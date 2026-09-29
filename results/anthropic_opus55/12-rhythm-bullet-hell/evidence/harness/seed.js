(function(){ const S = SYNCOPATH.Sim; const run = (cfg, ticks) => { const s = new S(cfg); s.quiet = true; for (let i = 1; i <= ticks; i++) s.step({ mx: (i % 240 < 120) ? 20 : -20, my: 0, b: (i % 400 === 0) ? 2 : 0, o: 0 }); return { hash: s.stateHash(), bullets: s.bullets.length, firstBullet: s.bullets[0] ? s.bullets[0].x.toFixed(3) + ',' + s.bullets[0].y.toFixed(3) : '-', score: Math.round(s.stats.score) }; };
  const base = { mode: 'story', diff: 'normal', bpm: 132, preset: 'neon', lab: null };
  const a1 = run(Object.assign({ seed: 1337 }, base), 6000), a2 = run(Object.assign({ seed: 1337 }, base), 6000), b = run(Object.assign({ seed: 1338 }, base), 6000);
  const lab = SYNCOPATH.labFromPreset(9); const L = (seed) => run({ mode: 'lab', seed, diff: 'normal', bpm: lab.bpm, preset: 'neon', lab }, 3000);
  const l1 = L(4242), l2 = L(4242), l3 = L(777);
  return JSON.stringify({ storySameSeedIdentical: a1.hash === a2.hash, storyDiffSeedDiffers: a1.hash !== b.hash, a1, a2, b, labSame: l1.hash === l2.hash, labDiff: l1.hash !== l3.hash, l1, l3 }); })()
