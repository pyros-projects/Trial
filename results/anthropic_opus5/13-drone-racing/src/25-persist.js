/* ============================================================================
   PERSISTENCE — best times, settings, JSON export/import, PNG capture.
   localStorage is unavailable on some file:// origins, so everything goes
   through a wrapper that falls back to memory and says so in the UI.
   ========================================================================== */
const STORE_KEY = 'velociraptor-fpv-v1';
const EXPORT_FORMAT = 'velociraptor-fpv';
const EXPORT_VERSION = 1;

const Store = (() => {
  let backing = null, available = false, reason = 'not tested';
  try {
    const t = '__vfpv_probe__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    backing = window.localStorage; available = true; reason = 'localStorage';
  } catch (e) {
    reason = 'localStorage blocked (' + (e && e.name || 'error') + ') — using in-memory storage for this session';
    const mem = new Map();
    backing = {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k)
    };
  }
  return {
    available, reason,
    read() {
      try { const raw = backing.getItem(STORE_KEY); return raw ? JSON.parse(raw) : {}; }
      catch (e) { return {}; }
    },
    /** On a quota failure, shed the bulky ghost recordings (keeping the lap
        times) and try once more, rather than losing the whole store. */
    write(obj) {
      try { backing.setItem(STORE_KEY, JSON.stringify(obj)); this.lastError = null; return true; }
      catch (e) {
        this.lastError = String(e && e.name || e);
        try {
          const slim = JSON.parse(JSON.stringify(obj));
          if (slim.best) for (const k of Object.keys(slim.best)) if (slim.best[k]) slim.best[k].ghost = null;
          backing.setItem(STORE_KEY, JSON.stringify(slim));
          this.lastError = this.lastError + ' — ghost recordings dropped to fit';
          return true;
        } catch (e2) { return false; }
      }
    },
    clear() { try { backing.removeItem(STORE_KEY); return true; } catch (e) { return false; } }
  };
})();

function courseKey(s) { return `${s.env}|${s.seed}|${s.gateCount}|${s.difficulty}`; }

function saveSettings(settings) {
  const db = Store.read();
  db.settings = settings;
  db.savedAt = new Date().toISOString();
  return Store.write(db);
}
function loadSettings() {
  const db = Store.read();
  if (!db.settings || typeof db.settings !== 'object') return null;
  const out = Object.assign({}, DEFAULT_SETTINGS);
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    const v = db.settings[k];
    if (v === undefined || v === null) continue;
    if (typeof DEFAULT_SETTINGS[k] === 'number' && typeof v === 'number' && isFin(v)) out[k] = v;
    else if (typeof DEFAULT_SETTINGS[k] === 'boolean' && typeof v === 'boolean') out[k] = v;
    else if (typeof DEFAULT_SETTINGS[k] === 'string' && typeof v === 'string') out[k] = v;
  }
  return out;
}
function saveBest(key, payload) {
  const db = Store.read();
  db.best = db.best || {};
  db.best[key] = payload;
  return Store.write(db);
}
function loadBest(key) {
  const db = Store.read();
  return (db.best && db.best[key]) || null;
}
function allBests() { return Store.read().best || {}; }
function clearBest(key) {
  const db = Store.read();
  if (db.best) delete db.best[key];
  return Store.write(db);
}

/* ---------------------------------------------------------------- export */
function buildExport(kind, settings, race) {
  const o = {
    format: EXPORT_FORMAT, version: EXPORT_VERSION, kind,
    created: new Date().toISOString(),
    course: {
      env: settings.env, seed: settings.seed, gateCount: settings.gateCount,
      difficulty: settings.difficulty, obstacleDensity: settings.obstacleDensity
    }
  };
  if (kind === 'replay' || kind === 'bundle') {
    const b = race.exportBest();
    if (b) { o.best = b.best; o.ghost = b.ghost; }
  }
  if (kind === 'bundle') o.settings = Object.assign({}, settings);
  return o;
}

function downloadJSON(obj, filename) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/* ---------------------------------------------------------------- import */
function validateImport(text) {
  let o;
  try { o = JSON.parse(text); }
  catch (e) { return { ok: false, error: 'Not valid JSON: ' + (e.message || e) }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'Top level must be a JSON object.' };
  if (o.format !== EXPORT_FORMAT) return { ok: false, error: `Unknown format "${o.format}" — expected "${EXPORT_FORMAT}".` };
  if (typeof o.version !== 'number' || o.version > EXPORT_VERSION) return { ok: false, error: `Unsupported version ${o.version}.` };
  const out = { ok: true, kind: o.kind || 'bundle', warnings: [] };
  if (o.course) {
    const c = o.course;
    if (typeof c !== 'object') return { ok: false, error: 'course must be an object.' };
    if (typeof c.seed !== 'string' || !c.seed.length || c.seed.length > 64) return { ok: false, error: 'course.seed must be a string of 1–64 characters.' };
    if (!ENVIRONMENTS[c.env]) return { ok: false, error: `course.env "${c.env}" is not one of: ${Object.keys(ENVIRONMENTS).join(', ')}.` };
    if (!isFin(c.gateCount) || c.gateCount < 4 || c.gateCount > 24) return { ok: false, error: 'course.gateCount must be a number from 4 to 24.' };
    if (!isFin(c.difficulty) || c.difficulty < 0 || c.difficulty > 3) return { ok: false, error: 'course.difficulty must be 0–3.' };
    out.course = {
      env: c.env, seed: c.seed, gateCount: Math.round(c.gateCount), difficulty: Math.round(c.difficulty),
      obstacleDensity: isFin(c.obstacleDensity) ? clamp(c.obstacleDensity, 0.2, 2) : 1
    };
  }
  if (o.ghost) {
    const g = o.ghost;
    if (typeof g !== 'object' || !Array.isArray(g.frames)) return { ok: false, error: 'ghost.frames must be an array.' };
    if (g.frames.length > 60000) return { ok: false, error: 'ghost.frames is too large (limit 60000).' };
    const bad = g.frames.findIndex(f => !Array.isArray(f) || f.length < 8 || !f.every(v => typeof v === 'number' && isFin(v)));
    if (bad >= 0) return { ok: false, error: `ghost.frames[${bad}] is not 8+ finite numbers.` };
    if (g.frames.length < 2) out.warnings.push('ghost has fewer than 2 frames and will not be shown');
    out.ghost = { hz: isFin(g.hz) ? clamp(g.hz, 1, 240) : GHOST_HZ, frames: g.frames };
  }
  if (o.best) {
    const bt = o.best;
    if (!isFin(bt.time) || bt.time <= 0) return { ok: false, error: 'best.time must be a positive number.' };
    if (bt.sectors && !Array.isArray(bt.sectors)) return { ok: false, error: 'best.sectors must be an array.' };
    out.best = { time: bt.time, sectors: (bt.sectors || []).filter(isFin) };
  }
  if (o.settings) {
    if (typeof o.settings !== 'object') return { ok: false, error: 'settings must be an object.' };
    const s = {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      const v = o.settings[k];
      if (v === undefined) continue;
      if (typeof v !== typeof DEFAULT_SETTINGS[k]) { out.warnings.push(`settings.${k} ignored (wrong type)`); continue; }
      if (typeof v === 'number' && !isFin(v)) { out.warnings.push(`settings.${k} ignored (not finite)`); continue; }
      s[k] = v;
    }
    out.settings = s;
  }
  if (!out.course && !out.ghost && !out.best && !out.settings) return { ok: false, error: 'Nothing importable found (expected course, ghost, best or settings).' };
  return out;
}

/* ------------------------------------------------------------- screenshot */
function captureFrame(glCanvas, hudCanvas) {
  try {
    const w = Math.max(glCanvas.width, hudCanvas ? hudCanvas.width : 0);
    const h = Math.max(glCanvas.height, hudCanvas ? hudCanvas.height : 0);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(glCanvas, 0, 0, w, h);
    if (hudCanvas) ctx.drawImage(hudCanvas, 0, 0, w, h);
    return c;
  } catch (e) { return null; }
}
function downloadCanvas(canvas, filename) {
  return new Promise(resolve => {
    if (!canvas) return resolve({ ok: false, error: 'capture failed' });
    try {
      canvas.toBlob(blob => {
        if (!blob) return resolve({ ok: false, error: 'toBlob returned null' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
        resolve({ ok: true, bytes: blob.size });
      }, 'image/png');
    } catch (e) { resolve({ ok: false, error: String(e && e.message || e) }); }
  });
}
