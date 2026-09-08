// Execute the actual interface lifecycle functions; stub only DOM rendering and timers.
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),c={};vm.createContext(c);
vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1],c);
const ui=html.match(/<script id="interface">([\s\S]*?)<\/script>/)[1];
const lifecycle=['closeModal','startReplay','stopReplay'];
function source(name){const from=ui.indexOf('function '+name+'('),to=ui.indexOf('\nfunction ',from+1);return ui.slice(from,to<0?undefined:to);}
const timers=new Map(),elements=new Map();let id=0;
Object.assign(c,{setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(id){timers.delete(id);},$:name=>{if(!elements.has(name))elements.set(name,{focus(){}});return elements.get(name);},renderUI(){},notify(){},openModal(){},canvas:{focus(){}},lastFocus:null});
vm.runInContext('var E=EmberEngine,state=E.create(),replayInfo=null,replayTimer=null,paused=false,modalName="",selected="move",effects=[],oldPositions={},settings={speed:150}; for(let n=0;n<4;n++) E.act(state,{type:"wait"});',c);
for(const name of lifecycle)vm.runInContext(source(name),c);
const original=c.E.fingerprint(c.state);console.log('before playback',JSON.stringify({turn:c.state.turn,fingerprint:original}));
c.startReplay();const [timer,step]=[...timers.entries()][0];timers.delete(timer);step();
console.log('during playback',JSON.stringify({turn:c.state.turn,originalTurn:c.replayInfo.original.turn,index:c.replayInfo.index}));
// Menu > Replay actions remains available during playback; it calls this same function.
c.startReplay();console.log('after replay again',JSON.stringify({turn:c.state.turn,originalTurn:c.replayInfo.original.turn,index:c.replayInfo.index}));
c.stopReplay();console.log('after Escape',JSON.stringify({turn:c.state.turn,fingerprint:c.E.fingerprint(c.state),matchesOriginal:c.E.fingerprint(c.state)===original}));
