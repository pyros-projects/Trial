import os,runpy,pathlib
os.environ.setdefault('BROWSER_SESSION','nightjar-final')
d=runpy.run_path(str(pathlib.Path(__file__).with_name('browser-mission.py')));run,read,snap=[d[n] for n in ['run','read','snap']]
run('reload');run('wait','--fn','!!window.Nightjar');run('click','#deployButton')
if not read('Nightjar.diagnostics().audio.enabled'):run('click','#audioButton')
run('wait','--fn','Nightjar.diagnostics().audio.state==="running"');a=snap('Audio enabled by gesture')
run('tab','new','about:blank');run('tab','t1');s=snap('Audio and simulation after focus switch');assert s['paused'] and not s['keys']
run('click','#resumeButton');run('wait','--fn','Nightjar.diagnostics().audio.state==="running"');b=snap('Audio after resume gesture');assert not b['paused'];assert b['audio']['enabled'];run('press','e');run('wait','--fn','Nightjar.diagnostics().player.access');run('wait','--fn',f'Nightjar.diagnostics().audio.tones>{a["audio"]["tones"]}');c=snap('Terminal synthesizes tones after focus recovery');run('press','Escape')
print('AUDIO STATE PASS',c['audio'],'audible quality not auditioned')
