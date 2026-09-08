// Web Audio API Procedural Weather Synthesizer

class WeatherAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;

    this.masterGain = null;
    this.windGain = null;
    this.rainGain = null;
    this.thunderGain = null;

    this.masterVol = 0.7;
    this.windRainVol = 0.6;
    this.thunderVol = 0.8;

    this.windFilter = null;
    this.rainFilter = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.enabled = true;
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVol, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // 1. Wind Synthesizer (Filtered Noise)
    this.setupWind();

    // 2. Rain Synthesizer (Granular Noise)
    this.setupRain();

    // 3. Thunder Bus
    this.thunderGain = this.ctx.createGain();
    this.thunderGain.gain.setValueAtTime(this.thunderVol, this.ctx.currentTime);
    this.thunderGain.connect(this.masterGain);

    this.enabled = true;
  }

  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    // Pink noise generation
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  setupWind() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    noise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    noise.start();
  }

  setupRain() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    noise.loop = true;

    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = "lowpass";
    this.rainFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    noise.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    noise.start();
  }

  // Modulate atmospheric soundscape with live simulation state
  update(sim, renderer) {
    if (!this.enabled || !this.ctx) return;

    const t = this.ctx.currentTime;
    const camWind = sim.stats.maxWindSpeed / 3.6; // m/s
    const targetFreq = Math.min(1800, 250 + camWind * 45.0);
    const targetWindGain = Math.min(0.8, (camWind / 35.0) * this.windRainVol);

    this.windFilter.frequency.setTargetAtTime(targetFreq, t, 0.2);
    this.windGain.gain.setTargetAtTime(targetWindGain, t, 0.2);

    const rainRate = sim.stats.maxPrecipRate; // mm/h
    const targetRainGain = Math.min(0.9, (rainRate / 60.0) * this.windRainVol);
    const targetRainCutoff = Math.min(4500, 600 + rainRate * 60.0);

    this.rainFilter.frequency.setTargetAtTime(targetRainCutoff, t, 0.2);
    this.rainGain.gain.setTargetAtTime(targetRainGain, t, 0.2);
  }

  // Trigger distance-delayed acoustic thunder
  triggerThunder(strikeX, strikeY, strikeZ, sim, renderer) {
    if (!this.enabled || !this.ctx) return;

    // Calculate physical 3D distance between lightning and camera
    const nx = sim.nx, ny = sim.ny, nz = sim.nz;
    const worldX = (strikeX / (nx - 1) - 0.5) * 48000.0; // in meters
    const worldY = (strikeY / (ny - 1) - 0.5) * 48000.0;
    const worldZ = (strikeZ / (nz - 1)) * 11200.0;

    const camX = renderer.camPos[0] * 1000.0;
    const camY = renderer.camPos[1] * 1000.0;
    const camZ = renderer.camPos[2] * 1000.0;

    const distM = Math.hypot(worldX - camX, worldY - camY, worldZ - camZ);
    // Speed of sound = 340 m/s
    const soundDelay = Math.min(6.0, Math.max(0.15, distM / 3400.0)); // scaled delay for domain feel

    const startTime = this.ctx.currentTime + soundDelay;

    // Sub-bass rumbler
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(65, startTime);
    osc.frequency.exponentialRampToValueAtTime(25, startTime + 2.5);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.001, startTime);
    oscGain.gain.exponentialRampToValueAtTime(0.9 * this.thunderVol, startTime + 0.15);
    oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 3.5);

    osc.connect(oscGain);
    oscGain.connect(this.thunderGain);
    osc.start(startTime);
    osc.stop(startTime + 3.6);

    // Filtered crackle & rolling rumble noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, startTime);
    filter.frequency.exponentialRampToValueAtTime(110, startTime + 3.0);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.7 * this.thunderVol, startTime + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 4.0);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.thunderGain);

    noise.start(startTime);
    noise.stop(startTime + 4.2);
  }

  setMasterVolume(val) {
    this.masterVol = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  setThunderVolume(val) {
    this.thunderVol = val;
    if (this.thunderGain && this.ctx) {
      this.thunderGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }

  setWindRainVolume(val) {
    this.windRainVol = val;
  }

  toggleAudio() {
    if (!this.ctx || this.ctx.state === "suspended") {
      this.init();
      return true;
    } else {
      if (this.enabled) {
        this.ctx.suspend();
        this.enabled = false;
        return false;
      } else {
        this.ctx.resume();
        this.enabled = true;
        return true;
      }
    }
  }
}
