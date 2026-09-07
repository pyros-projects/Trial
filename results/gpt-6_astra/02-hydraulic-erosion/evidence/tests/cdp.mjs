// Supplemental real input in the agent-browser session. No delivered dependency.
import {execFileSync} from 'node:child_process';
const browser=execFileSync('agent-browser',['--session','terra','get','cdp-url'],{encoding:'utf8'}).trim();
const url=new URL(browser);const targets=await(await fetch(`http://127.0.0.1:${url.port}/json/list`)).json();
const target=targets.find(t=>t.type==='page'&&t.url.includes('02-hydraulic-erosion'));
if(!target)throw Error('Terra page not found');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let seq=0;const pending=new Map();ws.onmessage=e=>{const data=JSON.parse(e.data);if(pending.has(data.id)){const {resolve,reject}=pending.get(data.id);pending.delete(data.id);data.error?reject(data.error):resolve(data.result);}};
export const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
export const close=()=>ws.close();
if(process.argv[1]?.endsWith('/cdp.mjs')&&process.argv[2]){const result=await send(process.argv[2],JSON.parse(process.argv[3]||'{}'));console.log(JSON.stringify(result));await new Promise(r=>setTimeout(r,150));close();}
