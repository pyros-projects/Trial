import subprocess,re,json,pathlib,shlex,os
ROOT=pathlib.Path(__file__).resolve().parent

def run(*a):
 c=['agent-browser','--session',os.getenv('OPAQUE_TEST_SESSION','opaque'),*map(str,a)];p=subprocess.run(c,text=True,capture_output=True,timeout=40)
 with (ROOT/'opaque-commands.log').open('a') as f:f.write(shlex.join(c)+'\n'+p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return p.stdout

def ref(name,role='button'):
 s=run('snapshot','-i');m=re.search(r'- '+role+r' "'+re.escape(name)+r'" \[[^\]]*ref=(e\d+)',s)
 if not m:raise RuntimeError('Missing '+name+'\n'+s)
 return '@'+m.group(1)
def click(name):run('click',ref(name))
def field(name,value,role='textbox'):run('fill',ref(name,role),str(value));run('press','Enter')
def diag(expr='studioDiagnostics'):
 return json.loads(subprocess.check_output(['node',str(ROOT/'iframe-diagnostics.cjs'),expr],text=True))
run('open','http://127.0.0.1:8765/evidence/sandbox.html');run('set','viewport',1280,800,1);run('frame','main');
if 'button "Close dialog"' in run('snapshot','-i'):click('Close dialog')
click('Reset');click('Select layer Lavender gesture');field('Fill color','#a0b5c8');assert diag()['document']['items'][7]['style']['fill']=='#a0b5c8'
click('Open export dialog')
files={}
for selector in ['#downloadProject','#downloadPNG']:
    output=subprocess.check_output(['node',str(ROOT/'opaque-native-download.cjs'),selector,str(ROOT/'downloads'/'opaque')],text=True)
    with (ROOT/'opaque-commands.log').open('a') as f:f.write('Supplemental CDP native download '+selector+'\n'+output+'\n')
    assert '"state":"completed"' in output
    events=[json.loads(line) for line in output.splitlines() if line.startswith('{"method"')];files[selector]=next(e['params']['filePath'] for e in events if e['method']=='Browser.downloadProgress' and e['params']['state']=='completed')
(ROOT/'opaque-files.json').write_text(json.dumps(files,indent=2))
click('Close dialog')
click('New');click('Rectangle tool');run('mouse','move',380,300);run('mouse','down');run('mouse','move',490,365);run('mouse','up');assert diag()['counts']['items']==1
field('Position X',100,'spinbutton');assert abs(diag()['bounds']['x']-100)<1e-8
subprocess.check_call(['node',str(ROOT/'iframe-upload.cjs'),files['#downloadProject']]);s=diag();assert s['counts']['items']==17 and s['history']['undo']==0
click('Cubic path tool');run('mouse','move',490,420);run('mouse','down');run('mouse','up');assert diag()['pendingPath']==1
click('Reset');s=diag('({origin:self.origin,state:studioDiagnostics,storage:(()=>{try{return localStorage.length}catch(e){return e.name}})()})');assert s['origin']=='null' and s['storage']=='SecurityError' and s['state']['history']['undo']==0
(ROOT/'opaque-final.json').write_text(json.dumps(s,indent=2));run('screenshot',str(ROOT/'screenshots'/'17-opaque-tested.png'))
(ROOT/'opaque-console.json').write_text(run('console','--json'));errors=run('errors','--json');(ROOT/'opaque-errors.json').write_text(errors);assert not json.loads(errors)['data']['errors'];(ROOT/'opaque-network.json').write_text(run('network','requests','--json'))
print('PASS opaque-origin edit, drag/numeric geometry, JSON/PNG downloads, Reset, denied storage, zero uncaught errors')
