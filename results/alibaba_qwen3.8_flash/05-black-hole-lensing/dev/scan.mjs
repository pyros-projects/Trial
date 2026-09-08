import { traceGeodesic } from './geodesic.mjs';
const R0=60, ESC=60;
function beam(b){const f0=Math.max(0.05,1-1/R0);const sinA=Math.min(0.999,(b*Math.sqrt(f0))/R0);const cosA=Math.sqrt(Math.max(0,1-sinA*sinA));return {p:[0,-R0,0],d:[sinA,cosA,0]};}
const bc=3*Math.sqrt(3)/2;
console.log('b_c =',bc.toFixed(6));
for(const b of [2.5981,2.5985,2.599,2.6005,2.605,2.62,2.68,2.9,3.5]){
  const {p,d}=beam(b);
  const r=traceGeodesic(p,d,{Rs:1,rHorizon:1,escapeR:ESC,pathLimit:4000,step:0.15,maxSteps:200000,diskIn:3,diskOut:12,thick:0.12},false);
  console.log(`b=${b.toFixed(4)} (b/bc-1=${((b/bc-1)*100).toFixed(3)}%) ${r.status.padEnd(9)} steps=${String(r.steps).padStart(6)} turns=${(r.defl/6.28319).toFixed(2)} defl=${r.defl.toFixed(3)} minR=${r.minR.toFixed(3)}`);
}
