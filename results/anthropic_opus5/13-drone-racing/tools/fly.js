#!/usr/bin/env node
/* Real keyboard/mouse driver over CDP (the same Input domain Playwright uses).
   Lets the harness hold keys for real durations instead of one press per CLI call.
   Usage: node tools/fly.js <ws-browser-url> <program.json>            */
const KEYS = {
  KeyW: [87, 'w'], KeyA: [65, 'a'], KeyS: [83, 's'], KeyD: [68, 'd'],
  KeyC: [67, 'c'], KeyM: [77, 'm'], KeyR: [82, 'r'], KeyG: [71, 'g'], KeyN: [78, 'n'],
  KeyO: [79, 'o'], KeyH: [72, 'h'], KeyP: [80, 'p'], KeyB: [66, 'b'], KeyV: [86, 'v'],
  ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowLeft: [37, 'ArrowLeft'], ArrowRight: [39, 'ArrowRight'],
  Tab: [9, 'Tab'], Escape: [27, 'Escape'], Backspace: [8, 'Backspace'], Space: [32, ' '],
  ShiftLeft: [16, 'Shift'], ControlLeft: [17, 'Control'],
  Digit1: [49, '1'], Digit2: [50, '2'], Digit3: [51, '3'], Digit4: [52, '4'],
  F9: [120, 'F9'], BracketLeft: [219, '['], BracketRight: [221, ']']
};

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pend = new Map(); this.sessionId = null; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws error')); });
    const c = new CDP(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pend.has(m.id)) { const { res, rej } = c.pend.get(m.id); c.pend.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    };
    return c;
  }
  send(method, params) {
    const id = ++this.id;
    const msg = { id, method, params: params || {} };
    if (this.sessionId) msg.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => {
      this.pend.set(id, { res, rej });
      setTimeout(() => { if (this.pend.has(id)) { this.pend.delete(id); rej(new Error('timeout ' + method)); } }, 90000);
    });
  }
  async attachPage(url) {
    const { targetInfos } = await this.send('Target.getTargets');
    const page = targetInfos.find(t => t.type === 'page' && (!url || t.url.includes(url)));
    if (!page) throw new Error('no page target; have: ' + targetInfos.map(t => t.type + ':' + t.url).join(', '));
    const { sessionId } = await this.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    this.sessionId = sessionId;
    await this.send('Runtime.enable');
    return page;
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || ''));
    return r.result.value;
  }
  key(type, code, mods) {
    const k = KEYS[code];
    if (!k) throw new Error('unknown key ' + code);
    const p = {
      type, code, key: k[1], windowsVirtualKeyCode: k[0], nativeVirtualKeyCode: k[0],
      modifiers: mods || 0, autoRepeat: false, isKeypad: false, location: 0
    };
    if (type === 'keyDown' && k[1].length === 1) p.text = k[1];
    return this.send('Input.dispatchKeyEvent', p);
  }
  async down(codes) { for (const c of [].concat(codes)) await this.key('keyDown', c); }
  async up(codes) { for (const c of [].concat(codes)) await this.key('keyUp', c); }
  async tap(code) { await this.key('keyDown', code); await sleep(35); await this.key('keyUp', code); }
  mouse(type, x, y, button, clicks) {
    return this.send('Input.dispatchMouseEvent', { type, x, y, button: button || 'none', buttons: type === 'mouseMoved' && button === 'left' ? 1 : (button === 'left' && type !== 'mouseReleased' ? 1 : 0), clickCount: clicks == null ? (button ? 1 : 0) : clicks });
  }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
async function main() {
  const wsBrowser = process.argv[2];
  const prog = JSON.parse(require('fs').readFileSync(process.argv[3], 'utf8'));
  const c = await CDP.connect(wsBrowser);
  await c.attachPage(prog.url || 'index.html');
  const log = [];
  const record = async (tag) => {
    const s = await c.eval('JSON.stringify(window.__DRONE__.state())');
    const st = JSON.parse(s);
    log.push({ tag, t: +st.simTime.toFixed(2), pos: st.pos.map(v => +v.toFixed(2)), vel: st.vel.map(v => +v.toFixed(2)),
      speed: +st.speed.toFixed(2), alt: +st.altAGL.toFixed(2), att: { r: +st.attitudeDeg.roll.toFixed(1), p: +st.attitudeDeg.pitch.toFixed(1), y: +st.attitudeDeg.yaw.toFixed(1) },
      omega: st.omega.map(v => +v.toFixed(2)), thr: +st.throttleCmd.toFixed(3), motors: st.motors.map(v => +v.toFixed(2)),
      mode: st.flightMode, cam: st.camera, gate: st.race.nextGate, lap: st.race.lap, lapTime: +st.race.lapTime.toFixed(2),
      crashed: st.crashed, contact: st.contact, contactKind: st.contactKind, errors: st.errors.length, fps: +st.render.fps.toFixed(1) });
    return st;
  };
  for (const step of prog.steps) {
    if (step.eval) { const v = await c.eval(step.eval); log.push({ tag: step.tag || 'eval', value: v }); }
    else if (step.hold) {
      await c.down(step.hold);
      const ms = step.ms || 500, tick = step.sample ? Math.max(50, ms / (step.sample || 1)) : ms;
      let elapsed = 0;
      while (elapsed < ms) { const w = Math.min(tick, ms - elapsed); await sleep(w); elapsed += w; if (step.sample) await record((step.tag || 'hold') + '@' + elapsed + 'ms'); }
      await c.up(step.hold);
      if (!step.sample) await record(step.tag || ('hold ' + step.hold.join('+') + ' ' + ms + 'ms'));
    }
    else if (step.tapKey) { await c.tap(step.tapKey); await sleep(step.ms || 120); await record(step.tag || ('tap ' + step.tapKey)); }
    else if (step.wait) { await sleep(step.wait); await record(step.tag || ('wait ' + step.wait + 'ms')); }
    else if (step.click) { await c.mouse('mousePressed', step.click[0], step.click[1], 'left'); await sleep(40); await c.mouse('mouseReleased', step.click[0], step.click[1], 'left'); await sleep(step.ms || 200); await record(step.tag || 'click'); }
    else if (step.drag) {
      const [x0, y0, x1, y1] = step.drag;
      await c.mouse('mousePressed', x0, y0, 'left');
      const n = step.steps || 10;
      for (let i = 1; i <= n; i++) { await c.mouse('mouseMoved', x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 'left'); await sleep(20); }
      await c.mouse('mouseReleased', x1, y1, 'left');
      await sleep(step.ms || 150); await record(step.tag || 'drag');
    }
    else if (step.record) await record(step.tag || 'record');
  }
  console.log(JSON.stringify(log, null, 1));
  process.exit(0);
}
main().catch(e => { console.error('FLY ERROR: ' + e.message); process.exit(1); });
