// Two-finger pinch via CDP touch events: fingers move from +-d0 to +-d1 around (cx, cy).
const [,, browserWs, cx, cy, d0, d1] = process.argv;
const port = new URL(browserWs).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page' && t.url.includes('index.html'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const send = (method, params) => new Promise(res => { const my = ++id; ws.addEventListener('message', function h(ev) { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', h); res(m); } }); ws.send(JSON.stringify({ id: my, method, params })); });
const pts = d => [{ x: +cx - d, y: +cy, id: 1 }, { x: +cx + d, y: +cy, id: 2 }];
let r = await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(+d0) });
for (let i = 1; i <= 8; i++) r = await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(+d0 + (d1 - d0) * i / 8) });
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('pinch done', r.error ? JSON.stringify(r.error) : 'ok'); ws.close();
