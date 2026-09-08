// Minimal CDP driver used for validation only. Not part of the delivered app.
// Sends genuine browser input events (Input.dispatchKeyEvent / dispatchMouseEvent)
// so held keys, focus loss and pointer drags behave exactly as for a human.
const KEYS = {
  ArrowUp:    { keyCode: 38, key: 'ArrowUp',    code: 'ArrowUp' },
  ArrowDown:  { keyCode: 40, key: 'ArrowDown',  code: 'ArrowDown' },
  ArrowLeft:  { keyCode: 37, key: 'ArrowLeft',  code: 'ArrowLeft' },
  ArrowRight: { keyCode: 39, key: 'ArrowRight', code: 'ArrowRight' },
  KeyW: { keyCode: 87, key: 'w', code: 'KeyW' }, KeyA: { keyCode: 65, key: 'a', code: 'KeyA' },
  KeyS: { keyCode: 83, key: 's', code: 'KeyS' }, KeyD: { keyCode: 68, key: 'd', code: 'KeyD' },
  KeyZ: { keyCode: 90, key: 'z', code: 'KeyZ' }, KeyX: { keyCode: 88, key: 'x', code: 'KeyX' },
  KeyC: { keyCode: 67, key: 'c', code: 'KeyC' }, KeyP: { keyCode: 80, key: 'p', code: 'KeyP' },
  KeyR: { keyCode: 82, key: 'r', code: 'KeyR' }, KeyB: { keyCode: 66, key: 'b', code: 'KeyB' },
  ShiftLeft: { keyCode: 16, key: 'Shift', code: 'ShiftLeft', mod: 8 },
  Space: { keyCode: 32, key: ' ', code: 'Space' },
  Escape: { keyCode: 27, key: 'Escape', code: 'Escape' },
  Tab: { keyCode: 9, key: 'Tab', code: 'Tab' },
};

export class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null; }
  static async attach(browserWsUrl, urlMatch) {
    const ws = new WebSocket(browserWsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) { const { res, rej } = c.pending.get(m.id); c.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    };
    const { targetInfos } = await c.send('Target.getTargets');
    const t = targetInfos.find(t => t.type === 'page' && (!urlMatch || t.url.includes(urlMatch)));
    if (!t) throw new Error('no page target matching ' + urlMatch + '; saw ' + targetInfos.map(x=>x.type+':'+x.url).join(', '));
    const { sessionId } = await c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    c.sessionId = sessionId;
    await c.send('Runtime.enable');
    return c;
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id;
    const msg = { id, method, params };
    if (useSession && this.sessionId) msg.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id);
        rej(new Error('CDP timeout: ' + method)); } }, 15000);
    });
  }
  async evalJS(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }
  async keyDown(name) {
    const k = KEYS[name]; if (!k) throw new Error('unknown key ' + name);
    this.mods = (this.mods || 0) | (k.mod || 0);
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: k.keyCode,
      nativeVirtualKeyCode: k.keyCode, key: k.key, code: k.code, modifiers: this.mods });
  }
  async keyUp(name) {
    const k = KEYS[name]; if (!k) throw new Error('unknown key ' + name);
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: k.keyCode,
      nativeVirtualKeyCode: k.keyCode, key: k.key, code: k.code, modifiers: this.mods });
    this.mods = (this.mods || 0) & ~(k.mod || 0);
  }
  async tap(name, ms = 40) { await this.keyDown(name); await sleep(ms); await this.keyUp(name); }
  async mouse(type, x, y, button = 'left', clickCount = 1) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : button,
      buttons: type === 'mouseReleased' ? 0 : (button === 'right' ? 2 : 1), clickCount });
  }
  async mouseDown(x, y, button = 'left') { await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: button === 'right' ? 2 : 1, clickCount: 1 }); }
  async mouseMove(x, y, buttons = 1) { await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons }); }
  async mouseUp(x, y, button = 'left') { await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 }); }
  async shot(path) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const fs = await import('node:fs');
    fs.writeFileSync(path, Buffer.from(data, 'base64'));
    return path;
  }
  close() { this.ws.close(); }
}
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
