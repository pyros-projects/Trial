import os,runpy,pathlib
os.environ.setdefault('BROWSER_SESSION','nightjar-final')
script=pathlib.Path(__file__).with_name('browser-mobile.py');d=runpy.run_path(str(script.with_name('browser-mission.py')));run,read=[d[n] for n in ['run','read']];root=d['root']
run('set','viewport',390,844,2);run('reload');run('wait','--fn','!!window.Nightjar');run('click','#deployButton');run('click','#touchInteract');run('wait','--fn','Nightjar.diagnostics().player.access')
assert read('document.documentElement.scrollWidth')==390;assert read('document.getElementById("liveStatus").getBoundingClientRect().bottom')<=844
run('screenshot',root/'evidence/screenshots/32-mobile-final-retina.png');runpy.run_path(str(script),run_name='__main__')
# Changing DPR in place must update the Canvas backing store without a CSS resize.
for dpr in [1,2]:
 run('set','viewport',390,844,dpr);run('wait','--fn',f'Nightjar.diagnostics().view.dpr==={dpr}')
 assert read('document.getElementById("game").width')==read(f'Math.round(document.getElementById("game").getBoundingClientRect().width*{dpr})')
print('MOBILE LAYOUT / DPR PASS',read('Nightjar.diagnostics().view'))
