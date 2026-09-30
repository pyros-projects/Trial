// ============================================================ PERSISTENCE
function encTiles(t) { let out = ''; for (let i = 0; i < t.length; i++) out += String.fromCharCode(65 + t[i]); return out; }
function decTiles(str) { const a = new Array(str.length); for (let i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) - 65; return a; }
function encBits(b) { const runs = []; let cur = 0, n = 0; for (const v of b) { const bit = v ? 1 : 0; if (bit === cur) n++; else { runs.push(n); cur = bit; n = 1; } } runs.push(n); return runs.join('.'); }
function decBits(str, len) { const out = new Array(len).fill(0); let i = 0, bit = 0; for (const r of String(str).split('.')) { const n = +r; for (let k = 0; k < n && i < len; k++) out[i++] = bit; bit ^= 1; } return out; }
function serialize(s) {
  const o = {}; for (const k of Object.keys(s)) if (k[0] !== '_') o[k] = s[k];
  o.floor = Object.assign({}, s.floor, { t: encTiles(s.floor.t), explored: encBits(s.floor.explored) });
  return JSON.parse(JSON.stringify(o, (k, v) => (k && k[0] === '_' ? undefined : v)));
}
function deserialize(o) {
  const s = JSON.parse(JSON.stringify(o));
  const fl = s.floor; fl.t = decTiles(o.floor.t); fl.explored = decBits(o.floor.explored, fl.w * fl.h);
  s._ev = []; invalidate(s);
  return s;
}
function validateState(s) {
  const need = (c, m) => { if (!c) throw new Error('Invalid state: ' + m); };
  need(s && typeof s === 'object', 'not an object');
  need(s.v === SCHEMA_VERSION, `state version ${s.v}`);
  need(s.rng && Array.isArray(s.rng.s) && s.rng.s.length === 4, 'rng');
  const fl = s.floor; need(fl && fl.w > 0 && fl.h > 0 && Array.isArray(fl.t) && fl.t.length === fl.w * fl.h, 'floor tiles');
  need(fl.t.every((v) => v >= 0 && v < TILES.length), 'tile codes');
  need(STYLES[fl.style], 'floor style');
  const p = s.player; need(p && Number.isFinite(p.hp) && Number.isFinite(p.x) && Number.isFinite(p.y) && Array.isArray(p.inv) && p.eq && Array.isArray(p.st), 'player');
  need(CLASSES[p.cls], 'player class');
  need(inb(fl, p.x, p.y), 'player position');
  need(Array.isArray(s.enemies) && s.enemies.every((e) => ENEMIES[e.k] && inb(fl, e.x, e.y) && Number.isFinite(e.hp)), 'enemies');
  need(Array.isArray(s.items) && s.items.every((i) => ITEMS[i.k]), 'items');
  need(Array.isArray(s.traps) && s.fx && s.fx.fire && s.fx.gas && s.fx.smoke, 'environment');
  need(p.inv.every((i) => ITEMS[i.k]), 'inventory');
  return true;
}
function stateHash(s) { const o = serialize(s); delete o.floorStart; return cyrb53(JSON.stringify(o)); }

// Deterministic re-simulation from run parameters + recorded actions.
function simulate(params, actions, upto = actions.length, onStep) {
  const s = newGame(params);
  for (let i = 0; i < upto; i++) {
    const ok = applyAction(s, actions[i]);
    if (!ok) return { state: s, error: `Action #${i + 1} ${JSON.stringify(actions[i])} was rejected: ${s._msg}`, at: i };
    s._ev.length = 0; if (onStep) onStep(s, i);
  }
  return { state: s };
}
function makeSave(s, actions, savedAt) {
  return { game: GAME_ID, schema: SCHEMA_VERSION, engine: ENGINE_VERSION, savedAt: savedAt || null, params: s.params, turn: s.turn, floor: s.floorN,
    actions: actions.slice(), hash: stateHash(s), state: serialize(s) };
}
// Schema history: v1 (pre-release) had no action log — cannot be restored.
// v2 stored {params:{seed,hero,difficulty,style}, moves:[...], state}; its
// state layout predates v3 so v2 saves are migrated by replaying the moves.
function migrateSave(obj, notes) {
  if (obj.schema === 2) {
    notes.push('Migrated a schema-2 save: renamed fields and rebuilt the state from its move log.');
    const pr = obj.params || {};
    return { game: GAME_ID, schema: 3, savedAt: obj.savedAt || null, params: { seed: pr.seed, cls: pr.hero || pr.cls, difficulty: pr.difficulty, style: pr.style, permadeath: pr.permadeath, startFloor: pr.startFloor }, actions: obj.moves || [], state: null, hash: null };
  }
  return obj;
}
function loadSave(obj) {
  const notes = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('This is not a save file (expected a JSON object).');
  if (obj.game !== GAME_ID) throw new Error('This JSON is not an Emberdeep save (missing "game": "emberdeep").');
  if (typeof obj.schema !== 'number') throw new Error('Save has no schema version.');
  if (obj.schema > SCHEMA_VERSION) throw new Error(`Save is from a newer version (schema ${obj.schema}); this build understands up to ${SCHEMA_VERSION}.`);
  if (obj.schema < 2) throw new Error(`Save schema ${obj.schema} is too old to convert (it has no action log).`);
  obj = migrateSave(obj, notes);
  if (!obj.params || !Array.isArray(obj.actions) || !obj.actions.every((a) => Array.isArray(a) && typeof a[0] === 'string')) throw new Error('Save is missing its run parameters or action log.');
  const params = normalizeParams(obj.params);
  if (obj.engine && obj.engine !== ENGINE_VERSION) notes.push(`Recorded with engine ${obj.engine} (this is ${ENGINE_VERSION}): the state loads exactly, but a replay may diverge.`);
  let state = null;
  if (obj.state) {
    try { state = deserialize(obj.state); validateState(state); if (obj.hash && stateHash(state) !== obj.hash) { notes.push('Stored state failed its integrity hash.'); state = null; } }
    catch (err) { notes.push(`Stored state unusable (${err.message}).`); state = null; }
  }
  if (!state) {
    const r = simulate(params, obj.actions);
    if (r.error) throw new Error('Could not rebuild the run from its action log: ' + r.error);
    state = r.state; notes.push(`Rebuilt the exact state by replaying ${obj.actions.length} actions.`);
  }
  return { state, actions: obj.actions.slice(), notes };
}
// ===CORE-END===
