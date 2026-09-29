/* ============================== IO / EXPORT ============================== */
function exportJSON(){download('circuit.logiclab.json',snapshot(),'application/json');}
function importJSON(){
  const f=document.createElement('input');f.type='file';f.accept='.json,application/json';
  f.onchange=()=>{const r=new FileReader();r.onload=()=>{try{
      const d=JSON.parse(r.result);validateCircuit(d);restore(d);pushHist();
      toast('imported '+d.comps.length+' comps','ok');renderInspector();
    }catch(e){toast('import failed: '+e.message,'err');}};r.readAsText(f.files[0]);};
  f.click();}
function shareCode(){
  const b=btoa(unescape(encodeURIComponent(snapshot())));
  openModal('Share code',box=>{
    const ta=document.createElement('textarea');ta.className='jarea';ta.value=b;ta.readOnly=true;
    box.appendChild(ta);
    const c=document.createElement('button');c.textContent='Copy';
    c.onclick=()=>{ta.select();document.execCommand('copy');navigator.clipboard&&navigator.clipboard.writeText(b).catch(()=>{});toast('copied');};
    box.appendChild(c);});
}
function shareLoad(){
  openModal('Load share code',box=>{
    const ta=document.createElement('textarea');ta.className='jarea';ta.placeholder='paste base64 share code…';box.appendChild(ta);
    const b=document.createElement('button');b.textContent='Load';
    b.onclick=()=>{try{const d=JSON.parse(decodeURIComponent(escape(atob(ta.value.trim()))));
      validateCircuit(d);restore(d);pushHist();closeModals();toast('loaded','ok');
      }catch(e){toast('bad share code: '+e.message,'err');}};
    box.appendChild(b);});
}

/* ---------- PNG ---------- */
function circBounds(){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const c of S.comps.values()){const s=CT[c.type].size(c);x0=Math.min(x0,c.x);y0=Math.min(y0,c.y);x1=Math.max(x1,c.x+s.w);y1=Math.max(y1,c.y+s.h);}
  for(const w of S.wires.values())for(const p of wirePts(w)){x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);}
  return{x0,y0,x1:x1+30,y1:y1+30,x0:x0-30,y0:y0-30};}
function exportPNG(){
  const b=circBounds();const w=b.x1-b.x0,h=b.y1-b.y0,sc=2;
  const oc=document.createElement('canvas');oc.width=w*sc;oc.height=h*sc;
  const g=oc.getContext('2d');const P=pal();
  g.fillStyle=P.bg;g.fillRect(0,0,oc.width,oc.height);
  g.scale(sc,sc);g.translate(-b.x0,-b.y0);
  for(const w of S.wires.values())drawWireCtx(g,w,P);
  for(const c of S.comps.values())drawCompCtx(g,c,P);
  oc.toBlob(bl=>{const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='circuit.png';a.click();});
}
function drawWireCtx(g,w,P){const pts=wirePts(w);if(pts.length<2)return;
  const nk=S.netOf.get(w.b.c+'.'+w.b.p);const v=S.sim.netVal.get(nk);
  g.strokeStyle=netColor(v,P);g.lineWidth=2.2*(pinW(S.comps.get(w.b.c),w.b.p)>1?1.6:1);
  if(v&&(v.s==='z'||v.s==='osc'))g.setLineDash([5,5]);
  g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.stroke();g.setLineDash([]);}
function drawCompCtx(g,c,P){
  const d=CT[c.type],sz=d.size(c),pins=pinsOf(c);
  g.fillStyle=P.panel;g.strokeStyle=P.line;g.lineWidth=1.4;
  g.beginPath();g.roundRect(c.x,c.y,sz.w,sz.h,7);g.fill();g.stroke();
  g.fillStyle=P.txt2;g.font=`bold ${Math.min(16,sz.h*0.32)}px monospace`;g.textAlign='center';
  g.fillText(d.glyph,c.x+sz.w/2,c.y+sz.h*0.38);
  g.fillStyle=P.txt;g.font='10px monospace';
  if(c.type==='display'){const v=pinVal(c.id,'D');g.fillStyle='#000';g.fillRect(c.x+7,c.y+12,sz.w-14,sz.h-20);
    g.fillStyle='#7CFC00';g.font=`bold ${sz.h*0.4}px monospace`;g.fillText(ok(v)?v.v.toString(16).toUpperCase():'X',c.x+sz.w/2,c.y+sz.h*0.66);}
  else if(c.state.q!==undefined||c.type==='led'){}
  if(c.type==='led'){const v=pinVal(c.id,'D');g.fillStyle=ok(v)&&v.v?P.w1:P.w0;
    g.beginPath();g.arc(c.x+sz.w/2,c.y+sz.h*0.62,6,0,7);g.fill();}
  g.fillStyle=P.txt2;g.font='10px monospace';g.textAlign='left';
  g.fillText(c.label||d.label,c.x+2,c.y-5);
  for(const p of pins){const a=pinAbs(c,p);const v=pinVal(c.id,p.name);
    g.fillStyle=netColor(v,P);g.beginPath();g.arc(a.x,a.y,3.6,0,7);g.fill();}
}

/* ---------- SVG ---------- */
function exportSVG(){
  const b=circBounds();const P=pal();
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x0} ${b.y0} ${b.x1-b.x0} ${b.y1-b.y0}" font-family="monospace">`;
  s+=`<rect x="${b.x0}" y="${b.y0}" width="${b.x1-b.x0}" height="${b.y1-b.y0}" fill="${P.bg}"/>`;
  for(const w of S.wires.values()){const pts=wirePts(w);if(pts.length<2)continue;
    const nk=S.netOf.get(w.b.c+'.'+w.b.p);const v=S.sim.netVal.get(nk);
    s+=`<polyline points="${pts.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="${netColor(v,P)}" stroke-width="2" ${v&&v.s!=='ok'?'stroke-dasharray="5 5"':''}/>`;}
  for(const c of S.comps.values()){const d=CT[c.type],sz=d.size(c);
    s+=`<g><rect x="${c.x}" y="${c.y}" width="${sz.w}" height="${sz.h}" rx="7" fill="${P.panel}" stroke="${P.line}"/>`;
    s+=`<text x="${c.x+sz.w/2}" y="${c.y+sz.h*0.4}" fill="${P.txt2}" font-size="14" font-weight="bold" text-anchor="middle">${esc(d.glyph)}</text>`;
    s+=`<text x="${c.x+2}" y="${c.y-5}" fill="${P.txt2}" font-size="10">${esc(c.label||d.label)}</text>`;
    for(const p of pinsOf(c)){const a=pinAbs(c,p);const v=pinVal(c.id,p.name);
      s+=`<circle cx="${a.x}" cy="${a.y}" r="3.5" fill="${netColor(v,P)}"/>`;}
    s+='</g>';}
  s+='</svg>';download('circuit.svg',s,'image/svg+xml');}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

/* ============================== RUN / LOOP ============================== */
function startRun(){S.sim.running=true;S.sim._last=0;S.sim._acc=0;
  $('#btnRun').classList.add('on');$('#btnPause').classList.remove('on');}
function pauseRun(){S.sim.running=false;$('#btnRun').classList.remove('on');}

let _lastHud=0,_lastWave=0;
function frame(now){
  runFrame(now);draw();
  if(AN.open&&now-_lastWave>200){drawWave();_lastWave=now;}
  if(now-_lastHud>140){hud();_lastHud=now;
    if(now-ft2>500){fps=Math.round(fc2*1000/(now-ft2));fc2=0;ft2=now;}}
  fc2++;requestAnimationFrame(frame);}
let fc2=0,ft2=0;

/* ============================== BOOT ============================== */
function boot(){
  try{const st=JSON.parse(localStorage.getItem('dllab.settings')||'null');
    if(st&&typeof st==='object')Object.assign(S.settings,st);}catch(e){}
  buildToolbar();buildPalette();applyTheme();resize();
  setTool('select');
  const saved=localStorage.getItem('dllab.autosave');
  if(saved){try{const d=JSON.parse(saved);validateCircuit(d);restore(d);pushHist();}
    catch(e){loadPreset('welcome-switch-and-led');}}
  else loadPreset('welcome-switch-and-led');
  renderInspector();renderAnalyzer();
  window.LAB={S,CT,settle,simReset,stepEvent,stepTick,netVal,netOfPin,pinVal,pinsOf,
    w2s,s2w,probesSample,loadPreset,pushHist,snapshot,restore,fitView,
    screenOf:(cid,pn)=>{const c=S.comps.get(cid);const p=pinsOf(c).find(x=>x.name===pn);
      const a=pinAbs(c,p);const r=cv.getBoundingClientRect();const s=w2s(a.x,a.y);return{x:s.x+r.left,y:s.y+r.top};}};
  requestAnimationFrame(frame);
}
try{boot();}catch(e){window.__bootErr=e.stack||e.message;console.error('BOOT FAIL',e);}
