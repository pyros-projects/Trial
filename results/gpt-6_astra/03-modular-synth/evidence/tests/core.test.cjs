const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = path.resolve(__dirname, '../../index.html');
assert.ok(fs.existsSync(file), 'The delivered self-contained application must exist');
const html = fs.readFileSync(file, 'utf8');
const script = html.match(/<script id="project-core">([\s\S]*?)<\/script>/);
assert.ok(script, 'Project behavior is available in the delivered application');
const sandbox = { Float32Array, ArrayBuffer, DataView, Math, JSON, console };
vm.createContext(sandbox);
vm.runInContext(script[1] + '\nthis.Core = Core;', sandbox);
const {Core} = sandbox;
// Catches loss of deterministic randomization and accidental shared mutable presets.
const a = Core.makeProject('midnight'), b = Core.makeProject('midnight');
assert.equal(JSON.stringify(a), JSON.stringify(b));
a.tracks[0].steps[0].velocity = 0.1;
assert.notEqual(a.tracks[0].steps[0].velocity, b.tracks[0].steps[0].velocity);
const r1 = Core.randomize(b.tracks[0], 9876, 0.55, 'minor', 2);
const r2 = Core.randomize(b.tracks[0], 9876, 0.55, 'minor', 2);
assert.equal(JSON.stringify(r1), JSON.stringify(r2));
assert.notEqual(JSON.stringify(r1), JSON.stringify(Core.randomize(b.tracks[0], 9877, 0.55, 'minor', 2)));
// At 120 BPM sixteenths total 0.25 seconds per pair, regardless of swing.
assert.equal(Core.stepDuration(120, 0, 0), 0.125);
assert.ok(Math.abs(Core.stepDuration(120, 0.4, 0) - 0.175) < 1e-10);
assert.ok(Math.abs(Core.stepDuration(120, 0.4, 1) - 0.075) < 1e-10);
assert.ok(Math.abs(Core.stepDuration(120, 0.4, 0) + Core.stepDuration(120, 0.4, 1) - 0.25) < 1e-10);
// Untrusted imports must not partially mutate a working project or allow NaN/unsafe gain.
assert.throws(() => Core.validateProject({}), /project/i);
const corrupted = JSON.parse(JSON.stringify(b)); corrupted.tracks[0].volume = 'loud';
assert.throws(() => Core.validateProject(corrupted), /volume/i);
const invalidNotes = JSON.parse(JSON.stringify(b)); invalidNotes.tracks[0].steps[0].notes = [999];
assert.throws(() => Core.validateProject(invalidNotes), /note/i);
const extraEffect = JSON.parse(JSON.stringify(b)); extraEffect.fx.unknown = {on:true,amount:0.5};
assert.throws(() => Core.validateProject(extraEffect), /unknown effect/i);
assert.equal(JSON.stringify(Core.validateProject(b)), JSON.stringify(b));
// Catches wrong PCM interleaving, signed scaling, RIFF size, channel count and sample rate.
const wav = Core.encodeWav([new Float32Array([0,1,-1]), new Float32Array([0.5,-0.5,0])], 44100);
const view = new DataView(wav);
assert.equal(view.getUint32(4,true), 48);
assert.equal(view.getUint16(22,true), 2);
assert.equal(view.getUint32(24,true), 44100);
assert.equal(view.getUint32(40,true), 12);
assert.equal(view.getInt16(46,true), 16383);
assert.equal(view.getInt16(48,true), 32767);
assert.equal(view.getInt16(52,true), -32768);
console.log('PASS: deterministic patterns, independent presets, swung timing, project validation, stereo PCM WAV encoding');
