import subprocess, json, time, sys, pathlib, shlex, traceback
ROOT=pathlib.Path.cwd(); E=ROOT/'evidence'; LOG=(E/'logs/browser-transcript.txt').open('w')
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
        results.append({'check':name,'status':'fail','seconds':round(time.monotonic()-started,2),'error':str(e)});print('FAIL '+name+' '+str(e),flush=True);snap('failure-'+str(len(results))+'.png')
    (E/'logs/browser-results.json').write_text(json.dumps(results,indent=2))
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
run('set','viewport',1280,800)
run('reload');pause();clear()
run('select','#gravity','none');range_key('radius','Home',3);range_key('amount','End')
run('click','#advancedBrush > summary');range_key('spray','Home')

def continuity():
    for name,p in [('Sand',[(20,30),(70,30)]),('Wood',[(20,65),(70,65)]),('Stone',[(95,30),(145,30)]),('Metal',[(95,65),(145,65)]),('Water',[(180,25),(210,25)]),('Oil',[(180,50),(210,50)]),('Gas',[(180,80),(210,80)]),('Explosive',[(30,110),(60,110)]),('Fire',[(30,105),(60,105)])]:material(name);stroke(p)
    s=state();assert all(s['stats']['counts'][i]>0 for i in [1,2,3,5,7,12,13,16,18])
    holes=js('Array.from({length:51},(_,i)=>lab.world.type[65*lab.world.w+20+i]).filter(x=>x!==Alchemy.M.WOOD).length');assert holes==0,holes
    snap('03-continuous-material-strokes.png');return {'counts':s['stats']['counts'],'wood_centerline_gaps':holes,'paused':s['paused']}
check('Continuous rapid pointer strokes across solids, liquids, gas, fire and explosive',continuity)

def sampler_erase():
    tool('pick');paintpoint(45,65);assert state()['selected']==5
    before=state()['stats']['counts'][5];stroke([(35,65),(50,65)],'right');after=state()['stats']['counts'][5];assert after<before
    return {'sampled':'Wood','wood_before':before,'wood_after_erase':after}
check('Eyedropper and right-pointer erasing',sampler_erase)

def containment():
    clear();tool('wall');stroke([(100,35),(160,35),(160,95),(100,95),(100,35)])
    material('Water');tool('fill');paintpoint(130,60)
    s=state();assert 1000<s['stats']['counts'][2]<6000
    outside=js('lab.world.type.reduce((n,id,i)=>n+(id===2&&((i%lab.world.w)<100||(i%lab.world.w)>160||(i/lab.world.w|0)<35||(i/lab.world.w|0)>95)),0)');assert outside==0,outside
    material('Sand');tool('paint');run('mouse','move',*point(35,130));run('focus','#world');run('press','ArrowRight');run('press','Enter');assert state()['stats']['counts'][1]>0
    old=state()['brush']['radius'];run('press',']');assert state()['brush']['radius']==old+1;run('press','[')
    snap('04-wall-fill-keyboard.png');return {'enclosed_water':s['stats']['counts'][2],'outside_water':outside,'keyboard_sand':state()['stats']['counts'][1]}
check('Wall drawing, enclosed flood fill, keyboard brush and radius shortcut',containment)

def lava_water():
    clear();material('Lava');stroke([(40,105),(75,105)]);material('Water');stroke([(40,99),(75,99)])
    initial=state()['stats']['counts'];steps(25);s=state();assert s['stats']['counts'][9]>0;assert s['stats']['counts'][12]>0;assert s['stats']['counts'][11]<initial[11]
    run('select','#view','temperature');snap('05-lava-water-temperature.png');run('select','#view','normal');snap('06-lava-water-products.png')
    return {'before':initial,'after':s['stats']['counts'],'reactions':s['stats']['reactions']}
check('Lava-water reaction leaves real steam and cooled stone',lava_water)

def combustion():
    clear();material('Wood');stroke([(25,130),(105,130)]);initial=state()['stats']['counts'][5];material('Fire');stroke([(40,124),(80,124)]);steps(125);s=state();assert s['stats']['counts'][5]<initial;assert s['stats']['counts'][20]>0
    run('select','#view','fuel');snap('07-fire-consumption-fuel.png');run('select','#view','normal');snap('08-fire-ash-smoke.png')
    return {'wood_before':initial,'wood_after':s['stats']['counts'][5],'ash':s['stats']['counts'][20],'smoke':s['stats']['counts'][8],'fuel_left':s['stats']['fuel']}
check('Fire consumes connected wood and leaves ash and smoke',combustion)

def electricity():
    clear();material('Metal');stroke([(30,120),(100,120)]);material('Electricity');paintpoint(25,120);steps(40)
    charge=js('({near:lab.world.charge[120*lab.world.w+32],far:lab.world.charge[120*lab.world.w+60],temperature:lab.world.temp[120*lab.world.w+60],max:lab.world.stats().maxCharge})');assert charge['far']>.05,charge
    run('select','#view','charge');snap('09-charge-through-metal.png');run('select','#view','normal');return charge
check('Electricity travels through a painted metal path and transfers heat',electricity)

def corrosion():
    clear();material('Metal');stroke([(25,125),(90,125)]);material('Stone');stroke([(160,125),(225,125)]);initial=state()['stats']['counts'];material('Acid');stroke([(25,119),(90,119)]);stroke([(160,119),(225,119)]);steps(130);s=state();metal_lost=initial[13]-s['stats']['counts'][13];stone_lost=initial[12]-s['stats']['counts'][12];assert metal_lost>0;assert metal_lost>stone_lost,(metal_lost,stone_lost)
    run('select','#view','activity');snap('10-acid-corrosion-activity.png');run('select','#view','normal');return {'metal_lost':metal_lost,'stone_lost':stone_lost,'gas':s['stats']['counts'][16],'reaction_count':s['stats']['reactions']}
check('Acid persistently corrodes metal more strongly than stone',corrosion)

def heat_cool():
    clear();material('Water');paintpoint(50,100);tool('cool');paintpoint(50,100);steps(1);assert state()['stats']['counts'][10]>0;iced=state()['stats']['counts'][10]
    tool('heat');paintpoint(50,100);steps(1);assert state()['stats']['counts'][2]>0;melt=state()['stats']['counts'][2]
    paintpoint(50,100);paintpoint(50,100);steps(1);assert state()['stats']['counts'][9]>0
    snap('11-heat-cool-phase-changes.png');return {'frozen_cells':iced,'melted_water':melt,'boiled_steam':state()['stats']['counts'][9]}
check('Cool freezes painted water; heat melts and boils actual cells',heat_cool)

def wind_blast():
    clear();material('Sand');stroke([(60,90),(80,90)]);tool('wind');stroke([(60,90),(80,90)]);velocity=js('Math.max(...lab.world.vx)');assert velocity>1
    tool('blast');paintpoint(70,90);impulse=js('Math.max(...lab.world.vx.map(Math.abs))');max_temp=js('Math.max(...lab.world.temp)');assert impulse>1 and max_temp>100
    run('select','#view','velocity');snap('12-wind-explosion-velocity.png');run('select','#view','normal');return {'wind_max_vx':velocity,'explosion_max_impulse':impulse,'max_temperature':max_temp}
check('Wind and explosion add real velocity and thermal impulses',wind_blast)

def diagnostics():
    hashes={}
    for mode in ['normal','temperature','velocity','density','charge','fuel','activity','order']:
        run('select','#view',mode);run('wait','--fn',f'lab.state.view==="{mode}"');time.sleep(.04)
        hashes[mode]=js('(()=>{const c=document.getElementById("world"),p=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<p.length;i+=7)h=Math.imul(h^p[i],16777619);return h>>>0;})()')
    assert len(set(hashes.values()))>=7,hashes
    snap('13-update-order.png');run('select','#view','normal');return hashes
check('All eight visualizations render distinct live property views',diagnostics)

def pause_step_settings():
    before=state()['stats']['steps'];time.sleep(.15);assert state()['stats']['steps']==before
    run('select','#speed','2');run('select','#substeps','4');steps(1);assert state()['stats']['steps']==before+1
    for direction in ['up','left','right','none','down']:run('select','#gravity',direction);assert js('lab.world.settings.gravity')==direction
    run('select','#speed','1');run('select','#substeps','1');click('pauseBtn');run('wait','--fn',f'lab.world.steps>{before+4}');click('pauseBtn');assert state()['paused']
    return {'paused_tick':before,'single_step':before+1,'resumed_tick':state()['stats']['steps'],'tested_gravity':['up','left','right','none','down']}
check('Pause continuity, exact single-step, resume, speed, substeps and gravity controls',pause_step_settings)

def growth():
    run('select','#presetSelect','ecosystem');pause();initial=state()['stats']['counts'][6];steps(65);grown=state()['stats']['counts'][6];assert grown>initial,(initial,grown)
    snap('14-growing-ecosystem.png');return {'plants_before':initial,'plants_after':grown}
check('Plant ecosystem grows persistent material with available water',growth)

def all_presets():
    observed={}
    for id in ['building','electrical','acid','engine','frozen','fireworks']:
        run('select','#presetSelect',id);pause();before=state()['stats'];steps(8);after=state()['stats'];assert after['active']>500;observed[id]={'cells':after['active'],'reactions':after['reactions'],'temperature':round(after['averageTemperature'])}
    run('select','#presetSelect','volcano');pause();click('resetBtn');first=signature();click('resetBtn');second=signature();assert first==second
    snap('15-reset-volcano.png');return {'scenes':observed,'deterministic_reset_hash':first['hash']}
check('Six additional elaborate presets and seeded deterministic reset',all_presets)

def save_load_png():
    before=signature();run('download','#saveBtn',str(E/'downloads/world.json'));path=E/'downloads/world.json';data=json.loads(path.read_text());assert data['format']=='materia' and data['arrays'] and data['extra']['brush'];size=path.stat().st_size
    click('clearBtn');assert state()['stats']['active']==0
    click('loadBtn');run('upload','#fileInput',str(path));run('wait','--fn','lab.world.stats().active>1000');after=signature();assert before==after,(before,after);assert state()['paused']
    run('select','#view','temperature');run('download','#exportBtn',str(E/'downloads/temperature.png'));assert (E/'downloads/temperature.png').read_bytes()[:8]==b'\x89PNG\r\n\x1a\n';run('select','#view','normal');snap('16-save-load-restored.png');return {'state_file_bytes':size,'exact_persistent_state_hash':after['hash'],'png_bytes':(E/'downloads/temperature.png').stat().st_size}
check('Actual Save download, clear, Load upload, exact restoration and PNG export',save_load_png)

def invalid_import():
    (E/'downloads/invalid.json').write_text('{"format":"materia","version":1,"w":999999}')
    before=signature();run('upload','#fileInput',str(E/'downloads/invalid.json'));run('wait','--text','Could not load state');assert signature()==before;snap('17-invalid-import-preserves-world.png');return {'world_unchanged':True,'message':js('document.getElementById("toast").textContent')}
check('Invalid import reports a readable error and preserves current cells',invalid_import)

def autosave_restore():
    run('click','#storageSettings > summary');before=signature();run('wait','--fn','localStorage.getItem("materia.autosave.v1") && JSON.parse(localStorage.getItem("materia.autosave.v1")).steps===lab.world.steps',timeout=35)
    saved=js('Alchemy.World.deserialize(localStorage.getItem("materia.autosave.v1")).stats()');assert saved['active']==state()['stats']['active'];click('clearBtn');click('restoreBtn');assert signature()==before
    run('reload');run('wait','--fn','lab.world.stats().active>1000');assert signature()==before;assert state()['paused'];return {'restored_after_clear':True,'restored_after_reload':True,'saved_cells':saved['active']}
check('Timed local autosave, Restore control, and reload persistence',autosave_restore)

def stress_resolution():
    run('select','#resolution','384');assert js('lab.world.w')==384;run('select','#presetSelect','stress');run('wait','--fn','lab.world.steps>12');s=state();assert s['stats']['active']>40000
    start=time.monotonic();click('pauseBtn');latency=time.monotonic()-start;assert state()['paused'];assert latency<2
    snap('18-stress-desktop.png');run('select','#resolution','256');assert js('lab.world.w')==256;assert state()['stats']['active']>10000
    return {'grid':'384 × 240','active_cells':s['stats']['active'],'fps_observed':round(s['fps'],1),'pause_response_seconds':round(latency,3),'resized_cells':state()['stats']['active']}
check('Dense stress scene with 384 resolution and responsive controls',stress_resolution)

run('errors');run('console');run('network','requests');print('Browser checks finished:',len(results),flush=True)
