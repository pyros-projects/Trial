from pathlib import Path
exec(Path('evidence/browser-flows.py').read_text().split('\ntry:\n')[0].replace('results={}',"results=json.loads((root/'logs/browser-results.json').read_text())"))
try:
 a=diag('final-regression-before');check('optimized-render-ready',a['ready'] and a['paused'])
 button('Open settings');run('focus','#control-timeOfDay');run('press','Home');shot('night-rendering');night=diag('night-rendering');check('time-of-day-control',night['settings']['timeOfDay']==0 and night['fields']==a['fields'] and night['ready'])
 # Restore time of day with a real pointer on the labeled slider.
 r=js("(()=>{const e=document.getElementById('control-timeOfDay'),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()")
 x=round(r['x']+6+(r['w']-12)*15.5/24);y=round(r['y']+r['h']/2);run('mouse','move',x,y);run('mouse','down','left');run('mouse','up','left')
 run('select','#qualitySelect','high');shot('cinematic-quality');check('cinematic-quality',diag('cinematic-quality')['render']['cloudSamples']==88)
 run('select','#qualitySelect','balanced');run('fill','#seedInput','-1');run('click','#applySeed');check('invalid-seed',js('weatherLab.simulation.seed')==4821 and 'whole-number seed' in run('get','text','#toast'))
 run('fill','#seedInput','4821');run('download','#exportPng',str(root/'exported-final-view.png'));button('Close settings')
 button('Section');run('select','#modeSelect','7');shot('final-vertical-field');button('Map');run('select','#modeSelect','4');shot('final-precipitation-map');button('3D view');run('select','#modeSelect','0')
 button('Resume simulation');t=diag('optimized-before-step')['time'];run('wait','--fn',f'weatherLab.diagnostics().time > {t+24}');button('Pause simulation');after=diag('optimized-evolved');check('optimized-simulation-render',after['ready'] and after['fields']['c']!=a['fields']['c'] and after['render']['uploads']>a['render']['uploads'])
 run('set','viewport','390','844');button('Inspect vertical probe column');shot('final-mobile-probe');check('probe-heading',f"Probe {after['probe']['id']:02d}" in run('get','text','#probeDialog h2'));button('Close probe');button('Map');shot('final-mobile-map');button('3D view');shot('final-mobile-scene');check('final-mobile-layout',js('document.documentElement.scrollWidth')==390 and diag('final-mobile')['ready'])
 run('set','viewport','1280','800');shot('final-delivery-desktop');run('errors');run('console');run('network','requests');diag('final-delivery')
 # Print final checks; reports remain agent-authored, never an evaluator score.
 check('png-csv-downloads',(root/'exported-final-view.png').stat().st_size>1000 and (root/'exported-probe.csv').stat().st_size>300)
 print('FINAL REGRESSION FINISHED',flush=True)
except Exception as e:
 log.write('FAILURE: '+repr(e)+'\n');print('FAILED:',repr(e),flush=True);sys.exit(1)
