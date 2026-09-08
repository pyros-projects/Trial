/* ============================================================
   GAME — entities, patterns, fixed-step simulation, replay.
   All gameplay randomness flows from one seeded RNG consumed in
   event order, so a run is reproducible from (seed, inputs).
   ============================================================ */
const COLS = ['#59f2ff', '#ff4fd8', '#a3ff5e', '#ffd166', '#ff5470', '#ff9d3f', '#b18cff', '#4fa8ff', '#e8f4ff', '#67e8c3'];

const GAME = {
  mode: 'run',            // 'run' | 'lab'
  state: 'title',         // 'title','countdown','run','dead','victory','over','lab'
  paused: false,
  seed: 1, rng: null,
  time: 0, lastT: 0,
  score: 0, combo: 0, mult: 1, maxCombo: 0, graze: 0,
  hearts: 4, maxHearts: 4, bombs: 2, maxBombs: 2,
  counts: { 3: 0, 2: 0, 1: 0 }, hits: 0,
  lastJudgeT: -9, lastErrMs: null,
  evq: [], bullets: [], bfree: [], bulletCount: 0,
  pbullets: [], pbfree: [],
  parts: [], pfree: [], floaters: [],
  warns: [], judgeFx: [],
  boss: null, player: null,
  spiralAng: 0, banner: null, flashT: -9, hurtT: -9,
  shakeT: -9, shakePow: 0,
  hashes: [], nextHash: 1, lastStep: -1,
  recording: false, recInputs: [], recPtrT: 0,
  replayMode: false, pt: { x: W / 2, y: H * 0.78 }, ptActive: false,
  vdown: new Set(),
  lab: null,
  deadAt: 0, vicAt: 0, finished: false,
  lastStats: null,
  startStamp: 0,
};
GAME.vdown = new Set();
GAME.pending = new Set();   // one-shot actions (dash/bomb) triggered at edge-drain time

/* ---------------- pools ---------------- */
function initPools() {
  for (let i = 0; i < 1400; i++) GAME.bullets.push({ on: false });
  for (let i = 0; i < 160; i++) GAME.pbullets.push({ on: false });
  for (let i = 0; i < 900; i++) GAME.parts.push({ on: false });
  for (let i = 0; i < 48; i++) GAME.floaters.push({ on: false });
}
function resetPools() {
  for (const b of GAME.bullets) b.on = false;
  for (const b of GAME.pbullets) b.on = false;
  for (const p of GAME.parts) p.on = false;
  for (const f of GAME.floaters) f.on = false;
  GAME.bfree = []; for (let i = GAME.bullets.length - 1; i >= 0; i--) GAME.bfree.push(i);
  GAME.pbfree = []; for (let i = GAME.pbullets.length - 1; i >= 0; i--) GAME.pbfree.push(i);
  GAME.pfree = []; for (let i = GAME.parts.length - 1; i >= 0; i--) GAME.pfree.push(i);
  GAME.bulletCount = 0;
}
function spawnB(o) {
  if (!GAME.bfree.length) return null;
  const idx = GAME.bfree.pop();
  const b = GAME.bullets[idx];
  b.idx = idx;
  b.on = true; GAME.bulletCount++;
  b.x = o.x; b.y = o.y; b.vx = o.vx || 0; b.vy = o.vy || 0;
  b.r = o.r || 6; b.col = o.col || 0; b.kind = o.kind || 0;
  b.age = 0; b.life = o.life || 20; b.grazed = false; b.des = !!o.des;
  b.accDelay = o.accDelay || 0; b.accK = o.accK || 0; b.vmax = o.vmax || 0;
  b.angVel = o.angVel || 0; b.cx = o.cx || 0; b.cy = o.cy || 0;
  b.rad = o.rad || 0; b.ang = o.ang || 0; b.radVel = o.radVel || 0;
  return b;
}
function killB(b) { b.on = false; GAME.bfree.push(b.idx); GAME.bulletCount--; }
function spawnPB(o) {
  if (!GAME.pbfree.length) return;
  const idx = GAME.pbfree.pop();
  const b = GAME.pbullets[idx];
  b.idx = idx;
  b.on = true; b.x = o.x; b.y = o.y; b.vy = o.vy; b.dmg = o.dmg; b.erase = !!o.erase; b.age = 0;
}
function killPB(b) { b.on = false; GAME.pbfree.push(b.idx); }
function spawnP(o) {
  if (!GAME.pfree.length) return;
  const idx = GAME.pfree.pop();
  const p = GAME.parts[idx];
  p.idx = idx;
  p.on = true; p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
  p.age = 0; p.life = o.life || 0.6; p.size = o.size || 3; p.col = o.col || '#fff';
  p.star = !!o.star; p.drag = o.drag === undefined ? 2.4 : o.drag;
}
/* visual-only helpers (never touch the seeded stream) */
function spark(x, y, col, n, spd, life) {
  n = Math.round(n * SETTINGS.particles);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.9);
    spawnP({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col, life: life || 0.5 + Math.random() * 0.3, size: 1.5 + Math.random() * 2.5 });
  }
}
function starBurst(x, y, col, n) {
  n = Math.round(n * SETTINGS.particles);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = 40 + Math.random() * 160;
    spawnP({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, col, life: 0.7 + Math.random() * 0.5, size: 2 + Math.random() * 2, star: true, drag: 1.2 });
  }
}
function floatText(x, y, text, col, size) {
  for (const f of GAME.floaters) if (!f.on) {
    f.on = true; f.x = x + (Math.random() * 16 - 8); f.y = y; f.text = text;
    f.col = col; f.age = 0; f.life = 0.8; f.size = size || 13; return;
  }
}

/* ---------------- events ---------------- */
function insertEvent(ev) {
  const q = GAME.evq;
  if (q.length > 3000) q.splice(0, q.length - 2000);   // hard safety cap
  let i = q.length;
  while (i > 0 && q[i - 1].t > ev.t) i--;
  q.splice(i, 0, ev);
}
function gameplayStep(i, tRaw) {
  // Emitted from the deterministic sim step cursor (simTick), never from timers.
  if (GAME.mode === 'lab' && GAME.state === 'lab' && !GAME.paused) {
    const cfg = GAME.lab, L = cfg.gridLen, s = i % L;
    if (cfg.gridA[s]) insertEvent({ t: tRaw, k: 'fire', p: cfg.pattern, o: { lab: true } });
    if (cfg.gridB[s]) insertEvent({ t: tRaw, k: 'fire', p: 'accent', o: { lab: true } });
    return;
  }
  if (GAME.mode !== 'run' || GAME.state !== 'run') return;
  const ph = PHASES[GAME.boss.phase];
  const st = i & 15, bar = i >> 4;
  const rules = ph.rules(st, bar);
  for (const r of rules) insertEvent({ t: tRaw, k: 'fire', p: r[0], o: r[1] || {} });
  insertEvent({ t: tRaw, k: 'step', i });
}
function applyEvent(ev) {
  switch (ev.k) {
    case 'fire': firePattern(ev.p, ev.o || {}, ev.t); break;
    case 'step': onStepEvent(ev, ev.t); break;
    case 'lane': fireLanes(ev.o, ev.t); break;
    case 'in':
      if (ev.a === '__pd') GAME.ptActive = true;
      else if (ev.a === '__pu') GAME.ptActive = false;
      else applyInputEdge(ev.a, ev.down);
      break;
    case 'pt': GAME.pt.x = ev.x; GAME.pt.y = ev.y; break;
    case 'arr': MUSIC.setArrangement(ev.n); break;
  }
}
function onStepEvent(ev, t) {
  // combo decays one step per beat while no judged action happens
  if (GAME.combo > 0 && t - GAME.lastJudgeT > MUSIC.beatDur() * 4) {
    GAME.combo--; GAME.lastJudgeT = t - MUSIC.beatDur() * 3; GAME.mult = 1 + Math.min(7, GAME.combo / 20 | 0);
  }
}

/* ---------------- rhythm judging ---------------- */
function beatDeltaSec(t) { const bd = MUSIC.beatDur(); return t - Math.round(t / bd) * bd; }
function judge(t) {
  const d = Math.abs(beatDeltaSec(t)) * 1000, bd = MUSIC.beatDur() * 1000;
  return d <= bd * 0.12 ? 3 : d <= bd * 0.25 ? 2 : 1;
}
function noteJudge(q, t, x, y, label) {
  GAME.counts[q]++;
  GAME.lastErrMs = Math.round(beatDeltaSec(t) * 1000);
  GAME.lastJudgeT = t;
  if (GAME.judgeFx.length > 24) GAME.judgeFx.shift();
  GAME.judgeFx.push({ t, q });
  if (q >= 2) {
    GAME.combo += q === 3 ? 2 : 1;
    GAME.maxCombo = Math.max(GAME.maxCombo, GAME.combo);
    GAME.mult = 1 + Math.min(7, GAME.combo / 20 | 0);
  }
  GAME.shotTextN = (GAME.shotTextN || 0) + 1;
  if (q === 3) {
    addScore(12); sfx('shoot-perfect');
    if (GAME.shotTextN % 3 === 0 || label) floatText(x, y, label ? label + ' PERFECT' : 'PERFECT', '#aef3ff', 12);
  } else if (q === 2) {
    addScore(6); sfx('shoot-good');
    if (GAME.shotTextN % 6 === 0 || label) floatText(x, y, label ? label + ' GOOD' : 'GOOD', '#b6ff7a', 11);
  }
}
function addScore(n) { GAME.score += Math.round(n * GAME.mult); }

/* ---------------- patterns ---------------- */
function emitterPos() { return GAME.mode === 'lab' ? { x: W / 2, y: 150 } : { x: GAME.boss.x, y: GAME.boss.y }; }
function denMult() {
  if (GAME.mode === 'lab') return GAME.lab.density / 4;
  const ph = GAME.boss.phase;
  let d = DIFFS[SETTINGS.difficulty].den * PHASES[ph].den;
  const band = PHASES[ph].frac - (PHASES[ph + 1] ? PHASES[ph + 1].frac : 0);
  const into = (PHASES[ph].frac - GAME.boss.hp / GAME.boss.maxHp) / (band || 1);
  if (into > 0.6) d *= 1.18;                       // boss health shapes intensity
  return d;
}
function spdMult() { return GAME.mode === 'lab' ? GAME.lab.speed : DIFFS[SETTINGS.difficulty].spd; }

const PATTERNS = {
  accent(o, t) {
    const e = emitterPos(), sp = 80 * spdMult();
    const base = GAME.rng() * TAU;
    for (let i = 0; i < 6; i++) spawnB({ x: e.x, y: e.y, vx: Math.cos(base + i / 6 * TAU) * sp, vy: Math.sin(base + i / 6 * TAU) * sp, r: 5, col: 1, des: true });
  },
  radial(o, t) {
    const e = emitterPos();
    const n = Math.max(6, Math.round((o.n || 12) * denMult()));
    const base = o.rot !== undefined ? o.rot : GAME.rng() * TAU;
    const sp = (o.sp || 96) * spdMult();
    for (let i = 0; i < n; i++) {
      const a = base + i / n * TAU;
      spawnB({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, col: 0, des: true });
    }
    spark(e.x, e.y, COLS[0], 6, 90, 0.3);
  },
  spiral(o, t) {
    const e = emitterPos();
    const arms = o.arms || 2;
    GAME.spiralAng += 0.58;
    const sp = (o.sp || 86) * spdMult();
    const n = Math.round((o.n || 1) * denMult());
    for (let k = 0; k < n; k++) for (let a = 0; a < arms; a++) {
      const ang = GAME.spiralAng + a / arms * TAU + k * 0.12;
      spawnB({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 5, col: 2, des: true });
    }
  },
  aimed(o, t) {
    if (GAME.mode === 'lab') { PATTERNS.radial({ n: 8, sp: 110 }, t); return; }
    const e = emitterPos(), p = GAME.player;
    const n = Math.max(1, Math.round((o.n || 3) * Math.min(2, denMult())));
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    const spread = o.spread || 0.3, sp = (o.sp || 155) * spdMult();
    for (let i = 0; i < n; i++) {
      const a = base + (n > 1 ? (i / (n - 1) - 0.5) * spread * 2 : 0);
      spawnB({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5.5, col: 1, des: false });
    }
  },
  wall(o, t) {
    const e = emitterPos();
    const gapN = denMult() > 1.15 ? 2 : 1;
    const cells = Math.floor(W / 52);
    const g1 = 1 + (GAME.rng() * (cells - 2) | 0);
    const g2 = clamp(g1 + (GAME.rng() < 0.5 ? -3 : 3), 1, cells - 2);
    const sp = (o.sp || 82) * spdMult();
    for (let i = 0; i <= cells; i++) {
      const x = 20 + i * 52;
      let skip = Math.abs(i - g1) <= 0;
      if (gapN === 2) skip = skip || Math.abs(i - g2) <= 0;
      if (skip) continue;
      spawnB({ x, y: e.y - 8, vx: 0, vy: sp, r: 7, col: 3, des: false });
    }
  },
  lanes(o, t) {
    const n = Math.max(2, Math.round((o.n || 3) * Math.min(1.8, denMult())));
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(50 + GAME.rng() * (W - 100));
    for (const x of xs) {
      GAME.warns.push({ x, t0: t, t1: t + MUSIC.beatDur() });
      if (GAME.warns.length > 24) GAME.warns.shift();
    }
    insertEvent({ t: t + MUSIC.beatDur(), k: 'lane', o: { xs } });
  },
  accel(o, t) {
    if (GAME.mode === 'lab') { /* aim down */ }
    const e = emitterPos(), p = GAME.player;
    const n = Math.max(3, Math.round((o.n || 7) * Math.min(2, denMult())));
    const base = GAME.mode === 'lab' ? Math.PI / 2 : Math.atan2(p.y - e.y, p.x - e.x);
    const spread = 0.85;
    for (let i = 0; i < n; i++) {
      const a = base + (i / (n - 1) - 0.5) * spread;
      const sp = 66 * spdMult();
      spawnB({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6, col: 5, kind: 1, accDelay: 0.55, accK: 2.7, vmax: 340 * spdMult(), des: false });
    }
  },
  curve(o, t) {
    const e = emitterPos();
    const n = Math.max(4, Math.round((o.n || 8) * Math.min(2, denMult())));
    const sp = (o.sp || 74) * spdMult();
    const dir = GAME.rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      spawnB({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5.5, col: 6, kind: 2, angVel: dir * (1.0 + GAME.rng() * 0.7), des: true });
    }
  },
  orbit(o, t) {
    const e = emitterPos();
    const n = Math.max(5, Math.round((o.n || 7) * Math.min(2, denMult())));
    const dir = GAME.rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      spawnB({ x: e.x, y: e.y, col: 7, kind: 3, cx: e.x, cy: e.y, rad: 36, ang: i / n * TAU, angVel: dir * 2.3, radVel: 30, life: 9, r: 5.5, des: false });
    }
  },
  stutter(o, t) {
    if (GAME.mode === 'lab') { PATTERNS.aimed({ n: 1, sp: 230, spread: 0.5 }, t); return; }
    const e = emitterPos(), p = GAME.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x) + (GAME.rng() - 0.5) * 0.25;
    const sp = 235 * spdMult();
    spawnB({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4.5, col: 8, des: true });
  },
  chaos(o, t) {
    const pick = ['radial', 'spiral', 'aimed', 'curve', 'stutter', 'accel', 'orbit', 'radial'][(GAME.rng() * 8) | 0];
    PATTERNS[pick]({ n: 8, arms: 2 }, t);
  },
};
function fireLanes(o, t) {
  const sp = 330 * spdMult();
  for (const x of o.xs) {
    spawnB({ x, y: -12, vx: 0, vy: sp, r: 5.5, col: 4, des: false });
    if (!o.echo) insertEvent({ t: t + MUSIC.beatDur() * 0.5, k: 'lane', o: { xs: [x], echo: true } });
  }
  if (!o.echo) spark(W / 2, 8, COLS[4], 8, 60, 0.3);
}
function firePattern(p, o, t) {
  if (GAME.mode === 'run') {
    if (GAME.state !== 'run') return;
    if (GAME.time < GAME.boss.invulnUntil) return;
  } else if (GAME.mode === 'lab' && GAME.state !== 'lab') return;
  const fn = PATTERNS[p]; if (fn) fn(o, t);
}

/* ---------------- boss phases ---------------- */
const PHASES = [
  { frac: 1.0, den: 1.0, name: 'MOVEMENT I — PULSE', col: COLS[0], colIdx: 0,
    rules(st, bar) {
      const r = [];
      if (st === 0 || st === 8) r.push(['radial', { n: 12, rot: hash32(bar * 16 + st) % 628 / 100 }]);
      if (st === 2 || st === 6 || st === 10 || st === 14) r.push(['aimed', { n: 3, spread: 0.32 }]);
      return r;
    } },
  { frac: 0.72, den: 1.1, name: 'MOVEMENT II — SPIRAL DRIVE', col: COLS[2], colIdx: 2,
    rules(st, bar) {
      const r = [];
      if (st % 2 === 0) r.push(['spiral', { arms: 2 }]);
      if (st === 0 || st === 8) r.push(['wall', {}]);
      if (st === 4 || st === 12) r.push(['aimed', { n: 5, spread: 0.55 }]);
      return r;
    } },
  { frac: 0.45, den: 1.2, name: 'MOVEMENT III — LANE SURGE', col: COLS[3], colIdx: 3,
    rules(st, bar) {
      const r = [];
      if (st === 0) r.push(['lanes', { n: 3 + bar % 3 }]);
      if (st === 4) r.push(['accel', { n: 7 }]);
      if (st === 8) r.push(['curve', { n: 8 }]);
      if (st === 12) r.push(['wall', {}]);
      if (st === 2 || st === 14) r.push(['spiral', { arms: 3, n: 1 }]);
      return r;
    } },
  { frac: 0.18, den: 1.35, name: 'FINAL — OVERDRIVE', col: COLS[1], colIdx: 1,
    rules(st, bar) {
      const r = [];
      if (st % 4 === 0) r.push(['radial', { n: 10, sp: 118, rot: hash32(bar * 97 + st) % 628 / 100 }]);
      if (st % 2 === 1) r.push(['stutter', {}]);
      if (st === 6 || st === 14) r.push(['orbit', { n: 7 }]);
      if (st === 0 && bar % 2 === 0) r.push(['lanes', { n: 5 }]);
      if (st === 0 && bar % 2 === 1) r.push(['wall', {}]);
      return r;
    } },
];

/* ---------------- run lifecycle ---------------- */
function parseSeed(str) {
  if (str === undefined || str === null) return (Math.random() * 0xffffffff) >>> 0;
  const s = ('' + str).trim();
  if (s === '') return (Math.random() * 0xffffffff) >>> 0;
  if (/^\d+$/.test(s)) return (parseInt(s, 10) >>> 0) || 1;
  let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function startRun(opts) {
  opts = opts || {};
  const replay = opts.replay || null;
  if (replay) {   // force matching simulation settings
    SETTINGS.tempo = clamp(replay.tempo || SETTINGS.tempo, 60, 200);
    SETTINGS.difficulty = replay.difficulty || SETTINGS.difficulty;
    SETTINGS.preset = replay.preset || SETTINGS.preset;
    UI.applySettingsToControls();
  }
  const seed = replay ? (replay.seed >>> 0) : parseSeed(opts.seed);
  const diff = DIFFS[SETTINGS.difficulty];
  stopLabInternal();
  GAME.mode = 'run';
  GAME.state = 'countdown';
  GAME.paused = false; GAME.finished = false;
  GAME.seed = seed; GAME.rng = mulberry32(seed);
  GAME.spiralAng = 0;
  GAME.score = 0; GAME.combo = 0; GAME.mult = 1; GAME.maxCombo = 0; GAME.graze = 0;
  GAME.counts = { 3: 0, 2: 0, 1: 0 }; GAME.hits = 0;
  GAME.hearts = diff.hearts; GAME.maxHearts = diff.hearts;
  GAME.bombs = diff.bombs; GAME.maxBombs = diff.bombs;
  GAME.lastJudgeT = -9; GAME.lastErrMs = null;
  GAME.evq.length = 0; GAME.warns.length = 0; GAME.judgeFx.length = 0;
  GAME.banner = null; GAME.flashT = -9; GAME.hurtT = -9; GAME.shakeT = -9; GAME.shakePow = 0;
  GAME.hashes = []; GAME.nextHash = 1;
  GAME.recInputs = []; GAME.recPtrT = 0;
  GAME.replayMode = !!replay;
  GAME.recording = !replay;
  UI.pendingReplay = replay || null;
  GAME.ptActive = false; GAME.pt = { x: W / 2, y: H * 0.78 };
  GAME.vdown = new Set(); GAME.pending = new Set();
  GAME.lastStep = -1;
  GAME.boss = { x: W / 2, y: 150, cx: W / 2, cy: 150, hp: diff.hp, maxHp: diff.hp, phase: 0, invulnUntil: -1, hitFlashT: -9, dead: false };
  GAME.player = { x: W / 2, y: H - 150, alive: true, focus: false, invulnUntil: 0.5, dashUntil: -9, dashCdUntil: -9, dashDirX: 0, dashDirY: -1, fireCdUntil: -9, lastMvx: 0, lastMvy: -1 };
  resetPools();
  const countIn = 4 * MUSIC.beatDur();
  CLOCK.t0 = CLOCK.now() + countIn;
  GAME.time = GAME.lastT = CLOCK.game();
  MUSIC.regenSeq(seed);
  MUSIC.start(CLOCK.t0, 1);
  MUSIC.scheduleCountIn(CLOCK.t0, 4);
  if (replay) {
    for (const r of replay.inputs) {
      if (r[1] === 'pt') insertEvent({ t: r[0] / 1000, k: 'pt', x: r[2], y: r[3] });
      else if (r[1] === '__pd') insertEvent({ t: r[0] / 1000, k: 'in', a: '__pd', down: true });
      else if (r[1] === '__pu') insertEvent({ t: r[0] / 1000, k: 'in', a: '__pu', down: true });
      else insertEvent({ t: r[0] / 1000, k: 'in', a: r[1], down: !!r[2] });
    }
    toast('REPLAY — seed ' + replay.seed);
  }
  INPUT.releaseAll();
  UI.showScreen(null);
  UI.refreshHudVisibility();
  GAME.startStamp = performance.now();
}
function quitToTitle() {
  stopLabInternal();
  GAME.mode = 'run'; GAME.state = 'title'; GAME.paused = false;
  MUSIC.stop();
  if (AUDIO.ok) MUSIC.start(CLOCK.now() + 0.06, 0);
  UI.showScreen('title');
  UI.refreshHudVisibility();
}
function stopLabInternal() { GAME.lab = null; }

/* ---------------- lab ---------------- */
function startLab(cfg) {
  GAME.mode = 'lab'; GAME.state = 'lab';
  GAME.paused = false; GAME.finished = false;
  GAME.lab = cfg;
  GAME.seed = cfg.seed >>> 0; GAME.rng = mulberry32(GAME.seed);
  GAME.spiralAng = 0;
  GAME.score = 0; GAME.combo = 0; GAME.mult = 1; GAME.graze = 0;
  GAME.counts = { 3: 0, 2: 0, 1: 0 };
  GAME.hearts = 99; GAME.bombs = 0;
  GAME.lastJudgeT = -9; GAME.lastErrMs = null;
  GAME.evq.length = 0; GAME.warns.length = 0; GAME.judgeFx.length = 0;
  GAME.banner = null; GAME.hashes = []; GAME.nextHash = 1;
  GAME.recording = false; GAME.replayMode = false;
  GAME.ptActive = false; GAME.vdown = new Set(); GAME.pending = new Set();
  GAME.lastStep = -1;
  GAME.player = { x: W / 2, y: H - 150, alive: true, focus: false, invulnUntil: 1e9, dashUntil: -9, dashCdUntil: -9, dashDirX: 0, dashDirY: -1, fireCdUntil: -9, lastMvx: 0, lastMvy: -1 };
  GAME.boss = null;
  resetPools();
  SETTINGS.tempo = cfg.bpm;
  const countIn = 2 * MUSIC.beatDur();
  CLOCK.t0 = CLOCK.now() + countIn;
  GAME.time = GAME.lastT = CLOCK.game();
  MUSIC.regenSeq(GAME.seed);
  MUSIC.start(CLOCK.t0, 2);
  MUSIC.scheduleCountIn(CLOCK.t0, 2);
  INPUT.releaseAll();
  UI.showScreen(null);
  UI.refreshHudVisibility();
  toast('LAB — ' + PRESETS[SETTINGS.preset].name + ' @ ' + cfg.bpm + ' BPM');
}

/* ---------------- simulation ---------------- */
function isAct(a) { return GAME.replayMode ? GAME.vdown.has(a) : INPUT.isDown(a); }

function simTick(t) {
  GAME.time = t;
  if (GAME.state === 'countdown' && t >= 0) GAME.state = 'run';
  // deterministic gameplay emission grid: fire every 16th-note step the sim has
  // passed, derived purely from game time (immune to timer throttling)
  if (t >= 0 && (GAME.state === 'run' || GAME.state === 'lab')) {
    const sd = MUSIC.stepDur();
    const cur = Math.floor(t / sd + 1e-9);
    let guardE = 0;
    while (GAME.lastStep < cur && guardE++ < 64) {
      GAME.lastStep++;
      gameplayStep(GAME.lastStep, GAME.lastStep * sd);
    }
  }
  // live input edges captured between frames; one-shots become pending here
  while (INPUT.edges.length && INPUT.edges[0].t <= t + 1e-9) {
    const e = INPUT.edges.shift();
    if (!GAME.replayMode) applyInputEdge(e.a, e.down);
  }
  const q = GAME.evq;
  while (q.length && q[0].t <= t + 1e-9) applyEvent(q.shift());
  if (t >= 0) {
    updatePlayer(t);
    if (GAME.mode === 'run') updateBoss(t);
    updatePBullets(t);
    updateBullets(t);
  }
  if (GAME.mode === 'run' && (GAME.recording || GAME.replayMode) && t >= GAME.nextHash) {
    GAME.hashes.push(stateHash());
    GAME.nextHash += 1;
  }
  if (GAME.mode === 'run' && !GAME.finished) {
    if (GAME.state === 'dead' && t - GAME.deadAt > 1.5) { GAME.finished = true; UI.finishRun(false); }
    if (GAME.state === 'victory' && t - GAME.vicAt > 1.9) { GAME.finished = true; UI.finishRun(true); }
  }
}
function applyInputEdge(a, down) {
  if ((a === 'dash' || a === 'bomb') && down) GAME.pending.add(a);
  else if (down) GAME.vdown.add(a);
  else GAME.vdown.delete(a);
}

function stateHash() {
  const p = GAME.player, b = GAME.boss;
  return fnv1a(`${p.x | 0},${p.y | 0},${b ? b.hp | 0 : 0},${GAME.score},${GAME.bulletCount}`);
}

function updatePlayer(t) {
  const p = GAME.player, dt = SIM_DT;
  if (!p.alive) return;
  const focus = isAct('focus'); p.focus = focus;
  const sp = focus ? 150 : 335;
  let vx = 0, vy = 0;
  if (!GAME.replayMode && INPUT.pointer.active) {
    const dx = INPUT.pointer.x - p.x, dy = INPUT.pointer.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) { const m = Math.min(d, sp * dt); vx = dx / d * (m / dt); vy = dy / d * (m / dt); }
  } else {
    let x = 0, y = 0;
    if (isAct('left')) x -= 1; if (isAct('right')) x += 1;
    if (isAct('up')) y -= 1; if (isAct('down')) y += 1;
    if (!GAME.replayMode && x === 0 && y === 0 && INPUT.gp.seen) { x = INPUT.gp.axes[0]; y = INPUT.gp.axes[1]; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    vx = x * sp; vy = y * sp;
    if (x || y) { p.lastMvx = x; p.lastMvy = y; }
  }
  if (t < p.dashUntil) { vx = p.dashDirX * 560; vy = p.dashDirY * 560; }
  p.x = clamp(p.x + vx * dt, 14, W - 14);
  p.y = clamp(p.y + vy * dt, 64, H - 26);
  // pointer recording (live, for replay log)
  if (GAME.recording && INPUT.pointer.active) {
    const nowMs = CLOCK.game() * 1000;
    if (nowMs - GAME.recPtrT > 12) {
      GAME.recPtrT = nowMs;
      GAME.recInputs.push([Math.round(nowMs), 'pt', Math.round(INPUT.pointer.x * 10) / 10, Math.round(INPUT.pointer.y * 10) / 10]);
    }
  }
  // dash
  if (GAME.pending.has('dash')) {
    GAME.pending.delete('dash');
    if (t >= p.dashCdUntil && (GAME.state === 'run' || GAME.state === 'lab')) {
      let dx = p.lastMvx, dy = p.lastMvy;
      if (!GAME.replayMode) {
        const ax = INPUT.moveAxis();
        if (ax.x || ax.y) { dx = ax.x; dy = ax.y; }
        else if (INPUT.pointer.active) {
          const ddx = INPUT.pointer.x - p.x, ddy = INPUT.pointer.y - p.y, dd = Math.hypot(ddx, ddy) || 1;
          dx = ddx / dd; dy = ddy / dd;
        }
      }
      const m = Math.hypot(dx, dy) || 1;
      p.dashDirX = dx / m; p.dashDirY = dy / m;
      p.dashUntil = t + 0.16;
      const q = judge(t);
      noteJudge(q, t, p.x, p.y - 26, 'DASH');
      if (q === 3) { p.dashCdUntil = t + 0.8; p.invulnUntil = Math.max(p.invulnUntil, t + 0.45); addScore(38); }
      else p.dashCdUntil = t + 1.4;
      p.invulnUntil = Math.max(p.invulnUntil, t + 0.22);
      sfx('dash');
      spark(p.x, p.y, '#8fd8ff', 10, 140, 0.35);
    }
  }
  // bomb
  if (GAME.pending.has('bomb') && GAME.mode === 'run') {
    GAME.pending.delete('bomb');
    if (GAME.bombs > 0 && GAME.state === 'run') doBomb(t);
  }
  // fire
  const firing = isAct('fire') || (!GAME.replayMode && INPUT.pointer.active);
  if (firing && t >= p.fireCdUntil && (GAME.state === 'run' || GAME.state === 'lab')) {
    p.fireCdUntil = t + 0.11;
    shoot(t);
  }
}
function shoot(t) {
  const p = GAME.player;
  const q = judge(t);
  noteJudge(q, t, p.x, p.y - 18);
  const dmg = q === 3 ? 12 : q === 2 ? 9 : 6;
  spawnPB({ x: p.x, y: p.y - 14, vy: -780, dmg, erase: q === 3 });
}
function doBomb(t) {
  const p = GAME.player;
  GAME.bombs--;
  let cleared = 0;
  for (const b of GAME.bullets) if (b.on) {
    starBurst(b.x, b.y, COLS[b.col], 1);
    killB(b); cleared++;
    if (cleared > 260) break;
  }
  addScore(5 * Math.min(cleared, 200));
  GAME.combo += 5; GAME.maxCombo = Math.max(GAME.maxCombo, GAME.combo);
  GAME.mult = 1 + Math.min(7, GAME.combo / 20 | 0);
  p.invulnUntil = Math.max(p.invulnUntil, t + 2.0);
  GAME.shakeT = t; GAME.shakePow = 1.1;
  if (!SETTINGS.reducedFlash) GAME.flashT = t;
  ringBlasts.push({ x: p.x, y: p.y, t, col: '#aef3ff' });
  sfx('bomb');
  floatText(p.x, p.y - 30, 'BOMB', '#aef3ff', 16);
}
const ringBlasts = [];

function updateBoss(t) {
  const b = GAME.boss; if (!b) return;
  if (b.dead) return;
  // lissajous drift; settle to center while invulnerable (phase transitions)
  const inv = t < b.invulnUntil;
  const tx = inv ? b.cx : b.cx + Math.sin(t * 0.5) * 74;
  const ty = inv ? b.cy - 30 + Math.sin(t * 1.7) * 4 : b.cy + Math.sin(t * 0.83) * 18;
  b.x += (tx - b.x) * Math.min(1, SIM_DT * (inv ? 2.4 : 0.9));
  b.y += (ty - b.y) * Math.min(1, SIM_DT * (inv ? 2.4 : 0.9));
  // phase transitions
  const next = b.phase + 1;
  if (next < PHASES.length && b.hp <= b.maxHp * PHASES[next].frac) phaseTransition(next, t);
  // contact damage
  const p = GAME.player;
  if (p.alive && GAME.state === 'run' && t > p.invulnUntil && dist2(p.x, p.y, b.x, b.y) < 35 * 35) playerHit(t);
  if (b.hp <= 0 && GAME.state === 'run') {
    b.dead = true;
    GAME.state = 'victory'; GAME.vicAt = t;
    clearBullets(true);
    starBurst(b.x, b.y, PHASES[b.phase].col, 90);
    spark(b.x, b.y, '#ffffff', 60, 260, 0.9);
    GAME.shakeT = t; GAME.shakePow = 1.4;
    if (!SETTINGS.reducedFlash) GAME.flashT = t;
    MUSIC.setArrangement(5);
    AUDIO.duck(0.65, 0.4);
    addScore(1500 + GAME.hearts * 250);
  }
}
function phaseTransition(i, t) {
  const b = GAME.boss;
  b.phase = i;
  b.invulnUntil = t + 2.4;
  clearBullets(true);
  GAME.banner = { text: PHASES[i].name, col: PHASES[i].col, until: t + 2.4 };
  addScore(500 * (i + 1));
  MUSIC.setArrangement(i + 1);
  AUDIO.duck(0.5, 0.6);
  sfx('phase');
  GAME.shakeT = t; GAME.shakePow = 0.9;
  if (!SETTINGS.reducedFlash) GAME.flashT = t;
  starBurst(b.x, b.y, PHASES[i].col, 40);
}
function clearBullets(toStars) {
  for (const b of GAME.bullets) if (b.on) {
    if (toStars) starBurst(b.x, b.y, COLS[b.col], 1);
    killB(b);
  }
  GAME.warns.length = 0;
}

/* spatial hash for collisions (rebuilt each tick) */
const GRID = { cs: 60, cols: Math.ceil(W / 60), rows: Math.ceil(H / 60), cells: [] };
for (let i = 0; i < GRID.cols * GRID.rows; i++) GRID.cells.push([]);
function gridIndex(x, y) {
  const cx = clamp(x / GRID.cs | 0, 0, GRID.cols - 1), cy = clamp(y / GRID.cs | 0, 0, GRID.rows - 1);
  return cy * GRID.cols + cx;
}
function rebuildGrid() {
  for (const c of GRID.cells) if (c.length) c.length = 0;
  for (let i = 0; i < GAME.bullets.length; i++) {
    const b = GAME.bullets[i];
    if (b.on) GRID.cells[gridIndex(b.x, b.y)].push(i);
  }
}

function updateBullets(t) {
  const dt = SIM_DT, p = GAME.player;
  rebuildGrid();
  const canHit = GAME.mode === 'run' && GAME.state === 'run' && p.alive;
  for (let i = 0; i < GAME.bullets.length; i++) {
    const b = GAME.bullets[i];
    if (!b.on) continue;
    b.age += dt;
    switch (b.kind) {
      case 1: // accelerating
        if (b.age > b.accDelay) {
          const sp = Math.hypot(b.vx, b.vy);
          const ns = Math.min(b.vmax || 400, sp * (1 + b.accK * dt));
          b.vx *= ns / sp; b.vy *= ns / sp;
        }
        b.x += b.vx * dt; b.y += b.vy * dt; break;
      case 2: // curving
        {
          const c = Math.cos(b.angVel * dt), s = Math.sin(b.angVel * dt);
          const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
          b.vx = vx; b.vy = vy;
          b.x += b.vx * dt; b.y += b.vy * dt;
        } break;
      case 3: // orbiting
        b.ang += b.angVel * dt; b.rad += b.radVel * dt;
        b.x = b.cx + Math.cos(b.ang) * b.rad;
        b.y = b.cy + Math.sin(b.ang) * b.rad;
        break;
      default:
        b.x += b.vx * dt; b.y += b.vy * dt;
    }
    if (b.age > b.life || b.x < -40 || b.x > W + 40 || b.y < -60 || b.y > H + 40) { killB(b); continue; }
    if (!canHit || t <= p.invulnUntil) continue;
    const rr = b.r + 3.2, dd = dist2(b.x, b.y, p.x, p.y);
    if (dd < rr * rr) { playerHit(t); continue; }
    if (!b.grazed) {
      const gr = b.r + 26;
      if (dd < gr * gr) graze(b, t);
    }
  }
}
function graze(b, t) {
  b.grazed = true;
  GAME.graze++;
  GAME.combo++; GAME.maxCombo = Math.max(GAME.maxCombo, GAME.combo);
  GAME.mult = 1 + Math.min(7, GAME.combo / 20 | 0);
  const p = GAME.player;
  const nearBeat = Math.abs(beatDeltaSec(t)) < 0.07;
  addScore(nearBeat ? 35 : 10);
  if (nearBeat) floatText(p.x, p.y - 30, 'GRAZE ✦', '#ffd166', 12);
  spark((b.x + p.x) / 2, (b.y + p.y) / 2, '#9fd2ff', 3, 80, 0.3);
  sfx('graze');
}
function playerHit(t) {
  const p = GAME.player;
  p.invulnUntil = t + 1.7;
  GAME.hearts--;
  GAME.hits++;
  GAME.combo = 0; GAME.mult = 1;
  GAME.hurtT = t;
  GAME.shakeT = t; GAME.shakePow = 0.8;
  if (!SETTINGS.reducedFlash) GAME.flashT = t;
  // mercy clear around the player
  for (const b of GAME.bullets) if (b.on && dist2(b.x, b.y, p.x, p.y) < 115 * 115) { spark(b.x, b.y, COLS[b.col], 2, 70, 0.3); killB(b); }
  spark(p.x, p.y, '#ff5470', 26, 200, 0.6);
  sfx('hit');
  if (GAME.hearts <= 0) {
    p.alive = false;
    GAME.state = 'dead'; GAME.deadAt = t;
    starBurst(p.x, p.y, '#ff5470', 60);
    spark(p.x, p.y, '#ffffff', 50, 300, 1.0);
    GAME.shakeT = t; GAME.shakePow = 1.4;
    clearBullets(true);
    MUSIC.setArrangement(6);
    AUDIO.duck(0.7, 0.5);
  }
}
function updatePBullets(t) {
  const dt = SIM_DT, b = GAME.boss;
  for (const pb of GAME.pbullets) {
    if (!pb.on) continue;
    pb.y += pb.vy * dt; pb.age += dt;
    if (pb.y < -20) { killPB(pb); continue; }
    // perfect shots erase light bullets
    if (pb.erase) {
      const cell = gridIndex(pb.x, pb.y);
      for (let gy = Math.max(0, cell - GRID.cols - 1); gy <= Math.min(GRID.cells.length - 1, cell + GRID.cols + 1); gy++) {
        for (const bi of GRID.cells[gy]) {
          const eb = GAME.bullets[bi];
          if (eb.on && eb.des && dist2(pb.x, pb.y, eb.x, eb.y) < 15 * 15) {
            spark(eb.x, eb.y, COLS[eb.col], 4, 90, 0.3);
            addScore(2); killB(eb); killPB(pb);
            break;
          }
        }
        if (!pb.on) break;
      }
      if (!pb.on) continue;
    }
    // boss damage
    if (GAME.mode === 'run' && b && !b.dead && GAME.state === 'run' && GAME.time >= b.invulnUntil &&
        dist2(pb.x, pb.y, b.x, b.y) < 30 * 30) {
      b.hp -= pb.dmg;
      b.hitFlashT = GAME.time;
      addScore(pb.dmg * 0.5);
      spark(pb.x, pb.y - 6, '#eaf6ff', 3, 90, 0.25);
      killPB(pb);
    }
  }
}

/* ---------------- replay i/o ---------------- */
function recordEdge(a, down) {
  if (GAME.recording && (GAME.state === 'run' || GAME.state === 'countdown')) {
    GAME.recInputs.push([Math.round(CLOCK.game() * 1000), a, down ? 1 : 0]);
  }
}
function buildReplayJSON() {
  return {
    v: 1, app: 'pulsefall',
    seed: GAME.seed, tempo: SETTINGS.tempo, difficulty: SETTINGS.difficulty, preset: SETTINGS.preset,
    duration: Math.round(Math.max(0, GAME.time) * 1000),
    stats: {
      score: GAME.score, graze: GAME.graze, maxCombo: GAME.maxCombo,
      hits: GAME.hits, victory: GAME.lastStats ? GAME.lastStats.victory : false,
    },
    hashes: GAME.hashes,
    inputs: GAME.recInputs,
  };
}
function parseReplayJSON(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return { err: 'not valid JSON' }; }
  if (!o || o.app !== 'pulsefall' || o.v !== 1 || !Array.isArray(o.inputs) || !(typeof o.seed === 'number'))
    return { err: 'not a pulsefall replay (v1)' };
  return { ok: true, data: o };
}
function downloadReplay() {
  try {
    const data = JSON.stringify(buildReplayJSON());
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pulsefall-replay-' + GAME.seed + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    toast('Replay exported (' + GAME.recInputs.length + ' events)');
  } catch (e) { toast('Export failed: ' + e.message, true); }
}
