// SYNTHETIC two-pointer pinch/pan (dispatched PointerEvents; not OS-level touch). Exercises the app's pinch handler.
(() => {
  const c = document.querySelector('#gl'), g = window.__bh.camGoal;
  const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 11, bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const before = { dist: g.dist, t: [g.tx, g.ty, g.tz] };
  ev('pointerdown', 11, 400, 400); ev('pointerdown', 12, 500, 400);
  for (let k = 1; k <= 10; k++) ev('pointermove', 12, 500 + k * 10, 400);          // spread 100 → 200 px
  const afterPinch = g.dist;
  for (let k = 1; k <= 5; k++) { ev('pointermove', 11, 400 + k * 8, 400 - k * 6); ev('pointermove', 12, 600 + k * 8, 400 - k * 6); } // two-finger drag
  ev('pointerup', 12, 640, 370); ev('pointerup', 11, 440, 370);
  return JSON.stringify({ distBefore: +before.dist.toFixed(2), distAfterPinch: +afterPinch.toFixed(2), expectedRatio: 0.5,
    targetBefore: before.t, targetAfterPan: [g.tx, g.ty, g.tz].map(v => +v.toFixed(2)), selectedByAccident: !!window.__bh.state.selected });
})()
