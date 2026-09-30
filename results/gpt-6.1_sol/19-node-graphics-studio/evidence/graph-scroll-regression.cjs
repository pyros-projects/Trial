const {execFileSync}=require('child_process'),assert=require('assert');
function run(...args){return JSON.parse(execFileSync('agent-browser',['--session','fieldwork','--json',...args],{encoding:'utf8'}));}
run('scrollintoview','#node-10 .node-head');
const d=run('eval','({top:document.querySelector("#graphStage").scrollTop,left:document.querySelector("#graphStage").scrollLeft,button:document.querySelector("#zoomIn").getBoundingClientRect().toJSON(),stage:document.querySelector("#graphStage").getBoundingClientRect().toJSON()})').data.result;
console.log(d);assert.equal(d.top,0,'Offscreen focus must not scroll the graph independently of its camera');assert.equal(d.left,0);assert(d.button.y>=d.stage.y,'Graph toolbar must remain inside graph viewport');console.log('PASS graph viewport cannot native-scroll; toolbar remains aligned');
