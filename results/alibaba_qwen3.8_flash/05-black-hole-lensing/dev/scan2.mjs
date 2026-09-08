import { traceGeodesic } from './geodesic.mjs';
const R0=60, ESC=60;
function beam(b){const f0=Math.max(0.05,1-1/R0);const sinA=Math.min(0.999,(b*Math.sqrt(f0))/R0);const cosA=Math.sqrt(Math.max(0,1-sinA*sinA));return {p:[0,-R0,0],d:[sinA,cosA,0]};}
for(const b of [2.5981,2.62,2.68,2.9,3.5,8]){
  const {p,d}=beam(b);
  const r=traceGeodesic(p,d,{Rs:1,rHorizon:1,escapeR:ESC,pathLimit:5000,step:0.15,maxSteps:400000,diskIn:3,diskOut:12,thick:0.12},false);
  // count full revolutions by tracking the polar angle of the polyline
  let prevAng=Math.atan2(p[1],p[0]), tot=0;
  for(let i=1;i<r.n;i++){
    const a=Math.atan2(r.pts[i*3+1],r.pts[i*3]);
    let da=a-prevAng; while(da>Math.PI)da-=2*Math.PI; while(da<-Math.PI)da+=2*Math.PI;
    tot+=da; prevAng=a;
  }
  let inside3=0; for(let i=1;i<r.n;i++){const rr=Math.hypot(r.pts[i*3],r.pts[i*3+1],r.pts[i*3+2]); if(rr<3)inside3++;}
  console.log(`b=${b} ${r.status} steps=${r.steps} pathLen=${r.pathLen.toFixed(1)} polarSweep=${tot.toFixed(2)}rad=${(tot/6.283).toFixed(2)}turns samplesInsideR3=${inside3} defl=${r.defl.toFixed(3)} minR=${r.minR.toFixed(3)}`);
}
