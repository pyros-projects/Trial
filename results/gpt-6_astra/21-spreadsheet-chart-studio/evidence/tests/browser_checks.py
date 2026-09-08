import subprocess,json,os,sys,shlex,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT/'evidence'
SESSION=os.environ.get('STUDIO_SESSION','sheet21-9a42d3169eda')
LOG=EVIDENCE/'browser-commands.jsonl'
RESULTS=EVIDENCE/'browser-results.jsonl'
def cmd(*args,stdin=None):
    launch=['--proxy','http://127.0.0.1:9','--proxy-bypass','127.0.0.1,localhost'] if SESSION.endswith('-opaque') else ['--allow-file-access']
    command=['agent-browser','--session',SESSION,*launch,'--download-path',str(EVIDENCE/'downloads'),'--json',*map(str,args)]
    p=subprocess.run(command,input=stdin,text=True,capture_output=True,cwd=ROOT,timeout=40)
    entry={'command':shlex.join(command),'stdin':stdin,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
    with LOG.open('a') as f:f.write(json.dumps(entry)+'\n')
    try:result=json.loads(p.stdout)
    except Exception:raise AssertionError('Non-JSON browser result: '+p.stdout+p.stderr)
    assert p.returncode==0 and result.get('success'),entry
    return result.get('data',{})
def read(js):return cmd('eval','--stdin',stdin=js).get('result')
def click(css):cmd('click',css)
def fill(css,s):cmd('fill',css,s)
def label(name,s):cmd('find','label',name,'fill',s)
def press(key):cmd('press',key)
def go(a):label('Cell or range',a);press('Enter')
def edit(a,raw):go(a);label('Formula bar',raw);click('#formula-apply')
def reset():click('#reset')
def cells(*aa):return read('Object.fromEntries('+json.dumps(aa)+'.map(a=>[a,{...document.getElementById("cell-"+a).dataset}]))')
def expect_cells(mapping):
    actual=cells(*mapping)
    for a,w in mapping.items():assert actual[a]['value']==str(w),f'{a}: expected {w!r}, observed {actual[a]}'
    return actual
def points():return read('[...document.querySelectorAll("#chart-host [data-source]")].map(e=>({...e.dataset}))')
def current_values():return [float(p['value']) for p in points() if p['series']=='Current']
def state():return read('({workbook,undo:undoStack.length,redo:redoStack.length})')
def screenshot(name):cmd('screenshot',str(EVIDENCE/'screenshots'/name))
def export_json(name):
    click('#export-open');cmd('select','#export-format','json');raw=read('document.getElementById("export-text").value')
    cmd('download','#export-download',str(EVIDENCE/'downloads'/name));click('#export-dialog [data-close]');return raw

def import_text(raw,fmt='json',close=True):
    click('#import-open');cmd('select','#import-format',fmt);fill('#import-text',raw);click('#import-confirm')
    if close and read('document.getElementById("import-dialog").open'):raise AssertionError(read('document.getElementById("import-error").textContent'))

def sheet01():
    reset();seed=expect_cells({'C1':6,'C2':20,'D1':26,'E1':10,'F1':11})
    assert seed['C1']['raw']=='=A1*B1' and seed['E1']['raw']=='=IF(A1>0,10,1/0)'
    assert current_values()==[6,20,26]
    assert [float(p['value']) for p in points() if p['series']=='Plan']==[8,18,26]
    edit('A1','5');expect_cells({'C1':15,'D1':35,'F1':23});assert current_values()==[15,20,35]
    screenshot('sheet01-live.png');click('#undo');expect_cells({'A1':2,'C1':6,'D1':26,'F1':11});assert current_values()==[6,20,26]
    cmd('hover','#chart-host [data-source="I3"]');assert read('document.getElementById("point-detail").textContent')=='Beta · Current · 20 · Source I3'
    click('#chart-host [data-source="I3"]');assert read('document.getElementById("address").value')=='I3';assert read('document.getElementById("formula").value')=='=C2'
    screenshot('sheet01-source-selected.png')
    return 'Seed formulas and both series correct; A1=5 recalculated grid/chart; Undo restored both; inspected Beta/Current/20/I3 and selected I3.'

def sheet02():
    reset();go('F1');click('#copy');go('F2');click('#paste');a=expect_cells({'F2':13});assert a['F2']['raw']=='=$A2+B$1+$C$1'
    go('A1:C2');click('#copy');go('A5');click('#paste');a=expect_cells({'C5':6,'C6':20});assert a['C5']['raw']=='=A5*B5' and a['C6']['raw']=='=A6*B6'
    click('#undo');expect_cells({'A5':'','B5':'','C5':'','A6':'','B6':'','C6':'','F2':13});click('#redo');expect_cells({'C5':6,'C6':20})
    go('Z100');before=state();click('#paste');assert state()==before;assert 'Paste rejected' in read('document.getElementById("toast").textContent');screenshot('sheet02-rejected-paste.png')
    edit('B10','=A10');go('B10');click('#copy');go('A10');click('#paste');a=expect_cells({'A10':'#REF!'});assert a['A10']['raw']=='=#REF!';screenshot('sheet02-ref-operand.png');click('#undo');expect_cells({'A10':''})
    return 'Mixed references and 3×2 rebasing correct; single-step range Undo/Redo; Z100 overflow rejected without state/history mutation; left-edge paste generated =#REF!, Undo restored blank.'

def sheet03():
    reset();edit('A1','=C1');expect_cells({a:'#CYCLE!' for a in ['A1','C1','D1','E1','F1','I2','I4']});assert current_values()==[20];assert 'error #CYCLE!' in read('document.getElementById("omission-summary").textContent');screenshot('sheet03-active-cycle.png')
    edit('A1','2');expect_cells({'A1':2,'C1':6,'D1':26,'E1':10,'F1':11});assert current_values()==[6,20,26]
    edit('G1','=IF(FALSE,G1,7)');expect_cells({'G1':7});edit('G1','=IF(TRUE,G1,7)');expect_cells({'G1':'#CYCLE!'});edit('G1','=IF(FALSE,G1,7)');expect_cells({'G1':7})
    assert read('[...(calculated.deps.G1??[])]')==[]
    return 'Active cycles and dependent chart errors propagate; correction recovers; inactive self-reference stays 7, active self-reference cycles, switching back recovers with no active dependencies.'

def sheet04():
    reset();checks=[('=2+3*4',14),('=(2+3)*4',20),('=SUM(A1:B2)',14),('=MIN(A1:B2)',2),('=MAX(A1:B2)',5),('=TRUE+2',3),('=IF(FALSE,1/0,9)',9),('=#REF!','#REF!'),('=IF(FALSE,#REF!,9)',9),('=1/0','#DIV/0!'),('=AA1','#REF!'),('=NOPE(1)','#NAME?'),('=SUM("text")','#VALUE!'),('=1+','#PARSE!')]
    for i,(formula,want) in enumerate(checks,12):edit('G'+str(i),formula);expect_cells({'G'+str(i):want})
    edit('B1','=1/0');expect_cells({'G14':'#DIV/0!','G15':'#DIV/0!','G16':'#DIV/0!'});edit('B1','3');expect_cells({'G14':14,'G15':2,'G16':5})
    edit('K7','12.5');edit('L7','=-K7*2+7/2');expect_cells({'L7':-21.5});edit('K7','-4');expect_cells({'L7':11.5})
    edit('L8','=IF(FALSE,1+,9)');expect_cells({'L8':'#PARSE!'})
    saved=export_json('parser-roundtrip.json');edit('G19','111');import_text(saved);a=expect_cells({'G19':'#REF!','G20':9});assert a['G19']['raw']=='=#REF!' and a['G20']['raw']=='=IF(FALSE,#REF!,9)'
    go('G19');screenshot('sheet04-errors-and-json-roundtrip.png')
    return 'All supplied parser/error cases passed. Range error propagated and recovered. Predicted -12.5*2+7/2=-21.5, then K7=-4 produced 11.5. Inactive malformed branch still parsed. #REF! formulas survived actual JSON download/UI import.'

def sheet05():
    reset();click('#new-chart-top');fill('#new-title','Progress line');cmd('select','#new-type','line');fill('#new-range','H1:J4');click('#create-chart');assert read('workbook.charts.length')==2
    edit('B2','7');assert current_values()==[6,28,34]
    fill('#chart-title','A clearer plan');label('Hex color for Current','#d48545');click('#apply-chart')
    assert read('document.getElementById("chart-heading").textContent')=='A clearer plan'
    assert read('document.querySelector("#chart-host [data-series-path=Current]").getAttribute("stroke")')=='#d48545'
    cmd('download','#export-svg',str(EVIDENCE/'downloads'/'current-line.svg'));cmd('download','#export-png',str(EVIDENCE/'downloads'/'current-line.png'))
    screenshot('sheet05-line-current.png')
    go('I3');click('#clear');assert current_values()==[6,34];assert '1 omitted point · blank'==read('document.getElementById("omission-summary").textContent')
    path=read('document.querySelector("#chart-host [data-series-path=Current]").getAttribute("d")');assert path.count('M')==2 and 'L' not in path,path
    screenshot('sheet05-line-gap.png');click('#undo');assert current_values()==[6,28,34]
    cmd('select','#chart-type','column');click('#apply-chart');assert read('document.querySelectorAll("#chart-host rect[data-source]").length')==6
    cmd('select','#chart-type','line');click('#apply-chart');assert current_values()==[6,28,34]
    box=read('(()=>{let r=document.getElementById("splitter").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+100};})()');cmd('mouse','move',round(box['x']),round(box['y']));cmd('mouse','down');cmd('mouse','move',round(box['x']-70),round(box['y']));cmd('mouse','up');assert current_values()==[6,28,34];expect_cells({'B2':7})
    click('#delete-chart');assert read('workbook.charts.length')==1;click('#undo');assert read('workbook.charts.length')==2
    return 'Created second/line chart; B2=7 gave [6,28,34]. Changed title/color, downloaded SVG and PNG. I3 clear omitted one blank with disconnected line segments; Undo restored point. Type switches, divider drag and chart delete/undo preserved state.'

def sheet06():
    reset();saved=export_json('seed-workbook.json');edit('A1','9');fill('#chart-title','Changed before import');click('#apply-chart');before=state()['workbook']
    click('#import-open');cmd('upload','#import-file',str(EVIDENCE/'downloads'/'seed-workbook.json'));click('#import-confirm');expect_cells({'A1':2,'C1':6});assert read('workbook.charts[0].title')=='Current vs Plan'
    click('#undo');assert state()['workbook']==before
    for change in ['address','range','version','id']:
        invalid=json.loads(saved)
        if change=='address':invalid['cells']['AA1']={'type':'number','raw':'2'}
        if change=='range':invalid['charts'][0]['range']='H1:AA4'
        if change=='version':invalid['version']=2
        if change=='id':invalid['charts'].append(dict(invalid['charts'][0]))
        before=state();import_text(json.dumps(invalid),close=False);assert state()==before;assert read('document.getElementById("import-error").textContent');screenshot('sheet06-invalid-'+change+'.png');click('#import-dialog [data-close]')
    csv='label,value\n"alpha, beta",2\n"line\nbreak",=1+1'
    import_text(csv,'csv');a=expect_cells({'A2':'alpha, beta','B2':2,'A3':'line\nbreak','B3':'=1+1'});assert a['B2']['type']=='number' and a['B3']['type']=='text';assert read('workbook.charts.length')==0
    click('#export-open');cmd('select','#export-format','csv');contents=read('document.getElementById("export-text").value');assert contents=='label,value\n"alpha, beta",2\n"line\nbreak",=1+1',repr(contents)
    cmd('download','#export-download',str(EVIDENCE/'downloads'/'roundtrip.csv'));click('#export-dialog [data-close]');before=state();import_text('"unterminated','csv',False);assert state()==before;assert 'unterminated' in read('document.getElementById("import-error").textContent');screenshot('sheet06-malformed-csv.png');click('#import-dialog [data-close]')
    edit('D1','<img src=x onerror="window.htmlExecuted=true">');assert read('document.getElementById("cell-D1").querySelector("img")===null && window.htmlExecuted===undefined');assert cells('D1')['D1']['value']=='<img src=x onerror="window.htmlExecuted=true">'
    edit('D2',"'=SUM(A1:B2)");assert cells('D2')['D2']['type']=='text';literal=export_json('literal-text-workbook.json');edit('D2','3');import_text(literal);expect_cells({'D2':'=SUM(A1:B2)'})
    screenshot('sheet06-safe-text.png')
    return 'Actual JSON download/file-picker restore and Undo passed. Invalid cell, chart range, version and duplicate IDs left workbook/history unchanged. CSV multiline, comma and numeric/literal types passed; malformed CSV atomic rejection. HTML-looking text inert; apostrophe text survived JSON.'

TESTS={f'SHEET-0{i}':f for i,f in enumerate([sheet01,sheet02,sheet03,sheet04,sheet05,sheet06],1)}
if __name__=='__main__':
    for name in sys.argv[1:] or TESTS:
        try:
            detail=TESTS[name]();entry={'check':name,'status':'pass','detail':detail};print(json.dumps(entry),flush=True)
        except Exception as e:
            screenshot(name.lower()+'-failure.png');entry={'check':name,'status':'fail','detail':str(e),'trace':traceback.format_exc()};print(json.dumps(entry),flush=True)
            with RESULTS.open('a') as f:f.write(json.dumps(entry)+'\n')
            raise
        with RESULTS.open('a') as f:f.write(json.dumps(entry)+'\n')
