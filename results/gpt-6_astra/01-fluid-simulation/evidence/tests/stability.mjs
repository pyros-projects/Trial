import {ab,click,setRange,inspect,simSeconds,drag,frames,evaluate,save,assert,close,events} from './driver.mjs';
const data={samples:[]};
try{
 await click('Reset');await click('Pause simulation');ab('select','#resolution','256');await setRange('Simulation speed','End');await setRange('Viscosity','Home');await setRange('Vorticity','End');await setRange('Pressure iterations','End');await setRange('Interaction force','End');await setRange('Interaction radius','End');await click('Resume simulation');
 const points=Array.from({length:141},(_,i)=>[490+230*Math.cos(i*.10),470+160*Math.sin(i*.10)]);await drag(points,1100);
 for(let i=0;i<4;i++){await simSeconds(.5);data.samples.push(await inspect());}await click('Pause simulation');
 assert(data.samples.every(s=>s.finite&&s.glError===0&&s.kineticEnergy>0&&s.dyeMass>0),'High resolution, strong forces, fast time, and continuous strokes stay finite',{fps:data.samples.map(s=>s.fps),maxSpeed:data.samples.map(s=>s.maxSpeed),pending:data.samples.at(-1).pendingStrokes});
 assert(data.samples.at(-1).pendingStrokes===0&&data.samples.at(-1).pointerEvents>=100,'Rapid input is consumed without a lingering backlog',{events:data.samples.at(-1).pointerEvents,splats:data.samples.at(-1).splats});
 await click('Reset');await click('Pause simulation');data.reset=await inspect();assert(data.reset.config.resolution===160&&data.reset.config.speed===1&&data.reset.config.vorticity===18&&data.reset.config.force===.8&&data.reset.mode==='dye'&&data.reset.finite&&data.reset.dyeMass>0&&data.reset.kineticEnergy>0,'Reset restores the initial scene and defaults after stress');
 await click('Resume simulation');await drag([[100,400],[400,400],[1100,440],[1270,500]],650);await simSeconds(.15);await click('Pause simulation');const released=await inspect();ab('mouse','move','500','500');await frames(4);data.afterRelease=await inspect();assert(data.afterRelease.pointerEvents===released.pointerEvents&&data.afterRelease.pendingStrokes===0,'Pointer capture releases correctly after dragging outside the canvas');
 await click('Reset');await click('Pause simulation');await click('Resume simulation');await simSeconds(1.6);ab('screenshot','evidence/screenshots/desktop-final.png');await click('Pause simulation');
 data.final=await inspect();data.resources=await evaluate('performance.getEntriesByType("resource").map(r=>({name:r.name,type:r.initiatorType}))');data.overflow=await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');assert(data.resources.every(r=>!/^https?:/.test(r.name)),'Direct-file application loads no external resources',data.resources);assert(data.overflow.width===data.overflow.scroll,'Final desktop has no horizontal overflow');
 save('stability-events',events);
}finally{save('stability',data);close();}
