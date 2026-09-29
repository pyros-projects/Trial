// Test harness: record audio-scheduled emission cues vs. simulation emission processing for the current run.
window.__startSyncMeasure = function(){
  const A = SYNCOPATH, s = A.sim, sess = A.app.sess; const rec = { audio: {}, sim: {}, beats: {} };
  // audio side: which pulses got an emission cue, and at what audio time
  const origPrev = s.previewPulse.bind(s);
  s.previewPulse = function(p){ const r = origPrev(p); if (r.emit) rec.audio[p] = { t: sess.audioStart + s.transport.secAt(p/12), at: A.audio.now }; return r; };
  // sim side: when did the sim actually process each emitting pulse (audio clock at processing time)
  const origPulse = s._pulse.bind(s);
  s._pulse = function(p, sec){ const before = s.bullets.length + s.lasers.length + s.drones.length; origPulse(p, sec); const after = s.bullets.length + s.lasers.length + s.drones.length;
    if (after > before) rec.sim[p] = { processedAt: A.audio.now, pulseAudioT: sess.audioStart + s.transport.secAt(p/12), spawned: after - before, simSec: sec };
    if (p % 12 === 0 && p >= 0) rec.beats[p/12] = { processedAt: A.audio.now, audioT: sess.audioStart + s.transport.secAt(p/12) }; };
  window.__rec = rec; return 'measuring';
};
window.__syncReport = function(){
  const r = window.__rec; const lat = SYNCOPATH.clock.latency() + SYNCOPATH.settings.offsetMs/1000;
  const simP = Object.keys(r.sim).map(Number), audP = Object.keys(r.audio).map(Number);
  const both = simP.filter(p => r.audio[p]); const onlySim = simP.filter(p => !r.audio[p]); const onlyAud = audP.filter(p => !r.sim[p] && p <= Math.max(...simP));
  const d = both.map(p => (r.sim[p].processedAt - r.audio[p].t) * 1000);           // how long after the sound was scheduled the sim fired it (audio clock)
  const lead = audP.map(p => (r.audio[p].t - r.audio[p].at) * 1000);             // scheduling lead (look-ahead)
  const st = a => a.length ? { n: a.length, min: +Math.min(...a).toFixed(1), max: +Math.max(...a).toFixed(1), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) } : null;
  const steps = both.map(p => ((p % 48) / 3)); const stepHist = {}; for (const x of steps) stepHist[x] = (stepHist[x] || 0) + 1;
  return JSON.stringify({ latencyCompMs: +(lat * 1000).toFixed(1), emittingPulsesSim: simP.length, emittingPulsesAudio: audP.length, matched: both.length, onlySim: onlySim.slice(0, 10), onlyAudio: onlyAud.slice(0, 10),
    simFireAfterAudioTimeMs: st(d), scheduleLeadMs: st(lead), step16Histogram: stepHist });
};
'ok';
