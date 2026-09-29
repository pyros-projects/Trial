// Trusted touch input through CDP attached to the existing agent-browser session.
// agent-browser 0.31.1 exposes mouse input on Linux; this supplements its core workflow.
const {execFileSync}=require('child_process');
const endpoint=execFileSync('agent-browser',['--session','materia','get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(endpoint);let sequence=0;const pending=new Map();
ws.addEventListener('message',ev=>{const p=JSON.parse(ev.data);if(p.id){const call=pending.get(p.id);if(call){pending.delete(p.id);p.error?call.reject(Error(JSON.stringify(p.error))):call.resolve(p.result);}}});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
(async()=>{await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});const {targetInfos}=await send('Target.getTargets');const page=targetInfos.find(t=>t.type==='page'&&t.url.endsWith('/09-falling-sand-alchemy/index.html'));if(!page)throw Error('Application tab unavailable');const {sessionId}=await send('Target.attachToTarget',{targetId:page.targetId,flatten:true});const cmd=(method,params)=>send(method,params,sessionId);await cmd('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
const inspect=async expression=>(await cmd('Runtime.evaluate',{expression,returnByValue:true})).result.value;
await inspect('window.touchEvidence=[]; document.getElementById("world").addEventListener("pointerdown",e=>touchEvidence.push({type:e.pointerType,trusted:e.isTrusted}));');
const geometry=await inspect('({box:document.getElementById("world").getBoundingClientRect().toJSON(),w:lab.world.w,h:lab.world.h})');const xy=(x,y)=>({x:geometry.box.x+(x+.5)/geometry.w*geometry.box.width,y:geometry.box.y+(y+.5)/geometry.h*geometry.box.height,id:1,radiusX:2,radiusY:2,force:1});
await cmd('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[xy(65,45)]});for(let x=72;x<=145;x+=7)await cmd('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[xy(x,45)]});await cmd('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
console.log(JSON.stringify(await inspect('({events:touchEvidence,state:lab.state,paintedVelocity:{vx:lab.world.vx[45*lab.world.w+90],vy:lab.world.vy[45*lab.world.w+90]},paintedTemperature:lab.world.temp[45*lab.world.w+90],bodyScrollWidth:document.documentElement.scrollWidth})')));await send('Target.detachFromTarget',{sessionId});ws.close();
})().catch(e=>{console.error(e.stack);process.exitCode=1;ws.close();});
