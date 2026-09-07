from importlib.machinery import SourceFileLoader
b=SourceFileLoader('browser',str(__import__('pathlib').Path(__file__).with_name('browser-regression.py'))).load_module()
run,ev,snap,click,fill,check,shot,ready,scenario,fresh=b.run,b.ev,b.snap,b.click,b.fill,b.check,b.shot,b.ready,b.scenario,b.fresh
import math,json
try:
    run('set','viewport',1280,800,1);run('reload');ready()
    click('Simulation settings')
    for layer,enabled in {'trajectories':True,'velocity':True,'acceleration':False,'guides':True,'potential':False,'elements':True,'soi':False,'encounters':True,'error':False,'trails':True}.items():
        sel=f'#settingsDialog [data-layer="{layer}"]';run('scrollintoview',sel);run('check' if enabled else 'uncheck',sel)
    run('scrollintoview','#trailLength');fill('Trail history (samples)',600);click('Done')
    results=[]
    for key in ['circular','elliptical','hohmann','moon','slingshot','threebody','escape']:
        scenario(key);s=snap();p=s['prediction'];check(p and all(math.isfinite(q[k]) for q in p['final']['bodies'] for k in ['x','y','vx','vy']),'scenario '+key+' predicts a finite full horizon')
        if key=='hohmann':check(len([e for e in p['events'] if e['type']=='burn'])==2,'Hohmann preset predicts both scheduled transfer burns')
        if key=='moon':check(next(c['distance'] for c in p['closest'] if c['craftId']=='odyssey' and c['bodyId']=='luna')<20,'moon transfer prediction enters Luna neighborhood')
        if key=='escape':check(float(ev('document.getElementById("telEcc").textContent'))>1 and ev('document.getElementById("telApo").textContent')=='Unbound','escape preset displays unbound osculating orbit')
        click('Single integration step');check(snap()['state']['time']>0,'scenario '+key+' advances through real playback control')
        results.append({'scenario':key,'time':snap()['state']['time'],'events':p['events'],'closest':p['closest']})
        if key in ['hohmann','moon','threebody','escape']:shot('scenario-'+key)
    (b.ROOT/'evidence/logs/scenario-observations.json').write_text(json.dumps(results,indent=2))
    # Actual high-warp Hohmann flight: run through both impulses and inspect the real event log.
    scenario('hohmann');run('focus','#warpRange');run('press','End');click('Play simulation');run('wait','--fn','OrbitalApp.getSnapshot().state.nodes.every(n=>n.executed) || OrbitalApp.getSnapshot().paused');s=snap()
    if not s['paused']:click('Pause simulation')
    s=snap();burns=[e for e in s['state']['events'] if e['type']=='burn'];check(len(burns)==2,'actual Hohmann flight executes both scheduled burns at high warp');check(abs(s['conservation']['energy'])<1e-5,'two-burn live flight retains low numerical energy drift')
    (b.ROOT/'evidence/logs/hohmann-live.json').write_text(json.dumps(s,indent=2))
    scenario('threebody');click('Save checkpoint');run('focus','#warpRange');run('press','End');click('Play simulation');run('wait','--fn','OrbitalApp.getSnapshot().state.events.some(e=>e.type==="collision") || OrbitalApp.getSnapshot().state.time>180 || OrbitalApp.getSnapshot().paused');s=snap()
    if not s['paused']:click('Pause simulation')
    s=snap();check(any(e['type']=='collision' for e in s['state']['events']),'unstable scenario produces a real contact event');check(s['primaryId']==(next(q for q in s['state']['bodies'] if q['id']==s['selectedId'])['primary'] or s['selectedId']),'actual collision keeps selected frame origin coherent');shot('threebody-real-collision')
    click('Restore checkpoint');check(snap()['state']['time']==0 and len([q for q in snap()['state']['bodies'] if q['alive']])==4,'checkpoint restores pre-collision bodies and mission time')
    click('Select Terra');fresh();check(ev('document.getElementById("encounterDistance").textContent')!='—','celestial body selection also displays predicted closest approach')
    check(not snap()['errors'],'all seven scenario workflows complete without uncaught errors')
    print('SCENARIO WORKFLOW COMPLETE')
finally:b.log.close()
