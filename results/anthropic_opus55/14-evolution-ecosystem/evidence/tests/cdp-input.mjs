// Trusted input via Chrome DevTools Protocol on the browser agent-browser drives.
// Used for wheel-at-cursor and multi-touch pinch, which the agent-browser 0.31.1 CLI
// cannot position (its `mouse wheel` always fires at client (0,0)).
// Usage: node cdp-input.mjs <ws-browser-url> <cmd> ...args
//   wheel x y dy            mouseWheel at (x,y)
//   drag x0 y0 x1 y1 n btn  mouse drag with n intermediate moves (btn: left|right|middle)
//   pinch cx cy d0 d1 n     two-finger pinch around (cx,cy) from distance d0 to d1
//   tap x y                 single touch tap
//   touchdrag x0 y0 x1 y1 n single-finger touch drag
const [,, wsUrl, cmd, ...a] = process.argv;
const args = a.map(Number);
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId;
  pending.set(m.id, { res, rej }); ws.send(JSON.stringify(m));
});
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find(t => t.type === 'page' && /index\.html/.test(t.url)) || targetInfos.find(t => t.type === 'page');
    const { sessionId: s } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', Object.assign({ type, x, y }, extra), s);
    const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) }, s);
    if (cmd === 'wheel') { await mouse('mouseMoved', args[0], args[1]); await mouse('mouseWheel', args[0], args[1], { deltaX: 0, deltaY: args[2] }); }
    else if (cmd === 'drag') {
      const [x0, y0, x1, y1, n] = args; const btn = a[5] || 'left'; const bits = { left: 1, right: 2, middle: 4 }[btn];
      await mouse('mouseMoved', x0, y0); await mouse('mousePressed', x0, y0, { button: btn, buttons: bits, clickCount: 1 });
      for (let i = 1; i <= n; i++) { await mouse('mouseMoved', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, { button: btn, buttons: bits }); await sleep(16); }
      await mouse('mouseReleased', x1, y1, { button: btn, buttons: 0, clickCount: 1 });
    } else if (cmd === 'pinch') {
      const [cx, cy, d0, d1, n] = args;
      const pts = d => [[cx - d / 2, cy], [cx + d / 2, cy]];
      await touch('touchStart', pts(d0));
      for (let i = 1; i <= n; i++) { await touch('touchMove', pts(d0 + (d1 - d0) * i / n)); await sleep(16); }
      await touch('touchEnd', []);
    } else if (cmd === 'tap') { await touch('touchStart', [[args[0], args[1]]]); await sleep(30); await touch('touchEnd', []); }
    else if (cmd === 'touchdrag') {
      const [x0, y0, x1, y1, n] = args;
      await touch('touchStart', [[x0, y0]]);
      for (let i = 1; i <= n; i++) { await touch('touchMove', [[x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]]); await sleep(16); }
      await touch('touchEnd', []);
    } else throw new Error('unknown cmd ' + cmd);
    console.log('ok', cmd);
  } catch (e) { console.error('ERR', e.message); process.exitCode = 1; }
  ws.close();
};
