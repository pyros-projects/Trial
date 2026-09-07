import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
const endpoint=execFileSync('agent-browser',['--session','horizon','get','cdp-url'],{encoding:'utf8'}).trim();
const ws=new WebSocket(endpoint);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);appendFileSync(new URL('./logs/download-cdp.jsonl',import.meta.url),JSON.stringify(m)+'\n');if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}});
const send=(method,params)=>new Promise(r=>{const key=++id;pending.set(key,r);ws.send(JSON.stringify({id:key,method,params}));});
console.log(await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:'/tmp/horizon-downloads',eventsEnabled:true}));
console.log(execFileSync('agent-browser',['--session','horizon','click',process.argv[2]||'#exportBtn'],{encoding:'utf8'}));
await new Promise(r=>setTimeout(r,2000));ws.close();
