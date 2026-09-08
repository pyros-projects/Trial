import subprocess,json,time,pathlib,shlex,sys
root=pathlib.Path(__file__).resolve().parent
log=(root/'logs/browser-flows.log').open('a',buffering=1)
results={}
def run(*args):
 cmd=['agent-browser','--session','weather',*map(str,args)]
 log.write('$ '+shlex.join(cmd)+'\n');p=subprocess.run(cmd,text=True,capture_output=True,timeout=45)
 log.write(p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError('Command failed: '+shlex.join(cmd)+' '+p.stdout+p.stderr)
 return p.stdout

def js(code):return json.loads(run('--json','eval',code))['data']['result']
def diag(name):
 d=js('weatherLab.diagnostics()');(root/'logs'/f'{name}.json').write_text(json.dumps(d,indent=2));return d

def button(name):return run('find','role','button','click','--name',name)
def shot(name):run('screenshot',str(root/'screenshots'/f'{name}.png'))
def check(name,ok,details=''):
 results[name]={'status':'pass' if ok else 'fail','details':details};print(name,results[name],flush=True)
 (root/'logs/browser-results.json').write_text(json.dumps(results,indent=2))
 if not ok:shot('FAIL-'+name);raise AssertionError(name+' '+str(details))
def drag(points):
 run('mouse','move',*points[0]);run('mouse','down','left')
 for p in points[1:]:run('mouse','move',*p)
 run('mouse','up','left')
try:
 run('snapshot','-i')
 if not diag('flow-start')['paused']:button('Pause simulation')
 button('Reset simulation');a=diag('reset-initial')
 time.sleep(1.2);b=diag('pause-stable')
 check('pause',a['steps']==b['steps'] and a['fields']==b['fields'],{'time':b['time']})
 button('Advance one simulation step');c=diag('single-step')
 check('single-step',c['steps']==a['steps']+1 and c['time']==a['time']+3 and c['paused'],{'time':c['time'],'steps':c['steps']})
 button('Reset simulation');d=diag('reset-repeat')
 check('same-seed-reset',a['fields']==d['fields'],{'seed':js('weatherLab.simulation.seed')})
 button('Resume simulation');run('wait','--fn','weatherLab.diagnostics().time >= 150');button('Pause simulation');e=diag('storm-evolved')
 changed=[k for k in a['fields'] if a['fields'][k]['checksum']!=e['fields'][k]['checksum']]
 check('coupled-field-evolution',len(changed)==8 and e['stats']['finite'] and e['stats']['precipTotal']>0,{'changed':changed,'time':e['time'],'stats':e['stats']})
 shot('desktop-storm-evolved')
 # Real orbit drag, wheel zoom, and right-button pan.
 ca=e['camera'];drag([(800,420),(838,428),(885,442)]);orbit=diag('camera-orbit')
 run('mouse','move',800,430);log.write('$ node evidence/cdp-input.cjs wheel 800 430 -180\n');subprocess.run(['node',str(root/'cdp-input.cjs'),'wheel','800','430','-180'],check=True,stdout=log,stderr=log);zoom=diag('camera-zoom')
 run('mouse','down','right');run('mouse','move',830,451);run('mouse','up','right');pan=diag('camera-pan')
 check('camera-orbit-zoom-pan',orbit['camera']['yaw']!=ca['yaw'] and zoom['camera']['distance']<orbit['camera']['distance'] and pan['camera']['target']!=zoom['camera']['target'])
 button('Next cinematic camera');check('cinematic-camera',diag('camera-preset')['camera']['preset']==1)
 button('Map');box=js("(()=>{let r=document.getElementById('weatherCanvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()")
 for value,name in [('1','temperature'),('2','humidity'),('3','cloud-water'),('4','precipitation'),('5','pressure'),('6','wind'),('7','vertical-motion'),('8','vorticity'),('9','terrain'),('10','surface-moisture')]:
  run('select','select[aria-label="Visualization mode"]',value)
  shot('field-'+name);f=diag('field-'+name)
  check('mode-'+name,f['mode']!='Cinematic' and f['ready'],{'mode':f['mode']})
 run('select','#modeSelect','2');button('Place probe')
 x=round(box['x']+box['w']/2-40);y=round(box['y']+box['h']/2+20)
 run('mouse','move',x,y);run('mouse','down','left');run('mouse','up','left');p=diag('probe-placed')
 check('probe-placement',p['probe']['id']>1 and p['probe']['x']!=a['probe']['x'],p['probe'])
 button('Inspect vertical probe column');run('snapshot','-i');shot('probe-column');button('Close probe')
 button('Section');shot('vertical-section');check('vertical-section',diag('section')['view']==2)
 button('Map');run('select','#modeSelect','0')
 # Store untreated complete state through actual download control.
 run('download','#saveState',str(root/'control-state.json'));pre=diag('before-brushes')
 for name,tag,points in [
  ('Add heat','heat',[(x-25,y),(x-10,y+6),(x+10,y+10),(x+28,y+3)]),
  ('Inject moisture','moisture',[(x-25,y),(x-10,y+6),(x+10,y+10),(x+28,y+3)]),
  ('Wind impulse','wind',[(x-25,y),(x-10,y+6),(x+10,y+10),(x+28,y+3)])]:
  button(name);drag(points);after=diag('after-'+tag)
  key={'heat':'t','moisture':'q','wind':'u'}[tag]
  check('brush-'+tag,after['fields'][key]['checksum']!=pre['fields'][key]['checksum'] and after['input']['activePointers']==0,{'mean':after['fields'][key]['mean'],'strokes':after['input']['brushStrokes']})
 post=diag('after-brushes');check('brushes-paused',post['time']==pre['time'] and post['input']['brushStrokes']>=3)
 run('download','#saveState',str(root/'intervened-state.json'))
 # Delayed response is additionally compared to an untreated identical-state twin outside the browser.
 button('Resume simulation');target=post['time']+120;run('wait','--fn',f'weatherLab.diagnostics().time >= {target}');button('Pause simulation');response=diag('brush-response')
 check('delayed-cloud-rain-response',response['fields']['c']['checksum']!=post['fields']['c']['checksum'] and response['fields']['r']['checksum']!=post['fields']['r']['checksum'],{'beforeCloud':post['fields']['c']['mean'],'afterCloud':response['fields']['c']['mean'],'beforeRain':post['fields']['r']['mean'],'afterRain':response['fields']['r']['mean']})
 shot('brush-response-map')
 button('3D view');run('record','start',str(root/'lightning-repro.webm'));button('Trigger lightning');shot('manual-lightning');run('record','stop');ld=diag('lightning')
 check('manual-lightning',ld['lightning']['manual']>=1 and ld['ready'],ld['lightning'])
 # Quality and grid changes while solver is running.
 button('Resume simulation');button('Open settings');run('snapshot','-i');run('select','#qualitySelect','low');run('select','#resolutionSelect','24');run('select','#layersSelect','8');run('check','#vectorsToggle');run('check','#audioToggle');qa=diag('quality-running')
 check('quality-grid-live',qa['dimensions']==[24,24,8] and qa['settings']['cloudQuality']==32 and not qa['paused'],qa['render'])
 check('audio-user-gesture',qa['audio']['enabled'] and qa['audio']['state']=='running',qa['audio'])
 button('Close settings');button('Trigger lightning');run('wait','--fn','weatherLab.diagnostics().audio.events > 0');audio=diag('thunder-dispatched')
 check('thunder-synthesized',audio['audio']['events']>0,audio['audio'])
 button('Pause simulation');button('Section');shot('section-vectors');button('3D view')
 button('Open settings');run('download','#exportPng',str(root/'exported-view.png'));run('download','#exportCsv',str(root/'exported-probe.csv'));button('Close settings')
 check('png-csv-downloads',(root/'exported-view.png').stat().st_size>1000 and len((root/'exported-probe.csv').read_text().splitlines())>1)
 print('MAIN FLOWS FINISHED',flush=True)
except Exception as e:
 log.write('FAILURE: '+repr(e)+'\n');print('FAILED:',repr(e),flush=True);sys.exit(1)
