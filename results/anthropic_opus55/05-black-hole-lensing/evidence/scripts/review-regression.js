// Regression checks for the independent-review findings (A,B,D,F,G,H,I). Paste via agent-browser eval --stdin.
(async () => {
  const b = window.__bh, P = b.P, out = {};
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  b.setParam('paused', false); b.setParam('timeSpeed', 6); await wait(1500);
  // A/B: a discrete change while time runs must restart accumulation (no ghost / dimming from stale history)
  const before = b.state.accumN; b.setParam('mode', 3); await raf(); await raf();
  out.B_modeSwitchWhileRunning = { accumBefore: before, accumAfter2Frames: b.state.accumN, pass: before > 3 && b.state.accumN <= 2 };
  b.setParam('mode', 0); await wait(800);
  const beforeQ = b.state.accumN; b.setParam('renderScale', 0.8); await raf(); await raf();
  out.A_resizeWhileRunning = { accumBefore: beforeQ, accumAfter2Frames: b.state.accumN, internal: b.state.internal, pass: beforeQ > 3 && b.state.accumN <= 2 };
  b.setParam('renderScale', 1);
  // D: idle when time rate is 0 but not paused
  b.setParam('timeSpeed', 0); await wait(6000);
  out.D_idleAtZeroRate = { paused: P.paused, idle: b.state.idle, accum: b.state.accumN, pass: !P.paused && b.state.idle };
  b.setParam('timeSpeed', 6);
  // F: pointercancel never selects
  b.clearSelection();
  const c = document.querySelector('#gl');
  c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 31, pointerType: 'touch', clientX: 300, clientY: 300, bubbles: true, button: 0 }));
  c.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 31, pointerType: 'touch', clientX: 300, clientY: 300, bubbles: true, button: 0 }));
  out.F_pointercancel = { selected: !!b.state.selected, pass: !b.state.selected };
  // G: legend stays hidden while UI hidden
  c.focus(); const kd = (key, shift) => window.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: !!shift, bubbles: true }));
  kd('h'); kd('m'); await raf();
  out.G_legendWhileHidden = { mode: P.mode, legendHidden: document.querySelector('#legend').classList.contains('hidden'), pass: P.mode === 1 && document.querySelector('#legend').classList.contains('hidden') };
  kd('h'); await raf();
  out.G_legendAfterUnhide = { legendHidden: document.querySelector('#legend').classList.contains('hidden'), pass: !document.querySelector('#legend').classList.contains('hidden') };
  // H: legend tick reflects maxSteps after a quality preset
  b.setParam('quality', 'ultra'); await raf();
  const txt = document.querySelector('#legend').textContent;
  out.H_legendAfterPreset = { hasUltraMax: txt.includes('1200'), pass: txt.includes('1200') };
  b.setParam('quality', 'high'); b.setParam('mode', 0);
  // I: top-edge pixel maps inside the image
  const sel = b.selectAt(0.5, 0);
  out.I_topEdgePixel = { py: sel.py, ih: b.state.internal[1], pass: sel.py === b.state.internal[1] - 0.5 };
  b.clearSelection();
  out.allPass = Object.values(out).every(v => v.pass);
  return JSON.stringify(out, null, 1);
})()
