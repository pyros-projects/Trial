(() => {
  const stat = (name) => {
    const g = window.fluxion.sampleField(name);
    const d = g.data.slice().sort((a, b) => a - b);
    const q = (p) => +d[Math.floor(p * (d.length - 1))].toFixed(3);
    return name + ': p50=' + q(0.5) + ' p90=' + q(0.9) + ' p99=' + q(0.99) + ' max=' + q(1);
  };
  return ['velocity', 'pressure', 'divergence', 'curl', 'dye'].map(stat).join('\n');
})()
