import {ab,click,setRange,inspect,simSeconds,save,assert,close} from './driver.mjs';
const results={};
async function trial(name,viscosity,vorticity){await click('Reset');await click('Pause simulation');await setRange('Viscosity',viscosity?'End':'Home');await setRange('Vorticity',vorticity?'End':'Home');results[name]={initial:await inspect()};await click('Resume simulation');await simSeconds(1.4);await click('Pause simulation');results[name].final=await inspect();await click('Velocity');ab('screenshot','evidence/screenshots/physics-'+name+'.png');}
try{
 await trial('inviscid',false,false);await trial('viscous',true,false);
 assert(results.viscous.final.kineticEnergy<results.inviscid.final.kineticEnergy*.85,'High viscosity smooths and reduces kinetic energy',{low:results.inviscid.final.kineticEnergy,high:results.viscous.final.kineticEnergy});
 assert(results.viscous.final.curlRMS<results.inviscid.final.curlRMS*.7,'High viscosity suppresses small velocity variations',{low:results.inviscid.final.curlRMS,high:results.viscous.final.curlRMS});
 await trial('swirling',false,true);
 assert(results.swirling.final.curlRMS>results.inviscid.final.curlRMS*1.5,'Vorticity increases visible swirling',{zero:results.inviscid.final.curlRMS,high:results.swirling.final.curlRMS});
 assert(Object.values(results).every(r=>r.final.finite&&r.final.glError===0),'Parameter extremes retain finite fields');
 save('physics-controls',results);
}finally{save('physics-controls',results);close();}
