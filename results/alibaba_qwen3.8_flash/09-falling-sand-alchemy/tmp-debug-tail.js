
let TR = [];
function cnt(m) { let c = 0; for (let i = 0; i < N; i++) if (mat[i] === m) c++; return c; }
allocWorld(60, 40, 33);
for (let y = 10; y < 30; y++) for (let x = 6; x < 40; x++) if ((x + y) % 2 === 0) putRaw(x, y, WOOD, 25, null);
putRaw(7, 20, FIRE, 800, 20);
putRaw(9, 20, FIRE, 800, 20);
for (let k = 0; k < 20; k++) {
  TR.length = 0;
  stepSim();
  console.log('--- step ' + (k + 1) + ' fire=' + cnt(FIRE) + ' char=' + cnt(CHAR));
  for (const l of TR.slice(0, 8)) console.log(l);
}
