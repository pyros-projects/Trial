// build.mjs — inlines src/* into a single self-contained index.html
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

const order = ['10-util.js', '20-audio.js', '30-sched.js', '40-ui.js', '45-roll.js', '50-vis.js', '60-io.js'];
let js = '';
for (const f of order) {
  const code = src(f);
  js += `\n/* ==== ${f} ==== */\n` + code.replace(/^\s*'use strict';\s*$/gm, '');
}
const body = "'use strict';\n(function(){\n" + js + "\n})();\n";

// quick syntax gate
try { new Function(body); } catch (e) {
  console.error('SYNTAX ERROR:', e.message);
  writeFileSync(join(root, 'build-check.js'), body);
  process.exit(1);
}

let html = src('shell.html');
const css = src('style.css');
html = html.replace('__STYLE__', () => css).replace('__SCRIPT__', () => body);
writeFileSync(join(root, 'index.html'), html);
const kb = (n) => (n / 1024).toFixed(1) + ' kB';
console.log('built index.html', kb(html.length), '(css', kb(css.length) + ', js', kb(body.length) + ')');
