/* ============================================================
   Editor state, history, rendering, interaction and panels.
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const stage = $('#stage'), world = $('#world'), sceneG = $('#scene'), overlay = $('#overlay');
const abBg = $('#abBg'), abFrame = $('#abFrame'), abShadowRect = $('#abShadowRect'), gridLayer = $('#gridLayer');
const inspectorEl = $('#inspector'), layersEl = $('#layers'), statusEl = $('#status'), hintEl = $('#hint');
const fileImport = $('#fileImport');
const COARSE = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
const HANDLE = COARSE ? 14 : 9;

const S = {
  doc: null, sel: [], tool: 'select',
  view: { zoom: 1, px: 0, py: 0 },
  hist: { past: [], future: [] },
  op: null, live: null,
  snapGrid: false, snapObj: true, showGrid: false, gridSize: 10, addMode: false,
  nodeSel: null, pathDraft: null,
  expanded: new Set(),
  session: 1, timers: new Set(), urls: new Set(),
  io: { msg: 'Ready', err: false },
  docName: 'Solstice poster', idSeq: 0,
  hoverId: null, hoverPt: null, guides: [],
  spaceDown: false, pointers: new Map(), pinch: null,
  modal: null, previewUrl: null, pendingImport: null,
};

/* ---------------- timers, toasts, status ---------------- */
function later(fn, ms) {
  const token = S.session;
  const t = setTimeout(() => { S.timers.delete(t); if (token === S.session) fn(); }, ms);
  S.timers.add(t);
  return t;
}
function clearTimers() { for (const t of S.timers) clearTimeout(t); S.timers.clear(); }
function toast(msg, kind = 'info', ms = 4200) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  later(() => el.remove(), ms);
  if (kind === 'error' || kind === 'warn') setIO(msg, true, false);
}
function setIO(msg, err = false, rerender = true) { S.io = { msg, err }; if (rerender) renderStatus(); else renderStatus(); }

/* ---------------- ids & helpers ---------------- */
function genId(doc) {
  let id;
  do { id = 'n' + (++S.idSeq); } while ((doc && doc.nodes[id]) || (S.doc && S.doc.nodes[id]));
  return id;
}
const selTargets = () => effectiveTargets(S.doc, S.sel);
function pruneSel() {
  S.sel = S.sel.filter((id) => S.doc.nodes[id]);
  if (S.nodeSel) {
    const n = S.doc.nodes[S.nodeSel.id];
    if (!n || !S.sel.includes(S.nodeSel.id) || (n.type !== 'path' && n.type !== 'line')) S.nodeSel = null;
    else S.nodeSel.index = clamp(S.nodeSel.index, 0, (n.type === 'path' ? n.anchors.length : 2) - 1);
  }
}
function darkBg(doc) {
  if (doc.artboard.transparent) return false;
  const h = doc.artboard.background;
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 110;
}
function nextName(doc, type) {
  let k = 1;
  for (const id in doc.nodes) if (doc.nodes[id].type === type) k++;
  return `${TYPE_LABEL[type]} ${k}`;
}
function isField(el) {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !['checkbox', 'radio', 'button', 'range', 'color', 'file', 'submit'].includes(el.type);
  return !!el.isContentEditable;
}

/* ---------------- history ---------------- */
const docStr = () => JSON.stringify(S.doc);
function pushHist(label, beforeStr, selBefore) {
  S.hist.past.push({ label, before: beforeStr, after: docStr(), selBefore: selBefore.slice(), selAfter: S.sel.slice() });
  if (S.hist.past.length > LIMITS.history) S.hist.past.shift();
  S.hist.future.length = 0;
}
// Atomic edit on a cloned draft: validate + lock-guard before touching the live document.
function edit(label, fn) {
  if (S.live) commitLive();
  const beforeStr = docStr();
  const draft = JSON.parse(beforeStr);
  const selBefore = S.sel.slice();
  let res;
  try {
    res = fn(draft);
    validateDoc(draft);
    lockGuard(S.doc, draft);
  } catch (e) {
    if (e instanceof UserError) { toast(e.message, 'error'); render(); return false; }
    throw e;
  }
  if (JSON.stringify(draft) === beforeStr) { if (Array.isArray(res)) { S.sel = res; pruneSel(); render(); } return false; }
  S.doc = draft;
  if (Array.isArray(res)) S.sel = res;
  pruneSel();
  pushHist(label, beforeStr, selBefore);
  render();
  return true;
}
function beginLive(kind, label) {
  if (S.live) commitLive();
  const s = docStr();
  S.live = { kind, label, beforeStr: s, before: JSON.parse(s), selBefore: S.sel.slice(), warned: false };
}
function updateLive(fn) {
  const L = S.live;
  if (!L) return false;
  const draft = JSON.parse(L.beforeStr);
  try {
    fn(draft);
    validateDoc(draft);
    lockGuard(L.before, draft);
  } catch (e) {
    if (e instanceof UserError) { if (!L.warned) { toast(e.message, 'error'); L.warned = true; } return false; }
    throw e;
  }
  S.doc = draft;
  return true;
}
function commitLive(label) {
  const L = S.live;
  if (!L) return false;
  S.live = null;
  pruneSel();
  const changed = docStr() !== L.beforeStr;
  if (changed) pushHist(label || L.label || 'Edit', L.beforeStr, L.selBefore);
  render();
  return changed;
}
function cancelLive() {
  const L = S.live;
  if (!L) return;
  S.live = null;
  S.doc = JSON.parse(L.beforeStr);
  S.sel = L.selBefore.slice();
  pruneSel();
  render();
}
function undo() {
  if (S.op) cancelOp();
  if (S.live) commitLive();
  if (S.pathDraft) { S.pathDraft = null; }
  const e = S.hist.past.pop();
  if (!e) { toast('Nothing to undo.', 'info', 1800); return; }
  S.doc = JSON.parse(e.before);
  S.sel = e.selBefore.slice();
  S.hist.future.push(e);
  pruneSel();
  setIO(`Undid: ${e.label}`);
  INS.sig = '';
  render();
}
function redo() {
  if (S.op) cancelOp();
  if (S.live) commitLive();
  const e = S.hist.future.pop();
  if (!e) { toast('Nothing to redo.', 'info', 1800); return; }
  S.doc = JSON.parse(e.after);
  S.sel = e.selAfter.slice();
  S.hist.past.push(e);
  pruneSel();
  setIO(`Redid: ${e.label}`);
  INS.sig = '';
  render();
}

/* ---------------- view ---------------- */
const toScreen = (p) => ({ x: p.x * S.view.zoom + S.view.px, y: p.y * S.view.zoom + S.view.py });
function toDoc(cx, cy) {
  const r = stage.getBoundingClientRect();
  return { x: (cx - r.left - S.view.px) / S.view.zoom, y: (cy - r.top - S.view.py) / S.view.zoom };
}
function stageXY(e) { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function fitView() {
  const r = stage.getBoundingClientRect();
  const W = r.width || 800, H = r.height || 600;
  const narrow = W < 600;
  const top = narrow ? 44 : 52, pad = narrow ? 14 : 36, bottom = narrow ? 30 : 44;
  const ab = S.doc.artboard;
  const z = clamp(Math.min((W - pad * 2) / ab.width, (H - top - bottom) / ab.height), 0.05, 32);
  S.view.zoom = z;
  S.view.px = (W - ab.width * z) / 2;
  S.view.py = top + (H - top - bottom - ab.height * z) / 2;
}
function zoomTo(z, sx, sy) {
  const z0 = S.view.zoom;
  z = clamp(z, 0.05, 32);
  if (sx == null) { const r = stage.getBoundingClientRect(); sx = r.width / 2; sy = r.height / 2; }
  S.view.px = sx - (sx - S.view.px) * (z / z0);
  S.view.py = sy - (sy - S.view.py) * (z / z0);
  S.view.zoom = z;
  render();
}
function zoomAt(factor, sx, sy) { zoomTo(S.view.zoom * factor, sx, sy); }
function setZoom(z) { zoomTo(z); }

/* ---------------- rendering ---------------- */
function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
function render() {
  renderWorld();
  renderScene();
  renderOverlay();
  renderPanels();
}
function renderWorld() {
  const { zoom: z, px, py } = S.view;
  world.setAttribute('transform', `matrix(${z} 0 0 ${z} ${px} ${py})`);
  const ab = S.doc.artboard;
  for (const r of [abBg, abFrame, abShadowRect]) { r.setAttribute('width', ab.width); r.setAttribute('height', ab.height); }
  abBg.setAttribute('fill', ab.transparent ? 'url(#checker)' : ab.background);
  abFrame.setAttribute('stroke', 'rgba(255,255,255,.18)');
  abFrame.setAttribute('vector-effect', 'non-scaling-stroke');
  gridLayer.replaceChildren();
  if (S.showGrid) {
    let step = S.gridSize;
    while (step * z < 6) step *= 2;
    let d = '';
    for (let x = step; x < ab.width; x += step) d += `M${num(x)} 0V${ab.height}`;
    for (let y = step; y < ab.height; y += step) d += `M0 ${num(y)}H${ab.width}`;
    svgEl('path', { d, stroke: ab.transparent || !darkBg(S.doc) ? 'rgba(40,110,255,.22)' : 'rgba(150,190,255,.18)', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', fill: 'none' }, gridLayer);
  }
}
function renderScene() {
  const ed = { zoom: S.view.zoom };
  const frag = document.createDocumentFragment();
  for (const id of S.doc.root) { const sp = nodeSpec(S.doc, id, ed, IDENT); if (sp) frag.appendChild(specToDOM(sp)); }
  sceneG.replaceChildren(frag);
}
function handleRect(p, attrs, parent) {
  const hs = HANDLE;
  return svgEl('rect', Object.assign({ x: round(p.x - hs / 2, 2), y: round(p.y - hs / 2, 2), width: hs, height: hs, fill: '#fff', stroke: 'var(--sel)', 'stroke-width': 1.5, 'shape-rendering': 'crispEdges' }, attrs), parent);
}
function renderOverlay() {
  overlay.replaceChildren();
  const O = overlay;
  const doc = S.doc;
  const sel = 'var(--sel)';
  // hover outline
  if (S.hoverId && doc.nodes[S.hoverId] && !S.op && !S.sel.includes(S.hoverId) && effVisible(doc, S.hoverId) && S.tool !== 'hand') {
    const n = doc.nodes[S.hoverId];
    if (n.type !== 'group') {
      const pts = boxCorners(worldMatrix(doc, S.hoverId), leafLocalBox(n)).map(toScreen);
      svgEl('polygon', { points: pts.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: sel, 'stroke-width': 1, opacity: 0.6, 'pointer-events': 'none' }, O);
    }
  }
  const targets = selTargets();
  const showNodes = (S.tool === 'node') && targets.length === 1 && ['path', 'line'].includes(doc.nodes[targets[0]].type);
  if (targets.length) {
    const locked = targets.some((id) => effLocked(doc, id));
    const col = locked ? 'var(--lock)' : sel;
    if (targets.length > 1) {
      for (const id of targets) {
        const b = nodeBounds(doc, id);
        const a = toScreen({ x: b.x, y: b.y });
        svgEl('rect', { x: a.x, y: a.y, width: b.w * S.view.zoom, height: b.h * S.view.zoom, fill: 'none', stroke: col, 'stroke-width': 1, opacity: 0.55, 'pointer-events': 'none' }, O);
      }
    }
    if (targets.length === 1) {
      const n = doc.nodes[targets[0]];
      if (n.type !== 'group') {
        const pts = boxCorners(worldMatrix(doc, targets[0]), leafLocalBox(n)).map(toScreen);
        svgEl('polygon', { points: pts.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: col, 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none' }, O);
      }
    }
    const U = unionBounds(doc, targets);
    const a = toScreen({ x: U.x, y: U.y }), b = toScreen({ x: U.x + U.w, y: U.y + U.h });
    svgEl('rect', { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, fill: 'none', stroke: col, 'stroke-width': 1.25, 'pointer-events': 'none' }, O);
    // size label
    const lab = `${fmt(U.w, 1)} × ${fmt(U.h, 1)}`;
    const lw = lab.length * 6.4 + 12;
    const lx = (a.x + b.x) / 2 - lw / 2, ly = b.y + 8;
    svgEl('rect', { x: lx, y: ly, width: lw, height: 18, rx: 4, fill: col, 'pointer-events': 'none' }, O);
    const t = svgEl('text', { x: (a.x + b.x) / 2, y: ly + 13, 'text-anchor': 'middle', fill: '#06121f', 'font-size': 11, 'font-family': 'system-ui, sans-serif', 'font-weight': 600, 'pointer-events': 'none' }, O);
    t.textContent = lab;
    if (locked) {
      const badge = svgEl('g', { transform: `translate(${a.x} ${a.y - 22})`, 'pointer-events': 'none' }, O);
      svgEl('rect', { width: 64, height: 18, rx: 4, fill: 'var(--lock)' }, badge);
      const tt = svgEl('text', { x: 32, y: 13, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#2a1d00', 'font-family': 'system-ui, sans-serif' }, badge);
      tt.textContent = '🔒 Locked';
    }
    if (S.tool === 'select' && !locked && !(S.op && S.op.type === 'move')) {
      const single = targets.length === 1 ? doc.nodes[targets[0]] : null;
      if (single && (single.type === 'rect' || single.type === 'ellipse')) {
        const W = worldMatrix(doc, single.id);
        const w = single.width, h = single.height;
        const spots = { nw: [0, 0], n: [w / 2, 0], ne: [w, 0], e: [w, h / 2], se: [w, h], s: [w / 2, h], sw: [0, h], w: [0, h / 2] };
        for (const k in spots) {
          const p = toScreen(mApply(W, spots[k][0], spots[k][1]));
          handleRect(p, { 'data-handle': 'resize:' + k, style: 'cursor:' + resizeCursor(k, single, W) }, O);
        }
      } else {
        const corners = { nw: [a.x, a.y], ne: [b.x, a.y], se: [b.x, b.y], sw: [a.x, b.y] };
        for (const k in corners) handleRect({ x: corners[k][0], y: corners[k][1] }, { 'data-handle': 'scale:' + k, style: `cursor:${k === 'nw' || k === 'se' ? 'nwse' : 'nesw'}-resize` }, O);
      }
      const cx = (a.x + b.x) / 2, ry = a.y - 26;
      svgEl('line', { x1: cx, y1: a.y, x2: cx, y2: ry, stroke: col, 'stroke-width': 1, 'pointer-events': 'none' }, O);
      svgEl('circle', { cx, cy: ry, r: HANDLE / 2 + 1, fill: '#fff', stroke: col, 'stroke-width': 1.5, 'data-handle': 'rotate', style: 'cursor:grab' }, O);
    }
    if (S.op && S.op.type === 'rotate') {
      const c = toScreen(S.op.c);
      const tt = svgEl('text', { x: c.x, y: c.y - 8, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#fff', stroke: '#000', 'stroke-width': 3, 'paint-order': 'stroke', 'font-family': 'system-ui, sans-serif', 'pointer-events': 'none' }, O);
      tt.textContent = `${fmt(S.op.angle || 0, 1)}°`;
    }
  }
  if (showNodes) renderNodeOverlay(O, targets[0]);
  if (S.pathDraft) renderDraftOverlay(O);
  // marquee
  if (S.op && S.op.type === 'marquee') {
    const a = toScreen(S.op.start), b = toScreen(S.op.cur);
    svgEl('rect', { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), fill: 'rgba(78,161,255,.1)', stroke: sel, 'stroke-width': 1, 'stroke-dasharray': '3 3', 'pointer-events': 'none' }, O);
  }
  // snap guides
  for (const g of S.guides) {
    if (g.axis === 'x') {
      const p1 = toScreen({ x: g.v, y: g.from }), p2 = toScreen({ x: g.v, y: g.to });
      svgEl('line', { x1: p1.x, y1: p1.y - 12, x2: p2.x, y2: p2.y + 12, stroke: 'var(--guide)', 'stroke-width': 1, 'pointer-events': 'none', 'data-guide': 'x:' + num(g.v) }, O);
    } else {
      const p1 = toScreen({ x: g.from, y: g.v }), p2 = toScreen({ x: g.to, y: g.v });
      svgEl('line', { x1: p1.x - 12, y1: p1.y, x2: p2.x + 12, y2: p2.y, stroke: 'var(--guide)', 'stroke-width': 1, 'pointer-events': 'none', 'data-guide': 'y:' + num(g.v) }, O);
    }
  }
}
function resizeCursor(k, n, W) {
  const base = { n: 90, s: 90, e: 0, w: 0, ne: 45, sw: 45, nw: 135, se: 135 }[k];
  const rot = Math.atan2(W[1], W[0]) * 180 / Math.PI;
  let a = ((base - rot) % 180 + 180) % 180;
  const opts = [[0, 'ew'], [45, 'nesw'], [90, 'ns'], [135, 'nwse'], [180, 'ew']];
  let best = opts[0];
  for (const o of opts) if (Math.abs(o[0] - a) < Math.abs(best[0] - a)) best = o;
  return best[1] + '-resize';
}
function renderNodeOverlay(O, id) {
  const n = S.doc.nodes[id];
  const W = worldMatrix(S.doc, id);
  const P = (x, y) => toScreen(mApply(W, x, y));
  const locked = effLocked(S.doc, id);
  const col = locked ? 'var(--lock)' : 'var(--sel)';
  const selIdx = S.nodeSel && S.nodeSel.id === id ? S.nodeSel.index : -1;
  if (n.type === 'line') {
    const a = P(n.x1, n.y1), b = P(n.x2, n.y2);
    svgEl('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, 'stroke-width': 1, 'pointer-events': 'none' }, O);
    [a, b].forEach((p, i) => handleRect(p, { 'data-node': `${i}:a`, fill: i === selIdx ? col : '#fff', stroke: col, style: 'cursor:move' }, O));
    return;
  }
  const A = n.anchors;
  // outline of the actual curve
  let d = '';
  const p0 = P(A[0].x, A[0].y);
  d = `M${p0.x} ${p0.y}`;
  for (const [a, b] of pathSegments(n)) {
    const c1 = P(a.outX, a.outY), c2 = P(b.inX, b.inY), e = P(b.x, b.y);
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`;
  }
  if (n.closed) d += ' Z';
  svgEl('path', { d, fill: 'none', stroke: col, 'stroke-width': 1, 'pointer-events': 'none' }, O);
  A.forEach((a, i) => {
    const pa = P(a.x, a.y);
    const hasIn = n.closed || i > 0, hasOut = n.closed || i < A.length - 1;
    for (const [part, hx, hy, used] of [['in', a.inX, a.inY, hasIn], ['out', a.outX, a.outY, hasOut]]) {
      if (!used) continue;
      const ph = P(hx, hy);
      if (Math.hypot(ph.x - pa.x, ph.y - pa.y) < 1) continue;
      svgEl('line', { x1: pa.x, y1: pa.y, x2: ph.x, y2: ph.y, stroke: col, 'stroke-width': 1, opacity: 0.8, 'pointer-events': 'none' }, O);
      svgEl('circle', { cx: ph.x, cy: ph.y, r: HANDLE / 2, fill: '#fff', stroke: col, 'stroke-width': 1.5, 'data-node': `${i}:${part}`, style: 'cursor:crosshair' }, O);
    }
  });
  A.forEach((a, i) => {
    const pa = P(a.x, a.y);
    handleRect(pa, { 'data-node': `${i}:a`, fill: i === selIdx ? col : '#fff', stroke: col, style: 'cursor:move' }, O);
  });
}
function renderDraftOverlay(O) {
  const D = S.pathDraft;
  const A = D.anchors;
  if (!A.length) return;
  const P = (x, y) => toScreen({ x, y });
  let d = '';
  const p0 = P(A[0].x, A[0].y);
  d = `M${p0.x} ${p0.y}`;
  for (let i = 0; i < A.length - 1; i++) {
    const a = A[i], b = A[i + 1];
    const c1 = P(a.outX, a.outY), c2 = P(b.inX, b.inY), e = P(b.x, b.y);
    d += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`;
  }
  svgEl('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'pointer-events': 'none' }, O);
  if (S.hoverPt && !(S.op && S.op.type === 'pathHandle')) {
    const last = A[A.length - 1];
    const c1 = P(last.outX, last.outY), e = P(S.hoverPt.x, S.hoverPt.y);
    svgEl('path', { d: `M${P(last.x, last.y).x} ${P(last.x, last.y).y} C${c1.x} ${c1.y} ${e.x} ${e.y} ${e.x} ${e.y}`, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none' }, O);
  }
  A.forEach((a, i) => {
    const pa = P(a.x, a.y);
    for (const [hx, hy] of [[a.inX, a.inY], [a.outX, a.outY]]) {
      const ph = P(hx, hy);
      if (Math.hypot(ph.x - pa.x, ph.y - pa.y) < 1) continue;
      svgEl('line', { x1: pa.x, y1: pa.y, x2: ph.x, y2: ph.y, stroke: 'var(--accent)', 'stroke-width': 1, 'pointer-events': 'none' }, O);
      svgEl('circle', { cx: ph.x, cy: ph.y, r: 3.5, fill: '#fff', stroke: 'var(--accent)', 'pointer-events': 'none' }, O);
    }
    handleRect(pa, { fill: i === 0 && A.length > 1 ? 'var(--accent)' : '#fff', stroke: 'var(--accent)', 'pointer-events': 'none' }, O);
  });
}

/* ---------------- snapping ---------------- */
function snapTargetsFor(movingIds) {
  const doc = S.doc;
  const exclude = new Set();
  for (const id of movingIds) {
    subtreeIds(doc, id).forEach((x) => exclude.add(x));
    ancestorsOf(doc, id).forEach((x) => exclude.add(x));
  }
  const ab = doc.artboard;
  const abB = { x: 0, y: 0, w: ab.width, h: ab.height };
  const xs = [0, ab.width / 2, ab.width].map((v) => ({ v, b: abB }));
  const ys = [0, ab.height / 2, ab.height].map((v) => ({ v, b: abB }));
  if (S.snapObj) {
    for (const id of paintOrder(doc)) {
      if (exclude.has(id) || !effVisible(doc, id)) continue;
      const b = nodeBounds(doc, id);
      if (!b) continue;
      xs.push({ v: b.x, b }, { v: b.x + b.w / 2, b }, { v: b.x + b.w, b });
      ys.push({ v: b.y, b }, { v: b.y + b.h / 2, b }, { v: b.y + b.h, b });
    }
  } else { xs.length = 0; ys.length = 0; }
  return { xs, ys, abB };
}
// Nearest eligible target within 6 CSS px; ties → lower target, then lower moving feature.
function snapAxis(features, targets, thr) {
  let best = null;
  const consider = (t, f, b) => {
    const d = Math.abs(t - f);
    if (d > thr + 1e-9) return;
    if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && (t < best.t - 1e-9 || (Math.abs(t - best.t) <= 1e-9 && f < best.f)))) best = { d, t, f, b };
  };
  for (const f of features) {
    for (const t of targets) consider(t.v, f, t.b);
    if (S.snapGrid) { const g = Math.round(f / S.gridSize) * S.gridSize; consider(g, f, null); }
  }
  return best;
}
function snapBox(bb, T) {
  const thr = 6 / S.view.zoom;
  const out = { dx: 0, dy: 0, guides: [] };
  if (!S.snapObj && !S.snapGrid) return out;
  const sx = snapAxis([bb.x, bb.x + bb.w / 2, bb.x + bb.w], T.xs, thr);
  const sy = snapAxis([bb.y, bb.y + bb.h / 2, bb.y + bb.h], T.ys, thr);
  if (sx) out.dx = sx.t - sx.f;
  if (sy) out.dy = sy.t - sy.f;
  const nb = { x: bb.x + out.dx, y: bb.y + out.dy, w: bb.w, h: bb.h };
  if (sx) { const ob = sx.b || T.abB; out.guides.push({ axis: 'x', v: sx.t, from: Math.min(nb.y, ob.y), to: Math.max(nb.y + nb.h, ob.y + ob.h) }); }
  if (sy) { const ob = sy.b || T.abB; out.guides.push({ axis: 'y', v: sy.t, from: Math.min(nb.x, ob.x), to: Math.max(nb.x + nb.w, ob.x + ob.w) }); }
  return out;
}
function snapPoint(p, T) {
  const r = snapBox({ x: p.x, y: p.y, w: 0, h: 0 }, T);
  return { x: p.x + r.dx, y: p.y + r.dy, guides: r.guides };
}

/* ---------------- node factories ---------------- */
function newBase(doc, type, extra) {
  return Object.assign({ id: extra && extra.id ? extra.id : genId(doc), type, parent: null, name: nextName(doc, type), visible: true, locked: false, transform: { x: 0, y: 0, rotation: 0, scale: 1 }, opacity: 1 }, extra);
}
function ink(doc) { return darkBg(doc) ? '#f4efe6' : '#1d1d1f'; }
function makeShape(doc, kind, box, id) {
  const dark = darkBg(doc);
  if (kind === 'rect') return newBase(doc, 'rect', { id, transform: { x: round(box.x, 4), y: round(box.y, 4), rotation: 0, scale: 1 }, width: round(box.w, 4), height: round(box.h, 4), radius: 0, fill: dark ? '#4ea1ff' : '#ff6a3d', stroke: 'none', strokeWidth: 2 });
  return newBase(doc, 'ellipse', { id, transform: { x: round(box.x, 4), y: round(box.y, 4), rotation: 0, scale: 1 }, width: round(box.w, 4), height: round(box.h, 4), fill: dark ? '#ffd166' : '#2f6fde', stroke: 'none', strokeWidth: 2 });
}
function addNode(d, n, parent = null, index = null) {
  n.parent = parent;
  d.nodes[n.id] = n;
  const list = childList(d, parent);
  if (index == null) list.push(n.id); else list.splice(index, 0, n.id);
  return n.id;
}
function removeSubtree(d, id) {
  const n = d.nodes[id];
  if (!n) return;
  const list = childList(d, n.parent);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  for (const x of subtreeIds(d, id)) delete d.nodes[x];
  // prune groups left empty
  let p = n.parent;
  while (p && d.nodes[p] && d.nodes[p].children.length === 0) {
    const pn = d.nodes[p];
    const pl = childList(d, pn.parent);
    pl.splice(pl.indexOf(p), 1);
    delete d.nodes[p];
    p = pn.parent;
  }
}
function cloneSubtree(d, id, parent) {
  const src = d.nodes[id];
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = genId(d);
  copy.parent = parent;
  d.nodes[copy.id] = copy;
  if (src.type === 'group') copy.children = src.children.map((c) => cloneSubtree(d, c, copy.id));
  return copy.id;
}

/* ---------------- commands ---------------- */
function cmdDelete() {
  const t = selTargets();
  if (!t.length) return;
  const n = t.length;
  if (edit(n > 1 ? `Delete ${n} items` : 'Delete', (d) => { for (const id of t) removeSubtree(d, id); return []; })) setIO(`Deleted ${n} item${n > 1 ? 's' : ''}`);
}
function cmdDuplicate() {
  const t = selTargets();
  if (!t.length) return;
  edit('Duplicate', (d) => {
    const out = [];
    for (const id of t) {
      const n = d.nodes[id];
      const cid = cloneSubtree(d, id, n.parent);
      d.nodes[cid].name = (n.name + ' copy').slice(0, LIMITS.name);
      const list = childList(d, n.parent);
      list.splice(list.indexOf(id) + 1, 0, cid);
      translateDoc(d, cid, 10, 10);
      out.push(cid);
    }
    return out;
  });
}
function cmdGroup() {
  const t = selTargets();
  if (!t.length) { toast('Select items to group.', 'warn'); return; }
  const parent = S.doc.nodes[t[0]].parent;
  if (t.some((id) => S.doc.nodes[id].parent !== parent)) {
    toast('Can’t group: the selected items belong to different parents. Grouping them would change which objects overlap. Select siblings at one level.', 'error', 6500);
    return;
  }
  const list = childList(S.doc, parent);
  const idx = t.map((id) => list.indexOf(id)).sort((a, b) => a - b);
  if (idx.some((v, i) => v !== idx[0] + i)) {
    toast('Can’t group: the selected siblings are not adjacent in layer order, so grouping would change occlusion. Reorder them to be adjacent first.', 'error', 6500);
    return;
  }
  let gid = null;
  const ok = edit('Group', (d) => {
    const L = childList(d, parent);
    const members = L.slice(idx[0], idx[0] + t.length);
    gid = genId(d);
    let k = 1;
    for (const id in d.nodes) if (d.nodes[id].type === 'group') k++;
    L.splice(idx[0], t.length, gid);
    d.nodes[gid] = { id: gid, type: 'group', parent, name: `Group ${k}`, visible: true, locked: false, transform: { x: 0, y: 0, rotation: 0, scale: 1 }, opacity: 1, children: members };
    for (const m of members) d.nodes[m].parent = gid;
    return [gid];
  });
  if (ok) { S.expanded.add(gid); setIO(`Grouped ${t.length} item${t.length > 1 ? 's' : ''}`); render(); }
}
function cmdUngroup() {
  const groups = selTargets().filter((id) => S.doc.nodes[id].type === 'group');
  if (!groups.length) { toast('Select a group to ungroup.', 'warn'); return; }
  const ok = edit('Ungroup', (d) => {
    const out = [];
    for (const gid of groups) {
      const g = d.nodes[gid];
      const Lg = localMatrix(g);
      const list = childList(d, g.parent);
      const i = list.indexOf(gid);
      for (const c of g.children) {
        const cn = d.nodes[c];
        cn.transform = trsFromMatrix(mMul(Lg, localMatrix(cn)));
        cn.parent = g.parent;
        if (g.opacity < 1) cn.opacity = round(cn.opacity * g.opacity, 4);
        if (!g.visible) cn.visible = false;
      }
      list.splice(i, 1, ...g.children);
      out.push(...g.children);
      delete d.nodes[gid];
    }
    return out;
  });
  if (ok) setIO(`Ungrouped ${groups.length} group${groups.length > 1 ? 's' : ''}`);
}
function cmdReorder(dir) {
  const t = selTargets();
  if (!t.length) return;
  const lockedId = t.find((id) => effLocked(S.doc, id));
  if (lockedId) { toast(`“${S.doc.nodes[lockedId].name}” is locked; unlock it in Layers to change its order.`, 'error'); return; }
  const label = { up: 'Bring forward', down: 'Send backward', front: 'Bring to front', back: 'Send to back' }[dir];
  edit(label, (d) => {
    const byParent = new Map();
    for (const id of t) { const p = d.nodes[id].parent; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(id); }
    for (const [p, ids] of byParent) {
      const L = childList(d, p);
      const set = new Set(ids);
      if (dir === 'front' || dir === 'back') {
        const moving = L.filter((x) => set.has(x));
        const rest = L.filter((x) => !set.has(x));
        L.splice(0, L.length, ...(dir === 'front' ? rest.concat(moving) : moving.concat(rest)));
      } else if (dir === 'up') {
        for (let i = L.length - 2; i >= 0; i--) if (set.has(L[i]) && !set.has(L[i + 1])) [L[i], L[i + 1]] = [L[i + 1], L[i]];
      } else {
        for (let i = 1; i < L.length; i++) if (set.has(L[i]) && !set.has(L[i - 1])) [L[i], L[i - 1]] = [L[i - 1], L[i]];
      }
    }
  });
}
function cmdAlign(mode) {
  const t = selTargets();
  if (!t.length) return;
  const ab = S.doc.artboard;
  const ref = t.length === 1 ? { x: 0, y: 0, w: ab.width, h: ab.height } : unionBounds(S.doc, t);
  const ok = edit('Align ' + mode, (d) => {
    for (const id of t) {
      const b = nodeBounds(d, id);
      let dx = 0, dy = 0;
      if (mode === 'left') dx = ref.x - b.x;
      if (mode === 'hcenter') dx = (ref.x + ref.w / 2) - (b.x + b.w / 2);
      if (mode === 'right') dx = (ref.x + ref.w) - (b.x + b.w);
      if (mode === 'top') dy = ref.y - b.y;
      if (mode === 'vmiddle') dy = (ref.y + ref.h / 2) - (b.y + b.h / 2);
      if (mode === 'bottom') dy = (ref.y + ref.h) - (b.y + b.h);
      if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) translateDoc(d, id, dx, dy);
    }
  });
  if (ok) setIO(t.length === 1 ? `Aligned to artboard (${mode})` : `Aligned ${t.length} items (${mode})`);
}
function cmdDistribute(axis) {
  const t = selTargets();
  if (t.length < 3) { toast('Select three or more items to distribute with equal gaps.', 'warn'); return; }
  const lead = axis === 'x' ? 'x' : 'y', ext = axis === 'x' ? 'w' : 'h';
  const items = t.map((id) => ({ id, b: nodeBounds(S.doc, id) }));
  items.sort((p, q) => (p.b[lead] - q.b[lead]) || naturalCmp(p.id, q.id));
  const first = items[0], last = items[items.length - 1];
  const span = (last.b[lead] + last.b[ext]) - first.b[lead];
  const sum = items.reduce((s, it) => s + it.b[ext], 0);
  const word = axis === 'x' ? 'widths' : 'heights';
  if (span < sum - 1e-9) {
    toast(`Can’t distribute: the items’ combined ${word} (${fmt(sum)}) exceed the span between the outermost items (${fmt(span)}). Equal gaps would require overlap, so nothing was changed.`, 'error', 7000);
    return;
  }
  const gap = (span - sum) / (items.length - 1);
  const ok = edit(axis === 'x' ? 'Distribute horizontally' : 'Distribute vertically', (d) => {
    let pos = first.b[lead] + first.b[ext] + gap;
    for (let i = 1; i < items.length - 1; i++) {
      const it = items[i];
      const delta = pos - it.b[lead];
      if (Math.abs(delta) > 1e-9) translateDoc(d, it.id, axis === 'x' ? delta : 0, axis === 'y' ? delta : 0);
      pos += it.b[ext] + gap;
    }
  });
  if (ok || true) setIO(`Distributed ${items.length} items — equal gap ${fmt(gap)}`);
}
function cmdNudge(dx, dy) {
  const t = selTargets();
  if (!t.length) return;
  edit('Nudge', (d) => { for (const id of t) translateDoc(d, id, dx, dy); });
}
function cmdSelectAll() {
  S.sel = S.doc.root.filter((id) => effVisible(S.doc, id));
  render();
}
function transformTargets(d, targets, M) { for (const id of targets) applyWorld(d, id, M); }
function centerOf(d, targets) { const U = unionBounds(d, targets); return { x: U.x + U.w / 2, y: U.y + U.h / 2 }; }
function toggleProp(id, prop) {
  const n = S.doc.nodes[id];
  if (!n) return;
  const v = !n[prop];
  const label = prop === 'visible' ? (v ? 'Show' : 'Hide') : (v ? 'Lock' : 'Unlock');
  if (edit(`${label} “${n.name}”`, (d) => { d.nodes[id][prop] = v; })) setIO(`${label}: ${n.name}`);
}

/* ---------------- documents: new / load / import / reset ---------------- */
function blankDoc() { return { artboard: { width: 1200, height: 800, background: '#ffffff', transparent: false }, root: [], nodes: {} }; }
function cancelTransient() {
  if (S.op) { S.op = null; }
  S.live = null;
  S.pathDraft = null; S.pinch = null; S.pointers.clear(); S.guides = []; S.hoverId = null;
  closePreview();
}
function replaceDoc(doc, name, msg) {
  cancelTransient();
  S.doc = doc;
  S.sel = []; S.nodeSel = null;
  S.hist = { past: [], future: [] };
  S.docName = name;
  S.expanded = new Set();
  INS.sig = ''; LY.sig = '';
  fitView();
  render();
  toast(`${msg} — undo history cleared.`, 'ok');
  setIO(msg);
}
function confirmReplace(title) {
  if (!S.hist.past.length && !S.hist.future.length) return Promise.resolve(true);
  return openModal(title, `${title} replaces the current document and clears undo/redo history. Download a Project JSON first if you want to keep this work.`, [{ label: 'Cancel', value: false }, { label: 'Replace document', value: true, primary: true }]);
}
function cmdNew() {
  confirmReplace('New document').then((ok) => { if (ok) replaceDoc(blankDoc(), 'Untitled', 'New blank document (1200 × 800)'); });
}
function loadComposition(key, silent) {
  const c = COMPOSITIONS[key];
  const doc = projectToDoc(JSON.parse(JSON.stringify(c.project)));
  if (silent) return doc;
  confirmReplace(`Load “${c.title}”`).then((ok) => { if (ok) replaceDoc(doc, c.title, `Loaded composition “${c.title}”`); });
  return doc;
}
function importFile(f) {
  const token = S.session;
  const name = String(f.name || 'file').slice(0, 80);
  const lower = name.toLowerCase();
  const failImport = (m) => { toast(`Import refused: ${m} The current document was not changed.`, 'error', 7000); setIO(`Import refused: ${m}`, true); };
  if (f.size > LIMITS.importBytes) return failImport(`“${name}” is ${(f.size / 1048576).toFixed(1)} MB; projects are limited to ${LIMITS.importBytes / 1048576} MB.`);
  if (/\.(svg|svgz|html?|xhtml|xml|js|mjs)$/.test(lower) || /svg|html|xml|javascript/.test(f.type || '')) return failImport('SVG, HTML, XML and script files are not supported — only Vector & Layout Studio project JSON.');
  if (/^image\//.test(f.type || '') || /\.(png|jpe?g|webp|gif|bmp)$/.test(lower)) return failImport('raster image import is not supported in this build — only project JSON.');
  setIO(`Reading “${name}”…`);
  S.pendingImport = token;
  f.text().then((text) => {
    if (token !== S.session) return;
    S.pendingImport = null;
    let doc;
    try { doc = parseProjectText(text); }
    catch (e) { return failImport(e instanceof UserError ? e.message : 'Could not parse the project.'); }
    confirmReplace('Import').then((ok) => {
      if (token !== S.session) return;
      if (!ok) { setIO('Import cancelled — document unchanged'); return; }
      replaceDoc(doc, name.replace(/\.json$/i, '').replace(/\.vls$/i, ''), `Imported “${name}” (${Object.keys(doc.nodes).length} items)`);
    });
  }, () => { if (token === S.session) { S.pendingImport = null; failImport('the file could not be read.'); } });
}
function resetSession() {
  S.session++;
  clearTimers();
  closeModal(undefined);
  cancelTransient();
  for (const u of S.urls) URL.revokeObjectURL(u);
  S.urls.clear();
  fileImport.value = '';
  S.pendingImport = null;
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  $('#toasts').replaceChildren();
  S.doc = loadComposition('solstice', true);
  S.sel = []; S.nodeSel = null;
  S.hist = { past: [], future: [] };
  S.tool = 'select'; S.docName = COMPOSITIONS.solstice.title;
  S.snapGrid = false; S.snapObj = true; S.showGrid = false; S.gridSize = 10; S.addMode = false;
  S.expanded = new Set(); S.idSeq = 0;
  $('#compSelect').value = 'solstice'; $('#pngScale').value = '1';
  syncCanvasBar();
  INS.sig = ''; LY.sig = '';
  setPanelTab('inspect');
  fitView();
  render();
  toast('Session reset: initial composition restored; selection, history, imports and pending work cleared.', 'ok');
  setIO('Session reset (not undoable)');
}

/* ---------------- export ---------------- */
const slug = () => (S.docName || 'artboard').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artboard';
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  S.urls.add(url);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  later(() => { URL.revokeObjectURL(url); S.urls.delete(url); }, 30000);
}
function exportJSON() {
  if (S.live) commitLive();
  const txt = JSON.stringify(docToProject(S.doc), null, 2);
  download(new Blob([txt], { type: 'application/json' }), `${slug()}.vls.json`);
  setIO(`Exported project JSON · ${Object.keys(S.doc.nodes).length} items · ${(txt.length / 1024).toFixed(1)} KB`);
}
function exportSVG() {
  if (S.live) commitLive();
  const s = exportSVGString(S.doc, S.docName);
  download(new Blob([s], { type: 'image/svg+xml' }), `${slug()}.svg`);
  setIO(`Exported SVG · ${S.doc.artboard.width}×${S.doc.artboard.height}`);
}
function exportPNG() {
  if (S.live) commitLive();
  const scale = Number($('#pngScale').value) || 1;
  let cv;
  try { cv = renderPNGCanvas(S.doc, scale); }
  catch (e) {
    if (e instanceof UserError) { toast(`PNG export refused: ${e.message}`, 'error', 6500); setIO(`PNG refused: ${e.message}`, true); return; }
    throw e;
  }
  const token = S.session;
  setIO(`Encoding PNG ${cv.width}×${cv.height}…`);
  cv.toBlob((blob) => {
    if (token !== S.session) return;
    if (!blob) { toast('PNG encoding failed; the document is unchanged.', 'error'); setIO('PNG encoding failed', true); return; }
    download(blob, `${slug()}@${scale}x.png`);
    setIO(`Exported PNG ${cv.width}×${cv.height} px (${scale}x)`);
  }, 'image/png');
}
function openPreview() {
  if (S.live) commitLive();
  closePreview();
  const s = exportSVGString(S.doc, S.docName);
  const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
  S.previewUrl = url;
  const img = $('#previewImg');
  img.classList.toggle('transparent', S.doc.artboard.transparent);
  img.src = url;
  img.width = S.doc.artboard.width; img.height = S.doc.artboard.height;
  $('#previewInfo').textContent = `${S.doc.artboard.width} × ${S.doc.artboard.height} · rendered from the SVG export${S.doc.artboard.transparent ? ' · transparent background' : ''}`;
  $('#preview').hidden = false;
  $('#previewClose').focus();
}
function closePreview() {
  const p = $('#preview');
  if (p) p.hidden = true;
  if (S.previewUrl) { URL.revokeObjectURL(S.previewUrl); S.previewUrl = null; $('#previewImg').removeAttribute('src'); }
}

/* ---------------- modal ---------------- */
function openModal(title, body, buttons) {
  closeModal(undefined);
  return new Promise((resolve) => {
    const m = $('#modal');
    $('#modalTitle').textContent = title;
    const b = $('#modalBody');
    b.replaceChildren();
    if (typeof body === 'string') { const p = document.createElement('p'); p.textContent = body; b.appendChild(p); }
    else b.appendChild(body);
    const acts = $('#modalActions');
    acts.replaceChildren();
    let first = null;
    for (const btn of buttons) {
      const el = document.createElement('button');
      el.className = 'btn' + (btn.primary ? ' primary' : '');
      el.textContent = btn.label;
      el.addEventListener('click', () => closeModal(btn.value));
      acts.appendChild(el);
      if (btn.primary || !first) first = el;
    }
    S.modal = { resolve, prevFocus: document.activeElement };
    m.hidden = false;
    (first || acts.firstChild).focus();
  });
}
function closeModal(value) {
  const M = S.modal;
  $('#modal').hidden = true;
  if (!M) return;
  S.modal = null;
  M.resolve(value === undefined ? false : value);
  if (M.prevFocus && M.prevFocus.focus && document.contains(M.prevFocus)) M.prevFocus.focus();
}
function showShortcuts() {
  const rows = [
    ['V / A', 'Select / Node (direct point) tool'], ['R / E / L / P / T / H', 'Rectangle, Ellipse, Line, Path, Text, Hand'],
    ['Shift-click · drag empty', 'Add to selection · marquee'], ['Ctrl/⌘-click', 'Select an item inside a group'],
    ['Double-click', 'Enter group · edit text · edit path points'], ['Arrows (+Shift)', 'Nudge 1 (10) units — exact, never snapped'],
    ['Ctrl+D · Delete', 'Duplicate · delete'], ['Ctrl+G · Ctrl+Shift+G', 'Group · ungroup'],
    ['] / [ · Ctrl+Shift+] / [', 'Forward / backward · to front / back'], ['Ctrl+Z · Ctrl+Shift+Z / Ctrl+Y', 'Undo · redo'],
    ['Space-drag · wheel', 'Pan'], ['Ctrl+wheel · + / − · 0 · 1 · 2', 'Zoom · fit · 100% · 200%'],
    ['Esc', 'Cancel drag / finish path / clear selection'], ['Enter / Ctrl+Enter', 'Commit field / commit text'],
  ];
  const t = document.createElement('table');
  for (const [k, v] of rows) {
    const tr = t.insertRow();
    const a = tr.insertCell(), b = tr.insertCell();
    k.split(' · ').forEach((part, i) => { if (i) a.append(' · '); const kb = document.createElement('kbd'); kb.textContent = part; a.appendChild(kb); });
    b.textContent = v;
  }
  openModal('Keyboard shortcuts', t, [{ label: 'Close', value: true, primary: true }]);
}

/* ---------------- tools ---------------- */
const ICON = {
  select: '<path d="M5 3l10 6.2-4.6 1.1L8.3 15z" fill="currentColor"/>',
  node: '<path d="M4 15C6 6 11 5 16 5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2.5" y="13.5" width="3.5" height="3.5" fill="currentColor"/><rect x="14.3" y="3.3" width="3.5" height="3.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="5.2" r="1.6" fill="currentColor"/>',
  rect: '<rect x="3.5" y="5" width="13" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  ellipse: '<ellipse cx="10" cy="10" rx="6.5" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  line: '<path d="M4 16L16 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  path: '<path d="M3 16C4 9 8 4 16 4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 3.8L16.2 4 12.4 9.8" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="3" cy="16" r="1.7" fill="currentColor"/>',
  text: '<path d="M4.5 5V3.8h11V5M10 3.8V16.2M7.6 16.2h4.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  hand: '<path d="M7 10V4.8a1.2 1.2 0 0 1 2.4 0V9.5V3.8a1.2 1.2 0 0 1 2.4 0V9.5V4.8a1.2 1.2 0 0 1 2.4 0v6.4c0 3-1.8 5.3-5 5.3-2.2 0-3.4-1-4.6-3l-1.6-2.8a1.1 1.1 0 0 1 1.9-1.1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  group: '<rect x="2.5" y="2.5" width="15" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.5 2"/><rect x="5.5" y="5.5" width="5" height="5" fill="currentColor"/><circle cx="12.5" cy="12.5" r="2.6" fill="currentColor"/>',
  eye: '<path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="2.4" fill="currentColor"/>',
  eyeOff: '<path d="M3 3l14 14M8.2 5a8.6 8.6 0 0 1 1.8-.2c5 0 8.2 5.2 8.2 5.2a14 14 0 0 1-2.4 2.9M5.3 6.4A14.4 14.4 0 0 0 1.8 10S5 15.2 10 15.2a7.4 7.4 0 0 0 3.2-.7" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  lock: '<rect x="4.5" y="9" width="11" height="8" rx="1.5" fill="currentColor"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  unlock: '<rect x="4.5" y="9" width="11" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 9V6.5a3 3 0 0 1 5.8-1" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  chevR: '<path d="M8 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  chevD: '<path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  aL: '<path d="M3 2v16" stroke="currentColor" stroke-width="1.6"/><rect x="5" y="5" width="10" height="3.5" fill="currentColor"/><rect x="5" y="11.5" width="6" height="3.5" fill="currentColor"/>',
  aC: '<path d="M10 2v16" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="5" width="12" height="3.5" fill="currentColor" opacity=".85"/><rect x="6.5" y="11.5" width="7" height="3.5" fill="currentColor" opacity=".85"/>',
  aR: '<path d="M17 2v16" stroke="currentColor" stroke-width="1.6"/><rect x="5" y="5" width="10" height="3.5" fill="currentColor"/><rect x="9" y="11.5" width="6" height="3.5" fill="currentColor"/>',
  aT: '<path d="M2 3h16" stroke="currentColor" stroke-width="1.6"/><rect x="5" y="5" width="3.5" height="10" fill="currentColor"/><rect x="11.5" y="5" width="3.5" height="6" fill="currentColor"/>',
  aM: '<path d="M2 10h16" stroke="currentColor" stroke-width="1.6"/><rect x="5" y="4" width="3.5" height="12" fill="currentColor" opacity=".85"/><rect x="11.5" y="6.5" width="3.5" height="7" fill="currentColor" opacity=".85"/>',
  aB: '<path d="M2 17h16" stroke="currentColor" stroke-width="1.6"/><rect x="5" y="5" width="3.5" height="10" fill="currentColor"/><rect x="11.5" y="9" width="3.5" height="6" fill="currentColor"/>',
  dH: '<path d="M2 3v14M18 3v14" stroke="currentColor" stroke-width="1.4"/><rect x="4.5" y="6" width="3" height="8" fill="currentColor"/><rect x="8.5" y="6" width="3" height="8" fill="currentColor"/><rect x="12.5" y="6" width="3" height="8" fill="currentColor"/>',
  dV: '<path d="M3 2h14M3 18h14" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="4.5" width="8" height="3" fill="currentColor"/><rect x="6" y="8.5" width="8" height="3" fill="currentColor"/><rect x="6" y="12.5" width="8" height="3" fill="currentColor"/>',
  tL: '<path d="M3 5h14M3 9h9M3 13h12M3 17h7" stroke="currentColor" stroke-width="1.6"/>',
  tC: '<path d="M3 5h14M5.5 9h9M4 13h12M6.5 17h7" stroke="currentColor" stroke-width="1.6"/>',
  tR: '<path d="M3 5h14M8 9h9M5 13h12M10 17h7" stroke="currentColor" stroke-width="1.6"/>',
};
function icon(name) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('viewBox', '0 0 20 20');
  s.setAttribute('aria-hidden', 'true');
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg xmlns="${SVGNS}">${ICON[name]}</svg>`; // constant markup only — never user data
  for (const c of [...tpl.content.firstChild.childNodes]) s.appendChild(c);
  return s;
}
const TOOLS = [
  { id: 'select', key: 'V', label: 'Select / move' }, { id: 'node', key: 'A', label: 'Node — edit path points & handles' }, null,
  { id: 'rect', key: 'R', label: 'Rectangle' }, { id: 'ellipse', key: 'E', label: 'Ellipse' }, { id: 'line', key: 'L', label: 'Line' },
  { id: 'path', key: 'P', label: 'Path (cubic Bézier pen)' }, { id: 'text', key: 'T', label: 'Text' }, null,
  { id: 'hand', key: 'H', label: 'Hand — pan' },
];
function buildTools() {
  const nav = $('#tools');
  for (const t of TOOLS) {
    if (!t) { const s = document.createElement('div'); s.className = 'tool-sep'; nav.appendChild(s); continue; }
    const b = document.createElement('button');
    b.className = 'tool'; b.dataset.tool = t.id;
    b.title = `${t.label} (${t.key})`;
    b.setAttribute('aria-label', `${t.label} tool`);
    b.setAttribute('aria-pressed', 'false');
    b.appendChild(icon(t.id));
    const k = document.createElement('kbd'); k.textContent = t.key; b.appendChild(k);
    b.addEventListener('click', () => setTool(t.id));
    nav.appendChild(b);
  }
}
function setTool(t) {
  if (S.op) cancelOp();
  if (S.pathDraft && t !== 'path') finishPath(false);
  S.tool = t;
  if (t === 'node') {
    const tg = selTargets();
    if (tg.length === 1 && ['path', 'line'].includes(S.doc.nodes[tg[0]].type)) S.nodeSel = S.nodeSel && S.nodeSel.id === tg[0] ? S.nodeSel : { id: tg[0], index: 0 };
  }
  render();
}

/* ---------------- pointer interaction ---------------- */
function hitId(target) {
  const g = target && target.closest ? target.closest('[data-id]') : null;
  return g && sceneG.contains(g) ? g.getAttribute('data-id') : null;
}
function pickTarget(leaf, deep) {
  if (deep) return leaf;
  const chain = [leaf, ...ancestorsOf(S.doc, leaf)].reverse(); // root-level first
  for (const id of chain) if (S.sel.includes(id)) return id;
  const ctx = S.sel.length && S.doc.nodes[S.sel[0]] ? S.doc.nodes[S.sel[0]].parent : null;
  if (ctx) { const i = chain.indexOf(ctx); if (i >= 0 && i < chain.length - 1) return chain[i + 1]; }
  return chain[0];
}
function revealInLayers(ids) {
  for (const id of ids) if (S.doc.nodes[id]) for (const a of ancestorsOf(S.doc, id)) S.expanded.add(a);
}
function onPointerDown(e) {
  if (S.modal) return;
  const ae = document.activeElement;
  if (ae && ae !== stage && ae !== document.body && isField(ae)) ae.blur();
  if (document.activeElement !== stage) stage.focus({ preventScroll: true });
  S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (S.pointers.size === 2) {
    if (S.op) cancelOp(true);
    const [p1, p2] = [...S.pointers.values()];
    const r = stage.getBoundingClientRect();
    S.pinch = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, mx: (p1.x + p2.x) / 2 - r.left, my: (p1.y + p2.y) / 2 - r.top, z0: S.view.zoom, px0: S.view.px, py0: S.view.py };
    return;
  }
  if (S.pointers.size > 2 || S.op) return;
  const pt = toDoc(e.clientX, e.clientY);
  if (e.button === 1 || (e.button === 0 && (S.spaceDown || S.tool === 'hand'))) {
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    S.op = { type: 'pan', pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, px0: S.view.px, py0: S.view.py };
    stage.classList.add('panning', 'dragging');
    return;
  }
  if (e.button !== 0) return;
  try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  const base = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY };
  switch (S.tool) {
    case 'select': downSelect(e, pt, base); break;
    case 'node': downNode(e, pt, base); break;
    case 'rect': case 'ellipse': case 'line': downCreate(e, pt, base); break;
    case 'text': downText(e, pt); break;
    case 'path': downPath(e, pt, base); break;
  }
}
function downSelect(e, pt, base) {
  const h = e.target.closest && e.target.closest('[data-handle]');
  if (h) { startHandleOp(h.getAttribute('data-handle'), pt, base, e); return; }
  const leaf = hitId(e.target);
  const additive = e.shiftKey || S.addMode;
  if (leaf) {
    const target = pickTarget(leaf, e.ctrlKey || e.metaKey);
    if (additive) {
      if (S.sel.includes(target)) { S.sel = S.sel.filter((x) => x !== target); render(); return; }
      S.sel = S.sel.concat(target);
    } else if (!S.sel.includes(target)) S.sel = [target];
    else if (S.sel.length > 1) base.collapseTo = target; // plain click (no drag) on a multi-selection member selects just it
    if (e.ctrlKey || e.metaKey) revealInLayers([target]);
    render();
    startMove(pt, base);
  } else {
    const baseSel = additive ? S.sel.slice() : [];
    if (!additive) S.sel = [];
    S.op = Object.assign({ type: 'marquee', start: pt, cur: pt, baseSel }, base);
    render();
  }
}
function startMove(pt, base) {
  const targets = selTargets();
  if (!targets.length) return;
  S.op = Object.assign({ type: 'move', start: pt, targets, startBounds: unionBounds(S.doc, targets), snapT: snapTargetsFor(targets), active: false }, base);
  beginLive('move', targets.length > 1 ? `Move ${targets.length} items` : 'Move');
}
function startHandleOp(kind, pt, base, e) {
  const targets = selTargets();
  if (!targets.length) return;
  const U = unionBounds(S.doc, targets);
  const c = { x: U.x + U.w / 2, y: U.y + U.h / 2 };
  if (kind === 'rotate') {
    S.op = Object.assign({ type: 'rotate', targets, c, a0: Math.atan2(pt.y - c.y, pt.x - c.x), angle: 0 }, base);
    beginLive('rotate', 'Rotate');
  } else if (kind.startsWith('scale:')) {
    S.op = Object.assign({ type: 'scale', targets, c, d0: Math.max(1e-6, Math.hypot(pt.x - c.x, pt.y - c.y)) }, base);
    beginLive('scale', 'Scale');
  } else if (kind.startsWith('resize:')) {
    const id = targets[0];
    const n0 = JSON.parse(JSON.stringify(S.doc.nodes[id]));
    S.op = Object.assign({ type: 'resize', id, handle: kind.slice(7), inv0: mInv(worldMatrix(S.doc, id)), L0: localMatrix(n0), n0, snapT: snapTargetsFor([id]) }, base);
    beginLive('resize', 'Resize');
  }
}
function downNode(e, pt, base) {
  const h = e.target.closest && e.target.closest('[data-node]');
  const tg = selTargets();
  if (h && tg.length === 1) {
    const id = tg[0];
    const [idx, part] = h.getAttribute('data-node').split(':');
    S.nodeSel = { id, index: +idx };
    const n0 = JSON.parse(JSON.stringify(S.doc.nodes[id]));
    S.op = Object.assign({ type: 'node', id, index: +idx, part: part === 'a' && e.altKey && n0.type === 'path' ? 'pull' : part, n0, inv0: mInv(worldMatrix(S.doc, id)), snapT: snapTargetsFor([id]), active: false }, base);
    beginLive('node', part === 'a' ? 'Move point' : 'Move handle');
    render();
    return;
  }
  const leaf = hitId(e.target);
  if (leaf) {
    const t = S.sel.includes(leaf) ? leaf : leaf;
    if (!S.sel.includes(t) || S.sel.length !== 1) { S.sel = [t]; revealInLayers([t]); }
    const n = S.doc.nodes[t];
    S.nodeSel = (n.type === 'path' || n.type === 'line') ? (S.nodeSel && S.nodeSel.id === t ? S.nodeSel : { id: t, index: 0 }) : null;
    render();
    startMove(pt, base);
  } else {
    S.sel = []; S.nodeSel = null;
    render();
  }
}
function downCreate(e, pt, base) {
  const T = snapTargetsFor([]);
  const p0 = snapPoint(pt, T);
  S.guides = p0.guides;
  const id = genId(S.doc);
  S.op = Object.assign({ type: 'create', kind: S.tool, p0, id, T, active: false }, base);
  beginLive('create', { rect: 'Add rectangle', ellipse: 'Add ellipse', line: 'Add line' }[S.tool]);
  render();
}
function downText(e, pt) {
  const T = snapTargetsFor([]);
  const p = snapPoint(pt, T);
  let id = null;
  const ok = edit('Add text', (d) => {
    const n = newBase(d, 'text', { transform: { x: round(p.x, 4), y: round(p.y, 4), rotation: 0, scale: 1 }, text: 'Text', fontFamily: 'sans', fontSize: 40, fontWeight: 400, align: 'left', lineHeight: 1.2, fill: ink(d) });
    id = n.id;
    addNode(d, n);
    return [n.id];
  });
  S.op = null;
  if (ok) {
    S.tool = 'select';
    render();
    setPanelTab('inspect');
    const ta = $('#insText');
    if (ta) { ta.focus(); ta.select(); }
  }
}
function downPath(e, pt, base) {
  const T = snapTargetsFor([]);
  const p = snapPoint(pt, T);
  const scr = stageXY(e);
  let D = S.pathDraft;
  if (D && D.anchors.length >= 2) {
    const a0 = toScreen(D.anchors[0]);
    if (Math.hypot(scr.x - a0.x, scr.y - a0.y) <= Math.max(8, HANDLE)) { finishPath(true); return; }
    const al = toScreen(D.anchors[D.anchors.length - 1]);
    if (Math.hypot(scr.x - al.x, scr.y - al.y) <= 5) { finishPath(false); return; }
  }
  if (!D) D = S.pathDraft = { anchors: [] };
  if (D.anchors.length >= LIMITS.anchors) { toast(`Paths are limited to ${LIMITS.anchors} anchors. Press Enter to finish.`, 'warn'); return; }
  D.anchors.push({ x: round(p.x, 4), y: round(p.y, 4), inX: round(p.x, 4), inY: round(p.y, 4), outX: round(p.x, 4), outY: round(p.y, 4) });
  S.op = Object.assign({ type: 'pathHandle', index: D.anchors.length - 1, active: false }, base);
  render();
}
function finishPath(closed) {
  const D = S.pathDraft;
  S.pathDraft = null;
  if (S.op && S.op.type === 'pathHandle') S.op = null;
  if (!D) return;
  if (D.anchors.length < 2) { toast('A path needs at least two points — draft discarded.', 'warn'); render(); return; }
  const ok = edit(closed ? 'Draw closed path' : 'Draw path', (d) => {
    const dark = darkBg(d);
    const n = newBase(d, 'path', { anchors: D.anchors.map((a) => Object.assign({}, a)), closed, fill: dark ? '#ffb35c' : '#4ea1ff', stroke: ink(d), strokeWidth: 3 });
    addNode(d, n);
    return [n.id];
  });
  if (ok) setIO(`Path created with ${D.anchors.length} anchors${closed ? ' (closed)' : ''}`);
}
function onPointerMove(e) {
  if (S.pointers.has(e.pointerId)) S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (S.pinch && S.pointers.size >= 2) {
    const [p1, p2] = [...S.pointers.values()];
    const r = stage.getBoundingClientRect();
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
    const mx = (p1.x + p2.x) / 2 - r.left, my = (p1.y + p2.y) / 2 - r.top;
    const P = S.pinch;
    const z = clamp(P.z0 * d / P.d0, 0.05, 32);
    S.view.zoom = z;
    S.view.px = mx - (P.mx - P.px0) * (z / P.z0);
    S.view.py = my - (P.my - P.py0) * (z / P.z0);
    render();
    return;
  }
  const op = S.op;
  const pt = toDoc(e.clientX, e.clientY);
  if (!op) {
    S.hoverPt = pt;
    const hid = S.tool === 'select' || S.tool === 'node' ? hitId(e.target) : null;
    const hv = hid ? (S.tool === 'node' || e.ctrlKey || e.metaKey ? hid : pickTarget(hid, false)) : null;
    if (hv !== S.hoverId || S.pathDraft) { S.hoverId = hv; renderOverlay(); }
    return;
  }
  if (e.pointerId !== op.pointerId) return;
  const moved = Math.hypot(e.clientX - op.sx, e.clientY - op.sy);
  switch (op.type) {
    case 'pan':
      S.view.px = op.px0 + (e.clientX - op.sx);
      S.view.py = op.py0 + (e.clientY - op.sy);
      renderWorld(); renderOverlay(); renderStatus();
      return;
    case 'marquee':
      op.cur = pt;
      renderOverlay();
      return;
    case 'move': {
      if (!op.active && moved < 3) return;
      op.active = true;
      let dx = pt.x - op.start.x, dy = pt.y - op.start.y;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      const B = op.startBounds;
      const sn = snapBox({ x: B.x + dx, y: B.y + dy, w: B.w, h: B.h }, op.snapT);
      if (e.shiftKey) { if (dy === 0) sn.dy = 0; else sn.dx = 0; sn.guides = sn.guides.filter((g) => (dy === 0 ? g.axis === 'x' : g.axis === 'y')); }
      dx += sn.dx; dy += sn.dy;
      S.guides = sn.guides;
      op.delta = { dx, dy };
      updateLive((d) => { for (const id of op.targets) translateDoc(d, id, dx, dy); });
      render();
      return;
    }
    case 'scale': {
      let k = Math.hypot(pt.x - op.c.x, pt.y - op.c.y) / op.d0;
      k = Math.max(k, 0.001);
      updateLive((d) => transformTargets(d, op.targets, mScaleAbout(k, op.c.x, op.c.y)));
      render();
      return;
    }
    case 'rotate': {
      let ang = (Math.atan2(pt.y - op.c.y, pt.x - op.c.x) - op.a0) * 180 / Math.PI;
      ang = normDeg(ang);
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      op.angle = ang;
      updateLive((d) => transformTargets(d, op.targets, mRotateAbout(ang, op.c.x, op.c.y)));
      render();
      return;
    }
    case 'resize': {
      const sp = snapPoint(pt, op.snapT);
      S.guides = sp.guides;
      const lp = mApply(op.inv0, sp.x, sp.y);
      const w0 = op.n0.width, h0 = op.n0.height, MIN = 1;
      let x0 = 0, y0 = 0, x1 = w0, y1 = h0;
      const hd = op.handle;
      if (hd.includes('w')) x0 = Math.min(lp.x, w0 - MIN);
      if (hd.includes('e')) x1 = Math.max(lp.x, MIN);
      if (hd.includes('n')) y0 = Math.min(lp.y, h0 - MIN);
      if (hd.includes('s')) y1 = Math.max(lp.y, MIN);
      if (e.shiftKey && hd.length === 2) {
        const s = Math.max((x1 - x0) / w0, (y1 - y0) / h0);
        if (hd.includes('w')) x0 = x1 - w0 * s; else x1 = x0 + w0 * s;
        if (hd.includes('n')) y0 = y1 - h0 * s; else y1 = y0 + h0 * s;
      }
      const o = mApply(op.L0, x0, y0);
      updateLive((d) => {
        const n = d.nodes[op.id];
        n.width = round(x1 - x0, 4); n.height = round(y1 - y0, 4);
        n.transform.x = round(o.x, 6); n.transform.y = round(o.y, 6);
      });
      render();
      return;
    }
    case 'create': {
      if (!op.active && moved < 3) return;
      op.active = true;
      const p1 = snapPoint(pt, op.T);
      S.guides = p1.guides.concat(op.p0.guides || []);
      let x1 = p1.x, y1 = p1.y;
      const p0 = op.p0;
      if (op.kind === 'line') {
        if (e.shiftKey) { const ang = Math.round(Math.atan2(y1 - p0.y, x1 - p0.x) / (Math.PI / 4)) * (Math.PI / 4); const L = Math.hypot(x1 - p0.x, y1 - p0.y); x1 = p0.x + Math.cos(ang) * L; y1 = p0.y + Math.sin(ang) * L; }
        updateLive((d) => {
          const n = newBase(d, 'line', { id: op.id, x1: round(p0.x, 4), y1: round(p0.y, 4), x2: round(x1, 4), y2: round(y1, 4), stroke: ink(d), strokeWidth: 4 });
          addNode(d, n);
        });
      } else {
        let w = x1 - p0.x, h = y1 - p0.y;
        if (e.shiftKey) { const s = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * s; h = Math.sign(h || 1) * s; }
        const box = { x: Math.min(p0.x, p0.x + w), y: Math.min(p0.y, p0.y + h), w: Math.max(Math.abs(w), LIMITS.minSize), h: Math.max(Math.abs(h), LIMITS.minSize) };
        updateLive((d) => { addNode(d, makeShape(d, op.kind, box, op.id)); });
      }
      S.sel = [op.id];
      render();
      return;
    }
    case 'node': {
      if (!op.active && moved < 2) return;
      op.active = true;
      const sp = snapPoint(pt, op.snapT);
      S.guides = sp.guides;
      const lp = mApply(op.inv0, sp.x, sp.y);
      updateLive((d) => {
        const n = d.nodes[op.id];
        if (n.type === 'line') {
          if (op.index === 0) { n.x1 = round(lp.x, 4); n.y1 = round(lp.y, 4); } else { n.x2 = round(lp.x, 4); n.y2 = round(lp.y, 4); }
          return;
        }
        const a = n.anchors[op.index], a0 = op.n0.anchors[op.index];
        if (op.part === 'a') {
          const dx = lp.x - a0.x, dy = lp.y - a0.y;
          a.x = round(a0.x + dx, 4); a.y = round(a0.y + dy, 4);
          a.inX = round(a0.inX + dx, 4); a.inY = round(a0.inY + dy, 4);
          a.outX = round(a0.outX + dx, 4); a.outY = round(a0.outY + dy, 4);
        } else if (op.part === 'pull') {
          a.outX = round(lp.x, 4); a.outY = round(lp.y, 4);
          a.inX = round(2 * a0.x - lp.x, 4); a.inY = round(2 * a0.y - lp.y, 4);
        } else if (op.part === 'in') { a.inX = round(lp.x, 4); a.inY = round(lp.y, 4); }
        else { a.outX = round(lp.x, 4); a.outY = round(lp.y, 4); }
      });
      render();
      return;
    }
    case 'pathHandle': {
      if (!op.active && moved < 3) return;
      op.active = true;
      const a = S.pathDraft && S.pathDraft.anchors[op.index];
      if (!a) return;
      a.outX = round(pt.x, 4); a.outY = round(pt.y, 4);
      a.inX = round(2 * a.x - pt.x, 4); a.inY = round(2 * a.y - pt.y, 4);
      renderOverlay();
    }
  }
}
function onPointerUp(e) {
  S.pointers.delete(e.pointerId);
  if (S.pinch) { if (S.pointers.size < 2) S.pinch = null; return; }
  const op = S.op;
  if (!op || e.pointerId !== op.pointerId) return;
  S.op = null;
  S.guides = [];
  stage.classList.remove('dragging');
  if (!S.spaceDown && S.tool !== 'hand') stage.classList.remove('panning');
  switch (op.type) {
    case 'pan': render(); return;
    case 'marquee': {
      const a = op.start, b = op.cur;
      const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
      if (r.w * S.view.zoom > 2 || r.h * S.view.zoom > 2) {
        const hits = S.doc.root.filter((id) => {
          if (!effVisible(S.doc, id)) return false;
          const bb = nodeBounds(S.doc, id);
          return bb.x <= r.x + r.w && bb.x + bb.w >= r.x && bb.y <= r.y + r.h && bb.y + bb.h >= r.y;
        });
        S.sel = op.baseSel.concat(hits.filter((h) => !op.baseSel.includes(h)));
      }
      render();
      return;
    }
    case 'move':
      commitLive();
      if (!op.active && op.collapseTo && S.doc.nodes[op.collapseTo]) { S.sel = [op.collapseTo]; render(); }
      return;
    case 'scale': case 'rotate': case 'resize': case 'node':
      commitLive();
      return;
    case 'create': {
      if (!op.active) {
        const p0 = op.p0;
        if (op.kind === 'line') {
          updateLive((d) => { const n = newBase(d, 'line', { id: op.id, x1: round(p0.x, 4), y1: round(p0.y, 4), x2: round(p0.x + 120, 4), y2: round(p0.y, 4), stroke: ink(d), strokeWidth: 4 }); addNode(d, n); });
        } else {
          const w = op.kind === 'rect' ? 120 : 100, h = op.kind === 'rect' ? 80 : 100;
          updateLive((d) => { addNode(d, makeShape(d, op.kind, { x: p0.x, y: p0.y, w, h }, op.id)); });
        }
      }
      if (S.doc.nodes[op.id]) S.sel = [op.id];
      commitLive();
      S.tool = 'select';
      render();
      return;
    }
    case 'pathHandle':
      render();
  }
}
// Cancel the in-progress pointer operation and restore its starting geometry (no history entry).
function cancelOp(silent) {
  const op = S.op;
  if (!op) return false;
  S.op = null;
  S.guides = [];
  stage.classList.remove('dragging');
  if (op.type === 'pathHandle' && S.pathDraft) {
    S.pathDraft.anchors.splice(op.index, 1);
    if (!S.pathDraft.anchors.length) S.pathDraft = null;
  }
  if (op.type === 'marquee') S.sel = op.baseSel;
  if (S.live && ['move', 'scale', 'rotate', 'resize', 'create', 'node'].includes(S.live.kind)) cancelLive();
  try { if (stage.hasPointerCapture(op.pointerId)) stage.releasePointerCapture(op.pointerId); } catch (_) { /* ignore */ }
  render();
  if (!silent && op.type !== 'pan' && op.type !== 'marquee') { toast('Drag cancelled — nothing changed.', 'info', 2200); setIO('Drag cancelled'); }
  return true;
}
function onPointerCancel(e) {
  S.pointers.delete(e.pointerId);
  if (S.pinch && S.pointers.size < 2) S.pinch = null;
  if (S.op && S.op.pointerId === e.pointerId) cancelOp();
}
function onLostCapture(e) {
  if (S.op && S.op.pointerId === e.pointerId && S.op.type !== 'pathHandle') cancelOp();
}
function onDblClick(e) {
  if (S.tool !== 'select') return;
  const leaf = hitId(e.target);
  if (!leaf) return;
  const chain = [leaf, ...ancestorsOf(S.doc, leaf)].reverse();
  const cur = S.sel.length === 1 ? S.sel[0] : null;
  const i = cur ? chain.indexOf(cur) : -1;
  if (i >= 0 && i < chain.length - 1) { S.sel = [chain[i + 1]]; revealInLayers(S.sel); render(); return; }
  const n = S.doc.nodes[cur || leaf];
  if (n && n.type === 'text') { setPanelTab('inspect'); const ta = $('#insText'); if (ta) { ta.focus(); } }
  else if (n && (n.type === 'path' || n.type === 'line')) { S.sel = [n.id]; setTool('node'); }
}
function onWheel(e) {
  e.preventDefault();
  const s = stageXY(e);
  if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), s.x, s.y);
  else {
    const k = e.deltaMode === 1 ? 16 : 1;
    S.view.px -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k;
    S.view.py -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k;
    render();
  }
}

/* ---------------- keyboard ---------------- */
function onKeyDown(e) {
  if (S.modal) { if (e.key === 'Escape') { e.preventDefault(); closeModal(false); } return; }
  if (!$('#preview').hidden) { if (e.key === 'Escape') { e.preventDefault(); closePreview(); } return; }
  if (e.key === 'Escape' && S.op) { e.preventDefault(); cancelOp(); return; }
  if (e.key === 'Escape' && S.live && S.live.kind === 'scrub') { e.preventDefault(); cancelLive(); toast('Scrub cancelled — value restored.', 'info', 2000); return; }
  if (isField(e.target)) return; // fields keep their native editing keys
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key;
  const kl = k.length === 1 ? k.toLowerCase() : k;
  if (mod && kl === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && kl === 'y') { e.preventDefault(); redo(); return; }
  if (mod && kl === 'd') { e.preventDefault(); cmdDuplicate(); return; }
  if (mod && kl === 'g') { e.preventDefault(); if (e.shiftKey) cmdUngroup(); else cmdGroup(); return; }
  if (mod && kl === 'a') { e.preventDefault(); cmdSelectAll(); return; }
  if (mod && (k === ']' || k === '}')) { e.preventDefault(); cmdReorder('front'); return; }
  if (mod && (k === '[' || k === '{')) { e.preventDefault(); cmdReorder('back'); return; }
  if (mod) return;
  if (k === 'Delete' || k === 'Backspace') {
    e.preventDefault();
    if (S.tool === 'node' && S.nodeSel && S.doc.nodes[S.nodeSel.id] && S.doc.nodes[S.nodeSel.id].type === 'path') deletePoint();
    else cmdDelete();
    return;
  }
  if (k.startsWith('Arrow')) {
    e.preventDefault();
    const st = e.shiftKey ? 10 : 1;
    cmdNudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
    return;
  }
  if (k === 'Escape') {
    if (S.pathDraft) { finishPath(false); return; }
    if (S.tool !== 'select' && S.tool !== 'node') { setTool('select'); return; }
    if (S.sel.length) {
      const p = S.sel.length === 1 && S.doc.nodes[S.sel[0]] ? S.doc.nodes[S.sel[0]].parent : null;
      S.sel = p ? [p] : []; S.nodeSel = null; render();
    }
    return;
  }
  if (k === 'Enter') {
    if (S.pathDraft) { e.preventDefault(); finishPath(false); return; }
    const t = selTargets();
    if (t.length === 1 && S.doc.nodes[t[0]].type === 'text') { e.preventDefault(); setPanelTab('inspect'); const ta = $('#insText'); if (ta) ta.focus(); }
    return;
  }
  if (k === ' ') {
    if (e.target === stage || e.target === document.body) { e.preventDefault(); if (!S.spaceDown) { S.spaceDown = true; stage.classList.add('panning'); } }
    return;
  }
  if (k === ']') { cmdReorder('up'); return; }
  if (k === '[') { cmdReorder('down'); return; }
  if (k === '+' || k === '=') { zoomAt(1.25); return; }
  if (k === '-' || k === '_') { zoomAt(0.8); return; }
  if (k === '0') { fitView(); render(); return; }
  if (k === '1') { setZoom(1); return; }
  if (k === '2') { setZoom(2); return; }
  if (k === '?') { showShortcuts(); return; }
  const tool = { v: 'select', a: 'node', r: 'rect', e: 'ellipse', l: 'line', p: 'path', t: 'text', h: 'hand' }[kl];
  if (tool && !e.altKey) { setTool(tool); }
}
function onKeyUp(e) {
  if (e.key === ' ') { S.spaceDown = false; if (!(S.op && S.op.type === 'pan') && S.tool !== 'hand') stage.classList.remove('panning'); }
}

/* ---------------- panels: helpers ---------------- */
function hEl(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const INS = { sig: '', binds: [], errEl: null };
let fieldSeq = 0;
function bind(fn) { INS.binds.push(fn); fn(); }
function setInsError(msg) { if (INS.errEl) { INS.errEl.textContent = msg; INS.errEl.hidden = !msg; } }
function fmtVal(v, d = 2) { return isFiniteNum(v) ? String(round(v, d)) : ''; }
function parseNum(str, o) {
  const s = String(str).trim();
  const nm = o.name || o.label;
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i.test(s)) return { err: `${nm}: enter a number` };
  const v = Number(s);
  if (!Number.isFinite(v)) return { err: `${nm} must be a finite number` };
  if (o.integer && !Number.isInteger(v)) return { err: `${nm} must be a whole number` };
  if (v < o.min || v > o.max) return { err: o.rangeMsg || `${nm} must be between ${o.min} and ${o.max}` };
  return { v };
}
function numField(o) {
  const id = 'f' + (++fieldSeq);
  const input = hEl('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': o.aria || o.name || o.label, readonly: o.readonly || null, 'data-field': o.key || null });
  const lab = hEl('label', { for: id, class: o.readonly ? null : 'scrub', title: o.readonly ? (o.title || '') : `${o.title || o.name || o.label} — drag to scrub, Shift ×10` }, o.label);
  const wrap = hEl('div', { class: 'fld' + (o.wide ? ' wide' : '') }, lab, input, o.unit ? hEl('span', { class: 'unit' }, o.unit) : null);
  let orig = '';
  const show = () => fmtVal(o.get(), o.decimals ?? 2);
  bind(() => {
    if (document.activeElement !== input) { input.value = show(); input.removeAttribute('aria-invalid'); }
    input.disabled = !!(o.disabled && o.disabled());
  });
  if (o.readonly) return wrap;
  const commit = () => {
    const r = parseNum(input.value, o);
    if (r.err) { input.setAttribute('aria-invalid', 'true'); setInsError(r.err); return false; }
    input.removeAttribute('aria-invalid'); setInsError('');
    const cur = o.get();
    if (!o.relative && isFiniteNum(cur) && Math.abs(r.v - cur) < 1e-9) { input.value = show(); orig = input.value; return true; }
    edit(o.hist, (d) => o.apply(d, r.v));
    input.value = show(); orig = input.value;
    return true;
  };
  input.addEventListener('focus', () => { orig = input.value; input.select(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (commit()) input.select(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.value = orig; input.removeAttribute('aria-invalid'); setInsError(''); input.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const r = parseNum(input.value, o);
      const b = r.err ? (o.relative ? o.get() : o.get()) : r.v;
      const st = (o.step || 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      input.value = fmtVal(clamp(b + st, o.min, o.max), 4);
      commit(); input.select();
    }
  });
  input.addEventListener('blur', () => {
    if (input.value === orig) return;
    const r = parseNum(input.value, o);
    if (r.err) { input.value = orig; input.removeAttribute('aria-invalid'); setInsError(''); toast(`${r.err} — value not applied.`, 'warn'); return; }
    commit();
  });
  scrubLabel(lab, o);
  return wrap;
}
function scrubLabel(lab, o) {
  lab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (o.disabled && o.disabled())) return;
    e.preventDefault();
    try { lab.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const x0 = e.clientX, v0 = o.get();
    let active = false;
    const move = (ev) => {
      const dx = ev.clientX - x0;
      if (!active && Math.abs(dx) < 3) return;
      if (!active) { active = true; beginLive('scrub', o.hist); }
      if (!S.live || S.live.kind !== 'scrub') return; // cancelled (Esc)
      let v = clamp(v0 + Math.round(dx) * (o.scrubStep || o.step || 1) * (ev.shiftKey ? 10 : 1), o.min, o.max);
      if (o.integer) v = Math.round(v);
      updateLive((d) => o.apply(d, v));
      render();
    };
    const end = (commit) => {
      lab.removeEventListener('pointermove', move);
      lab.removeEventListener('pointerup', up);
      lab.removeEventListener('pointercancel', cancel);
      lab.removeEventListener('lostpointercapture', lost);
      if (active && S.live && S.live.kind === 'scrub') { if (commit) commitLive(o.hist); else cancelLive(); }
    };
    const up = () => end(true);
    const cancel = () => end(false);
    const lost = () => end(true);
    lab.addEventListener('pointermove', move);
    lab.addEventListener('pointerup', up);
    lab.addEventListener('pointercancel', cancel);
    lab.addEventListener('lostpointercapture', lost);
  });
}
function paintField(o) {
  const color = hEl('input', { type: 'color', 'aria-label': `${o.label} colour picker`, title: `${o.label} colour` });
  const id = 'f' + (++fieldSeq);
  const hex = hEl('input', { id, type: 'text', spellcheck: 'false', autocomplete: 'off', maxlength: '7', 'aria-label': `${o.label} hex colour or none`, 'data-field': o.key });
  const none = o.allowNone ? hEl('input', { type: 'checkbox', 'aria-label': `No ${o.label.toLowerCase()}` }) : null;
  let last = '#000000', orig = '';
  bind(() => {
    const v = o.get();
    const isNone = v === 'none';
    if (!isNone && isHex(v)) last = v;
    if (document.activeElement !== hex) { hex.value = isNone ? 'none' : v; hex.removeAttribute('aria-invalid'); }
    if (document.activeElement !== color || !S.live) color.value = (isNone ? last : v).toLowerCase();
    if (none) none.checked = isNone;
    const dis = !!(o.disabled && o.disabled());
    color.disabled = hex.disabled = dis; if (none) none.disabled = dis;
  });
  color.addEventListener('input', () => {
    if (!S.live || S.live.kind !== 'color') beginLive('color', o.hist);
    updateLive((d) => o.apply(d, color.value));
    render();
  });
  color.addEventListener('change', () => { if (S.live && S.live.kind === 'color') commitLive(o.hist); });
  color.addEventListener('blur', () => { if (S.live && S.live.kind === 'color') commitLive(o.hist); });
  const commitHex = () => {
    let v = hex.value.trim().toLowerCase();
    if (/^#?[0-9a-f]{3}$/.test(v)) v = '#' + v.replace('#', '').split('').map((c) => c + c).join('');
    if (/^[0-9a-f]{6}$/.test(v)) v = '#' + v;
    if (!(v === 'none' && o.allowNone) && !isHex(v)) { hex.setAttribute('aria-invalid', 'true'); setInsError(`${o.label}: use #rrggbb${o.allowNone ? ' or none' : ''}`); return false; }
    hex.removeAttribute('aria-invalid'); setInsError('');
    if (v !== o.get()) edit(o.hist, (d) => o.apply(d, v));
    orig = hex.value = o.get();
    return true;
  };
  hex.addEventListener('focus', () => { orig = hex.value; hex.select(); });
  hex.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (commitHex()) hex.select(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hex.value = orig; hex.removeAttribute('aria-invalid'); setInsError(''); hex.blur(); }
  });
  hex.addEventListener('blur', () => {
    if (hex.value === orig) return;
    if (!commitHex()) { hex.value = orig; hex.removeAttribute('aria-invalid'); setInsError(''); toast(`${o.label}: invalid colour — not applied.`, 'warn'); }
  });
  if (none) none.addEventListener('change', () => edit(o.hist, (d) => o.apply(d, none.checked ? 'none' : last)));
  return hEl('div', { class: 'row' },
    hEl('div', { class: 'paint' }, color, hEl('div', { class: 'fld' }, hEl('label', { for: id }, o.label), hex)),
    none ? hEl('label', { class: 'check' }, none, 'None') : null);
}
function rangeField(o) {
  const range = hEl('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': o.label + ' slider', 'data-field': o.key + '-range' });
  bind(() => { if (!(S.live && S.live.kind === 'range')) range.value = String(Math.round(o.get() * 100)); range.disabled = !!(o.disabled && o.disabled()); });
  range.addEventListener('input', () => {
    if (!S.live || S.live.kind !== 'range') beginLive('range', o.hist);
    updateLive((d) => o.apply(d, Number(range.value) / 100));
    render();
  });
  const fin = () => { if (S.live && S.live.kind === 'range') commitLive(o.hist); };
  range.addEventListener('change', fin);
  range.addEventListener('pointerup', fin);
  range.addEventListener('blur', fin);
  range.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.live && S.live.kind === 'range') { e.preventDefault(); e.stopPropagation(); cancelLive(); } });
  const nf = numField({ label: '%', name: o.label, aria: o.label + ' percent', key: o.key, get: () => o.get() * 100, apply: (d, v) => o.apply(d, v / 100), hist: o.hist, min: 0, max: 100, decimals: 1, disabled: o.disabled });
  nf.style.width = '82px';
  return hEl('div', { class: 'row' }, range, nf);
}
function segButtons(items, label) {
  return hEl('div', { class: 'seg', role: 'group', 'aria-label': label }, items.map((it) => {
    const b = hEl('button', { type: 'button', title: it.title, 'aria-label': it.title, onclick: it.onclick }, it.icon ? icon(it.icon) : it.text);
    if (it.pressed || it.disabled) bind(() => { if (it.pressed) b.setAttribute('aria-pressed', String(!!it.pressed())); if (it.disabled) b.disabled = !!it.disabled(); });
    return b;
  }));
}
function sec(title, tag, ...kids) { return hEl('div', { class: 'sec' }, hEl('h3', null, title, tag ? hEl('span', { class: 'tag' }, tag) : null), ...kids); }

/* ---------------- inspector ---------------- */
function inspectorSig() {
  const t = selTargets();
  const parts = [S.tool, t.join(','), S.doc.artboard.transparent];
  for (const id of t) {
    const n = S.doc.nodes[id];
    parts.push(n.type, effLocked(S.doc, id), n.type === 'path' ? n.anchors.length + ':' + n.closed : '');
  }
  if (S.nodeSel) parts.push('ns' + S.nodeSel.id + ':' + S.nodeSel.index);
  return parts.join('|');
}
function renderInspector() {
  const sig = inspectorSig();
  if (sig === INS.sig && inspectorEl.childElementCount) { for (const b of INS.binds) b(); return; }
  // do not rebuild under a focused field of the same selection (keeps caret) unless the selection changed
  INS.sig = sig;
  INS.binds = [];
  const frag = document.createDocumentFragment();
  const t = selTargets();
  const doc = () => S.doc;
  const N = (id) => S.doc.nodes[id];
  const lockedAny = () => t.some((id) => S.doc.nodes[id] && effLocked(S.doc, id));
  INS.errEl = hEl('p', { class: 'note err', role: 'alert', hidden: true });
  if (t.length) {
    const single = t.length === 1 ? t[0] : null;
    const head = hEl('div', { class: 'selhead' });
    const title = hEl('span', { class: 'title' });
    const badges = hEl('span');
    bind(() => {
      if (!t.every((id) => S.doc.nodes[id])) return;
      title.textContent = single ? `${N(single).name}` : `${t.length} items`;
      badges.replaceChildren();
      badges.append(hEl('span', { class: 'badge' }, single ? TYPE_LABEL[N(single).type] : 'Multiple'));
      if (lockedAny()) badges.append(' ', hEl('span', { class: 'badge lock' }, '🔒 Locked'));
      if (t.some((id) => !effVisible(S.doc, id))) badges.append(' ', hEl('span', { class: 'badge hid' }, 'Hidden'));
    });
    head.append(title, badges);
    frag.append(head);
    if (lockedAny()) frag.append(hEl('div', { class: 'sec' }, hEl('p', { class: 'note', style: 'color:var(--lock);margin:0' }, 'Locked items can be inspected but not edited. Unlock them with the lock button in Layers.')));
    const dis = lockedAny;
    // name
    if (single) {
      const nm = hEl('input', { type: 'text', 'aria-label': 'Layer name', maxlength: String(LIMITS.name), 'data-field': 'name' });
      let orig = '';
      bind(() => { if (N(single) && document.activeElement !== nm) nm.value = N(single).name; nm.disabled = dis(); });
      const commitName = () => { const v = sanitizeText(nm.value).replace(/\n/g, ' ').slice(0, LIMITS.name); if (v !== N(single).name) edit('Rename', (d) => { d.nodes[single].name = v; }); nm.value = N(single).name; orig = nm.value; };
      nm.addEventListener('focus', () => { orig = nm.value; });
      nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitName(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); nm.value = orig; nm.blur(); } });
      nm.addEventListener('blur', () => { if (nm.value !== orig) commitName(); });
      frag.append(sec('Name', null, hEl('div', { class: 'row' }, hEl('div', { class: 'fld wide' }, hEl('label', null, 'Aa'), nm))));
    }
    // layout bounds
    const B = () => unionBounds(S.doc, t.filter((id) => S.doc.nodes[id]));
    frag.append(sec('Layout bounds', 'document units',
      hEl('div', { class: 'grid2' },
        numField({ label: 'X', name: 'X', key: 'bx', get: () => B().x, min: -LIMITS.coord, max: LIMITS.coord, hist: 'Move (X)', disabled: dis, apply: (d, v) => { const b = unionBounds(d, t); for (const id of t) translateDoc(d, id, v - b.x, 0); } }),
        numField({ label: 'Y', name: 'Y', key: 'by', get: () => B().y, min: -LIMITS.coord, max: LIMITS.coord, hist: 'Move (Y)', disabled: dis, apply: (d, v) => { const b = unionBounds(d, t); for (const id of t) translateDoc(d, id, 0, v - b.y); } }),
        numField({ label: 'W', key: 'bw', readonly: true, title: 'Bounds width (derived)', get: () => B().w }),
        numField({ label: 'H', key: 'bh', readonly: true, title: 'Bounds height (derived)', get: () => B().h })),
      hEl('p', { class: 'note' }, 'Axis-aligned union of transformed geometry boxes; excludes stroke and handles.')));
    // transform
    if (single) {
      frag.append(sec('Transform', 'about bounds centre', hEl('div', { class: 'grid2' },
        numField({ label: '↻', name: 'Rotation', key: 'rot', unit: '°', get: () => N(single).transform.rotation, min: -360, max: 360, step: 1, hist: 'Rotate', disabled: dis,
          apply: (d, v) => { const c = centerOf(d, [single]); transformTargets(d, [single], mRotateAbout(v - d.nodes[single].transform.rotation, c.x, c.y)); } }),
        numField({ label: '×', name: 'Scale', key: 'scale', get: () => N(single).transform.scale, min: LIMITS.scaleMin, max: LIMITS.scaleMax, step: 0.01, scrubStep: 0.01, decimals: 4, hist: 'Scale', disabled: dis,
          rangeMsg: `Scale must be a positive number from ${LIMITS.scaleMin} to ${LIMITS.scaleMax} (zero or negative scale is singular)`,
          apply: (d, v) => { const c = centerOf(d, [single]); transformTargets(d, [single], mScaleAbout(v / d.nodes[single].transform.scale, c.x, c.y)); } }))));
    } else {
      frag.append(sec('Transform', 'relative · about union centre', hEl('div', { class: 'grid2' },
        numField({ label: '↻', name: 'Rotate by', key: 'rotby', unit: '°', relative: true, get: () => 0, min: -360, max: 360, hist: 'Rotate', disabled: dis,
          apply: (d, v) => { const c = centerOf(d, t); transformTargets(d, t, mRotateAbout(v, c.x, c.y)); } }),
        numField({ label: '×', name: 'Scale by', key: 'scaleby', relative: true, get: () => 1, min: 0.01, max: 100, step: 0.01, scrubStep: 0.01, decimals: 4, hist: 'Scale', disabled: dis,
          rangeMsg: 'Scale factor must be a positive number from 0.01 to 100 (zero or negative scale is singular)',
          apply: (d, v) => { const c = centerOf(d, t); transformTargets(d, t, mScaleAbout(v, c.x, c.y)); } }))));
    }
    // arrange
    frag.append(sec('Arrange', t.length === 1 ? '1 item aligns to artboard' : `${t.length} items`,
      hEl('div', { class: 'row' },
        segButtons([
          { icon: 'aL', title: 'Align left', onclick: () => cmdAlign('left') }, { icon: 'aC', title: 'Align horizontal centres', onclick: () => cmdAlign('hcenter') }, { icon: 'aR', title: 'Align right', onclick: () => cmdAlign('right') },
        ], 'Horizontal alignment'),
        segButtons([
          { icon: 'aT', title: 'Align top', onclick: () => cmdAlign('top') }, { icon: 'aM', title: 'Align vertical middles', onclick: () => cmdAlign('vmiddle') }, { icon: 'aB', title: 'Align bottom', onclick: () => cmdAlign('bottom') },
        ], 'Vertical alignment'),
        segButtons([
          { icon: 'dH', title: 'Distribute horizontally (equal gaps)', onclick: () => cmdDistribute('x'), disabled: () => t.length < 3 },
          { icon: 'dV', title: 'Distribute vertically (equal gaps)', onclick: () => cmdDistribute('y'), disabled: () => t.length < 3 },
        ], 'Distribute')),
      hEl('div', { class: 'row' },
        hEl('button', { class: 'btn', type: 'button', title: 'Group (Ctrl+G)', onclick: cmdGroup }, 'Group'),
        hEl('button', { class: 'btn', type: 'button', title: 'Ungroup (Ctrl+Shift+G)', onclick: cmdUngroup, disabled: !t.some((id) => N(id).type === 'group') || null }, 'Ungroup'),
        hEl('button', { class: 'btn', type: 'button', title: 'Duplicate (Ctrl+D)', onclick: cmdDuplicate }, 'Duplicate'),
        hEl('button', { class: 'btn danger', type: 'button', title: 'Delete (Del)', onclick: cmdDelete }, 'Delete'))));
    // geometry
    if (single) {
      const n = N(single);
      const G = (k) => () => N(single)[k];
      const setK = (k) => (d, v) => { d.nodes[single][k] = v; };
      if (n.type === 'rect' || n.type === 'ellipse') {
        const kids = [
          numField({ label: 'W', name: 'Width', key: 'w', get: G('width'), apply: setK('width'), min: LIMITS.minSize, max: LIMITS.size, hist: 'Width', disabled: dis }),
          numField({ label: 'H', name: 'Height', key: 'h', get: G('height'), apply: setK('height'), min: LIMITS.minSize, max: LIMITS.size, hist: 'Height', disabled: dis }),
        ];
        if (n.type === 'rect') kids.push(numField({ label: 'R', name: 'Corner radius', key: 'radius', get: G('radius'), apply: setK('radius'), min: 0, max: LIMITS.size, hist: 'Corner radius', disabled: dis }));
        frag.append(sec(n.type === 'rect' ? 'Rectangle' : 'Ellipse', 'local size', hEl('div', { class: 'grid2' }, kids)));
      } else if (n.type === 'line') {
        const W = () => worldMatrix(S.doc, single);
        const ptGet = (i, ax) => () => { const nn = N(single); const p = mApply(W(), i ? nn.x2 : nn.x1, i ? nn.y2 : nn.y1); return p[ax]; };
        const ptSet = (i, ax) => (d, v) => { const nn = d.nodes[single]; const Wm = worldMatrix(d, single); const p = mApply(Wm, i ? nn.x2 : nn.x1, i ? nn.y2 : nn.y1); p[ax] = v; const inv = mInv(Wm); if (!inv) fail('Singular transform.'); const l = mApply(inv, p.x, p.y); if (i) { nn.x2 = round(l.x, 6); nn.y2 = round(l.y, 6); } else { nn.x1 = round(l.x, 6); nn.y1 = round(l.y, 6); } };
        frag.append(sec('Line endpoints', 'document units', hEl('div', { class: 'grid2' },
          numField({ label: 'X1', key: 'x1', get: ptGet(0, 'x'), apply: ptSet(0, 'x'), min: -LIMITS.coord, max: LIMITS.coord, hist: 'Edit line', disabled: dis }),
          numField({ label: 'Y1', key: 'y1', get: ptGet(0, 'y'), apply: ptSet(0, 'y'), min: -LIMITS.coord, max: LIMITS.coord, hist: 'Edit line', disabled: dis }),
          numField({ label: 'X2', key: 'x2', get: ptGet(1, 'x'), apply: ptSet(1, 'x'), min: -LIMITS.coord, max: LIMITS.coord, hist: 'Edit line', disabled: dis }),
          numField({ label: 'Y2', key: 'y2', get: ptGet(1, 'y'), apply: ptSet(1, 'y'), min: -LIMITS.coord, max: LIMITS.coord, hist: 'Edit line', disabled: dis }))));
      } else if (n.type === 'path') {
        frag.append(pathSection(single, dis));
      } else if (n.type === 'text') {
        frag.append(textSection(single, dis));
      }
    }
    // appearance
    const fillT = t.filter((id) => hasFill(N(id))), strokeT = t.filter((id) => hasStroke(N(id)));
    const app = [];
    if (fillT.length) {
      app.push(paintField({ label: 'Fill', key: 'fill', allowNone: true, get: () => N(fillT[0]).fill, apply: (d, v) => { for (const id of fillT) d.nodes[id].fill = v; }, hist: 'Fill colour', disabled: dis }));
      if (fillT.some((id) => N(id).type === 'path' && !N(id).closed)) app.push(hEl('p', { class: 'note' }, 'Fill is painted only when a path is closed.'));
    }
    if (strokeT.length) {
      app.push(paintField({ label: 'Stroke', key: 'stroke', allowNone: N(strokeT[0]).type !== 'line' || true, get: () => N(strokeT[0]).stroke, apply: (d, v) => { for (const id of strokeT) d.nodes[id].stroke = v; }, hist: 'Stroke colour', disabled: dis }));
      app.push(hEl('div', { class: 'grid2' }, numField({ label: 'Wt', name: 'Stroke width', key: 'sw', get: () => N(strokeT[0]).strokeWidth, apply: (d, v) => { for (const id of strokeT) d.nodes[id].strokeWidth = v; }, min: 0, max: LIMITS.stroke, step: 0.5, scrubStep: 0.5, hist: 'Stroke width', disabled: dis })));
    }
    app.push(hEl('div', { class: 'subhead' }, 'Opacity'));
    app.push(rangeField({ label: 'Opacity', key: 'opacity', get: () => N(t[0]).opacity, apply: (d, v) => { for (const id of t) d.nodes[id].opacity = round(v, 4); }, hist: 'Opacity', disabled: dis }));
    frag.append(sec('Appearance', t.length > 1 ? 'applies to all selected' : null, ...app));
  }
  // document
  const ab = () => S.doc.artboard;
  frag.append(sec('Artboard', `${LIMITS.artMin}–${LIMITS.artMax} units · 1 unit = 1 px @1x`,
    hEl('div', { class: 'grid2' },
      numField({ label: 'W', name: 'Artboard width', key: 'abw', get: () => ab().width, apply: (d, v) => { d.artboard.width = v; }, min: LIMITS.artMin, max: LIMITS.artMax, integer: true, hist: 'Artboard width' }),
      numField({ label: 'H', name: 'Artboard height', key: 'abh', get: () => ab().height, apply: (d, v) => { d.artboard.height = v; }, min: LIMITS.artMin, max: LIMITS.artMax, integer: true, hist: 'Artboard height' })),
    paintField({ label: 'Background', key: 'bg', allowNone: false, get: () => ab().background, apply: (d, v) => { d.artboard.background = v; }, hist: 'Background colour' }),
    hEl('div', { class: 'row' }, (() => {
      const cb = hEl('input', { type: 'checkbox', 'data-field': 'transparent' });
      bind(() => { cb.checked = ab().transparent; });
      cb.addEventListener('change', () => edit(cb.checked ? 'Transparent background' : 'Solid background', (d) => { d.artboard.transparent = cb.checked; }));
      return hEl('label', { class: 'check' }, cb, 'Transparent background (PNG alpha, no SVG background)');
    })())));
  frag.append(INS.errEl);
  inspectorEl.replaceChildren(frag);
}
function pathSection(id, dis) {
  const N = () => S.doc.nodes[id];
  const idx = () => (S.nodeSel && S.nodeSel.id === id ? clamp(S.nodeSel.index, 0, N().anchors.length - 1) : 0);
  const W = () => worldMatrix(S.doc, id);
  const keys = { a: ['x', 'y'], in: ['inX', 'inY'], out: ['outX', 'outY'] };
  const get = (part, ax) => () => { const a = N().anchors[idx()]; const k = keys[part]; const p = mApply(W(), a[k[0]], a[k[1]]); return p[ax]; };
  const set = (part, ax) => (d, v) => {
    const n = d.nodes[id];
    const i = idx();
    const a = n.anchors[i];
    const Wm = worldMatrix(d, id), inv = mInv(Wm);
    if (!inv) fail('Singular transform.');
    const k = keys[part];
    const p = mApply(Wm, a[k[0]], a[k[1]]);
    p[ax] = v;
    const l = mApply(inv, p.x, p.y);
    if (part === 'a') { // moving a point carries its handles
      const dx = l.x - a.x, dy = l.y - a.y;
      a.x = round(l.x, 6); a.y = round(l.y, 6);
      a.inX = round(a.inX + dx, 6); a.inY = round(a.inY + dy, 6); a.outX = round(a.outX + dx, 6); a.outY = round(a.outY + dy, 6);
    } else { a[k[0]] = round(l.x, 6); a[k[1]] = round(l.y, 6); }
  };
  const n = N();
  const i0 = idx();
  const unusedIn = () => !N().closed && idx() === 0;
  const unusedOut = () => !N().closed && idx() === N().anchors.length - 1;
  const nav = hEl('div', { class: 'ptnav' },
    hEl('button', { class: 'btn icon', type: 'button', 'aria-label': 'Previous point', title: 'Previous point', onclick: () => { S.nodeSel = { id, index: (idx() - 1 + N().anchors.length) % N().anchors.length }; render(); } }, '‹'),
    hEl('output', { 'aria-live': 'polite', 'data-field': 'point-index' }, `Point ${i0 + 1} of ${n.anchors.length}`),
    hEl('button', { class: 'btn icon', type: 'button', 'aria-label': 'Next point', title: 'Next point', onclick: () => { S.nodeSel = { id, index: (idx() + 1) % N().anchors.length }; render(); } }, '›'));
  const closedCb = hEl('input', { type: 'checkbox', 'data-field': 'closed' });
  bind(() => { closedCb.checked = N().closed; closedCb.disabled = dis(); });
  closedCb.addEventListener('change', () => edit(closedCb.checked ? 'Close path' : 'Open path', (d) => { d.nodes[id].closed = closedCb.checked; }));
  const mk = (label, part, ax, un) => numField({ label, name: `Point ${label}`, key: `pt-${part}-${ax}`, get: get(part, ax), apply: set(part, ax), min: -LIMITS.coord, max: LIMITS.coord, hist: part === 'a' ? 'Move point' : 'Move handle', disabled: () => dis() || (un && un()) });
  return sec('Path points', 'document units',
    hEl('div', { class: 'row' }, hEl('label', { class: 'check' }, closedCb, 'Closed path'), hEl('span', { class: 'badge' }, `${n.anchors.length}/${LIMITS.anchors} anchors`)),
    nav,
    hEl('div', { class: 'grid2' }, mk('X', 'a', 'x'), mk('Y', 'a', 'y')),
    hEl('div', { class: 'subhead' }, 'Incoming handle' + (!n.closed && i0 === 0 ? ' (unused on open start)' : '')),
    hEl('div', { class: 'grid2' }, mk('In X', 'in', 'x', unusedIn), mk('In Y', 'in', 'y', unusedIn)),
    hEl('div', { class: 'subhead' }, 'Outgoing handle' + (!n.closed && i0 === n.anchors.length - 1 ? ' (unused on open end)' : '')),
    hEl('div', { class: 'grid2' }, mk('Out X', 'out', 'x', unusedOut), mk('Out Y', 'out', 'y', unusedOut)),
    hEl('div', { class: 'row' },
      hEl('button', { class: 'btn', type: 'button', title: 'Insert a point in the middle of the segment after this point (keeps the curve shape)', onclick: addPoint, disabled: n.anchors.length >= LIMITS.anchors || (!n.closed && i0 === n.anchors.length - 1) || null }, 'Add point after'),
      hEl('button', { class: 'btn', type: 'button', title: 'Delete this point', onclick: deletePoint, disabled: n.anchors.length <= 2 || null }, 'Delete point'),
      S.tool !== 'node' ? hEl('button', { class: 'btn', type: 'button', onclick: () => setTool('node'), title: 'Edit points on canvas (A)' }, 'Edit on canvas') : null),
    hEl('p', { class: 'note' }, 'Moving a point carries its handles. In the Node tool, Alt-drag a point to pull out smooth handles.'));
}
function addPoint() {
  const id = S.sel[0];
  const n = S.doc.nodes[id];
  if (!n || n.type !== 'path') return;
  const i = S.nodeSel && S.nodeSel.id === id ? S.nodeSel.index : 0;
  if (!n.closed && i >= n.anchors.length - 1) { toast('Select a point that has a following segment.', 'warn'); return; }
  let ni = i + 1;
  if (edit('Add point', (d) => { ni = splitSegment(d.nodes[id], i, 0.5); })) { S.nodeSel = { id, index: ni }; render(); }
}
function deletePoint() {
  const id = S.nodeSel && S.nodeSel.id;
  const n = id && S.doc.nodes[id];
  if (!n || n.type !== 'path') return;
  if (n.anchors.length <= 2) { toast('A path needs at least two points.', 'warn'); return; }
  const i = S.nodeSel.index;
  if (edit('Delete point', (d) => { d.nodes[id].anchors.splice(i, 1); })) { S.nodeSel = { id, index: Math.max(0, i - 1) }; render(); }
}
function textSection(id, dis) {
  const N = () => S.doc.nodes[id];
  const ta = hEl('textarea', { id: 'insText', class: 'textedit', rows: '4', spellcheck: 'false', 'aria-label': 'Text content (Ctrl+Enter to apply, Esc to cancel)', 'aria-describedby': 'textHelp' });
  let orig = '';
  const help = hEl('p', { class: 'note', id: 'textHelp' }, `Plain text · Enter = new line · Ctrl/⌘+Enter or click away to apply · Esc cancels · max ${LIMITS.text} characters.`);
  bind(() => { if (N() && document.activeElement !== ta) { ta.value = N().text; ta.removeAttribute('aria-invalid'); } ta.disabled = dis(); });
  ta.addEventListener('focus', () => { orig = N().text; });
  ta.addEventListener('input', () => {
    const v = sanitizeText(ta.value);
    if (v.length > LIMITS.text) { ta.setAttribute('aria-invalid', 'true'); setInsError(`Text is limited to ${LIMITS.text} characters (currently ${v.length}); extra input is not applied.`); return; }
    ta.removeAttribute('aria-invalid'); setInsError('');
    if (!S.live || S.live.kind !== 'text') beginLive('text', 'Edit text');
    updateLive((d) => { d.nodes[id].text = v; });
    renderScene(); renderOverlay(); renderStatus();
    for (const b of INS.binds) b();
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (S.live && S.live.kind === 'text') cancelLive();
      ta.value = orig; ta.removeAttribute('aria-invalid'); setInsError('');
      ta.blur();
      setIO('Text edit cancelled');
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      ta.blur();
    }
  });
  ta.addEventListener('blur', () => {
    if (S.live && S.live.kind === 'text') { if (commitLive('Edit text')) setIO('Text edit applied'); }
    ta.removeAttribute('aria-invalid');
    if (N()) ta.value = N().text;
  });
  const famSel = hEl('select', { class: 'sel', 'aria-label': 'Font family', 'data-field': 'font-family' }, Object.keys(FONT_STACKS).map((k) => hEl('option', { value: k }, FONT_LABELS[k])));
  bind(() => { famSel.value = N().fontFamily; famSel.disabled = dis(); });
  famSel.addEventListener('change', () => edit('Font family', (d) => { d.nodes[id].fontFamily = famSel.value; }));
  return sec('Text', 'plain text',
    ta, help,
    hEl('div', { class: 'row' }, famSel,
      segButtons([
        { text: 'Regular', title: 'Normal weight (400)', onclick: () => edit('Font weight', (d) => { d.nodes[id].fontWeight = 400; }), pressed: () => N().fontWeight === 400 },
        { text: 'Bold', title: 'Bold weight (700)', onclick: () => edit('Font weight', (d) => { d.nodes[id].fontWeight = 700; }), pressed: () => N().fontWeight === 700 },
      ], 'Font weight')),
    hEl('div', { class: 'grid2' },
      numField({ label: 'Size', name: 'Font size', key: 'font-size', get: () => N().fontSize, apply: (d, v) => { d.nodes[id].fontSize = v; }, min: LIMITS.fontMin, max: LIMITS.fontMax, hist: 'Font size', disabled: dis }),
      numField({ label: 'LH', name: 'Line height', key: 'line-height', get: () => N().lineHeight, apply: (d, v) => { d.nodes[id].lineHeight = v; }, min: LIMITS.lineHMin, max: LIMITS.lineHMax, step: 0.05, scrubStep: 0.01, hist: 'Line height', disabled: dis, unit: '×' })),
    hEl('div', { class: 'row' },
      segButtons(['left', 'center', 'right'].map((a) => ({ icon: { left: 'tL', center: 'tC', right: 'tR' }[a], title: `Align text ${a}`, onclick: () => edit('Text alignment', (d) => { d.nodes[id].align = a; }), pressed: () => N().align === a })), 'Text alignment')),
    hEl('p', { class: 'note' }, 'Layout box = widest line × (lines × size × line height). Bounds, editing, preview and export share this layout.'));
}

/* ---------------- layers ---------------- */
const LY = { sig: '' };
function layersSig() {
  let s = S.sel.join(',') + '|' + [...S.expanded].join(',') + '|';
  for (const id of paintOrder(S.doc)) { const n = S.doc.nodes[id]; s += `${id}:${n.parent}:${n.visible ? 1 : 0}${n.locked ? 1 : 0}:${n.name}\u0001`; }
  return s;
}
function renderLayers() {
  const sig = layersSig();
  if (sig === LY.sig) return;
  LY.sig = sig;
  const frag = document.createDocumentFragment();
  const doc = S.doc;
  const walk = (ids, level) => {
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i], n = doc.nodes[id];
      const isG = n.type === 'group';
      const open = isG && S.expanded.has(id);
      const hidEff = !effVisible(doc, id), lockEff = effLocked(doc, id);
      const row = hEl('div', { class: 'lrow' + (hidEff ? ' hidden-eff' : '') + (lockEff ? ' locked-eff' : ''), role: 'treeitem', 'aria-level': String(level), 'aria-selected': S.sel.includes(id) ? 'true' : 'false', 'aria-expanded': isG ? String(open) : null, 'data-id': id, tabindex: '0', style: `padding-left:${(level - 1) * 14 + 2}px`, title: `${n.name} (${TYPE_LABEL[n.type]})` });
      const tw = hEl('button', { class: 'twist' + (isG ? '' : ' none'), type: 'button', 'data-act': 'twist', 'aria-label': `${open ? 'Collapse' : 'Expand'} ${n.name}`, tabindex: isG ? null : '-1' }, icon(open ? 'chevD' : 'chevR'));
      const ty = hEl('span', { class: 'ltype' }, icon(isG ? 'group' : n.type));
      const nm = hEl('span', { class: 'lname' }, n.name || '(unnamed)');
      const vis = hEl('button', { class: 'vis' + (n.visible ? '' : ' on'), type: 'button', 'data-act': 'vis', 'aria-pressed': String(!n.visible), 'aria-label': `${n.visible ? 'Hide' : 'Show'} ${n.name}`, title: n.visible ? 'Hide' : 'Show' }, icon(n.visible ? 'eye' : 'eyeOff'));
      const lk = hEl('button', { class: 'lk' + (n.locked ? ' on' : ''), type: 'button', 'data-act': 'lock', 'aria-pressed': String(n.locked), 'aria-label': `${n.locked ? 'Unlock' : 'Lock'} ${n.name}`, title: n.locked ? 'Unlock' : (lockEff ? 'Locked by a parent group' : 'Lock') }, icon(n.locked ? 'lock' : 'unlock'));
      row.append(tw, ty, nm, vis, lk);
      frag.appendChild(row);
      if (open) walk(n.children, level + 1);
    }
  };
  walk(doc.root, 1);
  if (!doc.root.length) frag.appendChild(hEl('div', { class: 'lempty' }, 'No items yet — draw with the tools on the left.'));
  const sc = layersEl.scrollTop;
  layersEl.replaceChildren(frag);
  layersEl.scrollTop = sc;
  const selRow = S.sel.length ? layersEl.querySelector(`.lrow[aria-selected="true"]`) : null;
  if (selRow && selRow.scrollIntoView) {
    const r = selRow.getBoundingClientRect(), pr = layersEl.getBoundingClientRect();
    if (r.top < pr.top || r.bottom > pr.bottom) selRow.scrollIntoView({ block: 'nearest' });
  }
}
function layersClick(e) {
  const row = e.target.closest('.lrow');
  if (!row) return;
  const id = row.getAttribute('data-id');
  if (!S.doc.nodes[id]) return;
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.getAttribute('data-act');
    if (a === 'twist') { if (S.expanded.has(id)) S.expanded.delete(id); else S.expanded.add(id); render(); }
    else if (a === 'vis') toggleProp(id, 'visible');
    else if (a === 'lock') toggleProp(id, 'locked');
    return;
  }
  if (e.target.closest('input')) return;
  if (e.shiftKey || e.ctrlKey || e.metaKey || S.addMode) S.sel = S.sel.includes(id) ? S.sel.filter((x) => x !== id) : S.sel.concat(id);
  else S.sel = [id];
  const n = S.doc.nodes[id];
  S.nodeSel = (n.type === 'path' || n.type === 'line') && S.sel.length === 1 ? { id, index: 0 } : null;
  render();
}
function layersDbl(e) {
  const nmEl = e.target.closest('.lname');
  const row = e.target.closest('.lrow');
  if (!nmEl || !row) return;
  startRename(row.getAttribute('data-id'), nmEl);
}
function startRename(id, nmEl) {
  const n = S.doc.nodes[id];
  if (!n) return;
  if (effLocked(S.doc, id)) { toast(`“${n.name}” is locked; unlock it to rename.`, 'error'); return; }
  const inp = hEl('input', { type: 'text', value: n.name, maxlength: String(LIMITS.name), 'aria-label': 'Rename layer' });
  nmEl.replaceChildren(inp);
  inp.focus(); inp.select();
  let done = false;
  const finish = (ok) => {
    if (done) return; done = true;
    const v = sanitizeText(inp.value).replace(/\n/g, ' ').slice(0, LIMITS.name);
    LY.sig = '';
    if (ok && v !== n.name) edit('Rename', (d) => { d.nodes[id].name = v; });
    else render();
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}
function layersKey(e) {
  const row = e.target.closest('.lrow');
  if (!row || e.target !== row) return;
  const id = row.getAttribute('data-id');
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); S.sel = [id]; render(); const r = layersEl.querySelector(`.lrow[data-id="${CSS.escape(id)}"]`); if (r) r.focus(); }
  else if (e.key === 'F2') { e.preventDefault(); startRename(id, row.querySelector('.lname')); }
}

/* ---------------- status, hint, chrome ---------------- */
function renderStatus() {
  if (!S.doc) return;
  const t = selTargets();
  const U = t.length ? unionBounds(S.doc, t) : null;
  const items = Object.keys(S.doc.nodes).length;
  const selTxt = t.length === 0 ? 'none' : t.length === 1 ? `${S.doc.nodes[t[0]].name}` : `${t.length} items`;
  const anchorsSel = t.length === 1 && S.doc.nodes[t[0]].type === 'path' ? ` · sel ${S.doc.nodes[t[0]].anchors.length}` : '';
  const toolName = (TOOLS.find((x) => x && x.id === S.tool) || {}).label || S.tool;
  statusEl.replaceChildren(
    hEl('span', { 'data-diag': 'tool' }, 'Tool ', hEl('b', null, toolName.split(' ')[0])),
    hEl('span', { 'data-diag': 'zoom' }, 'Zoom ', hEl('b', null, `${Math.round(S.view.zoom * 1000) / 10}%`)),
    hEl('span', { 'data-diag': 'selection' }, 'Sel ', hEl('b', null, selTxt)),
    hEl('span', { class: 'opt', 'data-diag': 'bounds' }, 'Bounds ', hEl('b', null, U ? `${fmt(U.x)}, ${fmt(U.y)}, ${fmt(U.w)} × ${fmt(U.h)}` : '—')),
    hEl('span', { 'data-diag': 'items' }, 'Items ', hEl('b', null, `${items}/${LIMITS.items}`)),
    hEl('span', { class: 'opt', 'data-diag': 'anchors' }, 'Anchors ', hEl('b', null, `${countAnchors(S.doc)}${anchorsSel}`)),
    hEl('span', { 'data-diag': 'history' }, 'History ', hEl('b', null, `↶${S.hist.past.length} ↷${S.hist.future.length}`)),
    hEl('span', { class: 'io' + (S.io.err ? ' err' : ''), 'data-diag': 'io', title: S.io.msg }, S.io.msg));
  $('#zoomLabel').textContent = `${Math.round(S.view.zoom * 100)}%`;
  $('#btnUndo').disabled = !S.hist.past.length;
  $('#btnRedo').disabled = !S.hist.future.length;
  $('#btnUndo').title = S.hist.past.length ? `Undo ${S.hist.past[S.hist.past.length - 1].label} (Ctrl+Z)` : 'Undo (Ctrl+Z)';
  $('#btnRedo').title = S.hist.future.length ? `Redo ${S.hist.future[S.hist.future.length - 1].label} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)';
}
function renderHint() {
  const m = {
    select: 'Click to select · Shift adds · Ctrl/⌘-click selects inside groups · drag to move or marquee · double-click enters a group',
    node: 'Drag points and handles · Alt-drag a point to pull out handles · Delete removes the selected point',
    rect: 'Drag to draw a rectangle · Shift = square · click for 120×80',
    ellipse: 'Drag to draw an ellipse · Shift = circle · click for 100×100',
    line: 'Drag to draw a line · Shift = 45° steps',
    path: S.pathDraft ? `${S.pathDraft.anchors.length} point${S.pathDraft.anchors.length === 1 ? '' : 's'} · click adds a corner · drag pulls a curve · click the first point to close · Enter/Esc finishes` : 'Click to add corner points · drag to pull cubic handles · click the first point to close',
    text: 'Click on the canvas to place a text box, then type in the Inspector',
    hand: 'Drag to pan · wheel scrolls · Ctrl+wheel zooms',
  };
  hintEl.textContent = m[S.tool] || '';
}
function renderPanels() {
  for (const b of document.querySelectorAll('#tools .tool')) b.setAttribute('aria-pressed', String(b.dataset.tool === S.tool));
  stage.setAttribute('class', 'tool-' + S.tool + (S.spaceDown || S.tool === 'hand' ? ' panning' : '') + (S.op && S.op.type === 'pan' ? ' panning dragging' : ''));
  renderInspector();
  renderLayers();
  renderStatus();
  renderHint();
}
function setPanelTab(tab) {
  const p = $('#panel');
  p.dataset.tab = tab;
  $('#tabInspect').setAttribute('aria-selected', String(tab === 'inspect'));
  $('#tabLayers').setAttribute('aria-selected', String(tab === 'layers'));
}
function syncCanvasBar() {
  $('#addMode').checked = S.addMode; $('#snapGrid').checked = S.snapGrid; $('#snapObj').checked = S.snapObj; $('#showGrid').checked = S.showGrid; $('#gridSize').value = String(S.gridSize);
}

/* ---------------- wiring ---------------- */
function wire() {
  buildTools();
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerCancel);
  stage.addEventListener('lostpointercapture', onLostCapture);
  stage.addEventListener('pointerleave', () => { if (!S.op && S.hoverId) { S.hoverId = null; renderOverlay(); } });
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('dblclick', onDblClick);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    S.spaceDown = false;
    if (S.op && S.op.type !== 'pathHandle') { cancelOp(); toast('Focus lost — drag cancelled, nothing changed.', 'info', 2600); }
    if (S.live && S.live.kind === 'scrub') cancelLive();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.op) cancelOp(); });
  let lastSize = null;
  const onResize = () => {
    const r = stage.getBoundingClientRect();
    if (lastSize && S.doc) { // keep the document point at the centre stable
      S.view.px += (r.width - lastSize.w) / 2;
      S.view.py += (r.height - lastSize.h) / 2;
    }
    lastSize = { w: r.width, h: r.height };
    if (S.doc) render();
  };
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
  else window.addEventListener('resize', onResize);
  $('#btnNew').addEventListener('click', cmdNew);
  $('#btnLoadComp').addEventListener('click', () => loadComposition($('#compSelect').value));
  $('#btnImport').addEventListener('click', () => { fileImport.value = ''; fileImport.click(); });
  fileImport.addEventListener('change', () => { const f = fileImport.files && fileImport.files[0]; if (f) importFile(f); fileImport.value = ''; });
  $('#btnExportJSON').addEventListener('click', exportJSON);
  $('#btnExportSVG').addEventListener('click', exportSVG);
  $('#btnExportPNG').addEventListener('click', exportPNG);
  $('#btnPreview').addEventListener('click', openPreview);
  $('#previewClose').addEventListener('click', closePreview);
  $('#preview').addEventListener('click', (e) => { if (e.target.id === 'preview') closePreview(); });
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnHelp').addEventListener('click', showShortcuts);
  $('#btnReset').addEventListener('click', () => {
    openModal('Reset session?', 'Reset restores the initial Solstice composition and clears the selection, undo/redo history, imported documents, pending imports and any in-progress edits. This is a fresh-session boundary and cannot be undone.', [{ label: 'Cancel', value: false }, { label: 'Reset session', value: true, primary: true }])
      .then((ok) => { if (ok) resetSession(); });
  });
  $('#snapGrid').addEventListener('change', (e) => { S.snapGrid = e.target.checked; setIO(`Grid snapping ${S.snapGrid ? 'on' : 'off'}`); });
  $('#snapObj').addEventListener('change', (e) => { S.snapObj = e.target.checked; setIO(`Object snapping ${S.snapObj ? 'on' : 'off'}`); });
  $('#showGrid').addEventListener('change', (e) => { S.showGrid = e.target.checked; render(); });
  $('#addMode').addEventListener('change', (e) => { S.addMode = e.target.checked; setIO(`Multi-select ${S.addMode ? 'on — clicks add/remove items' : 'off'}`); });
  const gs = $('#gridSize');
  const commitGrid = () => {
    const r = parseNum(gs.value, { name: 'Grid size', min: LIMITS.grid[0], max: LIMITS.grid[1] });
    if (r.err) { gs.value = String(S.gridSize); toast(r.err + ' — grid unchanged.', 'warn'); return; }
    S.gridSize = r.v; gs.value = String(r.v); render(); setIO(`Grid size ${r.v}`);
  };
  gs.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitGrid(); gs.select(); } else if (e.key === 'Escape') { e.preventDefault(); gs.value = String(S.gridSize); gs.blur(); } });
  gs.addEventListener('blur', commitGrid);
  $('#zoomIn').addEventListener('click', () => zoomAt(1.25));
  $('#zoomOut').addEventListener('click', () => zoomAt(0.8));
  $('#zoom100').addEventListener('click', () => setZoom(1));
  $('#zoomFit').addEventListener('click', () => { fitView(); render(); });
  $('#lyFront').addEventListener('click', () => cmdReorder('front'));
  $('#lyUp').addEventListener('click', () => cmdReorder('up'));
  $('#lyDown').addEventListener('click', () => cmdReorder('down'));
  $('#lyBack').addEventListener('click', () => cmdReorder('back'));
  layersEl.addEventListener('click', layersClick);
  layersEl.addEventListener('dblclick', layersDbl);
  layersEl.addEventListener('keydown', layersKey);
  $('#tabInspect').addEventListener('click', () => setPanelTab('inspect'));
  $('#tabLayers').addEventListener('click', () => setPanelTab('layers'));
}

/* ---------------- read-only diagnostics for testing ---------------- */
function diagnostics() {
  const t = selTargets();
  const bounds = {};
  for (const id in S.doc.nodes) { const b = nodeBounds(S.doc, id); bounds[id] = b && { x: round(b.x, 4), y: round(b.y, 4), w: round(b.w, 4), h: round(b.h, 4) }; }
  return JSON.parse(JSON.stringify({
    tool: S.tool, zoom: S.view.zoom, pan: { x: S.view.px, y: S.view.py }, selection: S.sel, targets: t,
    selectionBounds: t.length ? unionBounds(S.doc, t) : null, items: Object.keys(S.doc.nodes).length, anchors: countAnchors(S.doc),
    history: { undo: S.hist.past.length, redo: S.hist.future.length, labels: S.hist.past.map((e) => e.label) },
    liveTransaction: S.live ? S.live.kind : null, op: S.op ? S.op.type : null, nodeSel: S.nodeSel, pathDraft: S.pathDraft ? S.pathDraft.anchors.length : 0,
    snap: { grid: S.snapGrid, object: S.snapObj, gridSize: S.gridSize }, guides: S.guides, io: S.io, docName: S.docName, session: S.session,
    project: docToProject(S.doc), bounds,
  }));
}
try { Object.defineProperty(window, 'VLS', { value: Object.freeze({ diagnostics }), configurable: false, writable: false }); } catch (_) { /* ignore */ }

/* ---------------- boot ---------------- */
function boot() {
  wire();
  S.doc = loadComposition('solstice', true);
  S.docName = COMPOSITIONS.solstice.title;
  syncCanvasBar();
  fitView();
  render();
  setIO('Ready — Solstice poster loaded. Everything on the artboard is editable.');
}
boot();
