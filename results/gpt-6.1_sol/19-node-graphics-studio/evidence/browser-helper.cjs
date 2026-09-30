const {execFileSync}=require('child_process');
const fs=require('fs');
const prefix=['--session','fieldwork-http','--proxy','http://127.0.0.1:9','--proxy-bypass','127.0.0.1,localhost','--allowed-domains','127.0.0.1,localhost'];
const commands=[];
function cmd(...args){if(args[0]==='upload')for(let i=2;i<args.length;i++)args[i]=require('path').resolve(args[i]);commands.push('agent-browser '+[...prefix,...args].map(s=>/\s/.test(s)?JSON.stringify(s):s).join(' '));return execFileSync('agent-browser',[...prefix,...args],{encoding:'utf8',timeout:30000}).trim();}
function json(...args){const r=JSON.parse(cmd('--json',...args));if(!r.success)throw Error(r.error);return r.data;}
function read(expression){return json('eval',expression).result;}
function box(selector){const b=json('get','box',selector);return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2),width:b.width,height:b.height};}
function move(p){cmd('mouse','move',String(p.x),String(p.y));}
function drag(a,b){move(a);cmd('mouse','down');move(b);cmd('mouse','up');}
function render(action){const n=read('studio.diagnostics().renders');action();cmd('wait','--fn',`studio.diagnostics().renders>${n} && !dirty && !structural`);}
function hash(selector='#previewCanvas'){return read(`(()=>{const c=document.querySelector('${selector}'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<a.length;i++)h=Math.imul(h^a[i],16777619);return [c.width,h>>>0]})()`);}
function save(name,results){fs.writeFileSync('evidence/logs/'+name,[...results,'','Exact browser commands:',...commands].join('\n')+'\n');}
async function cdp(){const ws=new WebSocket(cmd('get','cdp-url'));await new Promise(r=>ws.onopen=r);let next=1;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});const {targetInfos}=await send('Target.getTargets');const target=targetInfos.find(t=>t.type==='page'&&t.url.includes('8793/index.html'));const {sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true});return {send:(m,p)=>{commands.push('CDP '+m+' '+JSON.stringify(p));return send(m,p,sessionId);},close:()=>ws.close()};}
module.exports={cmd,json,read,box,move,drag,render,hash,save,cdp};
