// Tests catch corrupt imports, lost object identity, nondeterministic round trips,
// and invalid numeric values reaching the GPU. Runs the actual embedded core.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const file='index.html';
if(!fs.existsSync(file)){console.error('FAIL: delivered scene core is missing');process.exit(1)}
const html=fs.readFileSync(file,'utf8');
const block=html.match(/<script id="scene-core">([\s\S]*?)<\/script>/);
assert.ok(block,'embedded scene core exists');
const ctx={};vm.createContext(ctx);vm.runInContext(block[1],ctx);
const core=ctx.SceneCore;
const obj=core.makeObject('sphere',3);obj.name='A <safe> sphere';obj.position=[1,2,3];obj.scale=[1,.5,2];
const scene=core.makeScene([obj]);
let passed=0;
function test(name,fn){try{fn();passed++;console.log('PASS:',name)}catch(e){console.error('FAIL:',name,e.message);process.exitCode=1}}
test('complete scene survives deterministic JSON round trip',()=>{const text=core.serialize(scene);const imported=core.parse(text);assert.equal(core.serialize(imported),text);assert.equal(imported.objects[0].id,3);assert.equal(imported.objects[0].name,'A <safe> sphere');assert.equal(imported.objects[0].scale[1],.5)});
test('unknown primitives and invalid operations are rejected',()=>{const a=JSON.parse(core.serialize(scene));a.objects[0].type='mesh';assert.throws(()=>core.parse(JSON.stringify(a)),/primitive/i);a.objects[0].type='sphere';a.objects[0].operation='xor';assert.throws(()=>core.parse(JSON.stringify(a)),/operation/i)});
test('invalid scales and duplicate identities are rejected',()=>{const a=JSON.parse(core.serialize(scene));a.objects[0].scale[0]=0;assert.throws(()=>core.parse(JSON.stringify(a)),/scale/i);a.objects[0].scale[0]=1;a.objects.push({...a.objects[0]});assert.throws(()=>core.parse(JSON.stringify(a)),/unique/i)});
test('nonfinite, out-of-range, and oversized scenes are rejected',()=>{const a=JSON.parse(core.serialize(scene));a.settings.epsilon=-.1;assert.throws(()=>core.parse(JSON.stringify(a)),/epsilon/i);a.settings.epsilon=.002;a.objects[0].position[0]=null;assert.throws(()=>core.parse(JSON.stringify(a)),/position/i);a.objects=Array.from({length:33},(_,i)=>({...obj,id:i+1}));assert.throws(()=>core.parse(JSON.stringify(a)),/32/i)});
test('empty scene is valid; unrecognized document is rejected',()=>{assert.equal(core.parse(core.serialize(core.makeScene([]))).objects.length,0);assert.throws(()=>core.parse('{}'),/FIELD|version|scene/i);assert.throws(()=>core.parse('nonsense'),/JSON/i)});
console.log(`${passed}/5 passed`);
