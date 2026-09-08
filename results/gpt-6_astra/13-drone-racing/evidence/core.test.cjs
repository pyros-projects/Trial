'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCore() {
  const filename = path.join(__dirname, 'flight-core.js');
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return context.DroneCore;
}

function settings(overrides = {}) {
  return {
    mode: 'acro',
    gravity: 9.81,
    twr: 3.4,
    drag: 0.3,
    rates: 180,
    expo: 0.3,
    autoLevel: 0.9,
    altHold: 0,
    antiCrash: 0,
    forgiveness: 0.65,
    ...overrides,
  };
}

const neutral = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };

function run(drone, seconds, input, course) {
  const steps = Math.round(seconds * 120);
  for (let i = 0; i < steps; i += 1) drone.step(1 / 120, input, course);
}

function expandedSegmentHitsBox(a, b, box, margin) {
  let lo = 0;
  let hi = 1;
  for (let axis = 0; axis < 3; axis += 1) {
    const d = b[axis] - a[axis];
    const min = box.min[axis] - margin;
    const max = box.max[axis] + margin;
    if (Math.abs(d) < 1e-10) {
      if (a[axis] < min || a[axis] > max) return false;
      continue;
    }
    let t0 = (min - a[axis]) / d;
    let t1 = (max - a[axis]) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    if (lo > hi) return false;
  }
  return true;
}

test('exports the browser global API and reset state', () => {
  const core = loadCore();
  assert.equal(typeof core.Drone, 'function');
  assert.equal(typeof core.createCourse, 'function');
  assert.equal(typeof core.crossGate, 'function');

  const course = core.createCourse('', 'canyon');
  const config = settings();
  const drone = new core.Drone(config);
  drone.reset(course);
  assert.deepEqual(Array.from(drone.p), [0, 0.65, 8]);
  assert.deepEqual(Array.from(drone.v), [0, 0, 0]);
  assert.deepEqual(Array.from(drone.q), [0, 0, 0, 1]);
  assert.deepEqual(Array.from(drone.omega), [0, 0, 0]);
  assert.deepEqual(Array.from(drone.acc), [0, 0, 0]);
  assert.equal(drone.mass, 0.7);
  assert.equal(drone.radius, 0.35);
  assert.equal(drone.time, 0);
  assert.deepEqual({ ...drone.collision }, { active: false, count: 0, impact: 0, kind: '' });
  assert.equal(drone.settings, config, 'settings remain a live reference');
});

test('course generation is deterministic, preset-aware, and keeps the opening readable', () => {
  const core = loadCore();
  const a = core.createCourse('night-run', 'canyon');
  const b = core.createCourse('night-run', 'canyon');
  const c = core.createCourse('other-seed', 'canyon');
  const alpine = core.createCourse('night-run', 'alpine');

  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(JSON.stringify(a.gates.slice(2)), JSON.stringify(c.gates.slice(2)));
  assert.deepEqual(Array.from(a.gates[0].p), [0, 4, -24]);
  assert.deepEqual(Array.from(a.gates[1].p), [0, 4, -56]);
  assert.equal(a.gates.length, 8);
  assert.equal(a.gates.every((gate) => gate.radius === 4.5), true);
  assert.notEqual(JSON.stringify(a.gates.slice(2)), JSON.stringify(alpine.gates.slice(2)));

  const points = [a.start, ...a.gates.map((gate) => gate.p)];
  for (const obstacle of a.obstacles) {
    for (let i = 1; i < points.length; i += 1) {
      assert.equal(
        expandedSegmentHitsBox(points[i - 1], points[i], obstacle, 10),
        false,
        `${obstacle.kind} blocks segment ${i}`,
      );
    }
  }
});

test('reported course length includes the closing leg of the eight-gate loop', () => {
  const core = loadCore();
  const course = core.createCourse('', 'canyon');
  assert.equal(course.length, 324.9);
});

test('gate normals follow the incoming path and right vectors form a usable frame', () => {
  const core = loadCore();
  const course = core.createCourse('frames', 'foundry');
  let previous = course.start;
  for (const gate of course.gates) {
    const dx = gate.p[0] - previous[0];
    const dz = gate.p[2] - previous[2];
    const length = Math.hypot(dx, dz);
    assert.ok((dx * gate.normal[0] + dz * gate.normal[2]) / length > 0.999);
    assert.ok(Math.abs(gate.normal[0] * gate.right[0] + gate.normal[2] * gate.right[2]) < 1e-9);
    assert.ok(gate.right[0] * gate.normal[2] - gate.right[2] * gate.normal[0] < -0.999);
    previous = gate.p;
  }
});

test('swept gate crossing accepts only forward passes through the craft-adjusted aperture', () => {
  const core = loadCore();
  const gate = { p: [0, 4, 0], normal: [0, 0, -1], right: [1, 0, 0], radius: 4.5 };
  assert.deepEqual(
    { ...core.crossGate([1, 5, 1], [1, 5, -2], gate, 0.35) },
    { crossed: true, missed: false, direction: 1 },
  );
  assert.deepEqual(
    { ...core.crossGate([4.3, 4, 1], [4.3, 4, -1], gate, 0.35) },
    { crossed: false, missed: true, direction: 1 },
  );
  assert.deepEqual(
    { ...core.crossGate([0, 4, -1], [0, 4, 1], gate, 0.35) },
    { crossed: false, missed: false, direction: -1 },
  );
  assert.deepEqual(
    { ...core.crossGate([40, 4, 1], [40, 4, -1], gate, 0.35) },
    { crossed: false, missed: false, direction: 1 },
  );
});

test('motor lag, gravity, and thrust produce distinct descent and climb', () => {
  const core = loadCore();
  const course = core.createCourse('', 'canyon');
  const low = new core.Drone(settings());
  const high = new core.Drone(settings());
  low.p[1] = high.p[1] = 40;
  const initialMotor = high.motor;
  high.step(1 / 120, { ...neutral, throttle: 1 }, course);
  assert.ok(high.motor > initialMotor && high.motor < 1, 'motor responds without jumping instantly');
  run(low, 1, { ...neutral, throttle: -1 }, course);
  run(high, 1 - 1 / 120, { ...neutral, throttle: 1 }, course);
  assert.ok(low.v[1] < -5, `expected descent, got ${low.v[1]}`);
  assert.ok(high.v[1] > 8, `expected climb, got ${high.v[1]}`);
});

test('pitch, roll, and yaw commands drive independent signed body axes', () => {
  const core = loadCore();
  const course = core.createCourse('', 'canyon');
  const commandCases = [
    ['pitch', 0, -1],
    ['yaw', 1, -1],
    ['roll', 2, -1],
  ];
  for (const [control, axis, sign] of commandCases) {
    const drone = new core.Drone(settings());
    drone.p[1] = 30;
    run(drone, 0.12, { ...neutral, [control]: 0.8 }, course);
    assert.equal(Math.sign(drone.omega[axis]), sign, `${control} sign`);
    const other = drone.omega.filter((_, index) => index !== axis);
    assert.ok(Math.abs(drone.omega[axis]) > Math.max(...other.map(Math.abs)) * 8 + 0.01, `${control} isolation`);
  }
});

test('angle and horizon modes level a tilted craft while acro preserves attitude', () => {
  const core = loadCore();
  const course = core.createCourse('', 'canyon');
  const make = (mode) => {
    const drone = new core.Drone(settings({ mode, autoLevel: 1 }));
    drone.p[1] = 30;
    drone.q = [0, 0, Math.sin(0.25), Math.cos(0.25)];
    return drone;
  };
  const angle = make('angle');
  const horizon = make('horizon');
  const acro = make('acro');
  run(angle, 0.2, neutral, course);
  run(horizon, 0.2, neutral, course);
  run(acro, 0.2, neutral, course);
  assert.ok(angle.omega[2] < -0.4);
  assert.ok(horizon.omega[2] < -0.4);
  assert.ok(Math.abs(acro.omega[2]) < 0.05);
});

test('altitude hold arrests a descent only in assisted modes', () => {
  const core = loadCore();
  const course = { ...core.createCourse('', 'canyon'), start: [0, 20, 8], obstacles: [] };
  const angle = new core.Drone(settings({ mode: 'angle', altHold: 1 }));
  const acro = new core.Drone(settings({ mode: 'acro', altHold: 1 }));
  angle.reset(course);
  acro.reset(course);
  angle.v[1] = acro.v[1] = -3;
  run(angle, 0.8, neutral, course);
  run(acro, 0.8, neutral, course);
  assert.ok(angle.v[1] > acro.v[1] + 1, `${angle.v[1]} should exceed ${acro.v[1]}`);
  assert.ok(angle.p[1] > acro.p[1] + 0.3);
});

test('anti-crash adds real near-ground lift and leveling correction', () => {
  const core = loadCore();
  const course = core.createCourse('', 'canyon');
  const safe = new core.Drone(settings({ antiCrash: 1 }));
  const raw = new core.Drone(settings({ antiCrash: 0 }));
  for (const drone of [safe, raw]) {
    drone.p[1] = 1.8;
    drone.v[1] = -1;
    drone.q = [0, 0, Math.sin(0.4), Math.cos(0.4)];
  }
  run(safe, 0.12, neutral, course);
  run(raw, 0.12, neutral, course);
  assert.ok(safe.v[1] > raw.v[1] + 0.15);
  assert.ok(safe.omega[2] < raw.omega[2] - 0.1);
});

test('anti-crash does not auto-launch a level stationary craft', () => {
  const core = loadCore();
  const course = core.createCourse('', 'canyon');
  const drone = new core.Drone(settings({ mode: 'angle', altHold: 0.85, antiCrash: 0.6 }));
  run(drone, 1, neutral, course);
  assert.ok(Math.abs(drone.p[1] - course.start[1]) < 0.08, `unexpected climb to ${drone.p[1]}`);
  assert.ok(Math.abs(drone.v[1]) < 0.08, `unexpected vertical speed ${drone.v[1]}`);
});

test('quaternion remains finite and normalized under sustained extreme input', () => {
  const core = loadCore();
  const course = { ...core.createCourse('', 'canyon'), obstacles: [] };
  const drone = new core.Drone(settings({ rates: 720, gravity: 0, drag: 0, antiCrash: 0 }));
  drone.p[1] = 80;
  for (let i = 0; i < 12000; i += 1) {
    drone.step(1 / 120, { throttle: 0, pitch: 1, roll: -1, yaw: 1 }, course);
  }
  const norm = Math.hypot(...drone.q);
  assert.ok(drone.q.every(Number.isFinite));
  assert.ok(drone.p.every(Number.isFinite));
  assert.ok(drone.v.every(Number.isFinite));
  assert.ok(Math.abs(norm - 1) < 1e-9, `quaternion norm ${norm}`);
});

test('step clamps long frames and reads tuning changes from the live settings object', () => {
  const core = loadCore();
  const course = core.createCourse('', 'canyon');
  const config = settings({ rates: 90 });
  const longFrame = new core.Drone(config);
  const cappedFrame = new core.Drone(settings({ rates: 90 }));
  longFrame.p[1] = cappedFrame.p[1] = 30;
  const input = { ...neutral, yaw: 1 };
  longFrame.step(1, input, course);
  cappedFrame.step(1 / 60, input, course);
  assert.deepEqual(longFrame.q, cappedFrame.q);
  assert.deepEqual(longFrame.omega, cappedFrame.omega);

  const before = Math.abs(longFrame.omega[1]);
  config.rates = 720;
  run(longFrame, 0.1, input, course);
  assert.ok(Math.abs(longFrame.omega[1]) > before * 2);
});

test('ground and obstacle contacts resolve penetration and count one hard impact', () => {
  const core = loadCore();
  const course = {
    ...core.createCourse('', 'canyon'),
    obstacles: [{ min: [1, 0, -2], max: [3, 4, 2], kind: 'container' }],
  };
  const obstacleHit = new core.Drone(settings({ gravity: 0, drag: 0 }));
  obstacleHit.p = [0.5, 2, 0];
  obstacleHit.v = [12, 0, 0];
  run(obstacleHit, 0.12, neutral, course);
  assert.ok(obstacleHit.p[0] <= 0.650001, `resolved x ${obstacleHit.p[0]}`);
  assert.ok(obstacleHit.v[0] <= 0);
  assert.equal(obstacleHit.collision.count, 1);
  assert.equal(obstacleHit.collision.kind, 'container');

  const floorHit = new core.Drone(settings({ antiCrash: 0 }));
  floorHit.p = [0, 0.38, 0];
  floorHit.v = [0, -10, 0];
  run(floorHit, 0.05, { ...neutral, throttle: -1 }, { ...course, obstacles: [] });
  assert.ok(floorHit.p[1] >= floorHit.radius - 1e-9);
  assert.equal(floorHit.collision.count, 1);
  run(floorHit, 1, { ...neutral, throttle: -1 }, { ...course, obstacles: [] });
  assert.equal(floorHit.collision.count, 1, 'resting floor contact is not penalized repeatedly');
});

test('course names match the simulator preset labels', () => {
  const core = loadCore();
  assert.equal(core.createCourse('', 'canyon').name, 'Redrock Canyon');
  assert.equal(core.createCourse('', 'foundry').name, 'The Foundry');
  assert.equal(core.createCourse('', 'alpine').name, 'Alpine Run');
});

test('recoverAt preserves race history and holds the chosen recovery altitude', () => {
  const core = loadCore();
  const course = { ...core.createCourse('', 'canyon'), obstacles: [], gates: [] };
  const drone = new core.Drone(settings({ mode: 'angle', altHold: 0.85, antiCrash: 0 }));
  drone.time = 17.25;
  drone.collision = { active: true, count: 4, impact: 12, kind: 'rock' };
  drone.v = [8, -3, 2];
  drone.omega = [1, 2, 3];
  drone.acc = [4, 5, 6];
  drone.motor = 1;
  drone.recoverAt([12, 20, -9], [0, Math.sin(0.3), 0, Math.cos(0.3)]);

  assert.deepEqual(Array.from(drone.p), [12, 20, -9]);
  assert.deepEqual(Array.from(drone.v), [0, 0, 0]);
  assert.deepEqual(Array.from(drone.omega), [0, 0, 0]);
  assert.deepEqual(Array.from(drone.acc), [0, 0, 0]);
  assert.equal(drone.time, 17.25);
  assert.deepEqual({ ...drone.collision }, { active: false, count: 4, impact: 0, kind: '' });
  assert.ok(Math.abs(drone.motor - 1 / 3.4) < 1e-12);

  run(drone, 1, neutral, course);
  assert.ok(Math.abs(drone.p[1] - 20) < 0.08, `recovery altitude drifted to ${drone.p[1]}`);
  assert.ok(Math.abs(drone.v[1]) < 0.08, `recovery vertical speed ${drone.v[1]}`);
});

test('a drone can fly through the circular gate aperture without touching the rim', () => {
  const core = loadCore();
  const gate = { p: [0, 4, 0], normal: [0, 0, -1], right: [1, 0, 0], radius: 4.5 };
  const course = { start: [0, 4, 1], gates: [gate], obstacles: [] };
  const drone = new core.Drone(settings({ gravity: 0, drag: 0, forgiveness: 0 }));
  drone.reset(course);
  drone.v = [0, 0, -80];
  drone.step(1 / 60, neutral, course);
  assert.equal(drone.collision.count, 0);
  assert.equal(drone.collision.active, false);
  assert.ok(drone.p[2] < 0, `aperture pass stopped at ${drone.p[2]}`);
});

test('a sphere striking the circular gate frame bounces clear without penetration', () => {
  const core = loadCore();
  const gate = { p: [0, 4, 0], normal: [0, 0, -1], right: [1, 0, 0], radius: 4.5 };
  const course = { start: [4.75, 4, 0.8], gates: [gate], obstacles: [] };
  const drone = new core.Drone(settings({ gravity: 0, drag: 0, forgiveness: 0 }));
  drone.reset(course);
  drone.v = [0, 0, -24];
  drone.step(1 / 60, neutral, course);
  const axialDistance = Math.abs((drone.p[0] - gate.p[0]) * gate.normal[0] + (drone.p[2] - gate.p[2]) * gate.normal[2]);
  assert.equal(drone.collision.count, 1);
  assert.equal(drone.collision.kind, 'gate');
  assert.ok(drone.v[2] > 0, `gate did not reflect velocity: ${drone.v[2]}`);
  assert.ok(axialDistance >= 0.65 - 1e-6, `sphere remained in rim at axial distance ${axialDistance}`);
  assert.ok([...drone.p, ...drone.v].every(Number.isFinite));
});

test('swept gate collision catches a 150 m/s rim strike in one frame', () => {
  const core = loadCore();
  const gate = { p: [0, 4, 0], normal: [0, 0, -1], right: [1, 0, 0], radius: 4.5 };
  const course = { start: [4.75, 4, 1], gates: [gate], obstacles: [] };
  const drone = new core.Drone(settings({ gravity: 0, drag: 0, forgiveness: 0 }));
  drone.reset(course);
  drone.v = [0, 0, -150];
  drone.step(1 / 60, neutral, course);
  assert.equal(drone.collision.count, 1);
  assert.equal(drone.collision.kind, 'gate');
  assert.ok(drone.p[2] >= 0.65 - 1e-5, `tunneled through gate to z=${drone.p[2]}`);
  assert.ok(drone.v[2] > 0);
});

test('swept obstacle collision catches a thin face at 150 m/s', () => {
  const core = loadCore();
  const course = {
    start: [0, 2, 0],
    gates: [],
    obstacles: [{ min: [1, 0, -1], max: [1.2, 4, 1], kind: 'container' }],
  };
  const drone = new core.Drone(settings({ gravity: 0, drag: 0, forgiveness: 0 }));
  drone.reset(course);
  drone.v = [150, 0, 0];
  drone.step(1 / 60, neutral, course);
  assert.equal(drone.collision.count, 1);
  assert.equal(drone.collision.kind, 'container');
  assert.ok(drone.p[0] <= 0.65 + 1e-5, `tunneled through obstacle to x=${drone.p[0]}`);
  assert.ok(drone.v[0] < 0);
});

test('assisted full-stick climb approaches six meters per second and captures on release', () => {
  const core = loadCore();
  const course = { start: [0, 20, 0], gates: [], obstacles: [] };
  const drone = new core.Drone(settings({ mode: 'angle', altHold: 0.85, antiCrash: 0 }));
  drone.reset(course);
  run(drone, 0.71, { ...neutral, throttle: 1 }, course);
  assert.ok(drone.v[1] > 4, `climb response too weak at ${drone.v[1]}`);
  assert.ok(drone.v[1] < 7.5, `climb rate not controlled at ${drone.v[1]}`);
  const releaseHeight = drone.p[1];
  run(drone, 1.5, neutral, course);
  assert.ok(Math.abs(drone.v[1]) < 1, `release was not captured, vy=${drone.v[1]}`);
  assert.ok(drone.p[1] < releaseHeight + 1.5, `release overshot by ${drone.p[1] - releaseHeight}`);
});

test('stick expo softens partial throttle in raw acro mode', () => {
  const core = loadCore();
  const course = { start: [0, 20, 0], gates: [], obstacles: [] };
  const linear = new core.Drone(settings({ expo: 0, drag: 0 }));
  const curved = new core.Drone(settings({ expo: 1, drag: 0 }));
  linear.reset(course);
  curved.reset(course);
  run(linear, 0.4, { ...neutral, throttle: 0.5 }, course);
  run(curved, 0.4, { ...neutral, throttle: 0.5 }, course);
  assert.ok(linear.motor > curved.motor + 0.15, `${linear.motor} should exceed ${curved.motor}`);
  assert.ok(linear.v[1] > curved.v[1] + 1);
});

test('angle mode keeps pitch and roll authority when auto-level is zero', () => {
  const core = loadCore();
  const course = { start: [0, 20, 0], gates: [], obstacles: [] };
  for (const [control, axis] of [['pitch', 0], ['roll', 2]]) {
    const drone = new core.Drone(settings({ mode: 'angle', autoLevel: 0, altHold: 0, antiCrash: 0 }));
    drone.reset(course);
    run(drone, 0.12, { ...neutral, [control]: 0.8 }, course);
    assert.ok(drone.omega[axis] < -0.2, `${control} authority was ${drone.omega[axis]}`);
  }
});
