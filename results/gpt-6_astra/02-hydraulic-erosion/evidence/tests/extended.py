from importlib.machinery import SourceFileLoader
from pathlib import Path
import subprocess,json,time
m=SourceFileLoader('actions',str(Path(__file__).with_name('browser-actions.py'))).load_module()
ab,js,snap,drag,root=m.ab,m.js,m.snap,m.drag,m.root
results={}
def click(name):return ab('find','role','button','click','--name',name)
def tab(name):return ab('find','role','tab','click','--name',name)
def cdp(method,params):
 p=subprocess.run(['node',str(root/'tests/cdp.mjs'),method,json.dumps(params)],text=True,capture_output=True,check=True);return p.stdout

def wait_state(expr):ab('wait','--fn',expr)
def save(): (root/'logs/extended-results.json').write_text(json.dumps(results,indent=2))
# Real labeled keyboard editing, invalid seed, deterministic generation.
ab('find','label','Landscape seed','fill','-1');before=js('window.terra.diagnostics()');click('Regenerate terrain');assert 'whole-number' in ab('get','text','#toast');assert js('window.terra.diagnostics().time')==before['time'];results['invalid_seed']='Rejected without changing simulation';save()
ab('find','label','Landscape seed','fill','4242');ab('find','label','Landscape seed','press','Enter') if False else ab('press','Enter');wait_state('sim.seed === 4242 && sim.t === 0');first=js('Array.from(sim.h)');click('Regenerate terrain');assert js('Array.from(sim.h)')==first;results['deterministic_regeneration']={'seed':4242,'identical_cells':len(first)};save()
ab('focus','#radius');ab('press','End');assert js('window.terra.diagnostics().brush.radius')==30
ab('focus','#strength');ab('press','End');assert js('window.terra.diagnostics().brush.strength')==100
click('Close parameters');wait_state('document.getElementById("sidebar").getBoundingClientRect().left >= innerWidth')
click('Inspect values');ab('mouse','move','230','450');assert js('hover !== null');assert 'm' in ab('get','text','#probe-h');snap('18-mobile-probe.png');results['probe']={'text':ab('get','text','#probe'),'hit':js('hover')};save()
# Keyboard pause and single step, independent of buttons.
ab('focus','#scene');t=js('sim.t');ab('press','Space');wait_state('sim.t > 1');ab('press','Space');t=js('sim.t');time.sleep(.3);assert js('sim.t')==t;ab('press','.');assert abs(js('sim.t')-t-.08)<1e-9;results['keyboard_pause_step']='Space resumes/pauses; period advances 0.08 s';save()
# Inspect modes without resetting state.
t=js('sim.t');h=js('window.terra.diagnostics().terrain');records=[]
for mode in range(7):
 ab('select','#view-mode',mode);wait_state('state.mode === '+str(mode));d=js('window.terra.diagnostics()');assert d['time']==t and d['terrain']==h
 snap('mode-'+str(mode)+'-mobile.png');records.append(d['mode'])
results['seven_modes_preserve_state']=records;save()
# Reset with the actual button resets time, water, sediment and geometry.
click('Reset simulation');d=js('window.terra.diagnostics()');assert d['time']==0 and d['sediment']==0 and d['absoluteChange']==0;assert js('Array.from(sim.h)')==first;results['reset']=d;save()
# Use desktop for remaining tests and real downloads.
ab('set','viewport','1280','800');wait_state('document.getElementById("sidebar").getBoundingClientRect().right <= innerWidth + 1');click('Reset camera');tab('Terrain');ab('select','#resolution','64');assert js('sim.n')==64
click('Regenerate terrain');baseline=js('window.terra.diagnostics()');assert baseline['time']==0
# Paused sculpting: smoothing reduces neighbor variation, flatten reduces range.
click('Raise terrain');drag([(465,405),(475,409)],.8)
# Metrics over a stable picked patch, not a screenshot-only check.
ab('mouse','move',475,409);js('window.patch = {x:Math.round(hover.gx),z:Math.round(hover.gz)}')
patch_metric='(() => {let a=[];for(let z=patch.z-3;z<=patch.z+3;z++)for(let x=patch.x-3;x<=patch.x+3;x++)a.push(sim.h[z*sim.n+x]);let avg=a.reduce((a,b)=>a+b)/a.length;return {variance:a.reduce((v,h)=>v+(h-avg)**2,0)/a.length,range:Math.max(...a)-Math.min(...a)}})()'
b=js(patch_metric);click('Smooth terrain');drag([(475,409),(475,409)],1.3);a=js(patch_metric);assert a['variance']<b['variance'];results['smooth']={'before':b,'after':a};save()
click('Flatten terrain');b=js(patch_metric);drag([(475,409),(475,409)],1.3);a=js(patch_metric);assert a['range']<b['range'];results['flatten']={'before':b,'after':a};save()
# Right drag and shift drag preserve sculpted terrain with brush selected.
h=js('window.terra.diagnostics().terrain');before=js('window.terra.diagnostics().camera');ab('mouse','move',550,420);ab('mouse','down','right');ab('mouse','move',610,435);ab('mouse','up','right');after=js('window.terra.diagnostics().camera');assert before['yaw']!=after['yaw'];assert js('window.terra.diagnostics().terrain')==h;results['right_drag_orbit']=True;save()
cdp('Input.dispatchMouseEvent',{'type':'mousePressed','x':550,'y':420,'button':'left','buttons':1,'modifiers':8,'clickCount':1});cdp('Input.dispatchMouseEvent',{'type':'mouseMoved','x':590,'y':455,'buttons':1,'modifiers':8});cdp('Input.dispatchMouseEvent',{'type':'mouseReleased','x':590,'y':455,'button':'left','buttons':0,'modifiers':8,'clickCount':1});afterpan=js('window.terra.diagnostics().camera');assert afterpan['panX']!=after['panX'];assert js('window.terra.diagnostics().terrain')==h;results['shift_pan']=afterpan;save()
# State export, mutate, and import, comparing every array and full state.
click('Reset camera');click('Add water');drag([(530,425),(550,430)],.6);ab('select','#view-mode','4')
cdp('Browser.setDownloadBehavior',{'behavior':'allow','downloadPath':str(root/'downloads'),'eventsEnabled':True})
click('Single step');expected=json.loads(js('JSON.stringify(window.terra.snapshot())'));click('Export');ab('download','#export-json',root/'downloads'/('terra-'+str(expected['seed'])+'-state.json'))
jsonfile=root/'downloads'/('terra-'+str(expected['seed'])+'-state.json');assert jsonfile.exists();ondisk=json.loads(jsonfile.read_text());assert ondisk==expected;results['json_export_bytes']=jsonfile.stat().st_size;save()
click('Reset simulation');click('Export');click('Import simulation');ab('upload','#file-input',jsonfile);wait_state('document.getElementById("toast").textContent.startsWith("Simulation restored")');restored=json.loads(js('JSON.stringify(window.terra.snapshot())'));assert restored==expected;results['json_roundtrip']='Exact equality of all nine arrays, counters, parameters, generation settings, view, brush, pause and camera';save()
click('Export');ab('download','#export-png',root/'downloads'/('terra-'+str(expected['seed'])+'-heightfield.png'));pngfile=root/'downloads'/('terra-'+str(expected['seed'])+'-heightfield.png');assert pngfile.exists();results['png_export_bytes']=pngfile.stat().st_size;save()
# Corrupt import must be atomic.
bad=root/'tests/invalid-state.json';bad.write_text('{"format":"terra-hydraulic-lab","version":1,"n":999999}')
click('Export');click('Import simulation');ab('upload','#file-input',bad);wait_state('document.getElementById("toast").textContent.startsWith("Import failed:")');assert json.loads(js('JSON.stringify(window.terra.snapshot())'))==expected;results['invalid_import']=ab('get','text','#toast');snap('19-invalid-import.png');save()
# Invalid array values are rejected too.
bad_data=json.loads(jsonfile.read_text());bad_data['layers']['w'][0]=-4;bad.write_text(json.dumps(bad_data));click('Export');click('Import simulation');ab('upload','#file-input',bad);wait_state('document.getElementById("toast").textContent.includes("Out-of-range")');assert json.loads(js('JSON.stringify(window.terra.snapshot())'))==expected;results['negative_water_import']='Rejected atomically';save()
print(json.dumps({k:v for k,v in results.items() if k!='reset'},indent=2))
