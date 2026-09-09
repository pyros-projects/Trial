'use strict';
/* ============================= fx: particles + audio ============================= */
const FX = {
  max: 1400, n: 0,
  px: null, data: null, // cpu state
  gpu: null, gpuCol: null, gpuSize: null, vbo: null,
  parts: [],
};
FX.init = function (gl) {
  FX.gl = gl;
  FX.gpu = new Float32Array(FX.max * 3);
  FX.gpuCol = new Float32Array(FX.max * 4);
  FX.gpuSize = new Float32Array(FX.max);
  FX.vbo = { p: gl.createBuffer(), c: gl.createBuffer(), s: gl.createBuffer() };
};
FX.spawn = function (x, y, z, vx, vy, vz, opts) {
  if (FX.parts.length >= FX.max) FX.parts.shift();
  FX.parts.push({
    x, y, z, vx, vy, vz,
    life: opts.life, age: 0,
    size: opts.size, r: opts.r, g: opts.g, b: opts.b, a: opts.a,
    grav: opts.grav || 0, drag: opts.drag || 0, additive: !!opts.additive, shrink: opts.shrink || 0,
  });
};
FX.burstDust = function (pos, n, nx, ny, nz, power) {
  n = Math.round(n * FX.densityMul());
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, r = Math.random() * 2.5 * power;
    FX.spawn(pos[0] + nx * 0.2, pos[1] + 0.1, pos[2] + nz * 0.2,
      Math.cos(a) * r - nx * power * 2, (0.5 + Math.random()) * power * 1.6, Math.sin(a) * r - nz * power * 2,
      { life: 0.5 + Math.random() * 0.6, size: 10 + Math.random() * 16, r: 0.55, g: 0.48, b: 0.38, a: 0.5, grav: 2.5, drag: 1.8 });
  }
};
FX.burstSparks = function (pos, n, power) {
  n = Math.round(n * FX.densityMul());
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, e = Math.random() * Math.PI;
    const s = (2 + Math.random() * 7) * power;
    FX.spawn(pos[0], pos[1], pos[2], Math.cos(a) * Math.sin(e) * s, Math.abs(Math.cos(e)) * s + 1, Math.sin(a) * Math.sin(e) * s,
      { life: 0.25 + Math.random() * 0.45, size: 5 + Math.random() * 7, r: 1, g: 0.75 + Math.random() * 0.25, b: 0.3, a: 0.95, grav: 9, drag: 0.6, additive: true, shrink: 1 });
  }
};
FX.gateFlash = function (gate, color) {
  const n = Math.round(26 * FX.densityMul());
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const c = Math.cos(a) * gate.R, s = Math.sin(a) * gate.R;
    // position on ring in gate plane (right x up)
    const rx = gate.right[0] * c, ry = gate.right[1] * c, rz = gate.right[2] * c;
    const ux = -gate.n[1] * s * 0 + 0, uy = 0, uz = 0;
    // gate plane up vector = n × right
    const upx = gate.n[1] * gate.right[2] - gate.n[2] * gate.right[1];
    const upy = gate.n[2] * gate.right[0] - gate.n[0] * gate.right[2];
    const upz = gate.n[0] * gate.right[1] - gate.n[1] * gate.right[0];
    const px = gate.c[0] + rx + upx * s, py = gate.c[1] + ry + upy * s, pz = gate.c[2] + rz + upz * s;
    const sp = 1.5 + Math.random() * 2.5;
    FX.spawn(px, py, pz, (px - gate.c[0]) * sp * 0.6, (py - gate.c[1]) * sp * 0.6, (pz - gate.c[2]) * sp * 0.6,
      { life: 0.3 + Math.random() * 0.35, size: 7 + Math.random() * 9, r: color[0], g: color[1], b: color[2], a: 0.95, grav: 0.5, drag: 2, additive: true, shrink: 1 });
  }
};
FX.propWash = function (D, upw, throttle) {
  if (Math.random() > throttle * 0.6) return;
  const gy = FX.W ? FX.W.height(D.pos[0], D.pos[2]) : -1e9;
  const h = D.pos[1] - gy;
  if (h > 3.2) return;
  const k = (1 - h / 3.2);
  if (Math.random() < k * 0.7) {
    const a = Math.random() * TAU, r = 0.5 + Math.random() * 1.1;
    FX.spawn(D.pos[0] + Math.cos(a) * r, gy + 0.08, D.pos[2] + Math.sin(a) * r,
      Math.cos(a) * 2.5 * k, 0.3, Math.sin(a) * 2.5 * k,
      { life: 0.4 + Math.random() * 0.4, size: 9 + Math.random() * 12, r: 0.6, g: 0.55, b: 0.45, a: 0.3 * k, grav: -0.5, drag: 2.2 });
  }
};
FX.densityMul = function () { return P.particles === 'low' ? 0.4 : P.particles === 'high' ? 1.6 : 1; };

FX.update = function (dt) {
  const ps = FX.parts;
  let w = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    p.age += dt;
    if (p.age >= p.life) continue;
    p.vy -= p.grav * dt;
    const d = 1 - p.drag * dt;
    p.vx *= d; p.vy *= d; p.vz *= d;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    ps[w++] = p;
  }
  ps.length = w;
};

FX.fill = function (gl, prog) {
  // single pass: write all, two draws by blend mode
  let ai = 0, di = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const t = p.age / p.life;
    const a = p.a * (1 - t);
    const sz = p.size * (1 - (p.shrink ? t * 0.7 : 0));
    if (p.additive) {
      FX.gpu[ai * 3] = p.x; FX.gpu[ai * 3 + 1] = p.y; FX.gpu[ai * 3 + 2] = p.z;
      FX.gpuCol[ai * 4] = p.r; FX.gpuCol[ai * 4 + 1] = p.g; FX.gpuCol[ai * 4 + 2] = p.b; FX.gpuCol[ai * 4 + 3] = a;
      FX.gpuSize[ai] = sz; ai++;
    } else {
      if (!FX.gpuD) { FX.gpuD = new Float32Array(FX.max * 3); FX.gpuDCol = new Float32Array(FX.max * 4); FX.gpuDSize = new Float32Array(FX.max); FX.vboD = { p: gl.createBuffer(), c: gl.createBuffer(), s: gl.createBuffer() }; }
      FX.gpuD[di * 3] = p.x; FX.gpuD[di * 3 + 1] = p.y; FX.gpuD[di * 3 + 2] = p.z;
      FX.gpuDCol[di * 4] = p.r; FX.gpuDCol[di * 4 + 1] = p.g; FX.gpuDCol[di * 4 + 2] = p.b; FX.gpuDCol[di * 4 + 3] = a;
      FX.gpuDSize[di] = sz; di++;
    }
  }
  FX.nAdd = ai; FX.nDust = di;
};
FX.draw = function (gl, prog, mode) {
  const drawSet = (bufs, n) => {
    if (!n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.p); gl.bufferData(gl.ARRAY_BUFFER, bufs.pData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(prog.a.aPos); gl.vertexAttribPointer(prog.a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.c); gl.bufferData(gl.ARRAY_BUFFER, bufs.cData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(prog.a.aCol); gl.vertexAttribPointer(prog.a.aCol, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.s); gl.bufferData(gl.ARRAY_BUFFER, bufs.sData, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(prog.a.aSize); gl.vertexAttribPointer(prog.a.aSize, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, n);
    G.stats.drawCalls++;
  };
  if (mode !== 'dust' && FX.nAdd) drawSet({ p: FX.vbo.p, c: FX.vbo.c, s: FX.vbo.s, pData: FX.gpu.subarray(0, FX.nAdd * 3), cData: FX.gpuCol.subarray(0, FX.nAdd * 4), sData: FX.gpuSize.subarray(0, FX.nAdd) }, FX.nAdd);
  if (mode !== 'add' && FX.nDust) drawSet({ p: FX.vboD.p, c: FX.vboD.c, s: FX.vboD.s, pData: FX.gpuD.subarray(0, FX.nDust * 3), cData: FX.gpuDCol.subarray(0, FX.nDust * 4), sData: FX.gpuDSize.subarray(0, FX.nDust) }, FX.nDust);
};

/* ============================= procedural audio ============================= */
const AU = {
  ok: false, muted: false,
};
AU.init = function () {
  if (AU.ok) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.ctx = ctx;
    AU.master = ctx.createGain();
    AU.master.gain.value = P.volume;
    AU.master.connect(ctx.destination);
    // noise buffer
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    AU.noiseBuf = buf;
    // motor: noise -> bandpass -> gain
    AU.motorNoise = ctx.createBufferSource();
    AU.motorNoise.buffer = buf; AU.motorNoise.loop = true;
    AU.motorBP = ctx.createBiquadFilter(); AU.motorBP.type = 'bandpass'; AU.motorBP.frequency.value = 160; AU.motorBP.Q.value = 1.1;
    AU.motorGain = ctx.createGain(); AU.motorGain.gain.value = 0;
    AU.motorNoise.connect(AU.motorBP); AU.motorBP.connect(AU.motorGain); AU.motorGain.connect(AU.master);
    AU.motorNoise.start();
    // motor tone: saw -> lowpass -> gain
    AU.osc = ctx.createOscillator(); AU.osc.type = 'sawtooth'; AU.osc.frequency.value = 90;
    AU.osc2 = ctx.createOscillator(); AU.osc2.type = 'square'; AU.osc2.frequency.value = 91.7;
    AU.oscLP = ctx.createBiquadFilter(); AU.oscLP.type = 'lowpass'; AU.oscLP.frequency.value = 900;
    AU.oscGain = ctx.createGain(); AU.oscGain.gain.value = 0;
    AU.osc.connect(AU.oscLP); AU.osc2.connect(AU.oscLP); AU.oscLP.connect(AU.oscGain); AU.oscGain.connect(AU.master);
    AU.osc.start(); AU.osc2.start();
    // wind: noise -> lowpass -> gain
    AU.wind = ctx.createBufferSource(); AU.wind.buffer = buf; AU.wind.loop = true;
    AU.windLP = ctx.createBiquadFilter(); AU.windLP.type = 'lowpass'; AU.windLP.frequency.value = 500;
    AU.windGain = ctx.createGain(); AU.windGain.gain.value = 0;
    AU.wind.connect(AU.windLP); AU.windLP.connect(AU.windGain); AU.windGain.connect(AU.master);
    AU.wind.start();
    AU.ok = true;
  } catch (e) { console.warn('Audio unavailable:', e); }
};
AU.resume = function () { if (AU.ok && AU.ctx.state === 'suspended') AU.ctx.resume(); };
AU.update = function (D, spd) {
  if (!AU.ok) return;
  const t = AU.ctx.currentTime;
  const vol = AU.muted ? 0 : P.volume;
  const thr = D.crashed ? 0 : D.motorAvg;
  const g = vol * 0.16 * (0.12 + thr);
  AU.motorGain.gain.setTargetAtTime(g, t, 0.05);
  AU.motorBP.frequency.setTargetAtTime(120 + thr * 620 + D.motors[0] * 40, t, 0.05);
  AU.oscGain.gain.setTargetAtTime(vol * 0.055 * (0.1 + thr * 0.9), t, 0.05);
  AU.osc.frequency.setTargetAtTime(70 + thr * 180, t, 0.06);
  AU.osc2.frequency.setTargetAtTime((70 + thr * 180) * 1.013, t, 0.06);
  AU.oscLP.frequency.setTargetAtTime(500 + thr * 2600, t, 0.08);
  AU.windGain.gain.setTargetAtTime(vol * 0.11 * clamp((spd - 4) / 30, 0, 1) * (D.crashed ? 0.2 : 1), t, 0.1);
  AU.windLP.frequency.setTargetAtTime(300 + spd * 40, t, 0.1);
};
AU.beep = function (freq, dur, type, vol, slide) {
  if (!AU.ok || AU.muted || P.volume <= 0) return;
  const ctx = AU.ctx, t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol * P.volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(AU.master);
  o.start(t); o.stop(t + dur + 0.02);
};
AU.thud = function (power) {
  if (!AU.ok || AU.muted || P.volume <= 0) return;
  const ctx = AU.ctx, t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = AU.noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(clamp(power * 0.14, 0.02, 0.5) * P.volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(f); f.connect(g); g.connect(AU.master);
  src.start(t); src.stop(t + 0.25);
};
AU.gate = function () { AU.beep(880, 0.09, 'sine', 0.25); AU.beep(1320, 0.14, 'sine', 0.18); };
AU.lap = function () { AU.beep(660, 0.12, 'triangle', 0.3); setTimeout(() => AU.beep(880, 0.12, 'triangle', 0.3), 110); setTimeout(() => AU.beep(1100, 0.2, 'triangle', 0.3), 220); };
AU.best = function () { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => AU.beep(f, 0.16, 'triangle', 0.32), i * 90)); };
AU.warn = function () { AU.beep(220, 0.18, 'square', 0.22, -60); };
