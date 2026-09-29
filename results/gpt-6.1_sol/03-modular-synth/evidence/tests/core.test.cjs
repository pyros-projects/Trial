const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const htmlPath = path.join(__dirname,'../../index.html');
const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath,'utf8') : '';
const match = html.match(/\/\/ CORE-BEGIN([\s\S]*?)\/\/ CORE-END/);
const context = vm.createContext({ArrayBuffer, DataView, Float32Array, Math, JSON});
vm.runInContext((match?.[1] || '') + ';globalThis.core={stepDuration:typeof stepDuration==="function"?stepDuration:null,seeded:typeof seeded==="function"?seeded:null,makeProject:typeof makeProject==="function"?makeProject:null,normalizeProject:typeof normalizeProject==="function"?normalizeProject:null,eventsForStep:typeof eventsForStep==="function"?eventsForStep:null,renderPlan:typeof renderPlan==="function"?renderPlan:null,encodeWav:typeof encodeWav==="function"?encodeWav:null}',context);
const c=context.core;
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name)}catch(e){failures++;console.error('FAIL',name,e.message)}}
test('swing preserves quarter-note time and delays the offbeat',()=>{assert.equal(typeof c.stepDuration,'function');assert.equal(c.stepDuration(120,0,0),.125);assert.equal(c.stepDuration(120,40,0),.175);assert.equal(c.stepDuration(120,40,1),.075);assert.equal(c.stepDuration(120,40,0)+c.stepDuration(120,40,1),.25)});
test('same random seed reproduces a sequence, another seed changes it',()=>{assert.equal(typeof c.seeded,'function');const a=c.seeded(42),b=c.seeded(42),d=c.seeded(43);const x=Array.from({length:20},()=>a());assert.deepEqual(x,Array.from({length:20},()=>b()));assert.notDeepEqual(x,Array.from({length:20},()=>d()));assert.ok(x.every(v=>v>=0&&v<1))});
test('project normalization rejects invalid version and missing tracks, clamps unsafe values',()=>{assert.equal(typeof c.makeProject,'function');const p=c.makeProject();assert.equal(p.tracks.length,4);assert.throws(()=>c.normalizeProject({version:999,tracks:[]}));assert.throws(()=>c.normalizeProject({version:1,tracks:[]}));p.tempo=999;p.swing=-1;p.length=0;p.tracks[0].synth.cutoff=-5;p.tracks[0].steps[0]=[{pitch:999,velocity:7,gate:-1}];const n=c.normalizeProject(p);assert.equal(n.tempo,240);assert.equal(n.swing,0);assert.equal(n.length,8);assert.equal(n.tracks[0].synth.cutoff,60);assert.equal(n.tracks[0].steps[0][0].pitch,96);assert.equal(n.tracks[0].steps[0][0].velocity,1);assert.equal(n.tracks[0].steps[0][0].gate,.1)});
test('note events preserve chords and omit muted or non-solo tracks',()=>{assert.equal(typeof c.makeProject,'function');const p=c.makeProject();p.tracks.forEach(t=>{t.steps=Array.from({length:32},()=>[]);t.mute=false;t.solo=false});p.tracks[0].steps[0]=[{pitch:48,velocity:.5,gate:.8},{pitch:55,velocity:.7,gate:1}];let e=c.eventsForStep(p,0);assert.equal(e.length,2);assert.equal(e[0].pitch,48);p.tracks[0].mute=true;assert.equal(c.eventsForStep(p,0).length,0);p.tracks[0].mute=false;p.tracks[1].solo=true;assert.equal(c.eventsForStep(p,0).length,0)});
test('WAV contains stereo interleaved bounded PCM and accurate header',()=>{assert.equal(typeof c.encodeWav,'function');const buf=c.encodeWav([new Float32Array([0,1,-1]),new Float32Array([.5,2,-2])],44100);const v=new DataView(buf);assert.equal(buf.byteLength,56);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint32(40,true),12);assert.equal(v.getInt16(46,true),16384);assert.equal(v.getInt16(48,true),32767);assert.equal(v.getInt16(50,true),32767);assert.equal(v.getInt16(52,true),-32768)});

test('prototype names cannot bypass scale validation',()=>{const p=c.makeProject();p.scale='toString';const n=c.normalizeProject(p);assert.equal(n.scale,'minor');assert.ok(Array.isArray(n.tracks[0].steps[0]));});



test('offline plan preserves the final note release and high-feedback delay decay',()=>{assert.equal(typeof c.renderPlan,'function');const p=c.makeProject();p.tempo=40;p.swing=0;p.length=8;p.fx.delay=0;p.fx.reverb=0;p.tracks.forEach(t=>t.steps=Array.from({length:32},()=>[]));p.tracks[1].synth.release=3;p.tracks[1].steps[7]=[{pitch:60,velocity:.8,gate:8}];const dry=c.renderPlan(p,1);assert.ok(dry.lastVoiceEnd>=8.65);assert.ok(dry.total>8.65);p.fx.delay=.8;p.fx.feedback=.75;p.tracks[1].delay=1;const wet=c.renderPlan(p,1);assert.ok(wet.total>dry.total+30);});
process.exitCode=failures?1:0;
