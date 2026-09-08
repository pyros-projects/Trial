import subprocess,json,time,pathlib,shlex,sys
root=pathlib.Path(__file__).resolve().parent
log=(root/'logs/browser-flows.log').open('a',buffering=1)
results=json.loads((root/'logs/browser-results.json').read_text())
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
 # Quality and grid changes while solver is running.
 if diag('continued-start')['paused']:button('Resume simulation')
 button('Open settings');run('snapshot','-i');run('select','#qualitySelect','low');run('select','#resolutionSelect','24');run('select','#layersSelect','8');run('check','#vectorsToggle');run('check','#audioToggle');qa=diag('quality-running')
 check('quality-grid-live',qa['dimensions']==[24,24,8] and qa['settings']['cloudQuality']==32 and not qa['paused'],qa['render'])
 check('audio-user-gesture',qa['audio']['enabled'] and qa['audio']['state']=='running',qa['audio'])
 button('Close settings');button('Trigger lightning');run('wait','--fn','weatherLab.diagnostics().audio.events > 0');audio=diag('thunder-dispatched')
 check('thunder-synthesized',audio['audio']['events']>0,audio['audio'])
 button('Pause simulation');button('Section');shot('section-vectors');button('3D view')
 button('Open settings');run('download','#exportPng',str(root/'exported-view.png'));run('download','#exportCsv',str(root/'exported-probe.csv'));button('Close settings')
 check('png-csv-downloads',(root/'exported-view.png').stat().st_size>1000 and len((root/'exported-probe.csv').read_text().splitlines())>1)

 print('REMAINING MAIN FLOWS FINISHED',flush=True)
except Exception as e:
 log.write('FAILURE: '+repr(e)+'\n');print('FAILED:',repr(e),flush=True);sys.exit(1)
