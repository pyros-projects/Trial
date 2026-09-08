// dev/build.mjs — inlines the dev sources into the single self-contained
// index.html at the project root. Dev-only tool; not a runtime dependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);
const shell = fs.readFileSync(path.join(here, 'shell.html'), 'utf8');
const parts = ['00-core.js', '10-render.js', '15-scenarios.js', '20-app.js']
  .map((f) => ({ f, src: fs.readFileSync(path.join(here, 'js', f), 'utf8') }));

const body = parts.map((p) => '\n/* ===== ' + p.f + ' ===== */\n' + p.src).join('\n')
  + '\n\nbootApp(CORE_API, makeScenarios, createRenderer);\n';

const script = '(function(){\n\'use strict\';\n' + body + '\n})();\n';

// defensive: the placeholder must exist
if (!shell.includes('__SCRIPTS__')) {
  console.error('shell.html is missing the __SCRIPTS__ placeholder');
  process.exit(1);
}
const out = shell.replace('<script>\n__SCRIPTS__\n</script>', '<script>\n' + script + '</script>');
const target = path.join(root, 'index.html');
fs.writeFileSync(target, out);

const kb = (out.length / 1024).toFixed(1);
const extern = out.match(/https?:\/\/[^\s"')]+/g) || [];
console.log('wrote ' + target + '  (' + kb + ' KB, ' +
  out.split('\n').length + ' lines)');
if (extern.length) console.log('WARNING external URLs referenced: ' + extern.join(' '));
const banned = ['import(', 'fetch(', 'XMLHttpRequest', 'WebSocket', '<script src', 'href="http',
  '@import', 'url(http'];
for (const b of banned) if (out.includes(b)) console.log('WARNING contains ' + b);
