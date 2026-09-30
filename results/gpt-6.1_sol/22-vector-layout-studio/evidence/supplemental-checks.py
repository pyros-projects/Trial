from browser_checks import *

run('open','http://127.0.0.1:8765/index.html');run('set','viewport',1280,800,1)
button('New');button('Fit')
a=make_rect('Marquee A',80,80,80,60);b=make_rect('Marquee B',180,100,60,60);c=make_rect('Marquee C',400,100,80,60)
before=state();gesture(screen(30,30),screen(270,180));s=state()
assert set(s['selection'])=={a,b} and s['document']==before['document'] and s['history']==before['history']
button('Additive selection');p=screen(440,130);gesture(p,p,steps=1);s=state();assert set(s['selection'])=={a,b,c}
p=screen(440,130);gesture(p,p,steps=1);assert set(state()['selection'])=={a,b}
button('Additive selection');button('Group selection');rename('Marquee pair');group_id=state()['selection'][0]
p=screen(600,400);gesture(p,p,steps=1);p=screen(120,110);gesture(p,p,steps=1);assert state()['selection']==[group_id]
layer('Marquee A');before=state();gesture(screen(120,110),screen(133,122));s=state()
assert next(n for n in s['items'] if n['id']==a)['bounds']!=next(n for n in before['items'] if n['id']==a)['bounds']
assert next(n for n in s['items'] if n['id']==b)['bounds']==next(n for n in before['items'] if n['id']==b)['bounds']
record('marquee-and-canvas-selection',s);shot('32-marquee-and-canvas-selection.png')
print('PASS actual marquee, canvas additive selection, group unit hit, Layers child selection and isolated child drag')

button('New');button('Text tool');p=screen(100,100);gesture(p,p,steps=1);prop('Font size',8)
run('fill','[aria-label="Text content"]','X'*2000);run('press','Control+Enter');before=state()
assert len(before['document']['items'][0]['g']['text'])==2000
run('fill','[aria-label="Text content"]','X'*2001);run('press','Control+Enter');s=state()
assert s['document']==before['document'] and s['history']==before['history'] and '2000' in s['status']
record('text-limit',s)

# Derive our boundary fixtures from an actual downloaded project, not from an evaluator fixture.
base=json.loads((ROOT/'downloads'/'roundtrip.json').read_text())
leaf={'id':'anchor_limit','name':'32 anchors','type':'path','visible':True,'locked':False,'m':[1,0,0,1,0,0],'style':{'fill':'none','stroke':'#345678','strokeWidth':2,'opacity':1},'g':{'closed':False,'nodes':[{'x':100+i*5,'y':100+(i%2)*20,'in':{'x':100+i*5,'y':100+(i%2)*20},'out':{'x':100+i*5,'y':100+(i%2)*20}} for i in range(32)]}}
tree=leaf
for i in range(4):tree={'id':'limit_group_'+str(i),'name':'Level '+str(i+1),'type':'group','visible':True,'locked':False,'m':[1,0,0,1,20,10],'style':{'fill':'none','stroke':'none','strokeWidth':0,'opacity':1},'g':{},'children':[tree]}
base['items']=[tree];file=ROOT/'downloads'/'supported-32-anchors-4-groups.json';file.write_text(json.dumps(base))
run('upload','#projectFile',str(file));run('wait','--fn','studioDiagnostics.status.startsWith("Imported")')
layer('32 anchors');before=state();assert before['counts']=={'items':5,'anchors':32}
prop('Outgoing control Y',90);assert state()['document']!=before['document'];before=state();record('anchor-depth-limits',before)
outcomes=[]
for name,mutation in [('33-anchors',lambda n:n['g']['nodes'].append(n['g']['nodes'][0])),('singular',lambda n:n.update(m=[0,0,0,0,0,0])),('reflection',lambda n:n.update(m=[-1,0,0,1,0,0])),('nonuniform',lambda n:n.update(m=[1,0,0,2,0,0]))]:
    d=json.loads(json.dumps(base));n=d['items'][0]
    for i in range(4):n=n['children'][0]
    mutation(n);f=ROOT/'downloads'/('invalid-'+name+'.json');f.write_text(json.dumps(d));run('upload','#projectFile',str(f));run('wait','--fn','studioDiagnostics.status.startsWith("Import refused")');s=state()
    assert s['document']==before['document'] and s['selection']==before['selection'] and s['history']==before['history'];outcomes.append({'case':name,'result':'pass','status':s['status']})
record('additional-limit-results',outcomes)
assert not json.loads(run('errors','--json'))['data']['errors']
button('Reset');button('Fit')
print('PASS 2000 entered text characters, editable 32-anchor path in four groups, atomic rejection of text 2001 / anchor 33 / singular / reflected / nonuniform transforms')
