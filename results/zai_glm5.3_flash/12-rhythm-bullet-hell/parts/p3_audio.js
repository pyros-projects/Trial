/* ============================================================
   CLOCK — shared musical transport clock.
   Follows AudioContext time while it genuinely advances (freezes
   on suspend -> drift-free pause). If the audio clock is dead or
   Web Audio is unavailable, falls back to a performance.now()
   timeline with continuity resync, so gameplay never stalls.
   ============================================================ */
const CLOCK = {
  audioOK: false, t0: 0,                    // t0 = transport time of gameTime 0
  _shift: 0, _paused: false, _pauseAt: 0,
  _aoff: 0, _aoffInit: false, _lastAnchor: 0,
  now() { return this._paused ? this._pauseAt : performance.now() / 1000 - this._shift; },
  game() { return this.now() - this.t0; },
  ctxTime(t) { return (AUDIO.ok && AUDIO.ctx) ? t + this._aoff : t; },
  maintainAudioOffset() {
    if (!AUDIO.ok || !AUDIO.ctx || AUDIO.ctx.state !== 'running') return;
    const target = AUDIO.ctx.currentTime - this.now();
    if (!this._aoffInit) { this._aoff = target; this._aoffInit = true; this._lastAnchor = this.now(); return; }
    // slow re-anchor only while the audio clock is plausible (within 80ms)
    if (Math.abs(target - this._aoff) < 0.08) {
      const dt = Math.max(0.001, this.now() - this._lastAnchor);
      this._aoff += (target - this._aoff) * Math.min(0.5, dt * 0.2);
    }
    this._lastAnchor = this.now();
  },
  pauseFallback() { if (!this._paused) this._pauseAt = this.now(); },
  resumeFallback() {
    if (this._paused) {
      this._paused = false;
      const d = performance.now() / 1000 - this._shift - this._pauseAt;
      this._shift += d;
      if (MUSIC.playing) MUSIC.nextStepTime += d;
    }
  },
};
/* ============================================================
   AUDIO — Web Audio graph: buses -> compressor -> master -> analyser -> out
   Plus a tempo-synced feedback delay send.
   ============================================================ */
const AUDIO = {
  ctx: null, ok: false, failed: false,
  master: null, comp: null, analyser: null, buses: null, sfx: null,
  delay: null, delayFb: null, delaySend: null,
  noise: null, wave: null, freq: null,

  ensure() {
    if (this.ok) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    if (this.failed) return false;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = true; return false; }
      const c = new AC();
      this.ctx = c;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 5;
      this.comp.attack.value = 0.004; this.comp.release.value = 0.24;
      this.master = c.createGain(); this.master.gain.value = SETTINGS.master;
      this.analyser = c.createAnalyser();
      this.analyser.fftSize = 1024; this.analyser.smoothingTimeConstant = 0.82;
      this.comp.connect(this.master); this.master.connect(this.analyser);
      this.analyser.connect(c.destination);
      this.buses = {};
      for (const name of ['drums', 'bass', 'lead', 'pad']) {
        const g = c.createGain();
        g.gain.value = SETTINGS.mutes[name] ? 0 : SETTINGS.tracks[name];
        g.connect(this.comp); this.buses[name] = g;
      }
      this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.comp);
      // tempo-synced delay
      this.delay = c.createDelay(2); this.delay.delayTime.value = 0.28;
      this.delayFb = c.createGain(); this.delayFb.gain.value = 0.3;
      const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
      this.delay.connect(dlp); dlp.connect(this.delayFb); this.delayFb.connect(this.delay);
      const dout = c.createGain(); dout.gain.value = 0.5; dlp.connect(dout); dout.connect(this.comp);
      this.delaySend = c.createGain(); this.delaySend.gain.value = 1; this.delaySend.connect(this.delay);
      // noise buffer
      const nb = c.createBuffer(1, c.sampleRate * 1.2 | 0, c.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noise = nb;
      this.wave = new Uint8Array(this.analyser.fftSize);
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.ok = true;
      CLOCK.audioOK = true;
      c.resume();
      // resilience: some browsers suspend the context despite a gesture;
      // any later user gesture retries resume.
      const kick = () => { if (AUDIO.ok && AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume().catch(() => { }); };
      window.addEventListener('pointerdown', kick, true);
      window.addEventListener('keydown', kick, true);
      window.addEventListener('touchstart', kick, true);
      setTimeout(() => { if (AUDIO.ok && AUDIO.ctx.state === 'suspended') toast('Audio suspended — click or press any key to enable sound'); }, 600);
      c.onstatechange = () => { /* reflected in status via CLOCK */ };
    } catch (e) {
      this.failed = true;
      toast('Web Audio unavailable — running on visual clock', true);
    }
    return this.ok;
  },
  suspend() { CLOCK.pauseFallback(); if (this.ok && this.ctx.state === 'running') this.ctx.suspend().catch(() => { }); },
  resume() { if (this.ok) this.ctx.resume().catch(() => { }); CLOCK.resumeFallback(); },
  setMaster(v) { if (this.ok) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03); },
  setTrack(name, v, muted) {
    if (!this.ok) return;
    this.buses[name].gain.setTargetAtTime(muted ? 0 : v, this.ctx.currentTime, 0.03);
  },
  sample() {
    if (!this.ok) return false;
    this.analyser.getByteTimeDomainData(this.wave);
    this.analyser.getByteFrequencyData(this.freq);
    return true;
  },
  bassEnergy() {
    if (!this.ok || !this.freq) return 0;
    let s = 0; for (let i = 1; i < 10; i++) s += this.freq[i];
    return s / (9 * 255);
  },
  duck(amount, backAfter) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, m = this.master.gain;
    m.cancelScheduledValues(t);
    m.setTargetAtTime(SETTINGS.master * amount, t, 0.02);
    m.setTargetAtTime(SETTINGS.master, t + backAfter, 0.12);
  },
};

/* ---------------- low-level voices ---------------- */
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

function vKick(t, vel) {
  const c = AUDIO.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(165, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
  o.connect(g); g.connect(AUDIO.buses.drums);
  o.start(t); o.stop(t + 0.32);
  const n = c.createBufferSource(); n.buffer = AUDIO.noise;
  const ng = c.createGain(), nf = c.createBiquadFilter();
  nf.type = 'lowpass'; nf.frequency.value = 900;
  ng.gain.setValueAtTime(vel * 0.35, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  n.connect(nf); nf.connect(ng); ng.connect(AUDIO.buses.drums);
  n.start(t, Math.random() * 0.5); n.stop(t + 0.05);
}
function vSnare(t, vel) {
  const c = AUDIO.ctx, n = c.createBufferSource(); n.buffer = AUDIO.noise;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  n.connect(f); f.connect(g); g.connect(AUDIO.buses.drums);
  n.start(t, Math.random() * 0.5); n.stop(t + 0.2);
  const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 196;
  const og = c.createGain();
  og.gain.setValueAtTime(vel * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(og); og.connect(AUDIO.buses.drums); o.start(t); o.stop(t + 0.1);
}
function vClap(t, vel) {
  const c = AUDIO.ctx;
  for (let i = 0; i < 3; i++) {
    const n = c.createBufferSource(); n.buffer = AUDIO.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.4;
    const g = c.createGain(); const tt = t + i * 0.011;
    g.gain.setValueAtTime(vel * (i === 2 ? 1 : 0.55), tt);
    g.gain.exponentialRampToValueAtTime(0.001, tt + (i === 2 ? 0.14 : 0.03));
    n.connect(f); f.connect(g); g.connect(AUDIO.buses.drums);
    n.start(tt, Math.random() * 0.5); n.stop(tt + 0.16);
  }
}
function vHat(t, open, vel) {
  const c = AUDIO.ctx, n = c.createBufferSource(); n.buffer = AUDIO.noise;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7400;
  const g = c.createGain(); const d = open ? 0.24 : 0.045;
  g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  n.connect(f); f.connect(g); g.connect(AUDIO.buses.drums);
  n.start(t, Math.random() * 0.5); n.stop(t + d + 0.03);
}
function vBass(t, midi, vel, dur) {
  const c = AUDIO.ctx, o = c.createOscillator(), sub = c.createOscillator();
  o.type = 'sawtooth'; o.frequency.value = midiHz(midi);
  sub.type = 'square'; sub.frequency.value = midiHz(midi - 12);
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(720, t);
  f.frequency.exponentialRampToValueAtTime(150, t + Math.min(0.24, dur));
  const g = c.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.008);
  g.gain.setValueAtTime(vel, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const sg = c.createGain(); sg.gain.value = 0.5;
  o.connect(f); sub.connect(sg); sg.connect(f); f.connect(g); g.connect(AUDIO.buses.bass);
  o.start(t); o.stop(t + dur + 0.05); sub.start(t); sub.stop(t + dur + 0.05);
}
function vLead(t, midi, vel, dur, wave, sendDelay) {
  const c = AUDIO.ctx;
  const g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 2600; f.Q.value = 1;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.setValueAtTime(vel, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
  for (const det of [-5, 5]) {
    const o = c.createOscillator();
    o.type = wave; o.frequency.value = midiHz(midi); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 0.1);
  }
  f.connect(g); g.connect(AUDIO.buses.lead);
  if (sendDelay) { const s = c.createGain(); s.gain.value = 0.28; g.connect(s); s.connect(AUDIO.delaySend); }
}
function vPad(t, midis, vel, dur) {
  const c = AUDIO.ctx;
  const g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 850;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.4);
  g.gain.setValueAtTime(vel, t + dur - 0.35);
  g.gain.linearRampToValueAtTime(0, t + dur);
  for (const m of midis) for (const det of [-7, 7]) {
    const o = c.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = midiHz(m); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 0.1);
  }
  f.connect(g); g.connect(AUDIO.buses.pad);
}
function vTick(t, accent) {
  const c = AUDIO.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.value = accent ? 1660 : 1180;
  g.gain.setValueAtTime(accent ? 0.16 : 0.09, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  o.connect(g); g.connect(AUDIO.sfx); o.start(t); o.stop(t + 0.06);
}
/* ---------------- UI sfx (respect master; skip if audio off) ---------------- */
function sfx(kind) {
  if (!AUDIO.ok || !AUDIO.ctx || AUDIO.ctx.state !== 'running') return;
  const c = AUDIO.ctx, t = c.currentTime;
  const blip = (freq, dur, vel, type) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(AUDIO.sfx); o.start(t); o.stop(t + dur + 0.02);
  };
  if (kind === 'shoot-perfect') blip(1900, 0.05, 0.045, 'triangle');
  else if (kind === 'shoot-good') blip(1400, 0.04, 0.03, 'triangle');
  else if (kind === 'graze') blip(2200, 0.03, 0.028, 'sine');
  else if (kind === 'dash') {
    const n = c.createBufferSource(); n.buffer = AUDIO.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3200, t + 0.12);
    const g = c.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    n.connect(f); f.connect(g); g.connect(AUDIO.sfx); n.start(t, Math.random() * 0.4); n.stop(t + 0.16);
  }
  else if (kind === 'hit') {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.26);
    g.gain.setValueAtTime(0.24, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(AUDIO.sfx); o.start(t); o.stop(t + 0.32);
  }
  else if (kind === 'bomb') {
    const n = c.createBufferSource(); n.buffer = AUDIO.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(3800, t); f.frequency.exponentialRampToValueAtTime(160, t + 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    n.connect(f); f.connect(g); g.connect(AUDIO.sfx); n.start(t, Math.random() * 0.3); n.stop(t + 0.6);
  }
  else if (kind === 'ui') blip(760, 0.05, 0.05, 'square');
  else if (kind === 'phase') blip(520, 0.3, 0.09, 'triangle');
}

/* ============================================================
   MUSIC — presets, arrangements, look-ahead scheduler.
   The same scheduler step stream drives audio voices AND pushes
   gameplay events (bullet emissions, beat markers) onto the
   game's event queue, so everything shares one musical transport.
   ============================================================ */
const PRESETS = {
  neon:   { name: 'Neon Circuit', root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6],
            style: 'house', leadWave: 'sawtooth', bpm: 118, motifSeed: 101 },
  sunset: { name: 'Sunset Drive', root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 5, 4],
            style: 'boombap', leadWave: 'triangle', bpm: 96, motifSeed: 202 },
  voltage:{ name: 'Voltage', root: 52, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 3, 1],
            style: 'break', leadWave: 'square', bpm: 132, motifSeed: 303 },
  star:   { name: 'Starlight', root: 48, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 4, 5, 3],
            style: 'soft', leadWave: 'triangle', bpm: 108, motifSeed: 404 },
};
const DRUM_STYLES = {
  house:   { k: [0, 4, 8, 12], s: [], c: [4, 12], h8: [0, 2, 4, 6, 8, 10, 12, 14], ho: [2, 6, 10, 14], sw: 0, bass: [0, 2, 4, 6, 8, 10, 12, 14] },
  break:   { k: [0, 7, 10], s: [4, 12], c: [4], h8: [0, 2, 4, 6, 8, 10, 12, 14], ho: [14], sw: 0.09, bass: [0, 3, 6, 8, 10, 12, 14] },
  boombap: { k: [0, 10], s: [4, 12], c: [12], h8: [0, 2, 4, 6, 8, 10, 12, 14], ho: [], sw: 0.16, bass: [0, 6, 8, 10, 14] },
  soft:    { k: [0, 8], s: [4, 12], c: [], h8: [0, 4, 8, 12], ho: [], sw: 0, bass: [0, 8] },
};

const MUSIC = {
  playing: false, arrangement: 0, stepIndex: 0, nextStepTime: 0,
  timer: null, HORIZON: 0.16, scheduled: 0, seq: null, lastStepInfo: null,
  stepDur() { return 15 / SETTINGS.tempo; },          // one 16th note
  beatDur() { return 60 / SETTINGS.tempo; },

  scaleAt(p, d) { const s = p.scale; return s[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7); },
  regenSeq(seed) {
    const p = PRESETS[SETTINGS.preset];
    const rng = mulberry32((seed >>> 0) ^ p.motifSeed);
    const seq = new Array(64).fill(null);
    let deg = 4 + (rng() * 3 | 0);
    for (let i = 0; i < 64; i++) {
      const onBeat = i % 4 === 0, onHalf = i % 8 === 4;
      const pr = onBeat ? 0.62 : onHalf ? 0.4 : i % 2 === 0 ? 0.22 : 0.1;
      if (rng() < pr) {
        deg += [(-2), -1, -1, 1, 1, 2, 3][(rng() * 7) | 0];
        deg = clamp(deg, 0, 11);
        seq[i] = { deg, len: rng() < 0.2 ? 2 : 1 };
      }
    }
    this.seq = seq;
  },

  start(when, arrangement) {
    this.arrangement = arrangement;
    this.stepIndex = 0; this.nextStepTime = when; this.playing = true;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  },
  stop() { this.playing = false; },
  setArrangement(a) { this.arrangement = a; },

  tick() {
    if (!this.playing) return;
    CLOCK.maintainAudioOffset();
    const now = CLOCK.now();
    // If the transport fell far behind (clock fallback resync, long tab jank),
    // fast-forward the step cursor instead of scheduling a storm of notes/events.
    if (this.nextStepTime < now - 0.25) {
      const sd = this.stepDur();
      let guardFF = 0;
      while (this.nextStepTime < now - 0.25 && guardFF++ < 200000) {
        this.nextStepTime += sd; this.stepIndex++;
      }
    } else if (this.nextStepTime > now + 0.5) {
      // stuck ahead (broken clock jumped forward): resync the cursor to reality
      this.nextStepTime = now + 0.05;
      this.resyncs = (this.resyncs || 0) + 1;
    }
    let guard = 0;
    while (this.nextStepTime < now + this.HORIZON && guard++ < 64) {
      this.scheduleStep(this.stepIndex, this.nextStepTime);
      this.stepIndex++;
      this.nextStepTime += this.stepDur();
    }
  },

  scheduleStep(i, tRaw) {
    const p = PRESETS[SETTINGS.preset];
    const st = i & 15, bar = i >> 4;
    const style = DRUM_STYLES[p.style];
    const beat = 60 / SETTINGS.tempo;
    const stepDur = beat / 4;
    const chordDeg = p.prog[bar % p.prog.length];
    const chordRoot = p.root + this.scaleAt(p, chordDeg);
    const A = this.arrangement;
    // gameplay grid events stay on the raw grid (no swing); emission is driven
    // deterministically from the sim's step cursor (see simTick), not here.
    // swing for audio only, then map transport time -> AudioContext time
    const t = CLOCK.ctxTime(tRaw + (st % 2 === 1 ? style.sw * stepDur : 0));
    if (AUDIO.ok) {
      if (A === 5) { this.stepVictory(i, t, p); return; }
      if (A === 6) { this.stepDefeat(i, t, p); return; }
      const quiet = A === 0 ? 0.5 : 1;
      // ---- drums ----
      if (A >= 1) {
        if (style.k.includes(st)) vKick(t, 0.85 * quiet);
        if (A >= 3 && st % 8 === 6) vKick(t, 0.4 * quiet);            // syncopated push
        if (style.s.includes(st)) vSnare(t, 0.5 * quiet);
        if (style.c.includes(st) && A >= 2) vClap(t, 0.3 * quiet);
        const sixteenth = A >= 3;
        const hatHits = sixteenth ? null : style.h8;
        if (hatHits ? hatHits.includes(st) : true) {
          const open = !sixteenth && style.ho.includes(st);
          const accent = st % 4 === 0 ? 0.3 : 0.16;
          vHat(t, open, accent * quiet * (A === 0 ? 0.7 : 1));
        }
        // snare roll at the end of every 4th bar in overdrive
        if (A === 4 && bar % 4 === 3 && st >= 12) vSnare(t, 0.14 + (st - 12) * 0.1);
      } else if (A === 0) {
        if (style.h8.includes(st)) vHat(t, false, st % 4 === 0 ? 0.2 : 0.1);
        if (st === 0) vKick(t, 0.5);
      }
      // ---- bass ----
      if (A >= 1 || A === 0) {
        if ((A === 0 && st === 8) || (A >= 1 && style.bass.includes(st))) {
          const oct = (A >= 3 && (st === 6 || st === 14)) ? 12 : 0;
          vBass(t, chordRoot - 12 + oct, (A === 0 ? 0.2 : 0.42), stepDur * 1.7);
        }
      }
      // ---- pad ----
      if (st === 0 && (A === 0 || A >= 1)) {
        const notes = [0, 2, 4].map(k => p.root + 12 + this.scaleAt(p, chordDeg + k));
        vPad(t, notes, A === 0 ? 0.05 : 0.06, beat * 4);
      }
      // ---- lead ----
      if (A >= 2 && this.seq) {
        const e = this.seq[i % 64];
        if (e) {
          const m = p.root + 24 + this.scaleAt(p, chordDeg + e.deg) + (A >= 3 ? 12 : 0);
          vLead(t, m, A === 2 ? 0.09 : 0.11, stepDur * e.len * 1.9, p.leadWave, true);
        }
      }
      // tempo-synced delay length each bar
      if (st === 0) AUDIO.delay.delayTime.setTargetAtTime(beat * 0.75, t, 0.1);
    }
    // count-in ticks are scheduled by startRun directly.
  },
  stepVictory(i, t, p) {
    if (!AUDIO.ok) return;
    const st = i & 15, bar = i >> 4;
    const fan = [0, 4, 7, 12, 16];
    if (st === 0) {
      const n = p.root + 24 + this.scaleAt(p, fan[bar % fan.length]);
      vLead(t, n, 0.16, 0.5, p.leadWave, true);
      vKick(t, 0.7);
      const notes = [0, 4, 7].map(k => p.root + 12 + this.scaleAt(p, fan[bar % fan.length] + k));
      vPad(t, notes, 0.07, 60 / SETTINGS.tempo * 4);
    }
    if (st === 8) vBass(t, p.root + this.scaleAt(p, fan[bar % fan.length]) - 12, 0.3, 0.3);
    if (st % 4 === 2) vHat(t, false, 0.18);
  },
  stepDefeat(i, t, p) {
    if (!AUDIO.ok) return;
    const st = i & 15;
    if (st === 0) {
      vKick(t, 0.8);
      vPad(t, [p.root, p.root + 3, p.root + 7].map(m => m + 12), 0.06, 60 / SETTINGS.tempo * 4);
      vBass(t, p.root - 12, 0.3, 0.6);
    }
    if (st === 10) vHat(t, false, 0.08);
  },
  scheduleCountIn(t0, beats) {
    if (!AUDIO.ok) return;
    const bd = this.beatDur();
    for (let i = 0; i < beats; i++) vTick(CLOCK.ctxTime(t0 - (beats - i) * bd), i === beats - 1);
  },
};
