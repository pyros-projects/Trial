// Real CDP mouse drag from (x0,y0) to (x1,y1) with optional modifiers (8 = Shift) and button.
const [,, browserWs, x0, y0, x1, y1, modifiers = '0', button = 'left'] = process.argv;
const port = new URL(browserWs).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page' && t.url.includes('index.html'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const send = (method, params) => new Promise(res => { const my = ++id; ws.addEventListener('message', function h(ev) { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', h); res(m); } }); ws.send(JSON.stringify({ id: my, method, params })); });
const mods = +modifiers, btn = { left: 1, right: 2, middle: 4 }[button];
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: +x0, y: +y0, modifiers: mods });
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: +x0, y: +y0, button, buttons: btn, clickCount: 1, modifiers: mods });
for (let i = 1; i <= 6; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: +x0 + (x1 - x0) * i / 6, y: +y0 + (y1 - y0) * i / 6, button, buttons: btn, modifiers: mods });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: +x1, y: +y1, button, buttons: 0, clickCount: 1, modifiers: mods });
console.log('drag done'); ws.close();
