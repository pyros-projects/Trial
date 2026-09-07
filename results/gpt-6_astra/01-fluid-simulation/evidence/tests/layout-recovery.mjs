import {ab,cdp,evaluate,inspect,frames,simSeconds,click,drag,save,assert,close,events} from './driver.mjs';
const data={};
try{
 await click('Reset');await click('Pause simulation');data.beforeResize=await inspect();
 ab('select','#resolution','96');await frames(3);data.light=await inspect();assert(data.light.resolution[1]===96&&data.light.dyeMass>0&&data.light.kineticEnergy>0,'Light resolution preserves the fluid');
 ab('select','#resolution','256');await frames(3);data.detailed=await inspect();assert(data.detailed.resolution[1]===256&&data.detailed.finite&&data.detailed.dyeMass>0,'Detailed resolution preserves the fluid');
 ab('select','#resolution','160');
 await click('How it works');assert(await evaluate('document.getElementById("helpDialog").open'),'Guide opens');ab('screenshot','evidence/screenshots/guide.png');ab('press','Escape');assert(!await evaluate('document.getElementById("helpDialog").open'),'Escape dismisses guide');
 await click('Enter fullscreen');await frames(3);assert(await evaluate('!!document.fullscreenElement'),'Fullscreen enters');ab('screenshot','evidence/screenshots/fullscreen.png');ab('click','#exitFullscreen');await frames(3);assert(!await evaluate('document.fullscreenElement'),'Fullscreen exits');
 ab('set','viewport','1280','800','2');await frames(5);data.retina=await inspect();assert(data.retina.canvas[0]>=1800&&data.retina.canvas[1]>=1100&&data.retina.finite,'High-DPI drawing buffer scales with device pixels');ab('screenshot','evidence/screenshots/desktop-retina.png');
 ab('set','viewport','390','844','1');await frames(5);data.mobile=await inspect();assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'Narrow viewport has no horizontal overflow');ab('snapshot','-i');ab('screenshot','evidence/screenshots/mobile-initial.png');
 await click('Fluid controls');assert(await evaluate('document.getElementById("mobileToggle").getAttribute("aria-expanded")==="true"'),'Mobile controls expand');ab('scroll','down','565');ab('screenshot','evidence/screenshots/mobile-controls.png');
 await click('Resume simulation');await click('Coral dye');ab('scroll','up','900');
 await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const start=await inspect();
 await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:110,y:390,id:1,radiusX:6,radiusY:6,force:.8},{x:260,y:540,id:2,radiusX:6,radiusY:6,force:.8}]});
 for(let i=1;i<=18;i++){await cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110+i*6,y:390+i*7,id:1,radiusX:6,radiusY:6,force:.8},{x:260-i*6,y:540-i*5,id:2,radiusX:6,radiusY:6,force:.8}]});}
 await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await simSeconds(.35);data.touch=await inspect();assert(data.touch.splats>start.splats+10&&data.touch.pointerEvents>start.pointerEvents+10&&data.touch.finite,'Two-finger touch injects continuous fluid strokes',{addedSplats:data.touch.splats-start.splats,events:data.touch.pointerEvents-start.pointerEvents});assert(await evaluate('scrollY===0'),'Canvas touch does not scroll the page');ab('screenshot','evidence/screenshots/mobile-touch.png');
 await cdp('Emulation.setTouchEmulationEnabled',{enabled:false,maxTouchPoints:1});ab('focus','#fluid');ab('press','Space');
 await click('Velocity');assert((await inspect()).mode==='velocity','Narrow viewport diagnostic mode works');
 await click('Fluid controls');assert(await evaluate('document.getElementById("mobileToggle").getAttribute("aria-expanded")==="false"'),'Mobile controls collapse');
 ab('set','viewport','1280','800','1');await frames(5);await click('Reset');await click('Pause simulation');
 await evaluate('document.getElementById("fluid").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');await frames(3);assert(await evaluate('!document.getElementById("unsupported").hidden&&!fluidLab.ready'),'Context loss shows actionable recovery');ab('screenshot','evidence/screenshots/context-loss.png');await click('Try again');ab('wait','--fn','fluidLab.ready');data.recovered=await inspect();assert(data.recovered.finite&&data.recovered.dyeMass>0,'Try again recovers from graphics context loss');
 const injected=await cdp('Page.addScriptToEvaluateOnNewDocument',{source:'HTMLCanvasElement.prototype.getContext=function(){return null;}'});ab('reload');ab('wait','--text','A little more graphics power.');assert(await evaluate('!fluidLab.ready && document.getElementById("pauseBtn").disabled'),'Unsupported WebGL shows a usable explanation and disables unavailable actions');ab('screenshot','evidence/screenshots/unsupported-webgl.png');await cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});await click('Try again');ab('wait','--fn','fluidLab.ready');await click('Pause simulation');assert((await inspect()).finite,'Supported graphics restart after unsupported-capability check');
 save('layout-recovery',data);save('layout-recovery-events',events);
}finally{save('layout-recovery',data);close();}
