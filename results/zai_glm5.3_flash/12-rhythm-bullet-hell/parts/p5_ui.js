/* ============================================================
   RENDER — canvas pipeline: layered bg, trails, sprites,
   bloom approximation, HUD, beat lane, audio viz, diagnostics.
   ============================================================ */
const RENDER = {
  cv: null, ctx: null, dprQ: 1,
  view: { scale: 1 },
  tcan: null, tctx: null,             // trail layer (half res)
  bcan: null, bctx: null,             // bloom (1/6 res)
  sprites: new Map(),
  stars: [],
  dropped: 0, droppedWin: 0,
  init() {
    this.cv = $('game'); this.ctx = this.cv.getContext('2d');
    this.tcan = document.createElement('canvas'); this.tcan.width = W / 2; this.tcan.height = H / 2;
    this.tctx = this.tcan.getContext('2d');
    this.bcan = document.createElement('canvas'); this.bcan.width = W / 6 | 0; this.bcan.height = H / 6 | 0;
    this.bctx = this.bcan.getContext('2d');
    for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), tw: Math.random() * TAU });
    this.resize();
  },
  dprCap() { return SETTINGS.quality === 'high' ? 2 : SETTINGS.quality === 'medium' ? 1.5 : 1; },
  resize() {
    const m = 10;
    const aw = Math.max(280, window.innerWidth - m), ah = Math.max(320, window.innerHeight - m);
    let cw = Math.min(aw, ah * W / H), ch = cw * H / W;
    if (ch > ah) { ch = ah; cw = ch * W / H; }
    this.dprQ = Math.min(window.devicePixelRatio || 1, this.dprCap());
    const bw = Math.round(cw * this.dprQ), bh = Math.round(ch * this.dprQ);
    if (this._cw !== cw || this._ch !== ch || this.cv.width !== bw || this.cv.height !== bh) {
      this._cw = cw; this._ch = ch;
      this.cv.style.width = cw + 'px'; this.cv.style.height = ch + 'px';
      this.cv.width = bw; this.cv.height = bh;
    }
    this.view.scale = bw / W;
  },
  sprite(col, r) {
    const key = col + ':' + Math.round(r * 2);
    let s = this.sprites.get(key);
    if (s) return s;
    const R = Math.ceil(r * 2.4), sz = R * 2;
    s = document.createElement('canvas'); s.width = sz; s.height = sz;
    const c = s.getContext('2d');
    const g = c.createRadialGradient(R, R, r * 0.15, R, R, r * 2.3);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.28, COLS[col]);
    g.addColorStop(0.62, COLS[col] + '66');
    g.addColorStop(1, COLS[col] + '00');
    c.fillStyle = g;
    c.fillRect(0, 0, sz, sz);
    this.sprites.set(key, s);
    return s;
  },
  draw(dt, ts) {
    const ctx = this.ctx, t = CLOCK.game(), st = GAME.state;
    this.resize();
    const S = this.view.scale;
    // screen shake
    let ox = 0, oy = 0;
    if (SETTINGS.shake && !SETTINGS.reducedMotion && t - GAME.shakeT < 0.35) {
      const p = GAME.shakePow * (1 - (t - GAME.shakeT) / 0.35);
      ox = (Math.random() - 0.5) * 16 * p; oy = (Math.random() - 0.5) * 16 * p;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#03040a'; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(S, 0, 0, S, ox * S, oy * S);
    const active = st === 'run' || st === 'countdown' || st === 'lab' || st === 'dead' || st === 'victory';
    if (active) {
      this.drawBackground(ctx, t);
      this.drawWarns(ctx, t);
      this.drawTrail(t);
      if (GAME.mode === 'run' && GAME.boss && !GAME.boss.dead) this.drawBoss(ctx, t);
      this.drawBullets(ctx, t);
      this.drawPBullets(ctx, t);
      this.drawPlayer(ctx, t);
      this.drawParticles(ctx, dt);
      this.drawFloaters(ctx, dt);
      this.drawRings(ctx, t);
      this.drawBanner(ctx, t);
      if (st === 'countdown') this.drawCountdown(ctx, t);
      if (t - GAME.flashT < 0.15) {
        ctx.fillStyle = 'rgba(240,250,255,' + (0.4 * (1 - (t - GAME.flashT) / 0.15)).toFixed(3) + ')';
        ctx.fillRect(-ox, -oy, W, H);
      }
      if (!SETTINGS.reducedFlash && t - GAME.hurtT < 0.5 && t - GAME.hurtT > 0) {
        const a = 0.45 * (1 - (t - GAME.hurtT) / 0.5);
        const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.62);
        g.addColorStop(0, 'rgba(255,60,90,0)'); g.addColorStop(1, 'rgba(255,60,90,' + a.toFixed(3) + ')');
        ctx.fillStyle = g; ctx.fillRect(-ox, -oy, W, H);
      }
      this.bloomPass();
      this.drawHud(ctx, t, ox, oy);
    }
  },
  drawBackground(ctx, t) {
    const pulse = AUDIO.ok ? AUDIO.bassEnergy() : (0.25 + 0.2 * Math.sin(t * TAU / MUSIC.beatDur() / 4));
    const ph = GAME.mode === 'run' && GAME.boss ? PHASES[GAME.boss.phase] : PHASES[0];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060a18'); g.addColorStop(0.5, '#04060e'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // stars
    const spd = SETTINGS.reducedMotion ? 0.15 : 1;
    for (const s of this.stars) {
      s.y += (12 + 44 * s.z) * 0.016 * spd; if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
      const a = (0.18 + 0.5 * s.z) * (0.7 + 0.5 * pulse);
      ctx.fillStyle = 'rgba(160,200,255,' + a.toFixed(3) + ')';
      ctx.fillRect(s.x, s.y, s.z > 0.7 ? 2 : 1, s.z > 0.7 ? 2 : 1);
    }
    if (!SETTINGS.contrast) {
      // scrolling floor grid
      const off = SETTINGS.reducedMotion ? 0 : (t * 40) % 48;
      ctx.strokeStyle = 'rgba(90,140,220,' + (0.05 + 0.06 * pulse).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = off; y < H; y += 48) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      for (let x = 30; x < W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      ctx.stroke();
      // phase tint
      ctx.fillStyle = ph.col + '0d';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    }
  },
  drawWarns(ctx, t) {
    for (const w of GAME.warns) {
      if (t > w.t1) continue;
      const a = 0.25 + 0.3 * Math.abs(Math.sin(t * 18));
      ctx.strokeStyle = 'rgba(255,84,112,' + a.toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(w.x, 0); ctx.lineTo(w.x, 46); ctx.stroke();
      ctx.setLineDash([]);
    }
    while (GAME.warns.length && GAME.warns[0].t1 < t - 1) GAME.warns.shift();
  },
  drawTrail(t) {
    const tc = this.tctx;
    tc.setTransform(1, 0, 0, 1, 0, 0);
    if (SETTINGS.reducedMotion) { tc.clearRect(0, 0, this.tcan.width, this.tcan.height); return; }
    tc.globalCompositeOperation = 'destination-out';
    tc.fillStyle = 'rgba(0,0,0,0.14)';
    tc.fillRect(0, 0, this.tcan.width, this.tcan.height);
    tc.globalCompositeOperation = 'lighter';
    const k = 0.5;
    const dense = GAME.bulletCount > 900;                 // thin trails under extreme load
    let stride = 1;
    if (dense) stride = 2;
    for (let i = 0; i < GAME.bullets.length; i += stride) {
      const b = GAME.bullets[i];
      if (!b.on) continue;
      tc.fillStyle = COLS[b.col] + '55';
      tc.beginPath(); tc.arc(b.x * k, b.y * k, b.r * 0.75 * k, 0, TAU); tc.fill();
    }
    for (const pb of GAME.pbullets) if (pb.on) {
      tc.fillStyle = 'rgba(190,240,255,0.5)';
      tc.fillRect(pb.x * k - 1, pb.y * k, 2, 7);
    }
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.globalAlpha = 0.8;
    this.ctx.drawImage(this.tcan, 0, 0, W, H);
    this.ctx.restore();
  },
  drawBoss(ctx, t) {
    const b = GAME.boss; if (!b) return;
    const ph = PHASES[b.phase];
    const beatFrac = ((t / MUSIC.beatDur()) % 1 + 1) % 1;
    const inv = t < b.invulnUntil;
    ctx.save();
    ctx.translate(b.x, b.y);
    // outer glow
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
    g.addColorStop(0, ph.col + '55'); g.addColorStop(1, ph.col + '00');
    ctx.fillStyle = g; ctx.fillRect(-70, -70, 140, 140);
    // rotating hex rings
    const rings = [[46, 0.5, 1], [34, -0.9, 1.4], [24, 1.7, 0.8]];
    for (let i = 0; i < rings.length; i++) {
      const [rad, spd, lw] = rings[i];
      ctx.save(); ctx.rotate(t * spd + i);
      ctx.strokeStyle = ph.col + (inv ? 'cc' : '88');
      ctx.lineWidth = lw * 2.4; this.poly(ctx, rad, 6, beatFrac); ctx.stroke();
      ctx.strokeStyle = ph.col; ctx.lineWidth = lw; this.poly(ctx, rad, 6, beatFrac); ctx.stroke();
      ctx.restore();
    }
    // core
    const pr = 1 + 0.13 * (1 - beatFrac);
    const flash = t - b.hitFlashT < 0.09;
    const cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 17 * pr);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.5, flash ? '#ffffff' : ph.col);
    cg.addColorStop(1, ph.col + '00');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, 17 * pr, 0, TAU); ctx.fill();
    if (inv) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.3 * Math.sin(t * 10)).toFixed(2) + ')';
      ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 58 + 6 * Math.sin(t * 3), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  },
  poly(ctx, r, n, squish) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU, rr = r * (1 + 0.05 * Math.sin(a * 3 + squish * 9));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  },
  drawBullets(ctx, t) {
    const contrast = SETTINGS.contrast, sprites = this.sprites;
    for (const b of GAME.bullets) if (b.on) {
      const key = b.col * 32 + (b.r * 2 | 0);           // fast numeric cache key
      let spr = sprites.get(key);
      if (!spr) { spr = this.sprite(b.col, b.r); sprites.set(key, spr); sprites.delete(b.col + ':' + Math.round(b.r * 2)); }
      const d = b.r * 4.8;
      ctx.drawImage(spr, b.x - d / 2, b.y - d / 2, d, d);
      if (contrast) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
      }
    }
  },
  drawPBullets(ctx, t) {
    for (const pb of GAME.pbullets) if (pb.on) {
      ctx.fillStyle = pb.erase ? '#aef3ff' : '#dfe9ff';
      ctx.fillRect(pb.x - 2, pb.y - 8, 4, 14);
      ctx.fillStyle = pb.erase ? '#ffffff' : '#8fd8ff';
      ctx.fillRect(pb.x - 1, pb.y - 10, 2, 6);
    }
  },
  drawPlayer(ctx, t) {
    const p = GAME.player;
    if (!p || !p.alive) return;
    const inv = t < p.invulnUntil;
    const blink = inv && !SETTINGS.reducedMotion ? (Math.sin(t * 40) > 0 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = blink;
    // beat ring (rhythm visualization)
    const bf = ((t / MUSIC.beatDur()) % 1 + 1) % 1;
    if (!SETTINGS.reducedMotion) {
      ctx.strokeStyle = 'rgba(140,220,255,' + ((1 - bf) * 0.4).toFixed(2) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, lerp(36, 20, bf), 0, TAU); ctx.stroke();
      if (GAME.lastJudgeT > 0 && Math.abs(t - GAME.lastJudgeT) < 0.02) { }
    }
    // graze ring
    ctx.strokeStyle = 'rgba(159,210,255,0.22)';
    ctx.setLineDash([4, 7]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    // dash streak
    if (t < p.dashUntil) {
      ctx.fillStyle = 'rgba(140,220,255,0.5)';
      ctx.beginPath(); ctx.ellipse(-p.dashDirX * 14, -p.dashDirY * 14, 10, 4, Math.atan2(p.dashDirY, p.dashDirX), 0, TAU); ctx.fill();
    }
    // ship
    const tilt = clamp((p.lastMvx || 0) * 0.3, -0.35, 0.35);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.moveTo(0, -13); ctx.lineTo(9, 9); ctx.lineTo(0, 4); ctx.lineTo(-9, 9); ctx.closePath();
    ctx.fillStyle = '#eaf6ff';
    ctx.strokeStyle = '#59f2ff'; ctx.lineWidth = 1.6;
    ctx.fill(); ctx.stroke();
    // engine
    ctx.fillStyle = 'rgba(120,200,255,' + (0.4 + 0.3 * Math.sin(t * 30)).toFixed(2) + ')';
    ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(0, 14 + 3 * Math.sin(t * 25)); ctx.lineTo(3, 8); ctx.closePath(); ctx.fill();
    ctx.rotate(-tilt);
    // focus hitbox
    if (p.focus) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff5470'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  },
  drawParticles(ctx, dt) {
    for (const p of GAME.parts) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age >= p.life) { p.on = false; GAME.pfree.push(p.idx); continue; }
      const dr = Math.max(0, 1 - p.drag * dt);
      p.vx *= dr; p.vy *= dr; p.vy += 60 * dt * (p.star ? 1 : 0);
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      if (p.star) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.age * 7);
        ctx.fillRect(-p.size, -p.size / 3, p.size * 2, p.size / 1.5);
        ctx.fillRect(-p.size / 3, -p.size, p.size / 1.5, p.size * 2);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.4, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },
  drawFloaters(ctx, dt) {
    ctx.textAlign = 'center';
    for (const f of GAME.floaters) {
      if (!f.on) continue;
      f.age += dt;
      if (f.age >= f.life) { f.on = false; continue; }
      const a = f.age / f.life;
      ctx.globalAlpha = 1 - a * a;
      ctx.font = '700 ' + f.size + 'px ' + "'Cascadia Mono',Menlo,Consolas,monospace";
      ctx.strokeStyle = 'rgba(2,6,12,0.8)'; ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y - a * 26);
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, f.x, f.y - a * 26);
    }
    ctx.globalAlpha = 1;
  },
  drawRings(ctx, t) {
    for (let i = ringBlasts.length - 1; i >= 0; i--) {
      const r = ringBlasts[i], age = t - r.t;
      if (age > 0.6 || age < 0) { ringBlasts.splice(i, 1); continue; }
      ctx.strokeStyle = r.col; ctx.globalAlpha = 1 - age / 0.6;
      ctx.lineWidth = 3 * (1 - age / 0.6) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, 20 + age * 900, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },
  drawBanner(ctx, t) {
    const bn = GAME.banner;
    if (!bn || t > bn.until) return;
    const age = bn.until - t, total = 2.4;
    let a = 1;
    if (total - age < 0.3) a = (total - age) / 0.3;
    if (age < 0.4) a = age / 0.4;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '900 25px system-ui,sans-serif';
    ctx.strokeStyle = 'rgba(2,6,12,0.85)'; ctx.lineWidth = 5;
    ctx.strokeText(bn.text, W / 2, H * 0.36);
    ctx.fillStyle = bn.col;
    ctx.fillText(bn.text, W / 2, H * 0.36);
    ctx.globalAlpha = 1;
  },
  drawCountdown(ctx, t) {
    if (t >= 0) return;
    const bd = MUSIC.beatDur();
    const remain = Math.ceil(-t / bd);
    const frac = 1 - ((-t) % bd) / bd;
    ctx.fillStyle = 'rgba(2,4,10,0.45)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(W / 2, H * 0.42);
    ctx.scale(1 + 0.25 * (1 - frac), 1 + 0.25 * (1 - frac));
    ctx.font = '900 84px system-ui,sans-serif';
    ctx.fillStyle = '#eaf6ff';
    ctx.shadowColor = '#59f2ff'; ctx.shadowBlur = 30;
    ctx.fillText('' + remain, 0, 28);
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.font = '600 13px ' + "ui-monospace,Menlo,monospace";
    ctx.fillStyle = '#9fd2ff';
    ctx.fillText('GET READY — MOVE ON THE COUNT-IN', W / 2, H * 0.42 + 64);
  },
  bloomPass() {
    if (SETTINGS.quality === 'low') return;
    const bc = this.bctx, cv = this.cv;
    bc.setTransform(1, 0, 0, 1, 0, 0);
    bc.clearRect(0, 0, this.bcan.width, this.bcan.height);
    bc.drawImage(cv, 0, 0, this.bcan.width, this.bcan.height);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = SETTINGS.quality === 'high' ? 0.38 : 0.22;
    ctx.drawImage(this.bcan, 0, 0, cv.width, cv.height);
    ctx.restore();
    ctx.globalAlpha = 1;
  },
  /* ---------------- HUD ---------------- */
  drawHud(ctx, t, ox, oy) {
    ctx.save();
    ctx.translate(-ox, -oy);
    ctx.textAlign = 'left';
    const mono = "ui-monospace,'Cascadia Mono',Menlo,Consolas,monospace";
    if (GAME.mode === 'run' && GAME.boss) {
      // boss hp bar
      const b = GAME.boss, ph = PHASES[b.phase];
      const bw = 400, bx = (W - bw) / 2, by = 16;
      ctx.fillStyle = 'rgba(6,10,20,0.7)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
      const frac = clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = ph.col;
      ctx.fillRect(bx, by, bw * frac, 8);
      ctx.strokeStyle = 'rgba(180,210,255,0.5)'; ctx.lineWidth = 1;
      ctx.strokeRect(bx - 2.5, by - 2.5, bw + 5, 13);
      for (let i = 1; i < PHASES.length; i++) {
        const x = bx + bw * PHASES[i].frac;
        ctx.strokeStyle = 'rgba(2,6,12,0.9)';
        ctx.beginPath(); ctx.moveTo(x, by - 2); ctx.lineTo(x, by + 10); ctx.stroke();
      }
      ctx.font = '700 9px ' + mono;
      ctx.fillStyle = 'rgba(200,225,255,0.75)';
      ctx.fillText('THE CONDUCTOR — ' + ph.name, bx, by - 6);
    } else if (GAME.mode === 'lab') {
      const cfg = GAME.lab;
      ctx.font = '700 11px ' + mono;
      ctx.fillStyle = '#9fd2ff';
      ctx.fillText('LAB · ' + cfg.pattern.toUpperCase() + ' · ' + cfg.bpm + ' BPM · ' + ['1/4', '1/8', '1/8T', '1/16'][cfg.sub - 1] + ' · ESC to exit', 14, H - 78);
    }
    // hearts & bombs (run)
    if (GAME.mode === 'run') {
      for (let i = 0; i < GAME.maxHearts; i++) {
        const x = 22 + i * 22, y = 44;
        this.heart(ctx, x, y, 7, i < GAME.hearts ? '#ff5470' : 'rgba(120,140,170,0.35)');
      }
      for (let i = 0; i < GAME.bombs; i++) {
        const x = 24 + i * 18, y = 64;
        ctx.strokeStyle = '#59f2ff'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(89,242,255,0.5)';
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
      }
      ctx.font = '600 10px ' + mono;
      ctx.fillStyle = 'rgba(159,210,255,0.8)';
      ctx.fillText('GRAZE ' + GAME.graze, 12, 84);
    }
    // score & combo
    ctx.textAlign = 'right';
    ctx.font = '800 22px ' + mono;
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText('' + GAME.score, W - 14, GAME.mode === 'run' ? 40 : 30);
    ctx.font = '700 11px ' + mono;
    ctx.fillStyle = GAME.mult > 1 ? '#ffd166' : '#8fa3c7';
    ctx.fillText('×' + GAME.mult + ' COMBO ' + GAME.combo, W - 14, GAME.mode === 'run' ? 56 : 46);
    if (GAME.mode === 'run') {
      const prog = (GAME.combo % 20) / 20;
      ctx.fillStyle = 'rgba(255,209,102,0.25)';
      ctx.fillRect(W - 114, 62, 100, 3);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(W - 114, 62, 100 * prog, 3);
    }
    // replay badge
    if (GAME.replayMode) {
      ctx.textAlign = 'center';
      ctx.font = '700 11px ' + mono;
      ctx.fillStyle = '#59f2ff';
      ctx.fillText('● REPLAY PLAYBACK', W / 2, 46);
    }
    this.drawBeatLane(ctx, t, mono);
    this.drawViz(ctx, t);
    ctx.restore();
  },
  heart(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.7, y - s, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
    ctx.fill();
  },
  drawBeatLane(ctx, t, mono) {
    if (GAME.state !== 'run' && GAME.state !== 'lab' && GAME.state !== 'countdown') return;
    const ly = H - 46, lh = 40;
    ctx.fillStyle = 'rgba(6,10,20,0.72)';
    ctx.fillRect(0, ly, W, lh);
    ctx.strokeStyle = 'rgba(60,90,140,0.4)';
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
    const bd = MUSIC.beatDur(), ppb = 54, cx = W / 2;
    const curBeat = t / bd;
    const base = Math.floor(curBeat);
    for (let k = -3; k <= 5; k++) {
      const n = base + k;
      const x = cx + (n - curBeat) * ppb;
      if (x < -10 || x > W + 10) continue;
      const down = ((n % 4) + 4) % 4 === 0;
      const alpha = clamp(1 - Math.abs(n - curBeat) / 4, 0.15, 1);
      ctx.strokeStyle = 'rgba(140,200,255,' + (alpha * (down ? 0.9 : 0.4)).toFixed(2) + ')';
      ctx.lineWidth = down ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(x, ly + lh - (down ? 24 : 14)); ctx.lineTo(x, ly + lh - 4); ctx.stroke();
      if (down) {
        ctx.font = '600 8px ' + mono;
        ctx.fillStyle = 'rgba(140,200,255,' + (alpha * 0.7).toFixed(2) + ')';
        ctx.textAlign = 'center';
        ctx.fillText('' + (Math.floor(n / 4) + 1), x, ly + 10);
      }
    }
    // playhead
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(cx - 5, ly + 4); ctx.lineTo(cx + 5, ly + 4); ctx.lineTo(cx, ly + 12); ctx.closePath(); ctx.fill();
    // judgement flashes
    for (let i = GAME.judgeFx.length - 1; i >= 0; i--) {
      const fx = GAME.judgeFx[i], age = t - fx.t;
      if (age < 0 || age > 0.45) { if (age > 0.45) GAME.judgeFx.splice(i, 1); continue; }
      const col = fx.q === 3 ? '#aef3ff' : fx.q === 2 ? '#b6ff7a' : 'rgba(160,170,190,0.5)';
      ctx.strokeStyle = col; ctx.globalAlpha = 1 - age / 0.45;
      ctx.lineWidth = fx.q === 1 ? 1 : 2;
      ctx.beginPath(); ctx.arc(cx, ly + lh - 8, 4 + age * 90, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
    ctx.font = '600 9px ' + mono;
    ctx.fillStyle = 'rgba(159,210,255,0.7)';
    ctx.fillText('BAR ' + (Math.floor(curBeat / 4) + 1) + (t < 0 ? ' · COUNT-IN' : ''), 8, ly + 12);
    ctx.textAlign = 'right';
    ctx.fillText('OFFSET ' + (SETTINGS.offsetMs >= 0 ? '+' : '') + SETTINGS.offsetMs + 'ms', W - 8, ly + 12);
  },
  drawViz(ctx, t) {
    // waveform (bottom-left) + spectrum (bottom-right), from live analyser
    const wy = H - 108, ww = 120, wh = 30;
    ctx.fillStyle = 'rgba(6,10,20,0.6)';
    ctx.fillRect(8, wy - wh / 2 - 4, ww + 8, wh + 8);
    ctx.fillRect(W - 16 - ww, wy - wh / 2 - 4, ww + 8, wh + 8);
    ctx.strokeStyle = 'rgba(60,90,140,0.4)';
    ctx.strokeRect(8, wy - wh / 2 - 4, ww + 8, wh + 8);
    ctx.strokeRect(W - 16 - ww, wy - wh / 2 - 4, ww + 8, wh + 8);
    if (AUDIO.ok && AUDIO.wave) {
      ctx.strokeStyle = '#59f2ff'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      const n = AUDIO.wave.length, step = Math.max(1, n / ww | 0);
      for (let x = 0; x < ww; x++) {
        const v = AUDIO.wave[(x * step) | 0] / 255;
        const y = wy - wh / 2 + v * wh;
        x ? ctx.lineTo(12 + x, y) : ctx.moveTo(12 + x, y);
      }
      ctx.stroke();
      const bins = AUDIO.freq, N = 26;
      const bw = ww / N;
      ctx.fillStyle = '#ff4fd8';
      for (let i = 0; i < N; i++) {
        const bi = Math.min(bins.length - 1, (Math.pow(i / N, 1.6) * 200) | 0 + 2);
        const v = bins[bi] / 255;
        const h = Math.max(1, v * wh);
        ctx.fillRect(W - 14 - ww + i * bw, wy + wh / 2 - h, bw - 1, h);
      }
    } else {
      ctx.strokeStyle = 'rgba(120,150,190,0.6)';
      ctx.beginPath(); ctx.moveTo(12, wy); ctx.lineTo(12 + ww, wy); ctx.stroke();
      ctx.font = '600 9px ui-monospace,Menlo,monospace';
      ctx.fillStyle = 'rgba(159,210,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(AUDIO.failed ? 'AUDIO N/A' : 'AUDIO OFF', W / 2 - ww / 2 - 14, wy + 3);
    }
  },
};

/* ============================================================
   UI — screens, settings, lab, pause, end screens, calibration
   ============================================================ */
const UI = {
  current: 'title', settingsReturn: 'title',
  calib: null,
  labCfg: null,
  showScreen(name) {
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('show');
    if (name) { const el = $('s-' + name); if (el) el.classList.add('show'); }
    this.current = name || null;
    if (name === 'title') updateBestLine();
    this.refreshHudVisibility();
  },
  refreshHudVisibility() {
    const running = (GAME.state === 'run' || GAME.state === 'countdown' || GAME.state === 'lab') && !GAME.paused;
    $('game').classList.toggle('running', running && !this.current);
  },
  togglePause() {
    if (GAME.paused) this.resumeGame();
    else if (GAME.state === 'run' || GAME.state === 'countdown' || GAME.state === 'lab') this.pauseGame();
  },
  pauseGame() {
    if (GAME.paused) return;
    GAME.paused = true;
    AUDIO.suspend();
    INPUT.releaseAll();
    this.showScreen('pause');
    this.refreshHudVisibility();
  },
  resumeGame() {
    if (!GAME.paused) return;
    GAME.paused = false;
    AUDIO.resume();
    INPUT.edges.length = 0;
    this.showScreen(null);
    this.refreshHudVisibility();
  },
  finishRun(victory) {
    const total = GAME.counts[3] + GAME.counts[2] + GAME.counts[1];
    const acc = total ? Math.round((GAME.counts[3] + 0.5 * GAME.counts[2]) / total * 100) : 0;
    const stats = {
      victory, score: GAME.score, graze: GAME.graze, maxCombo: GAME.maxCombo,
      acc, hits: GAME.hits, counts: { ...GAME.counts },
      time: Math.max(0, Math.round(GAME.time)), seed: GAME.seed,
      diff: DIFFS[SETTINGS.difficulty].label, preset: PRESETS[SETTINGS.preset].name,
      tempo: SETTINGS.tempo,
    };
    GAME.lastStats = stats;
    const best = loadBest();
    let newBest = false;
    if (!best || stats.score > best.score) {
      saveBest({ score: stats.score, seed: stats.seed, diff: stats.diff, date: Date.now() });
      newBest = true;
    }
    let badge;
    if (GAME.replayMode) {
      const rp = this.pendingReplay;
      let m = 0;
      if (rp && rp.hashes) {
        const n = Math.min(rp.hashes.length, GAME.hashes.length);
        for (let i = 0; i < n; i++) if (rp.hashes[i] === GAME.hashes[i]) m++;
        const ok = rp.hashes.length === GAME.hashes.length && m === GAME.hashes.length;
        badge = ok ? '<span class="badge ok">REPLAY VERIFIED ✓ ' + m + '/' + GAME.hashes.length + ' HASHES</span>'
                   : '<span class="badge bad">REPLAY DRIFT — matched ' + m + '/' + rp.hashes.length + '</span>';
      } else badge = '';
    } else {
      badge = (newBest ? '<span class="badge ok">NEW BEST SCORE</span> ' : '') +
              '<span class="badge replay">SEED ' + stats.seed + '</span>';
    }
    const rows = [
      ['SCORE', stats.score + (newBest ? ' ★' : '')],
      ['BEST', (loadBest() || { score: stats.score }).score],
      ['GRAZE · MAX COMBO', stats.graze + ' · ×' + (1 + Math.min(7, stats.maxCombo / 20 | 0)) + ' (' + stats.maxCombo + ')'],
      ['TIMING ACCURACY', acc + '%  (P' + stats.counts[3] + ' / G' + stats.counts[2] + ' / M' + stats.counts[1] + ')'],
      ['HITS TAKEN · TIME', stats.hits + ' · ' + stats.time + 's'],
      ['SEED · DIFFICULTY', stats.seed + ' · ' + stats.diff],
      ['TRACK', stats.preset + ' @ ' + stats.tempo + ' BPM'],
    ];
    const html = rows.map(r => '<dt>' + r[0] + '</dt><dd' + (r[0] === 'SCORE' ? ' class="hl"' : '') + '>' + r[1] + '</dd>').join('');
    if (victory) { $('vic-stats').innerHTML = html; $('vic-badge').innerHTML = badge; this.showScreen('victory'); }
    else { $('over-stats').innerHTML = html; $('over-badge').innerHTML = badge; this.showScreen('over'); }
    this.pendingReplay = null;
    this.refreshHudVisibility();
  },
  /* ------- settings ------- */
  applySettingsToControls() {
    $('set-tempo').value = SETTINGS.tempo; $('set-tempo-v').textContent = SETTINGS.tempo;
    $('set-offset').value = SETTINGS.offsetMs; $('set-offset-v').textContent = (SETTINGS.offsetMs >= 0 ? '+' : '') + SETTINGS.offsetMs + 'ms';
    $('set-diff').value = SETTINGS.difficulty;
    $('set-preset').value = SETTINGS.preset;
    $('set-master').value = SETTINGS.master; $('set-master-v').textContent = Math.round(SETTINGS.master * 100) + '%';
    for (const tr of ['drums', 'bass', 'lead', 'pad']) {
      $('set-v-' + tr).value = SETTINGS.tracks[tr];
      $('set-m-' + tr).checked = SETTINGS.mutes[tr];
    }
    $('set-particles').value = SETTINGS.particles; $('set-particles-v').textContent = Math.round(SETTINGS.particles * 100) + '%';
    $('set-shake').checked = SETTINGS.shake;
    $('set-shake-amp').value = SETTINGS.shakeAmp; $('set-shake-amp-v').textContent = Math.round(SETTINGS.shakeAmp * 100) + '%';
    $('set-motion').checked = SETTINGS.reducedMotion;
    $('set-flash').checked = SETTINGS.reducedFlash;
    $('set-contrast').checked = SETTINGS.contrast;
    $('set-quality').value = SETTINGS.quality;
    document.body.classList.toggle('hc', SETTINGS.contrast);
    this.refreshBinds();
    this.refreshLabControls();
  },
  refreshBinds() {
    const box = $('set-binds'); box.innerHTML = '';
    for (const a of Object.keys(BIND_LABELS)) {
      const row = document.createElement('div'); row.className = 'bindrow';
      const lab = document.createElement('span'); lab.textContent = BIND_LABELS[a];
      const btn = document.createElement('button');
      btn.textContent = SETTINGS.bindings[a].map(prettyCode).join(' / ');
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bindrow button').forEach(b => b.classList.remove('listen'));
        btn.classList.add('listen'); btn.textContent = 'press a key…';
        INPUT.capturing = a;
      });
      row.appendChild(lab); row.appendChild(btn); box.appendChild(row);
    }
  },
  refreshLabControls() {
    const c = this.labCfg;
    $('lab-pattern').value = c.pattern;
    $('lab-bpm').value = c.bpm; $('lab-bpm-v').textContent = c.bpm;
    $('lab-sub').value = '' + c.sub;
    $('lab-density').value = c.density; $('lab-density-v').textContent = c.density;
    $('lab-speed').value = c.speed; $('lab-speed-v').textContent = c.speed.toFixed(2);
    $('lab-seed').value = c.seed;
    this.buildLabGrid();
  },
  buildLabGrid() {
    const c = this.labCfg;
    for (const [id, arr, cls] of [['lab-grid-a', c.gridA, ''], ['lab-grid-b', c.gridB, 'b']]) {
      const box = $(id); box.innerHTML = '';
      for (let i = 0; i < c.gridLen; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell ' + cls + (arr[i] ? ' on' : '') + (i % 4 === 0 ? ' beat' : '');
        cell.innerHTML = '<span class="n">' + (i + 1) + '</span>';
        cell.addEventListener('click', () => {
          arr[i] = arr[i] ? 0 : 1;
          cell.classList.toggle('on', !!arr[i]);
          sfx('ui');
        });
        box.appendChild(cell);
      }
    }
  },
  init() {
    // title
    $('s-title').addEventListener('pointerdown', () => {
      if (AUDIO.ensure() && !MUSIC.playing) MUSIC.start(CLOCK.now() + 0.06, 0);
    });
    $('btn-start').addEventListener('click', () => {
      AUDIO.ensure();
      startRun({ seed: $('seed-input').value });
    });
    $('btn-lab').addEventListener('click', () => { AUDIO.ensure(); this.showScreen('lab'); });
    $('btn-help').addEventListener('click', () => this.showScreen('help'));
    $('btn-settings').addEventListener('click', () => { this.settingsReturn = 'title'; this.showScreen('settings'); });
    $('btn-import').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const r = parseReplayJSON(rd.result);
        if (r.err) { toast('Import failed: ' + r.err, true); return; }
        AUDIO.ensure();
        this.pendingReplay = r.data;
        startRun({ replay: r.data });
      };
      rd.readAsText(f);
      e.target.value = '';
    });
    $('help-close').addEventListener('click', () => this.showScreen(GAME.state === 'title' ? 'title' : this.current === 'help' && GAME.paused ? 'pause' : null));
    // settings
    $('set-close').addEventListener('click', () => {
      if (this.settingsReturn === 'pause') this.showScreen('pause');
      else this.showScreen(GAME.state === 'title' ? 'title' : null);
    });
    $('set-reset').addEventListener('click', () => {
      SETTINGS = defaultSettings(); saveSettings(); INPUT.rebuildMap();
      this.applySettingsToControls(); applyAllAudio(); toast('Settings reset');
    });
    $('set-calib').addEventListener('click', () => {
      if (!AUDIO.ok) { toast('Enable audio first (title screen)', true); return; }
      if (GAME.state !== 'title') { toast('Calibration uses the title loop — quit to title first', true); return; }
      this.calib = { taps: [] };
      $('calib-result').textContent = '';
      this.showScreen('calib');
    });
    $('calib-cancel').addEventListener('click', () => this.showScreen('settings'));
    $('calib-done').addEventListener('click', () => {
      if (this.calib && this.calib.taps.length >= 4) {
        const avg = this.calib.taps.reduce((a, b) => a + b, 0) / this.calib.taps.length;
        SETTINGS.offsetMs = clamp(Math.round(avg / 5) * 5, -200, 200);
        saveSettings(); this.applySettingsToControls();
        toast('Offset set to ' + SETTINGS.offsetMs + 'ms');
      }
      this.calib = null;
      this.showScreen('settings');
    });
    $('calib-tap').addEventListener('click', () => this.calibTap());
    // pause
    $('p-resume').addEventListener('click', () => this.resumeGame());
    $('p-restart').addEventListener('click', () => { AUDIO.resume(); startRun({ seed: GAME.seed }); });
    $('p-settings').addEventListener('click', () => { this.settingsReturn = 'pause'; this.showScreen('settings'); });
    $('p-quit').addEventListener('click', () => { AUDIO.resume(); quitToTitle(); });
    // end screens
    $('o-retry').addEventListener('click', () => startRun({ seed: GAME.seed }));
    $('v-retry').addEventListener('click', () => startRun({ seed: GAME.seed }));
    $('o-export').addEventListener('click', () => downloadReplay());
    $('v-export').addEventListener('click', () => downloadReplay());
    $('o-title').addEventListener('click', () => quitToTitle());
    $('v-title').addEventListener('click', () => quitToTitle());
    // hud buttons
    $('hb-pause').addEventListener('click', () => this.togglePause());
    $('hb-diag').addEventListener('click', () => {
      const d = $('diag'); d.classList.toggle('show');
    });
    // settings controls
    const rng = (id, get, set, fmt) => {
      $(id).addEventListener('input', e => {
        set(parseFloat(e.target.value));
        if (fmt) $(id + '-v').textContent = fmt(parseFloat(e.target.value));
        saveSettings();
      });
    };
    rng('set-tempo', null, v => SETTINGS.tempo = Math.round(v), v => Math.round(v));
    rng('set-offset', null, v => SETTINGS.offsetMs = Math.round(v), v => (v >= 0 ? '+' : '') + Math.round(v) + 'ms');
    $('set-diff').addEventListener('change', e => { SETTINGS.difficulty = e.target.value; saveSettings(); });
    $('set-preset').addEventListener('change', e => { SETTINGS.preset = e.target.value; MUSIC.regenSeq(GAME.seed); saveSettings(); });
    rng('set-master', null, v => { SETTINGS.master = v; AUDIO.setMaster(v); }, v => Math.round(v * 100) + '%');
    for (const tr of ['drums', 'bass', 'lead', 'pad']) {
      rng('set-v-' + tr, null, v => { SETTINGS.tracks[tr] = v; AUDIO.setTrack(tr, v, SETTINGS.mutes[tr]); });
      $('set-m-' + tr).addEventListener('change', e => { SETTINGS.mutes[tr] = e.target.checked; AUDIO.setTrack(tr, SETTINGS.tracks[tr], e.target.checked); saveSettings(); });
    }
    rng('set-particles', null, v => SETTINGS.particles = v, v => Math.round(v * 100) + '%');
    $('set-shake').addEventListener('change', e => { SETTINGS.shake = e.target.checked; saveSettings(); });
    rng('set-shake-amp', null, v => SETTINGS.shakeAmp = v, v => Math.round(v * 100) + '%');
    $('set-motion').addEventListener('change', e => { SETTINGS.reducedMotion = e.target.checked; saveSettings(); });
    $('set-flash').addEventListener('change', e => { SETTINGS.reducedFlash = e.target.checked; saveSettings(); });
    $('set-contrast').addEventListener('change', e => { SETTINGS.contrast = e.target.checked; document.body.classList.toggle('hc', e.target.checked); saveSettings(); });
    $('set-quality').addEventListener('change', e => { SETTINGS.quality = e.target.value; saveSettings(); RENDER.resize(); });
    // lab
    this.labCfg = { pattern: 'radial', bpm: 118, sub: 2, density: 4, speed: 1, seed: (Math.random() * 899999 + 1) | 0, gridLen: 8, gridA: [1, 0, 0, 0, 1, 0, 1, 0], gridB: [0, 0, 0, 0, 0, 0, 0, 1] };
    $('lab-pattern').addEventListener('change', e => { this.labCfg.pattern = e.target.value; });
    $('lab-bpm').addEventListener('input', e => { this.labCfg.bpm = parseInt(e.target.value); $('lab-bpm-v').textContent = this.labCfg.bpm; if (GAME.state === 'lab') SETTINGS.tempo = this.labCfg.bpm; });
    $('lab-sub').addEventListener('change', e => {
      const sub = parseInt(e.target.value);
      const lens = { 1: 4, 2: 8, 3: 12, 4: 16 };
      const c = this.labCfg; c.sub = sub; c.gridLen = lens[sub];
      const oldA = c.gridA, oldB = c.gridB;
      c.gridA = new Array(c.gridLen).fill(0); c.gridB = new Array(c.gridLen).fill(0);
      for (let i = 0; i < c.gridLen; i++) { c.gridA[i] = oldA[i % oldA.length] || 0; c.gridB[i] = oldB[i % oldB.length] || 0; }
      this.buildLabGrid();
    });
    $('lab-density').addEventListener('input', e => { this.labCfg.density = parseInt(e.target.value); $('lab-density-v').textContent = this.labCfg.density; });
    $('lab-speed').addEventListener('input', e => { this.labCfg.speed = parseFloat(e.target.value); $('lab-speed-v').textContent = this.labCfg.speed.toFixed(2); });
    $('lab-seed').addEventListener('change', e => { this.labCfg.seed = (parseInt(e.target.value) || 1) >>> 0; });
    $('lab-start').addEventListener('click', () => { AUDIO.ensure(); startLab({ ...this.labCfg, gridA: [...this.labCfg.gridA], gridB: [...this.labCfg.gridB] }); });
    $('lab-back').addEventListener('click', () => this.showScreen('title'));
    const LAB_PRESETS = [
      { name: 'Gentle Warmup', cfg: { pattern: 'radial', bpm: 100, sub: 1, density: 3, speed: 0.75, gridA: [1, 0, 0, 0], gridB: [0, 0, 0, 0] } },
      { name: 'Metro Groove', cfg: { pattern: 'aimed', bpm: 118, sub: 2, density: 4, speed: 1, gridA: [1, 0, 1, 0, 1, 0, 1, 0], gridB: [0, 0, 0, 0, 1, 0, 0, 0] } },
      { name: 'Hyperspiral', cfg: { pattern: 'spiral', bpm: 138, sub: 2, density: 6, speed: 1.2, gridA: [1, 1, 1, 1, 1, 1, 1, 1], gridB: [0, 0, 1, 0, 0, 0, 1, 0] } },
      { name: 'Chaos Kitchen', cfg: { pattern: 'chaos', bpm: 168, sub: 4, density: 9, speed: 1.5, gridA: [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1], gridB: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1] } },
    ];
    for (const lp of LAB_PRESETS) {
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.textContent = lp.name;
      b.addEventListener('click', () => {
        Object.assign(this.labCfg, JSON.parse(JSON.stringify(lp.cfg)));
        const lens = { 1: 4, 2: 8, 3: 12, 4: 16 };
        this.labCfg.gridLen = lens[this.labCfg.sub];
        this.refreshLabControls(); sfx('ui');
      });
      $('lab-presets').appendChild(b);
    }
    this.applySettingsToControls();
    // Esc in lab-run exits to lab screen
    document.addEventListener('keydown', e => {
      if (e.code === 'Backquote' && !INPUT.capturing) { $('diag').classList.toggle('show'); }
      if (this.calib && e.code === 'KeyF') { e.preventDefault(); this.calibTap(); }
      if (GAME.state === 'lab' && !GAME.paused && e.code === 'Escape') {
        // pause binding handles Escape via bindings; guard: do nothing extra here
      }
      if (this.current === 'title' && e.code === 'Enter') { $('btn-start').click(); }
    });
  },
  calibTap() {
    if (!this.calib) return;
    const bd = MUSIC.beatDur();
    const t = CLOCK.game();
    const delta = t - Math.round(t / bd) * bd;
    let ms = delta * 1000;
    if (ms > bd * 500) ms -= bd * 1000;
    if (ms < -bd * 500) ms += bd * 1000;
    this.calib.taps.push(ms);
    const n = this.calib.taps.length;
    const avg = this.calib.taps.reduce((a, b) => a + b, 0) / n;
    $('calib-result').textContent = n + '/8 taps · avg ' + (avg >= 0 ? '+' : '') + Math.round(avg) + 'ms';
    sfx('ui');
    if (n >= 8) $('calib-done').click();
  },
};
function prettyCode(c) {
  return c.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, 'Arrow ');
}
function applyAllAudio() {
  AUDIO.setMaster(SETTINGS.master);
  for (const tr of ['drums', 'bass', 'lead', 'pad']) AUDIO.setTrack(tr, SETTINGS.tracks[tr], SETTINGS.mutes[tr]);
}
function updateBestLine() {
  const b = loadBest();
  $('best-line').textContent = b ? 'BEST ' + b.score + ' · seed ' + b.seed + ' · ' + (b.diff || '') : 'no clear yet — the conductor awaits';
}

/* ============================================================
   STATUS / DIAGNOSTICS DOM
   ============================================================ */
let fpsEma = 60;
function updateStatusDom() {
  const el = $('status');
  const st = GAME.state;
  const audio = AUDIO.ok ? AUDIO.ctx.state : (AUDIO.failed ? 'unavailable' : 'off');
  const beat = CLOCK.game() / MUSIC.beatDur();
  const bar = Math.floor(beat / 4) + 1, bt = (Math.floor(beat) % 4 + 4) % 4 + 1;
  const la = MUSIC.playing ? Math.max(0, (MUSIC.nextStepTime - CLOCK.now()) * 1000) : 0;
  const phase = GAME.mode === 'run' && GAME.boss ? 'P' + (GAME.boss.phase + 1) : GAME.mode === 'lab' ? 'LAB' : '—';
  const inRun = st === 'run' || st === 'countdown' || st === 'lab' || st === 'dead' || st === 'victory';
  el.innerHTML = inRun ? (
    'FPS <b>' + Math.round(fpsEma) + '</b>  BPM <b>' + SETTINGS.tempo + '</b>  BAR <b>' + bar + '</b> BEAT <b>' + bt + '</b>\n' +
    'AUDIO <b>' + audio + '</b>  LOOKAHEAD <b>' + la.toFixed(0) + 'ms</b>  BULLETS <b>' + GAME.bulletCount + '</b>\n' +
    'PHASE <b>' + phase + '</b>  SCORE <b>' + GAME.score + '</b>  COMBO <b>×' + GAME.mult + ' ' + GAME.combo + '</b>\n' +
    'OFFSET <b>' + (SETTINGS.offsetMs >= 0 ? '+' : '') + SETTINGS.offsetMs + 'ms</b>  ' +
    (GAME.paused ? '<span class="warn">■ PAUSED</span>' : (st === 'countdown' ? '<span class="warn">COUNT-IN</span>' : '▶ LIVE')) +
    (GAME.replayMode ? '  <b>REPLAY</b>' : '')
  ) : 'PULSEFALL — ready';
}
function updateDiagDom() {
  const el = $('diag');
  if (!el.classList.contains('show')) return;
  const t = CLOCK.game(), bd = MUSIC.beatDur();
  const beat = t / bd;
  const pos = (Math.floor(beat / 4) + 1) + ':' + ((Math.floor(beat) % 4 + 4) % 4 + 1) + ':' + (Math.floor(((beat % 1) + 1) % 1 * 4) + 1);
  const total = GAME.counts[3] + GAME.counts[2] + GAME.counts[1];
  const acc = total ? Math.round((GAME.counts[3] + 0.5 * GAME.counts[2]) / total * 100) : 0;
  const p = GAME.player;
  el.innerHTML =
    '— SCHEDULER —\n' +
    'horizon      ' + (MUSIC.playing ? Math.max(0, (MUSIC.nextStepTime - CLOCK.now()) * 1000).toFixed(1) + ' ms' : 'stopped') + '\n' +
    'steps sched  ' + MUSIC.stepIndex + '\n' +
    'evq pending  ' + GAME.evq.length + '\n' +
    'ctx time     ' + (AUDIO.ok ? AUDIO.ctx.currentTime.toFixed(3) + ' s' : 'n/a') + '\n' +
    'base latency ' + (AUDIO.ok && AUDIO.ctx.baseLatency ? (AUDIO.ctx.baseLatency * 1000).toFixed(1) + ' ms' : 'n/a') + '\n' +
    'transport    bar:beat:16th ' + pos + '\n' +
    '— GAME —\n' +
    'game time    ' + t.toFixed(2) + ' s\n' +
    'bullets      ' + GAME.bulletCount + ' active / ' + GAME.bullets.length + ' pool\n' +
    'phase        ' + (GAME.mode === 'run' && GAME.boss ? (GAME.boss.phase + 1) + ' — ' + PHASES[GAME.boss.phase].name : GAME.mode === 'lab' ? 'lab' : '—') + '\n' +
    'player       ' + (p ? (p.x | 0) + ',' + (p.y | 0) + '  hit r3.2 graze r26' : '—') + '\n' +
    'timing err   ' + (GAME.lastErrMs === null ? '—' : (GAME.lastErrMs >= 0 ? '+' : '') + GAME.lastErrMs + ' ms') + '\n' +
    'judge P/G/M  ' + GAME.counts[3] + '/' + GAME.counts[2] + '/' + GAME.counts[1] + '  acc ' + acc + '%\n' +
    'state        ' + GAME.state + (GAME.paused ? ' (paused)' : '') + '\n' +
    'seed         ' + GAME.seed + (GAME.replayMode ? ' (replay)' : '') + '\n' +
    '— RENDER —\n' +
    'fps          ' + fpsEma.toFixed(1) + '\n' +
    'dropped      ' + RENDER.dropped + ' frames >22ms\n' +
    'backing      ' + RENDER.cv.width + '×' + RENDER.cv.height + ' @' + RENDER.dprQ.toFixed(2) + 'x';
}

/* ============================================================
   MAIN LOOP & BOOT
   ============================================================ */
let lastFrame = performance.now(), domTimer = 0, droppedLast = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(120, ts - lastFrame);
  lastFrame = ts;
  if (dtMs > 22) { RENDER.dropped++; }
  fpsEma = fpsEma * 0.95 + (1000 / Math.max(1, dtMs)) * 0.05;
  pollGamepad();
  AUDIO.sample();
  const st = GAME.state;
  const simActive = (st === 'countdown' || st === 'run' || st === 'lab' || st === 'dead' || st === 'victory') && !GAME.paused;
  if (simActive) {
    // Fixed-step sim: process every tick up to ~1s of backlog so GAME.time tracks
    // the transport exactly (event punctuality + replay determinism), regardless
    // of render speed.
    const target = CLOCK.game();
    let budget = 260;
    while (GAME.lastT + SIM_DT <= target + 1e-9 && budget-- > 0) {
      GAME.lastT += SIM_DT;
      simTick(GAME.lastT);
    }
    if (target - GAME.lastT > 1) {           // pathological backlog (post-stall): snap forward
      GAME.lastT = Math.round(target / SIM_DT) * SIM_DT;
      GAME.evq.length = 0;
      GAME.lastStep = Math.max(GAME.lastStep, Math.floor(target / MUSIC.stepDur()));
      MUSIC.nextStepTime = Math.max(MUSIC.nextStepTime, target);
    }
  }
  RENDER.draw(dtMs / 1000, ts);
  // adaptive quality: on persistently weak rendering, step down once per tier
  if (fpsEma < 34 && !GAME.paused && (st === 'run' || st === 'lab')) {
    RENDER.lowTimer = (RENDER.lowTimer || 0) + dtMs;
    if (RENDER.lowTimer > 3000) {
      RENDER.lowTimer = 0;
      if (SETTINGS.quality === 'high') { SETTINGS.quality = 'medium'; RENDER.resize(); toast('Performance: render quality → Medium'); }
      else if (SETTINGS.quality === 'medium') { SETTINGS.quality = 'low'; RENDER.resize(); toast('Performance: render quality → Low'); }
    }
  } else RENDER.lowTimer = 0;
  domTimer -= dtMs;
  if (domTimer <= 0) { updateStatusDom(); updateDiagDom(); domTimer = 150; }
}

function boot() {
  loadSettings();
  initPools();
  INPUT.rebuildMap();
  initInput();
  UI.init();
  RENDER.init();
  RENDER.resize();
  updateBestLine();
  window.addEventListener('resize', () => RENDER.resize());
  window.addEventListener('error', e => {
    GAME.lastError = e.message;
    toast('Error: ' + e.message, true);
  });
  window.__PF = { GAME, MUSIC, AUDIO, CLOCK, SETTINGS, RENDER, UI, INPUT, DIAG: { get show() { return $('diag').classList.contains('show'); } },
    startRun, startLab, simTick, judge, beatDeltaSec, buildReplayJSON, parseReplayJSON, version: '1.0' };
  requestAnimationFrame(frame);
}
boot();
