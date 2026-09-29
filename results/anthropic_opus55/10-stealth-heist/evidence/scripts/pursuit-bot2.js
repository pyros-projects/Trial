(() => {
  // In-page test bot: reacts every frame; acts ONLY through the game's input queue (same events a click / right-click / E produce).
  const L = window.__bot = { log: [], phase: 'approach', t0: performance.now(), shots: [], done: false };
  const s0 = () => GHOSTLINE.sim;
  const say = m => { const s = s0(); L.log.push(`[${s.time.toFixed(2)}] ${m} | P(${s.player.x.toFixed(1)},${s.player.y.toFixed(1)}) ` + s.guards.map(g => `${g.name}:${g.state} aw${g.aw.toFixed(2)}${g.seeing ? ' SEES' : ''}`).join(' ')); };
  const go = (x, y, run) => INPUT.ev.push(['go', round2(x), round2(y), run ? 1 : 0]);
  const G = () => s0().guards[0];
  let prevState = null, lastGo = 0, fleeTarget = null, lostAt = null;
  const bfs = (sx, sy, pass) => { const s = s0(), W = s.W, d = new Int32Array(W * s.H).fill(-1), q = [Math.floor(sy) * W + Math.floor(sx)]; d[q[0]] = 0; for (let h = 0; h < q.length; h++) { const c = q[h], x = c % W, y = (c / W) | 0; for (const [dx, dy] of DIR4) { const j = (y + dy) * W + x + dx; if (d[j] < 0 && pass(j)) { d[j] = d[c] + 1; q.push(j); } } } return d; };
  function pickFlee() {
    const s = s0(), g = G(), P = s.player, pp = playerPass(s);
    const dp = bfs(P.x, P.y, pp), dg = bfs(g.x, g.y, i => walkIdx(s, i));
    let best = null, bs = -1e9;
    for (let i = 0; i < dp.length; i++) { if (dp[i] < 3 || dp[i] > 30 || s.tiles[i] !== FLOOR) continue; const sc = (dg[i] < 0 ? 40 : dg[i]) - 0.55 * dp[i]; if (sc > bs) { bs = sc; best = { x: i % s.W + 0.5, y: ((i / s.W) | 0) + 0.5 }; } }
    return best;
  }
  function tick() {
    if (L.done) return;
    const s = s0(), g = G(), P = s.player, now = performance.now();
    if (!s || app.mode !== 'play') { requestAnimationFrame(tick); return; }
    if (g.state !== prevState) { say(`guard ${prevState}->${g.state}`); L.shots.push(g.state); prevState = g.state; }
    if (s.outcome) { say('OUTCOME ' + JSON.stringify(s.outcome)); L.done = true; return; }
    switch (L.phase) {
      case 'approach': // wait in the corridor; once the guard idles in the Power room, open its door
        if (Math.hypot(P.x - 20.5, P.y - 16.5) > 0.4) { if (now - lastGo > 700 && !P.autoPath) { go(20.5, 16.5); lastGo = now; } }
        else if (g.state === 'IDLE' && g.x < 27.5 && g.y > 7) { L.phase = 'openDoor'; say('guard idling in the Power room -> opening its door'); }
        if (g.state === 'CHASE') { L.phase = 'flee'; say('guard CHASING from ' + Math.hypot(g.x - P.x, g.y - P.y).toFixed(1) + ' tiles -> FLEE (run)'); L.shots.push('SPOTTED'); }
        break;
      case 'openDoor':
        if (Math.hypot(P.x - 21.35, P.y - 9.5) > 0.3) { if (now - lastGo > 500 && !P.autoPath) { go(21.35, 9.5); lastGo = now; } }
        else { INPUT.latchAct = true; L.phase = 'backoff'; say('door (22,9) opened'); }
        if (g.state === 'CHASE') { L.phase = 'flee'; say('guard CHASING -> FLEE'); L.shots.push('SPOTTED'); }
        break;
      case 'backoff':
        if (Math.hypot(P.x - 20.5, P.y - 16.3) > 0.35) { if (now - lastGo > 500 && !P.autoPath) { go(20.5, 16.3); lastGo = now; } }
        else { INPUT.ev.push(['sel', 0]); INPUT.ev.push(['use', 21.2, 10.9]); L.phase = 'wait'; say('noisemaker thrown at (21.2,10.9) to lure the guard'); }
        if (g.state === 'CHASE') { L.phase = 'flee'; }
        break;
      case 'wait': // stand in view until the guard commits to a chase
        if (g.state === 'CHASE') { L.phase = 'flee'; say('guard is chasing from ' + Math.hypot(g.x - P.x, g.y - P.y).toFixed(1) + ' tiles -> FLEE (run)'); L.shots.push('SPOTTED'); }
        break;
      case 'flee':
        INPUT.runToggle = true; INPUT.sneak = false;
        if (!fleeTarget || now - lastGo > 600) { fleeTarget = pickFlee(); if (fleeTarget) { go(fleeTarget.x, fleeTarget.y, true); lastGo = now; } }
        if (!g.seeing) { if (lostAt == null) { lostAt = now; say('line of sight broken'); L.shots.push('LOS'); } } else lostAt = null;
        if (lostAt != null && now - lostAt > 1200 && g.state !== 'CHASE') { L.phase = 'hide'; INPUT.runToggle = false; INPUT.sneak = true; say('switching to sneak and hiding'); }
        if (lostAt != null && now - lostAt > 2500) { L.phase = 'hide'; INPUT.runToggle = false; INPUT.sneak = true; say('out of sight for 2.5s: sneaking to hide'); }
        break;
      case 'hide':
        INPUT.runToggle = false; INPUT.sneak = true;
        if (g.seeing && g.state === 'CHASE') { L.phase = 'flee'; lostAt = null; say('re-spotted -> flee again'); }
        else if (!P.autoPath && now - lastGo > 1500) { const t = pickFlee(); if (t) { go(t.x, t.y, false); lastGo = now; } }
        if (g.state === 'RETURN' || g.state === 'PATROL') { if (!L.returned) { L.returned = true; say('guard gave up the search'); } }
        if (L.returned && (g.state === 'PATROL' || g.state === 'IDLE')) { say('guard back on duty'); L.done = true; INPUT.sneak = false; return; }
        break;
    }
    requestAnimationFrame(tick);
  }
  say('bot started'); requestAnimationFrame(tick); return 'bot running';
})()
