// ================= race / checkpoints =================
const R={next:0,lap:0,started:false,finished:false,tRace:0,tLap:0,lapStart:0,
 sector:0,sectorT0:0,sectorTimes:[],lapTimes:[],pen:0,missed:0,best:null,msgT:0};
const _gp=V3.c(),_gpPrev=V3.c(),_gq=QT.ident();
function courseKey(){return`${S.preset}:${S.seed}:${S.difficulty}:${S.laps}`}
function gateLocal(g,p,out){_gp[0]=p[0]-g.p[0];_gp[1]=p[1]-g.p[1];_gp[2]=p[2]-g.p[2];
 return QT.rotInv(out||_gp,g.q,_gp)}

function resetRace(respawn=true){
 R.next=0;R.lap=0;R.started=false;R.finished=false;R.tRace=0;R.tLap=0;
 R.sector=0;R.sectorTimes=[];R.lapTimes=[];R.pen=0;R.missed=0;R.delta=null;
 G.rec=[];G.recT=0;G.live=false;G.splits=[];_prevZ=null;
 if(respawn)spawnAt(0);
 msg(S.raceMode==='time'?'THROUGH THE START RING':'FREE FLIGHT','ok',1800)}
let _prevZ=null;
function raceStep(dt){
 if(S.raceMode==='time'&&!R.finished){if(R.started){R.tRace+=dt;R.tLap+=dt}}
 const total=W.gates.length*S.laps;
 if(S.raceMode==='time'&&R.next>total){_prevZ=null;return}
 const gi=R.next%W.gates.length,g=W.gates[gi];
 const loc=gateLocal(g,D.p);
 const plz=_prevZ;_prevZ=loc[2];
 if(plz===null||D.crashed)return;
 const crossed=(plz<=0&&loc[2]>0)||(plz>0&&loc[2]<=0);
 if(!crossed)return;
 const inside=Math.abs(loc[0])<g.w&&Math.abs(loc[1])<g.h;
 if(!inside){R.missed++;if(S.raceMode==='time')R.pen+=3;
  msg('MISSED GATE'+(S.raceMode==='time'?' +3s':'')+' — turn back!','bad',1800);sfxMiss();return}
 gatePassed(gi)}
function gatePassed(i){
 const N=W.gates.length;
 const secOf=k=>Math.min(2,Math.floor(k*3/N));
 if(i===0&&S.raceMode==='time'){
  if(!R.started){R.started=true;R.tLap=0;R.sectorT0=0;R.sectorTimes=[];G.live=true;
   msg('GO!','ok',1200);sfxGate();R.next=1;return}
  if(R.next===N*R.lap||R.next%N===0){ // completed all gates → lap done crossing start ring
   const lt=R.tLap+R.pen;R.lapTimes.push(lt);R.tLap=0;R.pen=0;
   R.lap=R.lapTimes.length;
   if(R.lapTimes.length>=S.laps){finishRace();return}
   msg(`LAP ${R.lap} — ${fmtT(lt)}`,'ok',1600);sfxGate();
   R.sector=0;R.sectorT0=0;R.sectorTimes=[];R.next++;return}
 }
 if(R.started&&S.raceMode==='time'){
  const ns=secOf(R.next+1);
  if(ns!==R.sector){R.sectorTimes.push(R.tLap-R.sectorT0);R.sectorT0=R.tLap;R.sector=ns}}
 R.next++;
 if(i!==0){msg(`GATE ${i}/${N}`,'',700);sfxGate()}
 if(R.started&&S.raceMode==='time')G.splits[R.next-1]=R.tRace;
}

function finishRace(){
 R.finished=true;R.live=false;G.live=false;
 const total=R.lapTimes.reduce((a,b)=>a+b,0);
 const key=courseKey();
 let isBest=false;
 try{const old=JSON.parse(localStorage.getItem('v1.best:'+key)||'null');
  if(!old||total<old.t){localStorage.setItem('v1.best:'+key,JSON.stringify({t:total,rec:G.rec,sp:G.splits}));
   R.best=total;isBest=true}else R.best=old.t}catch(e){}
 G.best=G.rec.slice();G.bestSplits=G.splits.slice();
 msg(`FINISH ${fmtT(total)}${isBest?' — NEW BEST!':''}`,'ok',6000);
 sfxFinish()}
function loadBest(){
 R.best=null;G.best=null;G.bestSplits=null;
 try{const o=JSON.parse(localStorage.getItem('v1.best:'+courseKey())||'null');
  if(o&&Number.isFinite(o.t)){R.best=o.t;if(Array.isArray(o.rec))G.best=o.rec;
   if(Array.isArray(o.sp))G.bestSplits=o.sp}}catch(e){}}

// ================= ghost =================
const G={rec:[],recT:0,live:false,best:null,splits:[],bestSplits:null};
function ghostStep(dt){ // called per physics step while racing
 if(!G.live)return;
 G.recT+=dt;
 if(G.recT>=1/30){G.recT-=1/30;
  G.rec.push(+R.tRace.toFixed(3),+D.p[0].toFixed(2),+D.p[1].toFixed(2),+D.p[2].toFixed(2),
   +D.q[0].toFixed(4),+D.q[1].toFixed(4),+D.q[2].toFixed(4),+D.q[3].toFixed(4))}}
const _gqP=V3.c(),_gqQ=QT.ident();
function ghostSample(t){ // sets _gqP,_gqQ; returns false if no data
 const rec=G.best;if(!rec||rec.length<16)return false;
 const n=rec.length/8;let i=0;
 while(i<n-1&&rec[i*8]<t)i++;
 const a=Math.max(0,i-1),b=Math.min(n-1,i);
 const ta=rec[a*8],tb=rec[b*8],f=tb>ta?clamp((t-ta)/(tb-ta),0,1):0;
 for(let k=0;k<3;k++)_gqP[k]=lerp(rec[a*8+1+k],rec[b*8+1+k],f);
 for(let k=0;k<4;k++)_gqQ[k]=lerp(rec[a*8+4+k],rec[b*8+4+k],f);
 QT.norm(_gqQ,_gqQ);return true}

// ================= cameras =================
const CAM={mode:0,names:['FPV','CHASE','ORBIT','TRACKSIDE'],orbitA:0,
 pos:V3.c(),look:V3.c(),up:V3.c(0,1,0),fov:95,fpv:false};
const _c1=V3.c(),_c2=V3.c(),_c3=V3.c();
function cycleCam(){CAM.mode=(CAM.mode+1)%4;$('btnCam').textContent='Cam: '+CAM.names[CAM.mode]+' [C]'}
function cycleFlight(){const m=['angle','horizon','acro'];S.flightMode=m[(m.indexOf(S.flightMode)+1)%3];
 $('sFlight').value=S.flightMode;msg('MODE: '+S.flightMode.toUpperCase(),'',1200);saveSettings()}
function updateCam(dt){
 const f=QT.rot(_c1,D.q,[0,0,1]),u=QT.rot(_c2,D.q,[0,1,0]);
 CAM.fpv=false;
 if(CAM.mode===0){ // FPV
  CAM.fpv=true;CAM.fov=S.fov;
  const tilt=S.camTilt*D2R;
  QT.fromYawPitchRoll(_q1,0,-tilt,0);QT.mul(_q2,D.q,_q1); // cam tilted up
  const cf=QT.rot(_c3,_q2,[0,0,1]),cu=QT.rot(V3.c(),_q2,[0,1,0]);
  CAM.pos[0]=D.p[0]+f[0]*0.15+u[0]*0.07;CAM.pos[1]=D.p[1]+f[1]*0.15+u[1]*0.07;CAM.pos[2]=D.p[2]+f[2]*0.15+u[2]*0.07;
  V3.add(CAM.look,CAM.pos,cf);V3.copy(CAM.up,cu)}
 else if(CAM.mode===1){ // chase
  CAM.fov=70;
  const tx=D.p[0]-f[0]*7+u[0]*2.2,ty=D.p[1]-f[1]*7+u[1]*2.2,tz=D.p[2]-f[2]*7+u[2]*2.2;
  const k=Math.min(1,dt*8);
  CAM.pos[0]+=(tx-CAM.pos[0])*k;CAM.pos[1]+=(ty-CAM.pos[1])*k;CAM.pos[2]+=(tz-CAM.pos[2])*k;
  const gy=W.h(CAM.pos[0],CAM.pos[2]);if(CAM.pos[1]<gy+0.5)CAM.pos[1]=gy+0.5;
  V3.copy(CAM.look,D.p);CAM.up[0]=0;CAM.up[1]=1;CAM.up[2]=0}
 else if(CAM.mode===2){ // orbit
  CAM.fov=60;CAM.orbitA+=dt*0.25;
  CAM.pos[0]=D.p[0]+Math.cos(CAM.orbitA)*11;CAM.pos[1]=D.p[1]+4;CAM.pos[2]=D.p[2]+Math.sin(CAM.orbitA)*11;
  const gy=W.h(CAM.pos[0],CAM.pos[2]);if(CAM.pos[1]<gy+0.5)CAM.pos[1]=gy+0.5;
  V3.copy(CAM.look,D.p);CAM.up[0]=0;CAM.up[1]=1;CAM.up[2]=0}
 else{ // trackside: static cam at the active gate watching the drone
  CAM.fov=55;
  const g=W.gates[R.next%W.gates.length];
  const fw=QT.rot(_c3,g.q,[0,0,1]),sd=QT.rot(V3.c(),g.q,[1,0,0]);
  const tx=g.p[0]-fw[0]*18+sd[0]*10,ty=Math.max(g.p[1]+4,W.h(g.p[0],g.p[2])+3),tz=g.p[2]-fw[2]*18+sd[2]*10;
  const k=Math.min(1,dt*3);
  CAM.pos[0]+=(tx-CAM.pos[0])*k;CAM.pos[1]+=(ty-CAM.pos[1])*k;CAM.pos[2]+=(tz-CAM.pos[2])*k;
  V3.copy(CAM.look,D.p);CAM.up[0]=0;CAM.up[1]=1;CAM.up[2]=0}
}
