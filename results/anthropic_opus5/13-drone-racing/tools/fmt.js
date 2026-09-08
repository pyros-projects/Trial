// compact one-line-per-sample formatter for fly.js output
const rows = JSON.parse(require('fs').readFileSync(process.argv[2] || 0, 'utf8'));
const p = (n, w = 6) => String(n).padStart(w);
for (const r of rows) {
  if (r.value !== undefined) { console.log(`· ${r.tag}: ${JSON.stringify(r.value).slice(0, 220)}`); continue; }
  console.log(
    `${(r.tag || '').padEnd(26)} t=${p(r.t, 6)} pos=[${r.pos.map(v => p(v, 7)).join(',')}] spd=${p(r.speed, 6)} alt=${p(r.alt, 6)} ` +
    `rpy=[${p(r.att.r, 6)},${p(r.att.p, 6)},${p(r.att.y, 7)}] w=[${r.omega.map(v => p(v, 6)).join(',')}] thr=${p(r.thr, 5)} ` +
    `mot=[${r.motors.map(v => p(v, 4)).join(',')}] ${r.mode}/${r.cam} gate=${r.gate} lap=${r.lap} lt=${p(r.lapTime, 6)}` +
    `${r.crashed ? ' CRASHED' : ''}${r.contact ? ' contact:' + r.contactKind : ''}${r.errors ? ' ERR=' + r.errors : ''} fps=${r.fps}`);
}
