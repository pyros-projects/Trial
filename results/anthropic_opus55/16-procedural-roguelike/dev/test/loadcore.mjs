// Loads the engine core. By default it extracts the code between
// ===CORE-START=== and ===CORE-END=== from the delivered index.html, so the
// tests exercise exactly what ships. `--src` uses dev/src/*.js instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
export function loadCore(fromSrc = process.argv.includes('--src')) {
  let code;
  if (fromSrc) {
    const dir = path.join(root, 'dev/src');
    code = fs.readdirSync(dir).filter((f) => /^[1-4]\d-.*\.js$/.test(f)).sort().map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  } else {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const a = html.indexOf('// ===CORE-START==='), b = html.indexOf('// ===CORE-END===');
    if (a < 0 || b < 0) throw new Error('core markers not found in index.html');
    code = html.slice(a, b);
  }
  const names = ['newGame', 'applyAction', 'generateFloor', 'validateFloor', 'simulate', 'serialize', 'deserialize', 'stateHash', 'makeSave', 'loadSave', 'validateState',
    'T', 'TILES', 'ENEMIES', 'ITEMS', 'CLASSES', 'STYLES', 'LAST_FLOOR', 'dmap', 'safeCost', 'gget', 'tWalk', 'diagOk', 'cheb', 'INF', 'DIRS8', 'isVis', 'ensureVision',
    'canSeePlayer', 'actorAt', 'enemyAt', 'pstats', 'makeEnemy', 'regionsOf', 'connPass', 'updateVision', 'worldRound', 'shadowcast', 'tOpaque', 'makeRng', 'rnext', 'styleForFloor', 'perceive', 'SCHEMA_VERSION', 'bestLine', 'projectileTrace'];
  // eslint-disable-next-line no-new-func
  return new Function(code + `\nreturn {${names.join(',')}};`)();
}
