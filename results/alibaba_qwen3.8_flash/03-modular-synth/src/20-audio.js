/* ============================================================
   MODSYN-8 — module 20: audio engine (graph + voices + FX)
   Works with both AudioContext and OfflineAudioContext.
   ============================================================ */

/* ---------- wave shaping curves ---------- */
function tanhCurve(n, k) {
  var c = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var x = (i * 2) / (n - 1) - 1;
    c[i] = Math.tanh(x * k) / Math.tanh(k);
  }
  return c;
}
function foldCurve(n, k) {
  var c = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var x = (i * 2) / (n - 1) - 1;
    var y = Math.tanh(x * k) / Math.tanh(k);
    c[i] = Math.max(-1, Math.min(1, y * 1.22 - Math.pow(y, 3) * 0.34));
  }
  return c;
}

/* ---------- procedural reverb impulse response ---------- */
function makeReverbIR(ctx, p) {
  var sr = ctx.sampleRate;
  var secs = clamp(p.size, 0.15, 6);
  var len = Math.max(1, Math.floor(sr * secs));
  var buf = ctx.createBuffer(2, len, sr);
  var decay = clamp(p.decay, 0.4, 12);
  var damp = clamp(p.damp, 0, 1);
  var r = rng((p.seed | 0) || 7);
  var k = Math.pow(0.5, 1 + damp * 6);        // one-pole smoothing for dark tails
  for (var ch = 0; ch < 2; ch++) {
    var d = buf.getChannelData(ch);
    var lp = 0, lp2 = 0;
    var pre = Math.floor(sr * 0.004);
    for (var i = 0; i < len; i++) {
      var t = i / sr;
      var n = r() * 2 - 1;
      lp = lp + k * (n - lp);                  // smoothed noise (metals/dark)
      lp2 = lp2 + k * (lp - lp2);              // 2nd order -> softer
      var env = Math.pow(Math.max(0, 1 - t / secs), decay);
      var early = 0;
      if (t < 0.06) {                          // a few discrete early reflections
        var er = Math.floor(t * sr) % 97;
        if (er === 0) early = (r() * 2 - 1) * 0.7;
      }
      var s = (lp2 * 1.9 + early) * env;
      if (i < pre) s *= i / pre;
      d[i] = clamp(s, -1, 1);
    }
    /* stereo decorrelation: flip polarity of alternating 12ms slices on R */
    if (ch === 1) {
      var slice = Math.floor(sr * 0.012);
      for (var j = 0; j < len; j += slice) {
        var pol = ((j / slice) | 0) % 2 ? -1 : 1;
        for (var m = j; m < Math.min(len, j + slice); m++) d[m] *= pol;
      }
    }
  }
  return buf;
}

/* ---------- master chain assembly ---------- */
function buildMaster(ctx, proj, E) {
  var fx = proj.fx;
  var mk = function (g) { var n = ctx.createGain(); n.gain.value = g === undefined ? 1 : g; return n; };

  var busDry = mk(1);                       // all dry track audio
  var fxRet = mk(1);                        // delay + reverb returns

  /* --- send buses --- */
  var dSend = mk(1);                        // per-track delay sends land here
  var rSend = mk(1);                        // per-track reverb sends

  /* --- ping-pong-ish stereo delay --- */
  var dIn = mk(fx.delay.mix);
  var maxD = 2.0;
  var dL = ctx.createDelay(maxD), dR = ctx.createDelay(maxD);
  dL.delayTime.value = fx.delay.time; dR.delayTime.value = fx.delay.time;
  var fbL = mk(fx.delay.fb), fbR = mk(fx.delay.fb);
  var lp1 = ctx.createBiquadFilter(), lp2 = ctx.createBiquadFilter();
  lp1.type = lp2.type = 'lowpass';
  var dFq = 400 + (1 - fx.delay.damp) * 14000;
  lp1.frequency.value = lp2.frequency.value = dFq;
  var panL = ctx.createStereoPanner(), panR = ctx.createStereoPanner();
  panL.pan.value = -0.75 * fx.delay.width; panR.pan.value = 0.75 * fx.delay.width;
  var dWet = mk(0.6);
  dSend.connect(dIn);
  dIn.connect(dL); dIn.connect(dR);
  dL.connect(fbL); fbL.connect(lp2); lp2.connect(dR);
  dR.connect(fbR); fbR.connect(lp1); lp1.connect(dL);
  dL.connect(panL); dR.connect(panR);
  panL.connect(dWet); panR.connect(dWet);
  dWet.connect(fxRet);

  /* --- procedural reverb (convolver with generated IR) --- */
  var rIn = mk(fx.verb.mix);
  var rPre = ctx.createDelay(0.2); rPre.delayTime.value = fx.verb.predelay;
  var conv = ctx.createConvolver();
  conv.normalize = false;
  conv.buffer = makeReverbIR(ctx, fx.verb);
  var rTrim = mk(0.55);
  rSend.connect(rIn);
  rIn.connect(rPre); rPre.connect(conv); conv.connect(rTrim); rTrim.connect(fxRet);

  /* --- FX chain stages --- */
  var satDry = mk(1 - fx.sat.mix);
  var shaper = ctx.createWaveShaper();
  shaper.curve = foldCurve(2048, Math.max(1.02, fx.sat.drive));
  shaper.oversample = '4x';
  var satLp = ctx.createBiquadFilter();
  satLp.type = 'lowpass';
  satLp.frequency.value = 900 + (1 - fx.sat.tone) * 15000;
  var satWet = mk(fx.sat.mix);
  var satOut = mk(0.9);
  var satSeg = { id: 'sat', on: !!fx.sat.on, heads: [satDry, shaper], tails: [satOut], nodes: [satDry, shaper, satLp, satWet, satOut] };
  shaper.connect(satLp); satLp.connect(satWet);
  satDry.connect(satOut); satWet.connect(satOut);

  var eqLow = ctx.createBiquadFilter(); eqLow.type = 'lowshelf';
  eqLow.frequency.value = fx.tone.fLow; eqLow.gain.value = fx.tone.low;
  var eqMid = ctx.createBiquadFilter(); eqMid.type = 'peaking';
  eqMid.frequency.value = fx.tone.fMid; eqMid.Q.value = 0.9; eqMid.gain.value = fx.tone.mid;
  var eqHi = ctx.createBiquadFilter(); eqHi.type = 'highshelf';
  eqHi.frequency.value = fx.tone.fHigh; eqHi.gain.value = fx.tone.high;
  var eqIn = mk(1), eqOut = mk(1);
  var toneSeg = { id: 'tone', on: !!fx.tone.on, heads: [eqIn], tails: [eqOut], nodes: [eqIn, eqLow, eqMid, eqHi, eqOut] };
  eqIn.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHi); eqHi.connect(eqOut);

  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = fx.lim.thr;
  comp.knee.value = 4;
  comp.ratio.value = fx.lim.ratio;
  comp.attack.value = fx.lim.atk;
  comp.release.value = fx.lim.rel;
  var limIn = mk(1), limOut = mk(1);
  var makeup = mk(fx.lim.makeup);
  var limSeg = { id: 'lim', on: !!fx.lim.on, heads: [limIn], tails: [limOut], nodes: [limIn, comp, makeup, limOut] };
  limIn.connect(comp); comp.connect(makeup); makeup.connect(limOut);

  var segs = [satSeg, toneSeg, limSeg];

  /* --- metering + output --- */
  var outG = mk(proj.master);
  var anPk = ctx.createAnalyser(); anPk.fftSize = 1024; anPk.smoothingTimeConstant = 0;
  var anScope = ctx.createAnalyser(); anScope.fftSize = 2048; anScope.smoothingTimeConstant = 0;
  var anSpec = ctx.createAnalyser(); anSpec.fftSize = 2048; anSpec.smoothingTimeConstant = 0.72;
  E.bufPk = new Float32Array(1024);
  E.bufScope = new Float32Array(2048);
  E.bufSpec = new Float32Array(anSpec.frequencyBinCount);

  var metroBus = mk(0);
  var masterTo = function (n) { busDry.connect(n); fxRet.connect(n); };

  E.busDry = busDry; E.fxRet = fxRet; E.dSend = dSend; E.rSend = rSend;
  E.dIn = dIn; E.dL = dL; E.dR = dR; E.fbL = fbL; E.fbR = fbR; E.lp1 = lp1; E.lp2 = lp2;
  E.panL = panL; E.panR = panR; E.dWet = dWet;
  E.rIn = rIn; E.rPre = rPre; E.conv = conv; E.rTrim = rTrim;
  E.shaper = shaper; E.satDry = satDry; E.satWet = satWet; E.satLp = satLp;
  E.eqLow = eqLow; E.eqMid = eqMid; E.eqHi = eqHi;
  E.comp = comp; E.makeup = makeup;
  E.outG = outG; E.anPk = anPk; E.anScope = anScope; E.anSpec = anSpec;
  E.metroBus = metroBus;
  E.segs = segs;
  E.chainSinks = [outG];

  /* first wire-up (before any toggle).
     Only the *path* wires are tracked here; the wiring inside each FX stage
     (created above) stays permanent, so bypass = re-path, not re-build. */
  E.wires = [];
  E.rewire = function () {
    E.wires.forEach(function (p) { try { p[0].disconnect(p[1]); } catch (e) { /* not connected */ } });
    E.wires = [];
    var link = function (a, b) { a.connect(b); E.wires.push([a, b]); };
    var walk = function (fromList, i) {
      if (i >= segs.length) {
        fromList.forEach(function (f) { link(f, outG); });
        return;
      }
      var s = segs[i];
      if (!s.on) { walk(fromList, i + 1); return; }
      fromList.forEach(function (f) { s.heads.forEach(function (h) { link(f, h); }); });
      walk(s.tails, i + 1);
    };
    walk([busDry, fxRet], 0);
    link(metroBus, outG);
    link(outG, anPk);
    link(anPk, anScope);
    link(anScope, anSpec);
    try { anSpec.connect(ctx.destination); } catch (e) { /* already connected */ }
  };
  E.rewire();
}

/* ---------- per-track signal chain ---------- */
function buildTracks(ctx, proj, E) {
  proj.tracks.forEach(function (def) {
    var p = def.inst;
    var g = function (v) { var n = ctx.createGain(); n.gain.value = v; return n; };
    var T = { def: def, p: p };
    T.in = g(1);                                     // voices land here
    T.mix = g(def.vol);                              // track volume
    T.pan = ctx.createStereoPanner(); T.pan.pan.value = def.pan;
    T.an = ctx.createAnalyser(); T.an.fftSize = 1024; T.an.smoothingTimeConstant = 0;
    T.buf = new Float32Array(1024);
    T.out = g(def.mute ? 0 : 1);                     // mute / solo gate
    T.sd = g(def.sendD);
    T.sr = g(def.sendR);
    T.in.connect(T.mix); T.mix.connect(T.pan);
    T.pan.connect(T.an); T.an.connect(T.out);
    T.out.connect(E.busDry);
    T.out.connect(T.sd); T.sd.connect(E.dSend);
    T.out.connect(T.sr); T.sr.connect(E.rSend);
    if (def.kind === 'mel') {
      T.lfo = ctx.createOscillator();
      T.lfo.type = p.lfoWave;
      T.lfo.frequency.value = p.lfoRate;
      T.lfoGain = g(lfoDepthToAmount(p));
      T.lfo.connect(T.lfoGain);
      try { T.lfo.start(0); } catch (e) { /* offline ctx needs startRendere */ }
    }
    E.T[def.id] = T;
  });
}

function lfoDepthToAmount(p) {
  var d = clamp(p.lfoDepth, 0, 1);
  switch (p.lfoTarget) {
    case 'pitch': return d * 320;        // cents
    case 'cutoff': return d * 3200;      // Hz
    case 'amp': return d * 0.55;
    case 'pan': return d * 0.85;
    default: return 0;
  }
}

/* ---------- engine factory ---------- */
function makeEngine(ctx, proj, opts) {
  opts = opts || {};
  var E = {
    ctx: ctx, proj: proj, offline: !!opts.offline,
    T: {}, active: [], dropped: 0, errors: [],
    maxTotal: opts.maxTotal || 48, label: opts.label || 'live'
  };
  var sr = ctx.sampleRate;
  var nlen = Math.floor(sr * 2);
  var nb = ctx.createBuffer(1, nlen, sr);
  var nd = nb.getChannelData(0);
  var r = rng(opts.noiseSeed || 987654321);
  for (var i = 0; i < nlen; i++) nd[i] = r() * 2 - 1;
  E.noise = nb;
  buildMaster(ctx, proj, E);
  buildTracks(ctx, proj, E);
  return E;
}

/* ---------- voice bookkeeping ---------- */
function trackVoices(E, id) {
  var n = 0;
  for (var i = 0; i < E.active.length; i++) if (E.active[i].t === id) n++;
  return n;
}
function pruneActive(E, now) {
  for (var i = E.active.length - 1; i >= 0; i--) if (E.active[i].end <= now) E.active.splice(i, 1);
}
function steal(E, id, poly) {
  var mine = [];
  for (var i = 0; i < E.active.length; i++) if (E.active[i].t === id) mine.push(E.active[i]);
  if (mine.length < poly) return true;
  mine.sort(function (a, b) { return a.born - b.born; });
  var drop = mine[0];
  if (drop && drop.kill) drop.kill();
  return true;
}
function killVoice(E, v) {
  for (var i = 0; i < E.active.length; i++) {
    if (E.active[i] === v) { E.active[i].kill(); E.active.splice(i, 1); return; }
  }
}

/* ---------- melodic voice ---------- */
/* v = {t:'trackId', p:midi, d:steps, v:vel, time:absStart, gateSec, chan:'seq'|'key', pitch} */
function playMel(E, T, t0, pitch, durSec, vel, chan) {
  var ctx = E.ctx, p = T.p, now = ctx.currentTime;
  pruneActive(E, now);
  if (E.active.length >= E.maxTotal) { E.dropped++; return null; }
  if (trackVoices(E, T.def.id) >= Math.max(1, p.poly | 0)) {
    var mine = [];
    for (var i = 0; i < E.active.length; i++) if (E.active[i].t === T.def.id) mine.push(E.active[i]);
    mine.sort(function (a, b) { return a.born - b.born; });
    if (mine.length) mine[0].kill();
  }
  var start = Math.max(t0, now + 0.0015);
  var gate = Math.max(0.022, durSec);
  var ampPeak = 0.30 * Math.pow(vel / 127, 1.15) * (p.poly > 2 ? 0.86 : 1.1);
  var rel = clamp(p.aR, 0.01, 4);
  var end = start + gate + rel + 0.02;

  var vca = ctx.createGain(); vca.gain.value = 0;
  var fIn = ctx.createGain(); fIn.gain.value = 1;

  /* filter (1 or 2 biquads) */
  var ftypes = { lowpass24: ['lowpass', 'lowpass'], lowpass12: ['lowpass'], highpass: ['highpass'], bandpass: ['bandpass'] };
  var kinds = ftypes[p.fType] || ftypes.lowpass24;
  var filters = [];
  for (var f = 0; f < kinds.length; f++) {
    var bq = ctx.createBiquadFilter();
    bq.type = kinds[f];
    bq.Q.value = kinds.length > 1 ? clamp(p.res, 0, 25) / 1.7 : clamp(p.res, 0, 25);
    bq.frequency.value = clamp(p.cutoff, 26, 16500);
    filters.push(bq);
  }
  /* head / tail of the filter chain */
  var fHead = filters[0], fTail = filters[filters.length - 1];
  for (var c = 0; c < filters.length - 1; c++) filters[c].connect(filters[c + 1]);

  /* oscillator bank */
  var freq = 440 * Math.pow(2, (pitch - 69) / 12);
  var oscs = [], mixO = ctx.createGain(); mixO.gain.value = 1;
  var mkOsc = function (wave, hz, level, det) {
    if (level <= 0.001) return;
    var o = ctx.createOscillator();
    o.type = wave;
    o.frequency.setValueAtTime(clamp(hz, 8, 18000), start);
    if (p.glide > 0.0005 && chan === 'seq') {
      o.frequency.setValueAtTime(clamp(hz * 0.94, 8, 18000), start);
      o.frequency.setTargetAtTime(clamp(hz, 8, 18000), start, Math.max(0.004, p.glide));
    }
    o.detune.value = det;
    var og = ctx.createGain(); og.gain.value = level;
    o.connect(og); og.connect(mixO);
    oscs.push(o);
    return o;
  };
  mkOsc(p.wave1, freq, 0.62, 0);
  mkOsc(p.wave2, freq * Math.pow(2, p.osc2Semis / 12), 0.62 * p.osc2Level, p.detune);
  /* per-voice LFO on pitch */
  var lfoTarget = p.lfoTarget;
  var ampNode = vca;
  if (T.lfoGain && lfoTarget === 'pitch') {
    oscs.forEach(function (o) { try { T.lfoGain.connect(o.detune); } catch (e) { } });
  }

  /* noise component (attack grit) */
  if (p.noise > 0.001) {
    var ns = ctx.createBufferSource();
    ns.buffer = E.noise; ns.loop = true;
    ns.playbackRate.value = 0.7 + 0.6 * ((pitch % 7) / 7);
    var ng = ctx.createGain(); ng.gain.value = 0.4 * p.noise;
    ns.connect(ng); ng.connect(fIn);
    oscs.push(ns);
    ns.start(start, (pitch * 0.137) % 1.5);
  }
  mixO.connect(fIn);

  /* optional per-voice panner for pan-LFO */
  var outNode = vca;
  if (T.lfoGain && lfoTarget === 'pan') {
    var vp = ctx.createStereoPanner();
    vp.pan.value = 0;
    try { T.lfoGain.connect(vp.pan); } catch (e) { }
    vca.connect(vp);
    outNode = vp;
  }

  fIn.connect(fHead);
  fTail.connect(vca);
  outNode.connect(T.in);

  /* amp envelope */
  var a = clamp(p.aA, 0.0008, 3), d = clamp(p.aD, 0.002, 4), s = clamp(p.aS, 0, 1);
  vca.gain.setValueAtTime(0.0001, start);
  vca.gain.linearRampToValueAtTime(ampPeak, start + a);
  vca.gain.linearRampToValueAtTime(Math.max(0.0001, ampPeak * s), start + a + d);
  if (gate > a + d) vca.gain.setValueAtTime(Math.max(0.0001, ampPeak * s), Math.max(start + a + d, start + gate));
  vca.gain.setTargetAtTime(0.0001, start + gate, Math.max(0.006, rel / 3.4));
  vca.gain.linearRampToValueAtTime(0.0001, end);

  /* filter envelope via constant source */
  var cs = null, fAmt = null;
  if (Math.abs(p.fEnv) > 1) {
    cs = ctx.createConstantSource();
    var fa = clamp(p.fA, 0.0008, 3), fd = clamp(p.fD, 0.002, 4), fs = clamp(p.fS, 0, 1);
    cs.offset.setValueAtTime(0, start);
    cs.offset.linearRampToValueAtTime(1, start + fa);
    cs.offset.linearRampToValueAtTime(fs, start + fa + fd);
    cs.offset.linearRampToValueAtTime(0, Math.max(start + fa + fd + 0.01, start + gate + Math.max(0.02, clamp(p.fR, 0.01, 3))));
    fAmt = ctx.createGain(); fAmt.gain.value = p.fEnv;
    cs.connect(fAmt);
    try { fAmt.connect(fHead.frequency); } catch (e) { }
    cs.start(start);
    cs.stop(end);
  }

  /* cutoff LFO */
  if (T.lfoGain && lfoTarget === 'cutoff') {
    try { T.lfoGain.connect(fHead.frequency); } catch (e) { }
  }
  /* amp tremolo LFO */
  if (T.lfoGain && lfoTarget === 'amp') {
    try { T.lfoGain.connect(vca.gain); } catch (e) { }
  }

  oscs.forEach(function (o) {
    if (o.bufferSource) { }
    try { o.start(start); } catch (e) { }
    try { o.stop(end); } catch (e) { }
  });

  var rec = {
    t: T.def.id, born: now, end: end, chan: chan,
    kill: function () {
      var k = Math.max(now, E.ctx.currentTime);
      try { vca.gain.cancelScheduledValues(k); } catch (e) { }
      try { vca.gain.setTargetAtTime(0.0001, k, 0.006); } catch (e) { }
      rec.end = k + 0.05;
      oscs.forEach(function (o) { try { o.stop(k + 0.06); } catch (e) { } });
      if (cs) { try { cs.stop(k + 0.06); } catch (e) { } }
    },
    dispose: function () {
      try { outNode.disconnect(); } catch (e) { }
      try { fIn.disconnect(); } catch (e) { }
      filters.forEach(function (q) { try { q.disconnect(); } catch (e) { } });
      if (fAmt) { try { fAmt.disconnect(); } catch (e) { } }
      if (cs) { try { cs.disconnect(); } catch (e) { } }
      try { mixO.disconnect(); } catch (e) { }
      oscs.forEach(function (o) { try { o.disconnect(); } catch (e) { } });
    }
  };
  E.active.push(rec);
  var ttl = (end - now) * 1000 + 120;
  if (!E.offline) setTimeout(function () { rec.dispose(); }, Math.min(ttl, 12000));
  return rec;
}

/* ---------- percussion voices ---------- */
function noiseSrc(E, t0, dur, rate) {
  var ctx = E.ctx;
  var n = ctx.createBufferSource();
  n.buffer = E.noise;
  n.loop = true;
  if (rate) n.playbackRate.value = rate;
  var off = (t0 * 7.3) % 1.5;
  n.start(t0, off);
  n.stop(t0 + dur + 0.02);
  return n;
}

function playPerc(E, T, t0, pitch, durSec, vel, chan, padDef) {
  var ctx = E.ctx, p = T.p, now = ctx.currentTime;
  pruneActive(E, now);
  if (E.active.length >= E.maxTotal) { E.dropped++; return null; }
  var voice = (padDef && padDef[1]) ? padDef[1] : p.voice;
  var tune = clamp(p.tune + ((padDef && padDef[3]) || 0), 0, 1), dec = p.decay, tone = p.tone, drv = p.drive;
  var amp = 0.5 * Math.pow(vel / 127, 1.1) * p.level;
  var start = Math.max(t0, now + 0.0015);
  var open = vel >= 110;
  var out = ctx.createGain(); out.gain.value = 1;
  var last = out, nodes = [out], srcs = [];
  var add = function (n) { nodes.push(n); return n; };

  /* drive stage shared by most voices */
  var drvNode = null;
  if (drv > 0.02) {
    drvNode = ctx.createWaveShaper();
    drvNode.curve = tanhCurve(1024, 1 + drv * 7);
    drvNode.oversample = '2x';
    drvNode.connect(out);
    last = drvNode;
  }
  var toChain = function (n) { n.connect(last); return n; };

  var mkVca = function (peak, atk, dcy) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + atk);
    g.gain.setTargetAtTime(0.0001, start + atk, Math.max(0.004, dcy));
    g.gain.linearRampToValueAtTime(0.0001, start + atk + dcy * 6 + 0.02);
    add(g);
    return g;
  };
  var total = 0.06;

  switch (voice) {
    case 'kick': {
      var f0 = 34 + tune * 150;
      var dcy = 0.06 + dec * 0.62;
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0 * 3.4, start);
      o.frequency.exponentialRampToValueAtTime(f0, start + Math.min(0.11, dcy * 0.42));
      o.frequency.setTargetAtTime(f0 * 0.92, start + dcy * 0.5, 0.09);
      var g1 = mkVca(amp * 1.15, 0.004, dcy);
      o.connect(g1); toChain(g1);
      srcs.push(o);
      /* beater click */
      var nz = noiseSrc(E, start, 0.05, 1);
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900 + tone * 3600;
      var ng = mkVca(amp * (0.16 + tone * 0.4), 0.001, 0.008 + tone * 0.012);
      nz.connect(hp); hp.connect(ng); toChain(ng);
      srcs.push(nz);
      total = dcy + 0.06;
      break;
    }
    case 'snare': {
      var dcy = 0.05 + dec * 0.42;
      var nz = noiseSrc(E, start, dcy + 0.05, 1);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 700 + tone * 4200; bp.Q.value = 0.75;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 240 + tune * 900;
      var g1 = mkVca(amp * 0.9, 0.002, dcy);
      nz.connect(bp); bp.connect(hp); hp.connect(g1); toChain(g1);
      srcs.push(nz);
      /* two tonal bodies */
      var b1 = ctx.createOscillator(); b1.type = 'triangle';
      b1.frequency.value = 150 + tune * 260;
      var b2 = ctx.createOscillator(); b2.type = 'triangle';
      b2.frequency.value = (150 + tune * 260) * 1.82;
      var g2 = mkVca(amp * 0.4, 0.002, 0.035 + dec * 0.09);
      b1.connect(g2); b2.connect(g2); toChain(g2);
      srcs.push(b1, b2);
      total = dcy + 0.08;
      break;
    }
    case 'clap': {
      var dcy = 0.06 + dec * 0.34;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 900 + tone * 1800; bp.Q.value = 1.3;
      var g1 = mkVca(amp * 0.8, 0.002, dcy);
      bp.connect(g1); toChain(g1);
      var gaps = [0, 0.011, 0.022, 0.036];
      gaps.forEach(function (dt, i) {
        var n = noiseSrc(E, start + dt, i === 3 ? dcy : 0.012, 1);
        var ng = ctx.createGain();
        ng.gain.value = i === 3 ? 0.55 : 0.85;
        n.connect(ng); ng.connect(bp);
        srcs.push(n);
      });
      total = dcy + 0.08;
      break;
    }
    case 'hat': {
      var dcy = (0.012 + dec * 0.3) * (open ? 3.2 : 1);
      var base = 84 + tune * 190;
      var ratios = [1, 1.0, 1.41, 1.53, 1.87, 2.13, 2.44, 3.01];
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 4200 + tone * 8000; bp.Q.value = 0.9;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass';
      hp.frequency.value = 5200 + tone * 4000;
      var g1 = mkVca(amp * 0.5, 0.001, dcy);
      bp.connect(hp); hp.connect(g1); toChain(g1);
      var mixH = ctx.createGain(); mixH.gain.value = 0.16; add(mixH);
      mixH.connect(bp);
      ratios.forEach(function (rt, i) {
        var o = ctx.createOscillator(); o.type = 'square';
        o.frequency.value = base * rt;
        o.detune.value = (i % 2 ? 9 : -7);
        o.connect(mixH);
        srcs.push(o);
      });
      var nz = noiseSrc(E, start, dcy + 0.03, 1.3);
      var ng2 = ctx.createGain(); ng2.gain.value = 0.22 + tone * 0.3;
      nz.connect(ng2); ng2.connect(bp);
      srcs.push(nz);
      total = dcy + 0.06;
      break;
    }
    case 'tom': {
      var f0 = 84 + tune * 260;
      var dcy = 0.06 + dec * 0.55;
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0 * 2.1, start);
      o.frequency.exponentialRampToValueAtTime(f0, start + Math.min(0.1, dcy * 0.35));
      var g1 = mkVca(amp * 0.95, 0.003, dcy);
      o.connect(g1); toChain(g1);
      srcs.push(o);
      var nz = noiseSrc(E, start, 0.04, 1);
      var bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass';
      bp2.frequency.value = 1200 + tone * 2600; bp2.Q.value = 1.1;
      var ng = mkVca(amp * 0.2, 0.001, 0.012);
      nz.connect(bp2); bp2.connect(ng); toChain(ng);
      srcs.push(nz);
      total = dcy + 0.06;
      break;
    }
    case 'cowbell': {
      var dcy = 0.03 + dec * 0.4;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1700 + tone * 1400; bp.Q.value = 2.4;
      var g1 = mkVca(amp * 0.62, 0.002, dcy);
      bp.connect(g1); toChain(g1);
      [544, 808].forEach(function (hz) {
        var o = ctx.createOscillator(); o.type = 'square';
        o.frequency.value = hz * (0.7 + tune * 0.65);
        o.connect(bp);
        srcs.push(o);
      });
      total = dcy + 0.05;
      break;
    }
    case 'rim': {
      var dcy = 0.008 + dec * 0.06;
      var o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = 420 + tune * 700;
      var nz = noiseSrc(E, start, 0.02, 1);
      var ng = ctx.createGain(); ng.gain.value = 0.5;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1700 + tone * 2400; bp.Q.value = 3.2;
      var g1 = mkVca(amp * 0.75, 0.001, dcy);
      o.connect(bp); nz.connect(ng); ng.connect(bp); bp.connect(g1); toChain(g1);
      srcs.push(o, nz);
      total = dcy + 0.04;
      break;
    }
    default: { /* zap — metallic FM-ish descend */
      var dcy = 0.02 + dec * 0.22;
      var car = ctx.createOscillator(); car.type = 'square';
      car.frequency.setValueAtTime(340 + tune * 900, start);
      car.frequency.exponentialRampToValueAtTime(62, start + dcy);
      var mod = ctx.createOscillator(); mod.type = 'sawtooth';
      mod.frequency.setValueAtTime(900 + tone * 3200, start);
      mod.frequency.exponentialRampToValueAtTime(90, start + dcy * 0.8);
      var mg = ctx.createGain(); mg.gain.value = 700 + tone * 2400;
      mod.connect(mg); mg.connect(car.frequency);
      var g1 = mkVca(amp * 0.7, 0.002, dcy);
      car.connect(g1); toChain(g1);
      srcs.push(car, mod);
      total = dcy + 0.05;
    }
  }

  out.connect(T.in);
  var end = start + total + 0.06;
  var rec = {
    t: T.def.id, born: now, end: end, chan: chan, perc: true,
    kill: function () {
      var k = Math.max(now, ctx.currentTime);
      try { out.gain.setTargetAtTime(0.0001, k, 0.004); } catch (e) { }
      rec.end = k + 0.03;
      srcs.forEach(function (s) { try { s.stop(k + 0.05); } catch (e) { } });
    },
    dispose: function () {
      try { out.disconnect(); } catch (e) { }
      nodes.forEach(function (n) { try { n.disconnect(); } catch (e) { } });
      srcs.forEach(function (s) { try { s.disconnect(); } catch (e) { } });
    }
  };
  E.active.push(rec);
  if (!E.offline) setTimeout(function () { rec.dispose(); }, Math.min((end - now) * 1000 + 140, 9000));
  return rec;
}

/* ---------- one-shot note entry point (used by sequencer + pads + keys) ---------- */
function playNote(E, trackId, t0, opt) {
  var T = E.T[trackId];
  if (!T || !T.def.on || T.def.mute) return null;
  if (E.soloActive && !T.def.solo) return null;
  var vel = clamp(num(opt.v, 96), 1, 127);
  var dur = num(opt.d, 2) * num(opt.stepDur, 0.15);
  var rec;
  try {
    if (T.def.kind === 'mel') rec = playMel(E, T, t0, num(opt.p, 60), dur, vel, opt.chan || 'seq');
    else rec = playPerc(E, T, t0, num(opt.p, 60), dur, vel, opt.chan || 'seq', opt.pad);
  } catch (err) {
    E.errors.push(String(err && err.message || err));
  }
  return rec;
}

/* ---------- live parameter updates ---------- */
function setTrackLevel(E, id, v) { var T = E.T[id]; if (T) T.mix.gain.setTargetAtTime(clamp(v, 0, 1.4), E.ctx.currentTime, 0.012); }
function setTrackPan(E, id, v) { var T = E.T[id]; if (T) T.pan.pan.setTargetAtTime(clamp(v, -1, 1), E.ctx.currentTime, 0.012); }
function setTrackSends(E, id, d, r) {
  var T = E.T[id]; if (!T) return;
  T.sd.gain.setTargetAtTime(clamp(d, 0, 1.5), E.ctx.currentTime, 0.02);
  T.sr.gain.setTargetAtTime(clamp(r, 0, 1.5), E.ctx.currentTime, 0.02);
}
function applySolo(E) {
  var any = E.proj.tracks.some(function (t) { return t.solo; });
  E.soloActive = any;
  E.proj.tracks.forEach(function (def) {
    var T = E.T[def.id]; if (!T) return;
    var open = !def.mute && (!any || def.solo);
    T.out.gain.setTargetAtTime(open ? 1 : 0, E.ctx.currentTime, 0.01);
  });
}
function setLfo(E, def) {
  var T = E.T[def.id]; if (!T || !T.lfo) return;
  var p = def.inst;
  T.lfo.type = (/^(sine|square|sawtooth|triangle)$/).test(p.lfoWave) ? p.lfoWave : 'sine';
  T.lfo.frequency.setTargetAtTime(clamp(p.lfoRate, 0.02, 40), E.ctx.currentTime, 0.03);
  T.lfoGain.gain.setTargetAtTime(lfoDepthToAmount(p), E.ctx.currentTime, 0.03);
}
function setFx(E, key, sub, val, timeSweep) {
  var ctx = E.ctx, now = ctx.currentTime;
  var sw = function (param, v, tc) {
    if (timeSweep) param.setTargetAtTime(v, now, tc || 0.02);
    else param.setValueAtTime(v, now);
  };
  switch (key + '/' + sub) {
    case 'delay/mix': sw(E.dIn.gain, clamp(val, 0, 1.2) * 0.9); break;
    case 'delay/time':
      E.dL.delayTime.setTargetAtTime(clamp(val, 0.01, 1.9), now, 0.03);
      E.dR.delayTime.setTargetAtTime(clamp(val, 0.01, 1.9), now, 0.03);
      break;
    case 'delay/fb': sw(E.fbL.gain, clamp(val, 0, 0.92)); sw(E.fbR.gain, clamp(val, 0, 0.92)); break;
    case 'delay/damp':
      var fq = 400 + (1 - clamp(val, 0, 1)) * 14000;
      sw(E.lp1.frequency, fq); sw(E.lp2.frequency, fq);
      break;
    case 'delay/width':
      var w = clamp(val, 0, 1) * 0.94;
      E.panL.pan.setValueAtTime(-w, now); E.panR.pan.setValueAtTime(w, now);
      break;
    case 'verb/mix': sw(E.rIn.gain, clamp(val, 0, 1.2) * 0.85); break;
    case 'verb/predelay': E.rPre.delayTime.setTargetAtTime(clamp(val, 0, 0.15), now, 0.02); break;
    case 'verb/size':
    case 'verb/decay':
    case 'verb/damp':
      E.conv.buffer = makeReverbIR(ctx, E.proj.fx.verb);
      break;
    case 'sat/mix':
      var m = clamp(val, 0, 1);
      E.satDry.gain.setTargetAtTime(1 - m, now, 0.02);
      E.satWet.gain.setTargetAtTime(m, now, 0.02);
      break;
    case 'sat/drive': E.shaper.curve = foldCurve(2048, Math.max(1.02, clamp(val, 1, 24))); break;
    case 'sat/tone': E.satLp.frequency.setTargetAtTime(900 + (1 - clamp(val, 0, 1)) * 15000, now, 0.02); break;
    case 'tone/low': sw(E.eqLow.gain, clamp(val, -18, 18)); break;
    case 'tone/mid': sw(E.eqMid.gain, clamp(val, -18, 18)); break;
    case 'tone/high': sw(E.eqHi.gain, clamp(val, -18, 18)); break;
    case 'tone/fLow': sw(E.eqLow.frequency, clamp(val, 30, 2000)); break;
    case 'tone/fMid': sw(E.eqMid.frequency, clamp(val, 200, 8000)); break;
    case 'tone/fHigh': sw(E.eqHi.frequency, clamp(val, 800, 14000)); break;
    case 'lim/thr': sw(E.comp.threshold, clamp(val, -60, 0)); break;
    case 'lim/ratio': sw(E.comp.ratio, clamp(val, 1, 30)); break;
    case 'lim/atk': sw(E.comp.attack, clamp(val, 0.0005, 0.2)); break;
    case 'lim/rel': sw(E.comp.release, clamp(val, 0.01, 1)); break;
    case 'lim/makeup': sw(E.makeup.gain, clamp(val, 0.1, 3)); break;
  }
}
function setFxOn(E, key, on) {
  var seg = E.segs.filter(function (s) { return s.id === ({ sat: 'sat', tone: 'tone', lim: 'lim' }[key]); })[0];
  if (seg) { seg.on = !!on; E.rewire(); }
}
function masterVolume(E, v) {
  E.outG.gain.setTargetAtTime(clamp(v, 0, 1.3), E.ctx.currentTime, 0.02);
}
function setMetro(E, on, vel) {
  E.metroBus.gain.setTargetAtTime(on ? (num(vel, 0.25)) : 0, E.ctx.currentTime, 0.01);
}
function clickAt(E, t, accent) {
  if (!E.proj.metro) return;
  var ctx = E.ctx;
  var o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = accent ? 2400 : 1500;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(accent ? 0.4 : 0.22, t + 0.001);
  g.gain.setTargetAtTime(0.0001, t + 0.002, 0.014);
  o.connect(g); g.connect(E.metroBus);
  o.start(t); o.stop(t + 0.09);
  setTimeout(function () { try { g.disconnect(); o.disconnect(); } catch (e) { } }, 800);
}

/* ---------- metering ---------- */
function readMaster(E) {
  var a = E.anPk, n = a.fftSize;
  a.getFloatTimeDomainData(E.bufPk);
  var L = 0, R = 0, pk = 0, cor = 0, eL = 0, eR = 0;
  var half = n / 2;
  for (var i = 0; i < half; i++) {
    var l = E.bufPk[i], r = E.bufPk[i + half];
    L += l * l; R += r * r;
    cor += l * r;
    eL += Math.abs(l); eR += Math.abs(r);
    var al = Math.abs(l), ar = Math.abs(r);
    if (al > pk) pk = al;
    if (ar > pk) pk = ar;
  }
  var rms = Math.sqrt((L + R) / n);
  var den = Math.sqrt(eL * eR) || 1e-9;
  return { rms: rms, peak: pk, corr: clamp(cor / den, -1, 1), width: clamp((eL + eR) / 2 / (Math.abs(eL - eR) + 0.05), 0, 1) };
}
function readTrack(E, id) {
  var T = E.T[id]; if (!T) return 0;
  T.an.getFloatTimeDomainData(T.buf);
  var s = 0, pk = 0;
  for (var i = 0; i < 512; i++) {
    var l = T.buf[i], r = T.buf[i + 512];
    s += l * l + r * r;
    var a = Math.abs(l), b = Math.abs(r);
    if (a > pk) pk = a; if (b > pk) pk = b;
  }
  return Math.sqrt(s / 1024);
}