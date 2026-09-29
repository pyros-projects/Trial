// Observe real Chrome download events and enable downloads in the actual recording context.
// agent-browser record starts a new context; its download helper did not configure that context.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const url=execFileSync('agent-browser',['--session','ferro','get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(url);const waiting=new Map();let id=0;
function call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;waiting.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id&&waiting.has(msg.id)){const p=waiting.get(msg.id);waiting.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}else if(msg.method?.startsWith('Browser.download'))console.log(JSON.stringify(msg));};
ws.onopen=async()=>{try{const targets=await call('Target.getTargets');const pages=targets.targetInfos.filter(t=>t.type==='page'&&t.url.endsWith('/11-factory-automation/index.html'));console.log('Factory contexts:',pages.map(t=>({targetId:t.targetId,browserContextId:t.browserContextId})));for(const t of pages){const params={behavior:'allow',downloadPath:'/home/pyro/projects/naked/sol61/11-factory-automation/evidence',eventsEnabled:true};if(t.browserContextId)params.browserContextId=t.browserContextId;await call('Browser.setDownloadBehavior',params);}console.log('Downloads enabled in actual factory context');setTimeout(()=>ws.close(),20000);}catch(e){console.error(e);ws.close();process.exitCode=1;}};
