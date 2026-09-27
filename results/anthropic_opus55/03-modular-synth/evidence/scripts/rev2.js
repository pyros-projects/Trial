(async () => {
  const db = x => +(10*Math.log10(x + 1e-12)).toFixed(1);
  const mk = (fn) => { const p = PG.buildSong(PG.SONGS[0]); p.tracks.forEach((t,k) => t.mix.solo = k === 5); p.fx.comp.limiter = false; p.fx.comp.ratio = 1; p.fx.drive.mix = 0; p.tracks[5].mix.sendA = 0; p.tracks[5].mix.sendB = 0; fn(p); return p; };
  const dry = (await PG.renderOffline(mk(() => {}), 1)).buf;
  const out = { dryRmsDb: 0 };
  let s = 0; for (let c = 0; c < 2; c++) { const d = dry.getChannelData(c); for (let i = 0; i < d.length; i++) s += d[i]*d[i]; } out.dryRmsDb = db(s / (2*dry.length));
  for (const [name, fn] of [['reverb send1 ret1', p => { p.tracks[5].mix.sendB = 1; p.fx.reverb.ret = 1; }], ['delay send1 ret1', p => { p.tracks[5].mix.sendA = 1; p.fx.delay.ret = 1; }], ['song default sends', p => { p.tracks[5].mix.sendA = 0.08; p.tracks[5].mix.sendB = 0.4; }]]) {
    const wet = (await PG.renderOffline(mk(fn), 1)).buf;
    let e = 0, pl = 0, pr = 0, lr = 0; const L0 = dry.getChannelData(0), R0 = dry.getChannelData(1), L1 = wet.getChannelData(0), R1 = wet.getChannelData(1);
    for (let i = 0; i < L0.length; i++) { const l = L1[i]-L0[i], r = R1[i]-R0[i]; e += (l*l + r*r)/2; pl += l*l; pr += r*r; lr += l*r; }
    out[name] = { wetRmsDb: db(e / L0.length), wetCorr: +(lr/Math.sqrt(pl*pr+1e-12)).toFixed(3) };
  }
  return JSON.stringify(out);
})()
