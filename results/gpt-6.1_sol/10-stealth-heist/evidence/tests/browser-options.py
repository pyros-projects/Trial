import os,runpy,pathlib,json,time
os.environ.setdefault('BROWSER_SESSION','nightjar-final')
d=runpy.run_path(str(pathlib.Path(__file__).with_name('browser-mission.py')));run,read,snap=[d[n] for n in ['run','read','snap']];root=d['root']
run('click','#recordButton');run('upload','#importFile',root/'evidence/logs/exported-run.json');run('wait','--text','Record verified');run('click','#showRecordRoute');assert read('Nightjar.diagnostics().review')
run('focus','#reviewSlider');run('press','Home');assert read('document.getElementById("reviewSlider").value')=='0';run('screenshot',root/'evidence/screenshots/27-route-start-scrub.png')
run('click','#recordButton');config=read('Nightjar.diagnostics().config')
for fixture,fragment in [('malformed.json','Could not parse'),('tampered-run.json','checksum failed'),('wrong-facility.json','fingerprint does not match')]:
    run('upload','#importFile',root/'evidence/tests'/fixture);run('wait','--text',fragment);assert read('Nightjar.diagnostics().config')==config;snap('Rejected '+fixture)
run('screenshot',root/'evidence/screenshots/28-import-error.png')
run('upload','#importFile',root/'evidence/logs/exported-mission.json');run('wait','--fn','!document.getElementById("importError").textContent');run('click','[aria-label="Close run data"]')
assert read('document.getElementById("reviewControl").hidden'),'New mission must clear previous record controls'
before=read('Nightjar.diagnostics().layoutHash');run('click','#restartButton');assert read('Nightjar.diagnostics().layoutHash')==before
run('click','#newButton');run('fill','#seedInput','');run('click','#applyMission');run('wait','--text','Enter a mission seed');assert read('document.getElementById("settingsDialog").open');assert read('Nightjar.diagnostics().layoutHash')==before
run('select','#presetInput','blackglass');run('select','#difficultyInput','ghost');run('fill','#seedInput','BG-20');run('click','#applyMission');s=snap('Preset and difficulty actually changed mission');assert len(s['guards'])==7;assert s['config']['difficulty']=='ghost';assert s['layoutHash']!=before
run('click','#restartButton');assert read('Nightjar.diagnostics().layoutHash')==s['layoutHash']
run('click','#settingsButton')
for field,fraction in [('masterVolume',.44),('effectsVolume',.31)]:
    r=read(f'document.getElementById("{field}").getBoundingClientRect().toJSON()');run('mouse','move',round(r['x']+r['width']*fraction),round(r['y']+r['height']/2));run('mouse','down');run('mouse','up')
run('check','#reducedMotion');run('scrollintoview','[data-debug="timing"]');run('check','[data-debug="timing"]');run('focus','[aria-label="Close settings"]');run('press','Space');assert not read('document.getElementById("settingsDialog").open')
s=snap('Native keyboard close and live options');assert s['debug']['timing'];assert 0<s['audio']['master']<100 and 0<s['audio']['effects']<100
prefs=read('JSON.parse(localStorage.getItem("nightjar-options-v1"))');assert prefs['reduced'] is True
run('click','#deployButton');run('wait','--fn','Nightjar.diagnostics().frameMs>0');run('screenshot',root/'evidence/screenshots/29-seven-guard-mission.png');run('press','Escape')
archive=read('localStorage.getItem("nightjar-history-v1")');count=read('Nightjar.diagnostics().historyCount');run('reload');run('wait','--fn','!!window.Nightjar');assert read('Nightjar.diagnostics().historyCount')==count;assert read('JSON.parse(localStorage.getItem("nightjar-options-v1"))')==prefs
run('eval','localStorage.setItem("nightjar-history-v1","broken JSON")');run('reload');run('wait','--fn','!!window.Nightjar');assert read('Nightjar.diagnostics().historyCount')==0
run('eval','localStorage.setItem("nightjar-history-v1",'+json.dumps(archive)+')');run('reload');run('wait','--fn','!!window.Nightjar');assert read('Nightjar.diagnostics().historyCount')==count
print('OPTIONS PASS',s['config'],prefs,'history',count)
