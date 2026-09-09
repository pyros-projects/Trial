/* ============================================================================
   Evolutionary Ecosystem Laboratory — simulation core (DOM-free, Node-safe)
   ==========================================================================*/
const SIM = (() => {

// ---------------------------------------------------------------- utilities
class RNG {
  constructor(seed){ this.s=(seed>>>0)||1; }
  next(){ let a=this.s|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a);
          t=t+Math.imul(t^t>>>7,61|t)^t; this.s=a;
          return ((t^t>>>14)>>>0)/4294967296; }
  range(a,b){ return a+(b-a)*this.next(); }
  int(n){ return Math.floor(this.next()*n); }
  gauss(){ return (this.next()+this.next()+this.next()-1.5)*1.1547; }
}
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const TAU=Math.PI*2;

function hash2(x,y,seed){ let h=(seed|0)^Math.imul(x|0,374761393)^Math.imul(y|0,668265263);
  h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; }
const smooth=t=>t*t*(3-2*t);
function vnoise(x,y,seed){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const a=hash2(xi,yi,seed),b=hash2(xi+1,yi,seed),c=hash2(xi,yi+1,seed),d=hash2(xi+1,yi+1,seed);
  const u=smooth(xf),v=smooth(yf);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbm(x,y,seed,oct){ let v=0,amp=.5,f=1;
  for(let i=0;i<oct;i++){ v+=amp*vnoise(x*f,y*f,seed+i*1013); f*=2; amp*=.5; } return v; }

// ------------------------------------------------------------------ genome
// name, min, max, distance weight
const GENES=[
  ['size',            0.55, 2.2,  2.0],
  ['speed',           0.30, 1.9,  2.0],
  ['turn',            0.40, 2.0,  1.0],
  ['vision',          45,   260,  1.5],
  ['metab',           0.55, 1.6,  1.0],
  ['digest',          0.40, 0.85, 1.5],
  ['dietPlant',       0,    1,    2.5],
  ['dietMeat',        0,    1,    2.5],
  ['dietCarrion',     0,    1,    1.5],
  ['aggression',      0,    1,    2.0],
  ['fear',            0,    1,    1.0],
  ['camo',            0,    1,    1.0],
  ['fertThreshold',   0.45, 0.92, 1.0],
  ['offspringInvest', 0.12, 0.45, 1.0],
  ['comfort',        -6,    32,   1.5],
  ['tolerance',       2.5,  18,   1.0],
  ['lifespan',        900,  7000, 1.5],
];
const NG=GENES.length;
const gi={}; GENES.forEach((g,i)=>gi[g[0]]=i);

// neural controller: 17 inputs -> 10 tanh hidden -> 3 outputs (turn, thrust, sprint)
const NIN=17,NH=10,NOUT=3;
const NW=NIN*NH+NH+NH*NOUT+NOUT;

function genomeDistance(a,b){
  let s=0,ws=0;
  for(let i=0;i<NG;i++){ const G=GENES[i];
    const d=(a.g[i]-b.g[i])/(G[2]-G[1]); s+=G[3]*d*d; ws+=G[3]; }
  let w2=0; const wa=a.w,wb=b.w;
  for(let j=0;j<NW;j++){ const d=wa[j]-wb[j]; w2+=d*d; }
  const wDist=Math.sqrt(w2/NW)/1.1;
  return Math.sqrt(s/ws+0.3*wDist*wDist);
}

function roleOf(g){
  const mp=g[gi.dietPlant], mm=g[gi.dietMeat]*Math.max(0.35,g[gi.aggression]), mc=g[gi.dietCarrion];
  if(mp>=mm&&mp>=mc) return mp<0.3?'Omnivore':'Herbivore';
  if(mm>=mc) return 'Predator';
  return 'Scavenger';
}

const SYL=['ka','ve','lo','mi','ta','ru','zen','or','an','bel','dor','ith','ul','pra','sek','mor','al','yn','ix','qua'];
function speciesName(rng){ const n=2+((rng.next()*2)|0); let s='';
  for(let i=0;i<n;i++) s+=SYL[rng.int(SYL.length)];
  return s[0].toUpperCase()+s.slice(1); }

// --------------------------------------------------------------- parameters
const DEFAULT_PARAMS={
  mutationRate:0.09, mutationMag:0.10, crossover:true,
  plantGrowth:1.0, plantCapacity:1.4, metabCost:1.0, reproMul:1.0, sensorMul:1.0,
  climateAmp:0.5, dayLength:1400, yearDays:14,
  speciation:0.34, popCap:2600, plantCap:7000, predEff:1.0,
};
const WORLD_SIZES={ Small:[1700,1150], Medium:[2500,1700], Large:[3600,2500] };

const PRESETS={
  meadow:     {name:'Balanced meadow',            size:'Medium', env:{fert:1,moist:1,sea:0.33},            pops:{herb:110,pred:16,scav:12,plants:900},  mut:{rate:.09,mag:.10}, climateAmp:.5},
  oscillation:{name:'Predator–prey oscillation',  size:'Medium', env:{fert:1.05,moist:.95,sea:0.36},       pops:{herb:170,pred:8,scav:8,plants:700},   mut:{rate:.06,mag:.08}, climateAmp:.35},
  islands:    {name:'Island isolation',           size:'Large',  env:{fert:1,moist:1.1,sea:0.52},          pops:{herb:80,pred:10,scav:10,plants:600},  mut:{rate:.10,mag:.12}, climateAmp:.5},
  desert:     {name:'Harsh desert',               size:'Medium', env:{fert:.72,moist:.6,sea:0.20},         pops:{herb:26,pred:4,scav:6,plants:380},    mut:{rate:.08,mag:.10}, climateAmp:.6},
  radiation:  {name:'Rapid radiation',            size:'Large',  env:{fert:1.1,moist:1,sea:0.44},          pops:{herb:110,pred:12,scav:12,plants:650}, mut:{rate:.30,mag:.22}, climateAmp:.5},
  extinction: {name:'Mass extinction & recovery', size:'Medium', env:{fert:1,moist:1,sea:0.33},            pops:{herb:130,pred:18,scav:14,plants:700}, mut:{rate:.10,mag:.12}, climateAmp:.5,
               scripted:[{tick:500,type:'meteor'},{tick:1100,type:'coldsnap'},{tick:2200,type:'bloom'}]},
  dense:      {name:'Dense stress test',          size:'Large',  env:{fert:1.25,moist:1.1,sea:0.30},       pops:{herb:1100,pred:130,scav:90,plants:1400}, mut:{rate:.09,mag:.10}, climateAmp:.4},
};

// ------------------------------------------------------------------ terrain
const CELL=50;
class World {
  constructor(opts={}){
    this.params=Object.assign({},DEFAULT_PARAMS,opts.params||{});
    this.init(opts.seed??1234,opts.preset??'meadow',opts.overrides||{});
  }

  init(seed,presetKey,overrides={}){
    const P=PRESETS[presetKey]||PRESETS.meadow;
    this.seed=seed>>>0||1; this.presetKey=presetKey;
    this.rng=new RNG(this.seed);
    const [W,H]=WORLD_SIZES[overrides.size||P.size]||WORLD_SIZES.Medium;
    this.W=W; this.H=H;
    this.cols=Math.ceil(W/CELL); this.rows=Math.ceil(H/CELL); this.nCells=this.cols*this.rows;

    Object.assign(this.params,{mutationRate:P.mut.rate,mutationMag:P.mut.mag,climateAmp:P.climateAmp});

    // --- terrain (hash noise ⇒ deterministic without consuming rng)
    const env=P.env,seedN=this.seed;
    this.type=new Uint8Array(this.nCells);
    this.fert=new Float32Array(this.nCells);
    this.moist=new Float32Array(this.nCells);
    this.tOff=new Float32Array(this.nCells);
    this.plantCnt=new Int16Array(this.nCells);
    const sc=3.1/Math.max(W,H);
    for(let cy=0;cy<this.rows;cy++)for(let cx=0;cx<this.cols;cx++){
      const i=cy*this.cols+cx,x=cx*CELL,y=cy*CELL;
      const elev=fbm(x*sc,y*sc,seedN,4);
      const mo=clamp(fbm(x*sc*1.7+50,y*sc*1.7+50,seedN+77,3)*1.25*env.moist-.12,0,1);
      this.type[i]=elev<env.sea?2:(elev>env.sea+0.34?1:0);
      this.fert[i]=clamp((0.18+0.95*mo+(fbm(x*sc*2.3+90,y*sc*2.3+90,seedN+31,2)-.5)*.5)*env.fert,0,1);
      this.moist[i]=mo;
      this.tOff[i]=(fbm(x*sc*.9+140,y*sc*.9+140,seedN+55,2)-.5)*2;
    }

    this.tick=0; this.nextId=1; this.nextSpId=1; this.nextPlantId=1;
    this.species=[]; this.spById=new Map(); this.byId=new Map();
    this.organisms=[]; this.plants=[]; this.corpses=[];
    this.history=[]; this.sampleTick=-1e9;
    this.birthsSince=0; this.deathsSince=0;
    this.event=null; this.scripted=(P.scripted||[]).slice();
    this.reserve=null; this.stats=null; this.deathCauses={};
    this.moistMul=1; this.tempAdd=0; this.fertBoost=0;
    this.terrainDirty=true;
    this._nearBuf=new Array(512); this._h=new Map(); this._CS=100;
    this.plantH=new Map();                              // spatial plant index
    this._climateCache();

    this._initialPlants(P.pops.plants);

    // --- founder species + initial populations (interleaved ⇒ order-free)
    const founders={};
    const found=r=>{ if(!founders[r]) founders[r]=this._foundSpecies({g:this._templateGenome(r,0),w:this._templateWeights(0)},null); return founders[r]; };
    const roles=[];
    for(let k=0;k<P.pops.herb;k++) roles.push('Herbivore');
    for(let k=0;k<P.pops.pred;k++) roles.push('Predator');
    for(let k=0;k<P.pops.scav;k++) roles.push('Scavenger');
    for(let i=roles.length-1;i>0;i--){ const j=this.rng.int(i+1); [roles[i],roles[j]]=[roles[j],roles[i]]; }
    for(const role of roles){
      const pos=this._randLandPos(); if(!pos) continue;
      const g=this._templateGenome(role,.06), w=this._templateWeights(.12);
      const emul=role==='Predator'?0.78:(role==='Scavenger'?0.7:0.72);
      this.organisms.push(this._birthOrganism({g,w,x:pos.x,y:pos.y,pa:0,sp:found(role),gen:0,energyMul:emul}));
    }
    this.byId.clear();
    for(const o of this.organisms) this.byId.set(o.id,o);
    this.sample(true);
  }

  // ------------------------------------------------------------ terrain api
  cellAt(x,y){ const cx=clamp(Math.floor(x/CELL),0,this.cols-1),cy=clamp(Math.floor(y/CELL),0,this.rows-1);
    return cy*this.cols+cx; }
  passable(x,y){ return this.type[this.cellAt(x,y)]===0; }
  tempAt(x,y){
    const i=this.cellAt(x,y);
    const row=y>=this.H?this.rows-1:(y<0?0:Math.floor(y/CELL));
    return this._rowBase[row]+this._yearTemp+this.tOff[i]*this._tOffScale+this.tempAdd;
  }
  light(){ const d=(this.tick%this.params.dayLength)/this.params.dayLength;
    return clamp(0.18+0.82*Math.sin(d*TAU),0,1); }

  applyBrush(x,y,r,kind,strength){
    const c0x=clamp(Math.floor((x-r)/CELL),0,this.cols-1),c1x=clamp(Math.floor((x+r)/CELL),0,this.cols-1);
    const c0y=clamp(Math.floor((y-r)/CELL),0,this.rows-1),c1y=clamp(Math.floor((y+r)/CELL),0,this.rows-1);
    for(let cy=c0y;cy<=c1y;cy++)for(let cx=c0x;cx<=c1x;cx++){
      const i=cy*this.cols+cx;
      const dx=cx*CELL+CELL/2-x,dy=cy*CELL+CELL/2-y;
      if(dx*dx+dy*dy>r*r) continue;
      switch(kind){
        case 'fert':  this.fert[i]=clamp(this.fert[i]+.05*strength,0,1); break;
        case 'moist': this.moist[i]=clamp(this.moist[i]+.05*strength,0,1); break;
        case 'heat':  this.tOff[i]=clamp(this.tOff[i]+.09*strength,-2.5,2.5); break;
        case 'cool':  this.tOff[i]=clamp(this.tOff[i]-.09*strength,-2.5,2.5); break;
        case 'barrier': if(this.type[i]!==1){ this.type[i]=1; this._clearPlantsInCell(i);} break;
        case 'erase': if(this.type[i]===1) this.type[i]=0; break;
        case 'food':  if(this.type[i]===0&&this.plants.length<this.params.plantCap&&this.rng.next()<.5*strength)
                        this.spawnPlant(x+this.rng.gauss()*r*.4,y+this.rng.gauss()*r*.4,this.rng.range(6,16)); break;
      }
    }
    this.terrainDirty=true;
  }

  reserveSet(x0,y0,x1,y1){ this.reserve={x0:Math.min(x0,x1),y0:Math.min(y0,y1),x1:Math.max(x0,x1),y1:Math.max(y0,y1)}; }
  inReserve(x,y){ const r=this.reserve; return !!r&&x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1; }

  // --------------------------------------------------------------- spawning
  spawnPlant(x,y,e){
    if(x<4||y<4||x>=this.W-4||y>=this.H-4) return null;
    const i=this.cellAt(x,y);
    if(this.type[i]!==0||this.plants.length>=this.params.plantCap) return null;
    const pl={id:this.nextPlantId++,x,y,e:e??this.rng.range(4,16),maxE:26+20*this.fert[i],cell:i};
    this.plants.push(pl); this.plantCnt[i]++;
    this._plantAdd(pl);
    return pl;
  }
  _pKey(x,y){ return (Math.floor(x/100))*73856093^(Math.floor(y/100))*19349663; }
  _plantAdd(pl){ const k=this._pKey(pl.x,pl.y); let a=this.plantH.get(k); if(!a){a=[];this.plantH.set(k,a);} a.push(pl); }
  _plantDel(pl){ const k=this._pKey(pl.x,pl.y),a=this.plantH.get(k); if(!a) return;
    const i=a.indexOf(pl); if(i>=0){ a[i]=a[a.length-1]; a.pop(); } }
  _removePlant(k){
    const pl=this.plants[k];
    this.plantCnt[pl.cell]--; this._plantDel(pl);
    const last=this.plants.pop();
    if(k<this.plants.length) this.plants[k]=last;
  }
  _clearPlantsInCell(i){
    for(let k=this.plants.length-1;k>=0;k--)
      if(this.plants[k].cell===i) this._removePlant(k);
  }

  spawnOrganism(role,x,y){
    const rl=role==='predator'?'Predator':role==='scavenger'?'Scavenger':role==='herbivore'?'Herbivore':null;
    if(!rl) return this.spawnPlant(x,y);
    if(!this.passable(x,y)){
      let best=null,bd=1e9;
      for(let t=0;t<24;t++){ const px=x+this.rng.gauss()*70,py=y+this.rng.gauss()*70;
        if(this.passable(px,py)){ const d=(px-x)**2+(py-y)**2; if(d<bd){bd=d;best=[px,py];} } }
      if(!best) return null; x=best[0]; y=best[1];
    }
    if(this.organisms.length>=this.params.popCap) return null;
    const g=this._templateGenome(rl,.06), w=this._templateWeights(.12);
    // reuse nearest existing species unless clearly novel
    let spId=null,bd=1e9;
    for(const sp of this.species){ const d=genomeDistance({g,w},sp.cent); if(d<bd){bd=d;spId=sp.id;} }
    if(bd>0.25) spId=this._foundSpecies({g,w},null);
    const org=this._birthOrganism({g,w,x,y,pa:0,sp:spId,gen:0,energyMul:.7});
    this.organisms.push(org); this.byId.set(org.id,org);
    return org;
  }

  removeAt(x,y,r){
    let n=0;
    for(let k=this.organisms.length-1;k>=0;k--){ const o=this.organisms[k];
      const dx=o.x-x,dy=o.y-y; if(dx*dx+dy*dy<r*r){ o._dead=true; o.cause='removed'; n++; } }
    this._reap();
    for(let k=this.plants.length-1;k>=0;k--){ const p=this.plants[k];
      const dx=p.x-x,dy=p.y-y; if(dx*dx+dy*dy<r*r){ this._removePlant(k); n++; } }
    for(let k=this.corpses.length-1;k>=0;k--){ const c=this.corpses[k];
      const dx=c.x-x,dy=c.y-y; if(dx*dx+dy*dy<r*r){ this.corpses[k]=this.corpses[this.corpses.length-1]; this.corpses.pop(); n++; } }
    return n;
  }

  // ----------------------------------------------------------- interventions
  intervention(type){
    switch(type){
      case 'drought':  this.event={type,dur:2600,t0:this.tick}; break;
      case 'bloom':    this.event={type,dur:1400,t0:this.tick}; break;
      case 'coldsnap': this.event={type,dur:1800,t0:this.tick}; break;
      case 'heatwave': this.event={type,dur:1800,t0:this.tick}; break;
      case 'disease':  this.event={type,dur:2400,t0:this.tick}; break;
      case 'meteor':{ const pos=this._randLandPos()||{x:this.W/2,y:this.H/2};
        this.meteorAt(pos.x,pos.y);
        this.event={type:'meteor',dur:400,t0:this.tick,info:`impact (${pos.x|0}, ${pos.y|0})`}; break; }
      case 'wildfire':{ const pos=this._randLandPos()||{x:this.W/2,y:this.H/2};
        this.wildfireAt(pos.x,pos.y);
        this.event={type:'wildfire',dur:300,t0:this.tick,info:`(${pos.x|0}, ${pos.y|0})`}; break; }
      case 'foodpulse':{ const pos=this._randLandPos()||{x:this.W/2,y:this.H/2};
        for(let k=0;k<320;k++){ const a=this.rng.next()*TAU,r=this.rng.next()*260;
          this.spawnPlant(pos.x+Math.cos(a)*r,pos.y+Math.sin(a)*r,this.rng.range(8,20)); }
        this.event={type:'foodpulse',dur:200,t0:this.tick,info:`cluster at (${pos.x|0}, ${pos.y|0})`}; break; }
      case 'predators':{ let n=0;
        for(let t=0;t<40&&n<10;t++){ const o=this.organisms[this.rng.int(this.organisms.length)];
          if(o){ const org=this.spawnOrganism('predator',o.x+this.rng.gauss()*120,o.y+this.rng.gauss()*120); if(org)n++; } }
        this.event={type:'predators',dur:200,t0:this.tick,info:`+${n} predators`}; break; }
    }
  }
  meteorAt(x,y){
    const R=240;
    for(let k=this.organisms.length-1;k>=0;k--){ const o=this.organisms[k];
      if(this.inReserve(o.x,o.y)) continue;
      const d=Math.hypot(o.x-x,o.y-y);
      if(d<R) this._kill(o,'meteor');
      else if(d<R*2){ o.health-=18*(1-d/(R*2)); if(o.health<=0) this._kill(o,'meteor'); } }
    this._reap();
    for(let k=this.plants.length-1;k>=0;k--){ const p=this.plants[k];
      if(Math.hypot(p.x-x,p.y-y)<R*1.6) this._removePlant(k); }
    this.applyBrush(x,y,R*0.7,'barrier',1);
    this.applyBrush(x,y,R*1.7,'fert',2.2);
  }
  wildfireAt(x,y){
    const R=320;
    for(let k=this.organisms.length-1;k>=0;k--){ const o=this.organisms[k];
      if(this.inReserve(o.x,o.y)) continue;
      const d=Math.hypot(o.x-x,o.y-y);
      if(d<R){ o.health-=22*(1-d/R)+6; if(o.health<=0) this._kill(o,'wildfire'); } }
    this._reap();
    for(let k=this.plants.length-1;k>=0;k--){ const p=this.plants[k];
      if(Math.hypot(p.x-x,p.y-y)<R) this._removePlant(k); }
    this.applyBrush(x,y,R,'fert',0.8);
  }

  // ---------------------------------------------------------------- genetics
  _templateGenome(role,jitter=0){
    const g=new Float32Array(NG);
    const t={};
    if(role==='Herbivore'){ t.size=1.0;t.speed=.95;t.vision=150;t.dietPlant=.8;t.dietMeat=.05;t.dietCarrion=.15;t.aggression=.14;t.fear=.6;t.comfort=16;t.tolerance=13;t.lifespan=3400;t.metab=1;t.fertThreshold=.62; }
    else if(role==='Predator'){ t.size=1.45;t.speed=1.5;t.vision=255;t.dietPlant=.04;t.dietMeat=.75;t.dietCarrion=.45;t.aggression=.68;t.fear=.1;t.comfort=15;t.tolerance=12;t.lifespan=4800;t.metab=.7;t.fertThreshold=.5; }
    else { t.size=.8;t.speed=.85;t.vision=130;t.dietPlant=.12;t.dietMeat=.15;t.dietCarrion=.72;t.aggression=.1;t.fear=.7;t.comfort=17;t.tolerance=12;t.lifespan=3000;t.metab=.9; }
    for(let i=0;i<NG;i++){ const G=GENES[i];
      const base=t[G[0]]!=null?t[G[0]]:(G[1]+G[2])/2;
      g[i]=clamp(base+this.rng.gauss()*jitter*(G[2]-G[1]),G[1],G[2]); }
    return g;
  }
  // Innate reflex arc: hidden units relay sensor lines to outputs so that
  // first-generation organisms already steer toward food/mates/prey and away
  // from threats/obstacles. All weights stay mutable — evolution refines them.
  _templateWeights(jitter=0){
    const w=new Float32Array(NW);
    const B=NIN*NH;                       // hidden biases
    const O=B+NH;                         // output weight block
    const relay=(j,i,gain=1)=>{ w[j*NIN+i]=gain; };   // hidden j ← input i
    const outw=(k,j,gain)=>{ w[O+k*NH+j]=gain; };     // output k ← hidden j
    relay(0,1);  outw(0,0, 2.2);                        // food side   → turn toward
    relay(1,3);  outw(0,1,-2.4);                        // threat side → turn away
    relay(2,5);  outw(0,2, 1.6);                        // prey side   → turn toward
    relay(5,7);  outw(0,5, 1.2);                        // mate side
    relay(7,9);  outw(0,7, 1.8);                        // obstacle free-side
    relay(3,0);  relay(3,4); outw(1,3, 1.3);            // food/prey ahead → thrust
    relay(4,2);  outw(1,4,-1.1); outw(2,4,-0.9);        // threat ahead → slow; sprint
    outw(2,2, 0.9);                                     // prey close → lunge sprint
    relay(6,6);  outw(1,6, 0.6);                        // mate ahead
    relay(8,8);  outw(1,8,-0.8);                        // obstacle urgency → slow
    relay(9,16,-0.6); relay(9,11,1.2); outw(1,9, 0.55); outw(2,9,-0.45); // hungry → cruise, full → rest
    for(let j=0;j<NW;j++) w[j]+=this.rng.gauss()*0.35*(1+jitter*2);
    return w;
  }
  _foundSpecies(genome,parentSp){
    const id=this.nextSpId++;
    const rng=new RNG((this.seed^Math.imul(id,0x9e3779b9))|1);
    const sp={id,name:speciesName(rng),hue:(rng.next()*360)|0,
      cent:{g:genome.g.slice(),w:genome.w.slice()},
      parent:parentSp||null,born:this.tick,extinct:null};
    this.species.push(sp); this.spById.set(id,sp);
    return id;
  }
  _mutate(g,w){
    const p=this.params,rate=p.mutationRate,mag=p.mutationMag;
    let muts=0;
    for(let i=0;i<NG;i++) if(this.rng.next()<rate){
      g[i]=clamp(g[i]+this.rng.gauss()*mag*(GENES[i][2]-GENES[i][1]),GENES[i][1],GENES[i][2]); muts++; }
    for(let j=0;j<NW;j++) if(this.rng.next()<rate){ w[j]+=this.rng.gauss()*mag*1.6; muts++; }
    return muts;
  }
  _crossover(a,b){
    const g=new Float32Array(NG),w=new Float32Array(NW);
    for(let i=0;i<NG;i++) g[i]=this.rng.next()<.5?a.g[i]:b.g[i];
    for(let j=0;j<NW;j++) w[j]=this.rng.next()<.5?a.w[j]:b.w[j];
    return {g,w};
  }
  _birthOrganism(o){
    const g=o.g,size=g[gi.size];
    const maxE=45+55*size,maxH=8+9*size;
    return {
      id:this.nextId++, x:o.x, y:o.y, heading:this.rng.next()*TAU, speed:0,
      g, w:o.w, energy:maxE*(o.energyMul??.6), health:maxH, maxH, maxE,
      sizePow:Math.pow(size,0.75),
      age:0, gen:o.gen, spId:o.sp??0, pa:o.pa, kids:0, desc:0, muts:o.muts||0,
      born:this.tick, cd:120+this.rng.int(160), an:o.an||[],
      role:roleOf(g), state:'—', in:null, out:new Float32Array(NOUT),
      tgtType:null, tgtId:0, _threat:0,_prey:0,_mate:0,_crowd:0,
      infected:false, immune:false, infT:0, _dead:false, cause:null, _sensedTick:0,
    };
  }

  // -------------------------------------------------------------- main step
  _climateCache(){
    const p=this.params;
    if(!this._rowBase||this._rowAmp!==p.climateAmp||this._rowH!==this.H){
      this._rowBase=new Float32Array(this.rows); this._rowAmp=p.climateAmp; this._rowH=this.H;
      for(let r=0;r<this.rows;r++) this._rowBase[r]=2+26*Math.cos(((r+0.5)*CELL/this.H)*Math.PI);
      this._tOffScale=7*p.climateAmp;
    }
    this._yearTemp=Math.sin((this.tick/(p.dayLength*p.yearDays))*TAU)*p.climateAmp*9;
  }

  step(){
    const p=this.params;
    this.tick++;
    this._climateCache();   // per-tick climate caches (tempAt is hot)

    if(this.scripted.length&&this.tick>=this.scripted[0].tick) this.intervention(this.scripted.shift().type);

    if(this.event){
      const e=this.event,dt=this.tick-e.t0;
      if(e.type==='drought')  this.moistMul=dt<e.dur*.6?Math.max(.42,1-dt/(e.dur*.6)*.58):lerp2(.42,1,(dt-e.dur*.6)/(e.dur*.4));
      if(e.type==='coldsnap') this.tempAdd=dt<e.dur*.5?lerp2(0,-11,dt/(e.dur*.5)):lerp2(-11,0,(dt-e.dur*.5)/(e.dur*.5));
      if(e.type==='heatwave') this.tempAdd=dt<e.dur*.5?lerp2(0,11,dt/(e.dur*.5)):lerp2(11,0,(dt-e.dur*.5)/(e.dur*.5));
      if(e.type==='bloom')    this.fertBoost=dt<e.dur*.5?lerp2(0,.32,dt/(e.dur*.5)):lerp2(.32,0,(dt-e.dur*.5)/(e.dur*.5));
      if(dt>=e.dur){ this.event=null; this.moistMul=1; this.tempAdd=0; this.fertBoost=0; }
    }

    if(this.tick%4===0) this._stepPlants(4);
    if(this.tick%8===0) this._stepCorpses(8);

    this._buildHash();
    const born=[];
    const orgs=this.organisms;
    for(let k=0;k<orgs.length;k++){
      const o=orgs[k];
      if(o._dead) continue;
      this._stepOrganism(o,born);
    }
    this._reap();
    for(const b of born){ this.organisms.push(b); this.byId.set(b.id,b); }

    if(this.tick-this.sampleTick>=20) this.sample(false);
  }
  _reap(){
    const orgs=this.organisms;
    let w=0;
    for(let k=0;k<orgs.length;k++){
      const o=orgs[k];
      if(o._dead){ this.byId.delete(o.id); this._deathBook(o); continue; }
      orgs[w++]=o;
    }
    if(w!==orgs.length) orgs.length=w;
  }
  _deathBook(o){
    if(o.cause==='removed') return;
    this.deathsSince++;
    this.deathCauses[o.cause]=(this.deathCauses[o.cause]||0)+1;
  }

  _stepPlants(dt){
    const p=this.params,light=this.light();
    for(let k=this.plants.length-1;k>=0;k--){
      const pl=this.plants[k];
      const fert=clamp(this.fert[pl.cell]+this.fertBoost,0,1);
      const mo=clamp(this.moist[pl.cell]*this.moistMul,0,1);
      const suit=1-clamp(Math.abs(this.tempAt(pl.x,pl.y)-15)/24,0,1);
      const env=clamp(fert*mo*suit,0,1)*(0.25+0.75*light)*(this.inReserve(pl.x,pl.y)?1.35:1);
      pl.e=Math.min(pl.maxE,pl.e+0.22*env*dt*p.plantGrowth);
      const cap=Math.round((1+4*fert)*p.plantCapacity);
      if(pl.e>pl.maxE*0.72&&this.plantCnt[pl.cell]<cap&&this.rng.next()<0.028*env){
        const a=this.rng.next()*TAU,r=this.rng.range(20,150);
        this.spawnPlant(pl.x+Math.cos(a)*r,pl.y+Math.sin(a)*r,this.rng.range(3,8));
      }
      if(pl.e<=0.5&&this.rng.next()<0.02) this._removePlant(k);
    }
  }
  _stepCorpses(dt){
    for(let k=this.corpses.length-1;k>=0;k--){
      const c=this.corpses[k];
      c.age+=dt; c.e-=dt*0.004*c.e0;
      if(c.e<=0){
        const i=this.cellAt(c.x,c.y);
        this.fert[i]=clamp(this.fert[i]+0.02,0,1);   // decomposition feeds the soil
        this.corpses[k]=this.corpses[this.corpses.length-1]; this.corpses.pop();
      }
    }
  }

  _buildHash(){
    const h=this._h; h.clear(); this.byId.clear();
    const CS=this._CS;
    for(const o of this.organisms){
      this.byId.set(o.id,o);
      const key=(Math.floor(o.x/CS))*73856093^(Math.floor(o.y/CS))*19349663;
      let arr=h.get(key); if(!arr){arr=[];h.set(key,arr);} arr.push(o);
    }
  }
  _near(x,y,r){
    const CS=this._CS,out=this._nearBuf; let n=0;
    const x0=Math.floor((x-r)/CS),x1=Math.floor((x+r)/CS),y0=Math.floor((y-r)/CS),y1=Math.floor((y+r)/CS);
    for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){
      const arr=this._h.get((cx*73856093)^(cy*19349663));
      if(!arr) continue;
      for(let k=0;k<arr.length;k++){ const o=arr[k];
        const dx=o.x-x,dy=o.y-y;
        if(dx*dx+dy*dy<=r*r&&n<out.length) out[n++]=o; }
    }
    out.length=n; return out;
  }

  _nnForward(o){
    const w=o.w,inp=o.in,hid=NN.h,out=o.out;
    let idx=0;
    for(let j=0;j<NH;j++){
      let s=0; for(let i=0;i<NIN;i++) s+=w[idx++]*inp[i];
      hid[j]=Math.tanh(s+w[NIN*NH+j]);
    }
    idx=NIN*NH+NH;
    for(let k=0;k<NOUT;k++){
      let s=0; for(let j=0;j<NH;j++) s+=w[idx++]*hid[j];
      out[k]=Math.tanh(s+w[NIN*NH+NH+NH*NOUT+k]);
    }
  }

  _stepOrganism(o,born){
    const p=this.params,g=o.g,size=g[gi.size];
    o.age+=1;
    const light=this.light();

    // ---- sense + decide (alternating halves per tick for throughput)
    if(!o.in) o.in=new Float32Array(NIN);
    if(((this.tick+o.id)&1)===0||this.tick-o._sensedTick>1){ this._sense(o,light); o._sensedTick=this.tick; }
    this._nnForward(o);
    const out=o.out,inArr=o.in;

    const threatStr=Math.sqrt(inArr[2]*inArr[2]+inArr[3]*inArr[3]),preyStr=Math.sqrt(inArr[4]*inArr[4]+inArr[5]*inArr[5]),
          foodStr=Math.sqrt(inArr[0]*inArr[0]+inArr[1]*inArr[1]),mateStr=Math.sqrt(inArr[6]*inArr[6]+inArr[7]*inArr[7]);
    o.state=
      threatStr>0.35&&out[1]<0.2?'Fleeing':
      preyStr>0.3&&g[gi.dietMeat]>0.25&&g[gi.aggression]>0.25?'Hunting':
      foodStr>0.3?'Foraging':
      mateStr>0.3&&o.energy>g[gi.fertThreshold]*o.maxE*.8?'Courting':
      Math.abs(out[1])<0.15?'Resting':'Wandering';

    // ---- movement
    const discomfort=clamp(Math.abs(this.tempAt(o.x,o.y)-g[gi.comfort])/g[gi.tolerance],0,1.5);
    o.heading+=out[0]*g[gi.turn];
    const sprint=1+0.7*clamp(out[2],0,1);
    const sp=Math.max(0,out[1])*g[gi.speed]*1.35*sprint;
    o.speed=sp;
    if(sp>0.01){
      const nx=o.x+Math.cos(o.heading)*sp,ny=o.y+Math.sin(o.heading)*sp;
      if(this.passable(nx,ny)){ o.x=clamp(nx,2,this.W-2); o.y=clamp(ny,2,this.H-2); }
      else{
        const a=o.heading+1.2;
        const sx=o.x+Math.cos(a)*sp*.6,sy=o.y+Math.sin(a)*sp*.6;
        if(this.passable(sx,sy)){ o.x=clamp(sx,2,this.W-2); o.y=clamp(sy,2,this.H-2); o.heading+=1.2; }
        else o.heading+=2.1;
      }
    }
    o.heading=((o.heading%TAU)+TAU)%TAU;

    // ---- metabolism (crowding stress damps overshoot)
    const ageFrac=o.age/g[gi.lifespan];
    const senesc=ageFrac>0.75?1+(ageFrac-0.75)*3:1;
    o.energy-=(0.0135*(o.sizePow||1)*g[gi.metab]*p.metabCost*(1+0.9*discomfort)*senesc
             +0.0035*size*sp*sp)+(o._crowd>5?0.0045*(o._crowd-5):0);

    // ---- feeding (contact based, diet-gated)
    const myR=size*4;
    const hunts=g[gi.dietMeat]>0.25&&g[gi.aggression]>0.2;
    if(g[gi.dietPlant]>0.15&&o.energy<o.maxE){
      const pl=this._nearestPlant(o,myR+6);
      if(pl&&pl.e>5){          // seedling refuge: small plants are inedible
        const bite=Math.min(pl.e,(0.45+0.75*g[gi.dietPlant])*size);
        pl.e-=bite; o.energy+=bite*g[gi.digest]*0.95;
        o.tgtType='plant'; o.tgtId=pl.id;
      }
    }
    if(g[gi.dietCarrion]>0.15&&this.corpses.length){
      const c=this._nearestCorpse(o,myR+6);
      if(c){
        const bite=Math.min(c.e,(0.42+0.8*g[gi.dietCarrion])*size);
        c.e-=bite; o.energy+=bite*g[gi.digest]*0.9;
        o.tgtType='corpse'; o.tgtId=0;
      }
    }
    if(hunts){
      const near=this._near(o.x,o.y,myR+size*7+4);
      for(let k=0;k<near.length;k++){
        const b=near[k];
        if(b===o||b._dead||!this._willHunt(o,b)) continue;
        if(this.inReserve(o.x,o.y)||this.inReserve(b.x,b.y)) continue;
        const dx=b.x-o.x,dy=b.y-o.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<myR+b.g[gi.size]*5+3){
          const dmg=9*g[gi.aggression]*size;
          o.energy+=dmg*0.25*g[gi.digest]-dmg*0.02;
          b.health-=dmg/(0.6+b.g[gi.size]*0.5);
          o.tgtType='org'; o.tgtId=b.id;
          if(b.health<=0&&!b._dead){
            this._kill(b,'predation');
            o.energy+=Math.min((8+12*b.g[gi.size]+0.25*b.energy)*p.predEff*(0.5+0.5*g[gi.digest]),140);
          }
          break;
        }
      }
    }

    // ---- disease
    if(o.infected){
      o.infT++;
      o.health-=0.003*o.maxH;
      o.energy-=0.008;
      if(o.infT>900){ o.infected=false; o.immune=true; }
    }

    // ---- healing / exposure / senescence
    if(o.energy>o.maxE*0.5&&o.health<o.maxH){ o.health=Math.min(o.maxH,o.health+0.02*o.maxH); o.energy-=0.006; }
    if(discomfort>1.0) o.health-=0.012*(discomfort-1.0)*o.maxH;
    if(ageFrac>1) o.health-=0.02*o.maxH;

    // ---- reproduction
    if(o.cd>0) o.cd--;
    if(o.cd<=0&&o.age>g[gi.lifespan]*0.1&&o.energy>g[gi.fertThreshold]*o.maxE*p.reproMul
       &&this.organisms.length+born.length<p.popCap){
      if(this._reproduce(o,born)) o.cd=620+this.rng.int(520);
    }

    // ---- death
    if(o.energy<=0) this._kill(o,'starvation');
    else if(o.health<=0) this._kill(o,o.infected?'disease':ageFrac>1?'old age':discomfort>1?'exposure':'injury');
    else if(ageFrac>1.15&&this.rng.next()<0.005) this._kill(o,'old age');
  }

  _willHunt(a,b){
    if(a.spId===b.spId&&a.energy>a.maxE*0.5) return false;          // no cannibalism unless starving
    if(b.g[gi.size]>a.g[gi.size]*1.35&&a.g[gi.aggression]<0.85) return false;
    if(b.role==='Predator'&&b.g[gi.size]>a.g[gi.size]) return false;
    return true;
  }

  _sense(o,light){
    const g=o.g,inp=o.in;
    inp.fill(0);
    const mul=this.params.sensorMul;
    const R=g[gi.vision]*mul*(o.role==='Predator'?(0.75+0.25*light):1);
    const hunger=clamp(1-o.energy/o.maxE,0,1);
    inp[11]=hunger;
    inp[12]=o.health/o.maxH;
    inp[13]=clamp(Math.abs(this.tempAt(o.x,o.y)-g[gi.comfort])/g[gi.tolerance],0,1.5);
    inp[14]=clamp(this.moist[this.cellAt(o.x,o.y)]*this.moistMul,0,1);
    inp[15]=light;
    inp[16]=1;

    const ca=Math.cos(o.heading),sa=Math.sin(o.heading);
    let foodSet=false;
    // carrion first for scavengers/predators (survival buffer when prey is scarce)
    if(g[gi.dietCarrion]>0.2&&hunger>0.2&&this.corpses.length){
      const c=this._nearestCorpse(o,R);
      if(c){
        const dx=c.x-o.x,dy=c.y-o.y,d=Math.sqrt(dx*dx+dy*dy)||1,s=(1-d/R)*1.0;
        inp[0]=(dx*ca+dy*sa)/d*s; inp[1]=(dy*ca-dx*sa)/d*s;
        foodSet=true;
      }
    }
    // herbivores seek food; predators use vegetation as patrol/hunting grounds
    const graze=g[gi.dietPlant]>0.15||g[gi.dietMeat]>0.4;
    if(!foodSet&&graze&&hunger>(g[gi.dietPlant]>0.15?0.15:0.35)){
      const pl=this._nearestPlant(o,R*(0.4+0.6*hunger));
      if(pl){
        const dx=pl.x-o.x,dy=pl.y-o.y,d=Math.sqrt(dx*dx+dy*dy)||1,s=(1-d/R)*(0.4+0.6*hunger)*(g[gi.dietPlant]>0.15?1:0.3);
        inp[0]=(dx*ca+dy*sa)/d*s; inp[1]=(dy*ca-dx*sa)/d*s;
        o.tgtType='plant'; o.tgtId=pl.id; foodSet=true;
      }
    }
    if(!foodSet&&g[gi.dietCarrion]>0.2&&hunger>0.2&&this.corpses.length){
      const c=this._nearestCorpse(o,R);
      if(c){
        const dx=c.x-o.x,dy=c.y-o.y,d=Math.hypot(dx,dy)||1,s=(1-d/R)*1.0;
        inp[0]=(dx*ca+dy*sa)/d*s; inp[1]=(dy*ca-dx*sa)/d*s;
      }
    }
    const near=this._near(o.x,o.y,R);
    let threat=null,tD=1e9,prey=null,pS=-1,mate=null,mD=1e9,crowd=0,infNear=0;
    for(let k=0;k<near.length;k++){
      const b=near[k]; if(b===o) continue;
      const dx=b.x-o.x,dy=b.y-o.y,dist=Math.sqrt(dx*dx+dy*dy)||1;
      if(dist<70) crowd++;
      if(b.infected) infNear++;
      if(b.g[gi.dietMeat]>0.3&&b.g[gi.aggression]>0.25&&b.g[gi.size]>g[gi.size]*0.7&&b.spId!==o.spId){
        if(dist<tD){ tD=dist; threat=b; } }
      if(g[gi.dietMeat]>0.25&&g[gi.aggression]>0.2&&this._willHunt(o,b)){
        const s=(b.energy+20)/dist; if(s>pS){ pS=s; prey=b; } }
      if(b.spId===o.spId&&b.age>b.g[gi.lifespan]*0.1&&b.energy>b.g[gi.fertThreshold]*b.maxE*0.7){
        if(dist<mD){ mD=dist; mate=b; } }
    }
    if(threat){ const fall=Math.pow(1-tD/R,2),s=fall*(0.3+g[gi.fear]*0.7),d=tD||1;
      inp[2]=((threat.x-o.x)*ca+(threat.y-o.y)*sa)/d*s;
      inp[3]=((threat.y-o.y)*ca-(threat.x-o.x)*sa)/d*s; o._threat=threat.id; } else o._threat=0;
    if(prey){ const d=Math.hypot(prey.x-o.x,prey.y-o.y)||1,s=clamp(1-d/R,0,1);
      inp[4]=((prey.x-o.x)*ca+(prey.y-o.y)*sa)/d*s;
      inp[5]=((prey.y-o.y)*ca-(prey.x-o.x)*sa)/d*s; o._prey=prey.id; } else o._prey=0;
    if(mate){ const d=mD||1,s=clamp(1-mD/R,0,1);
      inp[6]=((mate.x-o.x)*ca+(mate.y-o.y)*sa)/d*s;
      inp[7]=((mate.y-o.y)*ca-(mate.x-o.x)*sa)/d*s; o._mate=mate.id; } else o._mate=0;
    inp[10]=clamp(crowd/6,0,1);
    o._crowd=crowd; o._infNear=infNear;

    // obstacle probes ahead
    const fx=Math.cos(o.heading),fy=Math.sin(o.heading),V=g[gi.vision];
    let urg=0;
    for(const dd of [0.3,0.62,1.0])
      if(!this.passable(o.x+fx*V*dd,o.y+fy*V*dd)){ urg=1.1-dd; break; }
    if(urg>0){
      let bestA=0,bestU=-1;
      for(const off of [-1.1,-0.6,0.6,1.1]){
        const a=o.heading+off;
        if(this.passable(o.x+Math.cos(a)*V*0.62,o.y+Math.sin(a)*V*0.62)&&0>bestU){ bestU=0; bestA=off; }
      }
      inp[8]=Math.cos(o.heading+bestA)*urg; inp[9]=Math.sin(o.heading+bestA)*urg;
    }

    // disease transmission
    if(this.event&&this.event.type==='disease'&&!o.immune&&!o.infected)
      if(this.rng.next()<0.0018*(1+infNear)){ o.infected=true; o.infT=0; }
  }

  _nearestPlant(o,R){
    let best=null,bs=-1;
    const x=o.x,y=o.y,CS=100;
    const x0=Math.floor((x-R)/CS),x1=Math.floor((x+R)/CS),y0=Math.floor((y-R)/CS),y1=Math.floor((y+R)/CS);
    for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){
      const arr=this.plantH.get((cx*73856093)^(cy*19349663));
      if(!arr) continue;
      for(let k=0;k<arr.length;k++){
        const pl=arr[k],dx=pl.x-x,dy=pl.y-y,d2=dx*dx+dy*dy;
        if(d2>R*R||pl.e<5) continue;          // don't chase seedlings
        const s=pl.e/(60+d2);
        if(s>bs){bs=s;best=pl;}
      }
    }
    return best;
  }
  _nearestCorpse(o,R){
    let best=null,bd=R*R;
    for(const c of this.corpses){
      const dx=c.x-o.x,dy=c.y-o.y,d2=dx*dx+dy*dy;
      if(d2<bd){bd=d2;best=c;}
    }
    return best;
  }

  _reproduce(parent,born){
    const p=this.params;
    let genome;
    const mate=p.crossover&&parent._mate?this.byId.get(parent._mate):null;
    if(mate&&!mate._dead&&mate.spId===parent.spId){
      genome=this._crossover(parent,mate);
      mate.kids++; mate.cd=Math.max(mate.cd,120);
    }else{
      genome={g:parent.g.slice(),w:parent.w.slice()};
    }
    const g=genome.g.slice(),w=genome.w.slice();
    const muts=this._mutate(g,w);
    const invest=clamp(parent.g[gi.offspringInvest]*parent.energy,8,parent.energy*0.45);
    if(parent.energy-invest*1.18<=1) return null;
    parent.energy-=invest*1.18;
    const child=this._birthOrganism({
      g,w,
      x:clamp(parent.x+this.rng.gauss()*10,4,this.W-4),
      y:clamp(parent.y+this.rng.gauss()*10,4,this.H-4),
      pa:parent.id,sp:parent.spId,gen:parent.gen+1,
      an:[{id:parent.id,sp:parent.spId,gen:parent.gen},...parent.an].slice(0,8),
      muts:parent.muts+muts,
    });
    child.energy=clamp(invest*0.92,6,child.maxE*0.7);

    const sp=this.spById.get(parent.spId);
    if(sp){
      if(genomeDistance(child,sp.cent)>p.speciation) child.spId=this._foundSpecies({g:child.g,w:child.w},parent.spId);
      else{ const c=sp.cent; for(let i=0;i<NG;i++) c.g[i]=c.g[i]*0.99995+child.g[i]*0.00005; }
    }
    let anc=parent;
    for(let d=0;d<10&&anc;d++){ anc.desc++; anc=anc.pa?this.byId.get(anc.pa):null; }
    parent.kids++;
    this.birthsSince++;
    born.push(child);
    return child;
  }

  _kill(o,cause){
    if(o._dead) return;
    o._dead=true; o.cause=cause;
    if(cause!=='removed'){
      const e0=(8+12*o.g[gi.size]+0.25*o.energy)*0.55;
      this.corpses.push({x:o.x,y:o.y,e:e0*(cause==='starvation'?0.35:1),e0,age:0});
    }
  }

  // ---------------------------------------------------------------- sampling
  sample(){
    this.sampleTick=this.tick;
    const s={t:this.tick};
    const counts={Herbivore:0,Predator:0,Scavenger:0,Omnivore:0};
    let sumE=0,sumGen=0,maxGen=0,bio=0;
    const orgs=this.organisms;
    const liveSp=new Set();
    const mean={}; for(const key of ['speed','size','vision','aggression','dietPlant','dietMeat','dietCarrion','comfort']) mean[key]=0;
    for(const o of orgs){
      counts[o.role]=(counts[o.role]||0)+1;
      sumE+=o.energy; bio+=8+12*o.g[gi.size]+0.25*o.energy;
      sumGen+=o.gen; if(o.gen>maxGen)maxGen=o.gen;
      for(const key in mean) mean[key]+=o.g[gi[key]];
      liveSp.add(o.spId);
    }
    const n=orgs.length||1;
    s.pop=orgs.length;
    s.h=counts.Herbivore; s.p=counts.Predator; s.sc=counts.Scavenger; s.o=counts.Omnivore;
    s.plants=this.plants.length;
    s.births=this.birthsSince; s.deaths=this.deathsSince;
    this.birthsSince=0; this.deathsSince=0;
    s.avgE=sumE/n; s.bio=bio; s.avgGen=sumGen/n; s.maxGen=maxGen;
    s.species=liveSp.size;
    for(const key in mean) mean[key]/=n;
    let div=0;
    for(const key in mean){
      const G=GENES[gi[key]]; let v=0;
      for(const o of orgs){ const d=(o.g[gi[key]]-mean[key])/(G[2]-G[1]); v+=d*d; }
      div+=Math.sqrt(v/n);
    }
    s.div=div/8;
    s.avgSpeed=mean.speed; s.avgSize=mean.size; s.avgVision=mean.vision; s.avgAggr=mean.aggression;
    this.stats=s;
    const h=this.history;
    h.push(s);
    if(h.length>3600){ const nh=[]; for(let k=0;k<h.length;k+=2) nh.push(h[k]); this.history=nh; }
  }

  // ----------------------------------------------------------------- helpers
  _randLandPos(){
    // prefer climatically habitable land (populations avoid lethal zones)
    for(let t=0;t<220;t++){
      const x=this.rng.range(30,this.W-30),y=this.rng.range(30,this.H-30);
      if(this.passable(x,y)){
        if(t<150&&Math.abs(this.tempAt(x,y)-15)>11) continue;
        return {x,y};
      }
    }
    return null;
  }
  _initialPlants(target){
    let tries=0;
    while(this.plants.length<target&&tries<target*14){
      tries++;
      const pos=this._randLandPos(); if(!pos) break;
      const i=this.cellAt(pos.x,pos.y);
      if(this.fert[i]<0.15) continue;
      this.spawnPlant(pos.x,pos.y,this.rng.range(3,this.rng.next()*14+4));
    }
  }
};
const lerp2=(a,b,t)=>a+(b-a)*clamp(t,0,1);
const NN={h:new Float32Array(NH)};

// -------------------------------------------------------------- persistence
function f32toB64(f32){
  const u8=new Uint8Array(f32.buffer,f32.byteOffset,f32.byteLength);
  let s=''; const CH=0x8000;
  for(let i=0;i<u8.length;i+=CH) s+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));
  return btoa(s);
}
function b64ToF32(b64,len){
  const s=atob(b64),u8=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) u8[i]=s.charCodeAt(i);
  return new Float32Array(u8.buffer,0,len);
}
const r3=v=>Math.round(v*1000)/1000;

World.prototype.serialize=function(){
  return {
    v:3, seed:this.seed, preset:this.presetKey, W:this.W, H:this.H,
    tick:this.tick, rng:this.rng.s, nextId:this.nextId, nextSpId:this.nextSpId, nextPlantId:this.nextPlantId,
    params:this.params,
    type:Array.from(this.type),
    fert:Array.from(this.fert,r3), moist:Array.from(this.moist,r3), tOff:Array.from(this.tOff,r3),
    species:this.species.map(s=>({id:s.id,n:s.name,hu:s.hue,cg:Array.from(s.cent.g,r3),cw:f32toB64(Float32Array.from(s.cent.w)),pa:s.parent,b:s.born,x:s.extinct})),
    organisms:this.organisms.map(o=>({
      id:o.id,x:r3(o.x),y:r3(o.y),h:r3(o.heading),e:r3(o.energy),hl:r3(o.health),a:r3(o.age),
      gn:o.gen,sp:o.spId,pa:o.pa,k:o.kids,d:o.desc,m:o.muts,b:o.born,cd:o.cd,
      g:Array.from(o.g,r3), w:f32toB64(Float32Array.from(o.w)),
      inf:o.infected?1:0, im:o.immune?1:0,
    })),
    plants:this.plants.map(p=>[r3(p.x),r3(p.y),r3(p.e),r3(p.maxE)]),
    corpses:this.corpses.map(c=>[r3(c.x),r3(c.y),r3(c.e),r3(c.e0),c.age]),
    history:this.history.slice(-900),
    event:this.event, reserve:this.reserve,
    deathsSince:this.deathsSince, birthsSince:this.birthsSince,
    moistMul:this.moistMul, tempAdd:this.tempAdd, fertBoost:this.fertBoost,
  };
};

World.load=function(data){
  const w=Object.create(World.prototype);
  w.params=Object.assign({},DEFAULT_PARAMS,data.params);
  w.seed=data.seed; w.presetKey=data.preset;
  w.W=data.W; w.H=data.H;
  w.cols=Math.ceil(w.W/CELL); w.rows=Math.ceil(w.H/CELL); w.nCells=w.cols*w.rows;
  w.type=Uint8Array.from(data.type);
  w.fert=Float32Array.from(data.fert);
  w.moist=Float32Array.from(data.moist);
  w.tOff=Float32Array.from(data.tOff);
  w.plantCnt=new Int16Array(w.nCells);
  w.tick=data.tick; w.rng=new RNG(1); w.rng.s=data.rng>>>0;
  w.nextId=data.nextId; w.nextSpId=data.nextSpId; w.nextPlantId=data.nextPlantId||1;
  w.species=data.species.map(s=>({id:s.id,name:s.n,hue:s.hu,cent:{g:Float32Array.from(s.cg),w:b64ToF32(s.cw,NW)},parent:s.pa,born:s.b,extinct:s.x??null}));
  w.spById=new Map(w.species.map(s=>[s.id,s]));
  w.organisms=data.organisms.map(o=>{
    const g=Float32Array.from(o.g);
    return {
      id:o.id,x:o.x,y:o.y,heading:o.h,speed:0,g,w:b64ToF32(o.w,NW),
      energy:o.e,health:o.hl,maxH:8+9*g[gi.size],maxE:45+55*g[gi.size],
      sizePow:Math.pow(g[gi.size],0.75),
      age:o.a,gen:o.gn,spId:o.sp,pa:o.pa,kids:o.k,desc:o.d,muts:o.m,born:o.b,cd:o.cd,an:[],
      role:roleOf(g),state:'—',in:null,out:new Float32Array(NOUT),
      tgtType:null,tgtId:0,_threat:0,_prey:0,_mate:0,_crowd:0,
      infected:!!o.inf,immune:!!o.im,infT:0,_dead:false,cause:null,_sensedTick:0,
    };
  });
  w.plants=data.plants.map(p=>({id:0,x:p[0],y:p[1],e:p[2],maxE:p[3],cell:0}));
  w.plantH=new Map();
  for(let k=0;k<w.plants.length;k++){ const p=w.plants[k]; p.cell=w.cellAt(p.x,p.y); w.plantCnt[p.cell]++; w._plantAdd(p); }
  w.corpses=data.corpses.map(c=>({x:c[0],y:c[1],e:c[2],e0:c[3],age:c[4]}));
  w.history=data.history||[]; w.sampleTick=w.tick;
  w.event=data.event||null; w.reserve=data.reserve||null;
  w.deathsSince=data.deathsSince||0; w.birthsSince=data.birthsSince||0;
  w.moistMul=data.moistMul??1; w.tempAdd=data.tempAdd??0; w.fertBoost=data.fertBoost??0;
  w.scripted=[]; w.deathCauses={};
  w.terrainDirty=true;
  w._nearBuf=new Array(512); w._h=new Map(); w._CS=100;
  w._climateCache();
  w.byId=new Map();
  for(const o of w.organisms) w.byId.set(o.id,o);
  w._climateCache();
  w.sample(true);
  return w;
};

return {World,RNG,GENES,gi,NG,NW,NIN,NH,NOUT,genomeDistance,roleOf,DEFAULT_PARAMS,PRESETS,WORLD_SIZES,CELL,clamp};
})();

if(typeof module!=='undefined'&&module.exports) module.exports=SIM;
