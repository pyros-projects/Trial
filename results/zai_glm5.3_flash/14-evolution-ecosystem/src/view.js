/* ============================================================================
   Rendering layer: world canvas, visualization modes, overlays, charts,
   minimap, phylogeny, inspector portrait. Consumes the SIM global.
   ==========================================================================*/
const View=(()=>{

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const TAU=Math.PI*2;

function hsl(h,s,l,a=1){ return `hsla(${h},${s}%,${l}%,${a})`; }
function mix(c1,c2,t){ // c = [h,s,l]
  return [c1[0]+(c2[0]-c1[0])*t, c1[1]+(c2[1]-c1[1])*t, c1[2]+(c2[2]-c1[2])*t];
}
function css(c,a=1){ return `hsla(${c[0]},${c[1]}%,${c[2]}%,${a})`; }
const RAMP=[ // blue→cyan→green→yellow→red
  [215,80,55],[185,75,50],[120,65,50],[60,80,55],[10,80,55]];
function rampColor(t,a=1){ t=clamp(t,0,1)*(RAMP.length-1);
  const i=Math.min(RAMP.length-2,Math.floor(t));
  return css(mix(RAMP[i],RAMP[i+1],t-i),a); }

const VIZ_MODES=[
  ['natural','Natural'],['species','Species / lineage'],['energy','Energy'],['age','Age'],
  ['generation','Generation'],['speed','Speed'],['sensor','Sensor range'],['behavior','Behavior'],
  ['fertility','Fertility'],['temperature','Temperature'],['moisture','Moisture'],['resource','Resource density'],
];
const ROLES={
  Herbivore:{h:95,s:42,l:60}, Predator:{h:12,s:55,l:52}, Scavenger:{h:260,s:22,l:62}, Omnivore:{h:55,s:45,l:58},
};
const STATES={ Foraging:'#7ed957',Hunting:'#ff8c42',Fleeing:'#ff5a5a',Courting:'#ff9ff3',Resting:'#5d9cec',Wandering:'#aab7c4' };

class Renderer{
  constructor(canvas){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.cam={x:1250,y:850,zoom:0.5};
    this.viz='natural';
    this.overlays={rays:false,steer:false,targets:false,grid:false,decide:false,names:false};
    this.density=2;
    this.selected=null;
    this.highlightSp=0;
    this.terrainDirty=true;
    this._terrainKind='';
    this.follow=false;
    this.world=null;
    this._terrain=document.createElement('canvas');
    this._field=document.createElement('canvas');
    this._fieldKind='';
  }
  resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const w=this.cv.clientWidth,h=this.cv.clientHeight;
    if(w&&h){ this.cv.width=Math.round(w*dpr); this.cv.height=Math.round(h*dpr); }
    this.dpr=dpr;
  }
  fit(){
    if(!this.world) return;
    const w=this.cv.clientWidth||1280,h=this.cv.clientHeight||800;
    this.cam.zoom=Math.min(w/this.world.W,h/this.world.H);
    this.cam.x=this.world.W/2; this.cam.y=this.world.H/2;
  }
  w2sX(x){ return (x-this.cam.x)*this.cam.zoom + this.cv.clientWidth/2; }
  w2sY(y){ return (y-this.cam.y)*this.cam.zoom + this.cv.clientHeight/2; }
  s2wX(x){ return (x-this.cv.clientWidth/2)/this.cam.zoom + this.cam.x; }
  s2wY(y){ return (y-this.cv.clientHeight/2)/this.cam.zoom + this.cam.y; }

  pick(sx,sy,r=14){
    if(!this.world) return null;
    const wx=this.s2wX(sx),wy=this.s2wY(sy);
    const rr=Math.max(r/this.cam.zoom,10);
    let best=null,bd=rr*rr;
    for(const o of this.world.organisms){
      const dx=o.x-wx,dy=o.y-wy,d2=dx*dx+dy*dy;
      const rad=Math.max(4,o.g[2]*4);
      if(d2<(rad+rr)*(rad+rr)&&d2<bd*4){ if(d2<bd||!best){bd=d2;best=o;} }
    }
    return best;
  }

  // -------------------------------------------------------------- terrain
  buildTerrain(kind){
    const w=this.world;
    const scale=Math.min(0.6,1400/w.W);
    const c=kind==='none'?this._terrain:this._field;
    if(kind!=='none'&&this._fieldKind!==kind) this.terrainDirty=true;
    if(kind==='none'){ if(this._terrainKind===this.viz&&!this.terrainDirty) return; }
    else if(!this.terrainDirty&&this._fieldKind===kind) return;
    const cw=Math.max(2,Math.round(w.W*scale)),ch=Math.max(2,Math.round(w.H*scale));
    c.width=cw; c.height=ch;
    const g=c.getContext('2d');
    if(kind==='none') this._terrainKind=this.viz; else this._fieldKind=kind;
    this.terrainDirty=false;
    for(let cy=0;cy<w.rows;cy++){
      for(let cx=0;cx<w.cols;cx++){
        const i=cy*w.cols+cx;
        const px=Math.floor(cx*cw/w.cols),py=Math.floor(cy*ch/w.rows);
        const pw=Math.ceil(cw/w.cols),ph=Math.ceil(ch/w.rows);
        if(kind==='fertility'){
          const col=View.fieldColor(w.fert[i],[95,28,14],[95,72,46]);
          g.fillStyle=`hsl(${col[0]},${col[1]}%,${col[2]}%)`;
        } else if(kind==='temperature'){
          g.fillStyle=View.rampColor((w.tempAt(cx*CELL+25,cy*CELL+25)+15)/45);
        } else if(kind==='moisture'){
          const col=View.fieldColor(clamp(w.moist[i]*w.moistMul,0,1),[210,28,16],[200,62,50]);
          g.fillStyle=`hsl(${col[0]},${col[1]}%,${col[2]}%)`;
        } else if(kind==='resource'){
          const col=View.fieldColor(clamp((w.fert[i]*clamp(w.moist[i]*w.moistMul,0,1))/0.6,0,1),[140,22,16],[105,65,48]);
          g.fillStyle=`hsl(${col[0]},${col[1]}%,${col[2]}%)`;
        } else {
          const t=w.type[i];
          if(t===2) g.fillStyle='hsl(210,45%,30%)';
          else if(t===1) g.fillStyle='hsl(35,16%,26%)';
          else{
            const f=w.fert[i],m=clamp(w.moist[i]*w.moistMul,0,1);
            g.fillStyle=`hsl(${100-28*(1-f)},${30+30*m}%,${18+18*f+7*m}%)`;
          }
        }
        g.fillRect(px,py,pw,ph);
      }
    }
    // subtle grain for natural terrain
    if(kind==='none'){
      g.globalAlpha=0.05;
      for(let k=0;k<cw*ch/160;k++){
        g.fillStyle=Math.random()<.5?'#000':'#fff';
        g.fillRect(Math.random()*cw,Math.random()*ch,1.5,1.5);
      }
      g.globalAlpha=1;
    }
  }

  // ---------------------------------------------------------------- frame
  draw(world){
    this.world=world;
    const ctx=this.ctx,cv=this.cv;
    const W=cv.clientWidth,H=cv.clientHeight;
    ctx.save();
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.clearRect(0,0,W,H);

    const fieldMode=['fertility','temperature','moisture','resource'].includes(this.viz);
    this.buildTerrain(fieldMode?this.viz:'none');
    const layer=fieldMode?this._field:this._terrain;
    if(layer.width>2){
      ctx.imageSmoothingEnabled=true;
      const z0=this.cam.zoom;
      ctx.drawImage(layer,this.w2sX(0),this.w2sY(0),this.world.W*z0,this.world.H*z0);
    }

    const light=world.light();
    const z=this.cam.zoom;
    const vx0=this.s2wX(0),vy0=this.s2wY(0),vx1=this.s2wX(W),vy1=this.s2wY(H);

    if(this.overlays.grid){
      ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
      const CS=100;
      ctx.beginPath();
      for(let x=Math.floor(vx0/CS)*CS;x<vx1;x+=CS){ const sx=this.w2sX(x); ctx.moveTo(sx,0); ctx.lineTo(sx,H); }
      for(let y=Math.floor(vy0/CS)*CS;y<vy1;y+=CS){ const sy=this.w2sY(y); ctx.moveTo(0,sy); ctx.lineTo(W,sy); }
      ctx.stroke();
    }

    // plants
    const plants=world.plants;
    const skipP=plants.length>5000?2:1;
    ctx.fillStyle='#3f7d3a';
    for(let k=0;k<plants.length;k+=skipP){
      const p=plants[k];
      if(p.x<vx0||p.x>vx1||p.y<vy0||p.y>vy1) continue;
      const r=Math.max(1.1,(1+p.e/p.maxE*1.6)*z);
      ctx.globalAlpha=0.35+0.5*(p.e/p.maxE);
      ctx.beginPath(); ctx.arc(this.w2sX(p.x),this.w2sY(p.y),r,0,TAU); ctx.fill();
    }
    ctx.globalAlpha=1;

    // corpses
    ctx.fillStyle='#7a5c40';
    for(const c of world.corpses){
      if(c.x<vx0||c.x>vx1||c.y<vy0||c.y>vy1) continue;
      const r=Math.max(1.2,(2+c.e*0.12)*z);
      ctx.beginPath(); ctx.arc(this.w2sX(c.x),this.w2sY(c.y),r,0,TAU); ctx.fill();
    }

    // organisms
    const orgs=world.organisms;
    const simple=this.density<1||orgs.length>1400;
    let maxGen=world.stats?world.stats.maxGen:1;
    for(const o of orgs){
      if(o.x<vx0-40||o.x>vx1+40||o.y<vy0-40||o.y>vy1+40) continue;
      const sx=this.w2sX(o.x),sy=this.w2sY(o.y);
      const size=o.g[2];
      const r=Math.max(1.3,size*4*z);
      const col=this.orgColor(o,maxGen);
      const dim=this.highlightSp&&o.spId!==this.highlightSp;
      ctx.globalAlpha=dim?0.18:1;
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.arc(sx,sy,r,0,TAU); ctx.fill();
      if(!simple&&r>2.4){
        // role marker: dark outline for predators, hollow for scavengers
        if(o.role==='Predator'){ ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=Math.max(1,r*0.22); ctx.stroke(); }
        else if(o.role==='Scavenger'){ ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1; ctx.stroke(); }
        ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=Math.max(0.8,r*0.16);
        ctx.beginPath(); ctx.moveTo(sx,sy);
        ctx.lineTo(sx+Math.cos(o.heading)*r*1.5,sy+Math.sin(o.heading)*r*1.5); ctx.stroke();
      }
      if(this.viz==='sensor'&&!simple){
        ctx.strokeStyle=dim?'rgba(255,255,255,0.05)':'rgba(120,220,255,0.25)';
        ctx.lineWidth=1; ctx.beginPath(); ctx.arc(sx,sy,o.g[3]*world.params.sensorMul*z,0,TAU); ctx.stroke();
      }
      if(o===this.selected){
        ctx.globalAlpha=1;
        ctx.strokeStyle='#4fd1c5'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(sx,sy,r+5,0,TAU); ctx.stroke();
        ctx.strokeStyle='rgba(79,209,197,0.4)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(sx,sy,r+9,0,TAU); ctx.stroke();
      }
      else if(this.highlightSp&&o.spId===this.highlightSp){
        ctx.strokeStyle=hsl(world.spById.get(o.spId)?.hue??0,80,60,0.9); ctx.lineWidth=1.6;
        ctx.beginPath(); ctx.arc(sx,sy,r+4,0,TAU); ctx.stroke();
      }
      if(this.overlays.rays&&!simple&&o.in&&o.out){
        ctx.lineWidth=1;
        const R=o.g[3]*world.params.sensorMul*z;
        if(o._threat){ this.ray(ctx,sx,sy,R,o.in[2],o.in[3],'rgba(255,90,90,0.6)'); }
        if(o._prey&&!dim){ this.ray(ctx,sx,sy,R,o.in[4],o.in[5],'rgba(255,140,66,0.6)'); }
        if(o.in[0]*o.in[0]+o.in[1]*o.in[1]>0.02&&!dim){ this.ray(ctx,sx,sy,R,o.in[0],o.in[1],'rgba(126,217,87,0.5)'); }
        if(o._mate&&!dim){ this.ray(ctx,sx,sy,R,o.in[6],o.in[7],'rgba(255,159,243,0.5)'); }
      }
      if(this.overlays.steer&&!simple&&r>2&&o.out){
        const L=Math.max(4,(6+18*o.out[1])*z);
        ctx.strokeStyle='rgba(255,255,255,0.75)'; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.moveTo(sx,sy);
        ctx.lineTo(sx+Math.cos(o.heading)*L,sy+Math.sin(o.heading)*L); ctx.stroke();
      }
      if(this.overlays.decide&&!simple&&z>0.28&&o.out){
        ctx.font='9px ui-monospace,monospace'; ctx.fillStyle='rgba(255,255,255,0.75)';
        ctx.fillText(`${o.out[0].toFixed(1)} ${o.out[1].toFixed(1)}`,sx+r+2,sy-2);
      }
      if(this.overlays.names&&z>0.5&&(!this.highlightSp||o.spId===this.highlightSp)){
        const sp=world.spById.get(o.spId);
        if(sp){ ctx.font='9px system-ui'; ctx.fillStyle=hsl(sp.hue,70,70,0.9); ctx.fillText(sp.name,sx+r+2,sy+9); }
      }
    }
    ctx.globalAlpha=1;

    // reserve
    if(world.reserve){
      const r=world.reserve;
      ctx.strokeStyle='rgba(80,220,160,0.9)'; ctx.lineWidth=2; ctx.setLineDash([6,4]);
      ctx.strokeRect(this.w2sX(r.x0),this.w2sY(r.y0),(r.x1-r.x0)*z,(r.y1-r.y0)*z);
      ctx.fillStyle='rgba(80,220,160,0.06)';
      ctx.fillRect(this.w2sX(r.x0),this.w2sY(r.y0),(r.x1-r.x0)*z,(r.y1-r.y0)*z);
      ctx.setLineDash([]);
    }

    // day/night tint
    if(!fieldMode){
      const a=(1-light)*0.36;
      if(a>0.01){ ctx.fillStyle=`rgba(8,10,30,${a})`; ctx.fillRect(0,0,W,H); }
    }

    // brush cursor
    if(UI.toolBrush.has(UI.tool)){
      const m=UI.pointer;
      if(m.onCanvas){
        ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.arc(this.w2sX(m.wx),this.w2sY(m.wy),UI.brushSize*z,0,TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  ray(ctx,sx,sy,R,fx,sy2,color){
    // inputs are heading-relative (fwd, side): convert to world direction
    const f=Math.sqrt(fx*fx+sy2*sy2); if(f<0.01) return;
    ctx.strokeStyle=color;
    ctx.beginPath(); ctx.moveTo(sx,sy);
    ctx.lineTo(sx+fx/f*R,sy+sy2/f*R); ctx.stroke();
  }
  orgColor(o,maxGen){
    const g=o.g;
    switch(this.viz){
      case 'natural':{ const R=ROLES[o.role]||ROLES.Omnivore; return hsl(R.h,R.s,R.l); }
      case 'species':{ const sp=this.world.spById.get(o.spId); return sp?hsl(sp.hue,68,58):'#888'; }
      case 'energy': return rampColor(o.energy/o.maxE);
      case 'age':{ const t=o.age/g[16]; return t<0.5?css(mix([190,70,60],[280,50,60],t*2)):css(mix([280,50,60],[30,85,55],(t-0.5)*2)); }
      case 'generation': return rampColor(maxGen>0?o.gen/maxGen:0);
      case 'speed': return rampColor((o.speed||0)/(g[1]*1.35*1.7));
      case 'behavior': return STATES[o.state]||'#aab7c4';
      default: return hsl(0,0,80,0.85);
    }
  }
  // -------------------------------------------------------------- minimap
  drawMinimap(mm){
    const w=this.world; if(!w) return;
    const g=mm.getContext('2d');
    const W=mm.width,H=mm.height;
    g.clearRect(0,0,W,H);
    const sx=W/w.W,sy=H/w.H;
    g.fillStyle='#0a0f16'; g.fillRect(0,0,W,H);
    for(let cy=0;cy<w.rows;cy++)for(let cx=0;cx<w.cols;cx++){
      const i=cy*w.cols+cx,t=w.type[i];
      if(t===2) g.fillStyle='rgba(70,130,200,0.7)';
      else if(t===1) g.fillStyle='rgba(90,80,70,0.8)';
      else{
        const f=w.fert[i];
        g.fillStyle=`hsl(${100-30*(1-f)},45%,${16+22*f}%)`;
      }
      g.fillRect(cx*sx,cy*sy,Math.ceil(sx),Math.ceil(sy));
    }
    g.fillStyle='#8fdc7a';
    for(const p of w.plants){ g.fillRect(p.x*sx,p.y*sy,1,1); }
    for(const o of w.organisms){
      g.fillStyle=o.role==='Predator'?'#ff6b4a':(o.role==='Scavenger'?'#b9a0e8':'#ffe08a');
      g.fillRect(o.x*sx,o.y*sy,1.6,1.6);
    }
    // viewport rect
    const cv=this.cv;
    const vx0=this.s2wX(0),vy0=this.s2wY(0),vx1=this.s2wX(cv.clientWidth),vy1=this.s2wY(cv.clientHeight);
    g.strokeStyle='rgba(255,255,255,0.8)'; g.lineWidth=1;
    g.strokeRect(vx0*sx,vy0*sy,(vx1-vx0)*sx,(vy1-vy0)*sy);
  }
}

function fieldColor(t,h1,h2){ const c=mix(h1,h2,clamp(t,0,1)); return c; }
const CELL=SIM.CELL;

// ------------------------------------------------------------------ charts
function drawSeries(cv,series,opts={}){
  const g=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  g.clearRect(0,0,W,H);
  g.fillStyle='#0a0f16'; g.fillRect(0,0,W,H);
  let mn=Infinity,mx=-Infinity,len=0;
  for(const s of series){ for(const v of s.values){ if(v<mn)mn=v; if(v>mx)mx=v; }
    len=Math.max(len,s.values.length); }
  if(!isFinite(mn)){ g.fillStyle='#33404f'; g.font='12px system-ui'; g.fillText('no data',10,H/2); return; }
  if(mn===mx){ mx=mn+1; }
  if(opts.min!=null) mn=opts.min;
  if(opts.max!=null) mx=opts.max;
  const pad=opts.pad??8, pl=opts.padl??34;
  const x0=pl,y0=pad,x1=W-8,y1=H-14;
  const X=i=>x0+(x1-x0)*(len<2?0.5:i/(len-1));
  const Y=v=>y1-(y1-y0)*((v-mn)/(mx-mn));
  g.strokeStyle='rgba(255,255,255,0.08)'; g.lineWidth=1;
  for(let k=0;k<=3;k++){ const y=y0+(y1-y0)*k/3; g.beginPath(); g.moveTo(x0,y); g.lineTo(x1,y); g.stroke(); }
  for(const s of series){
    g.strokeStyle=s.color; g.lineWidth=1.6;
    g.beginPath();
    for(let i=0;i<s.values.length;i++){
      const px=X(i),py=Y(s.values[i]);
      i?g.lineTo(px,py):g.moveTo(px,py);
    }
    g.stroke();
  }
  g.font='10px ui-monospace,monospace'; g.fillStyle='#8fa0b4';
  g.fillText(fmtNum(mx),2,y0+8); g.fillText(fmtNum(mn),2,y1);
  if(opts.now!=null){ g.fillStyle='#4fd1c5'; g.fillText(fmtNum(opts.now),2,(Y(opts.now)+y0)/2+4); }
  if(opts.labels){
    let lx=x0+4;
    for(const s of series){
      g.fillStyle=s.color;
      g.fillText(`${s.label} ${fmtNum(s.values[s.values.length-1]??0)}`,lx,y1+11);
      lx+=g.measureText(s.label+' 0000').width+8;
    }
  }
}
function fmtNum(v){
  if(!isFinite(v)) return '0';
  if(Math.abs(v)>=10000) return (v/1000).toFixed(1)+'k';
  if(Math.abs(v)>=100) return v.toFixed(0);
  return v.toFixed(Math.abs(v)<10?1:0);
}
function traitHistogram(cv,organisms,geneIdx,label,min,max){
  const g=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  g.clearRect(0,0,W,H);
  g.fillStyle='#0a0f16'; g.fillRect(0,0,W,H);
  const NB=24,bins=new Float32Array(NB);
  for(const o of organisms){
    const t=clamp((o.g[geneIdx]-min)/(max-min),0,0.999);
    bins[Math.floor(t*NB)]++;
  }
  const bm=Math.max(1,...bins);
  const x0=8,y0=8,x1=W-8,y1=H-16;
  const bw=(x1-x0)/NB;
  for(let b=0;b<NB;b++){
    const h=(y1-y0)*bins[b]/bm;
    g.fillStyle=rampColor(b/(NB-1));
    g.fillRect(x0+b*bw,y1-h,bw-1.2,h);
  }
  g.font='10px ui-monospace,monospace'; g.fillStyle='#8fa0b4';
  g.fillText((+min).toFixed(1),x0,H-3); 
  g.fillText((+max).toFixed(1),x1-30,H-3);
  g.fillStyle='#4fd1c5'; g.fillText(label+' n='+organisms.length,x0+44,H-3);
}

// --------------------------------------------------------------- phylogeny
function drawPhylo(cv,world,highlightSp,onPick){
  const g=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  g.clearRect(0,0,W,H);
  g.fillStyle='#0a0f16'; g.fillRect(0,0,W,H);
  const alive=new Set(world.organisms.map(o=>o.spId));
  let sps=world.species.filter(s=>alive.has(s.id)||world.tick-s.born<9000);
  sps=sps.slice(-42);
  if(!sps.length){ g.fillStyle='#33404f'; g.font='12px system-ui'; g.fillText('no species yet',10,H/2); return; }
  const byId=new Map(sps.map(s=>[s.id,s]));
  const depth=s=>{ let d=0,p=s.parent; while(p&&byId.has(p)&&d<20){ d++; p=byId.get(p).parent; } return d; };
  const t0=sps[0].born, t1=Math.max(world.tick,sps[sps.length-1].born+1);
  const X=t=>18+(W-36)*((t-t0)/(t1-t0));
  const maxD=Math.max(1,...sps.map(depth));
  const Y=s=>16+(H-32)*(depth(s)/maxD);
  const counts=new Map();
  for(const o of world.organisms) counts.set(o.spId,(counts.get(o.spId)||0)+1);
  g.lineWidth=1.4;
  for(const s of sps){
    if(s.parent&&byId.has(s.parent)){
      const p=byId.get(s.parent);
      g.strokeStyle=hsl(s.hue,50,45,0.65);
      g.beginPath(); g.moveTo(X(p.born),Y(p));
      g.bezierCurveTo(X(p.born+400),Y(p),X(s.born-400),Y(s),X(s.born),Y(s));
      g.stroke();
    }
  }
  cv._nodes=[];
  for(const s of sps){
    const x=X(s.born),y=Y(s);
    const n=counts.get(s.id)||0;
    const r=3+Math.min(7,Math.sqrt(n)*0.9);
    const on=alive.has(s.id);
    g.beginPath(); g.arc(x,y,r,0,TAU);
    g.fillStyle=hsl(s.hue,on?70:25,on?58:30);
    g.fill();
    if(s.id===highlightSp){ g.strokeStyle='#fff'; g.lineWidth=2; g.stroke(); }
    cv._nodes.push({x,y,r,sp:s});
    if(r>4&&on){ g.font='9px system-ui'; g.fillStyle=hsl(s.hue,60,70,0.85); g.fillText(s.name,x+r+2,y+3); }
  }
}

// ----------------------------------------------------------------- portrait
function drawPortrait(cv,world,o){
  const g=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  g.clearRect(0,0,W,H);
  g.fillStyle='#0a0f16'; g.fillRect(0,0,W,H);
  if(!o){ return; }
  const S=26/o.g[3]*60; // px per wu based on vision
  const scale=0.55;
  const cx=W/2,cy=H/2;
  const T=(x,y)=>[cx+(x-o.x)*scale*3,cy+(y-o.y)*scale*3];
  // vision circle
  g.strokeStyle='rgba(120,220,255,0.3)'; g.lineWidth=1;
  g.beginPath(); g.arc(cx,cy,o.g[3]*scale*3,0,TAU); g.stroke();
  // heading
  g.strokeStyle='#fff'; g.lineWidth=2;
  g.beginPath(); g.moveTo(cx,cy);
  g.lineTo(cx+Math.cos(o.heading)*o.g[3]*scale*3*0.4,cy+Math.sin(o.heading)*o.g[3]*scale*3*0.4); g.stroke();
  // sensor rays
  const ray=(fx,sy2,color)=>{ const f=hypot2(fx,sy2); if(f<0.02) return;
    const R=o.g[3]*scale*3;
    g.strokeStyle=color; g.lineWidth=1.4;
    g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+fx/f*R,cy+sy2/f*R); g.stroke(); };
  if(o.in){
    if(o._threat) ray(o.in[2],o.in[3],'rgba(255,90,90,0.8)');
    if(o._prey) ray(o.in[4],o.in[5],'rgba(255,140,66,0.8)');
    if(o.in[0]*o.in[0]+o.in[1]*o.in[1]>0.02) ray(o.in[0],o.in[1],'rgba(126,217,87,0.8)');
    if(o._mate) ray(o.in[6],o.in[7],'rgba(255,159,243,0.8)');
  }
  // body
  const r=Math.max(6,o.g[2]*4*scale*3);
  const sp=world.spById.get(o.spId);
  g.fillStyle=sp?hsl(sp.hue,68,58):'#999';
  g.beginPath(); g.arc(cx,cy,r,0,TAU); g.fill();
  g.strokeStyle='rgba(0,0,0,0.5)'; g.stroke();
  g.strokeStyle='#fff'; g.lineWidth=2;
  g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(o.heading)*r*1.3,cy+Math.sin(o.heading)*r*1.3); g.stroke();
  if(o.role==='Predator'){ g.strokeStyle='#300'; g.lineWidth=2; g.beginPath(); g.arc(cx,cy,r,0,TAU); g.stroke(); }
}
function hypot2(x,y){ return Math.sqrt(x*x+y*y); }

return {Renderer,VIZ_MODES,STATES,ROLES,drawSeries,traitHistogram,drawPhylo,drawPortrait,rampColor,fieldColor};
})();
