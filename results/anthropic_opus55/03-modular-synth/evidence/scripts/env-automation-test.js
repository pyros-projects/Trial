// Renders the app's own envelope helpers onto a ConstantSourceNode and compares to the analytic model.
(async () => {
  const sr = 8000, dur = 2;
  const render = async fn => { const c = new OfflineAudioContext(1, sr * dur, sr), s = new ConstantSourceNode(c, { offset: 0 }); fn(s.offset); s.connect(c.destination); s.start(0); return (await c.startRendering()).getChannelData(0); };
  const maxErr = (buf, model, from = 0) => { let m = 0; for (let i = Math.floor(from * sr); i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - model(i / sr))); return +m.toFixed(4); };
  const E = () => ({ on: 0.1, a: 0.3, d: 0.2, s: 0.5, r: 0.25, lo: 0, hi: 1, off: null });
  const out = {};
  // A: release after attack (scheduled ahead)
  { const e = E(), e2 = E(); const b = await render(p => { schedEnv(p, e); applyRelease(p, e, 0.9, 0.25); }); schedEnv({ setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} }, e2); e2.off = 0.9; e2.offV = envAt(E(), 0.9); e2.rel = 0.25; out.releaseAfterAttack = maxErr(b, t => envAt(e2, t)); }
  // B: release during attack
  { const e = E(), m = E(); const b = await render(p => { schedEnv(p, e); applyRelease(p, e, 0.25, 0.25); }); m.off = 0.25; m.offV = envAt(E(), 0.25); m.rel = 0.25; out.releaseDuringAttack = maxErr(b, t => envAt(m, t)); }
  // C: scheduled release (during attack) then un-released by a slide at 0.2 -> must equal a held note
  { const e = E(); const b = await render(p => { schedEnv(p, e); applyRelease(p, e, 0.35, 0.25); unrelease(p, e); }); out.unreleaseDuringAttack = maxErr(b, t => envAt(E(), t)); }
  // D: scheduled release after attack, un-released, then released later at 1.2
  { const e = E(), m = E(); const b = await render(p => { schedEnv(p, e); applyRelease(p, e, 0.6, 0.25); unrelease(p, e); applyRelease(p, e, 1.2, 0.25); }); m.off = 1.2; m.offV = envAt(E(), 1.2); m.rel = 0.25; out.unreleaseThenRelease = maxErr(b, t => envAt(m, t)); }
  // E: glide re-anchoring (slide at 0.5 while a 0.2..0.9 glide 100->400 Hz is running, new target 200 Hz over 0.3 s)
  { const fi = { t0: 0.2, f0: 100, t1: 0.9, f1: 400 }, t = 0.5, cur = freqAt(fi, t), fi2 = { t0: t, f0: cur, t1: t + 0.3, f1: 200 };
    const b = await render(p => { p.setValueAtTime(100, 0.2); p.exponentialRampToValueAtTime(400, 0.9); p.cancelScheduledValues(t); p.exponentialRampToValueAtTime(cur, t); p.exponentialRampToValueAtTime(200, t + 0.3); });
    out.glideReanchorMaxHzErr = maxErr(b, x => x < 0.2 ? 0 : x <= t ? freqAt(fi, x) : freqAt(fi2, x), 0.2); }
  return JSON.stringify(out);
})()
