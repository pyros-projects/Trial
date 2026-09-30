// Read-only CDP diagnostics supplement: agent-browser eval remains in the parent
// execution context for this opaque iframe. All UI actions use agent-browser.
const {execFileSync}=require('child_process');
(async()=>{
 const r=JSON.parse(execFileSync('agent-browser',['--session',process.env.OPAQUE_TEST_SESSION||'opaque','get','cdp-url','--json'],{encoding:'utf8'}));
 const ws=new WebSocket(r.data.cdpUrl),pending=new Map();let seq=0,downloadDone;
 await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method&&m.method.includes('download')){console.log(JSON.stringify(m));if(m.params.state==='completed')downloadDone?.()}if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}};
 const cmd=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))});
 try{
  const targets=(await cmd('Target.getTargets')).targetInfos;
  const iframe=targets.find(t=>t.type==='iframe'&&t.url.endsWith('/index.html')),page=targets.find(t=>t.type==='page'&&t.url.endsWith('/evidence/sandbox.html'));
  const main=(await cmd('Target.attachToTarget',{targetId:page.targetId,flatten:true})).sessionId;
  const inner=(await cmd('Target.attachToTarget',{targetId:iframe.targetId,flatten:true})).sessionId;
  await cmd('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:process.argv[3],eventsEnabled:true});
  await cmd('Page.setDownloadBehavior',{behavior:'allow',downloadPath:process.argv[3]},main);
  const b=(await cmd('Runtime.evaluate',{expression:'(()=>{const r=document.querySelector('+JSON.stringify(process.argv[2])+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()',returnByValue:true},inner)).result.value;
  console.log('Click point',b);if(!b||!Number.isFinite(b.x))throw Error('No download click point');const done=new Promise(resolve=>{downloadDone=resolve;setTimeout(resolve,4000)});
  await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',...b},main);
  await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...b},main);
  await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...b},main);
  await done;
 }finally{ws.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
