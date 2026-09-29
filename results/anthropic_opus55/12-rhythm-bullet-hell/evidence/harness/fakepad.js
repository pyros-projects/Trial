// Synthetic Gamepad API object (no physical controller available in this environment).
(function(){ const btns = Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false }));
  window.__pad = { id: 'Synthetic test pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: btns, timestamp: 0 };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad, null, null, null], configurable: true });
  window.__padBtn = (i, on) => { btns[i].pressed = on; btns[i].value = on ? 1 : 0; return i + '=' + on; };
})();
