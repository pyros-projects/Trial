import runpy,json
h=runpy.run_path('evidence/browser-checks.py');globals().update({k:v for k,v in h.items() if not k.startswith('__')})
def calendar_edge():
    if ev('document.querySelector("#dialog").open'):button('Done')
    reset();before=state();m=json.loads(json.dumps(before['model']));m['project']['startDate']='2099-12-31';m['tasks']=[]
    import_text(m)
    assert not ev('document.querySelector("#dialog").open'),'Valid empty plan at last calendar date must import successfully'
    s=state();assert s['model']==m and s['completion']==0 and s['undoCount']==1
    button('Resources');shot('calendar-end-empty');assert 'Dec 31' in run('get','text','#resource-range')
    button('New task');button('Milestone');label('New task ID','LAST');label('New task name','Last-date milestone');label('New task priority','0');button('Create milestone')
    s=state();assert s['schedule']['LAST']['start']==0;button('Gantt');shot('calendar-end-milestone');assert ev('document.querySelectorAll(".gantt-bar").length')==1
    button('Files');run('download','[data-action=export-svg]',str(ROOT/'evidence/downloads/last-date.svg'));button('Done')
    assert not run('errors').strip()
    button('Undo');assert len(state()['model']['tasks'])==0;button('Undo');interval_expect(SEED,6)
check('CALENDAR-EDGE',calendar_edge)
