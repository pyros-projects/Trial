#!/usr/bin/env node
/* Test harness only — NOT part of the delivered artifact.
   Pulls the simulation half of ../../index.html out into core.js so the Node suites can
   exercise map generation, pathfinding, sound propagation and guard AI without a browser. */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const m = /<script>\n([\s\S]*)\n<\/script>/.exec(html);
if (!m) { console.error('no <script> block found'); process.exit(1); }
const js = m[1];
const i = js.indexOf('   6. INPUT');
const core = js.slice(0, js.lastIndexOf('/* ====', i));
fs.writeFileSync(path.join(__dirname, 'core.js'),
  core + '\nmodule.exports={makeMission,Sim,snapshotMission,resetMission,PRESETS,DIFFS,' +
  'GADGET_DEFS,GS,PF,SoundField,tileIdxAt,blocksMoveTile,losClear,castRay,reachFrom,' +
  'TILE,SIM_DT,bfsDist,Rng,hashStr};\n');
console.log('wrote', path.join(__dirname, 'core.js'), '(' + core.length + ' chars)');
