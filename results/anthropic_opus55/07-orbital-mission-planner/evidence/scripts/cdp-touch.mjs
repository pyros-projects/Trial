// Real touch input through the Chrome DevTools Protocol (Input.dispatchTouchEvent) against the running page.
// Usage: node cdp-touch.mjs <browser-ws-url>
const url = process.argv[2];
const ws = new WebSocket(url);
let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params }; if (sessionId) msg.sessionId = sessionId;
  pending.set(msg.id, { res, rej }); ws.send(JSON.stringify(msg));
});
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page' && t.url.includes('index.html'));
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;
    const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) }, sessionId);
    const out = {};
    await ev("OrbitLab.setPaused(true); 'ok'");
    const cam = () => ev("JSON.stringify({scale:OrbitLab.ui.cam.scale, x:OrbitLab.ui.cam.x, y:OrbitLab.ui.cam.y, sel:OrbitLab.snapshot().sel})");
    out.before = JSON.parse(await cam());
    // pinch out: fingers 100px apart -> 220px apart
    await touch('touchStart', [[400, 420], [500, 420]]);
    for (let k = 1; k <= 12; k++) { const d = 50 + 60 * k / 12; await touch('touchMove', [[450 - d, 420], [450 + d, 420]]); await sleep(16); }
    await touch('touchEnd', []);
    await sleep(100);
    out.afterPinchOut = JSON.parse(await cam());
    out.pinchRatio = out.afterPinchOut.scale / out.before.scale;
    // one-finger pan by (+80, +40) px
    await touch('touchStart', [[300, 600]]);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', [[300 + 10 * k, 600 + 5 * k]]); await sleep(16); }
    await touch('touchEnd', []);
    await sleep(100);
    out.afterPan = JSON.parse(await cam());
    out.panWorldDx = out.afterPan.x - out.afterPinchOut.x; out.expectedDx = -80 / out.afterPinchOut.scale;
    // tap on Selene to select it, then tap on Pathfinder
    for (const name of ['Gaia', 'Pathfinder']) {
      const p = JSON.parse(await ev(`JSON.stringify(OrbitLab.snapshot().objects.find(o=>o.name==='${name}'))`));
      await touch('touchStart', [[Math.round(p.sx), Math.round(p.sy)]]); await sleep(30); await touch('touchEnd', []); await sleep(120);
      out['tap_' + name] = { at: [Math.round(p.sx), Math.round(p.sy)], selected: JSON.parse(await cam()).sel };
    }
    out.errors = await ev('JSON.stringify(window.__errs||[])');
    console.log(JSON.stringify(out, null, 1));
  } catch (e) { console.error('ERR', e.message); }
  ws.close();
};
