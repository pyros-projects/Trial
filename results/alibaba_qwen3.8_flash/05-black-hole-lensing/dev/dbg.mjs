import { makeIntegrator } from './geodesic.mjs';
const t = makeIntegrator({maxSteps:12, ds:0.02, escapeR:200, pathLimit:4000});
const r = t([-56.57, 20, 0],[0,1,0],{Rs:1, rHorizon:1});
console.log('status',r.status,'steps',r.steps,'pathLen',r.pathLen.toFixed(3));
console.log(r.points.map(p=>p.map(v=>v.toFixed(3)).join(',')).join('\n'));
