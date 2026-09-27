(async () => {
  const win = (buf) => { const L = buf.getChannelData(0), R = buf.getChannelData(1), n = Math.floor(buf.sampleRate * 0.05), out = []; for (let a = buf.sampleRate * 0.6; a + n < buf.sampleRate * 4; a += n) { let e = 0, d = 0, l = 0, r = 0; for (let i = a; i < a + n; i++) { const m = (L[i] + R[i]) / 2; e += m * m; const dm = m - (L[i-1] + R[i-1]) / 2; d += dm * dm; l += L[i]*L[i]; r += R[i]*R[i]; } out.push({ bright: Math.sqrt(d / e), lvl: 10 * Math.log10(e / n), bal: 10 * Math.log10(l / r) }); } return out; };
  const cv = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  const run = async (dest, depth) => {
    const p = PG.buildSong(PG.SONGS[0]); p.tracks.forEach((t, k) => t.mix.solo = k === 5);
    const k = p.tracks[5]; k.mix.sendA = 0; k.mix.sendB = 0; p.fx.comp.ratio = 1; p.fx.comp.limiter = false;
    k.notes = [{ s: 0, p: 57, l: 32, v: 0.8 }, { s: 0, p: 64, l: 32, v: 0.8 }]; k.params.attack = 0.01; k.params.sustain = 1; k.params.fsustain = 0.5;
    Object.assign(k.params, { lfoDest: dest, lfoDepth: depth, lfoSync: 'free', lfoRate: 3, lfoWave: 'sine' });
    const w = win((await PG.renderOffline(p, 1)).buf);
    return { brightSD: +cv(w.map(x => x.bright)).toFixed(4), levelSD_dB: +cv(w.map(x => x.lvl)).toFixed(2), panSD_dB: +cv(w.map(x => x.bal)).toFixed(2) };
  };
  const out = {};
  for (const [d, x] of [['cutoff', 0], ['cutoff', 1], ['amp', 0], ['amp', 1], ['pan', 1], ['pitch', 1]]) out[d + '@' + x] = await run(d, x);
  return JSON.stringify(out);
})()
