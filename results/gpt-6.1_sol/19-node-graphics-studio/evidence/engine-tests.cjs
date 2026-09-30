// Real engine tests extracted from the delivered inline source. No browser mocks.
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const html=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
const source=html.match(/\/\* ENGINE START \*\/([\s\S]*?)\/\* ENGINE END \*\//)?.[1]||'';
const c=vm.createContext({console});vm.runInContext(source,c);
const run=s=>vm.runInContext(s,c);
let failed=0,passed=0;
function test(name,fn){try{fn();console.log('PASS',name);passed++;}catch(e){console.log('FAIL',name,':',e.message);failed++;}}
test('engine is available',()=>assert.equal(run('typeof compileGraph'),'function'));
if(run('typeof compileGraph')==='function'){
 test('edges determine compiled output expression',()=>{const s=run(`compileGraph({nodes:[makeNode('Constant',1,0,0,{value:.25}),makeNode('Output',2,200,0)],edges:[{from:1,out:0,to:2,input:0}],frames:[]},2).source`);assert(s.includes('n1(p)'));assert(s.includes('n2(p)'));assert(!s.includes('undefined'));});
 test('color cannot connect to coordinates',()=>assert.equal(run(`canConnect({nodes:[makeNode('Color',1),makeNode('Noise',2)],edges:[]},1,0,2,0).ok`),false));
 test('scalar can broadcast into color',()=>assert.equal(run(`canConnect({nodes:[makeNode('Constant',1),makeNode('Output',2)],edges:[]},1,0,2,0).ok`),true));
 test('cycle is rejected before mutation',()=>assert.equal(run(`canConnect({nodes:[makeNode('Add',1),makeNode('Multiply',2)],edges:[{from:1,out:0,to:2,input:0}]},2,0,1,0).ok`),false));
 test('valid project survives round trip',()=>assert.equal(run(`validateProject(JSON.parse(JSON.stringify({version:1,name:'Round trip',graph:{nodes:[makeNode('Constant',1),makeNode('Output',2)],edges:[{from:1,out:0,to:2,input:0}],frames:[]},timeline:{duration:8,fps:30,time:0,loop:true},keys:[]}))).graph.nodes.length`),2));
 test('oversized graph rejected',()=>assert.throws(()=>run(`validateProject({version:1,graph:{nodes:Array.from({length:101},(_,i)=>makeNode('Constant',i+1)),edges:[]}})`),/100|limit/i));
 test('unknown node rejected',()=>assert.throws(()=>run(`validateProject({version:1,graph:{nodes:[{id:1,type:'Unsafe',x:0,y:0,params:{}}],edges:[]}})`),/unknown/i));
 test('cycles rejected on import',()=>assert.throws(()=>run(`validateProject({version:1,graph:{nodes:[makeNode('Add',1),makeNode('Multiply',2)],edges:[{from:1,out:0,to:2,input:0},{from:2,out:0,to:1,input:0}]}})`),/cycle/i));
 test('linear keyframes interpolate numeric value',()=>assert.equal(run(`sampleKeys([{time:0,value:0,interp:'linear'},{time:2,value:10,interp:'linear'}],1)`),5));
 test('hold keyframe preserves prior value',()=>assert.equal(run(`sampleKeys([{time:0,value:3,interp:'hold'},{time:2,value:10}],1)`),3));
 test('color keyframes interpolate channels',()=>assert.equal(run(`JSON.stringify(sampleKeys([{time:0,value:[0,0,0,1],interp:'linear'},{time:2,value:[1,1,1,1]}],1))`),'[0.5,0.5,0.5,1]'));
 test('hold changes at exact intermediate key timestamp',()=>assert.equal(run(`sampleKeys([{time:0,value:0,interp:'hold'},{time:1,value:10,interp:'hold'},{time:2,value:20,interp:'hold'}],1)`),10));
 test('valid paste remaps internal edges and keyed targets',()=>assert.equal(run(`(()=>{const p={version:1,graph:{nodes:[makeNode('Constant',1)],edges:[],frames:[]},timeline:{duration:8,fps:30,time:0,loop:true},keys:[]};const c={nodes:[makeNode('Constant',10),makeNode('Multiply',11)],edges:[{from:10,out:0,to:11,input:0}],keys:[{node:10,param:'value',time:1,value:.6,interp:'linear'}]};const r=preparePaste(p,c,2);return JSON.stringify([r.project.graph.nodes.map(n=>n.id),r.project.graph.edges[0],r.project.keys[0].node]);})()`),'[[1,2,3],{"from":2,"out":0,"to":3,"input":0},2]'));
 test('cross-project paste rejects out-of-duration keys unchanged',()=>assert.throws(()=>run(`preparePaste({version:1,graph:{nodes:[],edges:[],frames:[]},timeline:{duration:2,fps:30,time:0,loop:true},keys:[]},{nodes:[makeNode('Constant',1)],edges:[],keys:[{node:1,param:'value',time:6,value:.5,interp:'linear'}]},100)`),/keyframe/i));
 test('paste enforces 1000 keyframe safety limit',()=>assert.throws(()=>run(`(()=>{const keys=Array.from({length:600},(_,i)=>({node:1,param:'value',time:i/100,value:.5,interp:'linear'}));const p={version:1,graph:{nodes:[makeNode('Constant',1)],edges:[],frames:[]},timeline:{duration:8,fps:30,time:0,loop:true},keys};return preparePaste(p,{nodes:[makeNode('Constant',1)],edges:[],keys},2);})()`),/1,000|1000/i));
 test('paste enforces 250 edge safety limit',()=>assert.throws(()=>run(`(()=>{const nodes=Array.from({length:96},(_,i)=>makeNode('Mask',i+1));nodes.push(makeNode('Constant',97));const edges=Array.from({length:250},(_,i)=>({from:97,out:0,to:Math.floor(i/3)+1,input:i%3}));return preparePaste({version:1,graph:{nodes,edges,frames:[]},timeline:{duration:8,fps:30,time:0,loop:true},keys:[]},{nodes:[makeNode('Constant',97),makeNode('Mask',1)],edges:[{from:97,out:0,to:1,input:0}],keys:[]},98);})()`),/250|limit/i));
 test('unsafe frame identifiers rejected before DOM selectors',()=>assert.throws(()=>run(`validateProject({version:1,graph:{nodes:[],edges:[],frames:[{id:'bad"id',x:0,y:0,w:100,h:100,nodes:[]}]}})`),/frame.*id/i));
 test('duplicate frame identifiers rejected',()=>assert.throws(()=>run(`validateProject({version:1,graph:{nodes:[],edges:[],frames:[{id:'same',x:0,y:0,w:100,h:100,nodes:[]},{id:'same',x:0,y:0,w:100,h:100,nodes:[]}]}})`),/frame.*id/i));
 test('frame safety limit rejects rather than truncates user data',()=>assert.throws(()=>run(`validateProject({version:1,graph:{nodes:[],edges:[],frames:Array.from({length:41},(_,i)=>({id:'f'+i,x:0,y:0,w:100,h:100,nodes:[]}))}})`),/40|limit/i));
}
console.log(`${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
