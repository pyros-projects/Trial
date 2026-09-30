// Live diagnostics in a sandboxed frame. agent-browser drives pointer/keyboard UI.
// Auxiliary modes configure actual Chrome downloads and set ordinary input files
// when the CLI's opaque-frame helpers cannot resolve them. No application API is
// called to perform actions and no product state is assigned by this helper.
import { readFileSync } from 'node:fs';
const [endpoint,suffix,action,argument]=process.argv.slice(2);
const expression=readFileSync(0,'utf8');
const ws=new WebSocket(endpoint);
let id=0;const pending=new Map(),contexts=[];
ws.addEventListener('message',event=>{
  const msg=JSON.parse(event.data);
  if(msg.method==='Runtime.executionContextCreated')contexts.push({...msg.params.context,sessionId:msg.sessionId});
  if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result);}
});
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const current=++id;pending.set(current,{resolve,reject});ws.send(JSON.stringify({id:current,method,params,...(sessionId?{sessionId}:{})}));});}
try{
  const {targetInfos}=await send('Target.getTargets');
  const target=targetInfos.find(t=>t.type==='iframe'&&t.url.endsWith(suffix))||targetInfos.find(t=>t.type==='page'&&t.url.endsWith(suffix));
  if(!target)throw new Error('No matching live target: '+JSON.stringify(targetInfos.map(t=>({type:t.type,url:t.url}))));
  const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  await send('Runtime.enable',{},sessionId);
  let value;
  if(action==='configure-downloads'){
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:argument});value={downloadPath:argument};
  }else if(action==='upload'){
    const {root}=await send('DOM.getDocument',{depth:0},sessionId);
    const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#projectFile'},sessionId);
    if(!nodeId)throw new Error('Ordinary project file input missing.');
    await send('DOM.setFileInputFiles',{nodeId,files:[argument]},sessionId);value={uploadedFile:argument};
  }else{
    const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));value=response.result.value;
  }
  console.log(JSON.stringify({target:{type:target.type,url:target.url},result:value},null,2));
  await send('Target.detachFromTarget',{sessionId});
}finally{ws.close();}
