const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),assert=require('node:assert/strict');
const session='aeris-qa';
function ab(...args){return execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:35000}).trim();}
function state(){return JSON.parse(ab('eval','aeris.snapshot()'));}
function waitSim(seconds){const t=state().simTime+seconds;ab('wait','--fn',`aeris.snapshot().simTime >= ${t}`);}
function hold(key,seconds){ab('keydown',key);waitSim(seconds);const active=state();ab('keyup',key);return active;}
function shot(name){ab('screenshot',`evidence/${name}.png`);}
function brief(s){return {phase:s.phase,settings:s.settings,position:s.position,velocity:s.velocity,orientation:s.orientation,angularVelocity:s.angularVelocity,input:s.input,collision:s.collision,penalty:s.penalty,time:s.lapTime,events:s.events,telemetry:s.telemetry};}
const result={};
ab('click','[data-panel="course"]');ab('click','[data-session="free"]');
for(const [name,key,axis] of [['pitch','w',0],['roll','d',2],['yaw','e',1],['throttle',' ',null]]){
 ab('click','#resetButton');ab('click','#recoverButton');ab('click','#startButton');
 const active=hold(key,.32);waitSim(.75);ab('press','p');const released=state();
 result[name]={active:brief(active),released:brief(released)};
 if(axis!==null)assert(Math.abs(active.angularVelocity[axis])>.05,`${name} angular response`);
 else assert(active.velocity[1]>1,'throttle produces climb');
 if(name==='pitch')assert(active.velocity[2]<-.1,'pitch thrust forward');
 if(name==='roll')assert(active.velocity[0]>.1,'roll thrust sideways');
 if(name==='yaw')assert(Math.abs(active.position[0])<.1&&Math.abs(active.position[2]+13)<.1,'yaw without translating directly');
}
ab('click','[data-panel="drone"]');
for(const mode of ['angle','horizon','acro']){
 ab('select','#flightMode',mode);ab('focus','#antiCrash');ab('press','Home');ab('click','#resetButton');ab('click','#recoverButton');ab('click','#startButton');
 const active=hold('w',.32);waitSim(.7);ab('press','p');const released=state();result[mode+'Mode']={active:brief(active),released:brief(released)};shot(mode+'-mode');
}
assert(Math.abs(result.angleMode.released.orientation[0])<.08,'angle levels after release');
assert(Math.abs(result.acroMode.released.orientation[0])>.25,'acro retains pitch after release');
assert(Math.abs(result.horizonMode.released.orientation[0])<Math.abs(result.acroMode.released.orientation[0]),'horizon levels at center');
fs.writeFileSync('evidence/independent-controls-and-modes.json',JSON.stringify(result,null,2));
console.log('PASS independent throttle, yaw, pitch, roll; angle/horizon/acro response.');
// Collision uses actual throttle and the public recovery button in time trial.
ab('click','[data-panel="course"]');ab('click','[data-session="trial"]');ab('click','#startButton');ab('click','#recoverButton');ab('click','#scene');ab('keydown','Shift');ab('wait','--fn','aeris.snapshot().collision.count > 0');ab('keyup','Shift');ab('press','p');const impact=state();assert(impact.collision.count>0);assert(impact.penalty>=5);shot('ground-collision');result.groundCollision=brief(impact);
ab('click','#recoverButton');const recovered=state();assert(recovered.velocity.every(v=>v===0));assert(recovered.position[1]===4);result.recovered=brief(recovered);shot('collision-recovery');
fs.writeFileSync('evidence/independent-controls-and-modes.json',JSON.stringify(result,null,2));
ab('click','#resetTuning');
console.log('PASS actual ground collision, +2s collision penalty, +3s recovery and cleared velocity.');
