import os,runpy,pathlib,json
os.environ.setdefault('BROWSER_SESSION','nightjar-final')
d=runpy.run_path(str(pathlib.Path(__file__).with_name('browser-mission.py')));run,read,snap=[d[n] for n in ['run','read','snap']];root=d['root']
run('reload');run('wait','--fn','!!window.Nightjar')
run('click','#recordButton');run('upload','#importFile',root/'evidence/logs/exported-run.json');run('wait','--text','Record verified');run('click','#showRecordRoute')
assert read('Nightjar.diagnostics().review');run('click','#briefStart');assert not read('Nightjar.diagnostics().review')
run('click','#recordButton');run('click','#showRecordRoute');a=snap('Reopened route review');run('wait',1700);b=snap('Review after real time');run('screenshot',root/'evidence/screenshots/30-review-safety.png')
assert b['review'] and b['phase']=='briefing','Review must load the corresponding briefing and suspend live play'
assert b['elapsed']==a['elapsed']==0,'Live time must not run underneath the recorded route'
fixture=json.loads((root/'evidence/logs/exported-run.json').read_text());assert b['layoutHash']==fixture['layoutHash']
# Retain the record, change facility, then explicitly load the recorded facility.
run('click','#settingsButton');run('select','#presetInput','blackglass');run('fill','#seedInput','REVIEW-OTHER');run('click','#applyMission');assert not read('Nightjar.diagnostics().review');assert read('document.getElementById("reviewControl").hidden')
run('click','#recordButton');run('click','#showRecordRoute');c=snap('Record facility restored');assert c['layoutHash']==fixture['layoutHash'];assert c['phase']=='briefing';assert c['review'];assert c['config']==fixture['mission']
print('REVIEW PASS',c['config'],c['layoutHash'])
