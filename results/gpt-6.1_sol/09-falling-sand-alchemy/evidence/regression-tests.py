import subprocess, json, time, sys, pathlib, shlex, traceback
ROOT=pathlib.Path.cwd(); E=ROOT/'evidence'; LOG=(E/'logs/regression-transcript.txt').open('w')
SESSION='materia'
results=[]
def run(*args,timeout=40):
    cmd=['agent-browser','--session',SESSION,*map(str,args)]
    LOG.write('$ '+shlex.join(cmd)+'\n');LOG.flush()
    p=subprocess.run(cmd,text=True,capture_output=True,timeout=timeout)
    LOG.write(p.stdout+p.stderr);LOG.flush()
    if p.returncode:raise RuntimeError('Command failed: '+shlex.join(cmd)+'\n'+p.stdout+p.stderr)
    return p.stdout.strip()
def js(code):
    out=json.loads(run('eval','--json',code))
    if not out.get('success'):raise RuntimeError(out)
    return out['data']['result']
def state():return js('lab.state')
def snap(name):run('screenshot',str(E/'screenshots'/name))
def check(name,fn):
    started=time.monotonic()
    try:
        data=fn();results.append({'check':name,'status':'pass','seconds':round(time.monotonic()-started,2),'observed':data});print('PASS '+name+' '+json.dumps(data),flush=True)
    except Exception as e:
        results.append({'check':name,'status':'fail','seconds':round(time.monotonic()-started,2),'error':str(e)});print('FAIL '+name+' '+str(e),flush=True);snap('regression-failure-'+str(len(results))+'.png')
    (E/'logs/regression-results.json').write_text(json.dumps(results,indent=2))
def click(id):return run('click','#'+id)
def material(name):run('find','role','button','click','--name','Select '+name)
def tool(name):run('click','[data-tool="'+name+'"]')
def pause():
    if not state()['paused']:click('pauseBtn')
def clear():pause();click('clearBtn')
def steps(n):
    for _ in range(n):click('stepBtn')
def range_key(id,start='Home',count=0):
    run('focus','#'+id);run('press',start)
    for _ in range(count):run('press','ArrowRight')
def box():return js('document.getElementById("world").getBoundingClientRect().toJSON()')
def point(x,y):
    b=box();dim=js('({w:lab.world.w,h:lab.world.h})');return [round(b['x']+(x+.5)/dim['w']*b['width']),round(b['y']+(y+.5)/dim['h']*b['height'])]
def stroke(points,button='left'):
    p=point(*points[0]);run('mouse','move',*p);run('mouse','down',button)
    for xy in points[1:]:run('mouse','move',*point(*xy))
    run('mouse','up',button)
def paintpoint(x,y):stroke([(x,y)])
def signature():
    return js('(()=>{let hash=2166136261;for(const k of Alchemy.World.fields){const a=new Uint8Array(lab.world[k].buffer);for(const v of a)hash=Math.imul(hash^v,16777619);}return {hash:hash>>>0,rng:lab.world.rng,steps:lab.world.steps,seed:lab.world.seed,w:lab.world.w,h:lab.world.h,sources:lab.world.sources,settings:lab.world.settings};})()')

def compact_regression():
    run('scrollintoview','#shapes');run('wait','--fn','document.getElementById("inspector").scrollTop<5')
    run('select','#presetSelect','volcano');pause();click('resetBtn');material('Sand');tool('paint');run('find','role','button','click','--name','Circle brush');range_key('radius','Home',5);range_key('amount','Home',64)
    if not js('document.getElementById("advancedBrush").open'):run('click','#advancedBrush > summary')
    range_key('brushVX','Home',16);range_key('brushVY','Home',16);range_key('spray','Home',15);run('focus','#replace');
    if state()['brush']['replace']:run('press','Space')
    original=signature();old_steps=state()['stats']['steps'];steps(1);assert state()['stats']['steps']==old_steps+1
    run('select','#view','temperature');time.sleep(.05);snap('31-final-temperature-world.png');run('select','#view','normal');click('resetBtn');assert signature()==original
    # Actual controlled preset playback, then inspect the rendered desktop and mobile view.
    click('pauseBtn');run('wait','--fn','lab.world.steps>50');run('mouse','move',1150,60)
    if js('document.getElementById("advancedBrush").open'):run('click','#advancedBrush > summary')
    if js('document.getElementById("physicsSettings").open'):run('click','#physicsSettings > summary')
    if js('document.getElementById("storageSettings").open'):run('click','#storageSettings > summary')
    run('set','viewport',1440,960,1);run('scrollintoview','#sceneName');run('wait','--fn','!document.getElementById("toast").classList.contains("show")');snap('32-final-desktop.png')
    run('scrollintoview','#presetSelect');snap('33-desktop-presets.png');run('scrollintoview','#sceneName')
    run('set','viewport',390,844,2);run('wait','--fn','document.getElementById("palette").inert');snap('34-final-mobile.png');run('scroll','down',200);snap('35-mobile-status-footer.png');run('scroll','up',200)
    run('set','viewport',1280,800,1);run('scrollintoview','#sceneName');assert not js('document.getElementById("palette").inert')
    errors=run('errors');console=run('console');requests=run('network','requests');(E/'logs/final-errors.txt').write_text(errors);(E/'logs/final-console.txt').write_text(console);(E/'logs/final-requests.txt').write_text(requests)
    assert not errors and not console;assert 'http://' not in requests and 'https://' not in requests
    return {'seeded_reset_exact':True,'single_step_exact':True,'desktop_and_mobile_live':True,'console_errors':0,'uncaught_errors':0,'external_requests':0,'live_cells':state()['stats']['active']}
check('Final regression, clean offline runtime, and live desktop/narrow screenshots',compact_regression)

print('Final regression finished',flush=True)
