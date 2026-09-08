const {execFileSync}=require('node:child_process');const fs=require('node:fs'),assert=require('node:assert/strict');
function ab(...a){return execFileSync('agent-browser',['--session','aeris-qa',...a],{encoding:'utf8',timeout:35000}).trim();}
const state=()=>JSON.parse(ab('eval','aeris.snapshot()'));
function wait(fn){ab('wait','--fn',fn);}
function stepHold(k,seconds){const t=state().simTime;ab('keydown',k);wait(`aeris.snapshot().simTime>${t+seconds}`);ab('keyup',k);}
const results={};
ab('reload');ab('click','#startButton');ab('click','#recoverButton');ab('click','#scene');
ab('keydown',' ');wait('aeris.snapshot().position[1]>11');ab('keyup',' ');
ab('keydown','w');wait('aeris.snapshot().position[2]<-27');ab('keyup','w');ab('press','p');results.miss=state();assert.equal(results.miss.gateIndex,0);assert(results.miss.events.some(e=>e.type==='missed-gate'));ab('screenshot','evidence/missed-gate.png');
// Descend while momentum carries the craft past the first gate, then approach gate 2.
ab('click','#startButton');ab('keydown','Shift');wait('aeris.snapshot().position[1]<5');ab('keyup','Shift');ab('keydown','w');wait('aeris.snapshot().events.some(e=>e.type==="out-of-order")');ab('keyup','w');ab('press','p');results.order=state();assert.equal(results.order.gateIndex,0);ab('screenshot','evidence/out-of-order.png');
fs.writeFileSync('evidence/checkpoint-order.json',JSON.stringify(results,null,2));console.log('PASS missed gate and out-of-order gate do not advance target.');
// Real pointer input against mobile sticks.
ab('click','#resetButton');ab('set','viewport','390','844');ab('click','#startButton');
ab('mouse','move','79','495');ab('mouse','down','left');ab('mouse','move','79','475');wait('aeris.snapshot().position[1]>1.6');results.mobileThrottle=state();ab('mouse','up','left');
ab('mouse','move','310','495');ab('mouse','down','left');ab('mouse','move','310','473');const t=state().simTime;wait(`aeris.snapshot().simTime>${t+.5}`);results.mobilePitch=state();ab('mouse','up','left');ab('press','p');
assert(results.mobileThrottle.input.throttle>.1);assert(results.mobilePitch.input.pitch>.1);assert(results.mobilePitch.velocity[2]<-.1);ab('screenshot','evidence/mobile-flight.png');
// Held keyboard input survives viewport and DPR changes.
ab('click','#startButton');ab('keydown','w');ab('set','viewport','1280','800','2');const t2=state().simTime;wait(`aeris.snapshot().simTime>${t2+.5}`);results.resizedHeld=state();assert.equal(results.resizedHeld.input.pitch,1);ab('keyup','w');ab('press','p');results.resizedReleased=state();assert.equal(results.resizedReleased.input.pitch,0);assert(results.resizedHeld.renderSize[0]>914);ab('screenshot','evidence/desktop-retina.png');
ab('set','viewport','390','844','1');results.narrowDimensions=JSON.parse(ab('eval','({inner:innerWidth,scroll:document.documentElement.scrollWidth,canvas:[document.getElementById("scene").width,document.getElementById("scene").height]})'));assert.equal(results.narrowDimensions.inner,results.narrowDimensions.scroll);ab('screenshot','evidence/mobile-after-resize.png');
fs.writeFileSync('evidence/checkpoint-order-and-mobile.json',JSON.stringify(results,null,2));console.log('PASS touch sticks, resize input continuity, high DPI and no narrow horizontal overflow.');
