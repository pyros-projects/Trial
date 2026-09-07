from importlib.machinery import SourceFileLoader
from pathlib import Path
import json,time
m=SourceFileLoader('actions',str(Path(__file__).with_name('browser-actions.py'))).load_module();ab,js,root=m.ab,m.js,m.root
ab('find','role','button','click','--name','Reset camera');ab('find','role','button','click','--name','Add water')
js('window.strokeSamples = [430,470,510].map(x=>pick(x,356)).map(p=>({i:Math.round(p.gz)*sim.n+Math.round(p.gx),w:sim.w[Math.round(p.gz)*sim.n+Math.round(p.gx)]}))')
before=js('window.terra.diagnostics()');ab('mouse','move',430,430);ab('mouse','down','left');time.sleep(.2)
for x in [450,470,490,510]:
 ab('press',']');ab('mouse','move',x,430);time.sleep(.18)
ab('mouse','move',1200,750);ab('mouse','up','left');after=js('window.terra.diagnostics()');time.sleep(.4);released=js('window.terra.diagnostics()');samples=js('strokeSamples.map(p=>({before:p.w,after:sim.w[p.i]}))')
assert all(p['after']>p['before'] for p in samples);assert after['brush']['radius']==before['brush']['radius']+4;assert after['camera']==before['camera'];assert released['water']==after['water'];assert after['time']==before['time']
out={'beforeWater':before['water'],'afterWater':after['water'],'samples':samples,'radiusBefore':before['brush']['radius'],'radiusAfter':after['brush']['radius'],'captureReleaseStopsPainting':True,'cameraUnchanged':True}
(root/'logs/continuity.json').write_text(json.dumps(out,indent=2));m.snap('26-continuous-stroke.png');print(json.dumps(out,indent=2))
