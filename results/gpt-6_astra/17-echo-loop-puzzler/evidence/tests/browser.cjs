const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(){
 const url=execFileSync('agent-browser',['--namespace','echo17','--session','echo','get','cdp-url'],{encoding:'utf8'}).trim();
 const ws=new WebSocket(url);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
 let next=1;const pending=new Map();let session;
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}}});
 const send=(method,params={},useSession=true)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(session&&useSession?{sessionId:session}:{})}))});
 const targets=await send('Target.getTargets',{},false);const target=targets.targetInfos.find(t=>t.type==='page'&&t.url.includes('index.html'));if(!target)throw Error('ECHO page not found');session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
 const state=()=>evaluate('window.echoDiagnostics');
 const key=async(code,down)=>{const mapping={ArrowRight:['ArrowRight',39],ArrowLeft:['ArrowLeft',37],ArrowUp:['ArrowUp',38],Space:[' ',32],KeyE:['e',69],KeyQ:['q',81],KeyR:['r',82],KeyP:['p',80],KeyW:['w',87],Escape:['Escape',27],Delete:['Delete',46]};const [k,v]=mapping[code]||[code.replace('Key','').toLowerCase(),code.charCodeAt(code.length-1)];await send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',code,key:k,windowsVirtualKeyCode:v,nativeVirtualKeyCode:v});};
 const press=async code=>{await key(code,true);await sleep(35);await key(code,false)};
 const until=async(fn,timeout=10000)=>{const start=Date.now();while(Date.now()-start<timeout){const s=await state();if(fn(s))return s;await sleep(15)}throw Error('Timed out waiting on live diagnostics')};
 const frames=async n=>{const s=await state();return until(v=>v.world.frame>=s.world.frame+n||v.world.won||v.world.player.dead,Math.max(5000,n*50))};
 const hold=async(code,fn,timeout)=>{await key(code,true);try{return await until(fn,timeout)}finally{await key(code,false)}};
 const close=()=>ws.close();return {send,evaluate,state,key,press,until,frames,hold,close,sleep};
}
module.exports={connect,sleep};
if(require.main===module)connect().then(async b=>{console.log(JSON.stringify(await b.state(),null,2));b.close()});
