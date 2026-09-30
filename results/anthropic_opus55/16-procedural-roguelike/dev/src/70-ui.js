// ============================================================ UI CONTROLLER
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const KEY_SAVE = 'emberdeep.save', KEY_SET = 'emberdeep.settings.v1', KEY_REC = 'emberdeep.records.v1', KEY_KEYS = 'emberdeep.keys.v1';
const DEFAULT_SEED = 'kindle'; // curated: opens in an overgrown room with water, grass, a chest and potions
const ACTIONS = [
  ['moveN', 'Move north', ['ArrowUp', 'k', 'Numpad8']], ['moveS', 'Move south', ['ArrowDown', 'j', 'Numpad2']], ['moveW', 'Move west', ['ArrowLeft', 'h', 'Numpad4']], ['moveE', 'Move east', ['ArrowRight', 'l', 'Numpad6']],
  ['moveNW', 'Move north-west', ['y', 'Numpad7', 'Home']], ['moveNE', 'Move north-east', ['u', 'Numpad9', 'PageUp']], ['moveSW', 'Move south-west', ['b', 'Numpad1', 'End']], ['moveSE', 'Move south-east', ['n', 'Numpad3', 'PageDown']],
  ['wait', 'Wait one turn', ['.', 'Numpad5']], ['search', 'Search for traps (1 turn)', ['s']], ['rest', 'Rest until healed / disturbed', ['r']],
  ['pickup', 'Pick up items here', ['g', ',']], ['interact', 'Interact / open (door, chest, shrine, brazier)', ['e']], ['close', 'Close an adjacent door', ['c']], ['descend', 'Descend stairs (or travel to known stairs)', ['>']],
  ['fire', 'Fire bow / reach attack (targeting)', ['f']], ['ability1', 'Class ability 1', ['z']], ['ability2', 'Class ability 2', ['x']],
  ['inventory', 'Inventory (then a–p to pick an item)', ['i']], ['inspect', 'Inspect / look mode', ['v', ';']],
  ['quick1', 'Quick-use consumable 1', ['1']], ['quick2', 'Quick-use consumable 2', ['2']], ['quick3', 'Quick-use consumable 3', ['3']], ['quick4', 'Quick-use consumable 4', ['4']], ['quick5', 'Quick-use consumable 5', ['5']], ['quick6', 'Quick-use consumable 6', ['6']],
  ['menu', 'Pause menu', ['Escape', 'p']], ['help', 'Help & key bindings', ['?', 'F1']], ['diag', 'Diagnostics panel', ['F3', '`']], ['minimap', 'Toggle minimap', ['m']],
  ['zoomIn', 'Zoom in', ['+', '=', 'NumpadAdd']], ['zoomOut', 'Zoom out', ['-', 'NumpadSubtract']],
];
const DIRKEY = { moveN: [0, -1], moveS: [0, 1], moveW: [-1, 0], moveE: [1, 0], moveNW: [-1, -1], moveNE: [1, -1], moveSW: [-1, 1], moveSE: [1, 1] };
const DEFAULT_SETTINGS = { anim: 1, text: 1, contrast: 'normal', vol: 60, mute: false, rm: null, touch: 'auto', zoom: 0, intent: true, autosave: true, mini: true };

const UI = {
  run: null,            // {state, actions, params, savedAt, savedTurn, sinceSave, ended}
  mode: 'play',         // play | target | inspect | dir | inv | replay
  modeData: null,
  travel: null,
  hover: null, preview: null,
  diag: { any: false, walk: false, regions: false, fov: false, dist: false, ai: false, occ: false, reveal: false },
  settings: null, keys: null, keyMap: null,
  replay: null,
  errors: [],
  lastLogSeq: 0,
  fps: 0,
};
const S = () => (UI.replay ? UI.replay.state : UI.run && UI.run.state);

// ---------------------------------------------------------------- settings & keys
function loadSettings() {
  const s = Object.assign({}, DEFAULT_SETTINGS, LS.get(KEY_SET, {}));
  if (s.rm === null) s.rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  UI.settings = s; applySettings();
}
function saveSettings() { LS.set(KEY_SET, UI.settings); }
function autoZoom() { return window.innerWidth < 700 ? 24 : window.innerHeight < 700 ? 28 : 32; }
function applySettings() {
  const s = UI.settings; document.documentElement.style.setProperty('--ui-scale', s.text);
  document.body.classList.toggle('hc', s.contrast === 'high'); document.body.classList.toggle('rm', !!s.rm);
  Renderer.opts.rm = !!s.rm; Renderer.opts.anim = +s.anim; Renderer.opts.intent = !!s.intent; Renderer.opts.hc = s.contrast === 'high';
  Sfx.setVol(s.vol / 100); Sfx.setEnabled(!s.mute);
  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  document.body.classList.toggle('touch-on', s.touch === 'on' || (s.touch === 'auto' && (coarse || window.innerWidth <= 700)));
  Renderer.setTile(s.zoom || autoZoom());
  $('btnSound').setAttribute('aria-pressed', String(!s.mute)); $('sndWave').style.display = s.mute ? 'none' : '';
  $('miniWrap').classList.toggle('collapsed', !s.mini);
  requestResize();
}
function loadKeys() {
  const saved = LS.get(KEY_KEYS, null); UI.keys = {};
  for (const [id, , def] of ACTIONS) UI.keys[id] = saved && Array.isArray(saved[id]) ? saved[id].slice(0, 4) : def.slice();
  rebuildKeyMap();
}
function rebuildKeyMap() { UI.keyMap = new Map(); for (const [id] of ACTIONS) for (const k of UI.keys[id]) if (!UI.keyMap.has(k)) UI.keyMap.set(k, id); }
function keyOf(e) {
  if (e.code && e.code.startsWith('Numpad') && e.code !== 'NumpadEnter') { if (e.code === 'NumpadDecimal') return 'Numpad.'; return e.code; }
  if (e.key === ' ') return 'Space';
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key;
}
const keyLabel = (k) => ({ ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', PageUp: 'PgUp', PageDown: 'PgDn' }[k] || k.replace('Numpad', 'Num '));
const firstKey = (id) => (UI.keys[id] && UI.keys[id][0] ? keyLabel(UI.keys[id][0]) : '—');

// ---------------------------------------------------------------- run management
function startRun(params, note) {
  stopTravel(); exitReplay(true);
  const state = newGame(params);
  UI.run = { state, actions: [], params: state.params, savedTurn: null, sinceSave: 0, ended: false, engine: ENGINE_VERSION };
  UI.mode = 'play'; UI.modeData = null; UI.lastLogSeq = 0; $('log').innerHTML = '';
  Renderer.reset(); state._ev.length = 0;
  UI.lastVerify = null; if ($('dgReplay')) $('dgReplay').innerHTML = '';
  refreshAll(); if (note) toast(note, 'info');
  if (UI.settings.autosave) saveGame(true);
  focusGame();
}
function doAction(a, opts = {}) {
  const r = UI.run; if (!r || UI.replay) return false; const s = r.state;
  if (dialogOpen()) return false;
  if (s.over && !(a[0] === 'r')) { toast('The run is over — start a new run or restart the floor.'); return false; }
  Renderer.finishAll();
  const ok = applyAction(s, a);
  if (!ok) { if (!opts.quiet && s._msg) toast(s._msg); drainEvents(s); return false; }
  r.actions.push(a); r.sinceSave++;
  if (UI.mode === 'play' && !$('tip').hidden) hideTip();
  if (!UI.travel) UI.preview = null;
  drainEvents(s); refreshAll();
  if (UI.settings.autosave && !s.over && (r.sinceSave >= 25 || s._floorEntered)) { saveGame(true); s._floorEntered = false; }
  if (s.over && !r.ended) onRunEnd(s);
  return true;
}
function drainEvents(s) {
  const evs = s._ev.splice(0, s._ev.length);
  Renderer.onEvents(evs, s);
  for (const e of evs) {
    if (e.type === 'sfx') Sfx.play(e.name);
    else if (e.type === 'floor') { s._floorEntered = true; if (e.how !== 'start') { Sfx.play('descend'); } }
    else if (e.type === 'hear' && UI.travel) stopTravel('You hear something.');
    else if (e.type === 'trapSpotted' && UI.travel) stopTravel('Trap spotted.');
  }
}
function onRunEnd(s) {
  const r = UI.run; r.ended = true; stopTravel();
  const rec = { score: s.over.score, result: s.over.result, cls: s.params.cls, seed: s.params.seed, floor: s.floorN, turns: s.turn, kills: s.stats.kills, level: s.player.level,
    difficulty: s.params.difficulty, style: s.params.style, daily: s.params.daily, practice: s.params.startFloor > 1, date: new Date().toISOString().slice(0, 16).replace('T', ' ') };
  const recs = LS.get(KEY_REC, []); recs.push(rec); recs.sort((a, b) => b.score - a.score); LS.set(KEY_REC, recs.slice(0, 25));
  if (s.params.permadeath && s.over.result === 'dead') LS.del(KEY_SAVE); else saveGame(true);
  setTimeout(() => showEnd(s), s.over.result === 'victory' ? 1400 : 900);
}
function saveGame(auto) {
  const r = UI.run; if (!r) return false;
  if (r.state.over && r.state.params.permadeath && r.state.over.result === 'dead') { if (!auto) toast('Permadeath: this run has ended and cannot be saved.'); return false; }
  const ok = LS.set(KEY_SAVE, makeSave(r.state, r.actions, new Date().toISOString()));
  if (ok) { r.savedTurn = r.state.turn; r.sinceSave = 0; if (!auto) { toast(`Saved at turn ${r.state.turn} (${r.actions.length} actions).`, 'good'); } }
  else if (!auto) toast('Could not save: browser storage is unavailable or full.');
  updateHud(true); return ok;
}
function loadGame() {
  let raw = null; try { raw = localStorage.getItem(KEY_SAVE); } catch (e) { toast('Browser storage is unavailable.'); return false; }
  if (!raw) { toast('No saved run in this browser.', 'info'); return false; }
  const backup = (why) => { try { localStorage.setItem(KEY_SAVE + '.corrupt', raw); } catch (e) { /* ignore */ } toast(`${why} The unreadable save was backed up as “${KEY_SAVE}.corrupt”.`); };
  let obj; try { obj = JSON.parse(raw); } catch (e) { backup('Saved data is not valid JSON.'); return false; }
  const ok = adoptSave(obj, 'Loaded saved run', true); if (!ok) backup('The saved run could not be loaded.');
  return ok;
}
function adoptSave(obj, verb) {
  let res; try { res = loadSave(obj); } catch (e) { toast(e.message); return false; }
  stopTravel(); exitReplay(true);
  UI.run = { state: res.state, actions: res.actions, params: res.state.params, savedTurn: res.state.turn, sinceSave: 0, ended: !!res.state.over, engine: obj.engine || null };
  UI.mode = 'play'; UI.lastLogSeq = 0; $('log').innerHTML = ''; Renderer.reset(); res.state._ev = [];
  UI.lastVerify = null; if ($('dgReplay')) $('dgReplay').innerHTML = '';
  refreshAll();
  toast(`${verb}: turn ${res.state.turn}, depth ${res.state.floorN}.${res.notes.length ? ' ' + res.notes.join(' ') : ''}`, 'good');
  if (res.state.over) setTimeout(() => showEnd(res.state), 300);
  focusGame(); return true;
}
function hasSave() { try { return !!localStorage.getItem(KEY_SAVE); } catch (e) { return false; } }

// ---------------------------------------------------------------- toasts & focus
function toast(msg, kind = 'bad') {
  const box = $('toast'); const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; box.appendChild(d);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), kind === 'bad' ? 2600 : 3400);
  $('liveMsg').textContent = msg;
}
function focusGame() { const c = $('view'); if (document.activeElement !== c) c.focus({ preventScroll: true }); }
function dialogOpen() { return !!document.querySelector('dialog[open]'); }
function openDialog(id) { closeItemMenu(); const d = $(id); if (!d.open) d.showModal(); setPaused(true); }
function closeDialog(id) { const d = $(id); if (d.open) d.close(); }
// Paused ⇔ a modal dialog is open (derived, never stored, so it can't go stale).
function setPaused(v) { if (v) stopTravel(); updateHud(true); }

// ---------------------------------------------------------------- commands
function cmd(name) {
  const s = S(); if (!s) return;
  if (UI.replay && !['menu', 'help', 'diag', 'minimap', 'zoomIn', 'zoomOut'].includes(name)) return;
  if (DIRKEY[name]) return move(...DIRKEY[name]);
  switch (name) {
    case 'wait': return doAction(['w']);
    case 'search': return doAction(['s']);
    case 'pickup': return doAction(['g']);
    case 'descend': {
      const p = s.player; if (gget(s.floor, p.x, p.y) === T.DOWN) return doAction(['d']);
      const ex = s.floor.exit; if (ex && s.floor.explored[ex.y * s.floor.w + ex.x]) { toast('Travelling to the stairs…', 'info'); return startTravel(ex.x, ex.y); }
      return toast(s.floorN >= LAST_FLOOR ? 'There are no stairs on the final floor — find the Hollow King.' : 'You have not found the stairs down yet.');
    }
    case 'interact': return chooseInteract();
    case 'close': return chooseClose();
    case 'fire': return startFire();
    case 'ability1': return startAbility(0);
    case 'ability2': return startAbility(1);
    case 'inventory': return startInv();
    case 'inspect': return startInspect();
    case 'rest': return startRest();
    case 'menu': return openMenu();
    case 'help': return openHelp();
    case 'diag': return toggleDiag();
    case 'minimap': UI.settings.mini = !UI.settings.mini; saveSettings(); applySettings(); return;
    case 'zoomIn': case 'zoomOut': { const steps = [20, 24, 28, 32, 40, 48]; const cur = UI.settings.zoom || autoZoom(); let i = steps.indexOf(cur); if (i < 0) i = 3; i = clamp(i + (name === 'zoomIn' ? 1 : -1), 0, steps.length - 1); UI.settings.zoom = steps[i]; saveSettings(); applySettings(); return; }
    default: if (name.startsWith('quick')) return quickUse(+name.slice(5) - 1);
  }
}
function move(dx, dy) {
  if (UI.mode === 'dir') { const d = UI.modeData; setMode('play'); d.onDir(dx, dy); return; }
  if (UI.mode === 'target' || UI.mode === 'inspect') { moveCursor(dx, dy); return; }
  if (UI.mode === 'inv') setMode('play');
  doAction(['m', dx, dy]);
}
function consumables(p) { return p.inv.filter((i) => ITEMS[i.k].use && ITEMS[i.k].use !== 'key'); }
function quickUse(n) { const s = S(); const it = consumables(s.player)[n]; if (!it) return toast(`Quick slot ${n + 1} is empty.`); useItem(it); }
function useItem(it) {
  const D = ITEMS[it.k];
  if (D.use === 'throw') return startTarget({ kind: 'throw', item: it, range: D.range, radius: D.radius || 0, label: `Throw ${D.name}` });
  if (D.slot) return doAction(['e', it.id]);
  return doAction(['u', it.id]);
}
function adjacentWhere(pred) { const s = S(); const p = s.player; const out = []; for (const [dx, dy] of DIRS8) { const x = p.x + dx, y = p.y + dy; if (pred(x, y, gget(s.floor, x, y))) out.push([dx, dy]); } return out; }
function chooseDir(label, options, fn) {
  if (!options.length) return false;
  if (options.length === 1) { fn(...options[0]); return true; }
  setMode('dir', { label, onDir: fn, options }); return true;
}
function chooseInteract() {
  const s = S(); const p = s.player; const t = gget(s.floor, p.x, p.y);
  if (t === T.DOWN) return doAction(['d']);
  if (s.items.some((i) => i.x === p.x && i.y === p.y)) return doAction(['g']);
  const opts = adjacentWhere((x, y, u) => u === T.CHEST || u === T.SHRINE || u === T.DOOR || u === T.LOCKED || u === T.BRAZIER || (u === T.OPEN && !actorAt(s, x, y)));
  const pri = opts.filter(([dx, dy]) => { const u = gget(s.floor, p.x + dx, p.y + dy); return u === T.CHEST || u === T.SHRINE; });
  if (!chooseDir('Interact with which direction?', pri.length ? pri : opts, (dx, dy) => doAction(['i', p.x + dx, p.y + dy]))) toast('Nothing to interact with nearby.');
}
function chooseClose() {
  const s = S(); const p = s.player;
  const opts = adjacentWhere((x, y, u) => u === T.OPEN && !actorAt(s, x, y));
  if (!chooseDir('Close which door?', opts, (dx, dy) => doAction(['c', p.x + dx, p.y + dy]))) toast('No open door next to you.');
}
function startFire() {
  const s = S(); const p = s.player; const ps = pstats(p);
  if (p.eq.ranged) { if (!p.inv.some((i) => i.k === 'arrows')) return toast('You are out of arrows.'); return startTarget({ kind: 'fire', range: ps.range, label: `Shoot (${ITEMS[p.eq.ranged.k].name})` }); }
  if (ps.reach >= 2) return startTarget({ kind: 'reach', range: 2, label: 'Spear thrust (reach 2)' });
  toast('No bow equipped. Throw items from your pack, or equip a bow/spear.');
}
function startAbility(i) {
  const s = S(); const p = s.player; const key = CLASSES[p.cls].abilities[i]; const A = ABILITIES[key];
  if (p.cd[key] > 0) return toast(`${A.name} is recharging (${p.cd[key]} turns).`);
  if (A.target === 'self') return doAction(['a', i, 0, 0]);
  if (A.target === 'adjacent') { const opts = adjacentWhere((x, y) => { const e = enemyAt(s, x, y); return e && isVis(s, x, y) && canMelee(s, p, e); }); if (!chooseDir(`${A.name}: which enemy?`, opts, (dx, dy) => doAction(['a', i, p.x + dx, p.y + dy]))) toast(`${A.name} needs an adjacent enemy.`); return; }
  if (A.target === 'dir') { setMode('dir', { label: `${A.name}: choose a direction`, onDir: (dx, dy) => doAction(['a', i, dx, dy]) }); return; }
  if (A.target === 'ranged' && key === 'pin' && !p.eq.ranged) return toast('Pinning Shot needs a bow equipped.');
  startTarget({ kind: 'ability', idx: i, key, range: A.range || ps(p).range || 7, label: A.name, tile: A.target === 'tile' });
}
const ps = (p) => pstats(p);
// ---------------------------------------------------------------- modes
function setMode(m, data) {
  UI.mode = m; UI.modeData = data || null; const bar = $('modeBar');
  if (m === 'play') { bar.hidden = true; UI.cursor = null; hideTip(); }
  else { bar.hidden = false; bar.className = m === 'inspect' ? 'inspect' : ''; }
  if (m === 'dir') bar.innerHTML = `<b>${esc(data.label)}</b> — press a direction key or click an adjacent tile · <kbd>Esc</kbd> cancel`;
  if (m === 'inv') { bar.innerHTML = '<b>Inventory</b> — press a–p to choose an item · <kbd>Esc</kbd> close'; showTab('pBag'); renderInventory(); }
  if (m === 'target' || m === 'inspect') updateCursorInfo();
  updateHud(true); updatePrompt();
}
function startTarget(d) {
  const s = S(); const p = s.player;
  const foes = visibleFoes(s).filter((e) => cheb(e.x, e.y, p.x, p.y) <= d.range);
  const first = d.tile ? { x: p.x, y: p.y } : foes[0] || { x: p.x, y: p.y };
  UI.cursor = { x: first.x, y: first.y, col: '#ffd27a' };
  setMode('target', d);
}
function startInspect() { const s = S(); const p = s.player; const f = visibleFoes(s)[0]; UI.cursor = { x: f ? f.x : p.x, y: f ? f.y : p.y, col: '#8fc8ff' }; setMode('inspect', {}); }
function startInv() { const s = S(); if (!s.player.inv.length) return toast('Your pack is empty.', 'info'); setMode('inv', {}); }
function visibleFoes(s) { const p = s.player; return s.enemies.filter((e) => e.hp > 0 && isVis(s, e.x, e.y)).sort((a, b) => cheb(a.x, a.y, p.x, p.y) - cheb(b.x, b.y, p.x, p.y) || a.id - b.id); }
function moveCursor(dx, dy) { const s = S(); UI.cursor.x = clamp(UI.cursor.x + dx, 0, s.floor.w - 1); UI.cursor.y = clamp(UI.cursor.y + dy, 0, s.floor.h - 1); updateCursorInfo(); }
function cycleTarget(dir) { const s = S(); const f = visibleFoes(s); if (!f.length) return; let i = f.findIndex((e) => e.x === UI.cursor.x && e.y === UI.cursor.y); i = (i + dir + f.length) % f.length; UI.cursor.x = f[i].x; UI.cursor.y = f[i].y; updateCursorInfo(); }
function computeTarget() {
  const s = S(); const p = s.player; const d = UI.modeData; const { x, y } = UI.cursor; const P = pstats(p);
  const tg = { x, y, valid: true, path: [], hit: null, area: null, reason: '', odds: '' };
  if (d.kind === 'reach') {
    const dx = x - p.x, dy = y - p.y; const foe = enemyAt(s, x, y);
    const straight = cheb(p.x, p.y, x, y) === 2 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy));
    tg.path = [[p.x + sign(dx), p.y + sign(dy)], [x, y]];
    if (!straight || !foe || !isVis(s, x, y)) { tg.valid = false; tg.reason = 'Needs a visible foe exactly 2 tiles away in a straight line.'; }
    else { tg.hit = foe; tg.odds = `${unaware(foe) ? 100 : hitChance(P.acc, estats(foe).eva)}% to hit · ${P.dmg[0]}–${P.dmg[1]} dmg`; }
    return tg;
  }
  if (d.tile) { // blink
    const t = gget(s.floor, x, y); const bad = !isVis(s, x, y) ? 'Not visible.' : cheb(p.x, p.y, x, y) > d.range ? `Out of range (max ${d.range}).` : (!tWalk(t) || TILES[t].hazard) ? 'Not a safe floor tile.' : actorAt(s, x, y) ? 'Occupied.' : '';
    tg.valid = !bad; tg.reason = bad; tg.path = [[x, y]]; return tg;
  }
  const bad = (x === p.x && y === p.y) ? 'Pick a target.' : !isVis(s, x, y) ? 'You cannot see that tile.' : cheb(p.x, p.y, x, y) > d.range ? `Out of range (max ${d.range}).` : '';
  const tr = projectileTrace(s, p.x, p.y, x, y, d.range); tg.path = tr.path; tg.hit = tr.hit && tr.hit !== p ? tr.hit : null;
  if (bad) { tg.valid = false; tg.reason = bad; return tg; }
  if (d.radius) { const [ex, ey] = tr.end; tg.area = []; for (let yy = ey - d.radius; yy <= ey + d.radius; yy++) for (let xx = ex - d.radius; xx <= ex + d.radius; xx++) if ((xx - ex) ** 2 + (yy - ey) ** 2 <= d.radius * d.radius + d.radius) tg.area.push([xx, yy]); }
  if (tg.hit) {
    const e = tg.hit; const es = estats(e); const sneak = unaware(e);
    if (d.kind === 'fire') tg.odds = `${sneak ? 100 : hitChance(P.rAcc, es.eva)}% to hit · ${P.rDmg[0]}–${P.rDmg[1]} dmg${sneak ? ' · sneak crit' : ''}`;
    else if (d.kind === 'ability' && d.key === 'pin') tg.odds = `${sneak ? 100 : hitChance(P.rAcc + 2, es.eva)}% to hit · ${P.rDmg[0] + 2}–${P.rDmg[1] + 2} dmg · roots 3`;
    else if (d.kind === 'ability' && d.key === 'firebolt') tg.odds = `auto-hit · ${4 + P.spell}–${8 + P.spell} fire dmg · burning 3`;
    else if (d.kind === 'throw' && d.item.k === 'knives') tg.odds = `${sneak ? 100 : hitChance(P.acc + 1, es.eva)}% to hit · 3–6 dmg`;
    if (tr.hit && (tr.hit.x !== x || tr.hit.y !== y)) tg.odds += ' · (hits the first creature in line)';
  } else if (d.kind !== 'throw') { if (tr.blocked) { tg.valid = false; tg.reason = 'No clear line of fire — the shot would stop short.'; } else tg.odds = 'No creature in the line of fire.'; }
  else if (tr.blocked) tg.odds = 'The line is blocked: it will land short, where it stops.';
  return tg;
}
function updateCursorInfo() {
  const s = S(); if (!UI.cursor || !s) return; const bar = $('modeBar'); const { x, y } = UI.cursor;
  if (UI.mode === 'target') {
    const tg = computeTarget(); UI.target = tg; UI.cursor.col = tg.valid ? '#ffd27a' : '#ff5a4a';
    bar.innerHTML = `<b>${esc(UI.modeData.label)}</b> → ${esc(describeShort(s, x, y))}${tg.valid ? (tg.odds ? ' · ' + esc(tg.odds) : '') : ' · <span style="color:#ff9a8a">' + esc(tg.reason) + '</span>'}<br><kbd>Enter</kbd>/<kbd>${esc(firstKey('fire'))}</kbd>/click to confirm · arrows move · <kbd>Tab</kbd> next target · <kbd>Esc</kbd> cancel`;
  } else if (UI.mode === 'inspect') {
    UI.target = null; bar.innerHTML = `<b>Inspect</b> (${x},${y}) — arrows move · <kbd>Tab</kbd> next enemy · <kbd>Esc</kbd> exit`;
  }
  showTipAtTile(x, y);
}
function confirmTarget() {
  const d = UI.modeData; const { x, y } = UI.cursor; const tg = computeTarget();
  if (!tg.valid) { toast(tg.reason || 'Invalid target.'); return; }
  let a; if (d.kind === 'fire' || d.kind === 'reach') a = ['f', x, y]; else if (d.kind === 'throw') a = ['u', d.item.id, x, y]; else a = ['a', d.idx, x, y];
  setMode('play'); UI.target = null;
  if (!doAction(a)) { /* keep play mode; toast already shown */ }
}
// ---------------------------------------------------------------- travel & rest
function travelCost(s, tx, ty) {
  const fl = s.floor, W = fl.w;
  return (x, y) => {
    const i = y * W + x; if (!fl.explored[i]) return -1; const t = fl.t[i];
    if (t === T.LOCKED) return s.player.inv.some((q) => q.k === 'key') ? 3 : -1;
    if (t === T.DOOR) return 2; if (!tWalk(t) || TILES[t].hazard) return -1;
    if (s.fx.fire[i] || s.fx.gas[i]) return -1;
    const tr = trapAt(s, x, y); if (tr && !tr.hidden && tr.armed) return -1;
    const e = enemyAt(s, x, y); if (e && isVis(s, x, y) && !(x === tx && y === ty)) return -1;
    return 1;
  };
}
function pathTo(s, tx, ty) {
  const p = s.player; const fl = s.floor; if (!inb(fl, tx, ty)) return null;
  const d = dmap(fl, [[tx, ty]], travelCost(s, tx, ty)); const W = fl.w;
  if (d[p.y * W + p.x] >= INF) return null;
  const path = []; let x = p.x, y = p.y;
  for (let guard = 0; guard < 400 && !(x === tx && y === ty); guard++) {
    let best = null, bv = d[y * W + x];
    for (const [dx, dy] of DIRS8) { const nx = x + dx, ny = y + dy; if (!inb(fl, nx, ny) || !diagOk(fl, x, y, nx, ny)) continue; const v = d[ny * W + nx]; if (v < bv) { bv = v; best = [nx, ny]; } }
    if (!best) break; path.push(best); [x, y] = best;
  }
  return path.length ? path : null;
}
function startTravel(tx, ty) {
  const s = S(); const path = pathTo(s, tx, ty);
  if (!path) { toast('No known safe path there.'); return false; }
  const foes = new Set(visibleFoes(s).map((e) => e.id));
  UI.travel = { kind: 'path', path, idx: 0, next: 0, foes, hp: s.player.hp, st: s.player.st.length, target: { x: tx, y: ty }, stuck: 0 };
  UI.preview = null; return true;
}
function startRest() {
  const s = S(); const p = s.player; const mx = pstats(p).maxHp;
  if (visibleFoes(s).some((e) => e.state !== 'asleep')) return toast('You cannot rest with enemies in view.');
  if (p.hp >= mx && !p.st.some((q) => STATUS[q.k].bad)) return toast('You are already rested.', 'info');
  UI.travel = { kind: 'rest', n: 0, next: 0, foes: new Set(visibleFoes(s).map((e) => e.id)), hp: p.hp, st: p.st.length };
  toast('Resting… (any key to stop)', 'info');
}
function stopTravel(reason) { if (UI.travel) { UI.travel = null; if (reason) toast(reason, 'info'); } }
function travelTick(now) {
  const tv = UI.travel; if (!tv || dialogOpen() || UI.mode !== 'play') return;
  if (now < tv.next) return; const s = S(); const p = s.player;
  const newFoe = visibleFoes(s).find((e) => !tv.foes.has(e.id));
  if (newFoe) return stopTravel(`You spot ${aName(newFoe.k)}!`);
  if (p.hp < tv.hp) return stopTravel('You are hurt — stopping.');
  if (s.over) return stopTravel();
  const delay = Renderer.opts.rm || UI.settings.anim == 0 ? 30 : 70 * Math.max(0.5, UI.settings.anim);
  tv.next = now + delay;
  if (tv.kind === 'rest') {
    const mx = pstats(p).maxHp; if ((p.hp >= mx && !p.st.some((q) => STATUS[q.k].bad)) || tv.n >= 100) return stopTravel(p.hp >= mx ? 'Rested to full health.' : 'You stop resting.');
    tv.n++; tv.hp = p.hp; if (!doAction(['w'], { quiet: true })) stopTravel(); return;
  }
  if (tv.idx >= tv.path.length) return stopTravel();
  const [nx, ny] = tv.path[tv.idx];
  if (cheb(nx, ny, p.x, p.y) !== 1) { const np = pathTo(s, tv.target.x, tv.target.y); if (!np) return stopTravel('Path lost.'); tv.path = np; tv.idx = 0; return; }
  const t = gget(s.floor, nx, ny); const foe = enemyAt(s, nx, ny);
  if (foe && isVis(s, nx, ny)) return stopTravel('Something blocks the way.');
  if (s.fx.fire[ny * s.floor.w + nx] || TILES[t].hazard) return stopTravel('Danger ahead — stopping.');
  const px = p.x, py = p.y; tv.hp = p.hp;
  if (!doAction(['m', nx - px, ny - py], { quiet: true })) return stopTravel(s._msg || 'Blocked.');
  if (p.x === nx && p.y === ny) { tv.idx++; tv.stuck = 0; } else if (++tv.stuck > 2) return stopTravel('Blocked.');
  if (tv.idx >= tv.path.length) { stopTravel(); }
}
// ---------------------------------------------------------------- keyboard
function onKey(e) {
  if (UI.listenRebind) return;
  if (dialogOpen()) return;
  const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  Sfx.init();
  if ((e.ctrlKey || e.metaKey) && !e.altKey) { if (e.key.toLowerCase() === 's') { e.preventDefault(); saveGame(false); } return; }
  const k = keyOf(e);
  if (!$('itemMenu').hidden) { if (k === 'Escape') { e.preventDefault(); closeItemMenu(); focusGame(); } return; }
  if (UI.travel) { stopTravel('Stopped.'); e.preventDefault(); return; }
  if (tag === 'BUTTON' && (k === 'Enter' || k === 'Space')) return;
  const action = UI.keyMap.get(k);
  if (UI.replay) {
    if (k === 'Escape') { exitReplay(); e.preventDefault(); } else if (k === 'Space') { toggleReplayPlay(); e.preventDefault(); } else if (k === 'ArrowRight') { replayStep(); e.preventDefault(); }
    else if (action === 'diag' || action === 'zoomIn' || action === 'zoomOut' || action === 'minimap') { cmd(action); e.preventDefault(); }
    return;
  }
  if (e.repeat && performance.now() - (UI.lastKeyAct || 0) < 55) { e.preventDefault(); return; }
  UI.lastKeyAct = performance.now();
  if (UI.mode === 'target' || UI.mode === 'inspect') {
    if (k === 'Escape') { setMode('play'); UI.target = null; e.preventDefault(); return; }
    if (k === 'Tab') { cycleTarget(e.shiftKey ? -1 : 1); e.preventDefault(); return; }
    if (k === 'Enter' || k === 'Space' || (UI.mode === 'target' && (action === 'fire' || action === 'ability1' || action === 'ability2'))) { if (UI.mode === 'target') confirmTarget(); else setMode('play'); e.preventDefault(); return; }
    if (DIRKEY[action]) { moveCursor(...DIRKEY[action]); e.preventDefault(); return; }
    if (action === 'inspect' && UI.mode === 'inspect') { setMode('play'); e.preventDefault(); return; }
    return;
  }
  if (UI.mode === 'dir') {
    if (k === 'Escape') { setMode('play'); e.preventDefault(); return; }
    if (DIRKEY[action]) { move(...DIRKEY[action]); e.preventDefault(); }
    return;
  }
  if (UI.mode === 'inv') {
    if (k === 'Escape' || action === 'inventory') { setMode('play'); e.preventDefault(); return; }
    if (/^[a-p]$/.test(k)) { const s = S(); const it = s.player.inv[k.charCodeAt(0) - 97]; if (it) { const btn = document.querySelector(`#inv [data-id="${it.id}"]`); openItemMenu(it, btn); } e.preventDefault(); }
    return;
  }
  if (k === 'Enter') { const s = S(); if (gget(s.floor, s.player.x, s.player.y) === T.DOWN) { cmd('descend'); e.preventDefault(); } return; }
  if (action) { e.preventDefault(); cmd(action); }
}
// ---------------------------------------------------------------- pointer
function initPointer() {
  const cv = $('view'); let down = null; let lpTimer = 0; let lastTap = null;
  let lastPX = -1, lastPY = -1;
  cv.addEventListener('pointermove', (e) => {
    const s = S(); if (!s) return;
    if (e.clientX === lastPX && e.clientY === lastPY) return; // synthetic move after a layout change: ignore
    lastPX = e.clientX; lastPY = e.clientY; const t = Renderer.screenToTile(e.clientX, e.clientY);
    UI.hover = inb(s.floor, t.x, t.y) ? t : null;
    if (e.pointerType === 'mouse') {
      if (UI.mode === 'target' || UI.mode === 'inspect') { if (UI.hover && (UI.cursor.x !== t.x || UI.cursor.y !== t.y)) { UI.cursor.x = t.x; UI.cursor.y = t.y; updateCursorInfo(); } }
      else if (UI.mode === 'play' && UI.hover && !UI.travel) { updatePreview(t.x, t.y); showTipAtTile(t.x, t.y, e.clientX, e.clientY); }
    }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) clearTimeout(lpTimer);
  });
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') return; UI.hover = null; if (UI.mode === 'play') { UI.preview = null; hideTip(); } });
  cv.addEventListener('pointerdown', (e) => {
    Sfx.init(); focusGame(); down = { x: e.clientX, y: e.clientY, t: performance.now(), lp: false };
    if (e.pointerType !== 'mouse') lpTimer = setTimeout(() => { down.lp = true; const t = Renderer.screenToTile(e.clientX, e.clientY); inspectAt(t.x, t.y, e.clientX, e.clientY); }, 480);
  });
  cv.addEventListener('pointerup', (e) => {
    clearTimeout(lpTimer); if (!down || down.lp || e.button !== 0) { down = null; return; }
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14; down = null; if (moved) return;
    const t = Renderer.screenToTile(e.clientX, e.clientY);
    const touch = e.pointerType !== 'mouse';
    if (touch && UI.mode === 'play') {
      const s = S(); const p = s.player; const far = cheb(t.x, t.y, p.x, p.y) > 1;
      if (far && !(lastTap && lastTap.x === t.x && lastTap.y === t.y)) { lastTap = t; updatePreview(t.x, t.y); showTipAtTile(t.x, t.y); if (UI.preview && UI.preview.path.length) toast('Tap again to walk there.', 'info'); return; }
      lastTap = null;
    }
    clickTile(t.x, t.y);
  });
  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); const t = Renderer.screenToTile(e.clientX, e.clientY); inspectAt(t.x, t.y, e.clientX, e.clientY); });
  $('minimap').addEventListener('click', (e) => {
    const s = S(); if (!s || UI.replay) return; const r = $('minimap').getBoundingClientRect(); const sc = r.width / s.floor.w;
    const x = Math.floor((e.clientX - r.left) / sc), y = Math.floor((e.clientY - r.top) / sc);
    if (inb(s.floor, x, y) && s.floor.explored[y * s.floor.w + x]) { if (startTravel(x, y)) toast('Travelling…', 'info'); } else toast('That area is unexplored.');
  });
}
function inspectAt(x, y, cx, cy) { const s = S(); if (!s || !inb(s.floor, x, y)) return; showTipAtTile(x, y, cx, cy, true); }
function updatePreview(x, y) {
  const s = S(); if (!s || UI.replay) { UI.preview = null; return; } const p = s.player;
  if (cheb(x, y, p.x, p.y) <= 1 || !s.floor.explored[y * s.floor.w + x]) { UI.preview = null; return; }
  const path = pathTo(s, x, y); UI.preview = path ? { path, safe: true } : null;
}
function clickTile(x, y) {
  const s = S(); if (!s || !inb(s.floor, x, y) || UI.replay) return; const p = s.player;
  if (UI.mode === 'target') { UI.cursor.x = x; UI.cursor.y = y; updateCursorInfo(); confirmTarget(); return; }
  if (UI.mode === 'dir') { const dx = sign(x - p.x), dy = sign(y - p.y); if (!dx && !dy) return; move(dx, dy); return; }
  if (UI.mode === 'inspect') { UI.cursor.x = x; UI.cursor.y = y; updateCursorInfo(); return; }
  if (UI.mode === 'inv') setMode('play');
  if (UI.travel) { stopTravel(); return; }
  if (x === p.x && y === p.y) { if (s.items.some((i) => i.x === x && i.y === y)) return doAction(['g']); if (gget(s.floor, x, y) === T.DOWN) return doAction(['d']); return doAction(['w']); }
  const d = cheb(x, y, p.x, p.y); const t = gget(s.floor, x, y);
  if (d === 1) { if (t === T.CHEST || t === T.SHRINE) return doAction(['i', x, y]); return doAction(['m', x - p.x, y - p.y]); }
  const foe = enemyAt(s, x, y);
  if (foe && isVis(s, x, y) && p.eq.ranged && d <= pstats(p).range) { startTarget({ kind: 'fire', range: pstats(p).range, label: `Shoot (${ITEMS[p.eq.ranged.k].name})` }); UI.cursor.x = x; UI.cursor.y = y; updateCursorInfo(); return; }
  if (!s.floor.explored[y * s.floor.w + x]) return toast('You have not explored there.');
  startTravel(x, y);
}
// ---------------------------------------------------------------- tooltips
function describeShort(s, x, y) { const e = enemyAt(s, x, y); if (e && isVis(s, x, y)) return ENEMIES[e.k].name; if (!s.floor.explored[y * s.floor.w + x]) return 'unexplored'; return tileName(s.floor.style, gget(s.floor, x, y)); }
function stateLabel(e) {
  return { asleep: 'Asleep — sneak attacks auto-hit and crit', idle: 'Unaware (wandering) — sneak attack possible', investigating: 'Investigating a noise — unaware of you', searching: 'Searching for you (lost sight)', hunting: 'Hunting you', fleeing: 'Fleeing!', guarding: 'Guarding its post' }[e.state] || e.state;
}
function intentText(s, e) {
  const it = e.intent || {}; if (e.windup) return e.windup.kind === 'slam' ? 'Winding up GRAVE SLAM on every adjacent tile!' : `Winding up a smash on (${e.windup.x},${e.windup.y}) — step off it!`;
  const map = { attack: 'Attacking', shoot: 'Shooting', aim: 'Moving for a clear shot', spit: 'Lobbing spores', flank: 'Circling to flank you', regroup: 'Waiting for its pack', hunt: 'Closing in', retreat: 'Backing away', flee: 'Fleeing', cower: 'Cornered', summon: 'Raising the dead', chant: 'Chanting (keeping distance)', guard: 'Holding its post', return: 'Returning to its post', investigate: 'Going to investigate', search: 'Searching', blocked: 'Blocked', stunned: 'Stunned', rooted: 'Rooted', door: 'Opening a door', smash: 'Just smashed', slam: 'Just slammed', idle: 'Idle', asleep: 'Sleeping' };
  return map[it.t] || it.t || '—';
}
function enemyHtml(s, e) {
  const D = ENEMIES[e.k]; const P = pstats(s.player); const es = estats(e); const sneak = unaware(e);
  const pEva = P.eva - (hasSt(s.player, 'stun') || hasSt(s.player, 'root') ? 3 : 0);
  const you = sneak ? 100 : hitChance(P.acc, es.eva); const it = hitChance(es.acc, pEva);
  const sts = e.st.map((q) => `${STATUS[q.k].name} ${q.t}`).join(', ');
  return `<h4>${esc(D.unique ? theName(e.k, 1) : D.name)}</h4><div class="sub">${esc(stateLabel(e))}</div>
  <div class="hpbar"><i style="width:${Math.round(100 * e.hp / e.maxHp)}%"></i></div>
  <div>HP <b>${e.hp}/${e.maxHp}</b> · Armor ${es.armor} · Evasion ${es.eva} · Speed ${espeed(e)}</div>
  <div class="odds">You: ${you}% to hit · ${P.dmg[0]}–${P.dmg[1]} dmg${es.armor ? ` (armor absorbs 0–${Math.max(0, es.armor - P.pierce)})` : ''}${sneak ? ' · SNEAK CRIT' : ''}</div>
  <div class="odds">It: ${it}% to hit you · ${es.dmg[0]}–${es.dmg[1]} dmg${P.armor ? ` (your armor absorbs 0–${P.armor})` : ''}${es.rdmg ? ` · ranged ${es.rdmg[0]}–${es.rdmg[1]} (range ${D.range})` : ''}</div>
  <div class="intent">Intent: ${esc(intentText(s, e))}</div>${sts ? `<div>Status: ${esc(sts)}</div>` : ''}<hr><div class="sub">${esc(D.desc)}</div>`;
}
function itemStatLine(k) {
  const D = ITEMS[k]; const parts = [];
  if (D.dmg && D.slot) parts.push(`${D.dmg[0]}–${D.dmg[1]} dmg`); if (D.acc) parts.push(`${D.acc > 0 ? '+' : ''}${D.acc} acc`); if (D.crit) parts.push(`${D.crit}% crit`); if (D.range && D.slot) parts.push(`range ${D.range}`);
  if (D.armor) parts.push(`+${D.armor} armor`); if (D.eva) parts.push(`${D.eva > 0 ? '+' : ''}${D.eva} eva`); if (D.hp) parts.push(`+${D.hp} max HP`); if (D.spell) parts.push(`+${D.spell} spell`); if (D.stealth) parts.push(`stealth ${D.stealth}`);
  return parts.join(' · ');
}
function tileHtml(s, x, y) {
  const fl = s.floor; if (!inb(fl, x, y)) return ''; const i = y * fl.w + x; const vis = isVis(s, x, y);
  if (!fl.explored[i]) return '<h4>Unexplored</h4><div class="sub">You have not seen this place.</div>';
  const out = []; const e = enemyAt(s, x, y);
  if (s.player.x === x && s.player.y === y) out.push(`<h4>You — ${esc(CLASSES[s.player.cls].name)}</h4><div class="sub">HP ${s.player.hp}/${pstats(s.player).maxHp} · Level ${s.player.level}</div>`);
  if (e && vis) out.push(enemyHtml(s, e));
  const t = fl.t[i]; const T0 = TILES[t];
  out.push(`${out.length ? '<hr>' : ''}<h4>${esc(tileName(fl.style, t))}${vis ? '' : ' <span class="sub">(remembered)</span>'}</h4>${T0.desc ? `<div class="sub">${esc(T0.desc)}</div>` : ''}`);
  const items = s.items.filter((q) => q.x === x && q.y === y && q.seen);
  for (const q of items) out.push(`<div>• <b>${esc(itemLabel(q))}</b>${itemStatLine(q.k) ? ` <span class="odds">${esc(itemStatLine(q.k))}</span>` : ''}${ITEMS[q.k].desc ? `<div class="sub">${esc(ITEMS[q.k].desc)}</div>` : ''}</div>`);
  const tr = trapAt(s, x, y); if (tr && !tr.hidden) out.push(`<div class="intent">${tr.armed ? 'Armed' : 'Sprung'} ${esc(TRAP_NAMES[tr.k])}: ${esc(TRAP_DESC[tr.k])}</div>`);
  if (vis) { if (s.fx.fire[i]) out.push(`<div class="intent">Burning (${s.fx.fire[i]} turns): sets creatures ablaze.</div>`); if (s.fx.gas[i]) out.push(`<div class="intent">Poison gas (${s.fx.gas[i]} turns).</div>`); if (s.fx.smoke[i]) out.push(`<div class="sub">Smoke (${s.fx.smoke[i]} turns): blocks sight.</div>`); }
  const snd = s.sounds.find((q) => q.x === x && q.y === y); if (snd) out.push(`<div style="color:var(--sense)">You heard ${esc(SOUND_TEXT[snd.kind] || snd.kind)} here.</div>`);
  if (vis && lightAt(s, x, y) > 0.3) out.push('<div class="sub">Brightly lit — you are easier to spot here.</div>');
  return out.join('');
}
function showTipAtTile(x, y, cx, cy, pinned) {
  const s = S(); const tip = $('tip'); const html = tileHtml(s, x, y); if (!html) return hideTip();
  tip.innerHTML = html; tip.hidden = false; const stage = $('stage').getBoundingClientRect();
  // anchor beside the tile (never on top of it): right side if it fits, else left, else below/above
  const sc = Renderer.tileToScreen(x, y); const tl = sc.x - stage.left, tt = sc.y - stage.top; const w = tip.offsetWidth, h = tip.offsetHeight;
  const hero = s.player; const preferLeft = x < hero.x || (x === hero.x && tl > stage.width / 2);
  let px = preferLeft ? tl - w - 8 : tl + sc.ts + 8, py = tt - 4;
  if (!preferLeft && px + w > stage.width - 6) px = tl - w - 8;
  if (preferLeft && px < 6) px = tl + sc.ts + 8;
  if (px + w > stage.width - 6) px = -1;
  if (px < 6) { px = clamp(tl + sc.ts / 2 - w / 2, 6, Math.max(6, stage.width - w - 6)); py = tt + sc.ts + 8; if (py + h > stage.height - 6) py = tt - h - 8; }
  py = clamp(py, 6, Math.max(6, stage.height - h - 6)); void cx; void cy;
  tip.style.left = px + 'px'; tip.style.top = py + 'px'; UI.tipPinned = !!pinned;
  if (pinned) { clearTimeout(UI.tipTimer); UI.tipTimer = setTimeout(() => { if (UI.tipPinned) hideTip(); }, 5000); }
}
function hideTip() { $('tip').hidden = true; UI.tipPinned = false; }
// ---------------------------------------------------------------- panels
function refreshAll() { renderHero(); renderInventory(); renderLog(); updateHud(true); updatePrompt(); updateChip(); if (UI.mode === 'target' || UI.mode === 'inspect') updateCursorInfo(); if (UI.diagOpen) renderDiag(); }
function updateChip() {
  const s = S(); if (!s) return; const P = s.params;
  $('runChip').textContent = `${UI.replay ? 'REPLAY · ' : ''}${CLASSES[P.cls].name} · Depth ${s.floorN}/${LAST_FLOOR} ${STYLES[s.floor.style].name} · seed ${P.seed}${P.daily ? ' (daily)' : ''} · ${DIFFICULTY[P.difficulty].name}${P.permadeath ? ' · permadeath' : ''}`;
}
function renderHero() {
  const s = S(); if (!s) return; const p = s.player; const P = pstats(p); const C = CLASSES[p.cls];
  if (UI._portrait !== p.cls) { Renderer.portrait($('heroPortrait'), 'p_' + p.cls); UI._portrait = p.cls; }
  $('heroName').textContent = C.name; $('heroSub').textContent = `Level ${p.level} · ${p.gold} gold · ${s.stats.kills} kills`;
  const hb = $('hpBar'); hb.querySelector('i').style.width = `${Math.round(100 * p.hp / P.maxHp)}%`; hb.querySelector('span').textContent = `HP ${p.hp} / ${P.maxHp}`;
  const need = XP_FOR(p.level); $('xpBar').querySelector('i').style.width = `${Math.round(100 * p.xp / need)}%`; $('xpBar').title = `Experience ${p.xp}/${need} to level ${p.level + 1}`;
  const stat = (lbl, v, tip) => `<div class="stat" title="${esc(tip)}"><b>${v}</b><span>${lbl}</span></div>`;
  $('stats').innerHTML = stat('Dmg', `${P.dmg[0]}–${P.dmg[1]}`, 'Melee damage range') + stat('Acc', P.acc, 'Accuracy: +5% hit chance per point over the target’s evasion') + stat('Eva', P.eva, 'Evasion: −5% enemy hit chance per point') + stat('Arm', P.armor, 'Armor absorbs 0–armor damage per hit');
  $('statusRow').innerHTML = p.st.length ? p.st.map((q) => `<span class="st ${STATUS[q.k].bad ? 'bad' : 'good'}" title="${esc(STATUS[q.k].desc)}">${esc(STATUS[q.k].name)} ${q.t}</span>`).join('') : '<span class="st none">No status effects</span>';
  const ab = C.abilities.map((k, i) => { const A = ABILITIES[k]; const cd = p.cd[k] || 0; const key = firstKey('ability' + (i + 1)); return `<button class="abtn" data-ab="${i}" ${cd ? 'aria-disabled="true"' : ''} title="${esc(A.name + ': ' + A.desc + ' Cooldown ' + A.cd + ' turns.')}"><span class="kbd">${esc(key)}</span><span class="nm">${esc(A.name)}</span>${cd ? `<span class="cdn">${cd}</span><span class="cd" style="width:${Math.round(100 * cd / A.cd)}%"></span>` : ''}</button>`; });
  const fireLbl = p.eq.ranged ? `Shoot (${(p.inv.find((i) => i.k === 'arrows') || { qty: 0 }).qty} arrows)` : P.reach >= 2 ? 'Reach attack' : 'Fire (no bow)';
  ab.push(`<button class="abtn" data-cmd="fire" title="Fire your bow or make a reach attack (targeting mode)"><span class="kbd">${esc(firstKey('fire'))}</span><span class="nm">${esc(fireLbl)}</span></button>`);
  const cons = consumables(p)[0]; ab.push(`<button class="abtn" data-cmd="inventory" title="Open inventory"><span class="kbd">${esc(firstKey('inventory'))}</span><span class="nm">Inventory${cons ? '' : ' (no consumables)'}</span></button>`);
  $('abil').innerHTML = ab.join('');
  $('tA1').textContent = ABILITIES[C.abilities[0]].name + (p.cd[C.abilities[0]] ? ` (${p.cd[C.abilities[0]]})` : ''); $('tA2').textContent = ABILITIES[C.abilities[1]].name + (p.cd[C.abilities[1]] ? ` (${p.cd[C.abilities[1]]})` : '');
}
const ICON_CANVAS = new Map();
function iconHtml(k) { return `<canvas data-icon="${k}" width="48" height="48" aria-hidden="true"></canvas>`; }
function paintIcons(root) { for (const c of root.querySelectorAll('canvas[data-icon]')) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 48, 48); ctx.drawImage(Art.sprite('i_' + c.dataset.icon, 48), 0, 0); } }
function renderInventory() {
  const s = S(); if (!s) return; const p = s.player;
  const slots = [['weapon', 'Weapon'], ['ranged', 'Ranged'], ['armor', 'Armor'], ['trinket', 'Trinket']];
  $('eq').innerHTML = slots.map(([k, lbl]) => { const it = p.eq[k]; return it ? `<button class="slot" data-id="${it.id}" title="${esc(ITEMS[it.k].name + ' — ' + itemStatLine(it.k) + (ITEMS[it.k].desc ? '. ' + ITEMS[it.k].desc : '') + ' (click for options)')}">${iconHtml(it.k)}<span><span class="lbl">${lbl}</span>${esc(ITEMS[it.k].name)}</span></button>` : `<div class="slot empty"><span><span class="lbl">${lbl}</span>empty</span></div>`; }).join('');
  const cons = consumables(p);
  $('inv').innerHTML = p.inv.length ? p.inv.map((it, i) => { const q = cons.indexOf(it); const D = ITEMS[it.k]; return `<button role="listitem" data-id="${it.id}" title="${esc(D.name + (itemStatLine(it.k) ? ' — ' + itemStatLine(it.k) : '') + (D.desc ? '. ' + D.desc : ''))}"><span class="lt">${String.fromCharCode(97 + i)}</span>${iconHtml(it.k)}<span>${esc(D.name)}${q >= 0 && q < 6 ? ` <kbd>${q + 1}</kbd>` : ''}</span>${it.qty > 1 ? `<span class="q">×${it.qty}</span>` : ''}</button>`; }).join('') : '<div class="empty">Your pack is empty.</div>';
  $('invCount').textContent = `${p.inv.length}/16`;
  paintIcons($('eq')); paintIcons($('inv'));
}
function openItemMenu(it, anchor) {
  const s = S(); const p = s.player; const D = ITEMS[it.k]; const m = $('itemMenu'); const equipped = Object.values(p.eq).some((q) => q && q.id === it.id);
  const opts = [];
  if (D.use && D.use !== 'key') opts.push([D.use === 'throw' ? 'Throw…' : 'Use', 'u']);
  if (D.slot) opts.push([equipped ? 'Unequip' : 'Equip', 'e']);
  if (!equipped) opts.push(['Drop', 'd']);
  opts.push(['Cancel', 'Escape']);
  let cmp = ''; if (D.slot && !equipped && p.eq[D.slot]) cmp = `<p>Currently: ${esc(ITEMS[p.eq[D.slot].k].name)} (${esc(itemStatLine(p.eq[D.slot].k))})</p>`;
  m.innerHTML = `<h4>${esc(itemLabel(it))}</h4>${itemStatLine(it.k) ? `<p class="odds">${esc(itemStatLine(it.k))}</p>` : ''}${D.desc ? `<p>${esc(D.desc)}</p>` : ''}${cmp}` + opts.map(([l, k]) => `<button data-k="${k}" role="menuitem"><span>${esc(l)}</span><kbd>${k === 'Escape' ? 'Esc' : k}</kbd></button>`).join('');
  m.hidden = false; const r = anchor ? anchor.getBoundingClientRect() : { left: window.innerWidth / 2 - 100, bottom: window.innerHeight / 2, top: window.innerHeight / 2 };
  const w = m.offsetWidth, h = m.offsetHeight; let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left)), y = r.bottom + 4; if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 4);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  const act = (k) => { closeItemMenu(); if (UI.mode === 'inv') setMode('play'); if (k === 'u') useItem(it); else if (k === 'e') doAction(['e', it.id]); else if (k === 'd') doAction(['x', it.id]); focusGame(); };
  m.onclick = (e) => { const b = e.target.closest('button'); if (b) act(b.dataset.k); };
  m.onkeydown = (e) => { e.stopPropagation(); const k = e.key.toLowerCase(); if (k === 'escape') { e.preventDefault(); closeItemMenu(); focusGame(); } else if (['u', 'e', 'd'].includes(k) && m.querySelector(`[data-k="${k}"]`)) { e.preventDefault(); act(k); } else if (k === 'arrowdown' || k === 'arrowup') { e.preventDefault(); const bs = [...m.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement); bs[(i + (k === 'arrowdown' ? 1 : -1) + bs.length) % bs.length].focus(); } };
  m.querySelector('button').focus();
}
function closeItemMenu() { $('itemMenu').hidden = true; }
function renderLog() {
  const s = S(); if (!s) return; const box = $('log'); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  if (s.log.length && s.log[0].n > UI.lastLogSeq + 1 && UI.lastLogSeq > 0 && s.log[s.log.length - 1].n < UI.lastLogSeq) { box.innerHTML = ''; UI.lastLogSeq = 0; }
  if (s.log.length && s.log[s.log.length - 1].n < UI.lastLogSeq) { box.innerHTML = ''; UI.lastLogSeq = 0; }
  const frag = document.createDocumentFragment(); let last = null;
  for (const m of s.log) { if (m.n <= UI.lastLogSeq) continue; const p = document.createElement('p'); p.className = m.kind; p.innerHTML = `<span class="t">${m.t}</span>${esc(m.text)}`; frag.appendChild(p); UI.lastLogSeq = m.n; last = m; }
  box.appendChild(frag); while (box.children.length > 220) box.removeChild(box.firstChild);
  if (atBottom || last) box.scrollTop = box.scrollHeight;
  if (last && (last.kind === 'warn' || last.kind === 'bad' || last.kind === 'good' || last.kind === 'sense')) $('liveMsg').textContent = last.text;
  $('logTurn').textContent = `turn ${s.turn}`;
}
function objective(s) {
  if (s.over) return s.over.result === 'victory' ? 'Victory! The Hollow King is slain.' : 'Fallen. Restart the floor or begin anew.';
  if (s.floorN >= LAST_FLOOR) return s.enemies.some((e) => e.k === 'boss' && e.hp > 0 && isVis(s, e.x, e.y)) ? 'Slay the Hollow King!' : 'Find and slay the Hollow King';
  const ex = s.floor.exit; if (ex && s.floor.explored[ex.y * s.floor.w + ex.x]) return `Reach the stairs (>) at ${ex.x},${ex.y} and descend`;
  return `Explore depth ${s.floorN} and find the stairs down`;
}
function updateHud(force) {
  const now = performance.now(); if (!force && now - (UI._hudT || 0) < 250) return; UI._hudT = now;
  const s = S(); if (!s) return; const p = s.player; const P = pstats(p); const foes = visibleFoes(s);
  const sts = p.st.length ? p.st.map((q) => `<span class="${STATUS[q.k].bad ? 'bad' : 'good'}">${STATUS[q.k].name} ${q.t}</span>`).join(', ') : '<span class="k">none</span>';
  const modeName = UI.replay ? 'Replay' : { play: UI.travel ? (UI.travel.kind === 'rest' ? 'Resting' : 'Travelling') : 'Move / attack', target: 'Targeting: ' + (UI.modeData && UI.modeData.label), inspect: 'Inspect', dir: 'Choose direction', inv: 'Inventory' }[UI.mode];
  const r = UI.run; let save = '—';
  if (UI.replay) save = `replay ${UI.replay.i}/${UI.replay.actions.length}${UI.replay.done ? (UI.replay.verified ? ' ✓ verified' : ' ✗ MISMATCH') : ''}`;
  else if (r) save = r.savedTurn == null ? 'unsaved' : r.sinceSave ? `saved T${r.savedTurn} (+${r.sinceSave} actions)` : `saved T${r.savedTurn}`;
  const paused = dialogOpen();
  $('hud').innerHTML = `<b>${UI.fps}</b> <span class="k">fps</span> · Depth <b>${s.floorN}/${LAST_FLOOR}</b> ${esc(STYLES[s.floor.style].name)} · seed <b>${esc(s.params.seed)}</b><br>`
    + `Turn <b>${s.turn}</b> · HP <b class="${p.hp < P.maxHp * 0.35 ? 'bad' : ''}">${p.hp}/${P.maxHp}</b> · Lv <b>${p.level}</b> · Foes in view <b class="${foes.length ? 'warn' : ''}">${foes.length}</b><br>`
    + `Status: ${sts}<br>Goal: ${esc(objective(s))}<br>`
    + `Action: <b>${esc(modeName)}</b> · ${esc(save)} · ${paused ? '<b class="warn">PAUSED</b>' : s.over ? '<b class="bad">RUN OVER</b>' : '<span class="good">awaiting input</span>'}`;
}
function updatePrompt() {
  const s = S(); if (!s || UI.replay || UI.mode !== 'play') { $('prompt').innerHTML = ''; return; } const p = s.player; const fl = s.floor; const t = gget(fl, p.x, p.y); let h = '';
  const k = (id) => `<kbd>${esc(firstKey(id))}</kbd>`;
  const threat = s.enemies.find((e) => e.hp > 0 && e.windup && e.windup.tiles.some(([x, y]) => x === p.x && y === p.y));
  if (s.over) h = s.over.result === 'victory' ? 'Victory! Open the menu for your summary.' : 'You have fallen.';
  else if (threat) h = `<span style="color:#ff8a7a">⚠ ${esc(ENEMIES[threat.k].name)} is about to strike your tile — move!</span>`;
  else if (hasSt(p, 'root')) h = 'You are rooted — attack, wait, or use an item.';
  else if (t === T.DOWN) h = `Stairs down — press ${k('descend')} to descend`;
  else if (s.items.some((i) => i.x === p.x && i.y === p.y)) h = `${esc(s.items.filter((i) => i.x === p.x && i.y === p.y).map(itemLabel).join(', '))} — ${k('pickup')} to pick up`;
  else {
    for (const [dx, dy] of DIRS8) { const u = gget(fl, p.x + dx, p.y + dy); if (u === T.CHEST) { h = `Chest nearby — ${k('interact')} to open`; break; } if (u === T.SHRINE) { h = `Shrine nearby — ${k('interact')} to pray`; break; } if (u === T.LOCKED) { h = p.inv.some((i) => i.k === 'key') ? 'Locked door — bump into it to use your Iron Key' : 'Locked door — you need an Iron Key'; break; } }
    if (!h) { const foe = s.enemies.find((e) => e.hp > 0 && isVis(s, e.x, e.y) && canMelee(s, p, e)); if (foe) h = `Bump the ${esc(ENEMIES[foe.k].name)} to attack (${unaware(foe) ? '100% sneak' : hitChance(pstats(p).acc, estats(foe).eva) + '%'} to hit)`; }
    if (!h && adjacentWhere((x, y, u) => u === T.OPEN).length) h = `${k('close')} closes the adjacent door`;
  }
  $('prompt').innerHTML = h;
}
function showTab(id) { for (const b of document.querySelectorAll('#tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === id)); for (const p of document.querySelectorAll('.panel')) p.classList.toggle('on', p.id === id); }
// ---------------------------------------------------------------- diagnostics panel
function toggleDiag() {
  UI.diagOpen = !UI.diagOpen; $('diag').hidden = !UI.diagOpen; $('btnDiag').setAttribute('aria-pressed', String(UI.diagOpen));
  if (UI.diagOpen) buildDiag(); UI.diag.any = UI.diagOpen && ['walk', 'regions', 'fov', 'dist', 'ai', 'occ', 'reveal'].some((k) => UI.diag[k]);
}
function buildDiag() {
  const box = $('diag'); const opts = [['walk', 'Walkability'], ['regions', 'Connectivity regions'], ['fov', 'FOV / LOS / light'], ['dist', 'Distance map to player'], ['ai', 'AI intent, paths & hidden enemies'], ['occ', 'Collision occupancy'], ['reveal', 'Reveal whole map (debug)']];
  box.innerHTML = `<h4>OVERLAYS (live)</h4><div class="grid2">${opts.map(([k, l]) => `<label><input type="checkbox" data-d="${k}" ${UI.diag[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
  <h4>REPLAY / STATE</h4><div class="row" style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" id="dgVerify" style="padding:3px 8px;min-height:28px">Verify replay now</button><button class="btn" id="dgClose" style="padding:3px 8px;min-height:28px">Close panel</button></div><pre id="dgReplay"></pre>
  <div id="dgBody"></div>`;
  box.querySelectorAll('input[data-d]').forEach((c) => c.addEventListener('change', () => { UI.diag[c.dataset.d] = c.checked; UI.diag.any = ['walk', 'regions', 'fov', 'dist', 'ai', 'occ', 'reveal'].some((k) => UI.diag[k]); focusGame(); }));
  $('dgVerify').onclick = verifyReplay; $('dgClose').onclick = () => { toggleDiag(); focusGame(); };
  renderDiag();
}
function verifyReplay() {
  const r = UI.run; if (!r) return; const t0 = performance.now(); const sim = simulate(r.params, r.actions); const ms = Math.round(performance.now() - t0);
  const a = stateHash(r.state), b = sim.error ? 'error' : stateHash(sim.state); const ok = a === b;
  UI.lastVerify = `${ok ? '✓ identical' : '✗ MISMATCH'} after ${r.actions.length} actions (${ms} ms)\nlive  ${a}\nreplay ${b}${sim.error ? '\n' + sim.error : ''}`;
  const el = $('dgReplay'); if (el) el.innerHTML = `<span class="${ok ? 'ok' : 'no'}">${esc(UI.lastVerify)}</span>`;
  toast(ok ? 'Replay verification: identical final state.' : 'Replay verification FAILED.', ok ? 'good' : 'bad');
}
function renderDiag() {
  const s = S(); const body = $('dgBody'); if (!s || !body) return; const p = s.player; const fl = s.floor; const W = fl.w;
  const occ = new Map(); let dup = 0, wallBad = 0; for (const a of [p, ...s.enemies.filter((e) => e.hp > 0)]) { const k = a.y * W + a.x; if (occ.has(k)) dup++; occ.set(k, a); if (!tWalk(fl.t[k])) wallBad++; }
  const q = [`player  spd ${pspeed(p)} en ${p.energy}  (acts now)`].concat(s.enemies.filter((e) => e.hp > 0).map((e) => { const sp = espeed(e); const need = Math.max(0, 100 - e.energy); const next = sp ? Math.ceil(need / sp) : '∞'; return `#${e.id} ${e.k.padEnd(8)} spd ${String(sp).padStart(3)} en ${String(e.energy).padStart(3)} next≈${next === 0 ? 1 : next}t ${e.state}${isVis(s, e.x, e.y) ? '' : ' (hidden)'}`; }));
  const v = fl.validation || { checks: [] };
  const regions = regionsOf(fl, connPass(fl));
  const rv = UI.lastVerify ? `<span class="${UI.lastVerify.startsWith('✓') ? 'ok' : 'no'}">${esc(UI.lastVerify)}</span>` : 'not run yet';
  const rp = $('dgReplay'); if (rp && !rp.innerHTML) rp.innerHTML = rv;
  body.innerHTML = `<h4>TURN QUEUE (world round order)</h4><pre>${esc(q.slice(0, 18).join('\n'))}${q.length > 18 ? '\n…' : ''}</pre>
  <h4>COLLISION</h4><pre class="${dup || wallBad ? 'no' : 'ok'}">${dup || wallBad ? `✗ ${dup} shared tiles, ${wallBad} actors in walls` : `✓ ${occ.size} actors, no shared tiles, none in walls`}</pre>
  <h4>RNG</h4><pre>play rng sfc32 [${s.rng.s.map((x) => x.toString(16).padStart(8, '0')).join(' ')}]\ndraws this run: ${s.rng.n}\nfloor key: ${esc(`${s.params.seed}|${fl.style}|F${fl.n}|A${fl.attempt}`)}</pre>
  <h4>GENERATION VALIDATION</h4><pre>${esc(STYLES[fl.style].name)} · attempt ${fl.attempt}${fl.fallbackFrom ? ` (fallback from ${fl.fallbackFrom})` : ''} · ${fl.w}×${fl.h}\nregions now: ${regions.count} (sizes ${regions.sizes.slice(0, 6).join(', ')})\n${v.checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`).join('\n')}</pre>
  <h4>STATE</h4><pre>turn ${s.turn} · actions ${UI.replay ? UI.replay.i : UI.run.actions.length} · enemies ${s.enemies.filter((e) => e.hp > 0).length} · items ${s.items.length}\nfx fire ${Object.keys(s.fx.fire).length} gas ${Object.keys(s.fx.gas).length} smoke ${Object.keys(s.fx.smoke).length} · sounds ${s.sounds.length}\nparticles ${Renderer.stats.parts} · frame ${Renderer.stats.frameMs.toFixed(1)} ms · ${UI.fps} fps · dpr ${Renderer.dpr}</pre>
  <h4>AUDIO</h4><pre>${esc(Sfx.st.state)} · ${Sfx.st.enabled ? 'on' : 'muted'} · vol ${Math.round(Sfx.st.vol * 100)}% · played ${Sfx.st.played} · last ${esc(Sfx.st.last)}</pre>
  ${UI.errors.length ? `<h4>ERRORS</h4><pre class="no">${esc(UI.errors.slice(-5).join('\n'))}</pre>` : ''}`;
}
// ---------------------------------------------------------------- dialogs
function openMenu() {
  if (UI.mode !== 'play' && !UI.replay) { setMode('play'); UI.target = null; return; }
  const s = S(); const r = UI.run;
  $('mnInfo').textContent = s ? `${CLASSES[s.params.cls].name}, depth ${s.floorN}, turn ${s.turn}. ${r ? r.actions.length : 0} actions recorded.` : '';
  const forgiving = s && !s.params.permadeath; const rb = document.querySelector('[data-m="restart"]'); rb.disabled = !forgiving || !!UI.replay; rb.title = forgiving ? 'Return to the state you entered this floor with (counts as a restart; −150 score).' : 'Disabled in permadeath mode';
  document.querySelector('[data-m="load"]').disabled = !hasSave();
  $('mnNote').textContent = s && s.params.permadeath ? 'Permadeath: dying deletes the save. Floors cannot be restarted.' : 'Forgiving mode: you can restart the current floor, even after death.';
  openDialog('dlgMenu');
}
function menuAction(m) {
  closeDialog('dlgMenu');
  switch (m) {
    case 'resume': break;
    case 'save': saveGame(false); break;
    case 'load': confirmBox('Load the saved run?', 'Unsaved progress in the current run will be lost.', () => loadGame()); return;
    case 'export': openExport(); return;
    case 'import': openImport(); return;
    case 'replay': startReplay(); break;
    case 'restart': confirmBox('Restart this floor?', 'You return to the moment you entered this depth. Counts as a restart (−150 score).', () => { if (doAction(['r'])) { Renderer.reset(); UI.lastLogSeq = 0; $('log').innerHTML = ''; refreshAll(); toast('Floor restarted.', 'info'); } }); return;
    case 'new': openStart(); return;
    case 'settings': openSettings(); return;
    case 'help': openHelp(); return;
    case 'records': openRecords(); return;
  }
  afterDialog();
}
function afterDialog() { setTimeout(() => { if (!dialogOpen()) { setPaused(false); focusGame(); } }, 0); }
function confirmBox(title, text, yes) {
  $('cfTitle').textContent = title; $('cfText').textContent = text; openDialog('dlgConfirm');
  $('cfYes').onclick = () => { closeDialog('dlgConfirm'); yes(); afterDialog(); }; $('cfNo').onclick = () => { closeDialog('dlgConfirm'); afterDialog(); };
  $('cfYes').focus();
}
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function openStart() {
  const s = UI.run && UI.run.state; const P = s ? s.params : { seed: DEFAULT_SEED, cls: 'warden', style: 'mixed', difficulty: 'normal' };
  const cards = $('classCards'); cards.innerHTML = Object.entries(CLASSES).map(([k, C]) => `<label class="ccard"><input type="radio" name="cls" value="${k}" ${P.cls === k ? 'checked' : ''}><canvas width="112" height="112" data-cls="${k}"></canvas><span><b>${C.name}</b><br><small>${esc(C.blurb)}</small><br><span class="cstats">HP ${C.hp} · Acc ${C.acc} · Eva ${C.eva}<br>${C.abilities.map((a) => ABILITIES[a].name).join(' · ')}</span></span></label>`).join('');
  for (const c of cards.querySelectorAll('canvas')) Renderer.portrait(c, 'p_' + c.dataset.cls);
  $('stSeed').value = P.daily ? P.seed : P.seed; $('stStyle').value = P.style; $('stDiff').value = P.difficulty; $('stFloor').value = String(P.startFloor || 1);
  document.querySelector(`input[name="mode"][value="${P.permadeath ? 'permadeath' : 'forgiving'}"]`).checked = true;
  $('stDaily').setAttribute('aria-pressed', 'false'); $('stNote').textContent = '';
  $('stContinue').hidden = !hasSave(); $('stCancel').hidden = !UI.run;
  openDialog('dlgStart'); $('stGo').focus();
}
function readStart() {
  const cls = (document.querySelector('input[name="cls"]:checked') || {}).value || 'warden';
  const daily = $('stDaily').getAttribute('aria-pressed') === 'true';
  return { seed: $('stSeed').value.trim() || DEFAULT_SEED, cls, style: $('stStyle').value, difficulty: $('stDiff').value, startFloor: +$('stFloor').value, permadeath: document.querySelector('input[name="mode"]:checked').value === 'permadeath', daily: daily ? todayStr() : null };
}
function openSettings() {
  const s = UI.settings; $('seAnim').value = String(s.anim); $('seText').value = String(s.text); $('seContrast').value = s.contrast; $('seVol').value = s.vol; $('seTouch').value = s.touch; $('seZoom').value = String(s.zoom || autoZoom());
  $('seRM').checked = !!s.rm; $('seMute').checked = !!s.mute; $('seIntent').checked = !!s.intent; $('seAutosave').checked = !!s.autosave;
  openDialog('dlgSettings');
}
function bindSettings() {
  const upd = () => { const s = UI.settings; s.anim = +$('seAnim').value; s.text = +$('seText').value; s.contrast = $('seContrast').value; s.vol = +$('seVol').value; s.touch = $('seTouch').value; s.zoom = +$('seZoom').value; s.rm = $('seRM').checked; s.mute = $('seMute').checked; s.intent = $('seIntent').checked; s.autosave = $('seAutosave').checked; saveSettings(); applySettings(); };
  for (const id of ['seAnim', 'seText', 'seContrast', 'seVol', 'seTouch', 'seZoom', 'seRM', 'seMute', 'seIntent', 'seAutosave']) $(id).addEventListener(id === 'seVol' ? 'input' : 'change', upd);
}
function openHelp() { renderKeyTable(); renderLegend(); openDialog('dlgHelp'); $('hpTitle').focus(); $('dlgHelp').querySelector('.dlg').scrollTop = 0; }
function renderKeyTable() {
  $('keyTable').innerHTML = '<tr><th>Action</th><th>Keys</th><th></th></tr>' + ACTIONS.map(([id, label]) => `<tr><td>${esc(label)}</td><td>${UI.keys[id].map((k) => `<kbd>${esc(keyLabel(k))}</kbd>`).join(' ') || '—'}</td><td><button data-rebind="${id}" aria-label="Rebind ${esc(label)}">Rebind</button></td></tr>`).join('')
    + '<tr><td>Save game</td><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td></td></tr><tr><td>Targeting / inspect: next target · confirm · cancel</td><td><kbd>Tab</kbd> · <kbd>Enter</kbd> · <kbd>Esc</kbd></td><td></td></tr>';
}
function startRebind(id, btn) {
  if (UI.listenRebind) return; btn.textContent = 'Press a key…'; btn.classList.add('listen'); UI.listenRebind = true;
  const handler = (e) => {
    e.preventDefault(); e.stopPropagation(); window.removeEventListener('keydown', handler, true); UI.listenRebind = false; btn.classList.remove('listen');
    const k = keyOf(e); if (k === 'Escape' && id !== 'menu') { renderKeyTable(); return; }
    let note = ''; for (const [aid, label] of ACTIONS) { if (aid !== id && UI.keys[aid].includes(k)) { UI.keys[aid] = UI.keys[aid].filter((q) => q !== k); note = ` (removed from “${label}”)`; } }
    UI.keys[id] = [k, ...UI.keys[id].filter((q) => q !== k)].slice(0, 4); LS.set(KEY_KEYS, UI.keys); rebuildKeyMap(); renderKeyTable(); renderHero();
    toast(`Bound ${keyLabel(k)} to ${ACTIONS.find((a) => a[0] === id)[1]}${note}.`, 'good');
    const nb = document.querySelector(`[data-rebind="${id}"]`); if (nb) nb.focus();
  };
  window.addEventListener('keydown', handler, true);
}
function renderLegend() {
  const items = [['p_warden', 'You (Warden)'], ['p_ranger', 'Ranger'], ['p_arcanist', 'Arcanist'], ...Object.keys(ENEMIES).map((k) => ['e_' + k, ENEMIES[k].name]), ['i_heal', 'Healing Draught'], ['i_firebomb', 'Fire Bomb'], ['i_key', 'Iron Key'], ['i_gold', 'Gold']];
  const tiles = [['door', 'Closed door'], ['locked', 'Locked door'], ['down', 'Stairs down'], ['chest', 'Chest'], ['shrine', 'Shrine'], ['brazier', 'Brazier'], ['grass', 'Tall grass (blocks sight)'], ['water0', 'Water'], ['lava0', 'Lava'], ['chasm', 'Chasm']];
  const box = $('legend'); box.innerHTML = items.map(([k, l]) => `<div><canvas width="52" height="52" data-s="${k}"></canvas>${esc(l)}</div>`).join('') + tiles.map(([k, l]) => `<div><canvas width="52" height="52" data-t="${k}"></canvas>${esc(l)}</div>`).join('')
    + '<div><span style="color:#ff5a4a;font-weight:800;width:26px;text-align:center">▣</span>Red tile: telegraphed attack</div><div><span style="color:#8fc8ff;font-weight:800;width:26px;text-align:center">?</span>Sound you heard</div>';
  for (const c of box.querySelectorAll('canvas')) { const x = c.getContext('2d'); x.fillStyle = '#0b0810'; x.fillRect(0, 0, 52, 52); if (c.dataset.s) x.drawImage(Art.sprite(c.dataset.s, 52), 0, 0); else x.drawImage(Art.tile('fortress', c.dataset.t, 0, 52), 0, 0); }
}
function openRecords() {
  const recs = LS.get(KEY_REC, []);
  $('rcBody').innerHTML = recs.length ? `<table class="t"><tr><th>#</th><th>Score</th><th>Result</th><th>Hero</th><th>Depth</th><th>Turns</th><th>Seed</th><th>Date</th></tr>${recs.map((r, i) => `<tr><td>${i + 1}</td><td class="num">${r.score}</td><td>${r.result === 'victory' ? '👑 Victory' : 'Died'}${r.practice ? ' (practice)' : ''}</td><td>${esc(CLASSES[r.cls] ? CLASSES[r.cls].name : r.cls)}</td><td class="num">${r.floor}</td><td class="num">${r.turns}</td><td>${esc(r.seed)}${r.daily ? ' ☀' : ''}</td><td>${esc(r.date)}</td></tr>`).join('')}</table>` : '<p>No finished runs yet.</p>';
  openDialog('dlgRecords'); $('rcClose').focus();
}
function showEnd(s) {
  if (UI.replay) return; const win = s.over.result === 'victory'; const t = $('enTitle'); t.textContent = win ? 'Victory!' : 'You have fallen'; t.className = 'endtitle ' + (win ? 'win' : 'lose');
  $('enCause').textContent = `${s.over.cause}. Final score ${s.over.score}.`;
  const box = (l, v) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
  $('enSummary').innerHTML = box('Score', s.over.score) + box('Depth', `${s.floorN}/${LAST_FLOOR}`) + box('Turns', s.turn) + box('Kills', s.stats.kills) + box('Level', s.player.level) + box('Gold', s.player.gold) + box('Damage dealt', s.stats.dmgDealt) + box('Damage taken', s.stats.dmgTaken) + box('Items used', s.stats.itemsUsed) + box('Restarts', s.stats.restarts) + box('Hero', CLASSES[s.params.cls].name) + box('Seed', s.params.seed);
  $('enNote').textContent = `${UI.run.actions.length} actions recorded — watch the deterministic replay or export the run as JSON.`;
  $('enRestart').hidden = win || s.params.permadeath;
  openDialog('dlgEnd'); ($('enRestart').hidden ? document.querySelector('#dlgEnd [data-e="new"]') : $('enRestart')).focus();
}
function endAction(k) {
  closeDialog('dlgEnd'); const s = UI.run.state;
  if (k === 'records') return openRecords(); if (k === 'export') return openExport(); if (k === 'replay') { startReplay(); return afterDialog(); }
  if (k === 'restart') { if (doAction(['r'])) { UI.run.ended = false; Renderer.reset(); UI.lastLogSeq = 0; $('log').innerHTML = ''; refreshAll(); } return afterDialog(); }
  if (k === 'same') { startRun(Object.assign({}, s.params), 'Same seed, fresh start.'); return afterDialog(); }
  if (k === 'new') return openStart();
}
function openExport() {
  const r = UI.run; if (!r) return; const json = JSON.stringify(makeSave(r.state, r.actions, new Date().toISOString()));
  $('ioTitle').textContent = 'Export run'; $('ioDesc').textContent = `Complete run state (turn ${r.state.turn}) plus its ${r.actions.length}-action log. Anyone can import it to continue or re-simulate it.`;
  $('ioText').value = json; $('ioErr').textContent = ''; $('ioImportBtn').hidden = true; $('ioPick').hidden = true; $('ioDownload').hidden = false; $('ioCopy').hidden = false;
  openDialog('dlgIO'); $('ioText').select();
}
function openImport() {
  $('ioTitle').textContent = 'Import run'; $('ioDesc').textContent = 'Paste an exported run (JSON) or choose a .json file. The game validates the schema and rebuilds the state from the action log if the stored state is damaged.';
  $('ioText').value = ''; $('ioErr').textContent = ''; $('ioImportBtn').hidden = false; $('ioPick').hidden = false; $('ioDownload').hidden = true; $('ioCopy').hidden = true;
  openDialog('dlgIO'); $('ioText').focus();
}
function doImport() {
  let obj; try { obj = JSON.parse($('ioText').value); } catch (e) { $('ioErr').textContent = 'Not valid JSON: ' + e.message; return; }
  try { loadSave(obj); } catch (e) { $('ioErr').textContent = e.message; return; }
  closeDialog('dlgIO'); adoptSave(obj, 'Imported run'); afterDialog();
}
function download(name, text) { const b = new Blob([text], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
// ---------------------------------------------------------------- replay
function startReplay() {
  const r = UI.run; if (!r || !r.actions.length) return toast('Nothing to replay yet — take a few actions first.', 'info');
  stopTravel(); setMode('play');
  UI.replay = { params: r.params, actions: r.actions.slice(), target: stateHash(r.state), state: newGame(r.params), i: 0, playing: true, next: 0, speed: 1, done: false, verified: false };
  UI.replay.state._ev.length = 0; Renderer.reset(); UI.lastLogSeq = 0; $('log').innerHTML = '';
  $('replayBar').hidden = false; $('rpPlay').textContent = '⏸'; refreshAll(); updateReplayInfo(); focusGame();
}
function replayStep() {
  const R = UI.replay; if (!R) return; if (R.i >= R.actions.length) { finishReplay(); return; }
  Renderer.finishAll(); const ok = applyAction(R.state, R.actions[R.i]); R.i++;
  const evs = R.state._ev.splice(0); Renderer.onEvents(evs, R.state); for (const e of evs) if (e.type === 'sfx') Sfx.play(e.name);
  if (!ok) { R.done = true; R.playing = false; R.error = `Action ${R.i} rejected: ${R.state._msg}${replayNote()}`; }
  refreshAll(); updateReplayInfo(); if (R.i >= R.actions.length) finishReplay();
}
function replayNote() { const r = UI.run; return r && r.engine && r.engine !== ENGINE_VERSION ? ` (run recorded with engine ${r.engine})` : ''; }
function finishReplay() { const R = UI.replay; if (!R || R.done && R.checked) return; R.done = true; R.playing = false; R.checked = true; R.verified = stateHash(R.state) === R.target; $('rpPlay').textContent = '▶'; updateReplayInfo(); toast(R.verified ? 'Replay finished: final state identical to the live run ✓' : 'Replay diverged from the live run ✗', R.verified ? 'good' : 'bad'); }
function updateReplayInfo() { const R = UI.replay; if (!R) return; $('rpInfo').textContent = `Replay ${R.i}/${R.actions.length} · turn ${R.state.turn}${R.done ? (R.verified ? ' · ✓ identical final state' : R.error ? ' · ✗ ' + R.error : ' · ✗ mismatch') : ''}`; updateHud(true); }
function toggleReplayPlay() { const R = UI.replay; if (!R) return; if (R.done) { restartReplay(); return; } R.playing = !R.playing; $('rpPlay').textContent = R.playing ? '⏸' : '▶'; }
function restartReplay() { const R = UI.replay; if (!R) return; R.state = newGame(R.params); R.state._ev.length = 0; R.i = 0; R.done = false; R.checked = false; R.verified = false; R.playing = true; $('rpPlay').textContent = '⏸'; Renderer.reset(); UI.lastLogSeq = 0; $('log').innerHTML = ''; refreshAll(); updateReplayInfo(); }
function exitReplay(silent) { if (!UI.replay) return; UI.replay = null; $('replayBar').hidden = true; Renderer.reset(); UI.lastLogSeq = 0; $('log').innerHTML = ''; if (!silent) { refreshAll(); toast('Back to the live run.', 'info'); focusGame(); } }
function replayTick(now) { const R = UI.replay; if (!R || !R.playing || dialogOpen()) return; if (now < R.next) return; R.next = now + 220 * (+$('rpSpeed').value); replayStep(); }
