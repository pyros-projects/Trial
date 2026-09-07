'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const line=prefix=>{const text=html.split('\n').find(l=>l.startsWith(prefix));assert.ok(text,`Missing source ${prefix}`);return text};
function context(extra={}){const c={...extra};vm.createContext(c);vm.runInContext(html.match(/<script id="physics-engine">([\s\S]*?)<\/script>/)[1],c);c.O=c.Orbital;c.alive=b=>b.alive!==false;c.fmt=(v,n=2)=>Number.isFinite(v)?v.toFixed(n):'—';return c}
const run=(c,s)=>vm.runInContext(s,c);
function validPayload(c){const s=c.O.scenario('hohmann');return {version:1,state:s.state,initial:c.O.clone(s.state),cfg:s.cfg,frameMode:'body',camera:{x:0,y:0,scale:2},baseline:c.O.invariants(s.state,s.cfg)}}
function dom(){const nodes={};return id=>nodes[id]??=( {textContent:'',onclick:null,options:[{},{},{},{}]} )}

test('valid exported events pass; malformed events are rejected before restoring state',()=>{
 const c=context();c.p=validPayload(c);c.p.state.time=10;c.p.state.nodes[0].executed=true;c.p.state.events=[{type:'burn',time:8,nodeId:'transfer-1',craftId:'odyssey',dvx:.1,dvy:0,dv:.1}];run(c,line('function validatePayload('));assert.equal(run(c,'validatePayload(p)===p'),true);
 run(c,line('function restorePayload('));c.state={sentinel:true};const old=c.state;
 for(const event of [null,{type:'collision',time:1,ids:null,behavior:'merge'},{type:'burn',time:1,nodeId:'a',craftId:'odyssey',dvx:0,dvy:0,dv:-1},{type:'note',time:11,message:'future'}]){c.p.state.events=[event];assert.throws(()=>run(c,'restorePayload(p)'),/invalid .*event/);assert.equal(c.state,old)}
});

test('normal numeric physics settings align with actual HTML minima and steps',()=>{
 for(const [id,values]of [['cfgG',[1,2,.01]],['cfgDt',[.001,.02,.04]],['cfgSoftening',[.001,.02,.03]]]){const tag=html.match(new RegExp(`<input id="${id}"[^>]+>`))[0],min=Number(tag.match(/min="([^"]+)/)[1]),step=Number(tag.match(/step="([^"]+)/)[1]);for(const value of values){const q=(value-min)/step;assert.ok(Math.abs(q-Math.round(q))<1e-8,`${id} rejects ${value}`)}}
});

test('paused body selection updates derived encounter and final orbit for selected craft',()=>{
 const c=context({$:dom(),selectedId:'odyssey',primaryId:'terra',activeNodeId:null,drawEncounterChart(){},updateFrameOptions(){},focusSelected(){},rebuildBodies(){},refreshNodes(){},updateUI(){},updateHint(){},dirty(){}});const s=c.O.scenario('circular');c.state=s.state;c.cfg={...s.cfg,horizon:10,resolution:50};const second=c.O.clone(c.state.bodies[3]);second.id='second';second.x+=10;c.state.bodies.push(second);c.forecast=c.O.predict(c.state,c.cfg);
 for(const f of ['selected','selectBody','updateEncounter','updatePredictionTelemetry'])run(c,line(`function ${f}(`));run(c,"selectBody('second')");assert.equal(c.encounter.craftId,'second');const secondText=c.$('projectedEcc').textContent;run(c,"selectBody('odyssey')");assert.equal(c.encounter.craftId,'odyssey');assert.notEqual(c.$('projectedEcc').textContent,secondText);
});

test('primary merger reconciles surviving selection with engine primary',()=>{
 const c=context({selectedId:'odyssey',primaryId:'terra',lastTrail:0,history:[],trailLength:600,energyHistory:[],lastEventCount:0,toast(){},updateFrameOptions(){},rebuildBodies(){},refreshNodes(){},schedulePrediction(){},setPause(){}});const s=c.O.scenario('circular');c.state=s.state;c.cfg=s.cfg;c.state.bodies[1].x=0;c.state.bodies[1].y=0;c.O.step(c.state,.001,c.cfg);run(c,line('function selected('));run(c,line('function afterAdvance('));run(c,'afterAdvance()');assert.equal(c.selectedId,'odyssey');assert.equal(c.primaryId,'helios');assert.equal(c.primaryId,c.state.bodies[3].primary);
});

test('handled Space and focused buttons do not trigger global transport',()=>{
 let handler,clicks=0;const c=context({document:{addEventListener(name,fn){handler=fn},querySelector(){return null}},$:()=>({click(){clicks++}})});run(c,line("document.addEventListener('keydown'"));const e={key:' ',defaultPrevented:true,target:{matches(){return false},closest(){return null}},preventDefault(){}};handler(e);assert.equal(clicks,0);e.defaultPrevented=false;e.target.closest=()=>({});handler(e);assert.equal(clicks,0);e.target.closest=()=>null;handler(e);assert.equal(clicks,1);
});

test('checkpoint restores physics settings with matching conservation baseline',()=>{
 const c=context({$:dom(),restart(){},dirty(){},toast(){},syncSettings(){},setPause(){},rebuildBodies(){},refreshNodes(){},schedulePrediction(){},updateUI(){}});const s=c.O.scenario('circular');c.state=s.state;c.cfg=s.cfg;c.baseline=c.O.invariants(c.state,c.cfg);run(c,line("$('restartButton').onclick="));c.$('checkpointButton').onclick();c.cfg.G=2;c.baseline=c.O.invariants(c.state,c.cfg);c.$('restoreCheckpointButton').onclick();assert.equal(c.cfg.G,1);assert.equal(c.O.invariants(c.state,c.cfg).energy,c.baseline.energy);
});

test('prediction is pending throughout debounce, worker launch and forced replacement',()=>{
 const queued=new Map();let timer=0;class Worker{terminate(){this.terminated=true}postMessage(m){this.message=m}}
 const c=context({$:dom(),worker:null,workerURL:null,predictionRequest:0,predictionBusy:false,predictionQueued:false,predictionTimer:null,predictionError:null,errors:[],performance:{now:()=>0},URL:{createObjectURL:()=> 'blob:fake'},Blob:class{},Worker,setTimeout(fn){queued.set(++timer,fn);return timer},clearTimeout(id){queued.delete(id)},toast(){},updateEncounter(){},updatePredictionTelemetry(){},updateUI(){}});const s=c.O.scenario('circular');c.state=s.state;c.cfg=s.cfg;run(c,line('function createWorker('));run(c,line('function schedulePrediction('));run(c,'schedulePrediction(true)');assert.equal(c.predictionQueued,true);assert.equal(c.predictionBusy,false);queued.get(c.predictionTimer)();assert.equal(c.predictionQueued,false);assert.equal(c.predictionBusy,true);const old=c.worker,oldId=old.message.id;run(c,'schedulePrediction(true)');assert.equal(old.terminated,true);assert.equal(c.predictionQueued,true);old.onmessage({data:{id:oldId,forecast:{stale:true}}});assert.equal(c.forecast,undefined);queued.get(c.predictionTimer)();c.worker.onmessage({data:{id:c.worker.message.id,forecast:{fresh:true},coast:null}});assert.equal(c.predictionQueued,false);assert.equal(c.predictionBusy,false);assert.equal(c.forecast.fresh,true);
});

test('checkpoint restoration reconciles a surviving spacecraft primary and frame label',()=>{
 const nodes={};const $=id=>nodes[id]??=(()=>{const options=[{textContent:''},{},{},{}];return {textContent:'',options,selectedOptions:[options[0]],style:{setProperty(){}},setAttribute(){}}})();
 const c=context({$,restart(){},dirty(){},toast(){},syncSettings(){},setPause(){},rebuildBodies(){},refreshNodes(){},schedulePrediction(){},drawTimeline(){},relevantNodes:()=>[],document:{activeElement:{matches:()=>true}},selectedId:'odyssey',primaryId:'terra',frameMode:'body',paused:true,fps:60,stepsLast:0,errorMessage:null,encounter:null,predictionBusy:false,predictionQueued:false,predictionError:null,targetWarp:4,achievedWarp:4,activeNodeId:null});
 const s=c.O.scenario('circular');c.state=s.state;c.cfg=s.cfg;c.baseline=c.O.invariants(c.state,c.cfg);c.conservation=()=>({energy:0,momentum:0});for(const f of ['selected','primary','getFrame','updateFrameOptions','updateUI'])run(c,line(`function ${f}(`));run(c,line("$('restartButton').onclick="));c.$('checkpointButton').onclick();c.state.bodies[1].x=0;c.state.bodies[1].y=0;c.O.step(c.state,.001,c.cfg);c.primaryId='helios';assert.equal(c.state.bodies[3].primary,'helios');c.$('restoreCheckpointButton').onclick();assert.equal(c.state.bodies[3].primary,'terra');assert.equal(c.primaryId,'terra');assert.equal(c.$('frameSelect').options[0].textContent,'Terra-centered');
});

test('missing checkpoint physics settings rejects import before mutating live mission',()=>{
 const c=context();c.p=validPayload(c);c.p.checkpoint={state:c.O.clone(c.p.state),baseline:c.O.clone(c.p.baseline)};c.state={sentinel:true};const original=c.state;for(const f of ['validatePayload','restorePayload'])run(c,line(`function ${f}(`));assert.throws(()=>run(c,'restorePayload(p)'),/Checkpoint physics settings are missing/);assert.equal(c.state,original);c.p.checkpoint.cfg=c.O.clone(c.p.cfg);assert.equal(run(c,'validatePayload(p)===p'),true);
});

test('planned mixed-component delta-v uses exact predicted impulse and equals executed burn',()=>{
 const c=context();const s=c.O.scenario('elliptical');c.state=s.state;c.cfg={...s.cfg,horizon:10,resolution:50};c.node={id:'mixed',craftId:'odyssey',primaryId:'terra',time:.2,mode:'orbital',prograde:.8,radial:.7,dx:0,dy:0,executed:false};c.state.nodes=[c.node];c.forecast=c.O.predict(c.state,c.cfg);for(const f of ['findSample','nodeDelta'])run(c,line(`function ${f}(`));const event=c.forecast.events.find(e=>e.nodeId==='mixed');assert.ok(event);assert.equal(run(c,'nodeDelta(node)'),event.dv);const live=c.O.clone(c.state);c.O.advance(live,.2,c.cfg);assert.ok(Math.abs(live.events[0].dv-event.dv)<1e-12);c.state=live;c.node=live.nodes[0];assert.equal(run(c,'nodeDelta(node)'),live.events[0].dv);
 // A changed node must not reuse the earlier forecast's cached impulse.
 c.node=c.O.clone(s.state.nodes[0]);c.node.executed=false;c.node.mode='cartesian';c.node.dx=3;c.node.dy=4;assert.equal(run(c,'nodeDelta(node)'),5);
});

test('non-spacecraft encounter finds closest celestial sample and excludes spacecraft',()=>{
 const c=context({selectedId:'terra',drawEncounterChart(){}});const make=(id,type,x)=>({id,type,x,y:0,alive:true});c.state={bodies:[make('terra','planet',0)]};c.forecast={samples:[{time:0,bodies:[make('terra','planet',0),make('moon','moon',10),make('star','star',1000),make('craft','craft',.1)]},{time:5,bodies:[make('terra','planet',0),make('moon','moon',3),make('star','star',1000),make('craft','craft',.01)]}]};for(const f of ['selected','updateEncounter'])run(c,line(`function ${f}(`));run(c,'updateEncounter()');assert.equal(c.encounter.craftId,'terra');assert.equal(c.encounter.bodyId,'moon');assert.equal(c.encounter.distance,3);assert.equal(c.encounter.time,5);
});

test('maneuvers for spacecraft without an orbital primary preserve null through import',()=>{
 const c=context({$:id=>({style:{}}),selectedId:'odyssey',primaryId:'odyssey',setPause(){},updateHint(){},refreshNodes(){},schedulePrediction(){},setMobilePanel(){},toast(){},dirty(){},innerWidth:1280});const s=c.O.scenario('circular');c.state=s.state;c.cfg=s.cfg;c.state.bodies[3].primary=null;for(const f of ['selected','addNode','validatePayload'])run(c,line(`function ${f}(`));run(c,'addNode(.08)');assert.equal(c.state.nodes[0].primaryId,null);c.p={version:1,state:c.state,initial:c.O.clone(c.state),cfg:c.cfg,frameMode:'inertial',camera:{x:0,y:0,scale:2},baseline:c.O.invariants(c.state,c.cfg)};assert.equal(run(c,'validatePayload(p)===p'),true);const predicted=c.O.predict(c.state,{...c.cfg,horizon:10,resolution:50});assert.ok(predicted.events.some(e=>e.type==='burn'&&e.dv>0));c.p.state.nodes[0].primaryId='missing';assert.throws(()=>run(c,'validatePayload(p)'),/invalid maneuver/);
});
