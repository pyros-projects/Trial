/* ============================================================================
   GL PLUMBING — one thin layer over WebGL2 with a WebGL1 fallback. Shaders are
   written in GLSL ES 1.00 so the same source compiles on both; instancing goes
   through either the WebGL2 core calls or ANGLE_instanced_arrays.
   ========================================================================== */
class GLContext {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.diag = { attempts: [] };
    const attrs = Object.assign({
      alpha: false, antialias: false, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false, desynchronized: false
    }, opts || {});
    let gl = null, isGL2 = false;
    try { gl = canvas.getContext('webgl2', attrs); isGL2 = !!gl; } catch (e) { this.diag.attempts.push('webgl2: ' + e.message); }
    if (!gl) {
      try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch (e) { this.diag.attempts.push('webgl: ' + e.message); }
    }
    if (!gl) { this.ok = false; return; }
    this.ok = true; this.gl = gl; this.isGL2 = isGL2;
    this.ext = {};
    if (!isGL2) {
      this.ext.inst = gl.getExtension('ANGLE_instanced_arrays');
      this.ext.uint = gl.getExtension('OES_element_index_uint');
      this.ext.vao = gl.getExtension('OES_vertex_array_object');
      this.ext.deriv = gl.getExtension('OES_standard_derivatives');
      if (!this.ext.inst) { this.ok = false; this.fatal = 'This WebGL1 driver has no ANGLE_instanced_arrays support.'; return; }
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : String(gl.getParameter(gl.RENDERER));
    this.vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : String(gl.getParameter(gl.VENDOR));
    this.software = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(this.renderer);
    this.limits = {
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxVarying: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxRenderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
    };
    this.programs = []; this.buffers = []; this.textures = []; this.fbos = [];
    this.drawCalls = 0; this.tris = 0;
  }

  /* ---- instancing shims ---- */
  divisor(loc, d) { this.isGL2 ? this.gl.vertexAttribDivisor(loc, d) : this.ext.inst.vertexAttribDivisorANGLE(loc, d); }
  drawInstanced(mode, count, type, offset, prim) {
    this.isGL2 ? this.gl.drawElementsInstanced(mode, count, type, offset, prim)
      : this.ext.inst.drawElementsInstancedANGLE(mode, count, type, offset, prim);
    this.drawCalls++; this.tris += (count / 3) * prim;
  }
  drawIndexed(mode, count, type, offset) {
    this.gl.drawElements(mode, count, type, offset); this.drawCalls++; this.tris += count / 3;
  }

  compile(type, src, name) {
    const gl = this.gl, sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      const numbered = src.split('\n').map((l, i) => String(i + 1).padStart(4) + '| ' + l).join('\n');
      gl.deleteShader(sh);
      throw new Error(`shader "${name}" failed:\n${log}\n${numbered}`);
    }
    return sh;
  }

  program(name, vsSrc, fsSrc, attribOrder) {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, vsSrc, name + '.vert');
    const fs = this.compile(gl.FRAGMENT_SHADER, fsSrc, name + '.frag');
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    if (attribOrder) attribOrder.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program "${name}" link failed: ${gl.getProgramInfoLog(p)}`);
    gl.deleteShader(vs); gl.deleteShader(fs);
    const obj = { name, p, u: {}, a: {} };
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); const n = info.name.replace(/\[0\]$/, ''); obj.u[n] = gl.getUniformLocation(p, n); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); obj.a[info.name] = gl.getAttribLocation(p, info.name); }
    this.programs.push(obj);
    return obj;
  }

  buffer(data, target, usage) {
    const gl = this.gl, b = gl.createBuffer();
    target = target || gl.ARRAY_BUFFER;
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, usage || gl.STATIC_DRAW);
    this.buffers.push(b);
    return b;
  }

  /** upload a mesh {pos,nrm,col,idx} into GPU buffers */
  uploadMesh(m) {
    const gl = this.gl;
    return {
      pos: this.buffer(m.pos), nrm: this.buffer(m.nrm), col: this.buffer(m.col),
      idx: this.buffer(m.idx, gl.ELEMENT_ARRAY_BUFFER),
      n: m.nIdx, type: m.idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
      verts: m.nVert
    };
  }

  texture(w, h, opts) {
    const gl = this.gl, o = opts || {}, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, o.internal || gl.RGBA, w, h, 0, o.format || gl.RGBA, o.type || gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, o.filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, o.filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.textures.push(t);
    return t;
  }

  /** colour target with optional depth renderbuffer */
  target(w, h, opts) {
    const gl = this.gl, o = opts || {};
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const tex = this.texture(w, h, o);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let depth = null;
    if (o.depth !== false) {
      depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, this.isGL2 ? gl.DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const t = { fb, tex, depth, w, h, status, ok: status === gl.FRAMEBUFFER_COMPLETE };
    this.fbos.push(t);
    return t;
  }
  resizeTarget(t, w, h, opts) {
    if (t.w === w && t.h === h) return t;
    const gl = this.gl, o = opts || {};
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, o.internal || gl.RGBA, w, h, 0, o.format || gl.RGBA, o.type || gl.UNSIGNED_BYTE, null);
    if (t.depth) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, t.depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, this.isGL2 ? gl.DEPTH_COMPONENT24 : gl.DEPTH_COMPONENT16, w, h);
    }
    t.w = w; t.h = h;
    return t;
  }
  bindTarget(t) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null);
    gl.viewport(0, 0, t ? t.w : this.canvas.width, t ? t.h : this.canvas.height);
  }
  errorString() {
    const e = this.gl.getError();
    if (!e) return null;
    const gl = this.gl;
    const map = { [gl.INVALID_ENUM]: 'INVALID_ENUM', [gl.INVALID_VALUE]: 'INVALID_VALUE', [gl.INVALID_OPERATION]: 'INVALID_OPERATION', [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY', [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION', [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST' };
    return map[e] || ('0x' + e.toString(16));
  }
}

/** describes one vertex attribute stream */
function bindAttrib(gl, glc, loc, buf, size, divisor, stride, offset) {
  if (loc == null || loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride || 0, offset || 0);
  glc.divisor(loc, divisor || 0);
}
