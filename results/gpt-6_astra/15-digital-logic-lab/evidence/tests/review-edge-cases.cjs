const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const engineSource = html.match(/<script id="logic-engine">([\s\S]*?)<\/script>/)[1];
const context = {};
vm.createContext(context);
vm.runInContext(engineSource, context);
const { Engine, makeNode, preset, validateCircuit } = context.Logic;
let failures = 0;
function test(name, body) {
  try { body(); console.log('PASS', name); }
  catch (error) { failures++; console.log('FAIL', name, '\n ', error.message); }
}
function circuit(nodes, connections, probes = []) {
  return { name: 'Review circuit', nodes, wires: connections.map(([from, op, to, ip], k) => ({ id: 'rw' + k, from: { node: from.id, port: op }, to: { node: to.id, port: ip } })), probes };
}
function find(e, label) { return e.circuit.nodes.find(n => n.label === label); }
function value(e, label) { return e.output(find(e, label).id); }
function set(e, label, v) { e.setSource(find(e, label).id, v, true); }

test('JSON import rejects inherited and non-string component types', () => {
  const invalidTypes = ['__proto__', 'constructor', 'toString', ['SWITCH']];
  const accepted = [];
  for (const type of invalidTypes) {
    const raw = JSON.parse(JSON.stringify({ nodes: [{ id: 'a', type, bits: 1, x: 0, y: 0 }], wires: [] }));
    try { validateCircuit(raw); accepted.push(type); } catch {}
  }
  assert.equal(accepted.length, 0, 'Incorrectly accepted: ' + JSON.stringify(accepted));
});

test('Holding capture preserves a full sample ring', () => {
  const e = new Engine(preset('counter'));
  for (let k = 0; k < 512; k++) e.tick();
  assert.equal(e.samples.length, 1024);
  const before = JSON.stringify(e.samples);
  // Execute the actual app handler with only its UI repaint stubbed out.
  const tickBody = html.match(/function tick\(\)\{([\s\S]*?)\}\nfunction run\(/)[1];
  const ui = { engine: e, recording: false, refreshSignals() {} };
  vm.createContext(ui);
  vm.runInContext('(function(){' + tickBody + '})()', ui);
  assert.equal(e.samples.length, 1024, 'HOLD must retain the existing sample count');
  assert.equal(JSON.stringify(e.samples), before, 'HOLD changed the recorded samples at ring capacity');
});

test('Surviving probes keep their IDs when an earlier probe is removed', () => {
  const e = new Engine(preset('half'));
  // Preset has p0=A (1), p1=B (0), p2=Sum, p3=Carry.
  const survivor = e.circuit.probes[1];
  const originalId = survivor.id;
  const originalValue = e.samples[0].values[originalId];
  e.circuit.probes.splice(0, 1);
  const compiled = validateCircuit(e.circuit);
  const replacement = compiled.probes.find(p => p.node === survivor.node && p.port === survivor.port);
  const relabeledHistoricalValue = e.samples[0].values[replacement.id];
  assert.equal(replacement.id, originalId,
    `Surviving B probe changed ${originalId} -> ${replacement.id}; retained samples show ${relabeledHistoricalValue} instead of ${originalValue}`);
});

test('Adding a probe does not reuse an ID belonging to retained history', () => {
  const e = new Engine(preset('half'));
  e.circuit.probes.splice(0, 1);
  const output = find(e, 'Carry');
  const marker = "$('#confirm-probe').onclick=()=>{";
  const start = html.indexOf(marker) + marker.length;
  const end = html.indexOf("};$('#probe-name').focus();", start);
  assert.ok(start >= marker.length && end > start, 'Locate the actual Add probe handler');
  const ui = {
    C: e.circuit,
    engine: e,
    candidates: [{ node: output.id, port: 'A' }],
    $: selector => ({ value: selector === '#probe-target' ? '0' : 'New Carry' }),
    checkpoint() {}, closeModal() {}, setTool() {}, renderWave() {}, autosave() {}, toast() {},
    record: phase => e.capture(phase)
  };
  vm.createContext(ui);
  vm.runInContext('(function(){' + html.slice(start, end) + '})()', ui);
  const added = e.circuit.probes.at(-1);
  assert.equal(e.samples[0].values[added.id], undefined,
    'The new probe inherited another signal from before it was attached');
  assert.equal(e.samples.at(-1).values[added.id], 0);
});

test('Imported probe IDs cannot invoke prototype accessors in sample storage', () => {
  const input = makeNode('SWITCH'); input.props.value = 1;
  const e = new Engine(circuit([input], [], [{ id: '__proto__', node: input.id, port: 'Q' }]));
  const id = e.circuit.probes[0].id;
  assert.equal(e.samples[0].values[id], 1, 'A permitted probe ID must store its numeric signal');
  assert.equal(JSON.parse(JSON.stringify(e.samples[0])).values[id], 1, 'Probe data survives JSON serialization');
});

test('Zero-delay clocks and source edits still advance analyzer timestamps', () => {
  const e = new Engine(preset('counter'), { delay: 'zero' });
  for (let k = 0; k < 3; k++) e.tick();
  for (let k = 1; k < e.samples.length; k++) {
    assert.ok(e.samples[k].time > e.samples[k-1].time,
      'Distinct clock half-cycles collapsed at t=' + e.samples[k].time);
  }
  const h = new Engine(preset('half'), { delay: 'zero' });
  const t0 = h.time;
  set(h, 'A', 0); const t1 = h.time;
  set(h, 'A', 1); const t2 = h.time;
  assert.ok(t1 > t0 && t2 > t1, 'External source changes need distinct sample times');
});

test('All same-clock registers capture the pre-edge state in every delay mode', () => {
  for (const delay of ['unit', 'gate', 'zero']) {
    const clk = makeNode('CLOCK', 0, 0, 1, 'clk');
    const input = makeNode('SWITCH', 0, 0, 4, 'input'); input.props.value = 9;
    const a = makeNode('REGISTER', 0, 0, 4, 'first');
    const b = makeNode('REGISTER', 0, 0, 4, 'second');
    const c = makeNode('REGISTER', 0, 0, 4, 'third');
    const e = new Engine(circuit([c, b, a, input, clk], [[input, 'Q', a, 'D'], [a, 'Q', b, 'D'], [b, 'Q', c, 'D'], ...[a,b,c].map(n => [clk, 'Q', n, 'CLK'])]), { delay });
    for (const expected of [[9,0,0], [9,9,0], [9,9,9]]) {
      e.tick();
      assert.deepEqual([e.output(a.id),e.output(b.id),e.output(c.id)], expected, delay);
    }
  }
});

test('CPU executes edited LDI/ADD/OUT/HALT and resets in all delay modes', () => {
  for (const delay of ['unit', 'gate', 'zero']) {
    const c = preset('cpu');
    c.nodes.find(n => n.type === 'ROM').props.memory = [0x1e, 0x23, 0x40, 0x50];
    const e = new Engine(c, { delay });
    const expected = [[1,14,0], [2,1,0], [3,1,1], [3,1,1], [3,1,1]];
    for (const row of expected) {
      e.tick();
      assert.deepEqual([value(e,'Program counter'),value(e,'Accumulator'),value(e,'Output')], row, delay);
    }
    e.reset();
    assert.deepEqual([value(e,'Program counter'),value(e,'Accumulator'),value(e,'Output')], [0,0,0]);
  }
});

test('RAM reads asynchronously, writes only on a rising edge, and resets memory', () => {
  const e = new Engine(preset('memory'));
  const ram = find(e, 'Memory');
  set(e, 'Write enable', 1);
  assert.equal(e.output(ram.id), 0);
  e.tick(); assert.equal(e.output(ram.id), 9);
  set(e, 'Data', 4); assert.equal(e.output(ram.id), 9);
  set(e, 'Address', 3); assert.equal(e.output(ram.id), 0);
  e.tick(); assert.equal(e.output(ram.id), 4);
  set(e, 'Write enable', 0);
  set(e, 'Address', 2); assert.equal(e.output(ram.id), 9);
  e.reset(); assert.equal(e.output(ram.id), 0);
});

test('RAM does not claim known words after a write to an unknown address', () => {
  const c = preset('memory');
  const ram = c.nodes.find(n => n.type === 'RAM');
  const address = c.nodes.find(n => n.label === 'Address');
  const floating = makeNode('TRISTATE', 0, 0, 4, 'Address driver');
  // No EN connection -> disabled, so ADDR is explicitly Z.
  c.nodes.push(floating);
  c.wires = c.wires.filter(w => !(w.to.node === ram.id && w.to.port === 'ADDR'));
  c.wires.push({ id:'rfloating', from:{ node:floating.id,port:'Q' },to:{node:ram.id,port:'ADDR'} });
  c.nodes.find(n => n.label === 'Write enable').props.value = 1;
  const e = new Engine(c);
  assert.equal(e.input(ram.id, 'ADDR'), 'Z');
  e.tick();
  assert.ok(e.state.get(ram.id).mem.every(v => v === 'X'), 'Unknown-address write left potential target words known: ' + JSON.stringify(e.state.get(ram.id).mem));
});

test('A seeded oscillation reaches the event limit and is contained downstream', () => {
  const inv = makeNode('NOT', 0, 0, 1, 'Oscillator'); inv.props.seed = 0;
  const out = makeNode('LED', 0, 0, 1, 'Output');
  const e = new Engine(circuit([inv,out], [[inv,'Q',inv,'A'], [inv,'Q',out,'A']]), { limit: 32 });
  assert.equal(e.oscillating, true);
  assert.equal(e.queue.length, 0);
  assert.equal(e.output(inv.id), 'X');
  assert.equal(e.input(out.id, 'A'), 'X');
  assert.ok(e.events <= 33, 'Event limit bounds an actual toggling feedback chain');
});

console.log(`${failures} review regression(s) failed`);
process.exitCode = failures ? 1 : 0;
