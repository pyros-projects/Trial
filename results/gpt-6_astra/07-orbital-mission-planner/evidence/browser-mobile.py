from importlib.machinery import SourceFileLoader
b=SourceFileLoader('browser',str(__import__('pathlib').Path(__file__).with_name('browser-regression.py'))).load_module()
run,ev,snap,click,fill,check,shot,ready,scenario,fresh=b.run,b.ev,b.snap,b.click,b.fill,b.check,b.shot,b.ready,b.scenario,b.fresh
try:
    run('set','viewport',390,844,2);scenario('circular');fresh();shot('mobile-orbit-390')
    dims=ev('({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,dpr:devicePixelRatio})')
    check(dims['width']==390 and dims['height']==844 and dims['scroll']<=390,'390x844 layout has no horizontal page overflow')
    s=snap();check(s['render']['dpr']==2 and s['render']['width']==390,'Canvas uses high-DPI backing store at narrow viewport')
    # Native touch events delivered through Chrome, with app Pointer Events handling them.
    old=s['camera'];b.cdp('drag',100,430,35,-20);fresh();check(abs(snap()['camera']['x']-old['x'])>1,'real single-touch gesture pans map')
    z=snap()['camera']['scale'];b.cdp('pinch',190,430,35,65);fresh();check(snap()['camera']['scale']>z*1.4,'real two-touch pinch zooms map')
    click('Telemetry');run('snapshot','-i');check(ev('document.getElementById("workspace").dataset.mobile')=='telemetry','mobile Telemetry navigation exposes body controls')
    shot('mobile-telemetry-390');click('Select Luna');check(snap()['selectedId']=='luna','mobile body selector works')
    click('Select Odyssey');click('Flight plan');click('Add maneuver');ready();run('snapshot','-i')
    # Scroll the independent sidebar to controls and edit with keyboard.
    run('scrollintoview','#dv1');fill('Prograde Δv',.18);ready();check(abs(snap()['state']['nodes'][0]['prograde']-.18)<1e-10,'narrow flight-plan editor changes actual maneuver')
    shot('mobile-flight-plan-390');click('Orbit map');fresh();shot('mobile-maneuver-map-390')
    click('Single integration step');check(snap()['state']['time']>0 and snap()['paused'],'mobile transport single-step works')
    run('focus','#orbitCanvas');run('press','Space');run('wait','--fn','OrbitalApp.getSnapshot().state.time>1');run('press','Space');check(snap()['paused'],'keyboard play/pause remains usable on narrow layout')
    click('Simulation settings');run('snapshot','-i');run('scrollintoview','#cfgHorizon');fill('Prediction horizon (TU)',120);ready();check(snap()['cfg']['horizon']==120,'mobile settings are scrollable and functional');shot('mobile-settings-390');click('Done')
    click('Help and keyboard shortcuts');run('snapshot','-i');shot('mobile-help-390');click('Close help');click('Choose scenario');run('scrollintoview','[data-scenario="moon"]');shot('mobile-scenarios-390');run('click','[data-scenario="moon"]');click('Pause simulation');ready();check('Lunar' in ev('document.getElementById("missionTitle").textContent'),'mobile scenario navigation loads a different mission')
    check(not snap()['errors'],'mobile navigation and gestures produce no uncaught application errors')
    print('MOBILE WORKFLOW COMPLETE')
finally:b.log.close()
