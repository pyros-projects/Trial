import subprocess, json, time, sys, pathlib, shlex, traceback
ROOT=pathlib.Path.cwd(); E=ROOT/'evidence'; LOG=(E/'logs/mobile-transcript.txt').open('w')
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
        results.append({'check':name,'status':'fail','seconds':round(time.monotonic()-started,2),'error':str(e)});print('FAIL '+name+' '+str(e),flush=True);snap('mobile-failure-'+str(len(results))+'.png')
    (E/'logs/mobile-results.json').write_text(json.dumps(results,indent=2))
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
base_click=click
def click(id):
    result=base_click(id)
    if id=='openPalette':run('wait','--fn','document.getElementById("palette").getBoundingClientRect().left>=-0.1')
    if id=='openInspector':run('wait','--fn','document.getElementById("inspector").getBoundingClientRect().right<=innerWidth+0.1')
    return result
def close_menu(name):
    run('find','role','button','click','--name',name)
    if name=='Close elements':run('wait','--fn','document.getElementById("palette").getBoundingClientRect().right<=0')
    else:run('wait','--fn','document.getElementById("inspector").getBoundingClientRect().left>=innerWidth')
run('set','viewport',390,844,2);run('reload');pause();clear()

def mobile_drawers():
    assert js('document.getElementById("palette").inert && document.getElementById("inspector").inert')
    click('openPalette');assert js('!document.getElementById("palette").inert');material('Metal');assert state()['selected']==13
    snap('22-mobile-material-drawer.png');close_menu('Close elements')
    assert js('document.getElementById("palette").inert')
    click('openInspector');assert js('!document.getElementById("inspector").inert');run('find','role','button','click','--name','Square brush');range_key('brushTemp','End')
    if not js('document.getElementById("advancedBrush").open'):run('click','#advancedBrush > summary')
    range_key('brushVX','End');range_key('brushVY','Home');range_key('spray','End');run('check','#replace')
    b=state();assert b['shape']=='square' and b['brush']['temperature']==2000 and b['brush']['vx']==8 and b['brush']['vy']==-8 and b['brush']['spray']==100 and b['brush']['replace']
    snap('23-mobile-brush-settings.png');close_menu('Close settings');assert js('document.getElementById("inspector").inert')
    return {'settings':b['brush'],'shape':b['shape'],'closed_drawers_inert':True}
check('Mobile element/settings drawers, shape, temperature, velocity, randomness and replace',mobile_drawers)

def trusted_touch():
    data=json.loads(subprocess.check_output(['node','evidence/touch-flow.cjs'],text=True))
    (E/'logs/touch-events.json').write_text(json.dumps(data,indent=2))
    assert data['events'] and data['events'][0]=={'type':'touch','trusted':True}
    assert data['state']['stats']['counts'][13]>100
    assert data['paintedVelocity']=={'vx':8,'vy':-8} and data['paintedTemperature']==2000
    before=state()['stats']['active'];time.sleep(.2);assert state()['stats']['active']==before
    steps(1);assert state()['stats']['counts'][14]>100
    run('select','#view','temperature');snap('24-mobile-touch-molten-metal.png');run('select','#view','normal')
    return {'trusted_touch':data['events'],'metal_painted':data['state']['stats']['counts'][13],'molten_after_step':state()['stats']['counts'][14],'input_stopped_after_touchend':True,'dpr':js('devicePixelRatio')}
check('Trusted continuous touch painting, brush properties, touch end and melting',trusted_touch)

def physics():
    click('openInspector');run('click','#physicsSettings > summary')
    for id in ['heatRate','reactionRate','liquidMobility','gasDiffusion','fireIntensity','explosionStrength']:range_key(id,'End')
    settings=js('lab.world.settings');assert all(settings[id]==3 for id in ['heatRate','reactionRate','liquidMobility','gasDiffusion','fireIntensity','explosionStrength'])
    range_key('ambient','Home');assert js('lab.world.settings.ambient')==-60
    run('fill','#seed','12345');close_menu('Close settings');click('resetBtn');assert js('lab.world.seed')==12345
    snap('25-mobile-seeded-reset.png');return {'physics':settings,'ambient_applied':-60,'reset_seed':12345}
check('All physics-rate sliders, ambient temperature and deterministic seed apply',physics)

def mobile_keyboard_guide():
    run('focus','#world');run('press','Space');assert not state()['paused'];tick=state()['stats']['steps'];run('wait','--fn',f'lab.world.steps>{tick+2}');run('press','Space');assert state()['paused']
    before=state()['stats']['steps'];run('press','.');assert state()['stats']['steps']==before+1
    click('openPalette');click('paletteGuide');assert js('document.getElementById("guide").open');snap('26-mobile-guide.png')
    overflow=js('(()=>{const d=document.getElementById("guide");return d.scrollWidth>d.clientWidth;})()');assert not overflow
    run('press','Escape');assert not js('document.getElementById("guide").open');return {'keyboard_pause_step':True,'guide_navigable':True,'guide_overflow':overflow}
check('Mobile keyboard playback and field-guide navigation',mobile_keyboard_guide)

def json_error():
    click('openInspector');run('click','#storageSettings > summary');click('pasteBtn');run('fill','#jsonText','this is not JSON');before=signature();click('importJson');run('wait','--text','Could not load state');assert signature()==before
    snap('27-mobile-json-error.png');click('closeJson');close_menu('Close settings');return {'invalid_paste_preserves_state':True}
check('JSON paste error flow on narrow screen',json_error)

def high_dpi_export_resize():
    sizes=js('({w:innerWidth,sw:document.documentElement.scrollWidth,cw:document.getElementById("world").width,ch:document.getElementById("world").height,box:document.getElementById("world").getBoundingClientRect().toJSON(),dpr:devicePixelRatio})');assert sizes['w']==390 and sizes['sw']==390;assert abs(sizes['cw']-sizes['box']['width']*2)<2
    run('download','#exportBtn',str(E/'downloads/mobile.png'));data=(E/'downloads/mobile.png').read_bytes();import struct;png=struct.unpack('>II',data[16:24]);assert list(png)==[sizes['cw'],sizes['ch']]
    before=signature();run('set','viewport',1280,800,1);assert signature()==before;assert not js('document.getElementById("palette").inert || document.getElementById("inspector").inert')
    snap('28-final-desktop-resized.png');run('errors');run('console');run('network','requests');return {'mobile_canvas':png,'horizontal_overflow':False,'state_preserved_on_resize':True,'desktop_drawers_accessible':True}
check('High-DPI PNG export and mobile-to-desktop resize preserve state and controls',high_dpi_export_resize)
print('Mobile checks finished:',len(results),flush=True)
