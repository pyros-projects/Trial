(() => {
  const f = window.fluxion;
  const s = f.sampleField('dye');
  const v = f.sampleField('velocity');
  const centroid = (g) => {
    let tot = 0, cx = 0, cy = 0;
    for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) {
      const w = g.data[y * g.size + x];
      tot += w; cx += w * (x + 0.5) / g.size; cy += w * (y + 0.5) / g.size;
    }
    return tot > 1e-6 ? { total: +tot.toFixed(3), x: +(cx / tot).toFixed(4), y: +(cy / tot).toFixed(4) }
                      : { total: +tot.toFixed(3), x: null, y: null };
  };
  return JSON.stringify({
    dye: centroid(s), vel: centroid(v),
    stats: { dyeE: f.stats.dyeEnergy, velE: f.stats.velocityEnergy, splats: f.stats.splats, steps: f.stats.steps, paused: f.stats.paused }
  });
})()
