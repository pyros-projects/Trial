import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('driver',Path(__file__).parent/'browser-checks.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
for k,v in vars(d).items():
 if not k.startswith('_'):globals()[k]=v
results=[]
def check(name,fn):
 try:
  observed=fn();r={'name':name,'status':'pass','observed':observed};print('PASS',name,json.dumps(observed),flush=True)
 except Exception as e:
  r={'name':name,'status':'fail','error':str(e)};print('FAIL',name,repr(e),flush=True)
  snap('extended-fail-'+str(len(results))+'.png')
  try:release()
  except:pass
 results.append(r);(ROOT/'logs'/'extended-results.json').write_text(json.dumps(results,indent=2))

def navigation():
 ensurepause();click('Load The playground');click('Resume simulation');click('Field guide');assert state()['paused'];assert js("document.getElementById('guide').open");snap('12-field-guide.png');ab('press','Escape');assert not js("document.getElementById('guide').open");assert not state()['paused'];ab('focus','#world');ab('press','Space');assert state()['paused']
 for key,tool in [('p','pin'),('c','cut'),('t','tear'),('f','force'),('w','wind'),('g','grab')]:ab('press',key);assert state()['tool']==tool
 start=state()['frames'];ab('press','.');assert state()['frames']==start+1
 ab('focus','#tab-world');ab('press','ArrowRight');assert js("document.getElementById('tab-material').getAttribute('aria-selected')")== 'true'
 return {'dialogRestoredRunningState':True,'keyboardTools':6,'keyboardStep':1,'tabArrowNavigation':True}
def spawn_errors_density():
 ensurepause();click('Load The playground');before=state()['stats']['particles'];click('Add object');click('Spawn balloon');ab('press','Escape');assert state()['pending'] is None;assert state()['stats']['particles']==before
 click('Pin / unpin (P)');move(45,510);ab('mouse','down');ab('mouse','up');msg=js("document.getElementById('toast').textContent");assert 'No point' in msg
 ab('click','#tab-material');setrange('density',False);click('Add object');click('Spawn ball');move(800,310);ab('mouse','down');ab('mouse','up');s=state();b=s['bodies'][-1];masses=[p['mass'] for p in s['particles'] if p['body']==b['id']];assert all(abs(m-6.8)<1e-8 for m in masses)
 click('Reset scene');click('Restore default settings')
 for i in range(9):
  click('Add object');click('Spawn cloth');move(400+(i%3)*70,170+(i//3)*80);ab('mouse','down');ab('mouse','up')
 s=state();msg=js("document.getElementById('toast').textContent");assert s['stats']['particles']==1307;assert s['pending']=='cloth';assert 'full' in msg;snap('13-capacity-feedback.png');ab('press','Escape');assert state()['pending'] is None;click('Reset scene')
 return {'cancelKeptParticleCount':before,'missFeedback':True,'newBallMassAtDensity4':masses[0],'capacityStoppedAt':s['stats']['particles'],'capacityMessage':msg}
def balloon_pressure():
 click('Load Balloon chamber');before=state();s=runframes(120);stable=[b['area']/b['restArea'] for b in s['bodies']];assert all(.7<r<1.3 for r in stable)
 ab('click','#tab-material');setrange('pressure',True);t=runframes(100);flat=[b['area']/b['restArea'] for b in t['bodies']];assert sum(flat)<sum(stable)-1;snap('14-pressure-off.png')
 click('Reset scene');click('Restore default settings');p=state()['particles'][0];click('Cut constraints (C)');move(p['x']-5,p['y']-7);ab('mouse','down');move(p['x']+12,p['y']+8);release();u=state();assert not u['bodies'][0]['closed'];z=runframes(80);snap('15-punctured-balloon.png');return {'stableAreaRatios':stable,'pressureZeroAreaRatios':flat,'puncturedClosed':u['bodies'][0]['closed'],'afterPunctureStats':z['stats']}
def png_export():
 click('Load The playground');ab('select','#view-mode','material');runframes(35);ab('download','#snapshot',str(ROOT/'softlab-export.png'));data=(ROOT/'softlab-export.png').read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';return {'bytes':len(data),'signature':'PNG'}
def mobile_resize():
 ensurepause();s=state();before=[(p['x'],p['y']) for p in s['particles']];ab('set','viewport',390,844,2);ab('snapshot','-i');t=state();assert [(p['x'],p['y']) for p in t['particles']]==before;assert t['camera']['dpr']==2;dim=js("({width:innerWidth,scroll:document.documentElement.scrollWidth,canvasWidth:document.getElementById('world').width,cssWidth:document.getElementById('world').getBoundingClientRect().width})");assert dim['scroll']==390;assert abs(dim['canvasWidth']-dim['cssWidth']*2)<=1;snap('16-mobile-full.png');ab('screenshot','--full',str(ROOT/'screenshots'/'17-mobile-full-page.png'));return {'worldPositionsPreserved':len(before),'dimensions':dim,'camera':t['camera']}
def mobile_pointer():
 ab('scrollintoview','#world');click('Grab & drag (G)');s=state();p=s['particles'][250];t=drag(p,85,45,7);release();u=state();dist=math.dist((p['x'],p['y']),(u['particles'][p['id']]['x'],u['particles'][p['id']]['y']));assert dist>45
 click('Pin / unpin (P)');p=u['particles'][200];pins=state()['stats']['pins'];pointclick(p);v=state();assert v['stats']['pins']==pins+1;pointclick(p);assert state()['stats']['pins']==pins
 click('Cut constraints (C)');before=state()['stats']['constraints'];move(290,105);ab('mouse','down');move(290,360);release();after=state()['stats']['constraints'];assert after<before;snap('18-mobile-cut.png')
 click('Zoom in');assert state()['camera']['zoom']>1;click('Fit world to canvas');assert state()['camera']['zoom']==1;return {'grabDistance':dist,'pinUnpin':True,'cutLinks':before-after,'zoomAndFit':True}
def mobile_settings():
 ab('click','#tab-world');click('Gravity up');assert state()['settings']['direction']==270;setrange('gravity',False);assert state()['settings']['gravity']==25
 ab('click','#tab-solver');ab('uncheck','#selfCollision');assert not state()['settings']['selfCollision'];ab('check','#selfCollision');setrange('iterations',False,5);assert state()['settings']['iterations']==15
 ab('scrollintoview','#world');click('Add object');click('Spawn balloon');s=state();move(760,320);ab('mouse','down');ab('mouse','up');t=state();assert t['stats']['particles']==s['stats']['particles']+28;snap('19-mobile-spawn.png')
 click('Load Hanging flag');ab('scrollintoview','#world');u=runframes(50);assert u['scenario']=='flag';assert all(math.isfinite(p['x']) and math.isfinite(p['y']) for p in u['particles']);snap('20-mobile-flag.png');return {'gravityAndDirection':True,'selfCollisionToggle':True,'iterations':15,'spawnedParticles':28,'scenario':u['scenario'],'stats':u['stats']}
def final_desktop():
 ensurepause();before=state();ab('set','viewport',1280,800,2);ab('scroll','up',2000);after=state();assert [(p['x'],p['y']) for p in before['particles']]==[(p['x'],p['y']) for p in after['particles']]
 click('Load The playground');click('Grab & drag (G)');ab('select','#view-mode','material');ab('click','#tab-world');runframes(80);ab('scroll','up',2000);snap('21-desktop-final-hidpi.png')
 errors=ab('errors');console=ab('console');requests=ab('network','requests');resources=js("performance.getEntriesByType('resource').map(r=>r.name)");assert not errors and not console;assert not resources
 return {'resizePreservedCoordinates':True,'errors':errors,'console':console,'resources':resources,'network':requests,'metrics':js('softlab.metrics')}
check('Keyboard navigation, guide, shortcuts and pause restoration',navigation)
check('Placement cancellation, empty hit, object density and capacity error',spawn_errors_density)
check('Live pressure change and real balloon puncture',balloon_pressure)
check('Canvas snapshot downloads a genuine PNG',png_export)
check('390x844 high-DPI resize with stable world and no horizontal overflow',mobile_resize)
check('Narrow viewport real grab, pin/unpin, swept cut and zoom',mobile_pointer)
check('Narrow settings, spawn and scenario navigation',mobile_settings)
check('Return to desktop, inspect console, network and high-DPI screenshot',final_desktop)
