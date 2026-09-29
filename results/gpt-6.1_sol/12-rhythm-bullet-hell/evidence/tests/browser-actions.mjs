// Development-only trusted input through the same browser opened by agent-browser.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const session=process.argv[2]||'pulse-vector',mode=process.argv[3]||'keyboard';
const url=execFileSync('agent-browser',['--session',session,'get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(url);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
let serial=0,attached,pending=new Map();
ws.onmessage=e=>{const r=JSON.parse(e.data);if(r.id){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(new Error(r.error.message)):p.resolve(r.result);}};
function send(method,params={},browser=false){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(!browser&&attached?{sessionId:attached}:{})}));});}
const targets=(await send('Target.getTargets',{},true)).targetInfos;
const target=targets.find(t=>t.type==='page'&&/index\.html|127\.0\.0\.1:4173/.test(t.url))||targets.find(t=>t.type==='page');
attached=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},true)).sessionId;
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
const state=()=>evaluate('window.PulseVector.state()');
const names={ShiftLeft:['Shift',16],Space:[' ',32],Escape:['Escape',27],ArrowLeft:['ArrowLeft',37],ArrowRight:['ArrowRight',39],ArrowUp:['ArrowUp',38],ArrowDown:['ArrowDown',40]};
async function key(code,type,modifiers=0){const [name,vk]=names[code]||[code.replace('Key','').toLowerCase(),code.replace('Key','').charCodeAt(0)];return send('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers});}
async function hold(codes,ms){for(const code of codes)await key(code,'keyDown',codes.includes('ShiftLeft')?8:0);await sleep(ms);for(const code of [...codes].reverse())await key(code,'keyUp');await sleep(35);}
async function waitBeat(fraction=0){let s=await state(),next=Math.ceil(s.transportBeat+.3)+fraction;for(let i=0;i<500;i++){s=await state();if(s.transportBeat>=next-.025)return s;await sleep(8);}throw new Error('beat wait timed out');}
async function mouse(type,x,y){await send('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:1});}
function screen(world,rect){const k=Math.min(rect.width/800,rect.height/680);return{x:rect.left+(rect.width-800*k)/2+world.x*k,y:rect.top+(rect.height-680*k)/2+world.y*k};}
let result={mode,at:new Date().toISOString()};
try{
if(['keyboard','damage','pointer','beats','touch','victory','remap','patterns'].includes(mode)){let ready=false;for(let i=0;i<700;i++){const s=await state();if(s.state==='running'&&(mode==='victory'||s.simBeat>2)){ready=true;break;}await sleep(20);}if(!ready)throw new Error('The actual run did not become ready.');}
if(mode==='ready'){const expression=process.argv[4]||"window.PulseVector.state().state==='running'";let ok=false;for(let i=0;i<2500;i++){if(await evaluate(expression)){ok=true;break;}await sleep(20);}if(!ok)throw new Error('Condition did not become true: '+expression);result.state=await state();}
if(mode==='keyboard'){
 result.before=await state();await hold(['KeyD'],300);result.normal=await state();await hold(['ShiftLeft','KeyD'],300);result.focus=await state();await hold(['ShiftLeft','KeyW','KeyD'],300);result.diagonal=await state();
 await waitBeat();await hold(['Space'],20);result.dash=await state();await hold(['Space'],20);result.cooldownAttempt=await state();
 await waitBeat();await hold(['KeyJ'],20);result.pulse=await state();await waitBeat(.5);await hold(['KeyJ'],20);result.offbeat=await state();
 await hold(['Escape'],10);await sleep(80);result.pauseStart=await state();await sleep(800);result.pauseEnd=await state();
 if(Math.abs(result.pauseEnd.audioTime-result.pauseStart.audioTime)>1e-8||result.pauseEnd.simulationTick!==result.pauseStart.simulationTick)throw new Error('Pause clock advanced');
 if(result.dash.player.cooldown<=0)throw new Error('Dash did not trigger');
 if(result.focus.player.x-result.normal.player.x>=result.normal.player.x-result.before.player.x)throw new Error('Focus did not slow movement');
}
if(mode==='damage'){
 result.before=await state();const rect=await evaluate('document.querySelector("#game").getBoundingClientRect().toJSON()');const pos=screen({x:400,y:145},rect);await mouse('mouseMoved',pos.x,pos.y);await mouse('mousePressed',pos.x,pos.y);
 for(let i=0;i<500;i++){const s=await state();if(s.collisions>result.before.collisions){result.hit=s;break;}await sleep(12);}await mouse('mouseReleased',pos.x,pos.y);if(!result.hit)throw new Error('No collision occurred after moving into the barrage');await hold(['Escape'],10);result.paused=await state();
 if(result.hit.player.invul<=0)throw new Error('No post-damage invulnerability');
}
if(mode==='pointer'){
 result.before=await state();const rect=await evaluate('document.querySelector("#game").getBoundingClientRect().toJSON()');const pos=screen({x:600,y:540},rect);await mouse('mouseMoved',pos.x,pos.y);await mouse('mousePressed',pos.x,pos.y);await sleep(500);await mouse('mouseReleased',pos.x,pos.y);result.after=await state();await sleep(220);result.released=await state();
 if(Math.abs(result.after.player.x-result.before.player.x)<25)throw new Error('Pointer did not move player');
 if(Math.abs(result.released.player.x-result.after.player.x)>4)throw new Error('Pointer release left movement stuck');
 await hold(['Escape'],10);
}
if(mode==='beats'){
 const readings=[];for(let i=0;i<24;i++){const s=await state();readings.push({audioTime:s.audioTime,beat:s.transportBeat,simBeat:s.simBeat,gameTime:s.gameplayTime,measure:s.measure,bpm:s.bpm,bullets:s.activeBullets,phase:s.phase,RMS:s.outputRMS,skipped:s.skippedAudioEvents,scheduled:s.scheduledEvents});await sleep(180);}result.readings=readings;result.maxBeatLag=Math.max(...readings.map(s=>Math.abs(s.beat-s.simBeat)));result.events=await evaluate('window.PulseVector.audioEvents().slice(-48)');
 await hold(['Escape'],10);
}
if(mode==='mobile'){
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});result.metrics=await evaluate('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvasWidth:document.getElementById("game").width})');
}
if(mode==='keydown'){await key('KeyD','keyDown');await sleep(180);result.state=await state();}
if(mode==='release'){await key('KeyD','keyUp');result.state=await state();}
if(mode==='mixer'){
 result.before=await state();for(const name of ['drums','bass','lead','pad']){const r=await evaluate('document.querySelector("[data-mute='+name+']").getBoundingClientRect().toJSON()');await mouse('mousePressed',r.left+r.width/2,r.top+r.height/2);await mouse('mouseReleased',r.left+r.width/2,r.top+r.height/2);}await sleep(1100);result.muted=await state();
 for(const name of ['drums','bass','lead','pad']){const r=await evaluate('document.querySelector("[data-mute='+name+']").getBoundingClientRect().toJSON()');await mouse('mousePressed',r.left+r.width/2,r.top+r.height/2);await mouse('mouseReleased',r.left+r.width/2,r.top+r.height/2);}await sleep(350);result.restored=await state();
 if(Object.values(result.muted.mix.tracks).some(g=>g>.001))throw new Error('Track gains did not mute');if(result.muted.outputRMS>.001)throw new Error('Output did not settle after muting');if(result.restored.outputRMS<.0001)throw new Error('Restored output is silent');
}
if(mode==='touch'){
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 result.before=await state();const rect=await evaluate('document.querySelector("#game").getBoundingClientRect().toJSON()');const from=screen({x:400,y:565},rect),to=screen({x:600,y:520},rect);await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x,y:from.y,radiusX:3,radiusY:3,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x,y:to.y,radiusX:3,radiusY:3,id:1}]});await sleep(500);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});result.after=await state();await sleep(200);result.released=await state();
 if(Math.abs(result.after.player.x-result.before.player.x)<20)throw new Error('Touch did not move player');
 const focus=await evaluate('document.getElementById("touchFocus").getBoundingClientRect().toJSON()');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:focus.left+focus.width/2,y:focus.top+focus.height/2,id:2}]});await sleep(130);result.focused=await state();const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.argv[4]||'/home/pyro/projects/naked/sol61/12-rhythm-bullet-hell/evidence/screenshots/18-mobile-focus.png',Buffer.from(shot.data,'base64'));await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(40);result.focusReleased=await state();
 const dash=await evaluate('document.getElementById("touchDash").getBoundingClientRect().toJSON()');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:dash.left+dash.width/2,y:dash.top+dash.height/2,id:3}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(40);result.dash=await state();if(!result.focused.focus||result.focusReleased.focus)throw new Error('Touch focus did not release');if(result.dash.player.cooldown<=0)throw new Error('Touch dash did not fire');

}
if(mode==='victory'){
 result.before=await state();const rect=await evaluate('document.querySelector("#game").getBoundingClientRect().toJSON()');let pos=screen({x:400,y:500},rect);await mouse('mouseMoved',pos.x,pos.y);await mouse('mousePressed',pos.x,pos.y);
 const phaseStates=[];let old=-1;for(let i=0;i<2700;i++){const s=await state();if(s.phase!==old){phaseStates.push(s);old=s.phase;}if(s.state==='victory'||s.state==='failure'){result.final=s;break;}pos=screen({x:400+285*Math.sin(s.simBeat*.25),y:500+22*Math.cos(s.simBeat*.21)},rect);await mouse('mouseMoved',pos.x,pos.y);if(s.player.cooldown<=0&&Math.abs(s.transportBeat-Math.round(s.transportBeat))<.045)await hold(['Space'],10);await sleep(16);}await mouse('mouseReleased',pos.x,pos.y);result.phases=phaseStates;if(!result.final)throw new Error('Encounter did not finish within 55 seconds');
}
if(mode==='calibration'){
 result.before=await state();const button=await evaluate('document.querySelector("#calibrate").getBoundingClientRect().toJSON()');const x=button.left+button.width/2,y=button.top+button.height/2;async function click(){await mouse('mousePressed',x,y);await mouse('mouseReleased',x,y);await sleep(30);}
 await click();for(let i=0;i<8;i++){await waitBeat();await click();}result.after=await state();const close=await evaluate('document.querySelector("[data-close=settingsDialog]").getBoundingClientRect().toJSON()');await mouse('mousePressed',close.left+close.width/2,close.top+close.height/2);await mouse('mouseReleased',close.left+close.width/2,close.top+close.height/2);await sleep(70);result.closed=await state();
 if(result.closed.pendingChanges.some(ch=>'offset' in ch.patch&&ch.beat>result.before.simBeat+.5))throw new Error('Calibration offset was queued on the advanced calibration clock instead of the frozen gameplay clock');
 if(Math.abs(result.closed.simBeat-result.before.simBeat)>.05)throw new Error('Calibration advanced the simulation');
}
if(mode==='range'){
 const id=process.argv[4],value=Number(process.argv[5]);const r=await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+');return {...e.getBoundingClientRect().toJSON(),min:Number(e.min),max:Number(e.max),value:e.value}})()');result.before=await state();const x=r.left+8+(r.width-16)*(value-r.min)/(r.max-r.min),y=r.top+r.height/2;await mouse('mouseMoved',x,y);await mouse('mousePressed',x,y);await mouse('mouseReleased',x,y);await sleep(50);result.value=await evaluate('document.getElementById('+JSON.stringify(id)+').value');result.after=await state();
}
if(mode==='grid'){
 for(let i=0;i<700;i++){const s=await state();if(s.changeCount===s.appliedChanges)break;await sleep(12);}result.before=await state();const targetBeat=result.before.simBeat+8;for(let i=0;i<700;i++){const s=await state();if(s.simBeat>=targetBeat){result.after=s;break;}await sleep(12);}if(!result.after)throw new Error('Grid observation timed out');if(result.after.emittedBullets!==result.before.emittedBullets)throw new Error('Cleared grid still emitted bullets');
}
if(mode==='remap'){
 result.before=await state();await hold(['KeyL'],300);result.right=await state();await hold(['KeyI','ShiftLeft'],300);result.focus=await state();await waitBeat();await hold(['KeyU'],20);result.pulse=await state();await hold(['Escape'],10);
 if(result.right.player.x-result.before.player.x<45)throw new Error('IJKL mapping did not move right');if(result.focus.player.y>=result.right.player.y-20)throw new Error('IJKL focus did not move up');if(result.pulse.feedback.kind==='miss')throw new Error('U pulse did not reach timing award');
}
if(mode==='patterns'){
 result.initial=await state();result.config=await evaluate('window.PulseVector.replay().config');result.patterns=[];
 for(const pattern of ['radial','aimed','spiral','wall','lanes','accelerate','orbit','chaos']){
  execFileSync('agent-browser',['--session',session,'select','#pattern',pattern],{stdio:'pipe'});
  const before=await state();let current;
  for(let i=0;i<450;i++){current=await state();if(current.appliedChanges===current.changeCount&&current.simBeat>before.simBeat+2&&current.emittedBullets>before.emittedBullets)break;await sleep(15);}
  if(current.emittedBullets<=before.emittedBullets)throw new Error('No emissions for '+pattern);
  result.patterns.push({pattern,state:current,bullets:await evaluate('window.PulseVector.bullets().slice(-6)'),changes:await evaluate('window.PulseVector.replay().changes.slice(-1)')});
 }
 await hold(['Escape'],10);result.final=await state();
}
if(mode==='guard'){
 await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});await send('Network.clearBrowserCache');
 await send('Network.setBlockedURLs',{urlPatterns:[{urlPattern:'http://127.0.0.1:4173/*',block:false},{urlPattern:'http://localhost:4173/*',block:false},{urlPattern:'http://*:*/*',block:true},{urlPattern:'https://*:*/*',block:true}]});
 const prior=ws.onmessage;let requests=[];
 ws.onmessage=e=>{const data=JSON.parse(e.data);if(data.method==='Network.requestWillBeSent')requests.push(data.params.request.url);prior(e);};
 console.log('Network.setBlockedURLs: external HTTP/HTTPS blocked, local 4173 allowed; cache disabled.');
 await sleep(Number(process.argv[4])||240000);console.log(JSON.stringify({requests}));
}

console.log(JSON.stringify(result,null,2));
}catch(e){result.error=e.message;console.log(JSON.stringify(result,null,2));process.exitCode=1;}finally{ws.close();}
