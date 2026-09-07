/* ================= camera input, picking, brush tools ================= */

const UI = { ringPts:null, ringColor:[0.3,0.95,0.8,0.9], hover:null, pinned:null, stroke:null, pointers:new Map(), lastPinch:0, uiHidden:false };

/* pointer → ray -------------------------------------------------------------- */
function pixelRay(px, py){
  const canvas = $('glc');
  const r = canvas.getBoundingClientRect();
  const ndcX = ((px-r.left)/r.width)*2-1;
  const ndcY = -(((py-r.top)/r.height)*2-1);
  const {eye,fwd,right,up} = camVectors();
  const tF = Math.tan(CAM.fov/2), asp = r.width/r.height;
  const dir = [
    fwd[0] + right[0]*ndcX*tF*asp + up[0]*ndcY*tF,
    fwd[1] + right[1]*ndcX*tF*asp + up[1]*ndcY*tF,
    fwd[2] + right[2]*ndcX*tF*asp + up[2]*ndcY*tF,
  ];
  const l = Math.hypot(...dir); dir[0]/=l; dir[1]/=l; dir[2]/=l;
  return {eye, dir};
}

/* CPU heightfield sample (with vertical exaggeration) ------------------------ */
function sampleHeight(fx, fz){
  const N=S.N;
  const cx = clamp(fx, 0, N-1.001), cz = clamp(fz, 0, N-1.001);
  const i0=cx|0, j0=cz|0, fxr=cx-i0, fzr=cz-j0, k=j0*N+i0;
  const h=S.h;
  return (h[k]*(1-fxr)+h[k+1]*fxr)*(1-fzr) + (h[k+N]*(1-fxr)+h[k+N+1]*fxr)*fzr;
}
function worldToGrid(wx, wz){
  return [ (wx/(2*S.half)+0.5)*S.N - 0.5, (wz/(2*S.half)+0.5)*S.N - 0.5 ];
}
function gridToWorld(gx, gz){
  return [ ((gx+0.5)/S.N-0.5)*2*S.half, ((gz+0.5)/S.N-0.5)*2*S.half ];
}

/* march ray against heightfield ------------------------------------------------ */
function pickTerrain(px, py){
  const {eye, dir} = pixelRay(px, py);
  const R = S.half;
  // bounding box: |x|,|z| ≤ R, y within [base, top]
  const yLo = (S.genMin - P.amp - 2)*P.ex, yHi = (S.genMax + 16)*P.ex;
  let t0 = 0.0, t1 = 6000;
  const mins=[-R,yLo,-R], maxs=[R,yHi,R];
  for(let a=0;a<3;a++){
    const d=dir[a], o=eye[a];
    if(Math.abs(d)<1e-9){ if(o<mins[a]||o>maxs[a]) return null; continue; }
    let ta=(mins[a]-o)/d, tb=(maxs[a]-o)/d;
    if(ta>tb){ const tmp=ta; ta=tb; tb=tmp; }
    t0=Math.max(t0,ta); t1=Math.min(t1,tb);
  }
  if(t0>t1) return null;
  const step=S.N>200?1.2:0.9;
  let tPrev=t0;
  const heightAt=t=>{
    const x=eye[0]+dir[0]*t, y=eye[1]+dir[1]*t, z=eye[2]+dir[2]*t;
    const [gx,gz]=worldToGrid(x,z);
    return {h:sampleHeight(gx,gz)*P.ex, gx, gz, x, y, z};
  };
  let prev=heightAt(t0);
  if(prev.h < prev.y){ /* starting under terrain (rare) */ }
  for(let t=t0+step; t<=t1; t+=step){
    const cur=heightAt(t);
    if(cur.y <= cur.h){
      // bisect between tPrev and t
      let a=tPrev, b=t;
      for(let it=0; it<12; it++){
        const m=(a+b)/2, mid=heightAt(m);
        if(mid.y <= mid.h) b=m; else a=m;
      }
      return heightAt(b);
    }
    tPrev=t;
  }
  return null;
}

/* brush application ----------------------------------------------------------- */
const TOOL_BASE = { raise:0.16, lower:0.16, smooth:0.35, flatten:0.3, water:0.6, sediment:0.6, dry:2.5 };
function applyBrush(gx, gz, tool, strengthScale){
  const N=S.N;
  const r = P.br, r2=r*r;
  const rate = TOOL_BASE[tool]*P.bs*(strengthScale===undefined?1:strengthScale);
  const i0=Math.max(0,Math.floor(gx-r)), i1=Math.min(N-1,Math.ceil(gx+r));
  const j0=Math.max(0,Math.floor(gz-r)), j1=Math.min(N-1,Math.ceil(gz+r));
  const h=S.h, w=S.w, s=S.s;
  let flatTarget = UI.flatTarget;
  for(let j=j0;j<=j1;j++){
    for(let i=i0;i<=i1;i++){
      const dx=i-gx, dz=j-gz, d2=dx*dx+dz*dz;
      if(d2>r2) continue;
      const f = 1 - Math.sqrt(d2)/r;
      const fall = f*f*(3-2*f);
      const k=j*N+i;
      switch(tool){
        case 'raise':   h[k] += rate*fall*0.5; break;
        case 'lower':   h[k] -= rate*fall*0.5; break;
        case 'smooth': {
          let sum=0, cnt=0;
          for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){
            const ii=clamp(i+di,0,N-1), jj=clamp(j+dj,0,N-1);
            sum+=h[jj*N+ii]; cnt++;
          }
          h[k] = lerp(h[k], sum/cnt, Math.min(0.9, rate*fall));
          break; }
        case 'flatten':
          if(flatTarget===undefined) break;
          h[k] = lerp(h[k], flatTarget, Math.min(0.9, rate*fall));
          break;
        case 'water':    w[k] += rate*fall*0.10; break;
        case 'sediment': s[k] += rate*fall*0.12; break;
        case 'dry':      w[k] *= Math.max(0, 1-rate*fall); s[k]*=Math.max(0,1-rate*fall*0.5); break;
      }
    }
  }
  S.dirty=true;
  S.flowDirty=true;
}

function strokeTo(gx, gz){
  const st = UI.stroke;
  if(!st) return;
  const [ax, az] = gridToWorld(st.gx, st.gz);
  const [bx, bz] = gridToWorld(gx, gz);
  const segLen = Math.max(P.br*0.4, 1.5);
  const d = Math.hypot(bx-ax, bz-az);
  if(st.first || d < segLen){
    applyBrush(gx, gz, P.tool);
    st.gx=gx; st.gz=gz; st.first=false;
  } else {
    const nSub = Math.min(24, Math.ceil(d/segLen));
    for(let q=1;q<=nSub;q++){
      const ix=lerp(ax,bx,q/nSub), iz=lerp(az,bz,q/nSub);
      const [igx,igz]=worldToGrid(ix,iz);
      applyBrush(igx,igz,P.tool, 1/nSub*1.4);
    }
    st.gx=gx; st.gz=gz;
  }
  updateRing(gx, gz);
}

function updateRing(gx, gz){
  const SEG=g.ringSeg;
  if(!UI.ringPts) UI.ringPts=new Float32Array(SEG*3);
  const r=P.br;
  for(let q=0;q<SEG;q++){
    const a=q/SEG*Math.PI*2;
    const wx=((gx+0.5)/S.N-0.5)*2*S.half + Math.cos(a)*r;
    const wz=((gz+0.5)/S.N-0.5)*2*S.half + Math.sin(a)*r;
    const [ggx,ggz]=worldToGrid(wx,wz);
    UI.ringPts[q*3]=wx; UI.ringPts[q*3+1]=sampleHeight(ggx,ggz)*P.ex+0.12; UI.ringPts[q*3+2]=wz;
  }
  UI.ringVisible=true;
  const c={raise:[0.35,0.95,0.55,0.95],lower:[0.95,0.45,0.35,0.95],smooth:[0.4,0.75,0.95,0.95],flatten:[0.95,0.8,0.35,0.95],water:[0.3,0.6,0.98,0.95],sediment:[0.75,0.5,0.25,0.95],dry:[0.98,0.9,0.4,0.95],inspect:[0.9,0.9,0.95,0.9],orbit:[0.6,0.65,0.7,0.5]};
  UI.ringColor=c[P.tool]||[1,1,1,0.9];
}

/* camera gestures --------------------------------------------------------------- */
function orbitBy(dx, dy){
  CAM.dyaw   -= dx*0.0052;
  CAM.dpitch  = clamp(CAM.dpitch + dy*0.0038, 0.06, 1.48);
}
function panBy(dx, dy){
  const {right,up,fwd} = camVectors();
  const s = CAM.dist*0.0011;
  CAM.dtx -= (right[0]*dx - up[0]*dy*1.2)*s;
  CAM.dty  = clamp(CAM.dty + up[1]*dy*1.2*s - right[1]*dx*s, (S.genMin-P.amp)*P.ex-20, (S.genMax+20)*P.ex);
  CAM.dtz -= (right[2]*dx - up[2]*dy*1.2)*s;
  const lim=S.half*1.4;
  CAM.dtx=clamp(CAM.dtx,-lim,lim); CAM.dtz=clamp(CAM.dtz,-lim,lim);
}
function zoomBy(f){
  CAM.ddist = clamp(CAM.ddist*f, S.N*0.12, S.N*4);
}

/* pointer event wiring ------------------------------------------------------------ */
function initInput(){
  const canvas = $('glc');
  canvas.addEventListener('contextmenu', e=>e.preventDefault());

  canvas.addEventListener('pointerdown', e=>{
    canvas.setPointerCapture(e.pointerId);
    UI.pointers.set(e.pointerId, {x:e.clientX, y:e.clientY, btn:e.button, shift:e.shiftKey});
    if(UI.pointers.size===2){
      // second finger cancels stroke → pinch/pan
      UI.stroke=null;
      const pts=[...UI.pointers.values()];
      UI.lastPinch={d:Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y),
                    cx:(pts[0].x+pts[1].x)/2, cy:(pts[0].y+pts[1].y)/2};
      return;
    }
    const camGesture = e.button===2 || e.button===1 || e.shiftKey || P.tool==='orbit';
    if(camGesture){
      UI.camDrag={x:e.clientX, y:e.clientY, pan:(e.button===1||e.shiftKey)};
      canvas.className='tool-orbit'; canvas.style.cursor='grabbing';
    } else {
      const hit=pickTerrain(e.clientX, e.clientY);
      if(P.tool==='inspect'){
        if(hit){ UI.pinned={gx:hit.gx, gz:hit.gz}; updateProbeCard(hit, true); }
        else { UI.pinned=null; $('probe').classList.remove('pin'); }
      } else if(hit){
        if(P.tool==='flatten'){
          const [gx,gz]=worldToGrid(hit.x,hit.z);
          UI.flatTarget=sampleHeight(gx,gz);
        }
        UI.stroke={gx:(worldToGrid(hit.x,hit.z))[0], gz:worldToGrid(hit.x,hit.z)[1], first:true};
        strokeTo(UI.stroke.gx, UI.stroke.gz);
      } else UI.stroke=null;
    }
  });

  canvas.addEventListener('pointermove', e=>{
    UI.mouse={x:e.clientX, y:e.clientY};
    const rec=UI.pointers.get(e.pointerId);
    if(rec){ rec.x=e.clientX; rec.y=e.clientY; }
    if(UI.pointers.size===2 && UI.lastPinch){
      const pts=[...UI.pointers.values()];
      const d=Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      const cx=(pts[0].x+pts[1].x)/2, cy=(pts[0].y+pts[1].y)/2;
      if(UI.lastPinch.d>0) zoomBy(UI.lastPinch.d/Math.max(d,1));
      panBy(cx-UI.lastPinch.cx, cy-UI.lastPinch.cy);
      UI.lastPinch={d, cx, cy};
      return;
    }
    if(UI.camDrag){
      const dx=e.clientX-UI.camDrag.x, dy=e.clientY-UI.camDrag.y;
      UI.camDrag.x=e.clientX; UI.camDrag.y=e.clientY;
      if(UI.camDrag.pan) panBy(dx,dy); else orbitBy(dx,dy);
      return;
    }
    if(UI.stroke){
      const hit=pickTerrain(e.clientX, e.clientY);
      if(hit) strokeTo(...worldToGrid(hit.x,hit.z));
    }
  });

  const endPointer = e=>{
    UI.pointers.delete(e.pointerId);
    if(UI.pointers.size<2) UI.lastPinch=null;
    if(UI.camDrag && (UI.pointers.size===0)){ UI.camDrag=null; canvas.style.cursor=P.tool==='orbit'?'grab':'crosshair'; }
    if(UI.pointers.size===0) UI.stroke=null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    zoomBy(Math.exp(e.deltaY*0.0011));
  }, {passive:false});
}
