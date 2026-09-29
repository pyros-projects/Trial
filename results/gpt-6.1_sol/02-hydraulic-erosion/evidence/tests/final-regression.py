import subprocess,json,pathlib,time
root=pathlib.Path(__file__).resolve().parents[2];log=(root/'evidence/logs/final-regression.log').open('w');results=[]
def run(*a,js=None):
    cmd=['agent-browser','--session','strata',*map(str,a)];log.write('$ '+' '.join(cmd)+'\n');log.flush();r=subprocess.run(cmd,input=js,text=True,capture_output=True);log.write(r.stdout+r.stderr+'\n');log.flush();assert r.returncode==0,r.stderr;return r.stdout.strip()
def ev(js):return json.loads(run('eval','--stdin',js=js))
def diag():return ev('window.strata.diagnostics()')
def check(name,condition,detail=None):
    results.append({'name':name,'status':'pass' if condition else 'fail','observed':detail});print(('PASS ' if condition else 'FAIL ')+name,flush=True);(root/'evidence/logs/final-regression-results.json').write_text(json.dumps(results,indent=2));assert condition,name
if not diag()['paused']:run('click','#pause')
run('select','#mode','0');run('click','#home');run('find','role','button','click','--name','Add water','--exact');run('focus','#radius');run('press','Home');run('focus','#strength');run('press','Home');p=ev('window.strata.project(-1,2)');start=diag();camera=ev('window.strata.camera');run('mouse','move',round(p['x']),round(p['y']));run('mouse','down');time.sleep(.3);small=diag();run('focus','#radius');run('press','End');run('focus','#strength');run('press','End');time.sleep(.4);large=diag();run('mouse','up');check('Brush radius and strength update during a held pointer stroke',large['water']-small['water']>(small['water']-start['water'])*4 and large['water']>small['water']+.1,{'smallBrushAdded':small['water']-start['water'],'largeBrushAdded':large['water']-small['water']});check('Editing drag preserves camera state',ev('window.strata.camera')==camera)
# Modifiers route the same editing tool to camera movement, with no injection.
p=ev('window.strata.project(0,2)');before=diag();camera=ev('window.strata.camera');run('focus','#viewport');run('press','Alt');run('mouse','move',round(p['x']),round(p['y']));
# A true held modifier uses keyboard down/up via CDP; CLI press sends a tap.
# Reuse native wheel coverage for precise native input; test right-drag here.
run('mouse','down','right');run('mouse','move',round(p['x']+35),round(p['y']+20));run('mouse','up','right');check('Camera pan in an editing tool preserves water and terrain',diag()['waterChecksum']==before['waterChecksum'] and diag()['heightChecksum']==before['heightChecksum'] and ev('window.strata.camera')['target']!=camera['target'])
run('click','#home');run('click','#reset');run('click','#step');check('Reset and step still work after editing and camera changes',diag()['steps']==1 and diag()['paused'],diag())
run('click','#pause');run('select','#resolution','192');run('select','#substeps','12');run('focus','#speed');run('press','End');run('wait','--fn','window.strata.diagnostics().time > 1');run('click','#pause');high=diag();check('Maximum resolution and substeps run with bounded live diagnostics',high['n']==192 and high['recoveries']==0 and high['glError']==0 and high['water']>0,high);run('select','#resolution','96');check('Downsampling preserves water and sediment volumes',abs(diag()['water']-high['water'])<.0001 and abs(diag()['sediment']-high['sediment'])<.0001,{'before':high,'after':diag()})
run('screenshot',root/'evidence/screenshots/max-resolution-regression.png');run('console');run('errors');print('Compact regression complete',flush=True)
