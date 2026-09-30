// ============================================================ ART (UI layer)
// Every tile and sprite is painted procedurally into cached offscreen
// canvases at device resolution. Visual randomness uses its own seeded RNG so
// it never touches game state.
const PALETTES = {
  fortress: { floor: '#3a3441', floor2: '#433c4b', grout: '#29232f', top: '#2b2632', face: '#514a5e', mortar: '#241f2a', hi: '#6f6882', tint: [255, 150, 70] },
  ruins: { floor: '#394032', floor2: '#414a37', grout: '#2a3025', top: '#283024', face: '#4f5a44', mortar: '#1f261a', hi: '#6c7a5e', moss: '#5f8f3f', tint: [255, 170, 90] },
  caverns: { floor: '#3b3129', floor2: '#44382e', grout: '#2b231d', top: '#2c231c', face: '#554333', mortar: '#211a14', hi: '#6d5946', tint: [255, 150, 80] },
  crypt: { floor: '#2e303e', floor2: '#353849', grout: '#20222d', top: '#222434', face: '#42455e', mortar: '#1a1c2a', hi: '#5c6080', tint: [120, 180, 255] },
  arena: { floor: '#4a3e31', floor2: '#524536', grout: '#382e24', top: '#342a20', face: '#615040', mortar: '#2a2219', hi: '#80705a', tint: [255, 160, 80] },
  sanctum: { floor: '#2b2226', floor2: '#33282d', grout: '#1c1518', top: '#1e1719', face: '#3f2f36', mortar: '#150f12', hi: '#5a4550', ember: '#ff6a2a', tint: [255, 110, 50] },
};
const Art = (() => {
  const cache = new Map();
  const mk = (S) => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  function get(key, S, draw) {
    const k = key + '@' + S; let c = cache.get(k);
    if (!c) { c = mk(S); const x = c.getContext('2d'); x.scale(S / 32, S / 32); x.lineJoin = 'round'; x.lineCap = 'round'; draw(x, makeRng('art|' + key)); cache.set(k, c); }
    return c;
  }
  const R = (r) => rnext(r);
  function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = clamp(Math.round(r + amt), 0, 255); g = clamp(Math.round(g + amt), 0, 255); b = clamp(Math.round(b + amt), 0, 255); return `rgb(${r},${g},${b})`; }
  function specks(x, r, n, col, a = 0.25, size = 1.2) { x.fillStyle = col; x.globalAlpha = a; for (let i = 0; i < n; i++) { x.fillRect(R(r) * 32, R(r) * 32, size, size); } x.globalAlpha = 1; }
  function floorTex(x, r, P, style, v) {
    x.fillStyle = P.floor; x.fillRect(0, 0, 32, 32);
    if (style === 'caverns') { specks(x, r, 40, '#000', 0.25, 1.4); specks(x, r, 18, P.hi, 0.3, 1.2); x.fillStyle = shade(P.floor, -12); for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(R(r) * 32, R(r) * 32, 2 + R(r) * 2, 1.2 + R(r), 0, 0, 7); x.fill(); } return; }
    if (style === 'arena') { specks(x, r, 60, '#000', 0.15); specks(x, r, 30, '#c9a877', 0.2); return; }
    const n = style === 'crypt' ? 2 : 2;
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
      const s = 32 / n; x.fillStyle = shade(v % 2 ? P.floor2 : P.floor, (R(r) - 0.5) * 14); x.fillRect(xx * s + 0.6, yy * s + 0.6, s - 1.2, s - 1.2);
    }
    x.strokeStyle = P.grout; x.lineWidth = 1.1; x.beginPath(); x.moveTo(16, 0); x.lineTo(16, 32); x.moveTo(0, 16); x.lineTo(32, 16); x.stroke();
    x.strokeRect(0.5, 0.5, 31, 31);
    specks(x, r, 24, '#000', 0.22); specks(x, r, 10, P.hi, 0.25);
    if (style === 'ruins' && P.moss) { x.fillStyle = P.moss; x.globalAlpha = 0.35; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(R(r) * 32, R(r) * 32, 1.5 + R(r) * 3, 0, 7); x.fill(); } x.globalAlpha = 1; }
    if (style === 'sanctum' && v % 3 === 0) { x.strokeStyle = P.ember; x.globalAlpha = 0.45; x.lineWidth = 0.9; x.beginPath(); let px = R(r) * 32, py = R(r) * 32; x.moveTo(px, py); for (let i = 0; i < 4; i++) { px += (R(r) - 0.5) * 12; py += (R(r) - 0.5) * 12; x.lineTo(px, py); } x.stroke(); x.globalAlpha = 1; }
    if (style === 'crypt' && v === 12) { x.fillStyle = '#d9d2bd'; x.globalAlpha = 0.7; x.beginPath(); x.arc(22, 22, 3, 0, 7); x.fill(); x.fillRect(19, 23, 6, 3); x.fillStyle = '#2a2530'; x.fillRect(20.5, 21, 1.4, 1.4); x.fillRect(23, 21, 1.4, 1.4); x.globalAlpha = 1; }
    if (v === 2 || v === 5) { x.strokeStyle = '#00000055'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(4 + R(r) * 8, 4); x.lineTo(10 + R(r) * 6, 12); x.lineTo(8 + R(r) * 6, 20); x.stroke(); }
  }
  function wallTex(x, r, P, style, face) {
    x.fillStyle = P.top; x.fillRect(0, 0, 32, 32);
    if (style === 'caverns') {
      for (let i = 0; i < 7; i++) { x.fillStyle = shade(P.top, (R(r) - 0.5) * 26); x.beginPath(); x.ellipse(R(r) * 32, R(r) * 32, 4 + R(r) * 6, 3 + R(r) * 5, R(r) * 3, 0, 7); x.fill(); }
      specks(x, r, 20, '#000', 0.25, 1.5);
      if (face) { const g = x.createLinearGradient(0, 12, 0, 32); g.addColorStop(0, shade(P.face, 10)); g.addColorStop(1, shade(P.face, -18)); x.fillStyle = g; x.beginPath(); x.moveTo(0, 14); for (let i = 0; i <= 8; i++) x.lineTo(i * 4, 12 + R(r) * 5); x.lineTo(32, 32); x.lineTo(0, 32); x.fill(); specks(x, r, 10, P.hi, 0.3, 1.4); if (R(r) < 0.35) { x.fillStyle = '#7fe0d0'; x.globalAlpha = 0.8; x.beginPath(); x.moveTo(20, 28); x.lineTo(23, 19); x.lineTo(25, 28); x.fill(); x.globalAlpha = 1; } }
      return;
    }
    x.fillStyle = P.hi; x.globalAlpha = 0.25; x.fillRect(0, 0, 32, 2); x.globalAlpha = 1;
    specks(x, r, 16, '#000', 0.2, 1.3);
    if (!face) { x.strokeStyle = P.hi; x.globalAlpha = 0.18; x.lineWidth = 1; x.strokeRect(1.5, 1.5, 29, 29); x.globalAlpha = 1; return; }
    const top = 11; const g = x.createLinearGradient(0, top, 0, 32); g.addColorStop(0, shade(P.face, 12)); g.addColorStop(1, shade(P.face, -14)); x.fillStyle = g; x.fillRect(0, top, 32, 32 - top);
    x.strokeStyle = P.mortar; x.lineWidth = 1;
    const bh = style === 'crypt' ? 10.5 : 7; let row = 0;
    for (let y = top; y < 32; y += bh, row++) { x.beginPath(); x.moveTo(0, y); x.lineTo(32, y); x.stroke(); const off = row % 2 ? 8 : 0; const bw = style === 'crypt' ? 16 : 11; for (let xx = off; xx < 32; xx += bw) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, Math.min(32, y + bh)); x.stroke(); } }
    for (let i = 0; i < 5; i++) { x.fillStyle = '#000'; x.globalAlpha = 0.12; x.fillRect(R(r) * 30, top + R(r) * 18, 3, 2); } x.globalAlpha = 1;
    if (style === 'ruins' && P.moss) { x.fillStyle = P.moss; x.globalAlpha = 0.55; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(R(r) * 32, top + R(r) * 6, 1.5 + R(r) * 2.5, 0, 7); x.fill(); } x.globalAlpha = 1; x.strokeStyle = '#4f7d33'; x.lineWidth = 1; x.beginPath(); const vx = 6 + R(r) * 20; x.moveTo(vx, top); x.quadraticCurveTo(vx + 3, top + 8, vx - 1, top + 16); x.stroke(); }
    if (style === 'sanctum') { x.strokeStyle = P.ember; x.globalAlpha = 0.6; x.lineWidth = 1; x.beginPath(); x.moveTo(8 + R(r) * 16, top + 2); x.lineTo(10 + R(r) * 12, top + 10); x.lineTo(6 + R(r) * 18, 30); x.stroke(); x.globalAlpha = 1; }
    x.fillStyle = '#000'; x.globalAlpha = 0.35; x.fillRect(0, 30, 32, 2); x.globalAlpha = 1;
  }
  function tile(style, t, v, S) {
    const P = PALETTES[style] || PALETTES.fortress;
    return get(`t|${style}|${t}|${v}`, S, (x, r) => {
      if (t === 'wall' || t === 'wallface') return wallTex(x, r, P, style, t === 'wallface');
      if (t === 'floor') return floorTex(x, r, P, style, v);
      floorTex(x, makeRng('art|floorbase|' + style + v), P, style, 0);
      switch (t) {
        case 'door': case 'locked': {
          x.fillStyle = '#1c130d'; x.fillRect(2, 2, 28, 28);
          const g = x.createLinearGradient(0, 0, 32, 0); g.addColorStop(0, '#6b4424'); g.addColorStop(0.5, '#8a5a31'); g.addColorStop(1, '#5e3a1f'); x.fillStyle = g; x.fillRect(4, 3, 24, 27);
          x.strokeStyle = '#3d2614'; x.lineWidth = 1; for (let i = 10; i < 28; i += 6) { x.beginPath(); x.moveTo(i, 3); x.lineTo(i, 30); x.stroke(); }
          x.fillStyle = t === 'locked' ? '#9aa3ad' : '#4a4f55'; x.fillRect(4, 8, 24, 3); x.fillRect(4, 22, 24, 3);
          if (t === 'locked') { x.fillStyle = '#e8c35a'; x.beginPath(); x.arc(16, 17, 3.6, 0, 7); x.fill(); x.fillStyle = '#1a1208'; x.beginPath(); x.arc(16, 16.3, 1.2, 0, 7); x.fill(); x.fillRect(15.4, 16.5, 1.2, 3); }
          else { x.fillStyle = '#d7b25a'; x.beginPath(); x.arc(23, 17, 1.6, 0, 7); x.fill(); }
          x.strokeStyle = '#120b07'; x.lineWidth = 1.5; x.strokeRect(4, 3, 24, 27); break;
        }
        case 'open': { x.fillStyle = '#00000055'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#6b4424'; x.fillRect(1, 2, 5, 28); x.strokeStyle = '#2d1c0e'; x.lineWidth = 1; x.strokeRect(1, 2, 5, 28); x.fillStyle = '#4a4f55'; x.fillRect(1, 8, 5, 2); x.fillRect(1, 22, 5, 2); break; }
        case 'down': case 'up': {
          for (let i = 0; i < 5; i++) { const c = t === 'down' ? 70 - i * 14 : 30 + i * 14; x.fillStyle = `rgb(${c},${c - 6},${c + 6})`; const inset = i * 2.4; x.fillRect(3 + inset, 3 + i * 5.2, 26 - inset * 2, 5.2); }
          if (t === 'down') { const g = x.createRadialGradient(16, 26, 1, 16, 26, 12); g.addColorStop(0, '#000'); g.addColorStop(1, '#0000'); x.fillStyle = g; x.fillRect(0, 12, 32, 20); x.strokeStyle = '#ffb867'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(12, 9); x.lineTo(16, 13); x.lineTo(20, 9); x.stroke(); }
          x.strokeStyle = '#00000088'; x.lineWidth = 1; x.strokeRect(3, 3, 26, 26); break;
        }
        case 'water0': case 'water1': {
          const g = x.createLinearGradient(0, 0, 32, 32); g.addColorStop(0, '#1d4a5c'); g.addColorStop(1, '#16394d'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
          x.strokeStyle = '#7fd0e0'; x.globalAlpha = 0.35; x.lineWidth = 1; const o = t === 'water1' ? 4 : 0;
          for (let i = 0; i < 3; i++) { const y = 6 + i * 10 + (o ? 2 : 0); x.beginPath(); x.moveTo(3 + o, y); x.quadraticCurveTo(9 + o, y - 3, 15 + o, y); x.quadraticCurveTo(21 + o, y + 3, 27 + o, y); x.stroke(); }
          x.globalAlpha = 1; break;
        }
        case 'chasm': { x.fillStyle = '#050308'; x.fillRect(0, 0, 32, 32); specks(x, r, 6, '#6a5a8a', 0.5, 0.8); break; }
        case 'lava0': case 'lava1': {
          const g = x.createRadialGradient(16, 16, 2, 16, 16, 22); g.addColorStop(0, t === 'lava0' ? '#ffcf5a' : '#ffb347'); g.addColorStop(0.6, '#ff6a1f'); g.addColorStop(1, '#b3290e'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
          x.fillStyle = '#4a1608'; x.globalAlpha = 0.65; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(R(r) * 32, R(r) * 32, 3 + R(r) * 4, 2 + R(r) * 3, R(r) * 3, 0, 7); x.fill(); } x.globalAlpha = 1; break;
        }
        case 'grass': {
          for (let i = 0; i < 26; i++) { const bx = R(r) * 32, by = 8 + R(r) * 24, h = 6 + R(r) * 9; x.strokeStyle = R(r) < 0.5 ? '#5e9a3a' : '#7bb64a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(bx, by); x.quadraticCurveTo(bx + (R(r) - 0.5) * 6, by - h * 0.6, bx + (R(r) - 0.5) * 8, by - h); x.stroke(); }
          break;
        }
        case 'rubble': { for (let i = 0; i < 6; i++) { x.fillStyle = shade(P.top, (R(r) - 0.5) * 30); x.beginPath(); const cx = 4 + R(r) * 24, cy = 4 + R(r) * 24, rr = 1.5 + R(r) * 3; x.moveTo(cx - rr, cy); x.lineTo(cx, cy - rr); x.lineTo(cx + rr, cy + 0.5); x.lineTo(cx, cy + rr); x.fill(); } break; }
        case 'ash': { x.fillStyle = '#26221f'; x.globalAlpha = 0.75; x.fillRect(0, 0, 32, 32); x.globalAlpha = 1; specks(x, r, 30, '#8a8078', 0.4, 1); specks(x, r, 6, '#ff7a3a', 0.5, 1); break; }
        case 'bridge': { x.fillStyle = '#050308'; x.fillRect(0, 0, 32, 32); x.fillStyle = '#6b4a2c'; for (let i = 0; i < 4; i++) { x.fillRect(4, 1 + i * 8, 24, 6.5); } x.strokeStyle = '#3a2716'; x.lineWidth = 1; x.beginPath(); x.moveTo(5, 0); x.lineTo(5, 32); x.moveTo(27, 0); x.lineTo(27, 32); x.stroke(); break; }
        case 'pillar': {
          x.fillStyle = '#0006'; x.beginPath(); x.ellipse(17, 25, 11, 5, 0, 0, 7); x.fill();
          if (style === 'ruins') { x.fillStyle = '#4a3322'; x.fillRect(14, 16, 5, 12); const g = x.createRadialGradient(13, 11, 2, 16, 13, 13); g.addColorStop(0, '#7fb54e'); g.addColorStop(1, '#2e5220'); x.fillStyle = g; x.beginPath(); x.arc(16, 13, 12, 0, 7); x.fill(); x.strokeStyle = '#1d3314'; x.lineWidth = 1.2; x.stroke(); specks(x, r, 12, '#b7e07a', 0.5, 1.4); }
          else if (style === 'crypt') { x.fillStyle = '#5b5e76'; x.fillRect(7, 3, 18, 26); x.strokeStyle = '#26283a'; x.lineWidth = 1.4; x.strokeRect(7, 3, 18, 26); x.fillStyle = '#6d7190'; x.fillRect(9, 5, 14, 22); x.strokeStyle = '#3a3d55'; x.beginPath(); x.moveTo(16, 8); x.lineTo(16, 22); x.moveTo(12, 12); x.lineTo(20, 12); x.stroke(); }
          else if (style === 'caverns') { const g = x.createLinearGradient(8, 0, 26, 0); g.addColorStop(0, '#7a654f'); g.addColorStop(1, '#4a3b2e'); x.fillStyle = g; x.beginPath(); x.moveTo(6, 28); x.lineTo(13, 5); x.lineTo(17, 12); x.lineTo(20, 4); x.lineTo(27, 28); x.closePath(); x.fill(); x.strokeStyle = '#2b2119'; x.lineWidth = 1.2; x.stroke(); }
          else { const g = x.createRadialGradient(13, 12, 1, 16, 16, 12); g.addColorStop(0, shade(P.hi, 30)); g.addColorStop(1, shade(P.face, -10)); x.fillStyle = g; x.beginPath(); x.arc(16, 16, 11, 0, 7); x.fill(); x.strokeStyle = shade(P.face, -30); x.lineWidth = 1.4; x.stroke(); x.beginPath(); x.arc(16, 16, 7, 0, 7); x.strokeStyle = shade(P.hi, 10); x.lineWidth = 0.8; x.stroke(); if (style === 'sanctum') { x.strokeStyle = P.ember; x.globalAlpha = 0.8; x.beginPath(); x.arc(16, 16, 9, 0, 7); x.stroke(); x.globalAlpha = 1; } }
          break;
        }
        case 'brazier': { x.fillStyle = '#0007'; x.beginPath(); x.ellipse(16, 25, 10, 4, 0, 0, 7); x.fill(); x.fillStyle = '#6c5a4a'; x.fillRect(12, 18, 8, 8); const g = x.createLinearGradient(0, 11, 0, 20); g.addColorStop(0, '#9c8468'); g.addColorStop(1, '#4d3d30'); x.fillStyle = g; x.beginPath(); x.moveTo(6, 12); x.lineTo(26, 12); x.lineTo(21, 20); x.lineTo(11, 20); x.closePath(); x.fill(); x.strokeStyle = '#231a12'; x.lineWidth = 1.2; x.stroke(); x.fillStyle = '#2a0f06'; x.fillRect(8, 11, 16, 2.4); break; }
        case 'shrine': case 'shrineUsed': {
          x.fillStyle = '#0007'; x.beginPath(); x.ellipse(16, 27, 12, 4, 0, 0, 7); x.fill();
          x.fillStyle = '#6e6a82'; x.fillRect(6, 12, 20, 14); x.fillStyle = '#8a86a2'; x.fillRect(4, 9, 24, 5); x.strokeStyle = '#2b2838'; x.lineWidth = 1.2; x.strokeRect(6, 12, 20, 14); x.strokeRect(4, 9, 24, 5);
          const lit = t === 'shrine'; x.strokeStyle = lit ? '#9fe3ff' : '#4d5566'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(16, 15); x.lineTo(16, 23); x.moveTo(12, 19); x.lineTo(20, 19); x.stroke();
          if (lit) { const g = x.createRadialGradient(16, 19, 0, 16, 19, 9); g.addColorStop(0, '#9fe3ff88'); g.addColorStop(1, '#9fe3ff00'); x.fillStyle = g; x.fillRect(4, 8, 24, 22); }
          break;
        }
        case 'chest': case 'chestOpen': {
          x.fillStyle = '#0007'; x.beginPath(); x.ellipse(16, 27, 12, 3.5, 0, 0, 7); x.fill();
          if (t === 'chest') { const g = x.createLinearGradient(0, 10, 0, 27); g.addColorStop(0, '#9a6636'); g.addColorStop(1, '#5c3a1d'); x.fillStyle = g; x.fillRect(5, 12, 22, 14); x.fillStyle = '#b07a44'; x.beginPath(); x.moveTo(5, 13); x.quadraticCurveTo(16, 4, 27, 13); x.fill(); x.fillStyle = '#e2b95a'; x.fillRect(5, 15, 22, 2); x.fillRect(14, 14, 4, 6); x.strokeStyle = '#2d1b0c'; x.lineWidth = 1.2; x.strokeRect(5, 12, 22, 14); }
          else { x.fillStyle = '#5c3a1d'; x.fillRect(5, 14, 22, 12); x.fillStyle = '#140c06'; x.fillRect(7, 15, 18, 5); x.fillStyle = '#8a5a31'; x.fillRect(5, 6, 22, 6); x.strokeStyle = '#2d1b0c'; x.lineWidth = 1.2; x.strokeRect(5, 14, 22, 12); x.strokeRect(5, 6, 22, 6); }
          break;
        }
      }
    });
  }
  // ---------------------------------------------------------- sprites
  const O = '#0b0710';
  function body(x, fill, pts, lw = 1.6) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = O; x.lineWidth = lw; x.stroke(); }
  function circ(x, cx, cy, r, fill, lw = 1.5) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fillStyle = fill; x.fill(); if (lw) { x.strokeStyle = O; x.lineWidth = lw; x.stroke(); } }
  function ell(x, cx, cy, rx, ry, fill, lw = 1.5, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fillStyle = fill; x.fill(); if (lw) { x.strokeStyle = O; x.lineWidth = lw; x.stroke(); } }
  function line(x, col, lw, ...p) { x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.strokeStyle = col; x.lineWidth = lw; x.stroke(); }
  function eyes(x, y, col = '#ff4a3a', gap = 3, cx = 16) { circ(x, cx - gap, y, 1.1, col, 0); circ(x, cx + gap, y, 1.1, col, 0); }
  const SPR = {
    p_warden(x) { body(x, '#56688f', [9, 29, 11, 15, 21, 15, 23, 29]); body(x, '#8fa6d6', [11, 16, 21, 16, 20, 23, 12, 23]); circ(x, 16, 10, 5.5, '#b9c6de'); x.fillStyle = O; x.fillRect(12.5, 9.3, 7, 1.6); x.fillRect(15.3, 9.3, 1.4, 4); line(x, '#e6ecf5', 2.2, 25, 25, 25, 9); line(x, '#c8a24a', 2, 22.5, 22, 27.5, 22); ell(x, 8, 20, 5, 6.5, '#8fb3ff'); circ(x, 8, 20, 1.6, '#f2d27a', 1); },
    p_ranger(x) { body(x, '#3f6a34', [8, 29, 12, 14, 20, 14, 24, 29]); body(x, '#5d8f47', [16, 3, 23, 15, 9, 15]); circ(x, 16, 12, 3.6, '#2a1f1a', 0); eyes(x, 12, '#e8f6c9', 1.5); x.beginPath(); x.arc(24, 18, 9, -1.2, 1.2); x.strokeStyle = '#8a5a31'; x.lineWidth = 2.2; x.stroke(); line(x, '#e8e0cf', 0.8, 27.3, 9.5, 27.3, 26.5); line(x, '#8a5a31', 1.6, 8, 27, 14, 20); },
    p_arcanist(x) { body(x, '#5b3d8a', [8, 29, 12, 15, 20, 15, 24, 29]); body(x, '#7a52b8', [7, 12, 25, 12, 16, 1]); circ(x, 16, 14, 3.8, '#e7c9a8'); eyes(x, 14, '#2a1a38', 1.5); line(x, '#8a5a31', 2, 25, 29, 25, 8); circ(x, 25, 7, 3.2, '#ff9a3d', 1.2); circ(x, 25, 7, 1.4, '#ffe8a8', 0); },
    e_rat(x) { x.beginPath(); x.moveTo(8, 20); x.quadraticCurveTo(1, 22, 3, 28); x.strokeStyle = '#d99a9a'; x.lineWidth = 1.4; x.stroke(); ell(x, 15, 20, 9, 6, '#8a7a68'); body(x, '#9a8a76', [21, 15, 29, 20, 21, 24]); circ(x, 21, 15, 2.4, '#b8a08a', 1.2); circ(x, 29, 20, 1.3, '#f2a0a0', 0); circ(x, 24.5, 18.5, 1, '#ff3a2a', 0); },
    e_jackal(x) { line(x, O, 3.4, 11, 22, 10, 29); line(x, O, 3.4, 21, 22, 22, 29); line(x, '#b86a30', 2, 11, 22, 10, 29); line(x, '#b86a30', 2, 21, 22, 22, 29); ell(x, 16, 19, 9, 5, '#d98f4e'); x.beginPath(); x.moveTo(7, 17); x.quadraticCurveTo(1, 12, 4, 9); x.strokeStyle = '#d98f4e'; x.lineWidth = 2.6; x.stroke(); body(x, '#e0a060', [22, 17, 23, 8, 26, 13, 28, 10, 28, 16, 31, 19, 25, 21]); circ(x, 26.5, 15.5, 1, '#ffef7a', 0); },
    e_goblin(x) { body(x, '#4d6b2c', [10, 29, 12, 17, 20, 17, 22, 29]); body(x, '#7fbf4d', [5, 10, 11, 12, 11, 15]); body(x, '#7fbf4d', [27, 10, 21, 12, 21, 15]); circ(x, 16, 13, 6, '#7fbf4d'); eyes(x, 12.5, '#ff3a2a', 2.5); line(x, O, 1, 13.5, 16.5, 18.5, 16.5); line(x, '#d8dde3', 2, 23, 27, 27, 18); },
    e_archer(x) { body(x, '#51663a', [10, 29, 12, 16, 20, 16, 22, 29]); body(x, '#6e8a40', [16, 4, 23, 15, 9, 15]); circ(x, 16, 13, 4, '#9ac266', 1); eyes(x, 13, '#ff3a2a', 1.8); x.beginPath(); x.arc(7, 19, 8, -1.1, 1.1); x.strokeStyle = '#7a4a26'; x.lineWidth = 2; x.stroke(); line(x, '#eee', 0.7, 10.6, 12, 10.6, 26); },
    e_brute(x) { body(x, '#6d557f', [4, 30, 6, 12, 26, 12, 28, 30]); circ(x, 16, 9, 6.5, '#a58ab8'); eyes(x, 8.5, '#ffdf3a', 2.6); x.fillStyle = '#f2ead8'; x.fillRect(12, 11.5, 1.6, 2.5); x.fillRect(18.4, 11.5, 1.6, 2.5); line(x, O, 5, 27, 28, 30, 8); line(x, '#7a5634', 3.2, 27, 28, 30, 8); circ(x, 30, 8, 3.5, '#7a5634'); },
    e_cultist(x) { body(x, '#8f2f1f', [7, 30, 12, 12, 20, 12, 25, 30]); body(x, '#b8412a', [16, 3, 24, 16, 8, 16]); circ(x, 16, 14, 3.4, '#1a0c0a', 0); eyes(x, 14, '#ffb03a', 1.4); circ(x, 16, 22, 2.6, '#ffcf5a', 1); },
    e_sentinel(x) { body(x, '#8a7440', [7, 30, 9, 13, 23, 13, 25, 30]); body(x, '#d8c27a', [10, 14, 22, 14, 21, 23, 11, 23]); body(x, '#c2ab63', [11, 4, 21, 4, 22, 13, 10, 13]); x.fillStyle = '#1a1206'; x.fillRect(12, 8, 8, 1.8); line(x, '#9aa3ad', 1.8, 27, 30, 27, 3); body(x, '#d8dde3', [27, 3, 31, 7, 27, 9]); },
    e_spitter(x) { ell(x, 16, 25, 9, 4, '#51702a'); ell(x, 16, 16, 11, 10, '#9ad14b'); for (const [a, b, c] of [[11, 12, 2.4], [20, 11, 1.8], [22, 19, 2.2], [12, 20, 1.6]]) circ(x, a, b, c, '#d8f07a', 0); ell(x, 16, 19, 4, 2.4, '#2a3a10', 1); circ(x, 13, 15, 1.1, '#ff3a2a', 0); circ(x, 19, 15, 1.1, '#ff3a2a', 0); },
    e_skeleton(x) { line(x, O, 3.4, 12, 29, 14, 20, 18, 20, 20, 29); line(x, '#e8e2cf', 1.8, 12, 29, 14, 20, 18, 20, 20, 29); body(x, '#e8e2cf', [11, 13, 21, 13, 19, 21, 13, 21], 1.3); line(x, '#5a5446', 0.8, 12, 16, 20, 16, 12.5, 18.5, 19.5, 18.5); circ(x, 16, 9, 5, '#f2ecd8'); circ(x, 14, 9, 1.4, '#1a1612', 0); circ(x, 18, 9, 1.4, '#1a1612', 0); line(x, '#c8c2b0', 1.6, 23, 12, 26, 26); },
    e_wraith(x) { x.globalAlpha = 0.9; body(x, '#4fb8a8cc', [6, 28, 9, 12, 16, 4, 23, 12, 26, 28, 22, 24, 19, 29, 16, 25, 13, 29, 10, 24]); x.globalAlpha = 1; circ(x, 16, 12, 5, '#bff5ec', 0); eyes(x, 12, '#0e3a36', 2); circ(x, 14, 12, 0.6, '#fff', 0); circ(x, 18, 12, 0.6, '#fff', 0); },
    e_boss(x) { body(x, '#2a1a24', [3, 31, 8, 11, 24, 11, 29, 31]); body(x, '#4a2a38', [8, 14, 24, 14, 22, 26, 10, 26]); circ(x, 16, 9, 6, '#c7b9a6'); eyes(x, 9, '#ff6a1f', 2.4); body(x, '#ffb347', [9, 5, 11, 0.5, 13.5, 3.5, 16, 0, 18.5, 3.5, 21, 0.5, 23, 5], 1.2); circ(x, 16, 3.2, 1.2, '#ff3a2a', 0); line(x, '#ff8a3d', 1.2, 5, 30, 12, 26); line(x, '#ff8a3d', 1.2, 27, 30, 20, 26); },
  };
  const POT = { heal: '#e0503f', antidote: '#6fd35b', haste: '#cfe3ff' };
  function itemDraw(x, k) {
    const D = ITEMS[k];
    if (POT[k]) { body(x, '#d8e2ec55', [12, 8, 20, 8, 20, 13, 25, 20, 23, 27, 9, 27, 7, 20, 12, 13], 1.4); body(x, POT[k], [9.5, 19, 22.5, 19, 23, 25.5, 9, 25.5], 0); x.fillStyle = '#7a5634'; x.fillRect(12.5, 5, 7, 3.5); x.fillStyle = '#ffffff66'; x.fillRect(10, 20, 2, 4); return; }
    if (k.startsWith('scroll')) { const seal = k === 'scrollBlink' ? '#b06aff' : k === 'scrollMap' ? '#5ab0ff' : '#ffd24a'; body(x, '#e8dcc0', [7, 9, 25, 9, 25, 24, 7, 24], 1.3); ell(x, 7, 16.5, 2.5, 7.5, '#d4c6a4', 1.2); ell(x, 25, 16.5, 2.5, 7.5, '#d4c6a4', 1.2); line(x, '#8a7a5a', 0.8, 11, 13, 21, 13, 11, 16, 21, 16, 11, 19, 18, 19); circ(x, 19, 21, 2.4, seal, 1); return; }
    switch (k) {
      case 'firebomb': case 'smokebomb': circ(x, 16, 19, 8, k === 'firebomb' ? '#2a1a14' : '#6b6f78'); line(x, '#c9a36a', 1.6, 16, 11, 19, 6); circ(x, 19.5, 5.5, 2, k === 'firebomb' ? '#ffcf5a' : '#e8e8e8', 0); if (k === 'firebomb') { x.fillStyle = '#ff6a1f'; x.fillRect(12, 18, 8, 2); } return;
      case 'knives': for (const dx of [-5, 0, 5]) { line(x, O, 3, 16 + dx, 27, 16 + dx, 6); line(x, '#dfe6ee', 1.8, 16 + dx, 20, 16 + dx, 6); line(x, '#7a4a26', 2.4, 16 + dx, 27, 16 + dx, 21); } return;
      case 'key': circ(x, 10, 12, 5, '#9aa3ad'); circ(x, 10, 12, 2, '#1c1a1f', 0); line(x, O, 4, 14, 16, 26, 26); line(x, '#9aa3ad', 2.4, 14, 16, 26, 26); line(x, '#9aa3ad', 2.2, 22, 23, 19, 26, 25, 25, 23, 28); return;
      case 'gold': for (const [a, b] of [[11, 22], [20, 23], [15, 18], [18, 13]]) { ell(x, a, b, 5, 3, '#ffd24a', 1.2); ell(x, a, b - 0.5, 3, 1.5, '#fff0a0', 0); } return;
      case 'arrows': for (const dx of [-3, 0, 3]) { line(x, '#a0784a', 1.6, 10 + dx, 28, 20 + dx, 6); body(x, '#d8dde3', [20 + dx, 4, 22 + dx, 8, 18 + dx, 8], 0.8); line(x, '#e8e8e8', 1.4, 9 + dx, 27, 11 + dx, 24); } return;
      case 'heartstone': body(x, '#e0304f', [16, 27, 6, 16, 8, 9, 13, 8, 16, 11, 19, 8, 24, 9, 26, 16]); x.fillStyle = '#ffb0c0'; x.fillRect(11, 11, 3, 3); return;
    }
    if (D.slot === 'weapon') {
      if (k === 'staff') { line(x, O, 4, 9, 28, 22, 7); line(x, '#8a5a31', 2.4, 9, 28, 22, 7); circ(x, 23, 6, 3.4, '#ff9a3d'); return; }
      if (k === 'spear') { line(x, O, 3.6, 6, 28, 24, 6); line(x, '#9a7040', 2, 6, 28, 24, 6); body(x, '#dfe6ee', [24, 6, 29, 2, 26, 9], 1.2); return; }
      if (k === 'axe') { line(x, O, 4, 9, 28, 20, 8); line(x, '#8a5a31', 2.4, 9, 28, 20, 8); body(x, '#c9d2dc', [17, 6, 26, 4, 28, 13, 22, 14], 1.3); return; }
      if (k === 'mace') { line(x, O, 4, 9, 28, 19, 12); line(x, '#8a5a31', 2.4, 9, 28, 19, 12); circ(x, 21, 10, 5, '#9aa3ad'); for (let a = 0; a < 6; a++) line(x, '#9aa3ad', 1.6, 21 + Math.cos(a) * 5, 10 + Math.sin(a) * 5, 21 + Math.cos(a) * 7.5, 10 + Math.sin(a) * 7.5); return; }
      const len = k === 'dagger' ? 10 : k === 'sword' ? 15 : 19; line(x, O, 4.4, 8, 26, 8 + len * 0.72, 26 - len); line(x, '#e6ecf5', 2.6, 9, 25, 8 + len * 0.72, 26 - len); line(x, O, 4, 5, 22, 12, 29); line(x, '#c8a24a', 2.2, 5, 22, 12, 29); line(x, '#6b4424', 2.6, 8, 26, 5, 29); return;
    }
    if (D.slot === 'ranged') { x.beginPath(); x.arc(10, 16, 13, -1.05, 1.05); x.strokeStyle = O; x.lineWidth = 4; x.stroke(); x.strokeStyle = k === 'longbow' ? '#b0703a' : '#8a5a31'; x.lineWidth = 2.4; x.stroke(); line(x, '#eee', 0.8, 16.4, 5, 16.4, 27); return; }
    if (D.slot === 'armor') { const c = k === 'plate' ? '#c96a3a' : k === 'chain' ? '#9aa3ad' : k === 'robe' ? '#7a52b8' : '#8a5a31'; body(x, c, [8, 7, 13, 5, 16, 8, 19, 5, 24, 7, 27, 13, 23, 14, 23, 28, 9, 28, 9, 14, 5, 13]); if (k === 'chain') { x.strokeStyle = '#5a636d'; x.lineWidth = 0.7; for (let y = 10; y < 28; y += 3) { x.beginPath(); x.moveTo(10, y); x.lineTo(22, y); x.stroke(); } } return; }
    if (D.slot === 'trinket') { if (k === 'amuletWard') { line(x, '#d8b45a', 1.2, 8, 5, 16, 16, 24, 5); body(x, '#5ab0ff', [16, 13, 21, 19, 16, 27, 11, 19]); return; } circ(x, 16, 19, 7, '#00000000', 0); x.beginPath(); x.arc(16, 19, 7, 0, 7); x.strokeStyle = O; x.lineWidth = 4.4; x.stroke(); x.strokeStyle = k === 'shadowBand' ? '#6b6f78' : '#e2b95a'; x.lineWidth = 2.6; x.stroke(); body(x, k === 'ringVigor' ? '#e0304f' : k === 'ringPrec' ? '#5affc8' : '#2a2a38', [16, 7, 20, 11, 16, 15, 12, 11], 1.2); return; }
    circ(x, 16, 16, 6, '#fff');
  }
  function sprite(key, S) { return get('s|' + key, S, (x) => { if (SPR[key]) SPR[key](x); else if (key.startsWith('i_')) itemDraw(x, key.slice(2)); }); }
  function trap(k, S) {
    return get('trap|' + k, S, (x) => {
      x.fillStyle = '#1a1714'; x.globalAlpha = 0.85; x.fillRect(6, 6, 20, 20); x.globalAlpha = 1; x.strokeStyle = '#8a8070'; x.lineWidth = 1.2; x.strokeRect(6, 6, 20, 20);
      if (k === 'spike') { x.fillStyle = '#c9d2dc'; for (const [a, b] of [[11, 11], [21, 11], [11, 21], [21, 21], [16, 16]]) { x.beginPath(); x.moveTo(a - 2, b + 2); x.lineTo(a, b - 3); x.lineTo(a + 2, b + 2); x.fill(); } }
      else if (k === 'gas') { x.strokeStyle = '#7bd65b'; x.lineWidth = 1.4; for (let i = 10; i < 24; i += 4) { x.beginPath(); x.moveTo(9, i); x.lineTo(23, i); x.stroke(); } }
      else if (k === 'alarm') { x.fillStyle = '#ffd24a'; x.beginPath(); x.moveTo(11, 21); x.quadraticCurveTo(11, 10, 16, 10); x.quadraticCurveTo(21, 10, 21, 21); x.fill(); x.fillRect(15, 21, 2, 3); }
      else if (k === 'fire') { x.fillStyle = '#ff6a1f'; x.beginPath(); x.moveTo(16, 9); x.quadraticCurveTo(23, 17, 16, 23); x.quadraticCurveTo(9, 17, 16, 9); x.fill(); }
      else if (k === 'net') { x.strokeStyle = '#c9b48a'; x.lineWidth = 1; for (let i = 8; i <= 24; i += 4) { x.beginPath(); x.moveTo(i, 7); x.lineTo(i, 25); x.moveTo(7, i); x.lineTo(25, i); x.stroke(); } }
    });
  }
  function clear() { cache.clear(); }
  return { tile, sprite, trap, clear, shade };
})();
function tileSpriteKey(fl, x, y, t) {
  switch (t) {
    case T.WALL: return gget(fl, x, y + 1) !== T.WALL && y + 1 < fl.h ? 'wallface' : 'wall';
    case T.FLOOR: case T.UP: return t === T.UP ? 'up' : 'floor';
    case T.DOOR: return 'door'; case T.OPEN: return 'open'; case T.LOCKED: return 'locked'; case T.DOWN: return 'down';
    case T.WATER: return 'water'; case T.CHASM: return 'chasm'; case T.LAVA: return 'lava'; case T.GRASS: return 'grass'; case T.RUBBLE: return 'rubble';
    case T.PILLAR: return 'pillar'; case T.BRAZIER: return 'brazier'; case T.SHRINE: return 'shrine'; case T.SHRINE_USED: return 'shrineUsed';
    case T.CHEST: return 'chest'; case T.CHEST_OPEN: return 'chestOpen'; case T.BRIDGE: return 'bridge'; case T.ASH: return 'ash';
  }
  return 'floor';
}
