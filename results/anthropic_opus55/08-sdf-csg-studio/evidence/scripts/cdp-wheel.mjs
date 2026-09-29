// Dispatch real CDP mouse-wheel input at (x,y) on the first page target of the agent-browser Chrome.
const [,, browserWs, x, y, dy] = process.argv;
const port = new URL(browserWs).port;
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find(t => t.type === 'page' && t.url.includes('index.html'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const send = (method, params) => new Promise(res => { const my = ++id; ws.addEventListener('message', function h(ev) { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', h); res(m); } }); ws.send(JSON.stringify({ id: my, method, params })); });
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: +x, y: +y });
const r = await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: +x, y: +y, deltaX: 0, deltaY: +dy });
console.log('wheel', x, y, dy, r.error ? JSON.stringify(r.error) : 'ok');
ws.close();
