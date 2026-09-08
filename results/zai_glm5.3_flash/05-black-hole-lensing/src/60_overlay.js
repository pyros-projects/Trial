/* ============================================================================
 *  2D overlays (event horizon, photon sphere, disk plane, selected ray path)
 *  and the geodesic schematic diagram + info panel.
 * ========================================================================= */
function makeProjector(){
  const b = camBasis();
  const focalPx = 0.5*R.cssH/Math.tan(deg2rad(P.fov)/2);
  return P3 => {
    const rel = v3.sub(P3, b.pos);
    const z = v3.dot(rel, b.fwd);
    if(z < 0.02) return null;
    return [(v3.dot(rel, b.right)/z)*focalPx + R.cssW/2,
            -(v3.dot(rel, b.up)/z)*focalPx + R.cssH/2, z];
  };
}
function circleScreenRadius(r, proj, b){
  const d = v3.len(b.pos);
  if(r >= d) return null;
  const c = proj([0,0,0]);
  if(!c) return null;
  return { c, rp: (0.5*R.cssH/Math.tan(deg2rad(P.fov)/2))*Math.tan(Math.asin(clamp(r/d, 0, 0.9999))) };
}
function strokeCircle(ctx, c, rp, color, dash, w){
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = w || 1.2;
  ctx.setLineDash(dash || []);
  ctx.beginPath(); ctx.arc(c[0], c[1], rp, 0, TAU); ctx.stroke();
  ctx.restore();
}
function polyline3D(ctx, pts, proj, style){
  ctx.save();
  ctx.strokeStyle = style.color; ctx.lineWidth = style.w || 1.3;
  if(style.dash) ctx.setLineDash(style.dash);
  ctx.beginPath();
  let pen = false;
  for(const p of pts){
    const s = proj(p);
    if(!s){ pen = false; continue; }
    if(pen) ctx.lineTo(s[0], s[1]); else { ctx.moveTo(s[0], s[1]); pen = true; }
  }
  ctx.stroke();
  ctx.restore();
}

function drawOverlay(ctx){
  ctx.clearRect(0, 0, R.cssW, R.cssH);
  const b = camBasis();
  const proj = makeProjector();

  /* disk plane ellipses */
  if(OV.disk){
    const { U, V } = diskBasis();
    const drawRing = (r, color) => {
      const pts = [];
      for(let i = 0; i <= 128; i++){
        const a = i/128*TAU;
        pts.push([r*Math.cos(a)*U[0] + r*Math.sin(a)*V[0],
                  r*Math.cos(a)*U[1] + r*Math.sin(a)*V[1],
                  r*Math.cos(a)*U[2] + r*Math.sin(a)*V[2]]);
      }
      polyline3D(ctx, pts, proj, { color, w: 1 });
    };
    drawRing(P.diskOut, 'rgba(190,215,255,0.22)');
    drawRing(P.diskIn,  'rgba(190,215,255,0.13)');
  }
  /* shadow edge, horizon & photon sphere */
  if(OV.shadow){
    const sh = circleScreenRadius(2.598*P.rs, proj, b);
    if(sh) strokeCircle(ctx, sh.c, sh.rp, 'rgba(140,220,255,0.5)', [2,7], 1.1);
  }
  if(OV.hor){
    const h = circleScreenRadius(horR(), proj, b);
    if(h) strokeCircle(ctx, h.c, h.rp, 'rgba(255,140,70,0.9)', [7,5], 1.4);
  }
  if(OV.phot){
    const ph = circleScreenRadius(photonR(), proj, b);
    if(ph) strokeCircle(ctx, ph.c, ph.rp, 'rgba(255,220,100,0.5)', [3,6], 1.1);
  }
  /* selected ray path */
  if(OV.ray && R.selData){
    const d = R.selData;
    polyline3D(ctx, d.pts, proj, { color:'rgba(110,215,255,0.9)', w:1.4 });
    for(const c of d.crossings){
      const s = proj(c.pos);
      if(s){ ctx.fillStyle = 'rgba(255,171,94,0.95)'; ctx.beginPath(); ctx.arc(s[0], s[1], 3, 0, TAU); ctx.fill(); }
    }
    if(d.state === 1){
      const s = proj(d.endPos);
      if(s){ ctx.fillStyle = 'rgba(255,70,60,0.95)'; ctx.beginPath(); ctx.arc(s[0], s[1], 3.5, 0, TAU); ctx.fill(); }
    }
  }
  /* selection crosshair */
  if(R.sel){
    ctx.save();
    ctx.strokeStyle = 'rgba(110,215,255,0.85)'; ctx.lineWidth = 1;
    const x = R.sel.x, y = R.sel.y;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, TAU); ctx.moveTo(x-11, y); ctx.lineTo(x-4, y); ctx.moveTo(x+4, y); ctx.lineTo(x+11, y);
    ctx.moveTo(x, y-11); ctx.lineTo(x, y-4); ctx.moveTo(x, y+4); ctx.lineTo(x, y+11);
    ctx.stroke(); ctx.restore();
  }
}

/* -------- schematic of the selected geodesic in its orbital plane -------- */
function drawDiagram(){
  const cv = $('diagram');
  const w = cv.clientWidth || 292, h = 150;
  if(cv.width !== (w*R.dpr)|0 || cv.height !== (h*R.dpr)|0){ cv.width = (w*R.dpr)|0; cv.height = (h*R.dpr)|0; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const d = R.selData;
  if(!d){
    ctx.fillStyle = '#39465c'; ctx.font = '11px monospace';
    ctx.fillText('click the image to trace a ray', 14, h/2);
    return;
  }
  const e1 = v3.norm(d.ro);
  const n = v3.norm(v3.cross(d.ro, d.rd));
  let e2 = v3.sub(d.rd, v3.scale(e1, v3.dot(d.rd, e1)));
  e2 = v3.norm(e2);
  const hor = horR(), phr = photonR();
  const viewR = clamp(Math.max(hor*3.6, d.minR*2.3), hor*2.5, escRadius());
  const cx = w/2, cy = h/2;
  const sc = Math.min((w/2 - 14), (h/2 - 12))/viewR;
  const toXY = p => [cx + v3.dot(p, e1)*sc, cy - v3.dot(p, e2)*sc];

  /* disk-plane line (intersection of disk plane & geodesic plane) */
  const wdir = v3.cross(diskBasis().N, n);
  if(v3.len(wdir) > 1e-4){
    const wd = v3.norm(wdir);
    const a = [v3.dot(wd, e1), v3.dot(wd, e2)];
    const L = Math.hypot(a[0], a[1]);
    if(L > 1e-3){
      ctx.save(); ctx.strokeStyle = 'rgba(190,215,255,0.30)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(cx - a[0]/L*cx*0.95, cy + a[1]/L*cy*0.95);
      ctx.lineTo(cx + a[0]/L*cx*0.95, cy - a[1]/L*cy*0.95); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(190,215,255,0.5)'; ctx.font = '9px monospace';
      ctx.fillText('disk plane', cx + a[0]/L*cx*0.95 - 52, cy - a[1]/L*cy*0.95 - 4);
    }
  }
  /* photon sphere & horizon */
  strokeCircle(ctx, [cx, cy], phr*sc, 'rgba(255,220,100,0.4)', [3,5], 1);
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx, cy, hor*sc, 0, TAU); ctx.fill();
  strokeCircle(ctx, [cx, cy], hor*sc, 'rgba(255,120,70,0.9)', [], 1.4);

  /* the geodesic itself, clipped to view */
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, Math.min(w/2, h/2) - 8, 0, TAU); ctx.clip();
  ctx.strokeStyle = '#6fd3ff'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  let started = false;
  for(const p of d.pts){
    const [x, y] = toXY(p);
    if(started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
  }
  ctx.stroke();
  for(const c of d.crossings){
    const [x, y] = toXY(c.pos);
    ctx.fillStyle = 'rgba(255,171,94,0.95)'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
  }
  const [ex, ey] = toXY(d.endPos);
  ctx.fillStyle = d.state === 1 ? '#ff4a3c' : '#a4ff70';
  ctx.beginPath(); ctx.arc(ex, ey, 2.8, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#7d8ba1'; ctx.font = '9px monospace';
  ctx.fillText('geodesic plane · hole at origin · ' + fmt(viewR, 1) + ' rs across', 8, h - 6);
}

/* -------- selected-ray info panel -------- */
function updateRayPanel(){
  const d = R.selData;
  const el = $('rayInfo');
  if(!d){ el.innerHTML = '<span style="color:#7d8ba1">no ray selected</span>'; return; }
  let html =
    '<table>' +
    '<tr><td>pixel</td><td>' + Math.round(R.sel.x) + ', ' + Math.round(R.sel.y) + ' px</td></tr>' +
    '<tr><td>state</td><td style="color:' + (d.state === 0 ? '#8de88a' : d.state === 1 ? '#ff8a80' : '#ffd25e') + '">' + STATE_NAMES[d.state] + '</td></tr>' +
    '<tr><td>impact param b</td><td>' + fmt(d.b, 3) + ' rs &nbsp;(crit ≈ 2.598 rs)</td></tr>' +
    '<tr><td>min radius</td><td>' + fmt(d.minR/P.rs, 3) + ' rs</td></tr>' +
    '<tr><td>deflection</td><td>' + fmt(rad2deg(d.defl), 1) + '°</td></tr>' +
    '<tr><td>CPU steps</td><td>' + d.steps + ' &nbsp;(' + fmt(d.ms, 2) + ' ms)</td></tr>' +
    '<tr><td>path length</td><td>' + fmt(d.endDist/P.rs, 2) + ' rs</td></tr>' +
    '<tr><td>end direction</td><td>' + d.endDir.map(x => fmt(x, 2)).join(', ') + '</td></tr>';
  if(d.crossings.length){
    html += '<tr><td colspan="2"><span class="hd">disk plane crossings (δ = Doppler, g = grav.redshift)</span></td></tr>';
    let i = 0;
    for(const c of d.crossings){
      html += '<tr><td>#' + (++i) + '</td><td>r=' + fmt(c.r/P.rs, 2) + ' rs · φ=' + fmt(rad2deg(c.phi), 0) + '° · ' +
              'δ=' + fmt(c.dop, 3) + ' · g=' + fmt(c.g, 3) + ' · T=' + fmt(c.temp, 0) + 'K · ' +
              'ρ=' + fmt(c.dens, 2) + ' <span class="sw" style="background:' + blackbodyCSS(c.temp) + '"></span></td></tr>';
    }
  }
  html += '</table><div style="color:#5c6a80;margin-top:5px">CPU trace uses half the shader step size; GPU step counts differ (see steps mode).</div>';
  el.innerHTML = html;
}
