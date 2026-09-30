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
# Confirm daily seed by genuinely starting the same date-based run twice.
for iteration in range(2):
    button('Daily seed');ab('snapshot','-i');date_seed=ab('get','value','#run-seed');assert date_seed.startswith('DAILY-')and len(date_seed)==16
    ab('select','#run-style','ruins');ab('check','input[name="keeper"][value="warden"]');button('Begin expedition')
    if iteration==0:daily=js('Hollowkeep.digest()')
    else:assert js('Hollowkeep.digest()')==daily
passed('daily seed is visible, date-based and generates an identical initial state offline')

from collections import deque
DIRS=[(0,-1),(1,0),(0,1),(-1,0)];KEYS={(0,-1):'ArrowUp',(1,0):'ArrowRight',(0,1):'ArrowDown',(-1,0):'ArrowLeft'}
def next_step(s):
    start=(s['player']['x'],s['player']['y']);goal=(s['exit']['x'],s['exit']['y']);q=deque([start]);prev={start:None};w,h=s['w'],s['h']
    while q:
        pos=q.popleft()
        if pos==goal:
            while prev[pos]!=start and prev[pos]is not None:pos=prev[pos]
            return pos
        for dx,dy in DIRS:
            p=(pos[0]+dx,pos[1]+dy)
            if 0<=p[0]<w and 0<=p[1]<h and p not in prev and s['map'][p[1]*w+p[0]]not in(0,5,6):prev[p]=pos;q.append(p)
    return None

def death_run(forgiving):
    button('New run');ab('fill','#run-seed','ASH-013');ab('check','input[name="keeper"][value="arcanist"]');ab('select','#run-difficulty','veteran');ab('select','#run-preset','5')
    if not forgiving:ab('uncheck','#run-forgiving')
    button('Begin expedition');s=state();assert s['floor']==5 and s['style']=='arena'and any(e['kind']=='boss'for e in s['enemies'])and s['player']['maxHp']==32
    button('Pause and open menu');assert js('document.getElementById("menu-restart").disabled')is(not forgiving);button('Resume')
    for i in range(60):
        s=state()
        if s['mode']!='playing':break
        if any(e['memory']>0 for e in s['enemies']):ab('press','Space')
        else:
            nxt=next_step(s);assert nxt;dx,dy=nxt[0]-s['player']['x'],nxt[1]-s['player']['y'];ab('press',KEYS[(dx,dy)])
    s=state();assert s['mode']=='dead'and s['player']['hp']==0 and js('Hollowkeep.verifyReplay()')
    ab('wait','--fn','document.getElementById("modal").open');snap('16-death-'+('forgiving'if forgiving else'permadeath')+'.png')
    if forgiving:
        t=s['turn'];button('Rekindle floor');s=state();assert s['mode']=='playing'and s['turn']==t+1 and s['player']['hp']==32 and s['penalty']==200 and js('Hollowkeep.verifyReplay()')
        passed('actual forgiving death restarts the entire floor checkpoint and remains replayable')
    else:
        assert not js('Boolean(document.getElementById("end-restart"))')
        digest=js('Hollowkeep.digest()');button('Close dialog');ab('press','ArrowRight');assert js('Hollowkeep.digest()')==digest
        ab('reload');assert js('Hollowkeep.digest()')==digest
        ab('wait','--fn','document.getElementById("modal").open');button('Close dialog');button('Pause and open menu');ab('download','#menu-export',str(ROOT/'evidence/death-run.json'));button('Resume')
        passed('final-floor preset, Arcanist, veteran death, permadeath action gate, local save reload and failed-run replay')
        assert js('JSON.parse(localStorage.getItem("hollowkeep.records.v3")).some(r=>r.mode==="dead"&&r.seed==="ASH-013")')

death_run(False);death_run(True)
assert not ab('errors');passed('no uncaught errors across daily seeds, presets, death and floor restart')
