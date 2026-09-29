const fs=require('fs');
const src=fs.readFileSync('core.js','utf8');
const mod={}; new Function('mod', src+'\nObject.assign(mod,{generateMission,createSim,simStep,simHash,DIFFS,PRESETS,SIZES,computeScore,RNG,castLOS});')(mod);
const {generateMission,createSim,simStep,PRESETS,DIFFS}=mod;
function build(P){const m=generateMission(P); m.seedKey=`${P.seed}|${P.size}|${P.diff}|${m.attempt}`; return m;}
// (a) completion with perception disabled (test-only: detect=0, hearing=0, cams off)
function complete(P){
  const m=build(P), s=createSim(m,P.diff); s.D=Object.assign({},s.D,{detect:0,hear:0,camRate:0});
  const vd=s.doors[m.vaultDoor]; let lastGo=-999, prevAct=false;
  const goal=()=>{const Pl=s.player;
    if(!Pl.hasKey) return {x:s.keycard.x,y:s.keycard.y,act:'tap',r:0.7};
    if(vd.open<0.9 && !Pl.hasObj){const ap=[[vd.x-1,vd.y],[vd.x+1,vd.y],[vd.x,vd.y-1],[vd.x,vd.y+1]].map(([x,y])=>({x:x+.5,y:y+.5})).filter(p=>{const i=Math.floor(p.y)*s.W+Math.floor(p.x);return s.tiles[i]!==0&&s.region[i]!==m.vaultRoom;});return {x:ap[0].x,y:ap[0].y,act:'tap',r:0.35};}
    if(!Pl.hasObj) return {x:s.objective.x,y:s.objective.y,act:'hold',r:1.3};
    return {x:m.extraction.cx,y:m.extraction.cy,act:null,r:0.2};};
  for(let t=0;t<60*600&&!s.outcome;t++){const g=goal(),Pl=s.player,d=Math.hypot(g.x-Pl.x,g.y-Pl.y),ev=[];let act=false;
    const lockF=s.focus&&s.focus.kind==='door'&&s.focus.obj.lock==='locked'&&s.focus.obj.target===0; if(lockF&&!Pl.autoPath){act=true;} else if(d>g.r){if(!Pl.autoPath&&t-lastGo>20){ev.push(['go',g.x,g.y,1]);lastGo=t;}} else if(g.act==='tap') act=(t%40===0); else if(g.act==='hold') act=true;
    prevAct=act; simStep(s,{mx:0,my:0,run:false,sneak:false,act,ev});}
  return s.outcome?s.outcome.type+' in '+s.time.toFixed(1)+'s':'TIMEOUT at '+JSON.stringify({x:s.player.x.toFixed(1),y:s.player.y.toFixed(1),key:s.player.hasKey,obj:s.player.hasObj});
}
for(const p of PRESETS) console.log('complete',p.id.padEnd(13),complete({seed:p.seed,size:p.size,guards:p.guards,cams:p.cams,diff:'operative',bias:p.bias}));
let ok=0; for(let i=0;i<60;i++){const size=['compact','standard','large'][i%3]; const r=complete({seed:'C-'+i,size,guards:3,cams:2,diff:'operative'}); if(r.startsWith('win')) ok++; else console.log('NOT COMPLETED',size,i,r);} console.log('random completions',ok,'/60');
// (b) chase -> lose sight -> search -> return
const p=PRESETS[1]; const P={seed:p.seed,size:p.size,guards:p.guards,cams:p.cams,diff:'operative',bias:p.bias};
const m=build(P), s=createSim(m,'operative'); const g=s.guards.find(x=>!x.post);
for(let t=0;t<60*8;t++) simStep(s,{mx:0,my:0,run:false,sneak:false,act:false,ev:[]});
// put player 3 tiles in front of guard in open floor
let placed=false; for(let d=3;d>=1.5&&!placed;d-=0.5){const x=g.x+Math.cos(g.facing)*d,y=g.y+Math.sin(g.facing)*d;const t=s.tiles[Math.floor(y)*s.W+Math.floor(x)];if(t===1||t===5){s.player.x=x;s.player.y=y;placed=true;}}
console.log('placed',placed,'guard',g.name,g.state);
const log=[]; let prev=g.state; const rec=()=>{ if(g.state!==prev){log.push(prev+'->'+g.state+'@'+s.time.toFixed(1));prev=g.state;} };
for(let t=0;t<60*3&&g.state!=='CHASE';t++){simStep(s,{mx:0,my:0,run:false,sneak:false,act:false,ev:[]});rec();}
// escape: teleport player to a far away floor tile out of LOS (simulates breaking line of sight)
let best=null,bd=0; for(let i=0;i<s.W*s.H;i++){if(s.tiles[i]!==1)continue;const x=i%s.W+.5,y=(i/s.W|0)+.5;const d=Math.hypot(x-g.x,y-g.y);if(d>bd&&mod.castLOS(s,g.x,g.y,x,y,false).blocked){bd=d;best={x,y};}}
const lkpBefore=g.lkp&&{x:g.lkp.x.toFixed(1),y:g.lkp.y.toFixed(1)}; s.player.x=m.entry.x;s.player.y=m.entry.y;
for(let t=0;t<60*60;t++){simStep(s,{mx:0,my:0,run:false,sneak:false,act:false,ev:[]});rec(); if(g.state==="PATROL"&&log.length>4)break;}
console.log('LKP when lost',JSON.stringify(lkpBefore),'transitions:',log.join('  '),'| alert:',s.alertName,'radio links seen, others:',s.guards.filter(o=>o!==g).map(o=>o.name+':'+o.state).join(','));
