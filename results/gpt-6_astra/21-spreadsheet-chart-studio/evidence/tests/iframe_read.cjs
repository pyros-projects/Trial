// Read-only CDP diagnostics for agent-browser's opaque iframe. Its eval command
// stays in the main document even after frame selection, so select a CDP context.
const fs=require('fs'),cp=require('child_process');
const expression=fs.readFileSync(0,'utf8');
(async()=>{
 const endpoint=cp.execFileSync('agent-browser',['--session','sheet21-9a42d3169eda-opaque','get','cdp-url'],{encoding:'utf8'}).trim();
 const ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map(),events=[];
 ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else events.push(m);};
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetInfos}=await send('Target.getTargets');
 const targets=targetInfos.filter(t=>t.type==='iframe'||t.type==='page');
 const contexts=[];
 for(const t of targets){const {sessionId}=await send('Target.attachToTarget',{targetId:t.targetId,flatten:true});await send('Runtime.enable',{},sessionId);for(const e of events.filter(e=>e.sessionId===sessionId&&e.method==='Runtime.executionContextCreated'))contexts.push({sessionId,target:t,ctx:e.params.context});}
 let chosen=contexts.find(c=>c.ctx.auxData?.isDefault&&c.target.type==='iframe'&&c.target.url.endsWith('/index.html'))||contexts.find(c=>c.ctx.auxData?.isDefault&&c.ctx.origin==='://');
 if(!chosen){console.error(JSON.stringify(contexts));throw Error('Opaque iframe execution context not found');}
 const result=await send('Runtime.evaluate',{expression,contextId:chosen.ctx.id,returnByValue:true,awaitPromise:true},chosen.sessionId);
 ws.close();if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));console.log(JSON.stringify(result.result.value));
})().catch(e=>{console.error(e);process.exit(1)});
