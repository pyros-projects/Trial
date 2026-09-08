const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const file=path.resolve(__dirname,'../../index.html');
assert.ok(fs.existsSync(file),'The deliverable and simulation engine must exist');
const html=fs.readFileSync(file,'utf8');
const match=html.match(/<script id="logic-engine">([\s\S]*?)<\/script>/);
assert.ok(match,'Simulation engine is available independently of DOM');
const context={};vm.createContext(context);vm.runInContext(match[1],context);
const {Engine,makeNode,preset,validateCircuit,portDefs}=context.Logic;
function engine(name){return new Engine(preset(name));}
function node(e,label){return e.circuit.nodes.find(n=>n.label===label);}
function val(e,label,p='Q'){return e.output(node(e,label).id,p);}
function input(e,label,value){e.setSource(node(e,label).id,value);e.settle();}
let e=engine('half');
for(const [a,b,s,c] of [[0,0,0,0],[0,1,1,0],[1,0,1,0],[1,1,0,1]]){input(e,'A',a);input(e,'B',b);assert.equal(e.input(node(e,'Sum').id,'A'),s);assert.equal(e.input(node(e,'Carry').id,'A'),c);}
console.log('PASS connected half-adder truth table');
e=engine('counter');for(let i=1;i<=18;i++){e.tick();assert.equal(val(e,'Counter'),i%16);}e.reset();assert.equal(val(e,'Counter'),0);console.log('PASS counter edges and reset');
e=engine('register');input(e,'Data',9);assert.equal(val(e,'Register'),0);e.tick();assert.equal(val(e,'Register'),9);input(e,'Data',3);assert.equal(val(e,'Register'),9);e.tick();assert.equal(val(e,'Register'),3);console.log('PASS edge-triggered register');
e=engine('cpu');const outputs=[];for(let i=0;i<16;i++){e.tick();outputs.push(val(e,'Output'));}assert.deepEqual(outputs,[0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,5]);assert.equal(val(e,'Accumulator'),5);console.log('PASS connected CPU instruction execution');
let invalid=preset('half');invalid.wires.push({id:'bad',from:{node:invalid.nodes[0].id,port:'Q'},to:{node:invalid.nodes[1].id,port:'Q'}});assert.throws(()=>validateCircuit(invalid),/input|port|direction/i);console.log('PASS invalid direction rejected');
invalid=preset('half');invalid.nodes[0].bits=4;assert.throws(()=>validateCircuit(invalid),/width/i);console.log('PASS bus width mismatch rejected');
assert.throws(()=>validateCircuit({nodes:[{id:'x',type:'EVAL',x:0,y:0,bits:1}],wires:[]}),/type/i);console.log('PASS unknown imported type rejected');
const inv=makeNode('NOT',0,0,1,'Inverter');e=new Engine({name:'loop',nodes:[inv],wires:[{id:'loop',from:{node:inv.id,port:'Q'},to:{node:inv.id,port:'A'}}]});assert.ok(e.loops.length);assert.equal(e.output(inv.id,'Q'),'X');assert.ok(e.queue.length===0);console.log('PASS unresolved combinational loop contained');
for(const key of ['half','full','mux','sr','register','counter','alu','memory','cpu']){const c=preset(key);validateCircuit(c);new Engine(c);}console.log('PASS all curated presets compile');
