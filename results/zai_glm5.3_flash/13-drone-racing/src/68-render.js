'use strict';
/* ============================= renderer ============================= */
const REN = {
  inited: false, fsq: null, propBuf: null, propModel: m4ident(),
  LINES: null, droneModel: m4ident(), ghostModel: m4ident(),
  tmpM: m4ident(), tmpM2: m4ident(), tmpQ: qid(), tmpV: v3(), tmpV2: v3(),
};
const GATE_COLORS = { next: [1.0, 0.82, 0.25], passed: [0.25, 1.0, 0.45], future: [0.3, 0.75, 1.0], finish: [0.95, 0.95, 1.0], dim: [0.4, 0.44, 0.5] };

function renderInit(gl) {
  REN.fsq = fsQuad(gl);
  const pb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  REN.propBuf = pb;
  const bb = gl.createBuffer();
  REN.LINES = { vbo: bb, data: new Float32Array(3 * 7 * 6000), n: 0 };
  // drone mesh (body +Y up, nose -Z)
  const db = new MeshBuilder(1 << 12);
  db.setColor([0.42, 0.45, 0.52]); db.setData([0, 0, 0, 0]);
  db.addBox(0, 0, 0.01, 0.19, 0.055, 0.28, 0);            // body
  db.setColor([0.16, 0.17, 0.2]);
  db.addBox(0, -0.01, -0.155, 0.09, 0.045, 0.05, 0);      // camera pod front
  db.setColor([1, 0.1, 0.08]); db.setData([3, 0, 0, 0]);  // rear LED (emissive red)
  db.addBox(0, 0.005, 0.15, 0.05, 0.03, 0.02, 0);
  db.setColor([0.5, 0.53, 0.6]); db.setData([0, 0, 0, 0]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    db.addBox(sx * 0.105, 0, sz * 0.105, 0.16, 0.022, 0.022, Math.atan2(sz, sx) + Math.PI / 2);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    db.setColor([0.3, 0.31, 0.36]);
    db.addCylinder(sx * 0.17, 0.008, sz * 0.17, 0.026, 0.026, 0.045, 8, true);
  }
  REN.droneMesh = db.build();
  REN.inited = true;
}

const PROP_OFFSETS = [[-0.17, 0.035, -0.17], [0.17, 0.035, -0.17], [0.17, 0.035, 0.17], [-0.17, 0.035, 0.17]];

function litUniforms(gl, prog, env, time, nightBoost) {
  const sky = env.sky;
  gl.uniform3f(prog.u.uSunDir, sky.sunDir[0], sky.sunDir[1], sky.sunDir[2]);
  gl.uniform3f(prog.u.uSunCol, sky.sun[0], sky.sun[1], sky.sun[2]);
  gl.uniform3f(prog.u.uSkyCol, sky.hemiSky[0], sky.hemiSky[1], sky.hemiSky[2]);
  gl.uniform3f(prog.u.uGndCol, sky.hemiGnd[0], sky.hemiGnd[1], sky.hemiGnd[2]);
  gl.uniform3f(prog.u.uCamPos, G.camPos[0], G.camPos[1], G.camPos[2]);
  gl.uniform3f(prog.u.uFogCol, env.fog.col[0], env.fog.col[1], env.fog.col[2]);
  gl.uniform1f(prog.u.uFogDen, P.haze ? env.fog.den : env.fog.den * 0.25);
  gl.uniform1f(prog.u.uNight, sky.night * (nightBoost || 1));
  gl.uniform1f(prog.u.uTime, time);
  gl.uniform1f(prog.u.uSpec, 0.35);
  gl.uniform1f(prog.u.uShin, 26);
  gl.uniform1f(prog.u.uMatOverride, -1);
  gl.uniform1f(prog.u.uAlpha, 1);
}

function setMat(gl, prog, model) {
  gl.uniformMatrix4fv(prog.u.uModel, false, model);
  gl.uniformMatrix4fv(prog.u.uNrmMat, false, model);
}

/* ---- dynamic line batch ---- */
function linesBegin() { REN.LINES.n = 0; }
function linesSeg(a, b, r, g, bl, al) {
  const L = REN.LINES;
  if (L.n * 14 + 14 > L.data.length) return;
  const o = L.n * 14;
  const d = L.data;
  d[o] = a[0]; d[o + 1] = a[1]; d[o + 2] = a[2]; d[o + 3] = r; d[o + 4] = g; d[o + 5] = bl; d[o + 6] = al;
  d[o + 7] = b[0]; d[o + 8] = b[1]; d[o + 9] = b[2]; d[o + 10] = r; d[o + 11] = g; d[o + 12] = bl; d[o + 13] = al;
  L.n++;
}
function linesFlush(gl, proj, view) {
  const L = REN.LINES;
  if (!L.n) return;
  const prog = G.progs.line;
  gl.useProgram(prog.prog);
  gl.uniformMatrix4fv(prog.u.uProj, false, proj);
  gl.uniformMatrix4fv(prog.u.uView, false, view);
  gl.bindBuffer(gl.ARRAY_BUFFER, L.vbo);
  gl.bufferData(gl.ARRAY_BUFFER, L.data.subarray(0, L.n * 14), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(prog.a.aPos); gl.vertexAttribPointer(prog.a.aPos, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(prog.a.aCol); gl.vertexAttribPointer(prog.a.aCol, 4, gl.FLOAT, false, 28, 12);
  gl.drawArrays(gl.LINES, 0, L.n * 2);
  G.stats.drawCalls++;
  L.n = 0;
}

function renderFrame(simTime, dtReal) {
  const gl = G.gl;
  const env = W.env;
  G.stats.drawCalls = 0;
  const postOn = P.postFX;
  // scene always renders into the FBO; post pass copies to screen (neutral when effects off)
  fboEnsure(gl, G.width, G.height);
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
  gl.viewport(0, 0, G.width, G.height);
  gl.clearColor(env.fog.col[0], env.fog.col[1], env.fog.col[2], 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* camera matrices */
  m4perspective(G.proj, Cam.fov * DEG, G.width / Math.max(1, G.height), 0.06, 1400);
  m4fromQuatPos(REN.tmpM, Cam.quat, Cam.eye);
  m4invert(G.view, REN.tmpM);
  m4mul(G.viewProj, G.proj, G.view);
  m4invert(G.invVP, G.viewProj);
  vcopy(G.camPos, Cam.eye);

  /* sky */
  {
    const prog = G.progs.sky;
    gl.useProgram(prog.prog);
    gl.depthMask(false);
    gl.uniformMatrix4fv(prog.u.uInvVP, false, G.invVP);
    gl.uniform3f(prog.u.uCamPos, Cam.eye[0], Cam.eye[1], Cam.eye[2]);
    const sky = env.sky;
    gl.uniform3f(prog.u.uSunDir, sky.sunDir[0], sky.sunDir[1], sky.sunDir[2]);
    gl.uniform3f(prog.u.uTop, sky.top[0], sky.top[1], sky.top[2]);
    gl.uniform3f(prog.u.uHorizon, sky.horizon[0], sky.horizon[1], sky.horizon[2]);
    gl.uniform3f(prog.u.uGround, sky.ground[0], sky.ground[1], sky.ground[2]);
    gl.uniform3f(prog.u.uSunCol, sky.sun[0], sky.sun[1], sky.sun[2]);
    gl.uniform1f(prog.u.uNight, sky.night);
    gl.uniform1f(prog.u.uTime, simTime);
    gl.bindBuffer(gl.ARRAY_BUFFER, REN.fsq);
    gl.enableVertexAttribArray(prog.a.aPos);
    gl.vertexAttribPointer(prog.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    G.stats.drawCalls++;
    gl.depthMask(true);
  }

  /* lit geometry */
  {
    const prog = G.progs.lit;
    gl.useProgram(prog.prog);
    gl.uniformMatrix4fv(prog.u.uProj, false, G.proj);
    gl.uniformMatrix4fv(prog.u.uView, false, G.view);
    litUniforms(gl, prog, env, simTime, 1);
    gl.uniform3f(prog.u.uTint, 1, 1, 1);
    gl.uniform3f(prog.u.uEmis, 0.85, 0.85, 0.85);
    m4ident(REN.tmpM);
    setMat(gl, prog, REN.tmpM);
    meshBindDraw(gl, prog, W.meshTerrain);
    meshBindDraw(gl, prog, W.meshProps);
    meshBindDraw(gl, prog, W.meshPad);

    /* gates */
    for (let i = 0; i < W.gates.length; i++) {
      const g = W.gates[i];
      let col, pulse, amp = 0.22, spd = 2.2;
      if (Race.finished) { col = GATE_COLORS.dim; pulse = 0.9; }
      else if (i === Race.nextGate) { col = g.kind === 'finish' ? GATE_COLORS.finish : GATE_COLORS.next; amp = 0.32; spd = 5.2; }
      else if (Race.lapActive && i < Race.nextGate) { col = GATE_COLORS.passed; amp = 0.1; }
      else { col = GATE_COLORS.future; spd = 1.6; }
      pulse = 0.78 + amp * Math.sin(simTime * spd + i * 1.31);
      const em = col;
      gl.uniform3f(prog.u.uEmis, em[0] * pulse, em[1] * pulse, em[2] * pulse);
      // orient torus +Z to gate normal
      const n = g.n, zz = [0, 0, 1];
      let axis = vcross(REN.tmpV, zz, n);
      let dotz = clamp(n[2], -1, 1);
      if (vlen2(axis) < 1e-6) axis = [1, 0, 0];
      qaxisAngle(REN.tmpQ, axis, Math.acos(dotz));
      m4fromQuatPos(REN.tmpM, REN.tmpQ, g.c, g.R);
      setMat(gl, prog, REN.tmpM);
      meshBindDraw(gl, prog, W.meshGate);
    }

    /* drone */
    if (!D.hideModel) {
      m4fromQuatPos(REN.droneModel, D.q, D.pos);
      setMat(gl, prog, REN.droneModel);
      gl.uniform3f(prog.u.uEmis, 1.6, 0.12, 0.1); // rear LED glow
      meshBindDraw(gl, prog, REN.droneMesh);
      gl.uniform3f(prog.u.uEmis, 0.85, 0.85, 0.85);
    }
  }

  /* blob / contact shadow */
  if (P.shadows && !D.crashed) {
    const gh = W.height(D.pos[0], D.pos[2]);
    const alt = D.pos[1] - gh;
    if (alt < 26) {
      const n = W.normal(D.pos[0], D.pos[2], [0, 0, 0]);
      const s = 0.85 + alt * 0.28;
      const a = 0.42 * Math.exp(-alt * 0.14) * clamp(alt * 2, 0, 1);
      const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const r = vnorm([0, 0, 0], vcross([0, 0, 0], n, helper));
      const u2 = vcross([0, 0, 0], n, r);
      const m = REN.tmpM;
      m[0] = r[0] * s; m[1] = r[1] * s; m[2] = r[2] * s; m[3] = 0;
      m[4] = n[0]; m[5] = n[1]; m[6] = n[2]; m[7] = 0;
      m[8] = u2[0] * s; m[9] = u2[1] * s; m[10] = u2[2] * s; m[11] = 0;
      m[12] = D.pos[0] + n[0] * 0.07; m[13] = gh + n[1] * 0.07; m[14] = D.pos[2] + n[2] * 0.07; m[15] = 1;
      const prog = G.progs.blob;
      gl.useProgram(prog.prog);
      gl.uniformMatrix4fv(prog.u.uProj, false, G.proj);
      gl.uniformMatrix4fv(prog.u.uView, false, G.view);
      gl.uniformMatrix4fv(prog.u.uModel, false, m);
      gl.uniform1f(prog.u.uAlpha, a);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, REN.propBuf);
      gl.enableVertexAttribArray(prog.a.aPos);
      gl.vertexAttribPointer(prog.a.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      G.stats.drawCalls++;
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }

  /* prop discs (additive) */
  if (!D.crashed && D.motorAvg > 0.03) {
    const prog = G.progs.prop;
    gl.useProgram(prog.prog);
    gl.uniformMatrix4fv(prog.u.uProj, false, G.proj);
    gl.uniformMatrix4fv(prog.u.uView, false, G.view);
    gl.uniform1f(prog.u.uAlpha, clamp(0.25 + D.motorAvg * 0.75, 0, 1));
    gl.uniform3f(prog.u.uCol, 0.75, 0.78, 0.85);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, REN.propBuf);
    gl.enableVertexAttribArray(prog.a.aPos);
    gl.vertexAttribPointer(prog.a.aPos, 2, gl.FLOAT, false, 0, 0);
    const local = REN.tmpM2;
    for (let i = 0; i < 4; i++) {
      const o = PROP_OFFSETS[i];
      // lay quad flat in body XZ plane: local(x,y,0) -> body(x, o.y, y) + offset
      local[0] = 1; local[1] = 0; local[2] = 0; local[3] = 0;
      local[4] = 0; local[5] = 0; local[6] = 1; local[7] = 0;
      local[8] = 0; local[9] = 1; local[10] = 0; local[11] = 0;
      local[12] = o[0]; local[13] = o[1]; local[14] = o[2]; local[15] = 1;
      m4mul(REN.tmpM, REN.droneModel, local);
      gl.uniformMatrix4fv(prog.u.uModel, false, REN.tmpM);
      gl.uniform1f(prog.u.uSpin, D.propSpin * (i % 2 === 0 ? 1 : -1) + i * 2.1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      G.stats.drawCalls++;
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /* ghost drone */
  if (P.ghostVisible && Race.lapActive) {
    const gp = Race.ghostPose(vlen3_elapsed());
    if (gp) {
      const prog = G.progs.lit;
      gl.useProgram(prog.prog);
      m4fromQuatPos(REN.ghostModel, gp.q, gp.pos);
      setMat(gl, prog, REN.ghostModel);
      gl.uniform3f(prog.u.uTint, 0.1, 0.1, 0.12);
      gl.uniform3f(prog.u.uEmis, 0.9, 1.9, 2.4);
      gl.uniform1f(prog.u.uMatOverride, 3);
      gl.uniform1f(prog.u.uAlpha, 0.5);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      meshBindDraw(gl, prog, REN.droneMesh);
      gl.uniform1f(prog.u.uMatOverride, -1);
      gl.uniform1f(prog.u.uAlpha, 1);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.uniform3f(prog.u.uTint, 1, 1, 1);
      gl.uniform3f(prog.u.uEmis, 0.85, 0.85, 0.85);
    }
  }

  /* particles */
  if (FX.parts.length) {
    FX.fill(gl);
    const prog = G.progs.particle;
    gl.useProgram(prog.prog);
    gl.uniformMatrix4fv(prog.u.uProj, false, G.proj);
    gl.uniformMatrix4fv(prog.u.uView, false, G.view);
    const pointScale = G.height / (2 * Math.tan(Cam.fov * DEG * 0.5));
    gl.uniform1f(prog.u.uPointScale, pointScale);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    FX.draw(gl, prog, 'add');
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    FX.draw(gl, prog, 'dust');
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /* diagnostics + racing line */
  if (P.showDiag || P.showVolumes || P.ghostTrail) buildDiagnosticLines(simTime);
  if (REN.LINES.n) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    linesFlush(gl, G.proj, G.view);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /* post pass to screen */
  {
    const prog = G.progs.post;
    gl.useProgram(prog.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, G.width, G.height);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, G.fboTex);
    gl.uniform1i(prog.u.uTex, 0);
    gl.uniform2f(prog.u.uRes, G.width, G.height);
    const fpv = Cam.mode === 'fpv';
    gl.uniform1f(prog.u.uVig, postOn ? (fpv ? 0.34 : 0.2) : 0);
    gl.uniform1f(prog.u.uDistort, postOn && fpv ? 0.11 : 0);
    gl.uniform1f(prog.u.uAberr, postOn && fpv ? 0.55 : 0);
    gl.uniform1f(prog.u.uExpo, 1.04);
    gl.uniform1f(prog.u.uSat, postOn ? 1.07 : 1);
    gl.uniform1f(prog.u.uNoise, postOn ? 0.014 : 0);
    gl.uniform1f(prog.u.uTime, simTime);
    gl.bindBuffer(gl.ARRAY_BUFFER, REN.fsq);
    gl.enableVertexAttribArray(prog.a.aPos);
    gl.vertexAttribPointer(prog.a.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    G.stats.drawCalls++;
    gl.enable(gl.DEPTH_TEST);
  }
}

/* elapsed of current lap for ghost playback */
function vlen3_elapsed() {
  return Race.lapActive ? (D.simTime - Race.lapStart) : 0;
}

function buildDiagnosticLines(simTime) {
  linesBegin();
  if (P.ghostTrail) {
    const pts = Race.ghostPoints();
    if (pts) {
      for (let i = 1; i < pts.length; i++) {
        const a = (i / pts.length) * 0.5;
        linesSeg(pts[i - 1], pts[i], 0.3, 0.9, 1.0, a);
      }
    }
  }
  if (P.showVolumes) {
    for (let i = 0; i < W.gates.length; i++) {
      const g = W.gates[i];
      const col = i === Race.nextGate ? [1, 1, 0.2, 0.9] : [0.4, 0.8, 1, 0.35];
      const up = vcross([0, 0, 0], g.n, g.right);
      const SEG = 36;
      for (let k = 0; k < SEG; k++) {
        const a0 = k / SEG * TAU, a1 = (k + 1) / SEG * TAU;
        const p0 = [g.c[0] + g.right[0] * Math.cos(a0) * g.R + up[0] * Math.sin(a0) * g.R,
          g.c[1] + g.right[1] * Math.cos(a0) * g.R + up[1] * Math.sin(a0) * g.R,
          g.c[2] + g.right[2] * Math.cos(a0) * g.R + up[2] * Math.sin(a0) * g.R];
        const p1 = [g.c[0] + g.right[0] * Math.cos(a1) * g.R + up[0] * Math.sin(a1) * g.R,
          g.c[1] + g.right[1] * Math.cos(a1) * g.R + up[1] * Math.sin(a1) * g.R,
          g.c[2] + g.right[2] * Math.cos(a1) * g.R + up[2] * Math.sin(a1) * g.R];
        linesSeg(p0, p1, col[0], col[1], col[2], col[3]);
      }
    }
  }
  if (P.showDiag) {
    // body axes: forward red, up green, right blue
    const att = droneAttitude(D);
    const p = D.pos;
    linesSeg(p, [p[0] + att.fwd[0] * 0.9, p[1] + att.fwd[1] * 0.9, p[2] + att.fwd[2] * 0.9], 1, 0.2, 0.2, 1);
    linesSeg(p, [p[0] + att.up[0] * 0.7, p[1] + att.up[1] * 0.7, p[2] + att.up[2] * 0.7], 0.2, 1, 0.3, 1);
    linesSeg(p, [p[0] + att.right[0] * 0.7, p[1] + att.right[1] * 0.7, p[2] + att.right[2] * 0.7], 0.25, 0.4, 1, 1);
    // velocity vector
    if (vlen2(D.vel) > 0.04) {
      const ve = [p[0] + D.vel[0] * 0.28, p[1] + D.vel[1] * 0.28, p[2] + D.vel[2] * 0.28];
      linesSeg(p, ve, 0.2, 1, 1, 0.95);
      linesSeg(ve, [ve[0] - D.vel[0] * 0.05 + 0.1, ve[1] - D.vel[1] * 0.05, ve[2] - D.vel[2] * 0.05], 0.2, 1, 1, 0.6);
      linesSeg(ve, [ve[0] - D.vel[0] * 0.05 - 0.1, ve[1] - D.vel[1] * 0.05, ve[2] - D.vel[2] * 0.05], 0.2, 1, 1, 0.6);
    }
    // collision bounds: 3 great circles of the collision sphere
    const r = DRONE_R * 1.02;
    for (let k = 0; k < 3; k++) {
      const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]][k], ay = [[0, 1, 0], [1, 0, 0], [0, 0, 1]][k];
      for (let i = 0; i < 20; i++) {
        const a0 = i / 20 * TAU, a1 = (i + 1) / 20 * TAU;
        const p0 = [p[0] + (ax[0] * Math.cos(a0) + ay[0] * Math.sin(a0)) * r, p[1] + (ax[1] * Math.cos(a0) + ay[1] * Math.sin(a0)) * r, p[2] + (ax[2] * Math.cos(a0) + ay[2] * Math.sin(a0)) * r];
        const p1 = [p[0] + (ax[0] * Math.cos(a1) + ay[0] * Math.sin(a1)) * r, p[1] + (ax[1] * Math.cos(a1) + ay[1] * Math.sin(a1)) * r, p[2] + (ax[2] * Math.cos(a1) + ay[2] * Math.sin(a1)) * r];
        linesSeg(p0, p1, 1, 0.55, 0.1, 0.8);
      }
    }
  }
}
