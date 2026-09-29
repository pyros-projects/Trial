(() => {
  const B = window.__stress = { log: [], frames: [], dprs: [], maxEngaged: 0, done: false, t0: performance.now() };
  const s = GHOSTLINE.sim, P = s.player; let best = null, bd = 1e9;
  for (const c of s.cameras) { const x = c.x + Math.cos(c.base) * 3, y = c.y + Math.sin(c.base) * 3; const d = Math.hypot(x - P.x, y - P.y); if (d < bd) { bd = d; best = { x, y }; } }
  B.target = best; let last = 0, lastT = performance.now(), phase = 'toCam';
  const f = (now) => { if (B.done) return; const s = GHOSTLINE.sim, P = s.player; B.frames.push(now - lastT); B.dprs.push(R.dpr); lastT = now;
    const eng = s.guards.filter(g => ['CHASE', 'SEARCH', 'INVESTIGATE'].includes(g.state)).length; B.maxEngaged = Math.max(B.maxEngaged, eng);
    if (s.outcome || app.mode !== 'play') { B.log.push('end ' + JSON.stringify(s.outcome)); B.done = true; return; }
    if (phase === 'toCam') { if (now - last > 800 && !P.autoPath) { INPUT.ev.push(['go', round2(B.target.x), round2(B.target.y), 0]); last = now; } if (s.alert.level === 2) { phase = 'evade'; B.log.push('alarm at ' + s.time.toFixed(1)); B.alarmFrame = B.frames.length; } }
    else { INPUT.runToggle = true; if (now - last > 1500) { let bx = null, bs = -1e9; for (let k = 0; k < 40; k++) { const x = P.x + (Math.random() - 0.5) * 14, y = P.y + (Math.random() - 0.5) * 14; if (tileAt(s, x, y) !== FLOOR) continue; const dg = Math.min(...s.guards.map(g => Math.hypot(g.x - x, g.y - y))); if (dg > bs) { bs = dg; bx = [x, y]; } } if (bx) INPUT.ev.push(['go', round2(bx[0]), round2(bx[1]), 1]); last = now; } }
    if (now - B.t0 > 40000) { B.done = true; B.log.push('timeout'); return; } requestAnimationFrame(f); };
  requestAnimationFrame(f); return 'stress bot running';
})()
