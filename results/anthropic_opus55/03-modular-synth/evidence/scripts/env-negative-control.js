(async () => {
  const sr = 8000, dur = 2;
  const render = async fn => { const c = new OfflineAudioContext(1, sr * dur, sr), s = new ConstantSourceNode(c, { offset: 0 }); fn(s.offset); s.connect(c.destination); s.start(0); return (await c.startRendering()).getChannelData(0); };
  const maxErr = (buf, model) => { let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - model(i / sr))); return +m.toFixed(4); };
  const E = () => ({ on: 0.1, a: 0.3, d: 0.2, s: 0.5, r: 0.25, lo: 0, hi: 1, off: null });
  const e = E();
  const b = await render(p => { schedEnv(p, e); applyRelease(p, e, 0.35, 0.25); p.cancelScheduledValues(0.2); /* old slide(): cancel from t */ });
  const peak = Math.max(...b);
  const fi = { t0: 0.2, f0: 100, t1: 0.9, f1: 400 }, t = 0.5, cur = freqAt(fi, t);
  const g = await render(p => { p.setValueAtTime(100, 0.2); p.exponentialRampToValueAtTime(400, 0.9); p.cancelScheduledValues(t); p.setValueAtTime(cur, t); /* old: snap */ p.exponentialRampToValueAtTime(200, t + 0.3); });
  return JSON.stringify({ oldSlideEnvErr: maxErr(b, x => envAt(E(), x)), heldModelPeak: +envAt(E(), 0.4).toFixed(3), renderedPeak: +peak.toFixed(3), oldGlideHzErr: maxErr(g, x => x < 0.2 ? 0 : x <= t ? freqAt(fi, x) : freqAt({ t0: t, f0: cur, t1: t + 0.3, f1: 200 }, x)) });
})()
