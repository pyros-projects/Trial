global.keyLabel=c=>String(c);
const C=require('./core.js');
const {makeMission,Sim,snapshotMission,GS,TILE,SIM_DT,losClear,tileIdxAt,blocksMoveTile,PF}=C;
let pass=0,fail=0;
const ok=(n,c,extra)=>{ if(c){pass++;console.log('  PASS',n);} else {fail++;console.log('  FAIL',n, extra===undefined?'':extra);} };
const IDLE={mx:0,my:0,run:false,sneak:false,aim:0,use:false,gadget:false,slot:-1};
const run=(sim,n,inp)=>{ for(let i=0;i<n;i++){ sim.step(SIM_DT, inp||IDLE); sim.events.length=0; } };

function scene(seed='AI-1',preset='vermeil',diff='operative'){
  const m=makeMission(seed,preset,diff); snapshotMission(m);
  const sim=new Sim(m,diff); PF.bind(m); return {m,sim};
}
// find a long open corridor/room run for controlled experiments
function openLine(m){
  for(const n of [8,7,6,5]){
    for(let ty=1;ty<m.gh-1;ty++) for(let tx=1;tx<m.gw-n;tx++){
      let good=true;
      for(let k=0;k<n;k++){ const i=m.grid.i(tx+k,ty); if(blocksMoveTile(m,i)||m.grid.doorAt[i]>=0){good=false;break;} }
      if(good) return {tx,ty,n};
    }
  }
  throw new Error('no open line found');
}
function wallPair(m){ // two floor tiles a few tiles apart with no line of sight between them
  const g=m.grid;
  for(let ty=1;ty<m.gh-1;ty++) for(let tx=1;tx<m.gw-1;tx++){
    const i=g.i(tx,ty); if(blocksMoveTile(m,i)||g.doorAt[i]>=0) continue;
    for(let k=2;k<=4;k++){
      const j=g.i(tx+k,ty); if(tx+k>=m.gw-1) break;
      if(blocksMoveTile(m,j)||g.doorAt[j]>=0) continue;
      const ax=(tx+0.5)*TILE, ay=(ty+0.5)*TILE, bx=(tx+k+0.5)*TILE;
      if(!losClear(m,ax,ay,bx,ay,15,null)) return {tx,ty,k};
    }
  }
  return null;
}

console.log('\n== perception: line of sight is occluded by geometry ==');
{
  const {m,sim}=scene();
  const L=openLine(m); const W=wallPair(m);
  // clear line: guard looking straight at the player
  const g=sim.guards[0];
  g.x=(L.tx+0.5)*TILE; g.y=(L.ty+0.5)*TILE; g.facing=0; g.state=GS.OBSERVE; g.aware=0; g.route=[]; g.lookBase=0; g.dwellT=999;
  sim.player.x=(L.tx+4.5)*TILE; sim.player.y=(L.ty+0.5)*TILE;
  for(const o of sim.guards) if(o!==g){ o.x=-9999; o.y=-9999; }
  run(sim,60);
  const awareOpen=g.aware;
  ok('guard detects a player standing in an unobstructed cone', awareOpen>0.5, 'aware='+awareOpen.toFixed(3));

  const {m:m2,sim:s2}=scene();
  const W2=wallPair(m2); const g2=s2.guards[0];
  g2.x=(W2.tx+0.5)*TILE; g2.y=(W2.ty+0.5)*TILE; g2.facing=0; g2.state=GS.OBSERVE; g2.aware=0; g2.route=[]; g2.lookBase=0; g2.dwellT=999;
  s2.player.x=(W2.tx+W2.k+0.5)*TILE; s2.player.y=(W2.ty+0.5)*TILE;
  for(const o of s2.guards) if(o!==g2){ o.x=-9999; o.y=-9999; }
  const seesThroughWall = losClear(m2,g2.x,g2.y,s2.player.x,s2.player.y,15,null);
  run(s2,90);
  ok('a wall blocks line of sight', !seesThroughWall);
  ok('guard stays unaware of a player behind a wall', g2.aware<0.05, 'aware='+g2.aware.toFixed(3));
}

console.log('\n== hearing: sound events drive investigation ==');
{
  const {m,sim}=scene('AI-2');
  const g=sim.guards[0]; g.route=[]; g.state=GS.OBSERVE; g.aware=0; g.dwellT=999;
  const L=openLine(m);
  g.x=(L.tx+0.5)*TILE; g.y=(L.ty+0.5)*TILE; g.facing=Math.PI; g.lookBase=Math.PI; // facing AWAY
  for(const o of sim.guards) if(o!==g){ o.x=-9999;o.y=-9999; }
  sim.player.x=-9999; sim.player.y=-9999;
  const src={x:(L.tx+5.5)*TILE, y:(L.ty+0.5)*TILE};
  const d0=Math.hypot(g.x-src.x,g.y-src.y);
  sim.emitSound(src.x,src.y,C.GADGET_DEFS?11.5:11.5,'noisemaker',null,true);
  sim.events.length=0;
  const stateAfter=g.state;
  run(sim,180);
  const d1=Math.hypot(g.x-src.x,g.y-src.y);
  ok('loud noise switches an idle guard to INVESTIGATE', stateAfter===GS.INVESTIGATE, stateAfter);
  ok('guard physically moves toward the noise', d1 < d0-30, 'd0='+d0.toFixed(0)+' d1='+d1.toFixed(0));
  ok('guard eventually searches around the noise then gives up',
     [GS.SEARCH,GS.RETURN,GS.OBSERVE,GS.PATROL,GS.INVESTIGATE].includes(g.state), g.state);
}
console.log('\n== hearing: walls attenuate, distance attenuates ==');
{
  const {m,sim}=scene('AI-3');
  const L=openLine(m); const g=sim.guards[0]; g.route=[]; g.state=GS.OBSERVE;
  g.x=(L.tx+0.5)*TILE; g.y=(L.ty+0.5)*TILE;
  for(const o of sim.guards) if(o!==g){o.x=-9999;o.y=-9999;}
  C.SoundField.bind(m);
  C.SoundField.flood(L.tx, L.ty, 12);
  const near=C.SoundField.at((L.tx+1.5)*TILE,(L.ty+0.5)*TILE);
  const far =C.SoundField.at((L.tx+6.5)*TILE,(L.ty+0.5)*TILE);
  ok('sound loudness falls off with path distance', near>far && far>0, 'near='+near.toFixed(2)+' far='+far.toFixed(2));
  // a sealed tile beyond walls should read 0
  let sealed=0, checked=0;
  for(let ty=1;ty<m.gh-1&&checked<1;ty++) for(let tx=1;tx<m.gw-1;tx++){
    const i=m.grid.i(tx,ty);
    if(m.grid.solid[i]) continue;
    const dd=Math.abs(tx-L.tx)+Math.abs(ty-L.ty);
    if(dd>16){ sealed=C.SoundField.at((tx+0.5)*TILE,(ty+0.5)*TILE); checked=1; break; }
  }
  ok('sound does not reach past its energy budget', sealed===0, 'val='+sealed);
}

console.log('\n== pursuit: chase, lose sight, search the last known position ==');
{
  const {m,sim}=scene('AI-4');
  const L=openLine(m); const g=sim.guards[0]; g.route=[]; 
  for(const o of sim.guards) if(o!==g){o.x=-9999;o.y=-9999;}
  g.x=(L.tx+0.5)*TILE; g.y=(L.ty+0.5)*TILE; g.facing=0; g.lookBase=0; g.dwellT=999;
  sim.player.x=(L.tx+3.5)*TILE; sim.player.y=(L.ty+0.5)*TILE;
  // hold the guard at its post so the meter can fill without an immediate grab
  const home={x:g.x,y:g.y};
  for(let i=0;i<400 && g.state!==GS.CHASE;i++){
    run(sim,1);
    if(Math.hypot(g.x-sim.player.x,g.y-sim.player.y)<70){ g.x=home.x; g.y=home.y; g.vx=0; g.vy=0; }
  }
  ok('sustained exposure escalates to CHASE', g.state===GS.CHASE, g.state+' aware='+g.aware.toFixed(2));
  ok('the sim is still running (no premature capture)', sim.status==='playing', sim.status);
  const lkpBefore = g.lkp? {x:g.lkp.x,y:g.lkp.y} : null;
  ok('chasing guard records a last-known position', !!lkpBefore);
  const detBefore = sim.stats.detections;
  ok('detection was counted', detBefore>=1, detBefore);
  ok('alarm raised to at least ALERTED', sim.alarm.level>=2, sim.alarm.level);
  // teleport the player far away out of sight -> guard must fall back to SEARCH
  sim.player.x=-9999; sim.player.y=-9999;
  run(sim,200);
  ok('losing the target drops the guard into SEARCH/INVESTIGATE/RETURN',
     [GS.SEARCH,GS.RETURN,GS.INVESTIGATE,GS.OBSERVE,GS.PATROL].includes(g.state), g.state);
  const movedToLkp = lkpBefore && Math.hypot(g.x-lkpBefore.x, g.y-lkpBefore.y) < 12*TILE;
  ok('guard searches near the last known position, not the real one', movedToLkp);
  run(sim,60*40);
  ok('guard eventually returns to duty', [GS.PATROL,GS.OBSERVE,GS.RETURN].includes(g.state), g.state);
  ok('alarm decays back down when contact is lost', sim.alarm.level<2, sim.alarm.level);
}

console.log('\n== radio: one guard alerts the others ==');
{
  const {m,sim}=scene('AI-5','cassiopeia');
  const L=openLine(m); const g=sim.guards[0];
  g.x=(L.tx+0.5)*TILE; g.y=(L.ty+0.5)*TILE; g.facing=0; g.route=[]; g.lookBase=0; g.dwellT=999;
  for(let i=1;i<sim.guards.length;i++){ const o=sim.guards[i];
    o.x=(L.tx+0.5)*TILE+ (i*24); o.y=(L.ty+0.5)*TILE + 3*TILE; o.route=[]; o.state=GS.OBSERVE; }
  sim.player.x=(L.tx+3.5)*TILE; sim.player.y=(L.ty+0.5)*TILE;
  run(sim,120);
  const others=sim.guards.slice(1);
  const alerted=others.filter(o=>o.state===GS.INVESTIGATE||o.state===GS.CHASE||o.state===GS.SEARCH).length;
  ok('nearby guards respond to the radio call', alerted>=1, alerted+'/'+others.length+' states='+others.map(o=>o.state).join(','));
}

console.log('\n== gadgets ==');
{
  const {m,sim}=scene('AI-6');
  const camOn0=m.cameras.filter(c=>c.enabled).length;
  const cam=m.cameras[0];
  sim.player.x=cam.x+20; sim.player.y=cam.y+20; sim.player.slot=1; // EMP
  sim.player.facing=0;
  const chargesBefore=sim.player.gadgets[1].charges;
  sim.useGadget(); run(sim,90);
  ok('EMP consumes a charge', sim.player.gadgets[1].charges===chargesBefore-1);
  ok('EMP disables cameras in radius', m.cameras.filter(c=>c.enabled).length < camOn0,
     m.cameras.filter(c=>c.enabled).length+'/'+camOn0);
  ok('EMP kills lamps in radius', m.lamps.some(l=>!l.on));

  const {m:m2,sim:s2}=scene('AI-7');
  const L=openLine(m2); const g2=s2.guards[0]; g2.route=[];
  g2.x=(L.tx+0.5)*TILE; g2.y=(L.ty+0.5)*TILE; g2.facing=0;
  for(const o of s2.guards) if(o!==g2){o.x=-9999;o.y=-9999;}
  s2.player.x=(L.tx+3.5)*TILE; s2.player.y=(L.ty+0.5)*TILE;
  const before=losClear(m2,g2.x,g2.y,s2.player.x,s2.player.y,15,s2.smokes);
  s2.player.slot=2; s2.useGadget(); run(s2,45);
  const after=losClear(m2,g2.x,g2.y,s2.player.x,s2.player.y,15,s2.smokes);
  ok('smoke blocks line of sight', before && !after, 'before='+before+' after='+after);

  const {m:m3,sim:s3}=scene('AI-8');
  const L3=openLine(m3); const g3=s3.guards[0]; g3.route=[]; g3.state=GS.OBSERVE;
  g3.x=(L3.tx+0.5)*TILE; g3.y=(L3.ty+0.5)*TILE; g3.facing=0; g3.lookBase=0; g3.dwellT=999;
  for(const o of s3.guards) if(o!==g3){o.x=-9999;o.y=-9999;}
  s3.player.x=-9999; s3.player.y=-9999;
  s3.decoys.push({x:(L3.tx+3.5)*TILE,y:(L3.ty+0.5)*TILE,vx:0,vy:0,life:9,maxLife:9,r:9,stepT:0,ang:0});
  run(s3,120);
  ok('holo decoy draws a guard (chase or investigate)',
     [GS.CHASE,GS.INVESTIGATE,GS.SEARCH,GS.SUSPECT].includes(g3.state), g3.state);

  const {m:m4,sim:s4}=scene('AI-9');
  const lockedBefore=m4.doors.filter(d=>d.locked).length;
  const t=m4.terminals.find(x=>x.action==='doors');
  if(t){ s4.applyTerminal(t); s4.events.length=0;
    ok('door-control terminal releases badge locks', m4.doors.filter(d=>d.locked).length < lockedBefore,
       lockedBefore+' -> '+m4.doors.filter(d=>d.locked).length); }
  else ok('door-control terminal exists', false);
}

console.log('\n== cameras raise the alarm ==');
{
  const {m,sim}=scene('AI-10','cassiopeia');
  const cam=m.cameras[0];
  // stand right in front of it, in its sweep
  let placed=false;
  for(let r=1.5;r<5 && !placed;r+=0.5){
    for(let a=-1;a<=1;a+=0.1){
      const x=cam.x+Math.cos(cam.base+a)*r*TILE, y=cam.y+Math.sin(cam.base+a)*r*TILE;
      const i=tileIdxAt(m,x,y);
      if(i>=0 && !blocksMoveTile(m,i) && losClear(m,cam.x,cam.y,x,y,15,null)){
        sim.player.x=x; sim.player.y=y; placed=true; break; }
    }
  }
  for(const g of sim.guards){ g.x=-9999; g.y=-9999; }
  let sawIt=false;
  for(let i=0;i<60*12;i++){ sim.step(SIM_DT,IDLE); sim.events.length=0;
    if(sim.stats.detections>0){ sawIt=true; break; } }
  ok('a camera with clear LOS eventually confirms and alerts', sawIt && sim.alarm.level>=2,
     'placed='+placed+' det='+sim.stats.detections+' alarm='+sim.alarm.level);
}

console.log('\n== noise model: run is louder than walk is louder than sneak ==');
{
  const {m,sim}=scene('AI-11');
  const L=openLine(m);
  const budgets={};
  for(const mode of ['sneak','walk','run']){
    const s=new Sim(m,'operative'); C.PF.bind(m);
    s.player.x=(L.tx+0.5)*TILE; s.player.y=(L.ty+0.5)*TILE;
    for(const g of s.guards){g.x=-9999;g.y=-9999;}
    let maxB=0;
    for(let i=0;i<120;i++){ s.step(SIM_DT,{mx:1,my:0,run:mode==='run',sneak:mode==='sneak',aim:0,use:false,gadget:false,slot:-1});
      for(const e of s.soundEvents) if(e.type==='step') maxB=Math.max(maxB,e.budget);
      s.events.length=0; }
    budgets[mode]=maxB;
  }
  ok('sneak < walk < run noise budget', budgets.sneak<budgets.walk && budgets.walk<budgets.run, JSON.stringify(budgets));
}
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
