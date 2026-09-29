source=open('evidence/browser-tests.py').read().split("run('set','viewport',1280,800)")[0]
source=source.replace('browser-transcript.txt','final-transcript.txt').replace('browser-results.json','final-results.json').replace("'failure-'","'final-failure-'")
exec(source)

def clipboard_json():
    if not js('document.getElementById("storageSettings").open'):run('click','#storageSettings > summary')
    before=signature();click('jsonBtn');run('wait','--text','Complete state JSON copied.')
    click('clearBtn');click('pasteBtn');run('focus','#jsonText');run('press','Control+v');raw=run('get','value','#jsonText');saved=json.loads(raw);assert saved['format']=='materia' and saved['version']==1
    (E/'downloads/clipboard-state.json').write_text(raw)
    assert state()['stats']['active']==0
    click('importJson');run('wait','--fn','!document.getElementById("jsonDialog").open');assert signature()==before
    snap('29-clipboard-json-restored.png');return {'bytes':len(raw),'exact_restore_hash':before['hash'],'clipboard_and_valid_paste':True}
check('Copy state JSON and valid Paste state JSON round trip',clipboard_json)

# Return the actual labeled controls to their defaults before the final stress check.
if not js('document.getElementById("physicsSettings").open'):run('click','#physicsSettings > summary')
for id in ['heatRate','reactionRate','liquidMobility','gasDiffusion']:range_key(id,'Home',9)
for id in ['fireIntensity','explosionStrength']:range_key(id,'Home',8)
range_key('ambient','Home',16);run('select','#gravity','down');run('select','#speed','1');run('select','#substeps','1');run('fill','#seed','240891')

def largest_resolution():
    pause();run('select','#resolution','512');assert js('lab.world.w')==512
    run('select','#presetSelect','stress');run('wait','--fn','lab.world.steps>18');s=state();assert s['stats']['active']>60000
    start=time.monotonic();click('pauseBtn');latency=time.monotonic()-start;assert state()['paused']
    snap('30-stress-512.png');run('download','#saveBtn',str(E/'downloads/stress-512.json'))
    run('select','#resolution','160');assert js('lab.world.w')==160 and state()['stats']['active']>1000
    run('select','#resolution','256');assert js('lab.world.w')==256
    return {'grid':'512 × 320','active_cells':s['stats']['active'],'fps_observed':round(s['fps'],1),'pause_seconds':round(latency,3),'state_bytes':(E/'downloads/stress-512.json').stat().st_size,'160_and_256_resize_preserved_materials':True}
check('Maximum grid stress, saved state and all resolution choices',largest_resolution)

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
print('Final checks finished:',len(results),flush=True)
