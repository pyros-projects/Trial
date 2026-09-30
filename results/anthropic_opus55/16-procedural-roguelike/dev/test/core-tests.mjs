// Headless engine tests: generation validity, determinism, invariants,
// save/load exactness, replay re-simulation, perception occlusion.
// Usage: node dev/test/core-tests.mjs [--src] [--quick]
import { loadCore } from './loadcore.mjs';
const C = loadCore();
const quick = process.argv.includes('--quick');
let failures = 0; const out = [];
const check = (name, ok, detail = '') => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) failures++; };

// ---------- independent connectivity check (not using core validation)
function independentConnected(fl) {
  const W = fl.w, H = fl.h; const T = C.T; const TL = C.TILES;
  const pass = (x, y) => { const t = fl.t[y * W + x]; return (TL[t].walk === 1 && !TL[t].hazard) || t === T.DOOR || t === T.LOCKED || t === T.OPEN; };
  const solid = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? true : TL[fl.t[y * W + x]].solid === 1;
  const isDoor = (x, y) => { const t = fl.t[y * W + x]; return t === T.DOOR || t === T.OPEN; };
  const seen = new Uint8Array(W * H); const st = [[fl.entry.x, fl.entry.y]]; seen[fl.entry.y * W + fl.entry.x] = 1; let n = 0;
  while (st.length) {
    const [x, y] = st.pop(); n++;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (seen[ny * W + nx] || !pass(nx, ny)) continue;
      if (dx && dy && (isDoor(x, y) || isDoor(nx, ny) || solid(nx, y) || solid(x, ny))) continue;
      seen[ny * W + nx] = 1; st.push([nx, ny]);
    }
  }
  let total = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (pass(x, y)) total++;
  return { reach: n, total, exitOk: fl.exit ? !!seen[fl.exit.y * W + fl.exit.x] : true };
}

// ---------- 1. generation sweep
{
  const seeds = ['ember', 'daily-2026-09-30', 'alpha', 'bravo', 'x9', 'lantern', 'moss', 'crown', 'q', '12345'];
  for (let i = 0; i < (quick ? 4 : 30); i++) seeds.push('s' + (i * 7919).toString(36));
  const styles = ['mixed', 'ruins', 'fortress', 'caverns', 'crypt', 'arena'];
  let floors = 0, valid = 0, fallback = 0, attempts = 0, indepBad = 0, maxAttempts = 0; const t0 = Date.now(); const bad = [];
  for (const seed of seeds) for (const style of styles) for (let n = 1; n <= C.LAST_FLOOR; n++) {
    const fl = C.generateFloor({ seed, style, cls: 'warden', difficulty: 'normal' }, n); floors++;
    if (fl.validation.ok) valid++; else bad.push(`${seed}/${style}/F${n}`);
    if (fl.fallbackFrom) fallback++;
    attempts += fl.attempt; maxAttempts = Math.max(maxAttempts, fl.attempt);
    const ind = independentConnected(fl); if (ind.reach !== ind.total || !ind.exitOk) { indepBad++; bad.push(`indep ${seed}/${style}/F${n} ${ind.reach}/${ind.total}`); }
  }
  const ms = Date.now() - t0;
  check('Generation: every floor passes validation', valid === floors, `${valid}/${floors} floors, ${fallback} fallbacks, avg retries ${(attempts / floors).toFixed(2)}, max ${maxAttempts}, ${(ms / floors).toFixed(1)} ms/floor ${bad.slice(0, 5).join(' ')}`);
  check('Generation: independent BFS confirms connectivity + exit reachability', indepBad === 0, `${indepBad} disagreements`);
  const a = C.generateFloor({ seed: 'repeat', style: 'mixed' }, 3), b = C.generateFloor({ seed: 'repeat', style: 'mixed' }, 3);
  check('Generation: same seed ⇒ identical floor', a.t.join() === b.t.join() && JSON.stringify(a.spawn) === JSON.stringify(b.spawn));
  const c = C.generateFloor({ seed: 'repeat2', style: 'mixed' }, 3);
  check('Generation: different seed ⇒ different floor', a.t.join() !== c.t.join());
  const stylesSeen = new Set(); for (let n = 1; n <= 5; n++) stylesSeen.add(C.styleForFloor({ seed: 'ember', style: 'mixed' }, n));
  check('Mixed style cycles through all curated styles', stylesSeen.size === 5, [...stylesSeen].join(','));
}

// ---------- 2. bot runs: invariants + replay + save/load
function bot(s, rnd) {
  const p = s.player; C.ensureVision(s); const W = s.floor.w; const fl = s.floor; const vis = (x, y) => s._vis[y * W + x];
  const ps = C.pstats(p);
  const foes = s.enemies.filter((e) => e.hp > 0 && vis(e.x, e.y));
  const heal = p.inv.find((i) => i.k === 'heal');
  if (p.hp < ps.maxHp * 0.35 && heal) return ['u', heal.id];
  for (const e of foes) if (C.cheb(e.x, e.y, p.x, p.y) === 1 && C.diagOk(fl, p.x, p.y, e.x, e.y)) {
    if (rnd() < 0.15) return ['a', 0, e.x, e.y];
    return ['m', e.x - p.x, e.y - p.y];
  }
  if (foes.length && rnd() < 0.25) { const e = foes[Math.floor(rnd() * foes.length)]; const r = rnd();
    if (r < 0.35) return ['f', e.x, e.y]; if (r < 0.7) return ['a', rnd() < 0.5 ? 0 : 1, e.x, e.y];
    const thr = p.inv.find((i) => C.ITEMS[i.k].use === 'throw'); if (thr) return ['u', thr.id, e.x, e.y]; }
  if (rnd() < 0.03 && p.inv.length) { const it = p.inv[Math.floor(rnd() * p.inv.length)]; return rnd() < 0.8 ? ['u', it.id, p.x + 1, p.y] : ['e', it.id]; }
  if (rnd() < 0.02) return ['s'];
  if (s.items.some((i) => i.x === p.x && i.y === p.y) && rnd() < 0.8) return ['g'];
  if (C.gget(fl, p.x, p.y) === C.T.DOWN) return ['d'];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = C.gget(fl, p.x + dx, p.y + dy); if ((t === C.T.CHEST || t === C.T.SHRINE || (t === C.T.BRAZIER && rnd() < 0.05)) && rnd() < 0.5) return ['i', p.x + dx, p.y + dy]; }
  // navigate: toward known stairs, else nearest frontier
  const known = (x, y) => fl.explored[y * W + x];
  const cost = (x, y) => { const t = fl.t[y * W + x]; if (!known(x, y)) return -1; if (t === C.T.DOOR || t === C.T.OPEN) return 1; if (!C.tWalk(t) || C.TILES[t].hazard) return -1; return 1; };
  let targets = [];
  if (fl.exit && known(fl.exit.x, fl.exit.y) && rnd() < 0.85) targets = [[fl.exit.x, fl.exit.y]];
  else if (fl.boss && s.enemies.some((e) => e.k === 'boss') ) { const b = s.enemies.find((e) => e.k === 'boss'); if (known(b.x, b.y)) targets = [[b.x, b.y]]; }
  if (!targets.length) for (let i = 0; i < fl.t.length; i++) { const x = i % W, y = (i / W) | 0; if (known(x, y) && cost(x, y) > 0 && C.DIRS8.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < fl.h && !known(nx, ny); })) targets.push([x, y]); }
  if (targets.length) {
    const d = C.dmap(fl, targets, cost); let best = null, bv = d[p.y * W + p.x];
    for (const [dx, dy] of C.DIRS8) { const nx = p.x + dx, ny = p.y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= fl.h) continue; if (dx && dy && !C.diagOk(fl, p.x, p.y, nx, ny)) continue; const v = d[ny * W + nx]; if (v < bv) { bv = v; best = [dx, dy]; } }
    if (best && rnd() < 0.9) return ['m', best[0], best[1]];
  }
  const [dx, dy] = C.DIRS8[Math.floor(rnd() * 8)]; return ['m', dx, dy];
}
function invariants(s) {
  const occ = new Map(); const errs = []; const fl = s.floor; const W = fl.w;
  const actors = [s.player, ...s.enemies.filter((e) => e.hp > 0)];
  for (const a of actors) {
    const k = a.y * W + a.x; if (occ.has(k)) errs.push(`two actors on (${a.x},${a.y})`); occ.set(k, a);
    const t = fl.t[k]; if (!(C.TILES[t].walk === 1)) errs.push(`${a.k || 'player'} on non-walkable ${C.TILES[t].name} (${a.x},${a.y})`);
  }
  if (!s.over && s.player.hp <= 0) errs.push('player dead but run not over');
  if (s.player.hp > C.pstats(s.player).maxHp) errs.push('hp above max');
  return errs;
}
{
  const runs = quick ? 6 : 24; const grammar = []; let totalActions = 0, invBad = 0, replayBad = 0, saveBad = 0, legalBad = 0, deaths = 0, wins = 0, maxFloor = 0, rejects = 0; const msgs = [];
  const classes = ['warden', 'ranger', 'arcanist']; const styles = ['mixed', 'arena', 'caverns', 'crypt', 'ruins', 'fortress'];
  for (let r = 0; r < runs; r++) {
    const params = { seed: 'bot' + r, cls: classes[r % 3], style: styles[r % styles.length], difficulty: r % 4 === 0 ? 'easy' : 'normal', startFloor: r % 5 === 4 ? 4 : 1 };
    const s = C.newGame(params); const actions = []; const rr = C.makeRng('botdecisions' + r); const rnd = () => C.rnext(rr);
    let midSave = null, midIdx = -1;
    for (let step = 0; step < (quick ? 500 : 1500) && !s.over; step++) {
      let a = bot(s, rnd);
      const before = new Map(s.enemies.filter((e) => e.hp > 0).map((e) => [e.id, { e0: e.energy, sp: e.k }]));
      const turn0 = s.turn; const floor0 = s.floorN; s._ev.length = 0;
      let ok = C.applyAction(s, a);
      if (!ok) { rejects++; a = ['w']; ok = C.applyAction(s, a); }
      if (!ok) { msgs.push(`wait rejected?! ${s._msg}`); break; }
      actions.push(a); totalActions++;
      // legality: each enemy moved at most as many times as its energy allows
      if (s.floorN === floor0) {
        const rounds = s.turn - turn0; const moves = new Map();
        for (const e of s._ev) if ((e.type === 'move' && !e.kb) || e.type === 'door') { if (e.type === 'move' && e.id !== 0) moves.set(e.id, (moves.get(e.id) || 0) + 1); }
        for (const [id, m] of moves) { const b = before.get(id); if (!b) continue; const sp = C.ENEMIES[b.sp].speed * 2 * 1.3; const allowed = Math.floor((b.e0 + sp * rounds) / 100); if (m > allowed) { legalBad++; if (msgs.length < 8) msgs.push(`enemy ${id} (${b.sp}) moved ${m}× in ${rounds} rounds`); } }
      }
      const errs = invariants(s); if (errs.length) { invBad++; if (msgs.length < 8) msgs.push(`run ${r} step ${step}: ${errs.join('; ')}`); }
      if (step === 150) { midSave = JSON.stringify(C.makeSave(s, actions, 'test')); midIdx = actions.length; }
    }
    for (const l of s.log) if (/\bThe The\b|\bthe the\b|\bthe The\b|\ba [AEIOU]|undefined|NaN|\[object/.test(l.text)) { grammar.push(l.text); }
    if (s.over) { if (s.over.result === 'dead') deaths++; else wins++; }
    maxFloor = Math.max(maxFloor, s.floorN);
    const sim = C.simulate(params, actions);
    if (sim.error || C.stateHash(sim.state) !== C.stateHash(s)) { replayBad++; msgs.push(`replay mismatch run ${r}: ${sim.error || 'hash differs'}`); }
    if (midSave) {
      const loaded = C.loadSave(JSON.parse(midSave)); const ref = C.simulate(params, actions, midIdx).state;
      if (C.stateHash(loaded.state) !== C.stateHash(ref)) { saveBad++; msgs.push(`save/load mismatch run ${r}`); }
      for (let i = midIdx; i < actions.length; i++) C.applyAction(loaded.state, actions[i]);
      if (C.stateHash(loaded.state) !== C.stateHash(s)) { saveBad++; msgs.push(`continued-from-save diverged run ${r}`); }
    }
  }
  check('Bot runs: no collision/wall/HP invariant violations', invBad === 0, `${runs} runs, ${totalActions} actions, ${rejects} rejected bot moves, deepest floor ${maxFloor}, ${deaths} deaths, ${wins} wins`);
  check('Bot runs: enemies never exceed their energy-granted actions', legalBad === 0, `${legalBad} violations`);
  check('Replay: re-simulating the action log reproduces the exact state hash', replayBad === 0, `${runs} runs`);
  check('Log text: no broken articles / undefined / NaN in messages', grammar.length === 0, grammar.slice(0, 3).join(' | '));
  check('Save/load: loaded mid-run state is exact and continues identically', saveBad === 0);
  if (msgs.length) out.push('   notes: ' + msgs.slice(0, 8).join('\n          '));
}

// ---------- 3. perception: closed doors occlude both ways; hidden enemies unseen
{
  let tested = 0, bad = 0; const details = [];
  for (let k = 0; k < 40 && tested < 12; k++) {
    const s = C.newGame({ seed: 'door' + k, style: 'fortress', cls: 'warden' }); const fl = s.floor; const W = fl.w;
    // find a closed door with walkable tiles straight on both sides
    let spot = null;
    for (let i = 0; i < fl.t.length && !spot; i++) {
      if (fl.t[i] !== C.T.DOOR) continue; const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [0, 1]]) { const a = [x - dx, y - dy], b = [x + dx, y + dy], b2 = [x + 2 * dx, y + 2 * dy];
        if ([a, b, b2].every(([u, v]) => C.tWalk(C.gget(fl, u, v)) && !C.actorAt(s, u, v))) spot = { door: [x, y], a, b2 }; }
    }
    if (!spot) continue; tested++;
    s.enemies = []; s.player.x = spot.a[0]; s.player.y = spot.a[1];
    const e = C.makeEnemy(s, 'goblin', spot.b2[0], spot.b2[1], { state: 'idle' }); s.enemies.push(e);
    s._losDirty = true; C.updateVision(s);
    const seenClosed = C.isVis(s, e.x, e.y), spotsClosed = C.canSeePlayer(s, e);
    fl.t[spot.door[1] * W + spot.door[0]] = C.T.OPEN; s._losDirty = true; C.updateVision(s);
    const seenOpen = C.isVis(s, e.x, e.y), spotsOpen = C.canSeePlayer(s, e);
    if (seenClosed || spotsClosed || !seenOpen || !spotsOpen) { bad++; details.push(`seed door${k}: closed(vis=${seenClosed},spot=${spotsClosed}) open(vis=${seenOpen},spot=${spotsOpen})`); }
  }
  check('Perception: closed door blocks sight both ways; opening it restores LOS', tested >= 8 && bad === 0, `${tested} doors tested ${details.join(' ')}`);
}
// ---------- 4. enemies lose track outside LOS and path around walls
{
  let ok = 0, tries = 0; const notes = [];
  for (let k = 0; k < 30 && tries < 10; k++) {
    const s = C.newGame({ seed: 'chase' + k, style: 'fortress', cls: 'warden' }); const fl = s.floor; const W = fl.w; const p = s.player;
    // put a hunting goblin 6+ path steps away with no LOS; it must reach the player via a path, never through walls
    const d = C.dmap(fl, [[p.x, p.y]], C.safeCost(fl, false));
    let spot = null; for (let i = 0; i < d.length; i++) { const x = i % W, y = (i / W) | 0; if (d[i] >= 7 && d[i] <= 12 && C.tWalk(fl.t[i]) && !C.TILES[fl.t[i]].hazard && !C.isVis(s, x, y) && !C.actorAt(s, x, y) && fl.t[i] !== C.T.OPEN) { spot = [x, y, d[i]]; break; } }
    if (!spot) continue; tries++;
    s.enemies = []; const e = C.makeEnemy(s, 'goblin', spot[0], spot[1], { state: 'hunting', last: { x: p.x, y: p.y } }); e.mem = 30; s.enemies.push(e);
    let reached = false;
    for (let t = 0; t < 40; t++) { C.applyAction(s, ['w']); const errs = invariants(s); if (errs.length) { notes.push(errs[0]); break; } if (e.hp > 0 && C.cheb(e.x, e.y, p.x, p.y) === 1) { reached = true; break; } if (s.over) break; }
    if (reached) ok++; else notes.push(`seed chase${k}: goblin at (${e.x},${e.y}) state=${e.state}`);
  }
  check('AI: hunting enemy paths around walls/doors to reach the player (last-known position)', tries > 0 && ok === tries, `${ok}/${tries} ${notes.slice(0, 3).join(' | ')}`);
  // losing knowledge: player teleports away out of LOS → enemy goes to last known spot, not the new one
  let lost = 0, ltries = 0;
  for (let k = 0; k < 20 && ltries < 6; k++) {
    const s = C.newGame({ seed: 'lose' + k, style: 'fortress', cls: 'warden' }); const fl = s.floor; const W = fl.w; const p = s.player;
    s.enemies = []; let spot = null;
    for (const [dx, dy] of C.DIRS8.map(([a, b]) => [a * 3, b * 3])) { const x = p.x + dx, y = p.y + dy; if (C.tWalk(C.gget(fl, x, y)) && C.isVis(s, x, y) && !C.TILES[C.gget(fl, x, y)].hazard) { spot = [x, y]; break; } }
    if (!spot) continue; ltries++;
    const e = C.makeEnemy(s, 'skeleton', spot[0], spot[1], { state: 'idle' }); s.enemies.push(e);
    C.applyAction(s, ['w']); // it sees us → hunting, last = our pos
    const seenAt = { x: p.x, y: p.y };
    // teleport the player far away out of sight
    const d = C.dmap(fl, [[p.x, p.y]], C.safeCost(fl, false)); let far = null;
    for (let i = 0; i < d.length; i++) { if (d[i] > 25 && d[i] < C.INF && C.tWalk(fl.t[i]) && !C.TILES[fl.t[i]].hazard && fl.t[i] !== C.T.OPEN && !C.actorAt(s, i % W, (i / W) | 0)) { far = [i % W, (i / W) | 0]; break; } }
    if (!far) { ltries--; continue; }
    p.x = far[0]; p.y = far[1]; s._losDirty = true; C.updateVision(s);
    C.applyAction(s, ['w']);
    const l = e.last;
    if (e.state !== 'hunting' && l && l.x === seenAt.x && l.y === seenAt.y) lost++;
  }
  check('AI: enemy that loses sight keeps only the last-known position (no wallhack)', ltries > 0 && lost === ltries, `${lost}/${ltries}`);
}
// ---------- 4b. visible ⇒ shootable: every visible floor tile in range has a clear projectile line
{
  let tiles = 0, noLine = 0; const ex = [];
  for (const style of ['ruins', 'fortress', 'caverns', 'crypt', 'arena']) for (let k = 0; k < 6; k++) {
    const s = C.newGame({ seed: 'los' + style + k, style, cls: 'ranger' }); const rr = C.makeRng('lw' + k);
    for (let step = 0; step < 60; step++) { const [dx, dy] = C.DIRS8[Math.floor(C.rnext(rr) * 8)]; C.applyAction(s, ['m', dx, dy]); if (s.over) break; }
    C.ensureVision(s); const fl = s.floor, W = fl.w, p = s.player;
    for (let i = 0; i < fl.t.length; i++) { const x = i % W, y = (i / W) | 0; if (!s._vis[i] || C.cheb(x, y, p.x, p.y) > 7 || (x === p.x && y === p.y) || C.tOpaque(fl.t[i])) continue; tiles++; if (!C.bestLine(s, p.x, p.y, x, y, false)) { noLine++; if (ex.length < 3) ex.push(`${style}${k} (${p.x},${p.y})→(${x},${y})`); } }
  }
  check('Targeting: every visible in-range tile has a clear projectile line', noLine === 0, `${tiles} tiles checked, ${noLine} without a line ${ex.join(' ')}`);
}
// ---------- 5. invalid / legacy saves are handled
{
  let okCount = 0; const cases = [
    ['garbage', 'not json object', () => C.loadSave('hello')],
    ['other game', 'foreign', () => C.loadSave({ game: 'other', schema: 3 })],
    ['future', 'newer', () => C.loadSave({ game: 'emberdeep', schema: 99 })],
    ['schema1', 'too old', () => C.loadSave({ game: 'emberdeep', schema: 1 })],
  ];
  for (const [name, , fn] of cases) { try { fn(); } catch (e) { okCount++; } }
  check('Save validation: foreign/newer/ancient saves are rejected with an error (no crash)', okCount === cases.length, `${okCount}/${cases.length}`);
  const s = C.newGame({ seed: 'mig', cls: 'ranger', style: 'arena' }); const acts = [['w'], ['s'], ['w']]; for (const a of acts) C.applyAction(s, a);
  const v2 = { game: 'emberdeep', schema: 2, params: { seed: 'mig', hero: 'ranger', style: 'arena' }, moves: acts, state: { junk: true } };
  const m = C.loadSave(v2);
  check('Save migration: schema-2 save rebuilt by replay equals live state', C.stateHash(m.state) === C.stateHash(s), m.notes.join(' '));
  const sv = C.makeSave(s, acts, 'x'); sv.state.player.hp = 'corrupt';
  const c = C.loadSave(JSON.parse(JSON.stringify(sv)));
  check('Save repair: corrupted state is rebuilt from the action log', C.stateHash(c.state) === C.stateHash(s), c.notes.join(' '));
}
console.log(out.join('\n'));
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
