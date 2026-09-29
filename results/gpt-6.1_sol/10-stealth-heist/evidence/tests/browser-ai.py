import os,runpy,time,json,pathlib
os.environ.setdefault('BROWSER_SESSION','nightjar-ai')
d=runpy.run_path(str(pathlib.Path(__file__).with_name('browser-mission.py')))
run,read,walk,clickworld,snap=[d[n] for n in ['run','read','walk','clickworld','snap']]
run('reload');run('wait','--fn','!!window.Nightjar');run('click','#settingsButton');run('select','#presetInput','dryrun');run('select','#difficultyInput','rookie');run('fill','#seedInput','AI-19');run('click','#applyMission');run('click','#deployButton')
run('click','#perceptionToggle');run('click','#navToggle')
# Make a route through real doors, without using the terminal or disabling perception.
walk(144,432,'AI approach loading door');run('press','e');run('wait','--fn','Nightjar.diagnostics().doors.some(d=>d.tx===4&&d.ty===12&&d.open>.8)')
walk(144,336,'AI enter corridor');walk(144,304,'AI approach records door');run('press','e');run('wait','--fn','Nightjar.diagnostics().doors.some(d=>d.tx===4&&d.ty===8&&d.open>.8)')
walk(144,240,'AI enter records')
q=read('Nightjar.project(208,176)');run('mouse','move',round(q['x']),round(q['y']));run('press','1');run('press','q')
run('wait','--fn',"Nightjar.diagnostics().metrics.investigations>0")
s=snap('noise causes actual investigation');assert any(ev['type']=='investigate' for ev in s['log']);assert s['player']['charges']['decoy']==3
run('screenshot','evidence/screenshots/13-noise-investigation.png')
# Deliberately plot a destination in the patrol's current forward cone.
for attempt in range(8):
    s=read('Nightjar.diagnostics()')
    if s['states'].get('chase',0):break
    target=read("""(()=>{const m=Nightjar.mission(),d=Nightjar.diagnostics(),g=d.guards[0],p=d.player,choices=[];for(let y=1;y<8;y++)for(let x=1;x<8;x++){const q={x:x*32+16,y:y*32+16},a=Math.atan2(q.y-g.y,q.x-g.x),diff=Math.atan2(Math.sin(a-g.angle),Math.cos(a-g.angle)),r=Math.hypot(q.x-g.x,q.y-g.y);if(m.grid[y*m.w+x]===0&&r>62&&r<140&&Math.abs(diff)<.47&&HeistCore.lineClear(m,g,q))choices.push(q);}choices.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));return choices[0]||null;})()""")
    if target:
        clickworld(target['x'],target['y'])
        run('wait','--fn',"Nightjar.diagnostics().guards.some(g=>g.state==='chase')||Nightjar.diagnostics().phase==='failed'",) 
        break
    time.sleep(.6)
run('wait','--fn',"Nightjar.diagnostics().guards.some(g=>g.state==='chase')")
s=snap('guard pursuit triggered by actual visibility');assert s['metrics']['detections']>0 and s['phase']=='active'
run('screenshot','evidence/screenshots/14-guard-pursuit.png')
run('press','2');run('press','q')
# Smoke blocks the real sight query; run to another room, then close the door behind us.
run('keydown','Shift');clickworld(144,336)
run('wait','--fn',"(()=>{const d=Nightjar.diagnostics();return Math.hypot(d.player.x-144,d.player.y-336)<9||d.phase!=='active';})()")
run('keyup','Shift');run('wait','--fn',"Nightjar.diagnostics().guards.some(g=>g.state==='search')")
s=snap('lost visibility produces local search');assert s['phase']=='active';assert any(g['state']=='search' and not g['sees'] for g in s['guards']);assert any(g['lastKnown'] and ((g['lastKnown']['x']-s['player']['x'])**2+(g['lastKnown']['y']-s['player']['y'])**2)**.5>45 for g in s['guards'])
run('screenshot','evidence/screenshots/15-local-search.png')
walk(144,464,'leave search area through loading bay');run('keydown','Shift');walk(48,592,'hide off the responding patrol route');run('keyup','Shift');run('press','c')
run('wait','--fn',"Nightjar.diagnostics().log.some(e=>e.type==='return')")
s=snap('guards return after searching remembered position');assert s['phase']=='active';assert s['metrics']['searches']>0 and s['metrics']['alarms']>0
run('screenshot','evidence/screenshots/16-return-to-duty.png');run('press','Escape')
print('AI PASS',s['metrics'],s['states'])
