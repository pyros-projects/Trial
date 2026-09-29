/* ============================== UI PANELS ============================== */

/* ---------- toolbar ---------- */
function buildToolbar(){
  const tb=$('#toolbar');tb.innerHTML='';
  const mk=(t,fn,title)=>{const b=document.createElement('button');b.textContent=t;b.title=title||'';b.onclick=fn;tb.appendChild(b);return b;};
  const sep=()=>{const s=document.createElement('span');s.className='sep';tb.appendChild(s);};
  const lbl=document.createElement('span');lbl.className='logo';lbl.textContent='⚡LogicLab';tb.appendChild(lbl);
  const g=document.createElement('span');g.className='grp';tb.appendChild(g);
  const tool=(id,t,title)=>{const b=document.createElement('button');b.textContent=t;b.title=title;b.dataset.tool=id;
    b.classList.toggle('on',S.tool===id);b.onclick=()=>setTool(id);g.appendChild(b);};
  tool('select','⬚ Select','Select / move (V)');tool('wire','⌁ Wire','Wire tool (W)');tool('pan','✋ Pan','Pan (H / space)');
  sep();
  mk('⎌ Undo',undo,'Ctrl+Z');mk('⎌ Redo',redo,'Ctrl+Y');
  sep();
  mk('▶ Run',()=>S.sim.running?pauseRun():startRun(),'Run clock (R)').id='btnRun';
  mk('▮ Pause',pauseRun,'Pause').id='btnPause';
  mk('» Event',stepEvent,'Step one propagation event (E)');
  mk('» Tick',stepTick,'Advance one clock tick (T)');
  mk('⟲ Reset',()=>{pauseRun();simReset();toast('reset');},'Reset simulation (0)');
  sep();
  const sl=document.createElement('input');sl.type='range';sl.min=0;sl.max=60;sl.step=0.5;sl.value=S.settings.clockHz;
  sl.style.width='90px';sl.title='Clock speed (ticks/s)';
  sl.oninput=()=>{S.settings.clockHz=+sl.value;hudClock.textContent=sl.value+' Hz';};
  const hudClock=document.createElement('span');hudClock.className='lbl';hudClock.textContent=S.settings.clockHz+' Hz';
  tb.appendChild(sl);tb.appendChild(hudClock);
  sep();
  mk('＋',()=>zoomAt(1.25,CW/2,CH/2),'Zoom in');
  mk('－',()=>zoomAt(1/1.25,CW/2,CH/2),'Zoom out');
  mk('⌂',fitView,'Fit circuit');
  sep();
  menuBtn('Presets',presetMenu());
  menuBtn('File',fileMenu());
  mk('≋ Analyzer',toggleAnalyzer,'Logic analyzer');
  mk('Σ Truth',truthTableModal,'Truth table of marked subcircuit');
  mk('? Help',helpModal);
}
function menuBtn(name,items){
  const wrap=document.createElement('span');wrap.className='msel';$('#toolbar').appendChild(wrap);
  const b=document.createElement('button');b.textContent=name+' ▾';wrap.appendChild(b);
  const m=document.createElement('div');m.className='menu';wrap.appendChild(m);
  for(const it of items){if(it==='-'){const d=document.createElement('div');d.className='mh';m.appendChild(d);continue;}
    if(it.head){const d=document.createElement('div');d.className='mh';d.textContent=tOr(it.head);m.appendChild(d);continue;}
    const bi=document.createElement('button');bi.textContent=it.t;bi.onclick=()=>{m.classList.remove('open');it.fn();};m.appendChild(bi);}
  b.onclick=e=>{e.stopPropagation();m.classList.toggle('open');};
  document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))m.classList.remove('open');});
}
const tOr=x=>x;
function presetMenu(){return PRESETS.map(p=>({t:p.name,fn:()=>{loadPreset(p.id);toast('loaded '+p.name,'ok');}}));}
function fileMenu(){return[
  {head:'Projects'},{t:'Save / load…',fn:saveModal},
  {head:'Share'},
  {t:'Export JSON',fn:exportJSON},{t:'Import JSON',fn:importJSON},
  {t:'Copy share code (base64)',fn:shareCode},
  {t:'Load from share code',fn:shareLoad},
  {head:'Image'},
  {t:'Export PNG',fn:exportPNG},{t:'Export SVG',fn:exportSVG},
  {t:'Export waveform CSV',fn:exportCSV},{t:'Export VCD',fn:exportVCD}];}

/* ---------- palette ---------- */
function buildPalette(){
  const pal=$('#palette');pal.innerHTML='';
  const groups={};for(const t in CT){const g=CT[t].grp;(groups[g]=groups[g]||[]).push(t);}
  for(const g of['I/O','Gates','Comb','Seq']){
    const h=document.createElement('div');h.className='pg';h.textContent=g;pal.appendChild(h);
    for(const t of groups[g]||[]){const d=CT[t];
      const el=document.createElement('div');el.className='pi';el.dataset.type=t;
      el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label','Place '+d.label);
      el.innerHTML=`<span class="sw">${d.glyph}</span><span>${d.label}</span>`;
      el.title=d.help+'\nClick then click canvas to place.';
      el.onpointerdown=ev=>{ev.preventDefault();E.placeType=t;S.tool='select';
        $$('#toolbar [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool==='select'));
        toast('place '+d.label+' — click canvas (Esc to cancel)');};
      pal.appendChild(el);}
  }
}

/* ---------- inspector ---------- */
let sideTab='insp';
function setTab(t){sideTab=t;$$('#side .tabs button').forEach(b=>b.classList.remove('on'));
  ({insp:$('#tabInsp'),diag:$('#tabDiag'),set:$('#tabSet')})[t].classList.add('on');renderInspector();}
$('#tabInsp').onclick=()=>setTab('insp');$('#tabDiag').onclick=()=>setTab('diag');$('#tabSet').onclick=()=>setTab('set');
$('#sideToggle').onclick=()=>$('#side').classList.toggle('open');

function renderInspector(){
  const sb=$('#sideBody');
  if(sideTab==='set')return renderSettings(sb);
  if(sideTab==='diag')return renderDiag(sb);
  sb.innerHTML='';
  const cs=selComps();const wsel=[...S.sel].map(id=>S.wires.get(id)).filter(Boolean);
  if(cs.length===1)renderCompInsp(sb,cs[0]);
  else if(wsel.length===1&&!cs.length)renderWireInsp(sb,wsel[0]);
  else if(S.sel.size){sb.innerHTML=`<h4>${S.sel.size} items selected</h4>`;
    const b=document.createElement('button');b.textContent='Delete selection';b.className='danger';b.onclick=delSel;sb.appendChild(b);}
  else{sb.innerHTML=`<h4>Inspector</h4><div class="small">Select a component or wire.<br><br>
    Circuit: ${S.comps.size} components, ${S.wires.size} wires, ${S.netOf?S.netPins.size:0} nets, ${S.probes.length} probes.</div>`;}
}
function propRow(sb,label,el){const r=document.createElement('div');r.className='frow';
  const l=document.createElement('label');l.textContent=label;r.appendChild(l);r.appendChild(el);sb.appendChild(r);return el;}
function numIn(v,fn,min,max){const i=document.createElement('input');i.type='number';i.value=v;i.min=min;i.max=max;
  i.onchange=()=>{fn(clamp(+i.value||min,min,max));pushHist();afterStructEdit();};return i;}
function txtIn(v,fn){const i=document.createElement('input');i.type='text';i.value=v;i.onchange=()=>{fn(i.value);pushHist();};return i;}
function chk(v,fn){const i=document.createElement('input');i.type='checkbox';i.checked=v;i.onchange=()=>{fn(i.checked);pushHist();};return i;}
function selIn(opts,v,fn){const s=document.createElement('select');for(const[o,t]of opts){const op=document.createElement('option');op.value=o;op.textContent=t;s.appendChild(op);}
  s.value=v;s.onchange=()=>{fn(s.value);pushHist();afterStructEdit();};return s;}
function afterStructEdit(){rebuildNets();dirtyAll();settle();probesSample();}

function renderCompInsp(sb,c){
  const d=CT[c.type];
  const h=document.createElement('h4');h.textContent=(c.label?c.label+' · ':'')+d.label;sb.appendChild(h);
  const sm=document.createElement('div');sm.className='small';sm.textContent=d.help;sb.appendChild(sm);
  propRow(sb,'label',txtIn(c.label,v=>{c.label=v;}));
  const p=c.props;
  if('bits'in p)propRow(sb,'bit width',numIn(p.bits,v=>{p.bits=v;},1,16));
  if('n'in p){const opts=c.type==='mux'?[[2,'2'],[4,'4']]:[[2,'2'],[3,'3'],[4,'4'],[5,'5'],[6,'6']];
    propRow(sb,'inputs',selIn(opts,String(p.n),v=>p.n=+v));}
  if('val'in p)propRow(sb,'value',numIn(p.val,v=>p.val=v,0,(1<<(p.bits||1))-1));
  if('period'in p)propRow(sb,'period',numIn(p.period,v=>p.period=v,1,64));
  if('aw'in p)propRow(sb,'addr bits',numIn(p.aw,v=>{p.aw=v;c.state.mem=null;},1,8));
  if('parts'in p)propRow(sb,'parts',txtIn(p.parts.join(','),v=>{const a=v.split(',').map(x=>+x.trim()).filter(x=>x>0&&x<=16);if(a.length&&a.reduce((x,y)=>x+y,0)<=32)p.parts=a;}));
  if(c.type==='ram'){const ta=document.createElement('textarea');ta.className='jarea';ta.style.height='60px';
    ta.value=(c.state.mem||c.props.mem||[]).join(',');ta.title='Memory contents, comma-separated';
    ta.onchange=()=>{c.props.mem=ta.value.split(',').map(x=>parseInt(x.trim())||0);if(c.state.mem)c.props.mem.forEach((v,i)=>{if(i<c.state.mem.length)c.state.mem[i]=v&MASK(c.props.bits);});pushHist();settle();probesSample();};
    propRow(sb,'mem',ta);}
  if(c.type==='switch'&&c.props.bits>1)propRow(sb,'switch val',numIn(c.state.val||0,v=>{c.state.val=v;S.sim.dirty.add(c.id);settle();probesSample();},0,MASK(c.props.bits)));
  // pins table
  const h2=document.createElement('h4');h2.textContent='Pins';sb.appendChild(h2);
  const t=document.createElement('table');t.className='ptab';
  t.innerHTML='<tr><th>pin</th><th>dir</th><th>w</th><th>value</th><th></th></tr>';
  for(const pin of pinsOf(c)){const tr=document.createElement('tr');
    const v=pinVal(c.id,pin.name);
    tr.innerHTML=`<td>${pin.name}</td><td>${pin.dir}</td><td>${pin.w}</td><td class="${valCls(v)}">${fmtVal(v,pin.w)}</td>`;
    const td=document.createElement('td');const b=document.createElement('button');b.textContent='probe';b.style.padding='1px 6px';
    b.onclick=()=>addProbe(c.id,pin.name);td.appendChild(b);tr.appendChild(td);t.appendChild(tr);}
  sb.appendChild(t);
  // truth table marking
  const h3=document.createElement('h4');h3.textContent='Truth table';sb.appendChild(h3);
  if(['switch','button','const'].includes(c.type)){const r=document.createElement('div');r.className='chk';
    r.appendChild(chk(S.ttIns.has(c.id),v=>v?S.ttIns.add(c.id):S.ttIns.delete(c.id)));
    r.appendChild(document.createTextNode('TT input'));sb.appendChild(r);}
  const r2=document.createElement('div');r2.className='chk';
  r2.appendChild(chk(S.ttOuts.has(c.id),v=>v?S.ttOuts.add(c.id):S.ttOuts.delete(c.id)));
  r2.appendChild(document.createTextNode('TT output'));sb.appendChild(r2);
  const br=document.createElement('div');br.className='btnrow';sb.appendChild(br);
  const bd=document.createElement('button');bd.textContent='Delete';bd.className='danger';bd.onclick=delSel;br.appendChild(bd);
  const bu=document.createElement('button');bu.textContent='Duplicate';bu.onclick=dupSel;br.appendChild(bu);
}
function renderWireInsp(sb,w){
  const a=S.comps.get(w.a.c),b=S.comps.get(w.b.c);
  sb.innerHTML=`<h4>Wire</h4><div class="small">${a?a.label||CT[a.type].label:'?'} .${w.a.p} → ${b?b.label||CT[b.type].label:'?'} .${w.b.p}</div>`;
  const nk=S.netOf.get(w.b.c+'.'+w.b.p);const v=S.sim.netVal.get(nk);const pw=pinW(b,w.b.p);
  const dv=document.createElement('div');dv.innerHTML=`<h4>Net value</h4><div style="font-size:20px" class="${valCls(v)}">${fmtVal(v,pw)}</div>
    <div class="small">net ${nk} · ${(S.netPins.get(nk)||[]).length} pins · state ${v?v.s:'z'}</div>`;sb.appendChild(dv);
  const br=document.createElement('div');br.className='btnrow';
  const bp=document.createElement('button');bp.textContent='Add probe';bp.onclick=()=>addProbe(w.b.c,w.b.p);br.appendChild(bp);
  const bd=document.createElement('button');bd.textContent='Delete';bd.className='danger';
  bd.onclick=()=>{S.wires.delete(w.id);S.sel.delete(w.id);rebuildNets();dirtyAll();settle();probesSample();pushHist();renderInspector();};br.appendChild(bd);
  sb.appendChild(br);
}

/* ---------- diagnostics tab ---------- */
function renderDiag(sb){
  sb.innerHTML='<h4>Diagnostics</h4>';
  const sim=S.sim;
  const rows=[['time (t)',sim.t],['tick',sim.tick],['events queued',sim.events.length],
    ['dirty queue',sim.dirty.size],['last settle iters',sim.lastIters],['edges fired',sim.edges],
    ['oscillation',sim.osc?'YES':'no'],['contention',sim.conflict?'YES':'no'],
    ['nets',S.netPins.size],['components',S.comps.size],['wires',S.wires.size]];
  const t=document.createElement('table');t.className='ptab';
  for(const[k,v]of rows){const tr=document.createElement('tr');tr.innerHTML=`<td>${k}</td><td>${v}</td>`;t.appendChild(tr);}
  sb.appendChild(t);
  const h=document.createElement('h4');h.textContent='Overlays';sb.appendChild(h);
  const ov=(k,l)=>{const r=document.createElement('div');r.className='chk';
    r.appendChild(chk(S.settings[k],v=>S.settings[k]=v));r.appendChild(document.createTextNode(l));sb.appendChild(r);};
  ov('ovOrder','eval order numbers');ov('ovFanout','fan-out counts');ov('ovBus','bus values on wires');
  ov('ovClock','clock-domain highlight');ov('ovLoops','loop/oscillation warnings');
  const h2=document.createElement('h4');h2.textContent='Last eval order';sb.appendChild(h2);
  const d=document.createElement('div');d.className='small';
  d.textContent=sim.evalOrder.slice(0,40).map((id,i)=>{const c=S.comps.get(id);return c?(c.label||CT[c.type].label):id;}).join(' → ')||'—';
  sb.appendChild(d);
  // loops: back-edges → nets driving a comp already evaluated upstream (approximation: comps in feedback)
  const h3=document.createElement('h4');h3.textContent='Feedback / loops';sb.appendChild(h3);
  const d3=document.createElement('div');d3.className='small';
  const fb=findLoops();d3.innerHTML=fb.length?fb.map(x=>'↻ '+x).join('<br>'):'no combinational loops';
  sb.appendChild(d3);
}
function findLoops(){
  // DFS on comp-graph (comp -> comps driven by its outputs)
  const adj=new Map();for(const w of S.wires.values()){
    if(!adj.has(w.a.c))adj.set(w.a.c,[]);adj.get(w.a.c).push(w.b.c);}
  const loops=new Set(),vis=new Set(),stk=new Set();
  function dfs(n,path){if(stk.has(n)){loops.add(path.slice(path.indexOf(n)).join('→')+'→'+n);return;}
    if(vis.has(n))return;vis.add(n);stk.add(n);
    for(const m of adj.get(n)||[])dfs(m,[...path,n]);stk.delete(n);}
  for(const id of S.comps.keys())dfs(id,[]);
  return[...loops].slice(0,8).map(s=>s.split('→').map(id=>{const c=S.comps.get(id);return c?(c.label||CT[c.type].label):id;}).join('→'));
}

/* ---------- settings tab ---------- */
function renderSettings(sb){
  sb.innerHTML='<h4>Simulation</h4>';
  propRow(sb,'clock Hz',numIn(S.settings.clockHz,v=>S.settings.clockHz=v,0.1,120));
  propRow(sb,'delay model',selIn([['none','zero delay'],['unit','unit delay']],S.settings.delay,v=>S.settings.delay=v));
  propRow(sb,'settle limit',numIn(S.settings.stepLimit,v=>S.settings.stepLimit=v,4,400));
  propRow(sb,'def bit width',numIn(S.settings.defBits,v=>S.settings.defBits=v,1,16));
  const h=document.createElement('h4');h.textContent='Editor';sb.appendChild(h);
  propRow(sb,'grid',selIn([[5,'5'],[10,'10'],[20,'20']],S.settings.grid,v=>S.settings.grid=+v));
  const r=document.createElement('div');r.className='chk';r.appendChild(chk(S.settings.snap,v=>S.settings.snap=v));
  r.appendChild(document.createTextNode('snap to grid'));sb.appendChild(r);
  propRow(sb,'wire style',selIn([['curved','curved'],['orth','orthogonal']],S.settings.wireStyle,v=>S.settings.wireStyle=v));
  propRow(sb,'radix',selIn([['hex','hex'],['dec','dec'],['bin','bin']],S.settings.radix,v=>S.settings.radix=v));
  propRow(sb,'theme',selIn([['dark','dark'],['light','light'],['cvd','high contrast (CB-safe)']],S.settings.theme,v=>{S.settings.theme=v;applyTheme();}));
  const r2=document.createElement('div');r2.className='chk';r2.appendChild(chk(S.settings.anim,v=>S.settings.anim=v));
  r2.appendChild(document.createTextNode('animated signal flow'));sb.appendChild(r2);
  const r3=document.createElement('div');r3.className='chk';r3.appendChild(chk(S.settings.minimap,v=>{S.settings.minimap=v;resize();}));
  r3.appendChild(document.createTextNode('minimap'));sb.appendChild(r3);
}
function applyTheme(){document.body.className=S.settings.theme==='dark'?'':S.settings.theme;}

/* ---------- HUD ---------- */
let fps=0,fc=0,ft=0;
function hud(){
  const sim=S.sim;
  const selV=selSignal();
  const warn=[];if(sim.osc)warn.push('OSC LOOP');if(sim.conflict)warn.push('CONTENTION');
  $('#hud').innerHTML=
    `fps ${fps} · comps ${S.comps.size} · wires ${S.wires.size} · nets ${S.netPins.size}\n`+
    `events ${sim.events.length} · dirty ${sim.dirty.size} · tick ${sim.tick} @ ${S.settings.clockHz}Hz · iters ${sim.lastIters}\n`+
    (selV?`sel ${selV}\n`:'')+
    `tool ${S.tool}${E.placeType?' (place '+E.placeType+')':''} · ${sim.running?'RUNNING':'paused'}`+
    (warn.length?`\n<span class="warn">⚠ ${warn.join(' · ')}</span>`:'');
}
function selSignal(){
  const cs=selComps();if(cs.length===1){const q=pinsOf(cs[0]).find(p=>p.dir==='out');
    if(q)return fmtVal(pinVal(cs[0].id,q.name),q.w);return'—';}
  const w=[...S.sel].map(id=>S.wires.get(id)).filter(Boolean);
  if(w.length===1){const v=S.sim.netVal.get(S.netOf.get(w[0].b.c+'.'+w[0].b.p));return fmtVal(v,pinW(S.comps.get(w[0].b.c),w[0].b.p));}
  return null;
}

/* ---------- analyzer ---------- */
const AN={open:false,zoom:1,off:0,hoverT:null};
function toggleAnalyzer(){AN.open=!AN.open;$('#analyzer').classList.toggle('show',AN.open);if(AN.open){renderAnalyzer();drawWave();}}
function renderAnalyzer(){
  const h=$('#anHead');h.innerHTML='';
  const t=document.createElement('span');t.className='t';t.textContent='Logic Analyzer';h.appendChild(t);
  const mk=(l,fn,title)=>{const b=document.createElement('button');b.textContent=l;b.title=title||'';b.onclick=fn;h.appendChild(b);};
  mk('＋ probe',()=>{const cs=selComps();const ws=[...S.sel].map(i=>S.wires.get(i)).filter(Boolean);
    if(cs.length){const p=pinsOf(cs[0]).find(p=>p.dir==='out')||pinsOf(cs[0])[0];addProbe(cs[0].id,p.name);}
    else if(ws.length)addProbe(ws[0].b.c,ws[0].b.p);else toast('select a wire or component first','err');});
  mk('zoom −',()=>{AN.zoom=Math.max(0.1,AN.zoom/1.5);drawWave();});
  mk('zoom ＋',()=>{AN.zoom=Math.min(64,AN.zoom*1.5);drawWave();});
  mk('⟵',()=>{AN.off=Math.max(0,AN.off-10*AN.zoom);drawWave();});
  mk('⟶',()=>{AN.off+=10*AN.zoom;drawWave();});
  mk('fit',()=>{const r=$('#waveWrap').getBoundingClientRect();
    const tMax=Math.max(4,S.sim.t+2);AN.zoom=clamp((r.width-16)/(tMax*4),0.05,64);AN.off=0;drawWave();});
  mk('CSV',exportCSV);mk('VCD',exportVCD);
  mk('✕',toggleAnalyzer);
  const n=$('#anNames');n.innerHTML='';
  for(const pr of S.probes){
    const r=document.createElement('div');r.className='pr';
    const nm=document.createElement('input');nm.type='text';nm.value=pr.name;nm.style.width='70px';
    nm.onchange=()=>{pr.name=nm.value;pushHist();};
    const v=netVal(pr.net);const vv=document.createElement('span');vv.className='val '+valCls(v);vv.textContent=fmtVal(v,probeW(pr));
    const del=document.createElement('button');del.textContent='✕';del.onclick=()=>{S.probes=S.probes.filter(x=>x!==pr);pushHist();renderAnalyzer();drawWave();};
    r.appendChild(nm);r.appendChild(vv);r.appendChild(del);n.appendChild(r);}
  $('#anStatus').textContent=`${S.probes.length} probes · t=${S.sim.t} · tick=${S.sim.tick} · scroll off=${AN.off} zoom=${AN.zoom.toFixed(2)} — click wire/comp → "probe" to add · click waveform to inspect`;
}
$('#wave').addEventListener('pointerdown',ev=>{
  const r=ev.target.getBoundingClientRect();
  const t=(ev.clientX-r.left-6)/(4*AN.zoom)+AN.off;
  const vals=S.probes.map(p=>{
    const s=p.samples.filter(x=>x.t<=t).pop();
    return p.name+'='+(s?(s.s==='ok'?fmtVal(s,p&&probeW(p)):s.s):'—');}).join('  ');
  $('#anStatus').textContent=`inspect t≈${t.toFixed(2)}:  ${vals}`;
});
function probeW(pr){const[cid,pn]=pr.ref.split('.');const c=S.comps.get(cid);return c?pinW(c,pn):1;}
function drawWave(){
  const wv=$('#wave');if(!wv||!AN.open)return;
  const r=$('#waveWrap').getBoundingClientRect();wv.width=r.width*DPR;wv.height=r.height*DPR;
  const g=wv.getContext('2d');const P=pal();g.setTransform(DPR,0,0,DPR,0,0);
  g.fillStyle=P.bg;g.fillRect(0,0,r.width,r.height);
  const pxT=x=>(x-AN.off)*4*AN.zoom+6;
  const tMax=S.sim.t+4;
  // tick grid
  g.strokeStyle=P.line;g.globalAlpha=.4;
  const tickStep=Math.max(1,Math.round(2/Math.max(0.001,S.settings.clockHz)));
  for(let t=Math.floor(AN.off);t<AN.off+r.width/(4*AN.zoom)+2;t++){
    g.beginPath();g.moveTo(pxT(t),0);g.lineTo(pxT(t),r.height);g.stroke();
    g.fillStyle=P.txt2;g.font='9px monospace';g.fillText(t,pxT(t)+2,10);}
  g.globalAlpha=1;
  const rowH=Math.min(52,(r.height-8)/Math.max(1,S.probes.length));
  S.probes.forEach((pr,i)=>{
    const y0=8+i*rowH,y1=y0+rowH-14,yb=y0+rowH-6;
    const w=probeW(pr);const multi=w>1;
    const samples=pr.samples;
    g.strokeStyle=P.line;g.beginPath();g.moveTo(0,yb);g.lineTo(r.width,yb);g.stroke();
    if(samples.length<1)return;
    let cur=null;
    for(let s=0;s<samples.length;s++){const sm=samples[s];const x=pxT(sm.t);
      const nx=s+1<samples.length?pxT(samples[s+1].t):r.width;
      const col=sm.s==='ok'?(multi?P.acc:(sm.v?P.w1:P.w0)):sm.s==='z'?P.wz:sm.s==='x'?P.wx:P.wosc;
      if(!multi){
        const yv=sm.s==='ok'?(sm.v?y0+4:y1-2):(y0+y1)/2;
        g.strokeStyle=col;g.lineWidth=1.6;
        if(cur!==null){g.beginPath();g.moveTo(x,cur.y);g.lineTo(x,yv);g.stroke();}
        g.beginPath();g.moveTo(x,yv);g.lineTo(nx,yv);g.stroke();
        cur={y:yv};
      }else{
        g.strokeStyle=col;g.lineWidth=1.4;
        g.beginPath();g.moveTo(x,y0+6);g.lineTo(x+3,y0+2);g.lineTo(nx-3,y0+2);g.lineTo(nx,y0+6);
        g.lineTo(nx-3,y1-4);g.lineTo(x+3,y1-4);g.lineTo(x,y0+6);g.stroke();
        if(nx-x>16){g.fillStyle=col;g.font='10px monospace';g.textAlign='center';
          g.fillText(fmtVal(sm,w),x+(nx-x)/2,(y0+y1)/2+2);g.textAlign='left';}
        cur=null;}
    }
    g.fillStyle=P.txt2;g.font='9px monospace';g.fillText(pr.name,4,y0+9);
  });
}
function exportCSV(){
  const times=[...new Set(S.probes.flatMap(p=>p.samples.map(s=>s.t)))].sort((a,b)=>a-b);
  const rows=['t,'+S.probes.map(p=>p.name).join(',')];
  for(const t of times){rows.push(t+','+S.probes.map(p=>{
    const s=p.samples.filter(x=>x.t<=t).pop();return s?(s.s==='ok'?s.v:s.s):'';}).join(','));}
  download('waveform.csv',rows.join('\n'),'text/csv');}
function exportVCD(){
  const L=['$date '+new Date().toISOString()+' $end','$timescale 1tick $end','$scope module top $end'];
  const ids=S.probes.map((p,i)=>String.fromCharCode(33+i));
  S.probes.forEach((p,i)=>L.push(`$var wire ${probeW(p)} ${ids[i]} ${p.name} $end`));
  L.push('$upscope $end','$enddefinitions $end');
  let lt=-1;const times=[...new Set(S.probes.flatMap(p=>p.samples.map(s=>s.t)))].sort((a,b)=>a-b);
  for(const t of times){L.push('#'+t);
    S.probes.forEach((p,i)=>{const s=p.samples.filter(x=>x.t<=t).pop();if(!s)return;
      const w=probeW(p);const v=s.s==='ok'?s.v.toString(2).padStart(w,'0'):s.s;
      L.push(w===1?v+ids[i]:'b'+v+' '+ids[i]);});}
  download('waveform.vcd',L.join('\n'),'text/plain');}
function download(name,content,type){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();}

/* ---------- truth table ---------- */
function truthTableModal(){
  const ins=[...S.ttIns].map(id=>S.comps.get(id)).filter(c=>c&&['switch','button','const'].includes(c.type));
  const outs=[...S.ttOuts].map(id=>S.comps.get(id)).filter(Boolean);
  if(!ins.length||!outs.length){toast('mark ≥1 TT input (switch/button/const) and ≥1 TT output','err');return;}
  const inBits=ins.reduce((a,c)=>a+c.props.bits,0);
  if(inBits>10){toast('too many input bits ('+inBits+'>10)','err');return;}
  const rows=Math.pow(2,inBits);
  const results=[],minTerms=outs.map(()=>[]);
  // save state
  const saved=ins.map(c=>({c,v:c.state.val,props:JSON.parse(JSON.stringify(c.props))}));
  for(let m=0;m<rows;m++){
    let bit=0;for(const c of ins){const w=c.props.bits;c.state.val=(m>>bit)&MASK(w);bit+=w;}
    dirtyAll();settle();
    const row={in:m,osc:S.sim.osc,outs:outs.map(c=>{
      const q=pinsOf(c).find(p=>p.dir==='out')||pinsOf(c)[0];const v=pinVal(c.id,q.name);
      return{v:v?v.v:0,s:v?v.s:'z'};})};
    if(!row.osc)outs.forEach((c,i)=>{const o=row.outs[i];if(o.s==='ok'&&o.v)minTerms[i].push(m);});
    results.push(row);}
  // restore
  saved.forEach(s=>{s.c.state.val=s.v;});dirtyAll();settle();probesSample();
  openModal('Truth table — '+rows+' rows',box=>{
    const d=document.createElement('div');d.className='ttlist';
    const t=document.createElement('table');t.className='tt';
    const hr=document.createElement('tr');
    ins.forEach((c,i)=>{const th=document.createElement('th');th.textContent=(c.label||'IN'+i);hr.appendChild(th);});
    outs.forEach((c,i)=>{const th=document.createElement('th');th.textContent=(c.label||'OUT'+i);hr.appendChild(th);});
    t.appendChild(hr);
    for(const r of results){const tr=document.createElement('tr');if(r.osc)tr.className='oscrow';
      let bit=0;ins.forEach(c=>{const td=document.createElement('td');const w=c.props.bits;
        td.textContent=((r.in>>bit)&MASK(w)).toString(2).padStart(w,'0');bit+=w;tr.appendChild(td);});
      r.outs.forEach(o=>{const td=document.createElement('td');td.className=o.s==='ok'?(o.v?'v1':'v0'):'vx';
        td.textContent=r.osc?'OSC':(o.s==='ok'?o.v:o.s);tr.appendChild(td);});
      t.appendChild(tr);}
    d.appendChild(t);box.appendChild(d);
    // simplified expressions
    const h=document.createElement('h4');h.textContent='Minimized expressions (QM, single-output bits)';box.appendChild(h);
    outs.forEach((c,i)=>{const dv=document.createElement('div');dv.className='small';
      const mt=minTerms[i];
      dv.textContent=(c.label||'OUT'+i)+' = Σm('+mt.join(',')+')'+(inBits<=6&&mt.length&&mt.length<rows?'  →  '+qmSOP(mt,inBits):'');
      box.appendChild(dv);});
  });
}

/* Quine-McCluskey (small n) → SOP string */
function qmSOP(mt,n){
  const terms=mt.map(m=>({bits:m.toString(2).padStart(n,'0'),used:false}));
  let primes=[];
  function combine(terms){
    const next=new Map(),used=new Set();
    for(let i=0;i<terms.length;i++)for(let j=i+1;j<terms.length;j++){
      const a=terms[i].bits,b=terms[j].bits;let diff=-1,cnt=0;
      for(let k=0;k<a.length;k++)if(a[k]!==b[k]){diff=k;cnt++;}
      if(cnt===1){const c=a.slice(0,diff)+'-'+a.slice(diff+1);next.set(c,true);used.add(i);used.add(j);}}
    terms.forEach((t,i)=>{if(!used.has(i))primes.push(t.bits);});
    if(next.size)combine([...next.keys()].map(k=>({bits:k})));
  }
  combine(terms);
  primes=[...new Set(primes)];
  if(!primes.length)return '0';
  // cover: prime -> minterms covered
  const covers=primes.map(p=>mt.filter(m=>{const b=m.toString(2).padStart(n,'0');
    return[...p].every((c,k)=>c==='-'||c===b[k]);}));
  const uncovered=new Set(mt);const chosen=[];
  while(uncovered.size){let best=-1,bi=-1;
    covers.forEach((c,i)=>{const cnt=c.filter(m=>uncovered.has(m)).length;
      if(cnt>best&&!chosen.includes(i)){best=cnt;bi=i;}});
    if(best<=0)break;chosen.push(bi);covers[bi].forEach(m=>uncovered.delete(m));}
  const vars='ABCDEFGH'.slice(0,n).split('');
  const term=p=>{const lits=[];[...p].forEach((c,k)=>{if(c==='1')lits.push(vars[k]);if(c==='0')lits.push(vars[k]+"'" );});return lits.length?lits.join('·'):'1';};
  return chosen.map(i=>term(primes[i])).join(' + ');
}

/* ---------- modals ---------- */
function openModal(title,fill,foot){
  closeModals();
  const m=document.createElement('div');m.className='modal open';
  const box=document.createElement('div');box.className='box';
  const h=document.createElement('div');h.className='mh2';
  h.innerHTML=`<span>${title}</span>`;const x=document.createElement('button');x.textContent='✕';x.onclick=closeModals;h.appendChild(x);
  const mb=document.createElement('div');mb.className='mb';fill(mb);
  box.appendChild(h);box.appendChild(mb);
  if(foot){const mf=document.createElement('div');mf.className='mf';foot(mf);box.appendChild(mf);}
  m.appendChild(box);$('#modalRoot').appendChild(m);
  m.addEventListener('pointerdown',e=>{if(e.target===m)closeModals();});
}
function closeModals(){$('#modalRoot').innerHTML='';}

function saveModal(){
  openModal('Projects',box=>{
    const r=document.createElement('div');r.className='frow';
    const nm=document.createElement('input');nm.type='text';nm.placeholder='project name';nm.value='untitled';
    const sv=document.createElement('button');sv.textContent='Save';
    sv.onclick=()=>{projSave(nm.value);toast('saved "'+nm.value+'"','ok');closeModals();};
    r.appendChild(nm);r.appendChild(sv);box.appendChild(r);
    const h=document.createElement('h4');h.textContent='Saved projects';box.appendChild(h);
    for(const n of projList()){const pr=document.createElement('div');pr.className='projrow';
      pr.innerHTML=`<span class="nm">${n}</span>`;
      const l=document.createElement('button');l.textContent='Load';l.onclick=()=>{projLoad(n);closeModals();toast('loaded '+n,'ok');renderInspector();};
      const d=document.createElement('button');d.textContent='✕';d.className='danger';
      d.onclick=()=>{localStorage.removeItem('dllab.proj.'+n);closeModals();saveModal();};
      pr.appendChild(l);pr.appendChild(d);box.appendChild(pr);}
  });
}
function helpModal(){
  openModal('Keyboard & usage',box=>{
    box.innerHTML=`<table id="helpBody">
    <tr><td>V / W / H</td><td>select / wire / pan tool</td></tr>
    <tr><td>click palette → canvas</td><td>place component (Shift = keep placing)</td></tr>
    <tr><td>drag pin → pin</td><td>connect wire (widths must match, out→in)</td></tr>
    <tr><td>click switch / button</td><td>toggle / momentary press</td></tr>
    <tr><td>drag empty / Shift-drag</td><td>marquee select</td></tr>
    <tr><td>Ctrl+C/V/D · Del · Ctrl+Z/Y · Ctrl+A</td><td>copy / paste / duplicate / delete / undo / redo / select all</td></tr>
    <tr><td>wheel / pinch</td><td>zoom · space-drag / pan tool pans</td></tr>
    <tr><td>right-click</td><td>context menu (probes, TT marks, wire ops)</td></tr>
    <tr><td>dbl-click comp</td><td>rename</td></tr>
    <tr><td>T / E / R / 0</td><td>step tick / step event / run-pause / reset</td></tr>
    <tr><td>Ctrl+S</td><td>save project</td></tr></table>
    <p class="small" style="margin-top:8px">Wire colors: gray=0, green=1, blue dashed=floating(Z), red=conflict/unknown(X), magenta dashed=oscillating. Mark TT inputs/outputs in the inspector, then use Σ Truth. Probes attach via right-click or the inspector probe buttons.</p>`;
  });
}
