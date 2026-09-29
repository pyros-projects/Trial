window.__cttb = function(){ const c = SYNCOPATH.app.calib; if (!c) return 1e9; const s = c.sess; const song = SYNCOPATH.clock.raw() - s.audioStart; const b = s.transport.beatAt(song); if (b < 0.6) return 1e9; return (s.transport.secAt(Math.ceil(b)) - song) * 1000; };
window.__crdy = function(x){ const t = __cttb(); return t < x && t > x - 30; };
'ok';
