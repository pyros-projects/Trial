// ================= scene assembly =================
let W=null, meshes={}, lineVAO=null,lineVB=null, partVAO=null,partVB=null;
let SUBSTEPS=0;
function buildMeshes(){
 W=buildWorld(S.preset,S.seed,S.difficulty);
 // ground
 const gnd=groundGeo(W);
 meshes.ground=new Mesh(gnd,1);
 const I=M4.ident(new Float32Array(16));
 meshes.ground.set(0,I,...W.sky.gnd.map(c=>c*0.55),1,0);
 meshes.ground.commit(1);
 // obstacles: boxes & cylinders
 const nb=W.obstacles.filter(o=>o.k==='b'),nc=W.obstacles.filter(o=>o.k==='c');
 const bg={pos:[],nrm:[],idx:[]};geoBox(bg,0,0,0,1,1,1);
 meshes.obsBox=new Mesh(bg,Math.max(1,nb.length));
 nb.forEach((o,i)=>{instTRS(meshes.obsBox,i,o.p[0],o.p[1],o.p[2],o.q,o.he[0]*2,o.he[1]*2,o.he[2]*2,...o.c,1,o.e||0)});
 meshes.obsBox.commit(nb.length);
 const cg={pos:[],nrm:[],idx:[]};geoCyl(cg,0,0,0,0.5,1,12);
 meshes.obsCyl=new Mesh(cg,Math.max(1,nc.length));
 nc.forEach((o,i)=>{const q=QT.ident();instTRS(meshes.obsCyl,i,o.p[0],o.p[1],o.p[2],q,o.r*2,o.h,o.r*2,...o.c,1,o.e||0)});
 meshes.obsCyl.commit(nc.length);
 // gates
 meshes.gate=new Mesh(gateGeo(W.gateAperture,W.gateAperture*0.8),W.gates.length,true);
 // gate legs + beacons + path markers + pad
 const legG={pos:[],nrm:[],idx:[]};geoBox(legG,0,0,0,0.22,1,0.22);
 meshes.legs=new Mesh(legG,W.gates.length*2);
 W.gates.forEach((g,i)=>{const sd=V3.c();QT.rot(sd,g.q,[1,0,0]);
  for(let s=0;s<2;s++){const sg=s?-1:1;
   const px=g.p[0]+sd[0]*sg*(g.w+0.4),pz=g.p[2]+sd[2]*sg*(g.w+0.4);
   const gy=W.h(px,pz),hh=Math.max(1,g.p[1]-gy+1);
   const q=QT.ident();
   instTRS(meshes.legs,i*2+s,px,gy+hh/2,pz,q,1,hh,1, 0.15,0.6,0.7, 1, 0.9)}});
 meshes.legs.commit(W.gates.length*2);
 const bc={pos:[],nrm:[],idx:[]};geoCyl(bc,0,0,0,0.08,60,8,false,false);
 meshes.beacon=new Mesh(bc,W.gates.length,true);
 const sg={pos:[],nrm:[],idx:[]};geoSphere(sg,0,0,0,0.28,6);
 const marks=[];
 for(let i=0;i<W.gates.length;i++){const a=W.gates[i].p,b=W.gates[(i+1)%W.gates.length].p;
  const d=V3.dist(a,b),steps=Math.floor(d/10);
  for(let j=1;j<steps;j++){const t=j/steps;
   marks.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)])}}
 meshes.marks=new Mesh(sg,Math.max(1,marks.length));
 marks.forEach((m,i)=>{const q=QT.ident();
  instTRS(meshes.marks,i,m[0],m[1],m[2],q,1,1,1, 0.2,0.5,0.7, 0.8, 0.7)});
 meshes.marks.commit(marks.length);
 // start pad
 const pg={pos:[],nrm:[],idx:[]};geoCyl(pg,0,0.05,0,2.4,0.1,20);
 meshes.pad=new Mesh(pg,1);
 const py=W.h(W.spawn.p[0],W.spawn.p[2]);
 instTRS(meshes.pad,0,W.spawn.p[0],py,W.spawn.p[2],QT.ident(),1,1,1, 0.1,0.5,0.6, 1, 0.5);
 meshes.pad.commit(1);
 // drone + props + ghost
 meshes.drone=new Mesh(droneGeo(),2,true);
 meshes.prop=new Mesh(propGeo(),8,true);
 // particles
 partVAO=gl.createVertexArray();gl.bindVertexArray(partVAO);
 const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 partVB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,partVB);
 gl.bufferData(gl.ARRAY_BUFFER,PART.n*32,gl.DYNAMIC_DRAW);
 gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,0);gl.vertexAttribDivisor(1,1);
 gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,4,gl.FLOAT,false,32,12);gl.vertexAttribDivisor(2,1);
 gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,32,28);gl.vertexAttribDivisor(3,1);
 gl.bindVertexArray(null);
 // debug lines
 lineVAO=gl.createVertexArray();gl.bindVertexArray(lineVAO);
 lineVB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,lineVB);
 gl.bufferData(gl.ARRAY_BUFFER,LINES.buf.byteLength,gl.DYNAMIC_DRAW);
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
 gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
 gl.bindVertexArray(null);
 loadBest();resetRace(true);
}
function newCourse(){buildMeshes();refreshPanel();saveSettings();toast(`Course: ${S.preset} seed ${S.seed}`)}
// gate colors per frame
function updateGateMesh(){
 const N=W.gates.length,total=N*S.laps;
 W.gates.forEach((g,i)=>{
  const done=S.raceMode==='time'&&R.started&&(i<R.next%N||R.next>=total)&&(R.next%N!==0||i<0);
  const active=(i===R.next%N&&R.next<total);
  let c,e;
  if(active){c=[0.1,0.9,1];e=2.2}else if(i===0){c=[0.2,1,0.5];e=1.2}
  else if(S.raceMode==='time'&&R.started&&R.next%N>i){c=[0.1,0.7,0.3];e=0.5}
  else{c=[0.35,0.4,0.5];e=0.25}
  instTRS(meshes.gate,i,g.p[0],g.p[1],g.p[2],g.q,1,1,1,...c,1,e);
  // beacon
  instTRS(meshes.beacon,i,g.p[0],g.p[1]+30,g.p[2],QT.ident(),1,1,1,...c,active?0.3:0.1,active?1.1:0.25)});
 meshes.gate.commit(N);meshes.beacon.commit(N)}
// ================= render =================
const VP=new Float32Array(16),PM=new Float32Array(16),VM=new Float32Array(16),
 LVP=new Float32Array(16),LPM=new Float32Array(16),LVM=new Float32Array(16),_tm=new Float32Array(16);
const sceneMeshes=()=>[meshes.ground,meshes.obsBox,meshes.obsCyl,meshes.legs,meshes.marks,meshes.pad];
function render(time){
 const asp=canvas.width/canvas.height;
 M4.persp(PM,CAM.fov*D2R,asp,0.1,900);
 M4.lookAt(VM,CAM.pos,CAM.look,CAM.up);
 M4.mul(VP,PM,VM);
 // sun
 const sk=W.sky;
 // drone + props instance data (needed by shadow + scene passes)
 M4.fromQT(_tm,D.q,D.p);
 meshes.drone.set(0,_tm,0.12,0.14,0.18,1,0);
 const spin=time*0.09*(0.3+D.motor);
 const mp=[[-0.28,-0.33],[0.28,-0.33],[-0.28,0.33],[0.28,0.33]];
 mp.forEach((m,i)=>{
  QT.axisAngle(_q1,0,1,0,spin*(i%2?1:-1));QT.mul(_q2,D.q,_q1);
  const off=QT.rot(V3.c(),D.q,[m[0],0.05,m[1]]);
  instTRS(meshes.prop,i,D.p[0]+off[0],D.p[1]+off[1],D.p[2]+off[2],_q2,1,1,1, 0.5,0.6,0.7,0.25,0.1)});
 meshes.prop.commit(4);meshes.drone.commit(1);
 // ---- shadow pass ----
 const shOn=S.shadowQ!=='off';
 const ctr=V3.c(D.p[0],D.p[1],D.p[2]);
 const eye=V3.c(ctr[0]+W.sunDir[0]*260,ctr[1]+W.sunDir[1]*260,ctr[2]+W.sunDir[2]*260);
 M4.lookAt(LVM,eye,ctr,[0,1,0]);M4.ortho(LPM,-140,140,-140,140,40,560);M4.mul(LVP,LPM,LVM);
 if(shOn){
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,shadowFBO);
  gl.viewport(0,0,SHADOW_SZ,SHADOW_SZ);gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(PSHADOW.p);gl.uniformMatrix4fv(PSHADOW.u.uLVP,false,LVP);
  for(const m of sceneMeshes()){if(!m.n)continue;gl.bindVertexArray(m.svaos);
   gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,m.n)}
  // drone in shadow
  gl.bindVertexArray(meshes.drone.svaos);gl.drawElementsInstanced(gl.TRIANGLES,meshes.drone.count,gl.UNSIGNED_INT,0,1);
 }
 // ---- scene pass ----
 gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,sceneMS);
 gl.viewport(0,0,FBO_W(),FBO_H());
 gl.clearColor(sk.fog[0],sk.fog[1],sk.fog[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.enable(gl.DEPTH_TEST);
 // sky
 gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
 gl.useProgram(PSKY.p);
 const cR=QT.rot(V3.c(),D.q,[1,0,0]); // camera right/up/fwd from VM rows
 // extract camera basis from view matrix (rows = axes)
 const rt=[VM[0],VM[4],VM[8]],ut=[VM[1],VM[5],VM[9]],fw=[-VM[2],-VM[6],-VM[10]];
 gl.uniform3fv(PSKY.u.uR,rt);gl.uniform3fv(PSKY.u.uU,ut);gl.uniform3fv(PSKY.u.uF,fw);
 gl.uniform1f(PSKY.u.uTan,Math.tan(CAM.fov*D2R/2));gl.uniform1f(PSKY.u.uAsp,asp);
 gl.uniform3fv(PSKY.u.uHor,sk.skyH);gl.uniform3fv(PSKY.u.uTop,sk.skyT);
 gl.uniform3fv(PSKY.u.uSunDir,W.sunDir);gl.uniform3fv(PSKY.u.uSunCol,sk.sunC);
 gl.uniform3fv(PSKY.u.uFog,sk.fog);gl.uniform1f(PSKY.u.uTime,time*0.001);
 gl.drawArrays(gl.TRIANGLES,0,3);
 gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
 // meshes
 gl.useProgram(PMESH.p);
 gl.uniformMatrix4fv(PMESH.u.uVP,false,VP);gl.uniformMatrix4fv(PMESH.u.uLVP,false,LVP);
 gl.uniform3fv(PMESH.u.uSunDir,W.sunDir);gl.uniform3fv(PMESH.u.uSunCol,sk.sunC);
 gl.uniform3fv(PMESH.u.uSky,sk.hemiSky);gl.uniform3fv(PMESH.u.uGnd,sk.hemiGnd);
 gl.uniform3fv(PMESH.u.uCam,CAM.pos);gl.uniform3fv(PMESH.u.uFog,sk.fog);
 gl.uniform1f(PMESH.u.uFogD,sk.fogD);gl.uniform1f(PMESH.u.uShOn,shOn?1:0);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTex);
 gl.uniform1i(PMESH.u.uShadow,0);
 for(const m of sceneMeshes()){if(!m.n)continue;gl.bindVertexArray(m.vao);
  gl.drawElementsInstanced(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0,m.n)}
 gl.bindVertexArray(meshes.gate.vao);gl.drawElementsInstanced(gl.TRIANGLES,meshes.gate.count,gl.UNSIGNED_INT,0,meshes.gate.n);
 gl.bindVertexArray(meshes.beacon.vao);gl.drawElementsInstanced(gl.TRIANGLES,meshes.beacon.count,gl.UNSIGNED_INT,0,meshes.beacon.n);
 // drone
 gl.bindVertexArray(meshes.drone.vao);gl.drawElementsInstanced(gl.TRIANGLES,meshes.drone.count,gl.UNSIGNED_INT,0,1);
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
 gl.bindVertexArray(meshes.prop.vao);gl.drawElementsInstanced(gl.TRIANGLES,meshes.prop.count,gl.UNSIGNED_INT,0,4);
 // ghost
 if(S.ghost&&G.best&&R.started&&ghostSample(R.tRace)){
  M4.fromQT(_tm,_gqQ,_gqP);
  meshes.drone.set(0,_tm,0.2,0.8,1,0.3,0.8);meshes.drone.commit(1);
  gl.bindVertexArray(meshes.drone.vao);gl.drawElementsInstanced(gl.TRIANGLES,meshes.drone.count,gl.UNSIGNED_INT,0,1);
  M4.fromQT(_tm,D.q,D.p);meshes.drone.set(0,_tm,0.12,0.14,0.18,1,0);meshes.drone.commit(1)}
 // particles
 const pn=partFill();
 if(pn){gl.bindBuffer(gl.ARRAY_BUFFER,partVB);gl.bufferSubData(gl.ARRAY_BUFFER,0,partData.subarray(0,pn*8));
  gl.useProgram(PPART.p);
  gl.uniformMatrix4fv(PPART.u.uVP,false,VP);gl.uniform3fv(PPART.u.uR,rt);gl.uniform3fv(PPART.u.uU,ut);
  gl.uniform3fv(PPART.u.uCam,CAM.pos);gl.uniform3fv(PPART.u.uFog,sk.fog);gl.uniform1f(PPART.u.uFogD,sk.fogD);
  gl.bindVertexArray(partVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,6,pn)}
 // debug lines
 if(S.diag){buildDebug();
  if(LINES.n){gl.bindBuffer(gl.ARRAY_BUFFER,lineVB);
   gl.bufferSubData(gl.ARRAY_BUFFER,0,LINES.buf.subarray(0,LINES.n*6));
   gl.useProgram(PLINE.p);gl.uniformMatrix4fv(PLINE.u.uVP,false,VP);
   gl.bindVertexArray(lineVAO);gl.drawArrays(gl.LINES,0,LINES.n*2)}}
 gl.depthMask(true);gl.disable(gl.BLEND);
 // resolve MSAA → texture
 gl.bindFramebuffer(gl.READ_FRAMEBUFFER,sceneMS);
 gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,sceneFBO);
 gl.blitFramebuffer(0,0,FBO_W(),FBO_H(),0,0,FBO_W(),FBO_H(),gl.COLOR_BUFFER_BIT,gl.NEAREST);
 // ---- post pass to screen ----
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 gl.viewport(0,0,canvas.width,canvas.height);
 gl.useProgram(PPOST.p);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sceneTex);gl.uniform1i(PPOST.u.uT,0);
 gl.uniform1f(PPOST.u.uVig,CAM.fpv?0.55:0.3);
 gl.uniform1f(PPOST.u.uDist,CAM.fpv?0.18:0);
 gl.uniform1f(PPOST.u.uSpd,clamp(V3.len(D.v)/60,0,1)*(CAM.fpv?1:0.4));
 gl.uniform1f(PPOST.u.uTime,time*0.001);gl.uniform1f(PPOST.u.uAsp,asp);
 gl.drawArrays(gl.TRIANGLES,0,3);
 if(shotReq){shotReq=false;takeShot()}
}
// ================= main loop =================
let lastT=0,acc=0,first=true;
const FIXED=1/240;
function frame(t){
 requestAnimationFrame(frame);
 const dt=Math.min(0.05,(t-lastT)/1000||0.016);lastT=t;
 const t0=performance.now();
 if(!paused){
  acc+=dt;SUBSTEPS=0;
  while(acc>=FIXED&&SUBSTEPS<20){stepPhysics(FIXED);raceStep(FIXED);ghostStep(FIXED);acc-=FIXED;SUBSTEPS++}
  if(acc>FIXED)acc=0;
  partStep(dt);audioFrame(dt)}
 updateCam(dt);updateGateMesh();
 resizeCheck();
 render(t);
 telePush();teleDraw();updateOSD();updateStats();drawAtt();updateDiag(dt,FIXED);
 frameMs=performance.now()-t0;fpsE=lerp(fpsE,1/Math.max(dt,1e-4),0.05);
 if(first){first=false;msg('THROUGH THE START RING — W/A/S/D + arrows fly','ok',4000)}
 window.__frame=(window.__frame||0)+1;
}
// ================= resize =================
function resize(){
 canvas.width=Math.max(2,canvas.clientWidth*devicePixelRatio|0);
 canvas.height=Math.max(2,canvas.clientHeight*devicePixelRatio|0);
 SHADOW_SZ={off:64,low:1024,high:2048}[S.shadowQ]||1024;
 buildFBOs()}
let _rszT=0;
function resizeCheck(){const w=canvas.clientWidth*devicePixelRatio|0,h=canvas.clientHeight*devicePixelRatio|0;
 if(w!==canvas.width||h!==canvas.height)resize()}
window.addEventListener('resize',()=>{clearTimeout(_rszT);_rszT=setTimeout(resize,60)});
// ================= boot =================
wireUI();
resize();
buildMeshes();
requestAnimationFrame(t=>{lastT=t;requestAnimationFrame(frame)});
// validation/debug handle
window.SIM={get D(){return D},get R(){return R},get S(){return S},get W(){return W},get ST(){return ST},
 get CAM(){return CAM},get G(){return G},get AU(){return AU},V3,QT};
