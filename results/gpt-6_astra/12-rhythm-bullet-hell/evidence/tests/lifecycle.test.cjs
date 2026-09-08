const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');

const root=fs.existsSync('index.html')?'.':'../..';
const html=fs.readFileSync(root+'/index.html','utf8');
const coreScript=html.match(/<script id="sim-core">([\s\S]*?)<\/script>/);
assert.ok(coreScript,'Standalone application must contain the executable simulation core');
const coreContext={};
vm.createContext(coreContext);
vm.runInContext(coreScript[1],coreContext);
const {Sim,validateConfig,validateReplay}=coreContext.EchoCore;

function test(name,fn){return Promise.resolve().then(fn).then(()=>console.log('PASS',name))}

function extractFunction(source,name){
  const start=source.indexOf('function '+name+'(');
  assert.notEqual(start,-1,'Missing production function '+name);
  const brace=source.indexOf('{',start);
  let depth=0,quote='',escaped=false;
  for(let i=brace;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped)escaped=false;
      else if(ch==='\\')escaped=true;
      else if(ch===quote)quote='';
      continue;
    }
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw Error('Unclosed production function '+name);
}

function validReplay(){
  return {version:1,engine:'echo-shift-1',config:{
    mode:'play',difficulty:'flow',pattern:'bloom',music:'neon',quality:'high',subdivision:2,
    bpm:120,density:1,speed:1,offset:0,master:.65,drums:.8,bass:.7,melody:.6,pad:.4,
    particles:1,seed:'lifecycle',grid:Array(16).fill(true),shake:true,reducedMotion:false,
    reducedFlash:false,contrast:false
  },ticks:3,actions:[[0,0,0,0,0],[1,.5,-.5,1,0,320,240]],changes:[],checksum:'12ab34ef'};
}

async function main(){
  await test('valid replay baseline accepts typed booleans, action tuple shapes, and checksum',()=>{
    const replay=validReplay();
    assert.equal(validateConfig(replay.config),replay.config);
    assert.equal(validateReplay(replay),replay);
  });

  await test('replay validation rejects malformed booleans, tuple length, and checksum types',()=>{
    for(const key of ['shake','reducedMotion','reducedFlash','contrast']){
      const replay=validReplay();replay.config[key]=key;
      assert.throws(()=>validateReplay(replay),new RegExp(key));
    }
    const six=validReplay();six.actions=[[0,0,0,0,0,12]];
    assert.throws(()=>validateReplay(six),/movement action/);
    for(const checksum of [12345678,null,'','1234567','123456789','zzzzzzzz']){
      const replay=validReplay();replay.checksum=checksum;
      assert.throws(()=>validateReplay(replay),/checksum/);
    }
  });

  await test('lab subdivision changes bloom emission density',()=>{
    const quarter=new Sim({mode:'lab',pattern:'bloom',subdivision:1,grid:Array(16).fill(true)});
    const sixteenth=new Sim({mode:'lab',pattern:'bloom',subdivision:4,grid:Array(16).fill(true)});
    for(let tick=0;tick<720;tick++){quarter.step({});sixteenth.step({})}
    assert.ok(sixteenth.emitted>quarter.emitted*2,{quarter:quarter.emitted,sixteenth:sixteenth.emitted});
  });

  await test('audio recovery aligns paused real and silent clocks without scheduling backlog',()=>{
    const audioSource=fs.readFileSync(root+'/evidence/audio.js','utf8');
    const audioContext={setInterval:()=>17,clearInterval:()=>{},performance:{now:()=>50000}};
    vm.createContext(audioContext);
    vm.runInContext(audioSource+'\n;globalThis.TestAudioRack=AudioRack;',audioContext);
    const transport={beatAt:seconds=>seconds*2-4,timeAt:beat=>(beat+4)/2};
    const rack=new audioContext.TestAudioRack(transport);
    let stopped=0;
    rack.context={currentTime:20,state:'suspended'};
    rack.origin=10;rack.running=false;rack.pausedElapsed=10;rack.schedulerId=17;
    rack.voices.add({stop(){stopped++}});
    rack._lastScheduledTime=20.4;
    rack.align(5.1);
    assert.equal(rack.running,false);
    assert.equal(rack.pausedElapsed,5.1);
    assert.equal(rack.origin,14.9);
    assert.equal(rack._fallbackOrigin,44900);
    assert.equal(rack.nextBeat,6.25);
    assert.equal(rack.schedulerId,0);
    assert.equal(rack.voices.size,0);
    assert.equal(stopped,1);
    assert.equal(rack._lastScheduledTime,20);
    assert.equal(rack.elapsed(),5.1);

    rack.context=null;rack._unavailable=true;
    rack.align(7.25);
    assert.equal(rack.pausedElapsed,7.25);
    assert.equal(rack._fallbackOrigin,42750);
    assert.equal(rack.elapsed(),7.25);
  });

  await test('gamepad Start uses a persistent edge latch across pause and dialog states',()=>{
    const appSource=fs.readFileSync(root+'/evidence/app.js','utf8');
    const pollSource=extractFunction(appSource,'pollGamepad');
    const clearSource=extractFunction(appSource,'clearInputs');
    const harness={pressed:false,present:true,dialogHidden:true,toggles:[]};
    const context={
      navigator:{getGamepads:()=>harness.present?[{axes:[0,0],buttons:Array.from({length:16},(_,i)=>({pressed:i===9&&harness.pressed}))}]:[]},
      harness,
      console
    };
    vm.createContext(context);
    vm.runInContext(`
      let screen='playing',gamepadConnected=false,padPause=false,pointer={x:1},dashTap=true,touchFocus=true;
      const keys=new Set(['KeyD']);
      const $=()=>({hidden:harness.dialogHidden,setAttribute(){}});
      const togglePause=reason=>harness.toggles.push(reason);
      ${clearSource}
      ${pollSource}
      globalThis.api={pollGamepad,clearInputs,setScreen:v=>screen=v,state:()=>({screen,gamepadConnected,padPause,pointer,dashTap,touchFocus,keys:[...keys]})};
    `,context);
    const api=context.api;

    harness.pressed=true;api.pollGamepad();api.clearInputs();api.pollGamepad();
    assert.deepEqual(harness.toggles,['Controller'],'holding Start must not retrigger after input clearing');
    assert.equal(api.state().keys.length,0);assert.equal(api.state().pointer,null);
    assert.equal(api.state().padPause,true,'pause latch must survive input clearing');

    harness.pressed=false;api.pollGamepad();api.setScreen('paused');harness.pressed=true;api.pollGamepad();
    assert.deepEqual(harness.toggles,['Controller','Controller'],'release then press must resume');

    harness.pressed=false;api.pollGamepad();harness.dialogHidden=false;harness.pressed=true;api.pollGamepad();
    harness.dialogHidden=true;api.pollGamepad();
    assert.equal(harness.toggles.length,2,'dialog must consume the held Start edge');
    harness.pressed=false;api.pollGamepad();harness.pressed=true;api.pollGamepad();
    assert.equal(harness.toggles.length,3);

    for(const state of ['title','failure']){
      harness.pressed=false;api.pollGamepad();api.setScreen(state);harness.pressed=true;api.pollGamepad();
    }
    assert.equal(harness.toggles.length,3,'Start must not begin title or failure states');
    harness.present=false;api.pollGamepad();assert.equal(api.state().gamepadConnected,false);
  });

  await test('application keeps run telemetry truthful and binds select changes',()=>{
    const appSource=fs.readFileSync(root+'/evidence/app.js','utf8');
    assert.match(appSource,/\$\('subdivision'\)\.onchange=/);
    assert.match(appSource,/COMBO <b>\$\{sim\.combo\}<\/b>/);
    assert.match(appSource,/screen==='title'\?settings:sim\.config/);
    assert.match(appSource,/Math\.min\(mode==='play'\?24:Infinity/);
    assert.match(appSource,/11\/feedbackScaleX/);
    assert.match(appSource,/clamp\(f\.x,feedbackMargin\+feedbackHalf,W-feedbackMargin-feedbackHalf\)/);
    assert.match(html,/\.bottom-status\{[^}]*position:fixed/);
    const beatSource=extractFunction(appSource,'updateBeatIndicator');
    const frameSource=extractFunction(appSource,'frame');
    const uiSource=extractFunction(appSource,'updateUI');
    assert.match(beatSource,/beatLights\.forEach/);
    assert.match(beatSource,/lastBeatIndicator/);
    assert.match(frameSource,/updateBeatIndicator\(\)/);
    assert.doesNotMatch(uiSource,/beatLights\.forEach/);
  });

  await test('keyboard activation stays native on controls while canvas shortcuts remain available',()=>{
    const appSource=fs.readFileSync(root+'/evidence/app.js','utf8');
    const activationSource=extractFunction(appSource,'isNativeActivation');
    const context={};vm.createContext(context);vm.runInContext(activationSource+';globalThis.isNativeActivationTest=isNativeActivation;',context);
    const button={closest:selector=>selector==='button,a[href]'?{}:null};
    const canvas={closest:()=>null};
    assert.equal(context.isNativeActivationTest({code:'Space',target:button}),true);
    assert.equal(context.isNativeActivationTest({code:'Enter',target:button}),true);
    assert.equal(context.isNativeActivationTest({code:'Escape',target:button}),false);
    assert.equal(context.isNativeActivationTest({code:'Space',target:canvas}),false);
    assert.match(appSource,/if\(isNativeActivation\(e\)\)return/);
    assert.match(appSource,/\$\('touchDash'\)\.onclick=e=>\{if\(e\.detail===0\)dashTap=true\}/);
  });
}

main().then(()=>console.log('7 lifecycle and validation checks passed')).catch(error=>{console.error(error);process.exitCode=1});
