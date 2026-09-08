
/* =====================================================================
   RENDERER — canvas 2D, dynamic lighting, cones, overlays
   ===================================================================== */
const Render = {
  cv: null, ctx: null, light: null, lctx: null, dpr: 1,
  cam: { x: 0, y: 0, scale: 1, init: false },
  mmPre: null, mmScale: 2,
  vign: null, fps: 60, frameTimes: [], lastT: 0,
  particles: [], dustT: 0, shake: 0,
  diag: { nav: false, state: false, rays: false, sound: false, lkp: false, coll: false, frame: false, light: false },

  init() {
    this.cv = document.getElementById('game');
    this.ctx = this.cv.getContext('2d');
    this.light = document.createElement('canvas'); this.lctx = this.light.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.floor(innerWidth * this.dpr); this.cv.height = Math.floor(innerHeight * this.dpr);
    this.light.width = this.cv.width; this.light.height = this.cv.height;
    this.vign = null;
    const mm = document.getElementById('minimap');
    const w = Math.min(170, Math.floor(innerWidth * 0.24));
    mm.style.width = w + 'px'; mm.style.height = Math.floor(w * 0.72) + 'px';
    mm.width = w * this.dpr; mm.height = Math.floor(w * 0.72) * this.dpr;
  },
  screenToWorld(sim, sx, sy) {
    const cw = this.cv.width / this.dpr, ch = this.cv.height / this.dpr;
    return { x: (sx - cw / 2) / this.cam.scale + this.cam.x, y: (sy - ch / 2) / this.cam.scale + this.cam.y };
  },

  render(sim, dt, reduced) {
    const ctx = this.ctx, cv = this.cv;
    const now = performance.now();
    if (this.lastT) { const ms = now - this.lastT; this.frameTimes.push(ms); if (this.frameTimes.length > 90) this.frameTimes.shift(); this.fps = this.fps * 0.95 + (1000 / Math.max(1, ms)) * 0.05; }
    this.lastT = now;
    const cw = cv.width / this.dpr, ch = cv.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#04060c'; ctx.fillRect(0, 0, cw, ch);
    if (!sim) { this.renderMenuBg(ctx, cw, ch); return; }
    const m = sim.m;
    /* camera */
    const p = sim.player;
    const scale = clamp(Math.min(cw / 1150, ch / 760), 0.62, 1.25);
    this.cam.scale = reduced ? scale : lerp(this.cam.scale || scale, scale, 0.1);
    const vw = cw / this.cam.scale, vh = ch / this.cam.scale;
    let tx = p.x, ty = p.y;
    tx = m.W * TILE < vw ? m.W * TILE / 2 : clamp(tx, vw / 2, m.W * TILE - vw / 2);
    ty = m.H * TILE < vh ? m.H * TILE / 2 : clamp(ty, vh / 2, m.H * TILE - vh / 2);
    if (!this.cam.init || reduced) { this.cam.x = tx; this.cam.y = ty; this.cam.init = true; }
    else { this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 6)); this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 6)); }
    this.shake = Math.max(0, this.shake - dt * 3);
    if (sim.state === 'lost') this.shake = Math.min(1, this.shake + dt * 2);
    const shx = reduced ? 0 : (Math.random() - 0.5) * this.shake * 14, shy = reduced ? 0 : (Math.random() - 0.5) * this.shake * 14;

    ctx.save();
    ctx.translate(cw / 2 + shx, ch / 2 + shy);
    ctx.scale(this.cam.scale, this.cam.scale);
    ctx.translate(-this.cam.x, -this.cam.y);
    const x0 = Math.max(0, Math.floor((this.cam.x - vw / 2) / TILE) - 1), x1 = Math.min(m.W - 1, Math.ceil((this.cam.x + vw / 2) / TILE) + 1);
    const y0 = Math.max(0, Math.floor((this.cam.y - vh / 2) / TILE) - 1), y1 = Math.min(m.H - 1, Math.ceil((this.cam.y + vh / 2) / TILE) + 1);

    /* floor */
    for (let ty2 = y0; ty2 <= y1; ty2++) for (let tx2 = x0; tx2 <= x1; tx2++) {
      const i = ty2 * m.W + tx2;
      if (m.grid[i] === 1) {
        const sh = m.shade[i];
        const r = sim.m.roomAt[i];
        const base = r >= 0 ? 34 : 26;
        const v = base + (sh % 7);
        ctx.fillStyle = `rgb(${v - 6},${v + 2},${v + 14})`;
        ctx.fillRect(tx2 * TILE, ty2 * TILE, TILE + 0.5, TILE + 0.5);
        if ((sh & 31) === 0) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(tx2 * TILE + 6, ty2 * TILE + 6, 4, 4); }
      }
    }
    /* restricted zones */
    for (const r of m.rooms) {
      if (!m.restricted.has(r.id)) continue;
      ctx.fillStyle = 'rgba(255,70,80,0.05)';
      ctx.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, r.h * TILE);
      ctx.strokeStyle = 'rgba(255,90,90,0.28)'; ctx.setLineDash([7, 6]); ctx.lineWidth = 1.4;
      ctx.strokeRect(r.x * TILE + 2, r.y * TILE + 2, r.w * TILE - 4, r.h * TILE - 4);
      ctx.setLineDash([]);
    }
    /* walls */
    for (let ty2 = y0; ty2 <= y1; ty2++) for (let tx2 = x0; tx2 <= x1; tx2++) {
      const i = ty2 * m.W + tx2;
      if (m.grid[i] === 0) {
        ctx.fillStyle = '#131b30';
        ctx.fillRect(tx2 * TILE - 0.5, ty2 * TILE - 0.5, TILE + 1, TILE + 1);
        ctx.fillStyle = 'rgba(120,150,210,0.07)';
        ctx.fillRect(tx2 * TILE, ty2 * TILE, TILE, 3);
      }
    }
    /* entry + extraction markers */
    this.drawMarker(ctx, (m.entry.tx + 0.5) * TILE, (m.entry.ty + 0.5) * TILE, '#59a0ff', 'ENTRY', sim.time);
    this.drawMarker(ctx, (m.extract.tx + 0.5) * TILE, (m.extract.ty + 0.5) * TILE, '#6fe3a0', 'EXFIL', sim.time);

    /* props */
    for (let ty2 = y0; ty2 <= y1; ty2++) for (let tx2 = x0; tx2 <= x1; tx2++) {
      const i = ty2 * m.W + tx2, t = m.propType[i];
      if (!t) continue;
      const px = tx2 * TILE, py = ty2 * TILE;
      if (t === 1) { // crate
        ctx.fillStyle = '#4a3b26'; ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = '#6b5535'; ctx.lineWidth = 2; ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.beginPath(); ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + TILE - 4, py + TILE - 4); ctx.moveTo(px + TILE - 4, py + 4); ctx.lineTo(px + 4, py + TILE - 4); ctx.stroke();
      } else if (t === 2) { // table (low)
        ctx.fillStyle = '#333f5e'; ctx.beginPath(); ctx.roundRect(px + 2, py + 7, TILE - 4, TILE - 14, 3); ctx.fill();
        ctx.fillStyle = 'rgba(160,190,255,0.12)'; ctx.fillRect(px + 5, py + 10, TILE - 10, 3);
      } else { // pillar
        ctx.fillStyle = '#0e1526'; ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 11, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2c3a60'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    /* terminals */
    for (const T of sim.terminals) {
      ctx.save(); ctx.translate(T.x, T.y - 6);
      ctx.fillStyle = '#10192e'; ctx.fillRect(-11, -9, 22, 16);
      ctx.fillStyle = T.used ? '#123f2a' : (sim.sysOffline ? '#123f2a' : '#0d3a4e');
      ctx.fillRect(-8, -6, 16, 10);
      ctx.fillStyle = T.used || sim.sysOffline ? '#4df0a0' : '#59e0ff';
      if (!T.used && !sim.sysOffline && Math.sin(sim.time * 6 + T.id) > 0) ctx.fillRect(-6, -4, 3, 3);
      if (T.used || sim.sysOffline) { ctx.font = '7px monospace'; ctx.fillText('OFF', -6, 2); }
      ctx.fillStyle = '#22304f'; ctx.fillRect(-3, 7, 6, 3);
      ctx.restore();
    }
    /* loot */
    for (const L of sim.loot) {
      if (L.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(sim.time * 3 + L.id * 2);
      if (L.type === 'intel') {
        ctx.strokeStyle = `rgba(255,215,94,${0.35 * pulse})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(L.x, L.y, 11 + 3 * pulse, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#ffd75e'; ctx.fillRect(L.x - 7, L.y - 5, 14, 10);
        ctx.fillStyle = '#7a5c14'; ctx.fillRect(L.x - 7, L.y - 1, 14, 2);
      } else {
        ctx.strokeStyle = `rgba(89,224,255,${0.3 * pulse})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(L.x, L.y, 8 + 2 * pulse, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#59e0ff';
        ctx.beginPath(); ctx.moveTo(L.x, L.y - 6); ctx.lineTo(L.x + 5, L.y); ctx.lineTo(L.x, L.y + 6); ctx.lineTo(L.x - 5, L.y); ctx.closePath(); ctx.fill();
      }
    }
    /* doors */
    for (const dr of sim.doors) {
      const horiz = dr.axis === 'h';
      const w = horiz ? (dr.maxx - dr.minx + 1) * TILE : 10;
      const h = horiz ? 10 : (dr.maxy - dr.miny + 1) * TILE;
      const bx = dr.minx * TILE, by = dr.miny * TILE;
      const slide = dr.open * ((horiz ? w : h) - 12);
      ctx.fillStyle = '#39476e';
      const elecOpen = dr.elec && (dr.empT > 0 || sim.sysOffline);
      if (horiz) ctx.fillRect(bx + slide, by + TILE / 2 - 5, w - 12, 10);
      else ctx.fillRect(bx + TILE / 2 - 5, by + slide, 10, h - 12);
      ctx.fillStyle = dr.locked && !elecOpen ? (dr.elec ? '#ff9a3e' : '#ff5d5d') : elecOpen ? '#6fe3a0' : '#59e0ff';
      if (horiz) ctx.fillRect(bx + slide + 3, by + TILE / 2 - 2, 4, 4);
      else ctx.fillRect(bx + TILE / 2 - 2, by + slide + 3, 4, 4);
      if (dr.locked && !elecOpen) {
        ctx.strokeStyle = 'rgba(255,93,93,0.5)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 1, by + 1, (dr.maxx - dr.minx + 1) * TILE - 2, (dr.maxy - dr.miny + 1) * TILE - 2);
      }
    }
    /* vision cones (under entities) */
    for (const g of sim.guards) this.drawCone(ctx, sim, g.x, g.y, g.angle, g.fov, g.viewDist, this.coneColor(g), 22);
    for (const c of sim.cameras) if (c.on) this.drawCone(ctx, sim, c.x, c.y, c.ang, c.arc * 2, c.range, this.camColor(c), 15);
    /* smoke */
    for (const s of sim.smokes) {
      const a = s.age > s.life - 1.2 ? Math.max(0, (s.life - s.age) / 1.2) : 1;
      for (let k = 0; k < 5; k++) {
        const ang = k * TAU / 5 + s.x * 0.01;
        const rr = s.r * 0.62;
        ctx.fillStyle = `rgba(190,200,215,${0.16 * a})`;
        ctx.beginPath(); ctx.arc(s.x + Math.cos(ang) * rr * 0.5, s.y + Math.sin(ang) * rr * 0.5, s.r * 0.62, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = `rgba(210,220,235,${0.1 * a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.8, 0, TAU); ctx.fill();
    }
    /* noise emitters + projectiles */
    for (const e of sim.emitters) {
      ctx.fillStyle = Math.sin(sim.time * 14) > 0 ? '#ffd75e' : '#8a6d1d';
      ctx.beginPath(); ctx.arc(e.x, e.y, 4, 0, TAU); ctx.fill();
    }
    for (const pr of sim.projectiles) {
      const h = Math.sin(Math.PI * clamp(pr.trav / pr.dist, 0, 1)) * 22;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(pr.x, pr.y, 4, 2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pr.key === 'smoke' ? '#b9c4d6' : '#ffd75e';
      ctx.beginPath(); ctx.arc(pr.x, pr.y - h, 4, 0, TAU); ctx.fill();
    }
    /* entities */
    for (const g of sim.guards) this.drawGuard(ctx, sim, g, reduced);
    this.drawPlayer(ctx, sim, reduced);
    /* sound rings */
    for (const s of sim.sounds) {
      const t = s.age / s.life;
      const r = s.r0 * (1 - Math.pow(1 - t, 2));
      const col = s.type === 'noise' ? '255,215,94' : s.type === 'emp' ? '140,220,255' : s.type === 'door' ? '160,190,255' : '230,235,250';
      ctx.strokeStyle = `rgba(${col},${0.42 * (1 - t)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(2, r), 0, TAU); ctx.stroke();
    }
    /* emp */
    if (sim.empFx) {
      const t = sim.empFx.age / 0.6;
      ctx.strokeStyle = `rgba(140,220,255,${0.7 * (1 - t)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sim.empFx.x, sim.empFx.y, 190 * t, 0, TAU); ctx.stroke();
    }
    /* particles */
    this.updateParticles(ctx, dt);

    /* darkness / lighting */
    this.drawLighting(sim, reduced, cw, ch, shx, shy);

    /* above-darkness: interaction target ring + guard status icons */
    if (p.target) {
      ctx.strokeStyle = 'rgba(255,215,94,0.85)'; ctx.lineWidth = 1.6;
      const r = 16 + Math.sin(sim.time * 6) * 2;
      ctx.beginPath(); ctx.arc(p.target.x, p.target.y, r, 0, TAU); ctx.stroke();
    }
    for (const g of sim.guards) {
      const label = g.state === 'SUSPICIOUS' ? '?' : g.state === 'ALERT' ? '!' : g.state === 'INVESTIGATE' || g.state === 'SEARCH' ? '?' : '';
      if (g.delayT > 0 || label === '?') {
        ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = '#ffb14e';
        ctx.fillText('?', g.x, g.y - 20);
      }
      if (label === '!') {
        const blink = Math.sin(sim.time * 10) > -0.3;
        if (blink) { ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff5d5d'; ctx.fillText('!', g.x, g.y - 20); }
      }
      // suspicion arc
      if (g.sus > 0.04 && g.state !== 'ALERT') {
        ctx.strokeStyle = 'rgba(10,14,24,0.8)'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.arc(g.x, g.y - 13, 8, -Math.PI / 2, -Math.PI / 2 + TAU); ctx.stroke();
        ctx.strokeStyle = g.sus > 0.6 ? '#ff5d5d' : '#ffb14e'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.arc(g.x, g.y - 13, 8, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(g.sus, 0, 1)); ctx.stroke();
      }
    }
    /* diagnostic overlays */
    this.drawDiag(ctx, sim, x0, y0, x1, y1);
    ctx.restore();

    /* vignette + alert edge */
    if (!this.vign) {
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.36, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(2,3,8,0.55)');
      this.vign = g;
    }
    ctx.fillStyle = this.vign; ctx.fillRect(0, 0, cw, ch);
    const danger = Math.max(sim.spottedT > 0 ? 1 : 0, sim.alarmT > 0 ? 0.8 : 0, (sim.alert - 1) * 0.3);
    if (danger > 0.01) {
      const a = reduced ? danger * 0.35 : danger * (0.3 + 0.2 * Math.sin(now / 130));
      const g2 = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
      g2.addColorStop(0, 'rgba(255,40,40,0)'); g2.addColorStop(1, `rgba(255,40,40,${clamp(a, 0, 0.6)})`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, cw, ch);
    }
    if (this.diag.frame) this.drawFrameGraph(ctx, cw, ch);
    this.drawMinimap(sim);
  },

  renderMenuBg(ctx, cw, ch) {
    ctx.fillStyle = 'rgba(89,224,255,0.03)';
    const t = performance.now() / 1000;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + t * 12 * (1 + (i % 3))) % cw, y = (i * 61) % ch;
      ctx.fillRect(x, y, 2, 2);
    }
  },

  coneColor(g) {
    if (g.state === 'ALERT') return 'rgba(255,80,80,';
    if (g.state === 'SUSPICIOUS' || g.state === 'INVESTIGATE' || g.state === 'SEARCH') return 'rgba(255,177,78,';
    return 'rgba(200,225,255,';
  },
  camColor(c) { return c.sus > 0.5 ? 'rgba(255,150,90,' : c.sus > 0.1 ? 'rgba(255,215,120,' : 'rgba(120,235,255,'; },

  drawCone(ctx, sim, x, y, ang, fov, range, colStr, rays) {
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k <= rays; k++) {
      const a = ang - fov / 2 + fov * k / rays;
      const hit = castRay(sim, x, y, a, range, { mode: 'sight' });
      ctx.lineTo(hit.x, hit.y);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(x, y, 8, x, y, range);
    grad.addColorStop(0, colStr + '0.30)');
    grad.addColorStop(0.75, colStr + '0.12)');
    grad.addColorStop(1, colStr + '0.02)');
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = colStr + '0.25)'; ctx.lineWidth = 1; ctx.stroke();
  },

  drawGuard(ctx, sim, g, reduced) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y + 5, 9, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a3552';
    ctx.beginPath(); ctx.arc(g.x, g.y, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = g.state === 'ALERT' ? '#ff5d5d' : '#4c5f8f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#c9d6f2'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(g.x + Math.cos(g.angle) * 4, g.y + Math.sin(g.angle) * 4);
    ctx.lineTo(g.x + Math.cos(g.angle) * 11, g.y + Math.sin(g.angle) * 11); ctx.stroke();
  },

  drawPlayer(ctx, sim, reduced) {
    const p = sim.player;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 5, 9, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#101a30';
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.fill();
    ctx.strokeStyle = p.inRestricted ? '#ff8080' : '#ffd75e'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4);
    ctx.lineTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12); ctx.stroke();
    if (p.act) {
      ctx.strokeStyle = 'rgba(20,26,44,0.9)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, TAU); ctx.stroke();
      ctx.strokeStyle = p.act.type === 'hack' ? '#59e0ff' : '#ffd75e'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.act.t / p.act.need, 0, 1)); ctx.stroke();
    }
    if (p.extractT > 0) {
      ctx.strokeStyle = '#6fe3a0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p.extractT / 0.9, 0, 1)); ctx.stroke();
    }
    if (p.running && p.moving) {
      this.dustT -= 1 / 60;
      if (this.dustT <= 0) {
        this.dustT = 0.06;
        this.particles.push({ x: p.x - Math.cos(p.angle) * 6, y: p.y - Math.sin(p.angle) * 6, vx: 0, vy: 0, age: 0, life: 0.4, r: 3, col: '180,190,210' });
      }
    }
  },

  drawMarker(ctx, x, y, col, label, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 14 + pulse * 3, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.25; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = col;
    ctx.fillText(label, x, y - 20);
  },

  drawLighting(sim, reduced, cw, ch, shx, shy) {
    const lc = this.lctx;
    lc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = 'rgba(3,5,11,0.78)';
    lc.fillRect(0, 0, cw, ch);
    lc.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, r, a) => {
      const sx = (wx - this.cam.x) * this.cam.scale + cw / 2 + shx, sy = (wy - this.cam.y) * this.cam.scale + ch / 2 + shy;
      const sr = r * this.cam.scale;
      if (sx < -sr || sy < -sr || sx > cw + sr || sy > ch + sr) return;
      const g = lc.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(sx, sy, sr, 0, TAU); lc.fill();
    };
    const t = performance.now() / 1000;
    for (const L of sim.m.lamps) {
      const flick = reduced ? 1 : 1 + 0.05 * Math.sin(t * 7 + L.flick * 9);
      const col = L.col === 'green' ? 'rgba(110,230,160,' : L.col === 'blue' ? 'rgba(90,160,255,' : 'rgba(255,220,150,';
      // colored tint on main canvas
      const sx = (L.tx + 0.5) * TILE, sy = (L.ty + 0.5) * TILE;
      hole(sx, sy, L.r * flick, L.int);
      this.ctx.fillStyle = col + '0.05)';
      this.ctx.beginPath(); this.ctx.arc(sx, sy, L.r * flick * 0.8, 0, TAU); this.ctx.fill();
    }
    hole(sim.player.x, sim.player.y, 165, 0.92);
    const m = sim.m;
    hole((m.extract.tx + 0.5) * TILE, (m.extract.ty + 0.5) * TILE, 80, 0.7);
    hole((m.entry.tx + 0.5) * TILE, (m.entry.ty + 0.5) * TILE, 70, 0.6);
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.light, 0, 0);
    this.ctx.restore();
  },

  updateParticles(ctx, dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pa = this.particles[i];
      pa.age += dt; pa.x += pa.vx * dt; pa.y += pa.vy * dt;
      if (pa.age > pa.life) { this.particles.splice(i, 1); continue; }
      const a = 1 - pa.age / pa.life;
      ctx.fillStyle = `rgba(${pa.col},${0.5 * a})`;
      ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.r * (0.6 + a * 0.6), 0, TAU); ctx.fill();
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  },

  /* -------- diagnostics -------- */
  drawDiag(ctx, sim, x0, y0, x1, y1) {
    const D = this.diag;
    if (D.coll) {
      ctx.fillStyle = 'rgba(255,70,70,0.14)';
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const i = ty * sim.W + tx;
        if (sim.m.grid[i] === 0 || sim.m.propSolid[i]) ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
      ctx.strokeStyle = 'rgba(255,160,80,0.8)';
      for (const dr of sim.doors) ctx.strokeRect(dr.minx * TILE, dr.miny * TILE, (dr.maxx - dr.minx + 1) * TILE, (dr.maxy - dr.miny + 1) * TILE);
    }
    if (D.light) {
      for (const L of sim.m.lamps) {
        ctx.strokeStyle = 'rgba(255,220,120,0.5)';
        ctx.beginPath(); ctx.arc((L.tx + 0.5) * TILE, (L.ty + 0.5) * TILE, L.r, 0, TAU); ctx.stroke();
      }
    }
    if (D.nav) {
      for (const g of sim.guards) {
        for (const wp of g.route) { ctx.fillStyle = 'rgba(89,224,255,0.3)'; ctx.fillRect(wp.x - 3, wp.y - 3, 6, 6); }
        if (g.path) {
          ctx.strokeStyle = 'rgba(89,224,255,0.75)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(g.x, g.y);
          for (let k = g.pi; k < g.path.length; k++) ctx.lineTo(g.path[k].x, g.path[k].y);
          ctx.stroke();
          for (let k = g.pi; k < g.path.length; k++) { ctx.fillStyle = 'rgba(89,224,255,0.8)'; ctx.fillRect(g.path[k].x - 2, g.path[k].y - 2, 4, 4); }
        }
      }
    }
    if (D.rays) {
      ctx.fillStyle = 'rgba(120,255,160,0.85)';
      for (const g of sim.guards) {
        for (let k = 0; k <= 10; k++) {
          const a = g.angle - g.fov / 2 + g.fov * k / 10;
          const hit = castRay(sim, g.x, g.y, a, g.viewDist, { mode: 'sight' });
          ctx.fillRect(hit.x - 1.5, hit.y - 1.5, 3, 3);
        }
      }
      for (const c of sim.cameras) if (c.on) {
        for (let k = 0; k <= 6; k++) {
          const a = c.ang - c.arc + 2 * c.arc * k / 6;
          const hit = castRay(sim, c.x, c.y, a, c.range, { mode: 'sight' });
          ctx.fillRect(hit.x - 1.5, hit.y - 1.5, 3, 3);
        }
      }
    }
    if (D.sound) {
      for (const s of sim.sounds) {
        const t = s.age / s.life;
        ctx.strokeStyle = `rgba(255,215,94,${0.8 * (1 - t)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r0, 0, TAU); ctx.stroke();
        ctx.font = '8px monospace'; ctx.fillStyle = `rgba(255,215,94,${0.9 * (1 - t)})`; ctx.textAlign = 'center';
        ctx.fillText(s.type + ' ' + Math.round(s.r0), s.x, s.y - s.r0 - 3);
      }
    }
    if (D.lkp) {
      for (const g of sim.guards) {
        if (g.lkp) {
          const a = clamp(1 - g.lkpAge / 10, 0.15, 1);
          ctx.strokeStyle = `rgba(255,93,93,${a})`; ctx.lineWidth = 2;
          const s = 6;
          ctx.beginPath();
          ctx.moveTo(g.lkp.x - s, g.lkp.y - s); ctx.lineTo(g.lkp.x + s, g.lkp.y + s);
          ctx.moveTo(g.lkp.x + s, g.lkp.y - s); ctx.lineTo(g.lkp.x - s, g.lkp.y + s);
          ctx.stroke();
        }
        if (g.poi) {
          ctx.strokeStyle = 'rgba(255,177,78,0.5)'; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.poi.x, g.poi.y); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    if (D.state) {
      ctx.font = '9px monospace'; ctx.textAlign = 'center';
      for (const g of sim.guards) {
        ctx.fillStyle = g.state === 'ALERT' ? '#ff5d5d' : g.state === 'SUSPICIOUS' ? '#ffb14e' : '#9fd8ff';
        ctx.fillText(g.state + ' ' + g.sus.toFixed(2), g.x, g.y + 24);
      }
    }
  },

  drawFrameGraph(ctx, cw, ch) {
    const w = 150, h = 44, x = cw - w - 12, y = ch - h - 12;
    ctx.fillStyle = 'rgba(5,8,16,0.75)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#223052'; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    ctx.strokeStyle = 'rgba(111,227,160,0.4)';
    ctx.beginPath(); ctx.moveTo(x, y + h - (16.7 / 40) * h); ctx.lineTo(x + w, y + h - (16.7 / 40) * h); ctx.stroke();
    const ft = this.frameTimes;
    for (let i = 0; i < ft.length; i++) {
      const ms = Math.min(40, ft[i]);
      const bh = (ms / 40) * h;
      ctx.fillStyle = ms > 22 ? 'rgba(255,93,93,0.8)' : ms > 17 ? 'rgba(255,177,78,0.8)' : 'rgba(111,227,160,0.8)';
      ctx.fillRect(x + 2 + i * (w - 4) / 90, y + h - bh, Math.max(1, (w - 4) / 90 - 1), bh);
    }
    ctx.font = '9px monospace'; ctx.fillStyle = '#8fa0c5'; ctx.textAlign = 'left';
    ctx.fillText(this.fps.toFixed(0) + ' fps · ' + (ft.length ? ft[ft.length - 1].toFixed(1) : '0') + ' ms', x + 4, y + 11);
  },

  /* -------- minimap -------- */
  buildMmPre(sim) {
    const s = this.mmScale;
    const c = document.createElement('canvas');
    c.width = sim.W * s; c.height = sim.H * s;
    const x = c.getContext('2d');
    x.fillStyle = '#070b14'; x.fillRect(0, 0, c.width, c.height);
    for (const r of sim.m.rooms) {
      x.fillStyle = sim.m.restricted.has(r.id) ? '#2a1420' : '#151d31';
      x.fillRect(r.x * s, r.y * s, r.w * s, r.h * s);
    }
    x.fillStyle = '#232f4d';
    for (let i = 0; i < sim.W * sim.H; i++) if (sim.m.grid[i] === 1 && sim.m.roomAt[i] < 0) x.fillRect((i % sim.W) * s, ((i / sim.W) | 0) * s, s, s);
    x.fillStyle = '#3a4a75';
    for (let i = 0; i < sim.W * sim.H; i++) if (sim.m.propSolid[i]) x.fillRect((i % sim.W) * s, ((i / sim.W) | 0) * s, s, s);
    this.mmPre = c;
  },
  drawMinimap(sim) {
    const mm = document.getElementById('minimap');
    if (!this.mmPre || this.mmPre._seed !== sim.m.seed + ':' + sim.m.preset + ':' + sim.m.diff) this.buildMmPre(sim), this.mmPre._seed = sim.m.seed + ':' + sim.m.preset + ':' + sim.m.diff;
    const ctx = mm.getContext('2d');
    const W = mm.width, H = mm.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070b14'; ctx.fillRect(0, 0, W, H);
    const s = Math.min(W / sim.W, H / sim.H);
    const ox = (W - sim.W * s) / 2, oy = (H - sim.H * s) / 2;
    ctx.drawImage(this.mmPre, ox, oy, sim.W * s, sim.H * s);
    const P = (tx, ty) => [ox + tx * s, oy + ty * s];
    for (const dr of sim.doors) {
      const [px, py] = P(dr.minx, dr.miny);
      ctx.fillStyle = dr.locked && !(dr.elec && (dr.empT > 0 || sim.sysOffline)) ? '#ff5d5d' : dr.open > 0.5 ? '#59e0ff' : '#8fa0c5';
      ctx.fillRect(px, py, Math.max(2, (dr.maxx - dr.minx + 1) * s), Math.max(2, (dr.maxy - dr.miny + 1) * s));
    }
    for (const T of sim.terminals) { const [px, py] = P(T.x / TILE, T.y / TILE); ctx.fillStyle = T.used || sim.sysOffline ? '#4df0a0' : '#59e0ff'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3); }
    for (const L of sim.loot) {
      if (L.taken) continue;
      const [px, py] = P(L.x / TILE, L.y / TILE);
      if (L.type === 'intel') { ctx.fillStyle = '#ffd75e'; ctx.fillRect(px - 2, py - 2, 4, 4); }
      else { ctx.fillStyle = 'rgba(89,224,255,0.8)'; ctx.fillRect(px - 1, py - 1, 2, 2); }
    }
    for (const c of sim.cameras) { const [px, py] = P(c.x / TILE, c.y / TILE); ctx.fillStyle = c.on ? '#7ce4ff' : '#444d63'; ctx.fillRect(px - 1.5, py - 1.5, 3, 3); }
    for (const g of sim.guards) {
      const [px, py] = P(g.x / TILE, g.y / TILE);
      ctx.fillStyle = g.state === 'ALERT' ? '#ff5d5d' : (g.state === 'INVESTIGATE' || g.state === 'SEARCH' || g.state === 'SUSPICIOUS') ? '#ffb14e' : '#c9d6f2';
      ctx.beginPath(); ctx.arc(px, py, 2.4, 0, TAU); ctx.fill();
    }
    const [ex, ey] = P(sim.m.extract.tx, sim.m.extract.ty);
    ctx.strokeStyle = '#6fe3a0'; ctx.strokeRect(ex - 3, ey - 3, 6, 6);
    const p = sim.player, [px, py] = P(p.x / TILE, p.y / TILE);
    ctx.save(); ctx.translate(px, py); ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath(); ctx.moveTo(0, -4.5); ctx.lineTo(3.4, 3.6); ctx.lineTo(-3.4, 3.6); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (sim.alarmT > 0 && Math.sin(performance.now() / 120) > 0) { ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.strokeRect(1, 1, W - 2, H - 2); }
  }
};
