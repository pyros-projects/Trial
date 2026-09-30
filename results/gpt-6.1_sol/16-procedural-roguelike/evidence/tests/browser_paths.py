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
ab('set','viewport',1280,800)
ab('wait',100)
# Select a genuine generated arena with no visible starting enemy to test uninterrupted travel.
seeds=js('Array.from({length:8},(_,i)=>"PATH-"+(204+i)).filter(seed=>new HKCore.Engine(seed,{style:"arena",difficulty:"gentle"}).visibleEnemies().length===0)')
assert seeds
button('New run');ab('fill','#run-seed',seeds[0]);ab('select','#run-style','arena');ab('select','#run-difficulty','gentle');ab('select','#run-preset','1');ab('check','input[name="keeper"][value="warden"]');button('Begin expedition')
ab('wait',100) # Let the first rendered frame center the new map before reading screen coordinates.
assert js('Hollowkeep.diagnostics.visibleEnemies')==0
before=js('Hollowkeep.digest()');pointer(7,11);assert js('Hollowkeep.digest()')==before
snap('17-safe-path-preview.png');pointer(7,11);ab('wait','--fn','Hollowkeep.state.player.x===7 && Hollowkeep.state.player.y===11');s=state();assert s['turn']==4
ab('wait',600);assert state()['turn']==4
passed('pointer safe-path preview consumes no turns; confirmed four-tile route advances four turns and stops at its destination')
# Discover an enemy by genuinely navigating toward the next room, then try travel in danger.
from collections import deque
DIRS=[(0,-1),(1,0),(0,1),(-1,0)];KEYS={(0,-1):'ArrowUp',(1,0):'ArrowRight',(0,1):'ArrowDown',(-1,0):'ArrowLeft'}
def first_step(s):
    start=(s['player']['x'],s['player']['y']);goal=(s['exit']['x'],s['exit']['y']);q=deque([start]);prev={start:None};w,h=s['w'],s['h']
    while q:
        p=q.popleft()
        if p==goal:
            while prev[p]!=start and prev[p]is not None:p=prev[p]
            return p
        for dx,dy in DIRS:
            n=(p[0]+dx,p[1]+dy)
            if 0<=n[0]<w and 0<=n[1]<h and n not in prev:
                tile=s['map'][n[1]*w+n[0]]
                cache=next((c for c in s['chests'] if c['x']==n[0] and c['y']==n[1]),None)
                if tile!=0 and not(tile==6 and cache and cache.get('locked') and not s['player']['items']['key']):prev[n]=p;q.append(n)
    return None
for i in range(35):
    s=state()
    if js('Hollowkeep.diagnostics.visibleEnemies')>0:break
    n=first_step(s);assert n;ab('press',KEYS[(n[0]-s['player']['x'],n[1]-s['player']['y'])])
s=state();assert js('Hollowkeep.diagnostics.visibleEnemies')>0
# Choose an actually explored, clear route whose first step keeps a visible foe in sight.
candidate=js('(()=>{const s=Hollowkeep.state,p=s.player,foes=s.enemies.filter(e=>e.hp>0&&s.visible[e.y*s.w+e.x]),blocked=new Set(s.map.map((t,i)=>({t,i})).filter(a=>!s.explored[a.i]||[0,2,5,6].includes(a.t)).map(a=>HKCore.key(a.i%s.w,Math.floor(a.i/s.w))));foes.forEach(e=>blocked.add(HKCore.key(e.x,e.y)));const out=[];for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++){if(!s.visible[y*s.w+x]||blocked.has(HKCore.key(x,y)))continue;const path=HKCore.pathfind(s,p,{x,y},blocked,false),pos=Hollowkeep.tileToScreen(x,y),r=document.getElementById("dungeon").getBoundingClientRect();if(path.length>1&&path.length<=6&&pos.x>r.left+20&&pos.x<r.right-20&&pos.y>r.top+90&&pos.y<r.bottom-45&&foes.some(e=>HKCore.los(s,path[0].x,path[0].y,e.x,e.y)))out.push({goal:{x,y},path})}return out.sort((a,b)=>b.path.length-a.path.length)[0]})()')
assert candidate
goal=candidate['goal']
pointer(goal['x'],goal['y']);t=state()['turn'];pointer(goal['x'],goal['y']);ab('wait',700);after=state();assert after['turn']==t+1 and js('Hollowkeep.diagnostics.visibleEnemies')>0
assert 'danger' in ab('get','text','#toast').lower()
snap('18-danger-stops-travel.png');passed('path travel stops after one legal step when a visible foe remains in sight')
# Enumerate each real diagnostic presentation; no turn advances while switching overlays.
before=js('Hollowkeep.digest()')
for mode in ['generation','walkability','regions','fov','paths','intent','queue','occupancy','rng']:
    button('Pause and open menu');ab('select','#setting-debug',mode);button('Resume');assert ab('get','text','#debug-overlay').startswith('DIAGNOSTICS / '+mode.upper());assert js('Hollowkeep.digest()')==before
snap('19-ai-debug-overlay.png');button('Pause and open menu');ab('select','#setting-debug','off');button('Resume');passed('all nine switchable overlays render live diagnostics and consume no turns')
ab('set','device','iPhone 15');ab('wait','--fn','devicePixelRatio===3 && Math.abs(document.getElementById("dungeon").width-document.getElementById("dungeon").getBoundingClientRect().width*3)<=1');metrics=js('({dpr:devicePixelRatio,width:innerWidth,canvas:document.getElementById("dungeon").width,css:document.getElementById("dungeon").getBoundingClientRect().width,overflow:document.documentElement.scrollWidth})');assert abs(metrics['canvas']-metrics['css']*3)<=1 and metrics['overflow']==metrics['width']
snap('20-high-dpi-mobile.png');button('Move west');assert state()['turn']==after['turn']+1
passed('real 3x high-DPI phone emulation resizes canvas correctly and labeled movement remains usable')
ab('set','viewport',1280,800)
assert not ab('errors');passed('no uncaught errors during pointer travel, all diagnostics or high-DPI resizing')
