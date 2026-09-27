(async () => {
  const base = PG.buildSong(PG.SONGS[0]); base.fx.comp.ratio = 1; base.fx.comp.makeup = 0; base.fx.comp.limiter = false; base.fx.drive.mix = 0;
  const stat = buf => { const L = buf.getChannelData(0), R = buf.getChannelData(1); let pk = 0, s = 0, d = 0, pl = 0, pr = 0, lr = 0; for (let i = 0; i < L.length; i++) { const m = (L[i] + R[i]) / 2; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); s += m * m; if (i) { const dm = m - ((L[i-1] + R[i-1]) / 2); d += dm * dm; } pl += L[i]*L[i]; pr += R[i]*R[i]; lr += L[i]*R[i]; } const rms = Math.sqrt(s / L.length); return { rmsDb: +(20*Math.log10(rms+1e-9)).toFixed(1), peakDb: +(20*Math.log10(pk+1e-9)).toFixed(1), bright: +(Math.sqrt(d/(s+1e-12))).toFixed(3), corr: +(lr/Math.sqrt(pl*pr+1e-12)).toFixed(3) }; };
  const out = {};
  { const { buf } = await PG.renderOffline(base, 1); out.MIX = stat(buf); }
  for (let i = 0; i < base.tracks.length; i++) {
    const p = JSON.parse(JSON.stringify(base)); p.tracks.forEach((t, k) => t.mix.solo = k === i);
    const { buf } = await PG.renderOffline(p, 1); out[p.tracks[i].name] = stat(buf);
  }
  return JSON.stringify(out);
})()
