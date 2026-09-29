import os,runpy,pathlib,json
os.environ.setdefault('BROWSER_SESSION','nightjar-ai')
d=runpy.run_path(str(pathlib.Path(__file__).with_name('browser-mission.py')));run,read,walk,snap=[d[n] for n in ['run','read','walk','snap']]
initial_history=read('Nightjar.diagnostics().historyCount');run('reload');run('wait','--fn','!!window.Nightjar');assert read('Nightjar.diagnostics().historyCount')==initial_history
run('click','#settingsButton');run('select','#presetInput','dryrun');run('select','#difficultyInput','rookie');run('fill','#seedInput','FAIL-1');run('click','#applyMission');run('click','#deployButton')
walk(144,432,'security approach door');run('press','e');run('wait','--fn','Nightjar.diagnostics().doors.some(d=>d.tx===4&&d.ty===12&&d.open>.8)')
walk(144,336,'security enter corridor');walk(400,336,'intentionally enter camera coverage')
run('wait','--fn',"Nightjar.diagnostics().log.some(e=>e.type==='camera-detected')")
s=snap('camera produces detection and alarm response');assert s['metrics']['alarms']>0 and s['metrics']['detections']>0
run('screenshot','evidence/screenshots/23-camera-alert.png')
run('wait','--fn',"Nightjar.diagnostics().phase==='failed'&&document.getElementById('resultDialog').open")
s=snap('intentional guard interception failure');assert s['summary']['score']==0 and s['summary']['result']=='failed';assert s['historyCount']==min(20,initial_history+1)
run('screenshot','evidence/screenshots/24-failure-debrief.png')
run('click','#resultRestart');assert read('Nightjar.diagnostics().phase')=='briefing';assert read('Nightjar.diagnostics().config.seed')=='FAIL-1'
print('SECURITY PASS',s['summary'])
