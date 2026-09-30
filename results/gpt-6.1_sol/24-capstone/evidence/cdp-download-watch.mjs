// Watch a real browser download caused by an agent-browser pointer click.
// Keep CDP alive: Chromium resets the per-connection download override on detach.
import { statSync } from 'node:fs';
import { join } from 'node:path';
const [endpoint,downloadPath]=process.argv.slice(2);
const ws=new WebSocket(endpoint),pending=new Map();let next=0,current;
let complete,rejectComplete;
const done=new Promise((resolve,reject)=>{complete=resolve;rejectComplete=reject;});
ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data);
  if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}
  if(m.method==='Browser.downloadWillBegin')current=m.params;
  if(m.method==='Browser.downloadProgress'&&current&&m.params.guid===current.guid){
    if(m.params.state==='completed')complete({filename:current.suggestedFilename,path:m.params.filePath||join(downloadPath,current.suggestedFilename),state:'completed'});
    else if(m.params.state==='canceled')rejectComplete(new Error('Chrome canceled the download.'));
  }
});
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
const send=(method,params)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
let timeout;
try{
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath,eventsEnabled:true});
  timeout=setTimeout(()=>rejectComplete(new Error('No completed Chrome download within 10 seconds.')),10000);
  console.log(JSON.stringify({ready:true,downloadPath}));
  const result=await done;result.bytes=statSync(result.path).size;console.log(JSON.stringify(result));
}finally{clearTimeout(timeout);ws.close();}
