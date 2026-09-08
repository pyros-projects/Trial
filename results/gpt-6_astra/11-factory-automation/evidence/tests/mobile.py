import workflow as w
from workflow import *
w.SESSION='forge-mobile'
import re
def button(name):
    snap=ab('snapshot','-i')
    matches=[ref for label,ref in re.findall(r'- button "([^\"]+)" \[ref=(e[0-9]+)\]',snap) if label.strip()==name]
    if not matches:raise RuntimeError('Visible labeled button not found: '+name)
    out=ab('click','@'+matches[0])
    wait_for("(()=>{const l=document.querySelector('#build-panel'),r=document.querySelector('#stats-panel'),a=l.getBoundingClientRect(),b=r.getBoundingClientRect();return (l.classList.contains('open')?Math.abs(a.left)<.1:a.right<.1)&&(r.classList.contains('open')?Math.abs(b.right-innerWidth)<.1:b.left>innerWidth-.1);})()")
    return out
w.button=button
if ev("!!document.querySelector('.modal')"):button('Close dialog')
button('Factory')
# Start with the current preset and use only real user-facing controls.
loadpreset('Balanced factory');button('Build');wait_for("getComputedStyle(document.querySelector('#build-panel')).transform==='none'");button('Build Conveyor belt')
pause();before=len(diag()['structures'])
marker='forge-touch-'+str(time.time_ns());ev('window.__forgeValidationTarget='+json.dumps(marker));url=ab('get','cdp-url')
p=subprocess.run(['node',str(E/'tests'/'touch-input.js'),url,'draw','[[12,17],[16,17],[16,19]]',marker],capture_output=True,text=True,timeout=15)
(E/'logs'/'mobile-touch-draw.json').write_text(p.stdout+p.stderr)
assert p.returncode==0,p.stderr
assert structure(12,17) and structure(16,17)['dir']==1 and structure(16,19)
shot('12-mobile-touch-built.png');result('Mobile real touch belt drawing',{'before':before,'after':len(diag()['structures'])})
count=len(diag()['structures'])
p=subprocess.run(['node',str(E/'tests'/'touch-input.js'),url,'draw','[[13,19]]',marker],capture_output=True,text=True,timeout=15)
assert p.returncode==0,p.stderr
assert structure(13,19) and len(diag()['structures'])==count+1
result('Touch tap commits one building',{'cell':[13,19],'count':len(diag()['structures'])})
button('Pan camera (H)');old=diag()['camera']
p=subprocess.run(['node',str(E/'tests'/'touch-input.js'),url,'pinch','',marker],capture_output=True,text=True,timeout=15)
(E/'logs'/'mobile-touch-pinch.json').write_text(p.stdout+p.stderr)
assert p.returncode==0,p.stderr
assert diag()['camera']['z']>old['z']*1.5
p=subprocess.run(['node',str(E/'tests'/'touch-input.js'),url,'pan','',marker],capture_output=True,text=True,timeout=15)
(E/'logs'/'mobile-touch-pan.json').write_text(p.stdout+p.stderr)
assert p.returncode==0,p.stderr
m=json.loads(p.stdout);assert m['after']['camera']['x']>m['before']['camera']['x']
result('Mobile pinch and touch pan',m)
button('Fit factory in view');button('Select (V)');clickcell(19,8);ab('snapshot','-i')
assert ab('get','text','#selected-status')
shot('13-mobile-machine-inspector.png');wait_for("getComputedStyle(document.querySelector('#stats-panel')).transform==='none'");button('Close insights')
# Offscreen drawers should not receive tab focus or expose controls until opened.
assert ev("document.querySelector('#stats-panel').inert")
button('Build');wait_for("getComputedStyle(document.querySelector('#build-panel')).transform==='none'");button('Build Extractor');before=len(diag()['structures']);clickcell(14,18)
assert len(diag()['structures'])==before
shot('14-invalid-placement-mobile.png')
result('Mobile inspector, drawers, invalid placement','Off-deposit extractor rejected; closed panel is inert')
button('Select (V)');resume();button('Simulation speed 4x');old=diag()['delivered'].get('circuit',0)
ab('set','viewport',390,844,2);button('Fit factory in view')
wait_for(f"(Forge.diagnostics().delivered.circuit || 0) >= {old+3}")
assert ev('document.documentElement.scrollWidth <= innerWidth')
shot('15-mobile-running-final.png');dump('mobile-final.json',diag())
button('Insights');wait_for("getComputedStyle(document.querySelector('#stats-panel')).transform==='none'");shot('16-mobile-overview.png');button('Close insights')
button('Guide');ab('snapshot','-i');shot('17-mobile-field-guide.png');button('Close dialog')
result('Mobile preset continuity and navigation',{'delivered':diag()['delivered'],'viewport':diag()['viewport']})
assert not diag()['errors'];ab('errors');ab('console');ab('network','requests')
