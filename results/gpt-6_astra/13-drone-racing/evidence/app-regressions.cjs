'use strict';

// Run from any directory: node /absolute/path/to/evidence/app-regressions.cjs
// Extracts the current delivered application and core from index.html each run.
// Synthetic VM fixtures verify logic only; they are not browser-flight evidence.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(filename, 'utf8');
const marker = html.match(/<!-- FLIGHT_CORE_START -->\s*<script[^>]*>([\s\S]*?)<\/script>\s*<!-- FLIGHT_CORE_END -->/);
assert.ok(marker, 'Current index.html contains the embedded flight core');
const app = html.slice(html.indexOf('<!-- FLIGHT_CORE_END -->'));
const lines = app.split('\n');
const genuine = JSON.parse(fs.readFileSync(path.join(__dirname, 'recorded-course-replay.json'), 'utf8')).replay;

function extract(prefix) {
  const matches = lines.filter(line => line.startsWith(prefix));
  assert.equal(matches.length, 1, `Exactly one current source declaration: ${prefix}`);
  return matches[0];
}

function context(extra = {}, functions = []) {
  const ctx = vm.createContext({ ...extra });
  vm.runInContext(marker[1], ctx, { filename: filename + '#FLIGHT_CORE' });
  const declarations = ['const defaults=', 'const limits=', 'const add='].map(extract);
  const names = [...new Set(['validateSettings', 'validateReplay', 'recordSample', ...functions])];
  vm.runInContext([...declarations, ...names.map(name => extract(`function ${name}(`))].join('\n'), ctx, { filename: filename + '#extracted-application' });
  return ctx;
}

function validate(run) {
  const ctx = context({ run });
  return vm.runInContext('validateReplay(run)', ctx);
}

const plain = value => JSON.parse(JSON.stringify(value));

test('genuine browser replay passes current application validation', () => {
  assert.equal(validate(genuine), genuine);
  assert.ok(genuine.samples.length > 100);
  assert.equal(genuine.samples.at(-1).gate, 8);
  assert.equal(genuine.penalty, 18, 'Recorded lap includes six public Recover penalties');
});

for (const [name, change, expected] of [
  ['all gates zero', r => r.samples.forEach(s => { s.gate = 0; }), /entire ordered course/],
  ['descending gate index', r => { const i = r.samples.findIndex(s => s.gate === 2); assert.ok(i >= 0 && i + 1 < r.samples.length); r.samples[i + 1].gate = 0; }, /checkpoint order/],
  ['missing opening frames', r => { r.samples = r.samples.filter(s => s.t > .1); }, /entire ordered course/],
  ['stationary route', r => r.samples.forEach(s => { s.p = [0, 1, 8]; }), /route does not pass/],
]) {
  test(`synthetic malformed replay rejected: ${name}`, () => {
    const malformed = structuredClone(genuine);
    change(malformed);
    assert.throws(() => validate(malformed), expected);
  });
}

test('synthetic same-time periodic finish updates frame without duplicate timestamp', () => {
  const ctx = context({ session: 'trial', lapStarted: true, recordInterval: .05,
    recording: [{ t: 10, p: [0, 2, 0], q: [0, 0, 0, 1], gate: 7 }],
    lapTime: 10, gateIndex: 8, drone: { p: [0, 2, -1], q: [0, 0, 0, 1] } });
  vm.runInContext('recordSample(true)', ctx);
  assert.deepEqual(plain(ctx.recording), [{ t: 10, p: [0, 2, -1], q: [0, 0, 0, 1], gate: 8 }]);
});

test('synthetic long lap compacts while retaining a valid complete genuine route', () => {
  // Synthetic wait frames extend the genuine route beyond the former 1200-second
  // limit. This is a recording stress fixture, not a new physical flight.
  const run = structuredClone(genuine);
  const count = 23900 - run.samples.length;
  assert.ok(count > 0);
  const offset = count * .052;
  const start = run.samples[0];
  const idle = Array.from({ length: count }, (_, i) => ({ t: i * .052, p: [...start.p], q: [...start.q], gate: 0 }));
  run.samples = [...idle, ...run.samples.map(s => ({ ...s, t: s.t + offset }))];
  run.time += offset;
  run.duration += offset;
  run.sectors[0] += offset;
  assert.ok(run.duration > 1200);
  const ctx = context({ session: 'trial', lapStarted: true, recordInterval: .05,
    recording: run.samples, lapTime: run.duration, gateIndex: 8,
    drone: { p: run.samples.at(-1).p, q: run.samples.at(-1).q } });
  vm.runInContext('recordSample(true)', ctx);
  run.samples = plain(ctx.recording);
  assert.ok(run.samples.length < 23900);
  assert.equal(ctx.recordInterval, .1);
  assert.equal(run.samples[0].t, 0);
  assert.equal(run.samples.at(-1).gate, 8);
  validate(run);
});

test('synthetic malformed storage rows are skipped individually', () => {
  const valid = { course: 'canyon', seed: '2048', mode: 'angle', time: 22, penalty: 3 };
  const ctx = context({ flightLog: [], savedRuns: {}, storageOK: true,
    localStorage: { getItem: key => key.includes('log') ? JSON.stringify([null, { course: 'canyon', time: 8 }, valid]) : null } }, ['readStorage']);
  vm.runInContext('readStorage()', ctx);
  assert.deepEqual(plain(ctx.flightLog), [valid]);
  assert.equal(ctx.storageOK, true);
});

test('synthetic exact vertical camera direction has a finite orthonormal basis', () => {
  const ctx = context({}, ['lookAt']);
  const m = Array.from(vm.runInContext('lookAt([0,0,0], [0,1,0], [0,1,0])', ctx));
  assert.ok(m.every(Number.isFinite));
  const basis = [0, 1, 2].map(row => [m[row], m[row + 4], m[row + 8]]);
  for (const axis of basis) assert.ok(Math.abs(Math.hypot(...axis) - 1) < 1e-6);
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
    assert.ok(Math.abs(basis[a].reduce((sum, value, i) => sum + value * basis[b][i], 0)) < 1e-6);
  }
});

test('synthetic ready trial recovery does not move the drone', () => {
  let moved = false;
  let message = '';
  const ctx = context({ phase: 'ready', session: 'trial',
    drone: { recoverAt: () => { moved = true; } }, toast: text => { message = text; } }, ['recover']);
  vm.runInContext('recover()', ctx);
  assert.equal(moved, false);
  assert.match(message, /Start the time trial/);
});

test('synthetic final-step collision is charged before finish and stops later work', () => {
  let observedPenalty;
  const ctx = context({ phase: 'flying', session: 'trial', lapStarted: true,
    input: {}, simTime: 0, lapTime: 0, penalty: 3, recordClock: 0, recordInterval: 1,
    collisionCount: 0, course: { bounds: 180 },
    drone: { p: [0, 2, 0], q: [0, 0, 0, 1], collision: { count: 0, kind: 'gate', impact: 4 },
      step() { this.collision.count++; this.p[0] = 181; } },
    emitCollision() {}, audio: { impact() {} }, flash() {}, event() {},
    recover() { assert.fail('A completed race must not run later boundary recovery'); },
    updateParticles() { assert.fail('A completed step must return immediately'); },
  }, ['simulationStep']);
  ctx.checkRace = () => { observedPenalty = ctx.penalty; ctx.phase = 'finished'; };
  vm.runInContext('simulationStep(1/120)', ctx);
  assert.equal(observedPenalty, 5);
  assert.equal(ctx.phase, 'finished');
});
