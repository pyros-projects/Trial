// ============================================================ GAME STATE
// Turn rules (also shown in Help):
//  * One "turn" = one world round. The player acts first with energy; every
//    action below costs 100 energy (one action). Normal speed regains 100
//    energy per round, Hasted 200 (two actions/round), Slowed 50.
//  * Move / attack / open door / wait / search / pick up / use / equip /
//    drop / throw / fire / ability / interact / descend all cost one action.
//  * Rejected actions (bumping a wall, locked door without key, out of range)
//    cost nothing and are not recorded.
//  * World round order: each enemy in id order gains energy and acts while
//    energy ≥ 100 → environment (fire, gas, smoke) → statuses & cooldowns.
//  * Nothing happens between player actions: the world only advances when an
//    accepted action is applied, so pausing/menus/animations cannot give
//    enemies extra turns.
function normalizeParams(p = {}) {
  const style = p.style === 'mixed' || (STYLES[p.style] && p.style !== 'sanctum') ? p.style : 'mixed';
  const seed = String(p.seed == null ? 'ember' : p.seed).trim().slice(0, 48) || 'ember';
  return { seed, cls: CLASSES[p.cls] ? p.cls : 'warden', difficulty: DIFFICULTY[p.difficulty] ? p.difficulty : 'normal', style,
    permadeath: !!p.permadeath, startFloor: clamp((p.startFloor | 0) || 1, 1, LAST_FLOOR), daily: p.daily || null };
}
function newGame(params) {
  params = normalizeParams(params);
  const s = { v: SCHEMA_VERSION, params, rng: makeRng(`${params.seed}|play|${params.cls}|${params.difficulty}`), turn: 0, floorN: 0, nextId: 1,
    floor: null, player: null, enemies: [], items: [], traps: [], fx: { fire: {}, gas: {}, smoke: {} }, sounds: [], log: [], logSeq: 0,
    stats: { kills: 0, dmgDealt: 0, dmgTaken: 0, itemsUsed: 0, deepest: 1, restarts: 0, killsBy: {}, turnsOnFloor: 0 }, over: null, floorStart: null, _ev: [] };
  s.player = makePlayer(s, params.cls);
  log(s, `${CLASSES[params.cls].name} enters the Emberdeep. Slay the Hollow King on depth ${LAST_FLOOR}.`, 'system');
  log(s, 'Tip: move with arrows / vi-keys / numpad; bump to attack or open doors. Hover or inspect anything for exact odds. Help lists every key.', 'system');
  if (params.startFloor > 1) practiceKit(s, params.startFloor);
  enterFloor(s, params.startFloor, 'start');
  return s;
}
function newItem(s, k, qty = 1) { return { id: s.nextId++, k, qty }; }
function makePlayer(s, cls) {
  const C = CLASSES[cls];
  const p = { id: 0, kind: 'player', cls, x: 0, y: 0, hp: C.hp, baseHp: C.hp, level: 1, xp: 0, xpTotal: 0, gold: 0, energy: 100, inv: [], eq: { weapon: null, ranged: null, armor: null, trinket: null }, st: [], cd: {}, lastHurt: -99 };
  for (const [k, qty, eq] of C.kit) { const it = newItem(s, k, qty); if (eq) p.eq[ITEMS[k].slot] = it; else p.inv.push(it); }
  return p;
}
function practiceKit(s, n) { // compact later-floor preset: roughly what a run would have by then
  const p = s.player; const r = makeRng(s.params.seed + '|practice');
  for (let i = 1; i < n * 2 - 1; i++) { p.xp = 0; levelUp(s, true); }
  addToInv(s, newItem(s, 'heal', n - 1)); addToInv(s, newItem(s, 'firebomb', 1)); addToInv(s, newItem(s, 'scrollWard', 1));
  if (!p.eq.trinket) p.eq.trinket = newItem(s, rpick(r, ['ringVigor', 'amuletWard', 'ringPrec']));
  if (n >= 3 && p.cls === 'warden') p.eq.weapon = newItem(s, 'mace');
  if (p.cls === 'ranger') addToInv(s, newItem(s, 'arrows', 10));
  p.hp = pstats(p).maxHp; p.gold = 40 * (n - 1);
}
function log(s, text, kind = 'info') { s.log.push({ n: ++s.logSeq, t: s.turn, text, kind }); if (s.log.length > 160) s.log.splice(0, s.log.length - 160); }
function ev(s, e) { if (s._ev) { s._ev.push(e); if (s._ev.length > 400) s._ev.splice(0, 200); } }
function fail(s, msg) { s._msg = msg; return 0; }

function enterFloor(s, n, how) {
  const fl = generateFloor(s.params, n);
  s.floorN = n;
  s.floor = { style: fl.style, n, w: fl.w, h: fl.h, t: fl.t, explored: new Array(fl.w * fl.h).fill(0), entry: fl.entry, exit: fl.exit, rooms: fl.rooms,
    vault: fl.vault, key: fl.key, bossRoom: fl.bossRoom, boss: fl.boss, attempt: fl.attempt, validation: fl.validation, genLog: fl.genLog, fallbackFrom: fl.fallbackFrom || null };
  s.enemies = fl.spawn.enemies.map((sp) => makeEnemy(s, sp.k, sp.x, sp.y, sp));
  s.items = fl.spawn.items.map((it) => ({ id: s.nextId++, k: it.k, qty: it.qty, x: it.x, y: it.y, seen: 0 }));
  s.traps = fl.spawn.traps.map((t) => ({ x: t.x, y: t.y, k: t.k, hidden: 1, armed: 1 }));
  s.fx = { fire: {}, gas: {}, smoke: {} }; s.sounds = [];
  const p = s.player; p.x = fl.entry.x; p.y = fl.entry.y; p.energy = 100;
  s.stats.deepest = Math.max(s.stats.deepest, n); s.stats.turnsOnFloor = 0;
  invalidate(s);
  const verb = how === 'fall' ? 'plummet to' : how === 'start' ? 'arrive at' : 'descend to';
  log(s, `You ${verb} depth ${n}: ${STYLES[fl.style].name}.`, 'system');
  if (fl.fallbackFrom) log(s, `(Generator fell back to a test arena after ${fl.genLog.length} invalid ${fl.fallbackFrom} layouts.)`, 'warn');
  if (n === LAST_FLOOR) log(s, 'A cold crown-light glows somewhere ahead. The Hollow King waits.', 'warn');
  if (fl.vault) log(s, 'Somewhere on this floor lies a locked vault.', 'info');
  ev(s, { type: 'floor', n, how });
  updateVision(s);
  s.floorStart = null;
  s.floorStart = JSON.stringify(serialize(s));
}
function makeEnemy(s, k, x, y, sp = {}) {
  const D = ENEMIES[k]; const n = s.floorN || 1; const diff = DIFFICULTY[s.params.difficulty];
  const hp = D.boss ? Math.round(D.hp * diff.hp) : Math.max(1, Math.round(D.hp * (1 + 0.12 * (n - 1)) * diff.hp));
  return { id: s.nextId++, k, x, y, hp, maxHp: hp, energy: 0, st: [], state: sp.state || 'idle', last: sp.last || null, mem: 0, home: { x, y }, post: sp.post || null,
    pack: sp.pack || 0, cd: {}, windup: null, intent: { t: sp.state === 'asleep' ? 'asleep' : 'idle' }, summoner: sp.summoner || 0, packWait: 0, sees: 0,
    dmgB: D.boss ? diff.dmg : Math.floor((n - 1) / 2) + diff.dmg, accB: D.boss ? 0 : Math.floor((n - 1) / 2), fst: -99, phase2: 0, fleeT: 0 };
}

// ------------------------------------------------------------ derived
function invalidate(s) { s._losDirty = true; s._lightDirty = true; s._maps = null; }
function tileChanged(s) { invalidate(s); }
function pstats(p) {
  const C = CLASSES[p.cls];
  const w = p.eq.weapon ? ITEMS[p.eq.weapon.k] : { dmg: [1, 3], acc: 0, crit: 0 };
  const a = p.eq.armor ? ITEMS[p.eq.armor.k] : {}; const tr = p.eq.trinket ? ITEMS[p.eq.trinket.k] : {}; const r = p.eq.ranged ? ITEMS[p.eq.ranged.k] : null;
  const lvlAcc = Math.floor(p.level / 2), lvlDmg = Math.floor((p.level - 1) / 3);
  const st = { maxHp: p.baseHp + (tr.hp || 0), acc: C.acc + lvlAcc + (w.acc || 0) + (tr.acc || 0), eva: C.eva + (a.eva || 0),
    armor: (a.armor || 0) + (tr.armor || 0) + (hasSt(p, 'shield') ? 3 : 0), dmg: [w.dmg[0] + lvlDmg, w.dmg[1] + lvlDmg], crit: 5 + (w.crit || 0) + (tr.crit || 0),
    critMult: w.critMult || 2, pierce: w.pierce || 0, onCrit: w.onCrit || null, reach: w.reach || 1, spell: (w.spell || 0) + (a.spell || 0) + Math.floor((p.level - 1) / 2),
    stealth: tr.stealth || 0, noisy: a.noisy || 0, immune: tr.immune || [], sight: 8,
    range: r ? r.range : 0, rDmg: r ? [r.dmg[0] + lvlDmg, r.dmg[1] + lvlDmg] : null, rAcc: r ? C.acc + lvlAcc + r.acc + (tr.acc || 0) : 0, rCrit: r ? 5 + r.crit + (tr.crit || 0) : 0 };
  return st;
}
function estats(e) {
  const D = ENEMIES[e.k];
  return { acc: D.acc + e.accB, eva: D.eva - (hasSt(e, 'stun') || hasSt(e, 'root') ? 3 : 0), armor: D.arm + (hasSt(e, 'shield') ? 3 : 0),
    dmg: [Math.max(1, D.dmg[0] + e.dmgB), Math.max(1, D.dmg[1] + e.dmgB)], rdmg: D.rdmg ? [Math.max(1, D.rdmg[0] + e.dmgB), Math.max(1, D.rdmg[1] + e.dmgB)] : null, crit: 5 };
}
const hitChance = (acc, eva) => clamp(70 + 5 * (acc - eva), 5, 95);
function hasSt(a, k) { for (const x of a.st) if (x.k === k) return x; return null; }
function isImmune(s, a, k) { if (a === s.player) return pstats(a).immune.includes(k); return (ENEMIES[a.k].immune || []).includes(k); }
function addSt(s, a, k, turns) {
  if (a.hp <= 0 || isImmune(s, a, k)) return false;
  if (s._inRound && k !== 'stun') turns += 1; // applied mid-round: survive this round's tick
  const cur = hasSt(a, k); if (cur) cur.t = Math.max(cur.t, turns); else a.st.push({ k, t: turns });
  if (k === 'burning' && gget(s.floor, a.x, a.y) === T.WATER) { delSt(a, 'burning'); return false; }
  ev(s, { type: 'status', id: a.id, k });
  return true;
}
function delSt(a, k) { a.st = a.st.filter((x) => x.k !== k); }
const aname = (s, a) => (a === s.player ? 'you' : theName(a.k));
const Aname = (s, a) => { const n = aname(s, a); return n[0].toUpperCase() + n.slice(1); };
function actorAt(s, x, y) { const p = s.player; if (p.x === x && p.y === y && p.hp > 0) return p; for (const e of s.enemies) if (e.hp > 0 && e.x === x && e.y === y) return e; return null; }
function enemyAt(s, x, y) { for (const e of s.enemies) if (e.hp > 0 && e.x === x && e.y === y) return e; return null; }
const trapAt = (s, x, y) => s.traps.find((t) => t.x === x && t.y === y) || null;
function opaqueAt(s, x, y) { if (tOpaque(gget(s.floor, x, y))) return true; return !!s.fx.smoke[y * s.floor.w + x]; }

function computeLight(s) {
  const fl = s.floor, W = fl.w, N = W * fl.h; const L = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = fl.t[i]; const r = t === T.LAVA ? 2 : (TILES[t].light || 0); if (!r) continue;
    const ox = i % W, oy = (i / W) | 0;
    shadowcast(fl, ox, oy, r, (x, y) => tOpaque(gget(fl, x, y)), (x, y) => { const d = Math.hypot(x - ox, y - oy); const v = (t === T.LAVA ? 0.55 : 1) * (1 - d / (r + 1)); const j = y * W + x; if (v > L[j]) L[j] = v; });
  }
  s._light = L; s._lightDirty = false;
}
function lightAt(s, x, y) { if (s._lightDirty || !s._light) computeLight(s); const i = y * s.floor.w + x; return Math.max(s._light[i], s.fx.fire[i] ? 0.9 : 0); }
function updateVision(s) {
  const fl = s.floor, W = fl.w, N = W * fl.h, p = s.player;
  if (!s._los || s._los.length !== N) { s._los = new Uint8Array(N); s._vis = new Uint8Array(N); }
  if (s._lightDirty || !s._light) computeLight(s);
  s._los.fill(0); s._vis.fill(0);
  shadowcast(fl, p.x, p.y, 16, (x, y) => opaqueAt(s, x, y), (x, y) => { s._los[y * W + x] = 1; });
  const sight = STYLES[fl.style].sight; const r2 = sight * sight + sight;
  for (let i = 0; i < N; i++) if (s._los[i]) {
    const x = i % W, y = (i - x) / W; const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
    if (d2 <= r2 || s._light[i] > 0.25 || s.fx.fire[i]) { s._vis[i] = 1; fl.explored[i] = 1; }
  }
  for (const it of s.items) if (s._vis[it.y * W + it.x]) it.seen = 1;
  s._losDirty = false; s._visAt = p.y * W + p.x;
}
function ensureVision(s) { if (s._losDirty || !s._los || s._visAt !== s.player.y * s.floor.w + s.player.x) updateVision(s); }
const isVis = (s, x, y) => { ensureVision(s); return inb(s.floor, x, y) && s._vis[y * s.floor.w + x] === 1; };

// ------------------------------------------------------------ noise & senses
function noise(s, x, y, vol, kind, srcId) {
  const fl = s.floor, W = fl.w; if (vol <= 0) return;
  const d = dmap(fl, [[x, y]], (xx, yy) => { const t = fl.t[yy * W + xx]; if (t === T.WALL || t === T.PILLAR) return -1; if (t === T.DOOR || t === T.LOCKED) return 5; return 1; }, vol + 6);
  for (const e of s.enemies) {
    if (e.id === srcId || e.hp <= 0) continue; const de = d[e.y * W + e.x]; if (de > vol) continue;
    if (e.state === 'asleep') { if (rchance(s.rng, clamp(0.3 + (vol - de) / vol * 0.6, 0.05, 0.95))) { e.state = 'investigating'; e.last = { x, y }; e.mem = 10; e.intent = { t: 'investigate', x, y }; ev(s, { type: 'wake', id: e.id }); } }
    else if (e.state === 'idle' || e.state === 'searching' || e.state === 'investigating' || (e.state === 'guarding' && ENEMIES[e.k].ai !== 'boss')) {
      if (e.post && cheb(x, y, e.post.x, e.post.y) > 6) continue;
      e.state = 'investigating'; e.last = { x, y }; e.mem = 10;
    }
  }
  if (srcId !== 0) { const p = s.player; const dp = d[p.y * W + p.x]; if (dp <= vol + 3) { ensureVision(s); if (!s._vis[y * W + x]) hear(s, x, y, kind, dp); } }
}
const SOUND_TEXT = { combat: 'the clash of combat', door: 'a door creak open', howl: 'a hunting howl', squeak: 'excited squeaking', chant: 'guttural chanting', footsteps: 'footsteps',
  alarm: 'a shrill alarm', explosion: 'an explosion', roar: 'a furious roar', smash: 'a heavy crash', crumble: 'bones clattering apart', spit: 'a wet spitting sound', twang: 'a bowstring' };
function hear(s, x, y, kind, d) {
  if (s.sounds.some((q) => q.turn === s.turn && q.kind === kind && cheb(q.x, q.y, x, y) <= 3)) return;
  s.sounds.push({ x, y, kind, turn: s.turn });
  const p = s.player; const where = d <= 2 ? 'right beside you' : `to the ${dirName(x - p.x, y - p.y)}`;
  log(s, `You hear ${SOUND_TEXT[kind] || kind} ${where}.`, 'sense');
  ev(s, { type: 'hear', x, y, kind });
}

// ------------------------------------------------------------ player actions
function applyAction(s, a) {
  s._msg = null; if (!s._ev) s._ev = [];
  if (!Array.isArray(a) || typeof a[0] !== 'string') return fail(s, 'Malformed action.');
  if (s.over && !(a[0] === 'r' && s.over.result === 'dead')) return fail(s, 'The run is over.');
  let cost = 0;
  switch (a[0]) {
    case 'm': cost = actMove(s, a[1] | 0, a[2] | 0); break;
    case 'w': cost = 100; s.player.searching = 0; break;
    case 's': cost = actSearch(s); break;
    case 'g': cost = actPickup(s); break;
    case 'd': cost = actDescend(s); break;
    case 'i': cost = actInteract(s, a[1] | 0, a[2] | 0); break;
    case 'c': cost = actClose(s, a[1] | 0, a[2] | 0); break;
    case 'u': cost = actUse(s, a[1] | 0, a[2], a[3]); break;
    case 'e': cost = actEquip(s, a[1] | 0); break;
    case 'x': cost = actDrop(s, a[1] | 0); break;
    case 'f': cost = actFire(s, a[1] | 0, a[2] | 0); break;
    case 'a': cost = actAbility(s, a[1] | 0, a[2] | 0, a[3] | 0); break;
    case 'r': return actRestartFloor(s);
    default: return fail(s, 'Unknown action.');
  }
  if (!cost) return false;
  s.stats.turnsOnFloor++;
  if (cost > 0) endPlayerTurn(s, cost);
  ensureVision(s);
  return true;
}
function pspeed(p) { const h = hasSt(p, 'haste'), sl = hasSt(p, 'slow'); return h && !sl ? 200 : sl && !h ? 50 : 100; }
function endPlayerTurn(s, cost) {
  const p = s.player; p.energy -= cost; const startFloor = s.floorN;
  for (let guard = 0; guard < 60 && !s.over; guard++) {
    while (p.energy < 100 && !s.over && s.floorN === startFloor) { worldRound(s); p.energy += pspeed(p); }
    if (s.over || s.floorN !== startFloor) { p.energy = Math.max(p.energy, 100); break; }
    const stun = hasSt(p, 'stun');
    if (stun) { stun.t--; if (stun.t <= 0) delSt(p, 'stun'); log(s, 'You are stunned and lose your turn!', 'bad'); p.energy -= 100; continue; }
    break;
  }
  if (!s.over) detectTraps(s);
}
function detectTraps(s) {
  const p = s.player; ensureVision(s);
  for (const t of s.traps) {
    if (!t.hidden || cheb(t.x, t.y, p.x, p.y) > (p.searching ? 3 : 2) || !s._vis[t.y * s.floor.w + t.x]) continue;
    const ch = 0.14 + (CLASSES[p.cls].detect || 0) + (p.searching ? 0.55 : 0);
    if (rchance(s.rng, ch)) { t.hidden = 0; log(s, `You spot a hidden ${TRAP_NAMES[t.k]}!`, 'warn'); ev(s, { type: 'trapSpotted', x: t.x, y: t.y }); }
  }
  p.searching = 0;
}
const TRAP_NAMES = { spike: 'spike trap', gas: 'gas vent', alarm: 'alarm plate', fire: 'flame jet', net: 'net trap' };
const TRAP_DESC = { spike: '3–6 damage and Bleeding. Stays armed.', gas: 'Releases poison gas (3×3, 6 turns).', alarm: 'Very loud alarm that draws enemies.', fire: 'Bursts into flame (3×3).', net: 'Roots you for 3 turns.' };

function actMove(s, dx, dy) {
  const p = s.player; if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (!dx && !dy)) return fail(s, 'Invalid direction.');
  const nx = p.x + dx, ny = p.y + dy; const fl = s.floor; const t = gget(fl, nx, ny);
  const foe = enemyAt(s, nx, ny);
  if (foe) { if (!diagOk(fl, p.x, p.y, nx, ny)) return fail(s, 'You cannot attack diagonally through a doorway or corner.'); return playerMelee(s, foe); }
  if (t === T.DOOR) { if (!diagOk(fl, p.x, p.y, nx, ny)) return fail(s, 'Doors must be approached straight on.'); openDoor(s, nx, ny, p); return 100; }
  if (t === T.LOCKED) {
    const key = p.inv.find((i) => i.k === 'key');
    if (!key) return fail(s, 'The door is locked. You need an Iron Key.');
    if (!diagOk(fl, p.x, p.y, nx, ny)) return fail(s, 'Doors must be approached straight on.');
    consume(s, key); fl.t[ny * fl.w + nx] = T.OPEN; tileChanged(s); log(s, 'You unlock the vault door with the Iron Key.', 'good'); noise(s, nx, ny, 4, 'door', 0); ev(s, { type: 'sfx', name: 'unlock' }); return 100;
  }
  if (hasSt(p, 'root')) return fail(s, 'You are rooted in place! (Wait, attack, or use Tumble.)');
  if (!tWalk(t)) return fail(s, t === T.CHASM ? 'You stop at the edge of the chasm.' : `${tileName(fl.style, t)} blocks the way.`);
  if (TILES[t].hazard) return fail(s, 'You refuse to walk into the lava.');
  if (!diagOk(fl, p.x, p.y, nx, ny)) return fail(s, 'You cannot squeeze diagonally past that corner or doorway.');
  moveActor(s, p, nx, ny);
  const ps = pstats(p); noise(s, nx, ny, 1 + ps.noisy + (t === T.WATER ? 3 : 0), 'footsteps', 0);
  arriveEffects(s, p);
  return 100;
}
function moveActor(s, a, nx, ny, kb) {
  ev(s, { type: 'move', id: a.id, fx: a.x, fy: a.y, tx: nx, ty: ny, kb: kb ? 1 : 0 });
  a.x = nx; a.y = ny; a._moved = 1;
  if (a === s.player) s._losDirty = true;
  if (gget(s.floor, nx, ny) === T.WATER && hasSt(a, 'burning')) { delSt(a, 'burning'); if (a === s.player) log(s, 'The water douses your flames.', 'good'); }
}
function arriveEffects(s, a) { // traps, lava, items (player)
  const fl = s.floor; const t = gget(fl, a.x, a.y);
  if (t === T.LAVA) { const d = rint(s.rng, 8, 12); log(s, `${Aname(s, a)} ${a === s.player ? 'are' : 'is'} scorched by lava!`, a === s.player ? 'bad' : 'combat'); addSt(s, a, 'burning', 4); damage(s, a, d, null, 'lava'); if (a.hp <= 0) return; }
  const tr = trapAt(s, a.x, a.y); if (tr && tr.armed) triggerTrap(s, tr, a); if (a.hp <= 0) return;
  if (a === s.player) {
    const here = s.items.filter((i) => i.x === a.x && i.y === a.y);
    for (const it of here) if (it.k === 'gold' || it.k === 'arrows') { if (it.k === 'gold') { a.gold += it.qty; log(s, `You pick up ${it.qty} gold.`, 'loot'); } else { if (!addToInv(s, { id: it.id, k: 'arrows', qty: it.qty })) continue; log(s, `You gather ${it.qty} arrow${it.qty > 1 ? 's' : ''}.`, 'loot'); } s.items = s.items.filter((q) => q !== it); ev(s, { type: 'sfx', name: 'coin' }); }
    const rest = s.items.filter((i) => i.x === a.x && i.y === a.y);
    if (rest.length) log(s, `You see ${rest.map((i) => itemLabel(i)).join(', ')} here. (G to pick up)`, 'info');
    if (t === T.DOWN) log(s, 'Stairs lead down into the dark. Press > to descend.', 'info');
  }
}
function openDoor(s, x, y, who) {
  const fl = s.floor; fl.t[y * fl.w + x] = T.OPEN; tileChanged(s);
  ev(s, { type: 'door', x, y, open: 1 });
  if (who === s.player) { log(s, 'You open the door.', 'info'); noise(s, x, y, 3, 'door', 0); }
  else noise(s, x, y, 5, 'door', who.id);
}
function actClose(s, x, y) {
  const p = s.player; const fl = s.floor;
  if (cheb(x, y, p.x, p.y) !== 1) return fail(s, 'Stand next to the door you want to close.');
  if (gget(fl, x, y) !== T.OPEN) return fail(s, 'There is no open door there.');
  if (actorAt(s, x, y) || s.items.some((i) => i.x === x && i.y === y)) return fail(s, 'Something is blocking the doorway.');
  fl.t[y * fl.w + x] = T.DOOR; tileChanged(s); log(s, 'You close the door.', 'info'); noise(s, x, y, 3, 'door', 0); ev(s, { type: 'door', x, y, open: 0 });
  return 100;
}
function actSearch(s) { s.player.searching = 1; log(s, 'You search your surroundings carefully.', 'info'); return 100; }
function itemLabel(it) { const D = ITEMS[it.k]; return it.qty > 1 ? `${it.qty} ${D.name}${D.name.endsWith('s') ? '' : 's'}` : D.name; }
function addToInv(s, it) {
  const p = s.player; const D = ITEMS[it.k];
  if (D.gold) { p.gold += it.qty; return true; }
  if (D.stack) { const ex = p.inv.find((i) => i.k === it.k); if (ex) { ex.qty += it.qty; return true; } }
  if (p.inv.length >= 16) return false;
  p.inv.push({ id: it.id, k: it.k, qty: it.qty }); return true;
}
function consume(s, it, n = 1) { it.qty -= n; if (it.qty <= 0) s.player.inv = s.player.inv.filter((i) => i !== it); }
function dropItem(s, k, qty, x, y, id) {
  const ex = s.items.find((i) => i.x === x && i.y === y && i.k === k && ITEMS[k].stack);
  if (ex) ex.qty += qty; else s.items.push({ id: id || s.nextId++, k, qty, x, y, seen: isVis(s, x, y) ? 1 : 0 });
}
function actPickup(s) {
  const p = s.player; const here = s.items.filter((i) => i.x === p.x && i.y === p.y);
  if (!here.length) return fail(s, 'There is nothing here to pick up.');
  let took = 0;
  for (const it of here) { if (addToInv(s, it)) { s.items = s.items.filter((q) => q !== it); took++; log(s, `You pick up ${itemLabel(it)}.`, 'loot'); } else { log(s, 'Your pack is full (16 slots).', 'warn'); break; } }
  if (took) ev(s, { type: 'sfx', name: 'pickup' });
  return took ? 100 : fail(s, 'Your pack is full.');
}
function actDescend(s) {
  const p = s.player;
  if (gget(s.floor, p.x, p.y) !== T.DOWN) return fail(s, 'There are no stairs down here.');
  s.stats.turnsOnFloor = 0; enterFloor(s, s.floorN + 1, 'descend'); ev(s, { type: 'sfx', name: 'descend' });
  return -1; // accepted; the new floor starts on the player's turn
}
function actRestartFloor(s) {
  if (s.params.permadeath) return fail(s, 'Permadeath is on: floors cannot be restarted.');
  if (!s.floorStart) return fail(s, 'No floor snapshot available.');
  const restarts = s.stats.restarts + 1; const snap = deserialize(JSON.parse(s.floorStart));
  const keep = s.floorStart;
  for (const k of Object.keys(s)) if (k[0] !== '_') delete s[k];
  Object.assign(s, snap); s.floorStart = keep; s.stats.restarts = restarts; s._ev = []; invalidate(s);
  log(s, `You steel yourself and begin depth ${s.floorN} again (restart ${restarts}).`, 'system');
  updateVision(s); ev(s, { type: 'floor', n: s.floorN, how: 'restart' });
  return true;
}
function actEquip(s, id) {
  const p = s.player;
  for (const slot of Object.keys(p.eq)) if (p.eq[slot] && p.eq[slot].id === id) { // unequip
    if (p.inv.length >= 16) return fail(s, 'No room in your pack to unequip that.');
    p.inv.push(p.eq[slot]); p.eq[slot] = null; log(s, `You remove the ${ITEMS[p.inv[p.inv.length - 1].k].name}.`, 'info'); p.hp = Math.min(p.hp, pstats(p).maxHp); return 100;
  }
  const it = p.inv.find((i) => i.id === id); if (!it) return fail(s, 'You do not have that item.');
  const D = ITEMS[it.k]; if (!D.slot) return fail(s, `${D.name} cannot be equipped.`);
  const old = p.eq[D.slot]; p.inv = p.inv.filter((i) => i !== it); if (old) p.inv.push(old); p.eq[D.slot] = it;
  p.hp = Math.min(p.hp, pstats(p).maxHp);
  log(s, `You equip the ${D.name}${old ? ` (swapping out the ${ITEMS[old.k].name})` : ''}.`, 'info'); ev(s, { type: 'sfx', name: 'equip' });
  return 100;
}
function actDrop(s, id) {
  const p = s.player; const it = p.inv.find((i) => i.id === id); if (!it) return fail(s, 'You do not have that item.');
  p.inv = p.inv.filter((i) => i !== it); dropItem(s, it.k, it.qty, p.x, p.y, it.id); log(s, `You drop ${itemLabel(it)}.`, 'info');
  return 100;
}

// ------------------------------------------------------------ targeting & projectiles
// Projectiles follow a continuous line between tile centres (with small
// sub-tile offsets so any target you can see has a findable line). Like sight,
// a shot may pass a diagonal gap between two opaque tiles (movement may not).
// Deterministic, shared by the player and by monsters.
const LINE_OFFS = [[0, 0], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]];
function lineTiles(x0, y0, x1, y1, o0, o1) {
  const ax = x0 + 0.5 + o0[0], ay = y0 + 0.5 + o0[1], bx = x1 + 0.5 + o1[0], by = y1 + 0.5 + o1[1];
  const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 8) + 1; const out = []; let lx = x0, ly = y0;
  for (let i = 1; i <= n; i++) { const t = i / n; const tx = Math.floor(ax + (bx - ax) * t), ty = Math.floor(ay + (by - ay) * t); if (tx !== lx || ty !== ly) { out.push([tx, ty]); lx = tx; ly = ty; } }
  if (!out.length || out[out.length - 1][0] !== x1 || out[out.length - 1][1] !== y1) return null;
  return out;
}
function lineClear(s, x0, y0, line, actorsBlock) {
  for (let k = 0; k < line.length; k++) {
    const [x, y] = line[k]; const last = k === line.length - 1;
    if (!last && (opaqueAt(s, x, y) || (actorsBlock && actorAt(s, x, y)))) return false;
    if (last && opaqueAt(s, x, y)) return false;
  }
  return true;
}
// The exact line symmetric shadowcasting uses: at every row (or column) centre
// the line must fall inside a clear tile; on an exact tie either tile will do.
function centerLine(s, x0, y0, x1, y1, actorsBlock) {
  const dx = x1 - x0, dy = y1 - y0, D = Math.max(Math.abs(dx), Math.abs(dy)); if (!D) return null;
  const bad = (x, y) => opaqueAt(s, x, y) || (actorsBlock && !!actorAt(s, x, y)); const out = []; const xMajor = Math.abs(dx) >= Math.abs(dy);
  for (let d = 1; d <= D; d++) {
    const m = (xMajor ? y0 + dy * d / D : x0 + dx * d / D); const f = Math.floor(m); const maj = (xMajor ? x0 + sign(dx) * d : y0 + sign(dy) * d);
    let mn = Math.round(m); const at = (q) => (xMajor ? [maj, q] : [q, maj]);
    if (m - f === 0.5 && d < D && bad(...at(f + 1))) mn = f;
    const [x, y] = at(mn);
    if (d < D ? bad(x, y) : opaqueAt(s, x, y)) return null;
    out.push([x, y]);
  }
  return out;
}
function bestLine(s, x0, y0, x1, y1, actorsBlock) {
  const c = centerLine(s, x0, y0, x1, y1, actorsBlock); if (c) return c;
  for (const o0 of LINE_OFFS) for (const o1 of LINE_OFFS) { const L = lineTiles(x0, y0, x1, y1, o0, o1); if (L && lineClear(s, x0, y0, L, actorsBlock)) return L; }
  return null;
}
function projectileTrace(s, x0, y0, x1, y1, range) {
  const line = bestLine(s, x0, y0, x1, y1, false) || bresenham(x0, y0, x1, y1).slice(1);
  const path = []; let hit = null, end = [x0, y0];
  for (let k = 0; k < line.length && k < range; k++) {
    const [x, y] = line[k];
    if (!inb(s.floor, x, y) || opaqueAt(s, x, y)) break;
    path.push([x, y]); end = [x, y];
    const a = actorAt(s, x, y); if (a && a !== s.player) { hit = a; break; }
  }
  return { path, hit, end, blocked: !(end[0] === x1 && end[1] === y1) && !hit };
}
function clearShot(s, a, b) { return !!bestLine(s, a.x, a.y, b.x, b.y, true); } // nothing opaque or alive in between
function targetCheck(s, tx, ty, range) {
  const p = s.player;
  if (!inb(s.floor, tx, ty)) return 'That is outside the map.';
  if (tx === p.x && ty === p.y) return 'Pick a target other than yourself.';
  if (!isVis(s, tx, ty)) return 'You cannot see that tile.';
  if (cheb(p.x, p.y, tx, ty) > range) return `Out of range (max ${range}).`;
  return null;
}
function actFire(s, tx, ty) {
  const p = s.player; const ps = pstats(p);
  const dx = tx - p.x, dy = ty - p.y;
  if (ps.reach >= 2 && cheb(p.x, p.y, tx, ty) === 2 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
    const foe = enemyAt(s, tx, ty); const mx = p.x + sign(dx), my = p.y + sign(dy);
    if (foe && !opaqueAt(s, mx, my) && !actorAt(s, mx, my) && isVis(s, tx, ty)) return playerMelee(s, foe, true);
  }
  if (!p.eq.ranged) return fail(s, ps.reach >= 2 ? 'Reach attacks need a foe exactly 2 tiles away in a straight, clear line.' : 'No bow equipped. (Throw items from your inventory instead.)');
  const ammo = p.inv.find((i) => i.k === 'arrows'); if (!ammo) return fail(s, 'You are out of arrows.');
  const bad = targetCheck(s, tx, ty, ps.range); if (bad) return fail(s, bad);
  const tr = projectileTrace(s, p.x, p.y, tx, ty, ps.range);
  if (tr.blocked) return fail(s, 'No clear line of fire to that tile.');
  consume(s, ammo); ev(s, { type: 'proj', kind: 'arrow', x0: p.x, y0: p.y, x1: tr.end[0], y1: tr.end[1] }); ev(s, { type: 'sfx', name: 'bow' });
  if (tr.hit && tr.hit !== p) attack(s, p, tr.hit, { acc: ps.rAcc, dmg: ps.rDmg, crit: ps.rCrit, sneak: unaware(tr.hit), verb: 'shoot' });
  else log(s, 'Your arrow clatters away.', 'info');
  if (rchance(s.rng, 0.5)) { const [ex, ey] = tr.end; if (tWalk(gget(s.floor, ex, ey))) dropItem(s, 'arrows', 1, ex, ey); }
  noise(s, p.x, p.y, 2, 'twang', 0);
  return 100;
}
const unaware = (e) => e.state !== 'hunting' && e.state !== 'fleeing';
function playerMelee(s, e, reach) {
  const p = s.player; const ps = pstats(p);
  attack(s, p, e, { acc: ps.acc, dmg: ps.dmg, crit: ps.crit, critMult: ps.critMult, pierce: ps.pierce, onCrit: ps.onCrit, sneak: unaware(e), verb: reach ? 'lunge at' : 'hit' });
  noise(s, e.x, e.y, 6, 'combat', 0);
  return 100;
}

// ------------------------------------------------------------ combat core
function attack(s, att, def, o) {
  const isP = att === s.player;
  const ds = def === s.player ? pstats(def) : estats(def);
  const eva = def === s.player ? ds.eva - (hasSt(def, 'stun') || hasSt(def, 'root') ? 3 : 0) : ds.eva;
  const ch = o.auto || o.sneak ? 100 : hitChance(o.acc, eva);
  const roll = rint(s.rng, 1, 100);
  ev(s, { type: 'attack', id: att.id, x: att.x, y: att.y, tx: def.x, ty: def.y, ranged: !!o.ranged });
  if (roll > ch) {
    log(s, `${Aname(s, att)} ${isP ? 'miss' : 'misses'} ${aname(s, def)}. (${ch}% to hit)`, 'combat');
    ev(s, { type: 'miss', x: def.x, y: def.y }); ev(s, { type: 'sfx', name: 'miss' });
    if (isP) alertTo(s, def);
    return { hit: false };
  }
  const crit = !!o.sneak || rint(s.rng, 1, 100) <= (o.crit || 5);
  let dmg = rint(s.rng, o.dmg[0], o.dmg[1]);
  if (crit) dmg = Math.floor(dmg * (o.sneak ? Math.max(3, o.critMult || 2) : (o.critMult || 2)));
  const arm = Math.max(0, ds.armor - (o.pierce || 0));
  const absorbed = arm > 0 && !o.trueDmg ? rint(s.rng, 0, crit ? arm >> 1 : arm) : 0;
  dmg = Math.max(1, dmg - absorbed);
  const tag = o.sneak ? ' Sneak attack!' : crit ? ' Critical!' : '';
  log(s, `${Aname(s, att)} ${isP ? o.verb || 'hit' : (o.verbE || 'hits')} ${aname(s, def)} for ${dmg}${absorbed ? ` (${absorbed} absorbed)` : ''}.${tag}`, def === s.player ? 'bad' : crit ? 'good' : 'combat');
  ev(s, { type: 'sfx', name: crit ? 'crit' : 'hit' });
  damage(s, def, dmg, att, o.kind || 'melee', crit);
  if (def.hp > 0) {
    if (crit && o.onCrit === 'bleed') { addSt(s, def, 'bleed', 4); log(s, `${Aname(s, def)} ${def === s.player ? 'are' : 'is'} bleeding.`, 'combat'); }
    if (crit && o.onCrit === 'stun' && addSt(s, def, 'stun', 1)) log(s, `${Aname(s, def)} ${def === s.player ? 'are' : 'is'} stunned!`, 'combat');
    if (o.onHit === 'slow' && !hasSt(def, 'slow') && rchance(s.rng, 0.35) && addSt(s, def, 'slow', 2)) log(s, `A deathly chill slows ${aname(s, def)}.`, def === s.player ? 'bad' : 'combat');
    if (o.onHit === 'root' && addSt(s, def, 'root', 3)) log(s, `${Aname(s, def)} ${def === s.player ? 'are' : 'is'} pinned in place!`, 'combat');
    if (o.onHit === 'burn' && addSt(s, def, 'burning', 3)) log(s, `${Aname(s, def)} ${def === s.player ? 'catch' : 'catches'} fire!`, def === s.player ? 'bad' : 'combat');
  }
  return { hit: true, crit, dmg };
}
function alertTo(s, e) { if (e.hp > 0 && e.state !== 'fleeing') { e.state = 'hunting'; e.last = { x: s.player.x, y: s.player.y }; e.mem = 14; } }
function damage(s, a, amount, src, kind, crit) {
  if (a.hp <= 0) return;
  a.hp -= amount;
  ev(s, { type: 'dmg', id: a.id, x: a.x, y: a.y, amount, crit: !!crit, kind });
  if (a === s.player) {
    s.stats.dmgTaken += amount; a.lastHurt = s.turn;
    if (a.hp <= 0) { a.hp = 0; const cause = src && src !== a ? `Slain by ${ENEMIES[src.k].name} on depth ${s.floorN}` : `Killed by ${kind === 'lava' ? 'lava' : kind === 'poison' ? 'poison' : kind === 'burning' ? 'flames' : kind === 'bleed' ? 'blood loss' : kind === 'trap' ? 'a trap' : kind} on depth ${s.floorN}`; die(s, cause); }
    return;
  }
  if (src === s.player || !src) s.stats.dmgDealt += amount;
  if (a.hp <= 0) killEnemy(s, a, src, kind);
  else if (src === s.player && a.state !== 'fleeing') alertTo(s, a);
}
function die(s, cause) {
  s.over = { result: 'dead', cause, turn: s.turn, floor: s.floorN }; s.over.score = computeScore(s);
  log(s, `You die. ${cause}.`, 'bad'); ev(s, { type: 'death', id: 0, x: s.player.x, y: s.player.y }); ev(s, { type: 'sfx', name: 'death' });
}
function computeScore(s) {
  const p = s.player; const v = s.over && s.over.result === 'victory';
  const raw = p.gold + 10 * p.xpTotal + 200 * (s.stats.deepest - 1) + (v ? 3000 : 0) - Math.floor(s.turn / 25) - 150 * s.stats.restarts;
  return Math.max(0, Math.round(raw * DIFFICULTY[s.params.difficulty].score * (s.params.startFloor > 1 ? 0.5 : 1)));
}
function killEnemy(s, e, src, kind) {
  e.hp = 0; const D = ENEMIES[e.k];
  const how = kind === 'chasm' ? 'plunges into the chasm' : kind === 'lava' ? 'is consumed by lava' : kind === 'crumble' ? 'crumbles to dust' : 'dies';
  log(s, `${theName(e.k, 1)} ${how}.`, 'good');
  ev(s, { type: 'death', id: e.id, x: e.x, y: e.y, k: e.k });
  s.stats.kills++; s.stats.killsBy[e.k] = (s.stats.killsBy[e.k] || 0) + 1;
  if (kind !== 'crumble') gainXp(s, e.summoner ? 1 : D.xp);
  if (kind !== 'chasm' && kind !== 'lava') {
    const r = s.rng;
    if ((e.k === 'goblin' || e.k === 'brute') && rchance(r, 0.5)) dropItem(s, 'gold', rint(r, 3, 8) * s.floorN, e.x, e.y);
    if (e.k === 'archer' && rchance(r, 0.6)) dropItem(s, 'arrows', rint(r, 2, 4), e.x, e.y);
    if (e.k === 'cultist' && rchance(r, 0.5)) dropItem(s, rweighted(r, CONSUMABLE_TABLE), 1, e.x, e.y);
  }
  for (const m of s.enemies) if (m.hp > 0 && m.summoner === e.id) { m.hp = 0; log(s, `${theName(m.k, 1)} collapses as its master falls.`, 'good'); ev(s, { type: 'death', id: m.id, x: m.x, y: m.y, k: m.k }); noise(s, m.x, m.y, 4, 'crumble', m.id); }
  if (D.boss) {
    s.over = { result: 'victory', cause: 'Slew the Hollow King', turn: s.turn, floor: s.floorN }; s.over.score = computeScore(s);
    log(s, 'The Hollow King shatters into embers. The Emberdeep is quiet at last. VICTORY!', 'good'); ev(s, { type: 'sfx', name: 'victory' }); ev(s, { type: 'victory' });
  }
}
function gainXp(s, n) {
  const p = s.player; p.xp += n; p.xpTotal += n;
  while (p.xp >= XP_FOR(p.level)) { p.xp -= XP_FOR(p.level); levelUp(s); }
}
function levelUp(s, quiet) {
  const p = s.player; const C = CLASSES[p.cls]; p.level++; p.baseHp += C.hpPer;
  const mx = pstats(p).maxHp; p.hp = Math.min(mx, p.hp + Math.ceil(mx * 0.3) + C.hpPer);
  if (!quiet) { log(s, `You reach level ${p.level}! (+${C.hpPer} max HP${p.level % 2 === 0 ? ', +1 accuracy' : ''})`, 'good'); ev(s, { type: 'levelup' }); ev(s, { type: 'sfx', name: 'levelup' }); }
}
function knockback(s, a, dx, dy, n, src) {
  for (let k = 0; k < n; k++) {
    if (a.hp <= 0) return;
    const nx = a.x + dx, ny = a.y + dy; const t = gget(s.floor, nx, ny);
    if (t === T.CHASM && s.floorN < LAST_FLOOR) { fallIn(s, a, nx, ny); return; }
    const occ = actorAt(s, nx, ny);
    if (!tWalk(t) || occ || !diagOk(s.floor, a.x, a.y, nx, ny) || t === T.CHASM) {
      log(s, `${Aname(s, a)} ${a === s.player ? 'slam' : 'slams'} into ${occ ? aname(s, occ) : 'the ' + tileName(s.floor.style, t).toLowerCase()}!`, 'combat');
      ev(s, { type: 'impact', x: a.x, y: a.y }); ev(s, { type: 'sfx', name: 'smash' });
      damage(s, a, 3, src, 'impact'); if (a.hp > 0) addSt(s, a, 'stun', 1);
      if (occ) damage(s, occ, 2, src, 'impact');
      return;
    }
    moveActor(s, a, nx, ny, 1); arriveEffects(s, a);
  }
}
function fallIn(s, a, x, y) {
  ev(s, { type: 'fall', id: a.id, x, y });
  if (a === s.player) {
    log(s, 'You tumble over the edge into the chasm!', 'bad'); const d = rint(s.rng, 3, 6);
    damage(s, a, d, null, 'fall'); if (a.hp <= 0) return;
    enterFloor(s, s.floorN + 1, 'fall');
    return;
  }
  a.x = x; a.y = y; killEnemy(s, a, s.player, 'chasm');
}

// ------------------------------------------------------------ traps & environment
function triggerTrap(s, tr, a) {
  const isP = a === s.player; tr.hidden = 0; const r = s.rng;
  log(s, `${Aname(s, a)} ${isP ? 'trigger' : 'triggers'} a ${TRAP_NAMES[tr.k]}!`, isP ? 'bad' : 'combat'); ev(s, { type: 'trap', x: tr.x, y: tr.y, k: tr.k }); ev(s, { type: 'sfx', name: 'trap' });
  if (tr.k === 'spike') { const arm = a === s.player ? pstats(a).armor : estats(a).armor; damage(s, a, Math.max(1, rint(r, 3, 6) - (arm >> 1)), null, 'trap'); if (a.hp > 0) addSt(s, a, 'bleed', 3); }
  else if (tr.k === 'gas') { tr.armed = 0; spawnCloud(s, 'gas', tr.x, tr.y, 1, 6); }
  else if (tr.k === 'alarm') { tr.armed = 0; noise(s, tr.x, tr.y, 24, 'alarm', -1); for (const e of s.enemies) if (e.hp > 0 && e.state !== 'hunting' && cheb(e.x, e.y, tr.x, tr.y) <= 18 && !(e.post && ENEMIES[e.k].ai === 'guard')) { if (e.state === 'asleep') e.state = 'investigating'; e.last = { x: tr.x, y: tr.y }; e.mem = 14; } }
  else if (tr.k === 'fire') { tr.armed = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ignite(s, tr.x + dx, tr.y + dy, 4); addSt(s, a, 'burning', 3); }
  else if (tr.k === 'net') { tr.armed = 0; addSt(s, a, 'root', 3); }
}
function ignite(s, x, y, turns) {
  const fl = s.floor; const t = gget(fl, x, y); if (!inb(fl, x, y)) return;
  if (t === T.WATER || t === T.CHASM || tSolid(t) || t === T.CHEST || t === T.SHRINE || t === T.CHEST_OPEN || t === T.SHRINE_USED) return;
  const i = y * fl.w + x; s.fx.fire[i] = Math.max(s.fx.fire[i] || 0, t === T.GRASS ? 5 : turns); s._lightDirty = true;
}
function spawnCloud(s, kind, cx, cy, r, turns) {
  const fl = s.floor;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (!inb(fl, x, y) || tSolid(gget(fl, x, y)) || (x - cx) ** 2 + (y - cy) ** 2 > r * r + r) continue;
    const i = y * fl.w + x; s.fx[kind][i] = Math.max(s.fx[kind][i] || 0, turns);
  }
  if (kind === 'smoke') s._losDirty = true;
  if (kind === 'gas') for (const a of [s.player, ...s.enemies]) if (a.hp > 0 && s.fx.gas[a.y * fl.w + a.x]) addSt(s, a, 'poison', 3);
}
function tickEnvironment(s) {
  const fl = s.floor, W = fl.w; const fire = s.fx.fire; const add = {};
  for (const key of Object.keys(fire)) {
    const i = +key, x = i % W, y = (i - x) / W;
    const a = actorAt(s, x, y); if (a && addSt(s, a, 'burning', 3) && a === s.player) log(s, 'You are caught in the flames!', 'bad');
    for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy, ni = ny * W + nx; if (gget(fl, nx, ny) === T.GRASS && !fire[ni] && !add[ni] && rchance(s.rng, 0.45)) add[ni] = 5; }
    fire[i]--; if (fire[i] <= 0) { delete fire[i]; if (fl.t[i] === T.GRASS) { fl.t[i] = T.ASH; tileChanged(s); } }
  }
  for (const k of Object.keys(add)) { fire[k] = add[k]; }
  if (Object.keys(add).length) s._lightDirty = true;
  const gas = s.fx.gas;
  for (const key of Object.keys(gas)) { const i = +key; const a = actorAt(s, i % W, (i / W) | 0); if (a) addSt(s, a, 'poison', 3); gas[i]--; if (gas[i] <= 0) delete gas[i]; }
  const sm = s.fx.smoke; let cleared = false;
  for (const key of Object.keys(sm)) { sm[key]--; if (sm[key] <= 0) { delete sm[key]; cleared = true; } }
  if (cleared) s._losDirty = true;
}
function tickStatuses(s) {
  const actors = [s.player, ...s.enemies];
  for (const a of actors) {
    if (a.hp <= 0) continue;
    for (const st of a.st.slice()) {
      if (a.hp <= 0) break;
      if (st.k === 'poison') damage(s, a, 1, null, 'poison');
      else if (st.k === 'bleed') damage(s, a, 1, null, 'bleed');
      else if (st.k === 'burning') { damage(s, a, 2, null, 'burning'); if (a.hp > 0 && gget(s.floor, a.x, a.y) === T.GRASS) ignite(s, a.x, a.y, 5); }
      else if (st.k === 'regen') { const mx = a === s.player ? pstats(a).maxHp : a.maxHp; a.hp = Math.min(mx, a.hp + 1); }
      if (st.k !== 'stun') st.t--;
    }
    a.st = a.st.filter((x) => x.t > 0);
    if (a !== s.player) for (const k of Object.keys(a.cd)) { if (a.cd[k] > 0) a.cd[k]--; }
  }
  const p = s.player; for (const k of Object.keys(p.cd)) if (p.cd[k] > 0) p.cd[k]--;
}

// ------------------------------------------------------------ world round
function worldRound(s) {
  s.turn++; s._inRound = true; s._maps = null; const startFloor = s.floorN;
  for (const e of s.enemies.slice()) {
    if (e.hp <= 0) continue; if (s.over || s.floorN !== startFloor) break;
    e._moved = 0;
    e.energy += espeed(e);
    let guard = 0;
    while (e.energy >= 100 && e.hp > 0 && !s.over && s.floorN === startFloor && guard++ < 4) { e.energy -= 100; enemyTurn(s, e); }
    if (e.energy > 100) e.energy = 100;
  }
  if (!s.over && s.floorN === startFloor) {
    tickEnvironment(s); tickStatuses(s);
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    footsteps(s);
  }
  s.sounds = s.sounds.filter((q) => s.turn - q.turn <= 2);
  s._inRound = false;
}
function espeed(e) { let v = ENEMIES[e.k].speed; if (e.phase2) v = 130; if (hasSt(e, 'haste')) v *= 2; if (hasSt(e, 'slow')) v = Math.floor(v / 2); return v; }
function footsteps(s) {
  const p = s.player; ensureVision(s); const W = s.floor.w;
  for (const e of s.enemies) {
    if (!e._moved || e.state === 'asleep' || s._vis[e.y * W + e.x]) continue;
    if (cheb(e.x, e.y, p.x, p.y) > 5 || s.turn - e.fst < 6 || e.k === 'wraith') continue; // wraiths drift silently
    e.fst = s.turn; hear(s, e.x, e.y, 'footsteps', cheb(e.x, e.y, p.x, p.y));
  }
}

// ------------------------------------------------------------ monster AI
function canSeePlayer(s, e) {
  const p = s.player; if (p.hp <= 0) return false; ensureVision(s);
  const W = s.floor.w; if (!s._los[e.y * W + e.x]) return false;
  const ps = pstats(p); let range = ENEMIES[e.k].sight - ps.stealth;
  if (lightAt(s, p.x, p.y) > 0.3) range += 2;
  if (gget(s.floor, p.x, p.y) === T.GRASS) range -= 2;
  return cheb(e.x, e.y, p.x, p.y) <= Math.max(1, range);
}
function perceive(s, e) {
  const D = ENEMIES[e.k], p = s.player; const d = cheb(e.x, e.y, p.x, p.y);
  const sees = canSeePlayer(s, e); const senses = !!D.lifesense && d <= D.lifesense;
  if (e.state === 'asleep') {
    let wake = senses && rchance(s.rng, 0.5);
    if (!wake && sees) wake = rchance(s.rng, clamp(0.55 - d * 0.07 - pstats(p).stealth * 0.06, 0.05, 0.55));
    if (wake) { e.state = 'idle'; ev(s, { type: 'wake', id: e.id }); } else { e.sees = 0; return; }
  }
  if (sees || senses) {
    if (e.state !== 'hunting' && e.state !== 'fleeing') spotted(s, e, sees);
    if (e.state !== 'fleeing') e.state = 'hunting';
    e.last = { x: p.x, y: p.y }; e.mem = 14; e.sees = 1;
  } else {
    e.sees = 0;
    if (e.state === 'hunting') { e.state = D.ai === 'guard' ? 'guarding' : 'searching'; e.mem = 10; }
  }
}
function spotted(s, e, sees) {
  const D = ENEMIES[e.k]; ensureVision(s); const vis = s._vis[e.y * s.floor.w + e.x];
  if (vis) { log(s, `${theName(e.k, 1)} ${D.boss ? 'rises from his throne!' : sees ? 'notices you!' : 'senses your life-force!'}`, 'warn'); ev(s, { type: 'spot', id: e.id }); }
  if (D.ai === 'pack') {
    noise(s, e.x, e.y, e.k === 'jackal' ? 10 : 6, e.k === 'jackal' ? 'howl' : 'squeak', e.id);
    for (const m of s.enemies) if (m !== e && m.hp > 0 && m.pack === e.pack && m.state !== 'hunting') { m.state = 'hunting'; m.last = { x: s.player.x, y: s.player.y }; m.mem = 14; }
  }
  if (D.boss) { noise(s, e.x, e.y, 16, 'roar', e.id); ev(s, { type: 'sfx', name: 'roar' }); }
}
function walkCost(s, opts) { // monster movement cost map
  const fl = s.floor, W = fl.w;
  return (x, y) => {
    const t = fl.t[y * W + x];
    if (t === T.LOCKED) return -1; if (t === T.DOOR) return opts.doors ? 2 : -1;
    if (!tWalk(t) || TILES[t].hazard) return -1;
    let c = 1; const i = y * W + x;
    if (s.fx.fire[i]) c += 10; if (s.fx.gas[i] && !opts.gasImm) c += 5;
    const tr = trapAt(s, x, y); if (tr && tr.armed) c += 12;
    return c;
  };
}
function mapTo(s, tx, ty, e, avoidPlayer) {
  const D = ENEMIES[e.k]; const doors = !D.animal, gasImm = (D.immune || []).includes('poison'); const p = s.player;
  const key = `${tx},${ty},${doors ? 1 : 0}${gasImm ? 1 : 0}${avoidPlayer ? `a${p.x},${p.y}` : ''}`;
  if (!s._maps) s._maps = new Map();
  let m = s._maps.get(key);
  if (!m) { const base = walkCost(s, { doors, gasImm }); m = dmap(s.floor, [[tx, ty]], avoidPlayer ? (x, y) => (x === p.x && y === p.y ? -1 : base(x, y)) : base); s._maps.set(key, m); }
  return m;
}
function safetyMap(s, e) {
  const p = s.player; const D = ENEMIES[e.k]; const key = `safe,${p.x},${p.y},${D.animal ? 0 : 1}`;
  if (!s._maps) s._maps = new Map();
  let m = s._maps.get(key);
  if (!m) { const to = mapTo(s, p.x, p.y, e); const src = []; const W = s.floor.w; for (let i = 0; i < to.length; i++) if (to[i] < INF) src.push([i % W, (i / W) | 0, -1.3 * to[i]]); m = dmap(s.floor, src, walkCost(s, { doors: !D.animal })); s._maps.set(key, m); }
  return m;
}
function canEnemyEnter(s, e, nx, ny) {
  const t = gget(s.floor, nx, ny); const D = ENEMIES[e.k];
  if (t === T.DOOR) return !D.animal && diagOk(s.floor, e.x, e.y, nx, ny) && !actorAt(s, nx, ny);
  if (!tWalk(t) || TILES[t].hazard) return false;
  if (!diagOk(s.floor, e.x, e.y, nx, ny) || actorAt(s, nx, ny)) return false;
  const tr = trapAt(s, nx, ny); if (tr && tr.armed) return false;
  if (e.post && ENEMIES[e.k].ai === 'guard' && cheb(nx, ny, e.post.x, e.post.y) > 5) return false;
  return true;
}
function stepOn(s, e, dist, allowEqual, tx, ty) {
  const W = s.floor.w; const cur = dist[e.y * W + e.x]; let best = null, bv = cur;
  for (const [dx, dy] of DIRS8) {
    const nx = e.x + dx, ny = e.y + dy; if (!canEnemyEnter(s, e, nx, ny)) continue;
    const v = dist[ny * W + nx];
    // a sidestep (same path length) is only taken if it gets geometrically closer: no jittering in corridors
    if (v < bv || (allowEqual && !best && v === cur && v < INF && cheb(nx, ny, tx, ty) < cheb(e.x, e.y, tx, ty))) { bv = v; best = [nx, ny]; }
  }
  return best;
}
function doStep(s, e, step) {
  const [nx, ny] = step;
  if (gget(s.floor, nx, ny) === T.DOOR) { openDoor(s, nx, ny, e); e.intent = { t: 'door', x: nx, y: ny }; return true; }
  moveActor(s, e, nx, ny); return true;
}
function approach(s, e, tx, ty, tag = 'hunt', avoidPlayer) {
  const m = mapTo(s, tx, ty, e, avoidPlayer); let st = stepOn(s, e, m, false);
  if (!st && cheb(e.x, e.y, tx, ty) > 1) st = stepOn(s, e, m, true, tx, ty); // sidestep around a blocker
  e.intent = { t: st ? tag : 'blocked', x: tx, y: ty };
  if (st) return doStep(s, e, st);
  return false;
}
function retreat(s, e) {
  const m = safetyMap(s, e); const st = stepOn(s, e, m, false);
  if (st && cheb(st[0], st[1], s.player.x, s.player.y) >= cheb(e.x, e.y, s.player.x, s.player.y)) { e.intent = { t: 'retreat', x: st[0], y: st[1] }; return doStep(s, e, st); }
  return false;
}
function wander(s, e, radius) {
  const home = e.home || e; const opts = [];
  for (const [dx, dy] of DIRS8) { const nx = e.x + dx, ny = e.y + dy; if (gget(s.floor, nx, ny) === T.DOOR) continue; if (canEnemyEnter(s, e, nx, ny) && cheb(nx, ny, home.x, home.y) <= radius) opts.push([nx, ny]); }
  if (opts.length) { const st = rpick(s.rng, opts); moveActor(s, e, st[0], st[1]); }
}
const canMelee = (s, a, b) => cheb(a.x, a.y, b.x, b.y) === 1 && diagOk(s.floor, a.x, a.y, b.x, b.y);
function enemyMelee(s, e, target) {
  const es = estats(e); const D = ENEMIES[e.k];
  e.intent = { t: 'attack', x: target.x, y: target.y };
  attack(s, e, target, { acc: es.acc, dmg: es.dmg, crit: es.crit, onHit: D.onHit, verbE: D.ai === 'pack' ? 'bites' : 'hits' });
  noise(s, e.x, e.y, 6, 'combat', e.id);
}
function enemyShoot(s, e, target, kind) {
  const es = estats(e); const D = ENEMIES[e.k];
  e.intent = { t: 'shoot', x: target.x, y: target.y };
  ev(s, { type: 'proj', kind, x0: e.x, y0: e.y, x1: target.x, y1: target.y });
  const vis = isVis(s, e.x, e.y);
  if (!vis) log(s, kind === 'lance' ? 'A soul lance streaks out of the darkness!' : 'Something shoots at you from the darkness!', 'bad');
  attack(s, e, target, { acc: es.acc + (kind === 'lance' ? 3 : 0), dmg: es.rdmg || es.dmg, crit: 5, ranged: 1, kind: 'ranged', onHit: kind === 'ember' && rchance(s.rng, 0.3) ? 'burn' : null, verbE: kind === 'arrow' ? 'shoots' : kind === 'lance' ? 'impales' : 'scorches' });
  noise(s, e.x, e.y, 3, 'twang', e.id);
  if (D.ai === 'ranged') ev(s, { type: 'sfx', name: 'bow' });
}
function summon(s, e, k, count) {
  let n = 0; if (s.enemies.length > 60) return 0;
  for (const [dx, dy] of DIRS8) {
    if (n >= count) break; const x = e.x + dx, y = e.y + dy; const t = gget(s.floor, x, y);
    if (!tWalk(t) || TILES[t].hazard || actorAt(s, x, y) || t === T.OPEN) continue;
    const m = makeEnemy(s, k, x, y, { state: 'hunting', summoner: e.id, last: { x: s.player.x, y: s.player.y } }); m.mem = 14; s.enemies.push(m); n++;
    ev(s, { type: 'summon', x, y });
  }
  if (n) { e.intent = { t: 'summon' }; if (isVis(s, e.x, e.y)) log(s, `${theName(e.k, 1)} raises ${n} skeleton${n > 1 ? 's' : ''} from the floor!`, 'warn'); noise(s, e.x, e.y, 7, 'chant', e.id); ev(s, { type: 'sfx', name: 'summon' }); }
  return n;
}
function passiveBehaviour(s, e) {
  const D = ENEMIES[e.k];
  if (e.state === 'guarding') {
    const post = e.post || e.home;
    if (e.x !== post.x || e.y !== post.y) { if (!approach(s, e, post.x, post.y, 'return')) e.intent = { t: 'guard', x: post.x, y: post.y }; }
    else e.intent = { t: 'guard', x: post.x, y: post.y };
    return;
  }
  if (e.state === 'investigating' || e.state === 'searching') {
    if (e.last) {
      if ((e.x === e.last.x && e.y === e.last.y) || cheb(e.x, e.y, e.last.x, e.last.y) === 0) e.last = null;
      else { const tag = e.state === 'searching' ? 'search' : 'investigate'; if (!approach(s, e, e.last.x, e.last.y, tag)) { if (cheb(e.x, e.y, e.last.x, e.last.y) <= 1 || rchance(s.rng, 0.3)) e.last = null; } return; }
    }
    e.mem--; e.intent = { t: 'search' };
    if (e.mem <= 0) { e.state = e.post ? 'guarding' : 'idle'; e.home = { x: e.x, y: e.y }; return; }
    e.home = e.home || { x: e.x, y: e.y }; wander(s, e, 4); return;
  }
  e.intent = { t: 'idle' };
  if (D.ai !== 'boss' && rchance(s.rng, 0.3)) wander(s, e, 4);
}
function enemyTurn(s, e) {
  const D = ENEMIES[e.k]; const p = s.player;
  const stun = hasSt(e, 'stun');
  if (stun) { stun.t--; if (stun.t <= 0) delSt(e, 'stun'); e.intent = { t: 'stunned' }; return; }
  perceive(s, e);
  if (e.state === 'asleep') { e.intent = { t: 'asleep' }; return; }
  if (e.windup) return resolveWindup(s, e);
  const rooted = !!hasSt(e, 'root');
  if (D.flee && e.state === 'hunting' && e.hp <= e.maxHp * D.flee) { e.state = 'fleeing'; e.fleeT = 0; if (isVis(s, e.x, e.y)) log(s, `${theName(e.k, 1)} turns to flee!`, 'good'); }
  if (e.state === 'fleeing') {
    e.fleeT++;
    if (!e.sees && e.fleeT % 2 === 0) e.hp = Math.min(e.maxHp, e.hp + 1);
    if (e.hp > e.maxHp * 0.6 || e.fleeT > 25) { e.state = e.sees ? 'hunting' : 'searching'; e.mem = 8; }
    else {
      if (!rooted && retreat(s, e)) { e.intent.t = 'flee'; return; }
      if (canMelee(s, e, p)) return enemyMelee(s, e, p);
      e.intent = { t: 'cower' }; return;
    }
  }
  if (e.state !== 'hunting') return passiveBehaviour(s, e);
  const d = cheb(e.x, e.y, p.x, p.y);
  const mv = (fn) => { if (rooted) { e.intent = { t: 'rooted' }; return true; } return fn(); };
  switch (D.ai) {
    case 'pack': {
      if (canMelee(s, e, p)) return enemyMelee(s, e, p);
      const mates = s.enemies.filter((m) => m !== e && m.hp > 0 && m.pack && m.pack === e.pack && m.state !== 'asleep');
      const close = mates.filter((m) => cheb(m.x, m.y, e.x, e.y) <= 3).length;
      if (mates.length && close < Math.min(2, mates.length) && d > 2 && e.packWait < 5) {
        e.packWait++; const m = mates.slice().sort((a, b) => cheb(a.x, a.y, e.x, e.y) - cheb(b.x, b.y, e.x, e.y))[0];
        if (cheb(m.x, m.y, e.x, e.y) > 1) mv(() => approach(s, e, m.x, m.y, 'regroup')); else e.intent = { t: 'regroup', x: m.x, y: m.y };
        e.intent.t = 'regroup'; return;
      }
      return mv(() => flank(s, e));
    }
    case 'flank': if (canMelee(s, e, p)) return enemyMelee(s, e, p); return mv(() => flank(s, e));
    case 'ranged': {
      if (canMelee(s, e, p)) { if (!rooted && rchance(s.rng, 0.65) && retreat(s, e)) return; return enemyMelee(s, e, p); }
      if (d <= D.range && clearShot(s, e, p)) return enemyShoot(s, e, p, 'arrow');
      if (d <= 2 && !rooted && retreat(s, e)) return;
      return mv(() => approach(s, e, p.x, p.y, 'aim'));
    }
    case 'artillery': {
      if (canMelee(s, e, p) && !rooted && retreat(s, e)) return;
      if (!e.cd.spit && d <= D.range && d >= 2) {
        e.cd.spit = 4; e.intent = { t: 'spit', x: p.x, y: p.y };
        ev(s, { type: 'proj', kind: 'spore', x0: e.x, y0: e.y, x1: p.x, y1: p.y }); ev(s, { type: 'sfx', name: 'spit' });
        log(s, isVis(s, e.x, e.y) ? `${theName(e.k, 1)} lobs a cloud of spores at you!` : 'A glob of spores arcs out of the dark!', 'bad');
        spawnCloud(s, 'gas', p.x, p.y, 1, 5); noise(s, e.x, e.y, 4, 'spit', e.id); return;
      }
      if (canMelee(s, e, p)) return enemyMelee(s, e, p);
      if (d <= 2 && !rooted && retreat(s, e)) return;
      if (d > D.range) return mv(() => approach(s, e, p.x, p.y, 'aim'));
      e.intent = { t: 'aim', x: p.x, y: p.y }; return;
    }
    case 'summoner': {
      const mine = s.enemies.filter((m) => m.hp > 0 && m.summoner === e.id).length;
      if (!e.cd.summon && mine < 3) { if (summon(s, e, 'skeleton', 2)) { e.cd.summon = 11; return; } }
      if (d <= 2 && !rooted && retreat(s, e)) return;
      if (canMelee(s, e, p)) return enemyMelee(s, e, p);
      if (d <= D.range && !e.cd.bolt && clearShot(s, e, p)) { e.cd.bolt = 2; return enemyShoot(s, e, p, 'ember'); }
      if (d > 5) return mv(() => approach(s, e, p.x, p.y, 'hunt'));
      e.intent = { t: 'chant' }; return;
    }
    case 'guard': {
      const post = e.post || e.home;
      if (cheb(p.x, p.y, post.x, post.y) > 6) { e.state = 'guarding'; return passiveBehaviour(s, e); }
      if (canMelee(s, e, p)) return enemyMelee(s, e, p);
      return mv(() => approach(s, e, p.x, p.y, 'hunt'));
    }
    case 'brute': {
      if (canMelee(s, e, p)) {
        e.windup = { kind: 'smash', x: p.x, y: p.y, tiles: [[p.x, p.y]] }; e.intent = { t: 'windup', x: p.x, y: p.y };
        log(s, `${theName(e.k, 1)} raises its club over your head! (Step away!)`, 'warn'); ev(s, { type: 'sfx', name: 'windup' }); return;
      }
      return mv(() => approach(s, e, p.x, p.y, 'hunt'));
    }
    case 'boss': {
      if (!e.phase2 && e.hp <= e.maxHp / 2) {
        e.phase2 = 1; log(s, 'The Hollow King howls — his embers flare and he quickens!', 'warn'); noise(s, e.x, e.y, 14, 'roar', e.id); ev(s, { type: 'sfx', name: 'roar' });
        summon(s, e, 'skeleton', 3); e.cd.summon = 8; return;
      }
      const mine = s.enemies.filter((m) => m.hp > 0 && m.summoner === e.id).length;
      if (!e.cd.summon && mine < 4) { if (summon(s, e, 'skeleton', 2)) { e.cd.summon = e.phase2 ? 8 : 12; return; } }
      if (d <= 1 && !e.cd.slam) {
        const tiles = []; for (const [dx, dy] of DIRS8) tiles.push([e.x + dx, e.y + dy]);
        e.windup = { kind: 'slam', x: e.x, y: e.y, tiles }; e.cd.slam = 5; e.intent = { t: 'windup', x: e.x, y: e.y };
        log(s, 'The Hollow King raises both fists — GRAVE SLAM incoming! (Get clear of him!)', 'warn'); ev(s, { type: 'sfx', name: 'windup' }); return;
      }
      if (canMelee(s, e, p)) return enemyMelee(s, e, p);
      if (e.phase2 && !e.cd.lance && d <= D.range && clearShot(s, e, p)) { e.cd.lance = 4; return enemyShoot(s, e, p, 'lance'); }
      return mv(() => approach(s, e, p.x, p.y, 'hunt'));
    }
    default: if (canMelee(s, e, p)) return enemyMelee(s, e, p); return mv(() => approach(s, e, p.x, p.y, 'hunt'));
  }
}
function flank(s, e) {
  const p = s.player; const W = s.floor.w;
  const allies = s.enemies.filter((a) => a !== e && a.hp > 0 && cheb(a.x, a.y, p.x, p.y) === 1);
  const fromE = mapTo(s, e.x, e.y, e, true); // paths may not pass through the player
  let best = null, bs = INF;
  for (const [dx, dy] of DIRS8) {
    const tx = p.x + dx, ty = p.y + dy; const t = gget(s.floor, tx, ty);
    if (!tWalk(t) || TILES[t].hazard || !diagOk(s.floor, tx, ty, p.x, p.y)) continue;
    const occ = actorAt(s, tx, ty); if (occ && occ !== e) continue;
    const pd = fromE[ty * W + tx]; if (pd >= INF) continue;
    let score = pd; for (const a of allies) score -= 1.5 * cheb(tx, ty, a.x, a.y);
    if (score < bs) { bs = score; best = [tx, ty]; }
  }
  if (!best) return approach(s, e, p.x, p.y, 'hunt');
  const ok = approach(s, e, best[0], best[1], 'flank', true);
  if (!ok) return approach(s, e, p.x, p.y, 'hunt');
  return ok;
}
function resolveWindup(s, e) {
  const w = e.windup; e.windup = null; const D = ENEMIES[e.k];
  if (w.kind === 'smash') {
    e.intent = { t: 'smash', x: w.x, y: w.y };
    if (cheb(e.x, e.y, w.x, w.y) > 1) { log(s, `${theName(e.k, 1)} loses its footing.`, 'combat'); return; }
    const victim = actorAt(s, w.x, w.y); ev(s, { type: 'impact', x: w.x, y: w.y, big: 1 }); ev(s, { type: 'sfx', name: 'smash' });
    noise(s, w.x, w.y, 8, 'smash', e.id);
    if (!victim) { if (isVis(s, w.x, w.y)) log(s, `${theName(e.k, 1)}'s club smashes the empty floor.`, 'good'); return; }
    const es = estats(e); attack(s, e, victim, { auto: 1, dmg: es.dmg, crit: 5, verbE: 'crushes' });
    if (victim.hp > 0) knockback(s, victim, sign(victim.x - e.x), sign(victim.y - e.y), 1, e);
  } else if (w.kind === 'slam') {
    e.intent = { t: 'slam', x: e.x, y: e.y };
    log(s, 'GRAVE SLAM! The floor heaves around the Hollow King.', 'warn'); ev(s, { type: 'impact', x: e.x, y: e.y, big: 2 }); ev(s, { type: 'sfx', name: 'smash' });
    for (const [x, y] of w.tiles) { const v = actorAt(s, x, y); if (!v || v === e) continue; attack(s, e, v, { auto: 1, dmg: [7 + e.dmgB, 12 + e.dmgB], crit: 0, verbE: 'pulverises' }); if (v.hp > 0) knockback(s, v, sign(v.x - e.x), sign(v.y - e.y), 1, e); if (s.over) return; }
  }
}

// ------------------------------------------------------------ items & abilities
function actUse(s, id, tx, ty) {
  const p = s.player; const it = p.inv.find((i) => i.id === id); if (!it) return fail(s, 'You do not have that item.');
  const D = ITEMS[it.k]; const ps = pstats(p);
  if (D.slot) return actEquip(s, id);
  if (!D.use) return fail(s, `${D.name} cannot be used directly.`);
  switch (D.use) {
    case 'heal': { const amt = 10 + Math.round(ps.maxHp * 0.3); const before = p.hp; p.hp = Math.min(ps.maxHp, p.hp + amt); delSt(p, 'bleed'); log(s, `You drink the Healing Draught (+${p.hp - before} HP).`, 'good'); ev(s, { type: 'heal', x: p.x, y: p.y }); break; }
    case 'cure': delSt(p, 'poison'); delSt(p, 'bleed'); addSt(s, p, 'regen', 6); log(s, 'The antidote burns clean through you. You feel restored.', 'good'); break;
    case 'haste': addSt(s, p, 'haste', 8); log(s, 'Quicksilver races through your veins — you are Hasted!', 'good'); break;
    case 'ward': addSt(s, p, 'shield', 12); log(s, 'A shimmering ward surrounds you (+3 armor).', 'good'); break;
    case 'maxhp': p.baseHp += 5; p.hp = Math.min(pstats(p).maxHp, p.hp + 5); log(s, 'The Heartstone melts into your chest. (+5 max HP)', 'good'); break;
    case 'map': { const fl = s.floor; for (let i = 0; i < fl.t.length; i++) { const x = i % fl.w, y = (i / fl.w) | 0; if (tWalk(fl.t[i]) || TILES[fl.t[i]].door || RING.some(([dx, dy]) => tWalk(gget(fl, x + dx, y + dy)))) fl.explored[i] = 1; } log(s, 'The floor plan unfurls in your mind.', 'good'); break; }
    case 'teleport': {
      const fl = s.floor; const d = dmap(fl, [[p.x, p.y]], safeCost(fl, false)); const cands = [];
      for (let i = 0; i < fl.t.length; i++) { const x = i % fl.w, y = (i / fl.w) | 0; if (d[i] >= 10 && d[i] < INF && floorish(fl.t[i]) && !actorAt(s, x, y) && !trapAt(s, x, y) && !s.fx.fire[i] && !s.fx.gas[i]) cands.push([x, y]); }
      if (!cands.length) return fail(s, 'The scroll fizzles: nowhere safe to go.');
      const [x, y] = rpick(s.rng, cands); ev(s, { type: 'blink', x0: p.x, y0: p.y, x1: x, y1: y }); p.x = x; p.y = y; s._losDirty = true; log(s, 'Space folds around you — you are elsewhere.', 'good'); break;
    }
    case 'key': return fail(s, 'Bump into a locked door to use the key.');
    case 'throw': {
      if (tx == null || ty == null) return fail(s, 'Choose a target to throw at.');
      tx |= 0; ty |= 0; const bad = targetCheck(s, tx, ty, D.range); if (bad) return fail(s, bad);
      const tr = projectileTrace(s, p.x, p.y, tx, ty, D.range); const [ex, ey] = tr.end;
      ev(s, { type: 'proj', kind: D.effect, x0: p.x, y0: p.y, x1: ex, y1: ey }); ev(s, { type: 'sfx', name: 'throw' });
      if (D.effect === 'knife') {
        if (tr.hit && tr.hit !== p) attack(s, p, tr.hit, { acc: ps.acc + 1, dmg: D.dmg, crit: ps.crit, sneak: unaware(tr.hit), verb: 'stick a knife in' }); else log(s, 'The knife skitters across the floor.', 'info');
        if (tWalk(gget(s.floor, ex, ey))) dropItem(s, 'knives', 1, ex, ey);
      } else if (D.effect === 'fire') {
        log(s, 'The fire bomb bursts into flame!', 'combat'); ev(s, { type: 'explode', x: ex, y: ey, r: 1 }); ev(s, { type: 'sfx', name: 'boom' });
        for (let y = ey - 1; y <= ey + 1; y++) for (let x = ex - 1; x <= ex + 1; x++) { if (opaqueAt(s, x, y) && !(x === ex && y === ey)) continue; ignite(s, x, y, 4); const v = actorAt(s, x, y); if (v) { damage(s, v, rint(s.rng, 4, 8), p, 'fire'); if (v.hp > 0) addSt(s, v, 'burning', 3); } if (s.over) break; }
        noise(s, ex, ey, 10, 'explosion', 0);
      } else if (D.effect === 'smoke') { spawnCloud(s, 'smoke', ex, ey, D.radius, 8); log(s, 'Thick smoke billows out, blocking all sight.', 'info'); ev(s, { type: 'sfx', name: 'puff' }); }
      break;
    }
    default: return fail(s, 'Nothing happens.');
  }
  consume(s, it); s.stats.itemsUsed++;
  if (D.use !== 'throw') ev(s, { type: 'sfx', name: D.use === 'heal' || D.use === 'cure' || D.use === 'maxhp' ? 'drink' : 'magic' });
  return 100;
}
function actAbility(s, idx, tx, ty) {
  const p = s.player; const key = CLASSES[p.cls].abilities[idx]; if (!key) return fail(s, 'No such ability.');
  const A = ABILITIES[key]; if (p.cd[key] > 0) return fail(s, `${A.name} is recharging (${p.cd[key]} turns).`);
  const ps = pstats(p); let ok = 0;
  switch (key) {
    case 'bash': {
      const e = enemyAt(s, tx, ty); if (!e || !canMelee(s, p, e)) return fail(s, 'Shield Bash needs an adjacent enemy (not diagonal through a doorway).');
      const dmg = rint(s.rng, 2, 5); log(s, `You shield-bash ${theName(e.k)} for ${dmg}!`, 'combat'); ev(s, { type: 'attack', id: 0, x: p.x, y: p.y, tx: e.x, ty: e.y }); ev(s, { type: 'sfx', name: 'bash' });
      damage(s, e, dmg, p, 'melee');
      if (e.hp > 0) { const boss = ENEMIES[e.k].boss; if (!boss) knockback(s, e, sign(e.x - p.x), sign(e.y - p.y), 2, p); else log(s, 'The Hollow King does not budge.', 'combat'); if (e.hp > 0 && addSt(s, e, 'stun', 1)) log(s, `${theName(e.k, 1)} is stunned.`, 'combat'); }
      noise(s, p.x, p.y, 8, 'combat', 0); ok = 1; break;
    }
    case 'rally': { const amt = Math.round(ps.maxHp * 0.35); p.hp = Math.min(ps.maxHp, p.hp + amt); addSt(s, p, 'shield', 5); log(s, `Second Wind! (+${amt} HP, Warded)`, 'good'); ev(s, { type: 'heal', x: p.x, y: p.y }); ev(s, { type: 'sfx', name: 'magic' }); ok = 1; break; }
    case 'pin': {
      if (!p.eq.ranged) return fail(s, 'Pinning Shot needs a bow equipped.');
      const ammo = p.inv.find((i) => i.k === 'arrows'); if (!ammo) return fail(s, 'You are out of arrows.');
      const bad = targetCheck(s, tx, ty, ps.range); if (bad) return fail(s, bad);
      const tr = projectileTrace(s, p.x, p.y, tx, ty, ps.range); if (tr.blocked) return fail(s, 'No clear line of fire to that tile.'); consume(s, ammo);
      ev(s, { type: 'proj', kind: 'arrow', x0: p.x, y0: p.y, x1: tr.end[0], y1: tr.end[1] }); ev(s, { type: 'sfx', name: 'bow' });
      if (tr.hit && tr.hit !== p) attack(s, p, tr.hit, { acc: ps.rAcc + 2, dmg: [ps.rDmg[0] + 2, ps.rDmg[1] + 2], crit: ps.rCrit, sneak: unaware(tr.hit), onHit: 'root', verb: 'pin' }); else log(s, 'Your pinning shot finds nothing.', 'info');
      noise(s, p.x, p.y, 2, 'twang', 0); ok = 1; break;
    }
    case 'tumble': {
      const dx = sign(tx), dy = sign(ty); if (!dx && !dy) return fail(s, 'Choose a direction to tumble.');
      let moved = 0;
      for (let k = 0; k < 3; k++) {
        const nx = p.x + dx, ny = p.y + dy; const t = gget(s.floor, nx, ny);
        if (!tWalk(t) || TILES[t].hazard || actorAt(s, nx, ny) || !diagOk(s.floor, p.x, p.y, nx, ny)) break;
        delSt(p, 'root'); moveActor(s, p, nx, ny); moved++; arriveEffects(s, p); if (p.hp <= 0 || hasSt(p, 'root')) break;
      }
      if (!moved) return fail(s, 'No room to tumble that way.');
      log(s, `You tumble ${moved} tile${moved > 1 ? 's' : ''}.`, 'info'); noise(s, p.x, p.y, 2, 'footsteps', 0); ok = 1; break;
    }
    case 'firebolt': {
      const range = 7; const bad = targetCheck(s, tx, ty, range); if (bad) return fail(s, bad);
      const tr = projectileTrace(s, p.x, p.y, tx, ty, range); const [ex, ey] = tr.end; if (tr.blocked) return fail(s, 'No clear line of fire to that tile.');
      ev(s, { type: 'proj', kind: 'fire', x0: p.x, y0: p.y, x1: ex, y1: ey }); ev(s, { type: 'sfx', name: 'fire' });
      if (tr.hit && tr.hit !== p) { const dmg = rint(s.rng, 4, 8) + ps.spell; log(s, `Your firebolt engulfs ${theName(tr.hit.k)} for ${dmg}!`, 'combat'); damage(s, tr.hit, dmg, p, 'fire'); if (tr.hit.hp > 0) addSt(s, tr.hit, 'burning', 3); }
      else log(s, 'Your firebolt splashes against nothing.', 'info');
      if (gget(s.floor, ex, ey) === T.GRASS) ignite(s, ex, ey, 5);
      noise(s, ex, ey, 5, 'combat', 0); ok = 1; break;
    }
    case 'blink': {
      if (!isVis(s, tx, ty) || cheb(p.x, p.y, tx, ty) > 5) return fail(s, 'Blink needs a visible tile within 5.');
      const t = gget(s.floor, tx, ty); const tr = trapAt(s, tx, ty);
      if (!tWalk(t) || TILES[t].hazard || actorAt(s, tx, ty) || (tr && !tr.hidden)) return fail(s, 'You cannot blink there.');
      ev(s, { type: 'blink', x0: p.x, y0: p.y, x1: tx, y1: ty }); ev(s, { type: 'sfx', name: 'magic' });
      p.x = tx; p.y = ty; s._losDirty = true; log(s, 'You blink across the gap.', 'info'); arriveEffects(s, p); ok = 1; break;
    }
  }
  if (!ok) return 0;
  p.cd[key] = A.cd; return 100;
}
function actInteract(s, x, y) {
  const p = s.player; const fl = s.floor; if (cheb(x, y, p.x, p.y) > 1) return fail(s, 'You can only interact with adjacent tiles.');
  const t = gget(fl, x, y);
  if (x === p.x && y === p.y) { if (t === T.DOWN) return actDescend(s); if (s.items.some((i) => i.x === x && i.y === y)) return actPickup(s); return fail(s, 'Nothing to interact with here.'); }
  if (t === T.DOOR) { if (!diagOk(fl, p.x, p.y, x, y)) return fail(s, 'Doors must be approached straight on.'); openDoor(s, x, y, p); return 100; }
  if (t === T.OPEN) return actClose(s, x, y);
  if (t === T.LOCKED) return actMove(s, x - p.x, y - p.y);
  if (t === T.CHEST) {
    fl.t[y * fl.w + x] = T.CHEST_OPEN; tileChanged(s); const r = s.rng; const got = [];
    const n = rint(r, 1, 2); for (let i = 0; i < n; i++) got.push(newItem(s, rweighted(r, CONSUMABLE_TABLE)));
    if (rchance(r, 0.3)) got.push(newItem(s, rpick(r, GEAR_BY_TIER[Math.min(3, 1 + Math.floor(s.floorN / 2))])));
    const gold = rint(r, 5, 15) * s.floorN; p.gold += gold;
    for (const it of got) { if (!addToInv(s, it)) dropItem(s, it.k, it.qty, p.x, p.y, it.id); }
    log(s, `You open the chest: ${got.map((i) => ITEMS[i.k].name).join(', ')} and ${gold} gold.`, 'loot'); ev(s, { type: 'sfx', name: 'chest' }); ev(s, { type: 'sparkle', x, y });
    noise(s, x, y, 3, 'door', 0); return 100;
  }
  if (t === T.SHRINE) {
    fl.t[y * fl.w + x] = T.SHRINE_USED; tileChanged(s); const b = rweighted(s.rng, [['vigor', 1], ['clarity', 1], ['fury', 1], ['cleanse', 1]]);
    if (b === 'vigor') { p.baseHp += 4; p.hp = pstats(p).maxHp; log(s, 'Blessing of Vigor: +4 max HP and fully healed.', 'good'); }
    else if (b === 'clarity') { for (let i = 0; i < fl.t.length; i++) fl.explored[i] = 1; for (const tr of s.traps) tr.hidden = 0; log(s, 'Blessing of Clarity: the floor and its traps are revealed.', 'good'); }
    else if (b === 'fury') { addSt(s, p, 'haste', 10); addSt(s, p, 'regen', 10); log(s, 'Blessing of Fury: Hasted and Regenerating.', 'good'); }
    else { p.st = p.st.filter((q) => !STATUS[q.k].bad); p.hp = Math.min(pstats(p).maxHp, p.hp + Math.ceil(pstats(p).maxHp / 2)); log(s, 'Blessing of Cleansing: ailments lifted, wounds mended.', 'good'); }
    ev(s, { type: 'sparkle', x, y }); ev(s, { type: 'sfx', name: 'shrine' }); return 100;
  }
  if (t === T.BRAZIER) {
    const dx = x - p.x, dy = y - p.y; const cx = x + dx, cy = y + dy;
    fl.t[y * fl.w + x] = T.ASH; tileChanged(s);
    log(s, 'You kick the brazier over — burning coals spill out!', 'combat'); ev(s, { type: 'explode', x: cx, y: cy, r: 1, small: 1 }); ev(s, { type: 'sfx', name: 'fire' });
    ignite(s, x, y, 3); for (const [ax, ay] of [[cx, cy], ...DIRS4.map(([a, b]) => [cx + a, cy + b])]) if (!(ax === p.x && ay === p.y)) { ignite(s, ax, ay, 4); const v = actorAt(s, ax, ay); if (v && v !== p) addSt(s, v, 'burning', 3); }
    noise(s, x, y, 5, 'combat', 0); return 100;
  }
  return fail(s, `Nothing to do with the ${tileName(fl.style, t).toLowerCase()}.`);
}
