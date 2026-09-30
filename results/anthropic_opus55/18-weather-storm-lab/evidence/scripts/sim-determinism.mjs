// Same seed twice -> identical hash after N steps; different seed -> different hash. All presets.
import fs from 'node:fs';
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/\/\/ === CORE BEGIN ===([\s\S]*?)\/\/ === CORE END ===/g)].map(m => m[1]);
new Function(blocks.join('\n') + '\n;globalThis.__core = { Sim, PRESET_ORDER };')();
const { Sim, PRESET_ORDER } = globalThis.__core;
const run = (id, seed) => { const s = Sim.create(id, seed, 32, 12, {}); for (let i = 0; i < 40; i++) s.step(); return s.hash(); };
for (const id of PRESET_ORDER) { const a = run(id, 777), b = run(id, 777), c = run(id, 778); console.log(`${id.padEnd(10)} seed777 ${a} seed777 ${b} seed778 ${c}  ${a === b && a !== c ? 'OK' : 'MISMATCH'}`); }
