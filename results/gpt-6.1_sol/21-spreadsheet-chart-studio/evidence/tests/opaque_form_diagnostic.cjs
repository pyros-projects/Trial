const{execFileSync}=require('node:child_process');
const ws=new WebSocket(execFileSync('agent-browser',['--session','studio-verified','get','cdp-url'],{encoding:'utf8'}).trim());let n=0,pending=new Map();
const req=(method,params={},sessionId)=>new Promise((resolve,reject)=>{pending.set(++n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,sessionId}));});
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result);}else if(d.method==='Log.entryAdded')console.log(JSON.stringify(d));};
ws.onopen=async()=>{const target=(await req('Target.getTargets')).targetInfos.find(t=>t.type==='iframe'&&t.url.endsWith('/index.html'));const s=(await req('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await req('Log.enable',{},s);await req('Runtime.enable',{},s);
console.log((await req('Runtime.evaluate',{expression:'({open:document.getElementById("import-dialog").open,A2:document.getElementById("cell-A2").textContent})',returnByValue:true},s)).result.value);
execFileSync('agent-browser',['--session','studio-verified','mouse','move','790','660']);execFileSync('agent-browser',['--session','studio-verified','mouse','down','left']);execFileSync('agent-browser',['--session','studio-verified','mouse','up','left']);
console.log((await req('Runtime.evaluate',{expression:'({open:document.getElementById("import-dialog").open,A2:document.getElementById("cell-A2").textContent})',returnByValue:true},s)).result.value);ws.close();};
