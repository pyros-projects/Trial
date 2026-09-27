// ============================================================ rendering
const cv=document.getElementById('cv');
const ctx=cv.getContext('2d');
const CS=32; // world px per cell
let DPR=1;

function resizeCanvas(){
  DPR=Math.min(2.5,window.devicePixelRatio||1);
  cv.width=Math.floor(innerWidth*DPR); cv.height=Math.floor(innerHeight*DPR);
  cv.style.width=innerWidth+'px'; cv.style.height=innerHeight+'px';
}
addEventListener('resize',resizeCanvas);

function s2w(sx,sy){ return [sx/W.cam.z+W.cam.x, sy/W.cam.z+W.cam.y]; }
function s2c(sx,sy){ const [wx,wy]=s2w(sx,sy); return [Math.floor(wx/CS),Math.floor(wy/CS)]; }
function cellScreen(x,y){ return [(x*CS-W.cam.x)*W.cam.z,(y*CS-W.cam.y)*W.cam.z]; }

function zoomFit(){
  let minx=W.W,miny=W.H,maxx=0,maxy=0,found=false;
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++){
    if(W.ents[cellIdx(x,y)]||W.terrain[cellIdx(x,y)]){
      found=true; if(x<minx)minx=x; if(y<miny)miny=y; if(x>maxx)maxx=x; if(y>maxy)maxy=y;
    }
  }
  if(!found){minx=0;miny=0;maxx=W.W;maxy=W.H;}
  const pad=3; minx-=pad;miny-=pad;maxx+=pad;maxy+=pad;
  const zw=innerWidth/((maxx-minx)*CS), zh=innerHeight/((maxy-miny)*CS);
  W.cam.z=clamp(Math.min(zw,zh),0.25,2.5);
  W.cam.x=minx*CS-(innerWidth/W.cam.z-(maxx-minx)*CS)/2;
  W.cam.y=miny*CS-(innerHeight/W.cam.z-(maxy-miny)*CS)/2;
}

function draw(t){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle='#0b0f14'; ctx.fillRect(0,0,innerWidth,innerHeight);
  ctx.scale(W.cam.z,W.cam.z); ctx.translate(-W.cam.x,-W.cam.y);
  const [vx0,vy0]=s2w(0,0),[vx1,vy1]=s2w(innerWidth,innerHeight);
  const cx0=Math.max(0,Math.floor(vx0/CS)-1),cy0=Math.max(0,Math.floor(vy0/CS)-1);
  const cx1=Math.min(W.W-1,Math.ceil(vx1/CS)+1),cy1=Math.min(W.H-1,Math.ceil(vy1/CS)+1);
  const z=W.cam.z;
  // ---- terrain
  for(let y=cy0;y<=cy1;y++)for(let x=cx0;x<=cx1;x++){
    const i=cellIdx(x,y),tr=W.terrain[i];
    if(tr){
      ctx.fillStyle=TERRAIN_COL[tr];
      ctx.fillRect(x*CS,y*CS,CS,CS);
      if(tr!==TERRAIN.rock){
        // speckles
        ctx.fillStyle='rgba(255,255,255,.16)';
        for(let s=0;s<3;s++){
          const hx=hash2(x*3+s,y*7+s,11),hy=hash2(x*5,y*3+s,23);
          ctx.fillRect(x*CS+4+hx*20,y*CS+4+hy*20,3,3);
        }
      } else {
        ctx.fillStyle='rgba(0,0,0,.25)';
        ctx.fillRect(x*CS+6,y*CS+6,CS-12,CS-12);
      }
    } else {
      ctx.fillStyle=((x+y)&1)?'#10151c':'#111720';
      ctx.fillRect(x*CS,y*CS,CS,CS);
    }
  }
  // grid lines
  if(z>0.5){
    ctx.strokeStyle='rgba(60,75,95,.35)'; ctx.lineWidth=1/z; ctx.beginPath();
    for(let x=cx0;x<=cx1+1;x++){ctx.moveTo(x*CS,cy0*CS);ctx.lineTo(x*CS,(cy1+1)*CS);}
    for(let y=cy0;y<=cy1+1;y++){ctx.moveTo(cx0*CS,y*CS);ctx.lineTo((cx1+1)*CS,y*CS);}
    ctx.stroke();
  }
  // ---- entities
  for(let y=cy0;y<=cy1;y++)for(let x=cx0;x<=cx1;x++){
    const e=W.ents[cellIdx(x,y)]; if(!e)continue;
    drawEnt(e,t,z);
  }
  // ---- items on belts
  const agg = W.itemCount>3500;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(let y=cy0;y<=cy1;y++)for(let x=cx0;x<=cx1;x++){
    const e=W.ents[cellIdx(x,y)]; if(!e||!e.items)continue;
    if(agg){
      const tot=e.items.reduce((s,i)=>s+i.n,0);
      if(tot>0){
        ctx.fillStyle='rgba(240,200,90,.9)';
        ctx.font='bold 10px monospace';
        ctx.fillText(tot,x*CS+CS/2,y*CS+CS/2);
      }
      continue;
    }
    for(const it of e.items){
      const d=DIRS[e.dir];
      let px=x*CS + CS/2 + d[0]*(it.pos-0.5)*(CS-8);
      let py=y*CS + CS/2 + d[1]*(it.pos-0.5)*(CS-8);
      // splitter: drift toward chosen side near exit
      if(e.kind==='splitter'&&it.pos>0.55){
        const sd = it._side? DIRS[(e.dir+1)&3] : DIRS[(e.dir+3)&3];
        const f=(it.pos-0.55)/0.45*0.28*CS;
        px+=sd[0]*f; py+=sd[1]*f;
      }
      const c=ITEMS[it.type];
      ctx.fillStyle=c.color;
      const r= it.n>1?6:4.5;
      ctx.beginPath(); ctx.arc(px,py,r,0,TAU); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=1; ctx.stroke();
      if(it.n>1&&z>0.7){
        ctx.fillStyle='#fff'; ctx.font='bold 8px monospace';
        ctx.fillText(it.n,px,py-0.5);
      }
    }
  }
  // ---- overlays
  drawOverlays(t,cx0,cy0,cx1,cy1);
  // ---- ghosts / previews
  drawGhosts(t);
  // ---- selection rect
  if(W.selRect){
    const [a,b]=W.selRect;
    const x=Math.min(a[0],b[0])*CS,y=Math.min(a[1],b[1])*CS;
    const w=(Math.abs(a[0]-b[0])+1)*CS,h=(Math.abs(a[1]-b[1])+1)*CS;
    ctx.fillStyle='rgba(63,182,255,.12)';ctx.fillRect(x,y,w,h);
    ctx.strokeStyle='#3fb6ff';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
  }
  // selected entity outline
  if(W.sel){
    ctx.strokeStyle='#f0a832';ctx.lineWidth=2;ctx.setLineDash([6,3]);
    ctx.strokeRect(W.sel.x*CS+1,W.sel.y*CS+1,CS-2,CS-2);ctx.setLineDash([]);
  }
}

function drawEnt(e,t,z){
  const x=e.x*CS,y=e.y*CS,k=e.kind,def=KINDS[k];
  const px=x+CS/2,py=y+CS/2;
  const stall=e.stall;
  // base tile
  if(k!=='pole'){
    ctx.fillStyle=def.color;
    ctx.globalAlpha = (NEEDPOWER(k)&&powerFactor(e)<=0)?0.45:0.92;
    rr(ctx,x+2,y+2,CS-4,CS-4,4);ctx.fill();
    ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=1;rr(ctx,x+2,y+2,CS-4,CS-4,4);ctx.stroke();
  }
  ctx.fillStyle='#0d1117';
  switch(k){
    case 'belt':{
      ctx.fillStyle='#46535f';ctx.fillRect(x+2,y+2,CS-4,CS-4);
      // chevron
      const d=DIRS[e.dir];
      ctx.strokeStyle='#8fa3b8';ctx.lineWidth=3;ctx.beginPath();
      const ox=px+d[0]*5,oy=py+d[1]*5;
      ctx.moveTo(ox-d[1]*6-d[0]*5,oy-d[0]*6-d[1]*5);
      ctx.lineTo(ox,oy);
      ctx.lineTo(ox+d[1]*6-d[0]*5,oy+d[0]*6-d[1]*5);
      ctx.stroke();
      break;
    }
    case 'splitter':{
      ctx.fillStyle='#4d5f75';ctx.fillRect(x+2,y+2,CS-4,CS-4);
      ctx.strokeStyle='#c8d8ea';ctx.lineWidth=2;ctx.beginPath();
      const ld=DIRS[(e.dir+3)&3],rd=DIRS[(e.dir+1)&3];
      ctx.moveTo(px-ld[0]*9,py-ld[1]*9);ctx.lineTo(px+ld[0]*9,py+ld[1]*9);
      ctx.moveTo(px-rd[0]*9,py-rd[1]*9);ctx.lineTo(px+rd[0]*9,py+rd[1]*9);
      ctx.stroke();
      ctx.fillStyle='#c8d8ea';
      // input notch
      const bd=DIRS[OPP(e.dir)];
      ctx.fillRect(px+bd[0]*10-3,py+bd[1]*10-3,6,6);
      break;
    }
    case 'merger':{
      ctx.fillStyle='#4d5f75';ctx.fillRect(x+2,y+2,CS-4,CS-4);
      ctx.strokeStyle='#c8d8ea';ctx.lineWidth=2;ctx.beginPath();
      const d=DIRS[e.dir];
      ctx.moveTo(px-d[0]*9,py-d[1]*9);ctx.lineTo(px+d[0]*9,py+d[1]*9);
      ctx.moveTo(px+d[0]*2-d[1]*6,py+d[1]*2-d[0]*6);ctx.lineTo(px+d[0]*9,py+d[1]*9);
      ctx.lineTo(px+d[0]*2+d[1]*6,py+d[1]*2+d[0]*6);
      ctx.stroke();
      break;
    }
    case 'inserter':{
      // base + arm toward dir
      const d=DIRS[e.dir];
      const ang=Math.atan2(d[1],d[0]);
      const sw=e.held? Math.min(1,e.t*2):0;
      ctx.strokeStyle='#c8b060';ctx.lineWidth=4;ctx.beginPath();
      ctx.moveTo(px-d[0]*10,py-d[1]*10);
      const mx=px-d[0]*10+(d[0]*20)*sw, my=py-d[1]*10+(d[1]*20)*sw;
      ctx.lineTo(mx,my);ctx.stroke();
      ctx.fillStyle='#e8d080';ctx.beginPath();ctx.arc(mx,my,4,0,TAU);ctx.fill();
      if(e.held){ctx.fillStyle=ITEMS[e.held.type].color;ctx.beginPath();ctx.arc(mx,my,5,0,TAU);ctx.fill();}
      break;
    }
    case 'miner':{
      ctx.fillStyle='#2c3844';ctx.font='15px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('⛏',px,py);
      // progress bar
      bar(x+5,y+CS-7,CS-10,3,e.progress,'#f0a832');
      const left=W.deposit[cellIdx(e.x,e.y)];
      if(left<200&&z>0.8){ctx.fillStyle='#f87171';ctx.font='8px monospace';ctx.fillText(left,px,y+8);}
      break;
    }
    case 'smelter': case 'assembler':{
      ctx.fillStyle='#0d1117';ctx.font='13px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(k==='smelter'?'♨':'⚒',px,py-3);
      const r=RECIPES[e.recipe];
      if(r&&z>0.6){
        const outs=Object.keys(r.out);
        ctx.font='9px monospace';
        ctx.fillStyle=ITEMS[outs[0]].color;
        ctx.fillText(ITEMS[outs[0]].glyph,px,py+7);
      }
      bar(x+5,y+CS-6,CS-10,3,e.working?e.progress:0,'#4ade80');
      // output arrow
      dirArrow(e.dir,px,py,'#4ade80');
      break;
    }
    case 'generator':{
      ctx.fillStyle='#0d1117';ctx.font='14px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('⚡',px,py-2);
      const fuelT=(e.inBuf.coal||0)+ (e.burnT>0?1:0);
      bar(x+5,y+CS-6,CS-10,3,Math.min(1,fuelT/8), e.burnT>0?'#fbbf24':'#6b7280');
      if(e.burnT>0){
        ctx.fillStyle=`rgba(251,191,36,${0.25+0.2*Math.sin(t*8)})`;
        ctx.beginPath();ctx.arc(px,py,10+2*Math.sin(t*8),0,TAU);ctx.fill();
      }
      break;
    }
    case 'pole':{
      ctx.strokeStyle='#e8c840';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(px,py-8);ctx.lineTo(px,py+8);
      ctx.moveTo(px-6,py-4);ctx.lineTo(px+6,py-4);ctx.stroke();
      ctx.fillStyle='#e8c840';ctx.beginPath();ctx.arc(px,py-8,2.5,0,TAU);ctx.fill();
      break;
    }
    case 'storage':{
      ctx.strokeStyle='#8898a8';ctx.lineWidth=2;
      ctx.strokeRect(x+7,y+8,CS-14,CS-16);
      const tot=bufCount(e.inv);
      bar(x+8,y+CS-12,CS-16,4,tot/STORAGE_CAP,'#8898a8');
      if(tot>0&&z>0.6){ctx.fillStyle='#d7e1ec';ctx.font='9px monospace';ctx.fillText(tot,px,py-2);}
      break;
    }
    case 'delivery':{
      ctx.strokeStyle='#48c888';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(px,py,10,0,TAU);ctx.stroke();
      ctx.beginPath();ctx.arc(px,py,4,0,TAU);ctx.stroke();
      const p=0.15*Math.sin(t*3)+0.85;
      ctx.strokeStyle=`rgba(72,200,136,${p})`;
      ctx.beginPath();ctx.arc(px,py,12+3*Math.sin(t*3),0,TAU);ctx.stroke();
      break;
    }
  }
  // status glyph (subtle, always on if status overlay)
  if(W.overlays.status&&stall){
    ctx.fillStyle=stallColor(stall);ctx.font='bold 10px monospace';ctx.textAlign='right';
    ctx.fillText(stallIcon(stall),x+CS-4,y+9);
    ctx.textAlign='center';
  }
}
function stallIcon(s){return s==='nopower'?'⚡':s==='starved'?'…':s==='blocked'?'✦':s==='depleted'?'∅':s==='nofuel'?'▱':s==='idle'?'·':'!';}
function stallColor(s){return s==='nopower'?'#fbbf24':s==='blocked'?'#f87171':s==='starved'?'#fb923c':'#9ca3af';}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function bar(x,y,w,h,f,col){f=clamp(f,0,1);ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(x,y,w,h);ctx.fillStyle=col;ctx.fillRect(x,y,w*f,h);}
function dirArrow(d,px,py,col){
  const v=DIRS[d];ctx.fillStyle=col;ctx.beginPath();
  const bx=px+v[0]*10,by=py+v[1]*10;
  ctx.moveTo(bx+v[0]*3,by+v[1]*3);
  ctx.lineTo(bx-v[0]*3-v[1]*4,by-v[1]*3-v[0]*4);
  ctx.lineTo(bx-v[0]*3+v[1]*4,by-v[1]*3+v[0]*4);
  ctx.closePath();ctx.fill();
}

// ---------------- overlays
function drawOverlays(t,cx0,cy0,cx1,cy1){
  const o=W.overlays;
  if(!(o.flow||o.conn||o.power||o.util||o.cong||o.blocked))return;
  const NETCOL=['#3fb6ff','#4ade80','#f0a832','#f87171','#c084fc','#2dd4bf','#f472b6','#a3e635'];
  for(let y=cy0;y<=cy1;y++)for(let x=cx0;x<=cx1;x++){
    const e=W.ents[cellIdx(x,y)];if(!e)continue;
    const px=e.x*CS,py=e.y*CS;
    if(o.flow&&ISBELT(e.kind)){
      // animated flow chevrons
      const d=DIRS[e.dir];
      const ph=(t*1.2)%1;
      ctx.strokeStyle='rgba(63,182,255,.55)';ctx.lineWidth=2;ctx.beginPath();
      for(let s=0;s<2;s++){
        const p=((ph+s*0.5)%1);
        const ax=px+CS/2+d[0]*(p-0.5)*(CS-10), ay=py+CS/2+d[1]*(p-0.5)*(CS-10);
        ctx.moveTo(ax-d[0]*3-d[1]*4,ay-d[1]*3-d[0]*4);
        ctx.lineTo(ax,ay);ctx.lineTo(ax-d[0]*3+d[1]*4,ay-d[1]*3+d[0]*4);
      }
      ctx.stroke();
    }
    if(o.cong&&e.items&&e.items.length){
      const f=e.items.length/3;
      ctx.fillStyle=`rgba(248,113,113,${f*0.45})`;ctx.fillRect(px+2,py+2,CS-4,CS-4);
    }
    if(o.util&&NEEDPOWER(e.kind)){
      const u=clamp(e.util||0,0,1);
      ctx.fillStyle=`rgba(${Math.round(248-(248-74)*u)},${Math.round(113+(222-113)*u)},113,.35)`;
      ctx.fillRect(px+2,py+2,CS-4,CS-4);
    }
    if(o.blocked&&(e.stall==='blocked'||e.stall==='nopower')){
      ctx.strokeStyle='#f87171';ctx.lineWidth=2;ctx.strokeRect(px+1,py+1,CS-2,CS-2);
    }
    if(o.conn){
      ctx.strokeStyle='rgba(160,180,200,.5)';ctx.lineWidth=1.5;ctx.beginPath();
      const cxp=px+CS/2,cyp=py+CS/2;
      if(ISBELT(e.kind)){
        const targets=e.kind==='splitter'?splitterTargets(e):[forwardCell(e)];
        for(const [tx,ty] of targets){ctx.moveTo(cxp,cyp);ctx.lineTo(tx*CS+CS/2,ty*CS+CS/2);}
      } else if(ISMACHINE(e.kind)||e.kind==='miner'||e.kind==='generator'){
        const [fx,fy]=forwardCell(e);
        ctx.moveTo(cxp,cyp);ctx.lineTo(fx*CS+CS/2,fy*CS+CS/2);
      } else if(e.kind==='inserter'){
        const d=DIRS[e.dir];
        ctx.moveTo(cxp-d[0]*CS,cyp-d[1]*CS);ctx.lineTo(cxp,cyp);
        ctx.lineTo(cxp+d[0]*CS,cyp+d[1]*CS);
      }
      ctx.stroke();
    }
    if(o.power){
      if(e.kind==='pole'||e.kind==='generator'){
        const nc=e.net>=0?NETCOL[e.net%NETCOL.length]:'#666';
        ctx.strokeStyle=nc;ctx.globalAlpha=.5;ctx.lineWidth=1.5;
        ctx.strokeRect(px-POLE_RANGE*CS,py-POLE_RANGE*CS,(2*POLE_RANGE+1)*CS,(2*POLE_RANGE+1)*CS);
        ctx.globalAlpha=1;
      }
      if(NEEDPOWER(e.kind)){
        ctx.fillStyle=e.net>=0?NETCOL[e.net%NETCOL.length]:'rgba(248,113,113,.8)';
        ctx.fillRect(px+CS-8,py+3,5,5);
      }
    }
  }
  // power net links
  if(o.power){
    ctx.lineWidth=1.5;
    for(const n of W.nets){
      ctx.strokeStyle=NETCOL[W.nets.indexOf(n)%NETCOL.length];ctx.globalAlpha=.6;
      ctx.beginPath();
      for(const m of n.members)for(const m2 of n.members){
        if(m!==m2&&Math.max(Math.abs(m.x-m2.x),Math.abs(m.y-m2.y))<=POLE_RANGE){
          ctx.moveTo(m.x*CS+CS/2,m.y*CS+CS/2);ctx.lineTo(m2.x*CS+CS/2,m2.y*CS+CS/2);
        }
      }
      ctx.stroke();ctx.globalAlpha=1;
    }
  }
}

// ---------------- build ghosts
let ghostPath=[]; // belt drag preview cells [{x,y,dir,ok}]
function drawGhosts(t){
  const hov=W.hover;
  if(!hov)return;
  const [hx,hy]=hov;
  const k=W.tool;
  if(ghostPath.length&&k==='belt'){
    for(const g of ghostPath){
      ctx.globalAlpha=.55;
      if(g.ok){ctx.fillStyle='#5c6b7d';ctx.fillRect(g.x*CS+2,g.y*CS+2,CS-4,CS-4);
        const d=DIRS[g.dir];ctx.strokeStyle='#c8d8ea';ctx.lineWidth=3;ctx.beginPath();
        const px=g.x*CS+CS/2+d[0]*5,py=g.y*CS+CS/2+d[1]*5;
        ctx.moveTo(px-d[1]*6-d[0]*5,py-d[0]*6-d[1]*5);ctx.lineTo(px,py);ctx.lineTo(px+d[1]*6-d[0]*5,py+d[0]*6-d[1]*5);ctx.stroke();
      } else {ctx.fillStyle='rgba(248,113,113,.5)';ctx.fillRect(g.x*CS+2,g.y*CS+2,CS-4,CS-4);}
      ctx.globalAlpha=1;
    }
    return;
  }
  if(KINDS[k]){
    const ok=!canPlace(k,hx,hy)&&(!W.settings.costMode||W.settings.costMode!=='on'||costOf(k)<=W.credits);
    ctx.globalAlpha=.55;
    ctx.fillStyle=ok?KINDS[k].color:'#f87171';
    ctx.fillRect(hx*CS+2,hy*CS+2,CS-4,CS-4);
    ctx.globalAlpha=1;
    const d=DIRS[W.buildDir];
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();
    const px=hx*CS+CS/2,py=hy*CS+CS/2;
    ctx.moveTo(px,py);ctx.lineTo(px+d[0]*10,py+d[1]*10);ctx.stroke();
    if(k==='pole'){
      ctx.strokeStyle='rgba(232,200,64,.4)';ctx.lineWidth=1;
      ctx.strokeRect(hx*CS-POLE_RANGE*CS,hy*CS-POLE_RANGE*CS,(2*POLE_RANGE+1)*CS,(2*POLE_RANGE+1)*CS);
    }
  } else if(k==='erase'){
    ctx.strokeStyle='#f87171';ctx.lineWidth=2;ctx.strokeRect(hx*CS+1,hy*CS+1,CS-2,CS-2);
  }
}
