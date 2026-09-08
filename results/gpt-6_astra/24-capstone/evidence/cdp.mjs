// Auxiliary CDP configuration only; user workflows are driven by agent-browser.
import {execFileSync} from 'node:child_process';
const [session,method,raw='{}',hold]=process.argv.slice(2);
const url=execFileSync('agent-browser',['--session',session,'get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(url); await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let seq=0;const contexts=[];const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.executionContextCreated')contexts.push({...m.params.context,sessionId:m.sessionId});if(m.id&&pending.has(m.id)){const{res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(new Error(JSON.stringify(m.error))):res(m.result);}};
function call(method,params={},sessionId){return new Promise((res,rej)=>{const id=++seq;pending.set(id,{res,rej});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
try {
 let sid;
 const params=JSON.parse(raw);

 if(!method.startsWith('Browser.')){const ts=await call('Target.getTargets');const page=ts.targetInfos.find(t=>t.type==='page'&&(t.url.includes('/index.html')||t.url.includes('/evidence/iframe.html')));if(!page)throw Error('No page target');sid=(await call('Target.attachToTarget',{targetId:page.targetId,flatten:true})).sessionId;}
 if(method==='Harness.touchCheck'){
  const inspect=async()=>{const r=await call('Runtime.evaluate',{expression:'({state:selvedge.getState(),diag:selvedge.diagnostics()})',returnByValue:true},sid);return r.result.value;};
  const point={x:params.x,y:params.y,id:1,radiusX:2,radiusY:2,force:1};
  const before=await inspect();
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]},sid);const during=await inspect();
  await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]},sid);const canceled=await inspect();
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]},sid);
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sid);const tapped=await inspect();
  console.log(JSON.stringify({before,during,canceled,tapped}));
 }else if(method==='Frame.evaluate'){
  await call('Runtime.enable',{},sid);
  let ctx=contexts.find(c=>c.auxData?.isDefault&&c.origin==='://');
  const tree=await call('Page.getFrameTree',{},sid);
  const child=tree.frameTree.childFrames?.find(f=>f.frame.url.includes('index.html'));
  if(child)ctx=contexts.find(c=>c.auxData?.isDefault&&c.auxData.frameId===child.frame.id);
  if(!ctx){const ts=await call('Target.getTargets');const iframe=ts.targetInfos.find(t=>t.type==='iframe'&&t.url.includes('index.html'));if(iframe){sid=(await call('Target.attachToTarget',{targetId:iframe.targetId,flatten:true})).sessionId;await call('Runtime.enable',{},sid);ctx=contexts.find(c=>c.sessionId===sid&&c.auxData?.isDefault);}}
  if(!ctx)throw Error('No iframe default execution context: '+JSON.stringify(contexts));
  console.log(JSON.stringify(await call('Runtime.evaluate',{...params,contextId:ctx.id,returnByValue:true,awaitPromise:true},sid)));
 }else console.log(JSON.stringify(await call(method,params,sid)));if(hold!=='--hold')ws.close();
}catch(e){console.error(e);ws.close();process.exitCode=1;}
