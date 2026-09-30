// In-page soak bot (dev only): drives the real UI doAction path.
(() => {
  const E = window.__emberdeep; const out = { actions: 0, runs: 1, deaths: 0, wins: 0, maxParts: 0, maxLogDom: 0, minFps: 999, floors: new Set(), errors: 0 };
  let r = 1; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  function pick() {
    const s = E.S(); const p = s.player; const fl = s.floor; const W = fl.w; ensureVision(s);
    const foes = s.enemies.filter((e) => e.hp > 0 && s._vis[e.y * W + e.x]);
    const heal = p.inv.find((i) => i.k === 'heal'); if (p.hp < pstats(p).maxHp * 0.35 && heal) return ['u', heal.id];
    for (const e of foes) if (cheb(e.x, e.y, p.x, p.y) === 1 && diagOk(fl, p.x, p.y, e.x, e.y)) return rnd() < 0.2 ? ['a', 0, e.x, e.y] : ['m', e.x - p.x, e.y - p.y];
    if (foes.length && rnd() < 0.3) { const e = foes[0]; const t = p.inv.find((i) => ITEMS[i.k].use === 'throw'); if (t && rnd() < 0.4) return ['u', t.id, e.x, e.y]; return rnd() < 0.5 ? ['a', rnd() < 0.5 ? 0 : 1, e.x, e.y] : ['f', e.x, e.y]; }
    if (gget(fl, p.x, p.y) === T.DOWN) return ['d'];
    if (s.items.some((i) => i.x === p.x && i.y === p.y)) return ['g'];
    const known = (x, y) => fl.explored[y * W + x];
    const cost = (x, y) => { const t = fl.t[y * W + x]; if (!known(x, y)) return -1; if (t === T.DOOR || t === T.OPEN) return 1; if (!tWalk(t) || TILES[t].hazard) return -1; return 1; };
    let targets = []; if (fl.exit && known(fl.exit.x, fl.exit.y)) targets = [[fl.exit.x, fl.exit.y]];
    const boss = s.enemies.find((e) => e.k === 'boss' && e.hp > 0); if (!targets.length && boss && known(boss.x, boss.y)) targets = [[boss.x, boss.y]];
    if (!targets.length) for (let i = 0; i < fl.t.length; i++) { const x = i % W, y = (i / W) | 0; if (known(x, y) && cost(x, y) > 0 && DIRS8.some(([dx, dy]) => inb(fl, x + dx, y + dy) && !known(x + dx, y + dy))) targets.push([x, y]); }
    if (targets.length && rnd() < 0.92) { const d = dmap(fl, targets, cost); let best = null, bv = d[p.y * W + p.x]; for (const [dx, dy] of DIRS8) { const nx = p.x + dx, ny = p.y + dy; if (!inb(fl, nx, ny) || !diagOk(fl, p.x, p.y, nx, ny)) continue; if (d[ny * W + nx] < bv) { bv = d[ny * W + nx]; best = [dx, dy]; } } if (best) return ['m', ...best]; }
    const [dx, dy] = DIRS8[Math.floor(rnd() * 8)]; return ['m', dx, dy];
  }
  const N = window.__soakN || 3000; const t0 = performance.now(); let frames = 0;
  function tick() {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    const s = E.S();
    if (s.over) { if (s.over.result === 'dead') out.deaths++; else out.wins++; E.startRun({ seed: 'soak' + out.runs, cls: ['warden', 'ranger', 'arcanist'][out.runs % 3], style: ['mixed', 'caverns', 'crypt', 'fortress', 'ruins'][out.runs % 5] }); out.runs++; }
    else { let a = pick(); if (!E.doAction(a, { quiet: true })) E.doAction(['w'], { quiet: true }); out.actions++; }
    out.floors.add(E.S().floorN);
    out.maxParts = Math.max(out.maxParts, E.Renderer.stats.parts); out.maxLogDom = Math.max(out.maxLogDom, document.getElementById('log').children.length);
    out.minFps = Math.min(out.minFps, E.UI.fps || 999); out.errors = E.UI.errors.length;
    if (out.actions < N) setTimeout(tick, 4); else { out.ms = Math.round(performance.now() - t0); out.floors = [...out.floors].sort().join(','); out.heapMB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null; out.enemies = E.S().enemies.length; out.lastErrors = E.UI.errors.slice(-3); window.__soakResult = out; }
  }
  window.__soakResult = null; tick(); return 'started';
})();
