const fs=require('fs');
const code=['10-math','11-rng','12-mesh','13-course'].map(f=>fs.readFileSync('src/'+f+'.js','utf8')).join('\n');
const M=eval('(function(){'+code+'; return {generateCourse,COURSE_PRESETS,ENVIRONMENTS,V3,Q,colliderDistance,DIFFICULTY};})()');
const {generateCourse,COURSE_PRESETS,V3,Q,colliderDistance}=M;
let fails=0;
for(const p of COURSE_PRESETS){
  const c=generateCourse({env:p.env,seed:p.seed,gateCount:p.gates,difficulty:p.difficulty});
  // gate clearance
  let minClear=1e9,minGap=1e9;
  for(const g of c.gates){ minClear=Math.min(minClear, g.pos[1]-c.terrain.at(g.pos[0],g.pos[2])-g.hh); }
  for(let i=0;i<c.gates.length;i++){const a=c.gates[i],b=c.gates[(i+1)%c.gates.length];minGap=Math.min(minGap,V3.dist(a.pos,b.pos));}
  // path corridor free?
  const probe=V3.new(); let block=0,minTerr=1e9,minObs=1e9;
  for(let s=0;s<c.path.totalLen;s+=2){
    c.path.atArc(s,probe);
    const th=c.terrain.at(probe[0],probe[2]); minTerr=Math.min(minTerr,probe[1]-th);
    for(const col of c.colliders){ if(col.kind==='gate'||col.kind==='gateleg'||col.kind==='pad'||col.kind==='padpylon')continue;
      const d=colliderDistance(col,probe); if(d<minObs)minObs=d; if(d<1.5)block++; }
  }
  const ok = minClear>0.5 && minTerr>1.0 && block===0;
  if(!ok)fails++;
  console.log(`${ok?'PASS':'FAIL'} ${p.name.padEnd(19)} gates=${c.gates.length} len=${c.path.totalLen.toFixed(0)}m colliders=${c.colliders.length} minGateClear=${minClear.toFixed(1)}m minPathTerrClear=${minTerr.toFixed(1)}m minObsDist=${minObs.toFixed(1)}m blocked=${block} removed=${c.stats.removedObstacles} gen=${c.stats.genMs.toFixed(0)}ms minGateGap=${minGap.toFixed(0)}m`);
}
// the final approach to the start gate must clear the launch pad
{
  let worst=1e9, worstName='';
  for(const p of COURSE_PRESETS){
    const c=generateCourse({env:p.env,seed:p.seed,gateCount:p.gates,difficulty:p.difficulty});
    const pad=c.colliders.find(x=>x.kind==='pad'); const g0=c.gates[0];
    // sample the last 40 m of the lap: from 40 m before gate 0, along its normal
    for(let d=40;d>=0;d-=1){
      const probe=V3.new(g0.pos[0]-g0.n[0]*d, g0.pos[1]-g0.n[1]*d, g0.pos[2]-g0.n[2]*d);
      const dist=colliderDistance(pad,probe);
      if(dist<worst){worst=dist;worstName=p.name;}
    }
  }
  console.log(`${worst>1.0?'PASS':'FAIL'} launch pad clears the gate-0 approach line (min ${worst.toFixed(2)} m, worst on ${worstName})`);
  if(worst<=1.0) fails++;
}

// determinism
const a=generateCourse({env:'canyon',seed:'ZZ-1',gateCount:9,difficulty:1});
const b=generateCourse({env:'canyon',seed:'ZZ-1',gateCount:9,difficulty:1});
const same=JSON.stringify([...a.gates.map(g=>[...g.pos])])===JSON.stringify([...b.gates.map(g=>[...g.pos])]) && a.colliders.length===b.colliders.length;
const c3=generateCourse({env:'canyon',seed:'ZZ-2',gateCount:9,difficulty:1});
const diff=JSON.stringify([...a.gates.map(g=>[...g.pos])])!==JSON.stringify([...c3.gates.map(g=>[...g.pos])]);
console.log('determinism identical:',same,' different seed differs:',diff);
// start pose sanity: does start face gate 0?
const c0=generateCourse({env:'neon',seed:'RAPTOR-1',gateCount:9,difficulty:1});
const f=V3.new(); Q.rot(f,c0.start.quat,V3.new(0,0,-1));
const to=V3.norm(V3.new(),V3.sub(V3.new(),c0.gates[0].pos,c0.start.pos));
console.log('start faces gate0 dot=',V3.dot(f,to).toFixed(3),' dist=',V3.dist(c0.start.pos,c0.gates[0].pos).toFixed(1),'m  startY=',c0.start.pos[1].toFixed(1),' gate0Y=',c0.gates[0].pos[1].toFixed(1));
// gate normal points along travel direction?
let ndots=[];
for(let i=0;i<c0.gates.length;i++){const g=c0.gates[i],n=c0.gates[(i+1)%c0.gates.length];
  const d=V3.norm(V3.new(),V3.sub(V3.new(),n.pos,g.pos)); ndots.push(V3.dot(g.n,d).toFixed(2));}
console.log('gate normal · to-next-gate:',ndots.join(' '));
process.exit(fails?1:0);
