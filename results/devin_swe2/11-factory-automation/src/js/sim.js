// ============================================================ world & simulation
const W = {
  W: 48, H: 34, tick: 0, time: 0, paused: false, speed: 1,
  terrain: null, deposit: null, ents: null,
  seq: 1, itemCount: 0,
  settings: {beltSpeed:1.8, machineSpeed:1, itemCap:6000, powerDiff:1,
             costMode:'on', seed:1337, gridW:48, gridH:34},
  credits: 400, spent: 0,
  contract: null, mode: 'sandbox', presetName: '',
  nets: [], powerDirty: true,
  stats: null, undoStack: [], redoStack: [],
  sel: null, selRect: null, tool: 'select', buildDir: 0, buildKind: 'belt',
  recipeSel: null, // per-kind pending recipe choice
  clip: null,     // clipboard stamp
  overlays: {status:1},
  cam: {x:0, y:0, z:1},
};

function cellIdx(x,y){ return y*W.W+x; }
function inB(x,y){ return x>=0 && y>=0 && x<W.W && y<W.H; }
function entAt(x,y){ return inB(x,y) ? W.ents[cellIdx(x,y)] : null; }
function terrainAt(x,y){ return inB(x,y) ? W.terrain[cellIdx(x,y)] : TERRAIN.rock; }

function initStats(){
  W.stats = {
    produced:{}, consumed:{}, delivered:{},     // cumulative units
    series:{},                                  // type -> [{p,c,d}] samples
    powerSeries:[],                             // {s,d}
    acc:{p:{},c:{},d:{}}, sampleT:0,
    stalls:{starved:0, blocked:0, nopower:0, depleted:0, nofuel:0},
    fps:0, ents:0, machines:0, stalled:0,
  };
  for(const t in ITEMS){ W.stats.produced[t]=0; W.stats.consumed[t]=0; W.stats.delivered[t]=0; }
}

function newWorld(w,h,seed){
  W.W=w; W.H=h; W.tick=0; W.time=0; W.seq=1; W.itemCount=0;
  W.terrain=new Uint8Array(w*h); W.deposit=new Int32Array(w*h);
  W.ents=new Array(w*h).fill(null);
  W.nets=[]; W.powerDirty=true; W.sel=null; W.selRect=null; W.clip=null;
  W.undoStack=[]; W.redoStack=[];
  W.credits=400; W.spent=0; W.contract=null; W.mode='sandbox'; W.presetName='';
  W.settings.seed=seed; W.settings.gridW=w; W.settings.gridH=h;
  initStats();
  genTerrain(seed);
}

function genTerrain(seed){
  const rng = mulberry32(seed);
  const patches=[['iron_ore',TERRAIN.iron_ore],['copper_ore',TERRAIN.copper_ore],['coal',TERRAIN.coal]];
  for(const [item,t] of patches){
    const n = 3+Math.floor(rng()*3);
    for(let i=0;i<n;i++){
      const cx=2+Math.floor(rng()*(W.W-4)), cy=2+Math.floor(rng()*(W.H-4));
      const r=1+rng()*2.2;
      for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
        if(!inB(x,y))continue;
        const d=Math.hypot(x-cx,y-cy)+rng()*0.8;
        if(d<r){ W.terrain[cellIdx(x,y)]=t; W.deposit[cellIdx(x,y)]=300+Math.floor(rng()*1200); }
      }
    }
  }
  // rocks
  const nr=Math.floor(W.W*W.H*0.015);
  for(let i=0;i<nr;i++){
    const x=Math.floor(rng()*W.W), y=Math.floor(rng()*W.H);
    if(W.terrain[cellIdx(x,y)]===0) W.terrain[cellIdx(x,y)]=TERRAIN.rock;
  }
}

// ---------------- entity creation
function mkEnt(kind,x,y,dir){
  const e={id:W.seq++, kind, x, y, dir:dir||0, net:-1, stall:'', util:0, _act:0};
  if(ISBELT(kind)){ e.items=[]; if(kind==='splitter')e.nextSide=0; }
  if(kind==='miner'){ e.outBuf={}; e.progress=0; }
  if(ISMACHINE(kind)){ e.inBuf={}; e.outBuf={}; e.progress=0; e.working=false;
    e.recipe = RECIPES_FOR[kind][0]; e.mods={speed:0,eff:0,prod:0}; }
  if(kind==='generator'){ e.inBuf={}; e.burnT=0; }
  if(kind==='storage'){ e.inv={}; }
  if(kind==='delivery'){ e.inv={}; }
  if(kind==='inserter'){ e.held=null; e.t=0; }
  return e;
}

function costOf(kind){
  if(W.settings.costMode!=='on') return 0;
  return KINDS[kind].cost;
}

function canPlace(kind,x,y){
  if(!inB(x,y)) return 'outside grid';
  const t=terrainAt(x,y);
  if(t===TERRAIN.rock) return 'blocked by rock';
  const ex=entAt(x,y);
  if(ex) return (ISBELT(kind)&&ISBELT(ex.kind)) ? null : 'cell occupied';
  if(kind==='miner'){
    if(t!==TERRAIN.iron_ore && t!==TERRAIN.copper_ore && t!==TERRAIN.coal)
      return 'miner must be placed on a resource deposit';
  } else if(t!==TERRAIN.empty && t!==TERRAIN.rock && kind!=='miner'){
    // deposits allow nothing else built on them except miners
    return 'deposit cell — place a miner here';
  }
  return null;
}

function placeEnt(kind,x,y,dir,opts){
  opts=opts||{};
  const err = canPlace(kind,x,y);
  if(err) return {err};
  const cost = costOf(kind);
  if(!opts.free && cost>W.credits) return {err:'not enough credits'};
  const e=mkEnt(kind,x,y,dir);
  if(opts.recipe && ISMACHINE(kind) && RECIPES[e.recipe] && RECIPES[e.recipe].machine===kind)
    e.recipe=opts.recipe;
  if(opts.mods) e.mods=Object.assign({},opts.mods);
  const old=W.ents[cellIdx(x,y)];
  if(old&&old.items&&e.items) e.items=old.items; // belt re-route keeps cargo
  W.ents[cellIdx(x,y)]=e;
  if(!opts.free){ W.credits-=cost; W.spent+=cost; }
  W.powerDirty=true;
  return {ent:e};
}

function removeEnt(x,y,refund){
  const e=entAt(x,y); if(!e) return false;
  if(e.items) W.itemCount -= e.items.reduce((s,i)=>s+(i._c||1),0);
  if(e.kind==='inserter' && e.held) W.itemCount--;
  if(refund===undefined) refund = W.settings.costMode==='on';
  if(refund) W.credits += KINDS[e.kind].cost;
  W.ents[cellIdx(x,y)]=null;
  if(W.sel===e) W.sel=null;
  W.powerDirty=true;
  return true;
}

// ---------------- item transport
function beltTailRoom(e){
  if(!e.items || e.items.length===0) return true;
  const last=e.items[e.items.length-1];
  return last.pos > BELT_SPACING;
}
function bufCount(b){ let s=0; for(const k in b)s+=b[k]; return s; }
function bufCap(e){ return BUF_CAP * (1+(e.mods?e.mods.prod:0)); }

// can ent `src` push `item`(type,n) into ent `dst`?
function acceptInto(dst, type, n, src){
  if(!dst) return false;
  switch(dst.kind){
    case 'belt': case 'merger': {
      if(src && ISBELT(src.kind) && src.dir===OPP(dst.dir)) return false; // head-on
      return beltTailRoom(dst);
    }
    case 'splitter': {
      // input only from behind
      const d=DIRS[dst.dir];
      if(!src || src.x!==dst.x-d[0] || src.y!==dst.y-d[1]) return false;
      return beltTailRoom(dst);
    }
    case 'smelter': case 'assembler': {
      const r=RECIPES[dst.recipe];
      if(!r || !(type in r.in)) return false;
      return (dst.inBuf[type]||0) < bufCap(dst);
    }
    case 'generator':
      return FUEL[type] && (dst.inBuf[type]||0) < BUF_CAP;
    case 'storage':
      return bufCount(dst.inv) < STORAGE_CAP;
    case 'delivery':
      return true;
  }
  return false;
}

// perform push: returns true if consumed
function pushInto(dst, type, n, src){
  if(!acceptInto(dst,type,n,src)) return false;
  switch(dst.kind){
    case 'belt': case 'merger': case 'splitter':
      dst.items.push({type, n, pos:0, stamp:W.tick});
      W.itemCount += n;
      return true;
    case 'smelter': case 'assembler': case 'generator':
      dst.inBuf[type]=(dst.inBuf[type]||0)+n; return true;
    case 'storage':
      dst.inv[type]=(dst.inv[type]||0)+n; return true;
    case 'delivery':
      dst.inv[type]=(dst.inv[type]||0)+n;
      W.stats.delivered[type]=(W.stats.delivered[type]||0)+n;
      W.stats.acc.d[type]=(W.stats.acc.d[type]||0)+n;
      if(W.contract && W.contract.item===type && !W.contract.done){
        W.contract.got+=n;
        if(W.contract.got>=W.contract.amount) completeContract();
      }
      return true;
  }
  return false;
}

function forwardCell(e){ const d=DIRS[e.dir]; return [e.x+d[0], e.y+d[1]]; }

function splitterTargets(e){
  // left & right relative to dir
  const l=(e.dir+3)&3, r=(e.dir+1)&3;
  return [[e.x+DIRS[l][0], e.y+DIRS[l][1]],[e.x+DIRS[r][0], e.y+DIRS[r][1]]];
}

function moveBeltItems(e, dt){
  const items=e.items;
  if(!items||!items.length) return;
  const spd=W.settings.beltSpeed*dt;
  const merging = W.itemCount > W.settings.itemCap;
  for(let i=0;i<items.length;i++){
    const it=items[i];
    if(it.stamp===W.tick) continue;
    it.stamp=W.tick;
    const ahead = i>0 ? items[i-1].pos - BELT_SPACING : 1e9;
    let np = it.pos + spd;
    if(np>=1){
      // try transfer
      let targets;
      if(e.kind==='splitter'){
        const st=splitterTargets(e);
        targets = e.nextSide===0 ? [st[0],st[1]] : [st[1],st[0]];
      } else {
        targets=[forwardCell(e)];
      }
      let moved=false;
      if(e.kind==='splitter') it._side = (targets[0]===splitterTargets(e)[0])?0:1;
      for(const [tx,ty] of targets){
        const dst=entAt(tx,ty);
        if(dst && acceptInto(dst,it.type,it.n,e)){
          // aggregate into tail packet if over cap
          if(merging && ISBELT(dst.kind) && dst.items.length){
            const tail=dst.items[dst.items.length-1];
            if(tail.type===it.type && tail.pos>BELT_SPACING){ tail.n+=it.n; moved=true; break; }
          }
          if(pushInto(dst,it.type,it.n,e)){ W.itemCount-=it.n; moved=true;
            if(e.kind==='splitter') e.nextSide^=1; break; }
        }
      }
      if(moved){ items.splice(i,1); i--; }
      else it.pos=Math.min(0.999, ahead);
    } else {
      it.pos=Math.min(np, ahead);
    }
  }
}

function recipeAccepts(e,type){
  if(!e)return false;
  if(e.kind==='generator')return !!FUEL[type];
  const r=RECIPES[e.recipe];
  return !!(r && type in r.in);
}

// ---------------- machines
function powerFactor(e){
  if(!NEEDPOWER(e.kind)) return 1;
  const net=W.nets[e.net];
  if(!net) return 0;
  return net.factor;
}
function isPowered(e){ return !NEEDPOWER(e.kind) || powerFactor(e)>0; }

function machineSpeedOf(e){
  return W.settings.machineSpeed * (1+0.5*(e.mods?e.mods.speed:0));
}
function machineDrawOf(e){
  const base=KINDS[e.kind].power;
  return base * (1+0.6*(e.mods?e.mods.speed:0)) * Math.pow(0.65,(e.mods?e.mods.eff:0)) * W.settings.powerDiff;
}

function tickMachine(e, dt){
  const r=RECIPES[e.recipe];
  if(!r){ e.stall='no recipe'; return; }
  const pf=powerFactor(e);
  if(pf<=0){ e.stall='nopower'; return; }
  // drain output toward forward cell
  drainOutput(e);
  const cap=bufCap(e);
  if(e.working){
    // completing blocked if output would overflow badly
    if(e.progress>=1){
      let blocked=false;
      for(const t in r.out) if((e.outBuf[t]||0) >= cap) blocked=true;
      if(blocked){ e.stall='blocked'; return; }
      for(const t in r.out){ e.outBuf[t]=(e.outBuf[t]||0)+r.out[t];
        W.stats.produced[t]=(W.stats.produced[t]||0)+r.out[t];
        W.stats.acc.p[t]=(W.stats.acc.p[t]||0)+r.out[t]; }
      e.working=false; e.progress=0; e.stall='';
    } else {
      e.progress += dt*machineSpeedOf(e)*pf/r.time;
      e._act+=dt; e._want=true;
      if(e.progress>=1){ /* completes next tick edge */ }
      e.stall='';
      return;
    }
  }
  // try start craft
  let can=true;
  for(const t in r.in) if((e.inBuf[t]||0) < r.in[t]){ can=false; break; }
  if(can){
    for(const t in r.in){ e.inBuf[t]-=r.in[t];
      W.stats.consumed[t]=(W.stats.consumed[t]||0)+r.in[t];
      W.stats.acc.c[t]=(W.stats.acc.c[t]||0)+r.in[t]; }
    e.working=true; e.progress=dt*machineSpeedOf(e)*pf/r.time; e._act+=dt; e._want=true; e.stall='';
  } else {
    // distinguish: starving vs no input connection
    e.stall = e._hadInput? 'starved' : 'starved';
    e._hadInput=false;
    for(const t in r.in) if((e.inBuf[t]||0)>0){ e._hadInput=true; }
  }
}

function drainOutput(e){
  // push output buffer to forward cell, 1 unit per tick
  if(!e.outBuf) return;
  for(const t in e.outBuf){
    if(e.outBuf[t]<=0) continue;
    const [fx,fy]=forwardCell(e);
    const dst=entAt(fx,fy);
    if(dst && pushInto(dst,t,1,e)){ e.outBuf[t]-=1; if(e.outBuf[t]<=0)delete e.outBuf[t]; return; }
  }
}

function tickMiner(e, dt){
  // miners can hand-crank at 25% when unpowered — breaks the coal chicken-and-egg
  let pf = powerFactor(e); const cranked = pf<=0;
  if(cranked) pf=0.25;
  const idx=cellIdx(e.x,e.y);
  const t=W.terrain[idx];
  const ore=TERRAIN_ITEM[t];
  if(!ore){ e.stall='no deposit'; return; }
  if(W.deposit[idx]<=0){ e.stall='depleted'; return; }
  drainOutput(e);
  if((e.outBuf[ore]||0)>=bufCap(e)){ e.stall='blocked'; return; }
  e.progress += dt*machineSpeedOf(e)*pf/1.1;
  e._act+=dt; e._want=true;
  e.stall = cranked ? 'nopower' : '';
  if(e.progress>=1){
    e.progress=0;
    e.outBuf[ore]=(e.outBuf[ore]||0)+1; W.deposit[idx]--;
    W.stats.produced[ore]=(W.stats.produced[ore]||0)+1;
    W.stats.acc.p[ore]=(W.stats.acc.p[ore]||0)+1;
  }
}

function tickGenerator(e, dt){
  const net=W.nets[e.net];
  const demand = net ? net.demand : 0;
  if(e.burnT<=0 && demand>0 && (e.inBuf.coal||0)>0){
    e.inBuf.coal--; e.burnT=4.0;
    W.stats.consumed.coal=(W.stats.consumed.coal||0)+1;
    W.stats.acc.c.coal=(W.stats.acc.c.coal||0)+1;
  }
  if(e.burnT>0){ e.burnT-=dt; if(net) net.supply+=GEN_OUT; }
  e.stall = (e.burnT>0)?'':((e.inBuf.coal||0)>0?'idle':'nofuel');
}

function tickInserter(e, dt){
  const pf=powerFactor(e);
  if(pf<=0){ e.stall='nopower'; return; }
  const spd=2.6*machineSpeedOf(e)*pf; // swings per sec scale
  const d=DIRS[e.dir];
  const sx=e.x-d[0], sy=e.y-d[1], tx=e.x+d[0], ty=e.y+d[1];
  if(!e.held){
    // take from source
    const src=entAt(sx,sy);
    if(!src){ e.stall='idle'; return; }
    let got=null;
    const dstPeek=entAt(tx,ty);
    if(ISBELT(src.kind) && src.items.length){
      // grab front-most acceptable item far enough along; when target is a
      // machine, only take items its recipe accepts (filter behavior)
      const machineDst = dstPeek && (ISMACHINE(dstPeek.kind)||dstPeek.kind==='generator');
      for(let i=0;i<src.items.length;i++){
        const it=src.items[i];
        if(it.pos<=0.45) continue;
        if(machineDst && !recipeAccepts(dstPeek,it.type)) continue;
        got={type:it.type,n:it.n}; src.items.splice(i,1); W.itemCount-=it.n; break;
      }
    } else if(ISMACHINE(src.kind)){
      for(const t in src.outBuf){ if(src.outBuf[t]>0){ src.outBuf[t]--; if(src.outBuf[t]<=0)delete src.outBuf[t]; got={type:t,n:1}; break; } }
    } else if(src.kind==='storage'){
      for(const t in src.inv){ if(src.inv[t]>0){ src.inv[t]--; if(src.inv[t]<=0)delete src.inv[t]; got={type:t,n:1}; break; } }
    }
    if(got){ e.held=got; e.t=0; e._act+=dt; e._want=true; W.itemCount+=got.n; e.stall=''; }
    else e.stall='idle';
  } else {
    e.t+=dt*spd;
    if(e.t<0.5){ e._act+=dt; e._want=true; e.stall=''; return; }
    const dst=entAt(tx,ty);
    if(dst && pushInto(dst,e.held.type,e.held.n,e)){
      W.itemCount-=e.held.n; e.held=null; e.t=0; e.stall='';
    } else e.stall='blocked';
  }
}

// ---------------- power networks
function rebuildPower(){
  W.powerDirty=false;
  const members=[];
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    const e=W.ents[cellIdx(x,y)];
    if(e && (e.kind==='pole'||e.kind==='generator')) members.push(e);
    if(e) e.net=-1;
  }
  // union find
  const par=members.map((_,i)=>i);
  const find=i=>{ while(par[i]!==i){par[i]=par[par[i]];i=par[i];} return i; };
  for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){
    const a=members[i],b=members[j];
    if(Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))<=POLE_RANGE){
      const ra=find(i),rb=find(j); if(ra!==rb)par[rb]=ra;
    }
  }
  const comp={};
  members.forEach((m,i)=>{ const r=find(i); (comp[r]=comp[r]||[]).push(m); });
  W.nets=Object.values(comp).map(ms=>({members:ms,supply:0,demand:0,factor:1,potential:0}));
  W.nets.forEach((n,ni)=>{ for(const m of n.members) m.net=ni; });
  // attach consumers
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    const e=W.ents[cellIdx(x,y)];
    if(!e||!NEEDPOWER(e.kind))continue;
    for(let n=0;n<W.nets.length;n++){
      let hit=false;
      for(const m of W.nets[n].members){
        if(Math.max(Math.abs(m.x-e.x),Math.abs(m.y-e.y))<=POLE_RANGE){ hit=true; break; }
      }
      if(hit){ e.net=n; break; }
    }
  }
}

// ---------------- main tick
function simTick(){
  const dt=1/20;
  W.tick++; W.time+=dt;
  if(W.powerDirty) rebuildPower();
  // reset net supply/demand
  for(const n of W.nets){ n.supply=0; n.demand=0; }
  // demand first (intent): active machines draw full, idle draw 15%
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    const e=W.ents[cellIdx(x,y)];
    if(e && NEEDPOWER(e.kind) && e.net>=0){
      const d=machineDrawOf(e);
      W.nets[e.net].demand += e._want ? d : d*0.15;
    }
  }
  // generators decide burn using demand
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    const e=W.ents[cellIdx(x,y)]; if(!e)continue;
    if(e.kind==='generator') tickGenerator(e,dt);
  }
  for(const n of W.nets){
    n.factor = n.demand>0 ? clamp(n.supply/n.demand,0,1) : 1;
    n.potential = n.supply;
  }
  // entities
  let machines=0, stalled=0;
  W.stats.stalls={starved:0,blocked:0,nopower:0,depleted:0,nofuel:0};
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    const e=W.ents[cellIdx(x,y)]; if(!e)continue;
    switch(e.kind){
      case 'belt': case 'splitter': case 'merger': moveBeltItems(e,dt); break;
      case 'smelter': case 'assembler': machines++; tickMachine(e,dt); break;
      case 'miner': machines++; tickMiner(e,dt); break;
      case 'inserter': machines++; tickInserter(e,dt); break;
    }
    const countable = ISMACHINE(e.kind)||e.kind==='miner'||e.kind==='inserter';
    if(e.stall && e.stall!=='idle'){
      if(countable)stalled++;
      if(e.stall==='nopower')W.stats.stalls.nopower++;
      else if(e.stall==='starved')W.stats.stalls.starved++;
      else if(e.stall==='blocked')W.stats.stalls.blocked++;
      else if(e.stall==='depleted')W.stats.stalls.depleted++;
      else if(e.stall==='nofuel')W.stats.stalls.nofuel++;
    }
    // utilization EMA (per second-ish)
    e.util = (e.util||0)*0.97 + (e._act>0?0.03:0);
    e._want = e._act>0; e._act=0;
  }
  W.stats.machines=machines; W.stats.stalled=stalled;
  // contract timer
  if(W.contract && !W.contract.done){
    W.contract.left = Math.max(0, W.contract.deadline - W.time);
    if(W.contract.left<=0 && W.contract.got<W.contract.amount) failContract();
  }
  // stats sampling 1x/sec
  W.stats.sampleT+=dt;
  if(W.stats.sampleT>=1){
    W.stats.sampleT=0;
    sampleStats();
  }
}

function sampleStats(){
  const s=W.stats;
  let ps=0,pd=0;
  for(const n of W.nets){ ps+=n.supply; pd+=n.demand; }
  s.powerSeries.push({s:Math.round(ps),d:Math.round(pd)});
  if(s.powerSeries.length>120)s.powerSeries.shift();
  for(const t in ITEMS){
    const a={p:s.acc.p[t]||0, c:s.acc.c[t]||0, d:s.acc.d[t]||0};
    (s.series[t]=s.series[t]||[]).push(a);
    if(s.series[t].length>120)s.series[t].shift();
    s.acc.p[t]=0;s.acc.c[t]=0;s.acc.d[t]=0;
  }
}

// ---------------- contracts
function startContract(item,amount,seconds,credits){
  W.mode='contract';
  W.contract={item,amount,deadline:seconds,got:0,left:seconds,done:false,
    startTick:W.tick,time:seconds};
  if(credits!==undefined){ W.credits=credits; W.spent=0; }
}
function completeContract(){
  W.contract.done=true; W.contract.win=true;
  const t=W.contract;
  const timeBonus=Math.round(t.left*10);
  const creditBonus=W.settings.costMode==='on'?W.credits:0;
  const footprint=W.ents.filter(Boolean).length;
  const score=Math.max(0, timeBonus + creditBonus + t.amount*20 - footprint*5);
  W.contract.score={score,timeBonus,creditBonus,footprint};
  showBanner(true);
  sfx('win');
}
function failContract(){
  W.contract.done=true; W.contract.win=false;
  W.contract.score={score:0,timeBonus:0,creditBonus:0,footprint:W.ents.filter(Boolean).length};
  showBanner(false);
  sfx('err');
}

// run fixed ticks; dtReal seconds of wall time scaled by speed
let _acc=0;
function frame(dtReal){
  if(W.paused){ return; }
  _acc += dtReal*W.speed;
  let n=0;
  const MAXT=8; // max ticks per frame to avoid spiral
  while(_acc>=1/20 && n<MAXT){ simTick(); _acc-=1/20; n++; }
  if(_acc>1/20*MAXT) _acc=0;
}
function stepOnce(){ simTick(); }
