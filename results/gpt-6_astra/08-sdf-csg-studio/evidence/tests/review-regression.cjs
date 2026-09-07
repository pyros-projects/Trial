const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');const SDF=vm.runInNewContext(html.match(/<script id="sdf-core">([\s\S]*?)<\/script>/)[1]+';SDF;');
assert.equal(typeof SDF.constrain,'function','Interactive edits must preserve the serialization bounds');
let scene=SDF.preset('sculpture');scene.camera.yaw=1003;scene.camera.target=[1001,-1400,0];scene.objects[0].position=[0,0,-3664.66];
SDF.constrain(scene);assert.ok(Math.abs(scene.camera.yaw)<=Math.PI);assert.ok(scene.camera.target.every(v=>Math.abs(v)<=1000));assert.equal(scene.objects[0].position[2],-1000);assert.doesNotThrow(()=>SDF.validate(scene));
scene=SDF.preset('empty');scene.objects=[SDF.object('sphere',{id:1000000000})];scene.selected=1000000000;assert.doesNotThrow(()=>SDF.validate(scene));const newId=SDF.allocateId(scene.objects);assert.ok(newId>=1&&newId<=1000000000);assert.notEqual(newId,1000000000);scene.objects.push(SDF.object('box',{id:newId}));assert.doesNotThrow(()=>SDF.validate(scene));
console.log('PASS: extreme viewport transforms stay serializable; valid maximum imported ID supports subsequent creation.');
