const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),c={window:{}};
vm.runInNewContext(html.match(/<script id="physics">([\s\S]*?)<\/script>/)[1],c);
const P=c.window.Physics;
const r=P.trace([5.59,2.86,16.86],[-.5338631491,-.3140371465,-.7850928663],{...P.defaults,thickness:.8});
assert.ok(r.hit,'A ray leaving the emitting slab at its outer edge must report the same disk hit as the shader');
assert.ok(Math.abs(r.hit.radius-8.963344)<.001);
assert.ok(Math.abs(r.hit.total-.810274)<.001);
console.log('PASS: disk-edge ray reports r='+r.hit.radius+', g='+r.hit.total);
