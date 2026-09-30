// Dispatches real touch input (CDP Input.dispatchTouchEvent) into agent-browser's own Chromium page:
// a one-finger drag (orbit) and a two-finger pinch (zoom). Usage: node touch.mjs <cdp-websocket-url>
const url = process.argv[2];
if (!url) { console.log('no CDP url'); process.exit(1); }
const ws = new WebSocket(url);
let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
ws.onopen = async () => {
  try {
    let sessionId;
    if (/\/devtools\/browser\//.test(url)) {
      const { targetInfos } = await send('Target.getTargets');
      const page = targetInfos.find(t => t.type === 'page' && /index\.html/.test(t.url)) || targetInfos.find(t => t.type === 'page');
      ({ sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true }));
    }
    const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1, radiusX: 5, radiusY: 5, force: 1 })) }, sessionId);
    // one-finger orbit drag
    await touch('touchStart', [[195, 430]]);
    for (let i = 1; i <= 12; i++) { await touch('touchMove', [[195 + i * 8, 430 + i * 2]]); await sleep(30); }
    await touch('touchEnd', []);
    console.log('one-finger drag dispatched');
    await sleep(300);
    // two-finger pinch out (zoom in)
    await touch('touchStart', [[165, 450], [225, 450]]);
    for (let i = 1; i <= 12; i++) { await touch('touchMove', [[165 - i * 6, 450], [225 + i * 6, 450]]); await sleep(30); }
    await touch('touchEnd', []);
    console.log('two-finger pinch dispatched');
  } catch (e) { console.log('touch error: ' + e.message); }
  ws.close();
};
