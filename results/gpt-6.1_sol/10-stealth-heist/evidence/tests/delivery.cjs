const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,2);for(const script of scripts)new Function(script[1]);
assert.ok(!/<(?:script|img|audio|video|iframe|link)\b[^>]*(?:src|href)\s*=\s*["'](?!#|data:)/i.test(html),'external asset reference');
assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(html),'network API dependency');
assert.ok(!/@import\b|\bimport\s*(?:\(|[^;]*from\s*["'])/.test(html),'runtime imports');
const css=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
assert.ok(!/url\(\s*["']?(?!data:|#)[a-z/]/i.test(css),'external CSS asset');
console.log('PASS two embedded scripts parse; no external resources, network APIs or runtime imports; single artifact '+Buffer.byteLength(html)+' bytes.');
