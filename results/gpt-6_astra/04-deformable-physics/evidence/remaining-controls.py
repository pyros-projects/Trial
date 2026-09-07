import importlib.util
from pathlib import Path
sp=importlib.util.spec_from_file_location('d',Path(__file__).parent/'browser-checks.py');d=importlib.util.module_from_spec(sp);sp.loader.exec_module(d)
d.ensurepause();d.ab('set','viewport',1280,800,1);d.click('Load The playground');d.ab('click','#tab-solver')
for id in ['iterations','substeps','timestep','damping','friction','restitution','thickness']:d.setrange(id,False)
s=d.state();d.click('Single step');t=d.state();assert t['frames']==s['frames']+1;assert abs(t['time']-s['time']-.033333)<1e-8;assert t['settings']['iterations']==20 and t['settings']['substeps']==8;assert t['stats']['recoveries']==0
r={'status':'pass','settings':t['settings'],'stepTime':t['time']-s['time'],'maxConstraintError':t['stats']['maxError'],'recoveries':t['stats']['recoveries']};(d.ROOT/'logs'/'remaining-controls.json').write_text(d.json.dumps(r,indent=2));print(d.json.dumps(r,indent=2))
d.click('Restore default settings');d.click('Reset scene');d.ab('click','#tab-world');d.click('Grab & drag (G)');d.ab('select','#view-mode','material');d.runframes(120);d.ab('wait','--fn',"!document.getElementById('toast').classList.contains('show')");d.snap('27-final-desktop.png');d.click('Resume simulation');print(d.ab('errors'));print(d.ab('console'));print(d.ab('network','requests'))
