const fs=require('fs'),vm=require('vm'),assert=require('assert');
let source=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.slice(0,source.lastIndexOf('wire();resizeCanvas();'));
const elements=new Map;
const element=selector=>{if(!elements.has(selector))elements.set(selector,{getContext:()=>({}),style:{},classList:{contains:()=>false,add(){},remove(){},toggle(){}},addEventListener(){}});return elements.get(selector);};
const box={document:{querySelector:element,querySelectorAll:()=>[]},window:{},performance:{now:()=>0},setTimeout,clearTimeout,setInterval,console};
vm.createContext(box);vm.runInContext(source,box);
// Stub browser rendering/storage boundaries only; execute the product's real edits and cleanup.
vm.runInContext('refreshUI=()=>{};renderInspector=()=>{};updateHistory=()=>{};autosave=()=>{};toast=()=>{};',box);
const run=code=>vm.runInContext(code,box);
const reset=()=>run("city=makeScenario('downtown');sim=newSim();history=[];rebuild();for(let i=0;i<1800;i++)tick();measure();");
const outcomes=[];
function check(name,fn){try{fn();outcomes.push({name,pass:true});}catch(e){outcomes.push({name,pass:false,error:e.message});}}
check('Deleting a passenger endpoint preserves loadable state and manifests',()=>{
  reset();const count=run('sim.passengers.filter(p=>p.origin===12||p.destination===12).length');assert.ok(count>0,'fixture must exercise live affected passengers');
  run("removeObject({type:'node',id:12});validateSnapshot(snapshot());");
  assert.equal(run('sim.passengers.some(p=>p.origin===12||p.destination===12)'),false);
  assert.equal(run("sim.vehicles.some(v=>v.type==='bus'&&v.onboard.some(id=>!sim.passengers.some(p=>p.id===id)))"),false);
  run('pushHistory();validateSnapshot(history[history.length-1]);');
});
check('Shrinking a populated map preserves physical gaps and a loadable snapshot',()=>{
  reset();run("renderSettings();document.querySelector('#setting-mapSize').onchange({target:{value:'600'}});");
  assert.equal(run('window.Flowstate.diagnostics.overlaps'),0);
  run('validateSnapshot(snapshot());for(let i=0;i<100;i++)tick();validateSnapshot(snapshot());');
  assert.equal(run('window.Flowstate.diagnostics.overlaps'),0);
});
check('Map resizing at minimum zoom remains reloadable',()=>{
  reset();run("city.size=600;cam.zoom=.12;renderSettings();document.querySelector('#setting-mapSize').onchange({target:{value:'3000'}});validateSnapshot(snapshot());");
  assert.ok(run('cam.zoom>=.12&&cam.zoom<=3'));
});
console.log(JSON.stringify(outcomes,null,2));if(outcomes.some(o=>!o.pass))process.exitCode=1;
