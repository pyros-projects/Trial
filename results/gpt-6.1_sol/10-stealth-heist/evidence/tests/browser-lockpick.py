import os,runpy,pathlib
os.environ.setdefault('BROWSER_SESSION','nightjar-final')
d=runpy.run_path(str(pathlib.Path(__file__).with_name('browser-mission.py')));run,read,walk,clickworld,snap=[d[n] for n in ['run','read','walk','clickworld','snap']];root=d['root']
run('reload');run('wait','--fn','!!window.Nightjar');run('click','#settingsButton');run('select','#presetInput','dryrun');run('select','#difficultyInput','rookie');run('fill','#seedInput','LOCK-1');run('click','#applyMission');run('click','#deployButton')
walk(144,432,'lockpick approach loading door');run('press','e');run('wait','--fn','Nightjar.diagnostics().doors.some(d=>d.tx===4&&d.ty===12&&d.open>.8)')
walk(144,336,'lockpick enter corridor');run('keydown','Shift');walk(688,336,'run beyond camera');run('keyup','Shift');walk(688,304,'approach locked vault')
# A real pointer route tries to cross a closed locked door and must stop.
clickworld(688,240);run('wait',700);s=snap('Locked route blocked');door=next(d for d in s['doors'] if d['tx']==21 and d['ty']==8)
assert s['phase']=='active' and not s['player']['access'];assert door['locked'] and door['open']==0;assert s['player']['y']>door['ty']*32+16
run('press','2');run('press','q');run('press','e');run('wait','--fn','Nightjar.diagnostics().doors.some(d=>d.tx===21&&d.ty===8&&!d.locked&&d.open>.8)')
s=snap('Lockpick finishes after blocked tap route');assert s['phase']=='active';assert any(e['type']=='unlock' for e in s['log']);assert not any(e['type']=='action-cancel' for e in s['log'])
run('screenshot',root/'evidence/screenshots/31-lockpick-route.png');walk(688,240,'cross deliberately picked lock');run('press','Escape')
print('LOCKPICK PASS',s['metrics'],s['player'])
