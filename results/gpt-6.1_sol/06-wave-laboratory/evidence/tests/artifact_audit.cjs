const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,2);
for(const [i,m] of scripts.entries()){cp.execFileSync(process.execPath,['--check'],{input:m[1],encoding:'utf8'});console.log('PASS inline JavaScript syntax, script '+(i+1));}
assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html));
assert.ok(!/\b(?:src|href)\s*=\s*["'](?:https?:|\/\/)/i.test(html));
assert.ok(!/@import|url\(\s*["']?https?:/i.test(html));
for(const m of scripts)assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bimport\s*\(/.test(m[1]));
console.log('PASS dependency audit: embedded styles, code and SVG; no network asset or API dependency');
console.log('Artifact bytes: '+Buffer.byteLength(html));
console.log('SHA-256: '+crypto.createHash('sha256').update(html).digest('hex'));
