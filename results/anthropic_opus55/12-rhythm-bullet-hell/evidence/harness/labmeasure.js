// harness: log every emission the lab sim actually performs (pulse, layer, pattern, step, bpm)
window.__labEmits = []; window.__hookLab = function(){ const s = SYNCOPATH.sim; const orig = s._emit.bind(s);
  s._emit = function(type, d){ if (type === 'emit') window.__labEmits.push({ p: s.curPulseSec != null ? Math.round(s.transport.beatAt(s.curPulseSec) * 12) : null, layer: d.layer, pat: d.p, bpm: s.transport.bpmAtSec(s.curPulseSec), tick: s.tick }); return orig(type, d); }; return 'hooked'; };
window.__labSummary = function(fromTick){ const e = window.__labEmits.filter(x => x.tick >= (fromTick || 0)); const byLayer = {}; for (const x of e) { const k = x.layer + ':' + x.pat; (byLayer[k] = byLayer[k] || []).push(x.p); }
  const out = {}; for (const k in byLayer) { const ps = byLayer[k]; out[k] = { n: ps.length, pulses: ps.slice(-8), stepsMod48: [...new Set(ps.map(p => p % 48))].sort((a, b) => a - b), bpm: e.filter(x => x.layer + ':' + x.pat === k).slice(-1)[0].bpm }; }
  const s = SYNCOPATH.sim; return JSON.stringify({ tick: s.tick, bpmNow: s.transport.bpmAtSec(s.sec), segs: s.transport.segs.map(g => g.beat + '@' + g.bpm), labUnit: s.lab.unit, maskA: s.lab.A.mask.map(v => v ? 'x' : '.').join(''), maskB: s.lab.B.mask.map(v => v ? 'x' : '.').join(''), emits: out }); };
'ok';
