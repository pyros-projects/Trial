window.__watchHits = function(){ const s = SYNCOPATH.sim; const log = []; window.__hitlog = log; const orig = s._playerHit.bind(s);
  s._playerHit = function(){ const P = s.player; let best = null;
    for (const b of s.bullets) { const d = Math.hypot(b.x - P.x, b.y - P.y); const thr = b.r * 0.72 + P.hitR; if (!best || d - thr < best.d - best.thr) best = { d, thr, r: b.r }; }
    let laser = null; for (const L of s.lasers) if (L.on) laser = true;
    log.push({ tick: s.tick, livesBefore: P.lives, invBefore: +P.inv.toFixed(3), nearest: best && { dist: +best.d.toFixed(2), threshold: +best.thr.toFixed(2) }, laser });
    orig(); log[log.length - 1].livesAfter = P.lives; log[log.length - 1].invAfter = P.inv; };
  // count overlaps that happen while invulnerable (should not cost lives)
  window.__invOverlaps = 0; const origU = s._updBullets.bind(s);
  s._updBullets = function(sec){ const P = s.player; if (P.inv > 0 && P.alive) for (const b of s.bullets) { const dx = b.x - P.x, dy = b.y - P.y, hr = b.r * 0.72 + P.hitR; if (dx * dx + dy * dy < hr * hr) window.__invOverlaps++; } return origU(sec); };
  return 'watching'; };
window.__hitReport = function(){ const l = window.__hitlog; const gaps = []; for (let i = 1; i < l.length; i++) gaps.push(((l[i].tick - l[i-1].tick) / 120).toFixed(2) + 's');
  return JSON.stringify({ hits: l.length, overlapsWhileInvulnerable: window.__invOverlaps, gapsBetweenHits: gaps, detail: l }); };
'ok';
