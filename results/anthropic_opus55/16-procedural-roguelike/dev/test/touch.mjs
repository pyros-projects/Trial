// Dev-only: dispatch genuine touch events (pointerType "touch") to the page
// through the Chrome DevTools Protocol. Usage:
//   node dev/test/touch.mjs <browser-ws-url> tap X Y [holdMs]
import process from 'node:process';
const [, , wsUrl, cmd, xs, ys, hold = '40'] = process.argv;
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } };
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page' && /index\.html/.test(t.url)) || targetInfos.find((t) => t.type === 'page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    const x = +xs, y = +ys;
    if (cmd === 'tap') {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }, sessionId);
      await new Promise((r) => setTimeout(r, +hold));
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
    }
    console.log('touch', cmd, x, y, 'hold', hold, 'on', page.url.slice(-40));
  } catch (e) { console.error('ERR', e.message); process.exitCode = 1; }
  ws.close();
};
