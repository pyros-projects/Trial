// ============================================================ procedural audio
const AudioSys = {
  ctx:null, enabled:true, master:null,
  init(){
    if(this.ctx) return;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain(); this.master.gain.value=0.18;
      this.master.connect(this.ctx.destination);
    }catch(e){ this.enabled=false; }
  },
  env(t0,a,d,peak){
    const g=this.ctx.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.linearRampToValueAtTime(peak,t0+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);
    g.connect(this.master); return g;
  },
  osc(type,f0,f1,t0,dur,peak){
    const o=this.ctx.createOscillator();
    o.type=type; o.frequency.setValueAtTime(f0,t0);
    if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t0+dur);
    o.connect(this.env(t0,0.005,dur,peak));
    o.start(t0); o.stop(t0+dur+0.05);
  },
  noise(t0,dur,peak,fc){
    const n=this.ctx.sampleRate*dur;
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=fc||1200;
    src.connect(f); f.connect(this.env(t0,0.003,dur,peak));
    src.start(t0);
  },
};
function sfx(kind){
  if(!AudioSys.enabled) return;
  AudioSys.init();
  if(!AudioSys.ctx) return;
  if(AudioSys.ctx.state==='suspended') AudioSys.ctx.resume();
  const t=AudioSys.ctx.currentTime;
  switch(kind){
    case 'place': AudioSys.osc('square',520,340,t,0.07,0.5); break;
    case 'belt':  AudioSys.osc('square',400,300,t,0.045,0.3); break;
    case 'erase': AudioSys.noise(t,0.09,0.4,900); AudioSys.osc('triangle',200,80,t,0.09,0.4); break;
    case 'err':   AudioSys.osc('sawtooth',160,110,t,0.18,0.4); break;
    case 'click': AudioSys.osc('square',700,650,t,0.03,0.25); break;
    case 'rotate':AudioSys.osc('square',300,420,t,0.05,0.3); break;
    case 'deliver':AudioSys.osc('sine',880,1320,t,0.12,0.35); break;
    case 'win':
      [523,659,784,1047].forEach((f,i)=>AudioSys.osc('sine',f,f,t+i*0.11,0.25,0.4));
      break;
    case 'pick':  AudioSys.osc('triangle',900,1100,t,0.04,0.3); break;
  }
}
