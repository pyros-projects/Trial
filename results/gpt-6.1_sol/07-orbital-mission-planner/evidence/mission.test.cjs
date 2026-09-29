const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');let passed=0,failed=0;function test(n,f){try{f();console.log('PASS '+n);passed++;}catch(e){console.log('FAIL '+n+': '+e.message);failed++;}}
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),script=html.match(/<script id="mission-core">([\s\S]*?)<\/script>/);let M;
test('mission validation module is available',()=>{assert.ok(script,'mission core not implemented');const c=vm.createContext({});vm.runInContext(script[1],c);M=vm.runInContext('Mission',c);});
if(M){const craft={id:'s',name:'Free craft',kind:'craft',mass:1e-6,radius:.1,display:7,x:0,y:0,vx:1,vy:0,color:'#8fe8c2'},mission=()=>({format:'orbitlab-mission',version:1,scenario:'escape',time:0,bodies:[{...craft}],nodes:[{id:'node-1',bodyId:'s',time:1,mode:'cartesian',a:.1,b:.1,executed:false}],config:{...M.defaultConfig},selectedId:'s',frame:'inertial'});
test('free-flight Cartesian and orbital maneuvers round-trip',()=>{let s=mission();assert.equal(M.validate(JSON.parse(JSON.stringify(s))).nodes.length,1);s.nodes[0].mode='orbital';assert.equal(M.validate(s).nodes[0].bodyId,'s');});
test('generated maneuver IDs remain unique after loading',()=>{assert.equal(M.uniqueId('node',[{id:'node-1'},{id:'node-2'}]),'node-3');});
test('non-finite and out-of-range states are rejected',()=>{const s=mission();s.bodies[0].vx=Infinity;assert.throws(()=>M.validate(s),/Velocity X/);const q=mission();q.config.dt=0;assert.throws(()=>M.validate(q),/dt/);});
test('duplicate identifiers and missing primaries are rejected',()=>{const s=mission();s.bodies.push({...craft});assert.throws(()=>M.validate(s),/unique/);const q=mission();q.nodes[0].primaryId='missing';assert.throws(()=>M.validate(q),/primary/);});
test('unknown strings are sanitized and no source objects are mutated',()=>{const s=mission();s.bodies[0].name='x'.repeat(100);s.bodies[0].color='url(javascript:alert(1))';const r=M.validate(s);assert.equal(r.bodies[0].name.length,30);assert.equal(r.bodies[0].color,'#8fe8c2');assert.equal(s.bodies[0].name.length,100);});
}
console.log(`${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
