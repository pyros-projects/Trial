
/* ============================================================
   Renderer
   ============================================================ */
const Render = {
  cv: null, ctx: null, dpr: 1, w: 0, h: 0,
  stars: [],
  potCanvas: null,

  init() {
    this.cv = el('cv');
    this.ctx = this.cv.getContext('2d');
    const rnd = mulberry32(42);
    for (let i = 0; i < 420; i++) {
      this.stars.push({ x: (rnd() * 2 - 1) * 1400, y: (rnd() * 2 - 1) * 1400, s: 0.4 + rnd() * 1.3, a: 0.25 + rnd() * 0.6 });
    }
    this.potCanvas = document.createElement('canvas');
    this.resize();
    new ResizeObserver(() => this.resize()).observe(el('canvasWrap'));
  },
  resize() {
    const wrap = el('canvasWrap');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = Math.max(200, wrap.clientWidth);
    this.h = Math.max(200, wrap.clientHeight);
    Cam.w = this.w; Cam.h = this.h;
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    this.cv.style.width = this.w + 'px';
    this.cv.style.height = this.h + 'px';
  },
  drawRadius(b) {
    return Math.max(P.minBodyPix, Sim.r[b] * P.bodyScale * Cam.zoom);
  },
  frame() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // background
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawStars();
    if (P.showPotential) this.drawPotential();
    if (P.showSOI) this.drawSOI();
    if (P.showOrbit && Sel.idx >= 0 && Sim.alive[Sel.idx]) this.drawOrbitGuide(Sel.idx);
    if (P.showTrails) this.drawTrails();
    if (P.showPred) this.drawPredictions();
    this.drawBodies();
    if (P.showVel) this.drawVectors('vel');
    if (P.showAcc) this.drawVectors('acc');
    this.drawNodeMarkers();
    this.drawOffscreenIndicators();
    this.drawScaleBar();
    if (P.showErrorGraph) this.drawErrorGraph();
    if (Interact.mode === 'placeNode') this.drawPlaceHint();
  },
  drawStars() {
    const ctx = this.ctx;
    ctx.fillStyle = '#9db2d8';
    for (const s of this.stars) {
      const sx = Cam.screenX(s.x), sy = Cam.screenY(s.y);
      if (sx < -4 || sx > this.w + 4 || sy < -4 || sy > this.h + 4) continue;
      ctx.globalAlpha = s.a;
      ctx.fillRect(sx, sy, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  },
  drawPotential() {
    const ctx = this.ctx;
    const GW = 110, GH = 62;
    const pc = this.potCanvas;
    if (pc.width !== GW || pc.height !== GH) { pc.width = GW; pc.height = GH; }
    const pctx = pc.getContext('2d');
    const img = pctx.createImageData(GW, GH);
    const d = img.data;
    // frame-space bounds of the viewport
    const x0 = Cam.cx - this.w / 2 / Cam.zoom, x1 = Cam.cx + this.w / 2 / Cam.zoom;
    const y0 = Cam.cy - this.h / 2 / Cam.zoom, y1 = Cam.cy + this.h / 2 / Cam.zoom;
    let k = 0;
    for (let gy = 0; gy < GH; gy++) {
      const fy = lerp(y1, y0, gy / (GH - 1));
      for (let gx = 0; gx < GW; gx++) {
        const fx = lerp(x0, x1, gx / (GW - 1));
        // potential in world space: invert frame transform once per pixel
        const wx = this.unframeX(fx, fy), wy = this.unframeY(fx, fy);
        let phi = 0;
        for (let b = 0; b < Sim.n; b++) {
          if (!Sim.alive[b] || Sim.m[b] === 0) continue;
          const dx = wx - Sim.x[b], dy = wy - Sim.y[b];
          phi -= Sim.G * Sim.m[b] / Math.max(hyp(dx, dy), Sim.r[b] * 0.5);
        }
        // log-scale color mapping
        const v = clamp((Math.log10(Math.abs(phi) + 1e-6) + 2) / 5, 0, 1);
        // deep: indigo -> violet -> warm
        const r = Math.round(18 + 200 * v * v);
        const g = Math.round(16 + 40 * v);
        const bl = Math.round(46 + 120 * (1 - v) * v + 60 * v);
        d[k++] = r; d[k++] = g; d[k++] = bl; d[k++] = 140;
      }
    }
    pctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(pc, 0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
  },
  unframeX(fx, fy) {
    if (Frames.mode === 'inertial') return fx;
    if (Frames.mode === 'body') return fx + Frames.cx;
    const cos = Math.cos(Frames.theta), sin = Math.sin(Frames.theta);
    const rx = fx * cos - fy * sin, ry = fx * sin + fy * cos;
    return rx + Frames.cx;
  },
  unframeY(fx, fy) {
    if (Frames.mode === 'inertial') return fy;
    if (Frames.mode === 'body') return fy + Frames.cy;
    const cos = Math.cos(Frames.theta), sin = Math.sin(Frames.theta);
    const rx = fx * cos - fy * sin, ry = fx * sin + fy * cos;
    return ry + Frames.cy;
  },
  bodyScreen(b) {
    const fx = Frames.px(Sim.x[b], Sim.y[b]), fy = Frames.py(Sim.x[b], Sim.y[b]);
    return { sx: Cam.screenX(fx), sy: Cam.screenY(fy), fx, fy };
  },
  drawSOI() {
    const ctx = this.ctx;
    ctx.setLineDash([4, 5]);
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.alive[b] || Sim.craft[b]) continue;
      const prim = primaryOf(b);
      if (prim < 0 || Sim.m[prim] <= Sim.m[b]) continue;
      const d = hyp(Sim.x[prim] - Sim.x[b], Sim.y[prim] - Sim.y[b]);
      const rsoi = d * Math.pow(Sim.m[b] / Sim.m[prim], 0.4);
      const p = this.bodyScreen(b);
      ctx.strokeStyle = 'rgba(148,163,184,0.35)';
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, rsoi * Cam.zoom, 0, TAU);
      ctx.stroke();
      // Hill radius label
      if (Cam.zoom * rsoi > 30) {
        ctx.fillStyle = 'rgba(148,163,184,0.55)';
        ctx.font = '10px ui-monospace,monospace';
        ctx.fillText(`SOI ${fmtNum(rsoi, 3)}`, p.sx + rsoi * Cam.zoom * 0.5, p.sy - rsoi * Cam.zoom * 0.72);
      }
    }
    ctx.setLineDash([]);
  },
  drawOrbitGuide(idx) {
    const prim = primaryOf(idx);
    if (prim < 0) return;
    // elements computed in FRAME space so the guide is consistent with trails/predictions
    const mu = Sim.G * (Sim.m[prim] + Sim.m[idx]);
    const rx = Frames.px(Sim.x[idx], Sim.y[idx]) - Frames.px(Sim.x[prim], Sim.y[prim]);
    const ry = Frames.py(Sim.x[idx], Sim.y[idx]) - Frames.py(Sim.x[prim], Sim.y[prim]);
    let vrx = Frames.vpx(idx) - Frames.vpx(prim);
    let vry = Frames.vpy(idx) - Frames.vpy(prim);
    if (Frames.mode !== 'rot') { // Galilean: relative velocity identical in inertial/body frames
      vrx = Sim.vx[idx] - Sim.vx[prim];
      vry = Sim.vy[idx] - Sim.vy[prim];
    }
    const elx = conicFromRel(rx, ry, vrx, vry, mu);
    const ctx = this.ctx;
    const p = this.bodyScreen(prim);
    ctx.save();
    ctx.strokeStyle = 'rgba(110,231,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 6]);
    if (elx.e < 1) {
      const b = elx.a * Math.sqrt(1 - elx.e * elx.e);
      const cA = elx.a * elx.e;
      const ccx = p.sx - Math.cos(elx.om) * cA * Cam.zoom;
      const ccy = p.sy + Math.sin(elx.om) * cA * Cam.zoom;
      ctx.beginPath();
      ctx.ellipse(ccx, ccy, elx.a * Cam.zoom, b * Cam.zoom, -elx.om, 0, TAU);
      ctx.stroke();
      // periapsis & apoapsis markers
      const drawMark = (nu, color, label) => {
        const r = elx.a * (1 - elx.e * elx.e) / (1 + elx.e * Math.cos(nu));
        const wx = Math.cos(nu + elx.om) * r, wy = Math.sin(nu + elx.om) * r;
        const sx = p.sx + wx * Cam.zoom, sy = p.sy - wy * Cam.zoom;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, TAU); ctx.fill();
        ctx.font = '10px ui-monospace,monospace';
        ctx.fillText(label, sx + 5, sy - 4);
      };
      drawMark(0, '#fbbf24', 'Pe');
      if (elx.e > 0.01) drawMark(Math.PI, '#34d399', 'Ap');
    } else {
      // hyperbolic branch
      const num = elx.a * (1 - elx.e * elx.e);
      const nuMax = Math.acos(-1 / elx.e) * 0.96;
      ctx.beginPath();
      for (let k = 0; k <= 120; k++) {
        const nu = lerp(-nuMax, nuMax, k / 120);
        const r = num / (1 + elx.e * Math.cos(nu));
        if (r <= 0 || !Number.isFinite(r)) continue;
        const sx = p.sx + Math.cos(nu + elx.om) * r * Cam.zoom;
        const sy = p.sy - Math.sin(nu + elx.om) * r * Cam.zoom;
        k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      const rp = elx.rp;
      const sx = p.sx + Math.cos(elx.om) * rp * Cam.zoom, sy = p.sy - Math.sin(elx.om) * rp * Cam.zoom;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, TAU); ctx.fill();
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillText('Pe', sx + 5, sy - 4);
    }
    ctx.restore();
  },
  drawTrails() {
    const ctx = this.ctx;
    const rows = Hist.rows;
    if (rows.length < 2) return;
    const stride = Math.max(1, Math.floor(rows.length / 500));
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.craft[b]) continue;
      this.strokeHistory(rows, b, stride, Sim.colors[b] || '#fff', 1.6, 0.9);
    }
    for (let b = 0; b < Sim.n; b++) {
      if (Sim.craft[b] || !Sim.alive[b]) continue;
      this.strokeHistory(rows, b, stride, Sim.colors[b] || '#888', 1, 0.42);
    }
  },
  strokeHistory(rows, b, stride, color, width, alpha) {
    const ctx = this.ctx;
    // draw in chunks with rising alpha for a fade-in effect
    const chunks = 6;
    let started = false;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    for (let c = 0; c < chunks; c++) {
      const i0 = Math.floor(c * (rows.length - 1) / chunks);
      const i1 = Math.floor((c + 1) * (rows.length - 1) / chunks);
      if (i1 - i0 < 1) continue;
      ctx.globalAlpha = alpha * (0.25 + 0.75 * (c + 1) / chunks);
      ctx.beginPath();
      started = false;
      for (let k = i0; k <= i1; k += stride) {
        const row = rows[k];
        const fx = Frames.rowX(row, b), fy = Frames.rowY(row, b);
        const sx = Cam.screenX(fx), sy = Cam.screenY(fy);
        if (!started) { ctx.moveTo(sx, sy); started = true; }
        else ctx.lineTo(sx, sy);
      }
      // ensure continuity to chunk boundary
      const rowE = rows[Math.min(i1, rows.length - 1)];
      {
        const fx = Frames.rowX(rowE, b), fy = Frames.rowY(rowE, b);
        ctx.lineTo(Cam.screenX(fx), Cam.screenY(fy));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  drawPredictions() {
    const ctx = this.ctx;
    for (const path of Predict.paths) {
      const rows = path.rows;
      if (rows.length < 2) continue;
      const isSel = path.craftIdx === Sel.idx;
      const stride = Math.max(1, Math.floor(rows.length / 700));
      ctx.lineWidth = isSel ? 1.8 : 1;
      ctx.strokeStyle = isSel ? hexA(Sim.colors[path.craftIdx] || '#6ee7ff', 0.95) : hexA(Sim.colors[path.craftIdx] || '#6ee7ff', 0.4);
      ctx.setLineDash(isSel ? [] : [3, 5]);
      ctx.beginPath();
      for (let k = 0; k < rows.length; k += stride) {
        const row = rows[k];
        const fx = Frames.rowX(row, path.craftIdx), fy = Frames.rowY(row, path.craftIdx);
        const sx = Cam.screenX(fx), sy = Cam.screenY(fy);
        k === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // encounter markers
      if (P.showEncounters) {
        for (const e of path.encounters) {
          const row = rows[e.ri] || rows[rows.length - 1];
          const fx = Frames.rowX(row, path.craftIdx), fy = Frames.rowY(row, path.craftIdx);
          const sx = Cam.screenX(fx), sy = Cam.screenY(fy);
          ctx.strokeStyle = 'rgba(251,191,36,0.9)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, TAU);
          ctx.moveTo(sx - 7, sy); ctx.lineTo(sx - 4, sy);
          ctx.moveTo(sx + 4, sy); ctx.lineTo(sx + 7, sy);
          ctx.stroke();
          if (isSel) {
            ctx.fillStyle = 'rgba(251,191,36,0.95)';
            ctx.font = '10px ui-monospace,monospace';
            ctx.fillText(`✕ ${Sim.names[e.body]} d=${fmtNum(e.dist, 3)} ${fmtTimeShort(e.t - Sim.t)}`, sx + 8, sy - 6);
          }
        }
        for (const im of path.impacts) {
          const row = rows[Math.min(im.ri, rows.length - 1)];
          const fx = Frames.rowX(row, path.craftIdx), fy = Frames.rowY(row, path.craftIdx);
          const sx = Cam.screenX(fx), sy = Cam.screenY(fy);
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy + 5);
          ctx.moveTo(sx + 5, sy - 5); ctx.lineTo(sx - 5, sy + 5);
          ctx.stroke();
          ctx.fillStyle = '#f87171';
          ctx.font = '10px ui-monospace,monospace';
          ctx.fillText(`IMPACT ${Sim.names[im.body]} ${fmtTimeShort(im.t - Sim.t)}`, sx + 8, sy + 3);
        }
      }
    }
  },
  drawBodies() {
    const ctx = this.ctx;
    // star glows first
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.alive[b]) continue;
      const p = this.bodyScreen(b);
      const r = this.drawRadius(b);
      if (Sim.m[b] > 100) {
        const g = ctx.createRadialGradient(p.sx, p.sy, r * 0.2, p.sx, p.sy, Math.max(r * 4, 30));
        g.addColorStop(0, hexA(Sim.colors[b], 0.5));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(r * 4, 30), 0, TAU); ctx.fill();
      }
    }
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.alive[b]) continue;
      const p = this.bodyScreen(b);
      if (p.sx < -80 || p.sx > this.w + 80 || p.sy < -80 || p.sy > this.h + 80) continue;
      const r = this.drawRadius(b);
      if (Sim.craft[b]) {
        // craft: triangle oriented along frame velocity
        const ang = Math.atan2(-Frames.vpy(b), Frames.vpx(b));
        const size = clamp(r, 4, 9) + 2;
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate(ang);
        ctx.fillStyle = Sim.colors[b];
        ctx.beginPath();
        ctx.moveTo(size * 1.4, 0); ctx.lineTo(-size, size * 0.85); ctx.lineTo(-size * 0.4, 0); ctx.lineTo(-size, -size * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = Sim.colors[b];
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fill();
        // limb shading
        const g = ctx.createRadialGradient(p.sx - r * 0.35, p.sy - r * 0.35, r * 0.2, p.sx, p.sy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, TAU); ctx.fill();
      }
      // selection ring
      if (b === Sel.idx) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(p.sx, p.sy, Math.max(r, 6) + 6, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (P.showLabels) {
        ctx.fillStyle = Sim.alive[b] ? hexA(Sim.colors[b], 0.92) : 'rgba(148,163,184,0.5)';
        ctx.font = '11px ui-sans-serif,system-ui';
        ctx.fillText(Sim.names[b], p.sx + Math.max(r, 6) + 4, p.sy - Math.max(r, 6) - 2);
      }
      // drag handles when paused & selected craft
      if (P.paused && b === Sel.idx && Sim.craft[b]) this.drawDragHandles(b, p);
    }
  },
  drawDragHandles(b, p) {
    const ctx = this.ctx;
    const vpx = Frames.vpx(b), vpy = Frames.vpy(b);
    const v = hyp(vpx, vpy);
    if (v > 1e-9) {
      const len = clamp(v * Cam.zoom * Interact.velArrowScale, 30, 260);
      const ux = vpx / v, uy = -vpy / v;
      const tx = p.sx + ux * len, ty = p.sy + uy * len;
      ctx.strokeStyle = Interact.mode === 'dragVel' ? '#fff' : hexA(Sim.colors[b], 0.9);
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy); ctx.lineTo(tx, ty);
      ctx.stroke();
      // arrowhead
      const a = Math.atan2(uy, ux);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 9 * Math.cos(a - 0.4), ty - 9 * Math.sin(a - 0.4));
      ctx.lineTo(tx - 9 * Math.cos(a + 0.4), ty - 9 * Math.sin(a + 0.4));
      ctx.closePath(); ctx.fill();
      // handle dot
      ctx.beginPath(); ctx.arc(tx, ty, 5, 0, TAU);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    // position crosshair
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    const r = this.drawRadius(b) + 8;
    ctx.beginPath();
    ctx.moveTo(p.sx - r, p.sy); ctx.lineTo(p.sx - r + 6, p.sy);
    ctx.moveTo(p.sx + r, p.sy); ctx.lineTo(p.sx + r - 6, p.sy);
    ctx.moveTo(p.sx, p.sy - r); ctx.lineTo(p.sx, p.sy - r + 6);
    ctx.moveTo(p.sx, p.sy + r); ctx.lineTo(p.sx, p.sy + r - 6);
    ctx.stroke();
  },
  drawVectors(kind) {
    const ctx = this.ctx;
    // auto scale: normalize to the max magnitude among alive bodies
    let vmax = 0;
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.alive[b]) continue;
      const v = kind === 'vel'
        ? hyp(Frames.vpx(b), Frames.vpy(b))
        : hyp(Sim.ax[b], Sim.ay[b]);
      vmax = Math.max(vmax, v);
    }
    if (vmax <= 0) return;
    const L = kind === 'vel' ? 70 : 60;
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.alive[b]) continue;
      const p = this.bodyScreen(b);
      const vx = kind === 'vel' ? Frames.vpx(b) : Sim.ax[b];
      const vy = kind === 'vel' ? Frames.vpy(b) : Sim.ay[b];
      const v = hyp(vx, vy);
      if (v < vmax * 1e-3) continue;
      const len = 18 + (v / vmax) * L;
      const ux = vx / v, uy = -vy / v;
      const tx = p.sx + ux * len, ty = p.sy + uy * len;
      ctx.strokeStyle = kind === 'vel' ? 'rgba(110,231,255,0.85)' : 'rgba(251,113,133,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(tx, ty); ctx.stroke();
      const a = Math.atan2(uy, ux);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 7 * Math.cos(a - 0.38), ty - 7 * Math.sin(a - 0.38));
      ctx.lineTo(tx - 7 * Math.cos(a + 0.38), ty - 7 * Math.sin(a + 0.38));
      ctx.closePath(); ctx.fill();
    }
    // legend
    ctx.font = '10px ui-monospace,monospace';
    ctx.fillStyle = kind === 'vel' ? 'rgba(110,231,255,0.8)' : 'rgba(251,113,133,0.8)';
    ctx.fillText(kind === 'vel' ? '── v (frame-relative)' : '── a (gravitational)', 10, this.h - 12);
  },
  drawNodeMarkers() {
    const ctx = this.ctx;
    for (const nd of Nodes.list) {
      if (nd.executed) continue;
      const path = Predict.pathFor(nd.craftIdx);
      if (!path || path.rows.length < 2) continue;
      // row nearest node time
      let best = 0, bd = Infinity;
      for (let k = 0; k < path.rows.length; k++) {
        const d = Math.abs(path.rows[k].t - nd.t);
        if (d < bd) { bd = d; best = k; }
      }
      const row = path.rows[best];
      const fx = Frames.rowX(row, nd.craftIdx), fy = Frames.rowY(row, nd.craftIdx);
      const sx = Cam.screenX(fx), sy = Cam.screenY(fy);
      const selNode = Interact.selNode === nd.id;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      const s = selNode ? 7 : 5.5;
      ctx.fillStyle = nd.useProRad ? '#6ee7ff' : '#a78bfa';
      ctx.strokeStyle = selNode ? '#fff' : 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
      if (selNode || (nd.craftIdx === Sel.idx && Predict.paths.length <= 3)) {
        ctx.fillStyle = nd.useProRad ? '#6ee7ff' : '#a78bfa';
        ctx.font = '10px ui-monospace,monospace';
        ctx.fillText(`ΔV ${fmtNum(Nodes.magnitude(nd), 3)} @ ${fmtTimeShort(nd.t - Sim.t)}`, sx + 10, sy + 12);
      }
      // burn direction arrow on the path
      if (selNode) {
        const dv = Nodes.dvVector(nd, { x: 0, y: 0 });
        const m = hyp(dv.x, dv.y);
        if (m > 1e-9) {
          const len = clamp(m * Cam.zoom * Interact.velArrowScale * 3, 24, 90);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(sx, sy);
          ctx.lineTo(sx + dv.x / m * len, sy - dv.y / m * len);
          ctx.stroke();
        }
      }
    }
  },
  drawOffscreenIndicators() {
    const ctx = this.ctx;
    for (let b = 0; b < Sim.n; b++) {
      if (!Sim.alive[b]) continue;
      const p = this.bodyScreen(b);
      const m = 26;
      if (p.sx > m && p.sx < this.w - m && p.sy > m && p.sy < this.h - m) continue;
      const cx = clamp(p.sx, m, this.w - m), cy = clamp(p.sy, m, this.h - m);
      const ang = Math.atan2(p.sy - cy, p.sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = hexA(Sim.colors[b], 0.8);
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(-3, 5); ctx.lineTo(-3, -5);
      ctx.closePath(); ctx.fill();
      ctx.rotate(-ang);
      ctx.font = '10px ui-monospace,monospace';
      ctx.fillStyle = hexA(Sim.colors[b], 0.8);
      const name = Sim.names[b];
      ctx.fillText(name, -ctx.measureText(name).width / 2, (cy < this.h / 2 ? 22 : -14));
      ctx.restore();
    }
  },
  drawScaleBar() {
    const ctx = this.ctx;
    // pick a nice round world length for ~110px
    const target = 110 / Cam.zoom;
    const pow = Math.pow(10, Math.floor(Math.log10(target)));
    const nice = [1, 2, 5, 10].map(m => m * pow).reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
    const px = nice * Cam.zoom;
    const x1 = this.w - 18 - px, y = this.h - 34;
    ctx.strokeStyle = 'rgba(226,232,240,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y - 4); ctx.lineTo(x1, y + 4);
    ctx.moveTo(x1, y); ctx.lineTo(x1 + px, y);
    ctx.moveTo(x1 + px, y - 4); ctx.lineTo(x1 + px, y + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(226,232,240,0.75)';
    ctx.font = '10px ui-monospace,monospace';
    const label = `${fmtNum(nice, 3)} u`;
    ctx.fillText(label, this.w - 18 - px + (px - ctx.measureText(label).width) / 2, y - 7);
  },
  drawErrorGraph() {
    const ctx = this.ctx;
    const w = 250, h = 74, x0 = 12, y0 = this.h - h - 30;
    ctx.fillStyle = 'rgba(8,12,24,0.72)';
    ctx.strokeStyle = 'rgba(148,163,184,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '10px ui-monospace,monospace';
    ctx.fillText('|ΔE/E₀| (log)', x0 + 8, y0 + 13);
    const hist = Stats.hist;
    if (hist.length < 2) return;
    let mx = 1e-16;
    for (const p of hist) mx = Math.max(mx, Math.abs(p.dE), Math.abs(p.dP) * 0.001);
    const logmax = Math.log10(Math.max(mx, 1e-16));
    ctx.strokeStyle = '#6ee7ff';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let k = 0; k < hist.length; k++) {
      const px = x0 + 8 + (w - 16) * k / (hist.length - 1);
      const ly = clamp(Math.log10(Math.max(Math.abs(hist[k].dE), 1e-16)) - (logmax - 4), 0, 4);
      const py = y0 + h - 6 - ly / 4 * (h - 30);
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(251,191,36,0.7)';
    ctx.beginPath();
    for (let k = 0; k < hist.length; k++) {
      const px = x0 + 8 + (w - 16) * k / (hist.length - 1);
      const ly = clamp(Math.log10(Math.max(Math.abs(hist[k].dP), 1e-16)) - (logmax - 4), 0, 4);
      const py = y0 + h - 6 - ly / 4 * (h - 30);
      k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(`10^${fmtNum(logmax, 2)}`, x0 + 8, y0 + h - 8);
    ctx.fillStyle = 'rgba(251,191,36,0.9)';
    ctx.fillText('— |ΔP/P₀|', x0 + w - 74, y0 + 13);
  },
  drawPlaceHint() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(110,231,255,0.9)';
    ctx.font = '13px ui-sans-serif,system-ui';
    const msg = 'Click on the predicted path to drop the maneuver node · Esc to cancel';
    ctx.fillText(msg, (this.w - ctx.measureText(msg).width) / 2, 46);
  },
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
