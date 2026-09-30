// ============================================================ AUDIO
// Procedural Web Audio. The context is created lazily on the first user
// gesture (browsers block autoplay); every sound is synthesised on the fly.
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null; const recent = new Map();
  const st = { enabled: true, vol: 0.6, played: 0, last: '-', state: 'not started (waiting for a click/key)' };
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { st.state = 'unsupported'; return; }
    try {
      ac = new AC(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
      master = ac.createGain(); master.gain.value = st.enabled ? st.vol : 0; master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); const r = makeRng('noise'); for (let i = 0; i < d.length; i++) d[i] = rnext(r) * 2 - 1;
      st.state = ac.state; ac.onstatechange = () => { st.state = ac.state; };
      if (ac.state === 'suspended') ac.resume().catch(() => {});
    } catch (e) { st.state = 'error: ' + e.message; ac = null; }
  }
  function setVol(v) { st.vol = v; if (master) master.gain.setTargetAtTime(st.enabled ? v : 0, ac.currentTime, 0.02); }
  function setEnabled(on) { st.enabled = on; setVol(st.vol); }
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function tone(type, f0, f1, dur, peak, delay = 0) {
    const t = ac.currentTime + delay; const o = ac.createOscillator(); const g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.006, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, peak, ftype, f0, f1, delay = 0, q = 1) {
    const t = ac.currentTime + delay; const src = ac.createBufferSource(); src.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain(); env(g, t, 0.004, peak, dur); src.connect(f); f.connect(g); g.connect(master); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const arp = (notes, type, step, dur, peak) => notes.forEach((n, i) => tone(type, n, n, dur, peak, i * step));
  const defs = {
    hit: () => { noise(0.09, 0.22, 'bandpass', 900, 280, 0, 2); tone('square', 150, 60, 0.1, 0.08); },
    crit: () => { noise(0.14, 0.3, 'bandpass', 1600, 300, 0, 2); tone('sawtooth', 260, 70, 0.18, 0.1); },
    miss: () => noise(0.14, 0.1, 'highpass', 3200, 1200),
    bow: () => { tone('triangle', 620, 160, 0.1, 0.1); noise(0.05, 0.06, 'highpass', 4000, 2500); },
    throw: () => noise(0.16, 0.1, 'bandpass', 1800, 600, 0, 1.5),
    bash: () => { noise(0.12, 0.3, 'lowpass', 700, 120); tone('square', 110, 50, 0.14, 0.12); },
    smash: () => { noise(0.35, 0.4, 'lowpass', 500, 60); tone('sine', 70, 35, 0.35, 0.3); },
    boom: () => { noise(0.6, 0.45, 'lowpass', 1200, 80); tone('sine', 90, 30, 0.5, 0.3); },
    fire: () => noise(0.35, 0.18, 'bandpass', 600, 2400, 0, 0.8),
    puff: () => noise(0.4, 0.14, 'lowpass', 900, 200),
    spit: () => { noise(0.12, 0.12, 'bandpass', 400, 1200, 0, 3); tone('sine', 300, 120, 0.12, 0.05); },
    death: () => { tone('sawtooth', 220, 40, 0.9, 0.12); noise(0.6, 0.12, 'lowpass', 600, 60); },
    levelup: () => arp([392, 494, 587, 784], 'triangle', 0.07, 0.25, 0.1),
    victory: () => arp([392, 494, 587, 784, 988, 1175], 'triangle', 0.11, 0.5, 0.12),
    descend: () => arp([523, 392, 330, 262], 'sine', 0.1, 0.3, 0.1),
    pickup: () => arp([880, 1320], 'sine', 0.05, 0.12, 0.07),
    coin: () => arp([1320, 1760], 'square', 0.04, 0.08, 0.03),
    chest: () => { noise(0.2, 0.1, 'lowpass', 500, 200); arp([660, 880, 1100], 'sine', 0.06, 0.2, 0.07); },
    shrine: () => arp([523, 659, 784, 1047], 'sine', 0.09, 0.6, 0.08),
    equip: () => noise(0.12, 0.1, 'bandpass', 2400, 1600, 0, 4),
    drink: () => { tone('sine', 400, 700, 0.18, 0.07); tone('sine', 500, 900, 0.18, 0.05, 0.1); },
    magic: () => { tone('sine', 660, 1320, 0.3, 0.07); tone('triangle', 990, 1980, 0.3, 0.04, 0.05); },
    unlock: () => { noise(0.05, 0.15, 'highpass', 3000, 3000); tone('square', 900, 900, 0.05, 0.04, 0.08); },
    door: () => tone('sawtooth', 90, 70, 0.25, 0.05),
    trap: () => { noise(0.08, 0.2, 'highpass', 2500, 1500); tone('square', 300, 150, 0.2, 0.08); },
    summon: () => { tone('sawtooth', 110, 220, 0.5, 0.06); tone('sine', 55, 110, 0.5, 0.1); },
    roar: () => { noise(0.8, 0.3, 'lowpass', 400, 80); tone('sawtooth', 80, 45, 0.8, 0.15); },
    windup: () => tone('triangle', 200, 420, 0.3, 0.08),
    ui: () => tone('sine', 880, 880, 0.04, 0.03),
    step: () => noise(0.04, 0.03, 'lowpass', 500, 300),
  };
  function play(name) {
    if (!ac || !st.enabled || st.vol <= 0 || !defs[name]) return;
    const now = performance.now(); if (now - (recent.get(name) || 0) < 40) return; recent.set(name, now);
    try { if (ac.state === 'suspended') ac.resume().catch(() => {}); defs[name](); st.played++; st.last = name; } catch (e) { st.state = 'error: ' + e.message; }
  }
  return { init, play, setVol, setEnabled, st };
})();
