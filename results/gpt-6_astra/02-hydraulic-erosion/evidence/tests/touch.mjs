import {send,close} from './cdp.mjs';
import fs from 'node:fs';
const read=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const touch=async(type,points)=>{await send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id,radiusX:3,radiusY:3,force:1}))});await wait(70);};
const results={};
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
let before=await read('window.terra.diagnostics()');
await touch('touchStart',[[200,470,1]]);await touch('touchMove',[[220,485,1]]);await touch('touchMove',[[240,495,1]]);await touch('touchEnd',[]);
let after=await read('window.terra.diagnostics()');if(after.camera.yaw===before.camera.yaw||after.terrain!==before.terrain)throw Error('Touch orbit failed');results.orbit={before:before.camera,after:after.camera};
// Two simultaneous fingers: pinch changes distance; midpoint moves pan.
before=after;await touch('touchStart',[[150,440,1],[240,500,2]]);await touch('touchMove',[[130,430,1],[280,530,2]]);await touch('touchEnd',[]);after=await read('window.terra.diagnostics()');if(after.camera.distance>=before.camera.distance||after.camera.panX===before.camera.panX||after.terrain!==before.terrain)throw Error('Pinch or pan failed');results.pinchPan={before:before.camera,after:after.camera};
await send('Emulation.setTouchEmulationEnabled',{enabled:false,maxTouchPoints:1});fs.writeFileSync(new URL('../logs/touch-results.json',import.meta.url),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));close();
