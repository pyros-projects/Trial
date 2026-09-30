const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync('index.html','utf8'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,2);for(const [i,script]of scripts.entries())new vm.Script(script,{filename:'index.html inline script '+i});
assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html),'No runtime script assets');
assert.ok(!/<(?:link|img|iframe)\b[^>]*(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i.test(html),'No external element assets');
assert.ok(!/@import\b|url\(\s*["']?https?:/i.test(html),'No external CSS assets');
const code=scripts.join('\n');assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|serviceWorker|sharedStorage)\b|document\.cookie|navigator\.clipboard|parent\./.test(code),'No network, storage, clipboard or parent APIs');
console.log('PASS two inline JavaScript blocks parse');console.log('PASS runtime asset and forbidden API audit');
console.log('Artifact bytes: '+Buffer.byteLength(html));console.log('SHA-256: '+crypto.createHash('sha256').update(html).digest('hex'));
