import subprocess,json,shlex,pathlib,time,sys,os
ROOT=pathlib.Path(__file__).resolve().parent
LOG=ROOT/'commands.log'
def run(*args,stdin=None):
    if args[:2]==('mouse','move'):args=('mouse','move',round(float(args[2])),round(float(args[3])))
    cmd=['agent-browser','--session',os.getenv('FORM_TEST_SESSION','form'),*map(str,args)]
    with LOG.open('a') as f: f.write(shlex.join(cmd)+(('\nSTDIN: '+stdin) if stdin else '')+'\n')
    p=subprocess.run(cmd,input=stdin,text=True,capture_output=True,timeout=40)
    with LOG.open('a') as f:f.write(p.stdout+p.stderr+'\n')
    if p.returncode:raise RuntimeError(p.stdout+p.stderr)
    return p.stdout

def ev(code):return json.loads(run('eval','--stdin','--json',stdin=code))['data']['result']
def state():return ev('window.studioDiagnostics')
def button(name):run('find','role','button','click','--name',name,'--exact')
def prop(name,value):run('fill','[aria-label='+json.dumps(name)+']',str(value));run('press','Enter')
def select(name,val):run('select','[aria-label='+json.dumps(name)+']',str(val))
def screen(x,y):
    d=ev('({view:window.studioDiagnostics.view,rect:(()=>{const r=document.querySelector("#stage").getBoundingClientRect();return {x:r.x,y:r.y}})()})')
    return [d['rect']['x']+d['view']['x']+x*d['view']['z'],d['rect']['y']+d['view']['y']+y*d['view']['z']]
def gesture(a,b,steps=4,up=True):
    origin=[round(v) for v in a];delta=[round(b[k]-a[k]) for k in range(2)]
    run('mouse','move',*origin);run('mouse','down')
    for i in range(1,steps+1):run('mouse','move',*[origin[k]+delta[k]*i/steps for k in range(2)])
    if up:run('mouse','up')
def draw(tool,a,b):button(tool+' tool');gesture(screen(*a),screen(*b))
def rename(name):prop('Layer name',name)
def layer(name):
    run('scrollintoview','[aria-label='+json.dumps('Select layer '+name)+']');button('Select layer '+name)
def shot(name):run('screenshot',str(ROOT/'screenshots'/name))
def record(name,d): (ROOT/(name+'.json')).write_text(json.dumps(d,indent=2))
def check_creation():
    button('New');button('Fit');draw('Rectangle',(40,60),(120,100));s=state();record('creation-state',s)
    assert s['counts']['items']==1,'Dragged rectangle must remain in scene'
    assert abs(s['bounds']['x']-40)<1 and abs(s['bounds']['w']-80)<2,s['bounds']
    print('PASS rectangle drag creation')
if __name__=='__main__':check_creation()
def selection(names):
    pressed=ev('document.querySelector("#addSelection").getAttribute("aria-pressed")')
    if pressed=='true':button('Additive selection')
    layer(names[0]);button('Additive selection')
    for name in names[1:]:layer(name)
    button('Additive selection')
def check_opening():
    button('Reset');button('Fit');layer('Lavender gesture');prop('Fill color','#aabbd1');assert next(n for n in state()['document']['items'] if n['name']=='Lavender gesture')['style']['fill']=='#aabbd1'
    layer('Headline');run('find','label','Text content','fill','Make space\nfor wonder.');run('press','Control+Enter');assert state()['document']['items'][3]['g']['text']=='Make space\nfor wonder.'
    shot('04-edited-opening.png');select('Composition','orbit');assert state()['counts']['items']>=10
    layer('Warm satellite');prop('Position X',600);prop('Fill color','#e8aa7e');shot('05-second-composition.png')
    print('PASS opening shapes/text editable and second composition editable')
def make_rect(name,x,y,w,h):
    draw('Rectangle',(x,y),(x+w,y+h));rename(name)
    for key,value in [('Position X',x),('Position Y',y),('Bounds width',w),('Bounds height',h)]:prop(key,value)
    return state()['selection'][0]
def check_layout_groups():
    button('New');button('Fit');a=make_rect('A',40,60,80,40);b=make_rect('B',180,100,60,40);c=make_rect('C',320,160,80,40)
    selection(['A','B','C']);button('Align top');s=state();assert all(abs(i['bounds']['y']-60)<1e-8 for i in s['items'])
    button('Distribute horizontal gaps');s=state();record('equal-gaps',s);assert [round(i['bounds']['x'],5) for i in s['items']]==[40,190,320];assert [i['id'] for i in s['items']]==[a,b,c]
    shot('06-alignment-and-equal-gaps.png')
    layer('B');prop('Position X',50);layer('C');prop('Position X',60);selection(['A','B','C']);before=state();button('Distribute horizontal gaps');after=state();assert before['document']==after['document'] and 'smaller' in after['status']
    button('Undo');button('Undo');selection(['A','C']);before=state();button('Group selection');after=state();assert before['document']==after['document'] and before['selection']==after['selection'] and 'contiguous' in after['status']
    selection(['A','B']);before=state();button('Group selection');s=state();g=s['selection'][0];assert [i['bounds'] for i in before['items'] if i['id'] in [a,b]]==[i['bounds'] for i in s['items'] if i['id'] in [a,b]]
    rename('Pair');prop('Position X',100);prop('Rotation degrees',30);prop('Uniform scale factor',1.4);layer('A');prop('Rotation degrees',65);layer('Pair');before=state();record('group-before-ungroup',before);button('Ungroup selection');after=state();record('group-after-ungroup',after)
    for i in before['items']:
        if i['id'] in [a,b,c]:
            j=next(j for j in after['items'] if j['id']==i['id'])
            assert max(abs(i['bounds'][k]-j['bounds'][k]) for k in ['x','y','w','h'])<1e-8
    button('Undo');assert state()['selection']==[g];button('Redo');assert state()['selection']==[a,b]
    button('Undo');selection(['Pair','C']);button('Group selection');rename('Outer');layer('A');selection(['A','C']);before=state();button('Group selection');after=state();assert before['document']==after['document'] and 'same parent' in after['status']
    # Ancestor and descendant selection: one parent operation only.
    selection(['Outer','A']);before=state();prop('Uniform scale factor',1.2);after=state();record('nested-once-transform',after)
    outer_before=next(i for i in before['items'] if i['name']=='Outer');outer_after=next(i for i in after['items'] if i['name']=='Outer');assert abs(outer_after['bounds']['w']/outer_before['bounds']['w']-1.2)<1e-8
    # Locked descendant blocks a whole-parent transform.
    button('Lock A');layer('Outer');before=state();run('focus','#stage');run('press','ArrowRight');after=state();assert before['document']==after['document'] and 'Locked' in after['status']
    button('Unlock A');prop('Position X',140);shot('07-nested-groups.png')
    print('PASS exact equal gaps/refusal, contiguous grouping, nested transforms, ungroup geometry, undo/redo, descendant lock')
def check_field_cancel():
    layer('A');before=state();run('focus','[aria-label="Position X"]');run('press','Escape');prop('Position X',44);s=state();record('field-cancel-state',s);assert abs(next(i for i in s['items'] if i['name']=='A')['bounds']['x']-44)<1e-8,'Edit after untouched Escape must commit'
def check_first_anchor_cancel():
    button('New');button('Cubic path tool');run('mouse','move',*screen(100,100));run('mouse','down');run('press','Escape');run('mouse','up');s=state();record('first-anchor-cancel-state',s);assert s['pendingPath']==0 and s['history']['undo']==0
    button('Reset');assert state()['counts']['items']==17
def check_scrub_cancel():
    layer('Lavender gesture');run('scrollintoview','#opacityScrub');s=state();rect=ev('(()=>{const r=document.querySelector("#opacityScrub").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()')
    gesture([rect['x']+rect['w']-5,rect['y']+rect['h']/2],[rect['x']+rect['w']*.45,rect['y']+rect['h']/2],up=False)
    ev('document.querySelector("#opacityScrub").dispatchEvent(new PointerEvent("pointercancel",{bubbles:true,pointerId:1}))')
    after=state();record('scrub-cancel-state',after);run('mouse','up');assert after['document']==s['document'] and after['history']==s['history'],'Pointercancel must revert opacity without history'
def check_large_id():
    button('Open export dialog');run('download','#downloadProject',str(ROOT/'downloads'/'id-source.json'));button('Close dialog')
    data=json.loads((ROOT/'downloads'/'id-source.json').read_text());data['items'][0]['id']='item_9007199254740992';f=ROOT/'downloads'/'large-valid-id.json';f.write_text(json.dumps(data));run('upload','#projectFile',str(f));run('wait','--fn','studioDiagnostics.status.startsWith("Imported")');before=state();draw('Rectangle',(300,550),(390,575));after=state();record('large-id-state',after);assert after['counts']['items']==before['counts']['items']+1,'Creation after large opaque ID import must produce a unique ID'
def check_paths_text_exports():
    button('New');button('Fit');button('Cubic path tool');gesture(screen(100,100),screen(100,0));gesture(screen(200,100),screen(200,200));run('press','Enter');rename('Arch')
    for name,value in [('Anchor X',100),('Anchor Y',100),('Outgoing control X',100),('Outgoing control Y',0)]:prop(name,value)
    select('Selected anchor','1')
    for name,value in [('Anchor X',200),('Anchor Y',100),('Incoming control X',200),('Incoming control Y',0)]:prop(name,value)
    b=state()['bounds'];record('curve-extrema',state());assert all(abs(b[k]-v)<1e-8 for k,v in {'x':100,'y':25,'w':100,'h':75}.items()),b
    shot('09-real-cubic-extrema.png');prop('Incoming control Y',-30);assert state()['bounds']['y']<25;button('Close path');prop('Fill color','#c1b3db');assert next(n for n in state()['document']['items'] if n['name']=='Arch')['g']['closed'];button('Open path')
    draw('Ellipse',(300,80),(410,150));rename('Moon');draw('Line',(60,250),(260,250));rename('Rule')
    selection(['Arch','Moon']);button('Group selection');rename('Curve group');prop('Rotation degrees',23);prop('Uniform scale factor',1.15);layer('Arch');button('Edit nodes tool');select('Selected anchor','0');prop('Outgoing control Y',-20)
    s=state();e=next(i for i in s['items'] if i['name']=='Arch');g=next(n for n in s['document']['items'][0]['children'] if n['name']=='Arch')['g'];p=g['nodes'][0]['out'];m=e['worldMatrix'];wp=[m[0]*p['x']+m[2]*p['y']+m[4],m[1]*p['x']+m[3]*p['y']+m[5]];before=s;gesture(screen(*wp),screen(wp[0]+15,wp[1]+8));s=state();assert before['document']!=s['document'];shot('10-transformed-node-edit.png')
    button('Text tool');a=screen(70,380);gesture(a,a,steps=1);run('fill','[aria-label="Text content"]','First line\nSecond line');run('press','Control+Enter');rename('Notes');select('Font family','monospace');prop('Font size',18);select('Font weight','bold');select('Text alignment','center');prop('Line height',1.6);prop('Fill color','#405632');prop('Rotation degrees',-8)
    before=state();literal='<img src=x onerror=alert(1)> & "layout"\nLiteral text, editable.';run('fill','[aria-label="Text content"]',literal);run('press','Control+Enter');after=state();assert after['history']['undo']==before['history']['undo']+1;assert ev('document.querySelectorAll("#stage img, #stage script, #stage foreignObject").length')==0
    button('Undo');assert state()['document']==before['document'];button('Redo');assert state()['document']==after['document'];run('fill','[aria-label="Text content"]','Cancelled draft');run('press','Escape');assert state()['document']==after['document']
    # Native shortcuts while editing must not affect scene objects.
    run('focus','[aria-label="Text content"]');run('press','Control+a');run('press','Backspace');run('press','Escape');assert state()['document']==after['document']
    layer('Rule');button('Hide Rule');button('Lock Moon');layer('Notes');button('Lower layer');button('Unlock Moon');selection(['Curve group','Notes']);button('Group selection');rename('Artwork');button('Lock Moon');before_lock=state();run('focus','#stage');run('press','ArrowRight');assert state()['document']==before_lock['document'] # Whole parent edit refused.
    button('Artboard preview');shot('11-scene-preview.png');button('Close dialog');button('Open export dialog');run('download','#downloadProject',str(ROOT/'downloads'/'roundtrip.json'));run('download','#downloadSVG',str(ROOT/'downloads'/'artwork.svg'));run('download','#downloadPNG',str(ROOT/'downloads'/'artwork-1x.png'));select('PNG resolution','2');run('download','#downloadPNG',str(ROOT/'downloads'/'artwork-2x.png'));button('Close dialog');record('export-scene',state())
    print('PASS actual cubic tools/extrema, transformed node gesture, multiline typography/literal text/history, preview and real downloads')
def check_snapping():
    button('New');button('Document');prop('Artboard width',600);prop('Artboard height',400);button('Design');button('Fit');make_rect('Target',100,100,100,60);make_rect('Mover',350,230,60,50)
    for z,snap_x,free_x in [('1',205,208),('2',202.5,204)]:
        select('Zoom',z);layer('Mover');prop('Position X',350);prop('Position Y',230)
        gesture(screen(380,255),screen(snap_x+30,255),up=False);s=state();assert abs(s['bounds']['x']-200)<.01,(z,s['bounds']);assert any(g['axis']=='x' and abs(g['at']-200)<.01 for g in s['guides']);record('snap-'+z+'x',s);shot('12-snap-'+z+'x-guide.png');run('mouse','up')
        prop('Position X',350);gesture(screen(380,255),screen(free_x+30,255),up=False);s=state();assert abs(s['bounds']['x']-free_x)<.51,(z,s['bounds']);assert not any(g['axis']=='x' for g in s['guides']);run('mouse','up')
    select('Zoom','1');layer('Mover');prop('Position X',350);button('Snap to objects');button('Grid');gesture(screen(380,255),screen(243,255),up=False);s=state();assert abs(s['bounds']['x']-210)<.01,s['bounds'];assert any(g['target']=='grid' for g in s['guides']);run('mouse','up')
    button('Grid');button('Snap to objects');button('Hide Target');layer('Mover');prop('Position X',350);gesture(screen(380,255),screen(237,255),up=False);s=state();assert abs(s['bounds']['x']-207)<=1.01 and not any(g['axis']=='x' for g in s['guides']);run('mouse','up');button('Show Target')
    prop('Position X',350);selection(['Target','Mover']);gesture(screen(380,255),screen(385,255),up=False);s=state();assert abs(s['bounds']['x']-105)<=1.01 and not any(g['axis']=='x' for g in s['guides']);run('mouse','up')
    layer('Target');prop('Position X',100);layer('Mover');prop('Position X',350);selection(['Target','Mover']);button('Group selection');rename('Snap group');layer('Target');gesture(screen(150,130),screen(258,130),up=False);s=state();assert abs(s['bounds']['x']-208)<=1.01 and not any(g['axis']=='x' for g in s['guides']),s;run('mouse','up')
    prop('Position X',100);button('Lock Mover');gesture(screen(150,130),screen(405,130),up=False);s=state();assert abs(s['bounds']['x']-350)<.01 and any(g['target']==next(i['id'] for i in s['items'] if i['name']=='Mover') for g in s['guides']);record('nested-child-snap',s);run('mouse','up');shot('13-nested-snap.png')
    print('PASS object snapping at 5/8 CSS px at 100%/200%, separate grid, hidden/subtree/ancestor exclusions and locked sibling targets')
def check_imports_limits():
    source=ROOT/'downloads'/'roundtrip.json';base=json.loads(source.read_text());button('New');run('upload','#projectFile',str(source));run('wait','--fn','studioDiagnostics.status.startsWith("Imported")');s=state();assert s['document']==base and s['history']=={'undo':0,'redo':0};layer('Arch');prop('Position X',150);before=state();bad={}
    bad['malformed']='{ broken JSON'
    d=json.loads(json.dumps(base));d['items'][0]['children'][0]['children'][1]['id']=d['items'][0]['children'][0]['children'][0]['id'];bad['duplicate-id']=json.dumps(d)
    leaf=json.loads(json.dumps(base['items'][1]));leaf['visible']=True
    def group(child,i):return {'id':'nest_'+str(i),'type':'group','name':'Nesting '+str(i),'m':[1,0,0,1,0,0],'style':{'fill':'none','stroke':'none','strokeWidth':0,'opacity':1},'g':{},'children':[child],'visible':True,'locked':False}
    tree=leaf
    for i in range(5):tree=group(tree,i)
    d=json.loads(json.dumps(base));d['items']=[tree];bad['excess-depth']=json.dumps(d)
    bad['non-finite']=json.dumps(base).replace('"width": 1200','"width": 1e309')
    d=json.loads(json.dumps(base));d['items'][0]['type']='script';bad['unsupported-type']=json.dumps(d)
    d=json.loads(json.dumps(base));d['items']=[dict(leaf,id='overflow_'+str(i)) for i in range(201)];bad['over-count']=json.dumps(d)
    bad['over-bytes']=' '*2097153+json.dumps(base)
    d=json.loads(json.dumps(base));d['items'][0]['src']='https://example.com/unsafe.png';bad['remote-resource']=json.dumps(d)
    d=json.loads(json.dumps(base));d['items'][0]['style']['fill']='url(https://example.com/paint.svg)';bad['unsafe-paint']=json.dumps(d)
    d=json.loads(json.dumps(base));d['version']=99;bad['unsupported-version']=json.dumps(d)
    bad['html-as-json']='<html><script>alert(1)</script></html>'
    bad['svg-as-json']='<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'
    outcomes=[]
    for name,content in bad.items():
        file=ROOT/'downloads'/('invalid-'+name+'.json');file.write_text(content);run('upload','#projectFile',str(file));run('wait','--fn','studioDiagnostics.status.startsWith("Import refused")');after=state();assert after['document']==before['document'] and after['selection']==before['selection'] and after['history']==before['history'],name;outcomes.append({'name':name,'status':after['status']})
    raw=ROOT/'downloads'/'arbitrary.svg';raw.write_text(bad['svg-as-json']);run('upload','#projectFile',str(raw));after=state();assert after['document']==before['document'] and after['history']==before['history'];outcomes.append({'name':'raw-svg','status':after['status']});record('hostile-import-results',outcomes)
    # Actual supported item limit, followed by an atomic refusal of item 201.
    d=json.loads(json.dumps(base));template={'id':'bounded_0','type':'rect','name':'Bounded 0','m':[1,0,0,1,0,0],'style':{'fill':'#b1c09a','stroke':'none','strokeWidth':0,'opacity':1},'g':{'x':10,'y':10,'w':12,'h':12,'rx':0},'visible':True,'locked':False};d['items']=[dict(template,id='bounded_'+str(i),name='Bounded '+str(i),g={'x':10+(i%20)*25,'y':10+(i//20)*25,'w':12,'h':12,'rx':0}) for i in range(200)];file=ROOT/'downloads'/'supported-200.json';file.write_text(json.dumps(d));run('upload','#projectFile',str(file));run('wait','--fn','studioDiagnostics.status.startsWith("Imported")');assert state()['counts']['items']==200;before=state();button('Rectangle tool');a=screen(750,550);gesture(a,a,steps=1);after=state();assert before['document']==after['document'] and '200' in after['status'];shot('18-supported-200-items.png')
    run('upload','#projectFile',str(source));run('wait','--fn','studioDiagnostics.status.startsWith("Imported")');layer('Arch');prop('Uniform scale factor',0);s=state();assert s['document']==base and s['history']['undo']==0 and 'Positive' in s['status'];prop('Uniform scale factor',-1);assert state()['document']==base
    print('PASS own-project roundtrip and 13 hostile imports preserve scene/selection/history; 200 items accepted, 201 refused; nonpositive scales refused')
def handle(kind,index=0):
    selector='#stage [data-handle="'+kind+'"][data-index="'+str(index)+'"]'
    return ev('(()=>{const r=document.querySelector('+json.dumps(selector)+').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()')
def check_focus_cancel():
    button('New');button('Fit');make_rect('Focus test',100,100,100,80);button('Snap to objects');before=state();gesture(screen(150,140),screen(230,200),up=False);assert state()['document']!=before['document'];run('press','Tab');after=state();record('focus-cancel-state',after);run('mouse','up');assert after['document']==before['document'] and after['history']==before['history'],'Moving focus away from artboard must cancel active drag'
def check_group_opacity():
    button('New');button('Fit');make_rect('Back',100,100,120,90);prop('Fill color','#345678');make_rect('Front',155,135,120,90);prop('Fill color','#df8754');selection(['Back','Front']);button('Group selection');prop('Opacity percent',50)
    button('Open export dialog');run('download','#downloadPNG',str(ROOT/'downloads'/'group-opacity-before.png'));button('Close dialog');button('Ungroup selection');button('Open export dialog');run('download','#downloadPNG',str(ROOT/'downloads'/'group-opacity-after.png'));button('Close dialog');assert (ROOT/'downloads'/'group-opacity-before.png').read_bytes()==(ROOT/'downloads'/'group-opacity-after.png').read_bytes(),'Ungroup should keep overlap appearance when distributing opacity'
def check_history_continuity():
    button('New');button('Document');prop('Artboard width',600);prop('Artboard height',400);button('Design');button('Fit');select('Zoom','1');make_rect('A',100,100,80,50);button('Snap to objects');before=state();p=handle('resize',2);gesture(p,[p[0]+40,p[1]+20]);s=state();assert abs(s['bounds']['w']-120)<1 and abs(s['bounds']['h']-70)<1;assert s['history']['undo']==before['history']['undo']+1;prop('Local width',120);prop('Local height',70)
    before=state();gesture(screen(160,135),screen(240,180),steps=30);after=state();assert after['history']['undo']==before['history']['undo']+1 and abs(after['bounds']['x']-180)<.01 and abs(after['bounds']['y']-145)<.01
    button('Undo');assert state()['document']==before['document'] and state()['selection']==before['selection'];button('Pan tool');gesture([650,590],[705,623]);select('Zoom','2');button('Select tool');assert state()['history']['undo']==before['history']['undo'];button('Redo');assert state()['document']==after['document']
    before=state();gesture(screen(240,180),screen(250,195));s=state();assert abs(s['bounds']['x']-190)<.01 and abs(s['bounds']['y']-160)<.01
    run('set','viewport',1450,900);before=state();gesture(screen(250,195),screen(261,202));s=state();assert abs(s['bounds']['x']-201)<.01 and abs(s['bounds']['y']-167)<.01;shot('20-pan-zoom-resize-continuity.png')
    run('scrollintoview','#opacityScrub');r=ev('(()=>{const r=document.querySelector("#opacityScrub").getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()');before=state();gesture([r['x']+r['w']-8,r['y']+r['h']/2],[r['x']+r['w']*.45,r['y']+r['h']/2],steps=12);after=state();assert after['history']['undo']==before['history']['undo']+1;button('Undo');assert state()['document']==before['document'];button('Redo');assert state()['document']==after['document']
    button('Fit');button('Text tool');a=screen(70,300);gesture(a,a,steps=1);before=state();run('fill','[aria-label="Text content"]','History has one\ncommitted text step.');run('press','Control+Enter');after=state();assert after['history']['undo']==before['history']['undo']+1;button('Undo');assert state()['document']==before['document'];button('Redo');assert state()['document']==after['document'];rename('Text')
    layer('A');before=state();button('Raise layer');after=state();assert after['history']['undo']==before['history']['undo']+1 and before['document']['items'][0]['id']==after['document']['items'][1]['id'];button('Undo');assert state()['document']==before['document'];button('Redo');assert state()['document']==after['document'];button('Undo');run('focus','#stage');run('press','ArrowRight');assert state()['history']['redo']==0
    before=state();b=before['bounds'];start=screen(b['x']+b['w']/2,b['y']+b['h']/2);gesture(start,[start[0]+45,start[1]+25],up=False);run('press','Escape');run('mouse','up');assert state()['document']==before['document'] and state()['history']==before['history']
    gesture(start,[start[0]+38,start[1]+22],up=False);ev('document.querySelector("#stage").dispatchEvent(new PointerEvent("pointercancel",{bubbles:true,pointerId:1}))');run('mouse','up');assert state()['document']==before['document'] and state()['history']==before['history']
    run('focus','#stage');run('press','Control+a');assert len(state()['selection'])==2;button('Duplicate selection');assert state()['counts']['items']==4;button('Delete selection');assert state()['counts']['items']==2;button('Undo');assert state()['counts']['items']==4;button('Redo');assert state()['counts']['items']==2
    run('set','viewport',1280,800);button('Fit');record('history-and-continuity',state());print('PASS handles, long-drag/scrub/text/order single-step history, pan/zoom/viewport continuity, exact nudges, redo branch, Escape/pointercancel, duplicate/delete')
def check_layers_locks():
    button('New');button('Document');prop('Artboard width',600);prop('Artboard height',400);button('Design');button('Fit');make_rect('Back',100,100,110,100);prop('Fill color','#bb593e');make_rect('Front',150,150,110,100);prop('Fill color','#6674c0');before=state();button('Lower layer');s=state();assert [n['name'] for n in s['document']['items']]==['Front','Back'];shot('21-layer-occlusion.png')
    button('Open export dialog');run('download','#downloadSVG',str(ROOT/'downloads'/'layer-order.svg'));button('Close dialog');button('Hide Back');layer('Back');a=screen(180,180);gesture(a,a,steps=1);assert next(i['name'] for i in state()['items'] if i['id']==state()['selection'][0])=='Front';button('Show Back');layer('Front');button('Lock Front');before=state();gesture(screen(240,200),screen(280,240));assert state()['document']==before['document'] and state()['history']==before['history'];button('Delete selection');assert state()['document']==before['document'] and 'Locked' in state()['status'];button('Unlock Front');prop('Position X',160)
    selection(['Front','Back']);button('Group selection');rename('Pair');button('Lock Back');before=state();run('focus','#stage');run('press','ArrowRight');assert state()['document']==before['document'];button('Unlock Back');prop('Position X',130);button('Lock Front');button('Open export dialog');run('download','#downloadSVG',str(ROOT/'downloads'/'locked-visible.svg'));button('Close dialog');button('Unlock Front')
    button('Hide Pair');before=state();button('Ungroup selection');s=state();assert all(not n['visible'] for n in s['document']['items']);button('Undo');assert state()['document']==before['document'];button('Redo');assert all(not n['visible'] for n in state()['document']['items']);button('Show Front');button('Show Back');record('layers-locks',state());print('PASS visual paint order/export order, hide/show, hidden hit exclusion, locks refuse drag/delete/parent movement, unlocking and hidden-group ungroup')
def mobile_inspect():
    run('scrollintoview','#showInspector');button('Toggle Inspector panel')
def mobile_layers():
    run('scrollintoview','#showLayers');button('Toggle Layers panel')
def check_mobile():
    run('set','viewport',390,844);button('Reset');button('Fit artboard');shot('22-mobile-opening.png');button('New');mobile_inspect();button('Document');prop('Artboard width',640);prop('Artboard height',640);prop('Artboard background','none');button('Design');button('Close Inspector panel');button('Fit artboard');draw('Rectangle',(80,100),(240,200));mobile_inspect();rename('Phone card');prop('Position X',80);prop('Position Y',100);prop('Bounds width',160);prop('Bounds height',100);prop('Fill color','#6b8b59');button('Close Inspector panel')
    before=state();p=handle('resize',2);gesture(p,[p[0]+30,p[1]+25]);after=state();assert after['history']['undo']==before['history']['undo']+1
    visible=ev('(()=>{const n=studioDiagnostics.selection[0],el=document.querySelector("#stage [data-item=\\\""+n+"\\\"] rect:not([fill=transparent])"),r=el.getBoundingClientRect(),stage=document.querySelector("#stage").getBoundingClientRect(),v=studioDiagnostics.view;return {x:(r.x-stage.x-v.x)/v.z,y:(r.y-stage.y-v.y)/v.z,w:r.width/v.z,h:r.height/v.z}})()')
    assert all(abs(visible[k]-after['bounds'][k])<.001 for k in ['x','y','w','h']);shot('23-mobile-handles.png')
    button('Pan tool');gesture([275,630],[296,651]);run('scrollintoview','#objectSnap');button('Snap to objects');button('Zoom in');button('Zoom in');button('Select tool');before=state();b=before['bounds'];p=screen(b['x']+b['w']/2,b['y']+b['h']/2);gesture(p,[p[0]+24,p[1]+18]);after=state();assert abs(after['bounds']['x']-before['bounds']['x']-24/before['view']['z'])<.001 and abs(after['bounds']['y']-before['bounds']['y']-18/before['view']['z'])<.001
    button('Text tool');p=screen(60,450);gesture(p,p,steps=1);run('fill','[aria-label="Text content"]','Small screen.\nBig possibilities.');run('press','Control+Enter');rename('Phone type');prop('Font size',24);shot('24-mobile-typography.png');button('Close Inspector panel');mobile_layers();layer('Phone card');button('Close Layers panel');mobile_inspect();assert state()['selection'][0]==next(i['id'] for i in state()['items'] if i['name']=='Phone card');button('Undo');button('Redo');button('Close Inspector panel')
    button('Artboard preview');shot('25-mobile-preview.png');button('Close dialog');button('Open export dialog');run('download','#downloadPNG',str(ROOT/'downloads'/'mobile-transparent.png'));button('Close dialog');record('mobile-state',state());assert state()['counts']['items']==2
    run('set','viewport',1280,800,2);button('Fit artboard');before=state();b=before['bounds'];p=screen(b['x']+b['w']/2,b['y']+b['h']/2);gesture(p,[p[0]+18,p[1]+12]);after=state();assert after['history']['undo']==before['history']['undo']+1;assert ev('devicePixelRatio')==2;shot('26-high-dpi.png');run('set','viewport',1280,800,1);button('Fit');print('PASS 390×844 creation/handles/inspector/pan/zoom/text/Layers/preview/export, exact rendered bounds, and 2× device pixel ratio editing')
def check_boundaries_reset():
    button('New');button('Document');before=state();prop('Artboard width',2049);assert state()['document']==before['document'] and '2048' in state()['status'];prop('Artboard width',64);prop('Artboard height',2048);before=state();prop('Artboard height',63);assert state()['document']==before['document'];prop('Artboard height',2048.5);assert state()['document']==before['document'];prop('Artboard width',2048)
    button('Open export dialog');select('PNG resolution','2');run('download','#downloadPNG',str(ROOT/'downloads'/'maximum-4096.png'));button('Close dialog');assert state()['document']==before['document'] or state()['document']['artboard']['width']==2048
    button('Reset');initial=state()['document'];layer('Headline');run('fill','[aria-label="Text content"]','Uncommitted changes before Reset');button('Reset');s=state();assert s['document']==initial and s['selection']==[] and s['history']=={'undo':0,'redo':0} and not any(s['pending'].values()) and s['tool']=='select'
    source=ROOT/'downloads'/'roundtrip.json';run('upload','#projectFile',str(source));run('wait','--fn','studioDiagnostics.status.startsWith("Imported")');button('Cubic path tool');a=screen(550,450);gesture(a,a,steps=1);assert state()['pendingPath']==1;button('Reset');s=state();assert s['document']==initial and s['pendingPath']==0 and s['selection']==[] and not any(s['pending'].values());run('reload');run('wait','--fn','typeof studioDiagnostics!=="undefined"');s=state();assert s['document']==initial and s['history']=={'undo':0,'redo':0};record('reset-final',s);shot('27-final-desktop.png');print('PASS whole artboard size limits and maximum 4096² export, Reset with pending text/path and imported project, timers cleared, reload fresh start')
def check_empty_history_draft():
    button('New');button('Cubic path tool');a=screen(100,100);gesture(a,a,steps=1);a=screen(180,170);gesture(a,a,steps=1);assert state()['pendingPath']==2;run('press','Control+z');assert state()['pendingPath']==0 and ev('document.querySelector("#pathActions").hidden') and state()['history']=={'undo':0,'redo':0};print('PASS empty-stack undo removes draft and adornments')
def check_clip_and_handles():
    button('New');button('Document');prop('Artboard width',600);prop('Artboard height',400);button('Design');button('Fit');select('Zoom','1');make_rect('Tilted',100,100,80,60);button('Snap to objects');prop('Rotation degrees',45);before=state();p=handle('resize',2);gesture(p,[p[0]+28,p[1]+14]);s=state();assert s['history']['undo']==before['history']['undo']+1 and abs(next(n for n in s['document']['items'] if n['name']=='Tilted')['g']['w']-80)>5
    before=state();b=before['bounds'];p=handle('rotate');end=screen(b['x']+b['w']/2+40,b['y']+b['h']/2);gesture(p,end);s=state();angle=lambda m:__import__('math').atan2(m[1],m[0]);assert abs(angle(s['items'][0]['worldMatrix'])-angle(before['items'][0]['worldMatrix'])-__import__('math').pi/2)<.025
    make_rect('Partner',300,180,80,40);selection(['Tilted','Partner']);button('Group selection');before=state();b=before['bounds'];p=handle('resize',2);center=screen(b['x']+b['w']/2,b['y']+b['h']/2);end=[center[k]+1.25*(p[k]-center[k]) for k in range(2)];gesture(p,end);after=state();ratio=after['bounds']['w']/b['w'];assert abs(ratio-1.25)<.01 and abs(after['bounds']['h']/b['h']-ratio)<.000001;assert abs(after['bounds']['x']+after['bounds']['w']/2-b['x']-b['w']/2)<1e-6;record('handles-transforms',after)
    button('New');make_rect('Outside',100,100,40,40);prop('Fill color','#00cc44');button('Document');prop('Artboard width',64);prop('Artboard height',512);button('Artboard preview');shot('28-artboard-clipped-preview.png');assert ev('document.querySelector("#modalBody clipPath rect").getAttribute("width")')=='64';button('Close dialog');button('Open export dialog');run('download','#downloadSVG',str(ROOT/'downloads'/'clipped.svg'));run('download','#downloadPNG',str(ROOT/'downloads'/'clipped.png'));button('Close dialog');print('PASS rotated local resize, pointer rotation, uniform group corner scaling, and artboard clipping in preview/export')
def check_native_field_focus():
    button('New');button('Text tool');a=screen(100,100);gesture(a,a,steps=1);run('fill','[aria-label="Text content"]','Native field focus');run('press','Control+Enter');before=state();run('focus','[aria-label="Font family"]');run('press','ArrowDown');run('press','ArrowDown');after=state();font_ok=after['document']['items'][0]['g']['font']=='monospace' and after['document']['items'][0]['m']==before['document']['items'][0]['m'];record('font-focus-state',after)
    before=state();run('scrollintoview','#opacityScrub');run('focus','#opacityScrub');run('press','ArrowLeft');run('press','ArrowLeft');after=state();slider_ok=after['document']['items'][0]['m']==before['document']['items'][0]['m'];record('slider-focus-state',after);assert font_ok and slider_ok,{'font':font_ok,'slider':slider_ok};print('PASS native select/range keyboard editing retains field focus and never nudges scene geometry')
def check_keyboard_during_drag():
    button('New');button('Fit');make_rect('A',100,100,100,70);make_rect('B',280,160,90,60);selection(['A','B']);before=state();gesture(screen(150,135),screen(200,180),up=False);run('press','Control+g');run('mouse','up');after=state();record('keyboard-group-state',after);assert after['document']['items'][0]['type']=='group' and after['counts']['items']==3 and after['selection']==[after['document']['items'][0]['id']],'Grouping during a drag must first cancel the pending gesture, then group the original scene'
    for i in before['items']:
        j=next(j for j in after['items'] if j['id']==i['id']);assert i['bounds']==j['bounds']
    print('PASS editing keyboard shortcut cancels active drag before applying hierarchy edit')
