from importlib.machinery import SourceFileLoader
b=SourceFileLoader('browser',str(__import__('pathlib').Path(__file__).with_name('browser-regression.py'))).load_module()
from math import isclose
import json,sys,subprocess,shutil
run,ev,snap,click,fill,check,shot,ready,scenario,fresh=b.run,b.ev,b.snap,b.click,b.fill,b.check,b.shot,b.ready,b.scenario,b.fresh

def settings():
    scenario('circular');click('Save checkpoint');click('Simulation settings');run('snapshot','-i')
    fill('Maximum integration step (TU)',.02);fill('Gravitational constant G',1.2);fill('Gravitational softening (DU)',.03)
    s=snap();check(s['cfg']['dt']==.02 and s['cfg']['G']==1.2 and s['cfg']['softening']==.03,'ordinary physics setting values apply through labeled controls')
    fill('Gravitational constant G',0);check(snap()['cfg']['G']==1.2 and ev('document.getElementById("settingsError").style.display')=='block','out-of-range gravity rejected without mutating physics')
    fill('Gravitational constant G',1);run('select','#cfgCollision','bounce');fill('Prediction horizon (TU)',160);fill('Prediction samples',600);fill('Trail history (samples)',0);ready()
    check(snap()['prediction']['sampleCount']==601 and abs(snap()['prediction']['end']-snap()['prediction']['start']-160)<1e-7,'horizon and prediction resolution change actual predicted data')
    for layer in ['acceleration','potential','soi','error']:
        selector='#settingsDialog [data-layer="'+layer+'"]'
        run('scrollintoview',selector);run('check',selector)
    # Some semantic find subcommands vary; check fallback uses labeled CSS only if needed.
    click('Done');fresh();shot('all-physics-overlays');s=snap();check(all(s['layers'][k] for k in ['acceleration','potential','soi','error']),'physics overlay controls update live renderer layers')
    click('Restore checkpoint');check(snap()['cfg']['G']==1 and snap()['cfg']['dt']==.04 and snap()['cfg']['softening']==.02,'checkpoint restores its matching solver configuration and conservation baseline')
    run('focus','#warpRange');run('press','End');check(snap()['targetWarp']==100,'keyboard input sets maximum warp')
    click('Play simulation');run('wait','--fn','OrbitalApp.getSnapshot().state.time>5');click('Pause simulation');s=snap();check(s['state']['time']>5 and all(__import__('math').isfinite(q['x']) for q in s['state']['bodies']),'high time warp advances finite actual orbital state')
    run('focus','#warpRange');run('press','Home');check(isclose(snap()['targetWarp'],.1),'keyboard input decelerates warp to 0.1x')
    print('SETTINGS WORKFLOW COMPLETE')

def export_download():
    url=run('get','cdp-url');cmd=['node','evidence/cdp-download.cjs',url,str(b.ROOT/'evidence/downloads')]
    p=subprocess.Popen(cmd,cwd=b.ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    path=None
    for line in p.stdout:
        b.log.write(line);b.log.flush()
        if 'observer ready' in line:click('Export')
        try:
            item=json.loads(line)
            if isinstance(item,dict) and item.get('params',{}).get('state')=='completed':path=item['params']['filePath']
        except ValueError:pass
    code=p.wait(timeout=25)
    check(code==0 and path is not None,'Chrome completed the actual mission download')
    shutil.copyfile(path,b.ROOT/'evidence/mission-export.json')
def persistence():
    scenario('circular');click('Add spacecraft');run('snapshot','-i');run('focus','#bodyName');run('press','Control+a');run('keyboard','type','Vela');run('press','Tab');fill('Individual display scale',1.4);click('Apply state');ready()
    s=snap();crafts=[q for q in s['state']['bodies'] if q['type']=='craft'];check(len(crafts)==2 and any(q['name']=='Vela' and q['scale']==1.4 for q in crafts),'keyboard body editor adds a fully simulated second spacecraft')
    click('Add maneuver');ready();vela=snap()['selectedId'];fill('Prograde Δv',.22);ready();v=snap();click('Select Odyssey');fresh();s=snap();text=ev('({name:document.getElementById("encounterName").textContent,distance:document.getElementById("encounterDistance").textContent})')
    expected=next(c for c in s['prediction']['closest'] if c['craftId']=='odyssey' and c['bodyId']=='luna')['distance']
    check(text['name']=='Luna' and abs(float(text['distance'])-expected)<.01,'paused spacecraft selection immediately refreshes closest-approach telemetry')
    click('Select Vela');fresh();check(ev('document.getElementById("projectedEcc").textContent')!='—','paused selection refreshes projected orbital elements')
    # Form input continuity: temporary invalid signed number does not reset focus/value.
    run('focus','#dv1');run('press','Control+a');run('keyboard','type','-');check(ev('document.activeElement.id')=='dv1','incomplete signed delta-v keeps input focus');run('keyboard','type','0.12');run('press','Tab');ready();check(isclose(snap()['state']['nodes'][0]['prograde'],-.12),'continued keyboard typing commits complete retrograde delta-v')
    click('Save checkpoint');click('Save mission');saved=snap();export_download();data=json.loads((b.ROOT/'evidence/mission-export.json').read_text());check(data['state']==saved['state'],'actual exported JSON matches the visible mission state')
    click('Single integration step');click('Simulation settings');click('Load saved mission');ready();loaded=snap();check(loaded['state']==saved['state'] and loaded['paused'],'local Save/Load restores bodies, nodes and exact time')
    run('reload');ready();reloaded=snap();check(reloaded['state']==saved['state'] and reloaded['paused'],'reload restores persisted workspace paused')
    scenario('escape');click('Simulation settings');run('upload','#importFile',str(b.ROOT/'evidence/mission-export.json'));run('wait','--fn','!document.getElementById("settingsDialog").open');ready();imported=snap();check(imported['state']==saved['state'] and imported['selectedId']==saved['selectedId'],'portable JSON import restores complete multi-craft mission')
    # Hand-edited invalid fixture from genuine export: null event must be rejected atomically.
    invalid=json.loads((b.ROOT/'evidence/mission-export.json').read_text());invalid['state']['events']=[None];invalid['state']['bodies'][0]['name']='Corrupted';(b.ROOT/'evidence/invalid-mission.json').write_text(json.dumps(invalid))
    click('Simulation settings');before=snap();run('upload','#importFile',str(b.ROOT/'evidence/invalid-mission.json'));run('wait','--fn','document.getElementById("settingsError").textContent.includes("invalid event")');after=snap();check(before['state']==after['state'] and ev('document.getElementById("settingsError").textContent').startswith('Import failed:'),'malformed event import rejected atomically and explained')
    shot('invalid-import-rejected');click('Done')
    check(not snap()['errors'],'no uncaught errors after persistence and validation flows')
    print('PERSISTENCE WORKFLOW COMPLETE')

if __name__=='__main__':
    try:{'settings':settings,'persistence':persistence}[sys.argv[1]]()
    finally:b.log.close()
