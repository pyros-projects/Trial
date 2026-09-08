/* ============================================================================
   HUD — a 2D canvas layered over the WebGL view. Betaflight-OSD flavoured:
   attitude with pitch ladder, speed/altitude tapes, throttle and pack gauges,
   a projected next-gate marker that becomes an edge arrow when off screen,
   timing block, and the warning stack.
   ========================================================================== */
class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 1; this.h = 1; this.dpr = 1;
    this.flash = 0; this.flashText = ''; this.flashColor = '#fff';
    this._p = new Float32Array(3);
  }
  resize(cssW, cssH, dpr) {
    this.w = cssW; this.h = cssH; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
  }

  draw(S) {
    const c = this.ctx, w = this.w, h = this.h;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    if (!S.settings.hud) return;
    const scale = clamp(Math.min(w, h) / 760, 0.55, 1.35);
    const narrow = w < 640;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.font = `600 ${11 * scale}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    c.textBaseline = 'middle';

    const d = S.drone, att = Q.attitude(d.q);
    const cx = w / 2, cy = h / 2;

    if (S.settings.attitude !== false) this._attitude(c, cx, cy, att, scale, S);
    this._crosshair(c, cx, cy, scale, S);
    if (!narrow || S.settings.hudCompact === false) {
      this._tapes(c, w, h, scale, S, d, att);
    } else {
      this._tapesCompact(c, w, h, scale, S, d);
    }
    this._heading(c, cx, 22 * scale, scale, att, S);
    this._gateMarker(c, S, scale);
    this._timing(c, w, h, scale, S, narrow);
    this._warnings(c, cx, h, scale, S);
    if (S.settings.showSticks) this._sticks(c, w, h, scale, S);
    if (S.settings.showTouch) { /* the DOM sticks handle their own rendering */ }
    c.restore();
  }

  /* ------------------------------------------------------------------ */
  _attitude(c, cx, cy, att, s, S) {
    const span = 150 * s, rollDeg = -att.roll * RAD, pitchPx = att.pitch * RAD * (2.3 * s);
    c.save();
    c.translate(cx, cy);
    c.rotate(rollDeg * DEG);
    c.translate(0, pitchPx);
    c.globalAlpha = 0.92;
    c.strokeStyle = 'rgba(200,240,255,0.85)'; c.lineWidth = 1.4 * s;
    /* horizon */
    c.beginPath(); c.moveTo(-span, 0); c.lineTo(-span * 0.28, 0); c.moveTo(span * 0.28, 0); c.lineTo(span, 0); c.stroke();
    /* pitch ladder */
    c.font = `600 ${9.5 * s}px ui-monospace, monospace`;
    c.textAlign = 'center';
    for (let a = -60; a <= 60; a += 10) {
      if (a === 0) continue;
      const y = -a * (2.3 * s);
      if (Math.abs(y - 0) > 210 * s) continue;
      const wdt = (a % 20 === 0 ? 46 : 26) * s;
      c.globalAlpha = 0.55;
      c.strokeStyle = a > 0 ? 'rgba(180,230,255,0.7)' : 'rgba(255,190,150,0.6)';
      c.beginPath();
      if (a > 0) { c.moveTo(-wdt, y); c.lineTo(-wdt * 0.35, y); c.moveTo(wdt * 0.35, y); c.lineTo(wdt, y); }
      else {
        c.setLineDash([4 * s, 3 * s]);
        c.moveTo(-wdt, y); c.lineTo(-wdt * 0.35, y); c.moveTo(wdt * 0.35, y); c.lineTo(wdt, y);
      }
      c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(210,235,255,0.62)';
      c.fillText(String(Math.abs(a)), -wdt - 11 * s, y);
      c.fillText(String(Math.abs(a)), wdt + 11 * s, y);
    }
    c.restore();
    /* roll arc + pointer */
    c.save();
    c.translate(cx, cy);
    c.globalAlpha = 0.6; c.strokeStyle = 'rgba(190,225,250,0.6)'; c.lineWidth = 1.2 * s;
    c.beginPath(); c.arc(0, 0, 108 * s, -Math.PI * 0.78, -Math.PI * 0.22); c.stroke();
    for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
      const ang = -Math.PI / 2 + a * DEG;
      const r0 = 108 * s, r1 = r0 + (a % 30 === 0 ? 8 : 4) * s;
      c.beginPath();
      c.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
      c.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
      c.stroke();
    }
    const pa = -Math.PI / 2 - att.roll;
    c.fillStyle = Math.abs(att.roll * RAD) > 55 ? '#ffc23d' : '#00e5ff';
    c.globalAlpha = 0.95;
    c.beginPath();
    const rr = 101 * s;
    c.moveTo(Math.cos(pa) * rr, Math.sin(pa) * rr);
    c.lineTo(Math.cos(pa + 0.045) * (rr - 9 * s), Math.sin(pa + 0.045) * (rr - 9 * s));
    c.lineTo(Math.cos(pa - 0.045) * (rr - 9 * s), Math.sin(pa - 0.045) * (rr - 9 * s));
    c.closePath(); c.fill();
    c.restore();
  }

  _crosshair(c, cx, cy, s, S) {
    c.save();
    c.globalAlpha = 0.9;
    c.strokeStyle = '#eafcff'; c.lineWidth = 2 * s;
    c.beginPath();
    c.moveTo(cx - 26 * s, cy); c.lineTo(cx - 9 * s, cy);
    c.moveTo(cx + 9 * s, cy); c.lineTo(cx + 26 * s, cy);
    c.moveTo(cx, cy - 5 * s); c.lineTo(cx, cy + 5 * s);
    c.stroke();
    c.fillStyle = '#00e5ff';
    c.fillRect(cx - 1.5 * s, cy - 1.5 * s, 3 * s, 3 * s);
    c.restore();
  }

  _tape(c, x, y0, y1, val, step, label, unit, s, opts) {
    const o = opts || {};
    const h = y1 - y0, mid = (y0 + y1) / 2, ppu = o.ppu || (h / (o.span || 40));
    c.save();
    c.globalAlpha = 0.85;
    c.strokeStyle = 'rgba(150,190,220,0.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke();
    c.font = `600 ${9.5 * s}px ui-monospace, monospace`;
    c.textAlign = o.right ? 'right' : 'left';
    const dir = o.right ? -1 : 1;
    const first = Math.floor((val - (mid - y0) / ppu) / step) * step;
    for (let v = first; v <= val + (mid - y0) / ppu + step; v += step) {
      const y = mid - (v - val) * ppu;
      if (y < y0 - 2 || y > y1 + 2) continue;
      const major = Math.abs(v % (step * 2)) < 1e-6;
      c.globalAlpha = major ? 0.75 : 0.4;
      c.strokeStyle = 'rgba(200,235,255,0.8)';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + dir * (major ? 9 : 5) * s, y); c.stroke();
      if (major) { c.fillStyle = 'rgba(210,235,255,0.75)'; c.fillText(String(Math.round(v)), x + dir * 13 * s, y); }
    }
    /* current-value box */
    c.globalAlpha = 1;
    const bw = 52 * s, bh = 17 * s;
    const bx = o.right ? x - bw - 2 * s : x + 2 * s;
    c.fillStyle = 'rgba(4,10,16,0.80)';
    c.strokeStyle = o.color || '#00e5ff'; c.lineWidth = 1.2 * s;
    c.beginPath(); c.rect(bx, mid - bh / 2, bw, bh); c.fill(); c.stroke();
    c.fillStyle = o.color || '#eafcff';
    c.font = `700 ${12 * s}px ui-monospace, monospace`;
    c.textAlign = 'center';
    c.fillText(o.fmt ? o.fmt(val) : val.toFixed(0), bx + bw / 2, mid);
    c.font = `600 ${8.5 * s}px ui-monospace, monospace`;
    c.fillStyle = 'rgba(180,210,235,0.75)';
    c.textAlign = o.right ? 'right' : 'left';
    c.fillText(label + (unit ? ' ' + unit : ''), o.right ? x : x, y0 - 8 * s);
    c.restore();
  }

  _tapes(c, w, h, s, S, d, att) {
    const y0 = h * 0.30, y1 = h * 0.70;
    const spd = d.speed();
    this._tape(c, 66 * s, y0, y1, spd, 5, 'SPD', 'm/s', s, { span: 44, color: '#00e5ff', fmt: v => v.toFixed(1) });
    this._tape(c, w - 66 * s, y0, y1, d.altAGL, 5, 'ALT', 'm AGL', s, { span: 44, right: true, color: '#39ff88', fmt: v => v.toFixed(1) });

    /* throttle + pack, bottom left */
    const bx = 28 * s, by1 = h - 96 * s, bh = 118 * s, bw = 11 * s;
    c.save();
    c.globalAlpha = 0.92;
    c.fillStyle = 'rgba(4,10,16,0.55)'; c.fillRect(bx, by1 - bh, bw, bh);
    c.strokeStyle = 'rgba(150,190,220,0.5)'; c.lineWidth = 1; c.strokeRect(bx, by1 - bh, bw, bh);
    const thr = clamp(S.ctl.throttle, 0, 1);
    const g = c.createLinearGradient(0, by1, 0, by1 - bh);
    g.addColorStop(0, '#0d7'); g.addColorStop(0.65, '#ffc23d'); g.addColorStop(1, '#ff4d4d');
    c.fillStyle = g; c.fillRect(bx + 1, by1 - bh * thr, bw - 2, bh * thr);
    /* hover reference tick */
    const hv = d.hoverStick ? d.hoverStick() : 0.3;
    c.strokeStyle = '#eafcff'; c.lineWidth = 1.4 * s;
    c.beginPath(); c.moveTo(bx - 4 * s, by1 - bh * hv); c.lineTo(bx + bw + 4 * s, by1 - bh * hv); c.stroke();
    c.font = `600 ${8.5 * s}px ui-monospace, monospace`; c.textAlign = 'center';
    c.fillStyle = 'rgba(200,230,250,0.8)';
    c.fillText('THR', bx + bw / 2, by1 + 10 * s);
    c.fillText(Math.round(thr * 100) + '%', bx + bw / 2, by1 - bh - 9 * s);
    /* motor load bars */
    const mx = bx + bw + 12 * s;
    for (let i = 0; i < 4; i++) {
      const mv = clamp(d.motors[i], 0, 1);
      const mh = bh * 0.62, myy = by1 - mh * mv;
      c.fillStyle = 'rgba(4,10,16,0.55)'; c.fillRect(mx + i * 7 * s, by1 - mh, 5 * s, mh);
      c.fillStyle = mv > 0.95 ? '#ff4d4d' : (mv > 0.8 ? '#ffc23d' : '#39c9ff');
      c.fillRect(mx + i * 7 * s, myy, 5 * s, mh * mv);
    }
    c.fillStyle = 'rgba(200,230,250,0.8)';
    c.fillText('MOT', mx + 13 * s, by1 + 10 * s);
    /* battery */
    const pb = clamp(d.battery, 0, 1);
    const px = bx, py = by1 + 20 * s;
    c.fillStyle = 'rgba(4,10,16,0.6)'; c.fillRect(px, py, 62 * s, 12 * s);
    c.fillStyle = pb > 0.35 ? '#39ff88' : (pb > 0.15 ? '#ffc23d' : '#ff4d4d');
    c.fillRect(px + 1, py + 1, (60 * s) * pb, 10 * s);
    c.strokeStyle = 'rgba(150,190,220,0.5)'; c.strokeRect(px, py, 62 * s, 12 * s);
    c.fillStyle = '#dbe6f2'; c.textAlign = 'left';
    c.fillText(`${(pb * 100).toFixed(0)}%  ${d.batteryV.toFixed(1)}V`, px + 68 * s, py + 6 * s);
    c.restore();
  }

  _tapesCompact(c, w, h, s, S, d) {
    c.save();
    c.globalAlpha = 0.95;
    c.font = `700 ${13 * s}px ui-monospace, monospace`;
    c.textAlign = 'left';
    const x = 12 * s, y = h - 74 * s;
    c.fillStyle = 'rgba(4,10,16,0.62)';
    c.fillRect(x - 5 * s, y - 15 * s, 128 * s, 62 * s);
    c.fillStyle = '#00e5ff'; c.fillText(d.speed().toFixed(1) + ' m/s', x, y);
    c.fillStyle = '#39ff88'; c.fillText(d.altAGL.toFixed(1) + ' m', x, y + 17 * s);
    const thr = clamp(S.ctl.throttle, 0, 1);
    c.fillStyle = 'rgba(4,10,16,0.6)'; c.fillRect(x, y + 27 * s, 110 * s, 8 * s);
    c.fillStyle = thr > 0.85 ? '#ff4d4d' : '#ffc23d';
    c.fillRect(x, y + 27 * s, 110 * s * thr, 8 * s);
    c.fillStyle = 'rgba(4,10,16,0.6)'; c.fillRect(x, y + 38 * s, 110 * s, 5 * s);
    c.fillStyle = d.battery > 0.3 ? '#39ff88' : '#ff4d4d';
    c.fillRect(x, y + 38 * s, 110 * s * clamp(d.battery, 0, 1), 5 * s);
    c.restore();
  }

  _heading(c, cx, y, s, att, S) {
    const w = 190 * s, deg = ((-att.yaw * RAD) % 360 + 360) % 360;
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = 'rgba(4,10,16,0.55)';
    c.fillRect(cx - w / 2, y - 9 * s, w, 18 * s);
    c.strokeStyle = 'rgba(150,190,220,0.35)'; c.lineWidth = 1;
    c.strokeRect(cx - w / 2, y - 9 * s, w, 18 * s);
    c.font = `600 ${8.5 * s}px ui-monospace, monospace`; c.textAlign = 'center';
    const ppd = w / 90;
    for (let a = -50; a <= 50; a += 10) {
      const hd = deg + a, x = cx + a * ppd;
      if (Math.abs(x - cx) > w / 2 - 2) continue;
      const norm = ((Math.round(hd) % 360) + 360) % 360;
      const major = norm % 30 === 0;
      c.strokeStyle = 'rgba(200,235,255,0.7)';
      c.globalAlpha = major ? 0.8 : 0.4;
      c.beginPath(); c.moveTo(x, y + 9 * s); c.lineTo(x, y + (major ? 3 : 6) * s); c.stroke();
      if (major) {
        c.globalAlpha = 0.85; c.fillStyle = 'rgba(215,240,255,0.9)';
        const lbl = norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W' : String(norm);
        c.fillText(lbl, x, y - 1 * s);
      }
    }
    c.globalAlpha = 1; c.fillStyle = '#00e5ff';
    c.beginPath(); c.moveTo(cx, y + 10 * s); c.lineTo(cx - 4 * s, y + 15 * s); c.lineTo(cx + 4 * s, y + 15 * s); c.closePath(); c.fill();
    c.restore();
  }

  _gateMarker(c, S, s) {
    if (!S.race || !S.renderer) return;
    const g = S.race.target();
    if (!g) return;
    const p = this._p, w = this.w, h = this.h;
    const r = S.renderer.project(g.pos, p);
    const dist = V3.dist(S.drone.p, g.pos);
    const col = S.race.behindGate ? '#ff4d4d' : '#00e5ff';
    c.save();
    c.font = `700 ${10.5 * s}px ui-monospace, monospace`;
    c.textAlign = 'center';
    if (r && p[2] > 0) {
      const x = p[0], y = p[1];
      if (x > 8 && x < w - 8 && y > 8 && y < h - 8) {
        const sz = clamp(1100 / Math.max(6, dist), 10, 90) * s;
        c.strokeStyle = col; c.lineWidth = 1.8 * s; c.globalAlpha = 0.95;
        c.beginPath();
        c.moveTo(x - sz, y - sz * 0.62); c.lineTo(x - sz, y - sz); c.lineTo(x - sz * 0.38, y - sz);
        c.moveTo(x + sz * 0.38, y - sz); c.lineTo(x + sz, y - sz); c.lineTo(x + sz, y - sz * 0.62);
        c.moveTo(x + sz, y + sz * 0.62); c.lineTo(x + sz, y + sz); c.lineTo(x + sz * 0.38, y + sz);
        c.moveTo(x - sz * 0.38, y + sz); c.lineTo(x - sz, y + sz); c.lineTo(x - sz, y + sz * 0.62);
        c.stroke();
        c.fillStyle = col;
        c.fillText(`GATE ${g.i + 1}  ${dist.toFixed(0)}m`, x, y + sz + 12 * s);
        c.restore(); return;
      }
    }
    /* off screen: clamp an arrow to the edge, pointing where to turn */
    const cxp = w / 2, cyp = h / 2;
    let dx, dy;
    if (r && p[2] > 0) { dx = p[0] - cxp; dy = p[1] - cyp; }
    else if (r) { dx = -(p[0] - cxp); dy = -(p[1] - cyp); }
    else { dx = 0; dy = 1; }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const rad = Math.min(w, h) * 0.36;
    const x = cxp + dx * rad, y = cyp + dy * rad;
    c.translate(x, y); c.rotate(Math.atan2(dy, dx) + Math.PI / 2);
    c.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(S.time * 4));
    c.fillStyle = col;
    c.beginPath(); c.moveTo(0, -13 * s); c.lineTo(10 * s, 9 * s); c.lineTo(0, 4 * s); c.lineTo(-10 * s, 9 * s); c.closePath(); c.fill();
    c.rotate(-(Math.atan2(dy, dx) + Math.PI / 2));
    c.globalAlpha = 0.95; c.fillStyle = col;
    c.fillText(`GATE ${g.i + 1} · ${dist.toFixed(0)}m`, 0, 26 * s);
    c.restore();
  }

  _timing(c, w, h, s, S, narrow) {
    const race = S.race; if (!race) return;
    /* keep the clock clear of the live-stats card on narrow layouts */
    const inset = S.insetLeft || 0;
    const x = inset > w * 0.28 ? inset + (w - inset) / 2 : w / 2;
    const y = 48 * s;
    c.save();
    c.textAlign = 'center';
    const lapT = race.armed ? race.lapTime + race.lapPenalty : 0;
    c.font = `700 ${(narrow ? 20 : 26) * s}px ui-monospace, monospace`;
    c.fillStyle = race.armed ? '#eafcff' : 'rgba(220,240,255,0.55)';
    c.shadowColor = 'rgba(0,0,0,0.85)'; c.shadowBlur = 8;
    c.fillText(race.mode === 'free' ? 'FREE FLIGHT' : (race.armed ? fmtTime(lapT) : 'READY'), x, y);
    c.shadowBlur = 0;
    c.font = `600 ${10.5 * s}px ui-monospace, monospace`;
    const dl = race.delta();
    const parts = [];
    parts.push(`LAP ${race.lap + (race.armed ? 1 : 0)}`);
    parts.push(`GATE ${race.nextGate + 1}/${race.gateCount}`);
    if (race.best) parts.push(`BEST ${fmtTime(race.best.time)}`);
    c.fillStyle = 'rgba(190,220,245,0.85)';
    c.fillText(parts.join('   ·   '), x, y + 17 * s);
    if (dl != null) {
      c.font = `700 ${13 * s}px ui-monospace, monospace`;
      c.fillStyle = dl <= 0 ? '#39ff88' : '#ff6b6b';
      c.fillText(fmtDelta(dl), x, y + 34 * s);
    }
    if (race.sectors.length) {
      c.font = `600 ${9.5 * s}px ui-monospace, monospace`;
      c.fillStyle = 'rgba(170,200,225,0.7)';
      const last = race.sectors[race.sectors.length - 1];
      c.fillText(`S${race.sectors.length} ${last.toFixed(2)}`, x, y + (dl != null ? 49 : 33) * s);
    }
    c.restore();
  }

  _warnings(c, cx, h, s, S) {
    const list = [];
    const d = S.drone;
    if (d.crashed) list.push(['CRASHED — R TO RECOVER', '#ff4d4d']);
    if (S.oob > 0) list.push([`OUT OF BOUNDS — ${S.oobTimer.toFixed(1)}s TO RESET`, '#ffc23d']);
    if (S.race && S.race.behindGate) list.push(['GATE BEHIND YOU — TURN AROUND', '#ffc23d']);
    if (d.battery < 0.15 && d.P.batteryDrain) list.push(['PACK LOW', '#ffc23d']);
    if (d.altAGL < 1.6 && !d.crashed && d.v[1] < -2.5) list.push(['TERRAIN', '#ff4d4d']);
    if (d.motorSat > 0.35) list.push(['MOTOR SATURATION', '#ffc23d']);
    if (!list.length) return;
    c.save();
    c.textAlign = 'center';
    c.font = `700 ${12 * s}px ui-monospace, monospace`;
    const blink = 0.55 + 0.45 * Math.sin(S.time * 9);
    let y = h - 128 * s;
    for (const [txt, col] of list) {
      c.globalAlpha = blink;
      c.fillStyle = 'rgba(4,10,16,0.7)';
      const wdt = c.measureText(txt).width + 18 * s;
      c.fillRect(cx - wdt / 2, y - 10 * s, wdt, 20 * s);
      c.fillStyle = col;
      c.fillText(txt, cx, y);
      y += 24 * s;
    }
    c.restore();
  }

  _sticks(c, w, h, s, S) {
    const size = 54 * s, pad = 12 * s;
    const y = h - size - pad - 4 * s;
    const draw = (x, vx, vy, l1, l2) => {
      c.save();
      c.globalAlpha = 0.85;
      c.fillStyle = 'rgba(4,10,16,0.6)'; c.strokeStyle = 'rgba(150,190,220,0.45)'; c.lineWidth = 1;
      c.fillRect(x, y, size, size); c.strokeRect(x, y, size, size);
      c.beginPath(); c.moveTo(x + size / 2, y); c.lineTo(x + size / 2, y + size);
      c.moveTo(x, y + size / 2); c.lineTo(x + size, y + size / 2);
      c.globalAlpha = 0.25; c.stroke(); c.globalAlpha = 0.95;
      c.fillStyle = '#00e5ff';
      const px = x + size / 2 + vx * size / 2 * 0.92, py = y + size / 2 - vy * size / 2 * 0.92;
      c.beginPath(); c.arc(px, py, 3.4 * s, 0, TAU); c.fill();
      c.font = `600 ${8 * s}px ui-monospace, monospace`; c.textAlign = 'center';
      c.fillStyle = 'rgba(180,210,235,0.7)';
      c.fillText(l1, x + size / 2, y + size + 8 * s);
      c.restore();
    };
    const ctl = S.ctl;
    draw(w - size * 2 - pad * 2, ctl.yaw, ctl.throttle * 2 - 1, 'THR/YAW');
    draw(w - size - pad, ctl.roll, ctl.pitch, 'PITCH/ROLL');
  }
}

/* ------------------------------------------------------------------------ */
/* scrolling telemetry: five traces derived straight from the live sim state  */
class TelemetryGraph {
  constructor(canvas, len = 420) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.len = len; this.i = 0; this.count = 0; this.paused = false;
    this.series = {
      alt: { data: new Float32Array(len), color: '#39ff88', min: 0, max: 60, label: 'alt m' },
      speed: { data: new Float32Array(len), color: '#00e5ff', min: 0, max: 40, label: 'spd m/s' },
      throttle: { data: new Float32Array(len), color: '#ffc23d', min: 0, max: 1, label: 'thr' },
      roll: { data: new Float32Array(len), color: '#ff2e8b', min: -12, max: 12, label: 'roll r/s' },
      pitch: { data: new Float32Array(len), color: '#a98bff', min: -12, max: 12, label: 'pitch r/s' }
    };
    this.dpr = 1;
  }
  resize(dpr) {
    const c = this.canvas, w = c.clientWidth || 330, h = 104;
    this.dpr = dpr;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    this.cssW = w; this.cssH = h;
  }
  push(vals) {
    if (this.paused) return;
    for (const k of Object.keys(this.series)) {
      const s = this.series[k];
      s.data[this.i] = vals[k] == null ? 0 : vals[k];
    }
    this.i = (this.i + 1) % this.len;
    this.count = Math.min(this.count + 1, this.len);
  }
  draw() {
    const c = this.ctx, W = this.cssW || 330, H = this.cssH || 104, dpr = this.dpr;
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#070b12'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,160,200,0.14)'; c.lineWidth = 1;
    for (let k = 1; k < 4; k++) { const y = H * k / 4; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let k = 1; k < 6; k++) { const x = W * k / 6; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    const n = this.count;
    if (n < 2) return;
    for (const k of Object.keys(this.series)) {
      const s = this.series[k];
      c.strokeStyle = s.color; c.lineWidth = 1.3; c.globalAlpha = 0.95;
      c.beginPath();
      for (let j = 0; j < n; j++) {
        const idx = (this.i - n + j + this.len * 2) % this.len;
        const v = clamp((s.data[idx] - s.min) / (s.max - s.min), 0, 1);
        const x = j / (this.len - 1) * W, y = H - v * (H - 3) - 1.5;
        j === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke();
    }
    c.globalAlpha = 1;
    /* current values on the right edge */
    c.font = '9px ui-monospace, monospace'; c.textAlign = 'right'; c.textBaseline = 'top';
    let yy = 3;
    for (const k of Object.keys(this.series)) {
      const s = this.series[k], idx = (this.i - 1 + this.len) % this.len;
      c.fillStyle = s.color;
      c.fillText(s.data[idx].toFixed(k === 'throttle' ? 2 : 1), W - 4, yy);
      yy += 11;
    }
  }
}
