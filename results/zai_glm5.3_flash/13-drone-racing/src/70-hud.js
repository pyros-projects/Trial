'use strict';
/* ============================= HUD (2D canvas overlay) ============================= */
const HUD = {
  canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
  graph: { alt: [], spd: [], thr: [], yaw: [] },
  graphMax: 420,
  hintT: 12,
};
HUD.init = function (canvas) {
  HUD.canvas = canvas;
  HUD.ctx = canvas.getContext('2d');
};
HUD.resize = function () {
  const c = HUD.canvas;
  HUD.dpr = Math.min(window.devicePixelRatio || 1, 2);
  HUD.w = c.clientWidth; HUD.h = c.clientHeight;
  c.width = Math.max(2, Math.round(HUD.w * HUD.dpr));
  c.height = Math.max(2, Math.round(HUD.h * HUD.dpr));
};
HUD.pushGraph = function (D) {
  const g = HUD.graph;
  g.alt.push(D.pos[1]); g.spd.push(vlen(D.vel)); g.thr.push(D.motorAvg);
  g.yaw.push(D.w[1] / DEG);
  for (const k of ['alt', 'spd', 'thr', 'yaw']) if (g[k].length > HUD.graphMax) g[k].shift();
};
HUD.fmtTime = function (t) {
  if (t == null || !isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
};

HUD.draw = function (simTime, dtReal, diag) {
  const ctx = HUD.ctx, w = HUD.w, h = HUD.h;
  const dpr = HUD.dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const narrow = w < 720;
  const fs = narrow ? 0.82 : 1;
  const att = droneAttitude(D);
  const spd = vlen(D.vel);
  const altAGL = D.pos[1] - W.height(D.pos[0], D.pos[2]);
  const mono = 'ui-monospace, Menlo, Consolas, monospace';
  const txt = (s, x, y, size, col, align, weight) => {
    ctx.font = (weight || '600') + ' ' + (size * fs).toFixed(1) + 'px ' + mono;
    ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  };

  /* ---------- FPV instrumentation ---------- */
  if (Cam.mode === 'fpv' && !narrow) {
    const cx = w / 2, cy = h / 2;
    // camera attitude
    const cf = qrot([0, 0, 0], Cam.quat, [0, 0, -1]);
    const cr = qrot([0, 0, 0], Cam.quat, [1, 0, 0]);
    const cu = qrot([0, 0, 0], Cam.quat, [0, 1, 0]);
    const cpitch = Math.asin(clamp(cf[1], -1, 1));
    const croll = Math.atan2(-cr[1], Math.max(0.05, cu[1])) * clamp(cu[1], 0, 1);
    const pxPerRad = h * 0.85;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(croll);
    ctx.translate(0, cpitch * pxPerRad);
    ctx.strokeStyle = 'rgba(140, 255, 190, 0.75)';
    ctx.lineWidth = 1.5;
    // horizon
    ctx.beginPath(); ctx.moveTo(-Math.min(w, h) * 0.3, 0); ctx.lineTo(-18, 0); ctx.moveTo(18, 0); ctx.lineTo(Math.min(w, h) * 0.3, 0); ctx.stroke();
    // pitch ladder
    ctx.font = '500 10px ' + mono; ctx.fillStyle = 'rgba(140,255,190,0.6)'; ctx.textAlign = 'center';
    for (const pd of [-30, -15, 15, 30]) {
      const y = -pd * DEG * pxPerRad;
      ctx.beginPath(); ctx.moveTo(-34, y); ctx.lineTo(34, y); ctx.stroke();
      ctx.fillText(pd > 0 ? '+' + pd : '' + pd, 48, y + 3);
    }
    ctx.restore();
    // center marker
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy - 11); ctx.stroke();
    // roll arc ticks
    ctx.strokeStyle = 'rgba(140,255,190,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.31, -Math.PI / 2 - 0.6, -Math.PI / 2 - 0.22); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.31, -Math.PI / 2 + 0.22, -Math.PI / 2 + 0.6); ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(croll);
    ctx.beginPath(); ctx.moveTo(0, -Math.min(w, h) * 0.31); ctx.lineTo(0, -Math.min(w, h) * 0.285); ctx.stroke();
    ctx.restore();
  }
  // crosshair for other cams
  if (Cam.mode !== 'fpv') {
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(cx - 9, cy - 9, 18, 18);
  }

  /* speed streaks */
  if (spd > 16 && Cam.mode === 'fpv') {
    const k = clamp((spd - 16) / 26, 0, 1) * 0.4;
    ctx.strokeStyle = 'rgba(255,255,255,' + (k * 0.5).toFixed(3) + ')';
    ctx.lineWidth = 1;
    const cx = w / 2, cy = h / 2, R = Math.hypot(w, h) / 2;
    for (let i = 0; i < 16; i++) {
      const seed = Math.floor(simTime * 22) * 7 + i * 13;
      const a = ((seed * 2654435761) % 1024) / 1024 * TAU;
      const r0 = R * (0.5 + ((seed >> 3) % 100) / 260);
      const r1 = r0 + R * (0.06 + ((seed >> 5) % 100) / 700);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  }

  /* ---------- gate direction ---------- */
  {
    const gate = W.gates[Race.nextGate];
    if (gate) {
      const p = m4transformPoint([0, 0, 0], G.viewProj, gate.c);
      const behind = p[3] <= 0;
      let sx = (p[0] / p[3] * 0.5 + 0.5) * w, sy = (1 - (p[1] / p[3] * 0.5 + 0.5)) * h;
      const dist = vdist(D.pos, gate.c);
      const col = Race.finished ? '#889' : (Race.nextGate === 0 ? '#fff' : '#ffd54f');
      if (!behind && sx > 8 && sx < w - 8 && sy > 8 && sy < h - 8) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = col;
        ctx.beginPath();
        const s = 8;
        ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s, sy); ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        txt(Math.round(dist) + 'm', sx, sy + 24, 11, col, 'center');
      } else {
        // edge arrow
        const ang = Math.atan2(behind ? -(sy - h / 2) : (sy - h / 2), behind ? -(sx - w / 2) : (sx - w / 2));
        const R = Math.min(w, h) * 0.38;
        const ax = w / 2 + Math.cos(ang) * R, ay = h / 2 + Math.sin(ang) * R;
        ctx.save();
        ctx.translate(ax, ay); ctx.rotate(ang);
        ctx.fillStyle = col; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
        txt(Math.round(dist) + 'm', ax - Math.cos(ang) * 22, ay - Math.sin(ang) * 22 + 4, 11, col, 'center');
      }
      txt('GATE ' + (Race.finished ? '--' : (Race.nextGate + 1)) + '/' + W.gates.length, w / 2, h - (narrow ? 108 : 124), 12, 'rgba(255,255,255,0.75)', 'center');
    }
  }

  /* ---------- speed / alt / throttle cluster ---------- */
  const bx = 16, byC = h * 0.5;
  // left: altitude + battery
  txt(altAGL.toFixed(1), bx + 34, byC - 6, 24, '#8ecfff', 'right');
  txt('ALT m', bx + 34, byC + 8, 10, 'rgba(160,210,255,0.7)', 'right');
  const battCol = D.battery < 25 ? '#ff7a6e' : '#9fe870';
  txt(D.voltage.toFixed(1) + 'V', bx + 34, byC + 30, 13, battCol, 'right');
  txt(Math.round(D.battery) + '%', bx + 34, byC + 46, 13, battCol, 'right');
  // right: speed
  const rx = w - 16;
  txt(spd.toFixed(1), rx - 34, byC - 6, 24, '#ffd54f', 'left');
  txt('SPD m/s', rx - 34, byC + 8, 10, 'rgba(255,213,79,0.75)', 'left');
  txt('LOAD ' + Math.round(clamp(D.motorAvg, 0, 1.15) * 100) + '%', rx - 34, byC + 30, 12, 'rgba(255,255,255,0.8)', 'left');
  txt('THR ' + Math.round(Input.out.throttle * 100) + '%', rx - 34, byC + 46, 12, 'rgba(255,255,255,0.8)', 'left');

  // bottom center: throttle bar + flight mode
  const tbW = Math.min(240, w * 0.3), tbX = w / 2 - tbW / 2, tbY = h - (narrow ? 42 : 52);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(tbX, tbY, tbW, 8);
  ctx.fillStyle = '#81c784';
  ctx.fillRect(tbX, tbY, tbW * clamp(D.motorAvg, 0, 1), 8);
  txt('THR', tbX - 8, tbY + 8, 11, 'rgba(255,255,255,0.7)', 'right');
  const fmName = { angle: 'ANGLE', horizon: 'HORIZON', acro: 'ACRO' }[P.flightMode];
  txt(fmName + (P.altHold && P.flightMode !== 'acro' ? ' +ALT' : ''), w / 2, tbY - 8, 12, 'rgba(255,255,255,0.85)', 'center');
  if (D.antiCrashOn) txt('ANTI-CRASH', w / 2, tbY + 22, 10, '#7fd7ff', 'center');

  /* ---------- race timing (top center) ---------- */
  {
    const cy2 = 18;
    const elapsed = Race.lapActive ? (D.simTime - Race.lapStart) : null;
    txt(HUD.fmtTime(elapsed), w / 2, cy2 + 20, 26, Race.lapActive ? '#fff' : 'rgba(255,255,255,0.45)', 'center');
    let sub;
    if (P.mode === 'free') sub = 'FREE FLIGHT';
    else if (Race.finished) sub = 'RUN COMPLETE';
    else if (!Race.lapActive) sub = 'CROSS START GATE TO BEGIN — LAP ' + (Race.lapCount + 1) + '/' + P.trialLaps;
    else sub = 'LAP ' + (Race.lapCount + 1) + '/' + P.trialLaps + '  ·  S' + (Race.nextGate === 0 ? W.gates.length : Race.nextGate) + ' ' + HUD.fmtTime(Race.lapActive ? elapsed - (Race.splits[Race.nextGate - 1] || 0) : null);
    txt(sub, w / 2, cy2 + 38, 12, 'rgba(255,255,255,0.8)', 'center');
    const bestT = Race.best ? Race.best.time : null;
    let dl = null;
    if (Race.lapActive && Race.nextGate > 0 && Race.splitDeltas[Race.nextGate - 1] != null) dl = Race.splitDeltas[Race.nextGate - 1];
    else if (Race.lastLap && Race.best && !Race.lapActive) dl = Race.lastLap.time - Race.best.time;
    if (dl != null) {
      txt((dl <= 0 ? '−' : '+') + Math.abs(dl).toFixed(2), w / 2, cy2 + 56, 15, dl <= 0 ? '#69f0ae' : '#ff8a80', 'center');
    }
    if (bestT != null) txt('BEST ' + HUD.fmtTime(bestT), w / 2, cy2 + (dl != null ? 74 : 56), 11, 'rgba(255,255,255,0.65)', 'center');
  }

  /* ---------- warnings ---------- */
  {
    let msg = null, col = '#ff5252';
    if (D.crashed) { msg = 'CRASHED — RECOVERING…'; }
    else if (simTime - Race.missedT < 1.3) { msg = 'MISSED GATE ' + (Race.nextGate === 0 ? 'START' : Race.nextGate) + ' — COME BACK AROUND'; }
    else if (simTime - Race.wrongWayT < 1.1) { msg = 'WRONG WAY'; }
    else if (D.battery <= 0) { msg = 'BATTERY DEAD — PRESS R TO RESET'; }
    else if (D.ceilingFade < 1) { msg = 'ALTITUDE LIMIT — AIR TOO THIN'; col = '#ffd740'; }
    else if (D.battery < 22) { msg = 'LOW BATTERY'; col = '#ffd740'; }
    else if (Math.abs(D.pos[0]) > W.half - 10 || Math.abs(D.pos[2]) > W.half - 10) { msg = 'COURSE BOUNDARY — TURN BACK'; }
    if (msg && (Math.sin(simTime * 9) > -0.4 || D.crashed)) {
      txt(msg, w / 2, h * 0.32, 19, col, 'center', '800');
    }
  }

  /* ---------- compact live overlay (top-left) ---------- */
  if (P.showOverlay) {
    const l = [
      diag.fps.toFixed(0) + ' fps · render ' + G.width + '×' + G.height,
      'POS ' + D.pos[0].toFixed(1) + ' ' + D.pos[1].toFixed(1) + ' ' + D.pos[2].toFixed(1) + ' · SPD ' + spd.toFixed(1) + ' · THR ' + Math.round(Input.out.throttle * 100) + '%',
      'MODE ' + P.mode.toUpperCase() + '/' + fmName + ' · GATE ' + (Race.nextGate + 1) + '/' + W.gates.length + ' · LAP ' + Math.min(Race.lapCount + 1, P.trialLaps) + '/' + P.trialLaps + ' · ' + HUD.fmtTime(Race.lapActive ? D.simTime - Race.lapStart : null),
      'CAM ' + Cam.label + ' · INPUT ' + Input.out.source.toUpperCase() + (Input.pad.connected ? ' (pad ok)' : ' (no gamepad — keyboard)') + ' · HIT ' + (simTime - D.lastCollisionT < 0.5 ? 'YES' : 'no'),
    ];
    ctx.fillStyle = 'rgba(5,8,14,0.55)';
    ctx.fillRect(8, 8, Math.min(w - 16, narrow ? w - 16 : 430), 14 * l.length + 10);
    l.forEach((s, i) => txt(s, 16, 24 + i * 14, 10.5, 'rgba(220,235,255,0.92)'));
  }

  /* ---------- telemetry graph ---------- */
  if (P.showGraph) {
    const gw = narrow ? 150 : 250, gh = narrow ? 78 : 110;
    const gx = w - gw - 12, gy = h - gh - 12;
    ctx.fillStyle = 'rgba(5,8,14,0.6)';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
    const plot = (arr, min, max, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const x = gx + (i / (HUD.graphMax - 1)) * (gw - 8) + 4;
        const y = gy + gh - 6 - clamp((arr[i] - min) / (max - min), -0.05, 1.05) * (gh - 16);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    plot(HUD.graph.alt, Math.min(0, ...HUD.graph.alt), Math.max(12, ...HUD.graph.alt) + 2, '#4fc3f7');
    plot(HUD.graph.spd, 0, Math.max(15, ...HUD.graph.spd) + 2, '#ffd54f');
    plot(HUD.graph.thr, 0, 1.15, '#81c784');
    const ymid = gy + gh - 6 - (0.5) * (gh - 16);
    ctx.strokeStyle = 'rgba(229,115,115,0.35)';
    ctx.beginPath(); ctx.moveTo(gx + 4, ymid); ctx.lineTo(gx + gw - 4, ymid); ctx.stroke();
    plot(HUD.graph.yaw.map(v => v / 540 + 0.5), 0, 1, '#e57373');
    txt('ALT', gx + 8, gy + 12, 9.5, '#4fc3f7');
    txt('SPD', gx + 34, gy + 12, 9.5, '#ffd54f');
    txt('THR', gx + 60, gy + 12, 9.5, '#81c784');
    txt('YAW', gx + 86, gy + 12, 9.5, '#e57373');
    txt('t −' + (HUD.graphMax / 60).toFixed(0) + 's', gx + gw - 8, gy + 12, 9.5, 'rgba(255,255,255,0.5)', 'right');
  }

  /* ---------- extended diagnostics ---------- */
  if (P.showDiag) {
    const lines = [
      'QUAT ' + D.q.map(v => v.toFixed(3)).join(' '),
      'FWD ' + att.fwd.map(v => v.toFixed(2)).join(' ') + ' UP ' + att.up.map(v => v.toFixed(2)).join(' '),
      'VEL ' + D.vel.map(v => v.toFixed(2)).join(' ') + ' |v| ' + spd.toFixed(2),
      'ACC ' + D.accel.map(v => v.toFixed(1)).join(' '),
      'ΩBODY ' + D.w.map(v => (v / DEG).toFixed(0)).join(' ') + ' °/s   ΩACC ' + D.angAccel.map(v => (v / DEG).toFixed(0)).join(' '),
      'CTRL t/y/p/r ' + Input.out.throttle.toFixed(2) + ' ' + Input.out.yaw.toFixed(2) + ' ' + Input.out.pitch.toFixed(2) + ' ' + Input.out.roll.toFixed(2) + ' src=' + Input.out.source,
      'SUBSTEPS ' + diag.substeps + ' h=' + (1 / 240).toFixed(4) + 's  phys ' + diag.physMs.toFixed(2) + 'ms  render ' + diag.rendMs.toFixed(2) + 'ms',
      'CONTACTS last ' + diag.lastContacts + '  impacts ' + D.collisionCount + '  instab ' + D.instabResets,
      'MOTORS ' + D.motors.map(v => v.toFixed(2)).join(' '),
      'GHOST rec ' + Race.ghostRec.length + '  samples, best ' + (Race.best ? Race.best.time.toFixed(3) + 's' : 'none'),
      'DRAWS ' + G.stats.drawCalls + '  tris ' + (diag.tris / 1000).toFixed(0) + 'k  parts ' + FX.parts.length,
    ];
    const y0 = (P.showOverlay ? 78 : 24);
    ctx.fillStyle = 'rgba(5,8,14,0.55)';
    ctx.fillRect(8, y0, 470, 14 * lines.length + 8);
    lines.forEach((s, i) => txt(s, 14, y0 + 16 + i * 14, 10, 'rgba(190,255,210,0.95)', 'left', '500'));
  }

  /* ---------- touch sticks ---------- */
  if (Input.touch.left || Input.touch.right) {
    for (const side of ['left', 'right']) {
      const pt = Input.touch[side];
      if (!pt) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pt.x0, pt.y0, 46, 0, TAU); ctx.stroke();
      const dx = clamp(pt.x - pt.x0, -46, 46), dy = clamp(pt.y - pt.y0, -46, 46);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(pt.x0 + dx, pt.y0 + dy, 18, 0, TAU); ctx.fill();
    }
  }

  /* ---------- first-run hint ---------- */
  if (HUD.hintT > 0 && !UI.helpOpen) {
    HUD.hintT -= dtReal;
    const a = clamp(HUD.hintT / 3, 0, 1);
    ctx.globalAlpha = a;
    txt('W/S throttle · A/D yaw · ↑↓←→ pitch/roll · C camera · R restart · TAB settings · H help', w / 2, h - (narrow ? 78 : 84), 12.5, 'rgba(255,255,255,0.92)', 'center');
    ctx.globalAlpha = 1;
  }
};
