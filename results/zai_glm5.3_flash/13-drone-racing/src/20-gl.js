'use strict';
/* ============================= WebGL plumbing ============================= */
const G = {
  gl: null, canvas: null, isGL2: false,
  progs: {}, meshes: {},
  renderScale: 1, dpr: 1, width: 1, height: 1,   // drawing-buffer size of default framebuffer
  fbo: null, fboTex: null, fboDepth: null, fboW: 0, fboH: 0,
  proj: m4ident(), view: m4ident(), viewProj: m4ident(), invVP: m4ident(),
  camPos: v3(), stats: { drawCalls: 0 },
};

function glInit(canvas) {
  G.canvas = canvas;
  const opts = { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
  let gl = canvas.getContext('webgl2', opts);
  G.isGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  if (!gl) return null;
  G.gl = gl;
  gl.getExtension('OES_element_index_uint');
  gl.getExtension('OES_standard_derivatives');
  return gl;
}

function makeShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error('Shader compile error:', log, src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    throw new Error('Shader compile failed: ' + log);
  }
  return sh;
}
function makeProgram(gl, vsSrc, fsSrc, name) {
  const p = gl.createProgram();
  gl.attachShader(p, makeShader(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, makeShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    console.error('Program link error [' + name + ']:', log);
    throw new Error('Link failed [' + name + ']: ' + log);
  }
  const prog = { prog: p, name, u: {}, a: {} };
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); prog.u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); prog.a[info.name] = gl.getAttribLocation(p, info.name); }
  return prog;
}

/* ---- static mesh builder: positions, normals, colors(vec3), data(vec4: matId, seed, aux1, aux2) ---- */
class MeshBuilder {
  constructor(cap) {
    this.pos = []; this.nrm = []; this.col = []; this.dat = []; this.idx = [];
    this.mat = m4ident(); this.color = [1, 1, 1]; this.mdat = [0, 0, 0, 0];
  }
  clear() { this.pos.length = 0; this.nrm.length = 0; this.col.length = 0; this.dat.length = 0; this.idx.length = 0; }
  setTransform(m) { m4copy_(this.mat, m); return this; }
  setColor(c) { this.color[0] = c[0]; this.color[1] = c[1]; this.color[2] = c[2]; return this; }
  setData(d) { this.mdat[0] = d[0]; this.mdat[1] = d[1]; this.mdat[2] = d[2] || 0; this.mdat[3] = d[3] || 0; return this; }
  _t(p, out) { return m4transformPoint(out, this.mat, p); }
  _tn(n, out) { return m4transformDir(out, this.mat, n); }
  vert(px, py, pz, nx, ny, nz) {
    const p = this._t([px, py, pz], [0, 0, 0]);
    const n = this._tn([nx, ny, nz], [0, 0, 0]);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0] / l, n[1] / l, n[2] / l);
    this.col.push(this.color[0], this.color[1], this.color[2]);
    this.dat.push(this.mdat[0], this.mdat[1], this.mdat[2], this.mdat[3]);
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); return this; }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); return this; }
  /* box centered at (cx,cy,cz), sizes sx,sy,sz, optional rotY */
  addBox(cx, cy, cz, sx, sy, sz, rotY, colors) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const old = m4ident();
    if (rotY) qtmpM_(this.mat, cx, cy, cz, rotY); else qtmpM_(this.mat, cx, cy, cz, 0);
    const C = colors || this.color;
    const face = (nx, ny, nz, verts) => {
      this.setColor(C);
      const i0 = this.vert(verts[0][0], verts[0][1], verts[0][2], nx, ny, nz);
      const i1 = this.vert(verts[1][0], verts[1][1], verts[1][2], nx, ny, nz);
      const i2 = this.vert(verts[2][0], verts[2][1], verts[2][2], nx, ny, nz);
      const i3 = this.vert(verts[3][0], verts[3][1], verts[3][2], nx, ny, nz);
      this.quad(i0, i1, i2, i3);
    };
    face(0, 0, 1, [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]);
    face(0, 0, -1, [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]);
    face(1, 0, 0, [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]);
    face(-1, 0, 0, [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]);
    face(0, 1, 0, [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]);
    face(0, -1, 0, [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]);
    m4copy_(this.mat, old);
    this.setColor(this.color);
    return this;
  }
  /* vertical cylinder (axis Y), rTop may differ (cone when 0) */
  addCylinder(cx, cy, cz, rBot, rTop, h, seg, capped) {
    seg = seg || 12;
    const start = this.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * TAU, c = Math.cos(a), s = Math.sin(a);
      this.vert(cx + c * rBot, cy, cz + s * rBot, c, 0, s);
      this.vert(cx + c * (rTop || 0.001), cy + h, cz + s * (rTop || 0.001), c, 0, s);
    }
    for (let i = 0; i < seg; i++) {
      const a = start + i * 2;
      this.quad(a, a + 1, a + 3, a + 2);
    }
    if (capped !== false) {
      if (rTop > 0.001) {
        const c0 = this.vert(cx, cy + h, cz, 0, 1, 0);
        const ring = [];
        for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; ring.push(this.vert(cx + Math.cos(a) * rTop, cy + h, cz + Math.sin(a) * rTop, 0, 1, 0)); }
        for (let i = 0; i < seg; i++) this.tri(c0, ring[i], ring[i + 1]);
      }
      const c1 = this.vert(cx, cy, cz, 0, -1, 0);
      const ring2 = [];
      for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; ring2.push(this.vert(cx + Math.cos(a) * rBot, cy, cz + Math.sin(a) * rBot, 0, -1, 0)); }
      for (let i = 0; i < seg; i++) this.tri(c1, ring2[i + 1], ring2[i]);
    }
    return this;
  }
  /* torus in plane facing +Z of local frame (rotate into place by transform) */
  addTorus(R, r, segU, segV) {
    segU = segU || 28; segV = segV || 12;
    for (let i = 0; i <= segU; i++) {
      const u = i / segU * TAU, cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= segV; j++) {
        const v = j / segV * TAU, cv = Math.cos(v), sv = Math.sin(v);
        const nx = cu * cv, ny = su * cv, nz = sv;
        this.vert((R + r * cv) * cu, (R + r * cv) * su, r * sv, nx, ny, nz);
      }
    }
    for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j, b = a + segV + 1;
      this.quad(a, b, b + 1, a + 1);
    }
    return this;
  }
  /* ground-aligned disc (facing +Y), for pads */
  addDisc(cx, cy, cz, r, seg, ny) {
    ny = ny === undefined ? 1 : ny;
    const c = this.vert(cx, cy, cz, 0, ny, 0);
    const ring = [];
    for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; ring.push(this.vert(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r, 0, ny, 0)); }
    for (let i = 0; i < seg; i++) { if (ny >= 0) this.tri(c, ring[i], ring[i + 1]); else this.tri(c, ring[i + 1], ring[i]); }
    return this;
  }
  build(gl) {
    gl = gl || G.gl;
    const m = { count: this.idx.length };
    m.vboP = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vboP); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.pos), gl.STATIC_DRAW);
    m.vboN = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vboN); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.nrm), gl.STATIC_DRAW);
    m.vboC = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vboC); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.col), gl.STATIC_DRAW);
    m.vboD = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, m.vboD); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.dat), gl.STATIC_DRAW);
    m.ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.idx), gl.STATIC_DRAW);
    m.idxBig = true;
    return m;
  }
}
function m4copy_(o, a) { for (let i = 0; i < 16; i++) o[i] = a[i]; return o; }
const _tmpM = m4ident();
function qtmpM_(m, cx, cy, cz, rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  m[0] = c; m[1] = 0; m[2] = -s; m[3] = 0;
  m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
  m[8] = s; m[9] = 0; m[10] = c; m[11] = 0;
  m[12] = cx; m[13] = cy; m[14] = cz; m[15] = 1;
  return m;
}

function meshBindDraw(gl, prog, m) {
  gl.bindBuffer(gl.ARRAY_BUFFER, m.vboP); gl.enableVertexAttribArray(prog.a.aPos); gl.vertexAttribPointer(prog.a.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.vboN); gl.enableVertexAttribArray(prog.a.aNrm); gl.vertexAttribPointer(prog.a.aNrm, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, m.vboC); gl.enableVertexAttribArray(prog.a.aCol); gl.vertexAttribPointer(prog.a.aCol, 3, gl.FLOAT, false, 0, 0);
  if (prog.a.aData !== undefined && prog.a.aData >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, m.vboD); gl.enableVertexAttribArray(prog.a.aData); gl.vertexAttribPointer(prog.a.aData, 4, gl.FLOAT, false, 0, 0); }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
  gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
  G.stats.drawCalls++;
}

/* ---- framebuffer for post-processing ---- */
function fboEnsure(gl, w, h) {
  if (G.fbo && G.fboW === w && G.fboH === h) return;
  if (G.fbo) { gl.deleteFramebuffer(G.fbo); gl.deleteTexture(G.fboTex); gl.deleteRenderbuffer(G.fboDepth); }
  G.fboTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, G.fboTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  G.fboDepth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, G.fboDepth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  G.fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, G.fboTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, G.fboDepth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  G.fboW = w; G.fboH = h;
}

/* fullscreen triangle/quad buffer for sky + post */
function fsQuad(gl) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  return b;
}
