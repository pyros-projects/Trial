/* Deterministic, stylized atmosphere. Physical domain: 32 × 32 × 6 km.
   First-order upwind transport; explicit diffusion; warm-cloud microphysics.
   These are educational approximations, not a forecast or safety product. */
const DEFAULT_PARAMS = Object.freeze({dt:3,substeps:2,wind:14,rotation:0.3,lapse:6.5,humidity:82,evaporation:1,condensation:1,precipitation:1,buoyancy:1,diffusion:0.12,terrainInfluence:1,lightning:0.35});
const ATMOSPHERE_RANGES = {dt:[0.25,12],substeps:[1,8],wind:[0,45],rotation:[-2,2],lapse:[2,12],humidity:[10,110],evaporation:[0,4],condensation:[0.65,1.3],precipitation:[0,4],buoyancy:[0,3],diffusion:[0,1],terrainInfluence:[0,3],lightning:[0,1]};
const ATMOSPHERE_FIELDS = ['t','q','c','r','u','v','w','p'];
const ATMOSPHERE_BOUNDS = {t:[-100,65],q:[0,60],c:[0,15],r:[0,20],u:[-120,120],v:[-120,120],w:[-65,65],p:[-60,60],terrain:[0,3.8],moisture:[0,1],surface:[0,4]};
const ATMOSPHERE_PRESETS = {
  cumulus:{temp:25,cloud:0.75,thermal:1.1,params:{wind:6,rotation:0.05,humidity:73,lapse:6.9}},
  sea:{temp:23,cloud:0.48,thermal:0.55,params:{wind:12,rotation:0.1,humidity:87,lapse:5.8}},
  mountain:{temp:21,cloud:1.15,thermal:0.85,params:{wind:22,rotation:0.1,humidity:85,terrainInfluence:2,lapse:7}},
  squall:{temp:27,cloud:1.9,thermal:1.3,params:{wind:27,rotation:0.25,humidity:91,lapse:7.6}},
  supercell:{temp:27,cloud:2.6,thermal:1.5,params:{humidity:94}},
  cyclone:{temp:28,cloud:1.8,thermal:1.25,params:{wind:31,rotation:1.5,humidity:94,lapse:6.2}},
  front:{temp:18,cloud:1.1,thermal:0.7,params:{wind:19,rotation:0.15,humidity:88,lapse:5.7}},
  heat:{temp:35,cloud:0.25,thermal:2,params:{wind:3,rotation:0,humidity:52,lapse:9,buoyancy:1.5}},
  snow:{temp:-4,cloud:1.2,thermal:0.25,params:{wind:11,rotation:0.12,humidity:91,lapse:5,precipitation:0.8}},
  stress:{temp:32,cloud:2.5,thermal:2,params:{dt:12,substeps:1,wind:45,rotation:2,lapse:12,humidity:110,evaporation:4,condensation:1.3,precipitation:4,buoyancy:3,diffusion:1,terrainInfluence:3,lightning:1}}
};
const atmClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
class Atmosphere {
  constructor({n=32,l=12,seed=4821,preset='supercell',params={}}={}) {
    Atmosphere.validateDimensions(n,l);
    if(typeof preset!=='string'||!Object.hasOwn(ATMOSPHERE_PRESETS,preset))throw new Error('Unknown weather preset');
    if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Seed must be an unsigned 32-bit integer');
    this.n=n;this.l=l;this.seed=seed;this.preset=preset;
    this.params={...DEFAULT_PARAMS,...ATMOSPHERE_PRESETS[preset].params,...params};Atmosphere.validateParams(this.params);
    this.time=0;this.steps=0;this.rngState=(seed||0x6d2b79f5)>>>0;this.precipTotal=0;this._lastCfl=0;this._lastSubsteps=0;
    this._allocate();this._initialize();
  }
  static validateDimensions(n,l) {
    if(![24,32,48,64].includes(n)||![8,12,16,24].includes(l))throw new Error('Unsupported atmosphere resolution');
  }
  static validateParams(params) {
    if(!params||typeof params!=='object'||Array.isArray(params))throw new Error('Invalid parameters');
    for(const [key,[min,max]] of Object.entries(ATMOSPHERE_RANGES))if(typeof params[key]!=='number'||!Number.isFinite(params[key])||params[key]<min||params[key]>max||(key==='substeps'&&!Number.isInteger(params[key])))throw new Error('Invalid parameter: '+key);
    for(const key of Object.keys(params))if(!Object.hasOwn(ATMOSPHERE_RANGES,key))throw new Error('Unknown parameter: '+key);
  }
  _allocate() {
    const length=this.n*this.n*this.l;this._next={};
    for(const key of ATMOSPHERE_FIELDS){this[key]=new Float32Array(length);this._next[key]=new Float32Array(length);}
    this.terrain=new Float32Array(this.n*this.n);this.moisture=new Float32Array(this.n*this.n);this.surface=new Uint8Array(this.n*this.n);
    this._dx=32000/(this.n-1);this._dy=6000/(this.l-1);
  }
  _random() {let x=this.rngState;x^=x<<13;x^=x>>>17;x^=x<<5;this.rngState=x>>>0;return this.rngState/4294967296;}
  qSaturation(t) {return Math.max(0.025,3.8*Math.exp(0.065*atmClamp(t,-100,65)));}
  _environment(y,x=0) {const cfg=ATMOSPHERE_PRESETS[this.preset];return cfg.temp-this.params.lapse*y*6/(this.l-1)+(this.preset==='front'?5*Math.tanh(x/4):0);}
  _backgroundHumidity(wy,wx,wz) {
    // A deep moist inflow region supports the supercell, with drier surrounding air.
    const envelope=this.preset==='supercell'?Math.min(1,2*Math.exp(-1*((wx+3)/10)**2-1*(wz/8)**2)):0;
    const horizontalDrying=this.preset==='supercell'?.14*(1-envelope):0;
    return atmClamp(this.params.humidity/100-horizontalDrying-(.018-.012*envelope)*wy,.1,1.1);
  }
  _initialize() {
    const n=this.n,l=this.l,cfg=ATMOSPHERE_PRESETS[this.preset],phase=this._random()*6.28,cloudSpread=this.preset==='supercell'?1.1:1;
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const j=x+n*z,wx=x/(n-1)*32-16,wz=z/(n-1)*32-16;
      const island=Math.max(0,1-Math.pow(wx/15,2)-Math.pow((wz+1)/14,2));
      const ridge=2.4*Math.exp(-Math.pow((wz-5.8-Math.sin(wx*.4)*1.7)/2.5,2)-Math.pow(wx/10,4));
      const rough=.15*Math.sin(wx*.8+phase)*Math.sin(wz*.7)+.12*Math.cos(wx*1.7+wz*.9+phase);
      let height=island>0?Math.max(0,.11+island*(.55+ridge+rough)):0;
      const river=Math.abs(wx+3-Math.sin(wz*.35)*2)<.46 && wz<5.5 && wz>-11;
      if(river)height*=.35;
      this.terrain[j]=atmClamp(height,0,3.8);this.surface[j]=island<=0?4:river?1:height>.65?2:0;
      if(wx>5&&wx<7.5&&wz>-4&&wz<-1)this.surface[j]=3;
      this.moisture[j]=this.surface[j]===4||this.surface[j]===1?1:this.surface[j]===3?.3:.63+.15*this._random();
    }
    for(let y=0;y<l;y++)for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const j=x+n*z,i=j+n*n*y,wx=x/(n-1)*32-16,wz=z/(n-1)*32-16,wy=y/(l-1)*12;
      const g=(cx,cz,cy,sx,sz,sy)=>Math.exp(-1*((wx-cx)/(sx*cloudSpread))**2-1*((wz-cz)/(sz*cloudSpread))**2-1*((wy-cy)/sy)**2);
      let core=g(-3,0,5.8,3.7,3.1,2.1)+.65*g(3.4,2.4,6.5,3.1,3.7,2)+.36*g(-7,-4.5,4,2.4,2.4,1.5);
      if(this.preset==='squall')core=Math.exp(-1*((wz-.2*wx)/2.4)**2-1*((wy-5.2)/2.1)**2)*(.7+.3*Math.cos(wx));
      if(this.preset==='cyclone')core=Math.exp(-1*((Math.hypot(wx,wz)-6)/2.3)**2-1*((wy-5)/2.3)**2)*(.8+.2*Math.sin(Math.atan2(wz,wx)*3));
      if(this.preset==='front')core=Math.exp(-1*((wx+wz*.4)/4)**2-1*((wy-4.8)/2)**2);
      if(this.preset==='mountain')core=g(0,6,5.8,8,2.5,1.9)+.45*g(-6,3,5,3,3,2);
      if(this.preset==='sea')core=g(-7,-6,3.2,3,3,1.1)+.6*g(8,-3,3.7,3,3,1.2)+.7*g(0,3,3.5,3,3,1.3);
      if(this.preset==='snow')core=.65*g(-2,1,4,7,6,1.8)+.35*g(7,-5,3.8,4,3,1.5);
      core*=atmClamp(.84+.18*Math.sin(wx*1.2+wz*.9+phase)*Math.sin(wy*2.7)+.12*this._random(),.55,1.12);
      if(wy<this.terrain[j]+.1)core=0;
      const surfaceThermal=cfg.thermal*Math.exp(-1*((wx+3)/4)**2-1*((wz+1)/4)**2)*Math.exp(-wy/2);
      const t=this._environment(y,wx)+surfaceThermal*2+core*.8+(this._random()-.5)*.12;
      const sat=this.qSaturation(t),rh=atmClamp(this._backgroundHumidity(wy,wx,wz)+core*.25,.15,1.08);
      this.t[i]=t;this.q[i]=sat*rh;this.c[i]=atmClamp(core*cfg.cloud,0,8);this.r[i]=core>.25?core*cfg.cloud*.12*Math.exp(-1*((wy-3.8)/2.7)**2):0;
      const swirl=this.preset==='cyclone'?this.params.wind*.85:this.params.rotation*12;
      const falloff=Math.exp(-(wx*wx+wz*wz)/100);
      this.u[i]=this.params.wind*(.6+.55*y/(l-1))-wz*swirl*.13*falloff;
      this.v[i]=this.params.wind*.1+wx*swirl*.13*falloff+this.params.rotation*wy*.6;
      this.w[i]=core*(this.preset==='supercell'?13:6)*Math.sin(Math.PI*wy/12)+surfaceThermal;
      this.p[i]=-core*(this.preset==='cyclone'?8:3)-surfaceThermal*.2;
    }
  }
  step(dt=this.params.dt) {
    Atmosphere.validateParams(this.params);
    if(!Number.isFinite(dt)||dt<=0||dt>120)throw new Error('Step duration must be in (0, 120] seconds');
    const count=this.params.substeps;let remaining=dt,actual=0,maxCfl=0;
    while(remaining>1e-10){
      let transport=0;
      for(let i=0;i<this.u.length;i++)transport=Math.max(transport,(Math.abs(this.u[i])+Math.abs(this.v[i]))/this._dx+(Math.abs(this.w[i])+8)/this._dy);
      // Include explicit diffusion and the reduced-speed pressure response in the stability budget.
      const mixing=2*4000*this.params.diffusion*(2/(this._dx*this._dx)+1/(this._dy*this._dy));
      const rate=transport+mixing+80/this._dx;
      const h=Math.min(remaining,dt/count,.8/Math.max(rate,1e-6));
      this._integrate(h);remaining-=h;actual++;maxCfl=Math.max(maxCfl,h*rate);
    }
    this.time+=dt;this.steps++;this._lastSubsteps=actual;this._lastCfl=maxCfl;return this;
  }
  _integrate(h) {
    const n=this.n,l=this.l,nn=n*n,dx=this._dx,dy=this._dy,pr=this.params,cfg=ATMOSPHERE_PRESETS[this.preset];
    const idx=1/dx,idy=1/dy,mix=4000*pr.diffusion;
    const fields=ATMOSPHERE_FIELDS.map(k=>this[k]),next=ATMOSPHERE_FIELDS.map(k=>this._next[k]);
    const [T,Q,C,R,U,V,W,P]=fields,[nt,nq,nc,nr,nu,nv,nw,np]=next;
    let precipitation=0;
    for(let y=0;y<l;y++)for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const j=x+n*z,i=j+nn*y,xm=(x===0?i+n-1:i-1),xp=(x===n-1?i-n+1:i+1),zm=(z===0?i+nn-n:i-n),zp=(z===n-1?i-nn+n:i+n),ym=y===0?i:i-nn,yp=y===l-1?i:i+nn;
      const ux=U[i],vz=V[i],wy=W[i],ax=Math.abs(ux)*idx,az=Math.abs(vz)*idx,ay=Math.abs(wy)*idy;
      const ix=ux>0?xm:xp,iz=vz>0?zm:zp,iy=wy>0?ym:yp;
      for(let f=0;f<8;f++){
        const a=fields[f],v=a[i];
        next[f][i]=v+h*(ax*(a[ix]-v)+az*(a[iz]-v)+ay*(a[iy]-v)+mix*((a[xm]+a[xp]+a[zm]+a[zp]-4*v)*idx*idx+(a[ym]+a[yp]-2*v)*idy*idy));
      }
      const altitude=y/(l-1)*12,wx=x/(n-1)*32-16,wz=z/(n-1)*32-16;
      const above=Math.max(0,altitude-this.terrain[j]),groundWeight=Math.exp(-above/1.2),inGround=altitude<this.terrain[j];
      const type=this.surface[j],water=type===1||type===4,forest=type===2,city=type===3;
      const env=this._environment(y,wx),warmCore=Math.exp(-1*((wx+3)/4.6)**2-1*((wz+1)/4.6)**2);
      const solar=(city?1.9:forest?.6:water?.25:1)*cfg.thermal;
      // Ground heat and moisture are continuous source terms. No seeded cloud is reinserted.
      nt[i]+=h*(.0035*solar*(.3+warmCore*3)*groundWeight-.00035*(T[i]-env)-wy*.0098);
      const saturation=this.qSaturation(nt[i]);
      // Surface evaporation weakens as the receiving air approaches saturation.
      const evaporationDeficit=atmClamp((1-Q[i]/saturation)*4,0,1);
      const vaporSource=.003*pr.evaporation*(water?2.2:forest?1.25:city?.2:.8)*this.moisture[j]*groundWeight*evaporationDeficit;
      const humidityTarget=this._backgroundHumidity(altitude,wx,wz);
      nq[i]+=h*(vaporSource+(.0012*groundWeight+.00008)*(saturation*humidityTarget-Q[i]));
      let cloud=Math.max(0,nc[i]),rain=Math.max(0,nr[i]),vapor=Math.max(0,nq[i]);
      const excess=vapor-saturation*pr.condensation;
      if(excess>0){const condensed=Math.min(vapor,excess*(1-Math.exp(-.07*h)));vapor-=condensed;cloud+=condensed;nt[i]+=2.2*condensed;}
      else if(vapor<saturation){const evaporated=Math.min(cloud,(saturation-vapor)*(1-Math.exp(-.025*h)));cloud-=evaporated;vapor+=evaporated;nt[i]-=2.2*evaporated;}
      const formed=Math.min(cloud,Math.max(0,cloud-.2)*(.0008+.0012*Math.sqrt(cloud))*pr.precipitation*h);cloud-=formed;rain+=formed;
      const rainEvap=Math.min(rain,rain*(1-Math.exp(-.02*h*Math.max(0,1-vapor/saturation))));rain-=rainEvap;vapor+=rainEvap;nt[i]-=2.2*rainEvap;
      if(inGround){rain=0;cloud=0;}
      // A small cloud mixing loss returns liquid water to vapor.
      const dissolved=Math.min(cloud,cloud*.00008*h);cloud-=dissolved;vapor+=dissolved;
      nq[i]=atmClamp(vapor,0,60);nc[i]=atmClamp(cloud,0,15);nr[i]=atmClamp(rain,0,20);nt[i]=atmClamp(nt[i],-100,65);
      const pressureX=(P[xp]-P[xm])*.5*idx,pressureZ=(P[zp]-P[zm])*.5*idx;
      const coriolis=pr.rotation*.00035;
      const targetU=pr.wind*(.6+.55*y/(l-1)),targetV=pr.wind*.1+pr.rotation*altitude*.6;
      const drag=.0007+(forest?.001:city?.0015:.0003)*groundWeight;
      nu[i]+=h*(-90*pressureX+coriolis*vz+(targetU-U[i])*.0015-drag*U[i]*groundWeight);
      nv[i]+=h*(-90*pressureZ-coriolis*ux+(targetV-V[i])*.0015-drag*V[i]*groundWeight);
      const jm=x===0?j+n-1:j-1,jp=x===n-1?j-n+1:j+1,km=z===0?j+nn-n:j-n,kp=z===n-1?j-nn+n:j+n;
      const uplift=Math.max(-5,Math.min(15,(ux*(this.terrain[jp]-this.terrain[jm])+vz*(this.terrain[kp]-this.terrain[km]))*250*idx))*pr.terrainInfluence;
      const thermalAcceleration=.028*(nt[i]-env)*pr.buoyancy+.015*warmCore*groundWeight*cfg.thermal*pr.buoyancy;
      nw[i]+=h*(thermalAcceleration-.01*cloud-.018*rain-.0035*W[i]+(uplift-W[i])*.012*groundWeight);
      if(y===l-1)nw[i]*=Math.exp(-.2*h);if(inGround)nw[i]=Math.max(0,nw[i])*.2;
      const divergence=(U[xp]-U[xm]+V[zp]-V[zm])*.5*idx+(W[yp]-W[ym])*.5*idy;
      np[i]+=h*(-14*divergence-.0015*P[i]-.00025*Math.max(0,nw[i]));
      nu[i]=atmClamp(nu[i],-120,120);nv[i]=atmClamp(nv[i],-120,120);nw[i]=atmClamp(nw[i],-65,65);np[i]=atmClamp(np[i],-60,60);
    }
    // Bottom-to-top traversal reads each unmodified donor before updating it.
    // The same donor flux leaves one cell and enters the next, including snow/rain transitions.
    for(let y=0;y<l;y++)for(let j=0;j<nn;j++){
      const i=j+nn*y,altitude=y/(l-1)*12;if(altitude<this.terrain[j])continue;
      const outgoing=nr[i]*(nt[i]<0?2.3:7)*h*idy;
      const incoming=y<l-1?nr[i+nn]*(nt[i+nn]<0?2.3:7)*h*idy:0;
      nr[i]=atmClamp(nr[i]-outgoing+incoming,0,20);
      if(y===0||(y-1)/(l-1)*12<this.terrain[j]){
        // g/kg × layer depth (m) × air density (kg/m³) / 1000 = rainfall mm.
        const groundRainMm=outgoing*dy*1.08/1000;
        precipitation+=groundRainMm;
        // Soil moisture is a 0..1 fraction of a stylized 100 mm available-water reservoir.
        if(this.surface[j]!==1&&this.surface[j]!==4)this.moisture[j]=atmClamp(this.moisture[j]+groundRainMm/100,0,1);
      }
    }
    for(const key of ATMOSPHERE_FIELDS){const old=this[key];this[key]=this._next[key];this._next[key]=old;}
    this.precipTotal+=precipitation/nn;
    // Dry land slowly loses available moisture; surface precipitation replenishes it above.
    for(let j=0;j<nn;j++){if(this.surface[j]===1||this.surface[j]===4)this.moisture[j]=1;else this.moisture[j]=atmClamp(this.moisture[j]-h*pr.evaporation*.000002,0,1);}
  }
  _vorticity(x,y,z) {
    const n=this.n,base=n*n*y,i=x+n*z+base;
    const xm=x===0?i+n-1:i-1,xp=x===n-1?i-n+1:i+1,zm=z===0?i+n*n-n:i-n,zp=z===n-1?i-n*n+n:i+n;
    return ((this.v[xp]-this.v[xm])-(this.u[zp]-this.u[zm]))/(2*this._dx);
  }
  stats() {
    let temperature=0,humidity=0,cloud=0,rain=0,wind=0,pressure=0,maxUpdraft=0,vorticity=0,covered=0,charge=0,finite=true;
    const n=this.n,l=this.l,length=this.t.length;
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      let columnCloud=0;
      for(let y=0;y<l;y++){
        const i=x+n*(z+n*y);temperature+=this.t[i];humidity+=this.q[i]/this.qSaturation(this.t[i])*100;cloud+=this.c[i];rain+=this.r[i];wind+=Math.hypot(this.u[i],this.v[i]);pressure+=this.p[i];maxUpdraft=Math.max(maxUpdraft,this.w[i]);columnCloud+=this.c[i];vorticity=Math.max(vorticity,Math.abs(this._vorticity(x,y,z)));
        charge=Math.max(charge,this.c[i]*Math.max(0,this.w[i])*Math.max(.1,this.r[i])*.09);
        for(const key of ATMOSPHERE_FIELDS)if(!Number.isFinite(this[key][i]))finite=false;
      }
      if(columnCloud*12/l>.45)covered++;
    }
    return {temperature:temperature/length,humidity:humidity/length,cloud:cloud/length,cloudCover:covered/(n*n),rain:rain/length,precipTotal:this.precipTotal,maxUpdraft,wind:wind/length,pressure:pressure/length,vorticity,cfl:this._lastCfl,substeps:this._lastSubsteps,charge:atmClamp(charge*this.params.lightning,0,1),finite};
  }
  sample(wx,wy,wz) {
    const n=this.n,x=Math.round(atmClamp((wx+16)/32,0,1)*(n-1)),z=Math.round(atmClamp((wz+16)/32,0,1)*(n-1)),y=Math.round(atmClamp(wy/12,0,1)*(this.l-1)),j=x+n*z,i=j+n*n*y;
    return {temperature:this.t[i],humidity:100*this.q[i]/this.qSaturation(this.t[i]),vapor:this.q[i],cloud:this.c[i],rain:this.r[i],u:this.u[i],v:this.v[i],w:this.w[i],pressure:1013.25*Math.exp(-(y/(this.l-1)*6000)/8400)+this.p[i],buoyancy:.028*(this.t[i]-this._environment(y,wx))*this.params.buoyancy,vorticity:this._vorticity(x,y,z),terrain:this.terrain[j],moisture:this.moisture[j]};
  }
  column(wx,wz) {return Array.from({length:this.l},(_,y)=>({...this.sample(wx,y/(this.l-1)*12,wz),altitude:y/(this.l-1)*6}));}
  brush(tool,wx,wz,radius,strength,elapsed=.1) {
    const supported=['heat','cool','moisture','dry','wind','pressure','cloud','raise','lower','lake','forest','city','ocean'];
    if(!supported.includes(tool))throw new Error('Unknown brush tool');
    if(![wx,wz,radius,strength,elapsed].every(Number.isFinite)||elapsed<0)throw new Error('Invalid brush arguments');
    radius=atmClamp(radius,.5,5);strength=atmClamp(strength,.1,3);elapsed=atmClamp(elapsed,0,1);
    const n=this.n,nn=n*n;let touched=0;
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const dx=x/(n-1)*32-16-wx,dz=z/(n-1)*32-16-wz,d=Math.hypot(dx,dz);if(d>radius)continue;
      const j=x+n*z,weight=(1-(d/radius)**2)**2,amount=weight*strength*elapsed;touched++;
      if(tool==='raise'||tool==='lower'){this.terrain[j]=atmClamp(this.terrain[j]+(tool==='raise'?1:-1)*amount*.9,0,3.8);if(this.terrain[j]>.08&&this.surface[j]===4)this.surface[j]=0;continue;}
      if(['lake','forest','city','ocean'].includes(tool)){
        this.surface[j]={lake:1,forest:2,city:3,ocean:4}[tool];this.moisture[j]=tool==='city'?.25:tool==='forest'?.85:1;
        if(tool==='ocean')this.terrain[j]=0;else if(tool==='lake')this.terrain[j]=Math.min(this.terrain[j],.12);continue;
      }
      for(let y=0;y<this.l;y++){
        const i=j+nn*y,wy=y/(this.l-1)*12,vertical=Math.exp(-Math.max(0,wy-this.terrain[j])/3.2),a=amount*vertical;
        if(tool==='heat'||tool==='cool')this.t[i]=atmClamp(this.t[i]+(tool==='heat'?1:-1)*a*5,-100,65);
        if(tool==='moisture'||tool==='dry')this.q[i]=atmClamp(this.q[i]+(tool==='moisture'?1:-1)*a*6,0,60);
        if(tool==='wind'){this.u[i]=atmClamp(this.u[i]+a*(15-dz*2),-120,120);this.v[i]=atmClamp(this.v[i]+a*dx*2,-120,120);}
        if(tool==='pressure')this.p[i]=atmClamp(this.p[i]-a*8,-60,60);
        if(tool==='cloud'){const made=amount*Math.exp(-1*((wy-5)/2.5)**2);this.c[i]=atmClamp(this.c[i]+made,0,15);}
      }
    }
    return touched;
  }
  serialize() {
    const state={schema:'weather-lab',version:1,n:this.n,l:this.l,seed:this.seed,preset:this.preset,params:{...this.params},time:this.time,steps:this.steps,rngState:this.rngState,precipTotal:this.precipTotal,lastCfl:this._lastCfl,lastSubsteps:this._lastSubsteps};
    for(const key of [...ATMOSPHERE_FIELDS,'terrain','moisture','surface'])state[key]=Array.from(this[key]);return state;
  }
  static fromState(state) {
    if(!state||typeof state!=='object'||Array.isArray(state)||state.schema!=='weather-lab'||state.version!==1)throw new Error('Unsupported weather-lab state');
    Atmosphere.validateDimensions(state.n,state.l);Atmosphere.validateParams(state.params);
    if(typeof state.preset!=='string'||!Object.hasOwn(ATMOSPHERE_PRESETS,state.preset))throw new Error('Unknown state preset');
    for(const key of ['seed','rngState'])if(!Number.isInteger(state[key])||state[key]<0||state[key]>4294967295||(key==='rngState'&&state[key]===0))throw new Error('Invalid '+key);
    for(const key of ['time','precipTotal','lastCfl'])if(typeof state[key]!=='number'||!Number.isFinite(state[key])||state[key]<0||state[key]>1e12)throw new Error('Invalid '+key);
    for(const key of ['steps','lastSubsteps'])if(!Number.isSafeInteger(state[key])||state[key]<0)throw new Error('Invalid '+key);
    for(const key of [...ATMOSPHERE_FIELDS,'terrain','moisture','surface']){
      const a=state[key],length=state.n*state.n*(ATMOSPHERE_FIELDS.includes(key)?state.l:1),[min,max]=ATMOSPHERE_BOUNDS[key];
      if(!Array.isArray(a)||a.length!==length)throw new Error('Invalid array length: '+key);
      for(let i=0;i<a.length;i++)if(typeof a[i]!=='number'||!Number.isFinite(a[i])||a[i]<min||a[i]>max||(key==='surface'&&!Number.isInteger(a[i])))throw new Error('Invalid array value: '+key+'['+i+']');
    }
    // Validation completes before allocating or exposing any replacement atmosphere.
    const restored=Object.create(Atmosphere.prototype);
    for(const key of ['n','l','seed','preset','time','steps','rngState','precipTotal'])restored[key]=state[key];
    restored.params={...state.params};restored._lastCfl=state.lastCfl;restored._lastSubsteps=state.lastSubsteps;restored._allocate();
    for(const key of [...ATMOSPHERE_FIELDS,'terrain','moisture','surface'])restored[key].set(state[key]);return restored;
  }
  resize(n,l) {
    Atmosphere.validateDimensions(n,l);
    const result=Object.create(Atmosphere.prototype);
    for(const key of ['seed','preset','time','steps','rngState','precipTotal'])result[key]=this[key];
    result.n=n;result.l=l;result.params={...this.params};result._lastCfl=this._lastCfl;result._lastSubsteps=this._lastSubsteps;result._allocate();
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const ox=Math.round(x/(n-1)*(this.n-1)),oz=Math.round(z/(n-1)*(this.n-1)),j=x+n*z,oj=ox+this.n*oz;
      result.terrain[j]=this.terrain[oj];result.moisture[j]=this.moisture[oj];result.surface[j]=this.surface[oj];
      for(let y=0;y<l;y++){
        const fy=y/(l-1)*(this.l-1),y0=Math.floor(fy),y1=Math.min(this.l-1,y0+1),f=fy-y0;
        for(const key of ATMOSPHERE_FIELDS)result[key][j+n*n*y]=this[key][oj+this.n*this.n*y0]*(1-f)+this[key][oj+this.n*this.n*y1]*f;
      }
    }
    return result;
  }
}
if(typeof module!=='undefined')module.exports={Atmosphere,DEFAULT_PARAMS};
