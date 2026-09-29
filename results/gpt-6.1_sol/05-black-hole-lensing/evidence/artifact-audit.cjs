// Agent-authored static audit; not a runtime dependency.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const javascript = scripts.filter(s => !/type\s*=\s*["']x-shader\//i.test(s[1]));
javascript.forEach((s, i) => new vm.Script(s[2], { filename: `index.html embedded script ${i + 1}` }));
const references = [];
for (const tag of html.matchAll(/<(?:script|img|link|iframe|source|video|audio|use)\b[^>]*>/gi)) {
  for (const a of tag[0].matchAll(/(?:src|href|xlink:href)\s*=\s*["']([^"']*)["']/gi)) references.push(a[1]);
}
const external = references.filter(r => r && !r.startsWith('#') && !r.startsWith('data:') && !r.startsWith('blob:'));
assert.equal(external.length, 0, 'External or separate-file resource reference');
assert(!/@import\b|\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|import\s*\(/.test(html), 'Network request or runtime import found');
const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(s => s[1]).join('\n');
for (const match of css.matchAll(/\burl\(\s*["']?([^\s)'";]+)/gi)) {
  assert(match[1].startsWith('data:') || match[1].startsWith('#'), 'CSS resource dependency');
}
assert.equal(scripts.length, 6);
assert.equal(javascript.length, 2);
const report = {
  artifact: 'index.html', bytes: Buffer.byteLength(html), sha256: crypto.createHash('sha256').update(html).digest('hex'),
  embeddedJavaScriptParsed: javascript.length, embeddedShaders: scripts.length - javascript.length,
  resourceReferences: references.length, externalResourceReferences: external,
  staticDependencyAudit: 'pass', javascriptSyntax: 'pass',
  directFileOfflineBrowserEvidence: 'logs/fresh-network.txt'
};
fs.writeFileSync('evidence/logs/artifact-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
