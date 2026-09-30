const fs=require('fs'),vm=require('vm'),assert=require('assert');const file=fs.readFileSync('index.html','utf8');const core=file.match(/<script id="simulation-core">([\s\S]*?)<\/script>/)[1];const start=file.indexOf('function validateApplication'),end=file.indexOf("$('stateFile').onchange=",start);const fieldStart=file.indexOf('function fieldValue'),fieldEnd=file.indexOf('function colorMap',fieldStart);const c={console};vm.createContext(c);vm.runInContext(core+file.slice(start,end)+file.slice(fieldStart,fieldEnd)+';globalThis.Simulation=Simulation;',c);
const checks=[];function check(name,fn){try{fn();console.log('PASS: '+name);}catch(e){checks.push(name);console.error('FAIL: '+name+' — '+e.message);}}
check('hot cloud brush remains save/load compatible',()=>{const s=new c.Simulation(24,8,731,'mountain');for(let i=0;i<600;i++)s.brush('heat',.5,.5,.2,1,.04);s.brush('cloud',.5,.5,.2,1,.1);assert(s.f.t.every(v=>v<=60));new c.Simulation().load(s.serialize());});
check('inherited preset names rejected',()=>{const s=new c.Simulation(24,8,731,'fair'),o=s.serialize();o.preset='__proto__';assert.throws(()=>s.load(o));});
const saved=JSON.parse(fs.readFileSync('evidence/saved-state.json'));
check('fractional visualization rejected before commit',()=>{const a=JSON.parse(JSON.stringify(saved.application));a.render.viz=1.5;assert.throws(()=>c.validateApplication(a,saved.n,saved.l));});
check('fractional map layer rejected',()=>{const a=JSON.parse(JSON.stringify(saved.application));a.render.mapLayer=2.5;assert.throws(()=>c.validateApplication(a,saved.n,saved.l));});
check('unrecognized camera members rejected',()=>{const a=JSON.parse(JSON.stringify(saved.application));a.camera.basis='broken';assert.throws(()=>c.validateApplication(a,saved.n,saved.l));});
check('cloud diagnostic matches 12 g/kg legend',()=>{const s=new c.Simulation(24,8,731,'fair');s.f.c[0]=1; c.sim=s;assert(Math.abs(c.fieldValue(3,0,0,0)-1/3)<1e-7);});
if(checks.length)process.exit(1);
