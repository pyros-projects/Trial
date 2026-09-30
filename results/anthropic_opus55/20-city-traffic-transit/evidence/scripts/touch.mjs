// Native two-finger pinch + one-finger tap via CDP Input.dispatchTouchEvent (test harness, not part of the app)
const url = process.argv[2]; const mode = process.argv[3] || 'pinch';
const ws = new WebSocket(url); let id = 0; const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
ws.onopen = async () => {
  const t = await send('Target.getTargets'); const page = t.result.targetInfos.find(x => x.type === 'page' && x.url.includes('index.html'));
  const at = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true }); const sid = at.result.sessionId;
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sid);
  const ev = async (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i })) }, sid);
  const evalJs = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sid)).result.result.value;
  const before = await evalJs('JSON.stringify(window.__metroflow.R.cam)');
  if (mode === 'pinch') {
    const cx = 195, cy = 420; let d = 40;
    await ev('touchStart', [[cx - d, cy], [cx + d, cy]]);
    for (let k = 0; k < 12; k++) { d += 8; await ev('touchMove', [[cx - d, cy + k * 2], [cx + d, cy + k * 2]]); await new Promise(r => setTimeout(r, 16)); }
    await ev('touchEnd', []);
  } else if (mode === 'tap') {
    const [x, y] = [+process.argv[4], +process.argv[5]]; await ev('touchStart', [[x, y]]); await new Promise(r => setTimeout(r, 40)); await ev('touchEnd', []);
  } else if (mode === 'pan') {
    await ev('touchStart', [[150, 400]]); for (let k = 1; k <= 10; k++) { await ev('touchMove', [[150 + k * 10, 400 + k * 5]]); await new Promise(r => setTimeout(r, 16)); } await ev('touchEnd', []);
  }
  const after = await evalJs('JSON.stringify(window.__metroflow.R.cam)');
  console.log(JSON.stringify({ mode, before: JSON.parse(before), after: JSON.parse(after) }));
  ws.close(); process.exit(0);
};
