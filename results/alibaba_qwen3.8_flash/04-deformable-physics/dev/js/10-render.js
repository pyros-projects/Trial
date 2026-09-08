/* ==========================================================================
 * RENDERER — Canvas 2D, deliberate visual polish + 8 diagnostic modes.
 * Batched fills (shade buckets) keep per-frame path counts low.
 * =========================================================================*/

const MODES = [
  { id: 'render', name: 'Render', hint: 'shaded surfaces, shadows, contacts' },
  { id: 'particles', name: 'Particles', hint: 'raw particle positions, speed-tinted' },
  { id: 'constraints', name: 'Constraints', hint: 'constraint graph by type' },
  { id: 'velocity', name: 'Velocity', hint: 'motion vectors' },
  { id: 'stress', name: 'Stress', hint: 'live constraint strain / tear warning' },
  { id: 'contacts', name: 'Contacts', hint: 'collision pairs this frame' },
  { id: 'pins', name: 'Pins', hint: 'pinned particles + anchors' },
  { id: 'grid', name: 'Grid', hint: 'spatial-partition cells (broad phase)' }
];

const TOOL_INFO = {
  grab: { name: 'Grab', key: '1', color: '#6ee7ff' },
  pin: { name: 'Pin / Unpin', key: '2', color: '#ffd166' },
  cut: { name: 'Cut / Tear', key: '3', color: '#ff5d73' },
  push: { name: 'Impulse', key: '4', color: '#a78bfa' },
  wind: { name: 'Wind gust', key: '5', color: '#5eead4' },
  spawn: { name: 'Spawn', key: '6', color: '#8ce99a' },
  erase: { name: 'Erase body', key: '7', color: '#f87171' }
};

function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const R = {
    canvas: canvas, ctx: ctx,
    view: { scale: 1, ox: 0, oy: 0, w: 800, h: 500, dpr: 1 },
    shadeCache: new Map(),
    windSeeds: null
  };

  function resize(cssW, cssH, worldW, worldH) {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.max(120, Math.floor(cssW)), h = Math.max(120, Math.floor(cssH));
    const need = Math.round(w * dpr), needH = Math.round(h * dpr);
    if (canvas.width !== need || canvas.height !== needH) {
      canvas.width = need; canvas.height = needH;
    }
    const pad = 10;
    const scale = Math.min((w - pad * 2) / worldW, (h - pad * 2) / worldH);
    const V = R.view;
    const old = V.scale;
    V.scale = scale;
    V.ox = (w - worldW * scale) / 2;
    V.oy = (h - worldH * scale) / 2;
    V.w = w; V.h = h; V.dpr = dpr;
    return old !== scale;
  }

  function screenToWorld(sx, sy) {
    const V = R.view;
    return [(sx - V.ox) / V.scale, (sy - V.oy) / V.scale];
  }

  function applyView() {
    const V = R.view;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  /* fast transform: world -> device px, drawn with an identity-ish transform
     so batched paths do not pay per-path transform cost */
  function setWorldTransform() {
    const V = R.view;
    ctx.setTransform(V.dpr * V.scale, 0, 0, V.dpr * V.scale, V.dpr * V.ox, V.dpr * V.oy);
  }

  function shadeKey(r, g, b) { return (r << 16) | (g << 8) | b; }

  /* ---------------------------- background -------------------------------- */
  function drawBackdrop(app) {
    const V = R.view;
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#0d1522');
    g.addColorStop(0.55, '#121c2b');
    g.addColorStop(1, '#182435');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, V.w, V.h);
    /* world plate */
    setWorldTransform();
    ctx.fillStyle = 'rgba(255,255,255,0.022)';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    /* grid guides */
    ctx.strokeStyle = 'rgba(140,180,220,0.055)';
    ctx.lineWidth = 1 / V.viewScale;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); }
    for (let y = 0; y <= WORLD_H; y += 50) { ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); }
    ctx.stroke();
    setWorldTransform();
    ctx.strokeStyle = 'rgba(120,200,255,0.30)';
    ctx.lineWidth = 2.5 / V.viewScale;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
  }

  /* wind streamlines: make the wind field visible while it is enabled */
  function drawWind(W, S) {
    if (S.wind < 30) return;
    const V = R.view;
    if (!R.windSeeds || R.windSeeds.n !== 64) {
      const n = 64, arr = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        arr[i * 4] = Math.random() * WORLD_W;
        arr[i * 4 + 1] = Math.random() * WORLD_H;
        arr[i * 4 + 2] = 0.4 + Math.random() * 0.8;
        arr[i * 4 + 3] = Math.random() * 6.28;
      }
      R.windSeeds = { a: arr, n: n };
    }
    const A = R.windSeeds.a;
    const sp = Math.min(420, S.wind) * 0.55;
    const dx = S.windDx, dy = S.windDy;
    ctx.save();
    setWorldTransform();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(125,205,255,0.17)';
    ctx.lineWidth = 1.6 / V.viewScale;
    ctx.beginPath();
    for (let i = 0; i < R.windSeeds.n; i++) {
      const o = i * 4;
      const x = A[o], y = A[o + 1], len = A[o + 2];
      const l = 34 + len * 46;
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * l, y + dy * l);
      A[o] += dx * sp * 0.016;
      A[o + 1] += dy * sp * 0.016 + Math.sin(W.t * 2 + A[o + 3]) * 0.45;
      if (A[o] > WORLD_W + 40 || A[o] < -40 || A[o + 1] > WORLD_H + 40 || A[o + 1] < -40) {
        A[o] = dx > 0 ? -20 : (dx < 0 ? WORLD_W + 20 : Math.random() * WORLD_W);
        A[o + 1] = dy > 0 ? -20 : (dy < 0 ? WORLD_H + 20 : Math.random() * WORLD_H);
        if (Math.abs(dx) < 0.1) A[o] = Math.random() * WORLD_W;
        if (Math.abs(dy) < 0.1) A[o + 1] = Math.random() * WORLD_H;
      }
    }
    ctx.stroke();
    ctx.restore();
    void V;
  }

  /* --------------------------- spatial grid ------------------------------- */
  function drawGrid(W) {
    const G = W.grid;
    if (!G) return;
    const V = R.view;
    setWorldTransform();
    const cs = G.cs;
    ctx.fillStyle = 'rgba(110,231,255,0.05)';
    ctx.strokeStyle = 'rgba(110,231,255,0.16)';
    ctx.lineWidth = 0.7 / V.viewScale;
    ctx.beginPath();
    let hot = 0;
    for (let cy = 0; cy < G.gh; cy++) {
      for (let cx = 0; cx < G.gw; cx++) {
        const c = cy * G.gw + cx;
        const k = G.count[c];
        const x = (cx - 1) * cs, y = (cy - 1) * cs;
        if (k > 0) {
          if (k > hot) hot = k;
          ctx.rect(x, y, cs, cs);
        }
      }
    }
    ctx.fill();
    ctx.beginPath();
    for (let cy = 0; cy < G.gh; cy++) {
      for (let cx = 0; cx < G.gw; cx++) {
        const c = cy * G.gw + cx;
        if (G.count[c] === 0) continue;
        const x = (cx - 1) * cs, y = (cy - 1) * cs;
        ctx.moveTo(x, y); ctx.lineTo(x + cs, y);
        ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs);
      }
    }
    ctx.stroke();
    /* dense cells glow: shows where the broad phase is actually working */
    if (hot > 1) {
      ctx.fillStyle = 'rgba(255,120,90,0.16)';
      ctx.beginPath();
      for (let cy = 0; cy < G.gh; cy++) {
        for (let cx = 0; cx < G.gw; cx++) {
          const c = cy * G.gw + cx;
          const k = G.count[c];
          if (k >= 4) ctx.rect((cx - 1) * cs, (cy - 1) * cs, cs, cs);
        }
      }
      ctx.fill();
    }
    R.lastHot = hot;
  }

  /* ------------------------------ obstacles ------------------------------- */
  function drawShapes(W, mode) {
    setWorldTransform();
    const V = R.view;
    for (let i = 0; i < W.shapes.length; i++) {
      const sh = W.shapes[i];
      if (!sh.alive) continue;
      const kin = !!sh.spin || !!sh.orbit || sh.kin;
      ctx.beginPath();
      if (sh.kind === 'circle') {
        ctx.arc(sh.cx, sh.cy, sh.r, 0, 6.2831853);
      } else if (sh.kind === 'seg') {
        const a = Math.atan2(sh.y1 - sh.y0, sh.x1 - sh.x0);
        ctx.lineWidth = sh.r * 2;
        ctx.lineCap = 'round';
        if (mode === 'render') {
          ctx.strokeStyle = kin ? 'rgba(255,150,90,0.85)' : 'rgba(122,146,176,0.9)';
          ctx.moveTo(sh.x0, sh.y0); ctx.lineTo(sh.x1, sh.y1); ctx.stroke();
          ctx.lineWidth = sh.r * 0.9;
          ctx.strokeStyle = 'rgba(20,28,40,0.75)';
          ctx.moveTo(sh.x0, sh.y0); ctx.lineTo(sh.x1, sh.y1); ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(150,180,210,0.5)';
          ctx.lineWidth = 1.5 / V.viewScale;
          ctx.moveTo(sh.x0, sh.y0); ctx.lineTo(sh.x1, sh.y1); ctx.stroke();
        }
        continue;
      } else {
        ctx.save();
        ctx.translate(sh.cx, sh.cy);
        ctx.rotate(sh.angle);
        ctx.rect(-sh.hw, -sh.hh, sh.hw * 2, sh.hh * 2);
        ctx.restore();
      }
      if (mode === 'render') {
        const g = ctx.createLinearGradient(sh.cx - 60, sh.cy - 60, sh.cx + 60, sh.cy + 60);
        if (kin) { g.addColorStop(0, 'rgba(255,159,98,0.92)'); g.addColorStop(1, 'rgba(180,80,50,0.92)'); }
        else { g.addColorStop(0, 'rgba(150,172,200,0.9)'); g.addColorStop(1, 'rgba(88,106,132,0.9)'); }
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(15,22,32,0.85)';
        ctx.lineWidth = 2 / V.viewScale;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(160,190,220,0.75)';
        ctx.lineWidth = 1.4 / V.viewScale;
        ctx.stroke();
      }
    }
  }

  /* -------------------------------- cloth --------------------------------- */
  const shadeOf = (t) => (t < 0 ? 0 : (t > 1 ? 1 : t));

  function drawClothRender(W, b) {
    const V = R.view;
    const cols = b.cols, rows = b.rows;
    const x = W.x, y = W.y;
    const at = (r, c) => b.p0 + r * cols + c;
    const h = b.hsl;
    /* shadow pass: whole sheet, offset with the "light" direction */
    const sx = 11, sy = 15;
    ctx.beginPath();
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = at(r, c), d = at(r, c + 1), e = at(r + 1, c + 1), f = at(r + 1, c);
        ctx.moveTo(x[a] + sx, y[a] + sy);
        ctx.lineTo(x[d] + sx, y[d] + sy);
        ctx.lineTo(x[e] + sx, y[e] + sy);
        ctx.lineTo(x[f] + sx, y[f] + sy);
        ctx.closePath();
      }
    }
    ctx.fillStyle = 'rgba(4,8,14,0.30)';
    ctx.fill();

    /* shaded quads, bucketed into 12 brightness levels (12 fills total) */
    const NB = 12;
    if (!R.buckets) {
      R.buckets = [];
      for (let i = 0; i < NB; i++) R.buckets.push(new Path2D());
    }
    const paths = R.buckets;
    for (let i = 0; i < NB; i++) paths[i] = new Path2D();
    const sp = b.sp || 20;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = at(r, c), d = at(r, c + 1), e = at(r + 1, c + 1), f = at(r + 1, c);
        const w0 = Math.abs(x[d] - x[a]) + Math.abs(x[e] - x[f]);
        const h0 = Math.abs(y[e] - y[a]) + Math.abs(y[f] - y[d]);
        /* fold darkness from in-plane compression, sheen from edge-on run */
        const comp = Math.max(0, Math.min(1.4, (2 * sp - Math.abs(w0)) / (2 * sp)));
        const edge = Math.abs(w0) / (Math.abs(h0) + 0.001);
        const sheen = Math.max(0, 1 - Math.abs(edge - 0.55) * 1.7) * 0.45;
        const t = shadeOf(0.62 - comp * 0.5 + sheen);
        const p = paths[Math.min(NB - 1, (t * (NB - 1)) | 0)];
        p.moveTo(x[a], y[a]); p.lineTo(x[d], y[d]);
        p.lineTo(x[e], y[e]); p.lineTo(x[f], y[f]);
        p.closePath();
      }
    }
    for (let i = 0; i < NB; i++) {
      const t = i / (NB - 1);
      const l = 22 + t * 52;
      const s = h.s - t * 12;
      ctx.fillStyle = 'hsl(' + h.h + ',' + Math.max(18, s) + '%,' + l + '%)';
      ctx.fill(paths[i]);
    }
    /* weave lines: cheap diagonal texture along the sheet */
    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.lineWidth = 0.8 / V.viewScale;
    ctx.beginPath();
    for (let r = 0; r < rows - 1; r += 2) {
      for (let c = 0; c < cols - 1; c += 2) {
        const a = at(r, c), e = at(r + 1, c + 1);
        ctx.moveTo(x[a], y[a]); ctx.lineTo(x[e], y[e]);
      }
    }
    ctx.stroke();
  }

  function drawJellyRender(W, b) {
    const cols = b.cols, rows = b.rows, x = W.x, y = W.y;
    const at = (r, c) => b.p0 + r * cols + c;
    ctx.beginPath();
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = at(r, c), d = at(r, c + 1), e = at(r + 1, c + 1), f = at(r + 1, c);
        ctx.moveTo(x[a] + 9, y[a] + 13); ctx.lineTo(x[d] + 9, y[d] + 13);
        ctx.lineTo(x[e] + 9, y[e] + 13); ctx.lineTo(x[f] + 9, y[f] + 13);
        ctx.closePath();
      }
    }
    ctx.fillStyle = 'rgba(6,10,18,0.35)';
    ctx.fill();
    const h = b.hsl;
    const NB = 8;
    if (!R.jb) { R.jb = []; for (let i = 0; i < NB; i++) R.jb.push(new Path2D()); }
    for (let i = 0; i < NB; i++) R.jb[i] = new Path2D();
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = at(r, c), d = at(r, c + 1), e = at(r + 1, c + 1), f = at(r + 1, c);
        const dx1 = x[d] - x[a], dy1 = y[d] - y[a];
        const dx2 = x[f] - x[e], dy2 = y[f] - y[e];
        const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
        const area = (len1 + len2) * 0.5 * Math.abs(Math.sin(Math.atan2(dy1, dx1) - Math.atan2(dy2, dx2)));
        const t = Math.max(0, Math.min(1, 0.30 + (area - 300) / 900));
        const p = R.jb[Math.min(NB - 1, (t * (NB - 1)) | 0)];
        p.moveTo(x[a], y[a]); p.lineTo(x[d], y[d]);
        p.lineTo(x[e], y[e]); p.lineTo(x[f], y[f]);
        p.closePath();
      }
    }
    for (let i = 0; i < NB; i++) {
      const t = i / (NB - 1);
      ctx.fillStyle = 'hsla(' + h.h + ',' + (60 + t * 20) + '%,' + (34 + t * 30) + '%,0.92)';
      ctx.fill(R.jb[i]);
    }
    /* rim light around the outline */
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.6 / R.view.viewScale;
    ctx.beginPath();
    const c1 = b.p0, c2 = b.p0 + cols - 1, c3 = c2 + (rows - 1) * cols, c4 = c1 + (rows - 1) * cols;
    polyStroke(ctx, x, y, c1, c2);
    polyStroke(ctx, x, y, c2, c3);
    polyStroke(ctx, x, y, c3, c4);
    polyStroke(ctx, x, y, c4, c1);
    ctx.stroke();
  }
  function polyStroke(ctx, x, y, a, b) {
    if (b > a) { for (let i = a; i <= b; i++) { if (i === a) ctx.moveTo(x[i], y[i]); else ctx.lineTo(x[i], y[i]); } }
    else { for (let i = a; i >= b; i--) { if (i === a) ctx.moveTo(x[i], y[i]); else ctx.lineTo(x[i], y[i]); } }
  }

  /* pressurised shell: smooth loop through the ring particles */
  function drawBlobRender(W, b) {
    const x = W.x, y = W.y;
    const n = b.ring;
    if (n < 3) return;
    const cx0 = (() => { let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[b.p0 + i]; sy += y[b.p0 + i]; } return [sx / n, sy / n]; })();
    ctx.beginPath();
    /* quadratic smoothing through midpoints */
    let mx = (x[b.p0 + n - 1] + x[b.p0]) * 0.5, my = (y[b.p0 + n - 1] + y[b.p0]) * 0.5;
    ctx.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const a = b.p0 + i, c = b.p0 + (i + 1) % n;
      const mx2 = (x[a] + x[c]) * 0.5, my2 = (y[a] + y[c]) * 0.5;
      ctx.quadraticCurveTo(x[a], y[a], mx2, my2);
    }
    ctx.closePath();
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(x[b.p0 + i] - cx0[0], y[b.p0 + i] - cx0[1]);
      if (d > maxR) maxR = d;
    }
    const h = b.hsl;
    const g = ctx.createRadialGradient(
      cx0[0] - maxR * 0.35, cx0[1] - maxR * 0.45, maxR * 0.08,
      cx0[0], cx0[1], maxR * 1.15);
    g.addColorStop(0, 'hsla(' + h.h + ',88%,74%,0.98)');
    g.addColorStop(0.55, 'hsla(' + h.h + ',72%,54%,0.97)');
    g.addColorStop(1, 'hsla(' + (h.h + 14) + ',66%,34%,0.96)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,18,28,0.8)';
    ctx.lineWidth = 2 / R.view.viewScale;
    ctx.stroke();
    /* specular highlight */
    ctx.beginPath();
    ctx.ellipse(cx0[0] - maxR * 0.3, cx0[1] - maxR * 0.42, maxR * 0.30, maxR * 0.16,
      -0.5, 0, 6.2831853);
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fill();
  }

  function drawClusterRender(W, b) {
    const hull = b.hull;
    if (!hull || hull.length < 3) return;
    const x = W.x, y = W.y;
    ctx.beginPath();
    ctx.moveTo(x[hull[0]], y[hull[0]]);
    for (let i = 1; i < hull.length; i++) ctx.lineTo(x[hull[i]], y[hull[i]]);
    ctx.closePath();
    let cx0 = 0, cy0 = 0;
    for (let i = 0; i < hull.length; i++) { cx0 += x[hull[i]]; cy0 += y[hull[i]]; }
    cx0 /= hull.length; cy0 /= hull.length;
    const g = ctx.createRadialGradient(cx0 - 12, cy0 - 16, 4, cx0, cy0, b.rad * 1.4);
    g.addColorStop(0, 'rgba(232,238,250,0.98)');
    g.addColorStop(0.6, 'rgba(150,166,196,0.96)');
    g.addColorStop(1, 'rgba(74,88,112,0.95)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(14,20,30,0.9)';
    ctx.lineWidth = 2 / R.view.viewScale;
    ctx.stroke();
  }

  function drawRopeRender(W, b) {
    const x = W.x, y = W.y;
    const n = b.pn;
    if (n < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    /* dark backing, then core, then highlight: reads as twisted fibre */
    const passes = [
      [b.thick * 1.0, 'rgba(10,14,22,0.55)'],
      [b.thick * 0.72, b.ropeCol || 'rgba(226,176,92,0.95)'],
      [b.thick * 0.26, 'rgba(255,238,200,0.55)']
    ];
    for (let p = 0; p < passes.length; p++) {
      ctx.beginPath();
      ctx.moveTo(x[b.p0], y[b.p0]);
      for (let i = 1; i < n; i++) ctx.lineTo(x[b.p0 + i], y[b.p0 + i]);
      if (b.closed) { ctx.lineTo(x[b.p0], y[b.p0]); ctx.closePath(); }
      ctx.lineWidth = passes[p][0];
      ctx.strokeStyle = passes[p][1];
      ctx.stroke();
    }
  }

  /* --------------------------- diagnostic modes --------------------------- */
  function drawParticlesMode(W, mode) {
    const x = W.x, y = W.y, act = W.act, cr = W.cr;
    setWorldTransform();
    const V = R.view;
    if (mode === 'particles' || mode === 'pins') {
      const NB = 10;
      if (!R.pb) { R.pb = []; for (let i = 0; i < NB; i++) R.pb.push(new Path2D()); }
      for (let i = 0; i < NB; i++) R.pb[i] = new Path2D();
      for (let i = 0; i < W.n; i++) {
        if (!act[i]) continue;
        const sp = Math.min(1, Math.hypot(W.vx[i], W.vy[i]) / 900);
        const bi = Math.min(NB - 1, (sp * NB) | 0);
        const r = Math.max(1.6, cr[i] * 0.75);
        R.pb[bi].moveTo(x[i] + r, y[i]);
        R.pb[bi].arc(x[i], y[i], r, 0, 6.2831853);
      }
      for (let i = 0; i < NB; i++) {
        const t = i / (NB - 1);
        ctx.fillStyle = 'hsl(' + (200 - t * 200) + ',85%,' + (55 + t * 8) + '%)';
        ctx.fill(R.pb[i]);
      }
      if (mode === 'pins') {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2 / V.viewScale;
        ctx.beginPath();
        for (let i = 0; i < W.n; i++) {
          if (!act[i] || !W.pin[i]) continue;
          const r = 5;
          ctx.moveTo(x[i] - r, y[i] - r); ctx.lineTo(x[i] + r, y[i] + r);
          ctx.moveTo(x[i] + r, y[i] - r); ctx.lineTo(x[i] - r, y[i] + r);
        }
        ctx.stroke();
      }
    } else if (mode === 'velocity') {
      const NB = 12;
      if (!R.vb) { R.vb = []; for (let i = 0; i < NB; i++) R.vb.push(new Path2D()); }
      for (let i = 0; i < NB; i++) R.vb[i] = new Path2D();
      let maxSp = 1;
      for (let i = 0; i < W.n; i++) {
        const s = Math.hypot(W.vx[i], W.vy[i]);
        if (s > maxSp) maxSp = s;
      }
      for (let i = 0; i < W.n; i++) {
        if (!act[i]) continue;
        const s = Math.hypot(W.vx[i], W.vy[i]);
        if (s < 3) continue;
        const k = 0.075;
        const bi = Math.min(NB - 1, (s / maxSp * NB) | 0);
        R.vb[bi].moveTo(x[i], y[i]);
        R.vb[bi].lineTo(x[i] - W.vx[i] * k, y[i] - W.vy[i] * k);
      }
      for (let i = 0; i < NB; i++) {
        const t = (i + 1) / NB;
        ctx.strokeStyle = 'hsl(' + (190 - t * 190) + ',90%,60%)';
        ctx.lineWidth = Math.max(0.8, 2.2 * t) / V.viewScale;
        ctx.stroke(R.vb[i]);
      }
    } else if (mode === 'contacts') {
      ctx.beginPath();
      const x2 = W.cX, y2 = W.cY;
      for (let c = 0; c < W.cc; c++) {
        const px = x2[c], py = y2[c];
        ctx.moveTo(px + 3.2, py);
        ctx.arc(px, py, 3.2, 0, 6.2831853);
      }
      ctx.fillStyle = 'rgba(255,90,90,0.75)';
      ctx.fill();
      ctx.beginPath();
      for (let c = 0; c < W.cc; c++) {
        const px = x2[c], py = y2[c];
        const nx = W.cNX[c], ny = W.cNY[c];
        ctx.moveTo(px, py);
        ctx.lineTo(px + nx * 9, py + ny * 9);
      }
      ctx.strokeStyle = 'rgba(120,255,190,0.5)';
      ctx.lineWidth = 1 / V.viewScale;
      ctx.stroke();
    }
  }

  function drawConstraintsMode(W, mode) {
    setWorldTransform();
    const V = R.view;
    const x = W.x, y = W.y;
    if (mode === 'constraints') {
      const cols = ['rgba(90,220,200,0.85)', 'rgba(240,180,80,0.6)',
        'rgba(160,120,255,0.55)', 'rgba(255,255,255,0.8)'];
      const lw = [1.5, 1.0, 0.9, 2.0];
      for (let cls = 1; cls <= 4; cls++) {
        ctx.beginPath();
        for (let k = 0; k < W.pc; k++) {
          if (!W.palive[k] || W.pcls[k] !== cls) continue;
          const a = W.pa[k], b = W.pb[k];
          ctx.moveTo(x[a], y[a]); ctx.lineTo(x[b], y[b]);
        }
        ctx.strokeStyle = cols[cls - 1];
        ctx.lineWidth = lw[cls - 1] / V.viewScale;
        ctx.stroke();
      }
      /* closed area / pressure loops */
      ctx.beginPath();
      for (let c = 0; c < W.ac; c++) {
        if (!W.aAlive[c]) continue;
        const off = W.aOff[c], n = W.aCnt[c];
        for (let i = 0; i < n; i++) {
          const a = W.poly[off + i], b = W.poly[off + (i + 1) % n];
          ctx.moveTo(x[a], y[a]); ctx.lineTo(x[b], y[b]);
        }
      }
      ctx.strokeStyle = 'rgba(255,120,190,0.55)';
      ctx.lineWidth = 1 / V.viewScale;
      ctx.stroke();
    } else if (mode === 'stress') {
      const thr = Math.max(0.02, R.app ? R.app.S.tear : 0.5);
      const NB = 14;
      if (!R.sb) { R.sb = []; for (let i = 0; i < NB; i++) R.sb.push(new Path2D()); }
      for (let i = 0; i < NB; i++) R.sb[i] = new Path2D();
      let maxSt = 0.001, hot = 0;
      for (let k = 0; k < W.pc; k++) {
        if (!W.palive[k]) continue;
        const s = W.pstr[k];
        if (s > maxSt) maxSt = s;
        const t = Math.min(1, s / thr);
        const bi = Math.min(NB - 1, (t * NB) | 0);
        if (t > 0.8) hot++;
        const a = W.pa[k], b = W.pb[k];
        R.sb[bi].moveTo(x[a], y[a]); R.sb[bi].lineTo(x[b], y[b]);
      }
      for (let i = 0; i < NB; i++) {
        const t = (i + 1) / NB;
        const hue = 140 - t * 140;
        ctx.strokeStyle = 'hsl(' + Math.max(0, hue) + ',95%,' + (48 + t * 12) + '%)';
        ctx.lineWidth = (1.1 + t * 2.4) / V.viewScale;
        ctx.stroke(R.sb[i]);
      }
      if (hot > 0) {   /* imminent tearing flashes */
        const pulse = 0.45 + 0.35 * Math.sin(W.t * 18);
        ctx.beginPath();
        for (let k = 0; k < W.pc; k++) {
          if (!W.palive[k]) continue;
          if (W.pstr[k] / thr <= 0.8) continue;
          const a = W.pa[k], b = W.pb[k];
          ctx.moveTo(x[a], y[a]); ctx.lineTo(x[b], y[b]);
        }
        ctx.strokeStyle = 'rgba(255,40,120,' + pulse.toFixed(3) + ')';
        ctx.lineWidth = 3.4 / V.viewScale;
        ctx.stroke();
      }
      R.stressInfo = { max: maxSt, hot: hot, thr: thr };
    }
  }

  /* ------------------------------ tool layer ------------------------------ */
  function drawToolLayer(W, S, app) {
    const V = R.view;
    setWorldTransform();
    const p = app.pointer;
    /* tool ring */
    if (p.inside) {
      const info = TOOL_INFO[app.tool] || TOOL_INFO.grab;
      const r = (app.tool === 'cut' ? 12 : app.tool === 'erase' ? 26 : S.grabRadius);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 6.2831853);
      ctx.strokeStyle = info.color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.6 / V.viewScale;
      ctx.stroke();
      if (app.tool === 'wind' || app.tool === 'push') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.55, 0, 6.2831853);
        ctx.globalAlpha = 0.35;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (p.down) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, 6.2831853);
        ctx.fillStyle = info.color;
        ctx.fill();
      }
    }
    /* grab tethers */
    if (app.tool === 'grab' && app.grabs && app.grabs.length) {
      ctx.beginPath();
      for (const g of app.grabs) {
        if (!g.idx) continue;
        for (let i = 0; i < g.n; i++) {
          ctx.moveTo(g.tx, g.ty);
          ctx.lineTo(W.x[g.idx[i]], W.y[g.idx[i]]);
        }
      }
      ctx.strokeStyle = 'rgba(110,231,255,0.5)';
      ctx.lineWidth = 1 / V.viewScale;
      ctx.stroke();
    }
    /* cut trail */
    if (app.cutTrail && app.cutTrail.length > 2) {
      ctx.beginPath();
      ctx.moveTo(app.cutTrail[0], app.cutTrail[1]);
      for (let i = 2; i < app.cutTrail.length; i += 2) ctx.lineTo(app.cutTrail[i], app.cutTrail[i + 1]);
      ctx.strokeStyle = 'rgba(255,93,115,0.9)';
      ctx.lineWidth = 2.4 / V.viewScale;
      ctx.stroke();
    }
    /* spawn ghost */
    if (app.spawnGhost) {
      const g = app.spawnGhost;
      ctx.strokeStyle = 'rgba(140,233,154,0.9)';
      ctx.lineWidth = 1.6 / V.viewScale;
      ctx.setLineDash([6 / V.viewScale, 5 / V.viewScale]);
      ctx.strokeRect(g.x, g.y, g.w, g.h);
      ctx.setLineDash([]);
    }
  }

  /* --------------------------------- frame -------------------------------- */
  function draw(W, S, app) {
    const V = R.view;
    V.viewScale = V.scale;
    R.app = app;
    applyView();
    drawBackdrop(app);
    const mode = app.mode;
    if (mode === 'grid') drawGrid(W);
    if (mode === 'render') drawWind(W, S);
    setWorldTransform();
    /* shadows for the smooth bodies first, then the bodies themselves */
    drawShapes(W, mode);
    for (let i = 0; i < W.bodies.length; i++) {
      const b = W.bodies[i];
      if (b.dead || b.pn === 0) continue;
      if (mode === 'render') {
        if (b.kind === BK_CLOTH) drawClothRender(W, b);
        else if (b.kind === BK_JELLY) {
          if (b.hull) drawClusterRender(W, b);
          else if (b.closed) drawBlobRender(W, b);
          else drawJellyRender(W, b);
        } else if (b.kind === BK_BLOB) drawBlobRender(W, b);
        else drawRopeRender(W, b);
      } else if (mode !== 'grid') {
        if (b.kind === BK_ROPE) drawRopeRender(W, b);
      }
    }
    if (mode !== 'render' && mode !== 'grid') drawParticlesMode(W, mode);
    if (mode === 'constraints' || mode === 'stress') drawConstraintsMode(W, mode);
    drawToolLayer(W, S, app);
    ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  }

  return { resize: resize, draw: draw, screenToWorld: screenToWorld, R: R };
}