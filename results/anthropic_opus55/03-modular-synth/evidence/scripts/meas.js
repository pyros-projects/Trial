window.__measure = (ms = 1200) => new Promise(res => {
  const an = PG.app.engine.m.an, fd = new Float32Array(an.frequencyBinCount), sr = PG.app.ctx.sampleRate, binHz = sr / an.fftSize;
  let hi = 0, tot = 0, cent = 0, n = 0;
  const t0 = performance.now();
  const step = () => {
    an.getFloatFrequencyData(fd);
    for (let b = 1; b < fd.length; b++) { const p = Math.pow(10, fd[b] / 10); tot += p; cent += p * b * binHz; if (b * binHz > 3000) hi += p; }
    n++;
    if (performance.now() - t0 < ms) setTimeout(step, 40); else res(JSON.stringify({hiShare: +(hi / tot).toFixed(4), centroidHz: Math.round(cent / tot), frames: n, outDb: +PG.app.outDb.toFixed(1)}));
  };
  step();
});
'ok';
