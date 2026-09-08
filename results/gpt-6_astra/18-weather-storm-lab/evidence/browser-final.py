from pathlib import Path
exec(Path('evidence/browser-flows.py').read_text().split('\ntry:\n')[0].replace('results={}',"results=json.loads((root/'logs/browser-results.json').read_text())"))
def cdp(*args):
 cmd=['node',str(root/'cdp-input.cjs'),*map(str,args)];log.write('$ '+shlex.join(cmd)+'\n');subprocess.run(cmd,check=True,stdout=log,stderr=log,timeout=20)
def load(path):
 run('upload','#stateFile',str(path));run('wait','--fn','document.getElementById("stateFile").value === ""')
try:
 run('snapshot','-i')
 if js('document.getElementById("settingsDialog").open'):button('Close settings')
 if not diag('final-start')['paused']:button('Pause simulation')
 # Held keyboard + pointer fly-through and complete state roundtrip.
 button('Toggle fly-through camera');run('focus','#weatherCanvas');flyA=diag('fly-before');cdp('key','KeyW','w',700);drag([(800,420),(830,405)]);flyB=diag('fly-after')
 check('fly-keyboard-look',flyB['camera']['fly'] and flyA['camera']['flyPos']!=flyB['camera']['flyPos'] and flyA['camera']['flyYaw']!=flyB['camera']['flyYaw'])
 run('download','#saveState',str(root/'fly-state.json'));saved=diag('save-roundtrip-before');button('Toggle fly-through camera');button('Add heat');button('Open settings');load(root/'fly-state.json');run('wait','--text','Experiment restored');loaded=diag('save-roundtrip-after')
 check('complete-state-roundtrip',saved['fields']==loaded['fields'] and saved['time']==loaded['time'] and saved['camera']==loaded['camera'] and loaded['tool']=='orbit',{'time':loaded['time'],'fly':loaded['camera']['fly']})
 shot('state-restored');button('Close settings');run('focus','#weatherCanvas');run('press','Escape')
 # Malformed imports leave the model and camera intact.
 state=json.loads((root/'fly-state.json').read_text());bad=dict(state);bad['ui']=json.loads(json.dumps(state['ui']));bad['ui']['effects']['bolt']={};(root/'invalid-effects.json').write_text(json.dumps(bad))
 bad=dict(state);bad['preset']=['supercell'];(root/'invalid-preset.json').write_text(json.dumps(bad))
 bad=dict(state);bad['t']=[0];(root/'invalid-fields.json').write_text(json.dumps(bad))
 (root/'invalid-json.json').write_text('{broken state')
 button('Open settings');before=diag('invalid-import-before')
 for file in ['invalid-effects.json','invalid-preset.json','invalid-fields.json','invalid-json.json']:
  load(root/file);run('wait','--text','Import rejected');after=diag(file.replace('.json',''))
  check('reject-'+file,after['ready'] and after['fields']==before['fields'] and after['time']==before['time'] and after['camera']==before['camera'],run('get','text','#fileStatus').strip())
 shot('invalid-import-rejected')
 # Change dt via labeled slider and demonstrate automatic subdivisions in stress scenario.
 run('focus','#control-dt');run('press','End');check('timestep-control',js('weatherLab.simulation.params.dt')==12)
 button('Close settings');run('select','#presetSelect','stress');button('Advance one simulation step');stress=diag('stress-live')
 check('stress-stability',stress['stats']['finite'] and stress['stats']['cfl']<=.80001 and stress['stats']['substeps']>1,stress['stats'])
 run('select','#presetSelect','supercell');button('Map');run('select','#modeSelect','9');button('Orbit camera')
 box=js("(()=>{let r=document.getElementById('weatherCanvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()")
 x=round(box['x']+box['w']/2);y=round(box['y']+box['h']/2)
 mapA=diag('map-nav-before');cdp('wheel',x,y,-200);drag([(x,y),(x+22,y+12)]);mapB=diag('map-nav-after')
 check('map-pan-zoom',mapB['camera']['mapZoom']<mapA['camera']['mapZoom'] and mapB['camera']['mapCenter']!=mapA['camera']['mapCenter'])
 # Continuous controls, radius and strength; all remaining brush classes.
 run('focus','#control-radius');run('press','End');run('focus','#control-strength');run('press','End');check('brush-radius-strength',diag('brush-settings')['settings']['radius']==5 and diag('brush-settings')['settings']['strength']==3)
 def field_info():return js("({t:weatherLab.simulation.t.reduce((a,b)=>a+b,0),q:weatherLab.simulation.q.reduce((a,b)=>a+b,0),p:weatherLab.simulation.p.reduce((a,b)=>a+b,0),c:weatherLab.simulation.c.reduce((a,b)=>a+b,0),terrain:weatherLab.simulation.terrain.reduce((a,b)=>a+b,0),surface:weatherLab.simulation.surface.reduce((a,b,i)=>a+b*(i+1),0)})")
 for tool,label,key,sign in [('cool','Cool brush','t',-1),('dry','Dry brush','q',-1),('pressure','Pressure brush','p',-1)]:
  button(label);prior=field_info();drag([(x-8,y),(x+8,y+8)]);after=field_info();check('tool-'+tool,(after[key]-prior[key])*sign>0,{'before':prior[key],'after':after[key]})
 button('Terrain & surface tools +')
 for tool,label,key,sign in [('cloud','Seed cloud brush','c',1),('raise','Raise brush','terrain',1),('lower','Lower brush','terrain',-1),('lake','Lake brush','surface',0),('forest','Forest brush','surface',0),('city','City brush','surface',0),('ocean','Ocean brush','surface',0)]:
  button(label);prior=field_info();drag([(x-8,y),(x+8,y+8)]);after=field_info();check('tool-'+tool,(after[key]-prior[key])*sign>0 if sign else after[key]!=prior[key],{'before':prior[key],'after':after[key]})
 shot('terrain-intervention')
 # Every scenario actually applies distinct state; cold snowfall and strong stress included.
 checks=[]
 for preset in ['cumulus','sea','mountain','squall','supercell','cyclone','front','heat','snow','stress']:
  run('select','#presetSelect',preset);button('Advance one simulation step');d=diag('preset-'+preset);checks.append((preset,d['fields']['q']['checksum'],d['fields']['w']['checksum']));check('preset-'+preset,d['preset']==preset and d['stats']['finite'] and d['steps']==1)
 check('presets-distinct',len(set((q,w) for _,q,w in checks))==10)
 run('select','#presetSelect','snow');button('3D view');run('select','#modeSelect','0');shot('snow-band')
 # Normal keyboard shortcuts work outside input fields.
 run('focus','#weatherCanvas');run('press','Space');run('wait','--fn','weatherLab.diagnostics().steps > 2');run('press','Space');k=diag('keyboard-pause');run('press','.');k2=diag('keyboard-step');check('keyboard-pause-step',k['paused'] and k2['steps']==k['steps']+1 and k2['paused'])
 # Settings persistence across real file reload.
 button('Open settings');run('select','#qualitySelect','low');run('focus','#control-exposure');run('press','Home');before=diag('persistence-before');button('Close settings');run('reload');after=diag('persistence-after');check('settings-persistence',after['settings']['exposure']==.5 and after['settings']['quality']=='low' and after['dimensions']==before['dimensions'] and after['preset']=='snow')
 button('Pause simulation');run('select','#presetSelect','supercell');button('Open settings');run('select','#qualitySelect','balanced');run('focus','#control-exposure');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');run('press','ArrowRight');button('Close settings')
 # Narrow viewport: page, drawer, fitted map, real touch strokes, pinch, probe, navigation.
 run('set','viewport','390','844');run('snapshot','-i');shot('mobile-390x844');check('mobile-no-overflow',js('document.documentElement.scrollWidth<=innerWidth'),js('({viewport:innerWidth,scroll:document.documentElement.scrollWidth})'))
 button('Open experiment controls');shot('mobile-controls');run('select','#presetSelect','mountain');button('Experiment controls');check('mobile-preset',diag('mobile-preset')['preset']=='mountain')
 button('Map');run('select','#modeSelect','2');shot('mobile-map-fit');box=js("(()=>{let r=document.getElementById('weatherCanvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()")
 x=round(box['x']+box['w']/2);y=round(box['y']+box['h']/2+30)
 button('Inject moisture');a=diag('touch-before');cdp('touch',x-40,y,x+40,y+25);b=diag('touch-after');check('touch-brush-continuity',b['fields']['q']['checksum']!=a['fields']['q']['checksum'] and b['input']['activePointers']==0 and b['input']['brushStrokes']>a['input']['brushStrokes'])
 button('Orbit camera');a=diag('pinch-before');cdp('pinch',x,y,80,145);b=diag('pinch-after');check('touch-pinch-zoom',b['camera']['mapZoom']<a['camera']['mapZoom'] and b['input']['activePointers']==0)
 button('Place probe');cdp('touch',x+60,y,x+60,y);button('Inspect vertical probe column');shot('mobile-probe');button('Close probe');button('3D view');run('select','#modeSelect','0');button('Resume simulation');run('wait','--fn','weatherLab.diagnostics().steps > 12');button('Pause simulation');shot('mobile-weather-final')
 check('mobile-rendering',diag('mobile-final')['ready'])
 # High DPI resize, final logs.
 run('set','viewport','1280','800','2');button('Open settings');run('select','#qualitySelect','low');button('Close settings');d=diag('high-dpi');check('high-dpi-resize',js('devicePixelRatio')==2 and d['ready'])
 run('set','viewport','1280','800','1');run('select','#presetSelect','supercell');button('Open settings');run('select','#resolutionSelect','32');run('select','#layersSelect','12');run('select','#qualitySelect','balanced');run('uncheck','#vectorsToggle');button('Close settings');button('Reset simulation');button('Resume simulation');run('wait','--fn','weatherLab.diagnostics().time >= 75');button('Pause simulation');shot('desktop-final');diag('final-desktop');run('console');run('errors');run('network','requests');
 print('FINAL FLOWS FINISHED',flush=True)
except Exception as e:
 log.write('FAILURE: '+repr(e)+'\n');print('FAILED:',repr(e),flush=True);sys.exit(1)
