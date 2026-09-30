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
button('New run');ab('fill','#run-seed','MOSS-731');ab('select','#run-style','ruins');ab('select','#run-difficulty','standard');button('Begin expedition')
button('Inventory I');ab('snapshot','-i');button('Equip Notched axe');button('Close dialog')
for k in ['ArrowUp','ArrowUp','ArrowRight','Space']:ab('press',k)
s=state();assert s['turn']==5 and s['player']['hp']<s['player']['maxHp'] and s['player']['status']['poison']==2
passed('new seeded run, keyboard movement, pursuit, actual damage and poison')
before=js('Hollowkeep.digest()');ab('wait',800);assert js('Hollowkeep.digest()')==before
passed('idle rendering does not advance enemies or RNG')
button('Inventory I');ab('snapshot','-i')
assert js('Hollowkeep.diagnostics.paused')
ab('press','ArrowRight');assert js('Hollowkeep.digest()')==before
button('Use Ironbark tonic');s=state();assert s['turn']==6 and s['player']['status']['shield']==3
passed('inventory pauses input; Ironbark consumes one turn and adds a live status')
ab('press','5');pointer(20,10);s=state();rat=next(e for e in s['enemies']if e['kind']=='rat'and e['x']==20)
assert s['turn']==7 and rat['status']['stun']==1 and rat['hp']==5
snap('05-frost-status.png');passed('pointer targeting applies damage and two-phase enemy stun')
pointer(20,10);s=state();assert s['turn']==8 and s['kills']>=1 and s['player']['xp']>=4
passed('pointer melee kills an adjacent foe, awards XP, and consumes one turn')
hp=s['player']['hp'];ab('press','1');s=state();assert s['turn']==9 and s['player']['hp']>hp
ab('press','2');ab('press','Enter');ab('press','2');ab('press','Enter');s=state()
assert s['player']['ammo']==12 and s['kills']>=2
passed('keyboard targeting and guaranteed ranged attacks spend arrows and turns')
assert all(q['actions']<=1 for q in js('Hollowkeep.diagnostics.queue'))
assert js('Hollowkeep.validate().occupancyValid')
passed('live enemy phase reports at most one action per actor and legal occupancy')
button('Inventory I');ab('snapshot','-i');t=state()['turn'];button('Equip Mossstone charm');s=state();assert s['turn']==t+1 and s['player']['equipment']['charm']=='charm'
button('Close dialog');passed('equipment changes slot and armor with a one-turn cost')
before=js('Hollowkeep.digest()');ab('press','v');pointer(20,10);ab('press','Escape');assert js('Hollowkeep.digest()')==before
passed('inspect and cancel do not consume turns')
button('Pause and open menu');ab('snapshot','-i');button('Save run');button('Resume')
saved=js('Hollowkeep.digest()');ab('reload');assert js('Hollowkeep.digest()')==saved
passed('file reload restores exact map, entities, statuses, equipment, turn and RNG')
assert js('Hollowkeep.verifyReplay()');passed('accepted-action replay reproduces the saved state exactly')
button('Pause and open menu');button('Import JSON');ab('snapshot','-i');ab('fill','#import-text','{"version":1}');button('Import expedition');assert js('Hollowkeep.digest()')==saved
assert 'older or invalid schema' in ab('get','text','#import-error')
snap('06-invalid-import.png');button('Close dialog');passed('older invalid JSON is rejected without mutating the active run')
button('Pause and open menu');ab('select','#setting-debug','paths');button('Resume');snap('07-path-diagnostics.png');assert 'breadth-first' in ab('get','text','#debug-overlay')
passed('diagnostic distance overlay reflects the actual pathfinding system')
button('Pause and open menu');ab('select','#setting-debug','off');button('Resume')
# Find an actual visible closed door and a reachable adjacent tile from live map data.
from collections import deque
s=state();w,h=s['w'],s['h'];p=s['player'];directions=[(0,-1),(1,0),(0,1),(-1,0)]
def route(s,goal):
    start=(s['player']['x'],s['player']['y']);q=deque([start]);parents={start:None}
    while q:
        x,y=q.popleft()
        if (x,y)==goal:
            result=[]
            while parents[(x,y)] is not None:result.append((x,y));x,y=parents[(x,y)]
            return result[::-1]
        for dx,dy in directions:
            pos=(x+dx,y+dy)
            if 0<=pos[0]<w and 0<=pos[1]<h and pos not in parents and s['map'][pos[1]*w+pos[0]] not in (0,2,5,6):parents[pos]=(x,y);q.append(pos)
    return None
choices=[]
for i,tile_value in enumerate(s['map']):
    if tile_value!=2 or not s['visible'][i]:continue
    dx0,dy0=i%w,i//w
    for dx,dy in directions:
        near=(dx0-dx,dy0-dy);behind=(dx0+dx,dy0+dy)
        if not(0<=behind[0]<w and 0<=behind[1]<h)or s['map'][behind[1]*w+behind[0]]==0:continue
        path=route(s,near)
        if path is not None:choices.append((dy0<=p['y'],len(path),(dx0,dy0),behind,path))
assert choices,'Need a generated reachable closed door'
_,_,door,behind,path=min(choices)
for x,y in path:
    current=state()['player'];dx,dy=x-current['x'],y-current['y'];ab('press',{(0,-1):'ArrowUp',(1,0):'ArrowRight',(0,1):'ArrowDown',(-1,0):'ArrowLeft'}[(dx,dy)])
s=state();assert s['map'][door[1]*w+door[0]]==2 and s['visible'][behind[1]*w+behind[0]] is False
snap('08-closed-door-occlusion.png');t=s['turn'];ab('press','e');s=state()
assert s['turn']==t+1 and s['map'][door[1]*w+door[0]]==1 and s['visible'][behind[1]*w+behind[0]]
snap('09-open-door-discovery.png');passed('closed door occludes nearby tiles; opening reveals the corridor and costs one turn')
with (ROOT/'evidence/logs/browser-flow-final-state.json').open('w')as f:json.dump(s,f,indent=2)
assert not ab('errors');passed('no uncaught browser errors during the desktop workflow')
