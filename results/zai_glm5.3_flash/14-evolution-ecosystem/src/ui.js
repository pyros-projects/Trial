/* ============================================================================
   UI wiring: tools, input, charts, inspector, persistence, HUD, main loop.
   ==========================================================================*/
const UI={
  tool:'select',
  toolBrush:new Set(['fert','moist','heat','cool','barrier','erase','remove','plant','herbivore','predator','scavenger']),
  brushSize:90,
  pointer:{x:0,y:0,wx:0,wy:0,onCanvas:false},
  paused:false,
  speedIdx:0,
  speeds:[1,2,4,8,16,32],
  sizeChoice:'Medium',
  highlightSp:0,
  lastAutosave:0,
};

(function(){
const {World,PRESETS,WORLD_SIZES,GENES,gi}=SIM;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
window.addEventListener('error',e=>{
  console.error('UI error:',e.message,e.filename,e.lineno);
  const t=document.createElement('div');
  t.className='toast'; t.style.borderColor='#fc8181';
  t.textContent='Error: '+e.message;
  document.getElementById('toasts')&&document.getElementById('toasts').appendChild(t);
});

// ------------------------------------------------------------------ state
const canvas=$('world');
const view=new View.Renderer(canvas);
let world=null;
let speed=1;
let fps=60,fpsAcc=0,fpsN=0,fpsT=0;
let traitSel=gi.speed;
let saveSettings={};

// ------------------------------------------------------------------- boot
function boot(){
  // world must exist before UI construction (sliders read params)
  let restored=false;
  try{
    const raw=localStorage.getItem('evoLabAutosave');
    if(raw){
      const data=JSON.parse(raw);
      world=World.load(data);
      restored=true;
      if(data.ui){
        if(data.ui.cam) view.cam={...data.ui.cam};
        if(data.ui.viz){ view.viz=data.ui.viz; view.terrainDirty=true; }
        if(data.ui.size) UI.sizeChoice=data.ui.size;
      }
    }
  }catch(e){ console.warn('autosave restore failed',e); }
  if(!world) world=newWorld(1234,'meadow');
  view.world=world;
  if(!restored){
    view.fit();
    // frame the living population (they cluster in the habitable band)
    const orgs=world.organisms;
    if(orgs.length){
      let mx=0,my=0; for(const o of orgs){ mx+=o.x; my+=o.y; }
      view.cam.x=mx/orgs.length; view.cam.y=my/orgs.length;
      view.cam.zoom=Math.min(view.cam.zoom*1.7,1.1);
    }
  }
  buildToolbar(); buildSelects(); buildSliders(); buildEvents(); buildHelp();
  bindInput();
  bindPanel();
  updateParamLabels();
  if(restored) toast('Autosave restored — Data tab has reset options');
  requestAnimationFrame(frame);
  setInterval(()=>{ if($('autosaveChk').checked) doAutosave(); },30000);
}

function newWorld(seed,preset){
  UI.highlightSp=0; view.highlightSp=0; view.selected=null;
  const w=new World({seed,preset,overrides:{size:UI.sizeChoice}});
  $('seedInput').value=seed;
  return w;
}
function loadWorld(w){
  world=w; view.world=w; view.selected=null; UI.highlightSp=0; view.highlightSp=0;
  view.terrainDirty=true; view.fit(); $('seedInput').value=w.seed;
  updateParamLabels();
}

// -------------------------------------------------------------- main loop
let lastT=performance.now();
function frame(now){
  const dt=now-lastT; lastT=now;
  fpsAcc+=dt; fpsN++;
  if(fpsAcc>500){ fps=Math.round(1000*fpsN/fpsAcc); fpsAcc=0; fpsN=0; }
  if(!UI.paused){
    const t0=performance.now();
    let done=0;
    while(done<speed){
      world.step(); done++;
      if(performance.now()-t0>8) break;   // keep UI responsive when accelerated
    }
  }
  if(view.follow&&view.selected){
    view.cam.x+=(view.selected.x-view.cam.x)*0.12;
    view.cam.y+=(view.selected.y-view.cam.y)*0.12;
  }
  view.draw(world);
  const s=now;
  if(s-lastHud>250){ lastHud=s; drawHud(); }
  if(s-lastMinimap>600){ lastMinimap=s; view.drawMinimap($('minimap')); }
  if(tabOn('charts')&&s-lastCharts>450){ lastCharts=s; drawCharts(); }
  if(tabOn('inspect')&&s-lastInspect>220){ lastInspect=s; drawInspector(); }
  requestAnimationFrame(frame);
}
let lastHud=0,lastMinimap=0,lastCharts=0,lastInspect=0;
const tabOn=name=>$('tab-'+name).classList.contains('on');

// ---------------------------------------------------------------- toolbar
const TOOLS=[
  ['select','↖','Select — click an organism to inspect','v'],
  ['pan','✥','Pan — drag to move the camera','h'],
  ['plant','🌱','Plant food — drag to scatter','f'],
  ['herbivore','🐇','Add herbivore','b'],
  ['predator','🦊','Add predator','n'],
  ['scavenger','🪰','Add scavenger','m'],
  ['remove','✖','Remove entities in brush','x'],
  ['fert','🟩','Paint fertility','g'],
  ['moist','💧','Paint moisture','c'],
  ['heat','🔥','Warm the climate','t'],
  ['cool','❄️','Cool the climate','y'],
  ['barrier','🧱','Raise rock barrier','r'],
  ['erase','⌫','Erase barrier','e'],
  ['reserve','🛡️','Drag a protected reserve','o'],
];
function buildToolbar(){
  const tb=$('toolButtons');
  for(const [id,icon,tip,key] of TOOLS){
    const b=document.createElement('button');
    b.className='tbtn'; b.textContent=icon; b.title=`${tip}  (${key.toUpperCase()})`; b.dataset.tool=id;
    b.onclick=()=>setTool(id);
    tb.appendChild(b);
  }
  setTool('select');
}
function setTool(id){
  UI.tool=id;
  document.querySelectorAll('#toolButtons .tbtn').forEach(b=>b.classList.toggle('on',b.dataset.tool===id));
  const t=TOOLS.find(t=>t[0]===id);
  $('hint').textContent=t?t[2]:'';
}

// -------------------------------------------------------------- selects
function buildSelects(){
  const vs=$('vizMode');
  for(const [id,label] of View.VIZ_MODES){
    const o=document.createElement('option'); o.value=id; o.textContent=label; vs.appendChild(o);
  }
  vs.value='natural';
  vs.onchange=()=>{ view.viz=vs.value; view.terrainDirty=true; };

  const ps=$('presetSel');
  for(const key of Object.keys(PRESETS)){
    const o=document.createElement('option'); o.value=key; o.textContent=PRESETS[key].name; ps.appendChild(o);
  }
  ps.value='meadow';
  $('btnPresetLoad').onclick=()=>{
    loadWorld(newWorld(+$('seedInput').value||1234,ps.value));
    toast(`Preset: ${PRESETS[ps.value].name}`);
  };
  const ss=$('sizeSel');
  for(const s of Object.keys(WORLD_SIZES)){
    const o=document.createElement('option'); o.value=s; o.textContent=`${s} (${WORLD_SIZES[s][0]}×${WORLD_SIZES[s][1]})`; ss.appendChild(o);
  }
  ss.value='Medium';
  ss.onchange=()=>{ UI.sizeChoice=ss.value; toast('Size applies on next preset load / reset'); };

  const trait=$('traitSel');
  for(const [idx,G] of GENES.entries()){
    if(['fertThreshold','offspringInvest'].includes(G[0])) continue;
    const o=document.createElement('option'); o.value=idx; o.textContent=G[0]; trait.appendChild(o);
  }
  trait.value=gi.speed;
  trait.onchange=()=>{ traitSel=+trait.value; drawCharts(); };
}

// --------------------------------------------------------------- sliders
const ENV_SLIDERS=[
  ['plantGrowth','Plant growth',0.2,3,0.05],
  ['plantCapacity','Plant capacity',0.3,3,0.05],
  ['metabCost','Metabolic cost',0.3,3,0.05],
  ['reproMul','Repro threshold ×',0.4,2.5,0.05],
  ['sensorMul','Sensor range ×',0.4,2,0.05],
  ['climateAmp','Climate amplitude',0,1,0.05],
  ['dayLength','Day length (ticks)',400,4000,50],
  ['speciation','Speciation distance',0.15,1.2,0.01],
  ['popCap','Population cap',400,4000,100],
];
const GENE_SLIDERS=[
  ['mutationRate','Mutation rate',0,0.5,0.005],
  ['mutationMag','Mutation magnitude',0,0.4,0.005],
  ['predEff','Predation efficiency',0.3,1.5,0.05],
];
function buildSliders(){
  const mk=(host,cfg,get,set)=>{
    const row=document.createElement('div'); row.className='slider';
    row.innerHTML=`<span class="lab">${cfg[1]}</span><input type="range" min="${cfg[2]}" max="${cfg[3]}" step="${cfg[4]}"><span class="val"></span>`;
    const inp=row.querySelector('input'),val=row.querySelector('.val');
    inp.value=get();
    val.textContent=fmtVal(get(),cfg[4]);
    inp.oninput=()=>{ set(parseFloat(inp.value)); val.textContent=fmtVal(parseFloat(inp.value),cfg[4]); };
    cfg._update=()=>{ inp.value=get(); val.textContent=fmtVal(get(),cfg[4]); };
    host.appendChild(row);
  };
  const host=$('envSliders');
  for(const cfg of ENV_SLIDERS) mk(host,cfg,()=>world.params[cfg[0]],v=>world.params[cfg[0]]=v);
  const gh=$('geneSliders');
  for(const cfg of GENE_SLIDERS) mk(gh,cfg,()=>world.params[cfg[0]],v=>world.params[cfg[0]]=v);
  // crossover toggle
  const xrow=document.createElement('div'); xrow.className='row';
  xrow.innerHTML=`<label class="inline"><input type="checkbox" id="xoverChk" checked> Sexual reproduction (crossover)</label>`;
  gh.appendChild(xrow);
  xrow.querySelector('input').onchange=e=>world.params.crossover=e.target.checked;
  // brush
  const br=$('brushSliders');
  const brow=document.createElement('div'); brow.className='slider';
  brow.innerHTML=`<span class="lab">Brush size</span><input id="brushSize" type="range" min="40" max="240" step="10" value="90"><span class="val">90</span>`;
  br.appendChild(brow);
  const bi=brow.querySelector('input');
  bi.oninput=()=>{ UI.brushSize=+bi.value; brow.querySelector('.val').textContent=bi.value; };
  // render density + overlays
  const vd=document.createElement('div'); vd.className='row';
  vd.innerHTML=`<label class="inline">Render detail</label><select id="densitySel">
    <option value="0">Low</option><option value="1">Medium</option><option value="2" selected>High</option></select>`;
  $('brushSliders').appendChild(vd);
  vd.querySelector('select').onchange=e=>view.density=+e.target.value;
  const ov=document.createElement('div'); ov.className='row'; ov.style.flexWrap='wrap'; ov.style.gap='10px';
  ov.innerHTML=`
    <label><input type="checkbox" data-ov="rays"> Sensor rays</label>
    <label><input type="checkbox" data-ov="steer"> Steering</label>
    <label><input type="checkbox" data-ov="targets"> Target</label>
    <label><input type="checkbox" data-ov="grid"> Cells</label>
    <label><input type="checkbox" data-ov="decide"> Decisions</label>
    <label><input type="checkbox" data-ov="names"> Names</label>`;
  $('brushSliders').appendChild(ov);
  ov.querySelectorAll('input[data-ov]').forEach(c=>c.onchange=()=>view.overlays[c.dataset.ov]=c.checked);
  $('btnClearReserve').onclick=()=>{ world.reserve=null; toast('Reserve cleared'); };
}
function fmtVal(v,step){ return step>=1?String(Math.round(v)):v.toFixed(String(step).split('.')[1]?.length??2); }
function updateParamLabels(){
  document.querySelectorAll('.slider').forEach(()=>{});
  for(const cfg of [...ENV_SLIDERS,...GENE_SLIDERS]) cfg._update&&cfg._update();
}

// ---------------------------------------------------------- interventions
const EVENTS=[
  ['drought','🌵 Drought'],['bloom','🌸 Bloom'],['coldsnap','🧊 Cold snap'],['heatwave','🔥 Heat wave'],
  ['disease','🦠 Disease'],['meteor','☄️ Meteor'],['wildfire','🔥 Wildfire'],['foodpulse','🍃 Food pulse'],
  ['predators','🦊 Introduce predators'],
];
function buildEvents(){
  const host=$('eventButtons');
  for(const [id,label] of EVENTS){
    const b=document.createElement('button'); b.className='pbtn'; b.textContent=label;
    b.onclick=()=>{ world.intervention(id); toast(label.replace(/^\S+\s/,'')+' triggered'); };
    host.appendChild(b);
  }
}

// ------------------------------------------------------------------ panel
function bindPanel(){
  document.querySelectorAll('#tabs button').forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
      $('tab-'+b.dataset.tab).classList.add('on');
      if(b.dataset.tab==='charts') drawCharts();
      if(b.dataset.tab==='inspect'){ drawInspector(); updateSpeciesList(); }
      if(b.dataset.tab==='world') updateParamLabels();
    };
  });
  $('btnPanel').onclick=()=>$('panel').classList.toggle('open');
  $('btnPause').onclick=togglePause;
  $('btnStep').onclick=()=>{ UI.paused=true; syncPause(); world.step(); };
  $('btnSpeedUp').onclick=()=>speedUp(1);
  $('btnSpeedDown').onclick=()=>speedUp(-1);
  $('btnFollow').onclick=()=>{ view.follow=!view.follow; $('btnFollow').classList.toggle('on',view.follow); };
  $('btnHighlight').onclick=()=>{
    if(view.selected){ UI.highlightSp=view.selected.spId; view.highlightSp=UI.highlightSp; updateSpeciesList(); }
  };
  $('btnKillSel').onclick=()=>{ if(view.selected){ world.removeAt(view.selected.x,view.selected.y,6); } };
  $('btnDice').onclick=()=>{ $('seedInput').value=(Math.random()*0xffffffff)>>>0; };
  $('btnResetSame').onclick=()=>{ loadWorld(newWorld(+$('seedInput').value>>>0,$('presetSel').value)); toast('World reset (same seed)'); };
  $('btnResetNew').onclick=()=>{ const s=(Math.random()*0xffffffff)>>>0; $('presetSel').value='meadow'; loadWorld(newWorld(s,'meadow')); toast('Fresh world, seed '+s); };
  $('btnSave').onclick=saveToFile;
  $('btnLoad').onclick=()=>$('fileInput').click();
  $('fileInput').onchange=loadFromFile;
  $('btnCSV').onclick=exportCSV;
  $('btnPNG').onclick=exportPNG;
  $('minimap').onclick=e=>{
    const r=$('minimap').getBoundingClientRect();
    view.cam.x=(e.clientX-r.left)/r.width*world.W;
    view.cam.y=(e.clientY-r.top)/r.height*world.H;
  };
}

// ------------------------------------------------------------------ input
function bindInput(){
  const pointers=new Map();
  let panStart=null,brushLast=null,reserveAnchor=null,pinch=null;

  const toWorld=e=>{
    const r=canvas.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    UI.pointer.x=x; UI.pointer.y=y;
    UI.pointer.wx=view.s2wX(x); UI.pointer.wy=view.s2wY(y);
    UI.pointer.onCanvas=true;
    return [x,y];
  };

  canvas.addEventListener('pointerdown',e=>{
    try{ canvas.setPointerCapture(e.pointerId); }catch(_){/* synthetic pointers can't capture */}
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
    toWorld(e);
    if(pointers.size===2){
      const pts=[...pointers.values()];
      pinch={d:Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1]),
             cx:(pts[0][0]+pts[1][0])/2,cy:(pts[0][1]+pts[1][1])/2,
             wx:view.s2wX((pts[0][0]+pts[1][0])/2),wy:view.s2wY((pts[0][1]+pts[1][1])/2)};
      panStart=null; brushLast=null; reserveAnchor=null;
      return;
    }
    const t=UI.tool;
    if(t==='pan'){ panStart=[e.clientX,e.clientY,view.cam.x,view.cam.y]; }
    else if(t==='select'){
      const o=view.pick(UI.pointer.x,UI.pointer.y);
      view.selected=o||null;
      if(o){ toast(`#${o.id} ${o.role} · ${spName(o.spId)}`); if(!$('tab-inspect').classList.contains('on'))
        document.querySelector('#tabs button[data-tab=inspect]').click(); }
    }
    else if(t==='reserve'){ reserveAnchor=[UI.pointer.wx,UI.pointer.wy]; }
    else { applyTool(); brushLast=[UI.pointer.wx,UI.pointer.wy]; }
  });
  canvas.addEventListener('pointermove',e=>{
    toWorld(e);
    if(pointers.has(e.pointerId)) pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if(pinch&&pointers.size===2){
      const pts=[...pointers.values()];
      const d=Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1]);
      const cx=(pts[0][0]+pts[1][0])/2,cy=(pts[0][1]+pts[1][1])/2;
      const nz=clamp(view.cam.zoom*(d/pinch.d),0.08,3);
      view.cam.zoom=nz;
      view.cam.x=pinch.wx-(cx-canvas.clientWidth/2)/nz;
      view.cam.y=pinch.wy-(cy-canvas.clientHeight/2)/nz;
      pinch.d=d; pinch.cx=cx; pinch.cy=cy;
      return;
    }
    if(!pointers.has(e.pointerId)) return;
    if(panStart){
      const dx=(e.clientX-panStart[0])/view.cam.zoom,dy=(e.clientY-panStart[1])/view.cam.zoom;
      view.cam.x=panStart[2]-dx; view.cam.y=panStart[3]-dy;
      view.follow=false; $('btnFollow').classList.remove('on');
    } else if(brushLast||UI.toolBrush.has(UI.tool)){
      if(brushLast){
        const dx=UI.pointer.wx-brushLast[0],dy=UI.pointer.wy-brushLast[1];
        if(dx*dx+dy*dy<(UI.brushSize*0.25)**2) return;
      }
      applyTool(); brushLast=[UI.pointer.wx,UI.pointer.wy];
    }
    if(reserveAnchor){ view._reservePreview=[reserveAnchor,[UI.pointer.wx,UI.pointer.wy]]; }
  });
  const up=e=>{
    pointers.delete(e.pointerId);
    if(pointers.size<2) pinch=null;
    if(reserveAnchor){
      world.reserveSet(reserveAnchor[0],reserveAnchor[1],UI.pointer.wx,UI.pointer.wy);
      toast('Reserve set — predation suppressed, growth boosted');
      reserveAnchor=null; view._reservePreview=null;
    }
    panStart=null; brushLast=null;
  };
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('pointerleave',()=>{ UI.pointer.onCanvas=false; });
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const wx=view.s2wX(e.offsetX),wy=view.s2wY(e.offsetY);
    const nz=clamp(view.cam.zoom*Math.exp(-e.deltaY*0.0012),0.08,3);
    view.cam.zoom=nz;
    view.cam.x=wx-(e.offsetX-canvas.clientWidth/2)/nz;
    view.cam.y=wy-(e.offsetY-canvas.clientHeight/2)/nz;
  },{passive:false});

  window.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return;
    const k=e.key.toLowerCase();
    if(k===' '){ e.preventDefault(); togglePause(); }
    else if(k==='.'){ UI.paused=true; syncPause(); world.step(); }
    else if(k==='='||k==='+') speedUp(1);
    else if(k==='-') speedUp(-1);
    else if(k==='f'){ setTool('plant'); }
    else{
      const t=TOOLS.find(t=>t[3]===k);
      if(t) setTool(t[0]);
      else if(k==='k'){
        const i=View.VIZ_MODES.findIndex(m=>m[0]===view.viz);
        const nx=View.VIZ_MODES[(i+1)%View.VIZ_MODES.length];
        view.viz=nx[0]; $('vizMode').value=nx[0]; view.terrainDirty=true;
      }
    }
  });

  window.addEventListener('resize',()=>{ view.resize(); });
  view.resize();
}

function applyTool(){
  const t=UI.tool,x=UI.pointer.wx,y=UI.pointer.wy;
  if(x<0||y<0||x>world.W||y>world.H) return;
  switch(t){
    case 'fert': case 'moist': case 'heat': case 'cool': case 'barrier': case 'erase':
      world.applyBrush(x,y,UI.brushSize,t,1); break;    case 'plant':
      for(let k=0;k<3;k++)
        world.spawnPlant(x+(Math.random()-0.5)*UI.brushSize,y+(Math.random()-0.5)*UI.brushSize);
      break;
    case 'herbivore': case 'predator': case 'scavenger':
      world.spawnOrganism(t,x,y); break;
    case 'remove':
      world.removeAt(x,y,UI.brushSize*0.6); break;
  }
}
function SIM_rand(){ return Math.random(); }
void SIM_rand;
function spName(spId){ const sp=world.spById.get(spId); return sp?sp.name:'—'; }

function togglePause(){ UI.paused=!UI.paused; syncPause(); }
function syncPause(){
  $('btnPause').textContent=UI.paused?'▶':'⏸';
  $('btnPause').classList.toggle('on',UI.paused);
}
function speedUp(d){
  UI.speedIdx=clamp(UI.speedIdx+d,0,UI.speeds.length-1);
  speed=UI.speeds[UI.speedIdx];
  $('speedLabel').textContent='×'+speed;
}

// -------------------------------------------------------------------- HUD
function drawHud(){
  const s=world.stats||{};
  const ev=world.event;
  const evTxt=ev?` · <span class="warn">⚑ ${ev.type}${ev.info?' '+ev.info:''} ${ev.dur>200?('· '+Math.ceil((ev.dur-(world.tick-ev.t0))/60)+'s'):''}</span>`:'';
  const sel=view.selected;
  const sp=sel?world.spById.get(sel.spId):null;
  $('hud').innerHTML=
    `<div class="row2">
      <span><b>${fps}</b> fps · <b>${fmtK(world.tick)}</b> ticks · <b>×${speed}</b>${UI.paused?' · <span class="warn">PAUSED</span>':''}</span>
      <span>pop <b>${s.pop??0}</b> (H ${s.h??0} · P ${s.p??0} · S ${s.sc??0} · O ${s.o??0})</span>
      <span>species <b>${s.species??0}</b> · max gen <b>${s.maxGen??0}</b></span>
      <span>births <b>${s.births??0}</b>/kt · deaths <b>${s.deaths??0}</b>/kt</span>
      <span>biomass <b>${fmtK(s.bio||0)}</b> · plants <b>${s.plants??0}</b></span>
      ${sel?`<span>▸ #${sel.id} ${sel.role} · ${sp?sp.name:'—'} · gen ${sel.gen} · ${sel.state}</span>`:''}
      ${world.reserve?'<span class="warn">🛡 reserve</span>':''}
      ${evTxt}
    </div>`;
}
function fmtK(v){ return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1000?(v/1000).toFixed(1)+'k':String(Math.round(v||0)); }

// ----------------------------------------------------------------- charts
function drawCharts(){
  const h=world.history;
  if(!h.length) return;
  const pick=k=>h.map(s=>s[k]||0);
  const legend=[];
  View.drawSeries($('chartPop'),[
    {values:pick('h'),color:'#8fdc7a',label:'Herb'},
    {values:pick('p'),color:'#ff7a5c',label:'Pred'},
    {values:pick('sc'),color:'#b9a0e8',label:'Scav'},
    {values:pick('o'),color:'#ffd76a',label:'Omn'},
  ],{labels:true});
  View.drawSeries($('chartBD'),[
    {values:pick('births'),color:'#68d391',label:'Births'},
    {values:pick('deaths'),color:'#fc8181',label:'Deaths'},
  ],{labels:true});
  const eCur=h[h.length-1].avgE||0,bCur=h[h.length-1].bio||0;
  View.drawSeries($('chartEnergy'),[
    {values:pick('avgE'),color:'#4fd1c5',label:'avgE'},
    {values:h.map(s=>(s.bio||0)/100),color:'#f6ad55',label:'bio/100'},
  ],{labels:true});
  View.drawSeries($('chartGen'),[
    {values:pick('avgGen'),color:'#63b3ed',label:'Gen'},
    {values:h.map(s=>(s.div||0)*100),color:'#ed64a6',label:'div×100'},
  ],{labels:true});
  View.drawSeries($('chartRes'),[
    {values:pick('plants'),color:'#68d391',label:'Plants'},
  ],{labels:true});
  View.traitHistogram($('chartTrait'),world.organisms,traitSel,GENES[traitSel][0],GENES[traitSel][1],GENES[traitSel][2]);
  $('chartLegend').innerHTML=`Population t=${world.tick} · avgE ${eCur.toFixed(1)} · biomass ${fmtK(bCur)} · div ${((h[h.length-1].div)||0).toFixed(3)}`;
}

// -------------------------------------------------------------- inspector
function drawInspector(){
  const o=view.selected;
  $('selEmpty').classList.toggle('hidden',!!o);
  $('selInfo').classList.toggle('hidden',!o);
  if(!o){ return; }
  const sp=world.spById.get(o.spId);
  const pct=(a,b)=>Math.round(100*clamp(a/b,0,1));
  const bar=(v,color)=>`<div class="bar"><i style="width:${Math.round(100*clamp(v,0,1))}%;background:${color||'var(--acc)'}"></i></div>`;
  const G=k=>o.g[gi[k]];
  const f=$('selFields');
  f.innerHTML=`
    <span class="k">ID</span><span class="v">#${o.id}</span>
    <span class="k">Species</span><span class="v">${sp?`<span class="spdot" style="display:inline-block;background:${hsl2(sp.hue)}"></span> ${sp.name}`:'—'}</span>
    <span class="k">Role</span><span class="v">${o.role}</span>
    <span class="k">Behavior</span><span class="v">${o.state}</span>
    <span class="k">Generation</span><span class="v">${o.gen}</span>
    <span class="k">Age</span><span class="v">${Math.round(o.age)}/${Math.round(G('lifespan'))} (${pct(o.age,G('lifespan'))}%)</span>
    <span class="k">Energy</span><span class="v">${o.energy.toFixed(1)}/${o.maxE.toFixed(0)}</span>
    <span class="k">Health</span><span class="v">${o.health.toFixed(1)}/${o.maxH.toFixed(1)}</span>
    <span class="k">Speed</span><span class="v">${(o.speed||0).toFixed(2)} wu/t</span>
    <span class="k">Size gene</span><span class="v">${G('size').toFixed(2)}</span>
    <span class="k">Vision</span><span class="v">${G('vision').toFixed(0)}</span>
    <span class="k">Digest</span><span class="v">${G('digest').toFixed(2)}</span>
    <span class="k">Aggression</span><span class="v">${G('aggression').toFixed(2)}</span>
    <span class="k">Camouflage</span><span class="v">${G('camo').toFixed(2)}</span>
    <span class="k">Comfort T</span><span class="v">${G('comfort').toFixed(1)}°±${G('tolerance').toFixed(1)}</span>
    <span class="k">Parent</span><span class="v">${o.pa?'#'+o.pa:'founder'}</span>
    <span class="k">Offspring</span><span class="v">${o.kids}</span>
    <span class="k">Descendants</span><span class="v">${o.desc}</span>
    <span class="k">Mutations</span><span class="v">${o.muts}</span>
    <span class="k">Infected</span><span class="v">${o.infected?'yes':(o.immune?'immune':'no')}</span>
    <span class="k">Crowding</span><span class="v">${o._crowd??0}</span>
    <span class="k">Target</span><span class="v">${o.tgtType||'—'} ${o.tgtId||''}</span>
  `;
  // bars under key vitals
  $('selBars').innerHTML=`
    <div class="small muted">energy</div>${bar(o.energy/o.maxE,'#4fd1c5')}
    <div class="small muted">health</div>${bar(o.health/o.maxH,'#fc8181')}
    <div class="small muted">diet plant / meat / carrion</div>${bar(G('dietPlant'),'#68d391')}${bar(G('dietMeat'),'#ff8c42')}${bar(G('dietCarrion'),'#b9a0e8')}`;
  // nn outputs
  const out=$('selOut');
  const orow=(label,v,c)=>{
    const p=v<0?50+(-v*50):50+v*50;
    return `<div class="outrow"><span>${label}</span><div class="bar" style="position:relative"><i style="position:absolute;left:${Math.min(50,p)}%;width:${Math.abs(v)*50}%;background:${c}"></i></div><span class="v">${v.toFixed(2)}</span></div>`;
  };
  out.innerHTML=o.out?orow('turn',o.out[0],'#63b3ed')+orow('thrust',o.out[1],'#68d391')+orow('sprint',o.out[2],'#f6ad55'):'';
  // sensors
  if(o.in){
    const i=o.in;
    $('selSensors').textContent=
      `food(${i[0].toFixed(2)},${i[1].toFixed(2)}) threat(${i[2].toFixed(2)},${i[3].toFixed(2)}) prey(${i[4].toFixed(2)},${i[5].toFixed(2)}) mate(${i[6].toFixed(2)},${i[7].toFixed(2)}) `+
      `obst(${i[8].toFixed(2)},${i[9].toFixed(2)}) crowd ${i[10].toFixed(2)} hunger ${i[11].toFixed(2)} health ${i[12].toFixed(2)} ΔT ${i[13].toFixed(2)} moist ${i[14].toFixed(2)} light ${i[15].toFixed(2)}`;
  }
  // ancestry
  const an=$('selAncestry');
  if(o.an&&o.an.length){
    an.innerHTML=o.an.map((a,k)=>{
      const s=world.spById.get(a.sp);
      return `<div class="anc">${'·'.repeat(k)} gen ${a.gen}: #${a.id} ${s?s.name:''}</div>`;
    }).join('');
  } else an.innerHTML='<div class="muted">Founder lineage</div>';
  View.drawPortrait($('portrait'),world,o);
}
function hsl2(h){ return `hsl(${h},68%,58%)`; }

// ---------------------------------------------------------- species + phylo
function updateSpeciesList(){
  const counts=new Map();
  for(const o of world.organisms) counts.set(o.spId,(counts.get(o.spId)||0)+1);
  const rows=[...world.spById.values()]
    .sort((a,b)=>(counts.get(b.id)||0)-(counts.get(a.id)||0))
    .slice(0,16);
  const host=$('speciesList');
  host.innerHTML='';
  for(const sp of rows){
    const n=counts.get(sp.id)||0;
    const d=document.createElement('div');
    d.className='sprow'+(UI.highlightSp===sp.id?' on':'');
    d.innerHTML=`<span class="spdot" style="background:${hsl2(sp.hue)}"></span>
      <span>${sp.name}${n?'':'<span class="muted"> (extinct)</span>'}</span><span class="cnt">${n}</span>`;
    d.onclick=()=>{
      UI.highlightSp=UI.highlightSp===sp.id?0:sp.id;
      view.highlightSp=UI.highlightSp;
      updateSpeciesList();
    };
    host.appendChild(d);
  }
  if(!rows.length) host.innerHTML='<div class="muted">—</div>';
  const cv=$('phylo');
  View.drawPhylo(cv,world,UI.highlightSp);
  cv.onclick=e=>{
    const r=cv.getBoundingClientRect();
    const x=(e.clientX-r.left)*(cv.width/r.width),y=(e.clientY-r.top)*(cv.height/r.height);
    let best=null,bd=1e9;
    for(const n of (cv._nodes||[])){
      const d=(n.x-x)**2+(n.y-y)**2;
      if(d<bd&&d<(n.r+8)**2){bd=d;best=n;}
    }
    if(best){
      UI.highlightSp=UI.highlightSp===best.sp.id?0:best.sp.id;
      view.highlightSp=UI.highlightSp;
      updateSpeciesList();
      toast(`Species ${best.sp.name}${UI.highlightSp?' highlighted':''}`);
    }
  };
}
// refresh species list occasionally when inspect tab is open
setInterval(()=>{ if(tabOn('inspect')&&world) updateSpeciesList(); },3000);

// ------------------------------------------------------------ persistence
function saveToFile(){
  const data=world.serialize();
  data.ui={cam:{...view.cam},viz:view.viz,size:UI.sizeChoice,preset:$('presetSel').value};
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`ecosystem-t${world.tick}-seed${world.seed}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('State saved to file');
}
function loadFromFile(e){
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const data=JSON.parse(rd.result);
      loadWorld(World.load(data));
      if(data.ui){
        if(data.ui.cam) view.cam={...data.ui.cam};
        if(data.ui.viz){ view.viz=data.ui.viz; $('vizMode').value=data.ui.viz; view.terrainDirty=true; }
        if(data.ui.preset) $('presetSel').value=data.ui.preset;
        if(data.ui.size) UI.sizeChoice=data.ui.size;
      }
      toast(`Loaded: tick ${world.tick}, ${world.organisms.length} organisms`);
    }catch(err){ toast('Load failed: '+err.message); }
  };
  rd.readAsText(f);
  e.target.value='';
}
function doAutosave(){
  try{
    const t0=performance.now();
    const data=world.serialize();
    data.ui={cam:{...view.cam},viz:view.viz,size:UI.sizeChoice,preset:$('presetSel').value};
    localStorage.setItem('evoLabAutosave',JSON.stringify(data));
    $('autosaveStatus').textContent=`Last autosave: tick ${fmtK(world.tick)}, ${world.organisms.length} organisms (${((performance.now()-t0)/1000).toFixed(1)}s ago, ${(JSON.stringify(data).length/1024).toFixed(0)}KB)`;
  }catch(e){
    $('autosaveStatus').textContent='Autosave failed (storage full?) — file save still works.';
  }
}
function exportCSV(){
  const cols=['t','pop','h','p','sc','o','plants','births','deaths','avgE','bio','avgGen','maxGen','species','avgSpeed','avgSize','div'];
  const lines=[cols.join(',')];
  for(const s of world.history){
    lines.push(cols.map(c=>typeof s[c]==='number'?(Math.round(s[c]*1000)/1000):'').join(','));
  }
  const blob=new Blob([lines.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`ecosystem-history-t${world.tick}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast(`CSV exported (${world.history.length} samples)`);
}
function exportPNG(){
  canvas.toBlob(b=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download=`ecosystem-view-t${world.tick}.png`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  });
  toast('PNG exported');
}

// ------------------------------------------------------------------- help
function buildHelp(){
  $('helpKeys').innerHTML=[
    'Space — pause / resume',' . — single step',' + / − — simulation speed',
    'V select · H pan · F plants · B herbivore · N predator · M scavenger · X remove',
    'G fertility · C moisture · T warm · Y cool · R barrier · E erase · O reserve',
    'K — cycle visualization mode','Wheel / pinch — zoom · drag — pan (pan tool or touch)',
  ].map(s=>`<div>${s}</div>`).join('');
}

// ------------------------------------------------------------------ toast
function toast(msg){
  const d=document.createElement('div');
  d.className='toast'; d.textContent=msg;
  $('toasts').appendChild(d);
  setTimeout(()=>{ d.style.opacity='0'; d.style.transition='opacity .4s'; },2200);
  setTimeout(()=>d.remove(),2700);
}

boot();
window.EVO={get world(){return world;},view,UI};   // diagnostics/automation handle
})();
