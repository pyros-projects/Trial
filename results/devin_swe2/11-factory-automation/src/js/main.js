// ============================================================ main loop & boot
let lastT=0, fpsAcc=0, fpsN=0, fpsT=0;
let uiTick=0;

function loop(t){
  const dt=Math.min(0.1,(t-lastT)/1000)||0.016;
  lastT=t;
  // fps meter
  fpsAcc+=dt;fpsN++;fpsT+=dt;
  if(fpsT>0.5){W.stats.fps=fpsN/fpsT;fpsN=0;fpsT=0;}
  frame(dt);
  draw(t/1000);
  uiTick+=dt;
  if(uiTick>0.25){
    uiTick=0;
    updateStatsBar();
    if(W.contract&&!W.contract.done)updateContractPanel();
    if(W.sel)updateInspector();
    updateAnalytics();
    refreshToolCosts();
  }
  requestAnimationFrame(loop);
}

// ---------------- buttons
function wireUI(){
  buildToolbar();
  $('b-pause').onclick=()=>{W.paused=!W.paused;$('b-pause').textContent=W.paused?'▶':'⏸';sfx('click');};
  $('b-step').onclick=()=>{W.paused=true;$('b-pause').textContent='▶';stepOnce();sfx('click');};
  $('b-undo').onclick=()=>undo();
  $('b-redo').onclick=()=>redo();
  $('b-reset').onclick=()=>{
    if(confirm('Reset factory? Current layout will be lost.')){
      if(W.presetName){const p=[...PRESETS,...CONTRACTS].find(p=>p.name===W.presetName);
        if(p){loadPreset(p.id);return;}}
      newWorld(W.settings.gridW,W.settings.gridH,W.settings.seed);
      zoomFit();
    }
  };
  $('sel-speed').onchange=e=>{W.speed=parseFloat(e.target.value);sfx('click');};
  $('b-zin').onclick=()=>{W.cam.z=clamp(W.cam.z*1.25,0.25,3);};
  $('b-zout').onclick=()=>{W.cam.z=clamp(W.cam.z/1.25,0.25,3);};
  $('b-zfit').onclick=()=>zoomFit();
  $('btn-overlay').onclick=()=>toggleMenu('overlay',menuOverlay);
  $('btn-presets').onclick=()=>toggleMenu('presets',menuPresets);
  $('btn-settings').onclick=()=>toggleMenu('settings',menuSettings);
  $('btn-save').onclick=()=>toggleMenu('save',menuSave);
  $('btn-analytics').onclick=()=>elAnal.classList.toggle('hidden');
  $('btn-sound').onclick=()=>{
    AudioSys.enabled=!AudioSys.enabled;
    $('btn-sound').textContent=AudioSys.enabled?'🔊':'🔇';
    if(AudioSys.enabled)sfx('click');
  };
  $('ban-again').onclick=()=>{
    const c=[...CONTRACTS].find(c=>c.name===W.presetName)||CONTRACTS[0];
    hideBanner();loadPreset(c.id);
  };
  $('ban-sandbox').onclick=()=>{W.contract=null;W.mode='sandbox';hideBanner();updateContractPanel();};
  $('ban-close').onclick=()=>hideBanner();
  // close menus when clicking canvas
  cv.addEventListener('pointerdown',()=>closeMenus(),{capture:true});
}

// ---------------- autosave every 20s
setInterval(()=>{lsAutosave();},20000);
addEventListener('beforeunload',()=>lsAutosave());

// ---------------- debug/testing API (also used by validator)
window.GAME={
  W, entAt, terrainAt, placeEnt, removeEnt, serializeWorld, deserializeWorld,
  shareEncode, shareDecode, loadPreset, simTick, stepOnce, zoomFit,
  state(){ let sup=0,dem=0;for(const n of W.nets){sup+=n.supply;dem+=n.demand;}
    return{tick:W.tick,items:W.itemCount,machines:W.stats.machines,stalled:W.stats.stalled,
      supply:sup,demand:dem,delivered:{...W.stats.delivered},credits:W.credits,
      contract:W.contract?{item:W.contract.item,got:W.contract.got,amount:W.contract.amount,done:W.contract.done}:null,
      ents:W.ents.filter(Boolean).length, stalls:{...W.stats.stalls}};},
};

// ---------------- boot
resizeCanvas();
wireUI();
loadPreset('starter');
zoomFit();
requestAnimationFrame(loop);
