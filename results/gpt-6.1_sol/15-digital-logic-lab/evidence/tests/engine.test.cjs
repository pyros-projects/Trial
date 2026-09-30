// Behavioral tests run the production engine extracted from the delivered HTML.
// Breaks caught: wrong gate truth rows, width bypass, arbitrary conflict values,
// feedback freezes, missed clock edges, sequential races, decorative CPU state,
// mutation of live state by truth tables, and unvalidated imports.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let failures=0,tests=0;
const html=fs.existsSync('index.html')?fs.readFileSync('index.html','utf8'):'';
const script=html.match(/<script id="logic-engine">([\s\S]*?)<\/script>/);
function test(name,fn){tests++;try{fn();console.log('PASS',name)}catch(e){failures++;console.log('FAIL',name,':',e.message)}}
let L;
test('production engine is delivered',()=>{assert.ok(script,'No delivered production engine');const ctx={console};ctx.globalThis=ctx;vm.runInNewContext(script[1],ctx);L=ctx.LogicLab;assert.equal(typeof L.Engine,'function')});
if(L){
const C=(components,wires=[])=>({version:1,name:'Test',components,wires,probes:[]});
const n=(id,type,bits=1,extra={})=>({id,type,bits,x:0,y:0,label:id,...extra});
const w=(from,fp,to,tp)=>({id:`${from}${fp}${to}${tp}`,from:{id:from,port:fp},to:{id:to,port:tp}});
test('half adder propagates all four independent rows',()=>{const c=L.examples.half();const e=new L.Engine(c);e.reset();for(const [a,b,sum,carry]of [[0,0,0,0],[0,1,1,0],[1,0,1,0],[1,1,0,1]]){e.setSource('a',a);e.setSource('b',b);e.settle();assert.equal(e.output('sum','Q'),sum);assert.equal(e.output('carry','Q'),carry)}});
test('unwired inverter resolves unknown',()=>{const e=new L.Engine(C([n('n','NOT')])) ;e.reset();assert.equal(e.output('n','Q'),'X')});
test('controlling low input masks unknown AND input',()=>{const e=new L.Engine(C([n('z','CONST',1,{value:0}),n('g','AND')],[w('z','Q','g','A')]));e.reset();assert.equal(e.output('g','Q'),0)});
test('width mismatch is rejected',()=>{const c=C([n('a','SWITCH',4),n('g','NOT',1)],[w('a','Q','g','A')]);assert.throws(()=>L.validateCircuit(c),/width/i)});
test('conflicting active drivers resolve X and warn',()=>{const e=new L.Engine(C([n('a','CONST',1,{value:0}),n('b','CONST',1,{value:1}),n('o','LED')],[w('a','Q','o','A'),w('b','Q','o','A')]));e.reset();assert.equal(e.output('o','Q'),'X');assert.ok(e.warnings.some(x=>/contention/i.test(x)))});
test('disabled tristate releases shared net',()=>{const e=new L.Engine(C([n('a','CONST',1,{value:1}),n('en','CONST',1,{value:0}),n('t','TRI'),n('o','LED')],[w('a','Q','t','A'),w('en','Q','t','EN'),w('t','Q','o','A')]));e.reset();assert.equal(e.output('t','Q'),'Z');assert.equal(e.input('o','A'),'Z')});
test('inverting feedback terminates and remains unresolved',()=>{const e=new L.Engine(C([n('n','NOT')],[w('n','Q','n','A')]),{limit:64});e.reset();assert.equal(e.output('n','Q'),'X');assert.ok(e.warnings.some(x=>/loop|feedback/i.test(x)));assert.ok(e.pendingCount<65)});
test('counter counts once per rising edge and resets',()=>{const e=new L.Engine(L.examples.counter());e.reset();assert.equal(e.output('count','Q'),0);e.clockTick();assert.equal(e.output('count','Q'),1);e.settle();assert.equal(e.output('count','Q'),1);e.clockTick();assert.equal(e.output('count','Q'),2);e.reset();assert.equal(e.output('count','Q'),0);assert.equal(e.ticks,0)});
test('register samples D on edge and holds between edges',()=>{const e=new L.Engine(L.examples.register());e.reset();e.setSource('data',9);e.settle();assert.equal(e.output('reg','Q'),0);e.clockTick();assert.equal(e.output('reg','Q'),9);e.setSource('data',3);e.settle();assert.equal(e.output('reg','Q'),9)});
test('same-clock registers sample prior settled values simultaneously',()=>{const c=C([n('clk','CLOCK'),n('d','CONST',4,{value:7}),n('r1','REGISTER',4),n('r2','REGISTER',4)],[w('clk','Q','r1','CLK'),w('clk','Q','r2','CLK'),w('d','Q','r1','D'),w('r1','Q','r2','D')]);const e=new L.Engine(c);e.reset();e.clockTick();assert.equal(e.output('r1','Q'),7);assert.equal(e.output('r2','Q'),0);e.clockTick();assert.equal(e.output('r2','Q'),7)});
test('tiny CPU executes LDI, OUT, ADD, OUT through connected blocks',()=>{const e=new L.Engine(L.examples.cpu());e.reset();e.clockTick();assert.equal(e.output('acc','Q'),1);assert.equal(e.output('pc','Q'),1);e.clockTick();assert.equal(e.output('outreg','Q'),1);e.clockTick();assert.equal(e.output('acc','Q'),2);e.clockTick();assert.equal(e.output('outreg','Q'),2);for(let i=0;i<4;i++)e.clockTick();assert.equal(e.output('outreg','Q'),3);assert.ok(e.samples.length>8);assert.ok(e.circuit.wires.length>=14)});
test('truth table produces literal XOR and AND rows without altering circuit',()=>{const c=L.examples.half();const e=new L.Engine(c);e.reset();const before=JSON.stringify(c);const table=L.truthTable(c,['a','b'],[{id:'sum',port:'Q'},{id:'carry',port:'Q'}]);assert.equal(table.rows.length,4);assert.deepEqual(Array.from(table.rows,r=>Array.from(r.outputs)),[[0,0],[1,0],[1,0],[0,1]]);assert.equal(JSON.stringify(c),before)});
test('sequential output cannot masquerade as combinational truth table',()=>{assert.throws(()=>L.truthTable(L.examples.counter(),[],[{id:'count',port:'Q'}]),/sequential|clock/i)});
test('import rejects unknown executable component types and dangling ports',()=>{assert.throws(()=>L.validateCircuit(C([n('x','<script>')])));assert.throws(()=>L.validateCircuit(C([n('a','SWITCH'),n('g','NOT')],[w('a','bad','g','A')])))});
test('propagation limit warning survives final diagnostics',()=>{const ns=[n('a','CONST',1,{value:1})],ws=[];for(let i=0;i<30;i++){ns.push(n('b'+i,'BUF'));ws.push(w(i?'b'+(i-1):'a','Q','b'+i,'A'))}const e=new L.Engine(C(ns,ws),{limit:8});e.reset();assert.equal(e.output('b29'),'X');assert.ok(e.warnings.some(x=>/limit/i.test(x)))});
test('registers on buffered routes of the same clock sample pre-edge data',()=>{const c=C([n('clk','CLOCK'),n('buf','BUF'),n('d','CONST',4,{value:7}),n('r1','REGISTER',4),n('r2','REGISTER',4)],[w('clk','Q','r1','CLK'),w('clk','Q','buf','A'),w('buf','Q','r2','CLK'),w('d','Q','r1','D'),w('r1','Q','r2','D')]);const e=new L.Engine(c);e.reset();e.clockTick();assert.equal(e.output('r1','Q'),7);assert.equal(e.output('r2','Q'),0);e.clockTick();assert.equal(e.output('r2','Q'),7)});
test('disabled recording suppresses transport and clock sampling',()=>{const e=new L.Engine(L.examples.counter(),{delay:'transport',capture:false});e.reset();assert.equal(e.samples.length,0);e.clockTick();assert.equal(e.output('count','Q'),1);assert.equal(e.samples.length,0);e.sample();assert.equal(e.samples.length,0)});
test('all curated examples validate and settle within bounds',()=>{for(const key of ['half','full','mux','sr','register','counter','alu','memory','cpu']){const c=L.validateCircuit(L.examples[key]());const e=new L.Engine(c,{limit:256});e.reset();assert.ok(e.pendingCount<=256,key)}});
}
console.log(`${tests-failures}/${tests} passed`);process.exitCode=failures?1:0;
