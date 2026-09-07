// Supplemental real input through the same Chrome session. agent-browser 0.31.1
// wheel dispatches at (0,0), so use CDP with explicit coordinates for this check.
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
const browser=execFileSync('agent-browser',['--session',process.env.HORIZON_BROWSER_SESSION||'horizon','get','cdp-url'],{encoding:'utf8'}).trim();
const base='http://'+new URL(browser).host;
const pages=await (await fetch(base+'/json/list')).json();
const page=pages.find(p=>p.url.includes('05-black-hole-lensing/index.html'));
if(!page)throw Error('Active Horizon tab not found');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));appendFileSync(new URL('./logs/cdp-actions.jsonl',import.meta.url),JSON.stringify({method,params})+'\n');});}
const kind=process.argv[2]||'wheel';
const read=async()=>{const r=await send('Runtime.evaluate',{expression:'JSON.stringify({camera:Horizon.diagnostics.camera,settings:Horizon.diagnostics.settings,selected:Horizon.diagnostics.selected,errors:Horizon.diagnostics.errors,pixels:Horizon.samplePixels()})',returnByValue:true});return JSON.parse(r.result.value);};
const before=await read();
if(kind==='hidpi')await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
if(kind==='desktop')await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
if(kind==='wheel')await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:440,y:370,deltaY:-90,deltaX:0});
if(kind==='touch'){
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const point=(x,y,id)=>({x,y,id,radiusX:3,radiusY:3,force:1});
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(170,345,1)]});
 for(const [x,y] of [[184,350],[200,362],[220,375]])await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(x,y,1)]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(155,365,1),point(230,370,2)]});
 for(let i=1;i<=5;i++)await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(155-i*6,365+i*3,1),point(230+i*8,370+i*3,2)]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
if(kind==='tap'){
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:240,y:340,id:1,radiusX:3,radiusY:3,force:1}]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
await new Promise(r=>setTimeout(r,400));const after=await read();console.log(JSON.stringify({kind,before,after}));ws.close();
