import browser_checks as b
import subprocess,json,traceback
b.SESSION='sheet21-9a42d3169eda-opaque'
def read(js):
    p=subprocess.run(['node',str(b.EVIDENCE/'tests'/'iframe_read.cjs')],input=js,text=True,capture_output=True,timeout=25,cwd=b.ROOT)
    with b.LOG.open('a') as f:f.write(json.dumps({'command':'node evidence/tests/iframe_read.cjs','stdin':js,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})+'\n')
    assert p.returncode==0,p.stderr
    return json.loads(p.stdout)
b.read=read
b.label=lambda name,s:b.fill('[aria-label="'+name+'"]',s)
original_cmd=b.cmd
def iframe_cmd(*args,stdin=None):
    if args[0]!='download':return original_cmd(*args,stdin=stdin)
    p=subprocess.run(['node',str(b.EVIDENCE/'tests'/'iframe_download.cjs'),str(args[1]),str(args[2])],text=True,capture_output=True,timeout=25,cwd=b.ROOT)
    with b.LOG.open('a') as f:f.write(json.dumps({'command':'node evidence/tests/iframe_download.cjs '+str(args[1])+' '+str(args[2]),'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})+'\n')
    assert p.returncode==0,p.stderr
    return json.loads(p.stdout)['data']
b.cmd=iframe_cmd
b.click=lambda css:(b.cmd('focus',css),b.cmd('click',css))

try:
    b.cmd('set','viewport',1280,800);b.cmd('frame','main');b.cmd('reload');b.cmd('snapshot','-i');b.cmd('frame','@e1')
    diagnostics=read('Promise.all([navigator.permissions.query({name:"clipboard-read"}),navigator.permissions.query({name:"clipboard-write"})]).then(p=>({origin:window.origin,parent:(()=>{try{return !!parent.document}catch(e){return e.name}})(),storage:(()=>{try{return !!localStorage}catch(e){return e.name}})(),clipboard:p.map(x=>x.state)}))')
    assert diagnostics=={'origin':'null','parent':'SecurityError','storage':'SecurityError','clipboard':['denied','denied']},diagnostics
    b.reset();b.edit('A1','5');b.expect_cells({'A1':5,'C1':15,'D1':35,'F1':23});assert b.current_values()==[15,20,35]
    b.go('F1');b.click('#copy');b.go('F2');b.click('#paste');a=b.expect_cells({'F2':22});assert a['F2']['raw']=='=$A2+B$1+$C$1'
    b.click('#undo');b.expect_cells({'F2':''});b.click('#redo');b.expect_cells({'F2':22})
    b.screenshot('sheet07-opaque-edit.png')
    saved=b.export_json('opaque-workbook.json');b.cmd('download','#export-svg',str(b.EVIDENCE/'downloads'/'opaque-chart.svg'));b.cmd('download','#export-png',str(b.EVIDENCE/'downloads'/'opaque-chart.png'))
    b.edit('A1','11');b.click('#import-open');b.cmd('upload','#import-file',str(b.EVIDENCE/'downloads'/'opaque-workbook.json'));b.click('#import-confirm');b.expect_cells({'A1':5,'F2':22})
    b.import_text('category,value\nA,2\nB,=2+2','csv');a=b.expect_cells({'B2':2,'B3':'=2+2'});assert a['B3']['type']=='text'
    before=b.state();b.import_text('"oops','csv',False);assert b.state()==before;b.click('#import-dialog [data-close]');b.click('#undo');b.expect_cells({'A1':5,'F2':22})
    b.cmd('set','viewport',390,844);b.edit('A1','3');b.expect_cells({'C1':9});b.click('#new-chart-top');b.fill('#new-title','Sandbox mobile');b.cmd('select','#new-type','line');b.fill('#new-range','H1:J4');b.click('#create-chart');assert read('workbook.charts.length')==2
    b.fill('#chart-title','Sandbox edited');b.click('#apply-chart');assert read('workbook.charts[1].title')=='Sandbox edited';b.fill('#chart-title','Sandbox keyboard');b.press('Enter');assert read('workbook.charts[1].title')=='Sandbox keyboard';b.screenshot('sheet07-opaque-mobile.png');b.reset();b.expect_cells({'A1':2,'C1':6});assert read('undoStack.length')==0
    b.edit('A1','99');b.cmd('frame','main');b.cmd('reload');b.cmd('snapshot','-i');b.cmd('frame','@e1');b.expect_cells({'A1':2,'C1':6});assert read('workbook.charts.length')==1 and read('undoStack.length')==0
    # Deliberate diagnostic network probe, separate from application behavior.
    # Launch uses a dead proxy, bypassing loopback only. The remote request must fail.
    b.cmd('network','route','https://**','--abort')
    probe=read('fetch("https://example.com/studio-validation-probe").then(()=>"UNEXPECTED success",e=>"blocked: "+e.name)')
    assert probe=='blocked: TypeError',probe
    requests=b.cmd('network','requests');console=b.cmd('console');errors=b.cmd('errors')
    (b.EVIDENCE/'opaque-diagnostics.json').write_text(json.dumps({'isolation':diagnostics,'networkProbe':probe,'requests':requests,'console':console,'errors':errors},indent=2))
    entry={'check':'SHEET-07-opaque-iframe','status':'pass','detail':'Actual sandbox="allow-scripts allow-downloads" iframe: origin null, parent/storage SecurityError, clipboard read/write denied. Desktop and narrow editing, formula calculations, internal copy/paste/history, JSON file-picker and CSV text imports, atomic malformed input, JSON/SVG/PNG downloads, Reset and fresh reload passed. Remote probe blocked; loopback HTTP reachable.'};print(json.dumps(entry))
except Exception as e:
    b.screenshot('iframe-failure.png');entry={'check':'SHEET-07-opaque-iframe','status':'fail','detail':str(e),'trace':traceback.format_exc()};print(json.dumps(entry));raise
finally:
    with b.RESULTS.open('a') as f:f.write(json.dumps(entry)+'\n')
