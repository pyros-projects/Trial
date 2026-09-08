"use strict";
/* ============================================================================
   0. MATH / UTILITY
   ========================================================================= */
const TAU = Math.PI * 2, PI = Math.PI;
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp  = (a,b,t)=> a+(b-a)*t;
const smooth= t=> t*t*(3-2*t);
const d2    = (ax,ay,bx,by)=>{const dx=bx-ax,dy=by-ay;return dx*dx+dy*dy;};
const dist  = (ax,ay,bx,by)=> Math.sqrt(d2(ax,ay,bx,by));
const sign  = Math.sign;
function angDiff(a,b){ let d=(b-a)%TAU; if(d>PI)d-=TAU; if(d<-PI)d+=TAU; return d; }
function angToward(a,b,step){ const d=angDiff(a,b); return Math.abs(d)<=step ? b : a+sign(d)*step; }
function fmtTime(s){ s=Math.max(0,s); const m=Math.floor(s/60), r=Math.floor(s%60);
  return String(m).padStart(2,'0')+':'+String(r).padStart(2,'0'); }
function fmtTimeMs(s){ s=Math.max(0,s); const m=Math.floor(s/60), r=(s%60);
  return String(m).padStart(2,'0')+':'+r.toFixed(2).padStart(5,'0'); }

/* Deterministic PRNG — mulberry32 over an FNV-1a string hash. */
function hashStr(str){
  let h = 0x811c9dc5 >>> 0;
  str = String(str);
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
class Rng{
  constructor(seed){ this.s = (typeof seed === 'number' ? seed>>>0 : hashStr(seed)) >>> 0; if(this.s===0)this.s=0x9e3779b9; }
  n(){ // mulberry32
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t>>>15), t | 1);
    t ^= t + Math.imul(t ^ (t>>>7), t | 61);
    return ((t ^ (t>>>14)) >>> 0) / 4294967296;
  }
  f(a=1,b){ return b===undefined ? this.n()*a : a + this.n()*(b-a); }
  i(a,b){ return Math.floor(a + this.n()*(b-a+1)); }        // inclusive
  pick(arr){ return arr[Math.floor(this.n()*arr.length)]; }
  chance(p){ return this.n() < p; }
  shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(this.n()*(i+1)); const t=arr[i];arr[i]=arr[j];arr[j]=t; } return arr; }
  clone(){ const r = new Rng(1); r.s = this.s; return r; }
}

/* Small binary min-heap used by A* and the sound flood. */
class Heap{
  constructor(){ this.a=[]; this.p=[]; this.n=0; }
  clear(){ this.n=0; this.a.length=0; this.p.length=0; }
  push(v,pri){ let i=this.n++; this.a[i]=v; this.p[i]=pri;
    while(i>0){ const par=(i-1)>>1; if(this.p[par]<=this.p[i])break;
      const tv=this.a[par],tp=this.p[par]; this.a[par]=this.a[i];this.p[par]=this.p[i]; this.a[i]=tv;this.p[i]=tp; i=par; } }
  pop(){ if(this.n===0)return undefined; const top=this.a[0];
    this.n--; if(this.n>0){ this.a[0]=this.a[this.n]; this.p[0]=this.p[this.n];
      let i=0; for(;;){ const l=i*2+1,r=l+1; let m=i;
        if(l<this.n && this.p[l]<this.p[m])m=l; if(r<this.n && this.p[r]<this.p[m])m=r;
        if(m===i)break; const tv=this.a[m],tp=this.p[m]; this.a[m]=this.a[i];this.p[m]=this.p[i]; this.a[i]=tv;this.p[i]=tp; i=m; } }
    this.a.length=this.n; this.p.length=this.n; return top; }
  get size(){ return this.n; }
}

/* ============================================================================
   1. GLOBAL CONSTANTS / TUNING
   ========================================================================= */
const TILE = 32;                 // world units per tile
const SIM_HZ = 60, SIM_DT = 1/60;
const MAX_STEPS_PER_FRAME = 5;

const TT = { VOID:0, ROOM:1, CORR:2, DOOR:3 };            // floor kinds
const GS = { PATROL:'patrol', OBSERVE:'observe', SUSPECT:'suspect', INVESTIGATE:'investigate',
             CHASE:'chase', SEARCH:'search', RETURN:'return' };
const GS_LABEL = { patrol:'PATROL', observe:'WATCH', suspect:'SUSPECT', investigate:'INVESTIGATE',
                   chase:'PURSUE', search:'SEARCH', return:'RETURN' };
const GS_COLOR = { patrol:'#6ee787', observe:'#6ee787', suspect:'#ffd76e', investigate:'#ffb454',
                   chase:'#ff5563', search:'#ff8c42', return:'#7fd7ff' };

const NOISE = {  // radius in tiles of the sound flood budget
  sneak: 1.6, walk: 4.6, run: 9.2, door: 7.0, doorForce: 10.5, prop: 8.0,
  throwLand: 11.5, emp: 6.5, smoke: 5.0, terminal: 3.0, alarm: 40, pickup: 2.2, shout: 26
};

const DIFFS = [
  { id:'rookie', name:'Rookie', blurb:'Forgiving cones, slow responders, generous kit.',
    guardMul:0.7, camMul:0.65, fov:0.85, view:0.80, detect:0.62, gspeed:0.86,
    respond:0.62, gadgetMul:1.6, alarmDecay:1.7, searchTime:0.7, hearing:0.8, scoreMul:0.7 },
  { id:'operative', name:'Operative', blurb:'The intended balance. Patrols overlap; mistakes cost.',
    guardMul:1.0, camMul:1.0, fov:1.0, view:1.0, detect:1.0, gspeed:1.0,
    respond:1.0, gadgetMul:1.0, alarmDecay:1.0, searchTime:1.0, hearing:1.0, scoreMul:1.0 },
  { id:'ghost', name:'Ghost', blurb:'Wider cones, faster radio chatter, thin resources.',
    guardMul:1.3, camMul:1.35, fov:1.14, view:1.18, detect:1.45, gspeed:1.11,
    respond:1.45, gadgetMul:0.7, alarmDecay:0.72, searchTime:1.35, hearing:1.25, scoreMul:1.45 },
  { id:'nightmare', name:'Nightmare', blurb:'Dense sweeps, sharp ears, almost no margin.',
    guardMul:1.6, camMul:1.7, fov:1.26, view:1.34, detect:1.95, gspeed:1.2,
    respond:1.85, gadgetMul:0.5, alarmDecay:0.55, searchTime:1.7, hearing:1.5, scoreMul:2.0 },
];
const diffById = id => DIFFS.find(d=>d.id===id) || DIFFS[1];

/* Curated mission presets. `gw/gh` are grid dims; the generator adapts to them. */
const PRESETS = [
  { id:'annex', name:'Blackwater Annex', tag:'Compact · Tutorial',
    story:'A two-wing records annex. Slip in through the loading bay, lift the courier ledger from the strongroom, and step back out the way you came. Skeleton night crew.',
    gw:34, gh:24, rooms:7, guards:3, cams:2, loot:3, locked:1, lights:0.85, defSeed:'ANNEX-01',
    goal:'Courier Ledger' },
  { id:'vermeil', name:'Vermeil Museum', tag:'Standard · Balanced',
    story:'The Vermeil keeps its private collection behind the east gallery. Take the Ashglass Cipher from the display vault, grab whatever else is loose, and reach the service roof.',
    gw:48, gh:32, rooms:11, guards:5, cams:4, loot:6, locked:2, lights:0.7, defSeed:'VERMEIL-7',
    goal:'Ashglass Cipher' },
  { id:'cassiopeia', name:'Cassiopeia Vault', tag:'Large · Heavy security',
    story:'Private clearing house. Layered checkpoints, camera saturation and a roaming response team. The bearer bonds sit in the core vault. Do not trip the floor alarm.',
    gw:58, gh:38, rooms:14, guards:8, cams:7, loot:8, locked:4, lights:0.62, defSeed:'CASSIO-13',
    goal:'Bearer Bonds' },
  { id:'helix', name:'Helix Biolabs', tag:'Maze · Access control',
    story:'Everything here is behind a badge reader. Terminals cut power to whole wings — use them. The sample case is in cold storage at the far end of the clean corridor.',
    gw:52, gh:36, rooms:13, guards:6, cams:6, loot:5, locked:6, lights:0.9, defSeed:'HELIX-04',
    goal:'Sample Case' },
  { id:'marrow', name:'Marrow Penthouse', tag:'Dark · Tight patrols',
    story:'Lights are off above the 40th. Few guards, but they walk short overlapping loops and they are listening. The safe holds an unregistered hard drive.',
    gw:42, gh:30, rooms:10, guards:4, cams:3, loot:5, locked:2, lights:0.34, defSeed:'MARROW-9',
    goal:'Unregistered Drive' },
  { id:'random', name:'Randomised Contract', tag:'Procedural · Anything goes',
    story:'Contract details generated on deployment. Layout, staffing and security posture are rolled fresh from the seed.',
    gw:0, gh:0, rooms:0, guards:0, cams:0, loot:0, locked:0, lights:0, defSeed:'', goal:'' },
];
const presetById = id => PRESETS.find(p=>p.id===id) || PRESETS[1];

const GADGET_DEFS = [
  { id:'noisemaker', name:'Noisemaker', icon:'◉', key:'1',
    desc:'Throws a chirping puck. Lands with a loud, locatable bang that pulls nearby guards to investigate.',
    charges:3, cooldown:1.2, throwable:true },
  { id:'emp', name:'EMP Charge', icon:'◈', key:'2',
    desc:'Thrown pulse. Kills cameras, lights and door locks inside its radius for a while. Guards notice the dark.',
    charges:2, cooldown:2.4, throwable:true },
  { id:'smoke', name:'Smoke Veil', icon:'◍', key:'3',
    desc:'Deployed at your feet. A drifting cloud that blocks all line of sight — yours and theirs.',
    charges:2, cooldown:3.0, throwable:false },
  { id:'lockpick', name:'Lock Shim', icon:'▤', key:'4',
    desc:'Defeats one badge-locked door by hand. Takes a few seconds and makes a small scraping noise.',
    charges:3, cooldown:0.4, throwable:false },
  { id:'decoy', name:'Holo Decoy', icon:'▲', key:'5',
    desc:'Projects a walking silhouette. Guards will chase and interrogate it until it fizzles.',
    charges:1, cooldown:4.0, throwable:true },
];

const DEFAULT_BINDS = {
  up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD',
  run:'ShiftLeft', sneak:'ControlLeft', use:'KeyE', gadget:'KeyQ',
  cycle:'KeyR', pause:'KeyP', menu:'Escape', diag:'F1'
};
const BIND_LABEL = { up:'Move up', down:'Move down', left:'Move left', right:'Move right',
  run:'Sprint (loud)', sneak:'Sneak (quiet)', use:'Interact / hold', gadget:'Use gadget',
  cycle:'Next gadget', pause:'Pause', menu:'Menu', diag:'Diagnostics' };

const LS = { settings:'nfp.settings.v1', binds:'nfp.binds.v1', scores:'nfp.scores.v1', last:'nfp.last.v1' };

const SETTINGS = {
  volMaster:0.7, volSfx:0.85, volAmb:0.45,
  reduceMotion:false, highContrast:false, darkness:true, shake:true, forceTouch:false, zoom:1.0,
  diffId:'operative', presetId:'annex', seed:'ANNEX-01',
  diag:{ open:false, nav:false, guard:false, rays:false, sound:false, lkp:false, collision:false, timing:true }
};
function loadSettings(){
  try{ const raw=localStorage.getItem(LS.settings); if(!raw)return;
    const o=JSON.parse(raw); for(const k in o){ if(k==='diag'&&o.diag){ Object.assign(SETTINGS.diag,o.diag); }
      else if(k in SETTINGS && k!=='diag') SETTINGS[k]=o[k]; } }catch(e){ console.warn('settings load failed',e); }
}
function saveSettings(){ try{ localStorage.setItem(LS.settings, JSON.stringify(SETTINGS)); }catch(e){} }
let BINDS = Object.assign({}, DEFAULT_BINDS);
function loadBinds(){ try{ const raw=localStorage.getItem(LS.binds); if(raw) BINDS=Object.assign({},DEFAULT_BINDS,JSON.parse(raw)); }catch(e){} }
function saveBinds(){ try{ localStorage.setItem(LS.binds, JSON.stringify(BINDS)); }catch(e){} }
/* ============================================================================
   2. MISSION GENERATION
   Binary-space-partition floorplan → corridors → geometric doorways → roles →
   props/lights/security/patrols → hard validation pass.
   ========================================================================= */
const ROOM_NAMES = {
  entry:['Loading Bay','Service Entry','Delivery Dock','Side Lobby','Freight Hall'],
  vault:['Strongroom','Display Vault','Core Vault','Cold Storage','Private Safe'],
  security:['Security Office','Guard Post','Control Room','Watch Station'],
  server:['Server Closet','Data Room','Comms Rack','Relay Room'],
  office:['Records Office','Admin Suite','Curator Office','Bookkeeping','Clerk Room'],
  storage:['Storage','Supply Room','Archive','Crate Store','Utility Store'],
  gallery:['Gallery','Atrium','Long Hall','Exhibit Floor','Reading Room'],
  utility:['Plant Room','Boiler Room','Maintenance','Ducting Bay'],
  exfil:['Roof Access','Back Alley','Fire Stair','Rear Court','Tunnel Head'],
};
const PROP_KINDS = {
  desk:   { solid:true,  opaque:true,  col:'#4c4131', edge:'#786447', label:'desk' },
  crate:  { solid:true,  opaque:true,  col:'#4b442f', edge:'#7d7148', label:'crate' },
  shelf:  { solid:true,  opaque:true,  col:'#3c362a', edge:'#635a43', label:'shelving' },
  server: { solid:true,  opaque:true,  col:'#22323f', edge:'#3d5e75', label:'rack' },
  pillar: { solid:true,  opaque:true,  col:'#2e3742', edge:'#4c5a67', label:'pillar' },
  glass:  { solid:true,  opaque:false, col:'#234a53', edge:'#5fe6d4', label:'display case' },
  planter:{ solid:true,  opaque:true,  col:'#283a2b', edge:'#4d8256', label:'planter' },
};

class Grid{
  constructor(w,h){
    this.w=w; this.h=h; this.n=w*h;
    this.solid = new Uint8Array(this.n).fill(1);
    this.floor = new Uint8Array(this.n);     // TT.*
    this.room  = new Int16Array(this.n).fill(-1);
    this.doorAt= new Int16Array(this.n).fill(-1);
    this.propAt= new Int16Array(this.n).fill(-1);
    this.zone  = new Int16Array(this.n).fill(0);
    this.restricted = new Uint8Array(this.n);
    this.light = new Float32Array(this.n);
  }
  i(tx,ty){ return ty*this.w+tx; }
  inB(tx,ty){ return tx>=0&&ty>=0&&tx<this.w&&ty<this.h; }
  isFloor(tx,ty){ return this.inB(tx,ty) && !this.solid[ty*this.w+tx]; }
}

function bspSplit(rng, region, minW, minH, depth, out){
  const {x,y,w,h} = region;
  const canH = h >= minH*2+1, canV = w >= minW*2+1;
  if(depth<=0 || (!canH && !canV) ){ out.push(region); return; }
  let vertical;
  if(canH && canV){
    const ratio = w/h;
    vertical = ratio>1.3 ? true : (ratio<0.77 ? false : rng.chance(0.5));
  } else vertical = canV;
  if(vertical){
    const cut = rng.i(x+minW, x+w-minW-1);
    bspSplit(rng,{x, y, w:cut-x+1, h}, minW,minH, depth-1, out);
    bspSplit(rng,{x:cut+1, y, w:x+w-cut-1, h}, minW,minH, depth-1, out);
  }else{
    const cut = rng.i(y+minH, y+h-minH-1);
    bspSplit(rng,{x, y, w, h:cut-y+1}, minW,minH, depth-1, out);
    bspSplit(rng,{x, y:cut+1, w, h:y+h-cut-1}, minW,minH, depth-1, out);
  }
}

function carveRect(g, x0,y0,x1,y1, kind){
  for(let ty=y0;ty<=y1;ty++) for(let tx=x0;tx<=x1;tx++){
    if(!g.inB(tx,ty))continue; const i=g.i(tx,ty); g.solid[i]=0;
    if(g.floor[i]===TT.VOID || kind===TT.ROOM) g.floor[i]=kind;
  }
}
function carveCorridor(g, ax,ay,bx,by, rng){
  // L-shaped, width 1, random elbow order
  const horizFirst = rng.chance(0.5);
  const stepX=(x0,x1,y)=>{ const s=Math.sign(x1-x0)||1; for(let x=x0;;x+=s){ const i=g.i(x,y);
      if(g.inB(x,y)){ g.solid[i]=0; if(g.floor[i]===TT.VOID) g.floor[i]=TT.CORR; } if(x===x1)break; } };
  const stepY=(y0,y1,x)=>{ const s=Math.sign(y1-y0)||1; for(let y=y0;;y+=s){ const i=g.i(x,y);
      if(g.inB(x,y)){ g.solid[i]=0; if(g.floor[i]===TT.VOID) g.floor[i]=TT.CORR; } if(y===y1)break; } };
  if(horizFirst){ stepX(ax,bx,ay); stepY(ay,by,bx); }
  else { stepY(ay,by,ax); stepX(ax,bx,by); }
}

/* flood-fill reachability over walkable tiles (props solid, doors passable) */
function reachFrom(g, startIdx, blockProps=true){
  const seen = new Uint8Array(g.n); const q = new Int32Array(g.n); let qs=0, qe=0;
  const walk = i => !g.solid[i] && !(blockProps && g.propAt[i]>=0 && PROP_KINDS[g._props[g.propAt[i]].kind].solid);
  if(!walk(startIdx)) return seen;
  seen[startIdx]=1; q[qe++]=startIdx;
  while(qs<qe){ const i=q[qs++]; const x=i%g.w, y=(i/g.w)|0;
    if(x>0){const j=i-1; if(!seen[j]&&walk(j)){seen[j]=1;q[qe++]=j;}}
    if(x<g.w-1){const j=i+1; if(!seen[j]&&walk(j)){seen[j]=1;q[qe++]=j;}}
    if(y>0){const j=i-g.w; if(!seen[j]&&walk(j)){seen[j]=1;q[qe++]=j;}}
    if(y<g.h-1){const j=i+g.w; if(!seen[j]&&walk(j)){seen[j]=1;q[qe++]=j;}}
  }
  return seen;
}
/* BFS distance in tiles from a start index (walls & solid props block) */
function bfsDist(g, startIdx){
  const d = new Int32Array(g.n).fill(-1); const q=new Int32Array(g.n); let qs=0,qe=0;
  const walk = i => !g.solid[i] && !(g.propAt[i]>=0 && PROP_KINDS[g._props[g.propAt[i]].kind].solid);
  if(!walk(startIdx)) return d;
  d[startIdx]=0; q[qe++]=startIdx;
  while(qs<qe){ const i=q[qs++]; const x=i%g.w,y=(i/g.w)|0; const nd=d[i]+1;
    if(x>0){const j=i-1; if(d[j]<0&&walk(j)){d[j]=nd;q[qe++]=j;}}
    if(x<g.w-1){const j=i+1; if(d[j]<0&&walk(j)){d[j]=nd;q[qe++]=j;}}
    if(y>0){const j=i-g.w; if(d[j]<0&&walk(j)){d[j]=nd;q[qe++]=j;}}
    if(y<g.h-1){const j=i+g.w; if(d[j]<0&&walk(j)){d[j]=nd;q[qe++]=j;}}
  }
  return d;
}
/* 0-1 BFS: minimum number of *locked* doors crossed from start to every tile */
function lockedCostField(g, doors, startIdx){
  const INF=1e9; const cost=new Int32Array(g.n).fill(INF);
  const prev=new Int32Array(g.n).fill(-1);
  const dq=new Int32Array(g.n*4); let head=g.n*2, tail=g.n*2;   // deque in the middle
  const walk = i => !g.solid[i] && !(g.propAt[i]>=0 && PROP_KINDS[g._props[g.propAt[i]].kind].solid);
  const wcost = i => { const di=g.doorAt[i]; return (di>=0 && doors[di].locked) ? 1 : 0; };
  if(!walk(startIdx)) return {cost,prev};
  cost[startIdx]=0; dq[tail++]=startIdx;
  while(head<tail){
    const i=dq[head++]; const x=i%g.w,y=(i/g.w)|0; const c=cost[i];
    const tryN=(j)=>{ if(!walk(j))return; const nc=c+wcost(j);
      if(nc<cost[j]){ cost[j]=nc; prev[j]=i;
        if(nc===c){ dq[--head]=j; } else { dq[tail++]=j; } } };
    if(x>0)tryN(i-1); if(x<g.w-1)tryN(i+1);
    if(y>0)tryN(i-g.w); if(y<g.h-1)tryN(i+g.w);
  }
  return {cost,prev};
}

function tileLOS(g, ax,ay,bx,by){   // integer Bresenham occlusion test (walls+opaque props)
  let x=ax,y=ay; const dx=Math.abs(bx-ax), dy=Math.abs(by-ay);
  const sx=ax<bx?1:-1, sy=ay<by?1:-1; let err=dx-dy;
  for(let guard=0; guard<400; guard++){
    if(x===bx&&y===by) return true;
    const e2=err*2;
    if(e2>-dy){ err-=dy; x+=sx; }
    if(e2<dx){ err+=dx; y+=sy; }
    if(!g.inB(x,y)) return false;
    if(x===bx&&y===by) return true;
    const i=g.i(x,y);
    if(g.solid[i]) return false;
    const p=g.propAt[i]; if(p>=0 && PROP_KINDS[g._props[p].kind].opaque) return false;
  }
  return false;
}

function makeMission(seedStr, presetId, diffId){
  const preset = presetById(presetId);
  const diff = diffById(diffId);
  for(let attempt=0; attempt<24; attempt++){
    const m = tryGenerate(seedStr, preset, diff, attempt);
    if(m) return m;
  }
  // Final fallback: the compact tutorial layout always generates.
  return tryGenerate(seedStr+'#fallback', presetById('annex'), diff, 0) ||
         tryGenerate('ANNEX-01', presetById('annex'), diffById('rookie'), 0);
}

function tryGenerate(seedStr, preset, diff, attempt){
  const rng = new Rng(hashStr(seedStr+'|'+preset.id+'|#'+attempt));
  // ---- dimensions / budget -------------------------------------------------
  let gw, gh, targetRooms, nGuards, nCams, nLoot, nLocked, lightDensity, goalName;
  if(preset.id === 'random'){
    gw = rng.i(36,56); gh = rng.i(26,38);
    targetRooms = rng.i(8,14); nGuards = rng.i(3,8); nCams = rng.i(2,7);
    nLoot = rng.i(3,8); nLocked = rng.i(1,5); lightDensity = rng.f(0.35,0.95);
    goalName = rng.pick(['Prototype Core','Sealed Dossier','Black Ledger','Signal Key','Ivory Reliquary','Encrypted Wafer']);
  } else {
    gw=preset.gw; gh=preset.gh; targetRooms=preset.rooms; nGuards=preset.guards;
    nCams=preset.cams; nLoot=preset.loot; nLocked=preset.locked; lightDensity=preset.lights;
    goalName = preset.goal;
  }
  nGuards = Math.max(2, Math.round(nGuards * diff.guardMul));
  nCams   = Math.max(1, Math.round(nCams   * diff.camMul));

  const g = new Grid(gw,gh);
  g._props = [];

  // ---- BSP rooms -----------------------------------------------------------
  const leaves = [];
  const depth = Math.max(2, Math.ceil(Math.log2(targetRooms)) + 1);
  bspSplit(rng, {x:1,y:1,w:gw-2,h:gh-2}, 8, 7, depth, leaves);
  if(leaves.length < 4) return null;
  rng.shuffle(leaves);
  const keep = leaves.slice(0, clamp(targetRooms, 4, leaves.length));
  const rooms = [];
  for(const L of keep){
    const iw = clamp(L.w-2, 3, 14), ih = clamp(L.h-2, 3, 12);
    const rw = rng.i(Math.max(3,Math.floor(iw*0.62)), iw);
    const rh = rng.i(Math.max(3,Math.floor(ih*0.62)), ih);
    const x0 = L.x + 1 + rng.i(0, Math.max(0, L.w-2-rw));
    const y0 = L.y + 1 + rng.i(0, Math.max(0, L.h-2-rh));
    const r = { id:rooms.length, x0, y0, x1:x0+rw-1, y1:y0+rh-1,
                cx:x0+((rw/2)|0), cy:y0+((rh/2)|0), w:rw, h:rh, area:rw*rh,
                role:'office', zone:0, name:'Room', restricted:false, lamps:[] };
    if(r.x1>=gw-1||r.y1>=gh-1||r.x0<1||r.y0<1) continue;
    rooms.push(r);
  }
  if(rooms.length < 4) return null;
  for(const r of rooms) carveRect(g, r.x0,r.y0,r.x1,r.y1, TT.ROOM);

  // ---- corridors: MST over room centres + a few loop edges ------------------
  const edges = [];
  for(let a=0;a<rooms.length;a++) for(let b=a+1;b<rooms.length;b++){
    const d = Math.abs(rooms[a].cx-rooms[b].cx)+Math.abs(rooms[a].cy-rooms[b].cy);
    edges.push([d,a,b]);
  }
  edges.sort((p,q)=>p[0]-q[0]);
  const parent = rooms.map((_,i)=>i);
  const find=(x)=>{ while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x]; } return x; };
  const chosen=[];
  for(const [d,a,b] of edges){ const ra=find(a), rb=find(b);
    if(ra!==rb){ parent[ra]=rb; chosen.push([a,b]); } }
  const extra = clamp(Math.round(rooms.length*0.32), 1, 8);
  let added=0;
  for(const [d,a,b] of edges){ if(added>=extra) break;
    if(chosen.some(e=>(e[0]===a&&e[1]===b)||(e[0]===b&&e[1]===a))) continue;
    if(rng.chance(0.5)){ chosen.push([a,b]); added++; } }
  for(const [a,b] of chosen) carveCorridor(g, rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy, rng);

  // re-stamp room ownership (corridors may have cut through room rects)
  for(const r of rooms) for(let ty=r.y0;ty<=r.y1;ty++) for(let tx=r.x0;tx<=r.x1;tx++){
    const i=g.i(tx,ty); if(!g.solid[i]){ g.floor[i]=TT.ROOM; g.room[i]=r.id; } }

  // enforce a solid border
  for(let x=0;x<gw;x++){ g.solid[g.i(x,0)]=1; g.solid[g.i(x,gh-1)]=1;
    g.floor[g.i(x,0)]=TT.VOID; g.floor[g.i(x,gh-1)]=TT.VOID; }
  for(let y=0;y<gh;y++){ g.solid[g.i(0,y)]=1; g.solid[g.i(gw-1,y)]=1;
    g.floor[g.i(0,y)]=TT.VOID; g.floor[g.i(gw-1,y)]=TT.VOID; }

  // connectivity of the raw shell
  let firstFloor=-1; for(let i=0;i<g.n;i++) if(!g.solid[i]){ firstFloor=i; break; }
  if(firstFloor<0) return null;
  {
    const seen = reachFrom(g, firstFloor, false);
    let total=0, reach=0;
    for(let i=0;i<g.n;i++) if(!g.solid[i]){ total++; if(seen[i])reach++; }
    if(reach < total) {  // fill unreachable pockets so nothing dangles
      for(let i=0;i<g.n;i++) if(!g.solid[i] && !seen[i]){ g.solid[i]=1; g.floor[i]=TT.VOID; g.room[i]=-1; }
    }
    // drop rooms that lost all their floor
    for(const r of rooms){ r.live=false;
      for(let ty=r.y0;ty<=r.y1&&!r.live;ty++) for(let tx=r.x0;tx<=r.x1;tx++)
        if(!g.solid[g.i(tx,ty)]){ r.live=true; break; } }
  }
  const liveRooms = rooms.filter(r=>r.live);
  if(liveRooms.length < 4) return null;

  // ---- doorways: geometric pinch points -----------------------------------
  const doors=[];
  for(let ty=1;ty<gh-1;ty++) for(let tx=1;tx<gw-1;tx++){
    const i=g.i(tx,ty); if(g.solid[i]) continue;
    const L=g.solid[i-1], R=g.solid[i+1], U=g.solid[i-gw], D=g.solid[i+gw];
    let horiz=null;
    if(L&&R&&!U&&!D) horiz=false;        // north-south passage, door slides horizontally
    else if(U&&D&&!L&&!R) horiz=true;    // east-west passage
    if(horiz===null) continue;
    const rA = horiz ? g.room[i-1] : g.room[i-gw];
    const rB = horiz ? g.room[i+1] : g.room[i+gw];
    if(rA===rB && rA!==-1) continue;     // interior pinch inside a single room: skip
    if(rA===-1 && rB===-1 && !rng.chance(0.22)) continue;  // corridor kink: rarely a door
    // avoid doors immediately adjacent to another door
    let near=false;
    for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue; const j=g.i(tx+dx,ty+dy); if(g.inB(tx+dx,ty+dy)&&g.doorAt[j]>=0){near=true;break;} }
    if(near) continue;
    const d={ id:doors.length, tx, ty, x:(tx+0.5)*TILE, y:(ty+0.5)*TILE, horiz,
              locked:false, zone:0, open:0, target:0, autoT:0, forced:false, jam:0 };
    doors.push(d); g.doorAt[i]=d.id; g.floor[i]=TT.DOOR;
  }

  // ---- room roles ----------------------------------------------------------
  const borderScore = r => Math.min(r.x0, r.y0, gw-1-r.x1, gh-1-r.y1);
  const sortedByBorder = liveRooms.slice().sort((a,b)=>borderScore(a)-borderScore(b));
  const entryRoom = sortedByBorder[0];
  entryRoom.role='entry';
  const eIdx = g.i(entryRoom.cx, entryRoom.cy);
  let entryTile = eIdx;
  if(g.solid[entryTile]){ // find any floor tile in the entry room
    outer: for(let ty=entryRoom.y0;ty<=entryRoom.y1;ty++) for(let tx=entryRoom.x0;tx<=entryRoom.x1;tx++)
      if(!g.solid[g.i(tx,ty)]){ entryTile=g.i(tx,ty); break outer; }
  }
  const distE = bfsDist(g, entryTile);
  const roomDist = r=>{ let best=-1;
    for(let ty=r.y0;ty<=r.y1;ty++) for(let tx=r.x0;tx<=r.x1;tx++){ const d=distE[g.i(tx,ty)]; if(d>best)best=d; }
    return best; };
  for(const r of liveRooms) r.dist = roomDist(r);
  const reachable = liveRooms.filter(r=>r.dist>=0);
  if(reachable.length < 4) return null;
  const byDist = reachable.slice().sort((a,b)=>b.dist-a.dist);
  const vaultRoom = byDist[0]; vaultRoom.role='vault'; vaultRoom.restricted=true;
  // extraction: near a border, far from the vault, not the vault
  let exfilRoom = null; let bestX=-1;
  for(const r of reachable){ if(r===vaultRoom) continue;
    const bs = borderScore(r); if(bs>4) continue;
    const s = r.dist*0.55 + (Math.abs(r.cx-vaultRoom.cx)+Math.abs(r.cy-vaultRoom.cy))*0.9 - bs*3;
    if(s>bestX){ bestX=s; exfilRoom=r; } }
  if(!exfilRoom) exfilRoom = entryRoom;
  if(exfilRoom!==entryRoom) exfilRoom.role='exfil';
  const mids = reachable.filter(r=>r!==vaultRoom && r!==entryRoom && r!==exfilRoom)
                        .sort((a,b)=>b.area-a.area);
  if(mids[0]) { mids[0].role='security'; mids[0].restricted=true; }
  if(mids[1]) { mids[1].role='server'; mids[1].restricted=true; }
  const rest = mids.slice(2);
  rng.shuffle(rest);
  rest.forEach((r,k)=>{ r.role = ['office','storage','gallery','utility','office','gallery'][k%6]; });
  // zones (2..4) by spatial quadrant, so terminals govern coherent areas
  const nZones = clamp(Math.round(reachable.length/3.4), 2, 4);
  for(const r of reachable){
    const fx = (r.cx/gw), fy=(r.cy/gh);
    r.zone = nZones<=2 ? (fx<0.5?0:1) : (nZones===3 ? (fx<0.34?0:(fx<0.67?1:2))
           : ((fx<0.5?0:1) + (fy<0.5?0:2)));
  }
  for(const r of reachable){ r.name = ROOM_NAMES[r.role] ? ROOM_NAMES[r.role][r.id % ROOM_NAMES[r.role].length] : 'Room';
    for(let ty=r.y0;ty<=r.y1;ty++) for(let tx=r.x0;tx<=r.x1;tx++){ const i=g.i(tx,ty);
      if(!g.solid[i] && g.room[i]===r.id){ g.zone[i]=r.zone; if(r.restricted) g.restricted[i]=1; } } }
  // doors inherit the zone of an adjacent room
  for(const d of doors){ const i=g.i(d.tx,d.ty);
    const nb=[i-1,i+1,i-gw,i+gw].filter(j=>j>=0&&j<g.n&&!g.solid[j]&&g.room[j]>=0);
    d.zone = nb.length ? g.zone[nb[0]] : 0;
    d.roomA = nb.length? g.room[nb[0]] : -1;
  }
  return finishMission(g, rng, {rooms:reachable, allRooms:rooms, doors, entryRoom, exfilRoom, vaultRoom,
    entryTile, gw, gh, preset, diff, seedStr, nGuards, nCams, nLoot, nLocked, lightDensity, goalName, nZones});
}

/* --- population, security, patrols, and the validation pass ---------------- */
function finishMission(g, rng, C){
  const {rooms, doors, entryRoom, exfilRoom, vaultRoom, gw, gh, preset, diff} = C;
  const gwv=gw;
  const props=g._props;
  const nearDoor = (tx,ty)=>{ for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const j=tx+dx, k=ty+dy; if(!g.inB(j,k))continue; if(g.doorAt[g.i(j,k)]>=0) return true; } return false; };
  const freeTiles = (r, pad=0)=>{ const out=[];
    for(let ty=r.y0+pad;ty<=r.y1-pad;ty++) for(let tx=r.x0+pad;tx<=r.x1-pad;tx++){
      if(!g.inB(tx,ty))continue; const i=g.i(tx,ty);
      if(g.solid[i]||g.propAt[i]>=0||g.doorAt[i]>=0||nearDoor(tx,ty)) continue;
      if(g.room[i]!==r.id) continue;
      out.push(i); } return out; };

  // ---- props / cover -------------------------------------------------------
  const propMix = {
    entry:['crate','crate','shelf','pillar'], vault:['pillar','glass','crate'],
    security:['desk','desk','server','shelf'], server:['server','server','server','pillar'],
    office:['desk','desk','shelf','planter'], storage:['crate','crate','crate','shelf'],
    gallery:['glass','glass','planter','pillar'], utility:['crate','pillar','shelf'],
    exfil:['crate','planter','pillar'],
  };
  for(const r of rooms){
    const mix = propMix[r.role] || propMix.office;
    const density = r.role==='gallery'?0.15 : r.role==='vault'?0.09 : 0.13;
    let want = Math.round(r.area * density * rng.f(0.75,1.35));
    want = clamp(want, 0, Math.max(0, Math.floor(r.area*0.28)));
    const cand = freeTiles(r);
    rng.shuffle(cand);
    for(let k=0;k<want && k<cand.length;k++){
      const i=cand[k]; const tx=i%gwv, ty=(i/gwv)|0;
      // never wall off a tile: require at least 2 free orthogonal neighbours after placing
      let free=0; for(const j of [i-1,i+1,i-gwv,i+gwv]) if(!g.solid[j] && g.propAt[j]<0) free++;
      if(free<3) continue;
      const kind = rng.pick(mix);
      const p={ id:props.length, tx, ty, x:(tx+0.5)*TILE, y:(ty+0.5)*TILE, kind,
                rot: rng.chance(0.5)?0:1, seed: rng.i(0,999) };
      props.push(p); g.propAt[i]=p.id;
    }
  }
  // remove props that break connectivity to any room
  {
    let startI = C.entryTile;
    for(let pass=0; pass<8; pass++){
      const seen = reachFrom(g, startI, true);
      let broken = [];
      for(const r of rooms){ let ok=false;
        for(let ty=r.y0;ty<=r.y1&&!ok;ty++) for(let tx=r.x0;tx<=r.x1;tx++){
          const i=g.i(tx,ty); if(!g.solid[i] && seen[i]){ ok=true; break; } }
        if(!ok) broken.push(r); }
      if(!broken.length) break;
      // strip props in and around broken rooms
      for(const r of broken){
        for(let ty=r.y0-1;ty<=r.y1+1;ty++) for(let tx=r.x0-1;tx<=r.x1+1;tx++){
          if(!g.inB(tx,ty))continue; const i=g.i(tx,ty);
          if(g.propAt[i]>=0){ props[g.propAt[i]].dead=true; g.propAt[i]=-1; } }
      }
    }
  }

  // ---- entry / extraction pads --------------------------------------------
  const padIn = (r)=>{ const c=freeTiles(r); if(!c.length){ // fallback: any floor
      for(let ty=r.y0;ty<=r.y1;ty++)for(let tx=r.x0;tx<=r.x1;tx++){const i=g.i(tx,ty); if(!g.solid[i]&&g.propAt[i]<0)c.push(i);} }
    if(!c.length) return C.entryTile;
    // prefer the tile closest to the map border
    c.sort((a,b)=>{ const ax=a%gwv,ay=(a/gwv)|0,bx=b%gwv,by=(b/gwv)|0;
      const da=Math.min(ax,ay,gw-1-ax,gh-1-ay), db=Math.min(bx,by,gw-1-bx,gh-1-by); return da-db; });
    return c[0]; };
  const entryI = padIn(entryRoom);
  const exfilI = exfilRoom===entryRoom ? entryI : padIn(exfilRoom);
  const T2W = i => ({ x:((i%gwv)+0.5)*TILE, y:(((i/gwv)|0)+0.5)*TILE, tx:i%gwv, ty:(i/gwv)|0 });
  const entry = T2W(entryI), exfil = T2W(exfilI);

  // ---- objective -----------------------------------------------------------
  let objTiles = freeTiles(vaultRoom);
  if(!objTiles.length){ for(let ty=vaultRoom.y0;ty<=vaultRoom.y1;ty++)for(let tx=vaultRoom.x0;tx<=vaultRoom.x1;tx++){
      const i=g.i(tx,ty); if(!g.solid[i]&&g.propAt[i]<0)objTiles.push(i);} }
  if(!objTiles.length) return null;
  objTiles.sort((a,b)=> d2(a%gwv,(a/gwv)|0,vaultRoom.cx,vaultRoom.cy) - d2(b%gwv,(b/gwv)|0,vaultRoom.cx,vaultRoom.cy));
  const objI = objTiles[0];
  const objective = Object.assign(T2W(objI), { name:C.goalName||'Objective', taken:false,
    progress:0, room:vaultRoom.id, holdTime: 2.6 });
  g.propAt[objI] = -1;

  // ---- loot ----------------------------------------------------------------
  const LOOT_NAMES=['Cash bundle','Signet ring','Data stick','Rare coin','Silver case','Art piece',
                    'Passport set','Watch','Bearer note','Cipher wheel'];
  const loot=[];
  const lootRooms = rooms.filter(r=>r!==entryRoom);
  for(let k=0;k<C.nLoot;k++){
    const r = rng.pick(lootRooms); const c = freeTiles(r).filter(i=>i!==objI);
    if(!c.length) continue;
    const i = rng.pick(c);
    if(loot.some(L=>L.tileI===i)) continue;
    loot.push(Object.assign(T2W(i), { id:loot.length, tileI:i, taken:false,
      value: rng.i(2,6)*50, name: rng.pick(LOOT_NAMES) }));
  }

  // ---- terminals -----------------------------------------------------------
  const terminals=[];
  const termRooms = rooms.filter(r=>['security','server','office','utility','storage'].includes(r.role));
  rng.shuffle(termRooms);
  const wantTerms = clamp(2 + Math.round(rooms.length/6), 2, 5);
  const actions = ['doors','cameras','lights','alarm'];
  for(let k=0;k<wantTerms;k++){
    const r = termRooms[k % Math.max(1,termRooms.length)] || rng.pick(rooms);
    const c = freeTiles(r).filter(i=>{ // wall-adjacent looks better
      return g.solid[i-1]||g.solid[i+1]||g.solid[i-gwv]||g.solid[i+gwv]; });
    const pool = c.length?c:freeTiles(r); if(!pool.length) continue;
    const i = rng.pick(pool);
    if(terminals.some(t=>t.tileI===i)) continue;
    const act = k===0 ? 'doors' : (k===1 ? 'cameras' : rng.pick(actions));
    let facing = 0;
    if(g.solid[i-gwv]) facing = PI/2; else if(g.solid[i+gwv]) facing = -PI/2;
    else if(g.solid[i-1]) facing = 0; else facing = PI;
    terminals.push(Object.assign(T2W(i), { id:terminals.length, tileI:i, action:act, zone:r.zone,
      room:r.id, used:false, progress:0, holdTime: act==='doors'?2.4:2.0, facing, blink: rng.f(0,TAU) }));
    g.propAt[i]=-1;
  }

  // ---- cameras -------------------------------------------------------------
  const cameras=[];
  const camSpots=[];
  for(let ty=1;ty<gh-1;ty++) for(let tx=1;tx<gw-1;tx++){
    const i=g.i(tx,ty); if(g.solid[i]||g.propAt[i]>=0||g.doorAt[i]>=0) continue;
    const walls=[ g.solid[i-1]?PI:0, g.solid[i+1]?0:0 ];
    let face=null;
    if(g.solid[i-1]) face=0; else if(g.solid[i+1]) face=PI;
    else if(g.solid[i-gwv]) face=PI/2; else if(g.solid[i+gwv]) face=-PI/2;
    if(face===null) continue;
    const rid=g.room[i];
    let w = 1;
    if(rid>=0){ const r=rooms.find(rr=>rr.id===rid);
      if(r){ if(r.restricted) w=4; else if(r.role==='entry') w=0.4; else w=1.4; } }
    else w = 2.2;   // corridors are prime camera turf
    camSpots.push({i,face,w,tx,ty});
  }
  // weighted spread selection: keep cameras apart
  rng.shuffle(camSpots);
  camSpots.sort((a,b)=>b.w-a.w);
  for(const s of camSpots){
    if(cameras.length>=C.nCams) break;
    if(cameras.some(c=> Math.abs(c.tx-s.tx)+Math.abs(c.ty-s.ty) < 7)) continue;
    if(rng.chance(0.18)) continue;
    const sweep = rng.f(0.45, 1.0);
    cameras.push({ id:cameras.length, tileI:s.i, tx:s.tx, ty:s.ty,
      x:(s.tx+0.5)*TILE, y:(s.ty+0.5)*TILE, base:s.face, sweep,
      speed: rng.f(0.32,0.55)*(0.85+0.3*diff.respond), phase: rng.f(0,TAU),
      fov: 0.62*diff.fov, range: (7.6*diff.view)*TILE, zone: g.zone[s.i],
      enabled:true, disabledT:0, seeT:0, alertT:0, ang:s.face, spotted:false });
  }

  // ---- lamps + baked light -------------------------------------------------
  const lamps=[];
  for(const r of rooms){
    const n = clamp(Math.round(r.area/26 * (0.4+C.lightDensity)), r.role==='vault'?1:0, 4);
    for(let k=0;k<n;k++){
      const c = freeTiles(r); if(!c.length) break;
      const i = rng.pick(c);
      lamps.push({ id:lamps.length, tileI:i, tx:i%gwv, ty:(i/gwv)|0, x:((i%gwv)+0.5)*TILE, y:((((i/gwv)|0))+0.5)*TILE,
        r: rng.f(3.6,6.2), intensity: rng.f(0.55,0.9)*(0.55+0.55*C.lightDensity),
        zone:r.zone, on:true, flicker: rng.chance(0.12)? rng.f(0.5,1.4):0, phase:rng.f(0,TAU) });
    }
  }
  // corridor lamps
  const corrTiles=[]; for(let i=0;i<g.n;i++) if(!g.solid[i] && g.room[i]<0 && g.propAt[i]<0 && g.doorAt[i]<0) corrTiles.push(i);
  rng.shuffle(corrTiles);
  const nCorrLamps = Math.round(corrTiles.length/16 * (0.35+C.lightDensity));
  for(let k=0;k<nCorrLamps && k<corrTiles.length;k++){
    const i=corrTiles[k*3 % corrTiles.length];
    if(lamps.some(l=>Math.abs(l.tx-(i%gwv))+Math.abs(l.ty-((i/gwv)|0))<4)) continue;
    lamps.push({ id:lamps.length, tileI:i, tx:i%gwv, ty:(i/gwv)|0, x:((i%gwv)+0.5)*TILE, y:((((i/gwv)|0))+0.5)*TILE,
      r: rng.f(3.0,4.6), intensity: rng.f(0.4,0.7)*(0.5+0.5*C.lightDensity), zone:g.zone[i], on:true,
      flicker: rng.chance(0.16)? rng.f(0.6,1.6):0, phase:rng.f(0,TAU) });
  }
  const ambient = clamp(0.11 + 0.055*C.lightDensity, 0.08, 0.2);

  // ---- locked doors --------------------------------------------------------
  const distE2 = bfsDist(g, entryI);
  const lockable = doors.filter(d=> distE2[g.i(d.tx,d.ty)] > 4)
                        .sort((a,b)=> distE2[g.i(b.tx,b.ty)] - distE2[g.i(a.tx,a.ty)]);
  const lockCount = clamp(C.nLocked, 0, lockable.length);
  for(let k=0;k<lockCount;k++){ lockable[k].locked = true; lockable[k].wasLocked = true; }

  // ---- guarantee the objective + exfil are obtainable ----------------------
  // The player carries a finite number of lock shims, and the run is entry → objective →
  // extraction. Guarantee the WHOLE route fits the budget with one shim to spare, otherwise
  // a legal mission could still be unwinnable half way through.
  const shims = Math.max(1, Math.round(GADGET_DEFS.find(x=>x.id==='lockpick').charges * diff.gadgetMul));
  const lockBudget = Math.max(0, shims-1);
  const firstLockedOnPath = (field, fromI, toI)=>{
    let cur=toI;
    while(cur>=0 && cur!==fromI){ const di=g.doorAt[cur];
      if(di>=0 && doors[di].locked) return doors[di];
      cur = field.prev[cur]; }
    return null;
  };
  {
    let ok=false;
    for(let iter=0; iter<28; iter++){
      const f1 = lockedCostField(g, doors, entryI);
      if(f1.cost[objI] >= 1e9) return null;          // unreachable even with every door open
      const f2 = lockedCostField(g, doors, objI);
      if(f2.cost[exfilI] >= 1e9) return null;
      if(f1.cost[objI] + f2.cost[exfilI] <= lockBudget){ ok=true; break; }
      const useFirst = f1.cost[objI] >= f2.cost[exfilI];
      const d0 = useFirst ? firstLockedOnPath(f1, entryI, objI) : firstLockedOnPath(f2, objI, exfilI);
      if(!d0) break;
      d0.locked=false; d0.relieved=true;
    }
    if(!ok) return null;
  }

  // ---- final reachability validation --------------------------------------
  {
    const seen = reachFrom(g, entryI, true);
    if(!seen[objI] || !seen[exfilI]) return null;
    for(const t of terminals) if(!seen[t.tileI]) t.unreachable=true;
    for(let k=loot.length-1;k>=0;k--) if(!seen[loot[k].tileI]) loot.splice(k,1);
    const usableTerms = terminals.filter(t=>!t.unreachable);
    if(usableTerms.length===0 && terminals.length>0) return null;
    C._reach = seen;
  }

  // ---- patrol routes -------------------------------------------------------
  const seen = C._reach;
  const nodes=[];
  for(const r of rooms){ const c=freeTiles(r).filter(i=>seen[i]); if(c.length) nodes.push({i:c[(c.length/2)|0], room:r}); }
  // corridor junctions add texture to routes
  for(let i=0;i<g.n;i++){ if(g.solid[i]||g.room[i]>=0||!seen[i]||g.doorAt[i]>=0) continue;
    let deg=0; for(const j of [i-1,i+1,i-gwv,i+gwv]) if(!g.solid[j]) deg++;
    if(deg>=3 && rng.chance(0.5)) nodes.push({i, room:null}); }
  if(nodes.length<3) return null;

  const routes=[]; const guardSpawns=[];
  const entryTx=entry.tx, entryTy=entry.ty;
  // The insertion point is a quiet pocket: nobody walks a beat through the player's
  // doorway, so a mission always opens with room to read the level.
  const away = n=>{ const tx=n.i%gwv, ty=(n.i/gwv)|0;
    return Math.abs(tx-entryTx)+Math.abs(ty-entryTy); };
  const safeNodes = nodes.filter(n=>away(n) > 7);
  const patrolNodes = safeNodes.length>=3 ? safeNodes : nodes;
  const farNodes = patrolNodes.filter(n=>away(n) > 10);
  const spawnPool = farNodes.length>=C.nGuards ? farNodes : patrolNodes;
  for(let k=0;k<C.nGuards;k++){
    const start = spawnPool[(k*7+3) % spawnPool.length];
    const len = rng.i(3,5);
    const chosen=[start];
    let cur=start;
    for(let s=1;s<len;s++){
      const cands = patrolNodes.filter(n=>!chosen.includes(n));
      if(!cands.length) break;
      cands.sort((a,b)=> d2(a.i%gwv,(a.i/gwv)|0,cur.i%gwv,(cur.i/gwv)|0) - d2(b.i%gwv,(b.i/gwv)|0,cur.i%gwv,(cur.i/gwv)|0));
      const pickFrom = cands.slice(0, Math.min(5, cands.length));
      const nx = pickFrom[rng.i(0, pickFrom.length-1)];
      chosen.push(nx); cur=nx;
    }
    const wps = chosen.map(n=>({ x:((n.i%gwv)+0.5)*TILE, y:(((n.i/gwv)|0)+0.5)*TILE, tileI:n.i,
      dwell: rng.f(1.4,3.6), roomName: n.room? n.room.name : 'corridor' }));
    routes.push(wps);
    guardSpawns.push({ x:wps[0].x, y:wps[0].y, route:routes.length-1, ang: rng.f(0,TAU) });
  }

  // ---- assemble ------------------------------------------------------------
  const mission = {
    version:2, seed:C.seedStr, presetId:preset.id, diffId:diff.id,
    name:preset.id==='random' ? 'Contract '+String(hashStr(C.seedStr)%9973).padStart(4,'0') : preset.name,
    story:preset.story, tag:preset.tag,
    gw, gh, grid:g, rooms, doors, props:props.filter(p=>!p.dead), cameras, terminals, loot,
    lamps, ambient, objective, entry, exfil, routes, guardSpawns,
    nZones:C.nZones, lightDensity:C.lightDensity,
    entryTile:entryI, objTile:objI, exfilTile:exfilI,
    vaultRoomId:vaultRoom.id, entryRoomId:entryRoom.id, exfilRoomId:exfilRoom.id,
  };
  // rebuild propAt against the filtered array
  g.propAt.fill(-1);
  mission.props.forEach((p,k)=>{ p.id=k; g.propAt[g.i(p.tx,p.ty)]=k; });
  g._props = mission.props;
  bakeLight(mission);
  return mission;
}

function bakeLight(m){
  const g=m.grid; g.light.fill(m.ambient);
  for(const L of m.lamps){
    if(!L.on) continue;
    const R = Math.ceil(L.r);
    for(let ty=L.ty-R; ty<=L.ty+R; ty++) for(let tx=L.tx-R; tx<=L.tx+R; tx++){
      if(!g.inB(tx,ty)) continue; const i=g.i(tx,ty); if(g.solid[i]) continue;
      const dd = Math.hypot(tx-L.tx, ty-L.ty); if(dd>L.r) continue;
      if(dd>1 && !tileLOS(g, L.tx,L.ty, tx,ty)) continue;
      const f = 1 - (dd/L.r); g.light[i] = Math.min(1, g.light[i] + L.intensity*f*f);
    }
  }
}

/* ============================================================================
   3. SPATIAL QUERIES — ray casting, A*, sound propagation
   ========================================================================= */
const SIGHT = { WALL:1, PROP:2, DOOR:4, SMOKE:8, ALL:15 };

function tileIdxAt(m,x,y){
  const tx=(x/TILE)|0, ty=(y/TILE)|0;
  if(tx<0||ty<0||tx>=m.gw||ty>=m.gh) return -1;
  return ty*m.gw+tx;
}
function doorBlocksSight(m,di){ const d=m.doors[di]; return d.open < 0.55; }
function doorBlocksMove(m,di){ const d=m.doors[di]; return d.open < 0.42; }

function blocksSightTile(m,i,flags){
  const g=m.grid;
  if((flags&SIGHT.WALL) && g.solid[i]) return true;
  if(flags&SIGHT.PROP){ const p=g.propAt[i]; if(p>=0 && PROP_KINDS[m.props[p].kind].opaque) return true; }
  if(flags&SIGHT.DOOR){ const d=g.doorAt[i]; if(d>=0 && doorBlocksSight(m,d)) return true; }
  return false;
}
function blocksMoveTile(m,i){
  const g=m.grid;
  if(g.solid[i]) return true;
  const p=g.propAt[i]; if(p>=0 && PROP_KINDS[m.props[p].kind].solid) return true;
  const d=g.doorAt[i]; if(d>=0 && doorBlocksMove(m,d)) return true;
  return false;
}

/* DDA ray march. Returns distance travelled before hitting a blocker (or maxD). */
function castRay(m, x0,y0, ang, maxD, flags){
  const dx=Math.cos(ang), dy=Math.sin(ang);
  let tx=Math.floor(x0/TILE), ty=Math.floor(y0/TILE);
  if(tx<0||ty<0||tx>=m.gw||ty>=m.gh) return 0;
  const stepX = dx>0?1:-1, stepY = dy>0?1:-1;
  const tDX = dx===0 ? Infinity : Math.abs(TILE/dx);
  const tDY = dy===0 ? Infinity : Math.abs(TILE/dy);
  let tMaxX = dx===0 ? Infinity : (dx>0 ? ((tx+1)*TILE - x0)/dx : (tx*TILE - x0)/dx);
  let tMaxY = dy===0 ? Infinity : (dy>0 ? ((ty+1)*TILE - y0)/dy : (ty*TILE - y0)/dy);
  let t=0;
  if(blocksSightTile(m, ty*m.gw+tx, flags)) return 0;
  for(let s=0;s<512;s++){
    if(tMaxX < tMaxY){ t=tMaxX; tx+=stepX; tMaxX+=tDX; }
    else { t=tMaxY; ty+=stepY; tMaxY+=tDY; }
    if(t>maxD) return maxD;
    if(tx<0||ty<0||tx>=m.gw||ty>=m.gh) return Math.min(t,maxD);
    if(blocksSightTile(m, ty*m.gw+tx, flags)) return t;
  }
  return maxD;
}
/* Straight-line visibility between two world points. */
function losClear(m, x0,y0, x1,y1, flags, smokes){
  const dx=x1-x0, dy=y1-y0; const len=Math.hypot(dx,dy);
  if(len<0.0001) return true;
  if(smokes && smokes.length && (flags&SIGHT.SMOKE)){
    for(const s of smokes){
      if(s.life<=0) continue;
      // segment / circle intersection
      const fx=x0-s.x, fy=y0-s.y;
      const a=dx*dx+dy*dy, b=2*(fx*dx+fy*dy), c=fx*fx+fy*fy - s.r*s.r;
      const disc=b*b-4*a*c;
      if(disc>=0){ const sq=Math.sqrt(disc); const t1=(-b-sq)/(2*a), t2=(-b+sq)/(2*a);
        if((t1>=0&&t1<=1)||(t2>=0&&t2<=1)||(t1<0&&t2>1)) return false; }
    }
  }
  const ang=Math.atan2(dy,dx);
  return castRay(m, x0,y0, ang, len, flags) >= len - 0.5;
}

/* ---- A* over the tile grid (8-way, no corner cutting) -------------------- */
class PathFinder{
  constructor(){ this.gen=0; this.lockCost=1.6; this._lockCost=1.6; }
  bind(m){
    if(this.m===m) return;
    this.m=m; const n=m.gw*m.gh;
    this.g=new Float32Array(n); this.f=new Float32Array(n);
    this.came=new Int32Array(n); this.stamp=new Uint32Array(n); this.closed=new Uint8Array(n);
    this.heap=new Heap(); this.gen=0;
  }
  passable(i){ const m=this.m, gr=m.grid;
    if(gr.solid[i]) return false;
    const p=gr.propAt[i]; if(p>=0 && PROP_KINDS[m.props[p].kind].solid) return false;
    return true; }
  stepCost(i){ const m=this.m; const d=m.grid.doorAt[i];
    if(d>=0){ const dr=m.doors[d]; return dr.locked ? this._lockCost : (dr.open<0.5 ? 1.5 : 1.0); }
    return 1; }
  /** returns array of tile indices from start to goal (inclusive), or null */
  find(sx,sy,gx,gy,maxNodes=5200,lockCost){
    const m=this.m; if(!m) return null;
    this._lockCost = lockCost===undefined ? this.lockCost : lockCost;
    const W=m.gw,H=m.gh;
    let si=tileIdxAt(m,sx,sy), gi=tileIdxAt(m,gx,gy);
    if(si<0||gi<0) return null;
    if(!this.passable(si)) si = this.nearestOpen(si); if(si<0) return null;
    if(!this.passable(gi)) gi = this.nearestOpen(gi); if(gi<0) return null;
    if(si===gi) return [si];
    const gen=++this.gen; const {g,f,came,stamp,closed,heap}=this;
    heap.clear();
    stamp[si]=gen; g[si]=0; closed[si]=0; came[si]=-1;
    const hx=gi%W, hy=(gi/W)|0;
    const hfn=(i)=>{ const x=i%W,y=(i/W)|0; const dx=Math.abs(x-hx),dy=Math.abs(y-hy);
      return (dx+dy) + (1.4142-2)*Math.min(dx,dy); };
    f[si]=hfn(si); heap.push(si,f[si]);
    let expanded=0;
    while(heap.size){
      const cur=heap.pop();
      if(closed[cur]===gen) continue;
      closed[cur]=gen;
      if(cur===gi){ // reconstruct
        const out=[]; let i=cur; while(i>=0){ out.push(i); i=(stamp[i]===gen)?came[i]:-1; if(out.length>9000)break; }
        out.reverse(); return out; }
      if(++expanded>maxNodes) break;
      const cx=cur%W, cy=(cur/W)|0; const gc=g[cur];
      for(let k=0;k<8;k++){
        const dx = k<4 ? [0,0,-1,1][k] : [-1,1,-1,1][k-4];
        const dy = k<4 ? [-1,1,0,0][k] : [-1,-1,1,1][k-4];
        const nx=cx+dx, ny=cy+dy;
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const ni=ny*W+nx;
        if(!this.passable(ni)) continue;
        if(dx&&dy){ if(!this.passable(cy*W+nx) || !this.passable(ny*W+cx)) continue; }
        const step = (dx&&dy?1.4142:1) * this.stepCost(ni);
        const ng = gc + step;
        if(stamp[ni]===gen && ng >= g[ni]) continue;
        stamp[ni]=gen; g[ni]=ng; came[ni]=cur; f[ni]=ng+hfn(ni);
        heap.push(ni,f[ni]);
      }
    }
    return null;
  }
  nearestOpen(i){
    const m=this.m,W=m.gw,H=m.gh; const x0=i%W,y0=(i/W)|0;
    for(let r=1;r<=6;r++){ for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
      const x=x0+dx,y=y0+dy; if(x<0||y<0||x>=W||y>=H) continue;
      const j=y*W+x; if(this.passable(j)) return j; } }
    return -1;
  }
  /** string-pull a tile path into world waypoints */
  smooth(path, smokes){
    const m=this.m; if(!path||path.length<2) return path? path.map(i=>this.center(i)) : [];
    const pts = path.map(i=>this.center(i));
    // doorways are mandatory waypoints: never string-pull across one, or actors
    // clip the frame and wedge themselves on the jamb.
    const doorIdx=[]; for(let k=0;k<path.length;k++) if(m.grid.doorAt[path[k]]>=0) doorIdx.push(k);
    const out=[pts[0]];
    let i=0, guard=0;
    while(i<pts.length-1 && guard++<400){
      let cap=pts.length-1;
      for(const dk of doorIdx) if(dk>i){ cap=dk; break; }
      let j=cap;
      for(; j>i+1; j--){
        if(losClear(m, pts[i].x,pts[i].y, pts[j].x,pts[j].y, SIGHT.WALL|SIGHT.PROP, null)
           && this.corridorClear(pts[i],pts[j])) break;
      }
      out.push(pts[j]); i=j;
    }
    return out;
  }
  corridorClear(a,b){ // sample a thin capsule so guards don't clip corners
    const m=this.m; const dx=b.x-a.x, dy=b.y-a.y; const len=Math.hypot(dx,dy);
    if(len<1) return true;
    const nx=-dy/len*9, ny=dx/len*9;
    return losClear(m,a.x+nx,a.y+ny,b.x+nx,b.y+ny,SIGHT.WALL|SIGHT.PROP,null) &&
           losClear(m,a.x-nx,a.y-ny,b.x-nx,b.y-ny,SIGHT.WALL|SIGHT.PROP,null);
  }
  center(i){ const W=this.m.gw; return { x:((i%W)+0.5)*TILE, y:(((i/W)|0)+0.5)*TILE, i }; }
}
const PF = new PathFinder();

/* ---- sound propagation: Dijkstra flood with door attenuation ------------- */
const SoundField = {
  m:null, val:null, stamp:null, gen:0, heap:new Heap(), touched:[],
  bind(m){ if(this.m===m) return; this.m=m; const n=m.gw*m.gh;
    this.val=new Float32Array(n); this.stamp=new Uint32Array(n); this.gen=0; },
  /** flood from a tile with `budget` tiles of travel; returns nothing, query with at() */
  flood(tx,ty,budget){
    const m=this.m, W=m.gw, H=m.gh, g=m.grid;
    const gen=++this.gen; const heap=this.heap; heap.clear();
    const start=ty*W+tx;
    if(start<0||start>=m.gw*m.gh) return;
    this.stamp[start]=gen; this.val[start]=0; heap.push(start,0);
    let iter=0;
    while(heap.size && iter++<9000){
      const i=heap.pop(); const c=this.val[i];
      if(c>budget) continue;
      const x=i%W,y=(i/W)|0;
      for(let k=0;k<4;k++){
        const nx=x+[1,-1,0,0][k], ny=y+[0,0,1,-1][k];
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const ni=ny*W+nx;
        if(g.solid[ni]) continue;                              // walls stop sound
        let step=1;
        const di=g.doorAt[ni];
        if(di>=0){ const d=m.doors[di]; if(d.open<0.5) step += 4.5*(1-d.open); }
        const p=g.propAt[ni]; if(p>=0 && PROP_KINDS[m.props[p].kind].solid) step += 1.2;
        const nc=c+step;
        if(nc>budget) continue;
        if(this.stamp[ni]===gen && this.val[ni]<=nc) continue;
        this.stamp[ni]=gen; this.val[ni]=nc; heap.push(ni,nc);
      }
    }
    this.budget=budget; this.curGen=gen;
  },
  /** 0..1 loudness at a world position for the most recent flood */
  at(x,y){ const m=this.m; const i=tileIdxAt(m,x,y); if(i<0) return 0;
    if(this.stamp[i]!==this.curGen) return 0;
    return clamp(1 - this.val[i]/this.budget, 0, 1); },
  pathDist(x,y){ const m=this.m; const i=tileIdxAt(m,x,y); if(i<0) return Infinity;
    if(this.stamp[i]!==this.curGen) return Infinity; return this.val[i]; }
};

/* ============================================================================
   4. GUARD — stateful AI with perception, hearing, pathing and radio
   ========================================================================= */
const GUARD_NAMES=['ORRIN','BASS','KETT','VOSS','MARLOW','DRAY','SELK','HOBB','RIEL','TARN','WICK','FEN','GRAU','PELL'];

class Guard{
  constructor(sim, id, spawn, route){
    const d = sim.diff;
    this.id=id; this.name=GUARD_NAMES[id%GUARD_NAMES.length];
    this.x=spawn.x; this.y=spawn.y; this.r=10;
    this.vx=0; this.vy=0; this.facing=spawn.ang||0;
    this.route=route||[]; this.wp = 0; this.dirStep=1;
    this.state=GS.PATROL; this.stateT=0; this.prevState=GS.PATROL;
    this.aware=0; this.alertKnown=0;
    this.path=null; this.pathIdx=0; this.repathT=0; this.goal=null; this.goalKey='';
    this.lkp=null; this.lkpAge=0; this.poi=null;
    this.searchPts=[]; this.searchIdx=0; this.searchT=0;
    this.dwellT= 0.4 + (id%3)*0.5; this.lookT=0; this.lookAim=this.facing;
    this.radioT=0; this.blindT=0; this.stuckT=0; this.lastX=this.x; this.lastY=this.y;
    this.seeing=false; this.seeStrength=0; this.chaseTgt=null; this.chaseKind='player';
    this.fovBase = 1.44*d.fov; this.rangeBase = 8.6*d.view*TILE;
    this.speedPatrol = 58*d.gspeed; this.speedInv = 96*d.gspeed; this.speedChase = 142*d.gspeed;
    this.headSway = sim.rng.f(0,TAU); this.lookBase=this.facing;
    this.rays=null; this.debugPath=null;
  }
  get fov(){ return this.state===GS.CHASE ? this.fovBase*1.18 : (this.state===GS.SEARCH||this.state===GS.INVESTIGATE ? this.fovBase*1.1 : this.fovBase); }
  get range(){ return this.state===GS.CHASE ? this.rangeBase*1.12 : (this.state===GS.SEARCH ? this.rangeBase*1.05 : this.rangeBase); }
  get speed(){
    switch(this.state){
      case GS.CHASE: return this.speedChase;
      case GS.INVESTIGATE: return this.speedInv;
      case GS.SEARCH: return this.speedInv*0.82;
      case GS.RETURN: return this.speedInv*0.72;
      case GS.SUSPECT: return this.speedPatrol*0.55;
      default: return this.speedPatrol;
    }
  }
  setState(s, sim){
    if(this.state===s) return;
    this.prevState=this.state; this.state=s; this.stateT=0;
    this.path=null; this.goalKey=''; this.lookBase=this.facing; this.lookT=0;
    sim.events.push({type:'guardState', id:this.id, state:s, x:this.x, y:this.y});
  }

  /* ---- perception ------------------------------------------------------- */
  perceive(sim, dt){
    const m=sim.m, p=sim.player;
    this.seeing=false; this.seeStrength=0;
    if(this.blindT>0){ this.blindT-=dt; this.aware=Math.max(0,this.aware-0.6*dt); return; }

    // decoys read as a person and outrank the real player
    let best=null, bestKind='player';
    const check=(tx,ty,kind,obj)=>{
      const dd=dist(this.x,this.y,tx,ty);
      if(dd>this.range) return;
      const a=Math.atan2(ty-this.y, tx-this.x);
      const off=Math.abs(angDiff(this.facing,a));
      const inCone = off <= this.fov*0.5;
      const inClose = dd < 52;                          // felt at arm's length
      if(!inCone && !inClose) return;
      if(!losClear(m, this.x,this.y, tx,ty, SIGHT.ALL, sim.smokes)) return;
      const distF = clamp(1-dd/this.range, 0, 1);
      const angF = inCone ? (0.45 + 0.55*(1 - off/(this.fov*0.5))) : 0.55;
      let lightF, moveF;
      if(kind==='player'){
        lightF = 0.30 + 1.00*sim.lightAt(p.x,p.y);
        moveF = p.mode==='sneak' ? 0.5 : (p.mode==='run' ? 1.55 : 1.0);
        if(p.moving===false) moveF *= 0.80;
      } else { lightF=0.85; moveF=1.15; }
      const s = Math.pow(distF,0.8)*angF*lightF*moveF;
      if(!best || s>best.s) best={s, x:tx, y:ty, dd, kind, obj};
    };
    for(let k=0;k<sim.decoys.length;k++){ const dc=sim.decoys[k]; if(dc.life>0) check(dc.x,dc.y,'decoy',dc); }
    if(!p.caught) check(p.x,p.y,'player',p);

    const d=sim.diff;
    if(best){
      this.seeing=true; this.seeStrength=best.s; this.chaseKind=best.kind;
      this.chaseTgt={x:best.x,y:best.y,kind:best.kind,obj:best.obj};
      const rate = 2.2*best.s*d.detect*(sim.alarm.level>=2?1.35:1);
      this.aware = clamp(this.aware + rate*dt, 0, 1.35);
      this.lkp = {x:best.x, y:best.y, t:sim.t}; this.lkpAge=0;
    } else {
      const decay = (this.state===GS.CHASE) ? 0.22 : (this.state===GS.SEARCH||this.state===GS.INVESTIGATE ? 0.30 : 0.55);
      this.aware = clamp(this.aware - decay*dt, 0, 1.35);
      if(this.lkp) this.lkpAge += dt;
    }
  }

  /* ---- hearing ---------------------------------------------------------- */
  hear(sim, ev, loud){
    if(this.blindT>0) return;
    const d=sim.diff;
    const l = clamp(loud*d.hearing, 0, 1);
    if(l < 0.10) return;
    if(this.state===GS.CHASE && this.seeing) return;
    const jitter = (1-l)*3.2*TILE;
    const px = ev.x + sim.rng.f(-jitter,jitter), py = ev.y + sim.rng.f(-jitter,jitter);
    const strong = l > 0.42 || ev.priority;
    this.aware = clamp(this.aware + (strong?0.30:0.14), 0, 0.92);
    sim.events.push({type:'heard', id:this.id, x:px, y:py, loud:l});
    this.heardAt = {x:px,y:py,t:sim.t,loud:l};
    if(this.state===GS.PATROL || this.state===GS.OBSERVE || this.state===GS.RETURN || this.state===GS.SUSPECT){
      if(strong){ this.poi={x:px,y:py}; this.setState(GS.INVESTIGATE, sim); }
      else { this.lookAim = Math.atan2(py-this.y, px-this.x); this.setState(GS.SUSPECT, sim); this.poi={x:px,y:py}; }
    } else if(this.state===GS.SEARCH && strong){
      this.poi={x:px,y:py}; this.searchPts=[]; this.setState(GS.INVESTIGATE, sim);
    } else if(this.state===GS.INVESTIGATE && strong){
      this.poi={x:px,y:py}; this.path=null; this.goalKey='';
    }
  }
  radioAlert(sim, x, y, force){
    this.lkp={x,y,t:sim.t}; this.lkpAge=0;
    if(this.state===GS.CHASE) return;
    if(force || this.state!==GS.INVESTIGATE){
      this.poi={x,y};
      this.setState(GS.INVESTIGATE, sim);
      this.aware=Math.max(this.aware, 0.42);
    }
  }

  /* ---- movement --------------------------------------------------------- */
  moveTo(sim, tx, ty, dt, speed){
    const m=sim.m;
    const key = ((tx/TILE)|0)+','+((ty/TILE)|0);
    this.repathT -= dt;
    if(this.goalKey!==key || !this.path || this.repathT<=0){
      PF.bind(m);
      const raw = PF.find(this.x,this.y,tx,ty);
      this.path = raw ? PF.smooth(raw) : null;
      this.debugPath = this.path;
      this.pathIdx = this.path && this.path.length>1 ? 1 : 0;
      this.goalKey = key; this.repathT = 0.55 + (this.id%5)*0.06;
    }
    let tgt=null;
    if(this.path && this.pathIdx < this.path.length){
      tgt = this.path[this.pathIdx];
      if(d2(this.x,this.y,tgt.x,tgt.y) < 15*15){ this.pathIdx++; tgt = this.path[Math.min(this.pathIdx,this.path.length-1)]; }
    }
    if(!tgt) tgt={x:tx,y:ty};
    const ang = Math.atan2(tgt.y-this.y, tgt.x-this.x);
    const acc = speed*7.5;
    this.vx += Math.cos(ang)*acc*dt; this.vy += Math.sin(ang)*acc*dt;
    const sp = Math.hypot(this.vx,this.vy);
    if(sp>speed){ this.vx=this.vx/sp*speed; this.vy=this.vy/sp*speed; }
    // face travel direction (head sway while calm)
    const turn = (this.state===GS.CHASE?8.5:4.2)*dt;
    this.facing = angToward(this.facing, ang, turn);
    return dist(this.x,this.y,tx,ty);
  }
  arrive(dt){ this.vx*=Math.pow(0.0016,dt); this.vy*=Math.pow(0.0016,dt); }

  /* ---- per-tick state machine ------------------------------------------- */
  update(sim, dt){
    const m=sim.m, p=sim.player, d=sim.diff;
    this.stateT+=dt; this.radioT-=dt;
    this.perceive(sim, dt);

    // hard promotion to chase — requires ACTUAL contact, not just a hot meter,
    // otherwise a guard who lost the target re-detects it every tick.
    if(this.aware>=1 && this.seeing && !p.caught){
      if(this.state!==GS.CHASE){
        this.setState(GS.CHASE, sim);
        sim.onGuardDetect(this, this.chaseKind);
      }
    } else if(this.aware>=0.32 && (this.state===GS.PATROL||this.state===GS.OBSERVE||this.state===GS.RETURN)){
      this.setState(GS.SUSPECT, sim);
      if(this.lkp) this.lookAim = Math.atan2(this.lkp.y-this.y, this.lkp.x-this.x);
    }

    switch(this.state){
      case GS.PATROL: {
        if(!this.route.length){ this.setState(GS.OBSERVE,sim); break; }
        const w = this.route[this.wp];
        const dd = this.moveTo(sim, w.x, w.y, dt, this.speed);
        if(dd < 20){ this.dwellT = w.dwell; this.setState(GS.OBSERVE, sim); }
        break; }
      case GS.OBSERVE: {
        this.arrive(dt);
        this.dwellT -= dt;
        // slow head sweep, anchored to the heading we arrived with
        this.headSway += dt*0.95;
        this.facing = angToward(this.facing, this.lookBase + Math.sin(this.headSway)*0.34, 1.6*dt);
        if(!this.route.length){ this.dwellT=1; break; }
        if(this.dwellT<=0){
          this.wp = (this.wp + this.dirStep);
          if(this.wp>=this.route.length){ this.wp=Math.max(0,this.route.length-2); this.dirStep=-1; }
          if(this.wp<0){ this.wp=Math.min(1,this.route.length-1); this.dirStep=1; }
          this.setState(GS.PATROL, sim);
        }
        break; }
      case GS.SUSPECT: {
        this.arrive(dt);
        const aim = this.lkp ? Math.atan2(this.lkp.y-this.y,this.lkp.x-this.x)
                             : (this.poi? Math.atan2(this.poi.y-this.y,this.poi.x-this.x) : this.lookAim);
        this.facing = angToward(this.facing, aim, 3.4*dt);
        // edge closer to the disturbance
        if(this.stateT>0.55 && this.poi){
          const dd=dist(this.x,this.y,this.poi.x,this.poi.y);
          if(dd>50) this.moveTo(sim, this.poi.x, this.poi.y, dt, this.speed);
        }
        if(this.aware<0.12){ this.setState(GS.RETURN, sim); }
        else if(this.stateT>2.6 && this.poi){ this.setState(GS.INVESTIGATE, sim); }
        break; }
      case GS.INVESTIGATE: {
        const t = this.poi || this.lkp;
        if(!t){ this.setState(GS.RETURN, sim); break; }
        const dd = this.moveTo(sim, t.x, t.y, dt, this.speed);
        if(dd<26 || this.stateT> 16){
          this.arrive(dt);
          this.searchPts = sim.makeSearchPoints(t.x, t.y, 3, 4.5);
          this.searchIdx=0; this.searchT = (7 + sim.rng.f(0,4))*d.searchTime;
          this.setState(GS.SEARCH, sim);
        }
        break; }
      case GS.CHASE: {
        const tgt = this.chaseTgt;
        if(this.seeing && tgt){
          this.lkp={x:tgt.x,y:tgt.y,t:sim.t}; this.lkpAge=0;
          this.moveTo(sim, tgt.x, tgt.y, dt, this.speed);
          if(this.radioT<=0){ sim.radio(this, tgt.x, tgt.y); this.radioT=2.4/d.respond; }
          if(tgt.kind==='decoy' && dist(this.x,this.y,tgt.x,tgt.y)<26){ sim.popDecoy(tgt.obj, this); }
        } else {
          if(this.lkp) this.moveTo(sim, this.lkp.x, this.lkp.y, dt, this.speed);
          if(this.lkpAge > 1.15 || !this.lkp){
            const t=this.lkp||{x:this.x,y:this.y};
            this.searchPts = sim.makeSearchPoints(t.x,t.y, 4, 6);
            this.searchIdx=0; this.searchT=(9+sim.rng.f(0,5))*d.searchTime;
            this.aware = Math.min(this.aware, 0.85);
            this.setState(GS.SEARCH, sim);
          }
        }
        break; }
      case GS.SEARCH: {
        this.searchT -= dt;
        if(this.searchT<=0){ this.setState(GS.RETURN, sim); break; }
        const pt = this.searchPts[this.searchIdx];
        if(!pt){ this.setState(GS.RETURN, sim); break; }
        const dd = this.moveTo(sim, pt.x, pt.y, dt, this.speed);
        if(dd<24){
          this.arrive(dt);
          if(!this.lookT) this.lookBase=this.facing;
          this.lookT = (this.lookT||0) + dt;
          this.facing = angToward(this.facing, this.lookBase + Math.sin(this.lookT*3.1+this.id)*1.5, 3.2*dt);
          if(this.lookT>1.1){ this.lookT=0; this.searchIdx++;
            if(this.searchIdx>=this.searchPts.length){
              this.searchPts = sim.makeSearchPoints(this.x,this.y, 3, 5); this.searchIdx=0; } }
        }
        break; }
      case GS.RETURN: {
        if(!this.route.length){ this.setState(GS.OBSERVE,sim); break; }
        // head for the nearest waypoint
        let bi=0,bd=Infinity;
        for(let k=0;k<this.route.length;k++){ const q=d2(this.x,this.y,this.route[k].x,this.route[k].y); if(q<bd){bd=q;bi=k;} }
        this.wp=bi;
        const w=this.route[bi];
        const dd=this.moveTo(sim, w.x, w.y, dt, this.speed);
        if(dd<24 || this.stateT>22){ this.dwellT=0.8; this.setState(GS.OBSERVE, sim); }
        break; }
    }

    // integrate + collide
    const fr = Math.pow(0.0009, dt);
    this.vx*=fr; this.vy*=fr;
    this.x += this.vx*dt; sim.collide(this, true);
    this.y += this.vy*dt; sim.collide(this, false);
    // guards push doors open ahead of them
    sim.autoDoors(this, 30, true);

    // unstick
    if(d2(this.x,this.y,this.lastX,this.lastY) < 0.4 && (this.state!==GS.OBSERVE&&this.state!==GS.SUSPECT)){
      this.stuckT += dt;
      if(this.stuckT>0.9){ this.path=null; this.goalKey=''; this.repathT=0; this.stuckT=0;
        this.vx += sim.rng.f(-40,40); this.vy += sim.rng.f(-40,40); }
    } else this.stuckT=0;
    this.lastX=this.x; this.lastY=this.y;
  }
}

/* ============================================================================
   5. SIMULATION
   Deterministic fixed-step world: player, doors, security, gadgets, alarm.
   ========================================================================= */
function snapshotMission(m){
  m._init = {
    doors: m.doors.map(d=>({locked:d.locked})),
    lamps: m.lamps.map(l=>({on:l.on})),
  };
}
function resetMission(m){
  m.doors.forEach((d,k)=>{ d.locked=m._init.doors[k].locked; d.open=0; d.target=0; d.autoT=0; d.jam=0; d.picked=false; });
  m.lamps.forEach((l,k)=>{ l.on=m._init.lamps[k].on; l.offT=0; });
  m.cameras.forEach(c=>{ c.enabled=true; c.disabledT=0; c.seeT=0; c.alertT=0; c.spotted=false; });
  m.terminals.forEach(t=>{ t.used=false; t.progress=0; });
  m.loot.forEach(l=>{ l.taken=false; });
  m.objective.taken=false; m.objective.progress=0;
  bakeLight(m);
}

class Sim{
  constructor(mission, diffId, seedSalt){
    this.m = mission; this.diff = diffById(diffId);
    this.rng = new Rng(hashStr(mission.seed+'|sim|'+diffId+'|'+(seedSalt||'')));
    PF.bind(mission); SoundField.bind(mission);
    resetMission(mission);
    this.t=0; this.tick=0; this.status='playing'; this.endReason='';
    this.events=[]; this.soundEvents=[]; this.smokes=[]; this.decoys=[]; this.throwables=[];
    this.noiseNow=0; this.exfilSealT=0;
    this.alarm={ level:0, timer:0, suppress:0, lastLevel:0 };
    this.stats={ detections:0, alarms:0, loot:0, lootCount:0, terminals:0, doors:0,
                 gadgetsUsed:0, distance:0, closest:9999, timeToObj:0 };
    const gm = this.diff.gadgetMul;
    this.player = {
      x:mission.entry.x, y:mission.entry.y, vx:0, vy:0, r:9, facing:0,
      mode:'walk', moving:false, caught:false, captureT:0, stepT:0, lastStepT:0,
      slot:0, lightLevel:0, hideT:0, interactT:0, pickT:0,
      gadgets: GADGET_DEFS.map(g=>({ id:g.id, charges: Math.max(1,Math.round(g.charges*gm)), cd:0 })),
    };
    this.guards = mission.guardSpawns.map((s,i)=> new Guard(this, i, s, mission.routes[s.route]));
    this.prevUse=false; this.prevGadget=false;
    this.interact=null;
    this.visitedRooms = new Set();
    this.objRoomSeen=false;
  }

  /* ---- helpers ---------------------------------------------------------- */
  lightAt(x,y){ const i=tileIdxAt(this.m,x,y); return i<0?0:this.m.grid.light[i]; }
  collide(e){
    const m=this.m, r=e.r;
    const t0x=Math.floor((e.x-r)/TILE), t1x=Math.floor((e.x+r)/TILE);
    const t0y=Math.floor((e.y-r)/TILE), t1y=Math.floor((e.y+r)/TILE);
    for(let ty=t0y;ty<=t1y;ty++) for(let tx=t0x;tx<=t1x;tx++){
      let blocked;
      if(tx<0||ty<0||tx>=m.gw||ty>=m.gh) blocked=true;
      else blocked = blocksMoveTile(m, ty*m.gw+tx);
      if(!blocked) continue;
      const rx=tx*TILE, ry=ty*TILE;
      const cx=clamp(e.x, rx, rx+TILE), cy=clamp(e.y, ry, ry+TILE);
      let dx=e.x-cx, dy=e.y-cy; let dd=Math.hypot(dx,dy);
      if(dd>=r) continue;
      if(dd<0.0001){ // centre inside the tile: eject on the shallowest axis
        const ox=(e.x-(rx+TILE/2)), oy=(e.y-(ry+TILE/2));
        if(Math.abs(ox)>Math.abs(oy)){ dx=Math.sign(ox)||1; dy=0; } else { dx=0; dy=Math.sign(oy)||1; }
        dd=1;
      }
      const nx=dx/dd, ny=dy/dd, push=r-dd;
      e.x += nx*push; e.y += ny*push;
      const vn = e.vx*nx + e.vy*ny;
      if(vn<0){ e.vx -= nx*vn; e.vy -= ny*vn; }
      if(e===this.player && Math.hypot(this.player.vx,this.player.vy)>150 && this.player.mode==='run'){
        if(this.t - (this.player.lastBumpT||-9) > 0.8){
          this.player.lastBumpT=this.t;
          this.emitSound(e.x,e.y, NOISE.prop*0.7, 'bump', null, false);
        }
      }
    }
  }
  /* doors near an actor open by themselves (guards, and the player when running through) */
  autoDoors(actor, radius, badge){
    const m=this.m, g=m.grid;
    const tx=(actor.x/TILE)|0, ty=(actor.y/TILE)|0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const x=tx+dx, y=ty+dy; if(!g.inB(x,y)) continue;
      const di=g.doorAt[g.i(x,y)]; if(di<0) continue;
      const d=m.doors[di];
      if(dist(actor.x,actor.y,d.x,d.y)>radius) continue;
      if(d.locked && !badge) continue;
      if(d.target<1){ this.openDoor(d, actor, false); }
      d.autoT = Math.max(d.autoT, 1.4);
    }
  }
  openDoor(d, src, loud){
    d.target=1; d.autoT=Math.max(d.autoT, 5.0);
    this.stats.doors++;
    this.emitSound(d.x,d.y, loud?NOISE.doorForce:NOISE.door, 'door', src, false);
    this.events.push({type:'door', x:d.x, y:d.y, open:true});
  }
  emitSound(x,y,budget,type,src,priority){
    if(budget<=0) return;
    const ev={ x,y,budget,type,t:this.t,life:0.85,src, priority:!!priority };
    this.soundEvents.push(ev);
    if(this.soundEvents.length>48) this.soundEvents.shift();
    this.noiseNow = Math.max(this.noiseNow, clamp(budget/NOISE.run,0,1.35));
    SoundField.flood((x/TILE)|0, (y/TILE)|0, budget);
    for(let i=0;i<this.guards.length;i++){
      const g=this.guards[i];
      if(src===g) continue;
      const loud = SoundField.at(g.x,g.y);
      if(loud>0) g.hear(this, ev, loud);
    }
  }
  makeSearchPoints(x,y,n,radiusTiles){
    const m=this.m, out=[];
    const tx=(x/TILE)|0, ty=(y/TILE)|0;
    for(let a=0;a<n*14 && out.length<n;a++){
      const r=this.rng.f(1.2,radiusTiles), th=this.rng.f(0,TAU);
      const nx=Math.round(tx+Math.cos(th)*r), ny=Math.round(ty+Math.sin(th)*r);
      if(!m.grid.inB(nx,ny)) continue;
      const i=m.grid.i(nx,ny);
      if(blocksMoveTile(m,i)) continue;
      out.push({ x:(nx+0.5)*TILE, y:(ny+0.5)*TILE });
    }
    if(!out.length) out.push({x,y});
    return out;
  }
  radio(from, x, y){
    const d=this.diff;
    const radius=(10+13*d.respond)*TILE;
    this.events.push({type:'radio', x:from.x, y:from.y});
    for(const g of this.guards){
      if(g===from) continue;
      if(this.alarm.level>=3 || dist(g.x,g.y,from.x,from.y) < radius) g.radioAlert(this, x, y, this.alarm.level>=2);
    }
  }
  onGuardDetect(guard, kind){
    if(kind!=='player') return;
    this.stats.detections++;
    this.raiseAlarm(2, guard.x, guard.y);
    this.emitSound(guard.x, guard.y, NOISE.shout, 'shout', guard, true);
    this.events.push({type:'spotted', id:guard.id, x:guard.x, y:guard.y});
    this.radio(guard, this.player.x, this.player.y);
  }
  raiseAlarm(level, x, y){
    if(this.alarm.suppress>0 && level>=3) level=2;
    if(level>this.alarm.level){
      this.alarm.level=level; this.alarm.timer=0;
      this.events.push({type:'alarm', level, x, y});
      if(level>=3){
        this.stats.alarms++;
        this.exfilSealT = 16;
        for(const d of this.m.doors) if(d.wasLocked && !d.picked && !d.relieved) d.locked=true;
        for(const g of this.guards) g.radioAlert(this, this.player.x, this.player.y, true);
      }
    } else { this.alarm.timer=0; }
  }
  popDecoy(dc, guard){
    dc.life=0;
    this.events.push({type:'decoyPop', x:dc.x, y:dc.y});
    if(guard){ guard.aware=Math.min(guard.aware,0.5); guard.chaseTgt=null;
      guard.searchPts=this.makeSearchPoints(dc.x,dc.y,3,4); guard.searchIdx=0;
      guard.searchT=5*this.diff.searchTime; guard.setState(GS.SEARCH,this); }
  }

  /* ---- gadgets ---------------------------------------------------------- */
  useGadget(){
    const p=this.player, slot=p.slot, def=GADGET_DEFS[slot], st=p.gadgets[slot];
    if(!def||!st) return;
    if(def.id==='lockpick'){ // handled through the hold-interaction
      if(this.interact && this.interact.kind==='lockedDoor') this.events.push({type:'hint',text:'Hold ['+keyLabel(BINDS.use)+'] to shim the lock'});
      else this.events.push({type:'hint',text:'No lock in reach'});
      return;
    }
    if(st.charges<=0){ this.events.push({type:'hint',text:def.name+' depleted'}); return; }
    if(st.cd>0){ this.events.push({type:'hint',text:def.name+' cycling'}); return; }
    st.charges--; st.cd=def.cooldown; this.stats.gadgetsUsed++;
    if(def.throwable){
      const sp=340;
      this.throwables.push({ kind:def.id, x:p.x, y:p.y, vx:Math.cos(p.facing)*sp, vy:Math.sin(p.facing)*sp,
        t:0, life:0.9, r:5, spin:this.rng.f(0,TAU) });
      this.emitSound(p.x,p.y, NOISE.sneak, 'throw', null, false);
      this.events.push({type:'throw', kind:def.id, x:p.x, y:p.y});
    } else if(def.id==='smoke'){
      this.smokes.push({ x:p.x, y:p.y, r:6, rMax:86, life:11, maxLife:11, t:0 });
      this.emitSound(p.x,p.y, NOISE.smoke, 'smoke', null, false);
      this.events.push({type:'smoke', x:p.x, y:p.y});
    }
  }
  landThrowable(o){
    const m=this.m;
    if(o.kind==='noisemaker'){
      this.emitSound(o.x,o.y, NOISE.throwLand, 'noisemaker', null, true);
      this.events.push({type:'bang', x:o.x, y:o.y});
    } else if(o.kind==='emp'){
      const R=5.6*TILE; let changed=false;
      for(const c of m.cameras) if(dist(c.x,c.y,o.x,o.y)<R*1.25){ c.enabled=false; c.disabledT=20; c.seeT=0; }
      for(const l of m.lamps) if(dist(l.x,l.y,o.x,o.y)<R*1.3 && l.on){ l.on=false; l.offT=20; changed=true; }
      for(const d of m.doors) if(dist(d.x,d.y,o.x,o.y)<R && d.locked){ d.locked=false; d.picked=true; }
      for(const g of this.guards) if(dist(g.x,g.y,o.x,o.y)<R*0.55) g.blindT=Math.max(g.blindT,1.1);
      if(changed) bakeLight(m);
      this.emitSound(o.x,o.y, NOISE.emp, 'emp', null, false);
      this.events.push({type:'emp', x:o.x, y:o.y, r:R*1.3});
    } else if(o.kind==='decoy'){
      const ang=Math.atan2(o.vy, o.vx)||this.player.facing;
      this.decoys.push({ x:o.x, y:o.y, vx:Math.cos(ang)*54, vy:Math.sin(ang)*54, life:9, maxLife:9,
        r:9, stepT:0, ang });
      this.events.push({type:'decoySpawn', x:o.x, y:o.y});
    }
  }

  /* ---- interaction resolution ------------------------------------------- */
  findInteract(){
    const p=this.player, m=this.m, g=m.grid;
    let best=null;
    const consider=(kind,ref,x,y,rad,label,hold,extra)=>{
      const dd=dist(p.x,p.y,x,y); if(dd>rad) return;
      const sc=dd - (extra||0);
      if(!best || sc<best.sc) best={kind,ref,x,y,label,hold,sc,dd};
    };
    // objective
    if(!m.objective.taken) consider('objective', m.objective, m.objective.x, m.objective.y, 40,
      'Secure the '+m.objective.name, m.objective.holdTime, 26);
    // extraction
    if(m.objective.taken) consider('exfil', null, m.exfil.x, m.exfil.y, 46,
      this.exfilSealT>0 ? 'Extraction sealed — '+Math.ceil(this.exfilSealT)+'s' : 'Extract', 1.0, 30);
    // terminals
    for(const t of m.terminals){ if(t.used) continue;
      consider('terminal', t, t.x, t.y, 40, 'Hack '+TERM_LABEL[t.action], t.holdTime, 18); }
    // doors in the 3x3 neighbourhood
    const tx=(p.x/TILE)|0, ty=(p.y/TILE)|0;
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
      const x=tx+dx,y=ty+dy; if(!g.inB(x,y)) continue;
      const di=g.doorAt[g.i(x,y)]; if(di<0) continue;
      const d=m.doors[di];
      if(d.locked){
        const shim=p.gadgets[3];
        consider('lockedDoor', d, d.x,d.y, 44, shim.charges>0? 'Shim the badge lock ('+shim.charges+' left)' : 'Badge lock — no shim left', 2.6, 16);
      } else {
        // a door still shut is far more useful to offer than one already standing open
        consider('door', d, d.x,d.y, 44, d.target>0.5?'Close door':'Open door', 0, d.target>0.5?0:14);
      }
    }
    return best;
  }

  /* ---- main fixed step -------------------------------------------------- */
  step(dt, input){
    if(this.status!=='playing'){ this.t+=dt; this.tick++; return; }
    const m=this.m, p=this.player, d=this.diff;
    this.t+=dt; this.tick++;
    this.noiseNow = Math.max(0, this.noiseNow - dt*1.5);
    if(this.alarm.suppress>0) this.alarm.suppress-=dt;
    if(this.exfilSealT>0) this.exfilSealT-=dt;

    /* -- player movement -- */
    p.mode = input.run ? 'run' : (input.sneak ? 'sneak' : 'walk');
    const spd = p.mode==='run' ? 196 : (p.mode==='sneak' ? 62 : 118);
    let mx=input.mx, my=input.my;
    const ml=Math.hypot(mx,my); if(ml>1){ mx/=ml; my/=ml; }
    const wantX=mx*spd, wantY=my*spd;
    const acc = (ml>0.01? 12 : 16);
    p.vx += (wantX-p.vx)*Math.min(1,acc*dt);
    p.vy += (wantY-p.vy)*Math.min(1,acc*dt);
    if(Math.abs(p.vx)<1.2) p.vx=0; if(Math.abs(p.vy)<1.2) p.vy=0;
    const oldx=p.x, oldy=p.y;
    p.x += p.vx*dt; this.collide(p);
    p.y += p.vy*dt; this.collide(p);
    this.stats.distance += dist(oldx,oldy,p.x,p.y);
    p.moving = (ml>0.05) && (d2(oldx,oldy,p.x,p.y) > 0.02);
    p.facing = input.aim;
    /* leaning into a shut, unlocked door shoulders it open (E does it instantly) */
    {
      const gr=m.grid, ptx=(p.x/TILE)|0, pty=(p.y/TILE)|0; let pushing=null;
      for(let dy=-1;dy<=1 && !pushing;dy++) for(let dx=-1;dx<=1;dx++){
        const x=ptx+dx, y=pty+dy; if(!gr.inB(x,y)) continue;
        const di=gr.doorAt[gr.i(x,y)]; if(di<0) continue;
        const dr=m.doors[di]; if(dr.locked || dr.open>0.5) continue;
        const ddx=dr.x-p.x, ddy=dr.y-p.y, dd=Math.hypot(ddx,ddy)||1;
        if(dd>42) continue;
        if(ml>0.05 && (mx*ddx+my*ddy)/dd > 0.25){ pushing=dr; break; }
      }
      if(pushing){ p.pushT=(p.pushT||0)+dt; if(p.pushT>0.30){ p.pushT=0; this.openDoor(pushing,p,false); } }
      else p.pushT=0;
    }
    p.lightLevel = this.lightAt(p.x,p.y);

    /* -- footstep noise -- */
    if(p.moving){
      p.stepT -= dt;
      if(p.stepT<=0){
        const iv = p.mode==='run'?0.27 : p.mode==='sneak'?0.62 : 0.41;
        p.stepT = iv;
        const budget = p.mode==='run'?NOISE.run : p.mode==='sneak'?NOISE.sneak : NOISE.walk;
        this.emitSound(p.x,p.y,budget,'step',null,false);
        this.events.push({type:'step', x:p.x, y:p.y, mode:p.mode});
      }
    } else p.stepT = 0;

    /* -- gadget cooldowns -- */
    for(const gsl of p.gadgets) if(gsl.cd>0) gsl.cd=Math.max(0,gsl.cd-dt);
    if(input.slot>=0 && input.slot<p.gadgets.length && input.slot!==p.slot){
      p.slot=input.slot; this.events.push({type:'slot', slot:p.slot});
    }
    if(input.gadget && !this.prevGadget) this.useGadget();
    this.prevGadget = input.gadget;

    /* -- interaction -- */
    const it = this.findInteract();
    const sameTarget = it && this.interact && it.kind===this.interact.kind && it.ref===this.interact.ref;
    if(!sameTarget) p.interactT=0;
    this.interact = it;
    if(it){
      if(it.hold>0){
        if(input.use){
          let allowed=true;
          if(it.kind==='lockedDoor' && p.gadgets[3].charges<=0) allowed=false;
          if(it.kind==='exfil' && this.exfilSealT>0) allowed=false;
          if(allowed){
            p.interactT += dt;
            if(it.kind==='terminal') it.ref.progress = clamp(p.interactT/it.hold,0,1);
            if(it.kind==='objective') it.ref.progress = clamp(p.interactT/it.hold,0,1);
            if(p.interactT>=it.hold){ this.completeInteract(it); p.interactT=0; }
            if((p.interactT*3|0) !== ((p.interactT-dt)*3|0))
              this.emitSound(p.x,p.y, it.kind==='lockedDoor'?NOISE.terminal*0.8:NOISE.terminal, 'work', null, false);
          }
        } else {
          p.interactT=Math.max(0,p.interactT-dt*2.2);
          if(it.kind==='terminal') it.ref.progress = clamp(p.interactT/it.hold,0,1);
          if(it.kind==='objective') it.ref.progress = clamp(p.interactT/it.hold,0,1);
        }
      } else if(input.use && !this.prevUse){
        this.completeInteract(it);
      }
    }
    this.prevUse = input.use;

    /* -- loot pickup (contact) -- */
    for(const L of m.loot){ if(L.taken) continue;
      if(d2(p.x,p.y,L.x,L.y) < 20*20){ L.taken=true; this.stats.loot += L.value; this.stats.lootCount++;
        this.emitSound(p.x,p.y,NOISE.pickup,'pickup',null,false);
        this.events.push({type:'loot', x:L.x, y:L.y, name:L.name, value:L.value}); } }

    /* -- doors -- */
    for(const dr of m.doors){
      if(dr.autoT>0){ dr.autoT-=dt; if(dr.autoT<=0 && dr.target>0){
        // keep open while someone stands in the doorway
        let occupied = d2(p.x,p.y,dr.x,dr.y) < 26*26;
        if(!occupied) for(const g of this.guards) if(d2(g.x,g.y,dr.x,dr.y)<28*28){occupied=true;break;}
        if(occupied) dr.autoT=0.7; else { dr.target=0; this.events.push({type:'door',x:dr.x,y:dr.y,open:false}); }
      } }
      const rate = 3.1*dt;
      if(dr.open<dr.target) dr.open=Math.min(dr.target,dr.open+rate);
      else if(dr.open>dr.target) dr.open=Math.max(dr.target,dr.open-rate);
    }
    /* -- lamps timed restore -- */
    let relight=false;
    for(const l of m.lamps) if(!l.on && l.offT>0){ l.offT-=dt; if(l.offT<=0){ l.on=true; relight=true; } }
    if(relight) bakeLight(m);

    /* -- throwables -- */
    for(let i=this.throwables.length-1;i>=0;i--){
      const o=this.throwables[i]; o.t+=dt;
      const nx=o.x+o.vx*dt, ny=o.y+o.vy*dt;
      const ti=tileIdxAt(m,nx,ny);
      let hit = ti<0 || blocksMoveTile(m,ti);
      if(hit){ o.vx*=-0.32; o.vy*=-0.32; o.life=Math.min(o.life,0.14); }
      else { o.x=nx; o.y=ny; }
      o.vx*=Math.pow(0.11,dt); o.vy*=Math.pow(0.11,dt);
      o.life-=dt;
      if(o.life<=0){ this.landThrowable(o); this.throwables.splice(i,1); }
    }
    /* -- smoke -- */
    for(let i=this.smokes.length-1;i>=0;i--){ const s=this.smokes[i]; s.t+=dt; s.life-=dt;
      s.r = s.rMax * clamp(s.t/0.8,0,1) * (s.life<1.6? Math.max(0.15,s.life/1.6):1);
      if(s.life<=0) this.smokes.splice(i,1); }
    /* -- decoys -- */
    for(let i=this.decoys.length-1;i>=0;i--){
      const dc=this.decoys[i]; dc.life-=dt;
      const nx=dc.x+dc.vx*dt, ny=dc.y+dc.vy*dt;
      const ti=tileIdxAt(m,nx,ny);
      if(ti<0||blocksMoveTile(m,ti)){ dc.ang += this.rng.f(1.6,2.4); dc.vx=Math.cos(dc.ang)*54; dc.vy=Math.sin(dc.ang)*54; }
      else { dc.x=nx; dc.y=ny; }
      dc.stepT-=dt;
      if(dc.stepT<=0){ dc.stepT=0.42; this.emitSound(dc.x,dc.y,NOISE.walk*0.85,'decoyStep',null,false); }
      if(dc.life<=0){ this.events.push({type:'decoyPop',x:dc.x,y:dc.y}); this.decoys.splice(i,1); }
    }

    /* -- cameras -- */
    for(const c of m.cameras){
      if(!c.enabled){ c.disabledT-=dt; if(c.disabledT<=0){ c.enabled=true; } c.seeT=0; continue; }
      c.ang = c.base + Math.sin(this.t*c.speed + c.phase)*c.sweep;
      if(c.alertT>0) c.alertT-=dt;
      let sees=false;
      if(!p.caught){
        const dd=dist(c.x,c.y,p.x,p.y);
        if(dd<c.range){
          const a=Math.atan2(p.y-c.y,p.x-c.x);
          if(Math.abs(angDiff(c.ang,a)) < c.fov*0.5){
            if(losClear(m,c.x,c.y,p.x,p.y,SIGHT.ALL,this.smokes)) sees=true;
          }
        }
      }
      c.spotted=sees;
      if(sees){
        c.seeT += dt*(0.55+0.85*p.lightLevel)*d.respond;
        if(c.seeT > 0.9 && c.alertT<=0){
          c.alertT=7; c.seeT=0;
          this.stats.detections++;
          this.raiseAlarm(2, c.x, c.y);
          for(const g of this.guards) g.radioAlert(this, p.x, p.y, true);
          this.events.push({type:'camSpot', x:c.x, y:c.y});
        }
      } else c.seeT = Math.max(0, c.seeT - dt*0.75);
    }

    /* -- guards -- */
    for(const g of this.guards) g.update(this, dt);

    /* -- capture -- */
    let caughtNow=false, closest=9999;
    for(const g of this.guards){
      const dd=dist(g.x,g.y,p.x,p.y);
      if(dd<closest) closest=dd;
      if(g.state===GS.CHASE && g.chaseKind==='player' && dd<26) caughtNow=true;
    }
    this.stats.closest=Math.min(this.stats.closest, closest);
    if(caughtNow){ p.captureT+=dt; if(p.captureT>0.42){ this.fail('captured'); } }
    else p.captureT=Math.max(0,p.captureT-dt*1.5);

    /* -- alarm decay -- */
    const anyHot = this.guards.some(g=>g.state===GS.CHASE||g.state===GS.INVESTIGATE||g.state===GS.SEARCH)
                   || m.cameras.some(c=>c.spotted);
    if(!anyHot){
      this.alarm.timer+=dt;
      const need = (this.alarm.level>=3?16 : this.alarm.level===2?12 : 7)/d.alarmDecay;
      if(this.alarm.timer>need && this.alarm.level>0){
        this.alarm.level--; this.alarm.timer=0;
        this.events.push({type:'alarmDown', level:this.alarm.level});
      }
    } else {
      this.alarm.timer=0;
      if(this.alarm.level<1){ this.alarm.level=1; this.events.push({type:'alarm',level:1}); }
    }
    /* -- sound event visuals -- */
    for(let i=this.soundEvents.length-1;i>=0;i--){ this.soundEvents[i].life-=dt;
      if(this.soundEvents[i].life<=0) this.soundEvents.splice(i,1); }
    /* -- objective / room bookkeeping -- */
    const ri=tileIdxAt(m,p.x,p.y); if(ri>=0 && m.grid.room[ri]>=0) this.visitedRooms.add(m.grid.room[ri]);
  }

  completeInteract(it){
    const m=this.m, p=this.player;
    switch(it.kind){
      case 'door': {
        const d=it.ref;
        if(d.target>0.5){ d.target=0; d.autoT=0; this.events.push({type:'door',x:d.x,y:d.y,open:false});
          this.emitSound(d.x,d.y,NOISE.door*0.7,'door',null,false); }
        else this.openDoor(d, p, false);
        break; }
      case 'lockedDoor': {
        const d=it.ref, shim=p.gadgets[3];
        if(shim.charges<=0) break;
        shim.charges--; d.locked=false; d.picked=true; this.stats.gadgetsUsed++;
        this.openDoor(d, p, false);
        this.events.push({type:'picked', x:d.x, y:d.y});
        break; }
      case 'terminal': {
        const t=it.ref; if(t.used) break;
        t.used=true; t.progress=1; this.stats.terminals++;
        this.applyTerminal(t);
        break; }
      case 'objective': {
        m.objective.taken=true; m.objective.progress=1;
        this.stats.timeToObj=this.t;
        this.emitSound(m.objective.x,m.objective.y,NOISE.terminal,'grab',null,false);
        this.events.push({type:'objective', x:m.objective.x, y:m.objective.y, name:m.objective.name});
        break; }
      case 'exfil': {
        if(this.exfilSealT>0) break;
        this.win();
        break; }
    }
  }
  applyTerminal(t){
    const m=this.m; let msg='';
    switch(t.action){
      case 'doors': { let n=0; for(const d of m.doors) if(d.locked && d.zone===t.zone){ d.locked=false; d.picked=true; n++; }
        if(n===0){ for(const d of m.doors) if(d.locked){ d.locked=false; d.picked=true; n++; if(n>=3)break; } }
        msg='Badge locks released ×'+n; break; }
      case 'cameras': { let n=0; for(const c of m.cameras) if(c.zone===t.zone||m.cameras.length<=2){ c.enabled=false; c.disabledT=75; c.seeT=0; n++; }
        if(n===0){ for(const c of m.cameras){ c.enabled=false; c.disabledT=60; n++; } }
        msg='Camera feeds looped ×'+n; break; }
      case 'lights': { let n=0; for(const l of m.lamps) if(l.zone===t.zone && l.on){ l.on=false; l.offT=70; n++; }
        bakeLight(m); msg='Lighting circuit cut ×'+n; break; }
      case 'alarm': { this.alarm.suppress=45;
        if(this.alarm.level>0){ this.alarm.level=Math.max(0,this.alarm.level-1); }
        this.exfilSealT=0; msg='Alarm bus suppressed 45s'; break; }
    }
    this.emitSound(t.x,t.y,NOISE.terminal,'terminal',null,false);
    this.events.push({type:'terminal', x:t.x, y:t.y, action:t.action, msg});
  }
  win(){ if(this.status!=='playing')return; this.status='won'; this.endReason='extracted';
    this.events.push({type:'win'}); }
  fail(reason){ if(this.status!=='playing')return; this.status='lost'; this.endReason=reason;
    this.player.caught=true; this.events.push({type:'lose', reason}); }

  guardStateCounts(){
    const c={patrol:0,observe:0,suspect:0,investigate:0,chase:0,search:0,return:0};
    for(const g of this.guards) c[g.state]=(c[g.state]||0)+1;
    return c;
  }
  score(){
    const s=this.stats, d=this.diff;
    const timeBonus = Math.max(0, Math.round(520 - this.t*2.4));
    let v = 1200 + s.loot + timeBonus - s.detections*140 - s.alarms*300;
    if(s.detections===0) v += 600;
    if(s.lootCount === this.m.loot.length && this.m.loot.length>0) v += 250;
    v = Math.round(Math.max(0,v) * d.scoreMul);
    if(this.status!=='won') v = Math.round(v*0.18);
    return v;
  }
  rank(){
    if(this.status!=='won') return 'F';
    const v=this.score();
    if(v>=2600) return 'S'; if(v>=2000) return 'A'; if(v>=1450) return 'B'; if(v>=950) return 'C'; return 'D';
  }
}
const TERM_LABEL = { doors:'door control', cameras:'camera hub', lights:'lighting grid', alarm:'alarm bus' };
const RANK_LABEL = { S:'PHANTOM', A:'GHOST', B:'PROFESSIONAL', C:'SLOPPY', D:'LUCKY', F:'BURNED' };


module.exports={makeMission,Sim,snapshotMission,resetMission,PRESETS,DIFFS,GADGET_DEFS,GS,PF,SoundField,tileIdxAt,blocksMoveTile,losClear,castRay,reachFrom,TILE,SIM_DT,bfsDist,Rng,hashStr};
