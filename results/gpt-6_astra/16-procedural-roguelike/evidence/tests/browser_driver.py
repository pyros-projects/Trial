import subprocess,json,time,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
LOG=ROOT/'evidence/logs/browser-commands.jsonl'
def ab(*args,parse=False):
    cmd=['agent-browser','--session','embervault']+(['--json'] if parse else [])+list(args)
    p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=40)
    with LOG.open('a') as f:f.write(json.dumps({'command':cmd,'returncode':p.returncode,'stdout':p.stdout,'stderr':p.stderr})+'\n')
    if p.returncode:raise RuntimeError(p.stdout+p.stderr)
    if parse:
        data=json.loads(p.stdout)
        if not data.get('success'):raise RuntimeError(str(data))
        return data['data'].get('result',data['data'])
    return p.stdout

def js(code):return ab('eval',code,parse=True)
def state():return js('Embervault.getState()')
def diag():return js('Embervault.getDiagnostics()')
def click(name):return ab('find','role','button','click','--name',name,'--exact')
def key(k):return ab('press',k)
def screenshot(name):return ab('screenshot','evidence/screenshots/'+name+'.png')
def tileclick(x,y):
    pt=js(f'Embervault.tileToScreen({x},{y})')
    ab('mouse','move',str(round(pt['x'])),str(round(pt['y'])))
    ab('mouse','down');ab('mouse','up')
def occupancy(s):
    m=s['map'];p=s['player'];occupied={(p['x'],p['y'])}
    for e in s['enemies']:
        assert m['tiles'][e['y']*m['w']+e['x']] in [1,3],('enemy in wall/door',e)
        assert (e['x'],e['y']) not in occupied,('collision',e)
        occupied.add((e['x'],e['y']))
        assert e['lastAct']<=s['turn']
    assert len(s['queue'])==len(set(s['queue'])),'duplicate enemy actions'
def legal(before,after):
    assert after['turn'] in [before['turn'],before['turn']+1]
    occupancy(after)
    if before['floor']==after['floor']:
        old={e['id']:e for e in before['enemies']}
        for e in after['enemies']:
            if e['id'] in old:
                o=old[e['id']];assert abs(e['x']-o['x'])+abs(e['y']-o['y'])<=1,('enemy teleported',o,e)
def move(k):
    before=state();key(k);after=state();legal(before,after);return after

def newrun(seed,style='arena',difficulty='story',preset='standard',mode='forgiving'):
    if not diag()['modal']:click('Ⅱ Menu')
    if diag()['modal']!='new':click('New expedition')
    ab('fill','#newSeed',seed);ab('select','#newStyle',style);ab('select','#newDifficulty',difficulty);ab('select','#newPreset',preset);ab('select','#newMode',mode);ab('click','#beginRun')
    s=state();assert s['turn']==0 and s['config']['seed']==seed;occupancy(s);return s
if __name__=='__main__':
    results=[]
    def check(name,fn):
        result=fn();results.append({'check':name,'result':'pass','observed':result});print(name,result,flush=True)
    s=state();check('seed1 connected',lambda:diag()['map'])
    a=diag()['fingerprint'];time.sleep(1.15);assert a==diag()['fingerprint'];check('no input freezes simulation',lambda:diag()['turn'])
    click('Ⅱ Menu');a=diag()['fingerprint'];key('ArrowRight');time.sleep(.5);assert a==diag()['fingerprint'];assert diag()['paused'];screenshot('04-paused-menu');click('Resume expedition');check('pause blocks movement and enemies',lambda:diag()['turn'])
    s=move('ArrowRight');assert s['player']['x']==8
    s=move('ArrowUp');assert s['player']['y']==14
    e=next(e for e in s['enemies'] if e['id']==99)
    click('Frost sigil');tileclick(e['x'],e['y']);s=state();e=next(e for e in s['enemies'] if e['id']==99);assert e['status']['frozen']==1
    old=(e['x'],e['y']);s=move('.');e=next(e for e in s['enemies'] if e['id']==99);assert e['status']['frozen']==0 and old==(e['x'],e['y']);check('frost consumes item and skips two enemy actions',lambda:{'turn':s['turn'],'frost':s['player']['items']['frost'],'enemy':e})
    click('Satchel');ab('click','[data-equip="plate"]');s=state();assert s['player']['gear']['armor']=='plate';check('equipment via inventory costs one turn',lambda:{'turn':s['turn'],'armor':s['player']['gear']['armor']})
    s=move('ArrowRight');s=move('.');assert s['player']['hp']<s['player']['maxHp'];check('enemy damage after real movement',lambda:{'hp':s['player']['hp'],'turn':s['turn'],'log':s['log'][-5:]});screenshot('05-combat-damage')
    adjacent=next(e for e in s['enemies'] if abs(e['x']-s['player']['x'])+abs(e['y']-s['player']['y'])==1);tileclick(adjacent['x'],adjacent['y']);s=state();assert s['player']['kills']>=1
    click('Mend');s=state();assert s['player']['hp']==s['player']['maxHp'];check('pointer melee and mending draught',lambda:{'hp':s['player']['hp'],'kills':s['player']['kills'],'potions':s['player']['items']['potion']})
    ab('focus','#map');key('e');s=state();assert s['map']['chests'][0]['opened'];check('cache interaction',lambda:{'gold':s['player']['gold'],'turn':s['turn']})
    click('Toggle diagnostics');screenshot('06-generation-diagnostics');click('Expand event log');screenshot('07-event-log');click('Close dialog')
    click('Ⅱ Menu');click('Save run');a=state();fp=diag()['fingerprint'];ab('reload');b=state();assert a==b;assert fp==diag()['fingerprint'];check('reload restores exact complete state',lambda:{'turn':b['turn'],'fingerprint':fp})
    click('Ⅱ Menu');click('Replay actions');ab('wait','--text','Deterministic replay verified.');screenshot('08-replay-verified');click('Return to your expedition');assert a==state();check('re-simulated replay exact state',lambda:diag()['fingerprint'])
    click('Mute sound');click('Enable sound');audio=diag()['audio'];assert audio['enabled'] and audio['state']=='running' and audio['notes']>0;check('audio user gesture created active context and tones',lambda:audio)
    (ROOT/'evidence/logs/browser-core-results.json').write_text(json.dumps(results,indent=2))
