(async () => {
  const run = async depth => {
    const p = PG.buildSong(PG.SONGS[0]); p.tracks.forEach((t, k) => t.mix.solo = k === 5);
    const k = p.tracks[5]; k.mix.sendA = 0; k.mix.sendB = 0; p.fx.drive.mix = 0; p.fx.comp.ratio = 1; p.fx.comp.limiter = false;
    k.notes = [{ s: 0, p: 69, l: 32, v: 0.8 }]; Object.assign(k.params, { wave1: 'sine', mix2: 0, attack: 0.01, sustain: 1, envAmt: 0, cutoff: 16000, lfoDest: 'pitch', lfoDepth: depth, lfoSync: 'free', lfoRate: 2, lfoWave: 'sine' });
    const buf = (await PG.renderOffline(p, 1)).buf, L = buf.getChannelData(0), sr = buf.sampleRate, n = Math.floor(sr * 0.05), f = [];
    for (let a = sr; a + n < sr * 3.5; a += n) { let z = 0; for (let i = a + 1; i < a + n; i++) if (L[i - 1] < 0 && L[i] >= 0) z++; f.push(z / 0.05); }
    return { minHz: Math.min(...f), maxHz: Math.max(...f) };
  };
  return JSON.stringify({ depth0: await run(0), depth1: await run(1) });
})()
