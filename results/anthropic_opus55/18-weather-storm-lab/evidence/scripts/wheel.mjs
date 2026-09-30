// Real wheel input via CDP Input.dispatchMouseEvent(mouseWheel). Usage: node wheel.mjs <cdp-url> <x> <y> <deltaY> [count]
const [url, x, y, dy, count = 1] = process.argv.slice(2);
const ws = new WebSocket(url); let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } };
ws.onopen = async () => {
  try {
    let sessionId;
    if (/\/devtools\/browser\//.test(url)) {
      const { targetInfos } = await send('Target.getTargets');
      const page = targetInfos.find(t => t.type === 'page' && /index\.html/.test(t.url)) || targetInfos.find(t => t.type === 'page');
      ({ sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true }));
    }
    for (let n = 0; n < +count; n++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +x, y: +y, deltaX: 0, deltaY: +dy }, sessionId); await new Promise(r => setTimeout(r, 40)); }
    console.log(`wheel ${count}x deltaY=${dy} at (${x},${y}) dispatched`);
  } catch (e) { console.log('wheel error: ' + e.message); }
  ws.close();
};
