// Real touch input via CDP Input.dispatchTouchEvent against the agent-browser session.
// usage: node touch.mjs <browserWsUrl> <jsonPathOfPoints>  (points: [[x,y],...] in CSS px)
const [,, wsUrl, ptsJson] = process.argv;
const pts = JSON.parse(ptsJson);
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId;
  pending.set(m.id, { res, rej }); ws.send(JSON.stringify(m));
});
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page' && t.url.includes('index.html'));
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 }, sessionId);
    const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(...pts[0]) }, sessionId);
    for (const p of pts.slice(1)) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(...p) }, sessionId); await new Promise((r) => setTimeout(r, 16)); }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
    const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__lastPointerTypes||null)', returnByValue: true }, sessionId);
    console.log('ok', r.result.value);
  } catch (e) { console.error('ERR', e.message); }
  ws.close();
};
