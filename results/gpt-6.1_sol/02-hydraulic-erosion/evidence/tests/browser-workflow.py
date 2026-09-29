import subprocess,json,time,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
log=(root/'evidence/logs/browser-workflow.log').open('a')
results=[]
if any(a.startswith('--resume') for a in sys.argv):
    previous=root/'evidence/logs/browser-results.json'
    if previous.exists():results=[r for r in json.loads(previous.read_text()) if r['status']=='pass']
def run(*args,js=None):
    if args[0]=='click' and len(args)>1 and args[1] in ['#regenerate','#resetCamera']:run('scrollintoview',args[1])
    command=['agent-browser','--session','strata',*map(str,args)]
    log.write('$ '+' '.join(command)+'\n');log.flush()
    result=subprocess.run(command,input=js,text=True,capture_output=True)
    log.write(result.stdout+result.stderr+'\n');log.flush()
    if result.returncode:raise RuntimeError(result.stderr or result.stdout)
    return result.stdout.strip()
def ev(js):return json.loads(run('eval','--stdin',js=js))
def diag():return ev('window.strata.diagnostics()')
def check(name,condition,detail=None):
    results.append({'name':name,'status':'pass' if condition else 'fail','observed':detail})
    print(('PASS ' if condition else 'FAIL ')+name,flush=True)
    (root/'evidence/logs/browser-results.json').write_text(json.dumps(results,indent=2))
    if not condition:raise AssertionError(name+': '+str(detail))
def shot(name):run('screenshot',root/'evidence/screenshots'/name)
def focuskey(selector,key):run('focus',selector);run('press',key)
def pause():
    if not diag()['paused']:run('find','role','button','click','--name','Pause simulation','--exact')
def pointer_brush(label,x,z,dwell=.45,end=None):
    run('find','role','button','click','--name',label,'--exact')
    p=ev(f'window.strata.project({x},{z})')
    run('mouse','move',round(p['x']),round(p['y']));run('mouse','down')
    time.sleep(dwell)
    if end:
        q=ev(f'window.strata.project({end[0]},{end[1]})')
        for f in [.25,.5,.75,1]:run('mouse','move',round(p['x']+(q['x']-p['x'])*f),round(p['y']+(q['y']-p['y'])*f));time.sleep(.07)
    run('mouse','up');time.sleep(.1)
def run_until(seconds):
    run('find','role','button','click','--name','Resume simulation','--exact')
    run('wait','--fn',f'window.strata.diagnostics().time >= {seconds}')
    pause();return diag()
try:
    if '--resume-terrain' not in sys.argv:
        if '--resume' not in sys.argv:
            pause();run('click','#home');start=diag();run('wait',700);check('Pause freezes terrain, water and simulation time',diag()['heightChecksum']==start['heightChecksum'] and diag()['time']==start['time'],diag())
            run('find','role','button','click','--name','Single simulation step','--exact');after=diag();check('Single step advances one step while staying paused',after['steps']==start['steps']+1 and after['time']>start['time'] and after['paused'],after)
            run('find','role','button','click','--name','Reset simulation','--exact');base=diag();check('Reset restores initial terrain and zero clock',base['time']==0 and base['eroded']==0,base);shot('desktop-reset.png')
            # Real mouse strokes on the actual 3D terrain, with live model measurements.
            base=diag();pointer_brush('Raise terrain',-3,0,.5,end=(1,0));raised=diag();check('Raise brush changes bed heights along a continuous pointer stroke',raised['heightChecksum']>base['heightChecksum']+1,{'before':base,'after':raised});shot('desktop-raised-brush.png')
            base=diag();pointer_brush('Lower terrain',-3,0,.65);check('Lower brush decreases actual terrain height',diag()['heightChecksum']<base['heightChecksum']-.3,diag())
            base=diag();pointer_brush('Smooth terrain',-3,0,.6);check('Smooth brush changes the heightfield',abs(diag()['heightChecksum']-base['heightChecksum'])>.005,diag())
            base=diag();pointer_brush('Flatten terrain',-3,0,.6);check('Flatten brush changes surrounding elevations',abs(diag()['heightChecksum']-base['heightChecksum'])>.005,diag())
            base=diag();pointer_brush('Add water',-3,0,.7,end=(0,1));water=diag();check('Water injection increases actual water volume',water['water']>base['water']+.2,{'before':base['water'],'after':water['water']});shot('desktop-water-injection.png')
            base=diag();pointer_brush('Add sediment',-3,0,.7);check('Sediment brush adds suspended material',diag()['sediment']>base['sediment']+.02,diag())
            base=diag();pointer_brush('Dry area',-3,0,.6);check('Dry brush removes local water',diag()['water']<base['water']-.05,diag())
            pointer_brush('Inspect terrain',0,1,.05);check('Inspect pins a meaningful sample',ev("document.getElementById('probeHint').textContent.includes('Pinned')"),ev("document.getElementById('probe').innerText"));shot('desktop-probe.png')
            # Editing modifiers and camera gestures must not alter the bed.
            run('find','role','button','click','--name','Orbit camera','--exact');beforeCam=ev('window.strata.camera');base=diag();run('mouse','move',760,420);run('mouse','down');run('mouse','move',890,460);run('mouse','up');check('Real drag orbits the camera without painting',ev('window.strata.camera')['theta']!=beforeCam['theta'] and diag()['heightChecksum']==base['heightChecksum'],ev('window.strata.camera'))
            beforeCam=ev('window.strata.camera');run('mouse','move',760,420);run('mouse','down','right');run('mouse','move',830,440);run('mouse','up','right');check('Right drag pans the camera',ev('window.strata.camera')['target']!=beforeCam['target'],ev('window.strata.camera'))
        beforeCam=ev('window.strata.camera');native=subprocess.run(['node',str(root/'evidence/tests/native-input.cjs'),'wheel','830','440','-240'],text=True,capture_output=True);log.write(native.stdout+native.stderr);log.flush();check('Wheel zoom changes camera distance',ev('window.strata.camera')['distance']<beforeCam['distance'],ev('window.strata.camera'))
        run('find','role','button','click','--name','Reset camera view','--exact')
        # Actual reset and running controls, no calls to the solver from the harness.
        run('find','role','button','click','--name','Reset simulation','--exact');base=diag();focuskey('#speed','End');run('select','#substeps','8');after=run_until(15);check('Flow changes underlying geometry, sediment and erosion over time',after['heightChecksum']!=base['heightChecksum'] and after['change']>.01 and after['eroded']>1 and after['sediment']>0 and after['water']>base['water'],{'before':base,'after':after});shot('desktop-evolved.png')
        # Select every visualization; all genuine simulation fields stay frozen.
        frozen=diag()
        for mode in range(7):
            run('select','#mode',mode);run('wait',120);current=diag();check('Visualization '+str(mode)+' preserves simulation',current['heightChecksum']==frozen['heightChecksum'] and current['waterChecksum']==frozen['waterChecksum'] and current['sedimentChecksum']==frozen['sedimentChecksum'] and current['time']==frozen['time'] and current['glError']==0,current['mode']);shot('mode-'+str(mode)+'.png')
        run('select','#mode','0')
        # Distinguish hydraulic bed change from thermal change and manual brush effects.
        run('scrollintoview','#thermal');focuskey('#thermal','Home');run('scrollintoview','#erosion');focuskey('#erosion','Home');run('scrollintoview','#evaporation');focuskey('#evaporation','Home');run('click','#reset');noErosionBase=diag();noErosion=run_until(5);check('Zero erosion and zero thermal leave the bed unchanged while water moves',abs(noErosion['heightChecksum']-noErosionBase['heightChecksum'])<.001 and noErosion['waterChecksum']!=noErosionBase['waterChecksum'],{'before':noErosionBase,'after':noErosion})
        run('scrollintoview','#erosion');focuskey('#erosion','End');run('click','#reset');highErosion=run_until(5);check('Increasing erosion produces material removal under the same initial conditions',highErosion['eroded']>noErosion['eroded']+5 and highErosion['change']>.01,{'erosionOff':noErosion,'erosionHigh':highErosion})
        run('scrollintoview','#erosion');focuskey('#erosion','Home');run('scrollintoview','#rain');focuskey('#rain','Home');run('scrollintoview','#evaporation');focuskey('#evaporation','Home');run('click','#reset');evapBase=diag();noEvap=run_until(5);check('With no rain or evaporation the closed basin conserves water',abs(noEvap['water']-evapBase['water'])<.0001,{'before':evapBase['water'],'after':noEvap['water']})
        focuskey('#evaporation','End');run('click','#reset');highEvap=run_until(5);check('Higher evaporation meaningfully reduces water volume',highEvap['water']<noEvap['water']*.3,{'evapOff':noEvap['water'],'evapHigh':highEvap['water']})
        # Changing resolution while running preserves water, time and finite fields.
        run('select','#preset','valley');focuskey('#speed','Home');run('click','#pause');run('select','#resolution','128');running128=diag();check('Resolution change while running keeps the simulation running and finite',running128['n']==128 and not running128['paused'] and running128['recoveries']==0,running128);run('select','#resolution','64');run('wait','--fn','window.strata.diagnostics().time > 1');pause();check('Resolution changes remain renderable',diag()['n']==64 and diag()['glError']==0,diag())
    # Regeneration, deterministic seed and invalid seed error.
    run('find','role','tab','click','--name','Terrain','--exact');run('fill','#seed','7331');run('click','#regenerate');seedA=diag();run('click','#regenerate');seedB=diag();check('Regeneration with the same seed reproduces the same bed',seedA['heightChecksum']==seedB['heightChecksum'] and seedB['seed']==7331,seedB)
    run('fill','#seed','7332');run('click','#regenerate');check('New seed changes generated geometry',diag()['heightChecksum']!=seedA['heightChecksum'],diag())
    good=diag();run('fill','#seed','-1');run('click','#regenerate');check('Invalid seed is rejected with a visible error and preserved terrain',diag()['heightChecksum']==good['heightChecksum'] and ev("document.getElementById('seed').getAttribute('aria-invalid')")=='true',ev("document.getElementById('toast').textContent"));shot('invalid-seed.png');run('fill','#seed','7331');run('click','#regenerate')
    # Keyboard tab navigation and display controls.
    run('focus','#tab-terrain');run('press','ArrowRight');check('Arrow keys navigate control tabs',ev("document.getElementById('tab-display').getAttribute('aria-selected')")=='true')
    frozen=diag();focuskey('#exaggeration','End');focuskey('#light','Home');focuskey('#waterOpacity','Home');run('check','#grid');run('uncheck','#contours');check('Display parameters change the view while preserving solver state',diag()['heightChecksum']==frozen['heightChecksum'] and ev('window.strata.view')['exaggeration']==2.5 and ev('window.strata.view')['waterOpacity']==0 and ev('window.strata.view')['grid'],ev('window.strata.view'));shot('display-controls.png')
    focuskey('#exaggeration','Home');run('press','ArrowRight');focuskey('#waterOpacity','End');run('uncheck','#grid');run('check','#contours');run('click','#resetCamera')
    run('find','role','tab','click','--name','Simulation','--exact');run('focus','#viewport');run('press','Space');check('Space resumes the simulation',not diag()['paused']);run('press','Space');check('Space pauses the simulation',diag()['paused']);steps=diag()['steps'];run('press','n');check('N advances a single step',diag()['steps']==steps+1)
    run('press','6');check('Number shortcut selects water tool',ev('window.strata.tool')=='water');oldRadius=ev("Number(document.getElementById('radius').value)");run('press',']');check('Bracket shortcut changes brush radius',ev("Number(document.getElementById('radius').value)")>oldRadius)
    run('find','role','button','click','--name','Open laboratory guide','--exact');check('Guide opens and takes keyboard focus',not ev("document.getElementById('helpModal').hidden") and ev('document.activeElement.id')=='closeHelp');run('press','Escape');check('Escape closes guide',ev("document.getElementById('helpModal').hidden"))
    # All presets are actual distinct terrains; stress evolves in live browser.
    checksums=[]
    for preset in ['mountain','canyon','island','valley','stress']:
        run('select','#preset',preset);d=diag();checksums.append(d['heightChecksum']);check('Preset '+preset+' initializes genuine terrain',d['time']==0 and d['recoveries']==0 and d['glError']==0,d);shot('preset-'+preset+'.png')
    check('Distinct landforms have distinct geometries',len(set(checksums[:4]))==4,checksums)
    focuskey('#speed','End');run('select','#substeps','12');stress=run_until(10);check('Aggressive preset stays finite without numerical recovery',stress['recoveries']==0 and ev('Array.from(window.strata.model.h).every(Number.isFinite)') and stress['glError']==0,stress);shot('stress-evolved.png')
    print('Desktop workflow complete',flush=True)
except Exception as error:
    print('STOPPED '+str(error),flush=True);shot('workflow-failure.png');sys.exit(1)
