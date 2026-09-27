// ============================================================ presets & contracts
// Geometry rules:
//  - belt pushes items to the cell its dir faces; merges allowed into
//    belt cells from side/behind (never head-on)
//  - machine input = item pushed INTO its cell; output pushed to dir cell
//  - inserter dir=d: grabs from (x-d,y-d), places to (x+d,y+d); grabs only
//    items the target machine accepts (filter behavior)
//  - splitter dir=d: input from behind, alternates outputs left/right
//  - miners sit on deposit cells, output must face a non-deposit cell
//  - generator accepts coal pushed into it (fuel buffer)
function _blank(w,h,seed){ newWorld(w,h,seed); W.terrain.fill(0); W.deposit.fill(0); }
function _depo(t,x,y,amt){ if(!inB(x,y))return; const i=cellIdx(x,y);
  W.terrain[i]=t; W.deposit[i]=amt===undefined?99999:amt; }
function _patch(t,cx,cy,r,amt){
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)
    if(Math.hypot(x-cx,y-cy)<=r+0.2)_depo(t,x,y,amt);
}
function _rect(t,x0,y0,x1,y1,amt){
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)_depo(t,x,y,amt);
}
function _bp(kind,x,y,dir,opts){
  const r=placeEnt(kind,x,y,dir||0,Object.assign({free:true},opts||{}));
  if(r.err) console.warn('[preset]',kind,x,y,r.err);
  return r.ent;
}
function _belt(x,y,dir){ return _bp('belt',x,y,dir); }
function _run(x1,y1,x2,y2){ // axis aligned; dir = travel direction
  const dx=Math.sign(x2-x1), dy=Math.sign(y2-y1);
  const dir = dx>0?0 : dy>0?1 : dx<0?2 : 3;
  let x=x1,y=y1; _belt(x,y,dir);
  while(x!==x2||y!==y2){ x+=dx; y+=dy; _belt(x,y,dir); }
}
function _path(pts){ // polyline; dir from successor (last keeps segment dir)
  for(let i=0;i<pts.length;i++){
    const [x,y]=pts[i]; let dir=0;
    if(i<pts.length-1){ const [nx,ny]=pts[i+1]; dir = nx>x?0 : ny>y?1 : nx<x?2 : 3; }
    else if(i>0){ const [px,py]=pts[i-1]; dir = x>px?0 : y>py?1 : x<px?2 : 3; }
    _belt(x,y,dir);
  }
}
function _poles(list){ for(const [x,y] of list)_bp('pole',x,y,0); }
function _poleGrid(x0,y0,x1,y1){ // stride-3 lattice inside POLE_RANGE=4
  for(let y=y0;y<=y1;y+=3)for(let x=x0;x<=x1;x+=3)
    if(!entAt(x,y)&&terrainAt(x,y)===TERRAIN.empty)_bp('pole',x,y,0);
}
function _asm(x,y,dir,recipe){ const a=_bp('assembler',x,y,dir); a.recipe=recipe; return a; }
function _sml(x,y,dir,recipe){ const s=_bp('smelter',x,y,dir); s.recipe=recipe; return s; }

const PRESETS = [
// ================================================== STARTER LINE
{id:'starter', name:'Starter Line', kind:'sandbox',
 desc:'Iron line + coal power. Produces plates immediately.',
 build(){
  _blank(48,34,101); W.settings.costMode='off';
  _patch(TERRAIN.iron_ore,5,9,3);   // covers x2-8 y6-12
  _patch(TERRAIN.coal,6,21,3);      // covers x3-9 y18-24
  _patch(TERRAIN.copper_ore,40,26,3);
  _bp('miner',8,8,0); _bp('miner',8,10,0);
  _run(9,8,14,8); _run(9,10,14,10);
  _sml(15,8,3,'iron_plate');        // out N -> (15,7)
  _sml(15,10,0,'iron_plate');       // out E -> (16,10)
  _run(15,7,26,7);
  _path([[26,7],[26,8],[26,9]]);    // drop, merges into bus at (26,10)
  _run(16,10,26,10);                // plate bus
  _bp('delivery',27,10,0);
  // coal -> splitter -> 2 generators
  _bp('miner',9,21,0);
  _run(10,21,13,21);
  _bp('splitter',14,21,0);          // -> (14,20) & (14,22)
  _belt(14,20,0); _bp('generator',15,20,0);
  _belt(14,22,0); _bp('generator',15,22,0);
  // poles: one lattice powers the whole footprint
  _poleGrid(8,6,27,22);
  W.cam={x:100,y:120,z:1.5};
 }},
// ================================================== BALANCED FACTORY
{id:'balanced', name:'Balanced Factory', kind:'sandbox',
 desc:'Iron+copper smelting, gears, wires and a circuit cell.',
 build(){
  _blank(56,38,202); W.settings.costMode='off';
  _patch(TERRAIN.iron_ore,5,5,3);   // x2-8 y2-8
  _patch(TERRAIN.copper_ore,5,16,3);// x2-8 y13-19
  _patch(TERRAIN.coal,6,31,3);      // x3-9 y28-34
  // iron -> plate bus y=5
  _bp('miner',8,4,0); _bp('miner',8,6,0);
  _run(9,4,11,4); _run(9,6,11,6);
  _sml(12,4,1,'iron_plate');        // out S -> (12,5)
  _sml(12,6,3,'iron_plate');        // out N -> (12,5)
  _run(12,5,44,5);                  // plate bus E
  // copper -> plate bus y=16
  _bp('miner',8,15,0); _bp('miner',8,17,0);
  _run(9,15,11,15); _run(9,17,11,17);
  _sml(12,15,1,'copper_plate');     // out S -> (12,16)
  _sml(12,17,3,'copper_plate');     // out N -> (12,16)
  _run(12,16,44,16);                // copper bus E
  // gear assemblers tap plate bus; output lane y=8
  for(const gx of [20,26]){
    _bp('inserter',gx,6,1);         // src (gx,5) -> dst (gx,7)
    _asm(gx,7,1,'gear');            // out S -> (gx,8)
    _belt(gx,8,0);
  }
  _run(19,8,46,8);                  // gear lane E
  // wire assemblers tap copper bus; output lane y=19
  for(const wx of [20,26]){
    _bp('inserter',wx,17,1);        // src (wx,16) -> dst (wx,18)
    _asm(wx,18,1,'wire');           // out S -> (wx,19)
    _belt(wx,19,0);
  }
  _run(19,19,46,19);                // wire lane E
  // gear feed lane y=10 W (drop at x=46); wire feed lane y=14 W (rise x=46)
  _path([[46,8],[46,9],[46,10],[45,10]]);
  _run(44,10,34,10);
  _path([[46,19],[46,18],[46,17],[46,16],[46,15],[46,14],[45,14]]);
  _run(44,14,30,14);
  // circuit assembler (34,12): gears via ins(34,11)S src(34,10), wire via ins(34,13)N src(34,14)
  _asm(34,12,0,'circuit');
  _bp('inserter',34,11,1);
  _bp('inserter',34,13,3);
  _run(35,12,45,12);                // circuit lane E
  _bp('delivery',46,12,0);
  // power: 2 coal lanes -> splitters -> 3 gens
  _bp('miner',9,30,0); _bp('miner',9,32,0);
  _run(10,30,14,30); _run(10,32,14,32);
  _bp('splitter',15,30,0);          // input (14,30) -> (15,29) & (15,31)
  _belt(15,29,0); _bp('generator',16,29,0);
  _belt(15,31,0); _bp('generator',16,31,0);
  _bp('splitter',15,32,0);          // input (14,32) -> (15,31) & (15,33)
  _belt(15,33,0); _bp('generator',16,33,0);
  // poles
  _poleGrid(8,4,46,34);
  W.cam={x:60,y:30,z:1.05};
 }},
// ================================================== CONGESTED BELTS
{id:'congested', name:'Congested Belts', kind:'sandbox',
 desc:'Six miners jam one artery + a bypass splitter. Watch queues.',
 build(){
  _blank(48,34,303); W.settings.costMode='off';
  _rect(TERRAIN.iron_ore,6,4,14,12);  // rect patch
  _patch(TERRAIN.coal,8,26,3);
  // 3 miners north edge (y=4) dir N -> lane y=3; 3 south edge (y=12) dir S -> lane y=13
  for(const mx of [7,10,13]){ _bp('miner',mx,4,3); _bp('miner',mx,12,1); }
  _run(7,3,20,3);                   // north trunk E
  _path([[20,3],[20,4],[20,5],[20,6],[20,7]]); // drop -> merges artery (20,8)
  _run(7,13,20,13);                 // south trunk E
  _path([[20,13],[20,12],[20,11],[20,10],[20,9]]); // rise -> merges (20,8)
  _run(6,8,21,8);                   // artery E up to splitter
  // bypass splitter demo: outputs N & S lanes rejoin artery
  _bp('splitter',22,8,0);           // -> (22,7) & (22,9)
  _belt(22,7,0); _belt(23,7,1);     // (23,7) dir S rejoins (23,8)
  _belt(22,9,0); _belt(23,9,3);     // (23,9) dir N rejoins (23,8)
  _run(23,8,25,8);
  const s1=_sml(26,8,0,'iron_plate');
  _run(27,8,34,8);
  _bp('delivery',35,8,0);
  // power: 2 coal miners -> 2 gens
  _bp('miner',11,25,0); _run(12,25,15,25); _bp('generator',16,25,0);
  _bp('miner',11,27,0); _run(12,27,15,27); _bp('generator',16,27,0);
  _poleGrid(6,3,35,27);
  W.cam={x:60,y:100,z:1.4};
 }},
// ================================================== POWER CRISIS
{id:'powercrisis', name:'Power Crisis', kind:'sandbox',
 desc:'One weak generator vs a hungry grid. Diagnose the brownout.',
 build(){
  _blank(48,34,404); W.settings.costMode='off'; W.settings.powerDiff=1.5;
  _patch(TERRAIN.iron_ore,6,8,3);   // x3-9 y5-11
  _patch(TERRAIN.coal,41,28,3);     // x38-44 y25-31
  _bp('miner',9,7,0); _bp('miner',9,9,0); _bp('miner',9,11,0);
  _run(10,7,12,7); _run(10,9,12,9); _run(10,11,12,11);
  _sml(13,7,0,'iron_plate'); _sml(13,9,0,'iron_plate'); _sml(13,11,0,'iron_plate');
  // outputs E -> column x=14 drop to bus y=13
  _belt(14,7,1); _belt(14,8,1); _belt(14,9,1); _belt(14,10,1);
  _belt(14,11,1); _belt(14,12,1); _belt(14,13,0);
  _run(15,13,34,13);                // plate bus E
  _bp('delivery',35,13,0);
  // hungry assemblers tap bus -> gears -> storage
  for(const ax of [22,28]){
    _bp('inserter',ax,14,1);        // src (ax,13) -> dst (ax,15)
    _asm(ax,15,0,'gear');           // out E
    _belt(ax+1,15,0); _bp('storage',ax+2,15,0);
  }
  // ONE generator; long coal feed: miners on south edge -> trunk y32 -> north
  _bp('miner',39,30,1); _bp('miner',41,31,1); _bp('miner',43,30,1);
  _belt(39,31,1); _belt(43,31,1);     // edge outputs drop to trunk row
  _run(43,32,25,32);                  // trunk W (miners push onto it)
  _path([[25,32],[25,31],[25,30],[25,29],[25,28],[25,27],[25,26],[24,26]]);
  _bp('generator',23,26,0);
  // pole chains: gen -> consumers; east -> coal miners
  _poles([[23,23],[23,20],[23,17],[23,14],[20,12],[18,11],[15,11],[12,10],[12,8],[12,6],
          [26,12],[29,14],
          [26,30],[29,31],[32,31],[35,31],[38,31],[41,33]]);
  W.cam={x:40,y:100,z:1.2};
 }},
// ================================================== MULTI-PRODUCT BUS
{id:'multibus', name:'Multi-Product Bus', kind:'sandbox',
 desc:'Full chain: ore → plates → gears+wire → circuits.',
 build(){
  _blank(56,38,505); W.settings.costMode='off';
  _patch(TERRAIN.iron_ore,5,4,3);    // x2-8 y1-7
  _patch(TERRAIN.copper_ore,5,15,3); // x2-8 y12-18
  _patch(TERRAIN.coal,5,30,3);       // x2-8 y27-33
  // iron: edge miners -> ore merge at (11,4) -> splitter -> 2 smelters -> bus y=4
  _bp('miner',8,3,0); _bp('miner',8,5,0);
  _run(9,3,10,3); _belt(11,3,1);      // lane ends pushing S into (11,4)
  _run(9,5,10,5); _belt(11,5,3);      // lane ends pushing N into (11,4)
  _belt(11,4,0); _belt(12,4,0);       // merge cell flows E to splitter
  _bp('splitter',13,4,0);           // -> (13,3) & (13,5)
  _belt(13,3,0); _belt(14,3,0); _sml(15,3,1,'iron_plate');  // out S -> (15,4)
  _belt(13,5,0); _belt(14,5,0); _sml(15,5,3,'iron_plate');  // out N -> (15,4)
  _run(15,4,46,4);                  // plate bus E
  // gear assemblers (gx,6): ins (gx,5)S src bus; out S -> gear lane y=7
  for(const gx of [20,26]){
    _bp('inserter',gx,5,1);
    _asm(gx,6,1,'gear');
    _belt(gx,7,0);
  }
  _run(19,7,46,7);                  // gear lane E
  // copper -> cu bus y=15
  _bp('miner',8,14,0); _bp('miner',8,16,0);
  _run(9,14,11,14); _run(9,16,11,16);
  _sml(12,14,1,'copper_plate');     // out S -> (12,15)
  _sml(12,16,3,'copper_plate');     // out N -> (12,15)
  _run(12,15,46,15);                // copper bus E
  // wire assemblers (wx,17): ins (wx,16)S; out S -> wire lane y=18
  for(const wx of [20,26]){
    _bp('inserter',wx,16,1);
    _asm(wx,17,1,'wire');
    _belt(wx,18,0);
  }
  _run(19,18,46,18);                // wire lane E
  // gears: drop x=46 to y=10 -> lane W ; wires: rise x=47 to y=14 -> lane W
  _belt(46,7,1); _belt(46,8,1); _belt(46,9,1); _belt(46,10,2);
  _run(45,10,36,10);
  _belt(47,18,3); _belt(47,17,3); _belt(47,16,3); _belt(47,15,3); _belt(47,14,2);
  _run(46,14,36,14);
  // circuit assembler (36,12): ins(36,11)S src(36,10)gears; ins(36,13)N src(36,14)wire
  _asm(36,12,0,'circuit');
  _bp('inserter',36,11,1);
  _bp('inserter',36,13,3);
  _run(37,12,44,12);                // circuit lane E
  _bp('delivery',45,12,0);
  // power: coal merge trunk -> splitter tree -> 4 gens
  _bp('miner',8,29,0); _bp('miner',8,30,0); _bp('miner',8,31,0);
  _run(9,29,10,29); _run(9,30,10,30); _run(9,31,10,31);
  _belt(10,29,1); _belt(10,31,3);   // merge into trunk cell (10,30)
  _belt(11,30,0);
  _bp('splitter',12,30,0);          // -> (12,29) & (12,31)
  _belt(12,29,0);
  _bp('splitter',13,29,0);          // -> (13,28) & (13,30)
  _belt(13,28,0); _bp('generator',14,28,0);
  _belt(13,30,0); _bp('generator',14,30,0);
  _belt(12,31,0); _belt(13,31,1); _belt(13,32,1);
  _bp('splitter',13,33,1);          // input from N -> outputs (12,33) & (14,33)
  _belt(12,33,2); _bp('generator',11,33,0);
  _belt(14,33,0); _bp('generator',15,33,0);
  // poles: lattice powers everything incl. gen island
  _poleGrid(8,3,46,36);
  W.cam={x:40,y:10,z:1.0};
 }},
// ================================================== STRESS TEST
{id:'stress', name:'Throughput Stress', kind:'sandbox',
 desc:'Dense miners, smelters and bus lanes. FPS + item-count check.',
 build(){
  _blank(72,44,606); W.settings.costMode='off';
  _rect(TERRAIN.iron_ore,4,6,12,14);    // iron A
  _rect(TERRAIN.iron_ore,4,26,12,36);   // iron B
  _rect(TERRAIN.copper_ore,34,6,42,14); // copper
  _rect(TERRAIN.coal,58,34,66,40);      // coal
  // iron A: miners E edge x=12 -> belts -> smelters x=20 -> collector x=21 -> bus y=17
  // (skip row 10: leaves a pole corridor so the whole band gets power)
  for(let y=6;y<=14;y++){
    if(y===10)continue;
    _bp('miner',12,y,0); _run(13,y,19,y);
    _sml(20,y,0,'iron_plate');          // out E -> (21,y)
    _belt(21,y,1);
  }
  for(let y=6;y<=16;y++) if(!entAt(21,y)) _belt(21,y,1);
  _belt(21,17,0); _run(22,17,47,17);    // bus stops before copper col x=49
  _bp('delivery',48,17,0);
  _poles([[14,10],[18,10],[14,15],[18,15],[14,5],[18,5]]);
  // iron B (skip row 30: pole corridor)
  for(let y=26;y<=36;y++){
    if(y===30)continue;
    _bp('miner',12,y,0); _run(13,y,19,y);
    _sml(20,y,0,'iron_plate');
    _belt(21,y,1);
  }
  for(let y=26;y<=36;y++) if(!entAt(21,y)) _belt(21,y,1);
  _belt(21,37,0); _run(22,37,56,37);
  _bp('delivery',57,37,0);
  _poles([[14,30],[18,30],[14,37],[18,37],[14,25],[18,25]]);
  // copper: miners E edge x=42 -> smelters x=48 -> col x=49 -> bus y=20
  for(let y=6;y<=14;y++){
    if(y===10)continue;
    _bp('miner',42,y,0); _run(43,y,47,y);
    _sml(48,y,0,'copper_plate');
    _belt(49,y,1);
  }
  for(let y=6;y<=19;y++) if(!entAt(49,y)) _belt(49,y,1);
  _belt(49,20,0); _run(50,20,60,20);
  _bp('delivery',61,20,0);
  _poles([[44,10],[46,10],[44,5],[46,5],[44,15],[46,15]]);
  // coal: west-edge miners dir W -> splitter fans -> gens col x=52
  //       east-edge miners dir E -> splitter fans -> gens col x=71
  for(const my of [34,38]){
    _bp('miner',58,my,2); _run(57,my,54,my);
    _bp('splitter',53,my,2);            // dir W: outputs (53,my-1) & (53,my+1)
    _belt(53,my-1,2); _bp('generator',52,my-1,0);
    _belt(53,my+1,2); _bp('generator',52,my+1,0);
    _bp('miner',66,my,0); _run(67,my,69,my);
    _bp('splitter',70,my,0);            // dir E: outputs (70,my-1) & (70,my+1)
    _belt(70,my-1,0); _bp('generator',71,my-1,0);
    _belt(70,my+1,0); _bp('generator',71,my+1,0);
  }
  // pole lattice
  for(let px=6;px<=70;px+=4)for(let py=4;py<=40;py+=4)
    if(!entAt(px,py)&&terrainAt(px,py)===TERRAIN.empty)_bp('pole',px,py,0);
  W.cam={x:0,y:0,z:0.85};
 }},
];

// ================================================== contracts
const CONTRACTS = [
{id:'c1', name:'Contract: First Plates',
 desc:'Deliver 40 iron plates in 4:00. Starter layout, cost mode on.',
 build(){
  PRESETS[0].build();
  W.settings.costMode='on'; W.credits=120; W.spent=0;
  startContract('iron_plate',40,240);
 }},
{id:'c2', name:'Contract: Circuit Order',
 desc:'Deliver 30 circuits in 9:00. Bus layout running, expand it.',
 build(){
  PRESETS[4].build();
  W.settings.costMode='on'; W.credits=350; W.spent=0;
  startContract('circuit',30,540);
 }},
];

function loadPreset(id){
  const p=PRESETS.find(p=>p.id===id)||CONTRACTS.find(c=>c.id===id);
  if(!p)return false;
  try{
    p.build();
    W.presetName=p.name;
    W.powerDirty=true; W.paused=false;
    hideBanner(); updateToolbar(); updateContractPanel(); refreshToolCosts();
    toast('Loaded: '+p.name); sfx('click');
    return true;
  }catch(e){ console.error(e); toast('Preset failed: '+e.message,'err'); return false; }
}
