import os,runpy,pathlib,time,json
os.environ.setdefault('BROWSER_SESSION','nightjar-mobile')
d=runpy.run_path(str(pathlib.Path(__file__).with_name('browser-mission.py')));run,read,snap,clickworld=[d[n] for n in ['run','read','snap','clickworld']]
s=snap('mobile before joystick')
box=read('document.getElementById("stick").getBoundingClientRect().toJSON()');x=round(box['x']+box['width']/2);y=round(box['y']+box['height']/2)
run('mouse','move',x,y);run('mouse','down');run('mouse','move',x+30,y);run('wait',750);run('mouse','up')
a=snap('mobile joystick released');assert a['player']['x']>s['player']['x']+30;assert a['analog']=={'x':0,'y':0}
run('wait',300);b=read('Nightjar.diagnostics()');assert abs(b['player']['x']-a['player']['x'])<1
run('keydown','ArrowUp');run('wait',650);run('keyup','ArrowUp');s=snap('mobile held keyboard and release');assert s['player']['y']<b['player']['y']-25;assert s['keys']==[]
# Plot a reachable floor tile using the actual rendered mobile map projection.
target=read("""(()=>{const m=Nightjar.mission(),p=Nightjar.diagnostics().player;let x=Math.floor(p.x/32)+1,y=Math.floor(p.y/32);if(m.grid[y*m.w+x]!==0)x--;return{x:x*32+16,y:y*32+16};})()""")
clickworld(target['x'],target['y']);run('wait','--fn',f"Math.hypot(Nightjar.diagnostics().player.x-{target['x']},Nightjar.diagnostics().player.y-{target['y']})<8")
s=snap('mobile map tap destination reached');before=s['player']['charges']['smoke'];run('click','#smokeButton');run('click','#touchUse');s=snap('mobile smoke deployed');assert s['player']['charges']['smoke']==before-1
run('click','#touchRun');assert read('Nightjar.diagnostics().touchRun') is True;run('click','#touchRun');assert read('Nightjar.diagnostics().touchRun') is False
run('click','#pauseButton');a=read('Nightjar.diagnostics()');run('wait',450);b=read('Nightjar.diagnostics()');assert b['paused'] and b['elapsed']==a['elapsed']
run('screenshot','evidence/screenshots/17-mobile-paused.png');run('click','#resumeButton')
run('keydown','ArrowDown');run('tab','new','about:blank');run('tab','t1');s=snap('mobile focus loss clears held input');assert s['paused'] and not s['keys'] and s['analog']=={'x':0,'y':0}
run('screenshot','evidence/screenshots/18-mobile-focus-loss.png');run('click','#resumeButton');run('click','#helpButton');run('snapshot','-i');run('click','[aria-label="Close controls"]')
s=snap('mobile after controls modal');assert not s['paused']
# Cancel a captured real pointer gesture by moving browser focus to another tab.
run('mouse','move',x,y);run('mouse','down');run('mouse','move',x+24,y);run('wait',250);assert read('Nightjar.diagnostics().analog.x')>0
run('tab','new','about:blank');run('mouse','up');run('tab','t1');s=snap('captured pointer cancelled on focus loss');assert s['paused'] and s['analog']=={'x':0,'y':0};run('click','#resumeButton')
s=snap('mobile final input state');assert not s['keys'] and s['analog']=={'x':0,'y':0};run('press','Escape')
print('MOBILE PASS',s['player'],s['view'])
