// ================= lines buffer =================
const lineBuf=new Float32Array(65536*7);
let lineN=0;
function lineReset(){lineN=0;}
function lineSeg(x1,y1,z1,x2,y2,z2,r,g,b,a){
  if(lineN+2>65536)return;
  const o=lineN*7;
  lineBuf[o]=x1;lineBuf[o+1]=y1;lineBuf[o+2]=z1;lineBuf[o+3]=r;lineBuf[o+4]=g;lineBuf[o+5]=b;lineBuf[o+6]=a;
  lineBuf[o+7]=x2;lineBuf[o+8]=y2;lineBuf[o+9]=z2;lineBuf[o+10]=r;lineBuf[o+11]=g;lineBuf[o+12]=b;lineBuf[o+13]=a;
  lineN+=2;}
function linesFlush(additive){
  if(!lineN)return;
  gl.useProgram(PROG.line);gl.bindVertexArray(lineVAO);
  gl.bindBuffer(gl.ARRAY_BUFFER,lineVBO);
  gl.bufferSubData(gl.ARRAY_BUFFER,0,lineBuf.subarray(0,lineN*7));
  gl.uniformMatrix4fv(U(PROG.line,'uVP'),false,m4mul(projM,viewM));
  gl.uniform1f(U(PROG.line,'uExp'),P.exposure);
  if(additive){gl.blendFunc(gl.ONE,gl.ONE);}else{gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}
  gl.enable(gl.BLEND);gl.depthMask(false);
  gl.drawArrays(gl.LINES,0,lineN);
  gl.depthMask(true);gl.disable(gl.BLEND);gl.bindVertexArray(null);}

// ================= audio =================
let AC=null;
function ensureAudio(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(AC&&AC.state==='suspended')AC.resume();}
function thunder(vol){
  if(!AC||!P.audio)return;
  const dur=1.8+Math.random()*1.4,n=AC.sampleRate*dur;
  const buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);
  let v=0;
  for(let i=0;i<n;i++){const t=i/n;
    const env=Math.exp(-t*3.2)*(0.6+0.4*Math.sin(t*30))*Math.min(1,t*30);
    v=v*0.965+(Math.random()*2-1)*0.035;
    d[i]=v*env*22*(0.7+0.3*Math.sin(t*50+t*t*200));}
  const src=AC.createBufferSource();src.buffer=buf;
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=160+vol*120;
  const g=AC.createGain();g.gain.value=vol*0.5;
  src.connect(f);f.connect(g);g.connect(AC.destination);src.start();}

// ================= UI =================
const panel=$('panel');
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function sliderRow(id,label,min,max,step,fmt){
  const r=el('div','row');const l=el('label','',label);l.title=id;
  const inp=document.createElement('input');inp.type='range';inp.min=min;inp.max=max;inp.step=step;inp.id='sl-'+id;
  const v=el('span','val');
  const upd=()=>{v.textContent=fmt?fmt(P[id]):(+P[id]).toPrecision(3);};
  inp.value=P[id];upd();
  inp.oninput=()=>{P[id]=+inp.value;upd();onParam(id);};
  r.append(l,inp,v);r._refresh=()=>{inp.value=P[id];upd();};
  return r;}
function selectRow(id,label,opts){
  const r=el('div','row');const l=el('label','',label);
  const s=document.createElement('select');s.id='sl-'+id;
  for(const o of opts){const op=document.createElement('option');op.value=o[0];op.textContent=o[1];s.appendChild(op);}
  s.value=P[id];s.onchange=()=>{P[id]=isNaN(+s.value)?s.value:+s.value;onParam(id);};
  r.append(l,s);r._refresh=()=>{s.value=P[id];};
  return r;}
function onParam(id){
  if(id==='nx'||id==='nz'||id==='nl')reinit();
  if(id==='viz'&&mapModeAuto)drawMap();
  saveSettings();
}
const rows={};function reg(id,row){rows[id]=row;return row;}
function refreshPanel(){for(const k in rows)if(rows[k]._refresh)rows[k]._refresh();
  document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===P.tool));}

const TOOLS=[['camera','🎥 Cam'],['probe','📍 Probe'],['heat','🔥 Heat'],['cool','❄ Cool'],
  ['moist','💧 Moist'],['dry','🏜 Dry'],['wind','💨 Wind'],['press','🌀 LowP'],
  ['seed','☁ Seed'],['raise','⛰ Raise'],['lower','🕳 Lower'],['surf','🖌 Surface'],
  ['bolt','⚡ Bolt']];
const SURF_NAMES=['land','ocean','forest','city','snow','sand'];

function buildPanel(){
  panel.innerHTML='';
  panel.appendChild(el('h1','','⛈ STORM LAB 3D'));
  // --- run ---
  let d=el('details');d.open=true;d.append(el('summary','','Run'));
  let b=el('div','body');
  const br=el('div','btnrow');
  const pb=el('button','','⏸ Pause');pb.id='btnPause';
  pb.onclick=()=>{P.pause=!P.pause;syncPauseBtn();};
  const sb=el('button','','⏭ Step');sb.onclick=()=>{P.pause=true;syncPauseBtn();for(let s=0;s<P.substeps;s++)stepSim(P.dt);};
  const rb=el('button','','↺ Reset');rb.onclick=()=>{RNG=mulberry32(P.seed);applyPreset(activePreset);};
  br.append(pb,sb,rb);b.appendChild(br);
  b.appendChild(reg('seed',sliderRow('seed','Deterministic seed',1,99999,1,v=>v|0)));
  b.appendChild(el('div','hint','Pause: Space · Step: . · tools act on the terrain below the pointer'));
  d.append(b);panel.appendChild(d);
  // --- preset ---
  d=el('details');d.open=true;d.append(el('summary','','Scenario preset'));
  b=el('div','body');
  const ps=document.createElement('select');ps.id='presetSel';
  for(const k in PRESETS){const o=document.createElement('option');o.value=k;o.textContent=PRESETS[k].name;ps.appendChild(o);}
  ps.value=activePreset;ps.onchange=()=>{RNG=mulberry32(P.seed);applyPreset(ps.value);refreshPanel();};
  b.appendChild(ps);d.append(b);panel.appendChild(d);
  // --- camera ---
  d=el('details');d.append(el('summary','','Camera'));
  b=el('div','body');
  const cr=el('div','btnrow');
  for(const k in CAM_PRESETS){const bt=el('button','',k);bt.onclick=()=>{CAM_PRESETS[k]();P.camPreset=k;};cr.appendChild(bt);}
  b.appendChild(cr);
  b.appendChild(el('div','hint','L-drag orbit · R/M-drag pan · wheel zoom · fly: WASD+QE, drag look'));
  b.appendChild(reg('flySpeed',sliderRow('flySpeed','Fly speed',2,30,1)));
  d.append(b);panel.appendChild(d);
  // --- tools ---
  d=el('details');d.open=true;d.append(el('summary','','Intervention tools'));
  b=el('div','body');
  const tg=el('div','toolgrid');
  for(const [k,n] of TOOLS){const bt=el('button','',n);bt.dataset.tool=k;
    bt.onclick=()=>{P.tool=k;refreshPanel();};tg.appendChild(bt);}
  b.appendChild(tg);
  b.appendChild(reg('brushRadius',sliderRow('brushRadius','Brush radius',1,15,0.5)));
  b.appendChild(reg('brushStrength',sliderRow('brushStrength','Brush strength',-2,2,0.05)));
  const sr=el('div','row');sr.appendChild(el('label','','Surface paint'));
  const ss=document.createElement('select');for(const s2 of SURF_NAMES){const o=document.createElement('option');o.value=s2;o.textContent=s2;ss.appendChild(o);}
  ss.value=P.surfPaint;ss.onchange=()=>{P.surfPaint=ss.value;};
  sr.appendChild(ss);b.appendChild(sr);
  b.appendChild(el('div','hint','Negative strength inverts tools (heat→cool, raise→lower, LowP→HighP).'));
  d.append(b);panel.appendChild(d);
  // --- viz ---
  d=el('details');d.open=true;d.append(el('summary','','Visualization'));
  b=el('div','body');
  b.appendChild(reg('viz',selectRow('viz','Field',Object.keys(VIZ).map(k=>[k,VIZ[k].label]))));
  b.appendChild(reg('mapLayer',sliderRow('mapLayer','Sample layer',0,NL-1,1,v=>v|0)));
  const chk=(id,label)=>{const r=el('div','row');const l=el('label','',label);
    const c=document.createElement('input');c.type='checkbox';c.checked=P[id];
    c.onchange=()=>{P[id]=c.checked;saveSettings();};r.append(l,c);return r;};
  b.appendChild(chk('arrows','Vector arrows'));
  b.appendChild(chk('streamlines','Wind streaks'));
  b.appendChild(chk('sliceOn','Vertical slice'));
  b.appendChild(reg('sliceAxis',selectRow('sliceAxis','Slice axis',[['z','along X'],['x','along Z']])));
  b.appendChild(reg('slicePos',sliderRow('slicePos','Slice position',0,1,0.01)));
  d.append(b);panel.appendChild(d);
  // --- sim params ---
  d=el('details');d.append(el('summary','','Simulation'));
  b=el('div','body');
  b.appendChild(reg('nx',selectRow('nx','Resolution X',[[32,'32'],[48,'48'],[64,'64'],[96,'96'],[128,'128']])));
  b.appendChild(reg('nz',selectRow('nz','Resolution Z',[[32,'32'],[48,'48'],[64,'64'],[96,'96'],[128,'128']])));
  b.appendChild(reg('nl',selectRow('nl','Vertical layers',[[8,'8'],[12,'12'],[16,'16'],[20,'20'],[24,'24']])));
  b.appendChild(reg('dt',sliderRow('dt','Timestep',0.1,2.5,0.05)));
  b.appendChild(reg('substeps',sliderRow('substeps','Substeps/frame',1,8,1,v=>v|0)));
  b.appendChild(reg('simSpeed',sliderRow('simSpeed','Sim speed ×',0.25,4,0.25)));
  b.appendChild(reg('windBase',sliderRow('windBase','Wind strength',-16,16,0.25)));
  b.appendChild(reg('coriolis',sliderRow('coriolis','Coriolis',0,2.5,0.05)));
  b.appendChild(reg('lapseRate',sliderRow('lapseRate','Lapse rate',0,1.6,0.02)));
  b.appendChild(reg('baseRH',sliderRow('baseRH','Base humidity',0.1,1.05,0.01)));
  b.appendChild(reg('evap',sliderRow('evap','Evaporation',0,3,0.05)));
  b.appendChild(reg('condThresh',sliderRow('condThresh','Condensation thr.',0.3,1.4,0.02)));
  b.appendChild(reg('precipRate',sliderRow('precipRate','Precip rate',0,2,0.02)));
  b.appendChild(reg('buoyancy',sliderRow('buoyancy','Buoyancy',0,3,0.05)));
  b.appendChild(reg('diffusion',sliderRow('diffusion','Diffusion',0,2,0.02)));
  b.appendChild(reg('terrainInfluence',sliderRow('terrainInfluence','Terrain influence',0,2,0.05)));
  b.appendChild(reg('lightningProb',sliderRow('lightningProb','Lightning prob.',0,1.5,0.02)));
  b.appendChild(reg('solar',sliderRow('solar','Solar heating',0,2,0.05)));
  const w=el('div','');w.id='warn';b.appendChild(w);
  d.append(b);panel.appendChild(d);
  // --- render ---
  d=el('details');d.append(el('summary','','Rendering'));
  b=el('div','body');
  b.appendChild(reg('renderScale',sliderRow('renderScale','Render resolution',0.35,2,0.05)));
  b.appendChild(reg('cloudQuality',sliderRow('cloudQuality','Cloud quality',0.05,1,0.05)));
  b.appendChild(reg('precipDensity',sliderRow('precipDensity','Precip density',0,2,0.05)));
  b.appendChild(reg('exposure',sliderRow('exposure','Exposure',0.3,2.5,0.05)));
  b.appendChild(reg('timeOfDay',sliderRow('timeOfDay','Time of day',0,24,0.1,v=>(+v).toFixed(1)+'h')));
  b.appendChild(chk('adaptive','Adaptive quality'));
  b.appendChild(chk('audio','Thunder audio'));
  d.append(b);panel.appendChild(d);
  // --- file ---
  d=el('details');d.append(el('summary','','File / Export'));
  b=el('div','body');
  const fr=el('div','btnrow');
  const sv=el('button','','💾 Save state');sv.onclick=saveState;
  const ld=el('button','','📂 Load');ld.onclick=()=>$('loadFile').click();
  const lf=document.createElement('input');lf.type='file';lf.id='loadFile';lf.accept='.json';lf.style.display='none';
  lf.onchange=()=>{if(lf.files[0])lf.files[0].text().then(t=>loadState(t));lf.value='';};
  const csv=el('button','','📄 Probe CSV');csv.onclick=exportCSV;
  const png=el('button','','🖼 PNG');png.onclick=exportPNG;
  fr.append(sv,ld,csv,png,lf);b.appendChild(fr);
  d.append(b);panel.appendChild(d);
  syncPauseBtn();
}
function syncPauseBtn(){const b=$('btnPause');b.textContent=P.pause?'▶ Resume':'⏸ Pause';b.classList.toggle('on',P.pause);}

// ================= brushes =================
let pointer={down:false,b:0,moved:0,lx:0,ly:0,lPick:null};
function applyBrush(gx,gz,dirX,dirZ){
  const r=P.brushRadius,s=P.brushStrength;
  const i0=Math.max(0,(gx-r)|0),i1=Math.min(NX-1,Math.ceil(gx+r));
  const j0=Math.max(0,(gz-r)|0),j1=Math.min(NZ-1,Math.ceil(gz+r));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const dd=Math.hypot(i-gx,j-gz);if(dd>r)continue;
    const f=Math.exp(-dd*dd/(r*r*0.4))*s;
    const c=ID2(i,j),kg=KG[c];
    switch(P.tool){
      case 'heat':for(let k=kg;k<Math.min(kg+4,NL);k++)F.tp[IDX(i,j,k)]+=f*3.0*Math.exp(-(k-kg)*0.4);break;
      case 'cool':for(let k=kg;k<Math.min(kg+4,NL);k++)F.tp[IDX(i,j,k)]-=f*3.0*Math.exp(-(k-kg)*0.4);break;
      case 'moist':for(let k=kg;k<Math.min(kg+4,NL);k++)F.qv[IDX(i,j,k)]+=f*1.2;break;
      case 'dry':for(let k=kg;k<NL;k++){const id=IDX(i,j,k);F.qv[id]*=Math.max(0,1-f*0.3);F.qc[id]*=Math.max(0,1-f*0.3);}break;
      case 'wind':{
        const dx=dirX!=null?dirX:1,dz=dirZ!=null?dirZ:0;
        for(let k=kg;k<Math.min(kg+5,NL);k++){const id=IDX(i,j,k);F.u[id]+=dx*f*4;F.v[id]+=dz*f*4;}break;}
      case 'press':for(let k=kg;k<NL;k++)F.p[IDX(i,j,k)]-=f*4;break;
      case 'seed':for(let k=kg+1;k<Math.min(kg+6,NL);k++)F.qc[IDX(i,j,k)]+=f*0.8;break;
      case 'raise':Ht[c]+=f*0.3;break;
      case 'lower':Ht[c]-=f*0.3;break;
      case 'surf':{
        const t=SURF_NAMES.indexOf(P.surfPaint);if(t<0)break;
        Sur[c]=t;
        if(t===1)Ht[c]=Math.min(Ht[c],WORLD.sea-0.4);
        else if(Ht[c]<WORLD.sea)Ht[c]=WORLD.sea+0.35;
        if(t===1)Wet[c]=2;
        break;}
      case 'bolt':break;
    }}
  if(P.tool==='raise'||P.tool==='lower'||P.tool==='surf'){recomputeKG();uploadH();uploadSurf();}
  if(P.tool==='moist'||P.tool==='dry')uploadWet();
}
let brushDir=null,brushHold=null;
canvas.addEventListener('pointerdown',e=>{
  ensureAudio();
  pointer.down=true;pointer.b=e.button;pointer.moved=0;pointer.lx=e.clientX;pointer.ly=e.clientY;
  canvas.setPointerCapture(e.pointerId);
  if(e.button===0&&P.tool==='bolt'){const g=pickGround(e.clientX,e.clientY);if(g)strikeAt(g.i,g.j,1.2);pointer.down=false;}
  if(e.button===0&&P.tool!=='camera'&&P.tool!=='probe'&&P.tool!=='bolt'){
    const g=pickGround(e.clientX,e.clientY);
    if(g){pointer.lPick=g;brushHold=g;applyBrush(g.i,g.j,null,null);}
  }
});
canvas.addEventListener('pointermove',e=>{
  const dx=e.clientX-pointer.lx,dy=e.clientY-pointer.ly;
  if(pointer.down)pointer.moved+=Math.abs(dx)+Math.abs(dy);
  pointer.lx=e.clientX;pointer.ly=e.clientY;
  if(!pointer.down)return;
  const camTool=P.tool==='camera'||P.tool==='probe';
  if(pointer.b===0&&(camTool&&cam.mode==='orbit')){cam.yaw-=dx*0.008;cam.pitch+=dy*0.008;}
  else if(pointer.b===0&&camTool&&cam.mode==='fly'){cam.fyaw-=dx*0.006;cam.fpitch-=dy*0.006;cam.fpitch=clamp(cam.fpitch,-1.5,1.5);}
  else if(pointer.b===1||pointer.b===2){
    const sc=cam.dist*0.0016;
    const fwd=cam.mode==='fly'?camDir():norm3([cam.tgt[0]-camPos[0],0,cam.tgt[2]-camPos[2]]);
    const rgt=[fwd[2],0,-fwd[0]];
    if(cam.mode==='fly'){cam.pos[0]+=(-rgt[0]*dx-fwd[0]*dy)*sc;cam.pos[2]+=(-rgt[2]*dx-fwd[2]*dy)*sc;}
    else{cam.tgt[0]+=(-rgt[0]*dx-fwd[0]*dy)*sc;cam.tgt[2]+=(-rgt[2]*dx-fwd[2]*dy)*sc;}
  }
  else if(pointer.b===0&&!camTool&&P.tool!=='bolt'){
    const g=pickGround(e.clientX,e.clientY);
    if(g){
      let dxw=null,dzw=null;
      if(pointer.lPick){dxw=g.x-pointer.lPick.x;dzw=g.z-pointer.lPick.z;
        const l=Math.hypot(dxw,dzw);if(l>0.01){dxw/=l;dzw/=l;}else{dxw=null;}}
      applyBrush(g.i,g.j,dxw,dzw);pointer.lPick=g;brushHold=g;brushHold.dx=dxw;brushHold.dz=dzw;}
  }
});
canvas.addEventListener('pointerup',e=>{
  if(pointer.b===0&&P.tool==='probe'&&pointer.moved<6){
    const g=pickGround(e.clientX,e.clientY);
    if(g)addProbe(g.i,g.j);}
  pointer.down=false;pointer.lPick=null;brushHold=null;});
canvas.addEventListener('pointercancel',()=>{pointer.down=false;pointer.lPick=null;brushHold=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();
  if(cam.mode==='fly')cam.speed=clamp(cam.speed*(e.deltaY>0?0.9:1.12),1,60);
  else cam.dist=clamp(cam.dist*(e.deltaY>0?1.11:0.9),6,240);
},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const keys={};
window.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
  keys[e.key.toLowerCase()]=true;
  if(e.key===' '){e.preventDefault();P.pause=!P.pause;syncPauseBtn();}
  if(e.key==='.'){P.pause=true;syncPauseBtn();for(let s=0;s<P.substeps;s++)stepSim(P.dt);}});
window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
$('panelToggle').onclick=()=>{panel.classList.toggle('open');
  document.body.classList.toggle('panelopen',panel.classList.contains('open'));};
document.body.classList.toggle('panelopen',panel.classList.contains('open'));

// ================= probes =================
let probeSeq=0;
function addProbe(i,j){
  probes.push({i,j,id:++probeSeq,hist:[]});
  if(probes.length>6)probes.shift();
  refreshProbeUI();}
function probeSample(pr){
  const i=clamp(pr.i|0,0,NX-1),j=clamp(pr.j|0,0,NZ-1),c=ID2(i,j),kg=KG[c];
  const id=IDX(i,j,Math.min(kg,NL-1));
  let colQ=0,mUp=0;
  for(let k=kg;k<NL;k++){colQ+=F.qc[IDX(i,j,k)]+F.qr[IDX(i,j,k)];if(F.w[IDX(i,j,k)]>mUp)mUp=F.w[IDX(i,j,k)];}
  return{t:simTime,T:tbase(kg)+F.tp[id],RH:RHof(kg,F.tp[id],F.qv[id])*100,
    p:F.p[id],ws:Math.hypot(F.u[id],F.v[id]),qc:colQ,rr:Rain2[c],w:mUp};}
function refreshProbeUI(){
  const pp=$('probePanel');
  if(!probes.length){pp.classList.remove('open');return;}
  pp.classList.add('open');
  pp.innerHTML='<b style="color:var(--acc)">Probes</b> <span class="hint">(click map/terrain with Probe tool)</span>';
  for(const pr of probes){
    const s=probeSample(pr);
    const dv=el('div','',`#${pr.id} @(${pr.i|0},${pr.j|0})  T=${s.T.toFixed(1)}° RH=${s.RH.toFixed(0)}% p=${s.p.toFixed(1)} wnd=${s.ws.toFixed(1)} w↑=${s.w.toFixed(1)} qc=${s.qc.toFixed(2)} rr=${s.rr.toFixed(2)}`);
    dv.style.cssText='font-size:10px;margin:3px 0;color:var(--txt)';
    pp.appendChild(dv);}
  const cv=document.createElement('canvas');cv.width=270;cv.height=90;cv.id='probeCv';
  pp.appendChild(cv);}
function drawProbeCv(){
  const cv=$('probeCv');if(!cv)return;const ctx=cv.getContext('2d');
  ctx.fillStyle='#0a0f16';ctx.fillRect(0,0,270,90);
  const pr=probes[probes.length-1];if(!pr||pr.hist.length<2)return;
  const h=pr.hist,n=h.length;
  const series=[['T',h.map(s=>s.T),0,30,'#ffd54f'],['RH',h.map(s=>s.RH),0,100,'#4fc3f7'],
    ['qc',h.map(s=>s.qc),0,4,'#eeeeee'],['rr',h.map(s=>s.rr),0,3,'#81c784']];
  for(const [nm,vals,lo,hi,col] of series){
    ctx.strokeStyle=col;ctx.beginPath();
    vals.forEach((v,x)=>{const px=4+x/(Math.max(n-1,1))*262,py=85-((v-lo)/(hi-lo))*80;
      x?ctx.lineTo(px,py):ctx.moveTo(px,py);});
    ctx.stroke();}
  ctx.fillStyle='#6d8093';ctx.font='9px monospace';
  ctx.fillText('probe #'+pr.id+' history (T=yellow RH=blue qc=white rain=green)',4,10);}
function exportCSV(){
  if(!probes.length){toast('No probes placed');return;}
  let csv='probe,t,T,RH,p,wind,w,qc,rainrate\n';
  for(const pr of probes)for(const s of pr.hist)
    csv+=`${pr.id},${s.t.toFixed(2)},${s.T.toFixed(3)},${s.RH.toFixed(2)},${s.p.toFixed(3)},${s.ws.toFixed(3)},${s.w.toFixed(3)},${s.qc.toFixed(4)},${s.rr.toFixed(4)}\n`;
  download('stormlab-probes.csv',new Blob([csv],{type:'text/csv'}));}

// ================= map canvas =================
const mapCv=$('map'),mapCtx=mapCv.getContext('2d');
const mapImg=mapCtx.createImageData(200,200);
let mapModeAuto=true;
function drawMap(){
  const W=200,H=200,d=mapImg.data;
  const cin=P.viz==='cinematic';
  const sd=sunDir();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=clamp(x/W*NX|0,0,NX-1),j=clamp(y/H*NZ|0,0,NZ-1),c=ID2(i,j);
    let r,g,b2;
    if(cin){
      // terrain + cloud composite
      const s=Sur[c],h=Ht[c];
      if(s===1){r=20;g=60;b2=110;}
      else if(s===2){r=20;g=70;b2=25;}
      else if(s===3){r=95;g=95;b2=100;}
      else if(s===4){r=230;g=235;b2=245;}
      else{const t=clamp(h/8,0,1);r=60+40*t;g=90-20*t;b2=40;}
      let q=0;const kg=KG[c];
      for(let k=kg;k<NL;k++)q+=F.qc[IDX(i,j,k)];
      const cw=clamp(q*40,0,235);
      r=r*(1-cw/255)+cw;g=g*(1-cw/255)+cw;b2=b2*(1-cw/255)+cw;
      const pr=clamp(Rain2[c]*80,0,120);b2=Math.min(255,b2+pr);
      const wet=clamp(Wet[c]*30,0,80);r-=wet;g-=wet*0.5;
    }else{
      const v=clamp(((diagBuf?diagBuf[c]:0)-VIZ[P.viz].r[0])/(VIZ[P.viz].r[1]-VIZ[P.viz].r[0]),0,1);
      [r,g,b2]=cmapJS(v);}
    const o=(y*W+x)*4;d[o]=r;d[o+1]=g;d[o+2]=b2;d[o+3]=255;}
  mapCtx.putImageData(mapImg,0,0);
  // wind arrows
  if(P.arrows||P.viz==='wind'||P.viz==='vort'){
    mapCtx.strokeStyle='rgba(255,255,255,.75)';mapCtx.lineWidth=1;
    const st=Math.max(4,NX/16|0),k=clamp(P.mapLayer|0,0,NL-1);
    for(let j=st/2|0;j<NZ;j+=st)for(let i=st/2|0;i<NX;i+=st){
      const id=IDX(i,j,k);if(Solid[id])continue;
      const x=(i+0.5)/NX*W,y=(j+0.5)/NZ*H;
      const u=F.u[id],v=F.v[id],sp=Math.hypot(u,v);if(sp<0.4)continue;
      const sc=Math.min(sp,10)/sp*8;
      mapCtx.beginPath();mapCtx.moveTo(x,y);mapCtx.lineTo(x+u*sc,y+v*sc);mapCtx.stroke();}}
  // probes
  for(const pr of probes){
    const x=(pr.i+0.5)/NX*W,y=(pr.j+0.5)/NZ*H;
    mapCtx.fillStyle='#ffd54f';mapCtx.beginPath();mapCtx.arc(x,y,3,0,TAU);mapCtx.fill();
    mapCtx.fillStyle='#000';mapCtx.font='7px monospace';mapCtx.fillText(pr.id,x+4,y+2);}
  // slice line
  if(P.sliceOn){mapCtx.strokeStyle='#ffd54f';mapCtx.setLineDash([3,3]);mapCtx.beginPath();
    if(P.sliceAxis==='z'){const y=P.slicePos*H;mapCtx.moveTo(0,y);mapCtx.lineTo(W,y);}
    else{const x=P.slicePos*W;mapCtx.moveTo(x,0);mapCtx.lineTo(x,H);}
    mapCtx.stroke();mapCtx.setLineDash([]);}
  $('mapTitle').textContent='MAP — '+(VIZ[P.viz]?VIZ[P.viz].label:'');
}
mapCv.addEventListener('pointerdown',e=>{
  const r=mapCv.getBoundingClientRect();
  const i=(e.clientX-r.left)/r.width*NX,j=(e.clientY-r.top)/r.height*NZ;
  if(P.tool==='probe'||e.shiftKey)addProbe(i,j);
  else{const g={i,j};if(P.tool!=='camera')applyBrush(i,j,null,null);}
});
$('mapHint').onclick=()=>{P.mapLayer=(P.mapLayer+4)%NL;saveSettings();};
function cmapJS(t){t=clamp(t,0,1);
  const stops=[[13,30,114],[13,166,191],[242,204,38],[230,30,20]];
  const x=t*3,i=Math.min(2,x|0),f=x-i;
  return[lerp(stops[i][0],stops[i+1][0],f),lerp(stops[i][1],stops[i+1][1],f),lerp(stops[i][2],stops[i+1][2],f)];}

// ================= save / load =================
const SAVE_FIELDS=['u','v','w','tp','qv','qc','qr','p'];
function saveState(){
  const o={v:1,seed:P.seed,nx:NX,nz:NZ,nl:NL,time:simTime,params:{},
    fields:{},Ht:f32b64(Ht),Sur:u8tob64(Sur),Wet:f32b64(Wet),Chg:f32b64(Chg),
    probes:probes.map(p=>({i:p.i,j:p.j,id:p.id}))};
  for(const k in P)if(typeof P[k]==='number'||typeof P[k]==='boolean'||typeof P[k]==='string')o.params[k]=P[k];
  for(const f of SAVE_FIELDS)o.fields[f]=f32b64(F[f]);
  download('stormlab-state.json',new Blob([JSON.stringify(o)],{type:'application/json'}));
  toast('State saved');}
function loadState(txt){
  let o;try{o=JSON.parse(txt);}catch(e){toast('Load failed: not JSON');return;}
  try{
    if(!o||o.v!==1||!o.fields||!o.fields.u)throw new Error('bad format');
    if(o.nx!==NX||o.nz!==NZ||o.nl!==NL){
      P.nx=o.nx;P.nz=o.nz;P.nl=o.nl;
      allocState();initTextures();buildTerrainMesh();}
    for(const f of SAVE_FIELDS){
      if(!o.fields[f])throw new Error('missing field '+f);
      const a=b64f32(o.fields[f],N);F[f].set(a);}
    Ht.set(b64f32(o.Ht,NX*NZ));Sur.set(b64tou8(o.Sur));Wet.set(b64f32(o.Wet,NX*NZ));Chg.set(b64f32(o.Chg,NX*NZ));
    for(let i=0;i<NX*NZ;i++)if(Sur[i]>5)throw new Error('bad surface data');
    if(o.params)for(const k in o.params)if(k in P)P[k]=o.params[k];
    simTime=o.time||0;
    probes=(o.probes||[]).map(p=>({i:p.i,j:p.j,id:p.id,hist:[]}));
    probeSeq=probes.reduce((m,p)=>Math.max(m,p.id),0);
    recomputeKG();rebuildTerrainGPU();refreshPanel();refreshProbeUI();
    toast('State loaded');
  }catch(e){toast('Load rejected: '+e.message);}}
let pngPending=false;
function exportPNG(){pngPending=true;}
function saveSettings(){
  try{const o={};for(const k in P)if(typeof P[k]==='number'||typeof P[k]==='boolean'||typeof P[k]==='string')o[k]=P[k];
    localStorage.setItem('stormlab-settings',JSON.stringify(o));}catch(e){}}
function loadSettings(){
  try{const o=JSON.parse(localStorage.getItem('stormlab-settings'));
    if(o)for(const k in o)if(k in P&&k!=='nx'&&k!=='nz'&&k!=='nl')P[k]=o[k];}catch(e){}}
function initTextures(){
  for(const k of['h','s','w','diag'])TEX[k]=mkTex(NX,NZ);
  allocQTex();}

// ================= render frame =================
let lastT=0,fps=60,fpsAcc=0,fpsN=0,frame=0,mapTick=0,histTick=0;
function renderFrame(now){
  requestAnimationFrame(renderFrame);
  const dtR=Math.min(0.05,(now-lastT)/1000||0.016);lastT=now;
  fpsAcc+=1/Math.max(dtR,1e-3);fpsN++;
  if(fpsN>=30){fps=fpsAcc/fpsN;fpsAcc=0;fpsN=0;
    if(P.adaptive){
      if(fps<28&&renderScaleEff>0.5){renderScaleEff=Math.max(0.5,renderScaleEff*0.9);}
      else if(fps>50&&renderScaleEff<P.renderScale)renderScaleEff=Math.min(P.renderScale,renderScaleEff*1.05);}}
  if(!P.adaptive)renderScaleEff=P.renderScale;
  else renderScaleEff=Math.min(renderScaleEff,P.renderScale);
  resize();
  // sim
  if(!P.pause){const steps=Math.max(1,Math.round(P.substeps*P.simSpeed));
    for(let s=0;s<steps;s++)stepSim(P.dt);}
  // fly move
  if(cam.mode==='fly'){
    const d=camDir(),r=[d[2],0,-d[0]],sp=cam.speed*dtR*4;
    if(keys['w']){cam.pos[0]+=d[0]*sp;cam.pos[1]+=d[1]*sp;cam.pos[2]+=d[2]*sp;}
    if(keys['s']){cam.pos[0]-=d[0]*sp;cam.pos[1]-=d[1]*sp;cam.pos[2]-=d[2]*sp;}
    if(keys['a']){cam.pos[0]-=r[0]*sp;cam.pos[2]-=r[2]*sp;}
    if(keys['d']){cam.pos[0]+=r[0]*sp;cam.pos[2]+=r[2]*sp;}
    if(keys['q'])cam.pos[1]-=sp;if(keys['e'])cam.pos[1]+=sp;
    cam.pos[1]=clamp(cam.pos[1],0.5,40);
    cam.pos[0]=clamp(cam.pos[0],-90,90);cam.pos[2]=clamp(cam.pos[2],-90,90);}
  // sustained brush: while pointer held on a tool, keep injecting (rate-scaled)
  if(brushHold&&pointer.down&&pointer.b===0){
    const s0=P.brushStrength;P.brushStrength=s0*dtR*6;
    applyBrush(brushHold.i,brushHold.j,brushHold.dx,brushHold.dz);
    P.brushStrength=s0;}
  updateParticles(dtR);
  updateBolts(dtR);
  const VP=updateCamera();
  uploadQ();uploadWet();buildDiag();
  if(P.sliceOn)buildSliceTex();
  draw(VP);
  frame++;
  if(now-mapTick>150){mapTick=now;drawMap();}
  if(!P.pause&&now-histTick>600){histTick=now;
    for(const pr of probes){pr.hist.push(probeSample(pr));if(pr.hist.length>240)pr.hist.shift();}
    refreshProbeUI();drawProbeCv();}
  updateHUD();
  $('warn').textContent=stabilityWarnings().join('\n');
  if(pngPending){pngPending=false;
    canvas.toBlob(b=>download('stormlab-view.png',b),'image/png');}
}
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.max(8,canvas.clientWidth*dpr*renderScaleEff|0),h=Math.max(8,canvas.clientHeight*dpr*renderScaleEff|0);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  aspect=w/h;gl.viewport(0,0,w,h);}
function draw(VP){
  const sd=sunDir();
  gl.clearColor(0.02,0.03,0.05,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  // sky
  gl.disable(gl.DEPTH_TEST);gl.useProgram(PROG.sky);gl.bindVertexArray(quadVAO);
  gl.uniformMatrix4fv(U(PROG.sky,'uInvVP'),false,invVP);
  gl.uniform3fv(U(PROG.sky,'uSun'),sd);gl.uniform3fv(U(PROG.sky,'uCam'),camPos);
  gl.uniform1f(U(PROG.sky,'uFlash'),flash.i);gl.uniform1f(U(PROG.sky,'uExp'),P.exposure);
  gl.uniform1f(U(PROG.sky,'uTime'),simTime);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.enable(gl.DEPTH_TEST);
  // terrain
  gl.useProgram(PROG.terrain);gl.bindVertexArray(terrainVAO);
  setBase(PROG.terrain,VP,sd);
  gl.uniform2f(U(PROG.terrain,'uDim'),NX,NZ);gl.uniform1f(U(PROG.terrain,'uHmax'),16);
  gl.uniform1f(U(PROG.terrain,'uSea'),WORLD.sea);
  gl.uniform1f(U(PROG.terrain,'uDiagMix'),P.viz==='cinematic'?0:0.85);
  bindTex(0,TEX.h,'uH',PROG.terrain);bindTex(1,TEX.s,'uS',PROG.terrain);
  bindTex(2,TEX.w,'uWet',PROG.terrain);bindTex(3,TEX.diag,'uDiag',PROG.terrain);
  gl.drawElements(gl.TRIANGLES,terrainN,gl.UNSIGNED_INT,0);
  // water
  gl.useProgram(PROG.water);gl.bindVertexArray(sliceVAO);
  gl.uniformMatrix4fv(U(PROG.water,'uVP'),false,VP);
  gl.uniform1f(U(PROG.water,'uSea'),WORLD.sea);gl.uniform1f(U(PROG.water,'uHmax'),16);
  gl.uniform3fv(U(PROG.water,'uSun'),sd);gl.uniform3fv(U(PROG.water,'uCam'),camPos);
  gl.uniform1f(U(PROG.water,'uExp'),P.exposure);gl.uniform1f(U(PROG.water,'uTime'),simTime);
  gl.uniform1f(U(PROG.water,'uFlash'),flash.i);
  bindTex(0,TEX.h,'uH',PROG.water);bindTex(1,TEX.s,'uS',PROG.water);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES,0,6);
  gl.depthMask(true);
  // diag plane
  if(P.viz!=='cinematic'){
    gl.useProgram(PROG.diag);gl.bindVertexArray(sliceVAO);
    gl.uniformMatrix4fv(U(PROG.diag,'uVP'),false,VP);
    gl.uniform1f(U(PROG.diag,'uY'),kH(clamp(P.mapLayer,0,NL-1))+0.02);
    gl.uniform1f(U(PROG.diag,'uAlpha'),0.5);gl.uniform1f(U(PROG.diag,'uExp'),P.exposure);
    bindTex(0,TEX.diag,'uDiag',PROG.diag);
    gl.drawArrays(gl.TRIANGLES,0,6);}
  gl.disable(gl.BLEND);gl.depthMask(true);
  // slice
  if(P.sliceOn){
    gl.useProgram(PROG.slice);gl.bindVertexArray(sliceVAO);
    gl.uniformMatrix4fv(U(PROG.slice,'uVP'),false,VP);
    if(P.sliceAxis==='z'){const z=(P.slicePos-0.5)*60;
      gl.uniform3fv(U(PROG.slice,'uA'),[-30,0,z]);gl.uniform3fv(U(PROG.slice,'uB'),[30,0,z]);}
    else{const x=(P.slicePos-0.5)*60;
      gl.uniform3fv(U(PROG.slice,'uA'),[x,0,-30]);gl.uniform3fv(U(PROG.slice,'uB'),[x,0,30]);}
    gl.uniform1f(U(PROG.slice,'uLift'),0.05);
    gl.uniform1f(U(PROG.slice,'uExp'),P.exposure);
    bindTex(0,TEX.slice,'uSlice',PROG.slice);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES,0,6);
    gl.depthMask(true);gl.disable(gl.BLEND);}
  // clouds
  gl.useProgram(PROG.cloud);gl.bindVertexArray(cubeVAO);
  gl.uniformMatrix4fv(U(PROG.cloud,'uVP'),false,VP);
  gl.uniform3fv(U(PROG.cloud,'uCam'),camPos);gl.uniform3fv(U(PROG.cloud,'uSun'),sd);
  gl.uniform1f(U(PROG.cloud,'uExp'),P.exposure);gl.uniform1f(U(PROG.cloud,'uTime'),simTime);
  gl.uniform1f(U(PROG.cloud,'uHmax'),16);gl.uniform1f(U(PROG.cloud,'uDens'),1.35);
  gl.uniform1f(U(PROG.cloud,'uQual'),P.cloudQuality);
  gl.uniform1f(U(PROG.cloud,'uFlash'),flash.i);gl.uniform3fv(U(PROG.cloud,'uFlashPos'),flash.pos);
  bindTex3D(0,TEX.q,'uQ',PROG.cloud);bindTex(1,TEX.h,'uH',PROG.cloud);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);gl.disable(gl.CULL_FACE);
  gl.drawElements(gl.TRIANGLES,cubeN,gl.UNSIGNED_SHORT,0);
  gl.depthMask(true);gl.disable(gl.BLEND);
  gl.bindVertexArray(null);
  // lines: rain / streaks / bolts / arrows / probes
  lineReset();
  if(P.streamlines){for(let a=0;a<NSTREAK;a++){
    const x=streak.p[a*3],y=streak.p[a*3+1],z=streak.p[a*3+2];
    cellWindAt(x,z,Math.round(y/cellZ()),_w3);
    const l=Math.min(Math.hypot(_w3[0],_w3[2])*0.22,1.4);
    lineSeg(x,y,z,x-_w3[0]*l,y-_w3[1]*l*0.2,z-_w3[2]*l,0.5,0.75,0.9,0.28);}}
  for(let a=0;a<rain.n;a++){
    const x=rain.p[a*3],y=rain.p[a*3+1],z=rain.p[a*3+2],sn=rain.snow[a];
    const ln=sn?0.25:0.6;
    if(sn)lineSeg(x,y,z,x-rain.v[a*3]*0.03,y-rain.v[a*3+1]*0.03,z-rain.v[a*3+2]*0.03,0.92,0.94,1,0.8);
    else lineSeg(x,y,z,x-rain.v[a*3]*0.05,y-ln,z-rain.v[a*3+2]*0.05,0.55,0.7,1,0.5);}
  linesFlush(false);
  // bolts + arrows additive
  lineReset();
  for(const b of boltList){
    const a=(1-b.t/b.life),s=b.segs;
    for(let k=0;k<s.length;k+=6)
      lineSeg(s[k],s[k+1],s[k+2],s[k+3],s[k+4],s[k+5],1.3*a+0.4,1.3*a+0.4,1.6*a+0.5,0.9*a);}
  if(P.arrows||P.viz==='wind'||P.viz==='vertical'||P.viz==='vort'){
    const st=Math.max(2,NX/24|0),k=clamp(P.mapLayer|0,0,NL-1),y=kH(k)+0.05;
    for(let j=st/2|0;j<NZ;j+=st)for(let i=st/2|0;i<NX;i+=st){
      const id=IDX(i,j,k);if(Solid[id])continue;
      const u=F.u[id],v=F.v[id],sp=Math.hypot(u,v);if(sp<0.3)continue;
      const x=(i+0.5)/NX*60-30,z=(j+0.5)/NZ*60-30;
      const sc=Math.min(sp,12)/sp*1.2,ux=u*sc,vz=v*sc;
      const r=clamp(sp/12,0.2,1);
      lineSeg(x,y,z,x+ux,y,z+vz,0.3+r,1-r*0.5,0.3,0.85);
      const a2=Math.atan2(vz,ux);
      lineSeg(x+ux,y,z+vz,x+ux-Math.cos(a2-0.5)*0.3,y,z+vz-Math.sin(a2-0.5)*0.3,1,1,1,0.85);
      lineSeg(x+ux,y,z+vz,x+ux-Math.cos(a2+0.5)*0.3,y,z+vz-Math.sin(a2+0.5)*0.3,1,1,1,0.85);}}
  for(const pr of probes){
    const x=(pr.i+0.5)/NX*60-30,z=(pr.j+0.5)/NZ*60-30;
    const y0=Math.max(Ht[ID2(clamp(pr.i|0,0,NX-1),clamp(pr.j|0,0,NZ-1))],0);
    lineSeg(x,y0,z,x,y0+14,z,1,0.85,0.2,0.9);
    for(let s2=0;s2<8;s2++){const a1=s2/8*TAU,a3=(s2+1)/8*TAU;
      lineSeg(x+Math.cos(a1),y0+0.2,z+Math.sin(a1),x+Math.cos(a3),y0+0.2,z+Math.sin(a3),1,0.85,0.2,0.9);}}
  linesFlush(true);
}
function bindTex(unit,t,name,p){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);
  gl.uniform1i(U(p,name),unit);}
function bindTex3D(unit,t,name,p){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_3D,t);
  gl.uniform1i(U(p,name),unit);}
function setBase(p,VP,sd){
  gl.uniformMatrix4fv(U(p,'uVP'),false,VP);
  gl.uniform3fv(U(p,'uSun'),sd);gl.uniform3fv(U(p,'uCam'),camPos);
  gl.uniform1f(U(p,'uExp'),P.exposure);gl.uniform1f(U(p,'uTime'),simTime);
  gl.uniform1f(U(p,'uFlash'),flash.i);gl.uniform3fv(U(p,'uFlashPos'),flash.pos);}
function updateParticles(dt){
  if(!P.pause){spawnRain(dt);updateRain(dt);updateStreaks(dt);}}

// ================= HUD =================
function updateHUD(){
  const cfl=maxWind*P.dt;
  $('hud').innerHTML=
   `<b>⛈ STORM LAB</b>  ${fps.toFixed(0)} fps`+(P.pause?'  <b style="color:#ef5350">PAUSED</b>':'')+`\n`+
   `grid ${NX}×${NZ}×${NL}  t=${fmtTime(simTime)}  dt=${P.dt}s\n`+
   `cloud ${(cloudCoverAvg*100).toFixed(1)}%  precip ${precipTotal.toFixed(1)}\n`+
   `w↑max ${maxUp.toFixed(1)}  wind ${maxWind.toFixed(1)}  CFL ${cfl.toFixed(2)}\n`+
   `preset ${activePreset} · viz ${P.viz} · probes ${probes.length}\n`+
   `charge ${chargeMax.toFixed(1)} · scale ${renderScaleEff.toFixed(2)}`;
}
function fmtTime(t){const m=t/60|0,s=t%60|0;return `${m}:${s<10?'0':''}${s}`;}

// ================= reinit / boot =================
function reinit(){
  allocState();
  initTextures();buildTerrainMesh();allocQTex();
  RNG=mulberry32(P.seed);
  applyPreset(activePreset);
  rows.mapLayer&&sliderRefreshLayers();
  toast(`Grid ${NX}×${NZ}×${NL}`);}
function sliderRefreshLayers(){const s=$('sl-mapLayer');if(s){s.max=NL-1;}}
function boot(){
  loadSettings();
  allocState();
  if(!initGL())return;
  RNG=mulberry32(P.seed);
  buildPanel();
  applyPreset('mtn-rain');
  refreshPanel();
  window.SL={
    P,F:()=>F,Ht:()=>Ht,Sur:()=>Sur,Wet:()=>Wet,KG:()=>KG,Solid:()=>Solid,
    IDX,ID2,NX:()=>NX,NZ:()=>NZ,NL:()=>NL,
    stats:()=>({t:simTime,cloud:cloudCoverAvg,precip:precipTotal,w:maxUp,wind:maxWind,chg:chargeMax,fps,probes:probes.length}),
    step:(n)=>{for(let i=0;i<n;i++)stepSim(P.dt);},
    preset:(k)=>{RNG=mulberry32(P.seed);applyPreset(k);refreshPanel();},
    strike:strikeAt,probe:(i,j)=>{addProbe(i,j);return probeSample(probes[probes.length-1]);},
    probeSample,probes:()=>probes,fieldAt:(f,i,j,k)=>F[f][IDX(i,j,k)],
    applyBrush:(i,j)=>{P.tool='heat';applyBrush(i,j);},
    brush:(tool,i,j,st)=>{P.tool=tool;if(st!=null)P.brushStrength=st;applyBrush(i,j);},
    setP:(k,v)=>{P[k]=v;},audioState:()=>AC?AC.state:'none',
    bolts:()=>boltList.length,ver:'1.0'};
  requestAnimationFrame(renderFrame);
}
boot();
