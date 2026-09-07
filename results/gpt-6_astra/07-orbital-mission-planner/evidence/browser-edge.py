from importlib.machinery import SourceFileLoader
b=SourceFileLoader('browser',str(__import__('pathlib').Path(__file__).with_name('browser-regression.py'))).load_module()
run,ev,snap,click,fill,check,shot,ready,scenario,fresh=b.run,b.ev,b.snap,b.click,b.fill,b.check,b.shot,b.ready,b.scenario,b.fresh
import math
try:
    scenario('circular');run('scrollintoview','#editBodyButton');click('Edit initial state');fill('Individual display scale',2);run('select','#bodyPrimary','');click('Apply state');ready();fresh();s=snap()
    radius=next(q['radius'] for q in s['render']['bodies'] if q['id']=='odyssey');print('Observed spacecraft radius at display scale 2:',radius)
    click('Add maneuver');ready();n=snap()['state']['nodes'][0];print('Observed maneuver primary with no assigned orbital primary:',n['primaryId'])
    shot('edge-display-scale-and-primary')
    check(radius==12,'spacecraft individual display scale changes rendered marker size')
    check(n['primaryId'] is None,'spacecraft with no primary uses inertial burn basis')
    click('Cartesian X / Y');fill('Inertial X Δv',.2);fill('Inertial Y Δv',-.1);fill('Burn at · mission time',.08);ready();n=snap()['state']['nodes'][0]
    check(n['mode']=='cartesian' and n['dx']==.2 and n['dy']==-.1,'Cartesian editor sets inertial impulse components')
    fill('Burn at · mission time',-1);check(ev('document.getElementById("nodeError").style.display')=='block' and snap()['state']['nodes'][0]['time']==.08,'past maneuver time rejected without changing schedule');fill('Burn at · mission time',.08)
    click('Single integration step');click('Single integration step');s=snap();e=next(e for e in s['state']['events'] if e['type']=='burn');check(abs(e['dvx']-.2)<1e-12 and abs(e['dvy']+.1)<1e-12,'actual Cartesian burn executes requested X and Y impulses')
    run('scrollintoview','[data-remove-node]');run('click','[data-remove-node]');ready();check(not snap()['state']['nodes'] and len(snap()['state']['events'])==1,'deleting an executed node preserves actual flight history')
    check(not snap()['errors'],'body-scale and no-primary maneuver flows have no uncaught errors')
    print('EDGE WORKFLOW COMPLETE')
finally:b.log.close()
