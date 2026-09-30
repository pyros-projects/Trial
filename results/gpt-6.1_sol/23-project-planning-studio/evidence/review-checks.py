import runpy,json,xml.etree.ElementTree as ET
h=runpy.run_path('evidence/browser-checks.py');globals().update({k:v for k,v in h.items() if not k.startswith('__')})
def focus_selection():
    run('set','viewport',1280,800);reset();button('Gantt');run('focus','#timeline .gantt-bar[data-task=T1]');run('press','Enter');assert state()['selected']=='T1'
    assert ev('document.activeElement.getAttribute("data-task")')=='T1','Keyboard bar selection must keep focus on the selected bar'
    button('Tasks');run('focus','[aria-label="Open details for T3"]');run('press','Enter');assert state()['selected']=='T3';assert ev('document.activeElement.getAttribute("data-task")')=='T3'
    button('Resources');run('focus','#resource-grid [data-task=T2]');run('press','Enter');assert state()['selected']=='T2';assert ev('document.activeElement.getAttribute("data-task")')=='T2'
    assert state()['undoCount']==0;shot('review-keyboard-focus')
def svg_bounds():
    reset();m=state()['model'];m['project']['startDate']='2099-12-31';m['tasks']=[dict(id='LAST',name='Last milestone',duration=0,priority=0,resourceId=None,predecessors=[],notBefore=None)]
    import_text(m);button('Files');path=ROOT/'evidence/downloads/review-last-date.svg';run('download','[data-action=export-svg]',str(path));button('Done')
    root=ET.parse(path).getroot();width=float(root.attrib['width']);legend=[e for e in root.iter() if e.tag.endswith('text') and 'Milestone'==(e.text or '')];assert len(legend)==1
    assert float(legend[0].attrib['x'])+60<=width,'Complete milestone legend must fit in the exported SVG viewport'
failures=0
for name,fn in [('REVIEW-KEYBOARD-FOCUS',focus_selection),('REVIEW-SVG-BOUNDS',svg_bounds)]:
    try:check(name,fn)
    except Exception:failures+=1
raise SystemExit(failures)
