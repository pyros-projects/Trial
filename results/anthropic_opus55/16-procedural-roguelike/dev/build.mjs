// Dev-only: assembles dev/src/* into the single self-contained index.html.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const src = path.join(root, 'dev/src');
const shell = fs.readFileSync(path.join(src, '00-shell.html'), 'utf8');
const js = fs.readdirSync(src).filter((f) => /^\d\d-.*\.js$/.test(f)).sort().map((f) => `// ---- ${f}\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
if (/<\/script/i.test(js)) throw new Error('script contains </script');
const out = shell.replace('/*@@SCRIPT@@*/', () => js);
fs.writeFileSync(path.join(root, 'index.html'), out);
fs.writeFileSync(path.join(root, 'dev/.bundle-check.js'), js);
console.log(`index.html: ${(out.length / 1024).toFixed(1)} KB, ${out.split('\n').length} lines`);
