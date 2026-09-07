import subprocess,json,time,math,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parent
LOG=ROOT/'logs'/'browser-actions.txt'
RESULTS=[]
def ab(*args,stdin=None):
    p=subprocess.run(['agent-browser','--session','softlab',*map(str,args)],input=stdin,text=True,capture_output=True)
    logged=p.stdout
    if stdin=='softlab.inspect()' and p.returncode==0:
        st=json.loads(p.stdout); logged=json.dumps({k:st[k] for k in ['scenario','paused','mode','tool','pending','frames','stats','camera','bodies']})+'\n[Full particle/constraint arrays used for assertions; omitted from action log.]\n'
    with LOG.open('a') as f:f.write('$ agent-browser --session softlab '+' '.join(map(str,args))+('\n'+stdin if stdin else '')+'\n'+logged+p.stderr+'\n')
    if p.returncode:raise RuntimeError(p.stdout+p.stderr)
    return p.stdout.strip()
def js(code):return json.loads(ab('eval','--stdin',stdin=code))
def state():return js('softlab.inspect()')
def click(name):ab('find','role','button','click','--name',name,'--exact')
def snap(name):ab('screenshot',str(ROOT/'screenshots'/name))
def coords(x,y):
    r=js("(()=>{const r=document.getElementById('world').getBoundingClientRect();return {x:r.x,y:r.y,c:softlab.inspect().camera}})()")
    return round(r['x']+r['c']['x']+x*r['c']['s']),round(r['y']+r['c']['y']+y*r['c']['s'])
def move(x,y):ab('mouse','move',*coords(x,y))
def pointclick(p):move(p['x'],p['y']);ab('mouse','down');ab('mouse','up')
def drag(p,dx,dy,steps=8):
    move(p['x'],p['y']);ab('mouse','down')
    for i in range(1,steps+1):move(p['x']+dx*i/steps,p['y']+dy*i/steps)
    return state()
def release():ab('mouse','up')
def ensurepause():
    if not state()['paused']:click('Pause simulation')
def runframes(n):
    start=state()['frames']
    if state()['paused']:click('Resume simulation')
    ab('wait','--fn',f'softlab.metrics.frames >= {start+n}')
    click('Pause simulation');return state()
def setrange(id,home,arrows=0):
    ab('focus','#'+id);ab('press','Home' if home else 'End')
    for i in range(arrows):ab('press','ArrowRight' if home else 'ArrowLeft')
def test(name,fn):
    try:
        details=fn();RESULTS.append({'name':name,'status':'pass','observed':details});print('PASS',name,json.dumps(details),flush=True)
    except Exception as e:
        RESULTS.append({'name':name,'status':'fail','error':str(e)});print('FAIL',name,str(e),flush=True)
        try:snap('failure-'+str(len(RESULTS))+'.png');release()
        except:pass
    (ROOT/'logs'/'browser-results.json').write_text(json.dumps(RESULTS,indent=2))

def pause_step_views():
    ensurepause();s=state();ab('wait','--fn',f'softlab.inspect().paused === true');assert state()['frames']==s['frames']
    click('Single step');t=state();assert t['frames']==s['frames']+1;assert abs(t['time']-s['time']-s['settings']['timestep']/1000)<1e-8
    before=[(p['x'],p['y']) for p in t['particles']]
    for mode in ['constraints','stress','particles','velocity','contacts','pins','cells','material']:
        ab('select','#view-mode',mode);u=state();assert u['mode']==mode;assert before==[(p['x'],p['y']) for p in u['particles']]
    return {'pausedFrame':s['frames'],'singleStepFrame':t['frames'],'viewsPreservedState':8}
def pin_unpin():
    click('Reset scene');p=state()['particles'][200];click('Pin / unpin (P)');before=state()['stats']['pins'];pointclick(p);s=state();assert s['particles'][p['id']]['pin'];assert s['stats']['pins']==before+1
    snap('02-pin.png');pointclick(s['particles'][p['id']]);t=state();assert not t['particles'][p['id']]['pin'];assert t['stats']['pins']==before
    return {'point':p['id'],'pins':[before,s['stats']['pins'],t['stats']['pins']]}
def grab_flow():
    click('Grab & drag (G)');s=state();p=s['particles'][250];t=drag(p,150,85,12);snap('03-grab-deformation.png');assert t['drag'] is not None;assert t['selected']==p['id'];release();u=state();d=math.dist((p['x'],p['y']),(u['particles'][p['id']]['x'],u['particles'][p['id']]['y']));assert d>80
    neighbors=sum(math.dist((a['x'],a['y']),(b['x'],b['y']))>5 for a,b in zip(s['particles'],u['particles']) if a['body']==p['body']);assert neighbors>10;assert u['drag'] is None
    return {'grabbedDisplacement':d,'otherClothPointsMoved':neighbors,'captureReleased':True}
def cut_flow():
    click('Reset scene');click('Cut constraints (C)');s=state();move(300,87);ab('mouse','down');move(300,341);release();t=state();removed=s['stats']['constraints']-t['stats']['constraints'];assert removed>25;ab('select','#view-mode','constraints');snap('04-cut-graph.png');click('Single step');u=state();assert u['stats']['constraints']<=t['stats']['constraints'];ab('select','#view-mode','material');snap('05-cut-surface.png')
    return {'before':s['stats']['constraints'],'after':t['stats']['constraints'],'removed':removed,'afterStep':u['stats']['constraints']}
def tear_flow():
    click('Reset scene');ab('click','#tab-material');setrange('tearThreshold',True,8);ab('uncheck','#autoTear');ab('select','#view-mode','stress');click('Pull & tear (T)');s=state();p=s['particles'][250];t=drag(p,210,135,14);release();snap('06-tear-stress.png');u=state();assert u['stats']['tears']>0;assert u['stats']['constraints']<s['stats']['constraints'];ab('check','#autoTear');return {'threshold':u['settings']['tearThreshold'],'tears':u['stats']['tears'],'remaining':u['stats']['constraints'],'maxError':u['stats']['maxError']}
def settings_flow():
    click('Reset scene');ab('click','#tab-solver');setrange('iterations',True,2);setrange('substeps',True,1);ab('click','#tab-material');setrange('stiffness',True,20);setrange('bending',True,15);setrange('pressure',True,12);ab('click','#tab-world');setrange('wind',False,6);s=state();assert s['settings']['iterations']==4;assert s['settings']['substeps']==2;assert abs(s['settings']['stiffness']-.25)<1e-8;assert s['settings']['wind']==17
    t=runframes(45);snap('07-tuned-stress.png');assert all(math.isfinite(p['x']) and math.isfinite(p['y']) for p in t['particles']);motion=max(math.dist((a['x'],a['y']),(b['x'],b['y'])) for a,b in zip(s['particles'],t['particles']));assert motion>5
    return {'settings':t['settings'],'motion':motion,'strainBefore':s['stats']['maxError'],'strainAfter':t['stats']['maxError'],'stats':t['stats']}
def spawn_flow():
    click('Restore default settings');click('Reset scene');ab('select','#view-mode','material');click('Grab & drag (G)');s=state();types=[('soft body','soft',580,160),('ball','ball',582,82),('balloon','balloon',700,225),('rope','rope',387,395),('cloth','cloth',890,175),('obstacle','obstacle',737,542)]
    for label,kind,x,y in types:
        click('Add object');ab('snapshot','-i');click('Spawn '+label);assert state()['pending']==kind;move(x,y);ab('mouse','down');ab('mouse','up');assert state()['pending'] is None
    t=state();assert len(t['bodies'])==len(s['bodies'])+5;assert len(t['obstacles'])==len(s['obstacles'])+1
    u=runframes(80);ab('select','#view-mode','contacts');snap('08-spawn-collisions.png');assert u['stats']['contacts']>0;assert all(math.isfinite(p['x']) and math.isfinite(p['y']) for p in u['particles']);return {'newTypes':[t[1] for t in types],'particleCount':u['stats']['particles'],'contacts':u['stats']['contacts'],'bodyCount':len(u['bodies']),'stats':u['stats']}
def force_wind():
    click('Restore default settings');click('Reset scene');click('Apply impulse (F)');s=state();p=s['particles'][278];pointclick(p);t=state();delta=max(math.hypot(p['vx'],p['vy']) for p in t['particles']);assert delta>50;click('Wind gust (W)');p=t['particles'][284];move(p['x']-15,p['y']);ab('mouse','down');move(p['x']+40,p['y']-30);release();u=runframes(25);assert u['time']>s['time'];snap('09-impulse-wind.png');return {'maximumImpulseVelocity':delta,'afterGustStats':u['stats']}

if __name__=='__main__':
    test('Pause, single-step and all diagnostic views',pause_step_views)
    test('Real pointer pin and unpin',pin_unpin)
    test('Captured pointer grab deforms connected cloth',grab_flow)
    test('One fast swept cut permanently changes graph and surface',cut_flow)
    test('Real pointer tear with low threshold in stress view',tear_flow)
    test('Keyboard-adjusted solver, stiffness, bending, pressure and wind',settings_flow)
    test('Spawn six object types, simulate deformation and contacts',spawn_flow)
    test('Real pointer impulse and directional wind gust',force_wind)
    print(json.dumps(RESULTS,indent=2))
