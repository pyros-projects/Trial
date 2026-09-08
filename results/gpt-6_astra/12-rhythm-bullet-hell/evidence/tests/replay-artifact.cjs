const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),scripts=[...html.matchAll(/<script id="([^"]+)">([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,3);for(const [,id,source]of scripts)new vm.Script(source,{filename:id});
assert.ok(!/<(?:script|img|link|iframe)[^>]+(?:src|href)=["'](?:https?:|\/\/)/i.test(html),'No external runtime asset references');
for(const [id,file]of [['audio-engine','evidence/audio.js'],['application','evidence/app.js']])assert.equal(scripts.find(s=>s[1]===id)[2].trim(),fs.readFileSync(file,'utf8').trim());
const context={};vm.createContext(context);vm.runInContext(scripts.find(s=>s[1]==='sim-core')[2],context);
for(const path of ['evidence/encounter-replay.json','evidence/final-replay.json']){
 const log=context.EchoCore.validateReplay(JSON.parse(fs.readFileSync(path,'utf8'))),sim=new context.EchoCore.Sim(log.config);let ai=0,ci=0,input={};
 while(sim.tick<log.ticks){while(ci<log.changes.length&&log.changes[ci][0]<=sim.tick)sim.applySettings(log.changes[ci++][1]);while(ai<log.actions.length&&log.actions[ai][0]<=sim.tick){const a=log.actions[ai++];input={dx:a[1],dy:a[2],focus:!!a[3],dash:!!a[4],tx:a[5]??null,ty:a[6]??null}}const t=sim.tick;sim.step(input);assert.ok(sim.tick>t,'Replay must progress to recorded endpoint');}
 assert.equal(sim.checksum(),log.checksum);console.log('PASS final artifact reproduces recorded browser run',path,sim.tick,sim.checksum());
}
console.log('PASS all embedded scripts parse; modules embedded; no external asset references');
