(function () {
  'use strict';
  const defaults = {G:1, dt:0.04, softening:0.02, collision:'merge', horizon:220, resolution:400};
  const clone = value => JSON.parse(JSON.stringify(value));
  const live = b => b.alive !== false;
  function options(cfg) {
    const c = Object.assign({}, defaults, cfg);
    if (!(c.G >= 0) || !Number.isFinite(c.G) || !(c.dt > 0) || !Number.isFinite(c.dt) || !(c.softening >= 0) || !Number.isFinite(c.softening)) throw new Error('Invalid gravity, step size, or softening.');
    return c;
  }
  function validate(state) {
    if (!Number.isFinite(state.time)) throw new Error('Numerical failure: invalid simulation time.');
    for (const b of state.bodies) if (live(b)) {
      if (!(b.mass >= 0) || ![b.mass,b.x,b.y,b.vx,b.vy,b.radius].every(Number.isFinite)) throw new Error('Numerical failure: non-finite body state.');
    }
  }
  function accelerations(state, cfg) {
    const c = options(cfg), bodies = Array.isArray(state) ? state : state.bodies;
    const a = bodies.map(() => ({x:0,y:0}));
    for (let i=0;i<bodies.length;i++) if(live(bodies[i])) for(let j=i+1;j<bodies.length;j++) if(live(bodies[j])) {
      const p=bodies[i], q=bodies[j], dx=q.x-p.x, dy=q.y-p.y;
      const r2=dx*dx+dy*dy+c.softening*c.softening;
      if (!(r2>0)) throw new Error('Numerical failure: singular encounter; increase softening.');
      const f=c.G/(r2*Math.sqrt(r2));
      a[i].x+=f*q.mass*dx; a[i].y+=f*q.mass*dy; a[j].x-=f*p.mass*dx; a[j].y-=f*p.mass*dy;
    }
    return a;
  }
  function invariants(state,cfg) {
    const c=options(cfg);let kinetic=0,potential=0,px=0,py=0,angular=0;
    const bs=state.bodies;
    for(let i=0;i<bs.length;i++) if(live(bs[i])) {
      const b=bs[i];kinetic+=.5*b.mass*(b.vx*b.vx+b.vy*b.vy);px+=b.mass*b.vx;py+=b.mass*b.vy;angular+=b.mass*(b.x*b.vy-b.y*b.vx);
      for(let j=i+1;j<bs.length;j++) if(live(bs[j])) {const q=bs[j];potential-=c.G*b.mass*q.mass/Math.hypot(b.x-q.x,b.y-q.y,c.softening);}
    }
    return {energy:kinetic+potential,px,py,angular,kinetic,potential};
  }
  function offset(state,before,after) {
    state.energyOffset=(state.energyOffset||0)+after.energy-before.energy;
    state.momentumOffset=state.momentumOffset||{x:0,y:0};
    state.momentumOffset.x+=after.px-before.px;state.momentumOffset.y+=after.py-before.py;
  }
  function collide(state,c) {
    if(c.collision==='pass') return;
    const bs=state.bodies;state.events=state.events||[];
    for(let i=0;i<bs.length;i++) if(live(bs[i])) for(let j=i+1;j<bs.length;j++) if(live(bs[j])) {
      const a=bs[i],b=bs[j], dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),radius=a.radius+b.radius;
      if(d>radius)continue;
      const before=invariants(state,c);
      if(c.collision==='bounce') {
        const nx=d>1e-12?dx/d:1,ny=d>1e-12?dy/d:0,rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny,total=a.mass+b.mass;
        if(total<=0)continue;
        if(rel<0) {const impulse=-2*rel/total;a.vx-=impulse*b.mass*nx;a.vy-=impulse*b.mass*ny;b.vx+=impulse*a.mass*nx;b.vy+=impulse*a.mass*ny;}
        const overlap=Math.max(0,radius-d)+1e-10;a.x-=nx*overlap*b.mass/total;a.y-=ny*overlap*b.mass/total;b.x+=nx*overlap*a.mass/total;b.y+=ny*overlap*a.mass/total;
      } else {
        const keep=a.mass>=b.mass?a:b,drop=keep===a?b:a,total=keep.mass+drop.mass;
        if(total<=0)continue;
        keep.x=(keep.x*keep.mass+drop.x*drop.mass)/total;keep.y=(keep.y*keep.mass+drop.y*drop.mass)/total;
        keep.vx=(keep.vx*keep.mass+drop.vx*drop.mass)/total;keep.vy=(keep.vy*keep.mass+drop.vy*drop.mass)/total;
        keep.radius=Math.cbrt(keep.radius**3+drop.radius**3);keep.mass=total;drop.alive=false;
        if(keep.primary===drop.id)keep.primary=drop.primary===keep.id?null:drop.primary;
        for(const q of bs)if(live(q)&&q.primary===drop.id)q.primary=keep.id;
        for(const node of state.nodes||[])if(node.primaryId===drop.id)node.primaryId=keep.id;
      }
      state.events.push({type:'collision',time:state.time,ids:[a.id,b.id],behavior:c.collision});
      offset(state,before,invariants(state,c));
      if(!live(a))break;
    }
  }
  function step(state,h,cfg) {
    const c=options(cfg);validate(state);if(!(h>=0)||!Number.isFinite(h))throw new Error('Invalid integration interval.');
    if(h===0)return;
    const a=accelerations(state,c);
    state.bodies.forEach((b,i)=>{if(live(b)){b.x+=b.vx*h+.5*a[i].x*h*h;b.y+=b.vy*h+.5*a[i].y*h*h;b.vx+=.5*a[i].x*h;b.vy+=.5*a[i].y*h;}});
    const next=accelerations(state,c);
    state.bodies.forEach((b,i)=>{if(live(b)){b.vx+=.5*next[i].x*h;b.vy+=.5*next[i].y*h;}});
    state.time+=h;collide(state,c);validate(state);
  }
  function burns(state,c) {
    for(const n of (state.nodes||[]).slice().sort((a,b)=>a.time-b.time)) if(!n.executed&&n.time<=state.time+1e-10) {
      const b=state.bodies.find(b=>live(b)&&b.id===n.craftId);n.executed=true;
      if(!b)continue;
      const p=state.bodies.find(b=>live(b)&&b.id===n.primaryId),before=invariants(state,c);
      let dvx=Number(n.dx)||0,dvy=Number(n.dy)||0;
      if(n.mode!=='cartesian') {
        const rx=b.x-(p?.x||0),ry=b.y-(p?.y||0),vx=b.vx-(p?.vx||0),vy=b.vy-(p?.vy||0),r=Math.hypot(rx,ry),v=Math.hypot(vx,vy);
        const nx=r?rx/r:1,ny=r?ry/r:0,tx=v?vx/v:-ny,ty=v?vy/v:nx;
        dvx=(Number(n.prograde)||0)*tx+(Number(n.radial)||0)*nx;dvy=(Number(n.prograde)||0)*ty+(Number(n.radial)||0)*ny;
      }
      b.vx+=dvx;b.vy+=dvy;offset(state,before,invariants(state,c));
      state.events=state.events||[];state.events.push({type:'burn',time:state.time,nodeId:n.id,craftId:b.id,dvx,dvy,dv:Math.hypot(dvx,dvy)});
    }
  }
  function bound(state,c) {
    let h=c.dt;const bs=state.bodies;
    for(let i=0;i<bs.length;i++)if(live(bs[i]))for(let j=i+1;j<bs.length;j++)if(live(bs[j])) {
      const a=bs[i],b=bs[j],r=Math.hypot(a.x-b.x,a.y-b.y,c.softening),mu=c.G*(a.mass+b.mass),speed=Math.hypot(a.vx-b.vx,a.vy-b.vy);
      if(mu>0)h=Math.min(h,.04*Math.sqrt(r*r*r/mu));
      if(speed>0)h=Math.min(h,.08*Math.max(r,c.softening,1e-6)/speed);
    }
    return Math.max(1e-7,h);
  }
  function advanceInternal(state,duration,c,observe) {
    validate(state);if(!(duration>=0)||!Number.isFinite(duration))throw new Error('Invalid simulation duration.');
    const end=state.time+duration;if(!Number.isFinite(end))throw new Error('Numerical failure: time overflow.');
    if(duration>0&&end===state.time)throw new Error('Numerical failure: duration is below time precision.');
    let count=0;burns(state,c);
    while(state.time<end) {
      let target=end;for(const n of state.nodes||[])if(!n.executed&&Number.isFinite(n.time)&&n.time>state.time+1e-10)target=Math.min(target,n.time);
      const h=Math.min(bound(state,c),target-state.time);
      if(!(h>0)||state.time+h===state.time)throw new Error('Numerical failure: integration step is below time precision.');
      if(observe)observe(state,h);step(state,h,c);count++;burns(state,c);if(observe)observe(state,0);
      if(count>2000000)throw new Error('Numerical failure: encounter requires too many integration steps.');
    }
    return count;
  }
  function advance(state,duration,cfg) {return advanceInternal(state,duration,options(cfg));}
  function predict(state,cfg) {
    const c=options(cfg);if(!(c.horizon>=0)||!Number.isFinite(c.horizon)||!Number.isInteger(c.resolution)||c.resolution<1||c.resolution>10000)throw new Error('Invalid prediction horizon or resolution.');
    const future=clone(state),start=future.time,eventsAtStart=(future.events||[]).length,closest=new Map(),samples=[];
    let previous=null,sampleIndex=1;
    const nextTime=()=>start+c.horizon*sampleIndex/c.resolution;
    const observe=(s,h)=>{
      if(h>0){if(sampleIndex<=c.resolution&&nextTime()<=s.time+h+1e-12)previous={time:s.time,bodies:clone(s.bodies),events:(s.events||[]).length};return;}
      for(const craft of s.bodies)if(live(craft)&&craft.type==='craft')for(const b of s.bodies)if(live(b)&&b.type!=='craft') {const key=craft.id+'|'+b.id,distance=Math.hypot(craft.x-b.x,craft.y-b.y);if(!closest.has(key)||distance<closest.get(key).distance)closest.set(key,{craftId:craft.id,bodyId:b.id,distance,time:s.time});}
      while(previous&&sampleIndex<=c.resolution&&nextTime()<=s.time+1e-12){
        const time=nextTime(),dt=s.time-previous.time,u=dt?Math.max(0,Math.min(1,(time-previous.time)/dt)):1;
        const intervalEvents=(s.events||[]).slice(previous.events);
        const beforeContact=u<1-1e-12&&intervalEvents.some(event=>event.type==='collision');
        // Contact changes mass, topology, and velocity instantaneously. Preserve a
        // coherent pre-contact snapshot until that integration event has happened.
        const bodies=clone(beforeContact?previous.bodies:s.bodies);
        if(u<1-1e-12&&!beforeContact)for(let i=0;i<bodies.length;i++){
          const b=bodies[i],a=previous.bodies[i];if(!live(a)||!live(b)){bodies[i]=clone(a);continue;}
          let vx=b.vx,vy=b.vy;
          for(const event of intervalEvents)if(event.type==='burn'&&event.craftId===b.id){vx-=event.dvx;vy-=event.dvy;}
          const u2=u*u,u3=u2*u;
          b.x=(2*u3-3*u2+1)*a.x+(u3-2*u2+u)*dt*a.vx+(-2*u3+3*u2)*b.x+(u3-u2)*dt*vx;
          b.y=(2*u3-3*u2+1)*a.y+(u3-2*u2+u)*dt*a.vy+(-2*u3+3*u2)*b.y+(u3-u2)*dt*vy;
          b.vx=a.vx+(vx-a.vx)*u;b.vy=a.vy+(vy-a.vy)*u;
        }
        samples.push({time,bodies});sampleIndex++;
      }
      previous=null;
    };
    observe(future,0);samples.push({time:start,bodies:clone(future.bodies)});
    if(c.horizon===0){advanceInternal(future,0,c);while(samples.length<c.resolution+1)samples.push({time:start,bodies:clone(future.bodies)});}
    else advanceInternal(future,c.horizon,c,observe);
    return {samples,events:(future.events||[]).slice(eventsAtStart),closest:[...closest.values()],final:future};
  }

  function elements(body,primary,cfg) {
    const c=options(cfg),p=primary||{x:0,y:0,vx:0,vy:0,mass:0},rx=body.x-p.x,ry=body.y-p.y,vx=body.vx-p.vx,vy=body.vy-p.vy,r=Math.hypot(rx,ry),v=Math.hypot(vx,vy),mu=c.G*(body.mass+p.mass),h=rx*vy-ry*vx;
    const result={distance:r,speed:v,energy:null,angular:h,eccentricity:null,periapsis:null,apoapsis:null,period:null,semiMajor:null,ex:null,ey:null};
    if(!(r>0)||!(mu>0))return result;
    const energy=v*v/2-mu/r,ex=vy*h/mu-rx/r,ey=-vx*h/mu-ry/r,e=Math.hypot(ex,ey),a=Math.abs(energy)>1e-14?-mu/(2*energy):null;
    Object.assign(result,{energy,eccentricity:e,ex,ey,semiMajor:a,periapsis:h*h/(mu*(1+e))});
    if(energy<0&&a>0){result.apoapsis=a*(1+e);result.period=2*Math.PI*Math.sqrt(a*a*a/mu);}return result;
  }
  function frame(state,mode,selectedId,primaryId) {
    const bs=Array.isArray(state)?state:state.bodies;const f={x:0,y:0,vx:0,vy:0,angle:0,omega:0};if(mode==='inertial')return f;
    const p=bs.find(b=>live(b)&&b.id===(mode==='selected'?selectedId:primaryId));if(!p)return f;Object.assign(f,{x:p.x,y:p.y,vx:p.vx,vy:p.vy});
    if(mode==='rotating'){const moon=bs.find(b=>live(b)&&b.type==='moon'&&b.primary===p.id);if(moon){const x=moon.x-p.x,y=moon.y-p.y,r2=x*x+y*y;f.angle=Math.atan2(y,x);f.omega=r2?(x*(moon.vy-p.vy)-y*(moon.vx-p.vx))/r2:0;}}return f;
  }
  function transform(body,f) {const x=body.x-f.x,y=body.y-f.y,c=Math.cos(f.angle),s=Math.sin(f.angle);return {x:x*c+y*s,y:-x*s+y*c};}
  function transformVelocity(body,f) {const x=body.vx-f.vx+f.omega*(body.y-f.y),y=body.vy-f.vy-f.omega*(body.x-f.x),c=Math.cos(f.angle),s=Math.sin(f.angle);return {x:x*c+y*s,y:-x*s+y*c};}
  function scenario(key) {
    const c={...defaults},colors={star:'#ffc876',planet:'#64b9ba',moon:'#b9b8b0',craft:'#9ce9db'};
    const make=(id,name,type,mass,radius,x,y,vx,vy,primary)=>({id,name,type,mass,radius,x,y,vx,vy,primary,scale:1,color:colors[type],alive:true});
    const star=make('helios','Helios','star',10000,25,0,0,0,0,null),planet=make('terra','Terra','planet',100,8,1000,0,0,Math.sqrt(10),'helios');
    const moonAngle=.8,moonR=80,moonV=Math.sqrt(100.8/moonR);
    const moon=make('luna','Luna','moon',.8,2.2,planet.x+moonR*Math.cos(moonAngle),moonR*Math.sin(moonAngle),-moonV*Math.sin(moonAngle),planet.vy+moonV*Math.cos(moonAngle),'terra');
    const angle=-1.0,r=30,v=Math.sqrt(100/r);
    const craft=make('odyssey','Odyssey','craft',.00001,.3,planet.x+r*Math.cos(angle),r*Math.sin(angle),-v*Math.sin(angle),planet.vy+v*Math.cos(angle),'terra');
    const state={bodies:[star,planet,moon,craft],time:0,nodes:[],events:[],energyOffset:0,momentumOffset:{x:0,y:0}};
    let title='Circular parking orbit',description='A low circular orbit around Terra, perturbed by Luna and Helios.';
    function orbit(radius,speed,a=angle){craft.x=planet.x+radius*Math.cos(a);craft.y=planet.y+radius*Math.sin(a);craft.vx=planet.vx-speed*Math.sin(a);craft.vy=planet.vy+speed*Math.cos(a);}
    if(key==='elliptical'){title='Elliptical survey';description='A 24–60 unit osculating ellipse reveals changing speed between apsides.';orbit(24,Math.sqrt(100*(2/24-1/42)));c.horizon=190;}
    else if(key==='hohmann'){title='Hohmann transfer';description='Two planned prograde impulses raise a circular orbit from 30 to 58 units; perturbations remain active.';const r2=58,a=(r+r2)/2,t=8;state.nodes=[{id:'transfer-1',craftId:craft.id,primaryId:planet.id,time:t,mode:'orbital',prograde:Math.sqrt(100*(2/r-1/a))-v,radial:0,dx:0,dy:0,executed:false},{id:'transfer-2',craftId:craft.id,primaryId:planet.id,time:t+Math.PI*Math.sqrt(a*a*a/100),mode:'orbital',prograde:Math.sqrt(100/r2)-Math.sqrt(100*(2/r2-1/a)),radial:0,dx:0,dy:0,executed:false}];c.horizon=170;}
    else if(key==='moon'){title='Lunar intercept';description='A departure ellipse extends from a 26 unit periapsis to Luna’s 80 unit orbit.';orbit(26,Math.sqrt(100*(2/26-1/53)),-.64);c.horizon=240;}
    else if(key==='slingshot'){title='Lunar gravity assist';description='A fast approach passes Luna and exchanges orbital energy through its moving gravity field.';craft.x=moon.x-19;craft.y=moon.y-8;craft.vx=moon.vx+1.5;craft.vy=moon.vy+.25;c.horizon=100;}
    else if(key==='threebody'){title='Unstable three-body';description='A massive companion strongly perturbs Terra and destabilizes the spacecraft’s orbit.';moon.mass=65;moon.radius=6;moon.x=planet.x+65;moon.y=18;moon.vx=planet.vx-.35;moon.vy=planet.vy+.65;orbit(27,Math.sqrt(100/27),-1.6);c.horizon=180;}
    else if(key==='escape'){title='Escape trajectory';description='Odyssey departs above Terra’s local two-body escape speed while remaining in the Helios system.';orbit(30,1.15*Math.sqrt(200/30),-.5);c.horizon=200;}
    let mass=0,px=0,py=0;for(const b of state.bodies){mass+=b.mass;px+=b.mass*b.vx;py+=b.mass*b.vy;}for(const b of state.bodies){b.vx-=px/mass;b.vy-=py/mass;}
    return {state,cfg:c,title,description,selectedId:'odyssey',primaryId:'terra',view:{scale:key==='escape'?1.9:2.6}};
  }
  globalThis.Orbital={clone,accelerations,step,advance,predict,invariants,elements,frame,transform,transformVelocity,scenario};
})();
