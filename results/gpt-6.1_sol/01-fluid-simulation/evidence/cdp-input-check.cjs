// agent-browser creates and manages this browser. Its Chrome CLI lacks touch
// dispatch, so this small adapter sends real CDP input to that same session.
// No DOM PointerEvent/TouchEvent synthesis or solver mutations are used.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const session='fluid-study',records=[];
const cli=(...args)=>{records.push({cli:args});return execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8'}).trim();};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const socket=new WebSocket(cli('get','cdp-url'));
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let serial=0,sessionId;
  const waiting=new Map();
  socket.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id&&waiting.has(msg.id)){const {resolve,reject}=waiting.get(msg.id);waiting.delete(msg.id);msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result);}};
  const send=(method,params={},target=true)=>new Promise((resolve,reject)=>{
    const id=++serial;waiting.set(id,{resolve,reject});const msg={id,method,params};if(target&&sessionId)msg.sessionId=sessionId;
    records.push({method,params});socket.send(JSON.stringify(msg));
  });
  const targets=(await send('Target.getTargets',{},false)).targetInfos;
  const page=targets.find(t=>t.type==='page'&&t.url.includes('01-fluid-simulation/index.html'));
  if(!page)throw new Error('No fluid-study page in the agent-browser session');
  sessionId=(await send('Target.attachToTarget',{targetId:page.targetId,flatten:true},false)).sessionId;
  const evaluate=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  cli('set','viewport','390','844');cli('find','role','button','click','--name','Reset simulation','--exact');
  // Reset is in the mobile panel below the canvas; the locator scrolls there.
  cli('scroll','up','2000');
  await sleep(120);
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const point=(x,y,id=1)=>({x,y,id,radiusX:6,radiusY:6,force:1});
  const initial=await evaluate('fluidLab.state');
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(75,400)]});
  for(let i=1;i<=20;i++){await sleep(16);await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(75+i*10,400+70*Math.sin(i/4))]});}
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(80);
  const touch=await evaluate('({state:fluidLab.state,fields:fluidLab.getStats()})');
  if(touch.state.input.lastPointerType!=='touch'||touch.state.pointerCount!==0||touch.state.input.splats<=initial.input.splats||!touch.fields.finite)throw new Error('Touch drag failed: '+JSON.stringify(touch));
  // Two touches then a real cancel exercise independent capture cleanup.
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(100,500),point(260,510,2)]});
  await sleep(20);
  const active=await evaluate('fluidLab.state.pointerCount');
  await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await sleep(50);
  const cancelled=await evaluate('fluidLab.state');
  if(active!==2||cancelled.pointerCount!==0)throw new Error('Multi-touch/cancel failed');
  cli('screenshot',path.join(__dirname,'screenshots','mobile-real-touch.png'));
  cli('set','viewport','1280','800');
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  // Actual 10 ms mouse samples test rapid input continuity and bounds capture.
  const mouseBefore=await evaluate('fluidLab.state');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:230,y:450});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:230,y:450,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=38;i++){await sleep(10);await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:230+i*15,y:450+100*Math.sin(i/6),button:'left',buttons:1});}
  // Move outside the canvas and release there; capture must clean up.
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:990,y:400,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:990,y:400,button:'left',buttons:0,clickCount:1});
  await sleep(120);
  const rapid=await evaluate('({state:fluidLab.state,fields:fluidLab.getStats()})');
  if(rapid.state.pointerCount!==0||rapid.state.queuedSegments!==0||rapid.state.input.splats<=mouseBefore.input.splats+30||!rapid.fields.finite)throw new Error('Rapid mouse continuity/capture failed');
  cli('screenshot',path.join(__dirname,'screenshots','rapid-capture-flow.png'));
  cli('find','role','button','click','--name','Pause simulation','--exact');
  const result={status:'pass',touch,multitouchActive:active,cancelled,rapid};
  fs.writeFileSync(path.join(__dirname,'logs','cdp-input-results.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(__dirname,'logs','cdp-input-commands.json'),JSON.stringify(records,null,2));
  console.log('PASS: genuine touch drag, two pointers, cancellation, 10 ms mouse strokes and release outside canvas.');
  socket.close();
})().catch(error=>{fs.writeFileSync(path.join(__dirname,'logs','cdp-input-commands.json'),JSON.stringify(records,null,2));console.error(error);process.exit(1);});
