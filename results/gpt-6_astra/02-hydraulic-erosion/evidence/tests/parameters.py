from importlib.machinery import SourceFileLoader
from pathlib import Path
import json,time
m=SourceFileLoader('actions',str(Path(__file__).with_name('browser-actions.py'))).load_module();ab,js,snap,root=m.ab,m.js,m.snap,m.root
out={}
def click(name):ab('find','role','button','click','--name',name)
def tab(name):ab('find','role','tab','click','--name',name)
def bound(key,which):ab('focus','#'+key);ab('press',which)
def steps(count):
 for _ in range(count):ab('click','#step')
def save():(root/'logs/parameter-results.json').write_text(json.dumps(out,indent=2))
# Start the final artifact directly, still offline.
ab('reload');ab('wait','--fn','window.terra.diagnostics().time > 1');click('Pause simulation');tab('Terrain');ab('select','#resolution','64');ab('find','label','Landscape seed','fill','7319');click('Regenerate terrain');tab('Simulation');bound('thermal','Home');bound('erosion','Home');click('Reset simulation');steps(100);low=js('window.terra.diagnostics()');assert low['eroded']==0 and low['sediment']==0
bound('erosion','End');click('Reset simulation');steps(100);high=js('window.terra.diagnostics()');assert high['eroded']>100 and high['sediment']>10;assert abs(low['time']-high['time'])<1e-9;out['erosion_comparison']={'zero':low,'maximum':high};save()
# Same initial water, no flow/rain: exponential evaporation alone.
bound('rain','Home');bound('flow','Home');bound('erosion','Home');bound('evap','Home');click('Reset simulation');initial=js('window.terra.diagnostics().water');steps(100);none=js('window.terra.diagnostics()');assert abs(none['water']-initial)<.001
bound('evap','End');click('Reset simulation');steps(100);fast=js('window.terra.diagnostics()');assert fast['water']<initial*.03;assert fast['evaporated']>initial*.95;out['evaporation_comparison']={'initial_water':initial,'zero_evap':none['water'],'max_evap':fast['water'],'evaporated':fast['evaporated'],'time':fast['time']};save()
# Exercise each actual preset under rainfall.
presets=[]
for key in ['mountain','canyon','island','valley','stress']:
 ab('select','#preset',key);click('Resume simulation');ab('wait','--fn','sim.t > 4');click('Pause simulation');d=js('window.terra.diagnostics()');assert d['time']>4 and d['absoluteChange']>1 and d['repairs']==0;d['preset']=key;presets.append(d);snap('preset-'+key+'.png')
out['presets']=presets;save()
# Hot resolution/speed/substep changes. Native select + keyboard input while running.
ab('select','#preset','mountain');click('Resume simulation');tab('Terrain');ab('select','#resolution','192');ab('wait','--fn','sim.n === 192 && sim.t > 1');tab('Simulation');bound('speed','End');ab('select','#substeps','8');ab('wait','--fn','sim.t > 3');d=js('window.terra.diagnostics()');assert d['n']==192 and d['repairs']==0
ab('select','#substeps','1');tab('Terrain');ab('select','#resolution','256');ab('wait','--fn','sim.n === 256 && sim.t > 4');click('Pause simulation');out['hot_settings']=js('window.terra.diagnostics()');assert out['hot_settings']['repairs']==0;save()
# Change appearance while paused; only the view changes.
ab('select','#resolution','128');tab('Display');base=js('window.terra.diagnostics()');bound('exaggeration','End');bound('light','Home');ab('uncheck','#show-water');ab('uncheck','#contours');ab('uncheck','#grid');ab('uncheck','#flow-lines');snap('20-display-controls.png');after=js('window.terra.diagnostics()');assert after['terrain']==base['terrain'] and after['time']==base['time'];out['display_preserves_state']=True;save()
# Help dialog keyboard focus returns to the opener.
click('Field guide');assert js('document.activeElement.id')=='close-help';ab('press','Tab');assert js('document.activeElement.id')=='start-exploring';ab('press','Tab');assert js('document.activeElement.id')=='close-help';ab('press','Escape');assert not js('document.getElementById("help-modal").classList.contains("open")');out['field_guide_keyboard']='Dialog opens, focus cycles inside it, Escape closes';save()
print(json.dumps({k:v for k,v in out.items() if k not in ['presets','erosion_comparison']},indent=2));print('Erosion:',low['eroded'],'vs',high['eroded']);print('Five presets passed')
