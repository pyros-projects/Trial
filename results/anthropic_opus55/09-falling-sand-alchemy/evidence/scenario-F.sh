#!/usr/bin/env bash
# Scenario F: narrow viewport (390x844 @3x) layout, controls and pointer input.
source "$(dirname "$0")/lib.sh"
fresh_open 390 844 3
btn "Blank Canvas"; sleep 0.3
echo "layout: $(ev 'JSON.stringify({vw:innerWidth,vh:innerHeight,scrollW:document.documentElement.scrollWidth,stage:[document.getElementById("stage").clientWidth,document.getElementById("stage").clientHeight],grid:[alchemy.grid.W,alchemy.grid.H],dpr:alchemy.grid.dpr,canvasPx:[document.getElementById("view").width,document.getElementById("view").height]})')"
btn "Water"; btn "Paint tool"; drag 10 40 120 40 10 60 120 60; sleep 0.5
echo "mouse strokes on phone: water=$(ev 'alchemy.counts().Water')"
echo "synthetic touch stroke (PointerEvent pointerType=touch):"
cat <<'JS' > /tmp/claude-1000/touch.js
(() => { const v = document.getElementById('view'); const S0 = alchemy.counts().Sand || 0;
  document.querySelector('#matGrid .mat[aria-label="Sand"]').click();
  const p = (x, y) => alchemy.toScreen(x, y);
  const mk = (type, x, y) => new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: p(x, y).x, clientY: p(x, y).y, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  v.dispatchEvent(mk('pointerdown', 20, 100));
  for (let k = 1; k <= 10; k++) v.dispatchEvent(mk('pointermove', 20 + k * 9, 100));
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => { v.dispatchEvent(mk('pointerup', 110, 100)); r(JSON.stringify({ sandBefore: S0, sandAfter: alchemy.counts().Sand || 0 })); })));
})()
JS
echo "  $(agent-browser eval --stdin < /tmp/claude-1000/touch.js | tail -1)"
sleep 1; shot F1-mobile-painting
agent-browser select "#viewMode" temp >/dev/null; sleep 0.3; shot F2-mobile-temp-view; agent-browser select "#viewMode" normal >/dev/null
btn "Burning Building"; sleep 4; shot F3-mobile-building; echo "fps on phone viewport: $(ev 'alchemy.stats().fps')"
echo "errors: $(agent-browser errors 2>&1 | head -3)"
agent-browser set viewport 1280 800 1 >/dev/null
