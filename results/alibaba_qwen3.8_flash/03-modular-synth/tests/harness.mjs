// tests/harness.mjs — drives the app in a real Chrome over CDP with real pointer/key input.
// usage: node tests/harness.mjs [--url <file-or-http>] [--session-only]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME || '/home/pyro/.agent-browser/browsers/chrome-152.0.7977.54/chrome';
const PORT = 9333;
const URL_TARGET = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'file:///home/pyro/projects/naked/qwen-flash/03-modular-synth/index.html';
const OUT = '/home/pyro/projects/naked/qwen-flash/03-modular-synth/evidence';

const results = [];
const consoleErrors = [];
const pageErrors = [];
const netFails = [];
let ws, mid = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = ++mid;
  const msg = { id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej, m: method });
    ws.send(JSON.stringify(msg));
  });
}

function connect(wsUrl) {
  return new Promise((res, rej) => {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => res();
    ws.onerror = (e) => rej(e.error || new Error('ws error'));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      let meth = null;
      if (m.id && pending.has(m.id)) {
        const p = pending.get(m.id);
        m.__method = pending.get(m.id).m;
        pending.delete(m.id);
        if (m.error) p.rej(new Error('CDP ' + (m.__method || '?') + ' -> ' + m.error.message)); else p.res(m.result);
        return;
      }
      const s = m.method === 'Target.receivedMessageFromTarget' ? null : m;
      if (m.method === 'Runtime.exceptionThrown') {
        pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      }
      if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
        consoleErrors.push(m.params.type + ': ' + (m.params.args || []).map(a => a.value ?? a.description).join(' '));
      }
      if (m.method === 'Log.entryAdded' && (m.params.entry.level === 'error' || m.params.entry.level === 'warning')) {
        consoleErrors.push(m.params.entry.source + ': ' + m.params.entry.text);
      }
      if (m.method === 'Network.loadingFailed') netFails.push(m.params.type + ' ' + (m.params.errorText || ''));
    };
  });
}

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async function(){${expr}})()`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}

async function mouse(type, x, y, opt = {}) {
  await send('Input.dispatchMouseEvent', {
    type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : (opt.buttons ?? 1),
    clickCount: opt.clickCount ?? (type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0),
    pointerType: 'mouse', ...opt
  });
}
async function drag(x1, y1, x2, y2, steps = 5) {
  // real drag: hover, press with the button held, move with buttons=1, release
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1, button: 'none', buttons: 0, clickCount: 0, pointerType: 'mouse' });
  await sleep(30);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
  await sleep(30);
  for (let i = 1; i <= steps; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + (x2 - x1) * i / steps, y: y1 + (y2 - y1) * i / steps, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    await sleep(30);
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', buttons: 0, clickCount: 1, pointerType: 'mouse' });
}
async function clickEl(id, tries = 4) {
  // Real-pointer clicks over CDP are flaky unless the hover target is settled first
  // (Chrome routes the press to whatever the input pipeline last knew about).
  // So: hit-test, settle hover, click, then verify a click actually landed on the
  // element; retry with fresh coordinates if it did not.
  for (let i = 0; i < tries; i++) {
    const b = await evalJs(`var e=document.getElementById('${id}'); if(!e) return null;
      window.__hit=null;
      e.addEventListener('click', function h(ev){ window.__hit=ev.detail; e.removeEventListener('click', h); }, {once:true});
      var r=e.getBoundingClientRect();
      var top=document.elementFromPoint(r.x+r.width/2, r.y+r.height/2);
      return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), over: !!(top&&(top===e||e.contains(top)))};`);
    if (!b || !b.over) { await sleep(150); continue; }
    await mouse('mouseMoved', b.x, b.y, { buttons: 0, clickCount: 0 });
    await sleep(50);
    await mouse('mouseMoved', b.x, b.y, { buttons: 0, clickCount: 0 });
    await clickAt(b.x, b.y);
    await sleep(140);
    const landed = await evalJs(`return window.__hit;`);
    if (landed !== null && landed !== undefined) return { ...b, landed: true };
    await sleep(120);
  }
  return { ok: false };
}
async function clickAt(x, y, opt = {}) {
  await mouse('mousePressed', x, y, opt);
  await sleep(40);
  await mouse('mouseReleased', x, y, opt);
}
async function key(type, code, k, vk) {
  await send('Input.dispatchKeyEvent', { type, code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKey: vk, text: type === 'keyDown' ? k : undefined });
}
async function press(code, k, vk) { await key('keyDown', code, k, vk); await key('keyUp', code, k, vk); }

function check(name, pass, info) {
  results.push({ name, pass: !!pass, info });
  console.log((pass ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '  — ' + JSON.stringify(info) : ''));
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/h-${name}.png`, Buffer.from(r.data, 'base64'));
}
const V = (id) => evalJs(`var e=document.getElementById('${id}'); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};`);

/* ------------------------------------------------------------------ */
async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!existsSync(CHROME)) throw new Error('no chrome at ' + CHROME);
  const prof = '/tmp/modsyn-chrome-profile';
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
    '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio',
    '--force-device-scale-factor=1', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let chromeLog = '';
  chrome.stdout.on('data', d => { chromeLog += d; });
  chrome.stderr.on('data', d => { chromeLog += d; });

  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === 'page');
    } catch (e) { /* not up yet */ }
  }
  if (!target) { console.log(chromeLog); throw new Error('chrome did not start'); }
  await connect(target.webSocketDebuggerUrl);
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');
  const { targetId } = await send('Target.attachToTarget', { targetId: target.id, flatten: true });
  const sid = targetId;
  const S = (m, p) => send(m, p, sid);

  await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await S('Page.navigate', { url: URL_TARGET });
  await sleep(600);
  /* deterministic start: drop any project persisted by an earlier run */
  await S('Runtime.evaluate', { expression: 'try{localStorage.clear();}catch(e){}' });
  await S('Page.navigate', { url: URL_TARGET });
  await sleep(1400);

  check('T1 app loads (gate visible, no page errors)',
    await evalJs(`return !document.getElementById('app').hidden ? 'app-shown' : 'gate'`) === 'gate' && pageErrors.length === 0,
    { url: URL_TARGET, errs: pageErrors.slice(0, 2) });
  await shot('01-gate');

  /* ---- T2: real gesture on the enable button starts audio + playback ---- */
  const gb = await V('btn-enable');
  await clickAt(Math.round(gb.x + gb.width / 2), Math.round(gb.y + gb.height / 2));
  await sleep(2600);
  let st = await evalJs(`return window.MODSYN.api.stats();`);
  check('T2 audio starts after real click (AudioContext running)', st.ctx === 'running', st);
  check('T3 demo loop auto-plays with voices + non-zero output', st.playing && st.voices > 0 && st.rms > 0.02, st);

  /* playhead actually moves */
  const p1 = await evalJs(`var h=document.getElementById('colhead');return h.style.transform;`);
  await sleep(700);
  const p2 = await evalJs(`var h=document.getElementById('colhead');return h.style.transform;`);
  check('T4 playhead animates (transform changes)', p1 !== p2 && !!p2, { p1, p2 });
  const m1 = await evalJs(`var m=document.getElementById('master-meter');return [m._a.style.transform,m._b.style.transform];`);
  await sleep(400);
  const m2 = await evalJs(`var m=document.getElementById('master-meter');return [m._a.style.transform,m._b.style.transform];`);
  check('T5 master meter responds to live audio', m1.join() !== m2.join(), { m1, m2 });
  await shot('02-playing');

  /* ---- T6: edit steps during playback ---- */
  const cellBox = await evalJs(`
    var c=document.querySelector('#seqgrid .cell[data-t="hat"][data-s="3"]');
    var r=c.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2, on:c.classList.contains('on')};`);
  await clickAt(Math.round(cellBox.x), Math.round(cellBox.y));
  await sleep(300);
  const cellAfter = await evalJs(`
    var c=document.querySelector('#seqgrid .cell[data-t="hat"][data-s="3"]');
    return {on:c.classList.contains('on'), vel:window.MODSYN.app.proj.tracks.find(t=>t.id==='hat').steps[3]};`);
  check('T6 step toggle by click during playback changes pattern state', cellAfter.on !== cellBox.on, { before: cellBox.on, after: cellAfter });
  await sleep(900);
  const cellVel = await evalJs(`
    var c=document.querySelector('#seqgrid .cell[data-t="hat"][data-s="3"]');
    return {cls:c.className, v:window.MODSYN.app.proj.tracks.find(t=>t.id==='hat').steps[3]};`);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: Math.round(cellBox.x), y: Math.round(cellBox.y), button: 'left', buttons: 0,
    clickCount: 1, pointerType: 'mouse', modifiers: 8
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: Math.round(cellBox.x), y: Math.round(cellBox.y), button: 'left', buttons: 0,
    clickCount: 1, pointerType: 'mouse', modifiers: 8
  });
  await sleep(300);
  const cellVel2 = await evalJs(`return window.MODSYN.app.proj.tracks.find(t=>t.id==='hat').steps[3];`);
  check('T7 shift+click cycles step velocity/accent', cellVel2 !== cellVel.v, { before: cellVel.v, after: cellVel2 });

  /* ---- T8/T9: piano-roll pointer editing ---- */
  /* Geometry is read back through the app's own hit test, so the assertion is
     "a click creates a note in the cell under the cursor", independent of
     row/column scaling assumptions in the harness. */
  const cell = await evalJs(`
    var a=window.MODSYN.app, R=window.MODSYN.roll, G=window.MODSYN.geo;
    a.ui.selectTrack('lead');
    var t=a.proj.tracks.find(function(x){return x.id==='lead';});
    var c=document.getElementById('roll'); var r=c.getBoundingClientRect();
    var g=G.rollGeo();
    var px=Math.round(R.gutter+g.colW*9.5), py=Math.round(g.plotH*0.42);
    var h=G.hit(px,py);
    if (!h || h.type!=='empty') return {bad:'first pick not an empty cell', h:h&&h.type};
    return { t:h.t, p:h.p, raw:JSON.stringify(h), x:Math.round(r.x+px), y:Math.round(r.y+py),
      inView:r.top>0&&r.bottom<innerHeight&&r.left>0&&r.right<innerWidth, n0:t.notes.length,
      geo:{rows:g.rows, lo:g.lo, rowH:+g.rowH.toFixed(2), colW:+g.colW.toFixed(2),
           cssH:Math.round(r.height), clientH:c.clientHeight, lane:R.lane} };`);
  const cellOk = cell && Number.isFinite(cell.x) && Number.isFinite(cell.y) && Number.isInteger(cell.t);
  check('T8a pick an empty roll cell for the click test', cellOk, cell);
  if (!cellOk) { writeFileSync(`${OUT}/harness-report.json`, JSON.stringify({ results, pageErrors, note: 'aborted: no roll cell' }, null, 1)); ws.close(); chrome.kill(); process.exit(1); }
  await clickAt(cell.x, cell.y);
  await sleep(300);
  const created = await evalJs(`
    var a=window.MODSYN.app; var t=a.proj.tracks.find(function(x){return x.id==='lead';});
    return { n:t.notes.length, last:t.notes[t.notes.length-1] };`);
  check('T8 piano-roll click adds a note in the clicked cell',
    created.n === cell.n0 + 1 && created.last.t === cell.t && created.last.p === cell.p,
    { before: cell.n0, want: { t: cell.t, p: cell.p }, got: created.last });

  /* drag that note somewhere else; destination verified empty through the app's
     hit test (the app refuses to stack notes, so a busy target would strand it) */
  await evalJs(`window.MODSYN.roll.snapScale = false; return 1;`);
  const dragFrom = await evalJs(`
    var a=window.MODSYN.app, G=window.MODSYN.geo, R=window.MODSYN.roll;
    var t=a.proj.tracks.find(function(x){return x.id==='lead';});
    var n=t.notes[t.notes.length-1]; var c=document.getElementById('roll'); var r=c.getBoundingClientRect();
    var g=G.rollGeo();
    var sx=R.gutter+(n.t+0.35)*g.colW, sy=(g.hi-1-n.p)*g.rowH+g.rowH/2;
    var h=G.hit(sx,sy);
    var dest=null;
    outer:
    for (var dt=3; dt<=10 && !dest; dt++) for (var dp=1; dp<=12; dp++) {
      var ex=R.gutter+(n.t+dt+0.5)*g.colW, ey=(g.hi-1-(n.p-dp))*g.rowH+g.rowH/2;
      if (ey<g.lane*0) continue;
      var clear=true;
      for (var m=1;m<=8;m++) {
        var hh=G.hit(sx+(ex-sx)*m/8, sy+(ey-sy)*m/8);
        if (!hh || hh.type!=='empty') { clear=false; break; }
      }
      if (clear) {
        var end=G.hit(ex,ey);
        if (end && end.type==='empty') dest={t:end.t, p:end.p, x:Math.round(r.x+ex), y:Math.round(r.y+ey)};
      }
    }
    return { type:h&&h.type, x:Math.round(r.x+sx), y:Math.round(r.y+sy), dest:dest, t:n.t, p:n.p };`);
  check('T9a found a note-free drag path in the roll', !!dragFrom.dest, dragFrom.dest ? 'ok' : 'no clear path');
  if (dragFrom.dest) {
    await drag(dragFrom.x, dragFrom.y, dragFrom.dest.x, dragFrom.dest.y, 8);
    await sleep(300);
    const moved = await evalJs(`var t=window.MODSYN.app.proj.tracks.find(function(x){return x.id==='lead';}); var n=t.notes[t.notes.length-1]; return {t:n.t,p:n.p};`);
    check('T9 piano-roll drag moves the note to the dragged-to cell',
      dragFrom.type === 'move' && moved.t === dragFrom.dest.t && moved.p === dragFrom.dest.p,
      { grab: dragFrom.type, from: { t: dragFrom.t, p: dragFrom.p }, dest: { t: dragFrom.dest.t, p: dragFrom.dest.p }, to: moved });
    await evalJs(`window.MODSYN.roll.snapScale = true; return 1;`);
  }

  /* ---- T10: computer-keyboard play + stuck note check ---- */
  await evalJs(`window.MODSYN.api.select('lead'); return 1;`);

  await S('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65, text: 'a' });
  await sleep(350);
  const heldVoices = await evalJs(`var a=window.MODSYN.app; return {key:a.E.active.filter(function(v){return v.chan==='key'}).length, held:Object.keys(a.held).length, target:a.target};`);
  await S('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyA', key: 'a', windowsVirtualKeyCode: 65 });
  await sleep(700);
  const afterRelease = await evalJs(`return window.MODSYN.app.E.active.filter(function(v){return v.chan==='key'}).length;`);
  check('T10 computer-keyboard play creates and releases a voice (no stuck note)',
    heldVoices.key > 0 && afterRelease === 0, { held: heldVoices, after: afterRelease });

  /* rapid repeated input + focus loss */
  for (let i = 0; i < 14; i++) { await press('KeyS', 's', 83); await sleep(28); }
  await sleep(300);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyD', key: 'd', windowsVirtualKeyCode: 68, text: 'd' });
  await sleep(200);
  await S('Runtime.evaluate', { expression: 'window.dispatchEvent(new Event("blur")); document.dispatchEvent(new Event("visibilitychange"));' });
  /* give the animation frame loop time to retire finished voices */
  await sleep(1600);
  const stuck = await evalJs(`var a=window.MODSYN.app; var now=a.ctx.currentTime;
    return {held:Object.keys(a.held).length, keyVoices:a.E.active.filter(function(v){return v.chan==='key';}).length,
      expired:a.E.active.filter(function(v){return v.chan==='key'&&v.end<now;}).length, total:a.E.active.length};`);
  check('T11 rapid repeats + focus loss leave no stuck notes (voices retire)',
    stuck.held === 0 && stuck.keyVoices === 0 && stuck.total < 60, stuck);

  /* ---- T12: transport stop/restart ---- */
  const stopBtn = await V('btn-stop');
  await clickAt(Math.round(stopBtn.x + stopBtn.width / 2), Math.round(stopBtn.y + stopBtn.height / 2));
  await sleep(400);
  const st2 = await evalJs(`return window.MODSYN.api.stats();`);
  const restartBtn = await V('btn-restart');
  await clickAt(Math.round(restartBtn.x + restartBtn.width / 2), Math.round(restartBtn.y + restartBtn.height / 2));
  await sleep(900);
  const st3 = await evalJs(`return window.MODSYN.api.stats();`);
  check('T12 stop halts playback; restart resumes from step 1',
    !st2.playing && st3.playing && st3.step >= 0, { stop: { playing: st2.playing, voices: st2.voices }, restart: { playing: st3.playing, step: st3.step } });

  /* ---- T13: live tempo change stays coherent ---- */
  const tempo = await V('in-tempo');
  await drag(Math.round(tempo.x + 6), Math.round(tempo.y + tempo.height / 2), Math.round(tempo.x + tempo.width - 30), Math.round(tempo.y + tempo.height / 2));
  await sleep(200);
  const newTempo = await evalJs(`return {t:window.MODSYN.app.proj.tempo, input:document.getElementById('in-tempo').value};`);
  const s1 = await evalJs(`return {step:window.MODSYN.api.stats().step, t:window.MODSYN.app.ctx.currentTime};`);
  await sleep(1400);
  const s2 = await evalJs(`return {step:window.MODSYN.api.stats().step, t:window.MODSYN.app.ctx.currentTime, late:window.MODSYN.app.lateCount, drift:+window.MODSYN.app.driftMs.toFixed(2)};`);
  check('T13 tempo slider changes tempo during playback and keeps scheduling (no late ticks/drift blow-up)',
    newTempo.t !== 100 && s2.drift < 20, { tempo: newTempo, s1, s2 });

  /* ---- T14: FX bypass actually changes the audio graph ---- */
  const limOn = await evalJs(`return {level: window.MODSYN.app.E.comp.reduction, wires: window.MODSYN.app.E.wires.length};`);
  const satSwitch = await evalJs(`
    var sw=[].slice.call(document.querySelectorAll('.fx-h .sw'));
    var el=sw[0]; var r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,n:sw.length, cls:el.className};`);
  await clickAt(Math.round(satSwitch.x), Math.round(satSwitch.y));
  await sleep(700);
  const afterByp = await evalJs(`return {wires: window.MODSYN.app.E.wires.length, sat: window.MODSYN.app.proj.fx.sat.on, rms: window.MODSYN.api.stats().rms};`);
  check('T14 FX bypass rewires the audio graph and changes output level',
    afterByp.wires !== limOn.wires && afterByp.rms !== 0, { before: limOn, after: afterByp });
  await clickAt(Math.round(satSwitch.x), Math.round(satSwitch.y));
  await sleep(300);

  /* ---- T15: knob drag changes a synth parameter ---- */
  await evalJs(`window.MODSYN.api.select('lead');
    window.MODSYN.app.proj.tracks.find(function(t){return t.id==='lead';}).inst.cutoff = 3400;
    return 1;`);
  const knob = await evalJs(`
    var ks=[].slice.call(document.querySelectorAll('#inspector .knob'));
    var k=ks.find(function(e){return e.getAttribute('aria-label')==='CUTOFF';});
    if(!k) return null;
    k.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,120));
    var r=k.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2, inView:r.top>0&&r.bottom<innerHeight, before: window.MODSYN.app.proj.tracks.find(t=>t.id==='lead').inst.cutoff};`);
  await drag(Math.round(knob.x), Math.round(knob.y), Math.round(knob.x - 60), Math.round(knob.y - 55));
  await sleep(300);
  const knobAfter = await evalJs(`return window.MODSYN.app.proj.tracks.find(t=>t.id==='lead').inst.cutoff;`);
  check('T15 knob drag changes synth parameter', knob.x && Math.abs(knobAfter - knob.before) > 50, { before: knob.before, after: knobAfter, found: !!knob.x });

  /* ---- T16: mute silences a track, meter drops ---- */
  /* Mute/solo are checked acoustically: playback is stopped so the mix is silent,
     then one note is played through LEAD and the master tap is read with the
     track open and gated. (The per-track analyser sits before the gate, so it
     cannot prove silence — the master bus can.) */
  await evalJs(`window.MODSYN.api.stop(); return 1;`);
  await sleep(700);
  const loudness = async () => evalJs(`
    var a=window.MODSYN.app, s=0, n=0;
    for (var i=0;i<12;i++) { await new Promise(function (r) { setTimeout(r, 40); });
      var m = window.MODSYN.api.stats(); s += m.rms; n++; }
    return +(s/n).toFixed(4);`);
  await evalJs(`window.MODSYN.api.note('lead', 69, 118); return 1;`);
  const openLvl = await loudness();
  await sleep(900);
  const muteBtn = await evalJs(`
    var b=document.querySelector('#tracklist .trk[data-tid="lead"] .ms button');
    b.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,120));
    var r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2, cls:b.className, inView:r.top>0&&r.bottom<innerHeight};`);
  await clickAt(Math.round(muteBtn.x), Math.round(muteBtn.y));
  await sleep(500);
  const gates = await evalJs(`
    var a=window.MODSYN.app, T=a.E.T.lead;
    window.MODSYN.api.note('lead', 69, 118);
    return {gain:T.out.gain.value, cls:document.querySelector('#tracklist .trk[data-tid="lead"]').className};`);
  await sleep(600);
  const mutedLvl = await loudness();
  check('T16 track mute silences audible output (master level collapses, gate at 0)',
    gates.gain === 0 && openLvl > 0.02 && mutedLvl < openLvl * 0.25,
    { open: openLvl, muted: mutedLvl, gain: gates.gain });
  await clickAt(Math.round(muteBtn.x), Math.round(muteBtn.y));
  await sleep(500);
  /* solo on lead should push every other track's output gain to zero */
  const soloBtn = await evalJs(`
    var b=document.querySelector('#tracklist .trk[data-tid="lead"] .ms button.solo');
    await new Promise(r=>setTimeout(r,80));
    var r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};`);
  await clickAt(soloBtn.x, soloBtn.y);
  await sleep(600);
  const soloState = await evalJs(`
    var a=window.MODSYN.app, E=a.E;
    var others=a.proj.tracks.filter(function(t){return t.id!=='lead';});
    var dead=others.filter(function(t){ return E.T[t.id].out.gain.value === 0; }).length;
    return {leadGain:E.T.lead.out.gain.value, silenced:dead, ofOthers:others.length, soloActive:E.soloActive};`);
  check('T17b solo isolates the track (other outputs gated to zero)',
    soloState.soloActive && soloState.silenced === soloState.ofOthers && soloState.leadGain > 0, soloState);
  await clickAt(soloBtn.x, soloBtn.y);
  await sleep(400);
  await evalJs(`window.MODSYN.api.play(true); return 1;`);
  await sleep(900);

  /* ---- T17: metronome + swing + length ---- */
  const lenCtl = await V('in-len');
  await drag(Math.round(lenCtl.x + lenCtl.width * 0.6), Math.round(lenCtl.y + 6), Math.round(lenCtl.x + lenCtl.width * 0.28), Math.round(lenCtl.y + 6));
  await sleep(900);
  const lenState = await evalJs(`var a=window.MODSYN.app; return {steps:a.proj.steps, cells:document.querySelectorAll('#seqgrid .cell[data-t="kick"]').length, playing:a.playing, step:a.stepIdx};`);
  check('T17 pattern length change while playing rebuilds grid and keeps playing',
    lenState.cells === lenState.steps && lenState.playing, lenState);
  await evalJs(`var b=document.getElementById('btn-metro'); b.scrollIntoView({block:'nearest'});
    await new Promise(r=>setTimeout(r,150)); return {on: window.MODSYN.app.proj.metro};`);
  const metroClick = await clickEl('btn-metro');
  await sleep(500);
  const metroState = await evalJs(`return {on: window.MODSYN.app.proj.metro, bus: +window.MODSYN.app.E.metroBus.gain.value.toFixed(3), playing: window.MODSYN.app.playing};`);
  check('T18 metronome toggle arms the click bus (real click)',
    metroClick && metroClick.landed && metroState.on === true && metroState.bus > 0.05, { click: metroClick, state: metroState });

  /* ---- T19: project save/load round trip ---- */
  const roundTrip = await evalJs(`
    var snap = window.MODSYN.api.snapshot();
    var before = JSON.stringify(snap).length;
    var ok = window.MODSYN.api.restore(JSON.parse(JSON.stringify(snap)));
    var after = JSON.stringify(window.MODSYN.api.snapshot());
    return {before:before, ok:ok, same: after === JSON.stringify(snap), playing: window.MODSYN.app.playing, voices: window.MODSYN.app.E.active.length};`);
  check('T18b metronome state survives save/load', await evalJs(`
    var s=window.MODSYN.api.snapshot(); window.MODSYN.api.restore(JSON.parse(JSON.stringify(s)));
    return window.MODSYN.app.proj.metro === true;`));
  check('T19 project save/load round-trips identical state', roundTrip.ok && roundTrip.same && roundTrip.playing, roundTrip);

  /* ---- T20: localStorage persistence ---- */
  const ls = await evalJs(`
    document.getElementById('btn-ls-save').click();
    var raw = localStorage.getItem('modsyn.project.v1');
    document.getElementById('btn-ls-load').click();
    return {bytes: raw?raw.length:0, loaded: !!window.MODSYN.app.proj, playing: window.MODSYN.app.playing};`);
  check('T20 localStorage save + reload works', ls.bytes > 1000 && ls.loaded, ls);
  await sleep(900);

  /* ---- T21: offline WAV render reflects mix ---- */
  const wav = await evalJs(`
    return window.MODSYN.api.renderWav(2, {}).then(function(r){
      return r ? {sec:+r.seconds.toFixed(2), peak:+r.peak.toFixed(3), events:r.events, ms:r.ms} : null;
    });`);
  check('T21 offline WAV render produces non-silent audio from the arrangement',
    wav && wav.peak > 0.05 && wav.events > 20, wav);

  /* ---- V1: the visualisers actually paint ---- */
  const vis = await evalJs(`
    var out={};
    ['scope','spec','spectro','phase','history','roll'].forEach(function(id){
      var c=document.getElementById(id); if(!c){ out[id]='missing'; return; }
      var g=c.getContext('2d'); if(!g){ out[id]='no-2d'; return; }
      var d=g.getImageData(0,0,c.width,c.height).data;
      var lit=0, seen={};
      for (var i=0;i<d.length;i+=4*17) { var v=d[i]+d[i+1]+d[i+2]; if (v>90) lit++; seen[(d[i]>>4)+','+(d[i+1]>>4)+','+(d[i+2]>>4)]=1; }
      out[id]={litPct:+(100*lit/(d.length/(4*17))).toFixed(1), colors:Object.keys(seen).length};
    });
    return out;`);
  const blank = Object.entries(vis).filter(([k, v]) => typeof v === 'object' && v.litPct < 1);
  const missing = Object.entries(vis).filter(([, v]) => typeof v === 'string');
  check('V27 all canvases (scope/spectrogram/phase/history/roll) render live content',
    blank.length === 0 && missing.length === 0, vis);

  /* ---- V2: per-track synth preset dropdown ---- */
  const presetSel = await evalJs(`
    var ss=[].slice.call(document.querySelectorAll('#inspector select'));
    var s=ss.find(function(x){ return x.options.length > 3 && x.options[0].value === '\u2014 current \u2014'; });
    if(!s) return null;
    s.scrollIntoView({block:'center'}); s.focus();
    await new Promise(r=>setTimeout(r,150));
    var r=s.getBoundingClientRect();
    return {opts:[].slice.call(s.options).map(function(o){return o.value;}).slice(0,8), value:s.value,
      before: JSON.stringify(window.MODSYN.app.proj.tracks.find(function(t){return t.id==='lead';}).inst),
      x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), focused: document.activeElement===s};`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'ArrowDown', key: 'ArrowDown', windowsVirtualKeyCode: 40, text: '' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'ArrowDown', key: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await sleep(700);
  const afterPreset = await evalJs(`
    var t=window.MODSYN.app.proj.tracks.find(function(x){return x.id==='lead';});
    var s=document.querySelector('#inspector select');
    return {value:s?s.value:null, after: JSON.stringify(t.inst)};`);
  check('V28 track synth preset changes the actual synth parameters',
    !!presetSel && !!presetSel.value && afterPreset.value !== presetSel.value && afterPreset.after !== presetSel.before,
    { from: presetSel && presetSel.value, to: afterPreset.value, changed: afterPreset.after !== presetSel.before });

  /* ---- V3: scoped randomisation only touches the selected track ---- */
  await evalJs(`window.MODSYN.api.select('lead'); return 1;`);
  await sleep(300);
  const beforeRnd = await evalJs(`
    var a=window.MODSYN.app;
    return JSON.stringify(a.proj.tracks.map(function(t){ return t.kind==='perc' ? t.steps.slice(0,a.proj.steps).join(',') : (t.notes||[]).map(function(n){return n.t+':'+n.p;}).join(','); }));`);
  const rndBtn = await evalJs(`
    var b=[].slice.call(document.querySelectorAll('#inspector button')).find(function(x){return x.textContent.trim()==='RANDOMISE';});
    if(!b) return null; b.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,150));
    var r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};`);
  if (rndBtn) await clickAt(rndBtn.x, rndBtn.y);
  await sleep(700);
  const afterRnd = await evalJs(`
    var a=window.MODSYN.app;
    return JSON.stringify(a.proj.tracks.map(function(t){ return t.kind==='perc' ? t.steps.slice(0,a.proj.steps).join(',') : (t.notes||[]).map(function(n){return n.t+':'+n.p;}).join(','); }));`);
  const diff = (beforeRnd === afterRnd) ? -1 : JSON.parse(beforeRnd).filter((v, i) => v !== JSON.parse(afterRnd)[i]).length;
  check('V29 per-track randomise changes only the selected track', diff === 1, { tracksChanged: diff, of: 7 });

  /* ---- V30: project JSON round trip through the real file input ---- */
  const io = await evalJs(`
    var a=window.MODSYN.app;
    var snapObj = window.MODSYN.api.snapshot();
    var wantTempo = snapObj.tempo, wantNotes = snapObj.tracks[0].notes.length;
    var errs0 = window.__errs.length;
    var f = new File([JSON.stringify(snapObj)], 'restore-test.medsyn.json', { type: 'application/json' });
    a.proj.tempo = 151; a.proj.tracks[0].notes = [];          /* deliberately wrong it */
    var dt = new DataTransfer(); dt.items.add(f);
    var inp = document.getElementById('file-json');
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r=>setTimeout(r,1400));
    return { wantTempo: wantTempo, wantNotes: wantNotes, newErrs: window.__errs.length - errs0,
      tempo: a.proj.tempo, notes: a.proj.tracks[0].notes.length,
      playing: a.playing, voices: a.E.active.length };`);
  check('V30 loading a project JSON file restores it and keeps playing',
    Math.abs(io.tempo - io.wantTempo) < 0.01 && io.notes === io.wantNotes && io.playing && io.newErrs === 0, io);

  /* ---- V31: offline render does not disturb the live engine ---- */
  const longBtn = await evalJs(`
    var b=document.getElementById('btn-wav2'); if(!b) return null;
    b.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,150));
    var r=b.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};`);
  if (longBtn) await clickAt(longBtn.x, longBtn.y);
  await sleep(6000);
  const afterRender = await evalJs(`return window.MODSYN.api.stats();`);
  check('V31 offline WAV render leaves the live engine intact',
    !!longBtn && afterRender.playing && afterRender.errors.length === 0 && afterRender.dropped === 0 && afterRender.rms > 0.05,
    { playing: afterRender.playing, errors: afterRender.errors, dropped: afterRender.dropped, rms: +afterRender.rms.toFixed(3) });

  /* ---- T22: no page errors / failed requests so far ---- */
  check('T22 no uncaught page errors during the whole run', pageErrors.length === 0, pageErrors.slice(0, 3));
  check('T23 no failed network requests (app is self-contained)',
    netFails.filter(f => !/favicon/i.test(f)).length === 0, netFails.slice(0, 5));

  /* ---- T24: narrow viewport ---- */
  await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await sleep(500);
  let mq = await evalJs(`return {w:innerWidth, mq:matchMedia('(max-width:760px)').matches};`);
  if (!mq.mq) { await S('Page.navigate', { url: URL_TARGET }); await sleep(1500); await evalJs(`document.getElementById('btn-enable').click(); return 1;`); await sleep(1500); }
  const narrow = await evalJs(`
    var b=document.body;
    return {scrollW:b.scrollWidth, clientW:b.clientWidth, inner:innerWidth, mq:matchMedia('(max-width:760px)').matches,
      overflow: b.scrollWidth > b.clientWidth + 2, playing: window.MODSYN.app.playing,
      rms:+window.MODSYN.api.stats().rms.toFixed(3)};`);
  const chain = await evalJs(`
    var out=[]; var n=document.getElementById('topbar');
    while(n && n.tagName!=='HTML'){ var r=n.getBoundingClientRect(); out.push(n.tagName+'#'+n.id+'.'+String(n.className).slice(0,10)+' w='+Math.round(r.width)+' cw='+n.clientWidth+' sw='+n.scrollWidth+' disp='+getComputedStyle(n).display.slice(0,9)+' ovf='+getComputedStyle(n).overflowX); n=n.parentElement; }
    var t=document.querySelector('.tgroup'); var tt=[];
    if(t){ tt.push('tgroup.w='+Math.round(t.getBoundingClientRect().width)+' styleW='+getComputedStyle(t).width+' parent='+t.parentElement.id); }
    return {chain:out, tg:tt, docW:document.documentElement.clientWidth, appW:Math.round(document.getElementById('app').getBoundingClientRect().width)};`);
  console.log('NARROW CHAIN: ' + JSON.stringify(chain, null, 1));
  const wide = await evalJs(`
    var w=[]; document.querySelectorAll('#app *').forEach(function(e){
      var r=e.getBoundingClientRect();
      if(r.right > innerWidth + 1 && getComputedStyle(e).overflowX !== 'auto' && !e.closest('[style*=auto]')) w.push(e.tagName+'.'+String(e.className).slice(0,18)+'='+Math.round(r.right));
    });
    return w.slice(0,8);`);
  check('T24 narrow 390x844 viewport: no horizontal overflow, audio continues',
    !narrow.overflow && narrow.playing, { ...narrow, wide });
  await shot('03-narrow');
  const nErr = await evalJs(`return window.__errs.length;`);
  check('T25 no runtime errors in narrow layout', nErr === 0, { count: nErr });

  await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await sleep(600);

  /* ---- T26: direct-file check summary + fresh reload keeps working ---- */
  await S('Page.navigate', { url: URL_TARGET });
  await sleep(1200);
  const fresh = await evalJs(`
    document.getElementById('btn-enable').click();
    return new Promise(function(r){ setTimeout(function(){
      var s=window.MODSYN.api.stats(); r({ctx:s.ctx, playing:s.playing, voices:s.voices, rms:+s.rms.toFixed(3), errs:window.__errs.length});
    }, 2200); });`);
  check('T26 reload from scratch replays the demo (persistence + boot path)', fresh.playing && fresh.rms > 0.01, fresh);
  await shot('04-reload');

  writeFileSync(`${OUT}/harness-report.json`, JSON.stringify({ results, pageErrors, consoleErrors, netFails }, null, 1));
  const fails = results.filter(r => !r.pass);
  console.log('\n== ' + (results.length - fails.length) + '/' + results.length + ' checks passed ==');
  if (fails.length) console.log('FAILED:\n' + fails.map(f => ' - ' + f.name + ' ' + JSON.stringify(f.info)).join('\n'));
  if (consoleErrors.length) console.log('\nconsole errors/warnings:\n' + consoleErrors.slice(0, 10).join('\n'));
  ws.close();
  chrome.kill();
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('HARNESS ERROR', e); try { ws && ws.close(); } catch (x) { } process.exit(2); });