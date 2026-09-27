// ================= world / course generation =================
const PRESETS={
 canyon:{skyH:[0.45,0.20,0.10],skyT:[0.05,0.08,0.16],sun:[-0.5,0.25,0.4],sunC:[1.0,0.6,0.35],
  fog:[0.36,0.22,0.16],fogD:0.0042,gnd:[0.5,0.3,0.2],hemiSky:[0.55,0.45,0.55],hemiGnd:[0.35,0.2,0.12]},
 neon:{skyH:[0.05,0.09,0.2],skyT:[0.01,0.02,0.07],sun:[0.3,0.5,-0.6],sunC:[0.7,0.7,1.0],
  fog:[0.08,0.07,0.2],fogD:0.0032,gnd:[0.07,0.08,0.14],hemiSky:[0.55,0.5,0.9],hemiGnd:[0.1,0.08,0.2]},
 industrial:{skyH:[0.55,0.6,0.65],skyT:[0.15,0.2,0.3],sun:[0.6,0.5,0.3],sunC:[1.0,0.9,0.7],
  fog:[0.5,0.52,0.55],fogD:0.0028,gnd:[0.42,0.42,0.44],hemiSky:[0.55,0.6,0.7],hemiGnd:[0.3,0.3,0.3]},
 forest:{skyH:[0.5,0.65,0.5],skyT:[0.1,0.2,0.35],sun:[0.5,0.6,0.2],sunC:[1.0,0.95,0.75],
  fog:[0.4,0.5,0.4],fogD:0.0046,gnd:[0.16,0.26,0.13],hemiSky:[0.5,0.6,0.55],hemiGnd:[0.15,0.22,0.12]},
};
const DIFF={easy:{gates:7,gateScale:1.5,obs:0.6,crash:14},normal:{gates:9,gateScale:1.15,obs:1.0,crash:10},
 hard:{gates:12,gateScale:0.85,obs:1.6,crash:7}};

function buildWorld(preset,seed,diff){
 const rng=RNG(seed*2654435761+13),noise=makeNoise(seed),noise2=makeNoise(seed^0x9e3779b9);
 const df=DIFF[diff]||DIFF.normal;
 const W={preset,seed,diff,obstacles:[],gates:[],decor:[],boundR:220,
  sunDir:V3.c(...PRESETS[preset].sun),sky:PRESETS[preset],
  gateAperture:5.2*df.gateScale};
 V3.norm(W.sunDir,W.sunDir);
 // ---- ground height function ----
 const H={
  canyon:(x,z)=>{const r=Math.hypot(x,z);
   const bowl=smoothstep(80,190,r); // keep course valley flat, walls around
   const ridge=Math.max(0,fbm(noise,x*0.008,z*0.008,4))**1.5*42*bowl;
   const mesa=smoothstep(120,200,r)*Math.max(0,fbm(noise2,x*0.02,z*0.02,3))*30;
   return ridge+mesa+Math.max(0,fbm(noise2,x*0.05,z*0.05,2))*1.5},
  neon:(x,z)=>0,
  industrial:(x,z)=>Math.max(0,fbm(noise,x*0.03,z*0.03,2))*0.6,
  forest:(x,z)=>fbm(noise,x*0.02,z*0.02,3)*3+Math.max(0,fbm(noise2,x*0.06,z*0.06,2))*1.2,
 }[preset];
 W.h=H;
 // ---- course loop: jittered ellipse ----
 const N=df.gates,cx=0,cz=0,R0=110+rng()*40,R1=R0*(0.75+rng()*0.5),rot=rng()*Math.PI*2;
 const wp=[];
 for(let i=0;i<N;i++){const a=i/N*Math.PI*2+rot;
  const jr=1+(rng()-0.5)*0.35;
  const x=cx+Math.cos(a)*R0*jr,z=cz+Math.sin(a)*R1*jr;
  const baseAlt=6+fbm(noise,i*0.7,3.3,2)*14+ (preset==='canyon'?6:0);
  wp.push(V3.c(x,Math.max(4,baseAlt+H(x,z)*0.3,H(x,z)+6),z))}
 // orient each gate: normal (local +Z) = travel direction from prev to next wp
 for(let i=0;i<N;i++){
  const prev=wp[(i-1+N)%N],next=wp[(i+1)%N],p=wp[i];
  const dir=V3.c();V3.sub(dir,next,prev);V3.norm(dir,dir);
  const yaw=Math.atan2(dir[0],dir[2]),pitch=-Math.asin(clamp(dir[1],-1,1));
  const q=QT.ident();QT.fromYawPitchRoll(q,yaw,pitch,(rng()-0.5)*0.5);
  W.gates.push({p,q,w:W.gateAperture,h:W.gateAperture*0.8,
   start:i===0,col:i===0?[0.2,1,0.5]:[0.1,0.9,1]})}
 W.boundR=Math.hypot(R0,R1)*1.6+80;
 // ---- spawn: behind gate0 facing it ----
 const g0=W.gates[0],fwd=V3.c();QT.rot(fwd,g0.q,V3.c(0,0,1));
 const sp=V3.c();V3.mad(sp,g0.p,fwd,-16);
 const gy=H(sp[0],sp[2]);sp[1]=Math.max(gy+1.6,g0.p[1]-3);
 const syaw=Math.atan2(fwd[0],fwd[2]);
 W.spawn={p:sp,yaw:syaw};
 // ---- obstacles ----
 const OBS=W.obstacles;
 const box=(x,y,z,sx,sy,sz,yaw,c,e=0)=>{const q=QT.ident();QT.fromYawPitchRoll(q,yaw||0,0,0);
  OBS.push({k:'b',p:V3.c(x,y,z),q,he:V3.c(sx/2,sy/2,sz/2),c,e})};
 const cyl=(x,y,z,r,h,c,e=0)=>{OBS.push({k:'c',p:V3.c(x,y,z),r,h,c,e})};
 const noBuild=V3.c(); // corridor keep-out helper
 function corridorFree(x,z,margin){ // distance to course segments, gates, spawn
  if(Math.hypot(x-W.spawn.p[0],z-W.spawn.p[2])<18)return false;
  for(let i=0;i<N;i++){const a=W.gates[i].p,b=W.gates[(i+1)%N].p;
   if(Math.hypot(x-a[0],z-a[2])<margin*1.4)return false;
   const abx=b[0]-a[0],abz=b[2]-a[2],L2=abx*abx+abz*abz;
   let t=L2?((x-a[0])*abx+(z-a[2])*abz)/L2:0;t=clamp(t,0,1);
   const dx=x-(a[0]+abx*t),dz=z-(a[2]+abz*t);
   if(dx*dx+dz*dz<margin*margin)return false}
  return true}
 const dens=df.obs;
 if(preset==='canyon'){
  for(let i=0;i<70*dens;i++){const a=rng()*Math.PI*2,r=40+rng()*220;
   const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(!corridorFree(x,z,14))continue;
   const h=8+rng()*40,w=4+rng()*10,y=H(x,z);
   box(x,y+h/2-1,z,w,h,w*(0.7+rng()*0.6),rng()*3,[0.45+rng()*0.15,0.25,0.14]);}
  // canyon wall pillars flanking some gates
  for(let i=1;i<N;i++){const g=W.gates[i];const fw=V3.c();QT.rot(fw,g.q,V3.c(0,0,1));
   const sd=V3.c();QT.rot(sd,g.q,V3.c(1,0,0));
   for(const s of[-1,1]){const px=g.p[0]+sd[0]*s*(g.w+6+rng()*8),pz=g.p[2]+sd[2]*s*(g.w+6+rng()*8);
    const ph=g.p[1]+10+rng()*20;box(px,ph/2,pz,5+rng()*4,ph,5+rng()*4,rng()*3,[0.5,0.27,0.15])}}
 }else if(preset==='neon'){
  const gs=26; // street grid pitch
  for(let gx=-8;gx<=8;gx++)for(let gz=-8;gz<=8;gz++){
   const x=gx*gs+(rng()-0.5)*4,z=gz*gs+(rng()-0.5)*4;
   if(Math.hypot(x,z)>280)continue;if(!corridorFree(x,z,10))continue;
   if(rng()<0.25)continue;
   const h=12+rng()**1.5*80,w=10+rng()*8;
   const hue=rng();const c=hue<0.33?[0.06,0.1,0.16]:hue<0.66?[0.08,0.07,0.14]:[0.05,0.09,0.12];
   box(x,h/2,z,w,h,w*(0.8+rng()*0.4),0,c);
   // neon edge strips (decor, emissive)
   const nc=[[1,0.1,0.6],[0.1,0.9,1],[1,0.6,0.05]][(rng()*3)|0];
   box(x,h+0.4,z,w*1.02,0.35,w*1.02,0,nc,1.6);
   if(rng()<0.55){box(x+w/2+0.2,h*(0.3+rng()*0.5),z,0.3,3+rng()*5,0.3,0,nc,2);box(x-w/2-0.2,h*(0.2+rng()*0.6),z,0.3,2+rng()*6,0.3,0,[0.1,0.9,1],1.8)}}
 }else if(preset==='industrial'){
  for(let i=0;i<60*dens;i++){const a=rng()*Math.PI*2,r=30+rng()*200;
   const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(!corridorFree(x,z,12))continue;
   const k=rng();
   if(k<0.4){box(x,1.5,z,12,3,3,rng()*3,[0.5,0.35,0.1+rng()*0.2]);} // containers
   else if(k<0.7){const h=15+rng()*20;box(x,h/2,z,2,h,2,rng(),[0.4,0.42,0.45]); // crane legs
    box(x,h,z,14+rng()*10,1.5,2,rng(),[0.8,0.6,0.1]);}
   else{cyl(x,4+rng()*4,z,1+rng(),20+rng()*30,[0.3,0.32,0.35]);}} // pipes
 }else{ // forest
  for(let i=0;i<220*dens;i++){const a=rng()*Math.PI*2,r=20+rng()*260;
   const x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(!corridorFree(x,z,9))continue;
   const h=10+rng()*26,tr=0.4+rng()*0.9,y=H(x,z);
   cyl(x,y+h/2,z,tr,h,[0.25+rng()*0.1,0.16,0.1]);
   cyl(x,y+h,z,1.6+rng()*2.6,4+rng()*4,[0.06,0.25+rng()*0.15,0.08]);}
 }
 // per-gate ring hazards on hard
 if(diff==='hard')for(let i=1;i<N;i++){const g=W.gates[i];const fw=V3.c();QT.rot(fw,g.q,V3.c(0,0,1));
  const mid=V3.c();V3.mad(mid,g.p,fw,14+rng()*10);
  const sd=V3.c();QT.rot(sd,g.q,V3.c(1,0,0));const s=rng()<0.5?-1:1;
  box(mid[0]+sd[0]*s*4,mid[1],mid[2]+sd[2]*s*4,1.5,6+rng()*6,1.5,rng(),[0.6,0.2,0.2]);}
 W.df=df;
 return W;
}

// ---- ground mesh from height fn ----
function groundGeo(W,size=640,res=140){
 const g={pos:[],nrm:[],idx:[]};
 for(let j=0;j<=res;j++)for(let i=0;i<=res;i++){
  const x=-size/2+i/res*size,z=-size/2+j/res*size,y=W.h(x,z);
  const e=1.2,hx=W.h(x+e,z)-W.h(x-e,z),hz=W.h(x,z+e)-W.h(x,z-e);
  const n=V3.c(-hx,2*e,-hz);V3.norm(n,n);
  g.pos.push(x,y,z);g.nrm.push(n[0],n[1],n[2])}
 for(let j=0;j<res;j++)for(let i=0;i<res;i++){const b=j*(res+1)+i;
  g.idx.push(b,b+1,b+res+1,b+1,b+res+2,b+res+1)}
 return g}
// ---- gate frame geometry (aperture w x h) ----
function gateGeo(w,h){
 const g={pos:[],nrm:[],idx:[]},t=0.35,d=0.5;
 geoBox(g,0,h/2+t/2,0,w+2*t,t,d);      // top bar
 geoBox(g,0,-h/2-t/2,0,w+2*t,t,d);     // bottom bar
 geoBox(g,-w/2-t/2,0,0,t,h,d);         // left
 geoBox(g,w/2+t/2,0,0,t,h,d);          // right
 return g}
function gatePostsGeo(w,h){ // two legs to ground drawn separately via scale
 const g={pos:[],nrm:[],idx:[]};geoBox(g,0,0.5,0,1,1,1);return g}
// ---- drone geometry ----
function droneGeo(){
 const g={pos:[],nrm:[],idx:[]};
 geoBox(g,0,0,0,0.34,0.10,0.42);            // body
 geoBox(g,0,0.05,-0.22,0.14,0.09,0.16);     // cam pod front (-z)
 geoBox(g,0,-0.02,0.16,0.2,0.05,0.12);      // tail
 for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
  geoBox(g,sx*0.19,-0.01,sz*0.24,0.22,0.03,0.06);   // arms
  geoCyl(g,sx*0.28,0.02,sz*0.33,0.035,0.07,8);      // motors
 }
 return g}
function propGeo(){const g={pos:[],nrm:[],idx:[]};geoCyl(g,0,0,0,0.14,0.006,12,false,false);return g}
function discGeo(r){const g={pos:[],nrm:[],idx:[]};
 const seg=24;g.pos.push(0,0,0);g.nrm.push(0,1,0);
 for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2;g.pos.push(Math.cos(a)*r,0,Math.sin(a)*r);g.nrm.push(0,1,0)}
 for(let i=0;i<seg;i++)g.idx.push(0,i+1,i+2);return g}
