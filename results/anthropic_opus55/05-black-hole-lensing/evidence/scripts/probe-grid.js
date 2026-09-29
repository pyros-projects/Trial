// Paste into the page (agent-browser eval --stdin). Runs the real GPU shader in PROBE mode on a 24x16 grid of
// pixels for several parameter sets, and compares each probe against the CPU mirror tracer.
(() => {
  const b = window.__bh, P = b.P;
  const saved = Object.assign({}, P);
  const FN = b.Phys.FATE_NAMES;
  const cases = [
    ['defaults', {}],
    ['spin 0.99', { spin: 0.99, diskIn: +b.Phys.iscoRadius(1, 0.99).toFixed(2) }],
    ['mass 3.0', { mass: 3 }],
    ['horizon x2.5', { horizonScale: 2.5 }],
    ['horizon x0.5', { horizonScale: 0.5 }],
    ['disk rin 1.0 (inside horizon)', { diskIn: 1.0 }],
    ['thick disk H/r 0.3, tilt 60', { diskH: 0.3, diskTilt: 60 }],
    ['doppler 2 redshift 2 T 30000', { doppler: 2, redshift: 2, diskTemp: 30000 }],
    ['doppler 0 redshift 0 T 1500', { doppler: 0, redshift: 0, diskTemp: 1500 }],
    ['step 0.3 maxSteps 16', { stepSize: 0.3, maxSteps: 16 }],
  ];
  const out = [];
  for (const [name, over] of cases) {
    Object.assign(P, saved, over);
    const hist = [0, 0, 0, 0, 0]; let nan = 0, mism = 0, n = 0, maxRelSteps = 0;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 24; i++) {
      const fx = (i + 0.5) / 24, fy = (j + 0.5) / 16;
      const g = b.gpuProbe(fx, fy), c = b.cpuTrace(fx, fy);
      n++; hist[g.fate]++;
      if (![g.rmin, g.defl, g.T, ...g.col].every(Number.isFinite)) nan++;
      if (g.fate !== c.fate) mism++;
      maxRelSteps = Math.max(maxRelSteps, Math.abs(g.steps - c.steps) / Math.max(1, c.steps));
    }
    out.push(`${name.padEnd(34)} ${hist.map((h, k) => `${FN[k].split(' ')[0]}:${h}`).join(' ')} | non-finite ${nan} | GPU≠CPU fate ${mism}/${n} | max step diff ${(maxRelSteps * 100).toFixed(1)}%`);
  }
  Object.assign(P, saved);
  b.setParam('mode', P.mode);
  return out.join('\n');
})()
