// ============================================================ serialization
const SAVE_VERSION = 3;

function serializeWorld(){
  const ents=[];
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    const e=W.ents[cellIdx(x,y)]; if(!e)continue;
    const s={k:e.kind,x,y,d:e.dir};
    if(e.recipe)s.r=e.recipe;
    if(e.mods&&(e.mods.speed||e.mods.eff||e.mods.prod))s.m=e.mods;
    if(e.items&&e.items.length)s.it=e.items.map(i=>[i.type,i.n,Math.round(i.pos*1000)/1000]);
    if(e.inBuf&&bufCount(e.inBuf))s.ib=e.inBuf;
    if(e.outBuf&&bufCount(e.outBuf))s.ob=e.outBuf;
    if(e.inv&&bufCount(e.inv))s.iv=e.inv;
    if(e.inv&&e.kind==='delivery'&&bufCount(e.inv))s.iv=e.inv;
    if(e.working){s.w=1;s.p=Math.round(e.progress*1000)/1000;}
    if(e.burnT>0)s.bt=Math.round(e.burnT*100)/100;
    if(e.held)s.h=[e.held.type,e.held.n];
    if(e.nextSide)s.ns=e.nextSide;
    ents.push(s);
  }
  // sparse terrain
  const terr=[];
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    const i=cellIdx(x,y);
    if(W.terrain[i]||W.deposit[i]) terr.push([x,y,W.terrain[i],W.deposit[i]]);
  }
  return {
    v:SAVE_VERSION, seed:W.settings.seed, W:W.W, H:W.H,
    settings:Object.assign({},W.settings),
    tick:W.tick, time:Math.round(W.time*100)/100,
    credits:W.credits, spent:W.spent, mode:W.mode, preset:W.presetName,
    contract: W.contract?{item:W.contract.item,amount:W.contract.amount,
      deadline:W.contract.deadline,got:W.contract.got,done:W.contract.done,
      win:W.contract.win,score:W.contract.score,startTick:W.contract.startTick}:null,
    terr, ents,
    stats:{produced:W.stats.produced,consumed:W.stats.consumed,delivered:W.stats.delivered},
  };
}

function validateSave(d){
  if(!d||typeof d!=='object') return 'not an object';
  if(typeof d.W!=='number'||typeof d.H!=='number'||d.W<8||d.H<8||d.W>200||d.H>200) return 'bad dimensions';
  if(!Array.isArray(d.ents)||!Array.isArray(d.terr)) return 'missing arrays';
  if(d.ents.length>60000||d.terr.length>60000) return 'too many entries';
  for(const e of d.ents){
    if(!e||typeof e.x!=='number'||typeof e.y!=='number'||typeof e.k!=='string') return 'bad entity';
    if(!KINDS[e.k]) return 'unknown entity '+e.k;
    if(e.x<0||e.y<0||e.x>=d.W||e.y>=d.H) return 'entity out of bounds';
    if(e.it&&(!Array.isArray(e.it)||e.it.length>64)) return 'bad item list';
  }
  return null;
}

function deserializeWorld(d){
  const err=validateSave(d);
  if(err) return {err};
  newWorld(d.W,d.H,(d.seed??1337));
  W.terrain.fill(0); W.deposit.fill(0);
  for(const [x,y,t,dep] of d.terr){
    if(!inB(x,y))continue;
    const i=cellIdx(x,y);
    W.terrain[i]=clamp(t|0,0,4); W.deposit[i]=dep|0;
  }
  if(d.settings) Object.assign(W.settings, d.settings);
  W.settings.gridW=d.W; W.settings.gridH=d.H;
  W.tick=d.tick|0; W.time=d.time||0;
  W.credits=d.credits??400; W.spent=d.spent||0; W.mode=d.mode||'sandbox';
  W.presetName=d.preset||'';
  for(const s of d.ents){
    const e=mkEnt(s.k,s.x,s.y,s.d||0);
    if(s.r&&RECIPES[s.r]&&ISMACHINE(s.k))e.recipe=s.r;
    if(s.m)e.mods=Object.assign({speed:0,eff:0,prod:0},s.m);
    if(s.it){ e.items=s.it.filter(i=>ITEMS[i[0]]).map(i=>({type:i[0],n:Math.max(1,i[1]|0),pos:clamp(i[2]||0,0,0.999),stamp:-1}));
      e.items.sort((a,b)=>b.pos-a.pos); }
    if(s.ib)e.inBuf=sanitizeBuf(s.ib);
    if(s.ob)e.outBuf=sanitizeBuf(s.ob);
    if(s.iv)e.inv=sanitizeBuf(s.iv);
    if(s.w){e.working=true;e.progress=s.p||0;}
    if(s.bt)e.burnT=s.bt;
    if(s.h&&ITEMS[s.h[0]]){e.held={type:s.h[0],n:s.h[1]|0||1};W.itemCount+=e.held.n;}
    if(s.ns)e.nextSide=s.ns;
    W.ents[cellIdx(s.x,s.y)]=e;
    if(e.items)for(const it of e.items)W.itemCount+=it.n;
  }
  if(d.contract) W.contract=Object.assign({left:0},d.contract,{done:d.contract.done});
  if(d.stats){ for(const k of['produced','consumed','delivered']){
    if(d.stats[k])for(const t in d.stats[k])if(ITEMS[t]!==undefined)W.stats[k][t]=d.stats[k][t]; } }
  W.powerDirty=true;
  W.undoStack=[];W.redoStack=[];
  return {ok:true};
}
function sanitizeBuf(b){
  const o={}; for(const t in b){ if(ITEMS[t]&&b[t]>0) o[t]=Math.min(9999,b[t]|0); } return o;
}

// ---------------- undo/redo (snapshot based)
function pushUndo(){
  try{
    W.undoStack.push(JSON.stringify(serializeWorld()));
    if(W.undoStack.length>40)W.undoStack.shift();
    W.redoStack.length=0;
  }catch(e){}
}
function undo(){
  if(!W.undoStack.length)return;
  const cur=JSON.stringify(serializeWorld());
  const s=W.undoStack.pop();
  const us=W.undoStack, rs=W.redoStack;   // deserialize clears stacks
  const r=deserializeWorld(JSON.parse(s));
  if(r.ok){
    W.undoStack=us; W.redoStack=rs;
    W.redoStack.push(cur);
    toast('Undo');sfx('click');
  }
}
function redo(){
  if(!W.redoStack.length)return;
  const cur=JSON.stringify(serializeWorld());
  const s=W.redoStack.pop();
  const us=W.undoStack, rs=W.redoStack;
  const r=deserializeWorld(JSON.parse(s));
  if(r.ok){
    W.undoStack=us; W.redoStack=rs;
    W.undoStack.push(cur);
    toast('Redo');sfx('click');
  }
}

// ---------------- share code (base64url of json)
function shareEncode(){
  const json=JSON.stringify(serializeWorld());
  return 'FOUNDRY1.'+btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function shareDecode(str){
  str=(str||'').trim();
  if(!str.startsWith('FOUNDRY1.'))return{err:'bad header'};
  let b=str.slice(9).replace(/-/g,'+').replace(/_/g,'/');
  while(b.length%4)b+='=';
  try{
    const json=decodeURIComponent(escape(atob(b)));
    return{data:JSON.parse(json)};
  }catch(e){return{err:'decode failed'};}
}

// ---------------- local storage slots
const LS_KEY='foundry.slots', LS_AUTO='foundry.autosave';
function lsSlots(){
  try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}');}catch(e){return{};}
}
function lsSave(name){
  const s=lsSlots();
  s[name]={t:Date.now(),data:serializeWorld()};
  try{localStorage.setItem(LS_KEY,JSON.stringify(s));return true;}
  catch(e){return false;}
}
function lsLoad(name){
  const s=lsSlots(); if(!s[name])return null; return s[name].data;
}
function lsDelete(name){ const s=lsSlots(); delete s[name];
  try{localStorage.setItem(LS_KEY,JSON.stringify(s));}catch(e){} }
function lsAutosave(){
  try{localStorage.setItem(LS_AUTO,JSON.stringify({t:Date.now(),data:serializeWorld()}));}catch(e){}
}
function lsAutosaveGet(){
  try{const d=JSON.parse(localStorage.getItem(LS_AUTO)||'null');return d?d.data:null;}catch(e){return null;}
}
