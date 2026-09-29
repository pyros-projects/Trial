window.__lum = function(){ const R = SYNCOPATH.R, A = R.arena, d = R.dpr; const c = document.createElement('canvas'); c.width = 48; c.height = 64; const g = c.getContext('2d');
  g.drawImage(R.cv, A.x * d, A.y * d, A.w * d, A.h * d, 0, 0, 48, 64); const px = g.getImageData(0, 0, 48, 64).data; let L = 0, red = 0;
  for (let i = 0; i < px.length; i += 4) { L += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; red += px[i] - (px[i + 1] + px[i + 2]) / 2; }
  const n = px.length / 4; return JSON.stringify({ rf: SYNCOPATH.settings.reducedFlash, hitFlash: +R.hitFlash.toFixed(2), meanLum: +(L / n).toFixed(1), redCast: +(red / n).toFixed(1) }); };
'ok';
