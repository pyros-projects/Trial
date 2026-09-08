/* ============================================================================
   PROCEDURAL AUDIO — Web Audio only, no samples. The motor bed is four
   detuned saw oscillators (one per motor) whose frequency and level follow the
   actual mixer output, plus filtered noise for prop wash and airspeed.
   Everything is built inside a user gesture so autoplay policy is satisfied.
   ========================================================================== */
class AudioEngine {
  constructor() { this.ready = false; this.ctx = null; this.muted = false; this.volume = 0.7; this.lastErr = null; }

  init() {
    if (this.ready) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.lastErr = 'Web Audio API not available'; return false; }
      const ctx = this.ctx = new AC();
      const master = this.master = ctx.createGain();
      master.gain.value = this.volume;
      const comp = this.comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 22; comp.ratio.value = 7; comp.attack.value = 0.004; comp.release.value = 0.18;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 512;
      this._buf = new Float32Array(this.analyser.fftSize);
      master.connect(comp); comp.connect(this.analyser); this.analyser.connect(ctx.destination);

      /* ---- shared noise source (2 s of deterministic white noise) -------- */
      const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      const rnd = makeRng('AUDIO-NOISE');
      for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
      this.noiseBuf = buf;

      /* ---- motor bed --------------------------------------------------- */
      this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0.0;
      const motorLP = this.motorLP = ctx.createBiquadFilter();
      motorLP.type = 'lowpass'; motorLP.frequency.value = 2400; motorLP.Q.value = 0.7;
      this.motorGain.connect(motorLP); motorLP.connect(master);
      this.oscs = []; this.oscGains = [];
      const detune = [0, 7, -6, 13];
      for (let i = 0; i < 4; i++) {
        const o = ctx.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'square';
        o.frequency.value = 90; o.detune.value = detune[i];
        const g = ctx.createGain(); g.gain.value = 0.0;
        o.connect(g); g.connect(this.motorGain); o.start();
        this.oscs.push(o); this.oscGains.push(g);
      }
      /* sub-harmonic body so it does not sound like a mosquito */
      this.sub = ctx.createOscillator(); this.sub.type = 'sine'; this.sub.frequency.value = 45;
      this.subGain = ctx.createGain(); this.subGain.gain.value = 0;
      this.sub.connect(this.subGain); this.subGain.connect(master); this.sub.start();

      /* ---- prop wash (noise through a moving bandpass) ------------------ */
      this.wash = ctx.createBufferSource(); this.wash.buffer = buf; this.wash.loop = true;
      this.washBP = ctx.createBiquadFilter(); this.washBP.type = 'bandpass'; this.washBP.frequency.value = 900; this.washBP.Q.value = 0.9;
      this.washGain = ctx.createGain(); this.washGain.gain.value = 0;
      this.wash.connect(this.washBP); this.washBP.connect(this.washGain); this.washGain.connect(master); this.wash.start();

      /* ---- airspeed rush ----------------------------------------------- */
      this.wind = ctx.createBufferSource(); this.wind.buffer = buf; this.wind.loop = true;
      this.windLP = ctx.createBiquadFilter(); this.windLP.type = 'lowpass'; this.windLP.frequency.value = 1600;
      this.windHP = ctx.createBiquadFilter(); this.windHP.type = 'highpass'; this.windHP.frequency.value = 220;
      this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
      this.wind.connect(this.windHP); this.windHP.connect(this.windLP); this.windLP.connect(this.windGain);
      this.windGain.connect(master); this.wind.start();

      this.ready = true;
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    } catch (e) { this.lastErr = String(e && e.message || e); this.ready = false; return false; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = clamp(v, 0, 1); if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }
  setMuted(m) { this.muted = !!m; if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }

  /** called every rendered frame with live simulation state */
  update(drone, dt, doppler) {
    if (!this.ready || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime, tc = 0.045;
    const dop = clamp(1 - (doppler || 0) / 343, 0.72, 1.32);
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      const m = drone.motors[i];
      sum += m;
      const f = (78 + 430 * m) * dop;
      this.oscs[i].frequency.setTargetAtTime(f, t, tc);
      this.oscGains[i].gain.setTargetAtTime(0.055 * Math.pow(m, 1.35), t, tc);
    }
    const load = sum / 4;
    this.motorGain.gain.setTargetAtTime(drone.crashed ? 0.02 : 0.85, t, 0.08);
    this.motorLP.frequency.setTargetAtTime(900 + 3600 * load, t, tc);
    this.subGain.gain.setTargetAtTime(0.16 * Math.pow(load, 1.6), t, tc);
    this.sub.frequency.setTargetAtTime((38 + 66 * load) * dop, t, tc);
    this.washGain.gain.setTargetAtTime(0.11 * Math.pow(load, 1.2), t, tc);
    this.washBP.frequency.setTargetAtTime(500 + 2600 * load, t, tc);
    const spd = drone.speed();
    this.windGain.gain.setTargetAtTime(clamp(spd * spd * 0.00019, 0, 0.30), t, 0.09);
    this.windLP.frequency.setTargetAtTime(700 + spd * 60, t, 0.12);
  }

  /** one-shot noise burst — collisions */
  impact(strength, kind) {
    if (!this.ready || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime, s = clamp(strength, 0, 1);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + s * 0.9;
    const bp = ctx.createBiquadFilter(); bp.type = 'lowpass';
    bp.frequency.setValueAtTime(400 + 3600 * s, t);
    bp.frequency.exponentialRampToValueAtTime(140, t + 0.16 + s * 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(clamp(0.10 + 0.55 * s, 0.02, 0.7), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20 + s * 0.35);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    const off = t + 0.6 + s * 0.4;
    src.start(t); src.stop(off);
    /* body thud */
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140 + 90 * s, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(clamp(0.12 + 0.4 * s, 0.02, 0.55), t + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 0.4);
  }

  /** short musical blip — gates, laps, warnings */
  blip(freq, dur = 0.10, type = 'triangle', vol = 0.22, slideTo) {
    if (!this.ready || this.ctx.state !== 'running') return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  chord(freqs, dur = 0.5, vol = 0.16) { freqs.forEach((f, i) => setTimeout(() => this.blip(f, dur, 'triangle', vol), i * 90)); }

  gate(i, total) { this.blip(720 + (i / Math.max(1, total)) * 420, 0.09, 'triangle', 0.20); }
  lap(best) { best ? this.chord([784, 988, 1319], 0.45, 0.18) : this.chord([523, 659], 0.30, 0.14); }
  miss() { this.blip(220, 0.28, 'square', 0.16, 110); }
  warn() { this.blip(880, 0.06, 'square', 0.13); }
  crash() { this.impact(1, 'crash'); this.blip(150, 0.5, 'sawtooth', 0.16, 55); }

  /** RMS of the master bus — used by the diagnostics panel */
  level() {
    if (!this.ready || !this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this._buf);
    let s = 0; for (let i = 0; i < this._buf.length; i++) s += this._buf[i] * this._buf[i];
    return Math.sqrt(s / this._buf.length);
  }
  info() {
    if (!this.ctx) return { state: 'not created', err: this.lastErr };
    return { state: this.ctx.state, rate: this.ctx.sampleRate, volume: this.volume, muted: this.muted, level: +this.level().toFixed(4) };
  }
}
