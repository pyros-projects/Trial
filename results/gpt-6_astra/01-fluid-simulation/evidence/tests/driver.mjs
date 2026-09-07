import {execFileSync} from 'node:child_process';
import {appendFileSync, writeFileSync} from 'node:fs';
export const session=process.env.FLUX_SESSION||'flux';
export function ab(...args){const command=['--session',session,...args];appendFileSync('evidence/logs/commands.txt','agent-browser '+command.map(a=>JSON.stringify(a)).join(' ')+'\n');return execFileSync('agent-browser',command,{encoding:'utf8',maxBuffer:8*1024*1024}).trim();}
const browserUrl=ab('get','cdp-url');
const pages=await (await fetch(browserUrl.replace(/^ws:/,'http:').replace(/\/devtools\/browser\/.*/,'/json/list'))).json();
const page=pages.find(p=>p.type==='page'&&p.url.includes('index.html'))||pages.find(p=>p.type==='page');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0;const pending=new Map();
export const events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result);}else events.push(m);};
export function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
export async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;}
export const inspect=()=>evaluate('fluidLab.inspect()');
export async function frames(n){return evaluate(`new Promise(resolve=>{let n=${n};function next(){if(--n<=0)resolve(fluidLab.status);else requestAnimationFrame(next);}requestAnimationFrame(next);})`);}
export async function simSeconds(n){return evaluate(`new Promise(resolve=>{const target=fluidLab.status.simTime+${n};function next(){if(fluidLab.status.simTime>=target)resolve(fluidLab.status);else requestAnimationFrame(next);}requestAnimationFrame(next);})`);}
export async function drag(points,duration=1000){await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:points[0][0],y:points[0][1]});await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:points[0][0],y:points[0][1],button:'left',buttons:1,clickCount:1});const started=performance.now(),moves=[];for(let i=1;i<points.length;i++){const at=started+duration*i/(points.length-1);const wait=at-performance.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));moves.push(cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:points[i][0],y:points[i][1],button:'left',buttons:1}));}await Promise.all(moves);const p=points.at(-1);await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:p[0],y:p[1],button:'left',buttons:0,clickCount:1});}
export async function click(name){ab('find','role','button','click','--name',name);}
export async function setRange(label,key){ab('find','label',label,'click');ab('press',key);}
export function save(name,data){writeFileSync('evidence/logs/'+name+'.json',JSON.stringify(data,null,2)+'\n');}
export function assert(condition,message,details={}){if(!condition){console.error('FAIL',message,details);throw Error(message);}console.log('PASS',message,JSON.stringify(details));}
export function close(){ws.close();}
await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Network.setCacheDisabled',{cacheDisabled:true});await cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await cdp('Network.setBlockedURLs',{urls:['http://*','https://*']});
