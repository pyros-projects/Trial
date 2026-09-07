import subprocess,json,math,pathlib,shlex,sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
SESSION='orbital-file'
LOG=ROOT/'evidence/logs/browser-regression.txt'
log=LOG.open('a')
def run(*args):
    if len(args)>1 and args[0]=='mouse' and args[1]=='move':args=(*args[:2],*(round(float(a)) for a in args[2:]))
    cmd=['agent-browser','--session',SESSION,*map(str,args)]
    result=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=40)
    log.write('$ '+shlex.join(cmd)+'\n'+result.stdout+result.stderr+'\n');log.flush()
    if result.returncode: raise RuntimeError(result.stderr or result.stdout)
    return result.stdout.strip()
def ev(code):return json.loads(run('eval',code))
def snap():return ev('OrbitalApp.getSnapshot()')
def click(name):run('find','role','button','click','--name',name)
def fill(label,value):run('find','label',label,'fill',str(value));run('press','Tab')
def check(ok,message):
    result=('PASS' if ok else 'FAIL')+': '+message
    print(result,flush=True);log.write(result+'\n');log.flush()
    if not ok:raise AssertionError(message)
def shot(name):run('screenshot',f'evidence/screenshots/{name}.png')
def ready():run('wait','--fn','!OrbitalApp.getSnapshot().predictionBusy && OrbitalApp.getSnapshot().prediction !== null')
def scenario(key):
    click('Choose scenario');run('snapshot','-i');run('scrollintoview',f'[data-scenario="{key}"]');run('click',f'[data-scenario="{key}"]');click('Pause simulation');click('Restart scenario');ready()
def fresh():
    n=snap()['render']['frameNumber'];run('wait','--fn',f'OrbitalApp.getSnapshot().render.frameNumber>{n+1}')
def cdp(kind,*args):
    ev('window.__orbitalHarnessTarget="orbital-file";true')
    url=run('get','cdp-url')
    cmd=['node','evidence/cdp-input.cjs',url,'active',kind,*map(str,args)]
    r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=15)
    log.write('$ '+shlex.join(cmd)+'\n'+r.stdout+r.stderr);log.flush()
    if r.returncode:raise RuntimeError(r.stderr)
def phase_main():
    scenario('circular');s0=snap();check(s0['paused'] and s0['state']['time']==0,'restart pauses at exact T+0')
    run('wait','200');check(snap()['state']['time']==0,'paused state does not advance')
    click('Single integration step');s1=snap();check(abs(s1['state']['time']-.04)<1e-10 and s1['paused'],'single-step advances exactly configured dt')
    click('Play simulation');run('wait','--fn','OrbitalApp.getSnapshot().state.time>3');click('Pause simulation');s2=snap()
    a={b['id']:b for b in s0['state']['bodies']};b={b['id']:b for b in s2['state']['bodies']}
    check(all(math.hypot(a[k]['x']-b[k]['x'],a[k]['y']-b[k]['y'])>.0001 for k in a),'star, planet, moon and spacecraft all move numerically')
    check(abs(s2['conservation']['energy'])<1e-5 and s2['conservation']['momentum']<1e-6,'live conservation errors remain small')
    shot('desktop-active-workflow-1280')
    click('Save checkpoint');t=s2['state']['time'];click('Single integration step');click('Restore checkpoint');check(abs(snap()['state']['time']-t)<1e-10,'checkpoint restores exact saved time and state')
    click('Restart scenario');ready();before=snap();click('Add maneuver');ready();new=snap()
    check(len(new['state']['nodes'])==1 and new['paused'],'Add maneuver creates a scheduled burn and pauses')
    check(abs(new['prediction']['signature']-before['prediction']['signature'])>1,'prediction changes immediately before any actual burn')
    fill('Burn at · mission time','.08');fill('Prograde Δv','.25');fill('Radial Δv','.05');ready();planned=snap()
    check(planned['state']['time']==0 and not planned['state']['nodes'][0]['executed'],'editing plan leaves live state before burn unchanged')
    # A counterfactual integration is diagnostic only: clone actual state, remove nodes, use delivered engine.
    expected=ev('(()=>{const s=OrbitalApp.getSnapshot();const b=Orbital.clone(s.state);b.nodes=[];Orbital.advance(b,.08,s.cfg);return b.bodies.find(q=>q.id==="odyssey")})()')
    click('Single integration step');check(not snap()['state']['nodes'][0]['executed'],'node does not execute before scheduled time')
    click('Single integration step');burned=snap();events=[e for e in burned['state']['events'] if e['type']=='burn'];craft=next(b for b in burned['state']['bodies'] if b['id']=='odyssey')
    check(len(events)==1 and abs(events[0]['time']-.08)<1e-10,'burn executes once at exact T+0.08')
    impulse=math.hypot(craft['vx']-expected['vx'],craft['vy']-expected['vy'])
    check(impulse>.25 and abs(impulse-events[0]['dv'])<1e-6,'actual velocity differs from unpowered continuation by recorded impulse')
    check(abs(burned['conservation']['energy'])<1e-6,'energy accounting excludes commanded impulse')
    click('Single integration step');check(len([e for e in snap()['state']['events'] if e['type']=='burn'])==1,'scheduled impulse is not applied twice')
    click('Flight log');shot('burn-flight-log');run('snapshot','-i');check('0.08' in run('read'),'executed burn appears in visible flight log');click('Close flight log')
    # Native Space on the maneuver card must not also activate the global shortcut.
    run('focus','[data-node]');run('press','Space');check(snap()['paused'],'Space on a maneuver card keeps simulation paused')
    (ROOT/'evidence/logs/burn-state.json').write_text(json.dumps(burned,indent=2))
    print('MAIN WORKFLOW COMPLETE',flush=True)
def phase_map():
    scenario('circular');click('Play simulation');run('wait','--fn','OrbitalApp.getSnapshot().state.time>4');click('Pause simulation');ready()
    check(snap()['historyCount']>5,'live trail history is populated')
    for mode in ['inertial','selected','rotating','body']:
        run('select','#frameSelect',mode);fresh();s=snap()
        check(s['frameMode']==mode and s['historyCount']>5,'frame '+mode+' transforms an existing simulation with trails')
        if mode=='rotating':
            r={b['id']:b for b in s['render']['bodies']};check(abs(r['luna']['y']-r['terra']['y'])<1e-5,'rotating frame aligns Luna and Terra horizontally')
            mv=ev('(()=>{const s=OrbitalApp.getSnapshot();const f=Orbital.frame(s.state,s.frameMode,s.selectedId,s.primaryId);return Orbital.transformVelocity(s.state.bodies.find(b=>b.id==="luna"),f)})()')
            check(abs(mv['y'])<1e-8,'rotating velocity subtracts frame angular motion')
        shot('frame-'+mode)
    # Canvas drag/pan/zoom is driven through real mouse events.
    bounds=ev('(()=>{const r=document.getElementById("orbitCanvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()')
    before=snap();x=bounds['x']+90;y=bounds['y']+bounds['height']-130
    run('mouse','move',x,y);run('mouse','down','left');run('mouse','move',x+45,y-20);run('mouse','up','left');after=snap()
    check(abs(after['camera']['x']-before['camera']['x'])>1,'dragging empty canvas pans reference coordinates')
    z=after['camera']['scale'];click('Zoom in');check(snap()['camera']['scale']>z,'zoom button changes scale');run('mouse','move',x,y);cdp('wheel',x,y,100);fresh();check(snap()['camera']['scale']<z*1.25,'wheel zoom changes canvas scale')
    click('Focus selected body');fresh();s=snap();craft=next(b for b in s['render']['bodies'] if b['id']=='odyssey');x=bounds['x']+craft['x'];y=bounds['y']+craft['y'];orig=next(b for b in s['state']['bodies'] if b['id']=='odyssey')
    run('mouse','move',x,y);run('mouse','down','left');run('mouse','move',x+24,y+17);run('mouse','up','left');ready();s=snap();now=next(b for b in s['state']['bodies'] if b['id']=='odyssey')
    check(math.hypot(now['x']-orig['x'],now['y']-orig['y'])>2,'paused spacecraft position drag updates actual state')
    fresh();s=snap();vh=s['render']['velocityHandle'];check(vh is not None,'paused velocity drag handle is rendered')
    x=bounds['x']+vh['x'];y=bounds['y']+vh['y'];orig=next(b for b in s['state']['bodies'] if b['id']=='odyssey')
    run('mouse','move',x,y);run('mouse','down','left');run('mouse','move',x+16,y-20);run('mouse','up','left');ready();s=snap();now=next(b for b in s['state']['bodies'] if b['id']=='odyssey')
    check(math.hypot(now['vx']-orig['vx'],now['vy']-orig['vy'])>.05,'paused vector-tip drag updates actual velocity')
    shot('canvas-position-velocity-edited')
    # Pointer placement on the prediction, not a synthetic state mutation.
    click('Place maneuver on trajectory');fresh();s=snap();points=[p for p in s['render']['path'] if 70<p['x']<bounds['width']-70 and 100<p['y']<bounds['height']-100 and p['time']>s['state']['time']+20]
    check(bool(points),'future prediction points visible for node placement');p=points[len(points)//3];run('mouse','move',bounds['x']+p['x'],bounds['y']+p['y']);run('mouse','down','left');run('mouse','up','left');ready();check(len(snap()['state']['nodes'])==1,'pointer placement creates a node at a real predicted future point')
    shot('maneuver-on-map')
    click('Fit entire system');fresh();s=snap();check(all(0<b['x']<bounds['width'] and 0<b['y']<bounds['height'] for b in s['render']['bodies']),'fit system brings all four bodies into view')
    run('focus','#orbitCanvas');cx=s['camera']['x'];run('press','ArrowRight');check(snap()['camera']['x']>cx,'keyboard arrows pan focused canvas')
    print('MAP WORKFLOW COMPLETE',flush=True)
if __name__=='__main__':
    try:
        {'main':phase_main,'map':phase_map}[sys.argv[1]]()
    except Exception as e:
        print('FAILURE:',str(e),flush=True);log.write('FAILURE: '+str(e)+'\n');raise
    finally:log.close()
