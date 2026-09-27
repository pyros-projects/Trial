// Collect 60 requestAnimationFrame deltas in the page and report median / p95 / worst frame time.
(async () => {
  const d = []; let last = performance.now();
  await new Promise((res) => { const f = (t) => { d.push(t - last); last = t; if (d.length < 61) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  d.shift(); d.sort((a, b) => a - b);
  const med = d[Math.floor(d.length / 2)], p95 = d[Math.floor(d.length * 0.95)];
  return JSON.stringify({ frames: d.length, medianMs: +med.toFixed(1), p95Ms: +p95.toFixed(1), worstMs: +d[d.length - 1].toFixed(1), medianFps: +(1000 / med).toFixed(1) });
})()
