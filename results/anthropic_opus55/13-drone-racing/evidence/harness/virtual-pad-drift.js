// Harness: virtual gamepad with a drifting, asymmetric stick (tests calibration / dead zone / inversion paths)
(() => {
  if (window.__bot) { clearInterval(window.__bot.timer); window.__bot.on = false; }
  const pad = window.__vpad = { id: 'Harness drift pad (virtual)', index: 0, connected: true, mapping: 'standard', timestamp: 1,
    axes: [0.18, 0.12, -0.15, 0.1], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [pad];
  return 'drift pad installed: rest axes ' + JSON.stringify(pad.axes);
})()
