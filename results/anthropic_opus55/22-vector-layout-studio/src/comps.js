/* ============================================================
   Built-in compositions — plain project documents in the same
   versioned schema as user files; loaded through projectToDoc().
   ============================================================ */
const T0 = (x = 0, y = 0, rotation = 0, scale = 1) => ({ x, y, rotation, scale });
const base = (id, type, parent, name, o) => ({ id, type, parent, name, visible: o.visible !== false, locked: !!o.locked, transform: o.t || T0(), opacity: o.op ?? 1 });
const cR = (id, parent, name, x, y, w, h, fill, o = {}) => Object.assign(base(id, 'rect', parent, name, Object.assign({ t: T0(x, y, o.rot || 0) }, o)), { width: w, height: h, radius: o.r || 0, fill, stroke: o.stroke || 'none', strokeWidth: o.sw || 0 });
const cE = (id, parent, name, x, y, w, h, fill, o = {}) => Object.assign(base(id, 'ellipse', parent, name, Object.assign({ t: T0(x, y, o.rot || 0) }, o)), { width: w, height: h, fill, stroke: o.stroke || 'none', strokeWidth: o.sw || 0 });
const cL = (id, parent, name, x1, y1, x2, y2, stroke, sw, o = {}) => Object.assign(base(id, 'line', parent, name, o), { x1, y1, x2, y2, stroke, strokeWidth: sw });
const cA = (x, y, inX = x, inY = y, outX = x, outY = y) => ({ x, y, inX, inY, outX, outY });
const cP = (id, parent, name, anchors, closed, fill, stroke = 'none', sw = 0, o = {}) => Object.assign(base(id, 'path', parent, name, o), { anchors, closed, fill, stroke, strokeWidth: sw });
const cT = (id, parent, name, x, y, text, fontFamily, fontSize, fontWeight, align, lineHeight, fill, o = {}) => Object.assign(base(id, 'text', parent, name, Object.assign({ t: T0(x, y, o.rot || 0) }, o)), { text, fontFamily, fontSize, fontWeight, align, lineHeight, fill });
const cG = (id, parent, name, o = {}) => base(id, 'group', parent, name, o);
const swift = () => [cA(-24, -12, -24, -12, -15, -14), cA(0, 2, -7, -8, 7, -8), cA(24, -14, 14, -15, 24, -14)];

const COMPOSITIONS = {
  solstice: {
    title: 'Solstice poster',
    project: {
      format: FORMAT, version: FORMAT_VERSION, app: 'Vector & Layout Studio',
      artboard: { width: 800, height: 1000, background: '#0f1530', transparent: false },
      items: [
        cG('sky', null, 'Sky'),
        cR('dusk', 'sky', 'Dusk band', 0, 520, 800, 480, '#1b2452'),
        cE('halo', 'sky', 'Halo ring', 175, 285, 450, 450, 'none', { stroke: '#ffb35c', sw: 2, op: 0.5 }),
        cE('sun', 'sky', 'Sun', 250, 360, 300, 300, '#ff7a45'),
        cE('core', 'sky', 'Sun core', 320, 430, 160, 160, '#ffb35c', { op: 0.85 }),
        cG('stars', 'sky', 'Stars'),
        cE('st1', 'stars', 'Star', 86, 372, 6, 6, '#fff1e0'),
        cE('st2', 'stars', 'Star', 140, 470, 4, 4, '#fff1e0', { op: 0.7 }),
        cE('st3', 'stars', 'Star', 704, 420, 5, 5, '#fff1e0'),
        cE('st4', 'stars', 'Star', 664, 520, 4, 4, '#fff1e0', { op: 0.6 }),
        cE('st5', 'stars', 'Star', 734, 318, 7, 7, '#ffd9a8'),
        cE('st6', 'stars', 'Star', 112, 566, 5, 5, '#fff1e0', { op: 0.8 }),
        cE('st7', 'stars', 'Star', 606, 262, 4, 4, '#fff1e0'),
        cP('far', null, 'Far ridge', [
          cA(0, 650, 0, 650, 90, 640), cA(250, 600, 170, 600, 330, 600), cA(560, 660, 470, 660, 650, 660),
          cA(800, 590, 730, 600, 800, 590), cA(800, 1000), cA(0, 1000),
        ], true, '#3b2a6b'),
        cP('near', null, 'Near ridge', [
          cA(0, 760, 0, 760, 120, 730), cA(300, 720, 200, 720, 420, 720), cA(620, 790, 520, 790, 700, 790),
          cA(800, 740, 760, 760, 800, 740), cA(800, 1000), cA(0, 1000),
        ], true, '#e8566c'),
        cP('fg', null, 'Foreground', [
          cA(0, 880, 0, 880, 200, 850), cA(460, 868, 330, 858, 600, 880), cA(800, 846, 700, 876, 800, 846),
          cA(800, 1000), cA(0, 1000),
        ], true, '#1a1030'),
        cG('birds', null, 'Swifts'),
        cP('bird1', 'birds', 'Swift', swift(), false, 'none', '#fff1e0', 2.5, { t: T0(560, 318, -6, 1.1) }),
        cP('bird2', 'birds', 'Swift', swift(), false, 'none', '#fff1e0', 2.5, { t: T0(626, 362, 8, 0.7) }),
        cL('rule', null, 'Rule', 64, 902, 736, 902, '#fff1e0', 1.5, { op: 0.5 }),
        cT('title', null, 'Title', 60, 64, 'SOLSTICE', 'serif', 112, 700, 'left', 1, '#fff1e0'),
        cT('sub', null, 'Subtitle', 64, 190, 'the longest light\nof the year', 'sans', 30, 400, 'left', 1.25, '#ffb35c'),
        cT('meta', null, 'Details', 64, 918, '21 · 06 · 2026\nSUNRISE 04:43 — SUNSET 21:33', 'mono', 15, 400, 'left', 1.6, '#fff1e0'),
        cT('edition', null, 'Edition', 626, 918, 'Nº 07\nNORTHERN SKY', 'mono', 15, 700, 'right', 1.6, '#ffb35c'),
      ],
    },
  },
  bauhaus: {
    title: 'Form Follows Function',
    project: {
      format: FORMAT, version: FORMAT_VERSION, app: 'Vector & Layout Studio',
      artboard: { width: 900, height: 900, background: '#f2ede3', transparent: false },
      items: [
        cG('reg', null, 'Registration marks', { op: 0.7 }),
        cG('mk1', 'reg', 'Mark top-left'),
        cL('mk1h', 'mk1', 'Mark bar', 28, 40, 52, 40, '#151515', 1.5), cL('mk1v', 'mk1', 'Mark bar', 40, 28, 40, 52, '#151515', 1.5),
        cG('mk2', 'reg', 'Mark top-right'),
        cL('mk2h', 'mk2', 'Mark bar', 848, 40, 872, 40, '#151515', 1.5), cL('mk2v', 'mk2', 'Mark bar', 860, 28, 860, 52, '#151515', 1.5),
        cG('mk3', 'reg', 'Mark bottom-left'),
        cL('mk3h', 'mk3', 'Mark bar', 28, 860, 52, 860, '#151515', 1.5), cL('mk3v', 'mk3', 'Mark bar', 40, 848, 40, 872, '#151515', 1.5),
        cG('mk4', 'reg', 'Mark bottom-right'),
        cL('mk4h', 'mk4', 'Mark bar', 848, 860, 872, 860, '#151515', 1.5), cL('mk4v', 'mk4', 'Mark bar', 860, 848, 860, 872, '#151515', 1.5),
        cE('disc', null, 'Red disc', 430, 110, 360, 360, '#e1452d'),
        cR('slab', null, 'Blue slab', 120, 400, 420, 140, '#1f4aa8', { rot: -12 }),
        cP('wedge', null, 'Yellow wedge', [cA(560, 520), cA(820, 520), cA(560, 780)], true, '#f2b41c'),
        cP('arc', null, 'Quarter arc', [cA(100, 560, 100, 560, 254.64, 560), cA(380, 840, 380, 685.36, 380, 840)], false, '#f2b41c', '#151515', 6),
        cL('rule', null, 'Rule', 70, 316, 380, 316, '#151515', 4),
        cG('dots', null, 'Dot row'),
        cE('d1', 'dots', 'Dot', 70, 338, 10, 10, '#151515'), cE('d2', 'dots', 'Dot', 92, 338, 10, 10, '#151515'),
        cE('d3', 'dots', 'Dot', 114, 338, 10, 10, '#151515'), cE('d4', 'dots', 'Dot', 136, 338, 10, 10, '#e1452d'),
        cT('head', null, 'Headline', 70, 72, 'FORM\nFOLLOWS\nFUNCTION', 'sans', 76, 700, 'left', 0.95, '#151515'),
        cT('cap', null, 'Caption', 560, 800, 'PLATE 03\nGEOMETRY & TYPE', 'mono', 14, 400, 'left', 1.5, '#151515'),
        cR('frame', null, 'Frame', 20, 20, 860, 860, 'none', { stroke: '#151515', sw: 1, op: 0.35 }),
      ],
    },
  },
};
