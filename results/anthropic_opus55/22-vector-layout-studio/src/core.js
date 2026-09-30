'use strict';
/* ============================================================
   Vector & Layout Studio — core: limits, math, model, geometry,
   validation, project schema, scene rendering and export.
   ============================================================ */
const SVGNS = 'http://www.w3.org/2000/svg';
const XMLNS = 'http://www.w3.org/XML/1998/namespace';
const FORMAT = 'vector-layout-studio';
const FORMAT_VERSION = 1;

const LIMITS = Object.freeze({
  items: 500,            // total scene items (groups included); required minimum is 200
  anchors: 32,           // anchors per path
  depth: 8,              // nested group levels; required minimum is 4
  text: 2000,            // characters per text item
  name: 120,             // characters per layer name
  coord: 100000,         // |coordinate| / |translation| bound in document units
  world: 1000000,        // |world-space bound| after composing transforms
  size: 100000,          // max local width/height
  minSize: 0.1,          // min rect/ellipse width/height
  scaleMin: 0.01,
  scaleMax: 100,
  worldScaleMin: 1e-4,
  worldScaleMax: 1e4,
  stroke: 1000,
  fontMin: 1,
  fontMax: 1000,
  lineHMin: 0.5,
  lineHMax: 5,
  artMin: 64,
  artMax: 2048,
  importBytes: 5 * 1024 * 1024,
  exportSide: 4096,
  exportPixels: 16777216,
  grid: [1, 1000],
  history: 200,
});

class UserError extends Error {}
const fail = (msg) => { throw new UserError(msg); };

/* ---------------- small utils ---------------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function round(v, d = 4) {
  const p = Math.pow(10, d);
  const r = Math.round(v * p) / p;
  return Object.is(r, -0) ? 0 : r;
}
const fmt = (v, d = 2) => String(round(v, d));
const num = (v) => String(round(v, 4));
const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isHex = (s) => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
const isPaint = (s) => s === 'none' || isHex(s);
function escXML(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
// characters that are not allowed in XML 1.0 text (we allow only \n among controls)
const BAD_TEXT_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
function sanitizeText(s) {
  return String(s).replace(/\r\n?/g, '\n').replace(/\t/g, '  ')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '').replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
}
function normDeg(r) {
  let a = r % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Object.is(a, -0) ? 0 : a;
}
function naturalCmp(a, b) {
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

/* ---------------- 2D affine matrices [a b c d e f] ---------------- */
const IDENT = Object.freeze([1, 0, 0, 1, 0, 0]);
function mMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
const mApply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
const mDet = (m) => m[0] * m[3] - m[1] * m[2];
function mInv(m) {
  const det = mDet(m);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-14) return null;
  return [
    m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}
const mTranslate = (x, y) => [1, 0, 0, 1, x, y];
function mRotateAbout(deg, cx, cy) {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
}
const mScaleAbout = (k, cx, cy) => [k, 0, 0, k, cx - k * cx, cy - k * cy];
function localMatrix(n) {
  const t = n.transform;
  const r = t.rotation * Math.PI / 180;
  const c = Math.cos(r) * t.scale, s = Math.sin(r) * t.scale;
  return [c, s, -s, c, t.x, t.y];
}
function isIdentity(m) {
  return Math.abs(m[0] - 1) < 1e-12 && Math.abs(m[1]) < 1e-12 && Math.abs(m[2]) < 1e-12 &&
    Math.abs(m[3] - 1) < 1e-12 && Math.abs(m[4]) < 1e-12 && Math.abs(m[5]) < 1e-12;
}
// Decompose a similarity matrix (rotation + positive uniform scale + translation).
function trsFromMatrix(m) {
  const s = Math.hypot(m[0], m[1]);
  const skew = Math.abs(m[0] - m[3]) + Math.abs(m[1] + m[2]);
  if (!Number.isFinite(s) || s <= 0 || skew > 1e-6 * Math.max(1, s)) fail('That transform is singular or not a rotation + uniform scale; it was refused.');
  return {
    x: round(m[4], 6), y: round(m[5], 6),
    rotation: normDeg(round(Math.atan2(m[1], m[0]) * 180 / Math.PI, 6)),
    scale: round(s, 9),
  };
}

/* ---------------- fonts & text layout ---------------- */
const FONT_STACKS = Object.freeze({
  sans: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif',
  serif: 'Georgia, "Times New Roman", "Liberation Serif", "DejaVu Serif", serif',
  mono: 'Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
});
const FONT_LABELS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
// Declared font metrics: each line occupies size×lineHeight; the em box (ascent 0.8em,
// descent 0.2em) is centred in that slot. Width = widest measured line.
const ASCENT = 0.8;
const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d');
const layoutCache = new Map();
const fontString = (n) => `${n.fontWeight} ${n.fontSize}px ${FONT_STACKS[n.fontFamily]}`;
function textLayout(n) {
  const key = n.text + '\u0001' + n.fontFamily + '|' + n.fontSize + '|' + n.fontWeight + '|' + n.lineHeight + '|' + n.align;
  let L = layoutCache.get(key);
  if (L) return L;
  measureCtx.font = fontString(n);
  const lines = n.text.split('\n');
  let w = 0;
  const widths = lines.map((l) => { const x = measureCtx.measureText(l).width; if (x > w) w = x; return x; });
  w = Math.max(w, n.fontSize * 0.25);
  const adv = n.fontSize * n.lineHeight;
  const base0 = (adv - n.fontSize) / 2 + n.fontSize * ASCENT;
  L = {
    lines, widths, w, h: lines.length * adv, adv,
    anchorX: n.align === 'center' ? w / 2 : n.align === 'right' ? w : 0,
    baselines: lines.map((_, i) => i * adv + base0),
  };
  if (layoutCache.size > 600) layoutCache.clear();
  layoutCache.set(key, L);
  return L;
}

/* ---------------- cubic path geometry ---------------- */
function pathSegments(n) {
  const A = n.anchors, out = [];
  for (let i = 0; i < A.length - 1; i++) out.push([A[i], A[i + 1], i]);
  if (n.closed && A.length > 1) out.push([A[A.length - 1], A[0], A.length - 1]);
  return out;
}
function cubicRoots(p0, p1, p2, p3) {
  const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
  const ts = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) ts.push(-c / b); }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const q = Math.sqrt(disc); ts.push((-b + q) / (2 * a), (-b - q) / (2 * a)); }
  }
  return ts.filter((t) => t > 0 && t < 1);
}
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };
function pathLocalBox(n) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const inc = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
  for (const a of n.anchors) inc(a.x, a.y);
  for (const [a, b] of pathSegments(n)) {
    for (const t of cubicRoots(a.x, a.outX, b.inX, b.x)) { const x = bez(a.x, a.outX, b.inX, b.x, t); if (x < x0) x0 = x; if (x > x1) x1 = x; }
    for (const t of cubicRoots(a.y, a.outY, b.inY, b.y)) { const y = bez(a.y, a.outY, b.inY, b.y, t); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, x1, y1 };
}
function pathD(n) {
  const A = n.anchors;
  let d = `M${num(A[0].x)} ${num(A[0].y)}`;
  for (const [a, b] of pathSegments(n)) d += ` C${num(a.outX)} ${num(a.outY)} ${num(b.inX)} ${num(b.inY)} ${num(b.x)} ${num(b.y)}`;
  if (n.closed) d += ' Z';
  return d;
}
const lerp = (a, b, t) => a + (b - a) * t;
// Split segment starting at anchor i at t (de Casteljau) — preserves the curve shape.
function splitSegment(n, i, t = 0.5) {
  const A = n.anchors, j = (i + 1) % A.length, a = A[i], b = A[j];
  const P = (k) => [[a.x, a.outX, b.inX, b.x], [a.y, a.outY, b.inY, b.y]][k];
  const res = [0, 1].map((k) => {
    const [p0, p1, p2, p3] = P(k);
    const q0 = lerp(p0, p1, t), q1 = lerp(p1, p2, t), q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t), r1 = lerp(q1, q2, t), s = lerp(r0, r1, t);
    return { q0, q2, r0, r1, s };
  });
  const [X, Y] = res;
  a.outX = round(X.q0, 6); a.outY = round(Y.q0, 6);
  b.inX = round(X.q2, 6); b.inY = round(Y.q2, 6);
  const na = { x: round(X.s, 6), y: round(Y.s, 6), inX: round(X.r0, 6), inY: round(Y.r0, 6), outX: round(X.r1, 6), outY: round(Y.r1, 6) };
  A.splice(i + 1, 0, na);
  return i + 1;
}

/* ---------------- document model ---------------- */
// doc = { artboard:{width,height,background,transparent}, root:[ids], nodes:{id:node} }
// node = { id, type, parent, name, visible, locked, transform:{x,y,rotation,scale}, opacity, ...type fields, children? }
const TYPES = ['rect', 'ellipse', 'line', 'path', 'text', 'group'];
const TYPE_LABEL = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', path: 'Path', text: 'Text', group: 'Group' };
const COMMON_FIELDS = ['id', 'type', 'parent', 'name', 'visible', 'locked', 'transform', 'opacity'];
const TYPE_FIELDS = {
  rect: ['width', 'height', 'radius', 'fill', 'stroke', 'strokeWidth'],
  ellipse: ['width', 'height', 'fill', 'stroke', 'strokeWidth'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'strokeWidth'],
  path: ['anchors', 'closed', 'fill', 'stroke', 'strokeWidth'],
  text: ['text', 'fontFamily', 'fontSize', 'fontWeight', 'align', 'lineHeight', 'fill'],
  group: [],
};
const hasFill = (n) => n.type === 'rect' || n.type === 'ellipse' || n.type === 'path' || n.type === 'text';
const hasStroke = (n) => n.type === 'rect' || n.type === 'ellipse' || n.type === 'path' || n.type === 'line';

const childList = (doc, pid) => (pid ? doc.nodes[pid].children : doc.root);
function worldMatrix(doc, id) {
  const chain = [];
  for (let cur = id; cur; cur = doc.nodes[cur].parent) chain.push(cur);
  let m = IDENT;
  for (let i = chain.length - 1; i >= 0; i--) m = mMul(m, localMatrix(doc.nodes[chain[i]]));
  return m;
}
const parentWorld = (doc, id) => { const p = doc.nodes[id].parent; return p ? worldMatrix(doc, p) : IDENT; };
function ancestorsOf(doc, id) {
  const out = [];
  for (let p = doc.nodes[id].parent; p; p = doc.nodes[p].parent) out.push(p);
  return out;
}
function effVisible(doc, id) {
  for (let cur = id; cur; cur = doc.nodes[cur].parent) if (!doc.nodes[cur].visible) return false;
  return true;
}
function effLocked(doc, id) {
  for (let cur = id; cur; cur = doc.nodes[cur].parent) if (doc.nodes[cur].locked) return true;
  return false;
}
function groupLevel(doc, id) {
  let lvl = doc.nodes[id].type === 'group' ? 1 : 0;
  for (let p = doc.nodes[id].parent; p; p = doc.nodes[p].parent) lvl++;
  return lvl;
}
function subtreeDepth(doc, id) { // group levels contained in this subtree incl. itself
  const n = doc.nodes[id];
  if (n.type !== 'group') return 0;
  let m = 0;
  for (const c of n.children) m = Math.max(m, subtreeDepth(doc, c));
  return 1 + m;
}
function subtreeIds(doc, id, out = []) {
  out.push(id);
  const n = doc.nodes[id];
  if (n.type === 'group') for (const c of n.children) subtreeIds(doc, c, out);
  return out;
}
function paintOrder(doc) { // DFS back-to-front
  const out = [];
  const walk = (ids) => { for (const id of ids) { out.push(id); const n = doc.nodes[id]; if (n.type === 'group') walk(n.children); } };
  walk(doc.root);
  return out;
}
function isAncestor(doc, anc, id) {
  for (let p = doc.nodes[id].parent; p; p = doc.nodes[p].parent) if (p === anc) return true;
  return false;
}
// Remove descendants of other selected items (so an op applies once, to the ancestor), keep paint order.
function effectiveTargets(doc, sel) {
  const set = new Set(sel.filter((id) => doc.nodes[id]));
  const keep = [...set].filter((id) => !ancestorsOf(doc, id).some((a) => set.has(a)));
  const order = new Map(paintOrder(doc).map((id, i) => [id, i]));
  return keep.sort((a, b) => order.get(a) - order.get(b));
}
function countAnchors(doc) {
  let n = 0;
  for (const id in doc.nodes) { const x = doc.nodes[id]; if (x.type === 'path') n += x.anchors.length; else if (x.type === 'line') n += 2; }
  return n;
}

/* ---------------- bounds (document-space layout boxes) ---------------- */
function leafLocalBox(n) {
  switch (n.type) {
    case 'rect': case 'ellipse': return { x0: 0, y0: 0, x1: n.width, y1: n.height };
    case 'line': return { x0: Math.min(n.x1, n.x2), y0: Math.min(n.y1, n.y2), x1: Math.max(n.x1, n.x2), y1: Math.max(n.y1, n.y2) };
    case 'path': return pathLocalBox(n);
    case 'text': { const L = textLayout(n); return { x0: 0, y0: 0, x1: L.w, y1: L.h }; }
  }
  return null;
}
function boxCorners(m, b) {
  return [mApply(m, b.x0, b.y0), mApply(m, b.x1, b.y0), mApply(m, b.x1, b.y1), mApply(m, b.x0, b.y1)];
}
function aabb(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function unionB(a, b) {
  if (!a) return b; if (!b) return a;
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
  return { x: x0, y: y0, w: Math.max(a.x + a.w, b.x + b.w) - x0, h: Math.max(a.y + a.h, b.y + b.h) - y0 };
}
function nodeBounds(doc, id, m) {
  const n = doc.nodes[id];
  const W = m || worldMatrix(doc, id);
  if (n.type === 'group') {
    let b = null;
    for (const c of n.children) b = unionB(b, nodeBounds(doc, c, mMul(W, localMatrix(doc.nodes[c]))));
    return b;
  }
  return aabb(boxCorners(W, leafLocalBox(n)));
}
function unionBounds(doc, ids) {
  let b = null;
  for (const id of ids) b = unionB(b, nodeBounds(doc, id));
  return b;
}

/* ---------------- transforms applied in document space ---------------- */
function applyWorld(doc, id, M) {
  const n = doc.nodes[id];
  const P = parentWorld(doc, id);
  const Pi = mInv(P);
  if (!Pi) fail('A parent transform is singular; the operation was refused.');
  n.transform = trsFromMatrix(mMul(Pi, mMul(M, mMul(P, localMatrix(n)))));
}
function translateDoc(doc, id, dx, dy) {
  const n = doc.nodes[id];
  const Pi = mInv(parentWorld(doc, id));
  if (!Pi) fail('A parent transform is singular; the operation was refused.');
  n.transform.x = round(n.transform.x + Pi[0] * dx + Pi[2] * dy, 6);
  n.transform.y = round(n.transform.y + Pi[1] * dx + Pi[3] * dy, 6);
}

/* ---------------- validation ---------------- */
function checkNum(v, lo, hi, what) {
  if (!isFiniteNum(v)) fail(`${what} must be a finite number.`);
  if (v < lo || v > hi) fail(`${what} must be between ${lo} and ${hi} (got ${round(v, 4)}).`);
}
function validateNodeFields(n, label) {
  const L = label || `Item “${n && n.id}”`;
  if (!TYPES.includes(n.type)) fail(`${L}: unsupported type “${String(n.type).slice(0, 40)}”.`);
  if (typeof n.name !== 'string' || n.name.length > LIMITS.name) fail(`${L}: name must be text up to ${LIMITS.name} characters.`);
  if (BAD_TEXT_CHARS.test(n.name)) fail(`${L}: name contains control characters.`);
  if (typeof n.visible !== 'boolean' || typeof n.locked !== 'boolean') fail(`${L}: visible/locked must be true or false.`);
  const t = n.transform;
  if (!t || typeof t !== 'object' || Array.isArray(t)) fail(`${L}: missing transform.`);
  for (const k of Object.keys(t)) if (!['x', 'y', 'rotation', 'scale'].includes(k)) fail(`${L}: unsupported transform field “${k.slice(0, 30)}”.`);
  checkNum(t.x, -LIMITS.coord, LIMITS.coord, `${L} transform x`);
  checkNum(t.y, -LIMITS.coord, LIMITS.coord, `${L} transform y`);
  checkNum(t.rotation, -360, 360, `${L} rotation`);
  if (!isFiniteNum(t.scale) || t.scale <= 0) fail(`${L}: scale must be a positive number (zero or negative scale is singular).`);
  checkNum(t.scale, LIMITS.scaleMin, LIMITS.scaleMax, `${L} scale`);
  checkNum(n.opacity, 0, 1, `${L} opacity`);
  if (hasFill(n) && !isPaint(n.fill)) fail(`${L}: fill must be “none” or a #rrggbb colour.`);
  if (hasStroke(n)) {
    if (!isPaint(n.stroke)) fail(`${L}: stroke must be “none” or a #rrggbb colour.`);
    checkNum(n.strokeWidth, 0, LIMITS.stroke, `${L} stroke width`);
  }
  switch (n.type) {
    case 'rect':
      checkNum(n.radius, 0, LIMITS.size, `${L} corner radius`);
    // falls through
    case 'ellipse':
      checkNum(n.width, LIMITS.minSize, LIMITS.size, `${L} width`);
      checkNum(n.height, LIMITS.minSize, LIMITS.size, `${L} height`);
      break;
    case 'line':
      for (const k of ['x1', 'y1', 'x2', 'y2']) checkNum(n[k], -LIMITS.coord, LIMITS.coord, `${L} ${k}`);
      break;
    case 'path': {
      if (!Array.isArray(n.anchors)) fail(`${L}: anchors must be a list.`);
      if (n.anchors.length < 2) fail(`${L}: a path needs at least 2 anchors.`);
      if (n.anchors.length > LIMITS.anchors) fail(`${L}: ${n.anchors.length} anchors exceeds the limit of ${LIMITS.anchors} per path.`);
      if (typeof n.closed !== 'boolean') fail(`${L}: closed must be true or false.`);
      n.anchors.forEach((a, i) => {
        if (!a || typeof a !== 'object' || Array.isArray(a)) fail(`${L}: anchor ${i + 1} is malformed.`);
        for (const k of Object.keys(a)) if (!['x', 'y', 'inX', 'inY', 'outX', 'outY'].includes(k)) fail(`${L}: anchor ${i + 1} has unsupported field “${k.slice(0, 30)}”.`);
        for (const k of ['x', 'y', 'inX', 'inY', 'outX', 'outY']) checkNum(a[k], -LIMITS.coord, LIMITS.coord, `${L} anchor ${i + 1} ${k}`);
      });
      break;
    }
    case 'text':
      if (typeof n.text !== 'string') fail(`${L}: text must be a string.`);
      if (n.text.length > LIMITS.text) fail(`${L}: text has ${n.text.length} characters; the limit is ${LIMITS.text}.`);
      if (BAD_TEXT_CHARS.test(n.text)) fail(`${L}: text contains unsupported control characters.`);
      if (!FONT_STACKS[n.fontFamily] || !Object.prototype.hasOwnProperty.call(FONT_STACKS, n.fontFamily)) fail(`${L}: font family must be sans, serif or mono.`);
      checkNum(n.fontSize, LIMITS.fontMin, LIMITS.fontMax, `${L} font size`);
      if (n.fontWeight !== 400 && n.fontWeight !== 700) fail(`${L}: font weight must be 400 or 700.`);
      if (!['left', 'center', 'right'].includes(n.align)) fail(`${L}: align must be left, center or right.`);
      checkNum(n.lineHeight, LIMITS.lineHMin, LIMITS.lineHMax, `${L} line height`);
      break;
  }
}
function validateArtboard(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) fail('Artboard settings are missing.');
  for (const k of Object.keys(a)) if (!['width', 'height', 'background', 'transparent'].includes(k)) fail(`Artboard has unsupported field “${k.slice(0, 30)}”.`);
  for (const k of ['width', 'height']) {
    if (!Number.isInteger(a[k]) || a[k] < LIMITS.artMin || a[k] > LIMITS.artMax) fail(`Artboard ${k} must be a whole number from ${LIMITS.artMin} to ${LIMITS.artMax}.`);
  }
  if (!isHex(a.background)) fail('Artboard background must be a #rrggbb colour.');
  if (typeof a.transparent !== 'boolean') fail('Artboard transparent must be true or false.');
}
// Validates a whole in-memory document (used after every edit and after import).
function validateDoc(doc) {
  validateArtboard(doc.artboard);
  const ids = Object.keys(doc.nodes);
  if (ids.length > LIMITS.items) fail(`That would make ${ids.length} items; the limit is ${LIMITS.items}.`);
  let reached = 0;
  const seen = new Set();
  const walk = (list, parent, level) => {
    for (const id of list) {
      const n = doc.nodes[id];
      if (!n) fail(`Missing item “${String(id).slice(0, 40)}”.`);
      if (seen.has(id)) fail(`Item “${id}” appears twice in the hierarchy.`);
      seen.add(id); reached++;
      if (n.id !== id) fail(`Item id mismatch for “${id}”.`);
      if (n.parent !== parent) fail(`Item “${id}” has an inconsistent parent.`);
      validateNodeFields(n);
      if (n.type === 'group') {
        if (level + 1 > LIMITS.depth) fail(`Groups may be nested at most ${LIMITS.depth} levels deep.`);
        if (!Array.isArray(n.children) || n.children.length === 0) fail(`Group “${n.name || id}” has no children.`);
        walk(n.children, id, level + 1);
      }
    }
  };
  walk(doc.root, null, 0);
  if (reached !== ids.length) fail('Some items are not reachable from the artboard (orphans or cycles).');
  // world-space sanity: finite, non-singular, bounded
  for (const id of ids) {
    const W = worldMatrix(doc, id);
    const s = Math.hypot(W[0], W[1]);
    if (!W.every(Number.isFinite) || !(s >= LIMITS.worldScaleMin && s <= LIMITS.worldScaleMax)) fail(`Item “${doc.nodes[id].name || id}” would have a singular or extreme combined scale.`);
    if (doc.nodes[id].type !== 'group') {
      const b = nodeBounds(doc, id, W);
      if (![b.x, b.y, b.w, b.h].every(Number.isFinite) || Math.abs(b.x) > LIMITS.world || Math.abs(b.y) > LIMITS.world || Math.abs(b.x + b.w) > LIMITS.world || Math.abs(b.y + b.h) > LIMITS.world) fail(`Item “${doc.nodes[id].name || id}” would move outside the ±${LIMITS.world} unit workspace.`);
    }
  }
}
// Refuse any change that would alter an effectively-locked item (directly or through a parent).
function lockGuard(before, after) {
  for (const id in before.nodes) {
    if (!effLocked(before, id)) continue;
    const a = before.nodes[id], b = after.nodes[id];
    const nm = a.name || id;
    if (!b) fail(`“${nm}” is locked and cannot be deleted. Unlock it in Layers first.`);
    const strip = (n) => { const o = Object.assign({}, n); delete o.locked; delete o.visible; return JSON.stringify(o); };
    if (strip(a) !== strip(b)) fail(`“${nm}” is locked and cannot be changed. Unlock it in Layers first.`);
    const Wa = worldMatrix(before, id), Wb = worldMatrix(after, id);
    for (let i = 0; i < 6; i++) if (Math.abs(Wa[i] - Wb[i]) > 1e-7 * Math.max(1, Math.abs(Wa[i]))) fail(`“${nm}” is locked; transforming its parent group would move it. Unlock it in Layers first.`);
  }
}

/* ---------------- project JSON (versioned own schema) ---------------- */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function docToProject(doc) {
  const items = [];
  for (const id of paintOrder(doc)) {
    const n = JSON.parse(JSON.stringify(doc.nodes[id]));
    delete n.children;
    items.push(n);
  }
  return { format: FORMAT, version: FORMAT_VERSION, app: 'Vector & Layout Studio', artboard: Object.assign({}, doc.artboard), items };
}
function projectToDoc(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail('Project must be a JSON object.');
  for (const k of Object.keys(obj)) if (!['format', 'version', 'app', 'artboard', 'items'].includes(k)) fail(`Unsupported top-level field “${k.slice(0, 30)}”.`);
  if (obj.format !== FORMAT) fail(`Not a Vector & Layout Studio project (format must be “${FORMAT}”).`);
  if (obj.version !== FORMAT_VERSION) fail(`Unsupported project version ${JSON.stringify(obj.version)?.slice(0, 20)}; this editor reads version ${FORMAT_VERSION}.`);
  if (obj.app !== undefined && (typeof obj.app !== 'string' || obj.app.length > 200)) fail('Project “app” field must be short text.');
  validateArtboard(obj.artboard);
  if (!Array.isArray(obj.items)) fail('Project items must be a list.');
  if (obj.items.length > LIMITS.items) fail(`Project has ${obj.items.length} items; the limit is ${LIMITS.items}.`);
  const nodes = Object.create(null);
  const order = [];
  obj.items.forEach((it, i) => {
    if (!it || typeof it !== 'object' || Array.isArray(it)) fail(`Item ${i + 1} is not an object.`);
    if (typeof it.id !== 'string' || !ID_RE.test(it.id)) fail(`Item ${i + 1} has an invalid id (use 1–64 letters, digits, _ or -).`);
    if (nodes[it.id]) fail(`Duplicate item id “${it.id}”.`);
    if (!TYPES.includes(it.type)) fail(`Item “${it.id}” has unsupported type “${String(it.type).slice(0, 40)}”.`);
    const allowed = COMMON_FIELDS.concat(TYPE_FIELDS[it.type]);
    for (const k of Object.keys(it)) if (!allowed.includes(k)) fail(`Item “${it.id}” has unsupported field “${k.slice(0, 30)}”.`);
    for (const k of allowed) if (!(k in it)) fail(`Item “${it.id}” is missing “${k}”.`);
    if (it.parent !== null && (typeof it.parent !== 'string' || !ID_RE.test(it.parent))) fail(`Item “${it.id}” has an invalid parent reference.`);
    const n = JSON.parse(JSON.stringify(it));
    validateNodeFields(n, `Item “${it.id}”`);
    if (n.type === 'group') n.children = [];
    nodes[n.id] = n;
    order.push(n.id);
  });
  // references & cycles
  for (const id of order) {
    const p = nodes[id].parent;
    if (p === null) continue;
    if (!nodes[p]) fail(`Item “${id}” references missing parent “${p}”.`);
    if (nodes[p].type !== 'group') fail(`Item “${id}” has parent “${p}”, which is not a group.`);
  }
  for (const id of order) {
    let steps = 0;
    for (let p = nodes[id].parent; p; p = nodes[p].parent) {
      if (p === id || ++steps > order.length) fail(`Cyclic parent relationship involving “${id}”.`);
    }
  }
  const root = [];
  for (const id of order) { const p = nodes[id].parent; if (p) nodes[p].children.push(id); else root.push(id); }
  const doc = { artboard: Object.assign({}, obj.artboard), root, nodes: {} };
  for (const id of order) doc.nodes[id] = nodes[id];
  validateDoc(doc);
  return doc;
}
function parseProjectText(text) {
  if (typeof text !== 'string') fail('Could not read the file as text.');
  if (text.length > LIMITS.importBytes) fail(`File is larger than ${LIMITS.importBytes / 1048576} MB.`);
  const head = text.replace(/^﻿/, '').trimStart().slice(0, 64).toLowerCase();
  if (head.startsWith('<')) fail('SVG/HTML/XML import is not supported. Only Vector & Layout Studio project JSON can be imported.');
  let obj;
  try { obj = JSON.parse(text.replace(/^﻿/, '')); }
  catch (e) { fail('Malformed JSON: ' + String(e.message).slice(0, 120)); }
  return projectToDoc(obj);
}

/* ---------------- scene → SVG spec (shared by editor and export) ---------------- */
const matAttr = (m) => `matrix(${m.map((v) => String(round(v, 6))).join(' ')})`;
function paintAttrs(n, a) {
  if (hasStroke(n)) {
    a.stroke = n.stroke;
    if (n.stroke !== 'none') a['stroke-width'] = num(n.strokeWidth);
  }
}
function shapeSpec(n) {
  switch (n.type) {
    case 'rect': {
      const a = { x: 0, y: 0, width: num(n.width), height: num(n.height), fill: n.fill };
      const r = Math.min(n.radius, n.width / 2, n.height / 2);
      if (r > 0) { a.rx = num(r); a.ry = num(r); }
      paintAttrs(n, a);
      return { tag: 'rect', attrs: a };
    }
    case 'ellipse': {
      const a = { cx: num(n.width / 2), cy: num(n.height / 2), rx: num(n.width / 2), ry: num(n.height / 2), fill: n.fill };
      paintAttrs(n, a);
      return { tag: 'ellipse', attrs: a };
    }
    case 'line': {
      const a = { x1: num(n.x1), y1: num(n.y1), x2: num(n.x2), y2: num(n.y2), fill: 'none', 'stroke-linecap': 'round' };
      paintAttrs(n, a);
      return { tag: 'line', attrs: a };
    }
    case 'path': {
      const a = { d: pathD(n), fill: n.closed ? n.fill : 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      paintAttrs(n, a);
      return { tag: 'path', attrs: a };
    }
    case 'text': {
      const L = textLayout(n);
      const anchor = n.align === 'center' ? 'middle' : n.align === 'right' ? 'end' : 'start';
      const kids = [];
      L.lines.forEach((line, i) => { if (line.length) kids.push({ tag: 'tspan', attrs: { x: num(L.anchorX), y: num(L.baselines[i]) }, text: line }); });
      return {
        tag: 'text',
        attrs: { 'xml:space': 'preserve', 'font-family': FONT_STACKS[n.fontFamily], 'font-size': num(n.fontSize), 'font-weight': String(n.fontWeight), 'text-anchor': anchor, fill: n.fill },
        kids,
      };
    }
  }
  return null;
}
// ed: null for export; {zoom} for the editor (adds data-id + generous hit areas)
function nodeSpec(doc, id, ed, parentM) {
  const n = doc.nodes[id];
  if (!n.visible) return null;
  const lm = localMatrix(n);
  const attrs = {};
  if (!isIdentity(lm)) attrs.transform = matAttr(lm);
  if (n.opacity < 1) attrs.opacity = num(n.opacity);
  if (n.type === 'group') {
    const W = ed ? mMul(parentM || IDENT, lm) : null;
    return { tag: 'g', attrs, kids: n.children.map((c) => nodeSpec(doc, c, ed, W)).filter(Boolean) };
  }
  const kids = [shapeSpec(n)];
  if (ed) {
    attrs['data-id'] = id;
    const W = mMul(parentM || IDENT, lm);
    const ws = Math.hypot(W[0], W[1]) || 1;
    const hitW = Math.max(n.strokeWidth || 0, 12 / (ed.zoom * ws));
    if (n.type === 'text') {
      const L = textLayout(n);
      kids.unshift({ tag: 'rect', attrs: { class: 'hit', x: 0, y: 0, width: num(L.w), height: num(L.h), fill: 'transparent', stroke: 'none' } });
    } else if (n.type === 'line' || (n.type === 'path' && (!n.closed || n.fill === 'none')) || ((n.type === 'rect' || n.type === 'ellipse') && n.fill === 'none')) {
      const t = JSON.parse(JSON.stringify(kids[0]));
      t.attrs.fill = 'none'; t.attrs.stroke = 'transparent'; t.attrs['stroke-width'] = num(hitW); t.attrs.class = 'hit';
      kids.push(t);
    }
  }
  return { tag: 'g', attrs, kids };
}
function specToDOM(s) {
  const el = document.createElementNS(SVGNS, s.tag);
  for (const k in s.attrs) {
    if (k.startsWith('xml:')) el.setAttributeNS(XMLNS, k, s.attrs[k]);
    else el.setAttribute(k, s.attrs[k]);
  }
  if (s.text != null) el.textContent = s.text;
  if (s.kids) for (const k of s.kids) if (k) el.appendChild(specToDOM(k));
  return el;
}
function specToString(s, ind) {
  const pad = '  '.repeat(ind);
  let a = '';
  for (const k in s.attrs) a += ` ${k}="${escXML(s.attrs[k])}"`;
  if (s.text != null) return `${pad}<${s.tag}${a}>${escXML(s.text)}</${s.tag}>\n`;
  if (!s.kids || !s.kids.length) return `${pad}<${s.tag}${a}/>\n`;
  let out = `${pad}<${s.tag}${a}>\n`;
  for (const k of s.kids) if (k) out += specToString(k, ind + 1);
  return out + `${pad}</${s.tag}>\n`;
}
function exportSVGString(doc, title) {
  const { width: W, height: H, background, transparent } = doc.artboard;
  let s = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
  s += `  <title>${escXML(title || 'Artboard')}</title>\n`;
  if (!transparent) s += `  <rect x="0" y="0" width="${W}" height="${H}" fill="${escXML(background)}"/>\n`;
  for (const id of doc.root) { const sp = nodeSpec(doc, id, null); if (sp) s += specToString(sp, 1); }
  return s + '</svg>\n';
}

/* ---------------- Canvas 2D renderer (PNG export) ---------------- */
function drawShape(ctx, n) {
  const fillIt = (f) => { if (f && f !== 'none') { ctx.fillStyle = f; ctx.fill(); } };
  const strokeIt = () => { if (hasStroke(n) && n.stroke !== 'none' && n.strokeWidth > 0) { ctx.strokeStyle = n.stroke; ctx.lineWidth = n.strokeWidth; ctx.stroke(); } };
  switch (n.type) {
    case 'rect': {
      ctx.beginPath();
      const r = Math.min(n.radius, n.width / 2, n.height / 2);
      if (r > 0) ctx.roundRect(0, 0, n.width, n.height, r); else ctx.rect(0, 0, n.width, n.height);
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
      fillIt(n.fill); strokeIt(); break;
    }
    case 'ellipse':
      ctx.beginPath(); ctx.ellipse(n.width / 2, n.height / 2, n.width / 2, n.height / 2, 0, 0, Math.PI * 2);
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
      fillIt(n.fill); strokeIt(); break;
    case 'line':
      ctx.beginPath(); ctx.moveTo(n.x1, n.y1); ctx.lineTo(n.x2, n.y2);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; strokeIt(); break;
    case 'path': {
      const A = n.anchors;
      ctx.beginPath(); ctx.moveTo(A[0].x, A[0].y);
      for (const [a, b] of pathSegments(n)) ctx.bezierCurveTo(a.outX, a.outY, b.inX, b.inY, b.x, b.y);
      if (n.closed) ctx.closePath();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (n.closed) fillIt(n.fill);
      strokeIt(); break;
    }
    case 'text': {
      const L = textLayout(n);
      ctx.font = fontString(n);
      ctx.textAlign = n.align; ctx.textBaseline = 'alphabetic';
      if (n.fill !== 'none') {
        ctx.fillStyle = n.fill;
        L.lines.forEach((line, i) => { if (line.length) ctx.fillText(line, L.anchorX, L.baselines[i]); });
      }
      break;
    }
  }
}
function drawNode(ctx, doc, id, W, H) {
  const n = doc.nodes[id];
  if (!n.visible) return;
  ctx.save();
  const m = localMatrix(n);
  ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const needsLayer = n.opacity < 1 && (n.type === 'group' || (hasFill(n) && hasStroke(n) && n.fill !== 'none' && n.stroke !== 'none' && n.strokeWidth > 0 && (n.type !== 'path' || n.closed)));
  if (needsLayer) {
    const layer = document.createElement('canvas');
    layer.width = W; layer.height = H;
    const lc = layer.getContext('2d');
    lc.setTransform(ctx.getTransform());
    if (n.type === 'group') for (const c of n.children) drawNode(lc, doc, c, W, H);
    else drawShape(lc, n);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = n.opacity;
    ctx.drawImage(layer, 0, 0);
  } else if (n.type === 'group') {
    for (const c of n.children) drawNode(ctx, doc, c, W, H);
  } else {
    ctx.globalAlpha = n.opacity;
    drawShape(ctx, n);
  }
  ctx.restore();
}
function checkExportSize(doc, scale) {
  const W = doc.artboard.width * scale, H = doc.artboard.height * scale;
  if (W > LIMITS.exportSide || H > LIMITS.exportSide) fail(`PNG ${W}×${H} px exceeds the ${LIMITS.exportSide} px per side limit — choose a smaller scale.`);
  if (W * H > LIMITS.exportPixels) fail(`PNG ${W}×${H} px exceeds the ${LIMITS.exportPixels.toLocaleString('en')} pixel limit — choose a smaller scale.`);
  return { W, H };
}
function renderPNGCanvas(doc, scale) {
  const { W, H } = checkExportSize(doc, scale);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) fail('Canvas is unavailable for PNG export.');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if (!doc.artboard.transparent) { ctx.fillStyle = doc.artboard.background; ctx.fillRect(0, 0, doc.artboard.width, doc.artboard.height); }
  for (const id of doc.root) drawNode(ctx, doc, id, W, H);
  return cv;
}
