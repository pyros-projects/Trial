class AudioRack {
  constructor(transport, config = {}) {
    this.transport = transport;
    this.config = Object.assign({
      bpm: 120,
      music: "neon",
      master: 0.65,
      drums: 0.8,
      bass: 0.7,
      melody: 0.6,
      pad: 0.4
    }, config);

    this.context = null;
    this.analyser = null;
    this.masterGain = null;
    this.compressor = null;
    this.tracks = Object.create(null);

    this.running = false;
    this.origin = 0;
    this.nextBeat = -4;
    this.pausedElapsed = 0;
    this.schedulerId = 0;
    this.voices = new Set();
    this.maxVoices = 56;

    this._unavailable = false;
    this._enablePromise = null;
    this._desiredContextRunning = false;
    this._contextTransition = Promise.resolve(true);
    this._lifecycleTicket = 0;
    this._fallbackOrigin = 0;
    this._noiseBuffer = null;
    this._lastScheduledTime = 0;
    this._events = 0;
    this._lateEvents = 0;
    this._timingErrorTotal = 0;
    this._timingSamples = 0;
    this._wave = new Uint8Array(1024);
    this._wave.fill(128);
    this._spectrum = new Uint8Array(512);
  }

  async enable() {
    if (this.context && this.context.state !== "closed") {
      try {
        await this.context.resume();
        this._unavailable = false;
        return true;
      } catch (error) {
        await this._enterSilentFallback(this.context);
        return false;
      }
    }
    if (this._enablePromise) return this._enablePromise;

    this._enablePromise = (async () => {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) {
        this._unavailable = true;
        return false;
      }
      try {
        const context = new AudioContextClass({ latencyHint: "interactive" });
        this.context = context;
        this._buildGraph(context);
        await context.resume();
        this._unavailable = false;
        return true;
      } catch (error) {
        await this._enterSilentFallback(this.context);
        return false;
      } finally {
        this._enablePromise = null;
      }
    })();
    return this._enablePromise;
  }

  start() {
    const ticket = ++this._lifecycleTicket;
    this._clearScheduler();
    this._stopVoices();
    this.nextBeat = -4;
    this.pausedElapsed = 0;
    this._events = 0;
    this._lateEvents = 0;
    this._timingErrorTotal = 0;
    this._timingSamples = 0;
    this._lastScheduledTime = 0;
    this._desiredContextRunning = true;

    if (this.context && !this._unavailable) {
      this.origin = this.context.currentTime + 0.12;
      this.running = true;
      this._beginScheduler();
      this._queueContextState().then(() => {
        if (ticket !== this._lifecycleTicket || !this._desiredContextRunning) return;
        if (this.context && this.context.state === "running" && !this.schedulerId) {
          this.running = true;
          this._beginScheduler();
        }
      });
      return;
    }

    this._fallbackOrigin = this._nowMs() + 120;
    this.running = true;
  }

  elapsed() {
    if (!this.running) return Math.max(0, this.pausedElapsed);
    if (this.context && !this._unavailable) {
      return Math.max(0, this.context.currentTime - this.origin);
    }
    return Math.max(0, (this._nowMs() - this._fallbackOrigin) / 1000);
  }

  async pause() {
    if (!this.running && !this._desiredContextRunning) return;
    const ticket = ++this._lifecycleTicket;
    if (this.running) this.pausedElapsed = this.elapsed();
    this.running = false;
    this._desiredContextRunning = false;
    this._clearScheduler();
    if (this.context && !this._unavailable) {
      await this._queueContextState();
      if (ticket === this._lifecycleTicket && !this._desiredContextRunning && this.context.state !== "running") {
        this.pausedElapsed = Math.max(0, this.context.currentTime - this.origin);
      }
    }
  }

  align(seconds) {
    const frozen = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    this.running = false;
    this._desiredContextRunning = false;
    this.pausedElapsed = frozen;
    this._clearScheduler();
    this._stopVoices();
    this.nextBeat = Math.ceil((this.transport.beatAt(frozen) + 1e-7) * 4) / 4;
    this._fallbackOrigin = this._nowMs() - frozen * 1000;
    if (this.context && !this._unavailable) {
      this.origin = this.context.currentTime - frozen;
      this._lastScheduledTime = this.context.currentTime;
    } else {
      this._lastScheduledTime = 0;
    }
  }

  async resume() {
    if (this.running) return true;
    const ticket = ++this._lifecycleTicket;
    const frozen = Math.max(0, this.pausedElapsed);
    this._desiredContextRunning = true;

    if (!this.context || this._unavailable) {
      this._fallbackOrigin = this._nowMs() - frozen * 1000;
      if (ticket === this._lifecycleTicket && this._desiredContextRunning) {
        this.running = true;
        return true;
      }
      return false;
    }

    const ready = await this._queueContextState();
    if (!ready || ticket !== this._lifecycleTicket || !this._desiredContextRunning) return false;
    this.running = true;
    this._beginScheduler();
    return true;
  }

  stop() {
    ++this._lifecycleTicket;
    this._desiredContextRunning = false;
    this.running = false;
    this.pausedElapsed = 0;
    this.origin = 0;
    this.nextBeat = -4;
    this._clearScheduler();
    this._stopVoices();
    if (this.context && !this._unavailable) this._queueContextState();
  }

  mix(config = {}) {
    for (const key of ["master", "drums", "bass", "melody", "pad"]) {
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        this.config[key] = this._level(config[key], this.config[key]);
      }
    }
    if (typeof config.music === "string" && ["neon", "drift", "ember"].includes(config.music)) {
      this.config.music = config.music;
    }
    if (!this.context) return;
    const at = this.context.currentTime;
    this._smoothGain(this.masterGain && this.masterGain.gain, this.config.master, at);
    for (const key of ["drums", "bass", "melody", "pad"]) {
      this._smoothGain(this.tracks[key] && this.tracks[key].gain, this.config[key], at);
    }
  }

  getWave() {
    if (!this.analyser) {
      const silence = new Uint8Array(this._wave.length);
      silence.fill(128);
      return silence;
    }
    if (this._wave.length !== this.analyser.fftSize) this._wave = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(this._wave);
    return this._wave;
  }

  getSpectrum() {
    if (!this.analyser) return new Uint8Array(this._spectrum.length);
    if (this._spectrum.length !== this.analyser.frequencyBinCount) {
      this._spectrum = new Uint8Array(this.analyser.frequencyBinCount);
    }
    this.analyser.getByteFrequencyData(this._spectrum);
    return this._spectrum;
  }

  diagnostics() {
    const wave = this.getWave();
    let sum = 0;
    for (let i = 0; i < wave.length; i += 1) {
      const sample = (wave[i] - 128) / 128;
      sum += sample * sample;
    }
    return {
      contextTime: this.context ? this.context.currentTime : null,
      audioState: this._unavailable || !this.context ? "unavailable" : this.context.state,
      ahead: this.context && this.running
        ? Math.max(0, this._lastScheduledTime - this.context.currentTime)
        : 0,
      events: this._events,
      timingError: this._timingSamples ? this._timingErrorTotal / this._timingSamples : 0,
      lateEvents: this._lateEvents,
      signalRms: wave.length ? Math.sqrt(sum / wave.length) : 0
    };
  }

  _buildGraph(context) {
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;

    this.masterGain = context.createGain();
    this.masterGain.gain.value = this._level(this.config.master, 0.65);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.72;

    for (const key of ["drums", "bass", "melody", "pad"]) {
      const gain = context.createGain();
      gain.gain.value = this._level(this.config[key], 0.7);
      gain.connect(this.compressor);
      this.tracks[key] = gain;
    }
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(context.destination);
    this._noiseBuffer = this._makeNoiseBuffer(context);
  }

  _beginScheduler() {
    if (!this.context || this.schedulerId || !this.running) return;
    this._schedule();
    this.schedulerId = setInterval(() => this._schedule(), 25);
  }

  _clearScheduler() {
    if (this.schedulerId) clearInterval(this.schedulerId);
    this.schedulerId = 0;
  }

  _schedule() {
    const context = this.context;
    if (!context || !this.running || context.state === "closed") return;
    const now = context.currentTime;
    const horizon = now + 0.12;
    let guard = 0;

    while (guard < 256) {
      const mapped = this._timeAt(this.nextBeat);
      const target = this.origin + mapped;
      if (!Number.isFinite(target) || target > horizon) break;

      if (target < now - 0.08) {
        this._lateEvents += 1;
      } else {
        const at = Math.max(target, now + 0.002);
        const error = Math.max(0, at - target);
        this._timingErrorTotal += error;
        this._timingSamples += 1;
        if (error > 0.012) this._lateEvents += 1;
        this._scheduleSubdivision(this.nextBeat, at);
        this._lastScheduledTime = Math.max(this._lastScheduledTime, at);
      }
      this.nextBeat += 0.25;
      guard += 1;
    }
  }

  _scheduleSubdivision(beat, at) {
    if (beat < 0) {
      if (Math.abs(beat - Math.round(beat)) < 0.00001) this._click(at, beat === -1);
      return;
    }

    const step = Math.round((((beat % 4) + 4) % 4) * 4) % 16;
    const measure = Math.floor(beat / 4);
    const phase = Math.min(2, Math.floor(Math.max(0, beat) / 32));
    const preset = this._preset();

    const kicks = phase === 0 ? [0, 8] : phase === 1 ? [0, 3, 8, 11] : [0, 6, 8, 14];
    if (kicks.includes(step)) this._kick(at, phase === 2 && (step === 6 || step === 14) ? 0.72 : 1);
    if (step === 4 || step === 12) this._snare(at, phase === 0 ? 0.82 : 1);
    if (phase > 0 && (step === 10 || (phase === 2 && step === 15))) this._snare(at, 0.28);

    const hatEveryStep = phase > 0;
    if (hatEveryStep || step % 2 === 0) {
      const open = (phase === 1 && step === 7) || (phase === 2 && (step === 7 || step === 15));
      this._hat(at, open ? 0.42 : (step % 4 === 0 ? 0.34 : 0.22), open);
    }

    const bassPatterns = [
      [0, null, 0, null, 3, null, 0, null, -2, null, 0, null, 3, null, 5, null],
      [0, null, 0, 3, null, 5, 0, null, -2, null, 3, null, 5, 3, null, 0],
      [0, null, 0, 3, 5, null, 7, 5, -2, null, 0, 3, 5, 3, 7, null]
    ];
    const bassDegree = bassPatterns[phase][step];
    if (bassDegree !== null) {
      const note = preset.bassRoot + this._scaleOffset(preset.scale, bassDegree);
      const duration = this._secondsBetween(beat, beat + (phase === 0 ? 0.42 : 0.3), 0.07, 0.32);
      this._bass(at, note, duration, preset, phase);
    }

    const playArp = phase === 0 ? step % 2 === 0 : true;
    if (playArp) {
      const arpIndex = (measure * (phase + 3) + step) % preset.arp.length;
      const octaveLift = phase === 2 && (step === 3 || step === 11) ? 12 : 0;
      const duration = this._secondsBetween(beat, beat + (phase === 0 ? 0.42 : 0.22), 0.045, 0.26);
      this._melody(at, preset.melodyRoot + preset.arp[arpIndex] + octaveLift, duration, preset, phase, step);
    }

    if (step === 0) {
      const progression = preset.progression[measure % preset.progression.length];
      const duration = this._secondsBetween(beat, beat + 3.85, 0.7, 3.5);
      this._pad(at, preset, progression, duration, phase);
    }
  }

  _click(at, accent) {
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(accent ? 1040 : 760, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.055 : 0.035, at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    oscillator.connect(gain).connect(this.tracks.drums);
    oscillator.start(at);
    oscillator.stop(at + 0.055);
    this._registerVoice([oscillator], [gain]);
    this._events += 1;
  }

  _kick(at, strength) {
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(145, at);
    oscillator.frequency.exponentialRampToValueAtTime(46, at + 0.105);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.72 * strength, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    oscillator.connect(gain).connect(this.tracks.drums);
    oscillator.start(at);
    oscillator.stop(at + 0.3);
    this._registerVoice([oscillator], [gain]);
    this._events += 1;
  }

  _snare(at, strength) {
    const context = this.context;
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = this._noiseBuffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 1850;
    noiseFilter.Q.value = 0.7;
    noiseGain.gain.setValueAtTime(0.0001, at);
    noiseGain.gain.exponentialRampToValueAtTime(0.3 * strength, at + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    noise.connect(noiseFilter).connect(noiseGain).connect(this.tracks.drums);

    const tone = context.createOscillator();
    const toneGain = context.createGain();
    tone.type = "triangle";
    tone.frequency.value = 184;
    toneGain.gain.setValueAtTime(0.0001, at);
    toneGain.gain.exponentialRampToValueAtTime(0.12 * strength, at + 0.002);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.105);
    tone.connect(toneGain).connect(this.tracks.drums);

    noise.start(at);
    noise.stop(at + 0.2);
    tone.start(at);
    tone.stop(at + 0.12);
    this._registerVoice([noise, tone], [noiseFilter, noiseGain, toneGain]);
    this._events += 1;
  }

  _hat(at, strength, open) {
    const context = this.context;
    const noise = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const gain = context.createGain();
    const length = open ? 0.19 : 0.055;
    noise.buffer = this._noiseBuffer;
    highpass.type = "highpass";
    highpass.frequency.value = open ? 6100 : 7600;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(strength, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    noise.connect(highpass).connect(gain).connect(this.tracks.drums);
    noise.start(at);
    noise.stop(at + length + 0.015);
    this._registerVoice([noise], [highpass, gain]);
    this._events += 1;
  }

  _bass(at, midi, duration, preset, phase) {
    const context = this.context;
    const oscillator = context.createOscillator();
    const sub = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const frequency = this._midi(midi);
    oscillator.type = preset.bassWave;
    sub.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, at);
    sub.frequency.setValueAtTime(frequency / 2, at);
    filter.type = "lowpass";
    filter.Q.value = phase === 2 ? 7 : 4;
    filter.frequency.setValueAtTime(phase === 0 ? 620 : 880, at);
    filter.frequency.exponentialRampToValueAtTime(190, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(phase === 2 ? 0.22 : 0.18, at + 0.008);
    gain.gain.setValueAtTime(phase === 2 ? 0.16 : 0.13, at + Math.min(0.045, duration * 0.45));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter);
    sub.connect(filter);
    filter.connect(gain).connect(this.tracks.bass);
    oscillator.start(at);
    sub.start(at);
    oscillator.stop(at + duration + 0.015);
    sub.stop(at + duration + 0.015);
    this._registerVoice([oscillator, sub], [filter, gain]);
    this._events += 1;
  }

  _melody(at, midi, duration, preset, phase, step) {
    const context = this.context;
    const oscillator = context.createOscillator();
    const echo = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const frequency = this._midi(midi);
    oscillator.type = preset.leadWave;
    echo.type = phase === 0 ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, at);
    echo.frequency.setValueAtTime(frequency * 1.003, at);
    filter.type = "lowpass";
    filter.Q.value = 2.4;
    filter.frequency.value = preset.leadCutoff + phase * 500;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(step % 4 === 0 ? 0.105 : 0.073, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter);
    echo.connect(filter);
    filter.connect(gain).connect(this.tracks.melody);
    oscillator.start(at);
    echo.start(at);
    oscillator.stop(at + duration + 0.012);
    echo.stop(at + duration + 0.012);
    this._registerVoice([oscillator, echo], [filter, gain]);
    this._events += 1;
  }

  _pad(at, preset, transpose, duration, phase) {
    const context = this.context;
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const sources = [];
    const nodes = [filter, gain];
    const extra = phase === 0 ? [] : phase === 1 ? [12] : [12, 19];
    const notes = preset.chord.concat(extra).slice(0, phase === 2 ? 6 : 5);
    filter.type = "lowpass";
    filter.frequency.value = preset.padCutoff + phase * 170;
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(phase === 2 ? 0.055 : 0.047, at + Math.min(0.28, duration * 0.18));
    gain.gain.setValueAtTime(phase === 2 ? 0.045 : 0.037, at + Math.max(0.3, duration * 0.72));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    for (let i = 0; i < notes.length; i += 1) {
      const oscillator = context.createOscillator();
      oscillator.type = preset.padWave;
      oscillator.detune.value = i % 2 ? 5 : -5;
      oscillator.frequency.setValueAtTime(this._midi(preset.padRoot + transpose + notes[i]), at);
      if (typeof context.createStereoPanner === "function") {
        const pan = context.createStereoPanner();
        pan.pan.value = notes.length === 1 ? 0 : -0.75 + (1.5 * i) / (notes.length - 1);
        oscillator.connect(pan).connect(filter);
        nodes.push(pan);
      } else {
        oscillator.connect(filter);
      }
      oscillator.start(at);
      oscillator.stop(at + duration + 0.025);
      sources.push(oscillator);
    }
    filter.connect(gain).connect(this.tracks.pad);
    this._registerVoice(sources, nodes);
    this._events += 1;
  }

  _registerVoice(sources, nodes) {
    while (this.voices.size >= this.maxVoices) {
      const oldest = this.voices.values().next().value;
      if (!oldest) break;
      oldest.stop();
    }
    let remaining = sources.length;
    let finished = false;
    const voice = {
      stop: () => {
        if (finished) return;
        finished = true;
        for (const source of sources) {
          try { source.stop(); } catch (error) { /* already stopped */ }
          try { source.disconnect(); } catch (error) { /* already disconnected */ }
        }
        for (const node of nodes) {
          try { node.disconnect(); } catch (error) { /* already disconnected */ }
        }
        this.voices.delete(voice);
      }
    };
    const ended = () => {
      remaining -= 1;
      if (remaining > 0 || finished) return;
      finished = true;
      for (const node of nodes) {
        try { node.disconnect(); } catch (error) { /* already disconnected */ }
      }
      this.voices.delete(voice);
    };
    for (const source of sources) source.addEventListener("ended", ended, { once: true });
    this.voices.add(voice);
  }

  _stopVoices() {
    for (const voice of Array.from(this.voices)) voice.stop();
    this.voices.clear();
  }

  async _enterSilentFallback(failedContext) {
    if (this.running && failedContext) {
      const musicalTime = Math.max(0, failedContext.currentTime - this.origin);
      this._fallbackOrigin = this._nowMs() - musicalTime * 1000;
    }
    this._clearScheduler();
    this._stopVoices();
    this.context = null;
    this.analyser = null;
    this.masterGain = null;
    this.compressor = null;
    this.tracks = Object.create(null);
    this._noiseBuffer = null;
    this._unavailable = true;
    if (failedContext && failedContext.state !== "closed") {
      try { await failedContext.close(); } catch (closeError) { /* silent fallback */ }
    }
  }

  _queueContextState() {
    this._contextTransition = this._contextTransition.catch(() => false).then(async () => {
      const context = this.context;
      if (!context || context.state === "closed") return false;
      for (let attempts = 0; attempts < 3; attempts += 1) {
        const desired = this._desiredContextRunning;
        try {
          if (desired && context.state !== "running") await context.resume();
          if (!desired && context.state === "running") await context.suspend();
        } catch (error) {
          return false;
        }
        if (desired === this._desiredContextRunning) break;
      }
      return this._desiredContextRunning ? context.state === "running" : context.state !== "running";
    });
    return this._contextTransition;
  }

  _preset() {
    switch (this.config.music) {
      case "drift":
        return {
          scale: [0, 2, 3, 7, 10], bassRoot: 43, melodyRoot: 67, padRoot: 55,
          arp: [0, 7, 10, 14, 15, 22, 15, 10], chord: [0, 3, 7, 10],
          progression: [0, -5, -2, -7], bassWave: "triangle", leadWave: "sine",
          padWave: "sine", leadCutoff: 2100, padCutoff: 920
        };
      case "ember":
        return {
          scale: [0, 3, 5, 7, 10], bassRoot: 40, melodyRoot: 76, padRoot: 52,
          arp: [0, 3, 7, 12, 15, 19, 22, 15], chord: [0, 3, 7, 10],
          progression: [0, -2, -5, 3], bassWave: "sawtooth", leadWave: "square",
          padWave: "sawtooth", leadCutoff: 1650, padCutoff: 690
        };
      case "neon":
      default:
        return {
          scale: [0, 3, 5, 7, 10], bassRoot: 45, melodyRoot: 69, padRoot: 57,
          arp: [0, 7, 12, 15, 19, 15, 12, 7], chord: [0, 3, 7, 10],
          progression: [0, -2, -5, -3], bassWave: "sawtooth", leadWave: "triangle",
          padWave: "triangle", leadCutoff: 2450, padCutoff: 840
        };
    }
  }

  _timeAt(beat) {
    if (this.transport && typeof this.transport.timeAt === "function") {
      const value = Number(this.transport.timeAt(beat));
      if (Number.isFinite(value)) return value;
    }
    return Number.NaN;
  }

  _secondsBetween(firstBeat, lastBeat, minimum, maximum) {
    const seconds = this._timeAt(lastBeat) - this._timeAt(firstBeat);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(seconds) ? seconds : minimum));
  }

  _scaleOffset(scale, degree) {
    const length = scale.length;
    const octave = Math.floor(degree / length);
    const index = ((degree % length) + length) % length;
    return octave * 12 + scale[index];
  }

  _makeNoiseBuffer(context) {
    const length = Math.max(1, Math.floor(context.sampleRate));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let state = 0x6d2b79f5;
    for (let i = 0; i < length; i += 1) {
      state = (state + 0x6d2b79f5) | 0;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      data[i] = (((value ^ value >>> 14) >>> 0) / 4294967296) * 2 - 1;
    }
    return buffer;
  }

  _smoothGain(param, value, at) {
    if (!param) return;
    param.cancelScheduledValues(at);
    param.setTargetAtTime(this._level(value, 0), at, 0.018);
  }

  _level(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(1.25, Math.max(0, number)) : fallback;
  }

  _midi(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  _nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }
}

if (typeof globalThis !== "undefined") globalThis.AudioRack = AudioRack;
