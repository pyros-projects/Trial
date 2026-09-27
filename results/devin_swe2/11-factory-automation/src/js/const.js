// ============================================================ constants & defs
const TAU = Math.PI * 2;
const DIRS = [[1,0],[0,1],[-1,0],[0,-1]]; // 0=E 1=S 2=W 3=N
const OPP = d => (d+2)&3;
const DIRNAME = ['E','S','W','N'];

function mulberry32(seed){ let a = seed>>>0; return function(){
  a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function hash2(x,y,s){ let h=(x*374761393+y*668265263+s*974634211)|0;
  h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; }
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;

// ---------------- items
const ITEMS = {
  iron_ore:   {name:'Iron ore',    color:'#c98a4b', glyph:'◆'},
  copper_ore: {name:'Copper ore',  color:'#e07040', glyph:'◆'},
  coal:       {name:'Coal',        color:'#3a3f4a', glyph:'◆'},
  iron_plate: {name:'Iron plate',  color:'#9fb4c8', glyph:'▬'},
  copper_plate:{name:'Copper plate',color:'#e8a15c',glyph:'▬'},
  gear:       {name:'Gear',        color:'#7d93a8', glyph:'⚙'},
  wire:       {name:'Copper wire', color:'#f0c060', glyph:'∿'},
  circuit:    {name:'Circuit',     color:'#4ade80', glyph:'▣'},
};
const FUEL = {coal: 1, wood: 1};

// ---------------- recipes (machines: smelter/assembler)
const RECIPES = {
  iron_plate:  {machine:'smelter',   in:{iron_ore:1},            out:{iron_plate:1},  time:1.6, name:'Iron plate'},
  copper_plate:{machine:'smelter',   in:{copper_ore:1},          out:{copper_plate:1},time:1.6, name:'Copper plate'},
  gear:        {machine:'assembler', in:{iron_plate:2},          out:{gear:1},        time:2.4, name:'Gear'},
  wire:        {machine:'assembler', in:{copper_plate:1},        out:{wire:2},        time:1.2, name:'Copper wire'},
  circuit:     {machine:'assembler', in:{gear:1, wire:2},        out:{circuit:1},     time:3.2, name:'Circuit'},
};
const RECIPES_FOR = {smelter:['iron_plate','copper_plate'], assembler:['gear','wire','circuit']};

// ---------------- entity kinds
// dir meaning: belt/splitter/merger/miner/machine/generator = output/forward side.
// splitter: input from back, outputs alternate left+right. merger: inputs sides+back, output front.
const KINDS = {
  belt:      {name:'Conveyor belt', icon:'➤', cost:2,  color:'#5c6b7d', power:0,  cat:'logi'},
  splitter:  {name:'Splitter',      icon:'⑃', cost:8,  color:'#7286a0', power:0,  cat:'logi'},
  merger:    {name:'Merger',        icon:'⑂', cost:8,  color:'#7286a0', power:0,  cat:'logi'},
  inserter:  {name:'Inserter',      icon:'⊢', cost:10, color:'#c8b060', power:4,  cat:'logi'},
  miner:     {name:'Miner',         icon:'⛏', cost:25, color:'#a07850', power:12, cat:'prod'},
  smelter:   {name:'Smelter',       icon:'♨', cost:30, color:'#b06848', power:18, cat:'prod'},
  assembler: {name:'Assembler',     icon:'⚒', cost:45, color:'#5898b8', power:20, cat:'prod'},
  generator: {name:'Generator',     icon:'⚡', cost:40, color:'#e8c840', power:0,  cat:'power'},
  pole:      {name:'Power pole',    icon:'⌁', cost:5,  color:'#e8c840', power:0,  cat:'power'},
  storage:   {name:'Storage',       icon:'▤', cost:15, color:'#8898a8', power:0,  cat:'logi'},
  delivery:  {name:'Delivery pad',  icon:'◎', cost:50, color:'#48c888', power:0,  cat:'logi'},
};
const BUILD_ORDER=['select','pan','-','belt','splitter','merger','inserter','-',
  'miner','smelter','assembler','-','generator','pole','-','storage','delivery','-','erase'];
const TOOLDEF = {select:{name:'Select / inspect',icon:'▣'},pan:{name:'Pan camera',icon:'✋'},
  erase:{name:'Erase (drag = area)',icon:'✕'}};

const ISBELT   = k => k==='belt'||k==='splitter'||k==='merger';
const ISMACHINE= k => k==='smelter'||k==='assembler';
const NEEDPOWER= k => k==='miner'||k==='smelter'||k==='assembler'||k==='inserter';

const TERRAIN = {empty:0, iron_ore:1, copper_ore:2, coal:3, rock:4};
const TERRAIN_NAME={0:'',1:'Iron deposit',2:'Copper deposit',3:'Coal deposit',4:'Rock'};
const TERRAIN_ITEM={1:'iron_ore',2:'copper_ore',3:'coal'};
const TERRAIN_COL={1:'#7a5636',2:'#8a4a2e',3:'#23262e',4:'#3d4652'};

const POLE_RANGE = 4;   // chebyshev
const GEN_OUT = 100;    // PU per burning generator
const BELT_SPACING = 0.34;
const BUF_CAP = 8;      // per-item-type units in machine buffers
const STORAGE_CAP = 60;

const MODS = {
  speed:{name:'Speed mod',    desc:'+50% speed, +60% power', cost:30, max:2},
  eff:  {name:'Efficiency mod',desc:'-35% power draw',       cost:25, max:2},
  prod: {name:'Capacity mod', desc:'+100% buffer size',      cost:20, max:2},
};

const SETTINGS_DEF = {
  beltSpeed:{label:'Belt speed (cells/s)',min:0.5,max:4,step:0.1,def:1.8},
  machineSpeed:{label:'Machine speed ×',min:0.5,max:3,step:0.25,def:1},
  itemCap:{label:'Item cap (density)',min:500,max:20000,step:500,def:6000},
  powerDiff:{label:'Power difficulty ×',min:0.5,max:2,step:0.25,def:1},
  costMode:{label:'Construction costs',opts:['off','on'],def:'on'},
  seed:{label:'Deterministic seed',def:1337},
  gridW:{label:'Grid width',min:24,max:96,def:48},
  gridH:{label:'Grid height',min:20,max:64,def:34},
};

const OVERLAY_DEFS = [
  ['flow','Item flow'],['conn','Connections'],['power','Power net'],
  ['util','Utilization'],['cong','Congestion'],['blocked','Blocked'],['status','Status'],
];
