// ============================================================ UI (DOM side)
const $=id=>document.getElementById(id);
const elStats=$('stats'),elTools=$('tools'),elInsp=$('insp'),elAnal=$('anal'),
  elContract=$('contract'),elTooltip=$('tooltip'),elMenus=$('menus'),
  elToast=$('toast'),elBanner=$('banner'),elSelBox=$('selbox');

function toast(msg,cls){
  const d=document.createElement('div');
  d.className='toast '+(cls||'');
  d.textContent=msg; elToast.appendChild(d);
  setTimeout(()=>d.remove(),3100);
}
function itemChip(t){const c=ITEMS[t];return `<span class="chip" style="background:${c.color}"></span>${c?c.name:t}`;}
function fmt(n){return n>=10000?(n/1000).toFixed(1)+'k':Math.round(n*10)/10;}

// ---------------- toolbar
function buildToolbar(){
  elTools.innerHTML='';
  const mkBtn=(id,icon,label,cost)=>{
    const b=document.createElement('button');
    b.dataset.tool=id;
    b.innerHTML=`<span class="ic">${icon}</span><span class="lbl">${label}</span>`+
      (cost!==undefined?`<span class="cost">${cost}</span>`:'');
    b.onclick=()=>{setTool(id);sfx('click');};
    elTools.appendChild(b);
  };
  for(const id of BUILD_ORDER){
    if(id==='-'){const s=document.createElement('div');s.className='tsep';elTools.appendChild(s);continue;}
    if(TOOLDEF[id]){mkBtn(id,TOOLDEF[id].icon,TOOLDEF[id].name);}
    else mkBtn(id,KINDS[id].icon,KINDS[id].name,KINDS[id].cost);
  }
  refreshToolCosts();
}
function refreshToolCosts(){
  elTools.querySelectorAll('button').forEach(b=>{
    const id=b.dataset.tool, c=b.querySelector('.cost');
    if(c&&KINDS[id]){
      const cost=costOf(id);
      c.textContent=W.settings.costMode==='on'?cost:'∞';
      b.classList.toggle('broke',W.settings.costMode==='on'&&cost>W.credits);
    }
  });
}
function setTool(t){
  W.tool=t; ghostPath=[];
  if(KINDS[t])W.buildKind=t;
  updateToolbar();
}
function updateToolbar(){
  elTools.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.tool===W.tool));
}

// ---------------- stats bar (live overlay)
let lastStatsTxt='';
function updateStatsBar(){
  const s=W.stats;
  let sup=0,dem=0; for(const n of W.nets){sup+=n.supply;dem+=n.demand;}
  const dm=W.stats.series;
  let dpm=0;
  for(const t in dm){const arr=dm[t];for(let i=Math.max(0,arr.length-10);i<arr.length;i++)dpm+=arr[i].d;}
  dpm*=6;
  const pcls=sup>=dem?'good':'bad';
  const obj=W.contract?`${itemChip(W.contract.item)} ${W.contract.got}/${W.contract.amount}`:'sandbox';
  const txt=
   `<span class="st"><span class="k">FPS</span><span class="v">${s.fps|0}</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">tick</span><span class="v">${W.tick}</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">speed</span><span class="v">${W.paused?'⏸':W.speed+'x'}</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">items</span><span class="v">${W.itemCount}</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">mach</span><span class="v good">${s.machines-s.stalled}</span><span class="k">/</span><span class="v ${s.stalled?'warn':'good'}">${s.stalled}⏸</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">⚡</span><span class="v ${pcls}">${Math.round(sup)}/${Math.round(dem)}</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">deliv</span><span class="v">${dpm.toFixed(0)}/m</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">tool</span><span class="v">${(KINDS[W.tool]||TOOLDEF[W.tool]||{name:W.tool}).name.split(' ')[0]}${KINDS[W.tool]?' '+DIRNAME[W.buildDir]:''}</span></span><span class="sep">|</span>`+
   `<span class="st"><span class="k">obj</span><span class="v">${obj}</span></span>`+
   (W.settings.costMode==='on'?`<span class="sep">|</span><span class="st"><span class="k">¢</span><span class="v ${W.credits<20?'warn':''}">${W.credits}</span></span>`:'');
  if(txt!==lastStatsTxt){elStats.innerHTML=txt;lastStatsTxt=txt;}
}

// ---------------- contract panel
function updateContractPanel(){
  if(!W.contract){elContract.classList.add('hidden');return;}
  const c=W.contract;
  elContract.classList.remove('hidden');
  const mm=Math.floor(c.left/60),ss=Math.floor(c.left%60);
  elContract.innerHTML=
    `<div><span class="ct">CONTRACT</span> ${itemChip(c.item)}</div>`+
    `<div>${c.got} / ${c.amount} delivered <span class="ctime">· ${mm}:${String(ss).padStart(2,'0')} left</span></div>`+
    `<div class="cbar"><div style="width:${(100*c.got/c.amount).toFixed(1)}%"></div></div>`+
    (W.settings.costMode==='on'?`<div class="ctime">credits: ${W.credits}</div>`:'');
}

// ---------------- banner
function showBanner(win){
  const c=W.contract;if(!c)return;
  elBanner.style.display='flex';
  $('ban-title').textContent=win?'Contract fulfilled':'Contract failed';
  $('ban-sub').innerHTML=win?
    `${itemChip(c.item)} ${c.got}/${c.amount} delivered with ${Math.round(c.left)}s to spare`:
    `Only ${c.got}/${c.amount} ${itemChip(c.item)} delivered.`;
  const s=c.score||{score:0};
  $('ban-score').textContent='Score: '+s.score;
  $('ban-detail').innerHTML=`<div class="kv"><span class="k">time bonus</span><span class="v">${s.timeBonus||0}</span></div>`+
    `<div class="kv"><span class="k">credits left</span><span class="v">${s.creditBonus||0}</span></div>`+
    `<div class="kv"><span class="k">footprint</span><span class="v">${s.footprint||0} tiles</span></div>`;
}
function hideBanner(){elBanner.style.display='none';}

// ---------------- inspector
let inspTimer=null;
function updateInspector(){
  const e=W.sel;
  if(!e){elInsp.classList.add('hidden');return;}
  elInsp.classList.remove('hidden');
  const def=KINDS[e.kind];
  let h=`<h3>${def.icon} ${def.name} <span style="color:var(--dim)">(${e.x},${e.y}) ${DIRNAME[e.dir]}</span><span class="x" id="inx">✕</span></h3>`;
  if(e.stall)h+=`<div class="kv"><span class="k">status</span><span class="v" style="color:${stallColor(e.stall)}">${e.stall}</span></div>`;
  else if(NEEDPOWER(e.kind)&&e.net<0)h+=`<div class="kv"><span class="k">status</span><span class="v" style="color:var(--warn)">unpowered</span></div>`;
  if(NEEDPOWER(e.kind)){
    const net=W.nets[e.net];
    h+=`<div class="kv"><span class="k">power</span><span class="v">${e.net<0?'—':(powerFactor(e)*100).toFixed(0)+'%'} · draw ${machineDrawOf(e).toFixed(1)}</span></div>`;
  }
  if(ISMACHINE(e.kind)){
    const r=RECIPES[e.recipe];
    h+=`<div class="kv"><span class="k">recipe</span><span class="v">${r?r.name:'—'}</span></div>`;
    h+=`<div style="margin:4px 0">`+RECIPES_FOR[e.kind].map(rid=>{
      const rr=RECIPES[rid];
      return `<button class="recbtn ${e.recipe===rid?'on':''}" data-rec="${rid}">${ITEMS[Object.keys(rr.out)[0]].glyph} ${rr.name}</button>`;
    }).join('')+`</div>`;
    h+=`<div class="kv"><span class="k">in</span><span class="v">${bufStr(e.inBuf)}</span></div>`;
    h+=`<div class="kv"><span class="k">out</span><span class="v">${bufStr(e.outBuf)}</span></div>`;
    h+=`<div class="kv"><span class="k">progress</span><span class="v">${(e.progress*100).toFixed(0)}%</span></div>`;
    // modules
    h+=`<div class="kv"><span class="k">modules</span><span class="v">⚡${e.mods.speed} ⛽${e.mods.eff} ▤${e.mods.prod}</span></div>`;
    h+=`<div class="rowbtns">`+Object.keys(MODS).map(mk=>{
      const m=MODS[mk];
      return `<button data-mod="${mk}" ${e.mods[mk]>=m.max?'disabled':''} title="${m.desc} (${m.cost}¢)">+${m.name.split(' ')[0]}</button>`;
    }).join('')+`</div>`;
  }
  if(e.kind==='miner'){
    const i=cellIdx(e.x,e.y);
    h+=`<div class="kv"><span class="k">deposit</span><span class="v">${W.deposit[i]} left</span></div>`;
    h+=`<div class="kv"><span class="k">out</span><span class="v">${bufStr(e.outBuf)}</span></div>`;
    h+=`<div class="kv"><span class="k">progress</span><span class="v">${(e.progress*100).toFixed(0)}%</span></div>`;
  }
  if(e.kind==='generator'){
    const net=W.nets[e.net];
    h+=`<div class="kv"><span class="k">fuel</span><span class="v">${e.inBuf.coal||0} coal ${e.burnT>0?'+burning '+e.burnT.toFixed(1)+'s':'(idle)'}</span></div>`;
    h+=`<div class="kv"><span class="k">output</span><span class="v">${e.burnT>0?GEN_OUT:0} PU</span></div>`;
    if(net)h+=`<div class="kv"><span class="k">network</span><span class="v">${Math.round(net.supply)}/${Math.round(net.demand)} PU (${(net.factor*100).toFixed(0)}%)</span></div>`;
  }
  if(e.items){
    h+=`<div class="kv"><span class="k">carrying</span><span class="v">${e.items.map(i=>ITEMS[i.type].glyph+(i.n>1?'×'+i.n:'')).join(' ')||'—'}</span></div>`;
    h+=`<div class="kv"><span class="k">fill</span><span class="v">${e.items.length}/3 slots</span></div>`;
  }
  if(e.kind==='storage'||e.kind==='delivery'){
    h+=`<div class="kv"><span class="k">contents</span><span class="v">${bufStr(e.inv)}</span></div>`;
  }
  if(e.kind==='inserter'){
    h+=`<div class="kv"><span class="k">holding</span><span class="v">${e.held?ITEMS[e.held.type].name+' ×'+e.held.n:'—'}</span></div>`;
  }
  h+=`<canvas class="spark" id="ispark" width="260" height="30"></canvas>`;
  h+=`<div class="rowbtns">`+
     `<button id="irot" title="Rotate (R)">⟳ Rotate</button>`+
     `<button id="icopy" title="Copy config">⧉ Copy</button>`+
     `<button id="idel" class="danger" title="Delete">✕ Delete</button></div>`;
  elInsp.innerHTML=h;
  $('inx').onclick=()=>{W.sel=null;updateInspector();};
  $('irot').onclick=()=>{e.dir=(e.dir+1)&3;W.powerDirty=true;sfx('rotate');updateInspector();};
  $('idel').onclick=()=>{pushUndo();removeEnt(e.x,e.y);sfx('erase');updateInspector();};
  $('icopy').onclick=()=>{copyEntConfig(e);sfx('pick');};
  elInsp.querySelectorAll('[data-rec]').forEach(b=>b.onclick=()=>{e.recipe=b.dataset.rec;sfx('click');updateInspector();});
  elInsp.querySelectorAll('[data-mod]').forEach(b=>b.onclick=()=>{
    const mk=b.dataset.mod,m=MODS[mk];
    if(W.settings.costMode==='on'&&W.credits<m.cost){toast('Not enough credits','err');return;}
    if(e.mods[mk]>=m.max)return;
    pushUndo(); if(W.settings.costMode==='on')W.credits-=m.cost;
    e.mods[mk]++; W.powerDirty=true; sfx('place'); updateInspector();
  });
}
function bufStr(b){
  const parts=[];for(const t in b){if(b[t]>0)parts.push(`${ITEMS[t].glyph}${b[t]}`);}
  return parts.join(' ')||'—';
}
function copyEntConfig(e){
  W.buildKind=e.kind;W.buildDir=e.dir;W.tool=e.kind;
  if(ISMACHINE(e.kind))W.recipeSel=e.recipe;
  updateToolbar();
}

// ---------------- analytics
function ratesFor(t){
  const s=W.stats.series[t]||[];
  let p=0,c=0,d=0;const n=Math.min(10,s.length);
  for(let i=s.length-n;i<s.length;i++){p+=s[i].p;c+=s[i].c;d+=s[i].d;}
  return{p:p*6,c:c*6,d:d*6}; // units/min
}
function updateAnalytics(){
  if(elAnal.classList.contains('hidden'))return;
  let h='<h3>Analytics <span class="x" id="anx">✕</span></h3>';
  h+='<table class="rate-table"><tr><th>item</th><th>+prod/m</th><th>−cons/m</th><th>➔deliv/m</th><th>stock</th></tr>';
  for(const t in ITEMS){
    const r=ratesFor(t);
    const tot=W.stats.delivered[t]||0;
    if(r.p+r.c+r.d===0&&tot===0&&!(W.stats.produced[t]))continue;
    h+=`<tr><td><span class="chip" style="background:${ITEMS[t].color}"></span>${ITEMS[t].name}</td>`+
       `<td>${r.p?r.p.toFixed(0):''}</td><td>${r.c?r.c.toFixed(0):''}</td><td>${r.d?r.d.toFixed(0):''}</td><td>${tot||''}</td></tr>`;
  }
  h+='</table><canvas class="spark" id="as-rate" width="260" height="34"></canvas>';
  // power
  let sup=0,dem=0;for(const n of W.nets){sup+=n.supply;dem+=n.demand;}
  h+=`<div class="kv" style="margin-top:6px"><span class="k">power supply/demand</span><span class="v" style="color:${sup>=dem?'var(--good)':'var(--bad)'}">${Math.round(sup)} / ${Math.round(dem)} PU</span></div>`;
  h+=`<canvas class="spark" id="as-pow" width="260" height="30"></canvas>`;
  // stalls
  const st=W.stats.stalls;
  const tot=st.starved+st.blocked+st.nopower+st.depleted+st.nofuel;
  h+=`<div class="kv"><span class="k">stalled machines</span><span class="v">${tot}</span></div><div class="stallist">`;
  if(st.nopower)h+=`<div>⚡ no power ×${st.nopower}</div>`;
  if(st.starved)h+=`<div>… starved inputs ×${st.starved}</div>`;
  if(st.blocked)h+=`<div>✦ blocked outputs ×${st.blocked}</div>`;
  if(st.nofuel)h+=`<div>▱ no fuel ×${st.nofuel}</div>`;
  if(st.depleted)h+=`<div>∅ depleted ×${st.depleted}</div>`;
  if(!tot)h+=`<div style="color:var(--dim)">no stalls detected</div>`;
  h+='</div>';
  // machine list (utilization) — top 8 by util
  const ms=[];
  for(let i=0;i<W.ents.length;i++){const e=W.ents[i];if(e&&(ISMACHINE(e.kind)||e.kind==='miner'||e.kind==='inserter'))ms.push(e);}
  ms.sort((a,b)=>(b.util||0)-(a.util||0));
  h+='<div class="kv" style="margin-top:4px"><span class="k">machines</span><span class="k">util / stall</span></div>';
  for(const e of ms.slice(0,8)){
    h+=`<div class="kv"><span class="k">${KINDS[e.kind].icon} (${e.x},${e.y})</span><span class="v">${((e.util||0)*100).toFixed(0)}% ${e.stall||''}</span></div>`;
  }
  elAnal.innerHTML=h;
  $('anx').onclick=()=>elAnal.classList.add('hidden');
  // sparklines
  drawSpark($('as-pow'),W.stats.powerSeries.map(s=>s.s),W.stats.powerSeries.map(s=>s.d));
  // combined prod rate
  const comb=[];
  const len=Math.max(0,...Object.values(W.stats.series).map(s=>s.length));
  for(let i=0;i<len;i++){let s=0;for(const t in W.stats.series){const a=W.stats.series[t];if(a[i])s+=a[i].p;}comb.push(s);}
  drawSpark($('as-rate'),comb,null,'#4ade80');
}
function drawSpark(cv2,seriesA,seriesB,colA){
  if(!cv2)return;
  const c=cv2.getContext('2d');c.clearRect(0,0,cv2.width,cv2.height);
  const all=(seriesA||[]).concat(seriesB||[]);
  const mx=Math.max(1,...all);
  const plot=(series,col)=>{
    if(!series||!series.length)return;
    c.strokeStyle=col;c.lineWidth=1.5;c.beginPath();
    series.forEach((v,i)=>{
      const x=i/(Math.max(1,series.length-1))*cv2.width;
      const y=cv2.height-2-(v/mx)*(cv2.height-6);
      i?c.lineTo(x,y):c.moveTo(x,y);
    });
    c.stroke();
  };
  plot(seriesA,colA||'#3fb6ff');plot(seriesB,'#f0a832');
}

// ---------------- menus (presets / settings / save)
let openMenu=null;
function closeMenus(){elMenus.innerHTML='';openMenu=null;}
function toggleMenu(name,builder){
  if(openMenu===name){closeMenus();return;}
  closeMenus();openMenu=name;
  const m=document.createElement('div');m.className='menu';
  const r=$('btn-'+name).getBoundingClientRect();
  m.style.top=(r.bottom+6)+'px';m.style.right=Math.max(8,innerWidth-r.right)+'px';
  builder(m);
  elMenus.appendChild(m);
}

function menuPresets(m){
  m.innerHTML='<h3>Presets & Contracts</h3>';
  const sec=(t)=>{const d=document.createElement('div');d.className='tlabel';
    d.style.cssText='color:var(--dim);font-size:10px;margin:6px 0 2px';d.textContent=t;m.appendChild(d);};
  sec('CONTRACTS');
  for(const c of CONTRACTS){
    const b=document.createElement('button');b.className='presetbtn';
    b.innerHTML=`<b>${c.name}</b><small>${c.desc}</small>`;
    b.onclick=()=>{loadPreset(c.id);closeMenus();};
    m.appendChild(b);
  }
  sec('SANDBOX PRESETS');
  for(const p of PRESETS){
    const b=document.createElement('button');b.className='presetbtn';
    b.innerHTML=`<b>${p.name}</b><small>${p.desc}</small>`;
    b.onclick=()=>{loadPreset(p.id);closeMenus();};
    m.appendChild(b);
  }
  sec('EMPTY MAP');
  const b=document.createElement('button');b.className='presetbtn';
  b.innerHTML='<b>Blank map</b><small>Fresh terrain from current seed</small>';
  b.onclick=()=>{newWorld(W.settings.gridW,W.settings.gridH,W.settings.seed);
    W.presetName='Blank';zoomFit();closeMenus();};
  m.appendChild(b);
}

function menuSettings(m){
  m.innerHTML='<h3>Simulation settings</h3>';
  const rows=[];
  for(const k in SETTINGS_DEF){
    const d=SETTINGS_DEF[k];
    const row=document.createElement('div');row.className='mrow';
    if(d.opts){
      row.innerHTML=`<label>${d.label}</label>`;
      const sel=document.createElement('select');
      d.opts.forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;sel.appendChild(op);});
      sel.value=W.settings[k];
      sel.onchange=()=>{W.settings[k]=sel.value;if(k==='costMode')refreshToolCosts();};
      row.appendChild(sel);
    } else {
      row.innerHTML=`<label>${d.label}</label>`;
      const inp=document.createElement('input');
      inp.type='text';inp.value=W.settings[k];inp.style.width='70px';
      inp.onchange=()=>{
        let v=parseFloat(inp.value);
        if(isNaN(v)){inp.value=W.settings[k];return;}
        if(d.min!==undefined)v=clamp(v,d.min,d.max);
        W.settings[k]=v;
        if((k==='gridW'||k==='gridH'||k==='seed')&&(v!==W.W&&k==='gridW'||v!==W.H&&k==='gridH'||k==='seed'))
          toast('Grid/seed applies on next blank map or preset','err');
      };
      row.appendChild(inp);
      if(d.min!==undefined)row.title=`${d.min} – ${d.max}`;
    }
    m.appendChild(row);rows.push(row);
  }
  const note=document.createElement('div');
  note.style.cssText='color:var(--dim);font-size:10px;margin-top:6px';
  note.textContent='Speed/belt/machine/density changes apply live. Grid & seed apply to new maps.';
  m.appendChild(note);
}

function menuSave(m){
  m.innerHTML='<h3>Save / Load / Share</h3>';
  const row=(html)=>{const d=document.createElement('div');d.className='mrow';d.innerHTML=html;m.appendChild(d);return d;};
  row(`<button id="sv-dl" style="flex:1">⬇ Export JSON</button><button id="sv-png" style="flex:1">🖼 PNG</button><button id="sv-share" style="flex:1">🔗 Share code</button>`);
  row(`<button id="sv-ul" style="flex:1">⬆ Import JSON…</button><button id="sv-paste" style="flex:1">📋 Import code</button><input type="file" id="sv-file" accept=".json" class="hidden">`);
  const slots=lsSlots();
  row(`<div style="width:100%;color:var(--dim);font-size:10px">NAMED SLOTS (localStorage)</div>`);
  const nr=row(`<input type="text" id="sv-name" placeholder="slot name" style="flex:1"><button id="sv-save">Save</button>`);
  const names=Object.keys(slots).sort();
  if(lsAutosaveGet()){
    const r=row(`<button style="flex:1" data-auto>↺ autosave (${new Date(JSON.parse(localStorage.getItem(LS_AUTO)).t).toLocaleTimeString()})</button>`);
    r.querySelector('[data-auto]').onclick=()=>{
      const d=lsAutosaveGet();const res=deserializeWorld(d);
      if(res.ok){toast('Autosave loaded');zoomFit();closeMenus();}else toast('Load failed: '+res.err,'err');
    };
  }
  for(const nm of names){
    const r=row(`<button style="flex:1" data-load="${nm}">${nm}</button><button class="danger" data-del="${nm}">✕</button>`);
    r.querySelector('[data-load]').onclick=()=>{
      const d=lsLoad(nm);const res=deserializeWorld(d);
      if(res.ok){toast('Loaded slot '+nm);zoomFit();closeMenus();}else toast('Load failed: '+res.err,'err');
    };
    r.querySelector('[data-del]').onclick=()=>{lsDelete(nm);closeMenus();};
  }
  m.querySelector('#sv-save').onclick=()=>{
    const nm=m.querySelector('#sv-name').value.trim()||('slot'+Date.now()%10000);
    if(lsSave(nm))toast('Saved "'+nm+'"');else toast('Save failed (storage full?)','err');
  };
  m.querySelector('#sv-dl').onclick=()=>{
    const blob=new Blob([JSON.stringify(serializeWorld())],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='foundry-save.json';a.click();URL.revokeObjectURL(a.href);
  };
  m.querySelector('#sv-ul').onclick=()=>m.querySelector('#sv-file').click();
  m.querySelector('#sv-file').onchange=ev=>{
    const f=ev.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{try{
      const res=deserializeWorld(JSON.parse(rd.result));
      if(res.ok){toast('Imported save');zoomFit();closeMenus();}
      else toast('Import failed: '+res.err,'err');
    }catch(e){toast('Import failed: bad JSON','err');}};
    rd.readAsText(f);
  };
  m.querySelector('#sv-share').onclick=()=>{
    const code=shareEncode();
    navigator.clipboard?.writeText(code).then(()=>toast('Share code copied ('+code.length+' chars)'))
      .catch(()=>{prompt('Share code:',code);});
  };
  m.querySelector('#sv-paste').onclick=()=>{
    const code=prompt('Paste share code:');
    if(!code)return;
    const r=shareDecode(code);
    if(r.err){toast('Bad code: '+r.err,'err');return;}
    const res=deserializeWorld(r.data);
    if(res.ok){toast('Share code imported');zoomFit();closeMenus();}
    else toast('Import failed: '+res.err,'err');
  };
  m.querySelector('#sv-png').onclick=()=>exportPNG();
}

function exportPNG(){
  // render whole factory bounds to offscreen canvas
  let minx=W.W,miny=W.H,maxx=0,maxy=0;
  for(let y=0;y<W.H;y++)for(let x=0;x<W.W;x++)
    if(W.ents[cellIdx(x,y)]||W.terrain[cellIdx(x,y)]){
      if(x<minx)minx=x;if(y<miny)miny=y;if(x>maxx)maxx=x;if(y>maxy)maxy=y;}
  minx=Math.max(0,minx-1);miny=Math.max(0,miny-1);
  maxx=Math.min(W.W-1,maxx+1);maxy=Math.min(W.H-1,maxy+1);
  const oc=document.createElement('canvas');
  oc.width=(maxx-minx+1)*CS;oc.height=(maxy-miny+1)*CS;
  const oc2=oc.getContext('2d');
  const oldCam={...W.cam},oldCtx=ctx;
  // temporarily render via main ctx is complex; draw simplified snapshot
  oc2.fillStyle='#0b0f14';oc2.fillRect(0,0,oc.width,oc.height);
  for(let y=miny;y<=maxy;y++)for(let x=minx;x<=maxx;x++){
    const i=cellIdx(x,y),tr=W.terrain[i];
    const px=(x-minx)*CS,py=(y-miny)*CS;
    oc2.fillStyle=tr?TERRAIN_COL[tr]:(((x+y)&1)?'#10151c':'#111720');
    oc2.fillRect(px,py,CS,CS);
    const e=W.ents[i];
    if(e){
      oc2.fillStyle=KINDS[e.kind].color;oc2.fillRect(px+2,py+2,CS-4,CS-4);
      const d=DIRS[e.dir];
      oc2.strokeStyle='#0d1117';oc2.lineWidth=3;oc2.beginPath();
      oc2.moveTo(px+CS/2-d[0]*8,py+CS/2-d[1]*8);oc2.lineTo(px+CS/2+d[0]*8,py+CS/2+d[1]*8);oc2.stroke();
      if(e.items)for(const it of e.items){
        oc2.fillStyle=ITEMS[it.type].color;
        oc2.beginPath();oc2.arc(px+CS/2+d[0]*(it.pos-0.5)*20,py+CS/2+d[1]*(it.pos-0.5)*20,4,0,TAU);oc2.fill();
      }
    }
  }
  const a=document.createElement('a');a.href=oc.toDataURL('image/png');
  a.download='foundry-factory.png';a.click();
  toast('PNG exported');
}

// ---------------- overlay menu
function menuOverlay(m){
  m.innerHTML='<h3>Overlays</h3><div class="ovlrow"></div>';
  const c=m.querySelector('.ovlrow');
  for(const [k,label] of OVERLAY_DEFS){
    const lb=document.createElement('label');
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!W.overlays[k];
    cb.onchange=()=>{W.overlays[k]=cb.checked?1:0;sfx('click');};
    lb.appendChild(cb);lb.appendChild(document.createTextNode(label));
    c.appendChild(lb);
  }
}

// ---------------- selection box actions
function updateSelBox(){
  if(!W.selRect){elSelBox.classList.add('hidden');return;}
  const [a,b]=W.selRect;
  const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]);
  const x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]);
  const [sx,sy]=cellScreen(x1+1,y0);
  elSelBox.classList.remove('hidden');
  elSelBox.style.left=(sx+6)+'px';elSelBox.style.top=sy+'px';
  if(!elSelBox.dataset.built){
    elSelBox.dataset.built='1';
    elSelBox.innerHTML='<button id="sb-copy" title="Copy cells">⧉</button>'+
      '<button id="sb-del" class="danger" title="Delete all (Del)">✕</button>';
    $('sb-del').onclick=()=>deleteSelection();
    $('sb-copy').onclick=()=>copySelection();
  }
}
function forEachSelCell(fn){
  if(!W.selRect)return;
  const [a,b]=W.selRect;
  const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]);
  const x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)fn(x,y);
}
function deleteSelection(){
  if(!W.selRect)return;
  pushUndo();let n=0;
  forEachSelCell((x,y)=>{if(removeEnt(x,y))n++;});
  W.selRect=null;updateSelBox();
  toast('Deleted '+n+' structures');sfx('erase');
}
function copySelection(){
  if(!W.selRect)return;
  const [a,b]=W.selRect;
  const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]);
  const x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]);
  W.clip={w:x1-x0+1,h:y1-y0+1,cells:[]};
  forEachSelCell((x,y)=>{
    const e=entAt(x,y);
    if(e)W.clip.cells.push({k:e.kind,dx:x-x0,dy:y-y0,dir:e.dir,recipe:e.recipe,mods:e.mods?{...e.mods}:undefined});
  });
  toast('Copied '+W.clip.cells.length+' structures — click map to stamp');sfx('pick');
  W.selRect=null;updateSelBox();
}
function stampClipboard(hx,hy){
  if(!W.clip)return;
  pushUndo();let placed=0,skipped=0;
  for(const c of W.clip.cells){
    const r=placeEnt(c.k,hx+c.dx,hy+c.dy,c.dir,{recipe:c.recipe,mods:c.mods});
    if(r.ent)placed++;else skipped++;
  }
  toast(`Stamped ${placed}${skipped?' ('+skipped+' blocked)':''}`);
  if(placed)sfx('place');
}
