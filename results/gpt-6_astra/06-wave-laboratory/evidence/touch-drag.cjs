// Supplemental real touch input through Chromium CDP on the agent-browser session.
// agent-browser 0.31.1 provides mouse drag but no desktop touch-drag command.
const fs=require('node:fs');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const ws=new WebSocket(input.url);let id=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result);}};
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,sessionId}));});
(async()=>{await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});const targets=await send('Target.getTargets');const target=targets.targetInfos.find(t=>t.type==='page'&&t.url.includes('06-wave-laboratory/index.html'));if(!target)throw Error('Wave Lab page not found');const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1},sessionId);
for(let i=0;i<input.points.length;i++){const [x,y]=input.points[i];await send('Input.dispatchTouchEvent',{type:i===0?'touchStart':'touchMove',touchPoints:[{x,y,radiusX:4,radiusY:4,force:1,id:1}]},sessionId);await new Promise(r=>setTimeout(r,50));}
await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sessionId);console.log(JSON.stringify({touchPoints:input.points,dispatched:true}));ws.close();})().catch(e=>{console.error(e);ws.close();process.exitCode=1;});
