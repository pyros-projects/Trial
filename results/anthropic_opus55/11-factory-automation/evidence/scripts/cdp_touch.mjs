// Sends trusted touch input to the Fluxworks page through the Chrome DevTools Protocol.
// usage: node cdp_touch.mjs <browser-ws-url> '<json actions>'
//   action: {type:'touchStart'|'touchMove'|'touchEnd', points:[[x,y],...]} | {type:'mouseWheel',x,y,deltaY} | {wait:ms}
const [url, json] = process.argv.slice(2);
const actions = JSON.parse(json);
const ws = new WebSocket(url);
let id = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej });
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const t = targetInfos.find((t) => t.type === 'page' && t.url.includes('index.html'));
    const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    for (const a of actions) {
      if (a.wait) { await new Promise((r) => setTimeout(r, a.wait)); continue; }
      if (a.type === 'mouseWheel') { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: a.x, y: a.y, deltaX: 0, deltaY: a.deltaY }, sessionId); await new Promise((r) => setTimeout(r, 30)); continue; }
      await send('Input.dispatchTouchEvent', { type: a.type, touchPoints: a.points.map((p, k) => ({ x: p[0], y: p[1], id: k, radiusX: 4, radiusY: 4, force: 1 })) }, sessionId);
      await new Promise((r) => setTimeout(r, 20));
    }
    console.log('ok');
  } catch (err) { console.log('error ' + err.message); }
  ws.close(); process.exit(0);
};
