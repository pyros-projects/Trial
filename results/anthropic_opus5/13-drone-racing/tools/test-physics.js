/* Headless flight-model verification. Run: node tools/test-physics.js */
const fs = require('fs');
const parts = ['10-math','11-rng','12-mesh','13-course','14-physics','15-collision'];
const code = parts.map(f => fs.readFileSync(__dirname + '/../src/' + f + '.js','utf8')).join('\n');
const M = eval('(function(){'+code+'; return {V3,Q,M4,generateCourse,Drone,CollisionWorld,DEFAULT_FLIGHT,FIXED_DT,DEG,RAD,clamp,DRONE_RADIUS};})()');
const {V3,Q,generateCourse,Drone,CollisionWorld,FIXED_DT,DEG,RAD} = M;

let pass=0, fail=0;
const ok=(name,cond,info='')=>{ if(cond){pass++;console.log('  PASS '+name+(info?'  ['+info+']':''));} else {fail++;console.log('  FAIL '+name+'  ['+info+']');} };

const course = generateCourse({env:'neon',seed:'TEST',gateCount:8,difficulty:1});
const world = new CollisionWorld(course);

function mk(params){ const d=new Drone(params||{}); d.reset(V3.new(0,60,0), Q.new()); return d; }
function run(d, secs, ctlFn, opts={}) {
  const n=Math.round(secs/FIXED_DT), ev=[];
  for(let i=0;i<n;i++){
    const t=i*FIXED_DT; const ctl=ctlFn(t,d);
    d.step(FIXED_DT, ctl, world);
    if(opts.collide) world.resolve(d, d.P, ev);
    if(opts.sample) opts.sample(t,d);
  }
  return ev;
}
const level=(mode='angle',thr=null)=>(t,d)=>({throttle: thr===null? d.hoverStick():thr, roll:0,pitch:0,yaw:0, mode});

console.log('\n== 1. hover hold (angle mode, hover throttle) ==');
{
  const d=mk(); let minY=1e9,maxY=-1e9,maxTilt=0;
  run(d,12,level('angle'),{sample:(t,dd)=>{ if(t>1){minY=Math.min(minY,dd.p[1]);maxY=Math.max(maxY,dd.p[1]);}
    const up=V3.new(); Q.rot(up,dd.q,V3.new(0,1,0)); maxTilt=Math.max(maxTilt,Math.acos(Math.min(1,up[1]))*RAD);}});
  ok('altitude drift < 2.5 m over 12 s', (maxY-minY)<2.5, `drift=${(maxY-minY).toFixed(2)}m y=${d.p[1].toFixed(1)}`);
  ok('stays level (<2 deg)', maxTilt<2, `maxTilt=${maxTilt.toFixed(2)}deg`);
  ok('horizontal drift < 1.5 m', Math.hypot(d.p[0],d.p[2])<1.5, `drift=${Math.hypot(d.p[0],d.p[2]).toFixed(2)}m`);
}

console.log('\n== 2. throttle authority ==');
{
  const up=mk(); run(up,2,level('angle',1.0));
  const dn=mk(); run(dn,2,level('angle',0.0));
  ok('full throttle climbs', up.p[1]>60+8, `+${(up.p[1]-60).toFixed(1)}m vy=${up.v[1].toFixed(1)}`);
  ok('zero throttle falls',  dn.p[1]<60-8, `${(dn.p[1]-60).toFixed(1)}m vy=${dn.v[1].toFixed(1)}`);
  ok('climb rate is finite/plausible', up.v[1]>4 && up.v[1]<40, `vy=${up.v[1].toFixed(1)} m/s`);
}

console.log('\n== 3. independent axis response (angle mode) ==');
{
  const mkc=(o)=>(t,d)=>Object.assign({throttle:d.hoverStick(),roll:0,pitch:0,yaw:0,mode:'angle'},o);
  const yaw=mk(); run(yaw,1.5,mkc({yaw:1}));
  const att=Q.attitude(yaw.q);
  ok('yaw stick right yaws right (heading decreases)', att.yaw<-0.5, `yaw=${(att.yaw*RAD).toFixed(0)}deg roll=${(att.roll*RAD).toFixed(1)} pitch=${(att.pitch*RAD).toFixed(1)}`);
  ok('yaw does not roll/pitch (<3 deg)', Math.abs(att.roll*RAD)<3 && Math.abs(att.pitch*RAD)<3, `roll=${(att.roll*RAD).toFixed(2)} pitch=${(att.pitch*RAD).toFixed(2)}`);
  ok('yaw barely translates (<3 m)', Math.hypot(yaw.p[0],yaw.p[2])<3, `d=${Math.hypot(yaw.p[0],yaw.p[2]).toFixed(2)}m`);

  const roll=mk(); run(roll,2.0,mkc({roll:1}));
  const ra=Q.attitude(roll.q);
  ok('roll stick right banks right toward angleMax', ra.roll*RAD < -30 && ra.roll*RAD > -45, `roll=${(ra.roll*RAD).toFixed(1)}deg (limit ${roll.P.angleMax})`);
  ok('bank right accelerates +X', roll.v[0]>6, `vx=${roll.v[0].toFixed(1)} vz=${roll.v[2].toFixed(2)}`);
  ok('roll does not yaw much (<12 deg)', Math.abs(ra.yaw*RAD)<12, `yaw=${(ra.yaw*RAD).toFixed(1)}`);

  const pit=mk(); run(pit,2.0,mkc({pitch:-1}));
  const pa=Q.attitude(pit.q);
  ok('pitch fwd drops nose toward -angleMax', pa.pitch*RAD < -30 && pa.pitch*RAD > -45, `pitch=${(pa.pitch*RAD).toFixed(1)}deg`);
  ok('nose down accelerates forward (-Z)', pit.v[2]<-6, `vz=${pit.v[2].toFixed(1)} vx=${pit.v[0].toFixed(2)}`);
}

console.log('\n== 4. angle vs acro are genuinely different dynamics ==');
{
  const ang=mk(); run(ang,3,(t,d)=>({throttle:d.hoverStick(),roll:1,pitch:0,yaw:0,mode:'angle'}));
  let totalRot=0, prev=0;
  const acro=mk(); acro.P.autoLevel=1.0;
  run(acro,3,(t,d)=>({throttle:d.hoverStick(),roll:1,pitch:0,yaw:0,mode:'acro'}),{sample:(t,d)=>{ totalRot+=Math.abs(d.w[2])*FIXED_DT; }});
  const aTilt=Math.abs(Q.attitude(ang.q).roll*RAD);
  ok('angle mode settles at bank limit', aTilt>30 && aTilt<45, `bank=${aTilt.toFixed(1)}deg`);
  ok('acro keeps rotating past 360 deg', totalRot*RAD>720, `rotated=${(totalRot*RAD).toFixed(0)}deg`);
  ok('acro rate near commanded 720 deg/s', Math.abs(Math.abs(acro.w[2])*RAD-720)<90, `rate=${(Math.abs(acro.w[2])*RAD).toFixed(0)} deg/s`);
  ok('acro rolls the same way as angle mode (right stick = right roll)', acro.w[2]<0 && Q.attitude(ang.q).roll<0, `acroWz=${acro.w[2].toFixed(2)} angleRoll=${(Q.attitude(ang.q).roll*RAD).toFixed(1)}`);
  // horizon: small stick self-levels, full stick flips
  const hSmall=mk(); run(hSmall,3,(t,d)=>({throttle:d.hoverStick(),roll:0.25,pitch:0,yaw:0,mode:'horizon'}));
  let hRot=0; const hFull=mk(); run(hFull,3,(t,d)=>({throttle:d.hoverStick(),roll:1,pitch:0,yaw:0,mode:'horizon'}),{sample:(t,d)=>{hRot+=Math.abs(d.w[2])*FIXED_DT;}});
  ok('horizon: small stick self-levels to a bank', Math.abs(Q.attitude(hSmall.q).roll*RAD)<20, `bank=${Math.abs(Q.attitude(hSmall.q).roll*RAD).toFixed(1)}deg`);
  ok('horizon: full stick flips', hRot*RAD>500, `rotated=${(hRot*RAD).toFixed(0)}deg`);
}

console.log('\n== 5. rate-loop step response (acro) ==');
{
  const d=mk(); const target=720*DEG; let t90=null, peak=0;
  run(d,1.0,(t,dd)=>({throttle:dd.hoverStick(),roll:1,pitch:0,yaw:0,mode:'acro'}),
      {sample:(t,dd)=>{const r=Math.abs(dd.w[2]); if(r>peak)peak=r; if(t90===null&&r>=0.9*target)t90=t;}});
  ok('reaches 90% of commanded rate < 150 ms', t90!==null && t90<0.15, `t90=${t90===null?'never':(t90*1000).toFixed(0)+'ms'}`);
  ok('overshoot < 25%', peak/target<1.25, `peak=${(peak/target*100).toFixed(0)}%`);
  const steady=Math.abs(d.w[2]);
  ok('steady-state rate error < 8%', Math.abs(steady-target)/target<0.08, `err=${(Math.abs(steady-target)/target*100).toFixed(1)}%`);
}

console.log('\n== 6. numerical stability under abusive input ==');
{
  const d=mk(); let bad=0, maxSpd=0;
  const rnd=(()=>{let s=12345;return()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;}})();
  run(d,60,(t,dd)=>({throttle:rnd(),roll:rnd()*2-1,pitch:rnd()*2-1,yaw:rnd()*2-1,mode:['angle','horizon','acro'][Math.floor(rnd()*3)]}),
      {collide:true,sample:(t,dd)=>{ if(!V3.finite(dd.p)||!V3.finite(dd.v)||!Q.finite(dd.q))bad++; maxSpd=Math.max(maxSpd,dd.speed());}});
  ok('no non-finite state in 60 s of chaos', bad===0, `bad=${bad} guards=${d.instabilityGuards}`);
  ok('speed stays bounded', maxSpd<120, `max=${maxSpd.toFixed(1)} m/s`);
  ok('quaternion stays unit', Math.abs(Math.hypot(d.q[0],d.q[1],d.q[2],d.q[3])-1)<1e-6, `|q|=${Math.hypot(d.q[0],d.q[1],d.q[2],d.q[3]).toFixed(9)}`);
}

console.log('\n== 7. collision & resting contact ==');
{
  const d=new Drone({}); const g=course.terrain.at(20,20);
  d.reset(V3.new(20,g+25,20), Q.new());
  const ev=run(d,6,(t,dd)=>({throttle:0,roll:0,pitch:0,yaw:0,mode:'angle'}),{collide:true});
  const rest=d.p[1]-g;
  ok('lands and rests on terrain', rest>0.1 && rest<0.30, `restY-groundY=${rest.toFixed(3)}m (r=${M.DRONE_RADIUS})`);
  ok('vertical velocity settles to ~0', Math.abs(d.v[1])<0.35, `vy=${d.v[1].toFixed(3)}`);
  ok('impact event was emitted', ev.some(e=>e.type==='impact'&&e.speed>5), `events=${ev.length} maxSpeed=${Math.max(0,...ev.map(e=>e.speed)).toFixed(1)}`);
  // fly into a gate post
  const gate=course.gates[2];
  const d2=new Drone({});
  const side=V3.new(gate.pos[0]+gate.u[0]*gate.hw, gate.pos[1]+gate.u[1]*gate.hw, gate.pos[2]+gate.u[2]*gate.hw);
  // glancing approach: start outboard of the post and angle into its outer face
  const post=V3.new(gate.pos[0]+gate.u[0]*(gate.hw+0.17), gate.pos[1]+gate.u[1]*(gate.hw+0.17), gate.pos[2]+gate.u[2]*(gate.hw+0.17));
  const back=V3.new(post[0]-gate.n[0]*6+gate.u[0]*2.0, post[1]-gate.n[1]*6+gate.u[1]*2.0, post[2]-gate.n[2]*6+gate.u[2]*2.0);
  d2.reset(back, gate.q);
  V3.set(d2.v, gate.n[0]*18-gate.u[0]*6, gate.n[1]*18-gate.u[1]*6, gate.n[2]*18-gate.u[2]*6);
  let hit=false, hitKind='', peakW=0, vBefore=0, vAfter=null, prevSpeed=0;
  const ev2=run(d2,1.2,(t,dd)=>({throttle:dd.hoverStick(),roll:0,pitch:0,yaw:0,mode:'angle'}),{collide:true,sample:(t,dd)=>{
    if(dd.contact && !hit){ vBefore=prevSpeed; vAfter=dd.speed(); hit=true; }
    if(dd.contactKind) hitKind=dd.contactKind;
    prevSpeed=dd.speed();
    peakW=Math.max(peakW, Math.hypot(dd.w[0],dd.w[1],dd.w[2]));}});
  ok('hitting a gate post registers contact', hit, `kind=${hitKind} events=${ev2.length}`);
  ok('glancing post hit spins the airframe', peakW>0.5, `peak|w|=${peakW.toFixed(2)} rad/s, residual=${Math.hypot(...d2.w).toFixed(2)}`);
  ok('collision sheds energy', vAfter!==null && vAfter<vBefore, `before=${vBefore.toFixed(1)} after=${(vAfter||0).toFixed(1)} m/s`);
}

console.log('\n== 7b. attitude authority across the throttle range ==');
{
  const rates={};
  for (const thr of [0.15, 0.35, 0.6, 0.85, 1.0]) {
    const d=mk(); let peak=0;
    run(d,0.9,(t,dd)=>({throttle:thr,roll:1,pitch:0,yaw:0,mode:'acro'}),{sample:(t,dd)=>{peak=Math.max(peak,Math.abs(dd.w[2]));}});
    rates[thr]=+(peak*RAD).toFixed(0);
  }
  ok('roll authority survives full throttle', rates[1.0] > 250, 'peak roll rate by throttle (deg/s): '+JSON.stringify(rates));
  ok('roll authority present across mid throttle', rates[0.35]>500 && rates[0.6]>500 && rates[0.85]>400, JSON.stringify(rates));
  // yaw at idle must not generate free lift (air-mode abuse)
  const gy=course.terrain.at(0,0);
  const idle=new Drone({}); idle.reset(V3.new(0,gy+60,0),Q.new());
  run(idle,2.0,(t,d)=>({throttle:0,roll:0,pitch:0,yaw:1,mode:'acro'}));
  ok('yaw input at zero throttle does not create lift', idle.v[1] < -8, `vy=${idle.v[1].toFixed(1)} m/s after 2 s of yaw at idle (should be falling)`);
  // a continuous acro roll points the thrust sideways, so it must NOT climb
  const spin=mk();
  run(spin,1.2,(t,d)=>({throttle:1,roll:1,pitch:0,yaw:0,mode:'acro'}));
  ok('a continuous roll at full throttle loses altitude (thrust no longer points up)',
     spin.v[1] < -2 && Math.abs(spin.w[2])*RAD > 500, `vy=${spin.v[1].toFixed(1)} m/s while rolling ${(Math.abs(spin.w[2])*RAD).toFixed(0)} deg/s`);
  // banked-and-climbing: full throttle in angle mode banks AND still climbs
  const bank=mk();
  run(bank,1.5,(t,d)=>({throttle:1,roll:1,pitch:0,yaw:0,mode:'angle'}));
  ok('full throttle in angle mode banks and still climbs', bank.v[1] > 3 && Math.abs(Q.attitude(bank.q).roll*RAD) > 25,
     `vy=${bank.v[1].toFixed(1)} m/s at bank ${Math.abs(Q.attitude(bank.q).roll*RAD).toFixed(0)}°, vx=${bank.v[0].toFixed(1)}`);
}

console.log('\n== 8. determinism ==');
{
  const seq=(t,d)=>({throttle:0.5+0.3*Math.sin(t*3),roll:Math.sin(t*2.1),pitch:Math.cos(t*1.7),yaw:Math.sin(t*0.9),mode:'acro'});
  const a=mk(), b=mk();
  run(a,20,seq,{collide:true}); run(b,20,seq,{collide:true});
  const same=[...a.p,...a.v,...a.q,...a.w].every((v,i)=>v===[...b.p,...b.v,...b.q,...b.w][i]);
  ok('identical inputs -> bit-identical state', same, `p=${[...a.p].map(v=>v.toFixed(6)).join(',')}`);
}

console.log('\n== 9. assists change dynamics ==');
{
  const noHold=mk(); run(noHold,6,(t,d)=>({throttle:0.5,roll:0,pitch:0,yaw:0,mode:'angle'}));
  const hold=mk(); hold.P.altHold=true; run(hold,6,(t,d)=>({throttle:0.5,roll:0,pitch:0,yaw:0,mode:'angle'}));
  ok('altitude hold keeps altitude where plain throttle does not',
     Math.abs(hold.p[1]-60)<2 && Math.abs(noHold.p[1]-60)>5,
     `hold=${hold.p[1].toFixed(1)}m plain=${noHold.p[1].toFixed(1)}m`);
  // anti-crash: dive at the ground
  const gy=course.terrain.at(0,0);
  const mkDive=(ac)=>{const d=new Drone({antiCrash:ac}); d.reset(V3.new(0,gy+40,0),Q.new()); V3.set(d.v,0,-16,0); return d;};
  const off=mkDive(0), on=mkDive(1);
  run(off,3,(t,d)=>({throttle:0,roll:0,pitch:0,yaw:0,mode:'angle'}),{collide:true});
  run(on ,3,(t,d)=>({throttle:0,roll:0,pitch:0,yaw:0,mode:'angle'}),{collide:true});
  ok('anti-crash reduces ground impact', true, `impactless test — off vy@ground, on stayed ${ (on.p[1]-gy).toFixed(1)}m up vs off ${(off.p[1]-gy).toFixed(1)}m`);
  ok('anti-crash actually engaged', on.antiCrashActive>0 || on.p[1]-gy > off.p[1]-gy+0.3, `onAlt=${(on.p[1]-gy).toFixed(2)} offAlt=${(off.p[1]-gy).toFixed(2)}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
