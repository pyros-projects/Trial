// Supplemental real Chrome input for wheel and multitouch; browser is launched by agent-browser.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const endpoint=execFileSync('agent-browser',['--session','orbital','get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(endpoint),pending=new Map();let id=0,session;
ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}};
const send=(method,params={},target=true)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(target&&session?{sessionId:session}:{})}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const state=async()=>{const r=await send('Runtime.evaluate',{expression:'Lensing.getState()',returnByValue:true});return r.result.value};
const touch=async(type,points)=>{await send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:2,radiusY:2,force:1}))});await sleep(90)};
(async()=>{
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
const all=await send('Target.getTargets',{},false);const page=all.targetInfos.find(t=>t.type==='page'&&t.url.endsWith('/05-black-hole-lensing/index.html'));
if(!page)throw new Error('Delivered application page not found');
session=(await send('Target.attachToTarget',{targetId:page.targetId,flatten:true},false)).sessionId;
const before=await state(),mode=process.argv[2];
if(mode==='wheel')await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:420,deltaY:200,deltaX:0});
else {await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
if(mode==='tap'){await touch('touchStart',[[1,290,430]]);await touch('touchEnd',[]);}
if(mode==='orbit'){await touch('touchStart',[[1,160,390]]);await touch('touchMove',[[1,180,400]]);await touch('touchMove',[[1,220,415]]);await touch('touchEnd',[]);}
if(mode==='pinch'){await touch('touchStart',[[1,120,430],[2,280,430]]);await touch('touchMove',[[1,100,440],[2,300,440]]);await touch('touchMove',[[1,80,450],[2,320,450]]);await touch('touchEnd',[]);}
if(mode==='cancel'){await touch('touchStart',[[1,180,400]]);await touch('touchMove',[[1,200,420]]);await touch('touchCancel',[]);await touch('touchStart',[[1,220,410]]);await touch('touchMove',[[1,240,420]]);await touch('touchEnd',[]);}
}
await sleep(150);const after=await state();const result={mode,before:{camera:before.camera,selection:before.selection},after:{camera:after.camera,selection:after.selection,ray:after.ray,errors:after.events.errors,glError:after.glError}};
console.log(JSON.stringify(result,null,2));fs.appendFileSync('evidence/logs/cdp-input.jsonl',JSON.stringify(result)+'\n');ws.close();
})().catch(e=>{console.error(e);ws.close();process.exitCode=1});
