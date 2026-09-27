// Real touch input through Chrome DevTools Protocol (Input.dispatchTouchEvent) against the page
// opened by agent-browser. Usage: node touch-drag.mjs <browser-ws-url> <mode: one|two>
const [wsUrl, mode = 'one'] = process.argv.slice(2);
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params }; if (sessionId) msg.sessionId = sessionId;
  pending.set(msg.id, { res, rej }); ws.send(JSON.stringify(msg));
});
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const page = targetInfos.find((t) => t.type === 'page' && t.url.includes('index.html'));
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId);
    const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)).result.value;
    const log = [];
    const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 8, radiusY: 8, force: 1 })) }, sessionId);
    const before = await evalJs('JSON.stringify(fluidDebug.snapshot().stats)');
    if (mode === 'one') {
      // single finger: bottom-to-top swipe in the middle of the screen
      await touch('touchStart', [[195, 620]]);
      for (let i = 1; i <= 12; i++) { await touch('touchMove', [[195 + 10 * Math.sin(i / 3), 620 - i * 30]]); await sleep(40); if (i === 6) log.push({ midDrag: await evalJs('JSON.stringify({pointers: fluidDebug.snapshot().pointers, hud: document.getElementById("hPtr").textContent, ring: document.getElementById("ring").className})') }); }
      await touch('touchEnd', []);
    } else {
      // two fingers moving in opposite directions (multi-touch)
      await touch('touchStart', [[100, 300], [290, 520]]);
      for (let i = 1; i <= 10; i++) { await touch('touchMove', [[100 + i * 18, 300], [290 - i * 18, 520]]); await sleep(40); if (i === 5) log.push({ midDrag: await evalJs('JSON.stringify({pointers: fluidDebug.snapshot().pointers, hud: document.getElementById("hPtr").textContent})') }); }
      await touch('touchEnd', []);
    }
    await sleep(600);
    const after = await evalJs('JSON.stringify({stats: fluidDebug.snapshot().stats, pointers: fluidDebug.snapshot().pointers})');
    console.log(JSON.stringify({ mode, before: JSON.parse(before), log, after: JSON.parse(after) }, null, 1));
  } catch (err) { console.error('touch test failed:', err.message); process.exitCode = 1; }
  ws.close();
};
