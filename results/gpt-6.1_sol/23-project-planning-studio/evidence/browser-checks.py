from pathlib import Path
import subprocess, json, shlex, time, sys
ROOT=Path(__file__).resolve().parent.parent
SESSION='planner'
LOG=ROOT/'evidence/logs/browser-commands.log'
RESULTS=ROOT/'evidence/logs/browser-results.json'
reports=json.loads(RESULTS.read_text()) if RESULTS.exists() else {}
def run(*args, json_output=False, allow_error=False):
    cmd=['agent-browser','--session',SESSION]+(['--json'] if json_output else [])+list(map(str,args))
    started=time.time(); p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=45)
    with LOG.open('a') as f:f.write('\n$ '+shlex.join(cmd)+'\n'+p.stdout+p.stderr+'[exit '+str(p.returncode)+', '+str(round(time.time()-started,2))+'s]\n')
    if p.returncode and not allow_error:raise RuntimeError(p.stdout+p.stderr)
    if json_output:
        value=json.loads(p.stdout)
        if not value.get('success') and not allow_error:raise RuntimeError(value)
        return value.get('data',{}).get('result',value.get('data'))
    return p.stdout

def ev(code):return run('eval',code,json_output=True)
def state():return ev('PlanningStudio.snapshot()')
def button(name):run('find','role','button','click','--name',name,'--exact')
def label(name,value):run('find','label',name,'fill',value)
def snap(name):
    (ROOT/'evidence/logs'/f'{name}.txt').write_text(run('snapshot','-i'))
def shot(name):run('screenshot',str(ROOT/'evidence/screenshots'/f'{name}.png'))
def reset():button('Reset')
def interval_expect(expected,cpm=None):
    s=state();actual={i:[a['start'],a['finish']] for i,a in s['schedule'].items()}
    assert all(actual.get(k)==v for k,v in expected.items()),(actual,expected)
    if cpm is not None:assert s['cpm']['completion']==cpm,s
    return s
SEED={'T1':[0,2],'T2':[2,5],'T3':[5,7],'T4':[7,8],'T5':[8,8]}
def unchanged(before):
    after=state()
    for key in ['model','schedule','cpm','undoCount','redoCount']:assert after[key]==before[key],(key,after,before)
def check(name,fn):
    try:
        fn();reports[name]={'status':'pass'};print(name+' PASS',flush=True)
    except Exception as e:
        reports[name]={'status':'fail','error':str(e)};print(name+' FAIL '+str(e),flush=True)
        try:shot(name+'-failure');snap(name+'-failure')
        except Exception:pass
        RESULTS.write_text(json.dumps(reports,indent=2));raise
    RESULTS.write_text(json.dumps(reports,indent=2))

def plan01():
    reset();s=interval_expect(SEED,6);assert s['completion']==8
    button('Tasks');snap('plan01-tasks');button('Open details for T3');assert state()['selected']=='T3'
    assert ev("document.querySelector('[data-task-row=T3]').classList.contains('selected')")
    button('Gantt');run('click','#timeline .gantt-bar[data-task=T3]');assert state()['selected']=='T3'
    assert ev("document.querySelector('#timeline .gantt-bar[data-task=T3]').classList.contains('selected')")
    button('Resources');run('find','first','#resource-grid [data-task=T3]','click');assert state()['selected']=='T3'
    assert ev("Array.from(document.querySelectorAll('.resource-day .occupancy-count')).every(e=>Number(e.textContent.split('/')[0])<=Number(e.textContent.split('/')[1]))")
    shot('plan01-resources');snap('plan01-resources')
    button('Gantt');button('Select T2 Build');body=run('get','text','#inspector-body');assert '2026-09-11' in body and 'Sep 14' in body
    button('Files');run('download','[data-action=export-csv]',str(ROOT/'evidence/downloads/seed.csv'));button('Done')
    shot('plan01-gantt');snap('plan01-gantt')

def plan02():
    reset();s=state();assert {i:a['float'] for i,a in s['cpm']['tasks'].items()}=={'T1':0,'T2':0,'T3':1,'T4':0,'T5':0}
    run('check','#critical-toggle');shot('plan02-critical')
    assert ev("document.querySelector('#timeline .gantt-bar[data-task=T1] rect').getAttribute('fill') === '#cbbade'")
    button('Resources');label('Capacity for R1','2');run('press','Tab')
    s=interval_expect({'T1':[0,2],'T2':[2,5],'T3':[2,4],'T4':[5,6],'T5':[6,6]},6);assert s['completion']==6;shot('plan02-capacity-two')
    button('Undo');s=interval_expect(SEED,6);assert s['model']['resources'][0]['capacity']==1

def plan03():
    reset();button('Tasks');label('Duration for T1','3');run('press','Tab')
    changed={'T1':[0,3],'T2':[3,6],'T3':[6,8],'T4':[8,9],'T5':[9,9]};interval_expect(changed,7);shot('plan03-duration')
    button('Undo');s=interval_expect(SEED,6);assert s['model']['tasks'][0]['duration']==2
    button('Redo');s=interval_expect(changed,7);assert s['model']['tasks'][0]['duration']==3

def barbox(id):
    run('scroll','up','2000');run('scrollintoview',f'#timeline .gantt-bar[data-task={id}]')
    return ev(f"(()=>{{let r=document.querySelector('#timeline .gantt-bar[data-task={id}]').getBoundingClientRect();return {{x:r.x,y:r.y,width:r.width,height:r.height}};}})()")
def begin_drag(id,delta):
    b=barbox(id);dw=ev("Number(document.querySelector('#timeline .gantt-bar[data-task=T1] rect').getAttribute('width'))+4")/state()['model']['tasks'][0]['duration']
    x=b['x']+b['width']/2;y=b['y']+b['height']/2
    run('mouse','move',round(x),round(y));run('mouse','down');run('mouse','move',round(x+delta*dw),round(y))

def plan04():
    reset();button('Gantt');begin_drag('T2',3)
    preview=state();assert preview['preview']['active'] and preview['preview']['valid'];assert preview['preview']['requested']==5
    assert preview['preview']['schedule']['T3']['start']==2
    shot('plan04-drag-preview');run('mouse','up')
    expected={'T1':[0,2],'T2':[5,8],'T3':[2,4],'T4':[8,9],'T5':[9,9]};s=interval_expect(expected,6);assert s['undoCount']==1 and s['model']['tasks'][1]['notBefore']=='2026-09-14'
    snap('plan04-constraint');button('Undo');interval_expect(SEED,6)
    button('Select T2 Build');label('Not before date','2026-09-12');run('press','Tab');button('Apply changes');interval_expect(expected,6)
    assert 'normalized forward to Monday 2026-09-14' in run('get','text','#status');shot('plan04-weekend-normalized')
    button('Undo');interval_expect(SEED,6);before=state();begin_drag('T2',2);run('press','Escape');run('mouse','up');unchanged(before);assert state()['preview'] is None

if __name__=='__main__':
    group=sys.argv[1] if len(sys.argv)>1 else 'first'
    if group=='first':
        for name,fn in [('PLAN-01',plan01),('PLAN-02',plan02),('PLAN-03',plan03),('PLAN-04',plan04)]:check(name,fn)

def rejected_edit(label_name,value,message_fragment):
    before=state();label(label_name,value);button('Apply changes');unchanged(before)
    assert message_fragment.lower() in run('get','text','#status').lower()

def plan05():
    reset();button('Gantt');button('Select T1 Design')
    rejected_edit('Predecessor IDs','T5','cycle')
    rejected_edit('Predecessor IDs','Missing','missing predecessor')
    rejected_edit('Selected task duration','1000000000','260')
    rejected_edit('Selected task priority','10000','9999')
    button('Resources');before=state();label('Capacity for R1','0');run('press','Tab');unchanged(before);assert '1 through 4' in run('get','text','#status')
    button('Gantt');button('Select T2 Build')
    rejected_edit('Not before date','2026-02-30','impossible calendar date')
    rejected_edit('Not before date','2037-01-01','2600')
    before=state();bad=json.loads(json.dumps(before['model']));bad['tasks'].append(dict(bad['tasks'][0]));button('Files');label('Plan JSON',json.dumps(bad));button('Import JSON');unchanged(before);assert 'Duplicate task ID: T1' in run('get','text','#dialog-error');shot('plan05-duplicate-rejected');button('Done')
    button('Select T1 Design');before=state();button('Delete T1');button('Cancel');unchanged(before)
    button('Delete T1');button('Delete & remove edges');s=state();assert not any(t['id']=='T1' or 'T1' in t['predecessors'] for t in s['model']['tasks']);shot('plan05-deleted-edges')
    button('Undo');unchanged_model=state();assert unchanged_model['model']==before['model'];interval_expect(SEED,6)
    button('Manage');before=state();button('Delete resource R1');unchanged(before);assert 'assigned to T1, T2, T3' in run('get','text','#dialog-error');button('Cancel')
    button('New task');label('New task ID','U');label('New task name','Unassigned root');label('New task priority','0');button('Create task');s=interval_expect({**SEED,'U':[0,1]},6);assert s['model']['tasks'][-1]['resourceId'] is None
    button('New task');button('Milestone');label('New task ID','M');label('New task name','Root complete');label('New task priority','0');label('New task predecessors','U');button('Create milestone');s=interval_expect({**SEED,'U':[0,1],'M':[1,1]},6);assert s['model']['tasks'][-1]['duration']==0 and s['model']['tasks'][-1]['resourceId'] is None
    shot('plan05-created-root-milestone');snap('plan05-created-root-milestone')

def import_text(m):
    button('Files');label('Plan JSON',json.dumps(m));button('Import JSON')

def plan06():
    reset();button('Tasks');label('Priority for T3','2');run('press','Tab');interval_expect(SEED,6)
    button('Files');run('download','[data-action=export-json]',str(ROOT/'evidence/downloads/tie-plan.json'));button('Done')
    saved=json.loads((ROOT/'evidence/downloads/tie-plan.json').read_text());reverse=json.loads(json.dumps(saved));reverse['tasks'].reverse();file=ROOT/'evidence/downloads/reversed-task-order.json';file.write_text(json.dumps(reverse,indent=2))
    button('Files');run('upload','#import-file',str(file));run('wait','--fn','!document.querySelector("#dialog").open');s=interval_expect(SEED,6);assert [t['id'] for t in s['model']['tasks']]==['T5','T4','T3','T2','T1'];shot('plan06-reversed-order')
    label('Duration for T1','4');run('press','Tab');edited=state();assert edited['schedule']['T2']['start']==4
    button('Files');run('upload','#import-file',str(ROOT/'evidence/downloads/tie-plan.json'));run('wait','--fn','!document.querySelector("#dialog").open');s=interval_expect(SEED,6);assert s['undoCount']==edited['undoCount']+1
    button('Undo');s=state();assert s['model']==edited['model'] and s['schedule']==edited['schedule'];button('Redo');interval_expect(SEED,6)
    inert=json.loads(json.dumps(saved));inert['tasks'][2]['name']='Docs, "ready"\n<script>window.__bad=1</script>';inert['project']['name']='<img src=x onerror="window.__bad=2">';inert['schedule']={'T2':{'start':999,'finish':999}}
    import_text(inert);interval_expect(SEED,6);assert ev('typeof window.__bad')=='undefined';assert ev("document.querySelectorAll('#project-name img, #inspector-body script, #task-table-body script').length")==0
    button('Open details for T3');shot('plan06-inert-import')
    button('Files');run('download','[data-action=export-csv]',str(ROOT/'evidence/downloads/inert-plan.csv'));run('download','[data-action=export-svg]',str(ROOT/'evidence/downloads/current-gantt.svg'));button('Done')
    import csv,xml.etree.ElementTree as ET
    rows=list(csv.DictReader((ROOT/'evidence/downloads/inert-plan.csv').open(newline='')));t3=next(x for x in rows if x['task_id']=='T3');assert t3['task_name']==inert['tasks'][2]['name'] and t3['dependency_only_total_float']=='1';t2=next(x for x in rows if x['task_id']=='T2');assert t2['exclusive_finish_date']=='2026-09-14' and t2['last_working_date']=='2026-09-11'
    svg=ET.parse(ROOT/'evidence/downloads/current-gantt.svg').getroot();texts=' '.join(svg.itertext());assert 'T1 · Design' in texts and '2026-09-17' in texts and 'Dependency-only completion 6' in texts and 'Legend' not in texts;assert not any(x.tag.endswith('script') for x in svg.iter())
    reset();button('Resources');label('Capacity for R1','2');run('press','Tab');button('Tasks');label('Duration for T3','4');run('press','Tab');s=interval_expect({'T1':[0,2],'T2':[2,5],'T3':[2,6],'T4':[6,7],'T5':[7,7]},7);assert s['completion']==7;shot('plan06-additional-general-case')

if __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]=='second':
    for name,fn in [('PLAN-05',plan05),('PLAN-06',plan06)]:check(name,fn)

def mobile_view(v):run('click',f'.mobile-nav [data-view={v}]')
def plan07_mobile():
    run('set','viewport',390,844);reset();mobile_view('gantt');run('uncheck','#critical-toggle');shot('plan07-mobile-gantt')
    assert ev('document.documentElement.scrollWidth <= innerWidth')
    run('scroll','down',240);button('Select T2 Build');assert state()['view']=='details';shot('plan07-mobile-details')
    label('Selected task name','Build ');run('keyboard','type','v2');assert run('get','value','#edit-name').strip()=='Build v2';button('Apply changes');assert state()['model']['tasks'][1]['name']=='Build v2';interval_expect(SEED,6)
    run('focus','#edit-not-before');run('press','Control+a');run('keyboard','type','2026-09-12');run('press','Enter')
    expected={'T1':[0,2],'T2':[5,8],'T3':[2,4],'T4':[8,9],'T5':[9,9]};s=interval_expect(expected,6);assert s['model']['tasks'][1]['notBefore']=='2026-09-14';shot('plan07-mobile-date-edit')
    button('Undo');s=interval_expect(SEED,6);assert s['model']['tasks'][1]['name']=='Build v2';button('Undo');s=interval_expect(SEED,6);assert s['model']['tasks'][1]['name']=='Build'
    mobile_view('gantt');button('Fit timeline');begin_drag('T2',3);shot('plan07-mobile-drag-preview');run('mouse','up');interval_expect(expected,6);button('Undo');interval_expect(SEED,6)
    before=state();button('Zoom in');button('Pan later');button('Pan earlier');button('Zoom out');unchanged(before)
    mobile_view('tasks');shot('plan07-mobile-tasks');run('scrollintoview','[aria-label="Open details for T3"]');button('Open details for T3');assert state()['selected']=='T3' and state()['view']=='details'
    mobile_view('resources');shot('plan07-mobile-resources');run('find','first','#resource-grid [data-task=T3]','click');assert state()['view']=='details';s=state()
    run('set','viewport',1280,800);assert state()['selected']=='T3';unchanged(s);shot('plan07-resize-to-desktop')
    run('set','viewport',390,844);unchanged(s);mobile_view('gantt')
    button('Files');shot('plan07-mobile-files');run('download','[data-action=export-json]',str(ROOT/'evidence/downloads/mobile-plan.json'));run('download','[data-action=export-csv]',str(ROOT/'evidence/downloads/mobile-plan.csv'));run('download','[data-action=export-svg]',str(ROOT/'evidence/downloads/mobile-gantt.svg'));button('Done');assert not ev('document.querySelector("#dialog").open')
    mobile_view('details');label('Selected task duration','4');button('Apply changes');assert state()['model']['tasks'][2]['duration']==4
    button('Files');run('upload','#import-file',str(ROOT/'evidence/downloads/mobile-plan.json'));run('wait','--fn','!document.querySelector("#dialog").open');interval_expect(SEED,6)
    run('reload');s=interval_expect(SEED,6);assert s['undoCount']==0 and s['redoCount']==0 and s['selected']=='T3'
    mobile_view('details');label('Selected task duration','3');button('Apply changes');button('Undo');assert state()['redoCount']==1;reset();s=interval_expect(SEED,6);assert s['undoCount']==s['redoCount']==0
    assert not run('errors').strip();(ROOT/'evidence/logs/mobile-console.txt').write_text(run('console'));(ROOT/'evidence/logs/direct-file-requests.txt').write_text(run('network','requests'))
    run('set','viewport',1280,800)

if __name__=='__main__' and len(sys.argv)>1 and sys.argv[1]=='mobile':check('PLAN-07-MOBILE-DIRECT-FILE',plan07_mobile)
