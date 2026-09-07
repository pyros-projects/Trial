import {ab,cdp,evaluate,inspect,frames,simSeconds,drag,click,save,assert,close,events} from './driver.mjs';
const log={};
try{
 await click('Reset');await simSeconds(.25);await click('Pause simulation');
 log.paused=await inspect();await frames(8);log.stillPaused=await inspect();
 assert(log.paused.steps===log.stillPaused.steps && log.paused.kineticEnergy===log.stillPaused.kineticEnergy && log.paused.dyeMass===log.stillPaused.dyeMass,'Pause freezes physical state');
 await click('Clear dye');log.clear=await inspect();
 assert(log.clear.dyeMass===0 && log.clear.kineticEnergy===log.paused.kineticEnergy,'Clear dye preserves velocity exactly',{beforeEnergy:log.paused.kineticEnergy,afterEnergy:log.clear.kineticEnergy,dye:log.clear.dyeMass});
 await click('Seafoam dye');await click('Resume simulation');
 ab('mouse','move','210','420');ab('mouse','down','left');ab('mouse','move','240','440');ab('mouse','move','270','465');ab('mouse','up','left');
 await drag(Array.from({length:31},(_,i)=>[270+i*10,465+60*Math.sin(i/9)]),1800);
 log.slow=await inspect();await drag(Array.from({length:45},(_,i)=>[640-i*8,565-105*Math.sin(i/14)]),170);
 log.fast=await inspect();await simSeconds(.5);await click('Pause simulation');log.dragged=await inspect();
 assert(log.dragged.splats>=30 && log.dragged.dyeMass>0 && log.dragged.finite,'Slow and rapid pointer strokes inject finite moving dye',{splats:log.dragged.splats,events:log.dragged.pointerEvents,dye:log.dragged.dyeMass});
 assert(log.fast.lastDragSpeed>log.slow.lastDragSpeed && log.fast.lastForce[0]<0 && log.slow.lastForce[0]>0,'Drag speed and direction influence momentum',{slow:log.slow.lastDragSpeed,fast:log.fast.lastDragSpeed,slowForce:log.slow.lastForce,fastForce:log.fast.lastForce});
 ab('screenshot','evidence/screenshots/pointer-dye.png');
 await click('Resume simulation');await simSeconds(.7);await click('Pause simulation');log.advected=await inspect();
 assert(log.advected.kineticEnergy>0 && Math.hypot(...log.advected.dyeCentroid.map((v,i)=>v-log.dragged.dyeCentroid[i]))>.0001,'Dye advects after pointer release',{before:log.dragged.dyeCentroid,after:log.advected.dyeCentroid});
 assert(log.advected.divergenceAfter<log.advected.divergenceBefore,'Pressure projection reduces divergence',{before:log.advected.divergenceBefore,after:log.advected.divergenceAfter});
 const steps=log.advected.steps;
 for(const [label,mode] of [['Velocity','velocity'],['Pressure','pressure'],['Vorticity','curl'],['Divergence','divergence'],['Dye','dye']]){await click(label);const s=await inspect();assert(s.mode===mode&&s.steps===steps,'Mode switch preserves the simulation: '+label);ab('screenshot','evidence/screenshots/mode-'+mode+'.png');}
 await click('Resume simulation');await simSeconds(.2);await click('Pressure');await simSeconds(.2);assert((await inspect()).mode==='pressure','Modes switch while running');
 ab('focus','#fluid');ab('press','Space');log.keyboardPause=await inspect();assert(log.keyboardPause.paused,'Space pauses focused canvas');ab('press','1');ab('press','ArrowRight');ab('press','ArrowUp');log.queued=await inspect();assert(log.queued.pendingStrokes>=2,'Keyboard arrows queue momentum while paused');ab('press','Space');await simSeconds(.15);await click('Pause simulation');log.keyboardAfter=await inspect();assert(log.keyboardAfter.splats>=log.keyboardPause.splats+2,'Resume applies queued keyboard strokes');
 save('lifecycle',log);save('lifecycle-browser-events',events);console.log('Lifecycle checks complete');
}finally{save('lifecycle',log);close();}
