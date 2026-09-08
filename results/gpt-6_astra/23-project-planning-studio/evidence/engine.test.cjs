const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
const script=html.match(/<script id="planner-model">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'A real scheduling engine must be delivered in index.html');
const context={};vm.createContext(context);vm.runInContext(script+';globalThis.engine=Engine;',context);
const E=context.engine,copy=x=>JSON.parse(JSON.stringify(x));
const seed=()=>copy(E.seed());
const intervals=r=>Object.fromEntries(Object.entries(r.schedule).map(([id,t])=>[id,[t.start,t.finish]]));
const verify=(name,fn)=>{fn();console.log('PASS',name)};
verify('seed capacity, exclusive finish, CPM and blocking explanation',()=>{
 const r=E.build(seed());assert.deepEqual(intervals(r),{T1:[0,2],T2:[2,5],T3:[5,7],T4:[7,8],T5:[8,8]});
 assert.equal(r.completion,8);assert.equal(r.dates[8],'2026-09-17');assert.equal(r.dates[4],'2026-09-11');assert.equal(r.dates[5],'2026-09-14');
 assert.equal(r.cpmCompletion,6);assert.equal(r.cpm.T3.float,1);for(const id of ['T1','T2','T4','T5'])assert.equal(r.cpm[id].float,0);
 assert.ok(r.schedule.T3.blockers.some(x=>x.ids.includes('T2')));
});
verify('capacity 2 and gap filling use general scheduling rules',()=>{
 let m=seed();m.resources[0].capacity=2;assert.deepEqual(intervals(E.build(m)),{T1:[0,2],T2:[2,5],T3:[2,4],T4:[5,6],T5:[6,6]});
 m=seed();m.tasks[1].notBefore='2026-09-14';const r=E.build(m);assert.deepEqual(intervals(r),{T1:[0,2],T2:[5,8],T3:[2,4],T4:[8,9],T5:[9,9]});assert.equal(r.cpmCompletion,6);
});
verify('propagation and independent additional duration prediction',()=>{
 let m=seed();m.tasks[0].duration=3;let r=E.build(m);assert.deepEqual(intervals(r),{T1:[0,3],T2:[3,6],T3:[6,8],T4:[8,9],T5:[9,9]});assert.equal(r.cpmCompletion,7);
 m=seed();m.tasks[2].duration=4;r=E.build(m);assert.deepEqual(intervals(r),{T1:[0,2],T2:[2,5],T3:[5,9],T4:[9,10],T5:[10,10]});assert.equal(r.cpmCompletion,7);assert.equal(r.cpm.T2.float,1);
});
verify('code-point tie breaks and row-order independence',()=>{let m=seed();m.tasks[2].priority=2;m.tasks.reverse();assert.deepEqual(intervals(E.build(m)),{T1:[0,2],T2:[2,5],T3:[5,7],T4:[7,8],T5:[8,8]});});
verify('weekend normalization, impossible dates, lower bound and calendar limits',()=>{
 let m=seed();m.tasks[1].notBefore='2026-09-12';let r=E.build(m);assert.equal(r.model.tasks[1].notBefore,'2026-09-14');assert.ok(r.notices.length);assert.equal(r.schedule.T2.start,5);
 m=seed();m.tasks[0].notBefore='2000-01-01';assert.equal(E.build(m).schedule.T1.start,0);
 for(const date of ['2026-02-30','2025-02-29','1999-12-31','2100-01-01']){m=seed();m.project.startDate=date;assert.throws(()=>E.build(m));}
 m=seed();m.project.startDate='2099-12-31';assert.throws(()=>E.build(m),/2099|range/i);
});
verify('whole model rejects invalid graph, numbers, resource and horizon',()=>{
 const cases=[m=>m.tasks[0].predecessors=['T5'],m=>m.tasks[0].predecessors=['missing'],m=>m.tasks.push(copy(m.tasks[0])),m=>m.resources[0].capacity=0,m=>m.tasks[0].duration=1000000000,m=>m.tasks[0].priority=10000,m=>m.tasks[0].priority=NaN,m=>m.tasks[0].resourceId='missing',m=>m.tasks[4].resourceId='R1',m=>m.tasks[0].notBefore='2040-01-02'];
 for(const mutate of cases){const m=seed();mutate(m);const before=copy(m);assert.throws(()=>E.build(m));assert.deepEqual(copy(m),before);}
});
verify('unassigned and milestone roots, empty plan',()=>{let m=seed();m.tasks.push({id:'U',name:'Unassigned',duration:1,priority:0,resourceId:null,predecessors:[],notBefore:null},{id:'M',name:'Milestone',duration:0,priority:0,resourceId:null,predecessors:['U'],notBefore:null});let r=E.build(m);assert.equal(r.schedule.U.start,0);assert.equal(r.schedule.M.start,1);assert.equal(r.completion,8);m.tasks=[];r=E.build(m);assert.equal(r.completion,0);assert.equal(r.cpmCompletion,0);});
verify('50 tasks, eight resources, valid horizon endpoint and reject overflow',()=>{
 let m=seed();m.resources=Array.from({length:8},(_,i)=>({id:'R'+i,name:'Resource '+i,capacity:1}));m.tasks=Array.from({length:50},(_,i)=>({id:'job_'+i,name:'Job '+i,duration:2,priority:i,resourceId:'R'+i%8,predecessors:[],notBefore:null}));let r=E.build(m);assert.equal(r.completion,14);
 m.tasks=Array.from({length:10},(_,i)=>({id:'J'+i,name:'Horizon '+i,duration:260,priority:i,resourceId:null,predecessors:i?['J'+(i-1)]:[],notBefore:null}));assert.equal(E.build(m).completion,2600);m.tasks.push({id:'overflow',name:'Overflow',duration:1,priority:10,resourceId:null,predecessors:['J9'],notBefore:null});assert.throws(()=>E.build(m),/2600|horizon/i);
});
