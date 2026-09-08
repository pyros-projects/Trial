// agent-browser performs the click; CDP observes downloads from the opaque frame.
const fs=require('fs'),path=require('path'),cp=require('child_process');
(async()=>{
 const [selector,dest]=process.argv.slice(2),dir=path.dirname(dest);
 const endpoint=cp.execFileSync('agent-browser',['--session','sheet21-9a42d3169eda-opaque','get','cdp-url'],{encoding:'utf8'}).trim();
 const ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0,info;const pending=new Map();let resolveDone,rejectDone;
 const done=new Promise((r,j)=>{resolveDone=r;rejectDone=j});
 ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Browser.downloadWillBegin')info=m.params;else if(m.method==='Browser.downloadProgress'&&m.params.state==='completed')resolveDone(m.params);else if(m.method==='Browser.downloadProgress'&&m.params.state==='canceled')rejectDone(Error('Download canceled'));};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir,eventsEnabled:true});
 cp.execFileSync('agent-browser',['--session','sheet21-9a42d3169eda-opaque','focus',selector],{encoding:'utf8'});
 const clicked=cp.execFileSync('agent-browser',['--session','sheet21-9a42d3169eda-opaque','--json','click',selector],{encoding:'utf8'});
 const timeout=setTimeout(()=>rejectDone(Error('No completed download event')),15000);
 const completion=await done;clearTimeout(timeout);const original=completion.filePath||path.join(dir,info.suggestedFilename);
 if(path.resolve(original)!==path.resolve(dest))fs.copyFileSync(original,dest);
 ws.close();console.log(JSON.stringify({success:true,data:{suggestedFilename:info.suggestedFilename,original,destination:dest,bytes:fs.statSync(dest).size,click:JSON.parse(clicked),completion}}));
})().catch(e=>{console.error(e);process.exit(1)});
