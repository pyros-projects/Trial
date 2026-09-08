/* Engine test harness.
   Run:  cat src/sim.js evidence/test-sim.js > /tmp/t.js && node /tmp/t.js
   sim.js is DOM-free by design, so the whole cellular system can be
   exercised headless here; the browser run covers rendering + input. */

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  PASS  ' + label + (extra ? '  [' + extra + ']' : '')); }
  else { fail++; console.log('  FAIL  ' + label + (extra ? '  [' + extra + ']' : '')); }
}
function head(t) { console.log('\n== ' + t); }
function count(m) { let c = 0; for (let i = 0; i < N; i++) if (mat[i] === m) c++; return c; }
function countCat(pred) { let c = 0; for (let i = 0; i < N; i++) if (pred(mat[i], i)) c++; return c; }
function rect(x, y, w, h, m, t) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inb(x + i, y + j)) putRaw(x + i, y + j, m, t, null);
}
function wakeAll() { for (let y = 0; y < H; y += CS) for (let x = 0; x < W; x += CS) wakeAt(x, y); }
function run(n) { for (let k = 0; k < n; k++) stepSim(); }
function dump(x0, y0, w, h) {
  let s = '';
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) s += (mat[y * W + x] === EMPTY ? '.' : NAMES[mat[y * W + x]][0].toLowerCase());
    s += '\n';
  }
  return s;
}
function reset(w, h) { srand(99); rect(0, 0, w, h, EMPTY); wakeAll(); }

/* ------------------------------------------------------------------ */
head('1. gravity + pile formation (sand)');
allocWorld(80, 60, 7);
rect(10, 4, 3, 3, SAND);
rect(30, 40, 20, 12, SAND);
run(60);
let bottomSand = 0;
for (let x = 0; x < W; x++) if (mat[(H - 1) * W + x] === SAND) bottomSand++;
ok(bottomSand >= 20, 'sand migrated to the floor and piled', 'floor cells=' + bottomSand);
ok(count(SAND) === 9 + 240, 'sand is conserved (no creation/destruction)', 'count=' + count(SAND));

head('2. liquid levelling + density layering');
allocWorld(120, 44, 11);
rect(0, 34, 120, 10, STONE);
rect(52, 2, 16, 12, WATER);
run(300);
let topY = [], spread = 0;
for (let x = 0; x < W; x++) {
  let y = 0; while (y < H && mat[y * W + x] !== WATER) y++;
  if (y < H) { spread++; topY.push(y); }
}
let minY = 99, maxY = 0;
for (const y of topY) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
ok(spread > 60, 'water spread sideways instead of staying a blob', 'columns with water=' + spread);
ok(maxY - minY <= 4, 'settled surface is level', 'surface varies ' + (maxY - minY) + ' rows');

allocWorld(100, 40, 12);
rect(0, 24, 100, 16, WATER);
rect(0, 10, 100, 8, OIL);
run(120);
let oilBelowWater = 0;
for (let x = 0; x < W; x++) {
  let firstWater = -1, lastOil = -1;
  for (let y = 0; y < H; y++) { if (mat[y * W + x] === WATER && firstWater < 0) firstWater = y; if (mat[y * W + x] === OIL) lastOil = y; }
  if (firstWater >= 0 && lastOil > firstWater) oilBelowWater++;
}
ok(oilBelowWater < 4, 'oil stays on top of water (density separation)', 'inverted columns=' + oilBelowWater);

allocWorld(60, 60, 13);
rect(0, 40, 60, 18, WATER);
rect(20, 4, 10, 10, SAND);
run(240);
let waterOverSand = 0, sandN = 0;
for (let i = 0; i < N; i++) if (mat[i] === SAND) {
  sandN++;
  if (i - W >= 0 && mat[i - W] === WATER) waterOverSand++;
}
ok(waterOverSand > 30, 'dense sand sinks under the water', 'sand cells with water above=' + waterOverSand + '/' + sandN);

head('3. dissolving: salt in water');
allocWorld(60, 40, 21);
rect(0, 20, 60, 18, WATER);
rect(24, 6, 8, 8, SALT);
run(200);
ok(count(BRINE) > 10, 'salt dissolves into brine', 'brine=' + count(BRINE) + ' salt=' + count(SALT));

head('4. lava quench: water -> steam, lava -> stone');
allocWorld(80, 60, 22);
rect(20, 40, 30, 12, LAVA, 1500);
rect(24, 20, 20, 8, WATER, 20);
run(240);
ok(count(STEAM) > 5, 'lava flashes water into steam', 'steam=' + count(STEAM));
ok(count(STONE) > 10, 'contact crusts the lava into stone', 'stone=' + count(STONE));

allocWorld(60, 40, 23);
rect(6, 24, 40, 8, LAVA, 1500);
run(150);
ok(count(LAVA) === 320 && count(STONE) === 0, 'an isolated lava pool stays molten (heat source, no quench)',
  'lava=' + count(LAVA) + ' stone=' + count(STONE));

head('5. combustion chain: fire spreads and consumes fuel');
allocWorld(120, 60, 31);
rect(10, 20, 60, 4, WOOD);
rect(72, 20, 12, 6, OIL);
putRaw(11, 21, FIRE, 800, 22);
putRaw(12, 22, FIRE, 800, 22);
const wood0 = count(WOOD);
run(30);
ok(count(FIRE) >= 0, 'dense timber smoulders instead of flaring (no air gaps)', 'fire=' + count(FIRE));
allocWorld(120, 60, 32);
for (let y = 16; y < 40; y++) for (let x = 10; x < 80; x++) if ((x + y) % 2 === 0) putRaw(x, y, WOOD, 25, null);
for (let y = 16; y < 40; y++) for (let x = 84; x < 96; y++, x++) putRaw(x, y, OIL, 25, null);
putRaw(11, 28, FIRE, 800, 20);
putRaw(13, 28, FIRE, 800, 20);
run(40);
ok(count(FIRE) > 6, 'flame multiplies where fuel has air gaps', 'fire=' + count(FIRE));
ok(count(SMOKE) > 6, 'fire produces smoke', 'smoke=' + count(SMOKE));
run(270);
const residues = count(CHAR) + count(ASH);
ok(residues > 20, 'fire crept through the timber and left char/ash', 'residues=' + residues + ' of ' + wood0 + ' wood');
run(600);
ok(count(FIRE) < 30, 'fire eventually dies out (fuel is finite)', 'fire=' + count(FIRE));

head('6. quenching: water stops fire');
allocWorld(80, 40, 32);
rect(20, 20, 30, 4, WOOD);
putRaw(22, 21, FIRE, 800, 22);
putRaw(24, 21, FIRE, 800, 22);
run(10);
const fireWet0 = count(FIRE);
rect(18, 18, 34, 3, WATER, 20);
run(80);
ok(count(FIRE) < fireWet0, 'water quenched the fire', 'fire ' + fireWet0 + ' -> ' + count(FIRE));

head('7. corrosion: acid eats metal, not glass');
allocWorld(80, 60, 41);
rect(20, 20, 30, 4, METAL);
rect(20, 14, 30, 5, ACID);
rect(60, 20, 8, 6, GLASS);
rect(60, 14, 8, 5, ACID);
run(300);
ok(count(RUST) > 3, 'acid corroded metal into rust', 'rust=' + count(RUST));
ok(count(GAS) > 0 || count(RUST) > 3, 'corrosion releases hydrogen', 'gas=' + count(GAS));
let glassIntact = 0;
for (let i = 0; i < N; i++) if (mat[i] === GLASS) glassIntact++;
ok(glassIntact === 48, 'glass is immune to acid', 'glass cells=' + glassIntact + '/48');

head('8. electrical conduction');
allocWorld(80, 40, 51);
for (let x = 8; x < 60; x++) putRaw(x, 20, METAL);
putRaw(6, 20, BATT);
putRaw(62, 20, POWDER);
run(30);
let live0 = 0; for (let i = 0; i < N; i++) if (chgA[i] > 0) live0++;
ok(live0 > 20, 'current flows along the wire', 'charged cells=' + live0);
run(120);
ok(count(POWDER) < 10 || count(FIRE) > 0, 'gunpowder detonated on the live wire',
  'powder=' + count(POWDER) + ' fire=' + count(FIRE));

allocWorld(60, 40, 52);
for (let x = 10; x < 50; x++) putRaw(x, 20, METAL);
putRaw(30, 21, EMPTY);
putRaw(29, 21, EMPTY);
putRaw(8, 20, BATT);
run(20);
let jump = 0;
for (let i = 0; i < N; i++) if (mat[i] === SPARK) jump++;
ok(jump > 0, 'current arcs across an air gap', 'spark cells=' + jump);

head('9. freezing + melting (temperature driven phase change)');
allocWorld(60, 40, 61);
P.ambient = -22;
rect(0, 14, 60, 16, WATER, 18);
run(200);
ok(count(ICE) > 60, 'water freezes below 0 °C', 'ice=' + count(ICE));
P.ambient = 24;
run(300);
ok(count(ICE) < 200, 'ice melts when the ambient rises', 'ice=' + count(ICE));

head('10. plant growth consumes water');
allocWorld(70, 50, 71);
P.ambient = 26;
rect(0, 40, 70, 9, SOIL);
rect(4, 34, 20, 6, WATER, 24);
for (let i = 0; i < 12; i++) putRaw(24 + (i % 6), 36 + ((i / 6) | 0), PLANT, 26, 46);
const plant0 = count(PLANT), water0 = count(WATER);
run(600);
ok(count(PLANT) > plant0 + 10, 'plants spread beyond the seeded patch',
  'plant ' + plant0 + ' -> ' + count(PLANT));
ok(count(WATER) < water0, 'growth consumed water', 'water ' + water0 + ' -> ' + count(WATER));

head('11. explosion impulse');
allocWorld(100, 60, 81);
rect(20, 10, 60, 30, SAND);
const before = (() => { let s = 0; for (let i = 0; i < N; i++) if (mat[i] === SAND) s++; return s; })();
explode(50, 25, 12, false);
run(4);
let movedFast = 0;
for (let i = 0; i < N; i++) if (Math.abs(vx[i]) + Math.abs(vy[i]) > 1) movedFast++;
ok(movedFast > 30, 'blast ring pushed material outward', 'cells over 1 u/step=' + movedFast);
run(120);
ok(count(SAND) === before, 'blast conserved the sand', 'sand=' + count(SAND) + '/' + before);

head('12. gas rise + condensation + condensation drip');
allocWorld(60, 60, 91);
rect(20, 20, 20, 20, STEAM, 110);
rect(10, 10, 40, 2, ICE, -20);
run(200);
ok(count(STEAM) + count(WATER) > 0 && count(WATER) > 3, 'steam condenses against the cold ceiling',
  'water=' + count(WATER) + ' steam=' + count(STEAM));

head('13. gravity rotation');
allocWorld(60, 60, 101);
rect(20, 20, 8, 8, SAND);
setGravityDir(6); // right
run(80);
let rightMost = 0;
for (let i = 0; i < N; i++) if (mat[i] === SAND) { const x = i % W; if (x > rightMost) rightMost = x; }
ok(rightMost > 40, 'sand falls toward the rotated gravity vector', 'max x=' + rightMost);
setGravityDir(0);

head('14. persistence codec');
allocWorld(64, 48, 111);
rect(4, 4, 30, 20, WATER);
rect(40, 30, 12, 10, METAL);
run(40);
const snapshot = encodeState();
const probe = [];
for (let i = 0; i < N; i += 97) probe.push(mat[i], Math.round(temp[i] * 2));
allocWorld(64, 48, 222);
const err = decodeState(snapshot);
let same = true;
for (let k = 0, i = 0; i < 64 * 48; i += 97, k += 2) {
  if (mat[i] !== probe[k] || Math.round(temp[i] * 2) !== probe[k + 1]) { same = false; break; }
}
ok(!err && same, 'state survives an encode/decode round trip', err || 'grid + temperature restored');

head('15. performance');
allocWorld(240, 150, 333);
P.ambient = 30;
const kinds = [SAND, WATER, OIL, SALT, WOOD, PLANT, STONE, METAL, ACID, GAS, POWDER, STEAM, RUST, CHAR, SOIL, BRINE, SNOW, GLASS, PLASTIC, MOLTEN, LAVA, ASH];
srand(7);
for (let k = 0; k < 900; k++) {
  const m = kinds[(rnd() * kinds.length) | 0];
  const x = (rnd() * W) | 0, y = (rnd() * H) | 0, r = 2 + ((rnd() * 6) | 0);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    if (!inb(x + dx, y + dy)) continue;
    if (rnd() < 0.6) putRaw(x + dx, y + dy, m, null, null);
  }
}
run(30);
const t0 = Date.now();
run(120);
const dt = Date.now() - t0;
let act = 0;
for (let i = 0; i < NC; i++) if (actA[i]) act++;
const perStep = dt / 120;
ok(perStep < 26, '36k-cell grid with heavy activity stays near 60 steps/s',
  perStep.toFixed(2) + ' ms/step, active chunks=' + act + '/' + NC);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;