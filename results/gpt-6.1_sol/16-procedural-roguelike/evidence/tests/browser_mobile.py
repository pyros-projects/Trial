"""Agent-authored real-browser checks. All actions use agent-browser input commands.
JavaScript evaluation is used only for live state/diagnostics and screen coordinates.
"""
import subprocess,json,pathlib,shlex,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
LOG=ROOT/'evidence/logs/browser-flow.txt'
SESSION='hollowkeep'
def ab(*args):
    command=['agent-browser','--session',SESSION,*map(str,args)]
    p=subprocess.run(command,cwd=ROOT,text=True,capture_output=True,timeout=35)
    with LOG.open('a') as f:
        f.write('$ '+shlex.join(command)+'\n'+p.stdout+p.stderr+'\n')
    if p.returncode: raise RuntimeError(p.stderr or p.stdout)
    return p.stdout.strip()
def js(expression):return json.loads(ab('eval',expression))
def state():return js('Hollowkeep.state')
def snap(name):ab('screenshot',str(ROOT/'evidence/screenshots'/name))
def button(name):
    if name=='Resume':ab('click','#menu-resume')
    else:ab('find','role','button','click','--name',name)
def pointer(x,y):
    ab('wait','--fn','!Hollowkeep.diagnostics.animation')
    pos=js(f'Hollowkeep.tileToScreen({x},{y})')
    ab('mouse','move',round(pos['x']),round(pos['y']))
    ab('mouse','down','left');ab('mouse','up','left')
def passed(message):
    print('PASS '+message,flush=True)
    with LOG.open('a')as f:f.write('PASS '+message+'\n')


if js('document.getElementById("modal").open'):button('Close dialog')
expected=js('Hollowkeep.digest()')
exported=ROOT/'evidence/exported-run.json'
assert exported.exists()
assert json.loads(exported.read_text())['version']==3
old_map=state()['map']
ab('set','viewport',390,844)
button('New run');ab('fill','#run-seed','EMBER-92');ab('select','#run-style','cavern');ab('select','#run-difficulty','gentle');ab('check','input[name="keeper"][value="wayfarer"]');button('Begin expedition')
s=state();assert s['seed']=='EMBER-92'and s['config']['class']=='wayfarer'and s['player']['maxHp']==34 and s['map']!=old_map
v=js('Hollowkeep.validate()');assert v['connected']and v['exitReachable']and v['safeEntry']and v['occupancyValid']
assert js('document.documentElement.scrollWidth')==390
snap('10-second-seed-narrow.png');passed('second seed creates a different connected map with safe spawn and reachable stairs at 390x844')
ab('press','ArrowUp');s=state();assert s['turn']==1 and s['player']['y']==11
button('Move east');s=state();assert s['turn']==2 and s['player']['x']==19
ab('press','ArrowLeft');s=state();assert s['turn']==3 and s['player']['x']==18
pointer(17,11);s=state();assert s['turn']==4 and s['player']['x']==17
passed('narrow keyboard, labeled touch controls and real tile pointer input remain continuous')
button('Inventory');ab('snapshot','-i');button('Use Trail ration');s=state();assert s['turn']==5 and s['player']['status']['focus']==3
passed('narrow inventory item applies focus and consumes one turn')
before=js('Hollowkeep.digest()');button('Pause and open menu');ab('snapshot','-i');ab('select','#setting-keys','vi');ab('select','#setting-speed','80');ab('select','#setting-text','large');ab('check','#setting-contrast');ab('check','#setting-motion');ab('focus','#setting-volume');ab('press','End');button('Resume')
assert js('Hollowkeep.digest()')==before
preferences=js('Hollowkeep.diagnostics.prefs');assert preferences['keys']=='vi'and preferences['motion']and preferences['contrast']and preferences['volume']==100
assert js('parseFloat(getComputedStyle(document.getElementById("journal-content")).fontSize)')==13
ab('press','k');s=state();assert s['turn']==6 and s['player']['y']==10
passed('alternate HJKL keys, animation speed, large text, contrast, reduced motion and volume settings work without spending turns')
ab('press','p');before=js('Hollowkeep.digest()');ab('press','ArrowRight');ab('wait',700);assert js('Hollowkeep.digest()')==before and js('Hollowkeep.diagnostics.paused')
snap('11-narrow-pause.png');ab('press','p');button('Move east');assert state()['turn']==7
passed('pause blocks input and autonomous turns; touch movement resumes normally')
# Real exported-file upload restores the earlier expedition, not a synthesized save.
button('Pause and open menu');button('Import JSON');ab('upload','#import-file',str(exported));ab('wait','--fn','document.getElementById("import-text").value.length > 100');button('Import expedition')
assert js('Hollowkeep.digest()')==expected
passed('actual exported JSON file imports and restores the complete prior run exactly')
# Watch the real action history; saving during replay must retain its backing run.
button('Pause and open menu');button('Replay run');ab('snapshot','-i');assert 'VERIFIED' in ab('get','text','.diag-data');button('Watch replay')
ab('wait','--fn','Hollowkeep.diagnostics.replay && Hollowkeep.diagnostics.replay.index >= 2')
button('Pause and open menu');button('Save run')
assert js('JSON.parse(localStorage.getItem("hollowkeep.run.v3")).state.turn')==21
button('Resume');ab('wait','--fn','Hollowkeep.diagnostics.replay && Hollowkeep.diagnostics.replay.verified');snap('12-replay-verified-narrow.png')
button('Return to run');assert js('Hollowkeep.digest()')==expected
passed('animated replay verifies exact state; saving during replay preserves the original run; return restores it')
button('Pause and open menu');ab('select','#setting-text','normal');ab('select','#setting-keys','wasd');ab('uncheck','#setting-contrast');ab('uncheck','#setting-motion');ab('select','#setting-speed','170');button('Resume')
ab('set','viewport',1280,800)
assert not ab('errors');passed('no uncaught errors across narrow controls, settings, import or replay')
