// ===CORE-START===
'use strict';
/* =====================================================================
   EMBERDEEP — core engine (DOM-free). Everything between CORE-START and
   CORE-END is pure game logic: RNG, data, generation, perception, AI,
   combat, persistence. The UI layer below only reads state & sends actions.
   ===================================================================== */
const GAME_ID = 'emberdeep';
const SCHEMA_VERSION = 3;
const ENGINE_VERSION = '1.0.0'; // bump when rules change: replays of older runs may diverge
const LAST_FLOOR = 5;
const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// ---------------------------------------------------------------- RNG
// sfc32 seeded by cyrb128(seed string). State is a plain {s:[4 uint32], n}
// object so it serialises exactly into saves and replays.
function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function makeRng(seedStr) {
  const r = { s: cyrb128(String(seedStr)), n: 0 };
  for (let i = 0; i < 12; i++) rnext(r);
  r.n = 0;
  return r;
}
function rnext(r) {
  let a = r.s[0] | 0, b = r.s[1] | 0, c = r.s[2] | 0, d = r.s[3] | 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  r.s[0] = a >>> 0; r.s[1] = b >>> 0; r.s[2] = c >>> 0; r.s[3] = d >>> 0;
  r.n++;
  return (t >>> 0) / 4294967296;
}
const rint = (r, a, b) => a + Math.floor(rnext(r) * (b - a + 1));
const rchance = (r, p) => rnext(r) < p;
const rpick = (r, arr) => arr[Math.floor(rnext(r) * arr.length)];
function rshuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnext(r) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function rweighted(r, entries) { // entries: [[value, weight], ...]
  let tot = 0; for (const e of entries) tot += e[1];
  let x = rnext(r) * tot;
  for (const e of entries) { x -= e[1]; if (x < 0) return e[0]; }
  return entries[entries.length - 1][0];
}

// ------------------------------------------------------------ helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
function bresenham(x0, y0, x1, y1) {
  const pts = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, x = x0, y = y0;
  for (let guard = 0; guard < 400; guard++) {
    pts.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return pts;
}
function dirName(dx, dy) {
  const a = Math.atan2(dy, dx) * 180 / Math.PI; // screen coords, y down
  const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  return names[((Math.round(a / 45) % 8) + 8) % 8];
}

// --------------------------------------------------------------- tiles
const T = { WALL: 0, FLOOR: 1, DOOR: 2, OPEN: 3, LOCKED: 4, DOWN: 5, UP: 6, WATER: 7, CHASM: 8, LAVA: 9, GRASS: 10, RUBBLE: 11, PILLAR: 12, BRAZIER: 13, SHRINE: 14, CHEST: 15, BRIDGE: 16, ASH: 17, CHEST_OPEN: 18, SHRINE_USED: 19 };
const TILES = [
  { name: 'Wall', walk: 0, opaque: 1, solid: 1 },
  { name: 'Floor', walk: 1 },
  { name: 'Closed door', walk: 0, opaque: 1, door: 1, solid: 1, desc: 'Bump to open it (1 turn). Blocks sight. Animals cannot open doors.' },
  { name: 'Open door', walk: 1, door: 1, desc: 'Stand beside it and press C to close it (1 turn). No diagonal moves through doorways.' },
  { name: 'Locked door', walk: 0, opaque: 1, door: 1, locked: 1, solid: 1, desc: 'Needs an Iron Key — bump into it while carrying one.' },
  { name: 'Stairs down', walk: 1, desc: 'Press > while standing here to descend (1 turn).' },
  { name: 'Stairs up', walk: 1, desc: 'Where you arrived. The way back is sealed.' },
  { name: 'Shallow water', walk: 1, water: 1, desc: 'Extinguishes Burning. Splashing through it is noisy.' },
  { name: 'Chasm', walk: 0, chasm: 1, desc: 'A sheer drop. Knocked-back foes fall to their death; if you fall, you land one floor deeper (hurt).' },
  { name: 'Lava', walk: 1, hazard: 1, desc: 'Deals 8–12 fire damage and sets you Burning. Safe paths avoid it.' },
  { name: 'Tall grass', walk: 1, opaque: 1, flammable: 1, desc: 'Walkable, but blocks line of sight. Burns readily.' },
  { name: 'Rubble', walk: 1, desc: 'Broken masonry. Walkable.' },
  { name: 'Pillar', walk: 0, opaque: 1, solid: 1 },
  { name: 'Brazier', walk: 0, light: 5, desc: 'Lights the area. Interact (E) from an adjacent tile to tip it over and spill fire beyond it.' },
  { name: 'Shrine', walk: 0, light: 2, desc: 'Interact (E) from an adjacent tile to pray (once).' },
  { name: 'Chest', walk: 0, desc: 'Interact (E) from an adjacent tile to open it (1 turn).' },
  { name: 'Bridge', walk: 1, desc: 'Old planks over the chasm.' },
  { name: 'Ash', walk: 1, desc: 'Burnt ground.' },
  { name: 'Open chest', walk: 0, desc: 'Empty.' },
  { name: 'Spent shrine', walk: 0, desc: 'Its power is spent.' },
];
const PILLAR_NAMES = { ruins: 'Ancient tree', crypt: 'Sarcophagus', caverns: 'Stalagmite' };
const tileName = (style, t) => (t === T.PILLAR && PILLAR_NAMES[style]) || TILES[t].name; // style-aware display name
const tWalk = (t) => TILES[t].walk === 1;
const tOpaque = (t) => TILES[t].opaque === 1;
const tSolid = (t) => TILES[t].solid === 1; // blocks diagonal squeezing

// ------------------------------------------------------------ statuses
const STATUS = {
  poison: { name: 'Poisoned', icon: '☠', bad: 1, desc: 'Lose 1 HP each turn.' },
  burning: { name: 'Burning', icon: '🔥', bad: 1, desc: 'Lose 2 HP each turn and ignite grass underfoot. Step into water to extinguish.' },
  bleed: { name: 'Bleeding', icon: '🩸', bad: 1, desc: 'Lose 1 HP each turn. Healing Draughts stop bleeding.' },
  stun: { name: 'Stunned', icon: '✦', bad: 1, desc: 'Loses its turns until the stun wears off.' },
  root: { name: 'Rooted', icon: '⌇', bad: 1, desc: 'Cannot move, but can still attack, shoot and use items.' },
  slow: { name: 'Slowed', icon: '🐌', bad: 1, desc: 'Acts at half speed (every other turn).' },
  haste: { name: 'Hasted', icon: '»', desc: 'Acts at double speed (two actions per turn).' },
  shield: { name: 'Warded', icon: '⛨', desc: '+3 armor.' },
  regen: { name: 'Regenerating', icon: '+', desc: 'Heal 1 HP each turn.' },
};

// --------------------------------------------------------------- items
// slot items are equipment. `use` items are consumables (1 turn to use).
const ITEMS = {
  dagger: { name: 'Dagger', slot: 'weapon', dmg: [2, 4], acc: 2, crit: 12, critMult: 3, tier: 1, desc: 'Critical hits deal ×3. Sneak attacks always crit.' },
  sword: { name: 'Shortsword', slot: 'weapon', dmg: [3, 6], acc: 1, crit: 8, tier: 1 },
  spear: { name: 'Spear', slot: 'weapon', dmg: [3, 7], acc: 1, crit: 6, reach: 2, tier: 1, desc: 'Reach 2: press F to strike a foe two tiles away in a straight line.' },
  longsword: { name: 'Longsword', slot: 'weapon', dmg: [4, 8], acc: 0, crit: 6, tier: 2 },
  axe: { name: 'War Axe', slot: 'weapon', dmg: [5, 10], acc: -1, crit: 8, onCrit: 'bleed', tier: 2, desc: 'Critical hits cause Bleeding (4 turns).' },
  mace: { name: 'Flanged Mace', slot: 'weapon', dmg: [4, 9], acc: 0, crit: 8, onCrit: 'stun', pierce: 2, tier: 2, desc: 'Ignores 2 armor. Critical hits Stun for 1 turn.' },
  staff: { name: 'Ashwood Staff', slot: 'weapon', dmg: [2, 5], acc: 0, crit: 5, spell: 2, tier: 1, desc: '+2 spell power (Firebolt damage).' },
  shortbow: { name: 'Shortbow', slot: 'ranged', dmg: [3, 6], acc: 1, crit: 8, range: 7, tier: 1, desc: 'Press F to shoot (uses 1 arrow, range 7).' },
  longbow: { name: 'Yew Longbow', slot: 'ranged', dmg: [4, 9], acc: 1, crit: 10, range: 9, tier: 2, desc: 'Press F to shoot (uses 1 arrow, range 9).' },
  leather: { name: 'Leather Jerkin', slot: 'armor', armor: 1, eva: 1, tier: 1 },
  chain: { name: 'Chain Mail', slot: 'armor', armor: 3, eva: -1, tier: 2 },
  plate: { name: 'Ember Plate', slot: 'armor', armor: 5, eva: -2, noisy: 2, tier: 3, desc: 'Heavy and loud: +2 noise when moving.' },
  robe: { name: 'Runed Robe', slot: 'armor', armor: 0, eva: 1, spell: 1, tier: 1, desc: '+1 spell power.' },
  ringPrec: { name: 'Ring of Precision', slot: 'trinket', acc: 2, crit: 5, tier: 1 },
  ringVigor: { name: 'Ring of Vigor', slot: 'trinket', hp: 10, tier: 2 },
  amuletWard: { name: 'Amulet of Warding', slot: 'trinket', armor: 1, immune: ['poison'], tier: 2, desc: '+1 armor and immunity to poison.' },
  shadowBand: { name: 'Shadow Band', slot: 'trinket', stealth: 2, tier: 2, desc: 'Enemies spot you from 2 tiles closer.' },
  heal: { name: 'Healing Draught', use: 'heal', stack: 1, desc: 'Restore 10 + 30% max HP and stop Bleeding.' },
  antidote: { name: 'Antidote', use: 'cure', stack: 1, desc: 'Cure Poison and Bleeding; Regenerate for 6 turns.' },
  haste: { name: 'Quicksilver Tonic', use: 'haste', stack: 1, desc: 'Hasted for 8 turns (two actions per turn).' },
  firebomb: { name: 'Fire Bomb', use: 'throw', effect: 'fire', range: 6, radius: 1, stack: 1, desc: 'Throw (range 6): 4–8 damage in a 3×3 blast and sets it ablaze.' },
  smokebomb: { name: 'Smoke Bomb', use: 'throw', effect: 'smoke', range: 6, radius: 2, stack: 1, desc: 'Throw (range 6): smoke cloud (radius 2, 8 turns) that blocks all sight.' },
  knives: { name: 'Throwing Knives', use: 'throw', effect: 'knife', range: 6, dmg: [3, 6], stack: 1, desc: 'Throw (range 6): 3–6 damage; the knife lands where it stops.' },
  scrollBlink: { name: 'Scroll of Displacement', use: 'teleport', stack: 1, desc: 'Teleport to a random safe tile at least 10 steps away.' },
  scrollMap: { name: 'Scroll of Cartography', use: 'map', stack: 1, desc: 'Reveal the layout of this floor, including stairs.' },
  scrollWard: { name: 'Scroll of Warding', use: 'ward', stack: 1, desc: 'Warded (+3 armor) for 12 turns.' },
  heartstone: { name: 'Heartstone', use: 'maxhp', stack: 1, desc: 'Permanently +5 max HP and heal 5.' },
  key: { name: 'Iron Key', use: 'key', stack: 1, desc: 'Opens one locked door: bump into the door while carrying it.' },
  arrows: { name: 'Arrows', ammo: 1, stack: 1, desc: 'Ammunition for bows. Missed or spent arrows sometimes survive where they land.' },
  gold: { name: 'Gold', gold: 1, stack: 1, desc: 'Counts toward your score.' },
};
const CONSUMABLE_TABLE = [['heal', 6], ['antidote', 2], ['haste', 1.2], ['firebomb', 2], ['smokebomb', 1.6], ['knives', 2], ['scrollBlink', 1.2], ['scrollMap', 1.2], ['scrollWard', 1.2], ['heartstone', 0.8]];
const GEAR_BY_TIER = {
  1: ['dagger', 'sword', 'spear', 'leather', 'shortbow', 'ringPrec', 'robe'],
  2: ['longsword', 'axe', 'mace', 'chain', 'longbow', 'ringVigor', 'amuletWard', 'shadowBand'],
  3: ['plate', 'axe', 'mace', 'longbow', 'ringVigor', 'amuletWard'],
};

// ------------------------------------------------------------- classes
const CLASSES = {
  warden: { name: 'Warden', hp: 36, hpPer: 6, acc: 2, eva: 0, color: '#8fb3ff',
    blurb: 'Armoured vanguard. Shield Bash hurls foes into walls, chasms and lava.',
    kit: [['longsword', 1, 1], ['chain', 1, 1], ['heal', 2], ['firebomb', 1]], abilities: ['bash', 'rally'] },
  ranger: { name: 'Ranger', hp: 28, hpPer: 5, acc: 4, eva: 2, color: '#8fdc7a',
    blurb: 'Keen-eyed skirmisher. Bow, knives, smoke and a Tumble to slip away.',
    kit: [['sword', 1, 1], ['shortbow', 1, 1], ['arrows', 20], ['leather', 1, 1], ['heal', 1], ['smokebomb', 1], ['knives', 3]], abilities: ['pin', 'tumble'], detect: 0.12 },
  arcanist: { name: 'Arcanist', hp: 22, hpPer: 4, acc: 2, eva: 1, color: '#c9a2ff',
    blurb: 'Fragile fire-caster. Firebolt ignites foes and grass; Blink repositions.',
    kit: [['staff', 1, 1], ['robe', 1, 1], ['heal', 1], ['scrollBlink', 1], ['antidote', 1]], abilities: ['firebolt', 'blink'] },
};
const ABILITIES = {
  bash: { name: 'Shield Bash', cd: 6, target: 'adjacent', desc: 'Auto-hit an adjacent foe for 2–5, knock it back 2 tiles and Stun it 1 turn. Slamming into a wall or creature deals +3; chasms kill, lava burns.' },
  rally: { name: 'Second Wind', cd: 22, target: 'self', desc: 'Heal 35% of max HP and become Warded (+3 armor) for 5 turns.' },
  pin: { name: 'Pinning Shot', cd: 7, target: 'ranged', desc: 'Bow shot with +2 accuracy and +2 damage that Roots the target for 3 turns. Uses 1 arrow.' },
  tumble: { name: 'Tumble', cd: 8, target: 'dir', desc: 'Dash up to 3 tiles in a straight line as a single action. Breaks Roots.' },
  firebolt: { name: 'Firebolt', cd: 3, target: 'ranged', range: 7, desc: 'Range 7. Auto-hits the first creature in line for 4–8 + spell power fire damage and sets it Burning (3). Ignites grass.' },
  blink: { name: 'Blink', cd: 10, target: 'tile', range: 5, desc: 'Teleport to a visible, empty, safe tile within 5.' },
};

// ------------------------------------------------------------- enemies
const ENEMIES = {
  rat: { name: 'Gnaw Rat', hp: 5, acc: 0, eva: 2, arm: 0, dmg: [1, 3], speed: 100, sight: 6, xp: 3, ai: 'pack', animal: 1, color: '#b89b7a',
    desc: 'Pack hunter: holds back until packmates gather, then surrounds you. Cannot open doors.' },
  jackal: { name: 'Ash Jackal', hp: 9, acc: 1, eva: 2, arm: 0, dmg: [2, 4], speed: 150, sight: 7, xp: 6, ai: 'pack', animal: 1, color: '#d98f4e',
    desc: 'Fast pack hunter (3 actions every 2 turns). Howls to alert its pack. Cannot open doors.' },
  goblin: { name: 'Goblin Cutthroat', hp: 11, acc: 1, eva: 1, arm: 1, dmg: [2, 5], speed: 100, sight: 7, xp: 7, ai: 'flank', flee: 0.3, color: '#7fbf4d',
    desc: 'Flanker: circles to the side of you opposite its allies. Flees when badly hurt.' },
  archer: { name: 'Goblin Archer', hp: 9, acc: 2, eva: 1, arm: 0, dmg: [1, 3], rdmg: [2, 5], range: 6, speed: 100, sight: 8, xp: 8, ai: 'ranged', flee: 0.25, color: '#a3c95a',
    desc: 'Ranged (6): shoots only along a clear line; backs away when you close in.' },
  brute: { name: 'Ogre Brute', hp: 30, acc: 1, eva: 0, arm: 2, dmg: [8, 13], speed: 80, sight: 6, xp: 20, ai: 'brute', color: '#b08ad0',
    desc: 'Slow. Raises its club over your tile (red warning), then smashes it on its next action — step away! Its smash hits anything on that tile.' },
  cultist: { name: 'Ember Cultist', hp: 14, acc: 1, eva: 1, arm: 0, dmg: [1, 4], rdmg: [2, 4], range: 5, speed: 100, sight: 7, xp: 14, ai: 'summoner', flee: 0.35, color: '#e0603a',
    desc: 'Summoner: raises skeletons, keeps its distance and throws embers. Its skeletons crumble when it dies.' },
  sentinel: { name: 'Vault Sentinel', hp: 24, acc: 2, eva: 0, arm: 3, dmg: [4, 7], speed: 100, sight: 7, xp: 16, ai: 'guard', color: '#d8c27a',
    desc: 'Guard: never strays more than 5 tiles from its post and returns to it.' },
  spitter: { name: 'Blight Spitter', hp: 12, acc: 2, eva: 0, arm: 0, dmg: [1, 3], range: 6, speed: 70, sight: 7, xp: 12, ai: 'artillery', animal: 1, immune: ['poison'], color: '#9ad14b',
    desc: 'Area denial: lobs poison spores over other creatures onto your tile, leaving gas for 5 turns. Slow; keeps away.' },
  skeleton: { name: 'Risen Skeleton', hp: 8, acc: 1, eva: 0, arm: 1, dmg: [2, 4], speed: 100, sight: 7, xp: 3, ai: 'melee', immune: ['poison', 'bleed'], color: '#e8e2cf',
    desc: 'Relentless direct pursuit. Immune to poison and bleeding.' },
  wraith: { name: 'Crypt Wraith', hp: 16, acc: 3, eva: 4, arm: 0, dmg: [3, 6], speed: 100, sight: 7, xp: 18, ai: 'melee', lifesense: 8, onHit: 'slow', immune: ['poison', 'bleed'], color: '#7fe0d0',
    desc: 'Lifesense: knows where you are within 8 tiles, even through walls. Its touch may Slow you (35%, 2 turns). Hard to hit.' },
  boss: { name: 'Hollow King', unique: 1, hp: 95, acc: 3, eva: 1, arm: 3, dmg: [6, 11], rdmg: [5, 9], range: 7, speed: 100, sight: 9, xp: 120, ai: 'boss', boss: 1, immune: ['poison', 'bleed', 'stun'], color: '#ffb347',
    desc: 'Final foe. Summons the dead, telegraphs a Grave Slam around himself, and at half health quickens and hurls Soul Lances.' },
};
const SPAWN_TABLE = [
  null,
  [['rat', 3], ['goblin', 3], ['archer', 2], ['spitter', 1]],
  [['jackal', 3], ['goblin', 3], ['archer', 2], ['spitter', 1.5], ['cultist', 1.2], ['rat', 1]],
  [['goblin', 2], ['archer', 2], ['brute', 2], ['cultist', 1.5], ['jackal', 2], ['skeleton', 2], ['spitter', 1]],
  [['brute', 2], ['cultist', 2], ['wraith', 2], ['archer', 2], ['spitter', 1], ['skeleton', 1.5], ['goblin', 1]],
  [['skeleton', 3], ['cultist', 1], ['wraith', 1.5], ['archer', 1.5], ['brute', 1]],
];

// --------------------------------------------------------- run options
const STYLES = {
  ruins: { name: 'Overgrown Ruins', gen: 'scatter', w: 60, h: 40, doorP: 0.4, traps: 1, sight: 8 },
  fortress: { name: 'Fortress', gen: 'bsp', w: 60, h: 40, doorP: 0.85, traps: 1, sight: 8 },
  caverns: { name: 'Caverns', gen: 'caverns', w: 60, h: 40, doorP: 0.3, traps: 0.8, sight: 7 },
  crypt: { name: 'Crypt', gen: 'grid', w: 60, h: 40, doorP: 0.92, traps: 1.6, sight: 7 },
  arena: { name: 'Test Arena', gen: 'arena', w: 33, h: 23, doorP: 1, traps: 0.5, sight: 8 },
  sanctum: { name: 'Ember Sanctum', gen: 'bsp', w: 56, h: 38, doorP: 0.9, traps: 0.6, sight: 8 },
};
const DIFFICULTY = {
  easy: { name: 'Easy', hp: 0.8, dmg: -1, count: -2, score: 0.7 },
  normal: { name: 'Normal', hp: 1, dmg: 0, count: 0, score: 1 },
  hard: { name: 'Hard', hp: 1.25, dmg: 1, count: 3, score: 1.4 },
};
// Article helpers so log lines read naturally ("the Hollow King", "an Ogre Brute").
const theName = (k, cap) => (cap ? 'The ' : 'the ') + ENEMIES[k].name;
const aName = (k) => (ENEMIES[k].unique ? 'the ' : /^[AEIOU]/.test(ENEMIES[k].name) ? 'an ' : 'a ') + ENEMIES[k].name;
const XP_FOR = (lvl) => 15 * lvl * (lvl + 1) / 2; // xp needed to reach lvl+1
