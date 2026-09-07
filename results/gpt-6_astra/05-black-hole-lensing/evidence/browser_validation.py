#!/usr/bin/env python3
"""Agent-authored real-browser workflow. All changes use pointer/keyboard/UI controls.
Eval calls read live diagnostics only; error injection is kept in a separate harness.
"""
import subprocess, json, time, pathlib, shlex, os
ROOT=pathlib.Path(__file__).resolve().parent
LOG=ROOT/'logs'/'browser-actions.jsonl'
RESULTS=ROOT/'logs'/'workflow-results.json'
results=json.loads(RESULTS.read_text()) if RESULTS.exists() else []
def run(*args):
    cmd=['agent-browser','--session',os.environ.get('HORIZON_BROWSER_SESSION','horizon'),'--json',*map(str,args)]
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=45)
    with LOG.open('a') as f:f.write(json.dumps({'command':shlex.join(cmd),'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})+'\n')
    if p.returncode: raise RuntimeError(p.stdout+p.stderr)
    data=json.loads(p.stdout)
    if not data.get('success'):raise RuntimeError(str(data))
    return data['data']
def ev(js):return run('eval',js)['result']
def shot(name):run('screenshot',str(ROOT/'screenshots'/name))
def click(name,role='button'):run('find','role',role,'click','--name',name,'--exact')
def snap():run('snapshot','-i')
def state():return ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({d:Horizon.diagnostics,p:Horizon.samplePixels()}))))')
def check(name,ok,detail):
    item={'check':name,'status':'pass' if ok else 'fail','observed':detail};results.append(item);RESULTS.write_text(json.dumps(results,indent=2));print(json.dumps(item),flush=True)
def range_to(id,value):
    run('scrollintoview','#'+id)
    box=ev("(()=>{let e=document.getElementById("+json.dumps(id)+"),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,min:+e.min,max:+e.max}})()")
    x=box['x']+4.5+(box['w']-9)*(value-box['min'])/(box['max']-box['min'])
    run('mouse','move',round(x),round(box['y']+box['h']/2));run('mouse','down');run('mouse','up')

def desktop():
    run('errors','--clear');run('console','--clear');snap()
    base=state();shot('desktop-workflow-baseline.png')
    check('direct-file offline render',base['d']['ready'] and base['p']['nonzero']>1000 and base['p']['glError']==0,{'protocol':ev('location.protocol'),'resources':ev('performance.getEntriesByType("resource").map(e=>e.name)'),'pixels':base['p'],'shaders':base['d']['shaderStatus']})
    run('record','start',str(ROOT/'videos'/'camera-ray-workflow.webm'))
    run('mouse','move',460,375);run('mouse','down')
    continuity=[]
    for x,y in [(480,383),(500,395),(525,410),(550,426)]:
        run('mouse','move',x,y);continuity.append(state())
    run('mouse','up');shot('desktop-orbited.png')
    check('continuous pointer orbit updates geometry',len({s['p']['hash'] for s in continuity})==4 and continuity[-1]['d']['camera']['pitch']!=base['d']['camera']['pitch'],[{'camera':s['d']['camera'],'hash':s['p']['hash']} for s in continuity])
    snap();click('Pan camera');before=state();run('mouse','move',440,370);run('mouse','down');run('mouse','move',484,390);run('mouse','up');after=state();shot('desktop-panned.png')
    check('pan changes target and ray field',before['d']['camera']['target']!=after['d']['camera']['target'] and before['p']['hash']!=after['p']['hash'],{'before':before['d']['camera'],'after':after['d']['camera']})
    run('mouse','move',440,370);run('mouse','wheel',-90);run('wait','--fn','Horizon.diagnostics.camera.distance<'+str(after['d']['camera']['distance']));zoom=state();check('wheel zoom',zoom['d']['camera']['distance']<after['d']['camera']['distance'],zoom['d']['camera'])
    run('focus','#universe');run('press','ArrowRight');run('press','+');keys=state();check('keyboard camera control',keys['d']['camera']['yaw']!=zoom['d']['camera']['yaw'] and keys['d']['camera']['distance']<zoom['d']['camera']['distance'],keys['d']['camera'])
    snap();click('Classic');run('wait','--fn','Math.abs(Horizon.diagnostics.camera.distance-22)<0.01');click('Inspect a ray');run('mouse','move',610,317);run('mouse','down');run('mouse','up');ray=state();shot('desktop-selected-ray.png')
    check('ray selection and trajectory inspector',ray['d']['selected'] is not None and ev('!document.getElementById("inspector").hidden') and ray['d']['selectedRay']['steps']>0,ray['d']['selectedRay'])
    run('record','stop')
    modes=[]
    for mode,name in [(1,'steps'),(2,'deflection'),(3,'frequency'),(4,'disk-coordinates'),(5,'distance'),(6,'classification')]:
        run('select','#viewMode',str(mode));s=state();shot('diagnostic-'+name+'.png');modes.append({'mode':mode,'hash':s['p']['hash'],'glError':s['p']['glError'],'legend':ev('document.getElementById("legendDescription").textContent')})
    check('all six diagnostics render distinct data',len({m['hash'] for m in modes})==6 and all(m['glError']==0 for m in modes),modes)
    run('select','#viewMode','0');snap();click('Close ray inspector');click('Environment','tab');range_to('spin',0);before=state();range_to('mass',0);flat=state();shot('zero-lensing-control.png');range_to('mass',1);bent=state();shot('lensing-restored.png')
    check('zero and enabled lensing change actual paths',flat['p']['hash']!=bent['p']['hash'] and flat['d']['settings']['mass']==0 and flat['d']['selectedRay']['bend']<.001,{'flat':flat['d']['selectedRay'],'lensed':bent['d']['selectedRay'],'pixelHashes':[flat['p']['hash'],bent['p']['hash']]})
    run('select','#viewMode','3');range_to('doppler',0);off=state();shot('frequency-doppler-off.png');range_to('doppler',2);on=state();shot('frequency-doppler-on.png');check('Doppler diagnostic responds',off['p']['hash']!=on['p']['hash'],{'off':off['d']['settings']['doppler'],'on':on['d']['settings']['doppler'],'hashes':[off['p']['hash'],on['p']['hash']]})
    range_to('redshift',0);off=state();range_to('redshift',2);on=state();shot('frequency-redshift-strong.png');check('redshift diagnostic responds',off['p']['hash']!=on['p']['hash'],{'off':off['d']['settings']['redshift'],'on':on['d']['settings']['redshift'],'hashes':[off['p']['hash'],on['p']['hash']]})
    click('Render','tab');run('select','#viewMode','6');range_to('maxSteps',32);limited=state();shot('integration-step-limit.png');range_to('maxSteps',320);resolved=state();shot('integration-step-limit-resolved.png');check('step limit exposed and resolved',limited['p']['hash']!=resolved['p']['hash'],{'limited':limited['d']['settings']['maxSteps'],'resolved':resolved['d']['settings']['maxSteps'],'hashes':[limited['p']['hash'],resolved['p']['hash']]})
    run('select','#viewMode','1');before=state();run('focus','#step');run('press','ArrowLeft');after=state();check('keyboard ray-step input changes rendering',before['d']['settings']['step']>after['d']['settings']['step'] and before['p']['hash']!=after['p']['hash'],{'beforeStep':before['d']['settings']['step'],'afterStep':after['d']['settings']['step']})
    click('Balanced');balanced=state();click('Ultra');ultra=state();click('Performance');perf=state();check('quality presets apply integration and dimensions',len({tuple(s['d']['internalSize']) for s in [balanced,ultra,perf]})==3, [{'quality':s['d']['settings']['quality'],'size':s['d']['internalSize'],'step':s['d']['settings']['step'],'budget':s['d']['settings']['maxSteps']} for s in [balanced,ultra,perf]])
    run('select','#viewMode','0');run('check','#taa');run('wait','--fn','Horizon.diagnostics.accumSamples===32');aa=state();run('focus','#universe');run('press','ArrowLeft');cleared=state();check('paused temporal accumulation and invalidation',aa['d']['accumSamples']==32 and cleared['d']['accumSamples']<32,{'pausedSamples':aa['d']['accumSamples'],'afterCameraMove':cleared['d']['accumSamples']});run('uncheck','#taa')
    click('Camera','tab');run('check','#horizonOverlay');run('check','#photonOverlay');run('check','#diskOverlay');shot('coordinate-overlays.png');check('coordinate overlays toggled',all(ev('Horizon.diagnostics.settings')[k] for k in ['horizonOverlay','photonOverlay','diskOverlay']),ev('Horizon.diagnostics.settings'))
    for name in ['Polar','Edge-on','Close encounter','Classic']:
        snap();click(name);run('wait','--fn', {'Polar':'Horizon.diagnostics.camera.pitch>1.45','Edge-on':'Horizon.diagnostics.camera.pitch<0.026','Close encounter':'Horizon.diagnostics.camera.distance<13.01','Classic':'Math.abs(Horizon.diagnostics.camera.distance-22)<0.01'}[name]);shot('preset-'+name.lower().replace(' ','-')+'.png')
    run('check','#autoOrbit');snap();click('Resume simulation');a=state();run('wait','--fn','Horizon.diagnostics.time>'+str(a['d']['time']+.7));b=state();snap();click('Pause simulation');c=state();run('eval','new Promise(r=>setTimeout(()=>r(Horizon.diagnostics.time),500))');d=state();check('auto orbit follows playback; pause freezes time',b['d']['camera']['yaw']!=a['d']['camera']['yaw'] and c['d']['time']==d['d']['time'],{'before':{'time':a['d']['time'],'yaw':a['d']['camera']['yaw']},'running':{'time':b['d']['time'],'yaw':b['d']['camera']['yaw']},'pausedTimes':[c['d']['time'],d['d']['time']]})
    run('uncheck','#autoOrbit');range_to('simTime',180);scrub=state();check('simulation time scrub',abs(scrub['d']['time']-180)<2,scrub['d']['time']);snap();click('Restart simulation time');check('restart time',ev('Horizon.diagnostics.time')==0,ev('Horizon.diagnostics.time'))
    run('select','#timeSpeed','2');check('playback speed control',ev('Horizon.diagnostics.settings.speed')==2,ev('Horizon.diagnostics.settings.speed'))
    snap();click('Field notes ↗');shot('field-notes.png');check('field notes navigation',ev('document.getElementById("notesDialog").open'),ev('document.getElementById("notesDialog").open'));run('press','Escape');click('Controls and help');shot('controls-help.png');run('press','Escape');run('focus','#universe');run('press','h');shot('cinematic-full-view.png');check('cinematic control and escape',ev('document.body.classList.contains("full-ui-hidden")'),ev('({w:document.getElementById("stage").clientWidth,h:document.getElementById("stage").clientHeight})'));run('press','Escape')
    errors=run('errors');console=run('console');check('desktop console and runtime errors',len(errors.get('errors',[]))==0 and len(ev('Horizon.diagnostics.errors'))==0,{'errors':errors.get('errors'),'console':console.get('messages'),'runtime':ev('Horizon.diagnostics.errors')})

if __name__=='__main__': desktop()
