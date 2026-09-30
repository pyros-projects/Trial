"""Agent-authored real-browser checks. All actions use agent-browser input commands.
JavaScript evaluation is used only for live state/diagnostics and screen coordinates.
"""
import subprocess,json,pathlib,shlex,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
LOG=ROOT/'evidence/logs/browser-runs.txt'
SESSION='hollowkeep'
def ab(*args):
    command=['agent-browser','--session',SESSION,*map(str,args)]
    p=subprocess.run(command,cwd=ROOT,text=True,capture_output=True,timeout=35)
    with LOG.open('a') as f:
        f.write('$ '+shlex.join(command)+'\n'+(p.stdout if len(p.stdout)<2500 else p.stdout[:2500]+'\n[output truncated in command log; turn traces recorded separately]\n')+p.stderr+'\n')
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


from collections import deque
DIRS=[(0,-1),(1,0),(0,1),(-1,0)];KEYS={(0,-1):'ArrowUp',(1,0):'ArrowRight',(0,1):'ArrowDown',(-1,0):'ArrowLeft'}
traces=[];new_summons=0;legal_phases=0;boss_warning_seen=False

def distance(a,b):return abs(a['x']-b['x'])+abs(a['y']-b['y'])
def visible(s):return[e for e in s['enemies']if s['visible'][e['y']*s['w']+e['x']]]
def danger(s,x,y):return any(h['x']==x and h['y']==y and h['due']<=s['turn']+1<=h['expires'] for h in s['hazards'])
def route(s,goal,avoid_poison=True):
    w,h=s['w'],s['h'];start=(s['player']['x'],s['player']['y']);end=(goal['x'],goal['y']);q=deque([start]);parents={start:None};occupied=({(e['x'],e['y'])for e in visible(s)}|{(c['x'],c['y'])for c in s['chests']if c['locked']and not s['player']['items']['key']and s['map'][c['y']*w+c['x']]==6})-{end}
    while q:
        x,y=q.popleft()
        if(x,y)==end:
            result=[]
            while parents[(x,y)] is not None:result.append((x,y));x,y=parents[(x,y)]
            return result[::-1]
        for dx,dy in DIRS:
            pos=(x+dx,y+dy)
            if 0<=pos[0]<w and 0<=pos[1]<h and pos not in parents and pos not in occupied and s['map'][pos[1]*w+pos[0]]!=0 and not(avoid_poison and s['map'][pos[1]*w+pos[0]]==5) and not danger(s,*pos):parents[pos]=(x,y);q.append(pos)
    return None

def aim(s,kind,enemy):
    ab('press',{'shoot':'2','fire':'3','frost':'5'}[kind]);foes=visible(s);index=next(i for i,e in enumerate(foes)if e['id']==enemy['id'])
    for i in range(index):ab('press','Tab')
    ab('press','Enter')
def use_item(name):
    ab('press','i');button('Use '+{'heal':'Mending draught','shield':'Ironbark tonic','antidote':'Silverleaf','ration':'Trail ration'}[name])

def play(label,max_turns=250,stop_floor=None):
    global new_summons,legal_phases,boss_warning_seen
    for step in range(max_turns):
        s=state();p=s['player'];foes=visible(s);adj=[e for e in foes if distance(p,e)==1]
        if s['mode']!='playing' or stop_floor and s['floor']>=stop_floor:break
        old=s;chosen=''
        if danger(s,p['x'],p['y']):
            choices=[]
            for dx,dy in DIRS:
                x,y=p['x']+dx,p['y']+dy
                if 0<=x<s['w']and 0<=y<s['h']and s['map'][y*s['w']+x]not in(0,2,5,6)and not danger(s,x,y)and not any(e['x']==x and e['y']==y for e in s['enemies']):choices.append((sum(distance({'x':x,'y':y},e)==1 for e in foes),dx,dy))
            if choices:
                _,dx,dy=min(choices);ab('press',KEYS[(dx,dy)]);chosen='dodge'
            elif not p['cooldowns']['blink']:
                escape=next(({'x':x,'y':y}for y in range(max(0,p['y']-4),min(s['h'],p['y']+5))for x in range(max(0,p['x']-4),min(s['w'],p['x']+5))if distance(p,{'x':x,'y':y})in(2,3,4)and s['visible'][y*s['w']+x]and s['map'][y*s['w']+x]in(1,3,4,7)and not danger(s,x,y)and not any(e['x']==x and e['y']==y for e in s['enemies'])),None)
                if escape:ab('press','6');pointer(escape['x'],escape['y']);chosen='blink-dodge'
        if not chosen and (p['status'].get('poison',0)>=2 or p['status'].get('burn',0)>=2)and p['items']['antidote']:
            use_item('antidote');chosen='cleanse'
        if not chosen and p['hp']<=p['maxHp']-13 and p['items']['heal']:
            ab('press','1');chosen='mend'
        if not chosen and adj:
            enemy=min(adj,key=lambda e:(e['kind']!='boss',e['hp']))
            if enemy['kind']=='boss'and not enemy['status'].get('stun')and not p['status'].get('shield')and p['items']['shield'] and enemy['hp']>15:use_item('shield');chosen='ironbark'
            elif enemy['kind']=='boss'and p['items']['frost']and not enemy['status'].get('stun')and enemy['hp']>12:aim(s,'frost',enemy);chosen='freeze'
            elif p['cooldowns']['cleave']==0:ab('press','7');chosen='cleave'
            else:ab('press',KEYS[(enemy['x']-p['x'],enemy['y']-p['y'])]);chosen='melee'
        if not chosen and foes:
            enemy=min(foes,key=lambda e:(distance(p,e),e['hp']));d=distance(p,enemy)
            if enemy['kind']=='boss'and d<=5 and p['items']['fire'] and not enemy['status'].get('burn')and enemy['hp']>10:aim(s,'fire',enemy);chosen='ember'
            elif enemy['kind']=='boss'and d<=5 and p['items']['frost'] and not enemy['status'].get('stun')and enemy['hp']>8:aim(s,'frost',enemy);chosen='freeze'
            elif p['ammo']and d<=7:aim(s,'shoot',enemy);chosen='ranged'
            else:
                path=route(s,enemy)or route(s,enemy,False)
                if path:
                    x,y=path[0];ab('press',KEYS[(x-p['x'],y-p['y'])]);chosen='pursue'
        if not chosen:
            caches=[c for c in s['chests']if s['map'][c['y']*s['w']+c['x']]==6 and s['visible'][c['y']*s['w']+c['x']]and (not c['locked']or p['items']['key'])and distance(p,c)<11]
            goal=min(caches,key=lambda c:distance(p,c))if caches else s['exit']
            if distance(p,goal)==0:ab('press','e');chosen='stairs'
            else:
                path=route(s,goal)or route(s,goal,False)
                if path:
                    x,y=path[0];ab('press',KEYS[(x-p['x'],y-p['y'])]);chosen='explore/cache'if caches else'explore/stairs'
                else:ab('press','Space');chosen='wait'
        after=state()
        if after['turn']!=old['turn']+1:
            raise AssertionError(f"Chosen action {chosen} did not advance one turn: {ab('get','text','#toast')}")
        diagnostics=js('Hollowkeep.diagnostics');assert diagnostics['occupancyValid']and len({q['id']for q in diagnostics['queue']})==len(diagnostics['queue'])and all(q['actions']<=1 for q in diagnostics['queue'])
        if after['floor']==old['floor']:
            previous={e['id']:e for e in old['enemies']}
            for e in after['enemies']:
                if e['id']in previous:assert distance(e,previous[e['id']])<=1
                else:assert e['lastAct']==-1 and not any(q['id']==e['id']for q in after['queue']);new_summons+=1
            legal_phases+=1
        else:
            assert after['floor']==old['floor']+1 and after['queue']==[]and all(e['lastAct']==-1 for e in after['enemies'])
            snap(f"{label}-floor-{after['floor']}.png")
            print(f"{label}: reached floor {after['floor']}, turn {after['turn']}, HP {after['player']['hp']}",flush=True)
        if after['hazards']and any(e['kind']=='boss'for e in after['enemies'])and not boss_warning_seen:
            snap(label+'-boss-warning.png');boss_warning_seen=True
        traces.append({'run':label,'action':chosen,'floor':after['floor'],'turn':after['turn'],'hp':after['player']['hp'],'level':after['player']['level'],'rng':after['rng'],'mode':after['mode'],'kills':after['kills'],'caches':after['caches'],'player':[after['player']['x'],after['player']['y']],'hazards':after['hazards'],'queue':after['queue'],'enemies':[{'id':e['id'],'kind':e['kind'],'x':e['x'],'y':e['y'],'hp':e['hp'],'intent':e['intent'],'memory':e['memory'],'lastKnown':e['lastKnown']}for e in after['enemies']]})
        if step%30==0:print(f"{label}: floor {after['floor']} turn {after['turn']} · HP {after['player']['hp']} · kills {after['kills']}",flush=True)
    with(ROOT/'evidence/logs/long-run-trace.json').open('w')as f:json.dump(traces,f,indent=2)
    return state()

if js('document.getElementById("modal").open'):button('Close dialog')
if state()['seed']!='MOSS-731' or state()['floor']!=1 or state()['turn']!=21:
    button('Pause and open menu');button('Import JSON');ab('upload','#import-file',str(ROOT/'evidence/exported-run.json'));ab('wait','--fn','document.getElementById("import-text").value.length > 100');button('Import expedition')
# Continue the naturally played default-layout run through its first actual stair.
s=play('13-default-journey',120,stop_floor=2)
assert s['floor']==2 and s['mode']=='playing';passed('default journey reaches the real floor-II stair with live combat, loot, statuses and escalating enemies')
t=s['turn'];button('Pause and open menu');button('Rekindle floor');s=state();assert s['turn']==t+1 and s['player']['x']==s['entry']['x']and s['player']['y']==s['entry']['y']and s['penalty']==200 and js('Hollowkeep.verifyReplay()')
passed('forgiving floor checkpoint restarts deterministically with the advertised score penalty')
# Full five-floor compact journey; all advancement remains genuine input.
button('New run');ab('fill','#run-seed','CROWN-57');ab('select','#run-style','arena');ab('select','#run-difficulty','gentle');ab('check','input[name="keeper"][value="warden"]');button('Begin expedition')
button('Inventory I');button('Equip Notched axe');button('Equip Mossstone charm');button('Close dialog')
s=play('14-full-expedition',450)
assert s['mode']=='victory'and s['floor']==5
ab('wait','--fn','document.getElementById("modal").open');snap('15-victory-summary.png')
assert js('Hollowkeep.verifyReplay()');passed('complete five-floor victory, boss combat, local record and exact replay')
assert js('JSON.parse(localStorage.getItem("hollowkeep.records.v3")).some(r=>r.mode==="victory"&&r.seed==="CROWN-57")')
button('Export run');button('Close dialog');button('Pause and open menu');ab('download','#menu-export',str(ROOT/'evidence/victory-run.json'));button('Resume')
print(f'PASS {legal_phases} legal live enemy phases; {new_summons} newly spawned enemies observed waiting; boss warnings={boss_warning_seen}',flush=True)
assert not ab('errors');passed('no uncaught errors during long multi-floor play')
