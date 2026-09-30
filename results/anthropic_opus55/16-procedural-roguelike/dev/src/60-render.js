// ============================================================ RENDERER
// Draws whatever state it is given (live run or replay). Animations only
// interpolate between already-resolved states; they never drive game logic.
const Renderer = (() => {
  let cv, ctx, mini, mctx; let dpr = 1, cw = 0, ch = 0, ts = 32;
  const cam = { x: 0, y: 0, init: false };
  const anims = new Map(), lunges = new Map(), hurt = new Map();
  let parts = [], floaters = [], projs = [], rings = [], ghosts = [], shake = { t0: 0, dur: 0, mag: 0 };
  let lightCv, lightCtx, lightImg, tintCv, tintCtx, tintImg, miniCv, miniCtx, miniImg; let lastW = 0, lastH = 0;
  const opts = { anim: 1, rm: false, intent: true, hc: false };
  const vr = makeRng('visual-fx'); const vrand = () => rnext(vr);
  let regionCache = { key: '', data: null }, distCache = { key: '', data: null };
  const stats = { parts: 0, frameMs: 0 };
  const ease = (k) => 1 - (1 - k) * (1 - k);
  const variant = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 13; // 0-11 plain/cracked, 12 decal
  function init(canvas, minimap) { cv = canvas; ctx = cv.getContext('2d'); mini = minimap; mctx = mini.getContext('2d'); resize(); }
  function resize() {
    const r = cv.getBoundingClientRect(); const ndpr = Math.min(3, window.devicePixelRatio || 1);
    if (ndpr !== dpr) Art.clear();
    dpr = ndpr; cw = Math.max(1, r.width); ch = Math.max(1, r.height);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  }
  function setTile(n) { if (n !== ts) { ts = n; cam.init = false; } }
  const dur = (ms) => (opts.rm || opts.anim === 0 ? 0 : ms * opts.anim);
  function reset() { anims.clear(); lunges.clear(); hurt.clear(); parts = []; floaters = []; projs = []; rings = []; ghosts = []; cam.init = false; regionCache.key = ''; distCache.key = ''; }
  function center(x, y) { return [x * ts + ts / 2, y * ts + ts / 2]; }
  function burst(x, y, n, col, speed = 60, life = 500, grav = 60, size = 2.2) {
    if (opts.rm) n = Math.min(n, 3);
    const [cx, cy] = center(x, y);
    for (let i = 0; i < n && parts.length < 600; i++) { const a = vrand() * Math.PI * 2, v = speed * (0.3 + vrand()); parts.push({ x: cx + (vrand() - 0.5) * ts * 0.3, y: cy + (vrand() - 0.5) * ts * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, life, max: life, col, grav: opts.rm ? 0 : grav, size }); }
  }
  function floater(x, y, text, col, big) { floaters.push({ x, y, text, col, big, t0: performance.now(), dur: big ? 1300 : 900 }); if (floaters.length > 60) floaters.shift(); }
  function onEvents(evs, s) {
    const now = performance.now(); const pos = new Map([[0, s.player]]); for (const e of s.enemies) pos.set(e.id, e);
    for (const e of evs) {
      switch (e.type) {
        case 'move': {
          const d = dur(e.kb ? 150 : 110); if (!d) break;
          const cur = anims.get(e.id); if (cur && cur.t0 === now) { cur.tx = e.tx; cur.ty = e.ty; cur.dur = Math.min(cur.dur + d * 0.6, d * 2); }
          else anims.set(e.id, { fx: e.fx, fy: e.fy, tx: e.tx, ty: e.ty, t0: now, dur: d });
          break;
        }
        case 'attack': { const d = dur(e.ranged ? 90 : 150); if (d) lunges.set(e.id, { dx: sign(e.tx - e.x), dy: sign(e.ty - e.y), t0: now, dur: d }); break; }
        case 'dmg': { floater(e.x, e.y, (e.crit ? '✦' : '') + '-' + e.amount, e.id === 0 ? '#ff7a6a' : e.crit ? '#ffd24a' : '#ffffff', e.crit); hurt.set(e.id, now); burst(e.x, e.y, e.kind === 'poison' ? 3 : 7, e.kind === 'poison' ? '#8fdc5a' : e.kind === 'burning' || e.kind === 'fire' ? '#ff8a3d' : '#b3202a', 70, 450); if (e.id === 0 && !opts.rm) shake = { t0: now, dur: 180, mag: Math.min(6, 1.5 + e.amount / 3) }; break; }
        case 'miss': floater(e.x, e.y, 'miss', '#b0a8c0'); break;
        case 'death': { const a = pos.get(e.id); ghosts.push({ key: e.id === 0 ? 'p_' + s.player.cls : 'e_' + (e.k || (a && a.k)), x: e.x, y: e.y, t0: now, dur: opts.rm ? 300 : 650 }); burst(e.x, e.y, 16, e.k === 'skeleton' || e.k === 'boss' ? '#e8e2cf' : '#9b1c24', 90, 700); if (e.k === 'boss') { burst(e.x, e.y, 60, '#ffb347', 160, 1400, 20, 3); if (!opts.rm) shake = { t0: now, dur: 500, mag: 8 }; } break; }
        case 'proj': projs.push({ ...e, t0: now, dur: Math.max(60, dur(40 + 28 * Math.hypot(e.x1 - e.x0, e.y1 - e.y0))) || 1 }); break;
        case 'explode': burst(e.x, e.y, e.small ? 14 : 34, '#ff9a3d', 120, 700, 30, 3); burst(e.x, e.y, 12, '#ffe08a', 80, 500, 10, 2); if (!opts.rm) shake = { t0: now, dur: 260, mag: e.small ? 2 : 5 }; break;
        case 'impact': burst(e.x, e.y, e.big ? 18 : 8, '#b8a890', 80, 500, 80, 2.4); if (!opts.rm) shake = { t0: now, dur: 200, mag: e.big ? 5 : 2.5 }; break;
        case 'heal': burst(e.x, e.y, 14, '#8fdc7a', 40, 800, -40, 2); break;
        case 'sparkle': burst(e.x, e.y, 16, '#ffd24a', 50, 800, -20, 2); break;
        case 'blink': burst(e.x0, e.y0, 14, '#c9a2ff', 60, 600, -10, 2); burst(e.x1, e.y1, 14, '#c9a2ff', 60, 600, -10, 2); break;
        case 'summon': burst(e.x, e.y, 16, '#b06aff', 50, 700, -30, 2.6); rings.push({ x: e.x, y: e.y, t0: now, dur: 700, col: '#b06aff' }); break;
        case 'hear': rings.push({ x: e.x, y: e.y, t0: now, dur: 1200, col: '#8fc8ff', sound: 1 }); break;
        case 'trap': burst(e.x, e.y, 10, '#ffd24a', 60, 500); break;
        case 'trapSpotted': rings.push({ x: e.x, y: e.y, t0: now, dur: 800, col: '#ffc15e' }); break;
        case 'levelup': floater(s.player.x, s.player.y, 'LEVEL UP!', '#ffd24a', true); burst(s.player.x, s.player.y, 24, '#ffd24a', 60, 900, -30, 2.2); break;
        case 'spot': { const a = pos.get(e.id); if (a) floater(a.x, a.y, '!', '#ffc15e', true); break; }
        case 'wake': { const a = pos.get(e.id); if (a && isVis(s, a.x, a.y)) floater(a.x, a.y, '?', '#ffc15e'); break; }
        case 'floor': reset(); break;
        case 'victory': rings.push({ x: s.player.x, y: s.player.y, t0: now, dur: 2000, col: '#ffd24a' }); break;
      }
    }
  }
  function rpos(a, now) {
    let x = a.x, y = a.y; const an = anims.get(a.id);
    if (an) { const k = (now - an.t0) / an.dur; if (k >= 1 || an.tx !== a.x || an.ty !== a.y) anims.delete(a.id); else { const e = ease(k); x = an.fx + (an.tx - an.fx) * e; y = an.fy + (an.ty - an.fy) * e; } }
    const l = lunges.get(a.id);
    if (l) { const k = (now - l.t0) / l.dur; if (k >= 1) lunges.delete(a.id); else { const o = Math.sin(Math.PI * k) * 0.28; x += l.dx * o; y += l.dy * o; } }
    return [x, y];
  }
  function animating(now) { return anims.size > 0 || lunges.size > 0 || projs.length > 0; }
  function finishAll() { anims.clear(); lunges.clear(); projs = []; }
  // ------------------------------------------------------ main draw
  function draw(s, U, now, dt) {
    const t0 = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, cw, ch); ctx.imageSmoothingEnabled = false;
    if (!s || !s.floor) return;
    const fl = s.floor, W = fl.w, H = fl.h; ensureVision(s); const vis = s._vis, exp = fl.explored, p = s.player; const Sz = Math.round(ts * dpr);
    const [prx, pry] = rpos(p, now); const [tx, ty] = center(prx, pry);
    const mw = W * ts, mh = H * ts; let gx = mw > cw ? clamp(tx, cw / 2 - ts * 2, mw - cw / 2 + ts * 2) : mw / 2; let gy = mh > ch ? clamp(ty, ch / 2 - ts * 2, mh - ch / 2 + ts * 2) : mh / 2;
    if (!cam.init || opts.rm || opts.anim === 0) { cam.x = gx; cam.y = gy; cam.init = true; } else { const k = 1 - Math.exp(-dt * 0.012); cam.x += (gx - cam.x) * k; cam.y += (gy - cam.y) * k; if (Math.abs(gx - cam.x) < 0.3) cam.x = gx; if (Math.abs(gy - cam.y) < 0.3) cam.y = gy; }
    let ox = Math.round(cw / 2 - cam.x), oy = Math.round(ch / 2 - cam.y);
    if (shake.dur && now - shake.t0 < shake.dur) { const k = 1 - (now - shake.t0) / shake.dur; ox += Math.round((vrand() - 0.5) * shake.mag * 2 * k); oy += Math.round((vrand() - 0.5) * shake.mag * 2 * k); }
    view.ox = ox; view.oy = oy;
    const x0 = Math.max(0, Math.floor(-ox / ts) - 1), x1 = Math.min(W - 1, Math.ceil((cw - ox) / ts)), y0 = Math.max(0, Math.floor(-oy / ts) - 1), y1 = Math.min(H - 1, Math.ceil((ch - oy) / ts));
    const style = fl.style; const frame = opts.rm ? 0 : Math.floor(now / 700) % 2; const light = s._light;
    const P = (x, y) => [ox + x * ts, oy + y * ts];
    // tiles
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (!exp[i] && !U.diag.reveal) continue; const t = fl.t[i];
      let key = tileSpriteKey(fl, x, y, t); if (key === 'water' || key === 'lava') key += frame;
      ctx.drawImage(Art.tile(style, key, variant(x, y), Sz), ox + x * ts, oy + y * ts, ts, ts);
    }
    // animated flames on visible braziers & fire fields
    const flame = (x, y, scale, col1, col2) => {
      const sx = ox + x * ts + ts / 2, sy = oy + y * ts + ts * 0.42;
      const fl2 = opts.rm ? 1 : 0.85 + 0.15 * Math.sin(now / 90 + x * 3 + y * 7) + 0.08 * Math.sin(now / 37 + x);
      const h = ts * 0.5 * scale * fl2, w = ts * 0.22 * scale;
      const g = ctx.createRadialGradient(sx, sy, 1, sx, sy - h * 0.3, h); g.addColorStop(0, col2); g.addColorStop(1, col1 + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - w, sy); ctx.quadraticCurveTo(sx - w * 0.9, sy - h * 0.6, sx, sy - h); ctx.quadraticCurveTo(sx + w * 0.9, sy - h * 0.6, sx + w, sy); ctx.quadraticCurveTo(sx, sy + w * 0.6, sx - w, sy); ctx.fill();
      ctx.fillStyle = col2; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(sx, sy - h * 0.18, w * 0.45, h * 0.3, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    };
    const cold = style === 'crypt';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (fl.t[i] === T.BRAZIER && (vis[i] || U.diag.reveal)) flame(x, y - 0.12, 1.05, cold ? '#6fb6ff' : '#ff6a1f', cold ? '#d4f0ff' : '#ffe08a'); }
    // fields: fire, gas, smoke
    for (const key of Object.keys(s.fx.fire)) { const i = +key, x = i % W, y = (i - x) / W; if (x < x0 || x > x1 || y < y0 || y > y1 || !(vis[i] || U.diag.reveal)) continue; ctx.fillStyle = '#ff5a1a33'; ctx.fillRect(ox + x * ts, oy + y * ts, ts, ts); flame(x - 0.18, y + 0.15, 0.8, '#ff4a10', '#ffcf5a'); flame(x + 0.2, y + 0.2, 0.7, '#ff4a10', '#ffb347'); }
    const cloud = (map, col, a) => { for (const key of Object.keys(map)) { const i = +key, x = i % W, y = (i - x) / W; if (x < x0 || x > x1 || y < y0 || y > y1 || !exp[i]) continue; if (!(vis[i] || s._los[i] || U.diag.reveal) && col !== '#9aa0aa') continue; const [sx, sy] = P(x, y); const wob = opts.rm ? 0 : Math.sin(now / 400 + i) * ts * 0.06; ctx.fillStyle = col; ctx.globalAlpha = a * Math.min(1, map[key] / 3 + 0.4); ctx.beginPath(); ctx.arc(sx + ts * 0.35 + wob, sy + ts * 0.4, ts * 0.42, 0, 7); ctx.arc(sx + ts * 0.68 - wob, sy + ts * 0.62, ts * 0.38, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } };
    cloud(s.fx.gas, '#8fdc3a', 0.38); cloud(s.fx.smoke, '#9aa0aa', 0.75);
    // traps & items
    for (const tr of s.traps) { const i = tr.y * W + tr.x; if ((tr.hidden && !U.diag.reveal) || !exp[i] || tr.x < x0 || tr.x > x1 || tr.y < y0 || tr.y > y1) continue; ctx.globalAlpha = tr.armed ? 1 : 0.45; ctx.drawImage(Art.trap(tr.k, Sz), ox + tr.x * ts, oy + tr.y * ts, ts, ts); ctx.globalAlpha = 1; }
    const counts = new Map(); for (const it of s.items) { const i = it.y * W + it.x; counts.set(i, (counts.get(i) || 0) + 1); }
    const drawnItem = new Set();
    for (const it of s.items) {
      const i = it.y * W + it.x; if ((!it.seen && !U.diag.reveal) || !exp[i] || drawnItem.has(i)) continue; drawnItem.add(i);
      const [sx, sy] = P(it.x, it.y); const bob = opts.rm ? 0 : Math.sin(now / 500 + i) * ts * 0.03;
      ctx.drawImage(Art.sprite('i_' + it.k, Sz), sx + ts * 0.14, sy + ts * 0.12 + bob, ts * 0.72, ts * 0.72);
      if (it.k === 'key' && vis[i] && !opts.rm) { ctx.strokeStyle = '#ffd24a'; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(now / 250); ctx.lineWidth = 1.5; ctx.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4); ctx.globalAlpha = 1; }
      if (counts.get(i) > 1) { ctx.fillStyle = '#000c'; ctx.fillRect(sx + ts - 12, sy + ts - 11, 11, 10); ctx.fillStyle = '#ffe9c9'; ctx.font = `bold ${Math.max(8, ts * 0.28)}px ${getComputedStyle(document.body).getPropertyValue('--mono')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(counts.get(i), sx + ts - 6.5, sy + ts - 6); }
    }
    // telegraphed attacks (visible danger)
    for (const e of s.enemies) {
      if (e.hp <= 0 || !e.windup) continue; const seen = vis[e.y * W + e.x] || U.diag.ai;
      for (const [wx, wy] of e.windup.tiles) { if (!inb(fl, wx, wy) || (!seen && !vis[wy * W + wx])) continue; const [sx, sy] = P(wx, wy); const a = opts.rm ? 0.45 : 0.3 + 0.22 * Math.sin(now / 110); ctx.fillStyle = `rgba(255,50,40,${a})`; ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2); ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2; ctx.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4); }
    }
    // path preview & targeting
    if (U.preview && U.preview.path.length) {
      ctx.fillStyle = U.preview.safe ? '#ffd27a' : '#ff8a6a';
      for (let k = 0; k < U.preview.path.length; k++) { const [x, y] = U.preview.path[k]; const [sx, sy] = P(x, y); const last = k === U.preview.path.length - 1; ctx.globalAlpha = last ? 0.9 : 0.55; ctx.beginPath(); ctx.arc(sx + ts / 2, sy + ts / 2, last ? ts * 0.16 : ts * 0.08, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (U.target) drawTarget(s, U.target, P);
    // entities
    const list = s.enemies.filter((e) => e.hp > 0 && (vis[e.y * W + e.x] || U.diag.ai)).sort((a, b) => a.y - b.y);
    for (const e of list) drawActor(s, e, 'e_' + e.k, now, P, !vis[e.y * W + e.x]);
    if (p.hp > 0) drawActor(s, p, 'p_' + p.cls, now, P, false);
    // ghosts & particles & projectiles
    ghosts = ghosts.filter((g) => now - g.t0 < g.dur);
    for (const g of ghosts) { const k = (now - g.t0) / g.dur; const [sx, sy] = P(g.x, g.y); ctx.globalAlpha = 1 - k; ctx.drawImage(Art.sprite(g.key, Sz), sx, sy + (opts.rm ? 0 : k * ts * 0.25), ts, ts); ctx.globalAlpha = 1; }
    projs = projs.filter((pj) => { const k = (now - pj.t0) / pj.dur; if (k >= 1) { impactFx(pj); return false; } return true; });
    for (const pj of projs) drawProj(pj, now, P);
    const dts = Math.min(0.05, dt / 1000);
    parts = parts.filter((q) => (q.life -= dt) > 0);
    for (const q of parts) { q.vy += q.grav * dts; q.x += q.vx * dts; q.y += q.vy * dts; q.vx *= 0.96; ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.col; ctx.fillRect(ox + q.x - q.size / 2, oy + q.y - q.size / 2, q.size, q.size); }
    ctx.globalAlpha = 1; stats.parts = parts.length;
    // lighting (low-res map canvas upscaled with smoothing = soft shadows)
    if (!U.diag.reveal) drawLighting(s, ox, oy, now);
    // sound markers (perceived, drawn above darkness)
    for (const snd of s.sounds) { const age = s.turn - snd.turn; const [sx, sy] = P(snd.x, snd.y); const pulse = opts.rm ? 0.5 : (now / 900) % 1; ctx.strokeStyle = '#8fc8ff'; ctx.globalAlpha = (1 - age * 0.3) * (opts.rm ? 0.8 : 1 - pulse); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx + ts / 2, sy + ts / 2, ts * (0.3 + pulse * 0.8), 0, 7); ctx.stroke(); ctx.globalAlpha = Math.max(0.3, 1 - age * 0.3); ctx.fillStyle = '#8fc8ff'; ctx.font = `bold ${ts * 0.45}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', sx + ts / 2, sy + ts / 2); ctx.globalAlpha = 1; }
    rings = rings.filter((r) => now - r.t0 < r.dur);
    for (const r of rings) { const k = (now - r.t0) / r.dur; const [sx, sy] = P(r.x, r.y); ctx.strokeStyle = r.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx + ts / 2, sy + ts / 2, ts * (0.3 + (opts.rm ? 0.5 : k * 1.6)), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    // floating text
    floaters = floaters.filter((f) => now - f.t0 < f.dur);
    for (const f of floaters) { const k = (now - f.t0) / f.dur; const [sx, sy] = P(f.x, f.y); const rise = opts.rm ? 0 : k * ts * 0.7; ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3; ctx.font = `800 ${Math.round(ts * (f.big ? 0.5 : 0.4))}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, sx + ts / 2, sy + ts * 0.15 - rise); ctx.fillStyle = f.col; ctx.fillText(f.text, sx + ts / 2, sy + ts * 0.15 - rise); ctx.globalAlpha = 1; }
    // cursors
    if (U.hover && !U.cursor && inb(fl, U.hover.x, U.hover.y)) { const [sx, sy] = P(U.hover.x, U.hover.y); ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1.5; ctx.strokeRect(sx + 1.5, sy + 1.5, ts - 3, ts - 3); }
    if (U.cursor) { const [sx, sy] = P(U.cursor.x, U.cursor.y); ctx.strokeStyle = U.cursor.col || '#8fc8ff'; ctx.lineWidth = 2.5; const pad = opts.rm ? 1 : 1 + Math.sin(now / 160); ctx.strokeRect(sx + pad, sy + pad, ts - pad * 2, ts - pad * 2); }
    drawDiag(s, U, ox, oy, x0, x1, y0, y1, P);
    stats.frameMs = performance.now() - t0;
  }
  const view = { ox: 0, oy: 0 };
  function drawActor(s, a, key, now, P, hidden) {
    const Sz = Math.round(ts * dpr); const [rx, ry] = rpos(a, now); const sx = view.ox + rx * ts, sy = view.oy + ry * ts;
    const isP = a === s.player; const D = isP ? null : ENEMIES[a.k]; const asleep = !isP && a.state === 'asleep';
    const bob = opts.rm || asleep ? 0 : Math.sin(now / 260 + a.id * 1.7) * ts * 0.025;
    const big = D && (D.boss || a.k === 'brute') ? 1.12 : 1;
    ctx.globalAlpha = hidden ? 0.4 : 1;
    ctx.fillStyle = '#0009'; ctx.beginPath(); ctx.ellipse(sx + ts / 2, sy + ts * 0.86, ts * 0.32 * big, ts * 0.11, 0, 0, 7); ctx.fill();
    if (isP || D.boss) { const g = ctx.createRadialGradient(sx + ts / 2, sy + ts / 2, 1, sx + ts / 2, sy + ts / 2, ts * 0.7); g.addColorStop(0, isP ? '#ffd27a22' : '#ff6a1f33'); g.addColorStop(1, '#0000'); ctx.fillStyle = g; ctx.fillRect(sx - ts * 0.2, sy - ts * 0.2, ts * 1.4, ts * 1.4); }
    const w = ts * big; ctx.drawImage(Art.sprite(key, Sz), sx + (ts - w) / 2, sy + (ts - w) - ts * 0.04 + bob, w, w);
    const h = hurt.get(a.id); if (h && now - h < 160 && !opts.rm) { ctx.globalAlpha = 0.45 * (1 - (now - h) / 160); ctx.fillStyle = '#ff2a2a'; ctx.fillRect(sx + ts * 0.2, sy + ts * 0.15, ts * 0.6, ts * 0.7); ctx.globalAlpha = hidden ? 0.4 : 1; }
    if (asleep) { ctx.fillStyle = '#cfd8ff'; ctx.font = `bold ${ts * 0.3}px system-ui`; ctx.textAlign = 'left'; const zz = opts.rm ? 0 : (now / 700) % 1; ctx.globalAlpha = 0.9 - zz * 0.6; ctx.fillText('z', sx + ts * 0.72, sy + ts * 0.2 - zz * ts * 0.2); ctx.globalAlpha = hidden ? 0.4 : 1; }
    const maxHp = isP ? pstats(a).maxHp : a.maxHp;
    if (!isP && (a.hp < maxHp || D.boss)) { const bw = ts * 0.8, bh = opts.hc ? 5 : 3.5; ctx.fillStyle = '#000c'; ctx.fillRect(sx + ts * 0.1 - 1, sy - 2, bw + 2, bh + 2); ctx.fillStyle = D.boss ? '#ffb347' : '#e0503f'; ctx.fillRect(sx + ts * 0.1, sy - 1, bw * Math.max(0, a.hp / maxHp), bh); }
    if (a.st.length) { let k = 0; for (const st of a.st) { const col = st.k === 'poison' ? '#8fdc3a' : st.k === 'burning' ? '#ff8a3d' : st.k === 'bleed' ? '#e0304f' : st.k === 'stun' ? '#ffe066' : st.k === 'root' ? '#c9b48a' : st.k === 'slow' ? '#6fb6ff' : st.k === 'haste' ? '#f2f2f2' : st.k === 'shield' ? '#8fc8ff' : '#8fdc7a'; ctx.fillStyle = '#000'; ctx.fillRect(sx + 2 + k * 7, sy + ts - 7, 6, 6); ctx.fillStyle = col; ctx.fillRect(sx + 3 + k * 7, sy + ts - 6, 4, 4); k++; } }
    if (!isP && opts.intent && !hidden) drawIntent(s, a, sx, sy, now);
    if (!isP && hidden) { ctx.fillStyle = '#8fc8ff'; ctx.font = `${Math.max(8, ts * 0.24)}px monospace`; ctx.textAlign = 'center'; ctx.fillText('hidden', sx + ts / 2, sy + ts + 8); }
    ctx.globalAlpha = 1;
  }
  function drawIntent(s, e, sx, sy, now) {
    const it = e.intent || {}; const p = s.player; let icon = null, col = '#ffc15e';
    if (e.windup) { icon = '!!'; col = '#ff4a3a'; }
    else if (e.state === 'fleeing') { icon = '↩'; col = '#8fc8ff'; }
    else if (e.state === 'hunting') {
      const D = ENEMIES[e.k]; const d = cheb(e.x, e.y, p.x, p.y);
      if (d === 1) { icon = '⚔'; col = '#ff6b5e'; } else if ((D.ai === 'ranged' || D.ai === 'summoner' || (D.ai === 'boss' && e.phase2)) && d <= (D.range || 0)) { icon = '➶'; col = '#ffb347'; } else if (D.ai === 'artillery') { icon = e.cd.spit ? '…' : '☁'; col = '#9ad14b'; } else if (it.t === 'regroup') { icon = '⋯'; col = '#d98f4e'; } else { icon = '»'; col = '#ffc15e'; }
    } else if (e.state === 'investigating' || e.state === 'searching') { icon = '?'; col = '#ffe066'; }
    else if (e.state === 'guarding') { icon = '⛨'; col = '#d8c27a'; }
    if (!icon) return;
    const bx = sx + ts * 0.78, by = sy + ts * 0.08; const r = Math.max(6, ts * 0.2);
    ctx.fillStyle = '#0b0810e0'; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = col; ctx.font = `bold ${Math.round(r * 1.25)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, bx, by + 0.5);
  }
  function drawTarget(s, tg, P) {
    const p = s.player; const col = tg.valid ? '#ffd27a' : '#ff5a4a';
    if (tg.path && tg.path.length) { ctx.strokeStyle = col; ctx.globalAlpha = 0.8; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); const [ax, ay] = P(p.x, p.y); ctx.moveTo(ax + ts / 2, ay + ts / 2); for (const [x, y] of tg.path) { const [bx, by] = P(x, y); ctx.lineTo(bx + ts / 2, by + ts / 2); } ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if (tg.area) for (const [x, y] of tg.area) { const [sx, sy] = P(x, y); ctx.fillStyle = tg.valid ? '#ff8a3d33' : '#ff5a4a22'; ctx.fillRect(sx, sy, ts, ts); }
    if (tg.hit) { const [sx, sy] = P(tg.hit.x, tg.hit.y); ctx.strokeStyle = '#ff6b5e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx + ts / 2, sy + ts / 2, ts * 0.46, 0, 7); ctx.stroke(); }
  }
  function drawProj(pj, now, P) {
    const k = Math.min(1, (now - pj.t0) / pj.dur);
    const x = pj.x0 + (pj.x1 - pj.x0) * k, y = pj.y0 + (pj.y1 - pj.y0) * k; const [sx, sy] = P(x, y); const lift = (pj.kind === 'spore' || pj.kind === 'smoke') ? Math.sin(Math.PI * k) * ts * 0.8 : 0;
    const cx = sx + ts / 2, cy = sy + ts / 2 - lift;
    const col = { arrow: '#e8dcc0', fire: '#ff9a3d', ember: '#ff8a3d', spore: '#9ad14b', smoke: '#9aa0aa', knife: '#dfe6ee', lance: '#c9a2ff' }[pj.kind] || '#fff';
    const [ax, ay] = P(pj.x0, pj.y0); const ang = Math.atan2(pj.y1 - pj.y0, pj.x1 - pj.x0);
    ctx.strokeStyle = col; ctx.lineWidth = pj.kind === 'lance' ? 3 : 2; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(ax + ts / 2 + (cx - ax - ts / 2) * 0.6, ay + ts / 2 + (cy - ay - ts / 2) * 0.6); ctx.lineTo(cx, cy); ctx.stroke(); ctx.globalAlpha = 1;
    if (pj.kind === 'arrow' || pj.kind === 'knife') { ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.fillStyle = col; ctx.fillRect(-ts * 0.3, -1, ts * 0.45, 2); ctx.beginPath(); ctx.moveTo(ts * 0.2, -3); ctx.lineTo(ts * 0.3, 0); ctx.lineTo(ts * 0.2, 3); ctx.fill(); ctx.restore(); }
    else { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 0.3); g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.3, 0, 7); ctx.fill(); }
  }
  function impactFx(pj) {
    const c = { arrow: '#e8dcc0', fire: '#ff9a3d', ember: '#ff8a3d', spore: '#9ad14b', smoke: '#c0c4cc', knife: '#dfe6ee', lance: '#c9a2ff' }[pj.kind] || '#fff';
    burst(pj.x1, pj.y1, pj.kind === 'fire' || pj.kind === 'spore' ? 14 : 6, c, 70, 450, 40);
  }
  function drawLighting(s, ox, oy, now) {
    const fl = s.floor, W = fl.w, H = fl.h, N = W * H; const p = s.player;
    if (!lightCv || lastW !== W || lastH !== H) { lightCv = document.createElement('canvas'); lightCv.width = W; lightCv.height = H; lightCtx = lightCv.getContext('2d'); lightImg = lightCtx.createImageData(W, H); tintCv = document.createElement('canvas'); tintCv.width = W; tintCv.height = H; tintCtx = tintCv.getContext('2d'); tintImg = tintCtx.createImageData(W, H); lastW = W; lastH = H; }
    const L = lightImg.data, Tn = tintImg.data; const vis = s._vis, exp = fl.explored, lt = s._light; const sight = STYLES[fl.style].sight; const tint = (PALETTES[fl.style] || PALETTES.fortress).tint;
    const flick = opts.rm ? 1 : 0.94 + 0.06 * Math.sin(now / 120);
    const remA = opts.hc ? 120 : 168;
    for (let i = 0; i < N; i++) {
      const j = i * 4; const x = i % W, y = (i - x) / W;
      if (!exp[i]) { L[j] = 7; L[j + 1] = 5; L[j + 2] = 10; L[j + 3] = 255; Tn[j + 3] = 0; continue; }
      if (!vis[i]) { L[j] = 6; L[j + 1] = 5; L[j + 2] = 18; L[j + 3] = remA; Tn[j + 3] = 0; continue; }
      const d = Math.hypot(x - p.x, y - p.y); const torch = clamp(1 - d / (sight + 2.5), 0, 1) * flick; const st = lt[i] + (s.fx.fire[i] ? 0.8 : 0);
      const b = clamp(0.28 + torch * 0.8 + st * 0.75, 0, 1); L[j] = 4; L[j + 1] = 2; L[j + 2] = 10; L[j + 3] = Math.round((1 - b) * 205);
      const tv = clamp(st * flick, 0, 1); Tn[j] = tint[0]; Tn[j + 1] = tint[1]; Tn[j + 2] = tint[2]; Tn[j + 3] = Math.round(tv * 255);
    }
    lightCtx.putImageData(lightImg, 0, 0); tintCtx.putImageData(tintImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = opts.hc ? 0.12 : 0.2; ctx.drawImage(tintCv, ox, oy, W * ts, H * ts);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(lightCv, ox, oy, W * ts, H * ts);
    ctx.imageSmoothingEnabled = false;
    // hard black outside the map bounds
    ctx.fillStyle = '#07050a'; ctx.fillRect(0, 0, cw, Math.max(0, oy)); ctx.fillRect(0, oy + H * ts, cw, ch); ctx.fillRect(0, 0, Math.max(0, ox), ch); ctx.fillRect(ox + W * ts, 0, cw, ch);
  }
  function drawDiag(s, U, ox, oy, x0, x1, y0, y1, P) {
    const D = U.diag; if (!D.any) return; const fl = s.floor, W = fl.w; const p = s.player;
    ctx.font = `${Math.max(8, Math.round(ts * 0.3))}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (D.walk) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const t = fl.t[y * W + x]; const [sx, sy] = P(x, y); let c = null; if (TILES[t].hazard) c = '#ff503c66'; else if (t === T.LOCKED) c = '#b06aff66'; else if (TILES[t].door) c = '#50a0ff55'; else if (tWalk(t)) c = '#50dc7838'; else if (t === T.CHASM) c = '#ff503c33'; if (c) { ctx.fillStyle = c; ctx.fillRect(sx, sy, ts, ts); } }
    if (D.regions) {
      const key = s.floorN + '|' + s.turn + '|' + fl.t.reduce((a, v, i) => (v === T.DOOR || v === T.LOCKED || v === T.GRASS ? a + i * v : a), 0);
      if (regionCache.key !== key) { regionCache = { key, data: regionsOf(fl, connPass(fl)) }; }
      const R = regionCache.data;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const id = R.id[y * W + x]; if (id < 0) continue; const [sx, sy] = P(x, y); ctx.fillStyle = `hsla(${(140 + id * 97) % 360},80%,55%,0.3)`; ctx.fillRect(sx, sy, ts, ts); }
    }
    if (D.fov) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; const [sx, sy] = P(x, y); if (s._vis[i]) { ctx.fillStyle = '#ffe06622'; ctx.fillRect(sx, sy, ts, ts); } else if (s._los[i]) { ctx.fillStyle = '#6fb6ff30'; ctx.fillRect(sx, sy, ts, ts); } if (s._light[i] > 0.05) { ctx.fillStyle = `rgba(255,140,40,${s._light[i] * 0.35})`; ctx.fillRect(sx + ts * 0.35, sy + ts * 0.35, ts * 0.3, ts * 0.3); } }
    if (D.dist) {
      const key = `${s.floorN}|${p.x},${p.y}|${s.turn}`;
      if (distCache.key !== key) distCache = { key, data: dmap(fl, [[p.x, p.y]], walkCost(s, { doors: true, gasImm: false })) };
      const dm = distCache.data;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = dm[y * W + x]; if (v >= INF) continue; const [sx, sy] = P(x, y); ctx.fillStyle = `hsla(${Math.max(0, 200 - v * 6)},80%,55%,0.22)`; ctx.fillRect(sx, sy, ts, ts); if (ts >= 20) { ctx.fillStyle = '#fff'; ctx.fillText(Math.round(v), sx + ts / 2, sy + ts / 2); } }
    }
    if (D.occ) { const seen = new Map(); for (const a of [p, ...s.enemies.filter((e) => e.hp > 0)]) { const k = a.y * W + a.x; seen.set(k, (seen.get(k) || 0) + 1); } for (const [k, n] of seen) { const x = k % W, y = (k - x) / W; const [sx, sy] = P(x, y); ctx.strokeStyle = n > 1 ? '#ff2020' : '#00e0ff'; ctx.lineWidth = n > 1 ? 3 : 1.5; ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2); } }
    if (D.ai) for (const e of s.enemies) {
      if (e.hp <= 0) continue; const [sx, sy] = P(e.x, e.y); const it = e.intent || {};
      if (it.x != null) { const [tx2, ty2] = P(it.x, it.y); ctx.strokeStyle = it.t === 'attack' || it.t === 'windup' ? '#ff5a4a' : it.t === 'flee' || it.t === 'retreat' ? '#6fb6ff' : '#ffd27a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx + ts / 2, sy + ts / 2); ctx.lineTo(tx2 + ts / 2, ty2 + ts / 2); ctx.stroke(); ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(tx2 + ts / 2, ty2 + ts / 2, 3, 0, 7); ctx.fill(); }
      if (e.last) { const [lx, ly] = P(e.last.x, e.last.y); ctx.strokeStyle = '#ff9aff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx + 6, ly + 6); ctx.lineTo(lx + ts - 6, ly + ts - 6); ctx.moveTo(lx + ts - 6, ly + 6); ctx.lineTo(lx + 6, ly + ts - 6); ctx.stroke(); }
      if (e.post) { const [qx, qy] = P(e.post.x, e.post.y); ctx.strokeStyle = '#d8c27a'; ctx.strokeRect(qx + 4, qy + 4, ts - 8, ts - 8); }
      const label = `${e.state}/${it.t || '-'}${e.sees ? ' 👁' : ''}`; ctx.font = `${Math.max(8, Math.round(ts * 0.26))}px monospace`; const w = ctx.measureText(label).width + 6; ctx.fillStyle = '#000c'; ctx.fillRect(sx + ts / 2 - w / 2, sy - ts * 0.42, w, ts * 0.32); ctx.fillStyle = '#9fe3ff'; ctx.fillText(label, sx + ts / 2, sy - ts * 0.26);
    }
  }
  // ------------------------------------------------------ minimap
  function drawMini(s, U) {
    const fl = s.floor, W = fl.w, H = fl.h; const narrow = window.innerWidth <= 900; const sc = Math.max(narrow ? 1.5 : 2, Math.min(4, Math.floor(Math.min((narrow ? 118 : 190) / W, (narrow ? 80 : 120) / H) * 2) / 2));
    const cssW = W * sc, cssH = H * sc; if (mini.width !== Math.round(cssW * dpr) || mini.height !== Math.round(cssH * dpr)) { mini.width = Math.round(cssW * dpr); mini.height = Math.round(cssH * dpr); mini.style.width = cssW + 'px'; mini.style.height = cssH + 'px'; }
    if (!miniCv || miniCv.width !== W || miniCv.height !== H) { miniCv = document.createElement('canvas'); miniCv.width = W; miniCv.height = H; miniCtx = miniCv.getContext('2d'); miniImg = miniCtx.createImageData(W, H); }
    const d = miniImg.data; ensureVision(s); const vis = s._vis, exp = fl.explored;
    for (let i = 0; i < W * H; i++) {
      const j = i * 4; if (!exp[i]) { d[j + 3] = 0; continue; } const t = fl.t[i]; let c;
      if (t === T.WALL || t === T.PILLAR) c = [86, 74, 100]; else if (t === T.WATER) c = [44, 100, 130]; else if (t === T.LAVA) c = [220, 90, 30]; else if (t === T.CHASM) c = [10, 8, 16]; else if (TILES[t].door) c = t === T.LOCKED ? [176, 106, 255] : [160, 110, 60]; else if (t === T.DOWN) c = [255, 180, 90]; else if (t === T.GRASS) c = [60, 100, 50]; else if (t === T.CHEST || t === T.SHRINE || t === T.BRAZIER) c = [220, 190, 110]; else c = [46, 38, 56];
      const k = vis[i] ? 1.45 : 1; d[j] = Math.min(255, c[0] * k); d[j + 1] = Math.min(255, c[1] * k); d[j + 2] = Math.min(255, c[2] * k); d[j + 3] = 255;
    }
    const dot = (x, y, c) => { const j = (y * W + x) * 4; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255; };
    for (const it of s.items) if (it.seen && exp[it.y * W + it.x]) dot(it.x, it.y, [255, 214, 110]);
    for (const e of s.enemies) if (e.hp > 0 && vis[e.y * W + e.x]) dot(e.x, e.y, [255, 70, 60]);
    dot(s.player.x, s.player.y, [255, 255, 255]);
    miniCtx.putImageData(miniImg, 0, 0);
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, mini.width, mini.height); mctx.fillStyle = '#05030a'; mctx.fillRect(0, 0, mini.width, mini.height); mctx.imageSmoothingEnabled = false; mctx.drawImage(miniCv, 0, 0, mini.width, mini.height);
    const k = sc * dpr / ts; mctx.strokeStyle = '#ffd27aaa'; mctx.lineWidth = 1; mctx.strokeRect((-view.ox) * k, (-view.oy) * k, cw * k, ch * k);
    mctx.strokeStyle = '#fff'; mctx.lineWidth = Math.max(1, dpr); mctx.strokeRect((s.player.x - 1) * sc * dpr, (s.player.y - 1) * sc * dpr, 3 * sc * dpr, 3 * sc * dpr);
    return sc;
  }
  function screenToTile(clientX, clientY) { const r = cv.getBoundingClientRect(); const x = clientX - r.left - view.ox, y = clientY - r.top - view.oy; return { x: Math.floor(x / ts), y: Math.floor(y / ts) }; }
  function tileToScreen(x, y) { const r = cv.getBoundingClientRect(); return { x: r.left + view.ox + x * ts, y: r.top + view.oy + y * ts, ts }; }
  function portrait(canvas, key) { const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height); c.imageSmoothingEnabled = true; c.drawImage(Art.sprite(key, canvas.width), 0, 0, canvas.width, canvas.height); }
  return { init, resize, setTile, onEvents, draw, drawMini, screenToTile, tileToScreen, reset, opts, animating, finishAll, stats, portrait, get ts() { return ts; }, get dpr() { return dpr; }, view };
})();
