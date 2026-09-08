// Real Chromium touch input in the browser launched and managed by agent-browser.
// CLI core exposes mouse controls; this supplement sends CDP touch/pinch events.
const [url,action,payload,marker] = process.argv.slice(2);
const ws = new WebSocket(url);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
const targets=await call('Target.getTargets');
const candidates=targets.targetInfos.filter(t=>t.type==='page'&&t.url.includes('11-factory-automation/index.html'));
let sessionId;
for(const target of candidates){
 const attached=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
 const hit=marker ? (await call('Runtime.evaluate',{expression:'window.__forgeValidationTarget==='+JSON.stringify(marker),returnByValue:true},attached.sessionId)).result.value : candidates.length===1;
 if(hit){sessionId=attached.sessionId;break;}
 await call('Target.detachFromTarget',{sessionId:attached.sessionId});
}
if(!sessionId)throw new Error('Active application target not identified; supply its marker');
const read=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true},sessionId)).result.value;
const before=await read('Forge.diagnostics()');
const rect=await read("(()=>{const r=document.querySelector('#world').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()");
const point=(x,y,id=1)=>({id,x,y,radiusX:2,radiusY:2,force:1});
const send=(type,points)=>call('Input.dispatchTouchEvent',{type,touchPoints:points},sessionId);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
if(action==='draw'){
 const cells=JSON.parse(payload),pts=cells.map(([x,y])=>({x:rect.x+before.camera.x+(x+.5)*32*before.camera.z,y:rect.y+before.camera.y+(y+.5)*32*before.camera.z}));
 await send('touchStart',[point(pts[0].x,pts[0].y)]);await delay(100);
 for(let i=1;i<pts.length;i++)for(let j=1;j<=12;j++){
  const a=pts[i-1],b=pts[i],t=j/12;await send('touchMove',[point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)]);await delay(25);
 }
 await send('touchEnd',[]);
}else if(action==='pinch'){
 const x=rect.x+rect.w/2,y=rect.y+rect.h/2;
 await send('touchStart',[point(x-30,y,1),point(x+30,y,2)]);
 for(let i=1;i<=12;i++){await send('touchMove',[point(x-30-i*3,y,1),point(x+30+i*3,y,2)]);await delay(25);}
 await send('touchEnd',[]);
}else if(action==='pan'){
 const x=rect.x+rect.w/2,y=rect.y+rect.h/2;
 await send('touchStart',[point(x,y)]);
 for(let i=1;i<=12;i++){await send('touchMove',[point(x+i*3,y-i*2)]);await delay(25);}
 await send('touchEnd',[]);
}else throw new Error('Unknown action');
await delay(100);const after=await read('Forge.diagnostics()');
console.log(JSON.stringify({action,before:{camera:before.camera,count:before.structures.length},after:{camera:after.camera,count:after.structures.length,tool:after.tool,errors:after.errors}},null,2));
await call('Target.detachFromTarget',{sessionId});ws.close();
