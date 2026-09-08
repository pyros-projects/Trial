const fs=require('node:fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];assert.equal(scripts.length,1);assert.ok(!/\bsrc\s*=/.test(scripts[0][1]));new Function(scripts[0][2]);
assert.ok(!/<(?:img|iframe|audio|video|source)\b[^>]*\bsrc\s*=\s*["']https?:/i.test(html));assert.ok(!/@import\b|\bfetch\s*\(|XMLHttpRequest|import\s*\(/.test(html));
const remoteAttrs=[...html.matchAll(/\b(?:src|href)\s*=\s*["'](https?:[^"']+)/gi)];assert.equal(remoteAttrs.length,0);
console.log('PASS delivered inline JavaScript syntax');console.log('PASS artifact contains one inline script, no remote asset attributes, imports, fetch or XMLHttpRequest');console.log('Artifact: '+fs.statSync('index.html').size+' bytes');
