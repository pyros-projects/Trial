#!/usr/bin/env node
// Dispatch genuine multi-touch events through CDP (agent-browser's device
// profile does not enable touch emulation, and Input.dispatchTouchEvent is not
// exposed by the CLI). Usage: node touchdrag.js <browserWsUrl> <pageUrlSubstring>
const [wsUrl, urlMatch] = process.argv.slice(2);

async function main () {
  const targets = await (await fetch('http://' + new URL(wsUrl).host + '/json/list')).json();
  const page = targets.find(t => t.type === 'page' && t.url.includes(urlMatch));
  if (!page) throw new Error('page not found: ' + targets.map(t => t.url).join(','));

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmitTouchEventsForMouse', { enabled: false });

  // record what the page actually receives
  await evalJs(`window.__touch = { types: {}, ids: new Set(), max: 0 };
    const c = document.getElementById('glcanvas');
    const rec = e => { window.__touch.types[e.pointerType] = (window.__touch.types[e.pointerType]||0)+1;
                       window.__touch.ids.add(e.pointerId);
                       window.__touch.max = Math.max(window.__touch.max, window.fluxion.stats.pointers); };
    c.addEventListener('pointerdown', rec, true); c.addEventListener('pointermove', rec, true); 'ok'`);

  const before = await evalJs('JSON.stringify(window.fluxion.measure())');

  // --- two fingers dragging in opposite directions --------------------------
  const pt = (id, x, y) => ({ x, y, id, radiusX: 12, radiusY: 12, force: 1 });
  let a = { x: 90, y: 620 }, b = { x: 300, y: 220 };
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(1, a.x, a.y), pt(2, b.x, b.y)] });
  for (let i = 1; i <= 14; i++) {
    a = { x: 90 + i * 14, y: 620 - i * 20 };
    b = { x: 300 - i * 14, y: 220 + i * 20 };
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [pt(1, a.x, a.y), pt(2, b.x, b.y)] });
    await sleep(28);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);

  const after = await evalJs('JSON.stringify(window.fluxion.measure())');
  const seen = await evalJs("JSON.stringify({types: window.__touch.types, distinctPointerIds: window.__touch.ids.size, maxSimultaneousPointers: window.__touch.max, splats: window.fluxion.stats.splats, maxTouchPoints: navigator.maxTouchPoints})");
  console.log(JSON.stringify({ before: JSON.parse(before), after: JSON.parse(after), observed: JSON.parse(seen) }, null, 1));
  ws.close();
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
