// Development-only audit. The delivered HTML never loads this file.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 2, 'The two application scripts must be embedded');
for (const id of ['engine', 'app']) {
  const match = scripts.find(s => s[1].includes(`id="${id}"`));
  assert.ok(match, `Missing ${id}`);
  assert.ok(!/\bsrc\s*=/.test(match[1]), 'No external script');
  fs.writeFileSync(`evidence/${id}-syntax.js`, match[2]);
  execFileSync(process.execPath, ['--check', `evidence/${id}-syntax.js`]);
}
const externalAssets = [...html.matchAll(/\b(?:src|href)\s*=\s*["']((?:https?:|\/\/)[^"']*)["']/gi)].map(m => m[1]);
const runtimeNetworkCalls = /\b(?:fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(/.test(scripts.map(s => s[2]).join('\n'));
const externalCSS = /@import\b|url\s*\(/i.test(html.match(/<style>([\s\S]*?)<\/style>/)[1]);
assert.deepEqual(externalAssets, []);
assert.equal(runtimeNetworkCalls, false);
assert.equal(externalCSS, false);
assert.ok(!/<script[^>]+type=["']module/i.test(html));
const audit = {
  bytes: Buffer.byteLength(html),
  sha256: createHash('sha256').update(html).digest('hex'),
  externalAssetAttributes: externalAssets,
  runtimeNetworkCalls,
  externalCSS,
  scriptBlocks: scripts.length,
  syntax: 'Both embedded scripts passed node --check'
};
fs.writeFileSync('evidence/logs/dependency-audit.json', JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit, null, 2));
