// Trusted native Chrome touch input, supplementary to agent-browser's navigation/control tests.
const {execFileSync}=require('node:child_process');
const url=execFileSync('agent-browser',['--session','ferro','get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(url);const pending=new Map();let id=0,session;
function call(method,params={},page=false){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(page?{sessionId:session}:{})}));});}
ws.onmessage=event=>{const d=JSON.parse(event.data);if(d.id&&pending.has(d.id)){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result);}};
const evaluate=async expression=>{const d=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},true);if(d.exceptionDetails)throw Error(d.exceptionDetails.text);return d.result.value;};
const touch=(type,points)=>call('Input.dispatchTouchEvent',{type,touchPoints:points},true);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function tap(x,y){await touch('touchStart',[{x,y,id:1}]);await delay(80);await touch('touchEnd',[]);await delay(80);}
function assert(condition,message){if(!condition)throw Error(message);console.log('PASS:',message);}
ws.onopen=async()=>{try{const targets=(await call('Target.getTargets')).targetInfos;const t=targets.find(t=>t.type==='page'&&t.url.endsWith('/11-factory-automation/index.html'));session=(await call('Target.attachToTarget',{targetId:t.targetId,flatten:true})).sessionId;await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},true);await evaluate('window.qaTouchEvents=[];document.getElementById("factoryCanvas").addEventListener("pointerdown",e=>qaTouchEvents.push({type:e.pointerType,trusted:e.isTrusted}));true');
 const target=await evaluate('Ferro.cellToScreen(12,9)');await tap(target.x,target.y);const heading=await evaluate('document.querySelector("#inspectPanel h3")?.textContent');assert(heading==='Assembler','native touch selects the live assembler and opens its inspector');
 const close=await evaluate('(()=>{const r=document.getElementById("closeInspector").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');await tap(close.x,close.y);
 // Select Pan camera with a real keyboard key, then perform a two-finger pinch.
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'c',code:'KeyC',windowsVirtualKeyCode:67},true);await call('Input.dispatchKeyEvent',{type:'keyUp',key:'c',code:'KeyC',windowsVirtualKeyCode:67},true);const before=await evaluate('Ferro.camera');
 await touch('touchStart',[{x:150,y:360,id:1},{x:240,y:360,id:2}]);await delay(100);await touch('touchMove',[{x:130,y:350,id:1},{x:265,y:350,id:2}]);await delay(100);await touch('touchEnd',[]);await delay(100);const after=await evaluate('Ferro.camera');assert(after.scale>before.scale*1.2,'two-finger native touch pinch changes camera zoom');const events=await evaluate('qaTouchEvents');assert(events.length>=3&&events.every(e=>e.type==='touch'&&e.trusted),'touch events are trusted browser input');console.log(JSON.stringify({before,after,events}));ws.close();}catch(error){console.error(error);process.exitCode=1;ws.close();}};
