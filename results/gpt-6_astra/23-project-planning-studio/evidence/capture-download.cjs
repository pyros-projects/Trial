const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const dir=path.resolve(process.argv[2]);fs.mkdirSync(dir,{recursive:true});
const ws=new WebSocket(execFileSync('agent-browser',['--session','planner','get','cdp-url'],{encoding:'utf8'}).trim());let seq=0,download;const pending=new Map();
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
ws.addEventListener('message',async e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);return;}if(m.method==='Browser.downloadWillBegin')download=m.params;if(m.method==='Browser.downloadProgress'&&m.params.state==='completed'&&download){console.log(JSON.stringify({suggestedFilename:download.suggestedFilename,path:m.params.filePath||path.join(dir,download.suggestedFilename),bytes:m.params.receivedBytes,url:download.url}));ws.close();}});
ws.addEventListener('open',async()=>{await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir,eventsEnabled:true});console.log('READY');});
setTimeout(()=>{console.error('No completed browser download observed');process.exit(1)},20000).unref();
