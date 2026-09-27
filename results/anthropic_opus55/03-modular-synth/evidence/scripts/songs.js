(async () => {
  const out = {};
  for (const s of PG.SONGS) {
    const p = PG.buildSong(s); const t0 = performance.now();
    const { buf } = await PG.renderOffline(p, 1); const st = PG.bufStats(buf);
    const L = buf.getChannelData(0), R = buf.getChannelData(1); let lr = 0, ll = 0, rr = 0, nan = 0; for (let i = 0; i < L.length; i++) { if (!isFinite(L[i]) || !isFinite(R[i])) nan++; lr += L[i]*R[i]; ll += L[i]*L[i]; rr += R[i]*R[i]; }
    out[s.name] = { sec: +buf.duration.toFixed(2), rmsDb: +st.rmsDb.toFixed(1), peakDb: +st.peakDb.toFixed(1), corr: +(lr/Math.sqrt(ll*rr+1e-12)).toFixed(3), nonFinite: nan, renderMs: Math.round(performance.now() - t0) };
  }
  return JSON.stringify(out);
})()
