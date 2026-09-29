// agent-browser 0.31.1 keydown Space emitted empty key/code. Send trusted CDP keyboard input.
const {execFileSync}=require('node:child_process');
const url=execFileSync('agent-browser',['--session','ferro-import-text','get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(url);let id=0;const pending=new Map();
function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})}));});}
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id&&pending.has(d.id)){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result);}};
ws.onopen=async()=>{try{const targets=(await call('Target.getTargets')).targetInfos;const t=targets.find(t=>t.type==='page'&&t.url.endsWith('/11-factory-automation/index.html'));const s=(await call('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;await call('Input.dispatchKeyEvent',{type:process.argv[2]==='down'?'keyDown':'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32},s);console.log('Native Space '+process.argv[2]+' sent');}catch(error){console.error(error);process.exitCode=1;}finally{ws.close();}};
