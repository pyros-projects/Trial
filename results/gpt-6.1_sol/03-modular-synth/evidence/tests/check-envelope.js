(async () => {
 const p=window.forma.project;
 p.master=1;p.fx={delay:0,feedback:0,reverb:0,space:.4,drive:0,tone:18000,threshold:0};
 const t=p.tracks[1];t.volume=.7;t.pan=0;t.delay=0;t.reverb=0;t.mute=false;t.solo=false;
 t.synth={...t.synth,wave:'sine',detune:0,attack:.8,decay:.2,sustain:.5,release:.08,cutoff:16000,filterEnv:0,lfoDepth:0};
 const ctx=new OfflineAudioContext(2,22050,44100),engine=new window.forma.engine.constructor(ctx,p,true);
 engine.play(1,60,.8,.02,.12);
 const b=await ctx.startRendering(),d=b.getChannelData(0);let energy=0,count=0;
 for(let i=Math.floor(.04*44100);i<Math.floor(.10*44100);i++){energy+=d[i]*d[i];count++;}
 const rms=Math.sqrt(energy/count);
 if(rms<.001)throw new Error('Short gate removed long attack: early RMS '+rms);
 return {pass:true,earlyRms:rms};
})()
