/* ================= core: utils, state, terrain generation, simulation ================= */

const $ = id => document.getElementById(id);
const clamp = (x,a,b) => x<a?a:(x>b?b:x);
const lerp = (a,b,t) => a+(b-a)*t;

/* deterministic PRNG + noise ------------------------------------------------ */
function mulberry32(seed){ let a = seed>>>0; return function(){ a|=0; a = a+0x6D2B79F5|0; let t = Math.imul(a^a>>>15, 1|a); t = t+Math.imul(t^t>>>7, 61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hash2(ix,iz,seed){
  let h = (Math.imul(ix,374761393) + Math.imul(iz,668265263) + Math.imul(seed,974634211))|0;
  h = (h ^ (h>>>13))|0; h = Math.imul(h,1274126177); h = (h ^ (h>>>16))>>>0;
  return h/4294967296;
}
function valueNoise(x,z,seed){
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz;
  const ux=fx*fx*(3-2*fx), uz=fz*fz*(3-2*fz);
  return lerp(lerp(hash2(ix,iz,seed),hash2(ix+1,iz,seed),ux),
              lerp(hash2(ix,iz+1,seed),hash2(ix+1,iz+1,seed),ux), uz);
}
function fbm(x,z,seed,oct,persist){
  let amp=1,sum=0,norm=0,f=1;
  for(let o=0;o<oct;o++){ sum+=amp*valueNoise(x*f,z*f,seed+o*101); norm+=amp; amp*=persist; f*=2.03; }
  return sum/norm;
}
function ridged(x,z,seed,oct,persist){
  let amp=1,sum=0,norm=0,f=1;
  for(let o=0;o<oct;o++){ const n=1-Math.abs(2*valueNoise(x*f,z*f,seed+o*131)-1); sum+=amp*n*n; norm+=amp; amp*=persist; f*=2.11; }
  return sum/norm;
}

/* tunable parameters (bound to UI) ----------------------------------------- */
const P = {
  speed:1.5, substeps:1, res:192, seed:1337,
  style:'mountains', amp:7, rough:0.52,
  rain:0.35, evap:0.25, erode:0.09, dep:0.25, cap:2.5, flow:1.0, therm:0.3, talus:0.55,
  mode:0, ex:1.6, wop:0.85, laz:215, lel:38, shadow:true, contour:false, csp:0.8, grid:false,
  br:9, bs:0.5, tool:'raise',
};

/* mutable simulation state -------------------------------------------------- */
const S = {
  N:256, half:128,
  h:null, w:null, s:null, u:null, v:null, h0:null,
  fL:null,fR:null,fT:null,fB:null, gL:null,gR:null,gT:null,gB:null, // g* = swap (next) flux buffers
  sl:null,  // scratch for sediment advection
  dTh:null, // scratch thermal delta
  genMin:0, genMax:1,
  time:0, steps:0, paused:false,
  carved:0, deposited:0,
  recoveries:0, cappedNotice:false,
  spring:null,   // {i,j,r,rate}
  dirty:true,    // texture needs re-upload
  maxW:0.5, maxC:1.0, maxDl:0.05, maxSpd:4, // auto-scales for viz
  simMs:0, stepsAcc:0, stepsPerSec:0,
  running:false,
};

function allocState(N){
  const n2 = N*N;
  S.N=N; S.half=N/2;
  const f = () => new Float32Array(n2);
  S.h=f(); S.w=f(); S.s=f(); S.u=f(); S.v=f(); S.h0=f();
  S.fL=f(); S.fR=f(); S.fT=f(); S.fB=f();
  S.gL=f(); S.gR=f(); S.gT=f(); S.gB=f();
  S.sl=f(); S.dTh=f();
  S.flowAcc=null; S.order=null; S.blur=null; S.flowNorm=6;   // recreate scratch at correct size
}

/* terrain generation -------------------------------------------------------- */
function generateTerrain(keepWater){
  const N=S.N, seed=P.seed|0, h=S.h, w=S.w;
  const amp=P.amp, rough=P.rough, F=6.2;
  S.spring=null;
  const c = N*0.5;
  let gmin=Infinity, gmax=-Infinity;
  const pathZ = i => c + Math.sin(i/N*Math.PI*2*1.35 + hash2(seed,7,3)*6.28)*N*0.20
                        + Math.sin(i/N*Math.PI*2*3.1 + 1.7)*N*0.07;

  for(let j=0;j<N;j++){
    for(let i=0;i<N;i++){
      const idx=j*N+i;
      const nx=i/N*F, nz=j/N*F;
      const e = Math.min(i, j, N-1-i, N-1-j)/N;           // 0 at border → 0.5 center
      const fall = 0.35 + 0.65*Math.min(1, e/0.14);       // gentle rim falloff
      let hh=0;
      if(P.style==='mountains'){
        const r = ridged(nx,nz,seed,6,rough);
        const d = fbm(nx*2.4,nz*2.4,seed+55,5,rough);
        let m = r*0.82 + d*0.18;
        m = Math.pow(Math.max(0,m),1.35);
        hh = amp*(m*1.35-0.28)*fall;
      } else if(P.style==='hills'){
        const m = fbm(nx,nz,seed,6,rough);
        hh = amp*(m-0.42)*1.5*fall;
      } else if(P.style==='island'){
        const m = fbm(nx,nz,seed,6,rough);
        const r2 = ridged(nx*1.7,nz*1.7,seed+9,5,rough);
        const dist = Math.hypot(i-c,j-c)/(N*0.48);
        const mask = clamp(1.35*(1-dist),0,1);
        hh = (amp*(0.35*m+0.65*Math.pow(r2,1.2))-amp*0.42)*mask + (-amp*0.5)*(1-mask);
      } else if(P.style==='mesa'){
        const t = fbm(nx*0.7,nz*0.7,seed+3,4,rough);
        const plateau = 1/(1+Math.exp(-(t-0.5)*14));       // sharp terrace mask
        const detail = fbm(nx*2.6,nz*2.6,seed+8,5,rough);
        hh = amp*(0.28*detail + 0.55*plateau + 0.12) * lerp(0.55,1,Math.min(1,e/0.2));
        const zc = pathZ(i), dp = Math.abs(j-zc);
        const carve = Math.exp(-(dp*dp)/(2*Math.pow(N*0.032,2)));
        hh = lerp(hh, Math.min(hh, -amp*0.18), carve);
        if(i===Math.round(N*0.04)) S.spring = {i:Math.round(N*0.04), j:Math.round(clamp(zc,2,N-3)), r:2.5, rate:2.4};
      } else { // valley
        const ridge = ridged(nx*1.15,nz*1.15,seed+21,6,rough);
        let m = Math.pow(ridge,1.2);
        hh = amp*(m*1.1-0.18)*fall;
        const zc = pathZ(i), dp = Math.abs(j-zc);
        const valley = Math.exp(-(dp*dp)/(2*Math.pow(N*0.075,2)));
        hh = lerp(hh, -amp*0.16 + fbm(nx*3,nz*3,seed+4,4,rough)*amp*0.06, valley*0.96);
        if(i===Math.round(N*0.03)) S.spring = {i:Math.round(N*0.03), j:Math.round(clamp(zc,2,N-3)), r:3, rate:3.2};
      }
      h[idx]=hh; w[idx]=0;
      if(hh<gmin)gmin=hh; if(hh>gmax)gmax=hh;
    }
  }
  S.genMin=gmin; S.genMax=gmax;
  // soften single-cell spikes from ridged noise (two gentle 3×3 blur passes)
  if(!S.blur || S.blur.length!==N*N) S.blur=new Float32Array(N*N);
  const bl=S.blur;
  for(let pass=0;pass<2;pass++){
    bl.set(h);
    for(let j=0;j<N;j++){
      for(let i=0;i<N;i++){
        const k=j*N+i;
        let sum=0, cnt=0;
        for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){
          const ii=clamp(i+di,0,N-1), jj=clamp(j+dj,0,N-1);
          sum+=bl[jj*N+ii]; cnt++;
        }
        h[k]=lerp(bl[k], sum/cnt, 0.5);
      }
    }
  }
  gmin=Infinity; gmax=-Infinity;
  for(let k=0;k<N*N;k++){ const v=h[k]; if(v<gmin)gmin=v; if(v>gmax)gmax=v; }
  S.genMin=gmin; S.genMax=gmax;
  S.h0.set(h);
  S.s.fill(0); S.u.fill(0); S.v.fill(0);
  S.fL.fill(0);S.fR.fill(0);S.fT.fill(0);S.fB.fill(0);
  S.gL.fill(0);S.gR.fill(0);S.gT.fill(0);S.gB.fill(0);
  S.time=0; S.steps=0; S.carved=0; S.deposited=0; S.recoveries=0;
  S.maxW=0.5; S.maxC=1; S.maxDl=Math.max(0.05,(gmax-gmin)*0.02); S.maxSpd=4;
  if(!keepWater) resetWaterOnly();
  computeFlowAccumulation();
  S.dirty=true;
}

function resetWaterOnly(){
  const N=S.N, h=S.h, w=S.w;
  w.fill(0);
  if(P.style==='island'){
    const sea = -P.amp*0.22;
    for(let k=0;k<N*N;k++) w[k]=Math.max(0, sea-h[k]);
  }
}

function resetSim(){
  S.h.set(S.h0);
  resetWaterOnly();
  S.s.fill(0); S.u.fill(0); S.v.fill(0);
  S.fL.fill(0);S.fR.fill(0);S.fT.fill(0);S.fB.fill(0);
  S.gL.fill(0);S.gR.fill(0);S.gT.fill(0);S.gB.fill(0);
  S.time=0; S.steps=0; S.carved=0; S.deposited=0;
  computeFlowAccumulation();
  S.dirty=true;
}

/* flow accumulation (D8 steepest descent) — concentrates erosion into channels.
   Recomputed periodically; O(N² log N) sort is amortized over ~48 steps. */
function computeFlowAccumulation(){
  const N=S.N, h=S.h;
  if(!S.flowAcc || S.flowAcc.length!==N*N) S.flowAcc=new Float32Array(N*N);
  const acc=S.flowAcc;
  acc.fill(1);
  if(!S.order || S.order.length!==N*N) S.order=new Uint32Array(N*N);
  const idx=S.order;
  for(let k=0;k<N*N;k++) idx[k]=k;
  idx.sort((a,b)=>h[b]-h[a]);
  for(let q=0;q<idx.length;q++){
    const k=idx[q], i=k%N, j=(k/N)|0, hk=h[k];
    let best=-1, bs=0;
    if(i>0){ const d=hk-h[k-1]; if(d>bs){bs=d;best=k-1;} }
    if(i<N-1){ const d=hk-h[k+1]; if(d>bs){bs=d;best=k+1;} }
    if(j>0){ const d=hk-h[k-N]; if(d>bs){bs=d;best=k-N;} }
    if(j<N-1){ const d=hk-h[k+N]; if(d>bs){bs=d;best=k+N;} }
    if(best>=0) acc[best]+=acc[k];
  }
  let mean=0; for(let k=0;k<N*N;k++) mean+=acc[k];
  mean/=N*N;
  S.flowNorm=Math.max(mean*6, 6);
  S.flowDirty=false;
}

/* drifting rain storms: two gaussian blobs sweep across the map so that rain
   arrives locally — channels flood and drain visibly instead of a uniform flood */
function updateStorm(dt){
  const N=S.N;
  if(!S.storm) S.storm={t:0, blobs:[]};
  const st=S.storm;
  st.t+=dt;
  const m=N+90, r=N/4.2;
  st.blobs=[
    {x:((st.t*3.1)%m+m)%m-45,      y:((st.t*1.9)%m+m)%m-45,      w:0.6},
    {x:((st.t*1.4+130)%m+m)%m-45,  y:((st.t*2.6+60)%m+m)%m-45,   w:0.5},
  ];
  st.r=r; st.r2=2*r*r;
}
function applyRain(w, rain, dt){
  const N=S.N, st=S.storm;
  for(const b of st.blobs){
    const i0=Math.max(0,Math.floor(b.x-st.r)), i1=Math.min(N-1,Math.ceil(b.x+st.r));
    const j0=Math.max(0,Math.floor(b.y-st.r)), j1=Math.min(N-1,Math.ceil(b.y+st.r));
    for(let j=j0;j<=j1;j++){
      const dy=j-b.y, dy2=dy*dy;
      for(let i=i0;i<=i1;i++){
        const dx=i-b.x;
        const g=Math.exp(-(dx*dx+dy2)/st.r2);
        w[j*N+i]+=rain*b.w*g*dt;
      }
    }
  }
}

/* simulation: one substep of dt --------------------------------------------- */
const DT = 0.025;
function simStep(dt){
  const N=S.N, h=S.h, w=S.w, s=S.s, u=S.u, v=S.v;
  const fL=S.fL,fR=S.fR,fT=S.fT,fB=S.fB, gL=S.gL,gR=S.gR,gT=S.gT,gB=S.gB;
  const accel = dt*9.81*P.flow;                 // pipe acceleration coefficient
  /* 1. rainfall (storm cells) + springs */
  if(P.rain>0){ updateStorm(S.time); applyRain(w, P.rain, dt); }
  const sp=S.spring;
  if(sp){
    const r=sp.r, r2=(r+0.5)*(r+0.5);
    for(let j=Math.max(0,sp.j-4);j<=Math.min(N-1,sp.j+4);j++)
      for(let i=Math.max(0,sp.i-4);i<=Math.min(N-1,sp.i+4);i++){
        const d2=(i-sp.i)*(i-sp.i)+(j-sp.j)*(j-sp.j);
        if(d2<r2){ const add=sp.rate*dt*(1-Math.sqrt(d2)/(r+0.5)); w[j*N+i]+=add; }
      }
  }

  /* 2. pipe-model flow: update fluxes (read old → write next) */
  for(let j=0;j<N;j++){
    for(let i=0;i<N;i++){
      const k=j*N+i;
      const hc = h[k]+w[k];
      let l,r,t,b;
      l = i>0    ? hc-(h[k-1]+w[k-1]) : 0;
      r = i<N-1  ? hc-(h[k+1]+w[k+1]) : 0;
      t = j>0    ? hc-(h[k-N]+w[k-N]) : 0;
      b = j<N-1  ? hc-(h[k+N]+w[k+N]) : 0;
      let fl = fL[k]+accel*l; if(!(fl>0)||i===0)    fl=0;
      let fr = fR[k]+accel*r; if(!(fr>0)||i===N-1)  fr=0;
      let ft = fT[k]+accel*t; if(!(ft>0)||j===0)    ft=0;
      let fb = fB[k]+accel*b; if(!(fb>0)||j===N-1)  fb=0;
      const sum=fl+fr+ft+fb;
      if(sum>1e-12){
        const K = Math.min(1, w[k]/(sum*dt));
        if(K<1){ fl*=K; fr*=K; ft*=K; fb*=K; }
      }
      gL[k]=fl; gR[k]=fr; gT[k]=ft; gB[k]=fb;
    }
  }

  /* 3. apply fluxes to water depth + compute velocities */
  for(let j=0;j<N;j++){
    for(let i=0;i<N;i++){
      const k=j*N+i;
      const out = gL[k]+gR[k]+gT[k]+gB[k];
      let inn = 0;
      if(i>0)   inn+=gR[k-1];
      if(i<N-1) inn+=gL[k+1];
      if(j>0)   inn+=gT[k-N];
      if(j<N-1) inn+=gB[k+N];
      let wn = w[k] + dt*(inn-out);
      if(!(wn>1e-6)) wn=0; else if(wn>30) wn=30;
      w[k]=wn;
      let uu=0,vv=0;
      if(wn>1e-4){
        const dxf = 0.5*((i>0?gR[k-1]:0) - gL[k] + gR[k] - (i<N-1?gL[k+1]:0));
        const dzf = 0.5*((j>0?gT[k-N]:0) - gB[k] + gT[k] - (j<N-1?gB[k+N]:0));
        uu = dxf/wn; vv = dzf/wn;
        const spd2=uu*uu+vv*vv;
        if(spd2>900){ const f2=30/Math.sqrt(spd2); uu*=f2; vv*=f2; }  // clamp speed 30
      }
      u[k]=uu; v[k]=vv;
    }
  }
  // swap flux buffers
  S.fL=gL;S.fR=gR;S.fT=gT;S.fB=gB;S.gL=fL;S.gR=fR;S.gT=fT;S.gB=fB;

  /* 4. erosion / deposition */
  const Kc=P.cap, Ks=P.erode, Kd=P.dep;
  const hFloor = S.genMin - P.amp*0.3;
  let carv=0, dep=0;
  if((S.steps & 31)===0 && S.flowDirty) computeFlowAccumulation();
  if(Ks>0 || Kd>0){
    for(let k=0;k<N*N;k++){
      const wk=w[k];
      if(wk<1e-4){ if(s[k]>0){ h[k]+=s[k]; s[k]=0; } continue; }
      const spd=Math.sqrt(u[k]*u[k]+v[k]*v[k]);
      const disch = 0.18 + 0.82*Math.min(1, S.flowAcc[k]/S.flowNorm);
      const cap = Kc * Math.min(1,spd) * Math.min(1,wk*8) * disch;
      const sk=s[k];
      if(cap>sk){
        let e = Ks*(cap-sk)*dt;
        if(e>0.02) e=0.02;
        const room = 0.5*(h[k]-hFloor);
        if(e>room) e=Math.max(0,room);
        s[k]=sk+e; h[k]-=e; carv+=e;
      } else {
        let d2 = Kd*(sk-cap)*dt;
        if(d2>sk) d2=sk;
        s[k]=sk-d2; h[k]+=d2; dep+=d2;
      }
      if(h[k]<hFloor) h[k]=hFloor; else if(h[k]>S.genMax+14) h[k]=S.genMax+14;
    }
    S.carved+=carv; S.deposited+=dep;
  }

  /* 5. semi-Lagrangian sediment advection (mass-normalized) */
  if(Ks>0){
    const sl=S.sl;
    let sBefore=0;
    for(let k=0;k<N*N;k++) sBefore+=s[k];
    for(let j=0;j<N;j++){
      for(let i=0;i<N;i++){
        const k=j*N+i;
        const fi=i-u[k]*dt, fj=j-v[k]*dt;
        const ci=clamp(fi,0,N-1.001), cj=clamp(fj,0,N-1.001);
        const i0=ci|0, j0=cj|0, fx=ci-i0, fy=cj-j0;
        const a=j0*N+i0;
        sl[k] = (s[a]*(1-fx)+s[a+1]*fx)*(1-fy) + (s[a+N]*(1-fx)+s[a+N+1]*fx)*fy;
        if(!(sl[k]>=0)) sl[k]=0;
      }
    }
    let sAfter=0;
    for(let k=0;k<N*N;k++) sAfter+=sl[k];
    S.s.set(sl);
    if(sAfter>1e-9 && sBefore>1e-9){
      const corr=sBefore/sAfter;   // exact mass normalization (semi-Lagrangian resampling leaks)
      if(Number.isFinite(corr) && Math.abs(corr-1)>1e-6){ for(let k=0;k<N*N;k++) S.s[k]=Math.min(S.s[k]*corr, 40); }
    }
  }

  /* 6. evaporation (dry cells dump their sediment to the bed) */
  const evf = Math.max(0, 1-P.evap*dt);
  let wSum=0;
  for(let k=0;k<N*N;k++){
    let wk=w[k]*evf;
    if(!(wk>=1e-4)){
      if(s[k]>0){ h[k]+=s[k]; s[k]=0; }
      w[k]=0;
    } else { w[k]=wk; wSum+=wk; }
  }
  if(!Number.isFinite(wSum)){
    sanitize();   // numeric instability: repair immediately
  }

  /* 7. thermal (talus) erosion */
  const T=P.therm;
  if(T>0){
    const talus=P.talus;
    const kt = Math.min(0.12, T*dt*0.9);
    const dTh=S.dTh; dTh.fill(0);
    for(let j=0;j<N;j++){
      for(let i=0;i<N;i++){
        const k=j*N+i, hk=h[k];
        if(i>0){ const d=hk-h[k-1]; if(d>talus){ const m=(d-talus)*kt; dTh[k]-=m; dTh[k-1]+=m; } }
        if(i<N-1){ const d=hk-h[k+1]; if(d>talus){ const m=(d-talus)*kt; dTh[k]-=m; dTh[k+1]+=m; } }
        if(j>0){ const d=hk-h[k-N]; if(d>talus){ const m=(d-talus)*kt; dTh[k]-=m; dTh[k-N]+=m; } }
        if(j<N-1){ const d=hk-h[k+N]; if(d>talus){ const m=(d-talus)*kt; dTh[k]-=m; dTh[k+N]+=m; } }
      }
    }
    for(let k=0;k<N*N;k++) h[k]+=dTh[k];
  }

  S.time+=dt; S.steps++;
}

/* stability guard: scrub NaN/Inf, clamp extremes ---------------------------- */
function sanitize(){
  const N=S.N, n2=N*N;
  let bad=0;
  const check=(arr,fix)=>{ for(let k=0;k<n2;k++){ const x=arr[k]; if(!Number.isFinite(x)){ arr[k]=fix(k); bad++; } } };
  check(S.h, k=>S.h0[k]);
  check(S.w, ()=>0); check(S.s, ()=>0);
  check(S.u,()=>0); check(S.v,()=>0);
  check(S.fL,()=>0);check(S.fR,()=>0);check(S.fT,()=>0);check(S.fB,()=>0);
  if(bad>0){
    S.recoveries++;
    return bad;
  }
  return 0;
}

/* statistics ---------------------------------------------------------------- */
function computeStats(){
  const n2=S.N*S.N, h=S.h,w=S.w,s=S.s,u=S.u,v=S.v,h0=S.h0;
  let sw=0, ss=0, maxw=0, maxc=0, maxdl=0, maxspd=0, carve=0, depos=0;
  for(let k=0;k<n2;k++){
    const wk=w[k]; sw+=wk;
    if(wk>maxw) maxw=wk;
    const sk=s[k]; ss+=sk;
    const c = wk>1e-4 ? sk/wk : 0; if(c>maxc) maxc=c;
    const spd=Math.sqrt(u[k]*u[k]+v[k]*v[k]); if(spd>maxspd) maxspd=spd;
    const dl=h[k]-h0[k], adl=dl<0?-dl:dl;
    if(adl>maxdl) maxdl=adl;
    if(dl<0) carve-=dl; else depos+=dl;
  }
  // smoothed auto-scales so color ramps don't flicker
  S.maxW = Math.max(maxw*1.05, S.maxW*0.995, 0.02);
  S.maxC = Math.max(maxc*1.05, S.maxC*0.99, 0.05);
  S.maxDl = Math.max(maxdl*1.02, S.maxDl*0.995, 0.02);
  S.maxSpd = Math.max(maxspd*1.05, S.maxSpd*0.98, 0.5);
  return { water:sw, sed:ss, maxW:maxw, maxC:maxc, carved:carve, deposited:depos, maxSpd:maxspd };
}
