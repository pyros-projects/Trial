// Read-only CDP diagnostics supplement: agent-browser eval remains in the parent
// execution context for this opaque iframe. All UI actions use agent-browser.
const {execFileSync}=require('child_process');
(async()=>{
 const r=JSON.parse(execFileSync('agent-browser',['--session',process.env.OPAQUE_TEST_SESSION||'opaque','get','cdp-url','--json'],{encoding:'utf8'}));
 const ws=new WebSocket(r.data.cdpUrl),pending=new Map();let seq=0;
 await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
 const cmd=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))});
 try{
  const targets=(await cmd('Target.getTargets')).targetInfos;
  const target=targets.find(t=>t.type==='iframe'&&t.url.endsWith('/index.html'));if(!target)throw Error('Opaque iframe CDP target not found '+JSON.stringify(targets));
  const {sessionId}=await cmd('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  const r=await cmd('Runtime.evaluate',{expression:process.argv[2]||'({origin:self.origin,state:studioDiagnostics,storage:(()=>{try{return localStorage.length}catch(e){return e.name}})()})',returnByValue:true},sessionId);
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));console.log(JSON.stringify(r.result.value,null,2));
 }finally{ws.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
