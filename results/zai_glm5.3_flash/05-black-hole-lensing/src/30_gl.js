/* ============================================================================
 *  WebGL2 boot, program compilation (with graceful failure reporting),
 *  render-target management.
 * ========================================================================= */
function fatal(title, msg, log){
  $('errTitle').textContent = title;
  $('errMsg').innerHTML = msg;
  $('errLog').textContent = log || '';
  $('errLog').style.display = log ? 'block' : 'none';
  $('errbox').classList.add('show');
}

function compileShader(gl, type, src, name){
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    const log = gl.getShaderInfoLog(sh) || '(no log)';
    gl.deleteShader(sh);
    throw Object.assign(new Error(name + ' failed to compile'), { gllog: log, name });
  }
  return sh;
}
function buildProgram(gl, vsSrc, fsSrc, name){
  let vs, fs;
  try {
    vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc, name + ' vertex shader');
    fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc, name + ' fragment shader');
  } catch(e){
    if(vs) gl.deleteShader(vs);
    if(fs) gl.deleteShader(fs);
    throw e;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    const log = gl.getProgramInfoLog(prog) || '(no log)';
    gl.deleteProgram(prog);
    throw Object.assign(new Error(name + ' failed to link'), { gllog: log, name });
  }
  return prog;
}
function locs(gl, prog, names){
  const u = {};
  for(const n of names) u[n] = gl.getUniformLocation(prog, n);
  return { prog, u };
}

/* float16 render target (falls back to compressed RGBA8) */
class Target {
  constructor(gl, w, h, floatOK){
    this.gl = gl; this.w = Math.max(2, w|0); this.h = Math.max(2, h|0);
    this.format = floatOK ? gl.RGBA16F : gl.RGBA8;
    this.type   = floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.w, this.h, 0, gl.RGBA, this.type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if(!ok) throw new Error('framebuffer incomplete');
  }
  resize(w, h){
    w = Math.max(2, w|0); h = Math.max(2, h|0);
    if(w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.w, this.h, 0, gl.RGBA, this.type, null);
  }
  dispose(){
    const gl = this.gl;
    gl.deleteTexture(this.tex); gl.deleteFramebuffer(this.fbo);
  }
}

function initGL(){
  const canvas = $('gl');
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha:false, antialias:false, depth:false, stencil:false,
      powerPreference:'high-performance', preserveDrawingBuffer:true,
    });
  } catch(e){ gl = null; }
  if(!gl){
    fatal('WebGL2 is not available',
      'This explorer traces relativistic photon paths in real time and needs <b>WebGL2</b>, ' +
      'which your browser or GPU driver does not provide (or has disabled).<br><br>' +
      'Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
    return null;
  }
  const floatExt = gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float');
  R.floatOK = !!floatExt;
  R.enc = floatExt ? 0 : 1;   // 0 = HDR f16 buffers, 1 = LDR fallback
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  R.gpu = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'WebGL2';
  R.gl = gl;
  return gl;
}
