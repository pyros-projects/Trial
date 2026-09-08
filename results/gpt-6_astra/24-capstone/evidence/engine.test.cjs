const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const artifact = path.join(__dirname,'../index.html');
assert.ok(fs.existsSync(artifact), 'The delivered application and its weave engine must exist');
const html = fs.readFileSync(artifact,'utf8');
const code = html.match(/<script id="weave-core">([\s\S]*?)<\/script>/)?.[1];
assert.ok(code, 'The actual embedded engine must be available');
const ctx = {}; vm.createContext(ctx); vm.runInContext(code,ctx);
const W = ctx.WeaveCore;
let passed = 0;
function test(name, fn) { fn(); console.log('PASS', name); passed++; }
const plain = [[1,0,1,0],[0,1,0,1],[1,0,1,0],[0,1,0,1]];
const twill = [[1,1,0,0],[0,1,1,0],[0,0,1,1],[1,0,0,1]];
test('plain weave alternates on both axes: max 1, no unbound, 50% warp',()=>{
 const a=W.analyze(plain); assert.equal(a.max,1); assert.equal(a.unbound,0); assert.equal(a.warpFraction,.5);
});
test('2/2 twill has two-thread floats even where the repeat wraps',()=>{
 const a=W.analyze(twill); assert.equal(a.max,2); assert.equal(a.unbound,0);
 assert.ok(a.runs.some(r=>r.start===3 && r.length===2));
});
test('cyclic scan merges a seam-spanning three-thread float',()=>{
 const a=W.analyze([[1,1,0,1],[0,0,1,0],[1,0,1,0],[0,1,0,1]]);
 assert.ok(a.runs.some(r=>r.axis==='weft' && r.thread===0 && r.start===3 && r.length===3 && r.face==='reverse'));
});
test('all-warp has unbound yarns on both axes, not finite four-thread floats',()=>{
 const a=W.analyze(Array.from({length:4},()=>[1,1,1,1]));
 assert.equal(a.unbound,8); assert.equal(a.max,Infinity); assert.equal(a.warpFraction,1);
});
test('reverse mirrors columns and complements which yarn is visible',()=>{
 const p={n:4,cells:twill};
 assert.equal(W.at(p,0,0,false),1); assert.equal(W.at(p,0,0,true),1);
 assert.equal(W.at(p,0,2,false),0); assert.equal(W.at(p,0,2,true),0);
 for(let y=0;y<4;y++) for(let x=0;x<4;x++) assert.equal(W.at(p,y,x,false)+W.at(p,y,3-x,true),1);
});
test('binding makes one real crossing edit and reduces unbound yarn count',()=>{
 const m=Array.from({length:4},()=>[1,1,1,1]); const b=W.bindOne(m,3);
 assert.ok(b); assert.equal(b.cells.flat().filter(v=>v===0).length,1);
 assert.equal(W.analyze(b.cells).unbound,6); assert.equal(m.flat().reduce((a,b)=>a+b),16);
});
test('plain weave needs no binding and is not damaged by the helper',()=>{assert.equal(W.bindOne(plain,3),null);});
test('4 + 4 yarn bands keep their eight-thread period across a 12-crossing seam',()=>{
 const p={...W.initial(),n:12,rhythm:'bands'};
 for(const axis of ['warp','weft']) {
  const base=axis==='warp'?p.warp:p.weft,other=axis==='warp'?p.weft:p.warp;
  const expected=[base,base,base,base,other,other,other,other];
  for(let i=-8;i<32;i++)assert.equal(W.yarn(p,axis,i),expected[(i+8)%8],`${axis} yarn ${i}`);
 }
 assert.equal(W.repeatSpan(p),24);
});
test('valid project round-trips without losing a custom crossing or name',()=>{
 const p=W.initial(); p.name='My linen experiment'; p.cells[2][5]^=1;
 const q=W.validate(JSON.parse(JSON.stringify({format:'selvedge',version:1,project:p})));
 assert.equal(JSON.stringify(q),JSON.stringify(p));
});
test('malformed, excessive, and unsafe project inputs fail before being accepted',()=>{
 for(const mutate of [p=>p.n=2048,p=>p.cells[0][0]=2,p=>p.cells.pop(),p=>p.warp='url(https://example.com)',p=>p.rhythm='evil',p=>p.name='x'.repeat(100)]) {
  const p=W.initial(); mutate(p); assert.throws(()=>W.validate({format:'selvedge',version:1,project:p}));
 }
 assert.throws(()=>W.validate({format:'other',version:1,project:W.initial()}));
});
console.log(`${passed} behavioral engine tests passed.`);
