(()=>{
// TEST HARNESS ONLY — injected at runtime; never part of index.html.
// Reads live state, dispatches REAL KeyboardEvents. Never mutates simulation state.
if(window.__pilot && window.__pilot.stop) window.__pilot.stop();
const NFP=window.NFP, T=32;
const held=new Set();
const send=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,key:code,bubbles:true,cancelable:true}));
const setKeys=(codes)=>{
  for(const c of [...held]) if(!codes.has(c)){ held.delete(c); send('keyup',c); }
  for(const c of codes) if(!held.has(c)){ held.add(c); send('keydown',c); }
};
const P={
  goal:null, mode:'idle', path:null, pIdx:0, repath:0, run:false, sneak:true, avoid:true,
  timer:null, log:[], logEvery:10, n:0, status:'idle',
  stop(){ if(this.timer) clearInterval(this.timer); setKeys(new Set()); this.timer=null; },
  threats(){
    const s=NFP.App.sim, m=NFP.App.mission, p=s.player, out=[];
    for(const g of s.guards){
      const d=Math.hypot(g.x-p.x,g.y-p.y);
      if(d>11*T) continue;
      if(!NFP.losClear(m,g.x,g.y,p.x,p.y,15,s.smokes)) continue;
      out.push({g,d});
    }
    return out.sort((a,b)=>a.d-b.d);
  },
  tick(){
    const A=NFP.App, s=A.sim;
    if(!s || A.mode!=='playing'){ setKeys(new Set()); return; }
    const p=s.player, m=A.mission;
    let goal = this.mode==='mission' ? (m.objective.taken? m.exfil : m.objective) : this.goal;
    if(!goal){ setKeys(new Set()); return; }
    const codes=new Set();
    let action='seek';
    if(this.avoid){
      const th=this.threats();
      if(th.length){
        const t=th[0];
        if(t.g.state==='chase' || t.g.aware>0.55){
          action='evade';
          const base=Math.atan2(p.y-t.g.y, p.x-t.g.x);
          let bestA=null,bestS=-1e9;
          for(let k=-6;k<=6;k++){
            const a=base+k*0.28;
            const d=NFP.castRay(m,p.x,p.y,a,8*T,15);
            if(d<30) continue;
            const nx=p.x+Math.cos(a)*d, ny=p.y+Math.sin(a)*d;
            const sc=d*0.5 + Math.hypot(nx-t.g.x,ny-t.g.y)*1.0 - Math.abs(k)*5;
            if(sc>bestS){bestS=sc;bestA=a;}
          }
          if(bestA!==null){
            const tx=p.x+Math.cos(bestA)*48, ty=p.y+Math.sin(bestA)*48;
            if(tx-p.x>7)codes.add('KeyD'); else if(tx-p.x<-7)codes.add('KeyA');
            if(ty-p.y>7)codes.add('KeyS'); else if(ty-p.y<-7)codes.add('KeyW');
          }
          codes.add('ShiftLeft');
          this.path=null;
        } else {
          // freeze if we are standing inside any nearby cone, or already noticed
          for(const q of th){
            const a=Math.atan2(p.y-q.g.y,p.x-q.g.x);
            const off=Math.abs(((a-q.g.facing+Math.PI*3)%(Math.PI*2))-Math.PI);
            if((off < q.g.fov*0.75 && q.d < 9*T) || (q.g.aware>0.10 && q.d<7*T)){ action='freeze'; break; }
          }
        }
        if(action!=='seek'){
          this.status=action;
          if(this.sneak && !codes.has('ShiftLeft')) codes.add('ControlLeft');
          setKeys(codes); this.trace(action); return;
        }
      }
    }
    NFP.PF.bind(m);
    this.repath--;
    if(!this.path || this.repath<=0){
      const raw=NFP.PF.find(p.x,p.y,goal.x,goal.y,5200,40);
      this.path = raw? raw.map(i=>NFP.PF.center(i)) : null;
      this.pIdx = this.path&&this.path.length>1?1:0; this.repath=20;
    }
    let tx=goal.x, ty=goal.y;
    if(this.path && this.pIdx<this.path.length){
      let t=this.path[this.pIdx];
      while(t && Math.hypot(t.x-p.x,t.y-p.y)<16 && this.pIdx<this.path.length-1){ this.pIdx++; t=this.path[this.pIdx]; }
      if(t){ tx=t.x; ty=t.y; }
    }
    if(tx-p.x>7)codes.add('KeyD'); else if(tx-p.x<-7)codes.add('KeyA');
    if(ty-p.y>7)codes.add('KeyS'); else if(ty-p.y<-7)codes.add('KeyW');
    if(this.run)codes.add('ShiftLeft'); else if(this.sneak)codes.add('ControlLeft');
    if(s.interact) codes.add('KeyE');
    this.status='seek';
    setKeys(codes); this.trace('seek');
  },
  trace(action){
    if((this.n++ % this.logEvery)!==0) return;
    const s=NFP.App.sim,p=s.player;
    this.log.push({t:+s.t.toFixed(1),act:action,p:[Math.round(p.x),Math.round(p.y)],
      al:s.alarm.level,det:s.stats.detections,obj:NFP.App.mission.objective.taken,
      g:s.guards.map(g=>g.state[0]+(g.aware>0.05?g.aware.toFixed(1):'')).join(',')});
    if(this.log.length>400) this.log.shift();
  },
  start(){ this.stop(); this.timer=setInterval(()=>{ try{this.tick();}catch(e){ console.error('pilot',e);} },30); return 'pilot running'; },
  go(x,y,o){ o=o||{}; this.mode='goto'; this.goal={x,y}; this.run=!!o.run; this.sneak=o.sneak!==false;
    this.avoid=o.avoid!==false; this.path=null; this.repath=0; return 'goto'; },
  mission(o){ o=o||{}; this.mode='mission'; this.goal=null; this.run=!!o.run; this.sneak=o.sneak!==false;
    this.avoid=o.avoid!==false; this.path=null; this.repath=0; this.log=[]; return 'mission'; },
  halt(){ this.mode='idle'; this.goal=null; setKeys(new Set()); return 'halted'; },
  dump(n){ return JSON.stringify(this.log.slice(-(n||30))); },
};
window.__pilot=P;
return P.start();
})()
