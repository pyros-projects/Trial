import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browserURL=execFileSync('agent-browser',['--session','echo','get','cdp-url'],{encoding:'utf8'}).trim();
const u=new URL(browserURL),pages=await(await fetch(`http://${u.host}/json/list`)).json();
const page=pages.find(p=>p.type==='page'&&p.url.includes('12-rhythm-bullet-hell'));
assert.ok(page,'Find the genuine application tab owned by agent-browser');
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let serial=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result)}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
const read=async(expression='EchoShift.inspect()')=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const keyData={KeyD:['d',68],KeyA:['a',65],KeyW:['w',87],KeyS:['s',83],ShiftLeft:['Shift',16],Space:[' ',32],Escape:['Escape',27]};
async function key(code,down,mods=0){const[k,v]=keyData[code];await send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:k,code,windowsVirtualKeyCode:v,nativeVirtualKeyCode:v,modifiers:mods})}
async function press(code){await key(code,true);await sleep(55);await key(code,false)}
async function hold(code,ms,focus=false){if(focus)await key('ShiftLeft',true,8);await key(code,true,focus?8:0);await sleep(ms);await key(code,false,focus?8:0);if(focus)await key('ShiftLeft',false)}
async function waitFor(fn,timeout=20000){const start=Date.now();while(Date.now()-start<timeout){const d=await read();if(fn(d))return d;await sleep(20)}throw Error('Timed out waiting for game behavior')}
async function clickName(name){const selector=await read(`(()=>{const n=${JSON.stringify(name)};const e=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===n||b.textContent.replace(/\\s+/g,' ').trim()===n);return e?.id?'#'+e.id:e?.dataset.track?'[data-track="'+e.dataset.track+'"]':null})()`);if(selector)execFileSync('agent-browser',['--session','echo','scrollintoview',selector],{stdio:'pipe'});execFileSync('agent-browser',['--session','echo','find','role','button','click','--name',name],{stdio:'pipe'});} 
async function target(x,y,ms=500){const r=await read('document.getElementById("game").getBoundingClientRect().toJSON()');const p=await read();const from={x:r.x+p.player.x/960*r.width,y:r.y+p.player.y/640*r.height},to={x:r.x+x/960*r.width,y:r.y+y/640*r.height};await send('Input.dispatchMouseEvent',{type:'mouseMoved',...from});await send('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseMoved',...to,button:'left',buttons:1});await sleep(ms);await send('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',clickCount:1});}
const evidence=[];const record=async(name)=>{const d=await read();evidence.push({name,...d});console.log(name,JSON.stringify({tick:d.tick,beat:d.transportBeat,hp:d.player.hp,x:d.player.x,y:d.player.y,damage:d.damage,score:d.score,combo:d.combo,perfect:d.perfect,good:d.good,missed:d.missed,phase:d.phase,audio:d.audioState,rms:d.signalRms,sync:d.syncErrorMs}));return d};
try{
 const task=process.argv[2]||'controls';
 if(task==='controls'){
  await clickName('Enable audio & play');await waitFor(d=>d.screen==='playing');const initial=await record('movement-before');await hold('KeyD',350);const normal=await record('normal-right');assert.ok(normal.player.x-initial.player.x>75);
  await hold('KeyA',350,true);const focus=await record('focus-left');assert.ok(normal.player.x-focus.player.x>20&&normal.player.x-focus.player.x<45);
  await key('KeyD',true);await key('KeyW',true);await sleep(240);await key('KeyD',false);await key('KeyW',false);await record('diagonal');
  await target(300,500,1000);const pointer=await record('pointer-drag');assert.ok(pointer.player.x<450);
  await sleep(200);const release=await read();assert.equal(pointer.player.x,release.player.x);assert.equal(pointer.player.y,release.player.y);
  await waitFor(d=>d.player.cooldown===0&&d.transportBeat%1<.045);await press('Space');await waitFor(d=>d.perfect>0);const pulse=await record('perfect-pulse');assert.ok(pulse.player.cooldown>0);
  await press('Escape');await waitFor(d=>d.audioState==='suspended');const paused=await record('paused');await sleep(700);const still=await read();assert.equal(paused.tick,still.tick);assert.equal(paused.checksum,still.checksum);assert.equal(paused.contextTime,still.contextTime);
  await clickName('Resume run');await waitFor(d=>d.transportBeat>paused.transportBeat+2);const resumed=await record('resumed');assert.ok(Math.abs(resumed.syncErrorMs)<40);assert.equal(resumed.lateEvents,0);
  await key('KeyD',true);await sleep(160);await send('Emulation.setFocusEmulationEnabled',{enabled:false});execFileSync('agent-browser',['--session','echo','tab','new','about:blank']);await sleep(200);const lost=await record('focus-loss');assert.equal(lost.screen,'paused');assert.deepEqual(lost.input.keys,[]);await key('KeyD',false);
 }else if(task==='damage'){
  if((await read()).screen==='paused')await clickName('Resume run');
  await target(500,150,1600);await waitFor(d=>d.damage>0);const hit=await record('intentional-collision');assert.ok(hit.player.invuln>0);const hp=hit.player.hp;await sleep(350);const shield=await record('invulnerability');assert.equal(shield.player.hp,hp);
  await waitFor(d=>d.screen==='failure',25000);const failure=await record('failure');assert.equal(failure.player.hp,0);
 }else if(task==='victory'){
  await clickName('Restart run');await waitFor(d=>d.screen==='playing');await target(18,58,3200);await record('survival-position');
  await waitFor(d=>d.phase===2,25000);await record('phase-two');
  await waitFor(d=>d.phase===3,25000);await record('phase-three');
  await waitFor(d=>['victory','failure'].includes(d.screen),25000);const result=await record('encounter-result');assert.equal(result.screen,'victory');
 }else if(task==='replay'){
  if(!(await read()).replaying)await clickName('Watch replay');await waitFor(d=>d.replaying&&d.tick>0);await record('replay-start');await waitFor(d=>d.tick>0&&['replay-end','victory','failure'].includes(d.screen),65000);const d=await record('replay-complete');assert.equal(d.checksum,d.replayExpected);
 }else if(task==='lab'){
  await clickName('Clear');execFileSync('agent-browser',['--session','echo','select','#pattern','spiral']);execFileSync('agent-browser',['--session','echo','select','#subdivision','4']);
  execFileSync('agent-browser',['--session','echo','fill','#seed','lab-check']);execFileSync('agent-browser',['--session','echo','press','Tab']);
  await clickName('Start practice');await waitFor(d=>d.transportBeat>=4);const empty=await record('all-steps-disabled');assert.equal(empty.emitted,0);
  await clickName('Emission step 1');await waitFor(d=>d.emitted>0);const one=await record('one-step-emission');assert.ok(one.settings.grid[0]);assert.equal(one.settings.grid.filter(Boolean).length,1);
  const before=one.emitted;await waitFor(d=>d.transportBeat>one.transportBeat+2);assert.equal((await read()).emitted,before);
  await clickName('All on');await waitFor(d=>d.emitted>before+40);await record('all-step-emissions');
  execFileSync('agent-browser',['--session','echo','focus','#tempo']);execFileSync('agent-browser',['--session','echo','press','End']);await waitFor(d=>d.bpm===180);await record('live-tempo-180');
  execFileSync('agent-browser',['--session','echo','focus','#density']);execFileSync('agent-browser',['--session','echo','press','ArrowRight']);execFileSync('agent-browser',['--session','echo','focus','#speed']);execFileSync('agent-browser',['--session','echo','press','ArrowRight']);
  execFileSync('agent-browser',['--session','echo','select','#music','drift']);
  for(const name of ['Mute drums','Mute bass','Mute melody','Mute atmosphere'])await clickName(name);await waitFor(d=>d.signalRms<.001);const mute=await record('all-tracks-muted');assert.equal(mute.audioState,'running');
  for(const name of ['Unmute drums','Unmute bass','Unmute melody','Unmute atmosphere'])await clickName(name);await waitFor(d=>d.signalRms>.01);await record('tracks-restored');
  execFileSync('agent-browser',['--session','echo','focus','#master']);execFileSync('agent-browser',['--session','echo','press','Home']);await waitFor(d=>d.signalRms<.001);await record('master-zero');execFileSync('agent-browser',['--session','echo','press','End']);await waitFor(d=>d.signalRms>.01);
  await clickName('Pause game');await waitFor(d=>d.screen==='paused');await clickName('Finish practice');const end=await record('practice-ended');assert.ok(end.settings.density>1&&end.settings.speed>1);assert.equal(end.settings.bpm,180);assert.ok(end.damage>=0);
  const log=await read('EchoShift.exportLog()');writeFileSync('evidence/lab-replay-live-edits.json',JSON.stringify(log));assert.ok(log.changes.length>8);
  await clickName('Watch replay');await waitFor(d=>d.replaying&&d.tick>0&&d.screen==='countdown');await waitFor(d=>d.tick>0&&d.screen==='replay-end',30000);const replay=await record('lab-replay-verified');assert.equal(replay.checksum,replay.replayExpected);
 }else if(task==='mobile'){
  await clickName('Start practice');await waitFor(d=>d.transportBeat>=3);const before=await record('narrow-before');await clickName('◎ FOCUS');await waitFor(d=>d.player.focus);
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});const r=await read('document.getElementById("game").getBoundingClientRect().toJSON()');
  const touch=(x,y)=>[{id:1,x:r.x+x/960*r.width,y:r.y+y/640*r.height,radiusX:6,radiusY:6,force:1}];
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touch(480,540)});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touch(650,460)});await sleep(750);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const drag=await record('narrow-touch-focused');assert.ok(drag.player.x>before.player.x+45&&drag.player.focus);
  await sleep(200);const released=await read();assert.equal(released.player.x,drag.player.x);assert.equal(released.input.pointer,false);
  await clickName('Pulse dash ready');await waitFor(d=>d.player.cooldown>0);const dash=await record('narrow-pulse');assert.ok(dash.settings.reducedFlash&&dash.settings.reducedMotion&&dash.settings.contrast);assert.equal(dash.settings.quality,'low');
  execFileSync('agent-browser',['--session','echo','screenshot','evidence/screenshots/15-narrow-active.png']);await clickName('Pause game');await waitFor(d=>d.audioState==='suspended');const paused=await record('narrow-paused');await sleep(400);assert.equal((await read()).tick,paused.tick);await clickName('Resume run');await waitFor(d=>d.transportBeat>paused.transportBeat+.5);await record('narrow-resumed');await clickName('Pause game');
 }else if(task==='regression'){
  if((await read()).settings.drums===0)await clickName('Unmute drums');
  execFileSync('agent-browser',['--session','echo','select','#subdivision','4']);await clickName('All on');execFileSync('agent-browser',['--session','echo','focus','#tempo']);execFileSync('agent-browser',['--session','echo','press','End']);await clickName('Enable audio & play');await waitFor(d=>d.screen==='playing');const initial=await record('fixed-lab-sixteenths');assert.equal(initial.settings.subdivision,4);
  await waitFor(d=>d.transportBeat>3);const before=await record('before-real-stall');await read('(()=>{const end=performance.now()+1100;while(performance.now()<end){}return true})()');await waitFor(d=>d.screen==='paused'&&d.audioState==='suspended');const stall=await record('aligned-after-stall');assert.ok(Math.abs(stall.syncErrorMs)<1);assert.ok(stall.tick-before.tick<15);
  await clickName('Resume run');await waitFor(d=>d.screen==='playing'&&d.transportBeat>stall.transportBeat+1);const resume=await record('stall-resume-success');assert.ok(Math.abs(resume.syncErrorMs)<40);
  const samples=[];for(let i=0;i<20;i++){samples.push(await read('(()=>{const d=EchoShift.inspect();return {beat:d.transportBeat,offset:d.settings.offset,bpm:d.bpm,lit:[...document.getElementById("beatGrid").children].findIndex(e=>e.classList.contains("lit"))}})()'));await sleep(31)}
  for(const d of samples){const expected=((Math.floor((d.beat-d.offset/1000*d.bpm/60)*4)%16)+16)%16;assert.equal(d.lit,expected)}evidence.push({name:'per-frame-beat-samples',samples});
  await read('window.testPad={axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0})),connected:true,index:0,id:"Validation virtual controller"};Object.defineProperty(navigator,"getGamepads",{configurable:true,value:()=>[window.testPad]});true');
  await read('testPad.buttons[9].pressed=true');await waitFor(d=>d.screen==='paused');await sleep(200);assert.equal((await read()).screen,'paused');await read('testPad.buttons[9].pressed=false');await sleep(50);await read('testPad.buttons[9].pressed=true');await waitFor(d=>d.screen==='playing');await read('testPad.buttons[9].pressed=false');await record('virtual-controller-resumed');
  await clickName('Mute drums');await press('Space');const keyboard=await record('keyboard-track-activation');assert.ok(keyboard.settings.drums>0,'Space on focused track button should activate the track control');
  await clickName('Pause game');await waitFor(d=>d.screen==='paused');await clickName('Finish practice');const end=await record('final-lab-ended');const log=await read('EchoShift.exportLog()');writeFileSync('evidence/final-replay.json',JSON.stringify(log));
  await clickName('Watch replay');await waitFor(d=>d.replaying&&d.tick>0);await read('testPad.buttons[9].pressed=true');await waitFor(d=>d.screen==='paused');await record('virtual-controller-paused-replay');await read('testPad.buttons[9].pressed=false');await sleep(60);await read('testPad.buttons[9].pressed=true');await waitFor(d=>d.screen==='playing'||d.screen==='countdown');await read('testPad.buttons[9].pressed=false');await waitFor(d=>d.screen==='replay-end',30000);const result=await record('final-replay-verified');assert.equal(result.checksum,result.replayExpected);
 }else if(task==='hidpi'){
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:2,mobile:false});execFileSync('agent-browser',['--session','echo','scroll','up','2500']);await clickName('Settings');execFileSync('agent-browser',['--session','echo','select','#quality','high']);await clickName('Close dialog');await sleep(100);
  const dimensions=await read('(()=>{const c=document.getElementById("game"),r=c.getBoundingClientRect();return {dpr:devicePixelRatio,canvasWidth:c.width,canvasHeight:c.height,cssWidth:r.width,cssHeight:r.height,viewport:[innerWidth,innerHeight],pageWidth:document.documentElement.scrollWidth}})()');assert.equal(dimensions.canvasWidth,Math.round(dimensions.cssWidth*2));assert.equal(dimensions.canvasHeight,Math.round(dimensions.cssHeight*2));assert.equal(dimensions.pageWidth,1280);evidence.push({name:'high-dpi-backing-store',...dimensions});
  await clickName('Toggle fullscreen');await sleep(150);assert.ok(await read('!!document.fullscreenElement'));await clickName('Toggle fullscreen');assert.equal(await read('!!document.fullscreenElement'),false);
  await clickName('Restart run');await waitFor(d=>d.screen==='playing'&&d.transportBeat>8);await key('ShiftLeft',true,8);await sleep(100);await record('desktop-live-diagnostics');execFileSync('agent-browser',['--session','echo','find','role','button','click','--name','DIAGNOSTICS ↗']);execFileSync('agent-browser',['--session','echo','screenshot','evidence/screenshots/21-desktop-live-diagnostics.png']);await key('ShiftLeft',false);await clickName('Pause game');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await sleep(120);execFileSync('agent-browser',['--session','echo','scroll','up','2500']);execFileSync('agent-browser',['--session','echo','find','role','button','click','--name','DIAGNOSTICS ↗']);execFileSync('agent-browser',['--session','echo','screenshot','evidence/screenshots/22-narrow-final.png']);const n=await read('({width:innerWidth,pageWidth:document.documentElement.scrollWidth,footer:document.querySelector(".bottom-status").getBoundingClientRect().toJSON(),controls:document.querySelector(".mobile-controls").getBoundingClientRect().toJSON()})');assert.equal(n.width,390);assert.equal(n.pageWidth,390);assert.ok(n.footer.bottom<=844&&n.controls.bottom<n.footer.top);evidence.push({name:'narrow-final-overlay-and-controls',...n});
 }else if(task==='snapshot')await record('snapshot');
 writeFileSync(`evidence/logs/browser-${task}.json`,JSON.stringify(evidence,null,2));
}catch(e){writeFileSync(`evidence/logs/browser-${process.argv[2]||'controls'}-failure.json`,JSON.stringify({error:e.stack,evidence},null,2));throw e}finally{socket.close()}
