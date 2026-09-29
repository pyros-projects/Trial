import os,runpy,pathlib
os.environ.setdefault('BROWSER_SESSION','nightjar-final')
script=pathlib.Path(__file__).with_name('browser-mission.py');d=runpy.run_path(str(script));run,read=[d[n] for n in ['run','read']]
run('set','viewport',1280,800,1);run('reload');run('wait','--fn','!!window.Nightjar');run('click','#settingsButton');run('select','#presetInput','dryrun');run('select','#difficultyInput','rookie');run('fill','#seedInput','V-042');run('click','#applyMission');run('click','#deployButton');run('press','e');run('wait','--fn','Nightjar.diagnostics().player.access')
runpy.run_path(str(script),run_name='__main__')
