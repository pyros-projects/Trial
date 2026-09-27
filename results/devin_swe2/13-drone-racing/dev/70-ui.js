// ================= UI / HUD =================
let paused=false;
function msg(t,cls='',ms=2000){const e=$('osdMsg');e.textContent=t;e.className='osd-t '+cls;
 e.style.opacity=1;clearTimeout(e._h);if(ms)e._h=setTimeout(()=>e.style.opacity=0,ms)}
function dmgFlash(f){$('dmg').style.opacity=Math.min(0.9,f);
 setTimeout(()=>$('dmg').style.opacity=0,350)}
// ---- settings wiring ----
const BIND=[['sDiff','difficulty'],['sLaps','laps'],['sFlight','flightMode'],['sGrav','gravity'],
 ['sTWR','twr'],['sDrag','dragK'],['sRates','ratesDps'],['sExpo','expo'],['sLevel','levelGain'],
 ['sAltHold','altHold'],['sAnti','antiCrash'],['sForgive','forgive'],['sFov','fov'],['sTilt','camTilt'],
 ['sQual','quality'],['sRes','resScale'],['sShadow','shadowQ'],['sPart','partDens'],['sVol','volume'],
 ['sMute','muted'],['sDz','deadzone'],['sInvR','invR'],['sInvP','invP'],['sInvY','invY'],['sInvT','invT'],
 ['sGhost','ghost'],['sTele','tele'],['sDiag','diag']];
function refreshPanel(){
 for(const [id,k] of BIND){const el=$(id);if(!el)continue;
  if(el.type==='checkbox')el.checked=S[k];else el.value=S[k];
  const v=el.parentElement.querySelector('.val');if(v)v.textContent=fmtVal(k,S[k])}
 $('inSeed').value=S.seed;$('selPreset').value=S.preset;$('selMode').value=S.raceMode;
 $('tele').style.display=S.tele?'block':'none';$('diag').style.display=S.diag?'block':'none'}
function fmtVal(k,v){if(['fov','ratesDps','camTilt'].includes(k))return v|0;
 if(typeof v==='number')return (+v).toFixed(2);return v}
function wireUI(){
 for(const [id,k] of BIND){const el=$(id);if(!el)continue;
  el.addEventListener('change',()=>{
   S[k]=el.type==='checkbox'?el.checked:(el.tagName==='SELECT'?el.value:+el.value);
   if(k==='laps')S.laps=clamp(S.laps|0,1,9);
   if(k==='quality')applyQuality();
   if(k==='resScale'||k==='shadowQ')resize();
   if(k==='tele')$('tele').style.display=S.tele?'block':'none';
   if(k==='diag')$('diag').style.display=S.diag?'block':'none';
   refreshPanel();saveSettings()});
  if(el.type==='range')el.addEventListener('input',()=>{el.dispatchEvent(new Event('change'))})}
 $('selPreset').addEventListener('change',e=>{S.preset=e.target.value;newCourse()});
 $('selMode').addEventListener('change',e=>{S.raceMode=e.target.value;resetRace(true);saveSettings()});
 $('inSeed').addEventListener('change',e=>{S.seed=+e.target.value|0;newCourse()});
 $('btnNew').addEventListener('click',()=>newCourse());
 $('btnRestart').addEventListener('click',()=>resetRace(true));
 $('btnCam').addEventListener('click',cycleCam);
 $('btnShot').addEventListener('click',()=>shotReq=true);
 $('btnPanel').addEventListener('click',()=>$('panel').classList.toggle('open'));
 $('btnHelp').addEventListener('click',()=>$('help').style.display='grid');
 $('btnHelpX').addEventListener('click',()=>$('help').style.display='none');
 $('btnCal').addEventListener('click',calibratePad);
 $('btnExpC').addEventListener('click',exportCourse);
 $('btnExpR').addEventListener('click',exportReplay);
 $('btnImp').addEventListener('click',()=>$('fileImp').click());
 $('fileImp').addEventListener('change',importJSON);
 const sel=$('selPreset');for(const p in PRESETS){const o=document.createElement('option');
  o.value=p;o.textContent=p[0].toUpperCase()+p.slice(1);sel.appendChild(o)}
 refreshPanel()}
function applyQuality(){
 const q=S.quality;
 if(q==='low'){S.resScale=0.6;S.shadowQ='off';S.partDens=0.5}
 else if(q==='medium'){S.resScale=1;S.shadowQ='low';S.partDens=1}
 else if(q==='high'){S.resScale=1.25;S.shadowQ='high';S.partDens=1.5}
 else{S.resScale=1.5;S.shadowQ='high';S.partDens=2}
 resize()}
// ---- import / export ----
function dl(name,obj){const b=new Blob([JSON.stringify(obj)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function exportCourse(){dl('course.json',{type:'v1-course',seed:S.seed,preset:S.preset,
 difficulty:S.difficulty,laps:S.laps});toast('Course exported')}
function exportReplay(){const rec=(G.best&&G.best.length?G.best:G.rec);
 if(!rec||rec.length<16){toast('No replay recorded yet');return}
 dl('replay.json',{type:'v1-replay',course:courseKey(),samples:rec});toast('Replay exported')}
function importJSON(e){const f=e.target.files[0];if(!f)return;
 const rd=new FileReader();
 rd.onload=()=>{try{
   const o=JSON.parse(rd.result);
   if(o&&o.type==='v1-course'&&Number.isFinite(o.seed)&&PRESETS[o.preset]&&DIFF[o.difficulty]){
    S.seed=o.seed|0;S.preset=o.preset;S.difficulty=o.difficulty;
    S.laps=clamp(o.laps|0||2,1,9);newCourse();toast('Course imported')}
   else if(o&&o.type==='v1-replay'&&Array.isArray(o.samples)&&o.samples.length>=16&&o.samples.length%8===0&&o.samples.every(Number.isFinite)){
    G.best=o.samples;S.ghost=true;$('sGhost').checked=true;toast('Replay loaded as ghost')}
   else toast('Invalid file: unrecognized format');
  }catch(err){toast('Import failed: '+err.message)}};
 rd.readAsText(f);e.target.value=''}
// ---- screenshot ----
let shotReq=false;
function takeShot(){canvas.toBlob(b=>{const a=document.createElement('a');
 a.href=URL.createObjectURL(b);a.download='shot-'+Date.now()+'.png';a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Screenshot saved')},'image/png')}
// ---- attitude indicator (canvas overlay) ----
const attC=$('att'),attX=attC.getContext('2d');
function drawAtt(){
 const w=attC.width=attC.clientWidth*devicePixelRatio,h=attC.height=attC.clientHeight*devicePixelRatio;
 attX.clearRect(0,0,w,h);
 if(CAM.mode!==0){$('gateArrow').style.display='none';return}
 const cx=w/2,cy=h/2,u=devicePixelRatio;
 // attitude from quat: pitch = angle of body fwd vs horizon, roll = rotation of body right vs level
 const rgt=QT.rot(_c1,D.q,[1,0,0]),fwd=QT.rot(_c2,D.q,[0,0,1]);
 const roll=Math.atan2(-rgt[1],Math.hypot(rgt[0],rgt[2]));
 const pitch=Math.asin(clamp(fwd[1],-1,1))+S.camTilt*D2R;
 attX.save();attX.translate(cx,cy);attX.rotate(-roll);
 const ppd=h*0.5; // px per rad of pitch
 attX.strokeStyle='rgba(0,229,255,.8)';attX.lineWidth=1.5*u;
 attX.beginPath();attX.moveTo(-160*u,-pitch*ppd);attX.lineTo(160*u,-pitch*ppd);attX.stroke();
 attX.strokeStyle='rgba(0,229,255,.4)';attX.font=`${10*u}px monospace`;attX.fillStyle='#7fd8e8';
 for(let d=-3;d<=3;d++){if(!d)continue;const y=-pitch*ppd+d*15*D2R*ppd;
  if(Math.abs(y)>200*u)continue;
  attX.beginPath();attX.moveTo(-30*u,y);attX.lineTo(30*u,y);attX.stroke();
  attX.fillText((d*15)+'',34*u,y+3)}
 attX.restore();
 // center crosshair
 attX.strokeStyle='#fffc';attX.lineWidth=2*u;
 attX.beginPath();attX.moveTo(cx-14*u,cy);attX.lineTo(cx-4*u,cy);attX.moveTo(cx+4*u,cy);attX.lineTo(cx+14*u,cy);
 attX.moveTo(cx,cy-14*u);attX.lineTo(cx,cy-4*u);attX.stroke();
 // gate direction diamond
 const g=W.gates[R.next%W.gates.length];
 if(g){_c3[0]=g.p[0]-CAM.pos[0];_c3[1]=g.p[1]-CAM.pos[1];_c3[2]=g.p[2]-CAM.pos[2];
  const cf=QT.rot(_c1,D.q,[0,0,1]);V3.norm(_c3,_c3);
  // angle of gate dir relative to view in yaw/pitch
  const right=QT.rot(V3.c(),D.q,[1,0,0]),upv=QT.rot(V3.c(),D.q,[0,1,0]);
  const ax=V3.dot(_c3,right),ay=V3.dot(_c3,upv),az=V3.dot(_c3,cf);
  const a=Math.atan2(ax,ay);const behind=az<0;
  const el=$('gateArrow'),rr=90*u/devicePixelRatio;
  el.style.display='block';el.style.color=behind?'#ffb300':'#00e5ff';
  el.style.transform=`translate(${Math.sin(a)*rr}px,${-Math.cos(a)*rr}px) translate(-50%,-50%) rotate(${behind?45:0}deg)`;
  el.style.opacity=az>0.96?0.25:1}
}
// ---- OSD text ----
function updateOSD(){
 const spd=V3.len(D.v),g=W.gates[R.next%W.gates.length];
 const alt=D.p[1]-W.h(D.p[0],D.p[2]);
 const bd=g?V3.dist(D.p,g.p):0;
 $('osdTL').innerHTML=
  `SPD <b>${(spd*3.6).toFixed(0)}</b> km/h<br>`+
  `ALT <b>${alt.toFixed(1)}</b> m<br>`+
  `THR <span class="bar" id="thrBar"><i style="width:${D.motor*100}%"></i></span> ${(D.motor*100)|0}%<br>`+
  `BAT <span class="bar" id="battBar"><i style="width:${D.batt*100}%"></i></span> ${(2+D.batt*14).toFixed(1)}V`+
  (D.batt<0.25?` <span style="color:var(--warn)">LOW</span>`:'');
 let dl='';
 if(G.bestSplits&&R.started&&R.next>0&&G.bestSplits[R.next-1]!==undefined){
  const dd=R.tRace-G.bestSplits[R.next-1];dl=`<br>Δ <span style="color:${dd<0?'var(--ok)':'var(--bad)'}">${dd>=0?'+':''}${dd.toFixed(2)}</span>`}
 $('osdTR').innerHTML=
  `${S.flightMode.toUpperCase()} · ${CAM.names[CAM.mode]}<br>`+
  `GATE <b>${S.raceMode==='time'?R.next:R.next%W.gates.length}/${S.raceMode==='time'?W.gates.length*S.laps:W.gates.length}</b> → ${bd.toFixed(0)}m<br>`+
  (S.raceMode==='time'?`LAP <b>${R.lap+1}/${S.laps}</b> ${fmtT(R.tLap)}${R.pen?` <span style="color:var(--bad)">+${R.pen}s</span>`:''}<br>`+
   `TOT ${fmtT(R.tRace)}${R.best?` BEST ${fmtT(R.best)}`:''}${dl}`:'FREE FLIGHT');
 $('osdBL').innerHTML=(S.raceMode==='time'&&R.sectorTimes.length?
  'SEC '+R.sectorTimes.map(t=>t.toFixed(1)).join(' · '):'')+
  (R.lapTimes.length?'<br>LAPS '+R.lapTimes.map(fmtT).join(' · '):'');
 $('osdBR').innerHTML=`${D.crashed?'<span style="color:var(--bad)">CRASHED</span>':D.contact?'<span style="color:var(--warn)">CONTACT</span>':'CLEAN'}`+
  `<br>${R.missed?`missed ×${R.missed}`:''}`;
}
// ---- stats strip ----
let fpsE=60,frameMs=0;
function updateStats(){
 $('stats').innerHTML=
  `<b>${fpsE.toFixed(0)}</b> fps · ${FBO_W()}×${FBO_H()} · ${frameMs.toFixed(1)}ms<br>`+
  `pos ${D.p[0].toFixed(0)},${D.p[1].toFixed(0)},${D.p[2].toFixed(0)} · spd ${V3.len(D.v).toFixed(1)} m/s<br>`+
  `${S.flightMode} · gate ${R.next}/${W.gates.length*S.laps} · ${CAM.names[CAM.mode].toLowerCase()}`+
  `${pad.ok?` · <span class="ok">pad</span>`:''}${D.crashed?` · <span class="bad">CRASH</span>`:''}`}
// ---- telemetry ----
const TB={alt:[],spd:[],thr:[],rate:[],max:600};
function telePush(){const a=TB.alt,T=TB;
 a.push(D.p[1]-W.h(D.p[0],D.p[2]));T.spd.push(V3.len(D.v));T.thr.push(D.motor);T.rate.push(D.w[0]);
 if(a.length>T.max){a.shift();T.spd.shift();T.thr.shift();T.rate.shift()}}
function teleDraw(){
 if(!S.tele)return;const c=$('teleC'),x=c.getContext('2d'),w=c.width,h=c.height;
 x.fillStyle='#04090fee';x.fillRect(0,0,w,h);
 x.strokeStyle='#14303f';x.beginPath();x.moveTo(0,h/2);x.lineTo(w,h/2);x.stroke();
 const plot=(arr,col,norm)=>{x.strokeStyle=col;x.lineWidth=1.4;x.beginPath();
  arr.forEach((v,i)=>{const px=i/TB.max*w,py=h-4-clamp(v/norm,-0.1,1.1)*(h-8);
   i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()};
 plot(TB.alt,'#38ff9c',60);plot(TB.spd,'#00e5ff',60);plot(TB.thr,'#ffb300',1);plot(TB.rate,'#ff5c8a',8)}
// ---- diagnostics ----
function updateDiag(dt,stepDt){
 if(!S.diag)return;
 const up=QT.rot(_c1,D.q,[0,1,0]),fwd=QT.rot(_c2,D.q,[0,0,1]);
 $('diag').textContent=
 `dt ${(stepDt*1e6)|0}µs ×${SUBSTEPS} · frame ${frameMs.toFixed(1)}ms
pos   ${D.p[0].toFixed(2)} ${D.p[1].toFixed(2)} ${D.p[2].toFixed(2)}
vel   ${D.v[0].toFixed(2)} ${D.v[1].toFixed(2)} ${D.v[2].toFixed(2)}
acc   ${D.acc[0].toFixed(1)} ${D.acc[1].toFixed(1)} ${D.acc[2].toFixed(1)}
rates p ${(D.w[0]*R2D).toFixed(0)}° y ${(D.w[1]*R2D).toFixed(0)}° r ${(D.w[2]*R2D).toFixed(0)}°/s
input r ${ST.roll.toFixed(2)} p ${ST.pitch.toFixed(2)} y ${ST.yaw.toFixed(2)} t ${ST.thr.toFixed(2)} [${ST.src}]
up    ${up[0].toFixed(2)} ${up[1].toFixed(2)} ${up[2].toFixed(2)}
fwd   ${fwd[0].toFixed(2)} ${fwd[1].toFixed(2)} ${fwd[2].toFixed(2)}
motor ${D.motor.toFixed(3)} batt ${(D.batt*100).toFixed(0)}% load ${(D.load*100)|0}%
state ${D.crashed?'CRASHED':D.contact?'contact':'air'} next ${R.next} pen ${R.pen}
src ${ST.src} pad ${pad.ok}`;
}
// ---- debug 3D lines ----
const LINES={buf:new Float32Array(6*2*4096),n:0};
function line(a,b,r,g2,b2,a2=1){if(LINES.n>=4096)return;const o=LINES.n*12;
 LINES.buf[o]=a[0];LINES.buf[o+1]=a[1];LINES.buf[o+2]=a[2];LINES.buf[o+3]=r;LINES.buf[o+4]=g2;LINES.buf[o+5]=b2;
 LINES.buf[o+6]=b[0];LINES.buf[o+7]=b[1];LINES.buf[o+8]=b[2];LINES.buf[o+9]=r;LINES.buf[o+10]=g2;LINES.buf[o+11]=b2;
 LINES.n++}
function wireFrame(c,q,he,r,g2,b2){
 const cs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
 const E=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
 const pts=cs.map(v=>{const p=V3.c(v[0]*he[0],v[1]*he[1],v[2]*he[2]);QT.rot(p,q,p);V3.add(p,p,c);return p});
 for(const [a,b] of E)line(pts[a],pts[b],r,g2,b2)}
function circle(c,rad,axis,r,g2,b2){
 const N=24,prev=V3.c();
 const t1=V3.c(axis===0?0:1,axis===1?0:0,axis===2?0:0),t2=V3.c();
 V3.cross(t2,[axis===0?1:0,axis===1?1:0,axis===2?1:0],t1); // sloppy but fine for axis aligned
 if(axis===0){t1[0]=0;t1[1]=1;t1[2]=0;t2[0]=0;t2[1]=0;t2[2]=1}
 if(axis===1){t1[0]=1;t1[1]=0;t1[2]=0;t2[0]=0;t2[1]=0;t2[2]=1}
 if(axis===2){t1[0]=1;t1[1]=0;t1[2]=0;t2[0]=0;t2[1]=1;t2[2]=0}
 for(let i=0;i<=N;i++){const a=i/N*Math.PI*2;
  const p=V3.c(c[0]+t1[0]*Math.cos(a)*rad+t2[0]*Math.sin(a)*rad,
   c[1]+t1[1]*Math.cos(a)*rad+t2[1]*Math.sin(a)*rad,
   c[2]+t1[2]*Math.cos(a)*rad+t2[2]*Math.sin(a)*rad);
  if(i)line(prev,p,r,g2,b2);V3.copy(prev,p)}}
function buildDebug(){
 LINES.n=0;
 // body axes at drone
 const ax=QT.rot(V3.c(),D.q,[1,0,0]),ay=QT.rot(V3.c(),D.q,[0,1,0]),az=QT.rot(V3.c(),D.q,[0,0,1]);
 line(D.p,V3.mad(V3.c(),D.p,ax,1.2),1,0.2,0.2);line(D.p,V3.mad(V3.c(),D.p,ay,1.2),0.2,1,0.2);
 line(D.p,V3.mad(V3.c(),D.p,az,1.2),0.3,0.4,1);
 // velocity + accel vectors
 line(D.p,V3.mad(V3.c(),D.p,D.v,0.2),1,0.9,0);line(D.p,V3.mad(V3.c(),D.p,D.acc,0.05),1,0,1);
 // collision sphere
 circle(D.p,R_DRONE,1,1,1,0);
 // active + next gate volume
 for(const k of[0,1]){const g=W.gates[(R.next+k)%W.gates.length];
  if(!g)continue;wireFrame(g.p,g.q,V3.c(g.w,g.h,0.4),k?0.4:0,k?0.5:0.9,k?0.6:1)}
 // ground contact point
 const gy=W.h(D.p[0],D.p[2]);line([D.p[0],D.p[1],D.p[2]],[D.p[0],gy,D.p[2]],0.5,0.5,0.5);
}
