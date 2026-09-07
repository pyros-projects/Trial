import {send,close} from './cdp.mjs';
const read=async e=>(await send('Runtime.evaluate',{expression:e,returnByValue:true})).result.value;const wait=ms=>new Promise(r=>setTimeout(r,ms));
await read('window.pointerLog=[];for(const t of ["pointerdown","pointermove","pointerup","pointercancel","lostpointercapture"])document.addEventListener(t,e=>pointerLog.push({type:e.type,id:e.pointerId,x:e.clientX,y:e.clientY}),true);true');
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
for(const [type,p]of [['touchStart',[[150,440,1],[240,500,2]]],['touchMove',[[130,430,1],[260,520,2]]],['touchEnd',[[130,430,1]]],['touchMove',[[175,445,1]]],['touchEnd',[]]]){await send('Input.dispatchTouchEvent',{type,touchPoints:p.map(([x,y,id])=>({x,y,id,radiusX:3,radiusY:3,force:1}))});await wait(90);console.log(type,JSON.stringify(await read('({action:activeAction,pointers:[...pointers],yaw:camera.yaw,log:pointerLog})')));}
await send('Emulation.setTouchEmulationEnabled',{enabled:false,maxTouchPoints:1});close();
