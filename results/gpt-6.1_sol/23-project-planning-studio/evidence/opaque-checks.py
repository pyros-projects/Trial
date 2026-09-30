import runpy,re,json,subprocess,shlex,time
from pathlib import Path
h=runpy.run_path('evidence/browser-checks.py');g=h['run'].__globals__;g['SESSION']='planner-opaque'
run=h['run'];ROOT=h['ROOT'];LOG=h['LOG'];shot=h['shot'];check=h['check'];snap=h['snap']
cdp=run('get','cdp-url',json_output=True)['cdpUrl']
def obs(code):
    cmd=['node','evidence/iframe-observe.mjs',cdp,code];p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=15)
    with LOG.open('a') as f:f.write('\n$ '+shlex.join(cmd)+'\n'+p.stdout+p.stderr+'\n[exit '+str(p.returncode)+']\n')
    if p.returncode:raise RuntimeError(p.stderr)
    return json.loads(p.stdout)
def download(name,path):
    events=ROOT/'evidence/logs/opaque-download-events.jsonl';before=len(events.read_text().splitlines()) if events.exists() else 0
    action={'.json':'export-json','.csv':'export-csv','.svg':'export-svg'}[Path(path).suffix]
    b=obs("(()=>{let r=document.querySelector('[data-action="+action+"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
    run('mouse','move',round(b['x']),round(b['y']));run('mouse','down');run('mouse','up')
    for _ in range(50):
        lines=events.read_text().splitlines()[before:] if events.exists() else []
        completed=[json.loads(line)['params'] for line in lines if json.loads(line).get('method')=='Browser.downloadProgress' and json.loads(line)['params'].get('state')=='completed']
        if completed:
            event=completed[-1];actual=Path(event['filePath']);assert event['receivedBytes']==event['totalBytes'] and event['totalBytes']>0
            actual.replace(path)
            with LOG.open('a') as f:f.write('Observed completed browser download '+str(path)+' ('+str(Path(path).stat().st_size)+' bytes), guid '+event['guid']+'\n')
            return
        time.sleep(.1)
    raise RuntimeError('Browser download did not finish: '+str(path))
def ref(name,role=None):
    tree=run('snapshot','-i')
    pattern=r'^\s*- '+(re.escape(role) if role else r'(?:button|textbox|spinbutton|combobox|checkbox)')+' "'+re.escape(name)+r'"[^\n]*\[ref=(e\d+)\]'
    m=re.search(pattern,tree,re.M)
    if not m:raise RuntimeError('No current accessible ref for '+name+'\n'+tree)
    return '@'+m.group(1)
def button(name):run('click',ref(name,'button'))
def label(name,value):run('fill',ref(name),value)
def state():return obs('PlanningStudio.snapshot()')
def intervals(expected,cpm=6):
    s=state();assert all([s['schedule'][i]['start'],s['schedule'][i]['finish']]==v for i,v in expected.items()),s;assert s['cpm']['completion']==cpm;return s
SEED=h['SEED'];DATE={'T1':[0,2],'T2':[5,8],'T3':[2,4],'T4':[8,9],'T5':[9,9]};DURATION={'T1':[0,3],'T2':[3,6],'T3':[6,8],'T4':[8,9],'T5':[9,9]}
def protect():
    obs((ROOT/'evidence/deny-storage.js').read_text())
    assert obs('window.__forbiddenAttempts')==[]
def origin():
    s=obs("({origin:window.origin,parentDenied:(()=>{try{return !!parent.document}catch(e){return e.name}})()})");assert s=={'origin':'null','parentDenied':'SecurityError'},s

def drag_t2():
    b=obs("(()=>{let r=document.querySelector('#timeline .gantt-bar[data-task=T2]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
    dw=obs("(Number(document.querySelector('#timeline .gantt-bar[data-task=T1] rect').getAttribute('width'))+4)/2")
    run('mouse','move',round(b['x']),round(b['y']));run('mouse','down');run('mouse','move',round(b['x']+3*dw),round(b['y']))
    assert state()['preview']['requested']==5;shot('plan07-opaque-drag-preview');run('mouse','up');intervals(DATE)

def opaque():
    run('frame','main');run('network','requests','--clear');run('reload');run('snapshot','-i');run('set','viewport',1280,800);protect();origin();button('Reset');intervals(SEED);snap('plan07-opaque-seed');shot('plan07-opaque-desktop')
    drag_t2();button('Undo');intervals(SEED)
    button('Select T2 Build');run('focus',ref('Not before date'));run('keyboard','type','2026-09-12');run('press','Enter');intervals(DATE);assert state()['model']['tasks'][1]['notBefore']=='2026-09-14';button('Undo');intervals(SEED)
    button('Select T1 Design');label('Selected task duration','3');button('Apply changes');intervals(DURATION,7)
    button('Files')
    for name,path in [('Download JSON','opaque-plan.json'),('Download CSV','opaque-plan.csv'),('Download Gantt SVG','opaque-gantt.svg')]:download(name,ROOT/'evidence/downloads'/path)
    button('Done');button('Reset');intervals(SEED);assert state()['undoCount']==0
    button('Files');run('upload',ref('Import JSON file'),str(ROOT/'evidence/downloads/opaque-plan.json'));intervals(DURATION,7);assert not obs('document.querySelector("#dialog").open');button('Undo');intervals(SEED)
    button('Files');label('Plan JSON',(ROOT/'evidence/downloads/opaque-plan.json').read_text());button('Import JSON');intervals(DURATION,7);button('Undo');intervals(SEED)
    button('Resources');label('Capacity for R1','2');run('press','Tab');intervals({'T1':[0,2],'T2':[2,5],'T3':[2,4],'T4':[5,6],'T5':[6,6]});button('Undo');intervals(SEED)
    button('Tasks');button('Open details for T3');assert state()['selected']=='T3';button('Gantt');shot('plan07-opaque-after-edits')
    run('set','viewport',390,844);button('Details');label('Selected task priority','2');button('Apply changes');intervals(SEED)
    button('Files');download('Download JSON',ROOT/'evidence/downloads/opaque-mobile.json');button('Done');button('Undo');intervals(SEED);button('Resources');shot('plan07-opaque-mobile-resources');button('Details');shot('plan07-opaque-mobile-details')
    assert obs('window.__forbiddenAttempts')==[];assert not run('errors').strip()
    (ROOT/'evidence/logs/opaque-console-before-probe.txt').write_text(run('console'));requests=run('network','requests');(ROOT/'evidence/logs/opaque-requests-before-probe.txt').write_text(requests);assert 'example.invalid' not in requests
    probe=obs("fetch('https://example.invalid/planner-offline-probe',{cache:'no-store'}).then(()=>false).catch(()=>true)");assert probe;assert 'example.invalid:443 -> 403 blocked' in (ROOT/'evidence/logs/blocked-external.log').read_text()
    run('frame','main');run('reload');run('snapshot','-i');intervals(SEED);s=state();assert s['undoCount']==s['redoCount']==0
    origin();protect();run('set','viewport',1280,800);button('Reset');assert state()['undoCount']==0
    (ROOT/'evidence/logs/opaque-errors.txt').write_text(run('errors'));(ROOT/'evidence/logs/opaque-requests-after-probe.txt').write_text(run('network','requests'));snap('plan07-opaque-final');shot('plan07-opaque-final')
check('PLAN-07-OPAQUE-IFRAME',opaque)
