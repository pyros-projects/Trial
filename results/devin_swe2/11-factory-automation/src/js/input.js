// ============================================================ input
const pointers=new Map(); // pointerId -> {x,y}
let dragging=false, dragBtn=0, dragCell=null, panning=false, panStart=null, camStart=null;
let selDragging=false, spaceHeld=false, pinchD0=0, pinchZ0=1, beltDrag=false;
let downPos=null, downTime=0, moved=false;

function canvasPos(ev){
  const r=cv.getBoundingClientRect();
  return [ev.clientX-r.left, ev.clientY-r.top];
}

cv.addEventListener('contextmenu',e=>e.preventDefault());

cv.addEventListener('pointerdown',ev=>{
  cv.setPointerCapture(ev.pointerId);
  const [sx,sy]=canvasPos(ev);
  pointers.set(ev.pointerId,{x:sx,y:sy});
  if(pointers.size===2){
    const p=[...pointers.values()];
    pinchD0=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y); pinchZ0=W.cam.z;
    panning=false;beltDrag=false;dragging=false;selDragging=false;
    return;
  }
  downPos=[sx,sy];downTime=performance.now();moved=false;
  const [cx,cy]=s2c(sx,sy);
  dragCell=[cx,cy];
  // pan triggers: middle/right button, space+drag, or pan tool
  if(ev.button===1||ev.button===2&&W.tool==='select'||spaceHeld||W.tool==='pan'){
    panning=true;panStart=[sx,sy];camStart={x:W.cam.x,y:W.cam.y};return;
  }
  if(ev.button===2){ // right-click = quick erase
    pushUndo(); if(removeEnt(cx,cy)){sfx('erase');}
    dragging=true;dragBtn=2;return;
  }
  if(ev.button!==0)return;
  // eyedropper on Alt+click
  if(ev.altKey){const e=entAt(cx,cy);if(e){copyEntConfig(e);sfx('pick');}return;}
  if(W.clip){stampClipboard(cx,cy);return;}
  const tool=W.tool;
  if(tool==='select'){
    const e=entAt(cx,cy);
    W.sel=e||null;
    selDragging=true;
    W.selRect=null;updateSelBox();
    updateInspector();
    if(e)sfx('click');
    return;
  }
  if(tool==='erase'){pushUndo();removeEnt(cx,cy);dragging=true;dragBtn=0;sfx('erase');return;}
  if(KINDS[tool]){
    pushUndo();
    if(tool==='belt'){beltDrag=true;ghostPath=[];beltTryAdd(cx,cy);}
    else tryPlace(tool,cx,cy);
    dragging=true;dragBtn=0;
  }
});

cv.addEventListener('pointermove',ev=>{
  const [sx,sy]=canvasPos(ev);
  const prev=pointers.get(ev.pointerId);
  if(prev){prev.x=sx;prev.y=sy;}
  const [cx,cy]=s2c(sx,sy);
  W.hover=[cx,cy];
  if(pointers.size===2){ // pinch
    const p=[...pointers.values()];
    const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
    if(pinchD0>0){
      const mx=(p[0].x+p[1].x)/2,my=(p[0].y+p[1].y)/2;
      const nz=clamp(pinchZ0*d/pinchD0,0.25,3);
      W.cam.x+=mx/W.cam.z-mx/nz; W.cam.y+=my/W.cam.z-my/nz; W.cam.z=nz;
    }
    return;
  }
  if(downPos&&Math.hypot(sx-downPos[0],sy-downPos[1])>4)moved=true;
  if(panning){
    W.cam.x=camStart.x-(sx-panStart[0])/W.cam.z;
    W.cam.y=camStart.y-(sy-panStart[1])/W.cam.z;
    return;
  }
  if(beltDrag){beltTryAdd(cx,cy);return;}
  if(selDragging&&moved&&W.tool==='select'){
    const a=dragCell;
    W.selRect=[a,[cx,cy]];updateSelBox();
    return;
  }
  if(dragging&&dragBtn===0){
    if(W.tool==='erase'){const e=entAt(cx,cy);if(e){removeEnt(cx,cy);}}
    else if(KINDS[W.tool]&&W.tool!=='belt'&&(cx!==dragCell[0]||cy!==dragCell[1])){
      // single-place tools: no drag paint (except poles allowed to drag-place)
      if(W.tool==='pole'){tryPlace('pole',cx,cy);}
    }
  }
  if(dragging&&dragBtn===2){if(removeEnt(cx,cy))sfx('erase');}
  updateTooltip(cx,cy,sx,sy);
});

function endPointer(ev){
  pointers.delete(ev.pointerId);
  if(beltDrag){
    // commit ghost path
    let n=0;
    for(const g of ghostPath)if(g.ok){const r=placeEnt('belt',g.x,g.y,g.dir);if(r.ent)n++;}
    if(n)sfx('belt');
    ghostPath=[];
  }
  if(selDragging&&!moved){ /* click select already done */ }
  dragging=false;panning=false;beltDrag=false;selDragging=false;downPos=null;
}
cv.addEventListener('pointerup',endPointer);
cv.addEventListener('pointercancel',endPointer);

cv.addEventListener('wheel',ev=>{
  ev.preventDefault();
  const [sx,sy]=canvasPos(ev);
  const f=ev.deltaY<0?1.12:1/1.12;
  const nz=clamp(W.cam.z*f,0.25,3);
  W.cam.x+=sx/W.cam.z-sx/nz; W.cam.y+=sy/W.cam.z-sy/nz; W.cam.z=nz;
},{passive:false});

// belt drag: extend ghostPath with L-route to (cx,cy)
function beltTryAdd(cx,cy){
  if(!inB(cx,cy))return;
  if(!ghostPath.length){
    ghostPath.push({x:cx,y:cy,dir:W.buildDir,ok:!canPlace('belt',cx,cy)||entAt(cx,cy)?.kind==='belt'});
    return;
  }
  let last=ghostPath[ghostPath.length-1];
  if(last.x===cx&&last.y===cy)return;
  // route: prefer continuing last's travel axis
  while(last.x!==cx||last.y!==cy){
    const dx=cx-last.x, dy=cy-last.y;
    let stepX=false;
    if(dx===0)stepX=false; else if(dy===0)stepX=true;
    else stepX = (last._axis==='x'); // continue same axis first
    let nx=last.x,ny=last.y,dir;
    if(stepX){nx+=Math.sign(dx);dir=dx>0?0:2;last._axis='x';}
    else{ny+=Math.sign(dy);dir=dy>0?1:3;last._axis='y';}
    // update previous cell dir to point toward this new one (cornering)
    const ndir = nx>last.x?0 : ny>last.y?1 : nx<last.x?2 : 3;
    if(ghostPath.length&&last.dir!==undefined)last.dir=ndir;
    const cellEnt=entAt(nx,ny);
    const ok=!canPlace('belt',nx,ny)||(cellEnt&&cellEnt.kind==='belt');
    const g={x:nx,y:ny,dir,ok,_axis:last._axis};
    ghostPath.push(g);last=g;
    if(ghostPath.length>600)break;
  }
}

function tryPlace(kind,x,y){
  const opts={};
  if(ISMACHINE(kind)&&W.recipeSel&&RECIPES[W.recipeSel].machine===kind)opts.recipe=W.recipeSel;
  const r=placeEnt(kind,x,y,W.buildDir,opts);
  if(r.err){toast(r.err,'err');sfx('err');}
  else{sfx('place');refreshToolCosts();}
}

// ---------------- keyboard
addEventListener('keydown',ev=>{
  if(ev.target.tagName==='INPUT'||ev.target.tagName==='SELECT'||ev.target.tagName==='TEXTAREA')return;
  const k=ev.key;
  if(k===' '){spaceHeld=true;W.paused=!W.paused;$('b-pause').textContent=W.paused?'▶':'⏸';ev.preventDefault();}
  else if(k==='.'){W.paused=true;$('b-pause').textContent='▶';stepOnce();}
  else if(k==='r'||k==='R'){
    if(W.hover){const e=entAt(W.hover[0],W.hover[1]);
      if(e){e.dir=(e.dir+1)&3;W.powerDirty=true;sfx('rotate');updateInspector();return;}}
    W.buildDir=(W.buildDir+1)&3;sfx('rotate');
  }
  else if(k==='Delete'||k==='Backspace'){
    if(W.selRect)deleteSelection();
    else if(W.sel){pushUndo();removeEnt(W.sel.x,W.sel.y);W.sel=null;updateInspector();sfx('erase');}
    else if(W.hover){const e=entAt(W.hover[0],W.hover[1]);if(e){pushUndo();removeEnt(e.x,e.y);sfx('erase');}}
  }
  else if(k==='z'&&ev.ctrlKey||k==='Z'&&ev.ctrlKey){ev.preventDefault();undo();}
  else if((k==='y'&&ev.ctrlKey)||(k==='Z'&&ev.ctrlKey&&ev.shiftKey)){ev.preventDefault();redo();}
  else if(k==='i'||k==='I'){if(W.hover){const e=entAt(W.hover[0],W.hover[1]);if(e){copyEntConfig(e);sfx('pick');}}}
  else if(k==='Escape'){W.selRect=null;W.sel=null;W.clip=null;ghostPath=[];closeMenus();updateSelBox();updateInspector();}
  else if(k==='o'||k==='O')toggleMenu('overlay',menuOverlay);
  else if(k==='a'||k==='A')elAnal.classList.toggle('hidden');
  else if(k>='1'&&k<='9'){
    const order=BUILD_ORDER.filter(t=>t!=='-');
    const i=+k-1;if(order[i])setTool(order[i]);
  }
});
addEventListener('keyup',ev=>{if(ev.key===' ')spaceHeld=false;});

// ---------------- tooltip
function updateTooltip(cx,cy,sx,sy){
  const e=entAt(cx,cy);
  const t=terrainAt(cx,cy);
  let h='';
  if(e){
    const d=KINDS[e.kind];
    h=`<span class="tt">${d.icon} ${d.name}</span> <span class="dim">${DIRNAME[e.dir]}</span>`;
    if(e.stall)h+=`<br><span style="color:${stallColor(e.stall)}">${e.stall}</span>`;
    if(ISMACHINE(e.kind)){const r=RECIPES[e.recipe];
      h+=`<br><span class="dim">${r?r.name:'no recipe'} · ${(e.progress*100)|0}%</span>`;
      h+=`<br><span class="dim">in ${bufStr(e.inBuf)} out ${bufStr(e.outBuf)}</span>`;}
    if(e.kind==='miner')h+=`<br><span class="dim">${W.deposit[cellIdx(cx,cy)]} left · ${(e.progress*100)|0}%</span>`;
    if(e.kind==='generator')h+=`<br><span class="dim">coal ${e.inBuf.coal||0} ${e.burnT>0?'· burning':''}</span>`;
    if(e.items&&e.items.length)h+=`<br><span class="dim">${e.items.map(i=>ITEMS[i.type].glyph).join(' ')}</span>`;
    if(e.inv&&bufCount(e.inv))h+=`<br><span class="dim">${bufStr(e.inv)}</span>`;
  } else if(t){
    h=`<span class="tt">${TERRAIN_NAME[t]}</span>`;
    if(t!==TERRAIN.rock)h+=`<br><span class="dim">${W.deposit[cellIdx(cx,cy)]} units — place a miner</span>`;
    else h+=`<br><span class="dim">impassable</span>`;
  } else if(KINDS[W.tool]){
    const cost=costOf(W.tool);
    h=`<span class="dim">${KINDS[W.tool].icon} place ${KINDS[W.tool].name}${cost?' · '+cost+'¢':''} · R rotates</span>`;
  }
  if(h){elTooltip.innerHTML=h;elTooltip.style.display='block';
    elTooltip.style.left=Math.min(innerWidth-250,sx+14)+'px';elTooltip.style.top=(sy+16)+'px';}
  else elTooltip.style.display='none';
}
