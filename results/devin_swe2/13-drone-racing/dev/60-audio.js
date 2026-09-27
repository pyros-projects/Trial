// ================= procedural audio =================
const AU={ctx:null,master:null,motor:null,mGain:null,noise:null,nGain:null,started:false};
function audioInit(){
 if(AU.started)return;AU.started=true;
 try{
  const c=new (window.AudioContext||window.webkitAudioContext)();AU.ctx=c;
  AU.master=c.createGain();AU.master.gain.value=S.muted?0:S.volume;AU.master.connect(c.destination);
  // motor hum: two detuned saws + filtered noise
  const o1=c.createOscillator(),o2=c.createOscillator();
  o1.type='sawtooth';o2.type='sawtooth';o1.frequency.value=80;o2.frequency.value=83;
  const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.Q.value=2;
  AU.mGain=c.createGain();AU.mGain.gain.value=0;
  o1.connect(lp);o2.connect(lp);lp.connect(AU.mGain);AU.mGain.connect(AU.master);
  o1.start();o2.start();AU.motor=[o1,o2];AU.motorLP=lp;
  const nb=c.createBuffer(1,c.sampleRate,c.sampleRate);
  const nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=c.createBufferSource();ns.buffer=nb;ns.loop=true;
  const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1800;bp.Q.value=0.6;
  AU.nGain=c.createGain();AU.nGain.gain.value=0;
  ns.connect(bp);bp.connect(AU.nGain);AU.nGain.connect(AU.master);ns.start();
  AU.noiseBP=bp;
 }catch(e){AU.started=false}
}
['pointerdown','keydown','touchstart'].forEach(ev=>window.addEventListener(ev,audioInit,{once:false}));
function audioFrame(dt){
 if(!AU.ctx)return;
 if(AU.ctx.state==='suspended'){AU.ctx.resume();return}
 AU.master.gain.value=S.muted?0:S.volume;
 const m=D.crashed?0:D.motor,spd=V3.len(D.v);
 const f=70+D.motor*160+spd*0.7+Math.sin(performance.now()*0.02)*3*D.motor;
 AU.motor[0].frequency.value=f;AU.motor[1].frequency.value=f*1.007+Math.sin(performance.now()*0.03)*2;
 AU.motorLP.frequency.value=500+D.motor*2600;
 AU.mGain.gain.value=0.05+D.motor*0.11;
 AU.nGain.gain.value=0.004+D.motor*0.03+Math.min(0.05,spd*0.0012);
 AU.noiseBP.frequency.value=800+D.motor*2200}
function blip(freq,dur,g,type='square'){
 if(!AU.ctx)return;const c=AU.ctx,o=c.createOscillator(),gn=c.createGain();
 o.type=type;o.frequency.value=freq;gn.gain.setValueAtTime(g,c.currentTime);
 gn.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+dur);
 o.connect(gn);gn.connect(AU.master);o.start();o.stop(c.currentTime+dur)}
function noiseBurst(dur,g,filt=1200){
 if(!AU.ctx)return;const c=AU.ctx;
 const b=c.createBuffer(1,c.sampleRate*dur|0,c.sampleRate),d=b.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
 const s=c.createBufferSource();s.buffer=b;
 const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=filt;
 const gn=c.createGain();gn.gain.value=g;
 s.connect(f);f.connect(gn);gn.connect(AU.master);s.start()}
function sfxGate(){blip(880,0.12,0.12);setTimeout(()=>blip(1320,0.14,0.1),70)}
function sfxMiss(){blip(220,0.3,0.14,'sawtooth');blip(180,0.4,0.12,'sawtooth')}
function sfxFinish(){[660,880,1100,1320].forEach((f,i)=>setTimeout(()=>blip(f,0.22,0.12),i*110))}
function sfxHit(sp){noiseBurst(0.12,Math.min(0.5,sp*0.05),2500)}
function sfxCrash(){noiseBurst(0.7,0.5,900);blip(140,0.5,0.15,'sawtooth')}

// ================= particles =================
const PART={n:600,pool:[],i:0,
 emit(x,y,z,vx,vy,vz,life,size,r,g,b,a){
  const p=this.pool[this.i=(this.i+1)%this.n];
  p.p[0]=x;p.p[1]=y;p.p[2]=z;p.v[0]=vx;p.v[1]=vy;p.v[2]=vz;
  p.life=life;p.t=0;p.size=size;p.c[0]=r;p.c[1]=g;p.c[2]=b;p.c[3]=a}};
for(let i=0;i<PART.n;i++)PART.pool.push({p:V3.c(),v:V3.c(),c:[0,0,0,0],life:0,t:1e9,size:0});
let partMesh=null;
function spawnBurst(pos,n,cnt){
 const c=Math.min(cnt*S.partDens|0,60);
 for(let i=0;i<c;i++){const a=Math.random()*Math.PI*2,b=Math.random()*Math.PI,s=2+Math.random()*8;
  const spark=Math.random()<0.4;
  PART.emit(pos[0],pos[1],pos[2],
   Math.cos(a)*Math.sin(b)*s+n[0]*4,Math.abs(Math.cos(b))*s*0.7+1,Math.sin(a)*Math.sin(b)*s+n[2]*4,
   spark?0.4+Math.random()*0.4:0.8+Math.random()*0.8,
   spark?0.05:0.3+Math.random()*0.3,
   spark?1.0:0.55,spark?0.75:0.45,spark?0.3:0.35,spark?0.9:0.5)}}
function partStep(dt){
 for(const p of PART.pool){if(p.t>=p.life)continue;p.t+=dt;
  p.v[1]-=6*dt;V3.mad(p.p,p.p,p.v,dt);
  const gh=W.h(p.p[0],p.p[2]);if(p.p[1]<gh){p.p[1]=gh;p.v[1]*=-0.3;p.v[0]*=0.7;p.v[2]*=0.7}}}
const partData=new Float32Array(PART.n*8); // x,y,z,r,g,b,a,size
function partFill(){let n=0;
 for(const p of PART.pool){if(p.t>=p.life||n>=PART.n)continue;
  const f=1-p.t/p.life,o=n*8;
  partData[o]=p.p[0];partData[o+1]=p.p[1];partData[o+2]=p.p[2];
  partData[o+3]=p.c[0];partData[o+4]=p.c[1];partData[o+5]=p.c[2];
  partData[o+6]=p.c[3]*f;partData[o+7]=p.size;n++}
 return n}
