const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(html.match(/<script id="logic-engine">([\s\S]*?)<\/script>/)[1], context);
const { Engine, makeNode } = context.Logic;
function chain(count, reverse) {
  const nodes = Array.from({length:count}, (_,k) => makeNode(k ? 'NOT' : 'SWITCH', k*20, 0));
  const wires = nodes.slice(1).map((n,k) => ({id:'cw'+k,from:{node:nodes[k].id,port:'Q'},to:{node:n.id,port:'A'}}));
  return {circuit:{nodes:reverse ? [...nodes].reverse() : nodes,wires},input:nodes[0].id,last:nodes.at(-1).id};
}
for (const reverse of [false,true]) {
  const graph = chain(1500,reverse), start = performance.now();
  const e = new Engine(graph.circuit);
  const compiledMs = performance.now()-start;
  assert.equal(e.oscillating,false);
  assert.equal(e.output(graph.last),1);
  const eventsBefore = e.events, propagateStart = performance.now();
  e.setSource(graph.input,1,true);
  const propagateMs = performance.now()-propagateStart;
  assert.equal(e.oscillating,false);
  assert.equal(e.output(graph.last),0);
  console.log(JSON.stringify({scenario:'1,500-component chain',reverse,compileAndResetMs:+compiledMs.toFixed(1),propagateMs:+propagateMs.toFixed(1),events:e.events-eventsBefore}));
}
// Reverse order maximizes initial uncertainty and tests the allowed wire boundary.
const nodes = [makeNode('SWITCH')];
for(let k=1;k<1500;k++)nodes.push(makeNode('XOR'));
const wires=[];
for(let k=1;k<nodes.length;k++){
  const prior=Math.max(0,k-1),skip=Math.max(0,k-2);
  wires.push({id:'a'+k,from:{node:nodes[prior].id,port:'Q'},to:{node:nodes[k].id,port:'A'}});
  wires.push({id:'b'+k,from:{node:nodes[skip].id,port:'Q'},to:{node:nodes[k].id,port:'B'}});
}
const start=performance.now();
const e=new Engine({nodes:[...nodes].reverse(),wires});
const buildMs=performance.now()-start;
const eventBase=e.events,changeStart=performance.now();
e.setSource(nodes[0].id,1,true);
console.log(JSON.stringify({scenario:'1,500-component reconvergent XOR graph',buildMs:+buildMs.toFixed(1),changeMs:+(performance.now()-changeStart).toFixed(1),events:e.events-eventBase,oscillating:e.oscillating,finalOutput:e.output(nodes.at(-1).id),warnings:e.warnings.slice(0,2)}));
