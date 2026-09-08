// tests/netcheck.mjs — HTTP delivery + strict network isolation + UI walk.
// The browser runs with no DNS and a dead proxy, so anything that tries to reach
// the internet fails loudly; the run asserts that nothing does.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { createServer } from 'node:net';

const ROOT = '/home/pyro/projects/naked/qwen-flash/03-modular-synth';
const OUT = `${ROOT}/evidence`;
const CHROME = process.env.CHROME || '/home/pyro/.agent-browser/browsers/chrome-152.0.7977.54/chrome';
const PORT = 9345;
const DL = '/tmp/modsyn-dl';

/* pick a free loopback port: a stale server from an earlier session on a fixed
   port would silently serve someone else's bytes */
function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

const results = [], notes = { requests: [], failed: [], pageErrors: [], console: [] };
let ws, mid = 0;
const pending = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++mid;
  const msg = { id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  pending.set(id, { res, rej, m: method });
  ws.send(JSON.stringify(msg));
});
function check(name, pass, info) {
  results.push({ name, pass: !!pass, info });
  console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '  — ' + JSON.stringify(info) : ''));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  rmSync(DL, { recursive: true, force: true });
  mkdirSync(DL, { recursive: true });

  /* ---- serve the folder over plain HTTP on a verified-free port ---- */
  const HTTP_PORT = await freePort();
  const server = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1', '-d', ROOT],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const wantBytes = readFileSync(`${ROOT}/index.html`).length;
  let served = 0;
  for (let i = 0; i < 20 && served !== wantBytes; i++) {
    await sleep(300);
    served = await fetch(`http://127.0.0.1:${HTTP_PORT}/index.html`, { proxy: '' })
      .then(r => r.arrayBuffer()).then(b => b.byteLength).catch(() => 0);
  }
  check('N0a local server really serves our index.html (not a stale port owner)',
    served === wantBytes, { served, wantBytes, port: HTTP_PORT });
  if (served !== wantBytes) { server.kill(); process.exit(1); }

  /* ---- browser: no DNS, dead proxy for everything but loopback ---- */
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/modsyn-net-profile',
    '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    /* No DNS for anything except loopback, and no proxy (the machine's proxy
       would otherwise swallow 127.0.0.1 and hand back someone else's bytes).
       Verified by the N0 probe: an external fetch fails, loopback works. */
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
    '--proxy-server=direct://',
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === 'page');
    } catch (e) { /* wait */ }
  }
  if (!target) { chrome.kill(); server.kill(); throw new Error('chrome did not start'); }
  await new Promise((res, rej) => {
    ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = res;
    ws.onerror = () => rej(new Error('ws error'));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id); pending.delete(m.id);
        if (m.error) p.rej(new Error(p.m + ': ' + m.error.message)); else p.res(m.result);
        return;
      }
      if (m.method === 'Network.requestWillBeSent') {
        notes.requests.push(m.params.request.url);
      }
      if (m.method === 'Network.loadingFailed') {
        notes.failed.push(`${m.params.type} ${m.params.errorText} :: ${(m.params.request || {}).url || ''}`);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        notes.pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        notes.console.push(m.params.args.map(a => a.value ?? a.description).join(' '));
      }
    };
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  const { targetId } = await send('Target.attachToTarget', { targetId: target.id, flatten: true });
  const sid = targetId;
  const S = (m, p) => send(m, p, sid);
  await S('Network.enable');
  await S('Page.enable');
  await S('Runtime.enable');
  await S('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  const ev = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: `(async function(){${expr}})()`, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const at = (sel, idx) => ev(`var e=${idx === undefined ? `document.querySelector('${sel}')` : `document.querySelectorAll('${sel}')[${idx}]`};
    if(!e) return null; var r=e.getBoundingClientRect();
    return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), w:Math.round(r.width), h:Math.round(r.height), tag:e.tagName};`);
  const click = async (x, y) => {
    await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0, clickCount: 0, pointerType: 'mouse' });
    await sleep(40);
    await S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    await sleep(50);
    await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
    await sleep(120);
  };
  const clickSel = async (sel) => { const b = await at(sel); if (b) await click(b.x, b.y); return b; };
  const key = async (code, k, vk) => {
    await S('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: vk, text: k });
    await sleep(40);
    await S('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk });
    await sleep(60);
  };

  /* sanity: the isolation actually works (external hosts must be unreachable) */
  const probe = await S('Runtime.evaluate', {
    expression: `fetch('https://example.com/').then(function(r){return 'REACHED '+r.status;}).catch(function(e){return 'blocked: '+String(e.message||e).slice(0,44);})`,
    returnByValue: true, awaitPromise: true
  });
  check('N0 network isolation is real (external fetch blocked)', String(probe.result.value).startsWith('blocked'), probe.result.value);
  /* ---- N1: load over HTTP ---- */
  notes.requests.length = 0; notes.failed.length = 0;
  await S('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.html` });
  await sleep(1800);
  const loaded = await ev(`return {title:document.title, scripts:document.scripts.length,
    bytes:document.scripts[0] ? document.scripts[0].textContent.length : 0,
    app:!!document.getElementById('app'), url:location.href};`);
  const hostUsed = [...new Set(notes.requests.map(u => { try { return new URL(u).host; } catch (e) { return u; } }))];
  check('N1 page served over http:// and self-contained (1 inline script, only host is loopback)',
    loaded.app && loaded.scripts === 1 && loaded.bytes > 140000 && hostUsed.length === 1 && hostUsed[0] === `127.0.0.1:${HTTP_PORT}`,
    { url: loaded.url, bytes: loaded.bytes, hosts: hostUsed, reqs: notes.requests.length });
  const failedExternal = notes.failed.filter(f => !/127\.0\.0\.1|localhost/.test(f));
  check('N2 no failed external requests while loading', failedExternal.length === 0, failedExternal.slice(0, 4));

  /* ---- N3: boot audio with a real click over HTTP ---- */
  const gb = await at('#btn-enable');
  await click(gb.x, gb.y);
  await sleep(2800);
  const st = await ev(`return window.MODSYN.api.stats();`);
  check('N3 audio + demo loop runs over http:// (not just file://)', st.ctx === 'running' && st.playing && st.rms > 0.02, st);

  /* ---- N4: every song preset, switched with real keyboard input ---- */
  await ev(`document.getElementById('sel-song').focus(); return document.getElementById('sel-song').value;`);
  const presetResults = [];
  for (let i = 0; i < 4; i++) {
    await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKey: 40, text: '' });
    await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKey: 40 });
    await sleep(1000);
    const s = await ev(`var a=window.MODSYN.app; return {song:document.getElementById('sel-song').value, name:a.proj.name, notes:a.proj.tracks.reduce(function(n,t){return n+(t.notes?t.notes.length:0);},0), playing:a.playing, rms:+window.MODSYN.api.stats().rms.toFixed(3)};`);
    presetResults.push(s);
  }
  const distinct = new Set(presetResults.map(p => p.song)).size;
  check('N4 song presets switch and keep playing', distinct >= 3 && presetResults.every(p => p.playing),
    presetResults.map(p => ({ song: p.song, notes: p.notes, rms: p.rms })));

  /* ---- N5: randomise + clear ---- */
  await clickSel('#btn-rnd-song');
  await sleep(1000);
  const rnd = await ev(`var a=window.MODSYN.app;
    function cells(){ return a.proj.tracks.reduce(function(n,t){ return n + (Array.isArray(t.steps) ? t.steps.slice(0, a.proj.steps).filter(function(v){return v>0;}).length : 0); }, 0); }
    return {notes:a.proj.tracks.reduce(function(n,t){return n+(t.notes?t.notes.length:0);},0),
      on:cells(), playing:a.playing, rms:+window.MODSYN.api.stats().rms.toFixed(3)};`);
  const arrs = await ev(`var a=window.MODSYN.app; return a.proj.tracks.filter(function(t){return t.kind==='perc';})
    .map(function(t){ return t.id+':'+t.steps.slice(0,a.proj.steps).join(''); });`);
  check('N5 randomise song fills patterns and keeps playing', rnd.on > 8 && rnd.playing, { ...rnd, arrs });
  await clickSel('#btn-clear-song');
  await sleep(800);
  const cleared = await ev(`var a=window.MODSYN.app;
    function cells(){ return a.proj.tracks.reduce(function(n,t){ return n + (Array.isArray(t.steps) ? t.steps.slice(0, a.proj.steps).filter(function(v){return v>0;}).length : 0); }, 0); }
    return {notes:a.proj.tracks.reduce(function(n,t){return n+(t.notes?t.notes.length:0);},0), on:cells()};`);
  check('N6 clear song empties the arrangement', cleared.notes === 0 && cleared.on === 0, cleared);

  /* ---- N7: restore a known song, then play pads + keyboard ---- */
  await ev(`window.MODSYN.api.applySong(window.MODSYN.songs[0]); return 1;`);
  await sleep(200);
  const resetOk = await ev(`return window.MODSYN.app.proj.tracks.reduce(function(n,t){return n+(t.notes?t.notes.length:0);},0);`);
  if (!resetOk) { check('N7a song reset via api restored notes', false, { notes: resetOk }); }
  await sleep(700);
  const pad = await at('#padrow .pad', 2);
  const kb = await at('#keyboard .wkey', 6);
  await sleep(300);
  /* pads and the on-screen keyboard are hold-to-play: the note is released with
     the pointer, so sample while the button is still down */
  const hold = async (x, y, ms) => {
    await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0, clickCount: 0, pointerType: 'mouse' });
    await sleep(60);
    await S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    await sleep(ms);
    const during = await ev(`var a=window.MODSYN.app; return {n:a.E.active.length, play:a.E.active.filter(function(v){return v.chan==='key';}).length};`);
    await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
    await sleep(600);
    const after = await ev(`var a=window.MODSYN.app; return {n:a.E.active.length, play:a.E.active.filter(function(v){return v.chan==='key';}).length};`);
    return { during, after };
  };
  const padHold = await hold(pad.x, pad.y, 200);
  await sleep(400);
  const kbHold = await hold(kb.x, kb.y, 300);
  const played = { padDuring: padHold.during.play, padAfter: padHold.after.play, kbDuring: kbHold.during.play, kbAfter: kbHold.after.play };
  check('N7 pad + on-screen keyboard play while held and release cleanly',
    !!pad && !!kb && padHold.during.play > 0 && kbHold.during.play > 0 && kbHold.after.play === 0,
    { pad: !!pad, kb: !!kb, ...played });

  /* ---- N8: WAV render buttons write real files through the download path ---- */
  await clickSel('#btn-wav1');
  await sleep(4000);
  const files = readdirSync(DL).filter(f => f.endsWith('.wav') || f.endsWith('.json'));
  const wav = files.find(f => f.endsWith('.wav'));
  let wavInfo = null;
  if (wav) {
    const buf = readFileSync(`${DL}/${wav}`);
    wavInfo = { name: wav, bytes: buf.length, riff: buf.slice(0, 4).toString('ascii'), fmt: buf.slice(8, 12).toString('ascii'), secs: +((buf.length - 44) / (44100 * 4)).toFixed(2) };
  }
  check('N8 WAV export writes a valid stereo file', !!wav && wavInfo && wavInfo.riff === 'RIFF' && wavInfo.fmt === 'WAVE' && wavInfo.bytes > 200000, wavInfo);
  await clickSel('#btn-save');
  await sleep(1500);
  const json = readdirSync(DL).find(f => f.endsWith('.json'));
  check('N9 project JSON export writes a file', !!json, { files: readdirSync(DL) });

  /* ---- N10: end-to-end isolation + stability ---- */
  const hosts = [...new Set(notes.requests.map(u => { try { return new URL(u).host; } catch (e) { return u; } }))];
  check('N10 no external host contacted during the whole session', hosts.every(h => h === `127.0.0.1:${HTTP_PORT}`), hosts);
  check('N11 no uncaught page errors during the whole session', notes.pageErrors.length === 0, notes.pageErrors.slice(0, 3));
  const finalStats = await ev(`return window.MODSYN.api.stats();`);
  check('N12 still playing with clean internals at the end', finalStats.playing && finalStats.errors.length === 0 && finalStats.dropped === 0, finalStats);

  writeFileSync(`${OUT}/netcheck-report.json`, JSON.stringify({ results, notes: { hosts: [...new Set(notes.requests)], failed: notes.failed, pageErrors: notes.pageErrors, console: notes.console } }, null, 1));
  const fails = results.filter(r => !r.pass);
  console.log('\n== ' + (results.length - fails.length) + '/' + results.length + ' net checks passed ==');
  if (fails.length) console.log('FAILED:\n' + fails.map(f => ' - ' + f.name + ' ' + JSON.stringify(f.info)).join('\n'));
  try { ws.close(); } catch (e) { }
  chrome.kill(); server.kill();
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('NETCHECK ERROR', e); try { ws && ws.close(); } catch (x) { } process.exit(2); });
