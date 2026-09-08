const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const file='index.html';
assert.ok(fs.existsSync(file),'Delivered application must exist');
const html=fs.readFileSync(file,'utf8'),code=html.match(/<script id="core">([\s\S]*?)<\/script>/)?.[1];
assert.ok(code,'Application exposes its real graph core');
const box={};vm.createContext(box);vm.runInContext(code,box);const C=box.GraphCore;
const defs={constant:{out:'scalar',inputs:[],params:{value:{min:-10,max:10,value:1}}},color:{out:'color',inputs:[],params:{}},uv:{out:'vector',inputs:[],params:{}},add:{out:'scalar',inputs:[['a','scalar'],['b','scalar']],params:{}},clock:{out:'exec',inputs:[],params:{}},output:{out:'image',inputs:[['surface','field']],params:{}}};
const node=(id,type)=>({id,type,x:0,y:0,p:type==='constant'?{value:1}:{},keys:{}});
const base={version:1,name:'Test',nodes:[node(1,'constant'),node(2,'add'),node(3,'output')],edges:[{from:1,to:2,port:0},{from:2,to:3,port:0}],timeline:{duration:6,fps:30}};
assert.equal(C.validate(base,defs).ok,true,'Valid scalar field graph should load');
assert.equal(C.compatible('scalar','color'),true);
assert.equal(C.compatible('color','vector'),false);
assert.equal(C.compatible('exec','field'),false);
assert.equal(C.validate({...base,edges:[...base.edges,{from:2,to:2,port:1}]},defs).ok,false,'Self cycles rejected');
assert.equal(C.validate({...base,nodes:[...base.nodes,node(4,'add')],edges:[{from:2,to:4,port:0},{from:4,to:2,port:0}]},defs).ok,false,'Indirect cycles rejected');
assert.equal(C.validate({...base,nodes:[...base.nodes,node(1,'constant')]},defs).ok,false,'Duplicate IDs rejected');
assert.equal(C.validate({...base,nodes:[node(1,'clock'),node(2,'output')],edges:[{from:1,to:2,port:0}]},defs).ok,false,'Execution-to-image rejected');
assert.equal(C.validate({...base,nodes:[{...node(1,'constant'),p:{value:Infinity}}]},defs).ok,false,'Nonfinite values rejected');
assert.equal(C.validate({...base,nodes:[{...node(1,'constant'),p:{value:100000}}]},defs).ok,false,'Unsafe parameter values rejected');
assert.equal(C.sampleKeys([{t:0,v:2},{t:2,v:6}],1,'linear'),4);
assert.equal(C.sampleKeys([{t:0,v:2},{t:2,v:6}],1,'hold'),2);
assert.equal(C.sampleKeys([{t:0,v:'#000000'},{t:2,v:'#ffffff'}],1,'linear'),'#808080');
assert.equal(C.sampleKeys([{t:0,v:2},{t:2,v:6}],-1,'linear'),2);
assert.equal(C.sampleKeys([{t:0,v:2},{t:2,v:6}],3,'linear'),6);
// A cached DFS visit must not hide the real longest path.
const deep={version:1,name:'Too deep',nodes:Array.from({length:26},(_,i)=>node(i+1,'add')),edges:Array.from({length:25},(_,i)=>({from:i+1,to:i+2,port:0})),timeline:{duration:6,fps:30}};
assert.equal(C.validate(deep,defs).ok,false,'Depth limit must reject a 26-node chain in upstream order');
assert.equal(C.validate({...deep,nodes:[...deep.nodes].reverse()},defs).ok,false,'Depth limit must be independent of storage order');
for (const type of ['constructor','__proto__','toString']) {
  assert.equal(C.validate({...base,nodes:[node(1,type)],edges:[]},defs).ok,false,'Inherited object properties are not node types');
}
assert.equal(C.validate({...base,nodes:[{...node(1,'constant'),p:{value:1,toString:2}}],edges:[]},defs).ok,false,'Inherited properties are not parameters');


assert.equal(C.sampleKeys([{t:0,v:2},{t:1,v:5},{t:2,v:6}],1,'hold'),5,'Hold interpolation must switch at the exact interior keyframe');

console.log('PASS: graph validation, type conversions, cycles, depth, bounds, inherited properties, numeric/color keyframes');
