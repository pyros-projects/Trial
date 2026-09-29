const fs=require('fs');
const src=fs.readFileSync('core.js','utf8');
const mod={};
new Function('mod', src+'\nObject.assign(mod,{generateMission,createSim,simStep,simHash,DIFFS,PRESETS,SIZES,G_STATES,computeScore,RNG});')(mod);
const {generateMission,createSim,simStep,simHash,DIFFS,PRESETS,SIZES}=mod;
function build(P){const m=generateMission(P); m.seedKey=`${P.seed}|${P.size}|${P.diff}|${m.attempt}`; return m;}
let fails=0, attempts=[], t0=Date.now();
// 1. presets x diffs
for(const p of PRESETS) for(const d of Object.keys(DIFFS)){
  const P={seed:p.seed,size:p.size,guards:p.guards,cams:p.cams,diff:d,bias:p.bias};
  const m=build(P); attempts.push(m.attempt);
  console.log(p.id.padEnd(13),d.padEnd(12),'attempt',m.attempt,'rooms',m.regions.filter(r=>r.kind==='room').length,'doors',m.doors.length,'guards',m.guards.length,'cams',m.cameras.length,'loot',m.loot.length,'ok',m.validation.ok);
}
// 2. random seeds
for(const size of Object.keys(SIZES)) for(let i=0;i<150;i++){
  const P={seed:'RND-'+i,size,guards:size==='compact'?2:size==='standard'?4:6,cams:size==='compact'?1:3,diff:['rookie','operative','professional'][i%3]};
  try{const m=build(P); attempts.push(m.attempt);}catch(e){fails++; console.log('FAIL',size,i,e.message);}
}
console.log('random gen fails',fails,'max attempt',Math.max(...attempts),'mean',(attempts.reduce((a,b)=>a+b,0)/attempts.length).toFixed(2),'time',Date.now()-t0,'ms');
// 3. determinism of generation
const a=build({seed:'DET-1',size:'standard',guards:4,cams:3,diff:'operative'}), b=build({seed:'DET-1',size:'standard',guards:4,cams:3,diff:'operative'});
console.log('gen deterministic', Buffer.from(a.tiles).equals(Buffer.from(b.tiles)) && JSON.stringify(a.guards)===JSON.stringify(b.guards));
// 4. sims: attract + random walker
let errs=0; const stateHits={};
for(let k=0;k<30;k++){
  const size=['compact','standard','large'][k%3];
  const P={seed:'SIM-'+k,size,guards:size==='compact'?2:size==='standard'?4:6,cams:3,diff:['rookie','operative','professional'][k%3]};
  const m=build(P); const s=createSim(m,P.diff);
  const r=new mod.RNG('bot'+k); let mx=0,my=0,run=false,sneak=false;
  try{
    for(let t=0;t<60*120 && !s.outcome;t++){
      if(t%45===0){mx=r.int(-1,1);my=r.int(-1,1);run=r.chance(0.3);sneak=!run&&r.chance(0.3);}
      const ev=[];
      if(t%400===200) ev.push(['use',s.player.x+r.range(-6,6),s.player.y+r.range(-6,6)]);
      if(t%400===0) ev.push(['sel',r.int(0,2)]);
      if(t%700===350) ev.push(['go',r.range(1,m.W-1),r.range(1,m.H-1),r.chance(0.5)?1:0]);
      simStep(s,{mx,my,run,sneak,act:r.chance(0.3),ev});
      for(const g of s.guards){stateHits[g.state]=(stateHits[g.state]||0)+1; if(!isFinite(g.x)||!isFinite(g.y)) throw new Error('NaN guard');}
      if(!isFinite(s.player.x)) throw new Error('NaN player');
    }
  }catch(e){errs++;console.log('SIM ERR',k,e.stack.split('\n').slice(0,4).join(' | '));}
  if(k<6) console.log('sim',k,size,'ticks',s.tick,'outcome',s.outcome&&s.outcome.type,s.outcome&&s.outcome.reason||'','det',s.stats.detections,'alarms',s.stats.alarms,'noises',s.stats.noises);
}
console.log('sim errors',errs,'state tick-hits',JSON.stringify(stateHits));
// 5. replay determinism: run once recording inputs, rerun and compare hash
function runRec(seed){const P={seed,size:'standard',guards:4,cams:3,diff:'operative'};const m=build(P);const s=createSim(m,P.diff);const r=new mod.RNG('rp'+seed);const cmds=[];let mx=0,my=0;
 for(let t=0;t<60*60&&!s.outcome;t++){if(t%50===0){mx=r.int(-1,1);my=r.int(-1,1);} const ev=t%300===150?[['use',Math.round((s.player.x+2)*100)/100,Math.round(s.player.y*100)/100]]:[]; const c={mx,my,run:t%200<60,sneak:false,act:t%90<20,ev}; cmds.push(c); simStep(s,c);} return {h:simHash(s),cmds,P};}
const r1=runRec('RP-1'); const m2=build(r1.P); const s2=createSim(m2,'operative'); for(const c of r1.cmds) simStep(s2,c);
console.log('replay hash match', r1.h===simHash(s2), r1.h);
