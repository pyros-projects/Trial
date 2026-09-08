/* ============================================================================
 *  GL setup, frame loop (raytrace → temporal accumulation → bloom → composite),
 *  HUD, adaptive resolution, selection handling, boot.
 * ========================================================================= */
let gRay, gBlend, gBloom, gComp, vao;
let tScene = null, tAccA = null, tAccB = null, tBloomA = null, tBloomB = null;
let lastT = 0, lastHud = 0, adaptCount = 0;
const octx = $('ov').getContext('2d');

function setupGL(){
  const gl = R.gl;
  try {
    gRay = locs(gl, buildProgram(gl, VERT_SRC, raySrcFinal, 'raytrace'),
      ['uRes','uJit','uTime','uCamPos','uCamR','uCamU','uCamF','uFocal','uMode','uRs','uHorR','uSpin','uEscR',
       'uDN','uDU','uDV','uDin','uDout','uDh','uDtemp','uTurb','uDopK','uRedK','uStepMul','uMaxSteps','uEnc']);
    gBlend = locs(gl, buildProgram(gl, VERT_SRC, BLEND_FRAG_SRC, 'accum blend'), ['uHist','uCur','uRes','uAlpha']);
    gBloom = locs(gl, buildProgram(gl, VERT_SRC, BLOOM_FRAG_SRC, 'bloom'), ['uTex','uRes','uTexel','uThresh','uPass']);
    gComp  = locs(gl, buildProgram(gl, VERT_SRC, COMP_FRAG_SRC, 'composite'),
      ['uTex','uBloom','uRes','uExposure','uContrast','uBloomStr','uBeauty','uEnc','uBloomOn']);
  } catch(e){
    console.error(e);
    fatal('Shader compilation failed',
      'The GPU shader compiler rejected part of this renderer (' + (e.name || 'shader') + '). ' +
      'This is usually a GPU-driver compatibility issue. Try updating your graphics drivers or another browser. ' +
      'The compiler log below shows the exact failure.',
      e.gllog || String(e));
    return false;
  }
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  return true;
}

function reallocTargets(){
  const gl = R.gl, w = R.renderW, h = R.renderH;
  R.stage = 'realloc:scene';
  if(!tScene){ tScene = new Target(gl, w, h, R.floatOK); tAccA = new Target(gl, w, h, R.floatOK); tAccB = new Target(gl, w, h, R.floatOK); }
  else { tScene.resize(w, h); tAccA.resize(w, h); tAccB.resize(w, h); }
  const bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
  R.stage = 'realloc:bloom';
  if(!tBloomA){ tBloomA = new Target(gl, bw, bh, R.floatOK); tBloomB = new Target(gl, bw, bh, R.floatOK); }
  else { tBloomA.resize(bw, bh); tBloomB.resize(bw, bh); }
}

function onResize(){
  R.cssW = Math.max(2, window.innerWidth);
  R.cssH = Math.max(2, window.innerHeight);
  R.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  const gl = $('gl'), ov = $('ov');
  R.stage = 'resize:canvas';
  gl.width = Math.round(R.cssW*R.dpr);
  gl.height = Math.round(R.cssH*R.dpr);
  ov.width = gl.width; ov.height = gl.height;
  R.stage = 'resize:targets';
  updateRenderSize(true);
  R.stage = 'resize:done';
  R.accN = 0; R.dirty = true;
}
function updateRenderSize(force){
  const w = Math.max(2, Math.round(R.cssW*R.dpr*P.scale));
  const h = Math.max(2, Math.round(R.cssH*R.dpr*P.scale));
  if(force || w !== R.renderW || h !== R.renderH){
    R.renderW = w; R.renderH = h;
    reallocTargets();
    R.accN = 0;
  }
}

function halton(i, b){ let f = 1, r = 0; while(i > 0){ f /= b; r += f*(i%b); i = Math.floor(i/b); } return r; }

/* ---------------- camera update ---------------- */
function updateCamera(dt, now){
  if(cam.anim){
    const a = cam.anim;
    let t = (now - a.t0)/a.dur;
    if(t >= 1) t = 1;
    const e = t*t*(3 - 2*t);
    cam.yaw = lerp(a.from.yaw, a.to.yaw, e);
    cam.pitch = lerp(a.from.pitch, a.to.pitch, e);
    cam.dist = lerp(a.from.dist, a.to.dist, e);
    cam.target = [lerp(a.from.target[0], a.to.target[0], e),
                  lerp(a.from.target[1], a.to.target[1], e),
                  lerp(a.from.target[2], a.to.target[2], e)];
    markDirty();
    if(t === 1) cam.anim = null;
    return;
  }
  if(!R.pointerCount){
    if(Math.abs(cam.vyaw) > 1e-5 || Math.abs(cam.vpitch) > 1e-5){
      cam.yaw += cam.vyaw;
      cam.pitch = clamp(cam.pitch + cam.vpitch, -1.55, 1.55);
      const k = Math.exp(-4*dt);
      cam.vyaw *= k; cam.vpitch *= k;
      markDirty();
    }
    if(P.autoOrbit && !R.paused){ cam.yaw += dt*0.03; markDirty(); }
  }
}

/* ---------------- per-frame GL passes ---------------- */
function renderFrame(now){
  const gl = R.gl;
  const B = camBasis(), DB = diskBasis();
  const w = R.renderW, h = R.renderH;
  R.stage = 'render:' + w + 'x' + h;

  if(R.dirty){ R.accN = 0; R.dirty = false; }
  const staticScene = R.paused || P.timeScale === 0;
  const cap = Math.max(1, staticScene ? P.accumMax : Math.min(P.accumMax, 3));
  const alpha = 1/Math.min(R.accN + 1, cap);
  const doJitter = cap > 1;
  const jx = doJitter && R.accN > 0 ? halton(R.frame & 63, 2) - 0.5 : 0;
  const jy = doJitter && R.accN > 0 ? halton(R.frame & 63, 3) - 0.5 : 0;

  /* 1 · raytrace into scene target */
  gl.bindFramebuffer(gl.FRAMEBUFFER, tScene.fbo);
  gl.viewport(0, 0, w, h);
  gl.useProgram(gRay.prog);
  const u = gRay.u;
  gl.uniform2f(u.uRes, w, h);
  gl.uniform2f(u.uJit, jx, jy);
  gl.uniform1f(u.uTime, R.simTime);
  gl.uniform3f(u.uCamPos, B.pos[0], B.pos[1], B.pos[2]);
  gl.uniform3f(u.uCamR, B.right[0], B.right[1], B.right[2]);
  gl.uniform3f(u.uCamU, B.up[0], B.up[1], B.up[2]);
  gl.uniform3f(u.uCamF, B.fwd[0], B.fwd[1], B.fwd[2]);
  gl.uniform1f(u.uFocal, 1/Math.tan(deg2rad(P.fov)/2));
  gl.uniform1i(u.uMode, R.mode);
  gl.uniform1f(u.uRs, P.rs);
  gl.uniform1f(u.uHorR, horR());
  gl.uniform1f(u.uSpin, P.spin);
  gl.uniform1f(u.uEscR, escRadius());
  gl.uniform3f(u.uDN, DB.N[0], DB.N[1], DB.N[2]);
  gl.uniform3f(u.uDU, DB.U[0], DB.U[1], DB.U[2]);
  gl.uniform3f(u.uDV, DB.V[0], DB.V[1], DB.V[2]);
  gl.uniform1f(u.uDin, P.diskIn);
  gl.uniform1f(u.uDout, P.diskOut);
  gl.uniform1f(u.uDh, P.diskH);
  gl.uniform1f(u.uDtemp, P.temp);
  gl.uniform1f(u.uTurb, P.turb);
  gl.uniform1f(u.uDopK, P.dopK);
  gl.uniform1f(u.uRedK, P.redK);
  gl.uniform1f(u.uStepMul, P.stepMul);
  gl.uniform1i(u.uMaxSteps, Math.round(P.maxSteps));
  gl.uniform1i(u.uEnc, R.enc);
  R.stage = 'draw:ray';
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  R.stage = 'accum';

  /* 2 · temporal accumulation (ping-pong) */
  gl.bindFramebuffer(gl.FRAMEBUFFER, tAccB.fbo);
  gl.viewport(0, 0, w, h);
  gl.useProgram(gBlend.prog);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tScene.tex); gl.uniform1i(gBlend.u.uCur, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tAccA.tex); gl.uniform1i(gBlend.u.uHist, 1);
  gl.uniform2f(gBlend.u.uRes, w, h);
  gl.uniform1f(gBlend.u.uAlpha, alpha);
  R.stage = 'draw:blend';
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const tTmp = tAccA; tAccA = tAccB; tAccB = tTmp;
  R.accN = Math.min(R.accN + 1, 4096);

  /* 3 · bloom (quarter res, bright pass + separable blur) */
  R.stage = 'bloom';
  const bloomOn = R.mode === 0 && P.bloom > 0.001;
  if(bloomOn){
    const bw = tBloomA.w, bh = tBloomA.h;
    gl.useProgram(gBloom.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tBloomA.fbo);
    gl.viewport(0, 0, bw, bh);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tAccA.tex);
    gl.uniform1i(gBloom.u.uTex, 0);
    gl.uniform2f(gBloom.u.uRes, bw, bh);
    gl.uniform2f(gBloom.u.uTexel, 1/w, 1/h);
    gl.uniform1f(gBloom.u.uThresh, R.enc ? 0.4 : 0.6);
    gl.uniform1i(gBloom.u.uPass, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tBloomB.fbo);
    gl.viewport(0, 0, bw, bh);
    gl.bindTexture(gl.TEXTURE_2D, tBloomA.tex);
    gl.uniform2f(gBloom.u.uTexel, 1/bw, 1/bh);
    gl.uniform1i(gBloom.u.uPass, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, tBloomA.fbo);
    gl.bindTexture(gl.TEXTURE_2D, tBloomB.tex);
    gl.uniform1i(gBloom.u.uPass, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* 4 · composite to screen */
  R.stage = 'composite';
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  R.stage = 'draw:comp';
  gl.useProgram(gComp.prog);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tAccA.tex);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tBloomA.tex);
  gl.uniform1i(gComp.u.uTex, 0);
  gl.uniform1i(gComp.u.uBloom, 1);
  gl.uniform2f(gComp.u.uRes, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(gComp.u.uExposure, P.exposure);
  gl.uniform1f(gComp.u.uContrast, P.contrast);
  gl.uniform1f(gComp.u.uBloomStr, P.bloom);
  gl.uniform1i(gComp.u.uBeauty, R.mode === 0 ? 1 : 0);
  gl.uniform1i(gComp.u.uEnc, R.enc);
  gl.uniform1i(gComp.u.uBloomOn, bloomOn ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/* ---------------- HUD ---------------- */
function updateHUD(){
  const q = P.quality === 'auto' ? 'auto (adaptive)' + (R.adaptiveMsg ? ' · ' + R.adaptiveMsg : '') : P.quality;
  const gpuShort = R.gpu.length > 34 ? R.gpu.slice(0, 33) + '…' : R.gpu;
  $('hud').innerHTML =
    '<b>fps</b> ' + fmt(R.fps, 0) + ' · <b>frame</b> ' + fmt(R.msEMA, 1) + ' ms' + (R.paused ? '  <span class="warn">⏸ PAUSED</span>' : '') + '\n' +
    '<b>render</b> ' + R.renderW + '×' + R.renderH + ' @ ' + fmt(P.scale, 2) + '× · canvas ' + gl_w() + '×' + gl_h() + ' @' + fmt(R.dpr, 1) + ' dpr\n' +
    '<b>quality</b> ' + q + ' · <b>accum</b> ' + Math.min(R.accN, Math.max(1, P.accumMax)) + '/' + P.accumMax + ' fr · <b>enc</b> ' + (R.enc ? 'LDR fallback' : 'HDR16F') + '\n' +
    '<b>mode</b> ' + (R.mode + 1) + '/' + MODES.length + ' — ' + MODES[R.mode] + '\n' +
    '<b>camera</b> d=' + fmt(camDistRs(), 2) + ' rs · yaw ' + fmt(((rad2deg(cam.yaw)%360)+360)%360, 0) + '° · pitch ' + fmt(rad2deg(cam.pitch), 0) + '° · t=' + fmt(R.simTime, 1) + 's' + (P.autoOrbit ? ' · auto-orbit' : '') + '\n' +
    '<b>selected ray</b> ' + (R.selData ? (R.selData.steps + ' steps · b=' + fmt(R.selData.b, 2) + ' rs · ' + STATE_NAMES[R.selData.state]) : 'none (click image)') + '\n' +
    '<b>gpu</b> ' + gpuShort;
  UI.timeSlider && document.activeElement !== UI.timeSlider.input && UI.timeSlider.refresh();
}
function gl_w(){ return $('gl').width; }
function gl_h(){ return $('gl').height; }

/* ---------------- selection ---------------- */
function recomputeSel(now){
  if(!R.sel) return;
  if(now - R.lastSelCompute < 100 && !R.dirty) return;
  R.lastSelCompute = now;
  R.selData = traceRayCPU(R.sel.x, R.sel.y);
  updateRayPanel();
  drawDiagram();
}

/* ---------------- adaptive resolution ---------------- */
function adaptive(now, dt){
  if(P.quality !== 'auto') { R.adaptiveMsg = ''; return; }
  R.fps = lerp(R.fps || 60, 1/Math.max(dt, 1e-3), 0.05);
  adaptCount++;
  if(adaptCount >= 40){
    adaptCount = 0;
    if(R.fps < 34 && P.scale > 0.35){
      P.scale = Math.max(0.35, P.scale*0.88);
      R.adaptiveMsg = 'scale → ' + fmt(P.scale, 2) + '×';
      updateRenderSize(); UI.refreshers.forEach(f => f.refresh());
    } else if(R.fps > 72 && P.scale < 1.0){
      P.scale = Math.min(1.0, P.scale*1.05);
      R.adaptiveMsg = 'scale → ' + fmt(P.scale, 2) + '×';
      updateRenderSize(); UI.refreshers.forEach(f => f.refresh());
    } else R.adaptiveMsg = 'holding ' + fmt(P.scale, 2) + '×';
  }
}

/* ---------------- main loop ---------------- */
function frame(now){
  requestAnimationFrame(frame);
  const dt = clamp((now - lastT)/1000 || 0.016, 0.0001, 0.1);
  lastT = now;
  R.msEMA = lerp(R.msEMA || dt*1000, dt*1000, 0.06);
  R.fps = lerp(R.fps || 1/dt, 1/dt, 0.06);

  /* watchdog: a pathological frame (>1.2 s) degrades resolution to recover */
  if(R.msEMA > 1200 && P.scale > 0.2){
    P.scale = Math.max(0.2, P.scale*0.6);
    R.adaptiveMsg = 'watchdog → ' + fmt(P.scale, 2) + '×';
    console.warn('slow frame detected — render resolution reduced to', P.scale);
    updateRenderSize(); UI.refreshers.forEach(f => f.refresh());
  }

  if(!R.paused) R.simTime += dt*P.timeScale;
  updateCamera(dt, now);
  updateRenderSize(false);
  adaptive(now, dt);

  renderFrame(now);

  octx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  drawOverlay(octx);
  recomputeSel(now);

  if(now - lastHud > 250){ lastHud = now; updateHUD(); }
  R.frame++;
}

/* ---------------- boot ---------------- */
function boot(){
  const gl = initGL();
  if(!gl) return;  $('gl').addEventListener('webglcontextlost', e => {
    e.preventDefault();
    fatal('WebGL context lost', 'The GPU driver reset the WebGL context (long tab suspension or driver hiccup). Reload the page to restart the explorer.');
  });
  buildUI();
  const hadState = loadState();
  /* software rasterizers (SwiftShader/llvmpipe) get gentle settings — clamped
     even over persisted choices, so an old high-quality save can't wedge them */
  const softwareGL = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(R.gpu);
  R.softwareGL = softwareGL;
  /* touch devices / small screens get their own first-run budget */
  const mobileish = !hadState && (matchMedia('(pointer: coarse)').matches || window.innerWidth < 700);
  if(!hadState && mobileish && !softwareGL){
    P.quality = 'auto'; P.scale = Math.min(P.scale, 0.55); P.maxSteps = Math.min(P.maxSteps, 320); P.accumMax = 1;
    console.log('touch/small screen detected — starting in adaptive mobile mode');
  }
  if(softwareGL){
    P.scale = Math.min(P.scale, 0.32);
    P.maxSteps = Math.min(P.maxSteps, 128);
    P.accumMax = Math.min(P.accumMax, 2);
    if(!hadState) P.quality = 'auto';
    console.log('software rasterizer detected — clamping quality for interactivity');
  }
  UI.refreshers.forEach(f => f.refresh());
  initInput();
  R.stage = 'setupGL';
  if(!setupGL()) return;

  /* expose a small read-only hook for testing/diagnostics */
  window.__BH = { P, cam, R, OV, MODES, horR, photonR, iscoR, traceRayCPU, setMode, applyQuality, camBasis };

  window.addEventListener('resize', onResize);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  R.stage = 'onResize';
  onResize();
  R.stage = 'setMode';
  setMode(R.mode);
  updBHNote();
  R.stage = 'updateHUD';
  updateHUD();
  R.stage = 'raf';
  R.ready = true;
  console.log('black-hole explorer ready · GPU:', R.gpu, '· HDR buffers:', R.floatOK);
  requestAnimationFrame(t => { lastT = t; frame(t); });
}

/* dev-only helper: ?crashshader forces a shader compile error to exercise
   the graceful-failure path. Harmless in normal use. */
let raySrcFinal = RAY_FRAG_SRC;
if(new URLSearchParams(location.search).has('crashshader')){
  raySrcFinal = RAY_FRAG_SRC + '\nvoid brokenOnPurpose(){ float f = thisIsNotDeclared; }\n';
}
try {
  boot();
} catch(e){
  console.error('boot failed', e);
  fatal('Startup failure', 'The explorer failed during initialization: ' + e.message, (e && e.stack) || String(e));
}
