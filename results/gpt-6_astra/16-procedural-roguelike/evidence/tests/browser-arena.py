from browser_driver import *
from collections import deque
results=[]
s=state();assert s['config']['seed']=='MOSS-2048';assert diag()['map']['valid'];assert diag()['map']['regions']==1
for gear in ['plate','fang','charm']:
    click('Satchel');ab('click','[data-equip="'+gear+'"]');occupancy(state())
ab('focus','#map');key('2');key('Enter');s=state();assert s['turn']==4 and s['player']['cd']['shot']==2;assert any('takes 4 damage' in l['text'] for l in s['log']);results.append({'check':'keyboard ranged targeting','status':'pass','turn':s['turn']})
s=move('.');e=next(e for e in s['enemies'] if e['id']==4);assert e['alert']==4
click('Satchel');ab('click','[data-use="smoke"]');s=state();trace=[]
for i in range(4):
    e=next(e for e in s['enemies'] if e['id']==4);trace.append({'turn':s['turn'],'memory':e['memory'],'remaining':e['alert'],'intent':e['intent'],'veil':s['player']['status'].get('veil',0)})
    if i<3:s=move('.')
assert trace[-1]['memory'] is None and trace[-1]['remaining']==0;results.append({'check':'enemy loses last known position after four unseen phases under veil','status':'pass','trace':trace});screenshot('15-veil-and-memory')
# Real keyboard navigation and combat through three compact generated floors.
def bfs(s,to,occupied=True):
    m=s['map'];start=(s['player']['x'],s['player']['y']);end=tuple(to);q=deque([start]);came={start:None};blocked={(h['x'],h['y']) for h in m['hazards'] if h['active']}
    if occupied:blocked|={(e['x'],e['y']) for e in s['enemies'] if (e['x'],e['y'])!=end}
    while q:
        at=q.popleft()
        if at==end:
            out=[]
            while at!=start:out.append(at);at=came[at]
            return out[::-1]
        for dx,dy in [(0,-1),(1,0),(0,1),(-1,0)]:
            n=(at[0]+dx,at[1]+dy)
            if 0<=n[0]<m['w'] and 0<=n[1]<m['h'] and m['tiles'][n[1]*m['w']+n[0]] and n not in came and n not in blocked:came[n]=at;q.append(n)
    return []
def step_to(s,n):
    dx=n[0]-s['player']['x'];dy=n[1]-s['player']['y'];return move({(1,0):'ArrowRight',(-1,0):'ArrowLeft',(0,1):'ArrowDown',(0,-1):'ArrowUp'}[(dx,dy)])
def use(id):
    click('Satchel');ab('click','[data-use="'+id+'"]')
lastfloor=1;checks=0;detours=[];bossDodge=[]
for attempt in range(250):
    s=state();p=s['player'];m=s['map'];occupancy(s)
    if s['outcome']!='active':break
    if s['floor']!=lastfloor:
        results.append({'check':'actual descent to floor '+str(s['floor']),'status':'pass','turn':s['turn'],'validation':diag()['map']});screenshot('16-floor-'+str(s['floor']));lastfloor=s['floor']
    # Read-only perception diagnostics record real memory positions when line of sight is absent.
    ai=js('(()=>{const s=Embervault.getState();return s.enemies.map(e=>({id:e.id,seen:EmberEngine.perceived(s,e),memory:e.memory,alert:e.alert,path:e.path,x:e.x,y:e.y}))})()')
    for a in ai:
        if not a['seen'] and a['memory'] and a['memory']!={'x':p['x'],'y':p['y']}:detours.append({'turn':s['turn'],'enemy':a['id'],'memory':a['memory'],'player':{'x':p['x'],'y':p['y']},'alert':a['alert']})
    if p['hp']<p['maxHp']-17 and p['items']['potion']>0:click('Mend');continue
    tele=[t for t in s['telegraphs'] if t['due']>=s['turn']]
    if tele:
        t=tele[0];dx=abs(p['x']-t['x']);dy=abs(p['y']-t['y'])
        if (dx==0 and dy<=2) or (dy==0 and dx<=2):
            # Find a shortest safe route off the marked cross within remaining turns.
            options=[]
            for x in range(max(1,p['x']-3),min(m['w']-1,p['x']+4)):
                for y in range(max(1,p['y']-3),min(m['h']-1,p['y']+4)):
                    if (x==t['x'] and abs(y-t['y'])<=2) or (y==t['y'] and abs(x-t['x'])<=2):continue
                    r=bfs(s,(x,y))
                    if r and len(r)<=t['due']-s['turn']:options.append(r)
            if options:
                r=min(options,key=len);before=s;after=step_to(s,r[0]);bossDodge.append({'turn':after['turn'],'hpBefore':before['player']['hp'],'hpAfter':after['player']['hp'],'mark':t,'position':{'x':after['player']['x'],'y':after['player']['y']}});continue
    visible=[e for e in s['enemies'] if s['visible'][e['y']*m['w']+e['x']]]
    visible.sort(key=lambda e:abs(e['x']-p['x'])+abs(e['y']-p['y']))
    if visible:
        e=visible[0];d=abs(e['x']-p['x'])+abs(e['y']-p['y'])
        if d==1:step_to(s,(e['x'],e['y']));checks+=1;continue
        if d<=5 and e['type']=='warden' and p['items']['frost']>0:key('5');key('Enter');continue
        if d<=7 and p['cd']['shot']==0:key('2');key('Enter');checks+=1;continue
        if d<=5 and d>1 and e['type']=='warden' and p['items']['fire']>0:key('4');key('Enter');continue
        r=bfs(s,(e['x'],e['y']))
        if r:step_to(s,r[0]);checks+=1;continue
    # Head toward exit even before it is visible; all movement remains genuine UI input.
    target=(m['exit']['x'],m['exit']['y'])
    if (p['x'],p['y'])==target:
        ab('focus','#map');key('e');continue
    r=bfs(s,target)
    if r:step_to(s,r[0]);checks+=1
    else:
        # Disarm an adjacent hazard if it is the only safe-path blocker.
        adj=[h for h in m['hazards'] if h['active'] and abs(h['x']-p['x'])+abs(h['y']-p['y'])==1]
        if adj:ab('focus','#map');key('e')
        else:move('.')
    if attempt%20==0:print('progress',attempt,'floor',s['floor'],'turn',s['turn'],'hp',p['hp'],'enemies',len(s['enemies']),flush=True)
s=state();print('end',s['outcome'],'floor',s['floor'],'turn',s['turn'],'hp',s['player']['hp'],'boss',s['bossDefeated'],flush=True)
results.append({'check':'automated UI expedition outcome','status':'pass' if s['outcome']=='victory' else 'fail','outcome':s['outcome'],'floor':s['floor'],'turn':s['turn'],'bossDefeated':s['bossDefeated'],'legalTurnsChecked':checks,'outsideLosMemoryObservations':detours[:10],'bossDodge':bossDodge})
screenshot('17-arena-run-outcome');(ROOT/'evidence/logs/browser-arena-results.json').write_text(json.dumps(results,indent=2));(ROOT/'evidence/logs/completed-arena-state.json').write_text(json.dumps(s));print(json.dumps(results[:3],indent=2));assert s['outcome']=='victory'
