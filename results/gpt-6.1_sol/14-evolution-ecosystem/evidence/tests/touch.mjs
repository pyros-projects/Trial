import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const raw=fs.readFileSync('evidence/logs/touch-cdp-url.txt','utf8').trim();
const url=raw.startsWith('"')?JSON.parse(raw):raw;
const ws=new WebSocket(url);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let next=0;const calls=new Map();ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id&&calls.has(d.id)){const p=calls.get(d.id);calls.delete(d.id);d.error?p.reject(Error(d.error.message)):p.resolve(d.result);}};
function call(method,params={},sessionId){const id=++next;return new Promise((resolve,reject)=>{calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
const browserSession=process.argv[2]||'evolab-offline';
const marker='touch-target-'+Date.now();execFileSync('agent-browser',['--session',browserSession,'eval','globalThis.__gestureTestPage='+JSON.stringify(marker)]);
const targets=(await call('Target.getTargets')).targetInfos;let sessionId,target;
for(const t of targets.filter(t=>t.type==='page'&&t.url.includes('127.0.0.1:8874'))){const attached=await call('Target.attachToTarget',{targetId:t.targetId,flatten:true});const check=(await call('Runtime.evaluate',{expression:'globalThis.__gestureTestPage',returnByValue:true},attached.sessionId)).result.value;if(check===marker){sessionId=attached.sessionId;target=t;break;}await call('Target.detachFromTarget',{sessionId:attached.sessionId});}
if(!sessionId)throw Error('Could not resolve the active agent-browser page.');
await call('Target.activateTarget',{targetId:target.targetId});
const evalPage=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result.value;
await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sessionId);
const r=await evalPage('(()=>{const r=document.getElementById("world").getBoundingClientRect();return {x:r.left,y:r.top,width:r.width,height:r.height};})()');
const x=r.x+r.width*.52,y=r.y+r.height*.5;
const p=(id,dx,dy=0)=>({id,x:x+dx,y:y+dy,radiusX:3,radiusY:3,force:1});
const touch=(type,touchPoints)=>call('Input.dispatchTouchEvent',{type,touchPoints},sessionId);
const camera=()=>evalPage('({...window.ecolab.camera})');
await evalPage('globalThis.__touchLog=[];["pointerdown","pointerup","pointermove","pointercancel"].forEach(type=>document.addEventListener(type,e=>__touchLog.push({type:e.type,id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target.id})));');
const environment=await evalPage('({dpr:devicePixelRatio,scale:visualViewport.scale,width:innerWidth,height:innerHeight,url:location.href})');const start=await camera();await touch('touchStart',[p(1,-30)]);await touch('touchStart',[p(1,-30),p(2,30)]);await touch('touchMove',[p(1,-50),p(2,60)]);const pinched=await camera();
await touch('touchEnd',[p(2,60)]);const lifted=await camera();await touch('touchMove',[p(1,-10,25)]);const dragged=await camera();await touch('touchEnd',[]);
const result={environment,start,pinched,lifted,dragged,pinchChangesZoom:pinched.zoom!==start.zoom,remainingFingerContinuesPan:dragged.x!==lifted.x||dragged.y!==lifted.y,touchSupport:await evalPage('navigator.maxTouchPoints'),events:await evalPage('__touchLog')};
console.log(JSON.stringify(result,null,2));ws.close();if(!result.pinchChangesZoom||!result.remainingFingerContinuesPan)process.exitCode=1;
