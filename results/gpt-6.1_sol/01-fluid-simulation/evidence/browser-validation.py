"""Development-only real-browser workflow. All interaction uses agent-browser.
Read-only eval inspects actual simulation fields, never manufactures state.
Run: python3 evidence/browser-validation.py core|modes|controls|materials|mobile
"""
import json, math, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SESSION = 'fluid-study'
RESULTS = {}

def ab(*args, stdin=None):
    command = ['agent-browser', '--session', SESSION, *map(str,args)]
    started = time.monotonic()
    p = subprocess.run(command,input=stdin,text=True,capture_output=True,timeout=40)
    with (ROOT/'logs'/'browser-commands.jsonl').open('a') as log:
        log.write(json.dumps({'command':command,'stdin':stdin,'code':p.returncode,'seconds':round(time.monotonic()-started,3),'stdout':p.stdout,'stderr':p.stderr})+'\n')
    if p.returncode or p.stdout.lstrip().startswith('✗'):
        raise RuntimeError(f'{command}: {p.stdout} {p.stderr}')
    return p.stdout

def js(expression):
    return json.loads(ab('eval',expression))

def fields():
    value=js('fluidLab.getStats()')
    assert value['finite'] and value.get('glError',0)==0, value
    return value

def state():
    return js('fluidLab.state')

def action(name):
    ab('find','role','button','click','--name',name,'--exact')

def paused(value=True):
    if state()['paused']!=value:
        action('Pause simulation' if value else 'Resume simulation')

def reset():
    action('Reset simulation')

def shot(name):
    ab('screenshot', str(ROOT/'screenshots'/f'{name}.png'))

def range_key(label,key):
    tree=ab('snapshot','-i')
    match=re.search(r'- slider "'+re.escape(label)+r'" \[[^\]]*ref=(e\d+)',tree)
    assert match, f'Labeled slider not in accessibility snapshot: {label}'
    ab('focus','@'+match.group(1))
    ab('press',key)

def wait_seconds_of_simulation(seconds):
    target=state()['simulationTime']+seconds
    ab('wait','--fn',f'fluidLab.state.simulationTime >= {target}')

def drag(points,delay=0):
    # agent-browser 0.31.1 expects integral mouse coordinates.
    points=[tuple(round(v) for v in p) for p in points]
    if delay:
        ab('mouse','move',*points[0]);ab('mouse','down')
        for p in points[1:]:
            time.sleep(delay);ab('mouse','move',*p)
        ab('mouse','up')
    else:
        # Individual commands dispatch real input through the browser.
        ab('mouse','move',*points[0]);ab('mouse','down')
        for p in points[1:]:ab('mouse','move',*p)
        ab('mouse','up')

def check(name,condition,detail):
    RESULTS[name]={'status':'pass' if condition else 'fail','observed':detail}
    print(name,RESULTS[name],flush=True)
    assert condition, f'{name}: {detail}'

def core():
    reset();paused();before=fields();steps=state()['steps']
    time.sleep(.35);after=fields()
    check('pause freezes actual fields',before==after and state()['steps']==steps,{'before':before,'after':after})
    drag([(300,450),(500,450),(680,400)])
    check('paused drags do not change fields',fields()==before,fields())
    action('Clear dye');cleared=fields()
    check('clear dye preserves exact paused velocity',cleared['dyeMass']==0 and cleared['kineticEnergy']==before['kineticEnergy'] and cleared['maxSpeed']==before['maxSpeed'],{'before':before,'after':cleared})
    shot('clear-dye-paused')
    paused(False);wait_seconds_of_simulation(.6)
    check('resume advances existing flow',state()['steps']>steps and fields()['kineticEnergy']>0,{'state':state(),'fields':fields()})
    slow=[(230+i*27,445) for i in range(14)]
    drag(slow,.075);slow_force=state()['input']['lastForce']
    check('slow rightward drag injects rightward force',slow_force[0]>0 and abs(slow_force[1])<.1,slow_force)
    mass=fields()['dyeMass'];wait_seconds_of_simulation(.4)
    check('dye is injected and transported',mass>0 and fields()['dyeMass']>0,{'injectedMass':mass,'advected':fields()})
    action('Apricot dye')
    drag([(680-i*30,490-45*math.sin(i/3)) for i in range(14)])
    fast_force=state()['input']['lastForce']
    check('rapid reversed drag changes direction and speed',fast_force[0]<0 and math.hypot(*fast_force)>math.hypot(*slow_force),{'slow':slow_force,'fast':fast_force})
    action('Lilac dye')
    drag([(450+130*math.cos(i/5),470+120*math.sin(i/5)) for i in range(34)])
    check('continuous strokes are consumed and capture releases',state()['input']['splats']>45 and state()['pointerCount']==0 and state()['queuedSegments']==0,state())
    a=fields();wait_seconds_of_simulation(1.1);b=fields()
    check('flow persists after release and dye advects',b['kineticEnergy']>1 and b['steps']>a['steps'] and math.dist(a['dyeCenter'],b['dyeCenter'])>.0001,{'before':a,'after':b})
    shot('desktop-drag-mixing');paused()
    ab('focus','#fluid');ab('press','Space');wait_seconds_of_simulation(.25);ab('press','Space')
    check('keyboard Space pauses and resumes',state()['paused'],state())
    ab('press','ArrowRight')
    check('arrow keys respect pause',state()['paused'],state())
    paused(False);ab('focus','#fluid');ab('press','ArrowUp');wait_seconds_of_simulation(.1)
    check('arrow keys stir running fluid',fields()['kineticEnergy']>0,state())
    shot('desktop-flow')
    paused()

def modes_run():
    paused(False)
    last=state()['steps']
    for label,mode in [('Velocity','velocity'),('Pressure','pressure'),('Vorticity','curl'),('Divergence','divergence'),('Dye','dye')]:
        action(label);wait_seconds_of_simulation(.2);s=state();f=fields()
        check(f'live {mode} mode',s['mode']==mode and s['steps']>last and f['finite'],{'state':s,'fields':f})
        shot(f'mode-{mode}');last=s['steps']
    paused();a=fields()
    for key,mode in [('2','velocity'),('3','pressure'),('4','curl'),('5','divergence'),('1','dye')]:
        ab('focus','#fluid');ab('press',key)
        check(f'keyboard {mode} switch preserves fields',state()['mode']==mode and fields()==a,fields())

def controls():
    reset();paused();initial=fields()
    for label,key,param,want in [('Force','End','force',3),('Radius','End','radius',.12),('Simulation speed','End','speed',2),('Viscosity','End','viscosity',.003),('Vorticity','End','vorticity',50),('Velocity decay','End','velocityDecay',3),('Dye decay','End','dyeDecay',1),('Pressure iterations','End','pressureIterations',60)]:
        range_key(label,key);value=state()['params'][param]
        check(f'{label} maximum via keyboard',abs(value-want)<1e-6,value)
    ab('scrollintoview','#cycle');ab('check','#cycle')
    ab('scrollintoview','#ambient');ab('check','#ambient')
    check('color cycle and continuous jets can be enabled',state()['cycleColors'] and state()['ambient'],state())
    paused(False);wait_seconds_of_simulation(.4);paused()
    check('all maximum settings remain stable',fields()['finite'],fields())
    action('Clear dye')
    check('clear dye disables jets without resetting velocity',not state()['ambient'] and fields()['dyeMass']==0 and fields()['kineticEnergy']>0,{'state':state(),'fields':fields()})
    paused(False);wait_seconds_of_simulation(.3)
    check('dye stays cleared with no hidden source',fields()['dyeMass']==0,fields())
    reset();paused();s=state()
    check('reset restores valid defaults',s['mode']=='dye' and s['params']['force']==1.2 and s['params']['pressureIterations']==24 and s['params']['speed']==1 and not s['ambient'] and not s['cycleColors'] and fields()['dyeMass']>.07,{'state':s,'fields':fields()})
    for label in ['Force','Radius','Simulation speed','Viscosity','Vorticity','Velocity decay','Dye decay','Pressure iterations']:range_key(label,'Home')
    paused(False);wait_seconds_of_simulation(.25);paused()
    check('all minimum settings remain stable',fields()['finite'],fields())
    reset();paused();original=fields()
    for value in ['128','256','384','192']:
        ab('select','#resolution',value)
        ab('wait','--fn',f'fluidLab.state.height == {value}')
        f=fields()
        check(f'resolution {value} resamples existing dye',f['dyeMass']>0 and math.dist(original['dyeCenter'],f['dyeCenter'])<.005,{'state':state(),'fields':f})
    action('How it works');shot('help-dialog');ab('press','Escape')
    check('help dialog closes with Escape',not js('document.getElementById("help-dialog").open'),state())
    action('Add fresh flow') if not state()['paused'] else None
    reset();shot('desktop-final-seed');paused()

def materials():
    for label in ['Viscosity','Vorticity']:
        samples=[]
        for setting in ['Home','End']:
            reset();paused();range_key('Velocity decay','Home');range_key('Dye decay','Home');range_key(label,setting)
            paused(False);wait_seconds_of_simulation(1.8);paused();f=fields();samples.append(f);shot(f'{label.lower()}-{setting.lower()}')
        if label=='Viscosity':
            condition=samples[1]['kineticEnergy']<samples[0]['kineticEnergy']*.8
        else:
            condition=abs(samples[1]['meanCurl']-samples[0]['meanCurl'])>.05
        check(f'{label} changes actual fluid behavior',condition,{'minimum':samples[0],'maximum':samples[1]})
    reset();paused()

def mobile():
    reset();paused();a=fields()
    ab('set','viewport',390,844)
    ab('wait','--fn','fluidLab.state.canvasWidth < 400')
    s=state();bounds=js('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canvas:document.getElementById("fluid").getBoundingClientRect().toJSON()})')
    check('390 by 844 layout has no horizontal overflow',bounds['scrollWidth']==390 and bounds['canvas']['height']>400,bounds)
    check('resize preserves dye and finite state',fields()['dyeMass']>0 and math.dist(a['dyeCenter'],fields()['dyeCenter'])<.01,{'state':s,'fields':fields()})
    shot('mobile-top')
    paused(False);drag([(85,430),(145,470),(240,420),(300,510)])
    check('narrow-screen pointer workflow works',state()['pointerCount']==0 and fields()['dyeMass']>0,state())
    action('Velocity');wait_seconds_of_simulation(.15);shot('mobile-velocity');action('Dye')
    ab('scroll','down',660);ab('snapshot','-i');shot('mobile-controls')
    range_key('Viscosity','End');check('narrow controls accept keyboard input',state()['params']['viscosity']==.003,state())
    ab('scroll','up',2000);paused();ab('set','viewport',1280,800,2)
    ab('wait','--fn','fluidLab.state.canvasWidth > 1500')
    s=state();rect=js('document.getElementById("fluid").getBoundingClientRect().toJSON()')
    check('high DPI uses a double-resolution rendering surface',s['canvasWidth']==round(rect['width']*2) and s['canvasHeight']==round(rect['height']*2) and s['dpr']==2,{'state':s,'rect':rect})
    shot('desktop-high-dpi');ab('set','viewport',1280,800,1)
    action('Reset simulation');paused()

if __name__=='__main__':
    task=sys.argv[1]
    try:
        {'core':core,'modes':modes_run,'controls':controls,'materials':materials,'mobile':mobile}[task]()
    finally:
        (ROOT/'logs'/f'browser-{task}.json').write_text(json.dumps(RESULTS,indent=2))
