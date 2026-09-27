// ================= input =================
const keys={};
const KEYMAP={KeyW:'p+',KeyS:'p-',KeyA:'r-',KeyD:'r+',ArrowLeft:'y-',ArrowRight:'y+'};
window.addEventListener('keydown',e=>{
 if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;
 keys[e.code]=1;
 if(e.code==='ArrowUp'||e.code==='ArrowDown'||e.code==='Space')e.preventDefault();
 hotkey(e.code)});
window.addEventListener('keyup',e=>{keys[e.code]=0});
function hotkey(c){
 if(c==='KeyR')resetRace(true);
 else if(c==='KeyC')cycleCam();
 else if(c==='KeyF')cycleFlight();
 else if(c==='KeyP'||c==='Escape')paused=!paused;
 else if(c==='KeyG'){S.ghost=!S.ghost;$('sGhost').checked=S.ghost}
 else if(c==='KeyT'){S.tele=!S.tele;$('tele').style.display=S.tele?'block':'none';$('sTele').checked=S.tele}
 else if(c==='F3'){S.diag=!S.diag;$('diag').style.display=S.diag?'block':'none';$('sDiag').checked=S.diag}
 else if(c==='KeyH')$('help').style.display=$('help').style.display==='grid'?'none':'grid';
 else if(c==='KeyM'){S.muted=!S.muted;$('sMute').checked=S.muted}}

// touch virtual sticks
const touch={l:{x:0,y:0,id:-1},r:{x:0,y:0,id:-1},active:false};
function stickSetup(el,st){
 const nub=el.querySelector('.nub');
 const upd=(t)=>{const r=el.getBoundingClientRect();
  st.x=clamp((t.clientX-(r.left+r.width/2))/(r.width/2),-1,1);
  st.y=clamp((t.clientY-(r.top+r.height/2))/(r.height/2),-1,1);
  nub.style.transform=`translate(${st.x*32}px,${st.y*32}px)`};
 el.addEventListener('pointerdown',e=>{document.body.classList.add('touch');touch.active=true;
  st.id=e.pointerId;el.setPointerCapture(e.pointerId);upd(e)});
 el.addEventListener('pointermove',e=>{if(e.pointerId===st.id)upd(e)});
 const end=e=>{if(e.pointerId===st.id){st.id=-1;st.x=st.y=0;nub.style.transform=''}};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)}
stickSetup($('stickL'),touch.l);stickSetup($('stickR'),touch.r);

// gamepad
const pad={ok:false,cal:[0,0,0,0],deadT:0,msg:''};
function pollPad(){
 const gp=(navigator.getGamepads?navigator.getGamepads():[]);
 let g=null;for(const p of gp)if(p&&p.connected){g=p;break}
 pad.ok=!!g;pad.g=g;
 const el=$('padStat');
 if(g){el.textContent=`Gamepad: ${g.id.slice(0,40)} — L:throttle/yaw R:pitch/roll`;el.classList.add('ok')}
 else{el.textContent='No gamepad detected — connect a controller and press any button.';el.classList.remove('ok')}
}
window.addEventListener('gamepadconnected',pollPad);
setInterval(pollPad,1500);
let padCalLock=0;
function calibratePad(){if(!pad.g){toast('No gamepad to calibrate');return}
 pad.cal=[0,0,0,0];padCalLock=performance.now()+800;$('calStat').textContent='centering…';
 setTimeout(()=>{if(pad.g){for(let i=0;i<4;i++)pad.cal[i]=pad.g.axes[i]||0;$('calStat').textContent='done'}
  saveSettings()},850)}
function dz(v){return Math.abs(v)<S.deadzone?0:(v-Math.sign(v)*S.deadzone)/(1-S.deadzone)}
function expo(v){return v*(1-S.expo)+v*v*v*S.expo}

// merged stick output: roll,pitch,yaw in -1..1 ; thr 0..1
const ST={roll:0,pitch:0,yaw:0,thr:0.42,kThr:0.42,src:'kb',srcT:0};
function readInput(dt){
 // keyboard: persistent throttle slewed by Up/Down
 if(keys.ArrowUp)ST.kThr+=dt*0.8; if(keys.ArrowDown)ST.kThr-=dt*0.8; ST.kThr=clamp(ST.kThr,0,1);
 if(keys.ArrowUp||keys.ArrowDown)ST.src='kb';
 let kr=0,kp=0,ky=0;
 for(const c in KEYMAP){if(!keys[c])continue;const m=KEYMAP[c];
  if(m==='r+')kr+=1;if(m==='r-')kr-=1;if(m==='p+')kp+=1;if(m==='p-')kp-=1;
  if(m==='y+')ky+=1;if(m==='y-')ky-=1}
 if(kr||kp||ky)ST.src='kb';
 // touch sticks (right = pitch/roll, left = throttle/yaw)
 if(touch.active&&(touch.r.id>=0||touch.l.id>=0)){ST.src='touch';
  ST.roll=touch.r.x;ST.pitch=-touch.r.y;ST.yaw=touch.l.x;ST.thr=clamp(0.42-touch.l.y,0,1)}
 if(ST.src==='kb'||!touch.active){ST.roll=kr;ST.pitch=kp;ST.yaw=ky;ST.thr=ST.kThr}
 // gamepad overrides when axes moved recently
 if(pad.ok&&pad.g){const a=pad.g.axes;
  const tRaw=(a[1]!==undefined?-a[1]:0),yRaw=a[0]||0,pRaw=a[3]!==undefined?-a[3]:0,rRaw=a[2]||0;
  if(Math.abs(tRaw-(pad.cal[1]||0))>0.04||Math.abs(rRaw)>0.04||Math.abs(pRaw)>0.04||Math.abs(yRaw)>0.04)pad.deadT=performance.now()+500;
  if(performance.now()<pad.deadT){
   ST.src='pad';
   ST.roll=expo(dz(rRaw-(pad.cal[2]||0)))*(S.invR?-1:1);
   ST.pitch=expo(dz(pRaw-(pad.cal[3]||0)))*(S.invP?-1:1);
   ST.yaw=dz(yRaw-(pad.cal[0]||0))*(S.invY?-1:1);
   let tt=(tRaw-(pad.cal[1]||0))*0.5+0.5; if(S.invT)tt=1-tt; ST.thr=clamp(tt,0,1)}}
 // keyboard expo on attitude sticks
 ST.roll=expo(clamp(ST.roll,-1,1));ST.pitch=expo(clamp(ST.pitch,-1,1));ST.yaw=clamp(ST.yaw,-1,1);
 if(ST.src==='kb'){ST.roll=expo(kr);ST.pitch=expo(kp)}
}

// ================= drone physics =================
const D={p:V3.c(),v:V3.c(),q:QT.ident(),w:V3.c(),motor:0,acc:V3.c(),
 crashed:false,crashedRest:false,contact:false,desYaw:0,impact:0,onGround:true,batt:1,load:0};
const M=0.55,R_DRONE=0.30; // mass kg, collision radius m
const RATE_RESP=11;
const _t1=V3.c(),_t2=V3.c(),_q1=QT.ident(),_q2=QT.ident();

function spawnAt(i){ // at approach side of gate i
 const g=W.gates[i];const fw=V3.c();QT.rot(fw,g.q,[0,0,1]);
 V3.mad(D.p,g.p,fw,-12);
 const gy=W.h(D.p[0],D.p[2]);if(D.p[1]<gy+1.2)D.p[1]=gy+1.2;
 D.v[0]=D.v[1]=D.v[2]=0;D.w[0]=D.w[1]=D.w[2]=0;
 const yaw=Math.atan2(fw[0],fw[2]);QT.fromYawPitchRoll(D.q,yaw,0,0);
 D.desYaw=yaw;D.motor=hoverThr();D.crashed=false;D.crashedRest=false;D.onGround=false;D.impact=0;D.batt=1}
function hoverThr(){return clamp(1/S.twr,0.05,0.95)}

function stepPhysics(dt){
 readInput(dt);
 const g=S.gravity,thr=ST.thr;
 // ---- attitude control ----
 const rates=S.ratesDps*D2R;
 const desR=V3.c(ST.pitch*rates,ST.yaw*rates,-ST.roll*rates); // body-frame desired rates
 D.desYaw+=ST.yaw*rates*dt;
 if(S.flightMode!=='acro'&&!D.crashed){
  // desired attitude: yaw-only frame tilted by sticks
  const maxA=0.65;
  QT.fromYawPitchRoll(_q1,D.desYaw,ST.pitch*maxA,-ST.roll*maxA);
  QT.conj(_q2,D.q);QT.mul(_q2,_q1,_q2); // err = qd * conj(q)
  if(_q2[3]<0){_q2[0]*=-1;_q2[1]*=-1;_q2[2]*=-1;_q2[3]*=-1}
  const s=Math.hypot(_q2[0],_q2[1],_q2[2]);
  if(s>1e-5){const ang=2*Math.atan2(s,_q2[3]),k=Math.min(ang*S.levelGain,rates);
   const f=k/s;desR[0]=_q2[0]*f;desR[1]=_q2[1]*f+ST.yaw*rates;desR[2]=_q2[2]*f}
  if(S.flightMode==='horizon'){ // blend to acro at stick extremes
   const m=Math.max(Math.abs(ST.roll),Math.abs(ST.pitch));
   const t=smoothstep(0.55,0.95,m);
   desR[0]=lerp(desR[0],ST.pitch*rates,t);desR[2]=lerp(desR[2],-ST.roll*rates,t)}
 }
 // rate controller: drive body rates (models motor torque + inertia)
 const invI=[1.15,0.45,1.0]; // yaw axis sluggish (y), pitch (x), roll (z)
 D.w[0]+=(desR[0]-D.w[0])*Math.min(1,RATE_RESP*invI[0]*dt*10);
 D.w[1]+=(desR[1]-D.w[1])*Math.min(1,RATE_RESP*invI[1]*dt*10);
 D.w[2]+=(desR[2]-D.w[2])*Math.min(1,RATE_RESP*invI[2]*dt*10);
 const wl=V3.len(D.w);if(wl>30)V3.scale(D.w,D.w,30/wl);
 QT.integrate(D.q,D.q,D.w[0],D.w[1],D.w[2],dt);
 // ---- throttle / motor ----
 let thrCmd=D.crashed?0:thr;
 if(S.altHold&&!D.crashed){ // throttle stick becomes climb-rate command around hover
  const climb=(thr-0.5)*10;
  const err=climb-D.v[1];
  thrCmd=hoverThr()+clamp(err*0.10,-0.5,0.6)}
 D.motor+=(clamp(thrCmd,0,1)-D.motor)*Math.min(1,dt/0.06); // motor spin lag
 if(S.antiCrash&&!D.crashed){ // proximity brake near ground
  const gh=W.h(D.p[0],D.p[2]),dh=D.p[1]-gh;
  if(dh<5&&D.v[1]<-4)D.motor=Math.max(D.motor,hoverThr()+(-D.v[1]-4)*0.12)}
 // ---- forces ----
 const up=V3.c();QT.rot(up,D.q,[0,1,0]);
 const thrust=D.motor*S.twr*M*g;
 _t1[0]=up[0]*thrust;_t1[1]=up[1]*thrust;_t1[2]=up[2]*thrust;
 if(D.crashed){_t1[0]=_t1[1]=_t1[2]=0}
 // quadratic drag in body frame
 const vb=V3.c();QT.rotInv(vb,D.q,D.v);
 const vl=V3.len(vb);const dk=S.dragK*0.055;
 const fd=V3.c(-vb[0]*vl*dk*1.3,-vb[1]*vl*dk*2.2,-vb[2]*vl*dk*0.7);
 QT.rot(fd,D.q,fd);
 _t1[0]+=fd[0];_t1[1]+=fd[1]-M*g;_t1[2]+=fd[2];
 V3.copy(D.acc,_t1);V3.scale(D.acc,D.acc,1/M);
 if(!finite3(D.acc)||!finite3(D.v)||!finite3(D.p)){spawnAt(0);return}
 V3.mad(D.v,D.v,D.acc,dt);V3.mad(D.p,D.p,D.v,dt);
 const sl=V3.len(D.v);if(sl>140)V3.scale(D.v,D.v,140/sl);
 // battery drain + motor load
 D.load=D.motor;D.batt=clamp(D.batt-(D.motor*D.motor*0.004+0.0005)*dt,0,1);
 if(D.batt<0.02)D.motor=Math.min(D.motor,hoverThr()*0.75);
 collide(dt);
}

function collide(dt){
 D.contact=false;const r=R_DRONE;
 const gh=W.h(D.p[0],D.p[2]);
 // ground (sampled normal)
 if(D.p[1]-r<gh){
  const e=0.8;const nx=W.h(D.p[0]+e,D.p[2])-W.h(D.p[0]-e,D.p[2]),
   nz=W.h(D.p[0],D.p[2]+e)-W.h(D.p[0],D.p[2]-e);
  _t1[0]=-nx;_t1[1]=2*e;_t1[2]=-nz;V3.norm(_t1,_t1);
  const pen=gh-(D.p[1]-r);V3.mad(D.p,D.p,_t1,pen);
  const vn=V3.dot(D.v,_t1);
  if(vn<0){hit(-vn,_t1);V3.mad(D.v,D.v,_t1,-vn*1.35)}
  // ground friction
  const vt=V3.c(D.v[0]-_t1[0]*V3.dot(D.v,_t1),0,0);vt[1]=D.v[1]-_t1[1]*V3.dot(D.v,_t1);vt[2]=D.v[2]-_t1[2]*V3.dot(D.v,_t1);
  V3.mad(D.v,D.v,vt,-Math.min(1,8*dt));D.contact=true}
 // obstacles
 for(const o of W.obstacles){
  const dx=D.p[0]-o.p[0],dy=D.p[1]-o.p[1],dz=D.p[2]-o.p[2];
  const rr=o.k==='b'?Math.max(o.he[0],o.he[1],o.he[2]):Math.max(o.r,o.h/2);
  if(dx*dx+dy*dy+dz*dz>(rr+r+2)*(rr+r+2))continue;
  if(o.k==='b'){ // OBB
   _t1[0]=dx;_t1[1]=dy;_t1[2]=dz;QT.rotInv(_t1,o.q,_t1);
   const cx=clamp(_t1[0],-o.he[0],o.he[0]),cy=clamp(_t1[1],-o.he[1],o.he[1]),cz=clamp(_t1[2],-o.he[2],o.he[2]);
   _t2[0]=_t1[0]-cx;_t2[1]=_t1[1]-cy;_t2[2]=_t1[2]-cz;
   const d2=_t2[0]*_t2[0]+_t2[1]*_t2[1]+_t2[2]*_t2[2];
   if(d2<r*r){let n;
    if(d2>1e-9){const d=Math.sqrt(d2);V3.scale(_t2,_t2,1/d);n=QT.rot(V3.c(),o.q,_t2);V3.mad(D.p,D.p,n,r-d)}
    else{ // inside: push out along smallest axis
     const px=o.he[0]-Math.abs(_t1[0]),py=o.he[1]-Math.abs(_t1[1]),pz=o.he[2]-Math.abs(_t1[2]);
     if(px<py&&px<pz){_t2[0]=Math.sign(_t1[0]);_t2[1]=_t2[2]=0}
     else if(py<pz){_t2[1]=Math.sign(_t1[1]);_t2[0]=_t2[2]=0}
     else{_t2[2]=Math.sign(_t1[2]);_t2[0]=_t2[1]=0}
     n=QT.rot(V3.c(),o.q,_t2);V3.mad(D.p,D.p,n,Math.min(px,Math.min(py,pz))+r)}
   const vn=V3.dot(D.v,n);
   if(vn<0){hit(-vn,n);V3.mad(D.v,D.v,n,-vn*1.3)}
   V3.mad(D.v,D.v,n,-0);D.contact=true}}
  else{ // vertical cylinder
   const ry=clamp(D.p[1],o.p[1]-o.h/2,o.p[1]+o.h/2);
   const rx=D.p[0]-o.p[0],rz=D.p[2]-o.p[2];
   const rd=Math.hypot(rx,rz);
   const dd=Math.hypot(rd,D.p[1]-ry);
   if(dd<r+o.r){const n=V3.c(rx/(rd||1),(D.p[1]-ry)*0.5,rz/(rd||1));V3.norm(n,n);
    V3.mad(D.p,D.p,n,(r+o.r)-dd);
    const vn=V3.dot(D.v,n);if(vn<0){hit(-vn,n);V3.mad(D.v,D.v,n,-vn*1.3)}
    D.contact=true}}}
 // gate posts (thin cylinders at ring edges)
 for(let i=0;i<W.gates.length;i++){const g=W.gates[i];
  const dx=D.p[0]-g.p[0],dy=D.p[1]-g.p[1],dz=D.p[2]-g.p[2];
  if(dx*dx+dy*dy+dz*dz>(g.w+6)*(g.w+6))continue;
  const sd=V3.c();QT.rot(sd,g.q,[1,0,0]);
  for(const s of[-1,1]){
   const px=g.p[0]+sd[0]*s*(g.w+0.4),py=g.p[1]+sd[1]*s*(g.w+0.4),pz=g.p[2]+sd[2]*s*(g.w+0.4);
   const gy=W.h(px,pz);if(D.p[1]<gy||D.p[1]>g.p[1]+1.5)continue;
   const rx=D.p[0]-px,rz=D.p[2]-pz,rd=Math.hypot(rx,rz);
   if(rd<r+0.18){const n=V3.c(rx/(rd||1),0,rz/(rd||1));V3.mad(D.p,D.p,n,(r+0.18)-rd);
    const vn=V3.dot(D.v,n);if(vn<0){hit(-vn,n);V3.mad(D.v,D.v,n,-vn*1.3)}
    D.contact=true}}}
 // world boundary
 const br=Math.hypot(D.p[0],D.p[2]);
 if(br>W.boundR){const n=V3.c(-D.p[0]/br,0,-D.p[2]/br);
  V3.mad(D.p,D.p,n,(br-W.boundR)*0.5);const vn=V3.dot(D.v,n);
  if(vn<0)V3.mad(D.v,D.v,n,-vn);if(br>W.boundR+30)hit(99,[0,1,0])}
 if(D.p[1]>500){D.p[1]=500;if(D.v[1]>0)D.v[1]=0}
}
function hit(speed,n){
 D.impact=Math.max(D.impact*0.9,speed);
 const thresh=W.df.crash*(0.5+S.forgive);
 if(speed>thresh&&!D.crashed){D.crashed=true;D.crashT=0;msg('CRASHED — R to respawn','bad',3000);
  sfxCrash()}
 if(speed>1.5){spawnBurst(D.p,n,Math.min(40,speed*4));sfxHit(speed)}
 dmgFlash(Math.min(1,speed/12))}
