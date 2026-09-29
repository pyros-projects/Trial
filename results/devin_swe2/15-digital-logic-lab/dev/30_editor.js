/* ============================== EDITOR ============================== */
const cv=$('#cv'),ctx=cv.getContext('2d');
const mmc=$('#minimap'),mmx=mmc.getContext('2d');
let DPR=1,CW=0,CH=0;
function resize(){
  const r=$('#cwrap').getBoundingClientRect();DPR=Math.min(2.5,window.devicePixelRatio||1);
  CW=r.width;CH=r.height;cv.width=CW*DPR;cv.height=CH*DPR;
  if(S.settings.minimap)mmc.classList.add('show');else mmc.classList.remove('show');
  drawWave();
}
window.addEventListener('resize',resize);

const w2s=(x,y)=>({x:(x-S.view.x)*S.view.z,y:(y-S.view.y)*S.view.z});
const s2w=(x,y)=>({x:x/S.view.z+S.view.x,y:y/S.view.z+S.view.y});
const Lview=()=>({x:S.view.x,y:S.view.y,z:S.view.z,w:CW/S.view.z,h:CH/S.view.z});

/* theme palette for canvas */
function pal(){const b=document.body;
  const v=n=>getComputedStyle(b).getPropertyValue(n).trim();
  return{grid:v('--line'),w0:v('--w0'),w1:v('--w1'),wx:v('--wx'),wz:v('--wz'),wc:v('--wc'),wosc:v('--wosc'),
    panel:v('--panel'),line:v('--line'),txt:v('--txt'),txt2:v('--txt2'),acc:v('--acc'),bg:v('--bg')};}

/* ---------- hit testing ---------- */
function compAt(wx,wy){let best=null,bd=1e9;
  for(const c of S.comps.values()){const sz=CT[c.type].size(c);
    if(wx>=c.x-4&&wx<=c.x+sz.w+4&&wy>=c.y-4&&wy<=c.y+sz.h+4){
      const d=Math.hypot(wx-c.x-sz.w/2,wy-c.y-sz.h/2);if(d<bd){bd=d;best=c;}}}
  return best;}
function pinAt(wx,wy){const tol=8/S.view.z;
  for(const c of S.comps.values())for(const p of pinsOf(c)){
    if(Math.hypot(wx-(c.x+p.x),wy-(c.y+p.y))<=tol)return{c,p};}return null;}
function wireAt(wx,wy){
  for(const w of S.wires.values()){const pts=wirePts(w);
    for(let i=0;i<pts.length-1;i++){if(dSeg(wx,wy,pts[i],pts[i+1])<6/S.view.z)return w;}}
  return null;}
function dSeg(px,py,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(!l2)return Math.hypot(px-a.x,py-a.y);
  let t=((px-a.x)*dx+(py-a.y)*dy)/l2;t=clamp(t,0,1);
  return Math.hypot(px-a.x-t*dx,py-a.y-t*dy);}

function pinAbs(c,p){return{x:c.x+p.x,y:c.y+p.y}}

/* ---------- wire routing ---------- */
function wirePts(w){
  const a=S.comps.get(w.a.c),b=S.comps.get(w.b.c);if(!a||!b)return[];
  const pa=pinsOf(a).find(p=>p.name===w.a.p),pb=pinsOf(b).find(p=>p.name===w.b.p);
  if(!pa||!pb)return[];
  const A=pinAbs(a,pa),B=pinAbs(b,pb);
  if(S.settings.wireStyle==='orth'){
    const dx=Math.max(18,Math.abs(B.x-A.x)*0.45);
    const ax=A.x+(pa.dir==='out'?dx:-dx),bx=B.x+(pb.dir==='in'?-dx:dx);
    if(Math.abs(A.y-B.y)<1)return[A,B];
    return[A,{x:ax,y:A.y},{x:ax,y:B.y},{x:bx,y:B.y},B];
  }
  // curved → approximate with sampled bezier for hit/draw
  const dx=Math.max(24,Math.abs(B.x-A.x)*0.5);
  const c1={x:A.x+(pa.dir==='out'?dx:-dx),y:A.y},c2={x:B.x+(pb.dir==='in'?-dx:dx),y:B.y};
  const pts=[];for(let i=0;i<=16;i++){const t=i/16,u=1-t;
    pts.push({x:u*u*u*A.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*B.x,
              y:u*u*u*A.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*B.y});}
  return pts;
}

/* ---------- draw ---------- */
function netColor(v,P){return!v?P.wz:v.s==='z'?P.wz:v.s==='x'?P.wx:v.s==='osc'?P.wosc:v.v?P.w1:P.w0;}
function draw(){
  const P=pal();ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle=P.bg;ctx.fillRect(0,0,CW,CH);
  ctx.save();ctx.scale(S.view.z,S.view.z);ctx.translate(-S.view.x,-S.view.y);
  drawGrid(P);
  // wires
  for(const w of S.wires.values())drawWire(w,P);
  if(E.wireFrom)drawWirePreview(P);
  // comps
  for(const c of S.comps.values())drawComp(c,P);
  if(E.marquee){ctx.strokeStyle=P.acc;ctx.setLineDash([4,4]);ctx.lineWidth=1/S.view.z;
    const m=E.marquee;ctx.strokeRect(Math.min(m.x0,m.x1),Math.min(m.y0,m.y1),Math.abs(m.x1-m.x0),Math.abs(m.y1-m.y0));ctx.setLineDash([]);}
  for(const g of E.guides){ctx.strokeStyle='#ffd166';ctx.lineWidth=1/S.view.z;ctx.beginPath();
    if(g.v){ctx.moveTo(g.p,S.view.y);ctx.lineTo(g.p,S.view.y+CH/S.view.z);}else{ctx.moveTo(S.view.x,g.p);ctx.lineTo(S.view.x+CW/S.view.z,g.p);}ctx.stroke();}
  ctx.restore();
  drawMinimap(P);
}
function drawGrid(P){
  const L=Lview(),g=S.settings.grid;ctx.strokeStyle=P.grid;ctx.globalAlpha=.35;ctx.lineWidth=1/S.view.z;
  const st=S.view.z<0.5?g*4:g;
  ctx.beginPath();
  for(let x=Math.floor(L.x/st)*st;x<L.x+L.w;x+=st){ctx.moveTo(x,L.y);ctx.lineTo(x,L.y+L.h);}
  for(let y=Math.floor(L.y/st)*st;y<L.y+L.h;y+=st){ctx.moveTo(L.x,y);ctx.lineTo(L.x+L.w,y);}
  ctx.stroke();ctx.globalAlpha=1;
}
function drawWire(w,P){
  const pts=wirePts(w);if(pts.length<2)return;
  const nk=S.netOf.get(w.b.c+'.'+w.b.p);const v=S.sim.netVal.get(nk);
  const sel=S.sel.has(w.id);
  ctx.strokeStyle=sel?'#ffffff':netColor(v,P);
  ctx.lineWidth=(sel?3:2.2)/S.view.z*(pinW(S.comps.get(w.b.c),w.b.p)>1?1.6:1);
  const osc=v&&v.s==='osc';
  if(S.settings.anim&&v&&v.s==='ok'&&v.v){ctx.setLineDash([10,8]);ctx.lineDashOffset=-(performance.now()/40)%18;}
  else if(v&&(v.s==='z'||osc))ctx.setLineDash([5,5]);
  else ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
  ctx.stroke();ctx.setLineDash([]);
  if(S.settings.ovBus&&pinW(S.comps.get(w.b.c),w.b.p)>1){
    const m=pts[Math.floor(pts.length/2)];
    ctx.fillStyle=netColor(v,P);ctx.font=`${11/S.view.z*Math.min(1,S.view.z)}px monospace`;
    ctx.font='11px monospace';ctx.fillText(fmtVal(v,pinW(S.comps.get(w.b.c),w.b.p)),m.x+4,m.y-4);
  }
}
function drawWirePreview(P){
  const pts=wirePtsPreview();if(pts.length<2)return;
  ctx.strokeStyle=E.wireBad?P.wx:P.acc;ctx.setLineDash([6,4]);ctx.lineWidth=2/S.view.z;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();ctx.setLineDash([]);
}
function wirePtsPreview(){
  const {c,p}=E.wireFrom;const A=pinAbs(c,p);const B=E.mouse;
  return[{x:A.x,y:A.y},{x:B.x,y:B.y}];
}
function drawComp(c,P){
  const d=CT[c.type],sz=d.size(c),pins=pinsOf(c);
  const sel=S.sel.has(c.id);
  // body
  ctx.fillStyle=P.panel;ctx.strokeStyle=sel?P.acc:P.line;ctx.lineWidth=(sel?2.5:1.4)/S.view.z;
  roundRect(c.x,c.y,sz.w,sz.h,7);ctx.fill();ctx.stroke();
  if(S.settings.ovClock&&d.clkPin){ctx.strokeStyle='#ffd16655';ctx.lineWidth=4/S.view.z;roundRect(c.x,c.y,sz.w,sz.h,7);ctx.stroke();}
  // glyph
  ctx.fillStyle=P.txt2;ctx.font=`bold ${Math.min(16,sz.h*0.32)}px monospace`;ctx.textAlign='center';
  ctx.fillText(d.glyph,c.x+sz.w/2,c.y+sz.h*0.38);
  // labels & state
  ctx.fillStyle=P.txt;ctx.font='10px monospace';
  if(c.type==='switch'||c.type==='button'||c.type==='const'){
    const v=c.type==='const'?maskW(c.props.val,c.props.bits):(c.state.val||0);
    ctx.fillText(fmtVal(V(v),c.props.bits),c.x+sz.w/2,c.y+sz.h*0.72);
  }else if(c.type==='led'){
    const v=pinVal(c.id,'D');const on=ok(v)&&v.v;
    ctx.fillStyle=ok(v)?(v.v?P.w1:P.w0):netColor(v,P);
    ctx.beginPath();ctx.arc(c.x+sz.w/2,c.y+sz.h*0.62,6,0,7);ctx.fill();
    if(c.props.bits>1){ctx.fillStyle=P.txt;ctx.fillText(fmtVal(v,c.props.bits),c.x+sz.w/2,c.y+sz.h*0.3);}
  }else if(c.type==='display'){
    const v=pinVal(c.id,'D');ctx.fillStyle='#000';ctx.fillRect(c.x+7,c.y+12,sz.w-14,sz.h-20);
    ctx.fillStyle=ok(v)?'#7CFC00':'#284018';ctx.font=`bold ${sz.h*0.42}px monospace`;
    ctx.fillText(ok(v)?v.v.toString(16).toUpperCase().padStart(Math.ceil(c.props.bits/4),'0'):(v.s==='z'?'Z':'X'),c.x+sz.w/2,c.y+sz.h*0.68);
  }else if(d.clkPin||c.type==='ram'){
    let sv='';if(c.state.q!==undefined)sv=fmtVal(V(maskW(c.state.q,c.props.bits||1)),c.props.bits||1);
    if(c.type==='ram')sv=(c.state.mem||[]).length+'c';
    if(c.type==='clock')sv='T'+(c.props.period);
    ctx.fillStyle=P.txt;ctx.fillText(sv,c.x+sz.w/2,c.y+sz.h*0.72);
  }else if(c.type!=='led'&&c.type!=='display'){
    const q=pins.find(p=>p.name==='Q'&&p.dir==='out');
    if(q&&c.props.bits>1){const v=pinVal(c.id,'Q');ctx.fillStyle=P.txt;ctx.fillText(fmtVal(v,c.props.bits),c.x+sz.w/2,c.y+sz.h*0.72);}
  }
  // label
  ctx.fillStyle=P.txt2;ctx.font='10px monospace';ctx.textAlign='left';
  const lbl=c.label||d.label;ctx.fillText(lbl,c.x+2,c.y-5);
  if(S.settings.ovOrder&&S.sim.orderIdx.has(c.id)){
    ctx.fillStyle='#ffd166';ctx.fillText('#'+S.sim.orderIdx.get(c.id),c.x+sz.w-16,c.y-5);}
  if(S.settings.ovFanout){let f=0;for(const w of S.wires.values())if(w.a.c===c.id)f++;
    ctx.fillStyle=P.txt2;ctx.fillText('→'+f,c.x+2,c.y+sz.h+11);}
  // pins
  for(const p of pins){
    const a=pinAbs(c,p);const v=pinVal(c.id,p.name);
    ctx.fillStyle=netColor(v,P);ctx.strokeStyle=P.line;ctx.lineWidth=1/S.view.z;
    ctx.beginPath();ctx.arc(a.x,a.y,p.w>1?4.4:3.6,0,7);ctx.fill();ctx.stroke();
    if(p.w>1){ctx.fillStyle=P.txt2;ctx.font='8px monospace';ctx.textAlign=p.dir==='in'?'left':'right';
      ctx.fillText(p.w,p.dir==='in'?a.x+7:a.x-7,a.y-6);}
    if(S.view.z>0.9){ctx.fillStyle=P.txt2;ctx.font='8.5px monospace';ctx.textAlign=p.dir==='in'?'left':'right';
      ctx.fillText(p.name,p.dir==='in'?a.x+7:a.x-7,a.y+3);}
  }
  if(E.hoverPin&&E.hoverPin.c===c){const p=E.hoverPin.p;const a=pinAbs(c,p);
    ctx.strokeStyle=P.acc;ctx.lineWidth=2/S.view.z;ctx.beginPath();ctx.arc(a.x,a.y,7,0,7);ctx.stroke();}
}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawMinimap(P){
  if(!S.settings.minimap||!S.comps.size)return;
  const mw=mmc.width,mh=mmc.height;mmx.setTransform(1,0,0,1,0,0);
  mmx.fillStyle=P.panel;mmx.fillRect(0,0,mw,mh);
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const c of S.comps.values()){const s=CT[c.type].size(c);x0=Math.min(x0,c.x);y0=Math.min(y0,c.y);x1=Math.max(x1,c.x+s.w);y1=Math.max(y1,c.y+s.h);}
  const L=Lview();x0=Math.min(x0,L.x);y0=Math.min(y0,L.y);x1=Math.max(x1,L.x+L.w);y1=Math.max(y1,L.y+L.h);
  const sc=Math.min((mw-8)/(x1-x0||1),(mh-8)/(y1-y0||1));
  mmx.save();mmx.translate(4,4);mmx.scale(sc,sc);mmx.translate(-x0,-y0);
  mmx.fillStyle='#5b8dd9';
  for(const c of S.comps.values()){const s=CT[c.type].size(c);mmx.fillRect(c.x,c.y,s.w,s.h);}
  mmx.strokeStyle='#8899aa';mmx.lineWidth=1/sc;
  for(const w of S.wires.values()){const a=S.comps.get(w.a.c),b=S.comps.get(w.b.c);if(!a||!b)continue;
    mmx.beginPath();mmx.moveTo(a.x,a.y);mmx.lineTo(b.x,b.y);mmx.stroke();}
  mmx.strokeStyle='#ffd166';mmx.lineWidth=1.5/sc;mmx.strokeRect(L.x,L.y,L.w,L.h);
  mmx.restore();
}

/* ---------- interaction state ---------- */
const E={down:null,mouse:{x:0,y:0},wireFrom:null,wireBad:false,marquee:null,
  hoverPin:null,hoverComp:null,dragging:null,preDrag:null,moved:false,
  panning:false,spacePan:false,placeType:null,guides:[],btnHeld:null,pinch:null};

function snapV(v){return S.settings.snap?Math.round(v/S.settings.grid)*S.settings.grid:Math.round(v);}
function pos(e){const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}

cv.addEventListener('pointerdown',ev=>{
  cv.setPointerCapture(ev.pointerId);
  const m=pos(ev);const w=s2w(m.x,m.y);E.mouse=w;
  if(ev.pointerType==='touch')trackPinch(ev);
  if(E.pinch)return;
  if(ev.button===1||S.tool==='pan'||E.spacePan){E.panning={x:m.x,y:m.y,vx:S.view.x,vy:S.view.y};return;}
  if(E.placeType){placeComp(E.placeType,w.x,w.y);if(!ev.shiftKey)E.placeType=null;return;}
  const pin=pinAt(w.x,w.y);
  if(S.tool==='wire'&&pin){E.wireFrom={c:pin.c,p:pin.p};return;}
  if(pin){E.wireFrom={c:pin.c,p:pin.p};return;}
  const c=compAt(w.x,w.y);
  if(c){
    const wasSel=S.sel.has(c.id);
    if(ev.shiftKey||ev.ctrlKey){wasSel?S.sel.delete(c.id):S.sel.add(c.id);renderInspector();return;}
    if(!wasSel){S.sel.clear();S.sel.add(c.id);}
    renderInspector();
    if(c.type==='button'&&!wasSel){CT.button.onDown(c);dirtyNetConsumers(netOfPin(c.id,'Q'));S.sim.dirty.add(c.id);settle();probesSample();E.btnHeld=c;E.down={x:m.x,y:m.y,btn:c};return;}
    E.dragging={ids:[...S.sel],start:w,orig:new Map([...S.sel].map(id=>{const cc=S.comps.get(id);return[id,{x:cc.x,y:cc.y}];}))};
    E.preDrag=snapshot();E.moved=false;E.down={x:m.x,y:m.y,tap:c};return;
  }
  const wi=wireAt(w.x,w.y);
  if(wi){S.sel.clear();S.sel.add(wi.id);renderInspector();E.dragging={wire:wi,start:w,pre:snapshot()};E.moved=false;E.down={x:m.x,y:m.y};return;}
  if(!ev.shiftKey){S.sel.clear();renderInspector();}
  E.marquee={x0:w.x,y0:w.y,x1:w.x,y1:w.y};
  E.down={x:m.x,y:m.y};
});

cv.addEventListener('pointermove',ev=>{
  const m=pos(ev);const w=s2w(m.x,m.y);E.mouse=w;
  if(E.pinch){pinchMove(ev);return;}
  if(E.panning){S.view.x=E.panning.vx-(m.x-E.panning.x)/S.view.z;S.view.y=E.panning.vy-(m.y-E.panning.y)/S.view.z;return;}
  if(E.btnHeld&&E.down&&Math.hypot(m.x-E.down.x,m.y-E.down.y)>5){
    // convert to drag
    CT.button.onUp(E.btnHeld);S.sim.dirty.add(E.btnHeld.id);settle();probesSample();
    const c=E.btnHeld;E.btnHeld=null;
    E.dragging={ids:[c.id],start:w,orig:new Map([[c.id,{x:c.x,y:c.y}]])};E.preDrag=snapshot();E.moved=false;
  }
  if(E.wireFrom){
    const pin=pinAt(w.x,w.y);E.wireBad=false;
    if(pin)E.wireBad=!canConnect(E.wireFrom,{c:pin.c,p:pin.p}).ok;
    return;}
  if(E.dragging&&E.down){
    if(Math.hypot(m.x-E.down.x,m.y-E.down.y)>3)E.moved=true;
    if(E.dragging.ids){
      const dx=w.x-E.dragging.start.x,dy=w.y-E.dragging.start.y;
      E.guides=[];
      for(const id of E.dragging.ids){const c=S.comps.get(id);const o=E.dragging.orig.get(id);if(!c||!o)continue;
        let nx=o.x+dx,ny=o.y+dy;
        if(S.settings.snap){nx=snapV(nx);ny=snapV(ny);}
        // alignment guides vs others
        const sz=CT[c.type].size(c);
        for(const oc of S.comps.values()){if(E.dragging.ids.includes(oc.id))continue;
          const os=CT[oc.type].size(oc);
          for(const [cv2,ov2,vert] of[[nx,oc.x,1],[nx+sz.w,oc.x+os.w,1],[nx,oc.x+os.w,1],[nx+sz.w,oc.x,1],[ny,oc.y,0],[ny+sz.h,oc.y+os.h,0],[ny,oc.y+os.h,0],[ny+sz.h,oc.y,0]]){
            if(Math.abs(cv2-ov2)<5/S.view.z){if(vert){nx=ov2-(cv2-nx);E.guides.push({v:1,p:ov2});}else{ny=ov2-(cv2-ny);E.guides.push({v:0,p:ov2});}}}
        }
        c.x=nx;c.y=ny;}
      return;
    }
    if(E.dragging.wire){E.dragging.wire.pts=null;return;}
  }
  if(E.marquee){E.marquee.x1=w.x;E.marquee.y1=w.y;
    const m0x=Math.min(E.marquee.x0,w.x),m1x=Math.max(E.marquee.x0,w.x);
    const m0y=Math.min(E.marquee.y0,w.y),m1y=Math.max(E.marquee.y0,w.y);
    S.sel.clear();
    for(const c of S.comps.values()){const s=CT[c.type].size(c);
      if(c.x+s.w>m0x&&c.x<m1x&&c.y+s.h>m0y&&c.y<m1y)S.sel.add(c.id);}
    for(const wi of S.wires.values()){const a=S.comps.get(wi.a.c),b=S.comps.get(wi.b.c);
      if(a&&b&&((a.x>m0x&&a.x<m1x&&a.y>m0y&&a.y<m1y)||(b.x>m0x&&b.x<m1x&&b.y>m0y&&b.y<m1y)))S.sel.add(wi.id);}
    renderInspector();return;}
  // hover
  const hp=pinAt(w.x,w.y);E.hoverPin=hp;
  const hc=hp?null:compAt(w.x,w.y);E.hoverComp=hc;
  cv.style.cursor=hp?'crosshair':(hc?(CT[hc.type].onTap||hc.type==='button'?'pointer':'move'):'crosshair');
  tooltip(ev,hp,hc,w);
});

cv.addEventListener('pointerup',ev=>{
  const m=pos(ev);const w=s2w(m.x,m.y);
  if(E.pinch){E.pinch=null;return;}
  if(E.panning){E.panning=null;return;}
  if(E.btnHeld){const c=E.btnHeld;E.btnHeld=null;
    if(Math.hypot(m.x-E.down.x,m.y-E.down.y)<=5){}
    CT.button.onUp(c);S.sim.dirty.add(c.id);settle();probesSample();pushHist();E.down=null;return;}
  if(E.wireFrom){
    const pin=pinAt(w.x,w.y);
    if(pin)tryConnect(E.wireFrom,{c:pin.c,p:pin.p});
    E.wireFrom=null;E.wireBad=false;return;}
  if(E.dragging){
    if(E.dragging.ids&&E.moved)pushHistPre(E.preDrag);
    else if(E.down&&E.down.tap&&Math.hypot(m.x-E.down.x,m.y-E.down.y)<=5){
      const c=E.down.tap;const d=CT[c.type];
      if(d.onTap){d.onTap(c);S.sim.dirty.add(c.id);settle();probesSample();pushHist();}
    }
    E.dragging=null;E.guides=[];E.down=null;return;}
  if(E.marquee){E.marquee=null;E.down=null;return;}
  E.down=null;
});

cv.addEventListener('pointerleave',()=>{E.hoverPin=null;$('#tip').style.display='none';});

cv.addEventListener('wheel',ev=>{
  ev.preventDefault();
  const m=pos(ev);zoomAt(ev.deltaY<0?1.15:1/1.15,m.x,m.y);
},{passive:false});
function zoomAt(f,mx,my){
  const nz=clamp(S.view.z*f,0.15,6);
  const wx=S.view.x+mx/S.view.z,wy=S.view.y+my/S.view.z;
  S.view.z=nz;S.view.x=wx-mx/nz;S.view.y=wy-my/nz;}

cv.addEventListener('contextmenu',ev=>{
  ev.preventDefault();const m=pos(ev);const w=s2w(m.x,m.y);
  const pin=pinAt(w.x,w.y),c=compAt(w.x,w.y),wi=pin?null:wireAt(w.x,w.y);
  showCtx(m.x,m.y,pin,c,wi);
});
cv.addEventListener('dblclick',ev=>{
  const m=pos(ev);const w=s2w(m.x,m.y);const c=compAt(w.x,w.y);
  if(c){const n=prompt('Label',c.label||CT[c.type].label);if(n!==null){c.label=n;pushHist();renderInspector();}}
});

/* pinch zoom */
const ptrs=new Map();
function trackPinch(ev){ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(ptrs.size===2){const[a,b]=[...ptrs.values()];
    E.pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:S.view.z,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2};}}
function pinchMove(ev){if(!ptrs.has(ev.pointerId))return;
  ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(ptrs.size===2&&E.pinch){const[a,b]=[...ptrs.values()];
    const d=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    const r=cv.getBoundingClientRect();const mx=cx-r.left,my=cy-r.top;
    const nz=clamp(E.pinch.z*d/E.pinch.d,0.15,6);
    const wx=S.view.x+mx/S.view.z,wy=S.view.y+my/S.view.z;
    S.view.z=nz;S.view.x=wx-mx/nz;S.view.y=wy-my/nz;}}
cv.addEventListener('pointercancel',ev=>{ptrs.delete(ev.pointerId);E.pinch=null;});
cv.addEventListener('pointerup',ev=>ptrs.delete(ev.pointerId));

/* ---------- wiring logic ---------- */
function canConnect(F,T){
  const dc=F.c===T.c;
  if(F.c.id===T.c.id&&F.p.name===T.p.name)return{ok:false,why:'same pin'};
  const dF=F.p.dir,dT=T.p.dir;
  if(dF===dT)return{ok:false,why:'cannot connect '+dF+' to '+dT};
  // multiple drivers on one input pin = bus/contention (resolved by sim)
  if(F.p.w!==T.p.w)return{ok:false,why:'width mismatch '+F.p.w+'b ↔ '+T.p.w+'b'};
  return{ok:true};
}
function tryConnect(F,T){
  const chk=canConnect(F,T);
  if(!chk.ok){toast('✗ '+chk.why,'err');return;}
  const drv=F.p.dir==='out'?F:T,load=F.p.dir==='in'?F:T;
  const w={id:uid(),a:{c:drv.c.id,p:drv.p.name},b:{c:load.c.id,p:load.p.name}};
  S.wires.set(w.id,w);rebuildNets();
  const nk=S.netOf.get(w.b.c+'.'+w.b.p);dirtyNetConsumers(nk);S.sim.dirty.add(w.a.c);settle();probesSample();
  pushHist();toast('wired '+w.a.p+' → '+w.b.p,'ok');
}
function placeComp(type,x,y){
  const d=CT[type];const c={id:uid(),type,x:snapV(x-20),y:snapV(y-15),label:'',props:d.defProps(),state:{}};
  if(d.init)d.init(c);S.comps.set(c.id,c);rebuildNets();
  S.sel.clear();S.sel.add(c.id);S.sim.dirty.add(c.id);settle();probesSample();pushHist();renderInspector();
}

/* ---------- tooltip ---------- */
function tooltip(ev,hp,hc,w){
  const t=$('#tip');
  if(hp){const{c,p}=hp;const v=pinVal(c.id,p.name);
    t.textContent=`${p.name} (${p.dir}, ${p.w}b) = ${fmtVal(v,p.w)}`;
    t.style.display='block';t.style.left=(ev.clientX-$('#cwrap').getBoundingClientRect().left+14)+'px';t.style.top=(ev.clientY-$('#cwrap').getBoundingClientRect().top+10)+'px';}
  else if(hc){const d=CT[hc.type];const v=S.sim.orderIdx.has(hc.id)?'\neval order #'+S.sim.orderIdx.get(hc.id):'';
    t.textContent=(hc.label?hc.label+' — ':'')+d.label+v;t.style.display='block';
    const r=$('#cwrap').getBoundingClientRect();t.style.left=(ev.clientX-r.left+14)+'px';t.style.top=(ev.clientY-r.top+10)+'px';}
  else t.style.display='none';
}

/* ---------- context menu ---------- */
function showCtx(mx,my,pin,c,wi){
  const cm=$('#ctxmenu');cm.innerHTML='';cm.style.display='block';
  const r=$('#cwrap').getBoundingClientRect();
  cm.style.left=Math.min(mx,r.width-200)+'px';cm.style.top=Math.min(my,r.height-260)+'px';
  const add=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{cm.style.display='none';fn();};cm.appendChild(b);};
  const head=t=>{const h=document.createElement('div');h.className='ch';h.textContent=t;cm.appendChild(h);};
  if(pin){head(pin.p.name+' · '+pin.p.dir+' '+pin.p.w+'b');
    add('Add probe here',()=>addProbe(pin.c.id,pin.p.name));}
  else if(c){head((c.label||CT[c.type].label)+' · '+c.type);
    if(!S.sel.has(c.id)){S.sel.clear();S.sel.add(c.id);}
    add('Duplicate (Ctrl+D)',dupSel);add('Copy (Ctrl+C)',copySel);add('Delete (Del)',delSel);
    head('Truth table');
    if(['switch','button','const'].includes(c.type))add(S.ttIns.has(c.id)?'✓ TT input':'Mark as TT input',()=>{S.ttIns.has(c.id)?S.ttIns.delete(c.id):S.ttIns.add(c.id);pushHist();});
    add(S.ttOuts.has(c.id)?'✓ TT output':'Mark as TT output',()=>{S.ttOuts.has(c.id)?S.ttOuts.delete(c.id):S.ttOuts.add(c.id);pushHist();});
    head('Probes');
    for(const p of pinsOf(c))add('Probe '+p.name,()=>addProbe(c.id,p.name));}
  else if(wi){head('wire '+wi.a.p+' → '+wi.b.p);
    add('Add probe on wire',()=>addProbe(wi.b.c,wi.b.p));
    add('Delete wire',()=>{S.wires.delete(wi.id);rebuildNets();dirtyAll();settle();probesSample();pushHist();});}
  else{head('canvas');
    add('Paste',pasteClip);add('Select all',()=>{S.comps.forEach(c=>S.sel.add(c.id));S.wires.forEach(w=>S.sel.add(w.id));renderInspector();});
    add('Reset view',()=>{S.view={x:60,y:40,z:1.2};});
    add('Fit circuit',fitView);}
  const dismiss=e=>{if(cm.contains(e.target))return;cm.style.display='none';document.removeEventListener('pointerdown',dismiss);};
  setTimeout(()=>document.addEventListener('pointerdown',dismiss),0);
}
function fitView(){
  if(!S.comps.size)return;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const c of S.comps.values()){const s=CT[c.type].size(c);x0=Math.min(x0,c.x);y0=Math.min(y0,c.y);x1=Math.max(x1,c.x+s.w);y1=Math.max(y1,c.y+s.h);}
  const z=clamp(Math.min(CW/(x1-x0+120),CH/(y1-y0+120)),0.2,2.5);
  S.view.z=z;S.view.x=x0-60;S.view.y=y0-60;
}

/* ---------- clipboard / delete ---------- */
function selComps(){return[...S.sel].map(id=>S.comps.get(id)).filter(Boolean)}
function copySel(){
  const cs=selComps();if(!cs.length)return;
  const ids=new Set(cs.map(c=>c.id));
  S.clip={comps:cs.map(c=>({type:c.type,x:c.x,y:c.y,label:c.label,props:JSON.parse(JSON.stringify(c.props)),sid:c.id})),
    wires:[...S.wires.values()].filter(w=>ids.has(w.a.c)&&ids.has(w.b.c)).map(w=>({a:w.a,b:w.b}))};
  toast('copied '+cs.length+' comp(s)');
}
function pasteClip(){
  if(!S.clip)return;const map={};S.sel.clear();
  for(const cd of S.clip.comps){const c={id:uid(),type:cd.type,x:cd.x+30,y:cd.y+30,label:cd.label,props:JSON.parse(JSON.stringify(cd.props)),state:{}};
    if(CT[c.type].init)CT[c.type].init(c);map[cd.sid]=c.id;S.comps.set(c.id,c);S.sel.add(c.id);}
  for(const wd of S.clip.wires){if(map[wd.a.c]&&map[wd.b.c]){const id=uid();
    S.wires.set(id,{id,a:{c:map[wd.a.c],p:wd.a.p},b:{c:map[wd.b.c],p:wd.b.p}});}}
  rebuildNets();dirtyAll();settle();probesSample();pushHist();renderInspector();
}
function dupSel(){if(!selComps().length)return;copySel();pasteClip();}
function delSel(){
  if(!S.sel.size)return;
  for(const id of S.sel){if(S.comps.has(id)){S.comps.delete(id);S.ttIns.delete(id);S.ttOuts.delete(id);}
    else S.wires.delete(id);}
  for(const wid of[...S.wires.keys()]){const w=S.wires.get(wid);
    if(!S.comps.has(w.a.c)||!S.comps.has(w.b.c))S.wires.delete(wid);}
  S.probes=S.probes.filter(p=>{const[cid]=p.ref.split('.');return S.comps.has(cid);});
  S.sel.clear();rebuildNets();dirtyAll();settle();probesSample();pushHist();renderInspector();
}
function pushHistPre(pre){S.hist=S.hist.slice(0,S.histI+1);S.hist.push(pre);S.histI=S.hist.length-1;pushHist();}

/* ---------- keyboard ---------- */
window.addEventListener('keydown',ev=>{
  const tag=(ev.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select')return;
  const k=ev.key.toLowerCase();
  if(k===' '){E.spacePan=true;cv.classList.add('pan');ev.preventDefault();return;}
  if(ev.ctrlKey||ev.metaKey){
    if(k==='z'){ev.preventDefault();ev.shiftKey?redo():undo();}
    else if(k==='y'){ev.preventDefault();redo();}
    else if(k==='c'){ev.preventDefault();copySel();}
    else if(k==='v'){ev.preventDefault();pasteClip();}
    else if(k==='d'){ev.preventDefault();dupSel();}
    else if(k==='a'){ev.preventDefault();S.comps.forEach(c=>S.sel.add(c.id));S.wires.forEach(w=>S.sel.add(w.id));renderInspector();}
    else if(k==='s'){ev.preventDefault();saveModal();}
    return;}
  if(k==='delete'||k==='backspace')delSel();
  else if(k==='escape'){E.placeType=null;E.wireFrom=null;S.sel.clear();$('#ctxmenu').style.display='none';closeModals();renderInspector();}
  else if(k==='w')setTool('wire');else if(k==='v'&&!ev.ctrlKey)setTool('select');
  else if(k==='h')setTool('pan');
  else if(k==='t')stepTick();else if(k==='e')stepEvent();
  else if(k==='r'){S.sim.running?pauseRun():startRun();}
  else if(k==='0')simReset();
});
window.addEventListener('keyup',ev=>{if(ev.key===' '){E.spacePan=false;cv.classList.remove('pan');}});

function setTool(t){S.tool=t;$$('#toolbar [data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  cv.classList.toggle('pan',t==='pan');}
