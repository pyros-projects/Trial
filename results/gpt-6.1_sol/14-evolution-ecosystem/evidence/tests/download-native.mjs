import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const raw=fs.readFileSync('evidence/logs/touch-cdp-url.txt','utf8').trim(),url=raw.startsWith('"')?JSON.parse(raw):raw;
const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let i=0;const waiting=new Map(),events=[],started=Date.now();
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.method&&/download|loadingFailed|exceptionThrown/.test(d.method))events.push({...d,ms:Date.now()-started});if(d.id&&waiting.has(d.id)){const p=waiting.get(d.id);waiting.delete(d.id);d.error?p.j(Error(d.error.message)):p.r(d.result);}};
function call(method,params={},sessionId){const id=++i;return new Promise((r,j)=>{waiting.set(id,{r,j});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
const marker='download-target-'+Date.now();execFileSync('agent-browser',['--session','evolab-offline','eval','globalThis.__gestureTestPage='+JSON.stringify(marker)]);
const targets=(await call('Target.getTargets')).targetInfos;let sessionId,t;
for(const candidate of targets.filter(t=>t.type==='page'&&t.url.includes('127.0.0.1:8874'))){const attached=await call('Target.attachToTarget',{targetId:candidate.targetId,flatten:true});const check=(await call('Runtime.evaluate',{expression:'globalThis.__gestureTestPage',returnByValue:true},attached.sessionId)).result.value;if(check===marker){sessionId=attached.sessionId;t=candidate;break;}await call('Target.detachFromTarget',{sessionId:attached.sessionId});}
if(!sessionId)throw Error('Could not resolve the active agent-browser page.');
await call('Target.activateTarget',{targetId:t.targetId});await call('Emulation.setTouchEmulationEnabled',{enabled:false},sessionId);await call('Network.enable',{},sessionId);await call('Runtime.enable',{},sessionId);
await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:process.cwd()+'/evidence/native-downloads',eventsEnabled:true});
const selector=process.argv[2]||'#downloadJson';
const r=(await call('Runtime.evaluate',{expression:'(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()',returnByValue:true},sessionId)).result.value;
await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x,y:r.y},sessionId);await call('Input.dispatchMouseEvent',{type:'mousePressed',x:r.x,y:r.y,button:'left',buttons:1,clickCount:1},sessionId);await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x,y:r.y,button:'left',buttons:0,clickCount:1},sessionId);
await new Promise(r=>setTimeout(r,2200));console.log(JSON.stringify({target:t.title,point:r,events},null,2));ws.close();if(!events.some(e=>e.method==='Browser.downloadProgress'&&e.params.state==='completed'))process.exitCode=1;
