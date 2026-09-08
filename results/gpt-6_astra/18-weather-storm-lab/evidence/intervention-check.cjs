const assert=require('assert'),fs=require('fs'),{Atmosphere}=require('./model.js');
const a=Atmosphere.fromState(JSON.parse(fs.readFileSync('evidence/control-state.json'))),b=Atmosphere.fromState(JSON.parse(fs.readFileSync('evidence/intervened-state.json')));
const diff=k=>a[k].reduce((s,v,i)=>s+Math.abs(v-b[k][i]),0),mean=(s,k)=>s[k].reduce((a,b)=>a+b,0)/s[k].length;
const before={time:a.time,heatL1:diff('t'),vaporL1:diff('q'),windL1:diff('u'),cloudL1:diff('c'),rainL1:diff('r')};assert(a.time===b.time&&before.heatL1>0&&before.vaporL1>0&&before.windL1>0);assert(before.cloudL1===0&&before.rainL1===0,'cloud/rain were not directly painted by these tools');
for(let i=0;i<60;i++){a.step();b.step();}
const after={time:a.time,cloudL1:diff('c'),rainL1:diff('r'),controlCloud:mean(a,'c'),treatedCloud:mean(b,'c'),controlRain:mean(a,'r'),treatedRain:mean(b,'r'),controlPrecip:a.precipTotal,treatedPrecip:b.precipTotal};assert(after.cloudL1>0.0001&&after.rainL1>0.0001);assert(after.treatedCloud>after.controlCloud&&after.treatedRain>after.controlRain,'moist heated input should form extra condensate after transport/cooling');
console.log(JSON.stringify({status:'pass',source:'actual browser-downloaded states, before and after continuous heat/moisture/wind pointer strokes',before,after},null,2));
