/* ==========================================================================
 * SCENARIOS — each one builds a fresh world and can tune the solver defaults.
 * World box is 1600 x 1000 world units, +y is down, 100 u = 1 "metre".
 * =========================================================================*/

function makeScenarios(A) {
  const SC = [];
  const shape = (W, s) => A.addShape(W, s);
  const cloth = (W, o) => A.buildCloth(W, o);
  const rope = (W, o) => A.buildChain(W, o);
  const blob = (W, o) => A.buildBlob(W, o);
  const jelly = (W, o) => A.buildJelly(W, o);
  const ball = (W, o) => A.buildCluster(W, Object.assign({ sp: 15 }, o));

  /* press a body's particles to a neighbour body (attachment constraints) */
  function sew(W, body, host, maxDist) {
    let n = 0;
    for (let i = body.p0; i < body.p0 + body.pn; i++) {
      const k = A.weldNearest(W, i, host, maxDist || 30);
      if (k >= 0) n++;
    }
    return n;
  }

  /* pressurised tube: elliptical shell that conserves its area */
  function tube(W, o) {
    const n = o.n;
    const b = A.addBody(W, {
      kind: A.BK_BLOB, p0: W.n, pn: n, closed: true, aero: false, self: true,
      name: 'tube', dampMul: 1.5, ring: n, rad: Math.max(o.rx, o.ry),
      thick: 7, hsl: { h: o.hue, s: 66, l: 55 }
    });
    const start = W.n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      A.addP(W, o.cx + Math.cos(a) * o.rx, o.y0 + Math.sin(a) * o.ry, o.im, 4.2, b, i, 0, 2, false);
    }
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(start + i);
    for (let i = 0; i < n; i++) {
      A.addPair(W, start + i, start + (i + 1) % n, undefined, A.CL_STRUCT);
      A.addPair(W, start + i, start + (i + 2) % n, undefined, A.CL_BEND);
    }
    A.addArea(W, idx, n, 1);
    return b;
  }

  /* ------------------------------------------------------------ scenarios */

  SC.push({
    id: 'cascade', name: 'Cascade Crash', default: true,
    blurb: 'Sheet, pendulum chain and a spinning paddle: the machine keeps running.',
    tool: 'grab',
    settings: { gravity: 900, wind: 250, windDir: 0, tear: 0.55 },
    build(W) {
      /* One machine, not a still life: everything is in contact with something.
         A steep chute feeds a kinematic paddle; a chain hangs into the paddle;
         a curtain hangs across the chute and gets raked by the pucks; the
         right-hand bin collects pucks, jelly and a pressurised balloon. */
      shape(W, { kind: 'seg', x0: 110, y0: 210, x1: 660, y1: 470, r: 14 });
      shape(W, { kind: 'seg', x0: 990, y0: 330, x1: 700, y1: 540, r: 14 });
      shape(W, { kind: 'box', cx: 780, cy: 720, hw: 180, hh: 13, spin: 2.2 });
      shape(W, { kind: 'circle', cx: 1060, cy: 250, r: 95 });
      shape(W, { kind: 'box', cx: 1120, cy: 620, hw: 15, hh: 165, angle: 0.22 });
      shape(W, { kind: 'box', cx: 1490, cy: 620, hw: 15, hh: 165, angle: -0.22 });
      shape(W, { kind: 'box', cx: 1290, cy: 830, hw: 220, hh: 16 });
      /* curtain: pinned along the top every 4th node so it can billow */
      /* banner: held along its whole top edge so it stays taut and streams
         in the wind instead of crumpling into a long tail */
      const c = cloth(W, { x0: 90, y0: 70, cols: 16, rows: 7, sp: 20, im: 0.45, hue: 168 });
      for (let r = 0; r < 16; r++) A.pinP(W, c.p0 + r);
      /* chain hanging into the paddle */
      const ro = rope(W, { x0: 620, y0: 150, dx: 0.5, dy: 1, n: 18, seg: 20, im: 0.32, thick: 6.5 });
      A.pinP(W, ro.p0);
      /* pucks: two on the chute, one on the deflector, three already in the bin */
      ball(W, { cx: 250, y0: 250, r: 34, sp: 14, im: 0.28, name: 'puck' });
      ball(W, { cx: 420, y0: 330, r: 28, sp: 13, im: 0.28, name: 'puck' });
      ball(W, { cx: 560, y0: 380, r: 24, sp: 13, im: 0.28, name: 'puck' });
      ball(W, { cx: 1060, y0: 90, r: 36, sp: 14, im: 0.28, name: 'puck' });
      ball(W, { cx: 1230, y0: 700, r: 30, sp: 14, im: 0.28, name: 'puck' });
      ball(W, { cx: 1300, y0: 740, r: 34, sp: 14, im: 0.28, name: 'puck' });
      ball(W, { cx: 1400, y0: 700, r: 26, sp: 13, im: 0.28, name: 'puck' });
      /* soft bodies */
      blob(W, { cx: 1180, y0: 480, r: 52, n: 20, im: 0.5, hue: 300 });
      blob(W, { cx: 1400, y0: 520, r: 46, n: 20, im: 0.5, hue: 24 });
      jelly(W, { x0: 1250, y0: 620, cols: 6, rows: 5, sp: 26, im: 0.45, hue: 226 });
    }
  });

  SC.push({
    id: 'flag', name: 'Hanging Flag',
    blurb: 'Curtain sewn to a mast, flapping in turbulence. Push the wind up to shred it.',
    tool: 'grab',
    settings: { gravity: 420, wind: 400, windDir: 0, windTurb: 0.8, tear: 0.42, kBend: 0.22 },
    build(W) {
      shape(W, { kind: 'seg', x0: 250, y0: 90, x1: 250, y1: 860, r: 13 });
      const c = cloth(W, { x0: 262, y0: 100, cols: 30, rows: 18, sp: 21, im: 0.5, hue: 205 });
      for (let r = 0; r < 18; r++) A.pinP(W, c.p0 + r * 30);
      shape(W, { kind: 'circle', cx: 1250, cy: 620, r: 150 });
      shape(W, { kind: 'box', cx: 880, cy: 880, hw: 300, hh: 16, angle: -0.14 });
      rope(W, { x0: 1000, y0: 110, dx: 0, dy: 1, n: 30, seg: 20, im: 0.6 });
    }
  });

  SC.push({
    id: 'drape', name: 'Cloth Drape',
    blurb: 'Folding over static geometry, plus a kinematic paddle that drags fabric around.',
    tool: 'grab',
    settings: { gravity: 1000, wind: 110, tear: 0.6, friction: 0.62, thickness: 6 },
    build(W) {
      shape(W, { kind: 'circle', cx: 430, cy: 430, r: 145 });
      shape(W, { kind: 'box', cx: 800, cy: 560, hw: 210, hh: 22, angle: 0.28 });
      shape(W, { kind: 'box', cx: 1200, cy: 430, hw: 110, hh: 110, angle: 0.5 });
      shape(W, { kind: 'box', cx: 700, cy: 240, hw: 190, hh: 12, spin: 1.6 });
      shape(W, { kind: 'seg', x0: 1300, y0: 560, x1: 1520, y1: 780, r: 14 });
      cloth(W, { x0: 260, y0: 40, cols: 26, rows: 22, sp: 21, im: 0.5, hue: 178 });
      cloth(W, { x0: 930, y0: 60, cols: 26, rows: 20, sp: 21, im: 0.5, hue: 44 });
      const r = rope(W, { x0: 1350, y0: 90, dx: 0, dy: 1, n: 26, seg: 20, im: 0.6 });
      A.pinP(W, r.p0);
      blob(W, { cx: 1120, y0: 160, r: 62, n: 22, im: 0.55, hue: 344 });
    }
  });

  SC.push({
    id: 'bridge', name: 'Bridge Under Load',
    blurb: 'Suspension deck of welded links carrying a soft cart and heavy shot.',
    tool: 'grab',
    settings: { gravity: 1050, wind: 80, tear: 0.3, kStruct: 0.96, kBend: 0.45 },
    build(W) {
      shape(W, { kind: 'box', cx: 200, cy: 300, hw: 24, hh: 230 });
      shape(W, { kind: 'box', cx: 1340, cy: 300, hw: 24, hh: 230 });
      shape(W, { kind: 'box', cx: 770, cy: 910, hw: 430, hh: 22, angle: 0.04 });
      const deck = rope(W, {
        x0: 225, y0: 520, dx: 1090, dy: 40, n: 52, seg: 21.2,
        im: 0.55, thick: 9, bend: true, ropeCol: 'rgba(212,168,110,0.96)'
      });
      A.pinP(W, deck.p0);
      A.pinP(W, deck.p0 + 52);
      const c1 = rope(W, { x0: 420, y0: 120, dx: 1, dy: 1.25, n: 26, seg: 24, im: 0.7, thick: 4.5 });
      const c2 = rope(W, { x0: 1120, y0: 120, dx: -1, dy: 1.25, n: 26, seg: 24, im: 0.7, thick: 4.5 });
      A.pinP(W, c1.p0);
      A.pinP(W, c2.p0);
      /* cables sewn onto the deck every few links = attachment constraints */
      sew(W, c1, deck, 40);
      sew(W, c2, deck, 40);
      const cart = jelly(W, { x0: 620, y0: 380, cols: 11, rows: 6, sp: 26, im: 0.34, hue: 210 });
      for (let i = cart.p0; i < cart.p0 + cart.pn; i++) W.im[i] *= 1.8;
      const shot = ball(W, { cx: 980, y0: 300, r: 40, im: 0.3, name: 'shot' });
      void shot;
    }
  });

  SC.push({
    id: 'stack', name: 'Soft Body Stack',
    blurb: 'Pressurised shells and jelly slabs on a platform, squeezed by a sliding plate.',
    tool: 'grab',
    settings: { gravity: 980, wind: 50, pressure: 0.8, tear: 0.6, friction: 0.55 },
    build(W) {
      shape(W, { kind: 'box', cx: 620, cy: 700, hw: 330, hh: 18, angle: -0.18 });
      shape(W, { kind: 'box', cx: 1180, cy: 620, hw: 210, hh: 16, angle: 0.24 });
      shape(W, {
        kind: 'box', cx: 1180, cy: 420, hw: 24, hh: 150,
        slide: { vx: -70, min: 1000, max: 1400 }
      });
      shape(W, { kind: 'circle', cx: 1010, cy: 280, r: 60 });
      jelly(W, { x0: 430, y0: 430, cols: 10, rows: 8, sp: 27, im: 0.42, hue: 205 });
      jelly(W, { x0: 640, y0: 560, cols: 10, rows: 5, sp: 27, im: 0.42, hue: 262 });
      jelly(W, { x0: 860, y0: 600, cols: 6, rows: 6, sp: 27, im: 0.42, hue: 40 });
      blob(W, { cx: 1130, y0: 430, r: 64, n: 24, im: 0.5, hue: 344 });
      blob(W, { cx: 1300, y0: 380, r: 52, n: 22, im: 0.5, hue: 300 });
      blob(W, { cx: 520, y0: 250, r: 58, n: 22, im: 0.5, hue: 152 });
      cloth(W, { x0: 160, y0: 90, cols: 18, rows: 14, sp: 21, im: 0.5, hue: 18 });
      rope(W, { x0: 980, y0: 210, dx: 1, dy: 0.35, n: 26, seg: 20, im: 0.45 });
    }
  });

  SC.push({
    id: 'net', name: 'Suspended Rope Net',
    blurb: 'A sling woven from plain distance links holds three heavy shots. Cut it and watch.',
    tool: 'cut',
    settings: { gravity: 1100, wind: 130, tear: 0.35, kStruct: 0.94 },
    build(W) {
      const net = cloth(W, {
        x0: 320, y0: 300, cols: 26, rows: 12, sp: 24, im: 0.45,
        shear: false, bend: false, hue: 200
      });
      A.pinP(W, net.p0);
      A.pinP(W, net.p0 + 25);
      A.pinP(W, net.p0 + 11 * 26);
      A.pinP(W, net.p0 + 11 * 26 + 25);
      const b1 = ball(W, { cx: 470, y0: 180, r: 40, im: 0.28, name: 'shot A' });
      const b2 = ball(W, { cx: 690, y0: 150, r: 48, im: 0.28, name: 'shot B' });
      const b3 = ball(W, { cx: 900, y0: 200, r: 36, im: 0.28, name: 'shot C' });
      void b1; void b2; void b3;
      shape(W, { kind: 'box', cx: 1250, cy: 620, hw: 240, hh: 18, angle: 0.2 });
      cloth(W, { x0: 1150, y0: 120, cols: 20, rows: 18, sp: 21, im: 0.5, hue: 60 });
    }
  });

  SC.push({
    id: 'balloon', name: 'Balloon Chamber',
    blurb: 'Low gravity, live pressure. Shells and a pressurised tube squash and collide.',
    tool: 'grab',
    settings: { gravity: 170, wind: 240, windDir: 0, pressure: 0.9, damping: 1.3, tear: 0.75 },
    build(W) {
      shape(W, { kind: 'box', cx: 520, cy: 830, hw: 330, hh: 18, angle: -0.1 });
      shape(W, { kind: 'box', cx: 1130, cy: 810, hw: 300, hh: 18, angle: 0.12 });
      shape(W, { kind: 'circle', cx: 800, cy: 560, r: 90 });
      blob(W, { cx: 380, y0: 300, r: 76, n: 26, im: 0.5, hue: 344 });
      blob(W, { cx: 560, y0: 430, r: 54, n: 22, im: 0.5, hue: 300 });
      blob(W, { cx: 1080, y0: 320, r: 90, n: 28, im: 0.5, hue: 200 });
      blob(W, { cx: 1290, y0: 470, r: 60, n: 22, im: 0.5, hue: 148 });
      tube(W, { cx: 760, y0: 250, rx: 180, ry: 56, n: 34, im: 0.45, hue: 30 });
      ball(W, { cx: 950, y0: 660, r: 44, im: 0.55, name: 'anchor shot' });
      cloth(W, { x0: 150, y0: 600, cols: 16, rows: 10, sp: 22, im: 0.5, hue: 220 });
    }
  });

  SC.push({
    id: 'stress', name: 'Destructive Stress Test',
    blurb: 'Overloaded sheet carrying heavy loads, with a shredder underneath. Tears fast.',
    tool: 'cut',
    settings: {
      gravity: 1500, wind: 500, windDir: 0, windTurb: 0.9, tear: 0.2,
      tearOn: true, kBend: 0.1, kShear: 0.3, damping: 0.5
    },
    build(W) {
      const c = cloth(W, { x0: 380, y0: 130, cols: 34, rows: 14, sp: 23, im: 0.45, hue: 8 });
      for (let col = 0; col < 34; col++) A.pinP(W, c.p0 + col);   /* top rail */
      shape(W, { kind: 'box', cx: 760, cy: 660, hw: 220, hh: 11, spin: -3.1 });
      shape(W, { kind: 'circle', cx: 1250, cy: 560, r: 110 });
      for (let k = 0; k < 5; k++) {
        const j = jelly(W, {
          x0: 430 + k * 155, y0: 420, cols: 6, rows: 6, sp: 24,
          im: 0.2, hue: 262, name: 'load ' + (k + 1)
        });
        for (let i = j.p0; i < j.p0 + j.pn; i++) W.im[i] *= 2.6;
        sew(W, j, c, 30);
      }
      rope(W, { x0: 110, y0: 220, dx: 0.2, dy: 1, n: 24, seg: 22, im: 0.5 });
    }
  });

  SC.push({
    id: 'wreck', name: 'Wrecking Ball',
    blurb: 'Heavy chain pendulum versus a loaded platform. Reset and it swings again.',
    tool: 'grab',
    settings: { gravity: 1400, wind: 0, tear: 0.35, restitution: 0.3, friction: 0.5 },
    build(W) {
      const r = rope(W, { x0: 250, y0: 140, dx: 1, dy: 0.8, n: 12, seg: 34, im: 0.28, thick: 8 });
      A.pinP(W, r.p0);
      const bob = ball(W, { cx: 620, y0: 400, r: 52, im: 0.2, name: 'wrecker' });
      A.weldNearest(W, r.p0 + 12, bob, 120);
      shape(W, { kind: 'box', cx: 1050, cy: 720, hw: 300, hh: 18 });
      shape(W, { kind: 'box', cx: 1400, cy: 520, hw: 18, hh: 180, angle: 0.1 });
      const j1 = jelly(W, { x0: 900, y0: 540, cols: 8, rows: 6, sp: 26, im: 0.45, hue: 210 });
      jelly(W, { x0: 1010, y0: 400, cols: 7, rows: 5, sp: 26, im: 0.45, hue: 340 });
      blob(W, { cx: 1190, y0: 470, r: 56, n: 22, im: 0.5, hue: 152 });
      blob(W, { cx: 1270, y0: 340, r: 46, n: 20, im: 0.5, hue: 44 });
      cloth(W, { x0: 1420, y0: 130, cols: 12, rows: 20, sp: 21, im: 0.5, hue: 190 });
      void j1;
    }
  });

  SC.push({
    id: 'sandbox', name: 'Sandbox',
    blurb: 'Mostly empty: obstacles, one sheet, one shell. Use the Spawn tool to fill it up.',
    tool: 'spawn',
    settings: { gravity: 900, wind: 150, tear: 0.5 },
    build(W) {
      shape(W, { kind: 'box', cx: 420, cy: 650, hw: 260, hh: 16, angle: -0.2 });
      shape(W, { kind: 'circle', cx: 980, cy: 520, r: 120 });
      shape(W, { kind: 'box', cx: 1330, cy: 360, hw: 160, hh: 11, spin: 1.1 });
      shape(W, { kind: 'seg', x0: 120, y0: 880, x1: 700, y1: 820, r: 12 });
      cloth(W, { x0: 250, y0: 80, cols: 22, rows: 16, sp: 21, im: 0.5, hue: 168 });
      blob(W, { cx: 1200, y0: 220, r: 62, n: 22, im: 0.5, hue: 344 });
    }
  });

  return { list: SC, byId: (id) => SC.find((s) => s.id === id) || SC[0] };
}
