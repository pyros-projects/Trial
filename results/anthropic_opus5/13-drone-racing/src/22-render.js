/* ============================================================================
   RENDERER — shadow pass, scene pass, additive glow, particles, bloom, post.
   All geometry is instanced where it repeats; the terrain and the airframe are
   single meshes with a model matrix.
   ========================================================================== */

const INST_STRIDE = 16;      /* floats per instance: pos+mat, quat, scale+em, col+seed */

const QUALITY_PRESETS = {
  potato: { shadow: 0, bloom: 0, particles: 0.35, renderScale: 0.55, grain: 0.0, chroma: 0.0, drawDist: 440, terrainStep: 4 },
  low: { shadow: 512, bloom: 0, particles: 0.6, renderScale: 0.75, grain: 0.012, chroma: 0.0006, drawDist: 620, terrainStep: 2 },
  medium: { shadow: 1024, bloom: 1, particles: 1.0, renderScale: 1.0, grain: 0.018, chroma: 0.0011, drawDist: 900, terrainStep: 1 },
  high: { shadow: 2048, bloom: 1, particles: 1.5, renderScale: 1.0, grain: 0.022, chroma: 0.0016, drawDist: 1400, terrainStep: 1 }
};

class ParticleSystem {
  constructor(max = 1400) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.col = new Float32Array(max * 3);
    this.kind = new Uint8Array(max); this.drag = new Float32Array(max);
    this.data = new Float32Array(max * 12);   /* aPPos, aPCol, aPVel */
    this.rng = makeRng('PARTICLES');
  }
  clear() { this.n = 0; }
  spawn(p, v, life, size, col, kind, drag) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = Math.floor(this.rng() * this.max);
    this.pos[i * 3] = p[0]; this.pos[i * 3 + 1] = p[1]; this.pos[i * 3 + 2] = p[2];
    this.vel[i * 3] = v[0]; this.vel[i * 3 + 1] = v[1]; this.vel[i * 3 + 2] = v[2];
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
    this.col[i * 3] = col[0]; this.col[i * 3 + 1] = col[1]; this.col[i * 3 + 2] = col[2];
    this.kind[i] = kind; this.drag[i] = drag == null ? 1.6 : drag;
  }
  burst(p, n, opts) {
    const o = opts || {}, r = this.rng;
    for (let k = 0; k < n; k++) {
      const dir = [r.gauss(), r.gauss(), r.gauss()];
      const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const s = (o.speed || 6) * (0.35 + r() * 0.9);
      const v = [dir[0] / l * s + (o.bias ? o.bias[0] : 0), dir[1] / l * s + (o.bias ? o.bias[1] : 0), dir[2] / l * s + (o.bias ? o.bias[2] : 0)];
      const c = o.color || [1, 0.75, 0.35];
      const jitter = 0.75 + r() * 0.5;
      this.spawn(p, v, (o.life || 0.7) * jitter, (o.size || 0.22) * jitter, [c[0] * jitter, c[1] * jitter, c[2] * jitter], o.kind || 1, o.drag);
    }
  }
  update(dt, gravity) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      const k = this.kind[i];
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d + (k === 1 ? -gravity * 0.55 : (k === 0 ? 0.7 : 0)) * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (w !== i) {
        for (let c = 0; c < 3; c++) {
          this.pos[w * 3 + c] = this.pos[i * 3 + c]; this.vel[w * 3 + c] = this.vel[i * 3 + c]; this.col[w * 3 + c] = this.col[i * 3 + c];
        }
        this.life[w] = this.life[i]; this.maxLife[w] = this.maxLife[i];
        this.size[w] = this.size[i]; this.kind[w] = this.kind[i]; this.drag[w] = this.drag[i];
      }
      w++;
    }
    this.n = w;
  }
  pack() {
    const d = this.data;
    for (let i = 0; i < this.n; i++) {
      const t = clamp(this.life[i] / Math.max(0.001, this.maxLife[i]), 0, 1);
      const k = this.kind[i];
      const fade = k === 1 ? t * t : (k === 2 ? Math.sin(t * Math.PI) : t);
      const o = i * 12;
      d[o] = this.pos[i * 3]; d[o + 1] = this.pos[i * 3 + 1]; d[o + 2] = this.pos[i * 3 + 2];
      d[o + 3] = this.size[i] * (k === 0 ? (1.8 - t) : 1.0);
      d[o + 4] = this.col[i * 3]; d[o + 5] = this.col[i * 3 + 1]; d[o + 6] = this.col[i * 3 + 2];
      d[o + 7] = fade * (k === 0 ? 0.55 : 1.0);
      d[o + 8] = this.vel[i * 3]; d[o + 9] = this.vel[i * 3 + 1]; d[o + 10] = this.vel[i * 3 + 2];
      d[o + 11] = k === 2 ? 6.0 : (k === 1 ? 1.6 : 0.0);
    }
    return this.n;
  }
}

/* -------------------------------------------------------------- cameras --- */
const CAMERA_MODES = [
  { id: 'fpv', name: 'FPV', blurb: 'Pilot view from the camera pod, lens distortion and all.' },
  { id: 'chase', name: 'Chase', blurb: 'Spring-damped follow camera behind the airframe.' },
  { id: 'orbit', name: 'Orbit', blurb: 'Free orbit around the quad — drag to rotate, wheel to zoom.' },
  { id: 'track', name: 'Trackside', blurb: 'Fixed course cameras that hand off as you pass.' }
];

class CameraRig {
  constructor() {
    this.mode = 0;
    this.pos = V3.new(); this.quat = Q.new();
    this.fov = 100; this.tilt = 22;
    this.chasePos = V3.new(); this.chaseLook = V3.new(); this.chaseInit = false;
    this.orbitYaw = 0.7; this.orbitPitch = 0.28; this.orbitDist = 5.0; this.orbitAuto = true;
    this.trackIdx = 0; this.trackHold = 0;
    this.shake = 0; this.fovNow = 100;
    this._m = M4.new(); this._t = V3.new(); this._t2 = V3.new(); this._q = Q.new();
  }
  get id() { return CAMERA_MODES[this.mode].id; }
  cycle(d) { this.mode = (this.mode + (d || 1) + CAMERA_MODES.length) % CAMERA_MODES.length; return this.id; }
  set(i) { this.mode = clamp(i | 0, 0, CAMERA_MODES.length - 1); return this.id; }

  update(dt, drone, course, opts) {
    const o = opts || {};
    this.shake = Math.max(0, this.shake - dt * 2.6);
    const id = this.id;
    const speed = drone.speed();
    if (id === 'fpv') {
      const off = this._t;
      V3.set(off, 0, 0.055, -0.075);
      Q.rot(off, drone.q, off);
      V3.add(this.pos, drone.p, off);
      Q.fromAxisAngle(this._q, 1, 0, 0, this.tilt * DEG);
      Q.mul(this.quat, drone.q, this._q);
      this.fovNow = damp(this.fovNow, this.fov + clamp(speed * 0.30, 0, 16), 8, dt);
    } else if (id === 'chase') {
      const yaw = Q.yawOf(drone.q);
      const back = this._t;
      /* trail behind the *velocity* when moving, behind the nose when hovering */
      let hx = -Math.sin(yaw), hz = -Math.cos(yaw);
      if (speed > 4) { const l = Math.hypot(drone.v[0], drone.v[2]) || 1; hx = drone.v[0] / l; hz = drone.v[2] / l; }
      V3.set(back, drone.p[0] - hx * 3.3, drone.p[1] + 0.95, drone.p[2] - hz * 3.3);
      if (course) back[1] = Math.max(back[1], course.terrain.at(back[0], back[2]) + 0.9);
      if (!this.chaseInit) { V3.copy(this.chasePos, back); V3.copy(this.chaseLook, drone.p); this.chaseInit = true; }
      V3.set(this.chasePos, damp(this.chasePos[0], back[0], 7, dt), damp(this.chasePos[1], back[1], 6, dt), damp(this.chasePos[2], back[2], 7, dt));
      V3.set(this.chaseLook, damp(this.chaseLook[0], drone.p[0], 14, dt), damp(this.chaseLook[1], drone.p[1], 14, dt), damp(this.chaseLook[2], drone.p[2], 14, dt));
      this._clearPath(course, drone.p, this.chasePos, 1.1);
      this._lookAt(this.chaseLook);
      this.fovNow = damp(this.fovNow, clamp(this.fov * 0.82, 45, 110) + clamp(speed * 0.22, 0, 12), 6, dt);
    } else if (id === 'orbit') {
      if (this.orbitAuto && !o.orbitDrag) this.orbitYaw += dt * 0.22;
      const cp = Math.cos(this.orbitPitch), sp = Math.sin(this.orbitPitch);
      const want = this._t4 || (this._t4 = V3.new());
      V3.set(want,
        drone.p[0] + Math.sin(this.orbitYaw) * cp * this.orbitDist,
        drone.p[1] + sp * this.orbitDist,
        drone.p[2] + Math.cos(this.orbitYaw) * cp * this.orbitDist);
      if (course) want[1] = Math.max(want[1], course.terrain.at(want[0], want[2]) + 0.8);
      this._clearPath(course, drone.p, want, 1.2);
      this._lookAt(drone.p);
      this.fovNow = damp(this.fovNow, clamp(this.fov * 0.72, 40, 95), 6, dt);
    } else {
      const cams = course && course.trackCams;
      if (cams && cams.length) {
        this.trackHold -= dt;
        let best = this.trackIdx, bestD = 1e9;
        for (let i = 0; i < cams.length; i++) {
          let d = V3.dist(cams[i], drone.p);
          if (course && course.grid) {
            /* penalise poles whose view is blocked */
            this._clearPath(course, drone.p, cams[i], 1.0);
            if (V3.dist(this.pos, cams[i]) > 2.5) d += 400;
          }
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best !== this.trackIdx && this.trackHold <= 0) { this.trackIdx = best; this.trackHold = 1.1; }
        V3.copy(this.pos, cams[this.trackIdx]);
      } else V3.set(this.pos, drone.p[0] + 25, drone.p[1] + 12, drone.p[2] + 25);
      this._lookAt(drone.p);
      const d = V3.dist(this.pos, drone.p);
      this.fovNow = damp(this.fovNow, clamp(64 - d * 0.22, 12, 64), 4, dt);
    }
    if (this.shake > 0.001) {
      const s = this.shake * 0.05;
      this.pos[0] += (Math.random() - 0.5) * s; this.pos[1] += (Math.random() - 0.5) * s; this.pos[2] += (Math.random() - 0.5) * s;
    }
  }
  /** march from the craft toward the wanted camera spot and stop short of the
      first solid thing, so external cameras never end up inside a building */
  _clearPath(course, target, desired, minDist) {
    if (!course || !course.grid) { V3.copy(this.pos, desired); return; }
    const dir = this._t2;
    V3.sub(dir, desired, target);
    const maxD = V3.len(dir);
    if (maxD < 1e-4) { V3.copy(this.pos, desired); return; }
    V3.mul(dir, dir, 1 / maxD);
    const probe = this._t3 || (this._t3 = V3.new());
    const near = this._nearIdx || (this._nearIdx = []);
    let hit = maxD;
    for (let t = minDist; t <= maxD; t += 0.6) {
      V3.addScaled(probe, target, dir, t);
      if (probe[1] < course.terrain.at(probe[0], probe[2]) + 0.5) { hit = t - 0.6; break; }
      course.grid.query(probe[0], probe[2], 1.2, near);
      let blocked = false;
      for (let k = 0; k < near.length; k++) {
        const c = course.colliders[near[k]];
        if (c.kind === 'gate' || c.kind === 'gateleg') continue;
        if (colliderDistance(c, probe) < 0.9) { blocked = true; break; }
      }
      if (blocked) { hit = t - 0.6; break; }
    }
    hit = clamp(hit, minDist, maxD);
    V3.addScaled(this.pos, target, dir, hit);
  }

  _lookAt(target) {
    const f = this._t2;
    V3.sub(f, target, this.pos);
    const l = V3.len(f);
    if (l < 1e-5) return;
    V3.mul(f, f, 1 / l);
    const yaw = Math.atan2(-f[0], -f[2]);
    const pitch = Math.asin(clamp(f[1], -1, 1));
    const qy = Q.fromAxisAngle(Q.new(), 0, 1, 0, yaw);
    const qx = Q.fromAxisAngle(Q.new(), 1, 0, 0, pitch);
    Q.mul(this.quat, qy, qx);
  }
}

/* ------------------------------------------------------------- renderer --- */
class Renderer {
  constructor(glc) {
    this.glc = glc; this.gl = glc.gl;
    this.view = M4.new(); this.proj = M4.new(); this.viewProj = M4.new();
    this.invViewProj = M4.new(); this.model = M4.new(); this.shadowMat = M4.new();
    this.tmpM = M4.new(); this.tmpM2 = M4.new();
    this.camRight = V3.new(); this.camUp = V3.new(); this.camFwd = V3.new();
    this.width = 1; this.height = 1; this.renderW = 1; this.renderH = 1;
    this.quality = 'medium'; this.shadowSize = 0;
    this.stats = { drawCalls: 0, tris: 0, instances: 0, particles: 0 };
    this._buildPrograms();
    this._buildMeshes();
    this.lineData = new Float32Array(4096 * 7);
    this.lineBufPos = glc.buffer(new Float32Array(4096 * 3), this.gl.ARRAY_BUFFER, this.gl.DYNAMIC_DRAW);
    this.lineBufCol = glc.buffer(new Float32Array(4096 * 4), this.gl.ARRAY_BUFFER, this.gl.DYNAMIC_DRAW);
    this.linePos = new Float32Array(4096 * 3); this.lineCol = new Float32Array(4096 * 4); this.lineN = 0;
    this.particles = new ParticleSystem(1400);
    this.partBuf = glc.buffer(this.particles.data, this.gl.ARRAY_BUFFER, this.gl.DYNAMIC_DRAW);
    this.glowBuf = glc.buffer(new Float32Array(64 * 12), this.gl.ARRAY_BUFFER, this.gl.DYNAMIC_DRAW);
    this.glowData = new Float32Array(64 * 12);
    this.gateInstData = null; this.gateBuf = null;
  }

  _buildPrograms() {
    const g = this.glc;
    const INST = '#define INSTANCED 1\n';
    this.pSky = g.program('sky', SKY_VS, SKY_FS, ['aPos']);
    this.pScene = g.program('scene', SCENE_VS, SCENE_FS, ['aPos', 'aNrm', 'aCol']);
    this.pSceneI = g.program('sceneI', INST + SCENE_VS, INST + SCENE_FS, ['aPos', 'aNrm', 'aCol', 'aIPos', 'aIQuat', 'aIScale', 'aICol']);
    this.pDepth = g.program('depth', DEPTH_VS, DEPTH_FS, ['aPos']);
    this.pDepthI = g.program('depthI', INST + DEPTH_VS, INST + DEPTH_FS, ['aPos', 'aIPos', 'aIQuat', 'aIScale']);
    this.pGlow = g.program('glow', GLOW_VS, GLOW_FS, ['aPos', 'aCol', 'aPPos', 'aPCol', 'aPVel']);
    this.pLine = g.program('line', LINE_VS, LINE_FS, ['aPos', 'aCol']);
    this.pPost = g.program('post', POST_VS, POST_FS, ['aPos']);
    this.pBright = g.program('bright', POST_VS, BRIGHT_FS, ['aPos']);
    this.pBlur = g.program('blur', POST_VS, BLUR_FS, ['aPos']);
  }

  _buildMeshes() {
    const g = this.glc;
    this.mesh = {
      box: g.uploadMesh(meshBox([1, 1, 1], 0.42, 1)),
      cyl: g.uploadMesh(meshCylinder(14, [1, 1, 1], true, 0.5)),
      cone: g.uploadMesh(meshCone(12, [1, 1, 1], 0.45)),
      sphere: g.uploadMesh(meshSphere(12, 8, [1, 1, 1])),
      tree: g.uploadMesh(meshTree()),
      rock: g.uploadMesh(meshRock(7)),
      gate: g.uploadMesh(meshGateFrame(0.10, [0.86, 0.92, 1.0])),
      drone: g.uploadMesh(meshDrone()),
      leds: g.uploadMesh(meshDroneLeds()),
      prop: g.uploadMesh(meshProp()),
      quad: g.uploadMesh(meshQuad()),
      ring: g.uploadMesh(meshRing(44, 0.44))
    };
    this.wireSphere = { buf: g.buffer(wireSphereLines(20)), n: 20 * 3 * 2 };
    this.wireBox = { buf: g.buffer(wireBoxLines()), n: 24 };
    const fs = new Float32Array([-0.5, -0.5, 0, 1.5, -0.5, 0, -0.5, 1.5, 0]);
    this.fsTri = g.buffer(fs);
  }

  /* -------- course upload -------- */
  loadCourse(course, quality) {
    const gl = this.gl, g = this.glc;
    this.course = course;
    this.buildTerrainMesh(quality);
    this.buildInstances(course);
  }

  /** The render mesh may be decimated for weak rasterisers; the physics keeps
      using the full-resolution height grid either way, so collision never
      changes with the graphics preset. */
  buildTerrainMesh(quality) {
    const gl = this.gl, g = this.glc, course = this.course;
    const qp = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
    const step = qp.terrainStep || 1;
    this.terrainStep = step;
    const t = course.terrain, cell = t.cell * step, half = t.half;
    const N = Math.floor((t.N - 1) / step) + 1;
    const b = new MeshBuilder();
    const pal = course.envDef.terrain.palette;
    const nrm = V3.new();
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -half + i * cell, z = -half + j * cell, h = t.at(x, z);
        t.normal(x, z, nrm);
        const slope = 1 - clamp(nrm[1], 0, 1);
        const hn = clamp((h - course.envDef.terrain.base) / (Math.abs(course.envDef.terrain.amp) + 1e-3) * 0.6 + 0.35, 0, 1);
        let c0 = pal[0], c1 = pal[1], c2 = pal[2];
        let r, gg, bb;
        if (hn < 0.5) { const u = hn * 2; r = lerp(c0[0], c1[0], u); gg = lerp(c0[1], c1[1], u); bb = lerp(c0[2], c1[2], u); }
        else { const u = (hn - 0.5) * 2; r = lerp(c1[0], c2[0], u); gg = lerp(c1[1], c2[1], u); bb = lerp(c1[2], c2[2], u); }
        const rock = smoothstep(0.30, 0.72, slope);
        r = lerp(r, r * 1.10 + 0.06, rock); gg = lerp(gg, gg * 1.02 + 0.05, rock); bb = lerp(bb, bb * 0.95 + 0.05, rock);
        /* cheap AO: how much the neighbourhood rises above this vertex */
        let occ = 0;
        for (let k = 0; k < 4; k++) {
          const ox = [1, -1, 0, 0][k] * cell * 3, oz = [0, 0, 1, -1][k] * cell * 3;
          occ += clamp((t.at(x + ox, z + oz) - h) / 12, 0, 1);
        }
        const ao = clamp(1 - occ * 0.22, 0.42, 1);
        b.vert(x, h, z, nrm[0], nrm[1], nrm[2], r, gg, bb, ao);
      }
    }
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, c = a + 1, d = a + N, e = d + 1;
      b.quad(a, d, e, c);
    }
    if (this.terrainMesh) this._deleteMesh(this.terrainMesh);
    this.terrainMesh = g.uploadMesh(b.build());
  }

  buildInstances(course) {
    const gl = this.gl, g = this.glc;
    /* instance groups */
    const groups = {};
    const q = Q.new();
    for (const key of Object.keys(course.inst)) {
      const arr = course.inst[key];
      if (!arr.length) continue;
      const data = new Float32Array(arr.length * INST_STRIDE);
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i], o = i * INST_STRIDE;
        Q.fromAxisAngle(q, 0, 1, 0, it.yaw || 0);
        data[o] = it.p[0]; data[o + 1] = it.p[1]; data[o + 2] = it.p[2]; data[o + 3] = it.mat || 0;
        data[o + 4] = q[0]; data[o + 5] = q[1]; data[o + 6] = q[2]; data[o + 7] = q[3];
        data[o + 8] = it.s[0]; data[o + 9] = it.s[1]; data[o + 10] = it.s[2]; data[o + 11] = it.em || 0;
        data[o + 12] = it.col[0]; data[o + 13] = it.col[1]; data[o + 14] = it.col[2]; data[o + 15] = (i * 7919 % 1000) / 1000;
      }
      groups[key] = { mesh: this.mesh[key], buf: g.buffer(data), count: arr.length, data };
    }
    if (this.groups) for (const k of Object.keys(this.groups)) gl.deleteBuffer(this.groups[k].buf);
    this.groups = groups;

    /* gates: rebuilt every frame because their colour tracks race state */
    const nG = course.gates.length;
    this.gateInstData = new Float32Array(nG * INST_STRIDE);
    this.haloData = new Float32Array(nG * 12);
    if (this.gateBuf) gl.deleteBuffer(this.gateBuf);
    if (this.haloBuf) gl.deleteBuffer(this.haloBuf);
    this.gateBuf = g.buffer(this.gateInstData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    this.haloBuf = g.buffer(this.haloData, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);

    /* trackside camera poles: outside the corridor, looking in */
    const cams = [];
    const nCams = Math.min(8, Math.max(4, Math.round(course.gates.length * 0.7)));
    const sp = V3.new();
    for (let i = 0; i < nCams; i++) {
      course.path.atArc(course.path.totalLen * (i / nCams) + 14, sp);
      const ang = Math.atan2(sp[2], sp[0]);
      const off = course.corridorRadius * 1.5 + 8;
      const x = sp[0] + Math.cos(ang) * off, z = sp[2] + Math.sin(ang) * off;
      const y = Math.max(sp[1] + 3, course.terrain.at(x, z) + 6);
      cams.push(V3.new(x, y, z));
    }
    course.trackCams = cams;

    /* racing-line buffer (filled from the ghost when one exists) */
    if (!this.lineStripBuf) {
      this.lineStripBuf = g.buffer(new Float32Array(4000 * 3), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
      this.lineStripCol = g.buffer(new Float32Array(4000 * 4), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
      this.lineStripN = 0;
    }
  }
  _deleteMesh(m) {
    const gl = this.gl;
    gl.deleteBuffer(m.pos); gl.deleteBuffer(m.nrm); gl.deleteBuffer(m.col); gl.deleteBuffer(m.idx);
  }

  setRacingLine(frames) {
    if (!frames || frames.length < 2) { this.lineStripN = 0; return; }
    const gl = this.gl;
    const n = Math.min(frames.length, 4000);
    const p = new Float32Array(n * 3), c = new Float32Array(n * 4);
    const stride = frames.length / n;
    for (let i = 0; i < n; i++) {
      const f = frames[Math.min(frames.length - 1, Math.floor(i * stride))];
      p[i * 3] = f[1]; p[i * 3 + 1] = f[2]; p[i * 3 + 2] = f[3];
      const thr = clamp(f[8] || 0, 0, 1);
      c[i * 4] = 0.15 + thr * 0.9; c[i * 4 + 1] = 1.0 - thr * 0.45; c[i * 4 + 2] = 0.55 + (1 - thr) * 0.45; c[i * 4 + 3] = 0.85;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineStripBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineStripCol); gl.bufferSubData(gl.ARRAY_BUFFER, 0, c);
    this.lineStripN = n;
  }

  /* -------- sizing -------- */
  resize(cssW, cssH, dpr, renderScale) {
    /* The drawing buffer itself carries the resolution scale and CSS stretches
       it back up, so every pass — including post — pays the reduced fill cost.
       The HUD canvas stays at full device resolution so text remains crisp. */
    const gl = this.gl, canvas = this.glc.canvas;
    const maxDim = this.glc.limits.maxRenderbuffer || 4096;
    const W = clamp(Math.round(cssW * dpr * renderScale), 64, maxDim);
    const H = clamp(Math.round(cssH * dpr * renderScale), 64, maxDim);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    this.width = W; this.height = H;
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    const rw = W, rh = H;
    if (rw !== this.renderW || rh !== this.renderH) {
      this.renderW = rw; this.renderH = rh;
      if (!this.sceneT) this.sceneT = this.glc.target(rw, rh, {}); else this.glc.resizeTarget(this.sceneT, rw, rh, {});
      const bw = Math.max(8, rw >> 2), bh = Math.max(8, rh >> 2);
      if (!this.bloomA) { this.bloomA = this.glc.target(bw, bh, { depth: false }); this.bloomB = this.glc.target(bw, bh, { depth: false }); }
      else { this.glc.resizeTarget(this.bloomA, bw, bh, {}); this.glc.resizeTarget(this.bloomB, bw, bh, {}); }
    }
  }
  setShadowSize(px) {
    if (px && this.glc.software) px = Math.min(px, 512);
    if (this.shadowSize === px) return;
    this.shadowSize = px;
    if (!px) return;
    const s = Math.min(px, this.glc.limits.maxTexture || 2048);
    if (!this.shadowT) this.shadowT = this.glc.target(s, s, { filter: this.gl.NEAREST });
    else this.glc.resizeTarget(this.shadowT, s, s, {});
  }

  /* -------- helpers -------- */
  _bindMesh(prog, mesh) {
    const gl = this.gl, g = this.glc;
    bindAttrib(gl, g, prog.a.aPos, mesh.pos, 3, 0);
    if (prog.a.aNrm != null) bindAttrib(gl, g, prog.a.aNrm, mesh.nrm, 3, 0);
    if (prog.a.aCol != null) bindAttrib(gl, g, prog.a.aCol, mesh.col, 4, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
  }
  _bindInstances(prog, buf) {
    const gl = this.gl, g = this.glc, S = INST_STRIDE * 4;
    bindAttrib(gl, g, prog.a.aIPos, buf, 4, 1, S, 0);
    bindAttrib(gl, g, prog.a.aIQuat, buf, 4, 1, S, 16);
    bindAttrib(gl, g, prog.a.aIScale, buf, 4, 1, S, 32);
    if (prog.a.aICol != null) bindAttrib(gl, g, prog.a.aICol, buf, 4, 1, S, 48);
  }
  _unbindInstances(prog) {
    const g = this.glc;
    for (const n of ['aIPos', 'aIQuat', 'aIScale', 'aICol']) {
      const l = prog.a[n]; if (l != null && l >= 0) { g.divisor(l, 0); this.gl.disableVertexAttribArray(l); }
    }
  }
  _setSky(prog, env, time) {
    const gl = this.gl, u = prog.u, s = env.sky;
    if (u.uSkyZenith) gl.uniform3fv(u.uSkyZenith, s.zenith);
    if (u.uSkyHorizon) gl.uniform3fv(u.uSkyHorizon, s.horizon);
    if (u.uSkyGround) gl.uniform3fv(u.uSkyGround, s.ground);
    if (u.uSunDir) gl.uniform3fv(u.uSunDir, this.sunDir);
    if (u.uSunCol) gl.uniform3f(u.uSunCol, env.sun.color[0] * env.sun.intensity, env.sun.color[1] * env.sun.intensity, env.sun.color[2] * env.sun.intensity);
    if (u.uStars) gl.uniform1f(u.uStars, env.stars);
    if (u.uClouds) gl.uniform1f(u.uClouds, env.clouds);
    if (u.uTime) gl.uniform1f(u.uTime, time);
  }

  /* -------- the frame -------- */
  render(S) {
    const gl = this.gl, glc = this.glc, course = this.course;
    glc.drawCalls = 0; glc.tris = 0;
    const env = course.envDef, cam = S.camera, set = S.settings, q = QUALITY_PRESETS[set.quality] || QUALITY_PRESETS.medium;
    this.sunDir = V3.norm(V3.new(), V3.new(env.sun.dir[0], env.sun.dir[1], env.sun.dir[2]));

    /* view / projection */
    M4.compose(this.tmpM, cam.pos, cam.quat, V3.new(1, 1, 1));
    M4.invert(this.view, this.tmpM);
    const aspect = this.renderW / Math.max(1, this.renderH);
    const far = q.drawDist * (set.drawDistance || 1);
    M4.perspective(this.proj, clamp(cam.fovNow, 20, 150) * DEG, aspect, 0.06, far);
    M4.mul(this.viewProj, this.proj, this.view);
    M4.invert(this.invViewProj, this.viewProj);
    V3.set(this.camRight, this.tmpM[0], this.tmpM[1], this.tmpM[2]);
    V3.set(this.camUp, this.tmpM[4], this.tmpM[5], this.tmpM[6]);
    V3.set(this.camFwd, -this.tmpM[8], -this.tmpM[9], -this.tmpM[10]);

    /* ---- shadow pass ---- */
    const wantShadow = q.shadow > 0 && set.shadows !== false;
    this.setShadowSize(wantShadow ? q.shadow : 0);
    if (wantShadow && this.shadowT && this.shadowT.ok) {
      const R = 62, D = 190;
      const c = S.drone.p;
      const texelWorld = (2 * R) / this.shadowT.w;
      const cx = Math.round(c[0] / texelWorld) * texelWorld, cz = Math.round(c[2] / texelWorld) * texelWorld;
      const eye = V3.new(cx + this.sunDir[0] * D, c[1] + this.sunDir[1] * D, cz + this.sunDir[2] * D);
      const tgt = V3.new(cx, c[1], cz);
      M4.lookAt(this.tmpM, eye, tgt, Math.abs(this.sunDir[1]) > 0.98 ? VEC_FWD : VEC_UP);
      M4.ortho(this.tmpM2, -R, R, -R, R, 1, D * 2);
      M4.mul(this.shadowMat, this.tmpM2, this.tmpM);
      glc.bindTarget(this.shadowT);
      gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT);
      const pd = this.pDepthI;
      gl.useProgram(pd.p);
      gl.uniformMatrix4fv(pd.u.uViewProj, false, this.shadowMat);
      for (const k of Object.keys(this.groups)) {
        const grp = this.groups[k];
        this._bindMesh(pd, grp.mesh); this._bindInstances(pd, grp.buf);
        glc.drawInstanced(gl.TRIANGLES, grp.mesh.n, grp.mesh.type, 0, grp.count);
      }
      this._bindMesh(pd, this.mesh.gate); this._bindInstances(pd, this.gateBuf);
      glc.drawInstanced(gl.TRIANGLES, this.mesh.gate.n, this.mesh.gate.type, 0, course.gates.length);
      this._unbindInstances(pd);
      const pdn = this.pDepth;
      gl.useProgram(pdn.p);
      gl.uniformMatrix4fv(pdn.u.uViewProj, false, this.shadowMat);
      M4.compose(this.model, S.drone.p, S.drone.q, V3.new(1, 1, 1));
      gl.uniformMatrix4fv(pdn.u.uModel, false, this.model);
      this._bindMesh(pdn, this.mesh.drone);
      glc.drawIndexed(gl.TRIANGLES, this.mesh.drone.n, this.mesh.drone.type, 0);
      gl.cullFace(gl.BACK);
    }

    /* ---- scene pass ---- */
    glc.bindTarget(this.sceneT);
    gl.clearColor(env.fog.color[0], env.fog.color[1], env.fog.color[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);

    /* common scene uniforms */
    const fogDensity = env.fog.density * (set.fogScale == null ? 1 : set.fogScale);
    const setupScene = prog => {
      gl.useProgram(prog.p);
      this._setSky(prog, env, S.time);
      gl.uniformMatrix4fv(prog.u.uViewProj, false, this.viewProj);
      gl.uniformMatrix4fv(prog.u.uShadowMat, false, this.shadowMat);
      gl.uniform3fv(prog.u.uCamPos, cam.pos);
      gl.uniform3fv(prog.u.uAmbient, env.ambient);
      gl.uniform3fv(prog.u.uFogColor, env.fog.color);
      gl.uniform1f(prog.u.uFogDensity, fogDensity);
      gl.uniform1f(prog.u.uShadowOn, wantShadow && this.shadowT && this.shadowT.ok ? 1 : 0);
      gl.uniform1f(prog.u.uShadowTexel, this.shadowT ? 1 / this.shadowT.w : 0);
      gl.uniform1f(prog.u.uQuality, set.quality === 'high' ? 3 : (set.quality === 'medium' ? 2 : 1));
      gl.uniform1f(prog.u.uAlpha, 1);
      gl.uniform1f(prog.u.uGridStrength, env.terrain.grid || 0);
      if (wantShadow && this.shadowT) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowT.tex);
        gl.uniform1i(prog.u.uShadowMap, 0);
      }
    };

    /* terrain */
    const pn = this.pScene;
    setupScene(pn);
    M4.ident(this.model);
    gl.uniformMatrix4fv(pn.u.uModel, false, this.model);
    gl.uniform4f(pn.u.uMatEm, 8, 0, 0, 1);
    gl.uniform3f(pn.u.uTint, 1, 1, 1);
    this._bindMesh(pn, this.terrainMesh);
    glc.drawIndexed(gl.TRIANGLES, this.terrainMesh.n, this.terrainMesh.type, 0);

    /* instanced world */
    const pi = this.pSceneI;
    setupScene(pi);
    let instTotal = 0;
    for (const k of Object.keys(this.groups)) {
      const grp = this.groups[k];
      this._bindMesh(pi, grp.mesh); this._bindInstances(pi, grp.buf);
      glc.drawInstanced(gl.TRIANGLES, grp.mesh.n, grp.mesh.type, 0, grp.count);
      instTotal += grp.count;
    }
    /* gates */
    this._updateGateInstances(S);
    this._bindMesh(pi, this.mesh.gate); this._bindInstances(pi, this.gateBuf);
    glc.drawInstanced(gl.TRIANGLES, this.mesh.gate.n, this.mesh.gate.type, 0, course.gates.length);
    instTotal += course.gates.length;
    this._unbindInstances(pi);
    this.stats.instances = instTotal;

    /* airframe + ghost */
    setupScene(pn);
    this._drawDrone(S.drone, 1, S);
    if (S.ghost && S.ghost.visible) this._drawGhost(S.ghost, S);

    /* sky fills only what the scene left at the far plane */
    const ps = this.pSky;
    gl.useProgram(ps.p);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    this._setSky(ps, env, S.time);
    gl.uniformMatrix4fv(ps.u.uInvViewProj, false, this.invViewProj);
    bindAttrib(gl, glc, ps.a.aPos, this.fsTri, 3, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); glc.drawCalls++;
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);

    /* ---- additive layer: gate halos, props, particles, lines ---- */
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
    this._drawHalos(S);
    this._drawProps(S);
    this._drawParticles(S);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this._drawLines(S);
    gl.depthMask(true); gl.disable(gl.BLEND);

    /* ---- bloom ---- */
    let bloomTex = null;
    if (q.bloom && set.bloom !== false) {
      const pb = this.pBright;
      glc.bindTarget(this.bloomA);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(pb.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex);
      gl.uniform1i(pb.u.uScene, 0);
      gl.uniform2f(pb.u.uTexel, 1 / this.renderW, 1 / this.renderH);
      gl.uniform1f(pb.u.uThreshold, set.bloomThreshold == null ? 0.72 : set.bloomThreshold);
      bindAttrib(gl, glc, pb.a.aPos, this.fsTri, 3, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3); glc.drawCalls++;
      const pbl = this.pBlur;
      gl.useProgram(pbl.p);
      bindAttrib(gl, glc, pbl.a.aPos, this.fsTri, 3, 0);
      for (const [src, dst, dx, dy] of [[this.bloomA, this.bloomB, 1, 0], [this.bloomB, this.bloomA, 0, 1]]) {
        glc.bindTarget(dst);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(pbl.u.uScene, 0);
        gl.uniform2f(pbl.u.uDir, dx / dst.w, dy / dst.h);
        gl.drawArrays(gl.TRIANGLES, 0, 3); glc.drawCalls++;
      }
      bloomTex = this.bloomA.tex;
      gl.enable(gl.DEPTH_TEST);
    }

    /* ---- post to the screen ---- */
    glc.bindTarget(null);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    const pp = this.pPost;
    gl.useProgram(pp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex);
    gl.uniform1i(pp.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bloomTex || this.sceneT.tex);
    gl.uniform1i(pp.u.uBloom, 1);
    const fpv = cam.id === 'fpv';
    gl.uniform2f(pp.u.uRes, this.renderW, this.renderH);
    gl.uniform1f(pp.u.uTime, S.time);
    gl.uniform1f(pp.u.uVignette, (set.vignette == null ? 0.55 : set.vignette) * (fpv ? 1 : 0.55));
    gl.uniform1f(pp.u.uBarrel, (set.lens == null ? 0.10 : set.lens) * (fpv ? 1 : 0.25));
    gl.uniform1f(pp.u.uChroma, q.chroma * (set.chroma == null ? 1 : set.chroma) * (fpv ? 1 : 0.4));
    gl.uniform1f(pp.u.uBloomAmt, bloomTex ? (set.bloomAmount == null ? 0.85 : set.bloomAmount) : 0);
    gl.uniform1f(pp.u.uGrain, q.grain * (set.grain == null ? 1 : set.grain));
    gl.uniform1f(pp.u.uExposure, set.exposure == null ? 1.0 : set.exposure);
    gl.uniform1f(pp.u.uFpv, fpv ? 1 : 0);
    gl.uniform1f(pp.u.uShake, cam.shake);
    gl.uniform1f(pp.u.uDamage, S.drone.crashed ? 1 : 0);
    bindAttrib(gl, glc, pp.a.aPos, this.fsTri, 3, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); glc.drawCalls++;

    this.stats.drawCalls = glc.drawCalls;
    this.stats.tris = Math.round(glc.tris);
    this.stats.particles = this.particles.n;
  }

  _updateGateInstances(S) {
    const gl = this.gl, course = this.course, race = S.race, d = this.gateInstData, h = this.haloData;
    const next = race ? race.nextGate : 0;
    const gateCol = course.envDef.gate;
    for (let i = 0; i < course.gates.length; i++) {
      const g = course.gates[i], o = i * INST_STRIDE;
      const isNext = i === next, isStart = i === 0;
      const pulse = 0.5 + 0.5 * Math.sin(S.time * 3.4 + i);
      let col, em, mat;
      if (isStart) { col = [1.0, 0.82, 0.22]; em = isNext ? 1.5 + pulse * 0.9 : 0.65; mat = 7; }
      else if (isNext) { col = [gateCol[0], gateCol[1], gateCol[2]]; em = 1.7 + pulse * 1.1; mat = 6; }
      else if (g.passed) { col = [0.25, 0.95, 0.45]; em = 0.30; mat = 6; }
      else if (g.missed) { col = [1.0, 0.25, 0.25]; em = 0.55; mat = 6; }
      else { col = [0.45, 0.60, 0.85]; em = 0.22; mat = 6; }
      d[o] = g.pos[0]; d[o + 1] = g.pos[1]; d[o + 2] = g.pos[2]; d[o + 3] = mat;
      d[o + 4] = g.q[0]; d[o + 5] = g.q[1]; d[o + 6] = g.q[2]; d[o + 7] = g.q[3];
      d[o + 8] = g.hw * 2; d[o + 9] = g.hh * 2; d[o + 10] = 1; d[o + 11] = em;
      d[o + 12] = col[0]; d[o + 13] = col[1]; d[o + 14] = col[2]; d[o + 15] = i * 0.137;
      const ho = i * 12;
      h[ho] = g.pos[0]; h[ho + 1] = g.pos[1]; h[ho + 2] = g.pos[2];
      h[ho + 3] = Math.max(g.hw, g.hh) * 2.32;
      h[ho + 4] = col[0]; h[ho + 5] = col[1]; h[ho + 6] = col[2];
      h[ho + 7] = isNext ? 0.55 + pulse * 0.35 : (g.passed ? 0.10 : 0.16);
      h[ho + 8] = 0; h[ho + 9] = 0; h[ho + 10] = 0; h[ho + 11] = 0;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gateBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.haloBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, h);
  }

  _drawDrone(drone, alpha, S) {
    const gl = this.gl, glc = this.glc, p = this.pScene;
    M4.compose(this.model, drone.p, drone.q, V3.new(1, 1, 1));
    gl.uniformMatrix4fv(p.u.uModel, false, this.model);
    gl.uniform4f(p.u.uMatEm, 0, drone.crashed ? 0.0 : 0.14, 0.3, alpha);
    gl.uniform3f(p.u.uTint, 1, 1, 1);
    gl.uniform1f(p.u.uAlpha, alpha);
    this._bindMesh(p, this.mesh.drone);
    glc.drawIndexed(gl.TRIANGLES, this.mesh.drone.n, this.mesh.drone.type, 0);
    /* navigation LEDs, bright enough to find the craft against a night city */
    const blink = drone.crashed ? (Math.sin(S.time * 14) > 0 ? 3.4 : 0.2) : 2.6;
    gl.uniform4f(p.u.uMatEm, 0, blink, 0.3, alpha);
    this._bindMesh(p, this.mesh.leds);
    glc.drawIndexed(gl.TRIANGLES, this.mesh.leds.n, this.mesh.leds.type, 0);
    gl.uniform1f(p.u.uAlpha, 1);
  }
  _drawGhost(ghost, S) {
    const gl = this.gl, glc = this.glc, p = this.pScene;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    M4.compose(this.model, ghost.pos, ghost.quat, V3.new(1, 1, 1));
    gl.uniformMatrix4fv(p.u.uModel, false, this.model);
    gl.uniform4f(p.u.uMatEm, 0, 2.2, 0.7, 0.55);
    gl.uniform3f(p.u.uTint, 0.30, 1.0, 0.95);
    gl.uniform1f(p.u.uAlpha, 0.55);
    this._bindMesh(p, this.mesh.drone);
    glc.drawIndexed(gl.TRIANGLES, this.mesh.drone.n, this.mesh.drone.type, 0);
    gl.uniform4f(p.u.uMatEm, 0, 3.2, 0.7, 0.75);
    this._bindMesh(p, this.mesh.leds);
    glc.drawIndexed(gl.TRIANGLES, this.mesh.leds.n, this.mesh.leds.type, 0);
    gl.uniform1f(p.u.uAlpha, 1);
    gl.disable(gl.BLEND);
  }

  _drawHalos(S) {
    const gl = this.gl, glc = this.glc, p = this.pGlow, n = this.course.gates.length;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uViewProj, false, this.viewProj);
    gl.uniform3fv(p.u.uCamRight, this.camRight);
    gl.uniform3fv(p.u.uCamUp, this.camUp);
    gl.uniform3fv(p.u.uCamPos, S.camera.pos);
    gl.uniform1f(p.u.uMode, 1);
    this._bindMesh(p, this.mesh.ring);
    const S4 = 12 * 4;
    bindAttrib(gl, glc, p.a.aPPos, this.haloBuf, 4, 1, S4, 0);
    bindAttrib(gl, glc, p.a.aPCol, this.haloBuf, 4, 1, S4, 16);
    bindAttrib(gl, glc, p.a.aPVel, this.haloBuf, 4, 1, S4, 32);
    glc.drawInstanced(gl.TRIANGLES, this.mesh.ring.n, this.mesh.ring.type, 0, n);
    for (const nm of ['aPPos', 'aPCol', 'aPVel']) { const l = p.a[nm]; if (l >= 0) { glc.divisor(l, 0); gl.disableVertexAttribArray(l); } }
  }

  _drawProps(S) {
    const gl = this.gl, glc = this.glc, p = this.pScene, d = S.drone;
    gl.useProgram(p.p);
    const L = d.P.armLen, arms = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
    const pos = V3.new(), qq = Q.new(), spin = Q.new(), scale = V3.new();
    for (let i = 0; i < 4; i++) {
      const [sx, sz] = arms[i];
      V3.set(pos, sx * L, 0.040, sz * L);
      Q.rot(pos, d.q, pos);
      V3.add(pos, d.p, pos);
      const rpm = d.motors[i] * 340 + 30;
      Q.fromAxisAngle(spin, 0, 1, 0, (S.time * rpm) % TAU);
      Q.mul(qq, d.q, spin);
      const bl = 0.13 + d.motors[i] * 0.02;
      V3.set(scale, bl, 1, bl);
      M4.compose(this.model, pos, qq, scale);
      gl.uniformMatrix4fv(p.u.uModel, false, this.model);
      const glow = 0.25 + d.motors[i] * 1.5;
      gl.uniform4f(p.u.uMatEm, 0, glow, 0, 0.30 + d.motors[i] * 0.35);
      gl.uniform3f(p.u.uTint, 0.55, 0.85, 1.0);
      gl.uniform1f(p.u.uAlpha, 0.22 + d.motors[i] * 0.30);
      this._bindMesh(p, this.mesh.prop);
      glc.drawIndexed(gl.TRIANGLES, this.mesh.prop.n, this.mesh.prop.type, 0);
    }
    gl.uniform1f(p.u.uAlpha, 1);
  }

  _drawParticles(S) {
    const n = this.particles.pack();
    if (!n) return;
    const gl = this.gl, glc = this.glc, p = this.pGlow;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.partBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particles.data.subarray(0, n * 12));
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uViewProj, false, this.viewProj);
    gl.uniform3fv(p.u.uCamRight, this.camRight);
    gl.uniform3fv(p.u.uCamUp, this.camUp);
    gl.uniform3fv(p.u.uCamPos, S.camera.pos);
    gl.uniform1f(p.u.uMode, 0);
    this._bindMesh(p, this.mesh.quad);
    const S4 = 12 * 4;
    bindAttrib(gl, glc, p.a.aPPos, this.partBuf, 4, 1, S4, 0);
    bindAttrib(gl, glc, p.a.aPCol, this.partBuf, 4, 1, S4, 16);
    bindAttrib(gl, glc, p.a.aPVel, this.partBuf, 4, 1, S4, 32);
    glc.drawInstanced(gl.TRIANGLES, this.mesh.quad.n, this.mesh.quad.type, 0, n);
    for (const nm of ['aPPos', 'aPCol', 'aPVel']) { const l = p.a[nm]; if (l >= 0) { glc.divisor(l, 0); gl.disableVertexAttribArray(l); } }
  }

  /* ---- debug / racing lines ---- */
  lineReset() { this.lineN = 0; }
  line(a, b, col) {
    if (this.lineN + 2 > 4096) return;
    const i = this.lineN;
    this.linePos[i * 3] = a[0]; this.linePos[i * 3 + 1] = a[1]; this.linePos[i * 3 + 2] = a[2];
    this.linePos[(i + 1) * 3] = b[0]; this.linePos[(i + 1) * 3 + 1] = b[1]; this.linePos[(i + 1) * 3 + 2] = b[2];
    for (let k = 0; k < 2; k++) {
      this.lineCol[(i + k) * 4] = col[0]; this.lineCol[(i + k) * 4 + 1] = col[1];
      this.lineCol[(i + k) * 4 + 2] = col[2]; this.lineCol[(i + k) * 4 + 3] = col[3] == null ? 1 : col[3];
    }
    this.lineN += 2;
  }
  _drawLines(S) {
    const gl = this.gl, glc = this.glc, p = this.pLine;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uViewProj, false, this.viewProj);
    M4.ident(this.tmpM); gl.uniformMatrix4fv(p.u.uModel, false, this.tmpM);
    gl.uniform1f(p.u.uAlpha, 1);
    if (S.showLine && this.lineStripN > 1) {
      bindAttrib(gl, glc, p.a.aPos, this.lineStripBuf, 3, 0);
      bindAttrib(gl, glc, p.a.aCol, this.lineStripCol, 4, 0);
      gl.drawArrays(gl.LINE_STRIP, 0, this.lineStripN); glc.drawCalls++;
    }
    if (this.lineN > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBufPos);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.linePos.subarray(0, this.lineN * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBufCol);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.lineCol.subarray(0, this.lineN * 4));
      bindAttrib(gl, glc, p.a.aPos, this.lineBufPos, 3, 0);
      bindAttrib(gl, glc, p.a.aCol, this.lineBufCol, 4, 0);
      gl.drawArrays(gl.LINES, 0, this.lineN); glc.drawCalls++;
    }
  }

  /** project a world point to canvas pixels; returns null when behind the camera */
  project(p, out) {
    const v = _prj;
    M4.xformPoint(v, this.viewProj, p);
    if (v[3] <= 1e-5) return null;
    out[0] = (v[0] / v[3] * 0.5 + 0.5) * (this.cssW || this.width);
    out[1] = (1 - (v[1] / v[3] * 0.5 + 0.5)) * (this.cssH || this.height);
    out[2] = v[3];
    return out;
  }
}
const _prj = new Float32Array(4);
