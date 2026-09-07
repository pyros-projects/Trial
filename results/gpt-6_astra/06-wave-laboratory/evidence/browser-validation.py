import json,subprocess,shlex, pathlib, time, sys, os
ROOT=pathlib.Path(__file__).resolve().parent
LOG=ROOT/'logs/browser-validation.txt'
SESSION=os.environ.get('WAVE_BROWSER_SESSION','wave-lab')
def ab(*args):
    cmd=['agent-browser','--session',SESSION,'--json',*map(str,args)]
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=45)
    with LOG.open('a') as f:f.write('$ '+shlex.join(cmd)+'\n'+p.stdout+p.stderr+'\n')
    if p.returncode:raise RuntimeError(p.stdout+p.stderr)
    data=json.loads(p.stdout)
    if not data.get('success'):raise RuntimeError(data)
    return data.get('data',{})
def ev(js):return ab('eval',js).get('result')
def state():return ev('window.waveLab.diagnostics')
def click(name):
    nested={'Laboratory':'navLab','Restore':'loadLocal','Save locally':'saveLocal','Export scene':'exportBtn','Import scene':'importBtn','Remove selected structure':'removeStructure','Remove':'deleteSource','Duplicate':'duplicateSource','Fire pulse':'firePulse'}
    if name in nested:ab('scrollintoview','#'+nested[name])
    return ab('find','role','button','click','--name',name,'--exact')
def select(label,value):
    ids={'More field diagnostics':'moreMode','Experiment preset':'presetSelect','Selected source':'sourceSelect','Source type':'sourceType','Waveform':'waveform','Color scale':'palette','Resolution':'resolution','Boundary':'boundary','Substeps / frame':'substeps','Additional drawing tools':'extraTool'}
    return ab('select','#'+ids[label],value)
def fill(label,value):return ab('find','label',label,'fill',value)
def shot(name):return ab('screenshot',str(ROOT/'screenshots'/name))
def snap():return ab('snapshot','-i')
def pause():
    if not state()['paused']:click('Pause simulation')
def resume():
    if state()['paused']:click('Resume simulation')
def waitsim(delta):
    t=state()['time']
    ab('wait','--fn',f'window.waveLab.diagnostics.time >= {t+delta}')
def fieldpoint(x,y):
    d=ev('({rect:(()=>{const r=document.getElementById("field").getBoundingClientRect();return {x:r.x,y:r.y}})(),view:window.waveLab.diagnostics.view})')
    return [round(d['rect']['x']+d['view']['x']+x*d['view']['w']),round(d['rect']['y']+d['view']['y']+y*d['view']['h'])]
def mousepoint(x,y):
    q=fieldpoint(x,y);ab('mouse','move',*q)
def tap(x,y):
    mousepoint(x,y);ab('mouse','down','left');ab('mouse','up','left')
def drag(points):
    mousepoint(*points[0]);ab('mouse','down','left')
    for p in points[1:]:mousepoint(*p)
    ab('mouse','up','left')
def fieldvisible():ab('scrollintoview','#field')
def report(name,values):
    with LOG.open('a') as f:f.write('OBSERVED '+name+': '+json.dumps(values)+'\n')
    print(name,json.dumps(values))
if __name__=='__main__':
    pause();fieldvisible();snap()
    a=state();time.sleep(.25);b=state();assert a['time']==b['time'] and a['steps']==b['steps'];report('pause freezes time and state',b)
    click('Advance one timestep');c=state();assert c['steps']==b['steps']+1 and abs(c['time']-b['time']-b['effective'])<1e-8;report('single step advances exactly one dt',c)
    click('Clear field');d=state();assert d['fieldMax']==0 and d['time']==0 and all(p['samples']==0 for p in d['probes']);shot('desktop-clear-paused.png');report('clear zeroes field and probe history',d)
    resume();waitsim(10);pause();fieldvisible();shot('desktop-interference-probes.png');d=state();assert d['fieldRms']>.005 and all(p['samples']>100 for p in d['probes']);report('two-source live field and measured probes',d)
    # Real keyboard control continuity on a labeled range.
    ab('focus','#frequency');ab('press','ArrowRight');ab('press','ArrowRight');d=state();assert abs(d['sources'][0]['frequency']-1.5)<1e-6;report('frequency keyboard changes persist',d['sources'][0]);
    # Regression for the reviewed duplicate-position bug.
    click('Duplicate');d=state();same=(d['sources'][-1]['x']==d['sources'][0]['x'] and d['sources'][-1]['y']==d['sources'][0]['y']);assert not same;report('duplicate offset regression',{'colocated':same,'sources':d['sources']});shot('duplicate-offset-regression.png')
    # Main public editing flow starts from a reset scene.
    click('Reset');pause();click('Barrier');fieldvisible();drag([(.52,.16),(.52,.3),(.52,.45),(.52,.6),(.52,.78)]);d=state();assert d['solidCells']>200;report('continuous barrier painting',d);shot('barrier-drawn.png')
    resume();waitsim(7);pause();fieldvisible();shot('barrier-wave-change.png');d=state();assert d['finite'];report('barrier alters live propagated field',d)
    click('Select');fieldvisible();drag([(.52,.45),(.59,.45),(.64,.45)]);d=state();assert d['solidCells']>150;report('barrier moved through pointer drag',d);shot('barrier-moved.png')
    click('Medium');fieldvisible();drag([(.68,.25),(.7,.35),(.7,.5),(.72,.65)]);d=state();assert d['mediumCells']>100;report('refractive region painted',d)
    click('Lens');fieldvisible();drag([(.74,.24),(.8,.43),(.84,.77)]);d=state();assert d['mediumCells']>700;report('lens drawn',d);resume();waitsim(5);select('More field diagnostics','medium');pause();fieldvisible();shot('painted-medium-and-lens.png')
    click('Probe');fieldvisible();tap(.87,.51);d=state();assert d['probeCount']==3;resume();waitsim(5);pause();d=state();assert d['probes'][-1]['samples']>50;report('new probe samples live local field',d);fieldvisible();shot('edited-field-probes.png')
    click('Erase');fieldvisible();drag([(.64,.25),(.64,.4),(.64,.55)]);d=state();report('erase changes material occupancy',d);shot('barrier-erased.png')
    click('Reset');pause();report('reset restores two-source scene',state());assert state()['sourceCount']==2 and state()['structureCount']==0 and state()['probeCount']==2
