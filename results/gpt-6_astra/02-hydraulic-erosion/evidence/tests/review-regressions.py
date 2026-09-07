from importlib.machinery import SourceFileLoader
from pathlib import Path
import json,math
m=SourceFileLoader('actions',str(Path(__file__).with_name('browser-actions.py'))).load_module();ab,js,root=m.ab,m.js,m.root
out={}
def click(name):ab('find','role','button','click','--name',name)
def exact():return json.loads(js('JSON.stringify(window.terra.snapshot())'))
def upload(path):click('Export');click('Import simulation');ab('upload','#file-input',path)
def wait_ok():ab('wait','--fn','document.getElementById("toast").textContent.startsWith("Simulation restored")')
# Independently authored uniform-water import validates domain integration and resampling.
data=exact();n=data['n'];data['settings']['paused']=True;data['camera']['yaw']=101;fixture=root/'tests/periodic-camera.json';fixture.write_text(json.dumps(data));upload(fixture);wait_ok();assert abs(js('camera.yaw')-101%(2*math.pi))<1e-12;out['periodic_camera_import']=js('camera.yaw')
expected=exact();click('Export');path=root/'downloads/periodic-camera-roundtrip.json';ab('download','#export-json',path);assert json.loads(path.read_text())==expected;click('Reset simulation');upload(path);wait_ok();assert exact()==expected;out['periodic_camera_roundtrip']=True
bad=dict(expected);bad['n']=32;invalid=root/'tests/unsupported-grid.json';invalid.write_text(json.dumps(bad));upload(invalid);ab('wait','--fn','document.getElementById("toast").textContent.startsWith("Import failed:")');assert exact()==expected;out['unsupported_grid_rejected']=True
uniform=exact();uniform['layers']['w']=[1]*(n*n);uniform['layers']['s']=[.25]*(n*n);uniform['layers']['initialWater']=[1]*(n*n);uniform['layers']['q']=[0]*(n*n*4);uniform['layers']['vx']=uniform['layers']['vz']=[0]*(n*n);uf=root/'tests/uniform-water.json';uf.write_text(json.dumps(uniform));upload(uf);wait_ok();ab('find','role','tab','click','--name','Terrain');volumes=[]
for size in [64,128,256,96,128]:
 ab('select','#resolution',size);d=js('window.terra.diagnostics()');assert abs(d['water']-40000)<.01 and abs(d['sediment']-10000)<.01;volumes.append({'resolution':size,'water':d['water'],'sediment':d['sediment']})
out['uniform_resampling']=volumes
# Non-finite internal fault must recover all diagnostics and remain exportable.
js('sim.s[600]=NaN; true');click('Single step');d=js('window.terra.diagnostics()');assert d['repairs']>0;assert all(not isinstance(v,float) or math.isfinite(v) for v in d.values());assert js('[sim.h,sim.w,sim.s,sim.delta,sim.vx,sim.vz,sim.q].every(a=>a.every(Number.isFinite))');out['numerical_fault_recovered']={'repairs':d['repairs'],'eroded':d['eroded'],'water':d['water'],'sediment':d['sediment']}
repaired=exact();rf=root/'downloads/recovered-state.json';click('Export');ab('download','#export-json',rf);click('Reset simulation');upload(rf);wait_ok();assert exact()==repaired;out['recovered_state_roundtrip']=True
(root/'logs/review-regressions.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
