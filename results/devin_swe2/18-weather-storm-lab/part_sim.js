// ---------------- terrain & init ----------------
function genTerrain(seed,style){
  const n=makeNoise(seed),n2=makeNoise(seed*7+3);
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++)
    HeatV[ID2(i,j)]=0.3+fbm(n2,i/NX*7,j/NZ*7,3)*1.5;
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const x=i/NX,y=j/NZ;let h=0;
    if(style==='ridge'){
      const cx=(x-0.5);
      h=fbm(n,x*3,y*3,4)*1.4+Math.exp(-cx*cx*38)*4.4*(0.7+0.6*fbm(n2,x*5,y*5,3));
    }else if(style==='island'){
      const dx=x-0.5,dy=y-0.5,r=Math.sqrt(dx*dx+dy*dy);
      h=Math.max(0,(0.55-r))*9*(0.5+fbm(n,x*4,y*4,4));
    }else if(style==='coast'){
      h=smooth01(x*1.6-0.25)*4.0*(0.45+0.8*fbm(n,x*3,y*3,4));
    }else if(style==='flat'){
      h=0.9+fbm(n,x*3,y*3,4)*0.8;
    }else{ // hills
      h=fbm(n,x*3.2,y*3.2,5)*3.4+Math.max(0,fbm(n2,x*6,y*6,3)-0.55)*5;
    }
    Ht[ID2(i,j)]=h;
  }
}
function smooth01(t){t=clamp(t,0,1);return t*t*(3-2*t);}
function genSurface(style){
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const id=ID2(i,j),x=i/NX;let s=0;
    if(style==='oceanAll')s=1;
    else if(style==='coast')s=(x<0.36||Ht[id]<WORLD.sea*0.7)?1:0;
    else if(style==='island')s=Ht[id]<WORLD.sea?1:(frand()<0.35?2:0);
    else{ // land with lakes/forest patches
      const n=makeNoise(P.seed+11);
      if(Ht[id]<WORLD.sea)s=1;
      else if(fbm(n,i/NX*4,j/NZ*4,3)>0.62)s=2;
    }
    Sur[id]=s;Wet[id]=s===1?2:0;
  }
}
function clearFields(){
  for(const f of FIELDS){F[f].fill(0);}
  Chg.fill(0);Rain2.fill(0);
  for(let i=0;i<Wet.length;i++)if(Sur[i]!==1)Wet[i]*=0.3;
}
function initAtmos(o){
  // o: {rh, tpAmp, windU, windV, shear}
  clearFields();
  const rh=o.rh!=null?o.rh:P.baseRH;
  const tpAmp=o.tpAmp||0, wu=o.windU!=null?o.windU:P.windBase, wv=o.windV||0;
  for(let k=0;k<NL;k++){
    const prof=0.35+0.65*k/NL;
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const id=IDX(i,j,k);if(Solid[id])continue;
      F.u[id]=wu*prof+(frand()-0.5)*0.4;
      F.v[id]=wv*prof+(frand()-0.5)*0.4;
      const kg=KG[ID2(i,j)];if(k<kg)continue;
      const qs=qsat(k,0);
      F.qv[id]=qs*clamp(rh-0.22*k/NL+0.12*(frand()-0.5),0.02,1.05);
      F.tp[id]=tpAmp*(frand()-0.5);
    }
  }
}

// ---------------- presets ----------------
const PRESETS={
  'fair':{name:'Fair-weather cumulus',setup(){
    P.lapseRate=0.62;P.baseRH=0.82;P.windBase=2.5;P.coriolis=0.4;P.solar=1.15;P.timeOfDay=13;
    genTerrain(P.seed,'hills');genSurface('land');recomputeKG();initAtmos({rh:0.78,tpAmp:1.2,windU:2.5});
  }},
  'sea-breeze':{name:'Sea breeze',setup(){
    P.lapseRate=0.55;P.baseRH=0.7;P.windBase=0.6;P.solar=1.3;P.timeOfDay=14;
    genTerrain(P.seed,'coast');genSurface('coast');recomputeKG();
    initAtmos({rh:0.75,windU:0.5});
    // warm the land side
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++)if(i/NX>0.42){const kg=KG[ID2(i,j)];for(let k=kg;k<Math.min(kg+3,NL);k++)F.tp[IDX(i,j,k)]+=2.5*(1-i/NX*0+0.5);}
  }},
  'mtn-rain':{name:'Mountain rain',setup(){
    P.lapseRate=0.5;P.baseRH=0.85;P.windBase=7;P.terrainInfluence=1.3;P.solar=0.6;P.timeOfDay=15;
    genTerrain(P.seed,'ridge');genSurface('land');recomputeKG();initAtmos({rh:0.9,windU:7});
  }},
  'squall':{name:'Squall line',setup(){
    P.lapseRate=0.8;P.baseRH=0.78;P.windBase=9;P.coriolis=0.3;P.solar=0.8;P.timeOfDay=17;
    genTerrain(P.seed,'flat');genSurface('land');recomputeKG();initAtmos({rh:0.8,tpAmp:1,windU:9});
    const j0=NZ*0.35|0;
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const dj=Math.abs(j-j0);
      if(dj<4){const kg=KG[ID2(i,j)];
        for(let k=kg;k<NL;k++){const id=IDX(i,j,k);
          const tpAdd=4*(1-dj/4)*Math.exp(-k*0.12);
          F.tp[id]+=tpAdd;
          F.qv[id]=Math.max(F.qv[id],qsat(k,tpAdd)*1.03*Math.exp(-Math.abs(k-6)*0.22));
          // pre-seed the line: a developing storm band that dynamics takes over
          const env=Math.exp(-Math.abs(k-6)*0.28);
          F.qc[id]+=1.8*(1-dj/4)*env;
        }}
      if(dj<8)F.u[IDX(i,j,KG[ID2(i,j)])]+=2*(1-dj/8);
    }
    // cold pool behind the line
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++)if(j<j0-4){const kg=KG[ID2(i,j)];for(let k=kg;k<Math.min(kg+3,NL);k++)F.tp[IDX(i,j,k)]-=3.5;}
    P.forceBand=j0;   // moist inflow keeps the line alive, drifts downwind
  }},
  'supercell':{name:'Rotating supercell',setup(){
    P.lapseRate=0.9;P.baseRH=0.8;P.windBase=6;P.coriolis=0.7;P.solar=1.0;P.timeOfDay=16;P.lightningProb=0.8;
    genTerrain(P.seed,'flat');genSurface('land');recomputeKG();initAtmos({rh:0.82,tpAmp:1,windU:6});
    const ci=NX*0.5|0,cj=NZ*0.5|0,R=10;
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const dx=i-ci,dz=j-cj,r=Math.hypot(dx,dz);if(r>R*2.2)continue;
      const kg=KG[ID2(i,j)],sw=Math.exp(-r*r/(R*R*0.8));
      for(let k=kg;k<NL;k++){
        const id=IDX(i,j,k),tang=9*sw*Math.exp(-k*0.05);
        F.u[id]+=-dz/(r+0.5)*tang;F.v[id]+=dx/(r+0.5)*tang;
        F.p[id]-=6*sw*Math.exp(-k*0.1);
        if(r<R*0.6){F.tp[id]+=5*Math.exp(-k*0.15);F.qv[id]*=1.2;}
      }
    }
  }},
  'cyclone':{name:'Tropical cyclone (approx.)',setup(){
    P.lapseRate=0.5;P.baseRH=0.9;P.windBase=0.8;P.coriolis=1.8;P.solar=0.7;P.timeOfDay=11;P.evap=1.4;
    genTerrain(P.seed,'flat');genSurface('oceanAll');recomputeKG();initAtmos({rh:0.92,windU:0.8});
    const ci=NX*0.5|0,cj=NZ*0.5|0,R=11;
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const dx=i-ci,dz=j-cj,r=Math.hypot(dx,dz);if(r>26)continue;
      const kg=KG[ID2(i,j)],prof=r<R? (r/R):Math.exp(-(r-R)*0.12);
      for(let k=kg;k<NL;k++){
        const id=IDX(i,j,k),tang=13*prof*Math.exp(-k*0.06);
        F.u[id]+=-dz/(r+0.6)*tang*1.5;F.v[id]+=dx/(r+0.6)*tang*1.5;
        F.p[id]-=9*Math.exp(-r*r/(2*R*R/3))*Math.exp(-k*0.12);
        if(r<R*0.35){F.tp[id]+=3.5*Math.exp(-k*0.2);F.qv[id]=Math.min(F.qv[id]*1.3,qsat(k,0)*0.98);}
      }
    }
  }},
  'cold-front':{name:'Cold front',setup(){
    P.lapseRate=0.7;P.baseRH=0.75;P.windBase=5;P.solar=0.75;P.timeOfDay=15;
    genTerrain(P.seed,'hills');genSurface('land');recomputeKG();initAtmos({rh:0.72,windU:5,windV:4});
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const front=i/NX+(j/NZ-0.5)*0.25;const kg=KG[ID2(i,j)];
      for(let k=kg;k<NL;k++){const id=IDX(i,j,k);
        if(front<0.45){F.tp[id]-=5.5*Math.exp(-(k-kg)*0.3);}
        else if(front<0.55){F.tp[id]+=2*Math.exp(-(k-kg)*0.2);F.qv[id]*=1.35;F.v[id]+=3;}
      }
    }
  }},
  'heat-island':{name:'Heat-island thunderstorm',setup(){
    P.lapseRate=0.85;P.baseRH=0.72;P.windBase=1.2;P.solar=1.3;P.timeOfDay=15.5;P.lightningProb=0.6;
    genTerrain(P.seed,'flat');genSurface('land');recomputeKG();
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const dx=i-NX/2,dz=j-NZ/2;if(Math.hypot(dx,dz)<7)Sur[ID2(i,j)]=3;
    }
    initAtmos({rh:0.75,windU:1});
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const dx=i-NX/2,dz=j-NZ/2,r=Math.hypot(dx,dz);if(r>8)continue;
      const kg=KG[ID2(i,j)];for(let k=kg;k<Math.min(kg+4,NL);k++)F.tp[IDX(i,j,k)]+=6*Math.exp(-r*r/30)*Math.exp(-(k-kg)*0.35);
    }
  }},
  'snow-band':{name:'Snow band',setup(){
    P.lapseRate=0.4;P.baseRH=0.8;P.windBase=8;P.solar=0.35;P.timeOfDay=9;P.precipRate=0.7;
    genTerrain(P.seed,'hills');genSurface('land');recomputeKG();initAtmos({rh:0.85,windU:8});
    for(let k=0;k<NL;k++)for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const id=IDX(i,j,k);if(!Solid[id])F.tp[id]=-tbase(k)-4-k*0.4;}
    // moist fetch band
    for(let j=0;j<NZ;j++)for(let i=0;i<NX*0.4;i++)for(let k=KG[ID2(i,j)];k<NL*0.6;k++)F.qv[IDX(i,j,k)]*=1.3;
  }},
  'stress':{name:'Numerical stress test',setup(){
    P.lapseRate=1.15;P.baseRH=0.9;P.windBase=14;P.coriolis=1.2;P.dt=1.4;P.diffusion=0.2;
    P.solar=1.4;P.lightningProb=1;P.terrainInfluence=1.5;
    STRESS=true;
    genTerrain(P.seed,'ridge');genSurface('land');recomputeKG();initAtmos({rh:0.95,tpAmp:6,windU:14,windV:6});
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
      const kg=KG[ID2(i,j)];
      for(let k=kg;k<NL;k++){const id=IDX(i,j,k);F.tp[id]+=(frand()-0.5)*7;F.u[id]+=(frand()-0.5)*8;F.v[id]+=(frand()-0.5)*8;F.qv[id]*=0.9+frand()*0.4;}
    }
  }},
};
let activePreset='fair';
function applyPreset(key){
  STRESS=false;
  const pr=PRESETS[key];if(!pr)return;
  // reset volatile params to sane defaults first
  P.dt=0.8;P.substeps=2;P.coriolis=0.5;P.precipRate=0.55;P.buoyancy=1;P.evap=1;P.condThresh=1;P.diffusion=0.5;P.terrainInfluence=1;P.forceBand=-1;
  activePreset=key;
  const sel=document.getElementById('presetSel');if(sel)sel.value=key;
  pr.setup();
  recomputeKG();
  simTime=0;precipTotal=0;boltList=[];pendingThunders=[];probes=[];
  rebuildTerrainGPU();refreshProbeUI();
  toast(pr.name);
}

// ---------------- simulation step ----------------
const tmpCol={pH:null,N:-1};
function stepSim(dt){
  const u=F.u,v=F.v,w=F.w,tp=F.tp,qv=F.qv,qc=F.qc,qr=F.qr,p=F.p;
  const dx=1,dz=1;
  if(tmpCol.N!==N){tmpCol.pH=new Float32Array(N);tmpCol.N=N;}
  const pH=tmpCol.pH;

  // 1) surface exchange + dynamics sources
  const sunEl=sunElev();
  const solarFlux=Math.max(0,sunEl)*P.solar;
  const surfHeat=[0.20,0.045,0.12,0.30,0.03,0.15];   // per surface type
  const surfEvap=[0.28,1.0,0.5,0.08,0.05,0.18];
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const c=ID2(i,j),kg=KG[c];if(kg>=NL)continue;
    const s=Sur[c],id=IDX(i,j,kg);
    const albedo=s===4?0.4:1;
    F.tp[id]+=solarFlux*surfHeat[s]*albedo*HeatV[c]*dt*(s===3?1.7:1);
    if(s===3)F.tp[id]+=0.05*dt; // anthropogenic heat always on
    const qs=qsat(kg,F.tp[id]);
    const target=qs*clamp(P.baseRH*(s===1?1.3:s===2?1.1:1)*HeatV[c],0,1.0);
    const evap=(target-F.qv[id])*surfEvap[s]*(1+Wet[c])*P.evap*0.45*dt;
    if(evap>0){const de=Math.min(evap,qs*0.99-F.qv[id]);F.qv[id]+=de;F.tp[id]-=Math.min(de*0.35,0.15*dt);}
    Wet[c]*=(1-0.006*dt); if(s===1)Wet[c]=2;
  }
  // 1b) sustained band forcing (squall-line moist inflow); band drifts with flow
  if(P.forceBand>=0){
    const jb=P.forceBand;
    for(let j=Math.max(0,jb-3|0);j<Math.min(NZ,jb+4);j++){
      const dj=Math.abs(j-jb);
      for(let i=0;i<NX;i++){
        const c=ID2(i,j),kg=KG[c];
        for(let k=kg;k<NL;k++){
          const id=IDX(i,j,k);
          const env=Math.exp(-Math.abs(k-6)*0.3)*(1-dj/4);
          if(env>0.05){
            const qs=qsat(k,F.tp[id]);
            if(F.qv[id]<qs*1.3*env)F.qv[id]+=(qs*1.3*env-F.qv[id])*0.5*dt;
            F.tp[id]+=1.5*env*dt;
            if(dj<2)F.qc[id]+=0.3*env*dt;
          }
        }
      }
    }
    P.forceBand+=P.windBase*0.008*dt;
    if(P.forceBand>NZ-4)P.forceBand=-1;
  }
  // 2) buoyancy, pressure, coriolis, base wind relaxation, terrain
  const Kb=P.buoyancy;
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    // column-integrated buoyancy -> hydrostatic pressure proxy
    // (warm/moist column => negative pressure anomaly => low-level inflow)
    const c=ID2(i,j);
    let acc=0;
    for(let k=KG[c];k<NL;k++){
      const id=IDX(i,j,k);
      acc+=Kb*(0.075*tp[id]+0.03*qv[id]-0.5*(qc[id]+qr[id]));
    }
    const ph=-acc*0.5;
    for(let k=0;k<NL;k++)pH[IDX(i,j,k)]=ph;
    for(let k=KG[c];k<NL;k++){
      const id=IDX(i,j,k);
      const b=Kb*(0.075*tp[id]+0.03*qv[id]-0.5*(qc[id]+qr[id]));
      w[id]+=(b-0.15*w[id])*dt;
      p[id]+=(pH[id]*0.08-p[id])*0.45*dt;
      // coriolis
      const f=P.coriolis*0.06*dt;
      const uu=u[id]+f*v[id],vv=v[id]-f*u[id];
      u[id]=uu;v[id]=vv;
      // relax toward base profile (weak — keeps momentum/vortices alive)
      const prof=0.35+0.65*k/NL;
      u[id]+=(P.windBase*prof-u[id])*0.008*dt;
      v[id]+=(0-v[id])*0.008*dt;
    }
    // pressure gradient horizontal accel (low draws in)
    const i1=(i+1)%NX,j1=j+1<NZ?j+1:j;
    for(let k=KG[c];k<NL;k++){
      const id=IDX(i,j,k);
      const gx=(p[IDX(i1,j,k)]-p[id])*0.5, gz=(p[IDX(i,j1,k)]-p[id])*0.5;
      u[id]-=gx*3.5*dt;v[id]-=gz*3.5*dt;
    }
    // terrain drag + orographic lift on near-ground cells
    const hL=Ht[ID2((i-1+NX)%NX,j)],hR=Ht[ID2((i+1)%NX,j)];
    const hD=Ht[ID2(i,j-1<0?j:j-1)],hU=Ht[ID2(i,j+1<NZ?j+1:j)];
    const dhdx=(hR-hL)*0.5,dhdz=(hU-hD)*0.5;
    for(let k=KG[c];k<Math.min(KG[c]+3,NL);k++){
      const id=IDX(i,j,k);
      const lift=-(u[id]*dhdx+v[id]*dhdz)/cellX()*P.terrainInfluence*2.2;
      w[id]+=clamp(lift,-3,3)*dt;
      const drag=0.025*P.terrainInfluence*dt;
      u[id]*=(1-drag);v[id]*=(1-drag);
      // slow ambient moisture flux-convergence in the boundary layer
      // (closed-domain storms otherwise exhaust all vapor and the sky dies)
      if(qv[id]<Q0*0.65*Math.exp(-0.18*(k-KG[c])))F.qv[id]+=0.008*dt;
    }
  }
  // approximate continuity: remove most of the per-layer mean vertical motion,
  // so updraft cores are balanced by subsidence (organizes/patches convection)
  for(let k=0;k<NL;k++){
    let s=0,n=0;
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const id=IDX(i,j,k);if(!Solid[id]){s+=w[id];n++;}}
    if(!n)continue;const m=s/n*0.85;
    for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const id=IDX(i,j,k);if(!Solid[id])w[id]-=m;}
  }
  // stable-stratification adiabatic term: tp += w*(lapse-G)*dt
  const adi=(P.lapseRate-G_AD)*dt;
  for(let id=0;id<N;id++){tp[id]+=w[id]*adi;}
  // 3) microphysics
  const LH=1.15,condT=P.condThresh,pr=P.precipRate;
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const c=ID2(i,j);let prec=0;
    for(let k=NL-1;k>=KG[c];k--){
      const id=IDX(i,j,k);
      // entrainment / environmental drying aloft — keeps free atmosphere
      // subsaturated so cloud only persists inside active updraft plumes
      if(k>NL*0.45){const ef=1-0.02*dt*(k-NL*0.45);if(qv[id]>0.05)qv[id]*=ef;}
      const qs=qsat(k,tp[id]);
      // condensation / evaporation of cloud
      if(qv[id]>qs*condT){const d=Math.min((qv[id]-qs*condT)*0.5,qv[id]);qv[id]-=d;qc[id]+=d;tp[id]+=d*LH;}
      else if(qc[id]>0&&qv[id]<qs*0.8){const d=Math.min(qc[id],(qs*0.8-qv[id])*0.2);qc[id]-=d;qv[id]+=d;if(tp[id]>-5)tp[id]-=d*LH*0.8;}
      // autoconversion to rain
      if(qc[id]>0.35){const d=Math.min(qc[id]-0.25,(qc[id]-0.25)*pr*0.25*dt+qr[id]*qc[id]*0.02*dt);qc[id]-=d;qr[id]+=d;}
      // rain falls one column step
      if(qr[id]>0){
        const cold=(tbase(k)+tp[id])<0;
        const vf=cold?1.2:3.2;
        const fall=Math.min(qr[id],vf*dt/dz);
        qr[id]-=fall;
        if(k-1>=KG[c]){qr[IDX(i,j,k-1)]+=fall;}
        else{prec+=fall;Wet[c]+=fall*2;precipTotal+=fall;}
        // evaporation of falling rain in subsaturated air (bounded — virga, not a heat sink)
        if(qr[id]>0&&qv[id]<qs*0.8&&tp[id]>-4){
          const d=Math.min(qr[id],(qs*0.8-qv[id])*0.12*dt);qr[id]-=d;qv[id]+=d;tp[id]-=d*LH*0.7;}
      }
    }
    Rain2[c]=prec/Math.max(dt,1e-4);
  }
  // 4) advection (semi-Lagrangian) + diffusion
  for(const f of FIELDS)advect(F[f],S[f],dt);
  diffuse(tp,S.tp,P.diffusion*0.10*dt);diffuse(qv,S.qv,P.diffusion*0.10*dt);
  diffuse(qc,S.qc,P.diffusion*0.08*dt);diffuse(p,S.p,0.12*dt+0.02);
  diffuse(u,S.u,0.05*dt);diffuse(v,S.v,0.05*dt);diffuse(w,S.w,0.05*dt);
  // 5) sanitize + stats + charge
  let mUp=0,mW=0,cloudCells=0;
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const c=ID2(i,j);let colQ=0,colUp=0;
    for(let k=KG[c];k<NL;k++){
      const id=IDX(i,j,k);
      let x;
      x=u[id];u[id]=(x!==x)?0:clamp(x,-30,30);
      x=v[id];v[id]=(x!==x)?0:clamp(x,-30,30);
      x=w[id];w[id]=(x!==x)?0:clamp(x,-9,9);
      x=tp[id];tp[id]=(x!==x)?0:clamp(x,-18,40);
      x=qv[id];qv[id]=(x!==x||x<0)?0:Math.min(x,12);
      x=qc[id];qc[id]=(x!==x||x<0)?0:Math.min(x,12);
      x=qr[id];qr[id]=(x!==x||x<0)?0:Math.min(x,12);
      x=p[id];p[id]=(x!==x)?0:clamp(x,-60,60);
      const sp=Math.hypot(u[id],v[id]);if(sp>mW)mW=sp;
      if(w[id]>mUp)mUp=w[id];
      if(w[id]>colUp)colUp=w[id];
      if(qc[id]>0.05)cloudCells++;
      colQ+=qc[id]+qr[id];
    }
    // charge proxy: strong updraft + condensate
    const prod=Math.max(0,colUp-0.6)*colQ*0.006;
    Chg[c]=Math.max(0,Chg[c]*(1-0.02*dt)+prod*dt*60);
  }
  maxUp=mUp;maxWind=mW;
  cloudCoverAvg=cloudCells/Math.max(1,N-NXZ_solid());
  chargeMax=0;
  for(let c=0;c<NX*NZ;c++)if(Chg[c]>chargeMax)chargeMax=Chg[c];
  // automatic lightning
  if(chargeMax>6&&frand()<P.lightningProb*dt*(chargeMax/14)){
    // find strike cell near charge max
    let best=0,bv=0;for(let c=0;c<NX*NZ;c++)if(Chg[c]>bv){bv=Chg[c];best=c;}
    strikeAt(best%NX,(best/NX)|0,1);
  }
  simTime+=dt;
}
let _sol=0;function NXZ_solid(){return Math.max(0,_sol);}
function advect(A,B,dt){
  // B <- A advected; then copy back
  for(let k=0;k<NL;k++)for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const id=IDX(i,j,k);
    if(Solid[id]){B[id]=0;continue;}
    let sx=i-F.u[id]*dt, sy=j-F.v[id]*dt, sz=k-F.w[id]*dt;
    // periodic in x, clamp in z & y
    sx=((sx%NX)+NX)%NX;sy=clamp(sy,0,NZ-1.001);
    const i0=sx|0,i1=(i0+1)%NX,j0=sy|0,j1=j0+1;
    // never sample below terrain of the backtraced column (prevents mass bleed)
    const kg=Math.max(KG[ID2(i0,j0)],KG[ID2(i1,j0)]);
    sz=clamp(sz,kg,NL-1.001);
    const k0=sz|0,k1=k0+1;
    const fx=sx-i0,fy=sy-j0,fz=sz-k0;
    const a00=lerp(A[IDX(i0,j0,k0)],A[IDX(i1,j0,k0)],fx);
    const a10=lerp(A[IDX(i0,j1,k0)],A[IDX(i1,j1,k0)],fx);
    const a01=lerp(A[IDX(i0,j0,k1)],A[IDX(i1,j0,k1)],fx);
    const a11=lerp(A[IDX(i0,j1,k1)],A[IDX(i1,j1,k1)],fx);
    B[id]=lerp(lerp(a00,a10,fy),lerp(a01,a11,fy),fz);
  }
  A.set(B);
}
function diffuse(A,B,k){
  if(k<=0.0005)return;k=Math.min(k,0.2);
  for(let z=0;z<NL;z++)for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const id=IDX(i,j,z);
    if(Solid[id]){B[id]=A[id];continue;}
    const l=A[IDX((i-1+NX)%NX,j,z)],r=A[IDX((i+1)%NX,j,z)];
    const d=A[IDX(i,j-1<0?j:j-1,z)],u2=A[IDX(i,j+1<NZ?j+1:j,z)];
    const dn=z>0?A[IDX(i,j,z-1)]:A[id],up=z<NL-1?A[IDX(i,j,z+1)]:A[id];
    B[id]=A[id]+k*(l+r+d+u2+dn+up-6*A[id]);
  }
  A.set(B);
}
// sun
function sunElev(){const a=(P.timeOfDay-6)/12*Math.PI;return Math.sin(a);}
function sunDir(){
  const a=(P.timeOfDay-6)/12*Math.PI;
  const el=Math.max(0.02,Math.sin(a)),az=a*0.6+Math.PI*0.5;
  const e=Math.max(0.06,el);
  return norm3([Math.cos(az)*Math.sqrt(Math.max(0,1-e*e)),e,Math.sin(az)*Math.sqrt(Math.max(0,1-e*e))]);
}
function norm3(v){const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l];}
