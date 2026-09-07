const assert=require('node:assert/strict');const {command,evaluate,diag}=require('./browser-lib.cjs');
command('reload');command('wait','--fn','document.readyState==="complete" && typeof phase==="object"');
evaluate(`window.__NativeAC=window.AudioContext;window.AudioContext=class extends __NativeAC {constructor(options){super({...options,sinkId:{type:'none'}});this.suspend()}async resume(){await super.resume();await new Promise(r=>setTimeout(r,500))}}`);
command('click','#play');command('click','#stop');
const d=evaluate('(async()=>{await new Promise(r=>setTimeout(r,700));return phase.diagnostics()})()');
assert.equal(d.playing,false,'Stop must cancel a play request that is waiting for AudioContext.resume');assert.equal(d.currentStep,-1);console.log('PASS: Stop cancels pending asynchronous playback');
