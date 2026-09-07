/* ================= UI bindings, presets, status, probe, data I/O ================= */

const MODE_NAMES = ['shaded','elevation','water depth','sediment','erosion/deposition','slope','flow'];
const PRESETS = {
  mountain:{label:'mountain', style:'mountains', amp:7,  rough:0.52, rain:0.35, evap:0.25, erode:0.09, dep:0.25, cap:2.5, flow:1.0, therm:0.30, talus:0.55, speed:1.5, substeps:1, res:192},
  canyon:  {label:'canyon',   style:'mesa',      amp:9,  rough:0.50, rain:0.40, evap:0.30, erode:0.12, dep:0.20, cap:3.5, flow:1.2, therm:0.12, talus:0.70, speed:1.5, substeps:1, res:192},
  island:  {label:'island',   style:'island',    amp:8,  rough:0.50, rain:0.40, evap:0.20, erode:0.06, dep:0.30, cap:2.5, flow:1.0, therm:0.25, talus:0.50, speed:1.5, substeps:1, res:192},
  valley:  {label:'valley',   style:'valley',    amp:7,  rough:0.50, rain:0.20, evap:0.25, erode:0.08, dep:0.25, cap:3.0, flow:1.0, therm:0.20, talus:0.60, speed:1.5, substeps:1, res:192},
  stress:  {label:'stress',   style:'mountains', amp:10, rough:0.60, rain:0.50, evap:0.15, erode:0.30, dep:0.15, cap:8.0, flow:1.6, therm:0.85, talus:0.90, speed:2, substeps:3, res:256},
};
let activePreset='mountain';

function toast(msg, isErr){
  const t=$('toast');
  t.textContent=msg; t.classList.toggle('err', !!isErr); t.classList.add('show');
  clearTimeout(toast._h);
  toast._h=setTimeout(()=>t.classList.remove('show'), 2600);
}

const FMT = {
  speed:v=>'×'+(+v).toFixed(2), substeps:v=>''+v, amp:v=>(+v).toFixed(1), rough:v=>(+v).toFixed(2),
  rain:v=>(+v).toFixed(3), evap:v=>(+v).toFixed(2), erode:v=>(+v).toFixed(2), dep:v=>(+v).toFixed(2),
  cap:v=>(+v).toFixed(1), flow:v=>'×'+(+v).toFixed(2), therm:v=>(+v).toFixed(2), talus:v=>(+v).toFixed(2),
  ex:v=>'×'+(+v).toFixed(1), wop:v=>Math.round(v*100)+'%', laz:v=>Math.round(v)+'°', lel:v=>Math.round(v)+'°',
  csp:v=>(+v).toFixed(2), br:v=>(+v).toFixed(1), bs:v=>Math.round(v*100)+'%',
};

function setParam(name, value, fromUI){
  if(name==='res'){
    const n=parseInt(value,10);
    if(n===S.N) return;
    P.res=n; allocState(n); generateTerrain(); buildMesh(n); allocTextures();
    CAM.ddist=Math.max(CAM.ddist, n*0.9); CAM.dist=CAM.ddist=n*0.95;
    CAM.dty=S.genMax*0.5*P.ex; CAM.ty=CAM.dty;
    toast('Resolution → '+n+'×'+n+' (terrain regenerated)');
    return;
  }
  if(name==='seed'){
    P.seed=Math.max(0, parseInt(value,10)||0)|0;
    generateTerrain();
    return;
  }
  if(name==='style'){
    P.style=value;
    activePreset=null;
    document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active', b.dataset.preset===activePreset));
    generateTerrain();
    return;
  }
  if(name==='mode'){
    P.mode=parseInt(value,10)|0;
    $('st-mode').textContent=MODE_NAMES[P.mode];
    return;
  }
  P[name]=value;
  if(FMT[name] && !fromUI) refreshLabels();
}

function refreshLabels(){
  document.querySelectorAll('[data-v]').forEach(el=>{
    const k=el.dataset.v;
    el.textContent = FMT[k] ? FMT[k](P[k]) : P[k];
  });
  $('d-brv').textContent=(+P.br).toFixed(1);
  $('d-bsv').textContent=Math.round(P.bs*100)+'%';
}

function initUI(){
  document.querySelectorAll('input[data-p],select[data-p]').forEach(el=>{
    const name=el.dataset.p;
    if(el.type==='checkbox'){
      el.checked=!!P[name];
      el.addEventListener('change', ()=>setParam(name, el.checked));
    } else if(el.type==='range'){
      el.value=P[name];
      el.addEventListener('input', ()=>{
        const v=parseFloat(el.value);
        setParam(name, v, true);
        if(FMT[name]){ const lab=document.querySelector('[data-v="'+name+'"]'); if(lab) lab.textContent=FMT[name](v); }
        if(name==='br') $('d-brv').textContent=v.toFixed(1);
        if(name==='bs') $('d-bsv').textContent=Math.round(v*100)+'%';
      });
    } else {
      el.value=P[name];
      el.addEventListener('change', ()=>setParam(name, el.value));
    }
  });

  document.querySelectorAll('.tool').forEach(b=>{
    if(b.dataset.tool===P.tool) b.classList.add('active');
    b.addEventListener('click', ()=>{
      P.tool=b.dataset.tool;
      document.querySelectorAll('.tool').forEach(x=>x.classList.toggle('active', x===b));
      const cv=$('glc');
      cv.style.cursor = P.tool==='orbit' ? 'grab' : 'crosshair';
      if(P.tool!=='inspect'){ UI.pinned=null; $('probe').classList.remove('pin'); }
    });
  });

  $('btn-pause').addEventListener('click', togglePause);
  $('btn-step').addEventListener('click', ()=>{
    if(!S.paused) togglePause();
    doSteps(1);
  });
  $('btn-reset').addEventListener('click', ()=>{ resetSim(); toast('Simulation reset'); });
  $('btn-regen').addEventListener('click', ()=>{ generateTerrain(); toast('Terrain regenerated (seed '+P.seed+')'); });
  $('btn-dice').addEventListener('click', ()=>{
    $('in-seed').value = Math.floor(Math.random()*1000000);
    setParam('seed', $('in-seed').value);
  });
  $('btn-drawer').addEventListener('click', ()=>$('panel').classList.remove('open'));

  document.querySelectorAll('.preset').forEach(b=>{
    b.classList.toggle('active', b.dataset.preset===activePreset);
    b.addEventListener('click', ()=>applyPreset(b.dataset.preset));
  });

  $('btn-png').addEventListener('click', exportPNG);
  $('btn-json').addEventListener('click', exportJSON);
  $('btn-load').addEventListener('click', ()=>$('file-json').click());
  $('file-json').addEventListener('change', e=>{
    const f=e.target.files[0];
    if(f) importJSON(f);
    e.target.value='';
  });

  window.addEventListener('keydown', e=>{
    const tag=(e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='select'||tag==='textarea') return;
    if(e.code==='Space'){ e.preventDefault(); togglePause(); }
    else if(e.key==='.'){ doSteps(1); }
    else if(e.key>='1'&&e.key<='7'){
      setParam('mode', (+e.key)-1);
      $('sel-mode').value=''+((+e.key)-1);
    }
    else if(e.key==='h'||e.key==='H'){
      UI.uiHidden=!UI.uiHidden;
      ['panel','status','dock','probe','legend'].forEach(id=>{ $(id).style.visibility=UI.uiHidden?'hidden':'visible'; });
    }
    else if(e.key==='p'||e.key==='P'){ $('panel').classList.toggle('open'); }
  });

  refreshLabels();
  $('st-mode').textContent=MODE_NAMES[P.mode];
}

function applyPreset(key){
  const pr=PRESETS[key]; if(!pr) return;
  activePreset=key;
  for(const k of ['style','amp','rough','rain','evap','erode','dep','cap','flow','therm','talus','speed','substeps'])
    P[k]=pr[k];
  // push values into controls
  for(const k of ['amp','rough','rain','evap','erode','dep','cap','flow','therm','talus','speed','substeps']){
    const el=$('in-'+k); if(el) el.value=P[k];
  }
  $('sel-style').value=P.style;
  setParam('res', pr.res); $('in-res').value=''+pr.res;
  generateTerrain();
  buildMesh(S.N); allocTextures();
  document.querySelectorAll('.preset').forEach(b=>b.classList.toggle('active', b.dataset.preset===key));
  refreshLabels();
  toast('Preset: '+bLabel(key));
}
function bLabel(k){ return {mountain:'Mountain drainage',canyon:'Canyon formation',island:'Island rainfall',valley:'River valley',stress:'Aggressive stress'}[k]||k; }

function togglePause(){
  S.paused=!S.paused;
  $('btn-pause').innerHTML = S.paused ? '▶ Resume' : '⏸ Pause';
  $('st-pause').textContent = S.paused ? 'PAUSED' : 'running';
  $('st-pause').classList.toggle('warnv', S.paused);
}

/* probe ------------------------------------------------------------------------- */
function slopeAt(gx,gz){
  const e=1;
  const hl=sampleHeight(gx-e,gz), hr=sampleHeight(gx+e,gz);
  const hd=sampleHeight(gx,gz-e), hu=sampleHeight(gx,gz+e);
  const dx=(hr-hl)/(2*e), dz=(hu-hd)/(2*e);
  return Math.hypot(dx,dz);
}
function probeText(hit, el){
  const k=clamp((hit.gz|0),0,S.N-1)*S.N + clamp((hit.gx|0),0,S.N-1);
  el('pr-pos').textContent = 'i'+(hit.gx|0)+', j'+(hit.gz|0)+'  ('+hit.x.toFixed(0)+', '+hit.z.toFixed(0)+')';
  el('pr-h').textContent = hit.h.toFixed(3);
  el('pr-w').textContent = S.w[k].toFixed(4);
  el('pr-s').textContent = S.s[k].toFixed(4);
  el('pr-v').textContent = Math.hypot(S.u[k],S.v[k]).toFixed(2)+' cells/s';
  el('pr-slope').textContent = slopeAt(hit.gx,hit.gz).toFixed(3);
  el('pr-dh').textContent = (S.h[k]-S.h0[k] >= 0 ? '+':'') + (S.h[k]-S.h0[k]).toFixed(3);
}
function updateProbeCard(hit, pinned){
  const el=id=>$(id);
  probeText(hit, el);
  $('probe').classList.toggle('pin', !!pinned);
}

/* status overlay ----------------------------------------------------------------- */
let statTimer=0;
function updateStatus(dt, stats){
  statTimer-=dt;
  if(dt<0.3) FPS.ema = FPS.ema*0.92 + (1/Math.max(dt,1e-3))*0.08;
  statTimer<=0 && (statTimer=0.25);
  if(statTimer>0.2){ // just after reset; render text
    $('st-fps').textContent=FPS.ema.toFixed(0);
    $('st-simms').textContent=S.simMs.toFixed(1)+' / '+(S.frameMs||0).toFixed(1)+' ms';
    $('st-res').textContent=S.N+' × '+S.N;
    const t=S.time, mm=(t/60)|0, ss=t%60;
    $('st-time').textContent=mm+':'+(ss<10?'0':'')+ss.toFixed(1);
    $('st-sps').textContent=S.stepsPerSec.toFixed(0);
    $('st-water').textContent=fmtVol(stats.water);
    $('st-sed').textContent=fmtVol(stats.sed);
    $('st-ero').textContent=fmtVol(stats.carved)+' / '+fmtVol(stats.deposited);
    $('st-mode').textContent=MODE_NAMES[P.mode];
    $('st-pause').textContent = S.paused ? 'PAUSED' : 'running';
    $('st-pause').classList.toggle('warnv', S.paused);
    const w=$('st-warn');
    if(S.recoveries>0){ w.style.display='block'; w.textContent='⚠ '+S.recoveries+' numeric instability event(s) recovered'; }
    else if(S.cappedNotice){ w.style.display='block'; w.textContent='⚠ step budget capped (lower speed/substeps for realtime)'; }
    else w.style.display='none';
  }
}
function fmtVol(v){
  if(v>=1e6) return (v/1e6).toFixed(2)+'M';
  if(v>=1e3) return (v/1e3).toFixed(1)+'k';
  return v.toFixed(1);
}

/* export / import ------------------------------------------------------------------ */
function download(name, blob){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function b64FromF32(arr){
  const u8=new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s='';
  const CH=0x8000;
  for(let i=0;i<u8.length;i+=CH) s+=String.fromCharCode.apply(null, u8.subarray(i,i+CH));
  return btoa(s);
}
function f32FromB64(b64, expect){
  const bin=atob(b64);
  const u8=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
  const arr=new Float32Array(u8.buffer);
  if(expect && arr.length!==expect) throw new Error('array size mismatch');
  return arr;
}
function crc32(buf){
  let c, table=crc32.table;
  if(!table){ table=crc32.table=new Uint32Array(256);
    for(let n=0;n<256;n++){ c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; table[n]=c; } }
  c=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++) c = table[(c^buf[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function exportPNG(){
  // minimal true-grayscale 8-bit PNG encoder (no external deps)
  const N=S.N;
  let mn=Infinity, mx=-Infinity;
  for(let k=0;k<N*N;k++){ const v=S.h[k]; if(v<mn)mn=v; if(v>mx)mx=v; }
  const sc = mx>mn ? 255/(mx-mn) : 0;
  // raw scanlines with filter byte 0
  const raw=new Uint8Array(N*(N+1));
  let p=0;
  for(let j=0;j<N;j++){
    raw[p++]=0;
    for(let i=0;i<N;i++) raw[p++]=Math.round((S.h[j*N+i]-mn)*sc);
  }
  // deflate stored blocks
  const nBlocks=Math.ceil(raw.length/65535);
  const deflated=new Uint8Array(raw.length+nBlocks*5+16);
  let q=0;
  deflated[q++]=0x78; deflated[q++]=0x01;
  let off=0;
  while(off<raw.length){
    const len=Math.min(65535, raw.length-off);
    const last=off+len>=raw.length?1:0;
    deflated[q++]=last; deflated[q++]=len&0xFF; deflated[q++]=(len>>>8)&0xFF;
    deflated[q++]=(~len)&0xFF; deflated[q++]=((~len)>>>8)&0xFF;
    deflated.set(raw.subarray(off,off+len), q); q+=len; off+=len;
  }
  const adler=(buf)=>{ let a=1,b=0; for(let i=0;i<buf.length;i++){ a=(a+buf[i])%65521; b=(b+a)%65521; } return ((b<<16)|a)>>>0; };
  const ad=adler(raw);
  deflated[q++]=(ad>>>24)&0xFF; deflated[q++]=(ad>>>16)&0xFF; deflated[q++]=(ad>>>8)&0xFF; deflated[q++]=ad&0xFF;
  const chunk=(type,data)=>{
    const out=new Uint8Array(12+data.length);
    const dv=new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for(let i=0;i<4;i++) out[4+i]=type.charCodeAt(i);
    out.set(data,8);
    dv.setUint32(8+data.length, crc32(out.subarray(4,8+data.length)));
    return out;
  };
  const ihdr=new Uint8Array(13);
  const dv=new DataView(ihdr.buffer);
  dv.setUint32(0,N); dv.setUint32(4,N); ihdr[8]=8; ihdr[9]=0; // 8-bit grayscale
  const parts=[
    new Uint8Array([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated.subarray(0,q)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total=parts.reduce((a,b)=>a+b.length,0);
  const png=new Uint8Array(total);
  let o=0; for(const part of parts){ png.set(part,o); o+=part.length; }
  download('heightmap_'+N+'_'+P.seed+'.png', new Blob([png], {type:'image/png'}));
  toast('Heightmap PNG exported (grayscale '+N+'×'+N+', h∈['+mn.toFixed(2)+', '+mx.toFixed(2)+'])');
}
function exportJSON(){
  const obj={
    app:'hydraulic-erosion-lab', version:1,
    seed:P.seed, resolution:S.N, simTime:S.time, steps:S.steps,
    params:{style:P.style,amp:P.amp,rough:P.rough,rain:P.rain,evap:P.evap,erode:P.erode,dep:P.dep,cap:P.cap,flow:P.flow,therm:P.therm,talus:P.talus,speed:P.speed,substeps:P.substeps},
    totals:{carved:S.carved,deposited:S.deposited,recoveries:S.recoveries},
    arrays:{h:b64FromF32(S.h), w:b64FromF32(S.w), s:b64FromF32(S.s), h0:b64FromF32(S.h0), u:b64FromF32(S.u), v:b64FromF32(S.v),
            fL:b64FromF32(S.fL), fR:b64FromF32(S.fR), fT:b64FromF32(S.fT), fB:b64FromF32(S.fB)},
  };
  const blob=new Blob([JSON.stringify(obj)], {type:'application/json'});
  download('erosion_state_'+S.N+'_'+Date.now()+'.json', blob);
  toast('Simulation state exported ('+(blob.size/1048576).toFixed(1)+' MB)');
}
function importJSON(file){
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const obj=JSON.parse(rd.result);
      if(obj.app!=='hydraulic-erosion-lab' || !obj.arrays) throw new Error('not a lab state file');
      const N=obj.resolution|0;
      if(![96,128,160,192,256,320].includes(N)) throw new Error('unsupported resolution');
      Object.assign(P, obj.params||{});
      P.res=N; P.seed=obj.seed|0;
      allocState(N);
      S.h.set(f32FromB64(obj.arrays.h, N*N));
      S.w.set(f32FromB64(obj.arrays.w, N*N));
      S.s.set(f32FromB64(obj.arrays.s, N*N));
      S.h0.set(f32FromB64(obj.arrays.h0, N*N));
      S.u.set(f32FromB64(obj.arrays.u, N*N));
      S.v.set(f32FromB64(obj.arrays.v, N*N));
      S.fL.set(f32FromB64(obj.arrays.fL, N*N));
      S.fR.set(f32FromB64(obj.arrays.fR, N*N));
      S.fT.set(f32FromB64(obj.arrays.fT, N*N));
      S.fB.set(f32FromB64(obj.arrays.fB, N*N));
      S.time=obj.simTime||0; S.steps=obj.steps||0;
      S.carved=(obj.totals&&obj.totals.carved)||0; S.deposited=(obj.totals&&obj.totals.deposited)||0;
      S.recoveries=(obj.totals&&obj.totals.recoveries)||0;
      // recompute generation range
      let mn=Infinity,mx=-Infinity;
      for(let k=0;k<N*N;k++){ const v=S.h0[k]; if(v<mn)mn=v; if(v>mx)mx=v; }
      S.genMin=mn; S.genMax=mx;
      // sync UI
      $('in-res').value=''+N;
      for(const k of ['amp','rough','rain','evap','erode','dep','cap','flow','therm','talus','speed','substeps']){
        const el=$('in-'+k); if(el && P[k]!==undefined) el.value=P[k];
      }
      $('sel-style').value=P.style; $('in-seed').value=P.seed;
      refreshLabels();
      buildMesh(N); allocTextures();
      sanitize();
      toast('State imported: seed '+P.seed+', t='+S.time.toFixed(1)+'s');
    }catch(err){
      toast('Import failed: '+err.message, true);
    }
  };
  rd.readAsText(file);
}
