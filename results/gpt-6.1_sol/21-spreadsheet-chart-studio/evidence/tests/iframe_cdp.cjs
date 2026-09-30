// Read-only live diagnostics and native file-input selection for the sandboxed
// OOPIF. Application editing/navigation remains agent-browser ref automation.
const {execFileSync}=require('node:child_process');
const url=execFileSync('agent-browser',['--session','studio-verified','get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(url),pending=new Map();let id=0;
ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);if(p){pending.delete(data.id);data.error?p.reject(new Error(JSON.stringify(data.error))):p.resolve(data.result);}}else if(process.argv[2]==='watch'&&['Runtime.exceptionThrown','Runtime.consoleAPICalled','Log.entryAdded','Network.loadingFailed','Browser.downloadWillBegin','Browser.downloadProgress'].includes(data.method)){process.stdout.write(JSON.stringify({event:data.method,params:data.params})+'\n');}});
function request(method,params={},sessionId){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});}
(async()=>{
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 const targets=(await request('Target.getTargets')).targetInfos;const target=targets.find(t=>t.type==='iframe'&&t.url.endsWith('/index.html'));if(!target)throw new Error('Opaque iframe target was not available.');
 const {sessionId}=await request('Target.attachToTarget',{targetId:target.targetId,flatten:true});
 await request('Runtime.enable',{},sessionId);
 const diagnostics=await request('Runtime.evaluate',{expression:'(async()=>{let storage,parentAccess;try{void localStorage;storage="allowed";}catch(e){storage=e.name;}try{void parent.document;parentAccess="allowed";}catch(e){parentAccess=e.name;}const read=(await navigator.permissions.query({name:"clipboard-read"})).state,write=(await navigator.permissions.query({name:"clipboard-write"})).state;return {origin:self.origin,storage,parentAccess,clipboardRead:read,clipboardWrite:write};})()',returnByValue:true,awaitPromise:true},sessionId);
 const result=diagnostics.result.value;
 if(process.argv[2]==='file'){
   const doc=await request('DOM.getDocument',{depth:1,pierce:true},sessionId);const {nodeId}=await request('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#import-file'},sessionId);await request('DOM.setFileInputFiles',{nodeId,files:[process.argv[3]]},sessionId);console.log(JSON.stringify({nativeFileSelected:process.argv[3],...result}));
 }else if(process.argv[2]==='watch'){
   await request('Network.enable',{},sessionId);await request('Log.enable',{},sessionId);const contexts=(await request('Target.getBrowserContexts')).browserContextIds;await request('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:process.argv[3]||process.cwd()+'/evidence/iframe-downloads',eventsEnabled:true,...(contexts.includes(target.browserContextId)?{browserContextId:target.browserContextId}:{})});console.log(JSON.stringify({ready:true,...result}));await new Promise(resolve=>{const timer=setTimeout(resolve,300000);process.once('SIGTERM',()=>{clearTimeout(timer);resolve();});});
 }else console.log(JSON.stringify(result));
 ws.close();
})().catch(e=>{console.error(e.stack);ws.close();process.exitCode=1;});
