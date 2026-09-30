// Send raw CDP input events to the Logic Lab page inside the agent-browser Chromium.
// usage: node cdp.js <ws-url> '<json array of [method, params]>'
const [url, cmdsJson] = process.argv.slice(2);
const cmds = JSON.parse(cmdsJson);
const ws = new WebSocket(url); let id = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } };
ws.onopen = async () => {
  try {
    const { targetInfos } = await send('Target.getTargets');
    const t = targetInfos.find(t => t.type === 'page' && /index\.html/.test(t.url));
    const { sessionId } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    for (const [method, params, wait] of cmds) { await send(method, params, sessionId); if (wait) await new Promise(r => setTimeout(r, wait)); }
    console.log('sent', cmds.length);
  } catch (e) { console.error('ERR', e.message); }
  ws.close();
};
