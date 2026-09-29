/* ============================== CORE / SIM ============================== */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let _uid=1; const uid=()=>"c"+(_uid++);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const MASK=w=>w>=32?0xFFFFFFFF:((1<<w)-1);
const maskW=(v,w)=>v&MASK(w);

/* value: {v:int, s:'ok'|'x'|'z'|'osc'} per net (bus-level flag) */
const V=(v,s='ok')=>({v,s});
const VEQ=(a,b)=>a&&b&&a.v===b.v&&a.s===b.s;

const S={
  comps:new Map(), wires:new Map(), probes:[],
  sel:new Set(), clip:null,
  view:{x:60,y:40,z:1.2},
  tool:'select', dragPal:null,
  settings:{clockHz:2, delay:'none', stepLimit:60, defBits:1, grid:10, snap:true,
    wireStyle:'curved', radix:'hex', theme:'dark', anim:true, minimap:true,
    ovOrder:false, ovFanout:false, ovBus:true, ovClock:false, ovLoops:true},
  sim:null, hist:[], histI:-1,
  ttIns:new Set(), ttOuts:new Set(),
};

function newSim(){
  S.sim={t:0,tick:0,half:0,running:false,events:[],dirty:new Set(),
    iters:0,lastIters:0,edges:0,osc:false,conflict:false,
    netVal:new Map(),netPrev:new Map(),pinCache:new Map(),
    evalOrder:[],orderIdx:new Map(),hz:0,_hzC:0,_hzT:0,warn:[]};
}

/* ---------- pins ---------- */
/* def(type).pins(comp) -> [{name,dir,w,ox,oy}]  ox,oy relative to comp.x/y */
function pinsOf(c){const d=CT[c.type];return d.pins?d.pins(c):d._pins;}

function rebuildNets(){
  // union pins over wires
  const parent=new Map();
  const key=(c,p)=>c+"."+p;
  const find=k=>{let r=k;while(parent.get(r)!==r&&parent.has(r))r=parent.get(r);let x=k;while(parent.get(x)!==x&&parent.has(x)){const n=parent.get(x);parent.set(x,r);x=n}return r};
  const union=(a,b)=>{parent.set(find(a),find(b))};
  const allKeys=new Set();
  for(const c of S.comps.values())for(const p of pinsOf(c))allKeys.add(key(c.id,p.name));
  for(const k of allKeys)parent.set(k,k);
  for(const w of S.wires.values()){union(key(w.a.c,w.a.p),key(w.b.c,w.b.p));}
  S.netOf=new Map(); // pinkey -> netKey
  S.netPins=new Map(); // netKey -> [pinkey]
  for(const k of allKeys){const r=find(k);S.netOf.set(k,r);
    if(!S.netPins.has(r))S.netPins.set(r,[]);S.netPins.get(r).push(k);}
  // rebind probes to current net keys (they store comp.pin ref)
  for(const pr of S.probes){pr.net=S.netOf.get(pr.ref);}
}

function pinDir(c,p){for(const q of pinsOf(c))if(q.name===p)return q.dir;return null}
function pinW(c,p){for(const q of pinsOf(c))if(q.name===p)return q.w;return 1}

function netOfPin(c,p){return S.netOf.get(c+"."+p)}
function netVal(nk){return S.sim.netVal.get(nk)||{v:0,s:'z'}}
function pinVal(c,p){return netVal(netOfPin(c,p))}
function setNetVal(nk,val){S.sim.netVal.set(nk,val)}

/* resolve net: gather drivers (out pins), combine */
function resolveNet(nk){
  const pins=S.netPins.get(nk)||[];let drv=[];
  for(const k of pins){const dot=k.lastIndexOf('.');const cid=k.slice(0,dot),pn=k.slice(dot+1);
    const c=S.comps.get(cid);if(!c)continue;
    if(pinDir(c,pn)!=='out')continue;
    drv.push(S.sim.drvVal.get(k)||{v:0,s:'z',w:pinW(c,pn)});}
  if(!drv.length)return{v:0,s:'z'};
  const real=drv.filter(d=>d.s!=='z');
  if(!real.length)return{v:0,s:'z'};
  if(real.length===1){const d=real[0];return{v:d.v,s:d.s==='ok'?'ok':d.s};}
  // multiple real drivers
  const okV=real.filter(d=>d.s==='ok');
  if(okV.length===real.length&&okV.every(d=>d.v===okV[0].v))return{v:okV[0].v,s:'ok'};
  return{v:0,s:'x',conflict:true};
}

/* ---------- eval dispatch ---------- */
/* CT[type].eval(comp, get) -> {pin:val} ; get(name)->pin val obj */
function evalComp(c){
  const d=CT[c.type];
  const ins={};for(const p of pinsOf(c))if(p.dir==='in')ins[p.name]=pinVal(c.id,p.name);
  return d.eval(c,ins);
}

/* ---------- settle ---------- */
function settle(){
  const sim=S.sim;sim.lastIters=0;sim.osc=false;sim.conflict=false;
  const snap=new Map(sim.netVal); // pre-wave values for edge capture
  const edges=[];
  let guard=0;
  while(sim.dirty.size&&guard++<S.settings.stepLimit){
    sim.lastIters++;
    const dcs=[...sim.dirty];sim.dirty.clear();
    const dn=new Set();
    for(const cid of dcs){
      const c=S.comps.get(cid);if(!c)continue;
      if(!sim.orderIdx.has(cid)){sim.orderIdx.set(cid,sim.evalOrder.length);sim.evalOrder.push(cid);}
      const outs=evalComp(c);
      for(const pn in outs){
        const k=cid+"."+pn,nk=S.netOf.get(k);if(nk===undefined)continue;
        const old=sim.drvVal.get(k);
        if(!VEQ(old,outs[pn])){sim.drvVal.set(k,outs[pn]);dn.add(nk);}
      }
    }
    for(const nk of dn){
      const nv=resolveNet(nk);if(nv.conflict)sim.conflict=true;
      const ov=sim.netVal.get(nk);
      if(!VEQ(ov,nv)){
        sim.netVal.set(nk,nv);
        // clock-edge detection: 0/undefined -> ok-1
        const obit=ov&&ov.s==='ok'?ov.v:0, nbit=nv.s==='ok'?nv.v:0;
        if((obit&1)===0&&(nbit&1)===1){
          for(const k of (S.netPins.get(nk)||[])){
            const dot=k.lastIndexOf('.');const c=S.comps.get(k.slice(0,dot));
            if(!c)continue;const pn=k.slice(dot+1);
            if(pinDir(c,pn)==='in'&&CT[c.type].clkPin===pn)edges.push(c);
          }
        }
        for(const k of (S.netPins.get(nk)||[])){
          const dot=k.lastIndexOf('.');const cid=k.slice(0,dot),pn=k.slice(dot+1);
          const c=S.comps.get(cid);if(!c)continue;
          if(pinDir(c,pn)==='in')sim.dirty.add(cid);
        }
      }
    }
    if(S.settings.delay==='unit')probesSample(sim.t+guard*0.01);
  }
  if(sim.dirty.size){
    // non-settling: mark nets of still-dirty comps as osc
    sim.osc=true;
    const oscNets=new Set();
    for(const cid of sim.dirty){const c=S.comps.get(cid);if(!c)continue;
      for(const p of pinsOf(c)){const nk=S.netOf.get(cid+"."+p.name);if(nk)oscNets.add(nk);}}
    for(const nk of oscNets){const v=sim.netVal.get(nk)||{v:0,s:'z'};sim.netVal.set(nk,{v:v.v,s:'osc'});}
    sim.dirty.clear();
  }else{
    // settled: unresolved (x) nets inside combinational feedback are non-settling physically
    const cn=cycleNetSet();let f=false;
    for(const nk of cn){const v=sim.netVal.get(nk);if(v&&v.s==='x'){sim.netVal.set(nk,{v:v.v,s:'osc'});f=true;}}
    if(f)sim.osc=true;
  }
  // apply captured edges (use pre-wave input snapshot semantics: inputs settled before clk moved)
  if(edges.length){
    sim.edges+=edges.length;
    for(const c of edges){const d=CT[c.type];if(d.edge)d.edge(c,snap,sim);}
    // re-settle after state update
    if(sim.dirty.size)settle();
  }
}

function touchComp(c){S.sim.dirty.add(c.id)}
function dirtyAll(){S.sim.dirty.clear();for(const c of S.comps.values())S.sim.dirty.add(c.id)}
function dirtyNetConsumers(nk){for(const k of (S.netPins.get(nk)||[])){const d=k.lastIndexOf('.');const c=S.comps.get(k.slice(0,d));if(c&&pinDir(c,k.slice(d+1))==='in')S.sim.dirty.add(c.id);}}
function drvSet(c,p,v){S.sim.dirty.add(c.id);}

/* ---------- sequential helpers ---------- */
/* nets on combinational feedback cycles */
function cycleNetSet(){
  const adj=new Map();
  for(const w of S.wires.values()){if(!adj.has(w.a.c))adj.set(w.a.c,[]);adj.get(w.a.c).push(w.b.c);}
  const nets=new Set(),state=new Map(),stack=[];
  function dfs(u){state.set(u,1);stack.push(u);
    for(const v of adj.get(u)||[]){
      if(state.get(v)===1){const i=stack.indexOf(v);
        for(let k=i;k<stack.length;k++){const c=S.comps.get(stack[k]);if(!c)continue;
          for(const p of pinsOf(c))if(p.dir==='out'){const nk=S.netOf.get(c.id+'.'+p.name);if(nk!==undefined)nets.add(nk);}}}
      else if(!state.get(v))dfs(v);}
    stack.pop();state.set(u,2);}
  for(const id of S.comps.keys())if(!state.get(id))dfs(id);
  return nets;}

function seqSample(c,snap,names){
  const r={};for(const n of names){const nk=S.netOf.get(c.id+"."+n);
    const v=nk!==undefined?(snap.get(nk)||{v:0,s:'z'}):{v:0,s:'z'};r[n]=v;}return r;}

/* ---------- clock scheduling ---------- */
function scheduleClock(c){
  const half=Math.max(1,c.props.period|0);
  S.sim.events.push({t:S.sim.t+half,c:c.id,kind:'clk'});
  S.sim.events.sort((a,b)=>a.t-b.t);
}
function initClocks(){S.sim.events.length=0;for(const c of S.comps.values())if(c.type==='clock')scheduleClock(c);}

/* ---------- sim ops ---------- */
function simReset(keepState){
  const keep=new Map();
  if(keepState)for(const c of S.comps.values())keep.set(c.id,c.state);
  newSim();S.sim.drvVal=new Map();
  for(const pr of S.probes)pr.samples=[];
  for(const c of S.comps.values()){
    c.state={};
    const d=CT[c.type];if(d.init)d.init(c);
    if(keepState&&keep.has(c.id))c.state=keep.get(c.id);
    for(const p of pinsOf(c))if(p.dir==='out')S.sim.drvVal.set(c.id+"."+p.name,{v:0,s:'z'});
  }
  initClocks();dirtyAll();settle();probesSample();
}
function stepEvent(){
  const sim=S.sim;
  if(sim.events.length&&sim.events[0].t<=sim.t+0){/* fire due event */}
  // fire next scheduled event if any pending within reach
  const ev=sim.events.shift();
  if(ev){
    sim.t=Math.max(sim.t+1,ev.t);
    const c=S.comps.get(ev.c);
    if(c&&ev.kind==='clk'){c.state.out=c.state.out?0:1;drvSet(c,'Q',V(c.state.out));if(c.state.out)sim.tick++;scheduleClock(c);}
  }else{sim.t++;}
  settle();probesSample();
}
function stepHalf(){stepEvent();}
function stepTick(){ // advance until next rising edge of any clock (or one event if none)
  const sim=S.sim, target=sim.tick+1;let guard=1000;
  while(sim.tick<target&&guard--){
    if(!sim.events.length){sim.t++;settle();probesSample();break;}
    stepEvent();
  }
  if(!guard)toast('tick step aborted (no clock?)','err');
}
function runFrame(now){
  const sim=S.sim;if(!sim.running)return;
  if(!sim._last)sim._last=now;
  // speed: clockHz = ticks/sec target → half-events/sec = 2*hz
  const want=S.settings.clockHz;
  const evPerSec=Math.max(0.1,want*2);
  sim._acc=(sim._acc||0)+(now-sim._last)/1000*evPerSec;sim._last=now;
  let n=0,budget=2000;
  while(sim._acc>=1&&n++<budget){sim._acc--;stepEvent();}
  if(n>=budget)sim._acc=0;
  // measured tick freq
  if(now-(sim._ptm||0)>500){
    sim.hz=Math.round((sim.tick-(sim._pt||0))/Math.max(0.001,(now-(sim._ptm||now))/1000)*10)/10;
    sim._pt=sim.tick;sim._ptm=now;}
}

/* ---------- probes ---------- */
function probesSample(t){
  if(t===undefined)t=S.sim.t;
  for(const pr of S.probes){
    const v=pr.ref?netVal(pr.net):{v:0,s:'z'};
    const L=pr.samples;
    if(!L.length||L[L.length-1].t<t||!VEQ(L[L.length-1],v))
      L.push({t,v:v.v,s:v.s});
    else L[L.length-1]={t,v:v.v,s:v.s};
  }
}
/* net may change on rebuild: store ref as comp.pin */
function addProbe(cid,pn,name){
  const ref=cid+"."+pn;const nk=netOfPin(cid,pn);
  S.probes.push({id:uid(),name:name||("P"+(S.probes.length+1)),ref,net:nk,samples:[]});
  probesSample();renderAnalyzer();pushHist();
}

/* ---------- history ---------- */
function snapshot(){
  return JSON.stringify({v:1,comps:[...S.comps.values()].map(c=>({id:c.id,type:c.type,x:c.x,y:c.y,label:c.label,props:c.props,state:c.state})),
    wires:[...S.wires.values()].map(w=>({id:w.id,a:w.a,b:w.b})),
    probes:S.probes.map(p=>({name:p.name,ref:p.ref})),ttIns:[...S.ttIns],ttOuts:[...S.ttOuts],view:{...S.view}});
}
function restore(js){
  const d=typeof js==='string'?JSON.parse(js):js;
  S.comps.clear();S.wires.clear();S.sel.clear();S.ttIns=new Set(d.ttIns||[]);S.ttOuts=new Set(d.ttOuts||[]);
  for(const cd of d.comps){if(!CT[cd.type])continue;
    S.comps.set(cd.id,{id:cd.id,type:cd.type,x:cd.x,y:cd.y,label:cd.label||"",props:{...(CT[cd.type].defProps?CT[cd.type].defProps():{}),...(cd.props||{})},state:cd.state?JSON.parse(JSON.stringify(cd.state)):{}});}
  for(const wd of d.wires){if(!S.comps.get(wd.a.c)||!S.comps.get(wd.b.c))continue;
    if(!pinDir(S.comps.get(wd.a.c),wd.a.p)||!pinDir(S.comps.get(wd.b.c),wd.b.p))continue;
    S.wires.set(wd.id,{id:wd.id,a:wd.a,b:wd.b,pts:wd.pts||null});}
  S.probes=(d.probes||[]).map(p=>({id:uid(),name:p.name,ref:p.ref,samples:[]}));
  if(d.view)S.view={...S.view,...d.view};
  _uid=1+[...S.comps.keys(),...S.wires.keys()].reduce((m,k)=>Math.max(m,parseInt(String(k).slice(1))||0),0);
  rebuildNets();for(const pr of S.probes)pr.net=S.netOf.get(pr.ref);
  simReset(true);renderAnalyzer();
}
function pushHist(){
  S.hist=S.hist.slice(0,S.histI+1);S.hist.push(snapshot());if(S.hist.length>120)S.hist.shift();
  S.histI=S.hist.length-1;autosave();
}
function undo(){if(S.histI>0){S.histI--;restore(S.hist[S.histI]);toast('undo');}}
function redo(){if(S.histI<S.hist.length-1){S.histI++;restore(S.hist[S.histI]);toast('redo');}}

/* ---------- storage ---------- */
function autosave(){try{localStorage.setItem('dllab.autosave',snapshot());localStorage.setItem('dllab.settings',JSON.stringify(S.settings));}catch(e){}}
function projList(){const r=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('dllab.proj.'))r.push(k.slice(11));}return r.sort();}
function projSave(n){localStorage.setItem('dllab.proj.'+n,snapshot());}
function projLoad(n){const s=localStorage.getItem('dllab.proj.'+n);if(s)restore(s);}

/* ---------- validation ---------- */
function validateCircuit(d){
  if(!d||typeof d!=='object'||!Array.isArray(d.comps)||!Array.isArray(d.wires))throw new Error('not a circuit file');
  if(d.comps.length>5000||d.wires.length>20000)throw new Error('circuit too large');
  for(const c of d.comps){if(typeof c.id!=='string'||typeof c.type!=='string'||!CT[c.type])throw new Error('bad component '+(c&&c.type));
    if(typeof c.x!=='number'||typeof c.y!=='number'||!isFinite(c.x)||!isFinite(c.y))throw new Error('bad position');
    if(c.props&&typeof c.props!=='object')throw new Error('bad props');
    if(c.props)for(const k in c.props){const v=c.props[k];if(typeof v!=='number'&&typeof v!=='string'&&typeof v!=='boolean'&&!Array.isArray(v))throw new Error('bad prop');}}
  for(const w of d.wires){if(!w.a||!w.b||typeof w.a.c!=='string'||typeof w.a.p!=='string')throw new Error('bad wire');}
  return true;
}

/* ---------- toast / misc ---------- */
function toast(msg,cls){const t=document.createElement('div');t.className='toast '+(cls||'');t.textContent=msg;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),2600);}
function fmtVal(v,w,radix){
  if(!v)return'z';if(v.s==='z')return'Z';if(v.s==='x')return'X';if(v.s==='osc')return'~OSC';
  radix=radix||S.settings.radix;w=w||1;
  if(w===1)return v.v?'1':'0';
  if(radix==='bin')return'0b'+v.v.toString(2).padStart(w,'0');
  if(radix==='dec')return String(v.v);
  return'0x'+v.v.toString(16).toUpperCase().padStart(Math.ceil(w/4),'0');
}
function valCls(v){return !v?'vz':v.s==='z'?'vz':v.s==='x'?'vx':v.s==='osc'?'vosc':v.v?'v1':'v0';}
