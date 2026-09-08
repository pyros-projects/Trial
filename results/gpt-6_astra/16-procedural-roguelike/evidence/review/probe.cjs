const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const context={};vm.createContext(context);vm.runInContext(html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1],context);const E=context.EmberEngine;
function output(label,data){console.log(label,JSON.stringify(data));}
// Exercise real persisted map objects after acceptance.
{
 const s=E.create(),p=s.player;s.map.loot.push({x:p.x,y:p.y-1,type:'unknown-relic',amount:1});
 const d=E.decode(E.encode(s));let error;
 try{E.act(d.state,{type:'move',dx:0,dy:-1});}catch(e){error=e.message;}
 output('malformed loot accepted and next move throws',{accepted:d.ok,error,turn:d.state?.turn,player:d.state?.player});
}
{
 const s=E.create();s.telegraphs=[null];const d=E.decode(E.encode(s));let error;
 try{E.act(d.state,{type:'wait'});}catch(e){error=e.message;}
 output('malformed telegraph accepted and next wait throws',{accepted:d.ok,error,turn:d.state?.turn});
}
// Search actual generated maps for direction-dependent LOS.
{
 const s=E.create(),m=s.map;let found=null;
 outer:for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++)if(E.walk(m,x,y))
 for(let by=Math.max(0,y-8);by<Math.min(m.h,y+9);by++)for(let bx=Math.max(0,x-8);bx<Math.min(m.w,x+9);bx++)if(E.walk(m,bx,by)&&Math.abs(x-bx)+Math.abs(y-by)<=6){
  const a={x,y},b={x:bx,y:by},ab=E.los(m,a,b),ba=E.los(m,b,a);if(ab!==ba){found={a,b,ab,ba};break outer;}
 }
 if(found){s.player.x=found.a.x;s.player.y=found.a.y;const e=E.clone(s.enemies.find(e=>e.type==='archer'));e.x=found.b.x;e.y=found.b.y;e.home={x:e.x,y:e.y};s.enemies=[e];E.updateFov(s);const hp=s.player.hp,visible=s.visible[e.y*m.w+e.x],perceived=E.perceived(s,e);E.act(s,{type:'wait'});output('LOS asymmetry and combat',{...found,visible,perceived,damage:hp-s.player.hp,log:s.log.slice(-2)});}
 else output('LOS asymmetry',null);
}
// Boss telegraph: a cast at a player's current tile cannot be left with one cardinal move.
{
 const s=E.create({style:'arena',preset:'final'}),boss=s.enemies.find(e=>e.type==='warden');s.enemies=[boss];s.player.x=15;s.player.y=9;boss.x=19;boss.y=9;boss.home={x:19,y:9};s.map.hazards=[];E.updateFov(s);
 const cast=E.act(s,{type:'wait'});output('boss casting fixture',{ok:cast.ok,telegraphs:s.telegraphs});
 const results=[];for(const [dx,dy]of E.DIRS){const c=E.clone(s),hp=c.player.hp;const r=E.act(c,{type:'move',dx,dy});results.push({dx,dy,ok:r.ok,damage:hp-c.player.hp,log:c.log.slice(-3)});}
 output('boss cardinal evasion',results);
}
// Seed sweep for floor-three boss existence and connected stairs.
{
 let count=0,missing=[],bad=[];
 for(const style of Object.keys(E.STYLES))for(let i=0;i<400;i++){
  const m=E.generate('review-'+i,3,style);count++;if(!m.enemies.some(e=>e.type==='warden'))missing.push({style,seed:'review-'+i});if(!E.validateMap(m).valid)bad.push({style,seed:'review-'+i});
 }
 output('generation sweep',{count,missing:missing.slice(0,10),bad:bad.slice(0,10)});
}
