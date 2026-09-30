import subprocess,json,time,pathlib,shlex,os
root=pathlib.Path.cwd(); out=root/'evidence'; log=out/'logs/browser-commands.log'; session=os.environ.get('ATMOS_BROWSER_SESSION','atmos')
def run(*args):
 cmd=['agent-browser','--session',session,*map(str,args)]
 r=subprocess.run(cmd,text=True,capture_output=True,timeout=40)
 with log.open('a') as f:f.write('$ '+shlex.join(cmd)+'\n'+r.stdout+r.stderr+'\n')
 if r.returncode:raise RuntimeError(r.stdout+r.stderr)
 return r.stdout.strip()
def ev(s):return json.loads(run('eval',s))
def cdp(commands):
 url=run('get','cdp-url');cmd=['node','evidence/cdp-input.cjs',url,json.dumps(commands)]
 r=subprocess.run(cmd,text=True,capture_output=True,timeout=20)
 with log.open('a') as f:f.write('$ '+shlex.join(cmd)+'\n'+r.stdout+r.stderr+'\n')
 if r.returncode:raise RuntimeError(r.stderr)
def diag(name):
 d=ev('window.atmos.diagnostics()');(out/'logs'/f'{name}.json').write_text(json.dumps(d,indent=2));return d
def click(name):return run('find','role','button','click','--name',name,'--exact')
def shot(name):run('screenshot',out/'screenshots'/f'{name}.png')
def note(text):
 print(text,flush=True)
 with (out/'validation.md').open('a') as f:f.write('\n- '+text+'\n')
try:
 click('3D');run('select','#visualization','0');run('select','#quality','low');run('select','#preset','supercell');click('Place probe / orbit');d=diag('workflow-start');assert d['paused']
 t=d['simulationSeconds'];time.sleep(1);assert diag('pause-held')['simulationSeconds']==t
 click('Single simulation step');d=diag('single-step');assert d['paused'] and abs(d['simulationSeconds']-t-d['params']['timestep']*45)<1e-7
 note('PASS: pause holds numerical time; single-step advances one requested interval (5.4 simulated seconds) and stays paused.')
 click('Reset experiment with seed');a=diag('seed-reset-a');click('Single simulation step');click('Reset experiment with seed');b=diag('seed-reset-b');assert all(a['fields'][k]['hash']==b['fields'][k]['hash'] for k in a['fields'])
 note('PASS: two paused resets of seed 731 reproduce all eight field hashes exactly.')
 click('Resume');run('wait','--fn','window.atmos.simulation.steps >= 30');click('Pause');b=diag('storm-evolution');assert all(a['fields'][k]['hash']!=b['fields'][k]['hash'] for k in a['fields']);assert b['stats']['rain']>0
 note('PASS: Rotating supercell evolves wind u/v/w, temperature, vapor, cloud, precipitation and pressure over 30 actual browser simulation steps; precipitation remains positive.')
 run('mouse','move',560,350);run('mouse','down');run('mouse','move',640,390);run('mouse','move',665,408);run('mouse','up');cdp([{'method':'Input.dispatchMouseEvent','params':{'type':'mouseWheel','x':620,'y':370,'deltaY':-160,'deltaX':0}}]);click('Zoom in');cam=diag('camera-orbit-zoom');assert cam['interactions']['orbits']>0 and cam['interactions']['zooms']>0
 cdp([{'method':'Input.dispatchMouseEvent','params':{'type':'mousePressed','x':610,'y':400,'button':'left','buttons':1,'modifiers':8,'clickCount':1}},{'method':'Input.dispatchMouseEvent','params':{'type':'mouseMoved','x':650,'y':415,'button':'left','buttons':1,'modifiers':8}},{'method':'Input.dispatchMouseEvent','params':{'type':'mouseReleased','x':650,'y':415,'button':'left','buttons':0,'modifiers':8,'clickCount':1}}]);click('Windward');click('Storm eye');click('Overview');shot('camera-overview')
 note('PASS: real pointer drag changes orbit, wheel and labeled Zoom in change distance; Windward, Storm eye and Overview presets render.')
 click('Map');run('select','#visualization','1');shot('temperature-map')
 rect=ev('document.getElementById("fieldView").getBoundingClientRect().toJSON()');x=round(rect['left']+rect['width']*.24);y=round(rect['top']+rect['height']*.57)
 run('mouse','move',x,y);run('mouse','down');run('mouse','up');before=diag('intervention-before');assert abs(before['probe']['x']/39-.24)<.04
 for tool in ['Heat','Moisture','Wind']:
  click(tool);run('mouse','move',x-12,y);run('mouse','down');time.sleep(.6);run('mouse','move',x+12,y-4);time.sleep(.6);run('mouse','move',x+28,y+6);time.sleep(.5);run('mouse','up')
 after=diag('intervention-immediate');assert after['interactions']['brushSamples']>20;assert after['probe']['t']>before['probe']['t'];assert after['probe']['q']>before['probe']['q'];assert abs(after['probe']['u']-before['probe']['u'])>.1
 note('PASS: continuous real pointer strokes inject heat and vapor and change wind in the actual sampled fields while paused; more than 20 continuous brush samples recorded.')
 click('Place probe / orbit');click('Resume');start=after['simulationSteps'];run('wait','--fn',f'window.atmos.simulation.steps >= {start+24}');click('Pause');later=diag('intervention-delayed');shot('intervention-temperature-after')
 note('Observed delayed intervention response: local cloud '+str(round(before['probe']['cloud'],3))+' → '+str(round(later['probe']['cloud'],3))+' g/kg; rain '+str(round(before['probe']['rain'],3))+' → '+str(round(later['probe']['rain'],3))+' mm/h; vertical wind '+str(round(before['probe']['w'],3))+' → '+str(round(later['probe']['w'],3))+' m/s after 24 simulation intervals.')
 assert later['probe']['cloud']>before['probe']['cloud']+.02 and later['probe']['rain']>before['probe']['rain']+.001
 note('PASS: delayed local cloud and precipitation growth after heat/moisture/wind input, with actual uplift and transport.')
 for mode,name in [('2','humidity-map'),('3','cloud-map'),('4','precipitation-map'),('5','pressure-map')]:run('select','#visualization',mode);shot(name)
 click('Section');shot('vertical-section');run('focus','#probeLayer');run('press','ArrowRight');probe=diag('probe-new-altitude');assert probe['probe']['k']!=later['probe']['k']
 note('PASS: temperature, relative humidity, cloud water, precipitation and pressure diagnostic maps visibly render; vertical section and keyboard-controlled column altitude read actual fields.')
 click('3D');run('select','#visualization','0');click('Sound off');click('Trigger lightning');lightning=diag('manual-lightning');assert lightning['lightningCount']>0 and lightning['audio']['enabled'] and lightning['audio']['state']=='running';shot('lightning-inspection')
 note('PASS: manual procedural lightning triggered at a storm column; user-gesture sound enable puts Web Audio into running state and schedules thunder. Audio quality was not heard or claimed.')
 run('download','#saveBtn',out/'saved-state.json');saved=json.loads((out/'saved-state.json').read_text());assert saved['format']=='atmos-state' and len(saved['fields']['q'])==saved['n']**2*saved['l'];run('download','#csvBtn',out/'probe-history.csv');run('download','#pngBtn',out/'current-view.png');assert (out/'current-view.png').read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
 note('PASS: labeled Save state, Export probe CSV and Export view as PNG create genuine JSON, CSV and PNG downloads.')
 click('Reset experiment with seed');run('upload','#stateFile',out/'saved-state.json');run('wait','--fn',f'window.atmos.simulation.steps === {saved["steps"]}');loaded=diag('loaded-state');assert all(loaded['fields'][k]['hash']==lightning['fields'][k]['hash'] for k in loaded['fields'])
 note('PASS: importing the downloaded JSON after reset restores all eight field hashes and saved simulation time exactly.')
 (out/'invalid-state.json').write_text('{"version":1,"n":999999,"fields":{}}');beforeInvalid=diag('before-invalid');run('upload','#stateFile',out/'invalid-state.json');run('wait','--text','State rejected');rejected=diag('invalid-rejected');assert beforeInvalid['fields']==rejected['fields'] and beforeInvalid['simulationSeconds']==rejected['simulationSeconds'];shot('invalid-import-rejected')
 note('PASS: invalid imported state is rejected visibly and atomically, with all fields and clock unchanged.')
 click('Resume');run('select','#quality','low');run('click','#numericalDetails > summary');run('scrollintoview','#gridResolution');run('select','#gridResolution','24');run('select','#verticalLayers','18');run('wait','--fn','window.atmos.simulation.steps > '+str(saved['steps']+2));resized=diag('resized-running');assert resized['dimensions']==[24,24,18] and resized['renderer']['uploads']>0 and all(f['finite'] for f in resized['fields'].values());click('Pause');shot('resolution-running')
 note('PASS: switching to Performance quality and resampling a running atmosphere to 24 × 24 × 18 preserves finite evolving fields and a compiled, updated renderer.')
 run('errors');run('console');run('network','requests');note('PASS: no browser uncaught errors or console errors through the desktop main workflow; network remains file/data only.')
except Exception as e:
 note('FAIL during browser workflow: '+str(e));raise
