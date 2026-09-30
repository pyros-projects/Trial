import subprocess, json, base64, shlex, sys, traceback, pathlib, os
ROOT=pathlib.Path(__file__).resolve().parents[2]
SESSION='studio-verified'
LOG=None
BATCH_COUNT=0
SNAPSHOT_COUNT=0

def ab(*args):
    command=['agent-browser','--session',SESSION,*map(str,args)]
    global BATCH_COUNT
    stdin=None; suffix=''
    if any(len(a.encode())>64000 for a in command):
        BATCH_COUNT+=1;stdin=json.dumps([list(map(str,args))]);batch_file=ROOT/'evidence/logs'/('streamed-command-%d.json'%BATCH_COUNT);batch_file.write_text(stdin);command=['agent-browser','--session',SESSION,'batch','--bail'];suffix=' < '+str(batch_file)
    result=subprocess.run(command,cwd=ROOT,text=True,input=stdin,capture_output=True,timeout=40)
    if LOG:
        LOG.write('$ '+shlex.join(command)+suffix+'\n'+result.stdout+result.stderr+'\n');LOG.flush()
    if result.returncode:raise RuntimeError(result.stdout+result.stderr)
    return result.stdout.strip()

def js(expression):
    return json.loads(ab('eval','-b',base64.b64encode(expression.encode()).decode()))

def click(name):return ab('find','role','button','click','--name',name,'--exact')
def fill(label,value):
    if label not in ['Chart title','Source range']:return ab('find','label',label,'fill',value)
    # These two labels exist in both a hidden settings form and the live modal.
    # Use the visible accessibility-tree textbox, avoiding CLI hidden-label lookup.
    global SNAPSHOT_COUNT
    SNAPSHOT_COUNT+=1;command=['agent-browser','--session',SESSION,'snapshot','-i','--json'];r=subprocess.run(command,cwd=ROOT,text=True,capture_output=True,timeout=30);p=ROOT/'evidence/logs'/('workflow-snapshot-%d-%d.json'%(os.getpid(),SNAPSHOT_COUNT));p.write_text(r.stdout)
    if LOG:LOG.write('$ '+shlex.join(command)+' > '+str(p)+'\n');LOG.flush()
    assert r.returncode==0,r.stderr;refs=json.loads(r.stdout)['data']['refs'];matches=[i for i,v in refs.items() if v['role']=='textbox' and v['name']==label];assert len(matches)==1,(label,matches)
    return ab('fill','@'+matches[0],value)
def goto(address):fill('Go to cell or range',address);ab('press','Enter')
def edit(address,raw):goto(address);fill('Formula bar',raw);ab('press','Enter')
def screenshot(name):ab('screenshot',str(ROOT/'evidence/screenshots'/name))
def raw(address):goto(address);return ab('get','value','#formula-input')
def reset():click('Reset')
def cells(expected):
    actual=js('Object.fromEntries('+json.dumps(list(expected))+'.map(a=>[a,document.querySelector("#cell-"+a+" .cell-content").textContent]))')
    assert actual==expected,(actual,expected)
    print('Cells:',actual,flush=True)

def chart(current,plan):
    data=js('Object.fromEntries(Array.from(document.querySelectorAll("#chart-stage [data-address]")).map(n=>[n.dataset.address,Number(n.getAttribute("aria-label").match(/: (.+?) · /)[1])]))')
    actual=[[data.get(a) for a in ['I2','I3','I4']],[data.get(a) for a in ['J2','J3','J4']]]
    assert actual==[current,plan],actual
    print('Chart:',actual,flush=True)

def download_json(name):
    click('Export');p=ROOT/'evidence'/name;ab('download','#export-json',str(p));click('Close export');return p

def import_text(text,fmt='json'):
    click('Import');ab('select','#import-format',fmt)
    if len(text.encode())>64000:
        global BATCH_COUNT
        BATCH_COUNT+=1;p=ROOT/'evidence/logs'/('picker-input-%d.'%BATCH_COUNT+fmt);p.write_text(text);ab('upload','#import-file',str(p));ab('wait','--fn','document.getElementById("import-text").value.length>64000')
    else:fill('File contents',text)
    click('Import workbook')

def no_errors():
    assert ab('errors')=='','Uncaught error';assert ab('console')=='','Console output'


def sheet01():
    reset();cells({'C1':'6','C2':'20','D1':'26','E1':'10','F1':'11'});chart([6,20,26],[8,18,26])
    for a,w in {'C1':'=A1*B1','C2':'=A2*B2','D1':'=SUM(C1:C2)','E1':'=IF(A1>0,10,1/0)','F1':'=$A1+B$1+$C$1'}.items():assert raw(a)==w
    edit('A1','5');cells({'C1':'15','D1':'35','F1':'23'});chart([15,20,35],[8,18,26]);screenshot('sheet01-live-edit.png')
    click('Undo');cells({'A1':'2','C1':'6','D1':'26','F1':'11'});chart([6,20,26],[8,18,26])
    ab('hover','#chart-stage [data-address="I3"]');click('Beta · Current: 20 · I3');assert ab('get','value','#address-input')=='I3';assert ab('get','value','#formula-input')=='=C2';assert ab('get','text','#point-inspector')=='Current\nBeta\n20\nI3 ↗';screenshot('sheet01-source-inspection.png')
    goto('A1:B2');assert ab('get','text','#numeric-count')=='4';assert ab('get','text','#numeric-sum')=='14';no_errors()


def sheet02():
    reset();goto('F1');click('Copy');goto('F2');click('Paste');assert raw('F2')=='=$A2+B$1+$C$1';cells({'F2':'13'})
    goto('A1:C2');click('Copy');goto('A5');click('Paste');assert raw('C5')=='=A5*B5';assert raw('C6')=='=A6*B6';cells({'C5':'6','C6':'20'});screenshot('sheet02-range-paste.png')
    click('Undo');cells({'A5':'','B5':'','C5':'','A6':'','B6':'','C6':'','F2':'13'});click('Redo');cells({'C5':'6','C6':'20','F2':'13'})
    before=js('({cells:Array.from(document.querySelectorAll("#sheet-table td")).map(n=>n.textContent),undo:document.getElementById("undo").title,redo:document.getElementById("redo").disabled})')
    goto('Z100');click('Paste');assert 'beyond Z100' in ab('get','text','#toast');after=js('({cells:Array.from(document.querySelectorAll("#sheet-table td")).map(n=>n.textContent),undo:document.getElementById("undo").title,redo:document.getElementById("redo").disabled})');assert before==after
    screenshot('sheet02-rejected-paste.png');edit('B10','=A10');cells({'B10':'0'});goto('B10');click('Copy');goto('A10');click('Paste');assert raw('A10')=='=#REF!';cells({'A10':'#REF!'});screenshot('sheet02-rebased-ref-error.png');click('Undo');cells({'A10':'','B10':'0'});no_errors()


def sheet03():
    reset();edit('A1','=C1');cells({'A1':'#CYCLE!','C1':'#CYCLE!','D1':'#CYCLE!','E1':'#CYCLE!','F1':'#CYCLE!'});chart([None,20,None],[8,18,26]);assert '#CYCLE!' in ab('get','text','#omission-summary');screenshot('sheet03-active-cycle.png')
    edit('A1','2');cells({'C1':'6','D1':'26','F1':'11'});chart([6,20,26],[8,18,26])
    edit('G1','=IF(FALSE,G1,7)');cells({'G1':'7'});assert ab('get','text','#dependency-list')=='—';edit('G1','=IF(TRUE,G1,7)');cells({'G1':'#CYCLE!'});edit('G1','=IF(FALSE,G1,7)');cells({'G1':'7'});screenshot('sheet03-lazy-recovery.png');no_errors()


def sheet04():
    reset();cases=[('L1','=2+3*4','14'),('L2','=(2+3)*4','20'),('L3','=SUM(A1:B2)','14'),('L4','=MIN(A1:B2)','2'),('L5','=MAX(A1:B2)','5'),('L6','=TRUE+2','3'),('L7','=IF(FALSE,1/0,9)','9'),('L8','=#REF!','#REF!'),('L9','=IF(FALSE,#REF!,9)','9'),('M1','=1/0','#DIV/0!'),('M2','=AA1','#REF!'),('M3','=NOPE(1)','#NAME?'),('M4','=SUM("text")','#VALUE!'),('M5','=1+','#PARSE!')]
    for a,f,v in cases:edit(a,f);cells({a:v})
    screenshot('sheet04-parser-results.png')
    edit('B2','=1/0');cells({'L3':'#DIV/0!','L4':'#DIV/0!','L5':'#DIV/0!'});edit('B2','5');cells({'L3':'14','L4':'2','L5':'5'})
    edit('N1','-3.5');edit('N2','=N1*4+SUM(A1:B1)');cells({'N2':'-9'})
    p=download_json('parser-roundtrip.json');edit('L8','1');edit('L9','2');import_text(p.read_text());cells({'L8':'#REF!','L9':'9'});assert raw('L8')=='=#REF!';assert raw('L9')=='=IF(FALSE,#REF!,9)';no_errors()


def sheet05():
    reset();click('Chart');fill('Chart title','Performance trend');fill('Source range','H1:J4');ab('select','#new-chart-type','line');click('Create chart');assert ab('get','text','#chart-count')=='2'
    edit('B2','7');chart([6,28,34],[8,18,26]);click('Chart settings');fill('Chart title','A clearer quarter');fill('Hex color for Current','#9C6B45');click('Save settings')
    svg=ROOT/'evidence/current-chart.svg';png=ROOT/'evidence/current-chart.png';ab('download','#export-svg',str(svg));ab('download','#export-png',str(png));assert 'A clearer quarter' in svg.read_text();assert 'Beta · Current: 28 · I3' in svg.read_text();assert 'Total · Current: 34 · I4' in svg.read_text();assert js('document.querySelector("#chart-stage path[data-series=Current]").getAttribute("stroke")')=='#9c6b45';assert js('document.getElementById("chart-select").selectedOptions[0].textContent')=='A clearer quarter';assert png.read_bytes().startswith(b'\x89PNG\r\n\x1a\n');screenshot('sheet05-line-edited.png')
    goto('I3');click('Clear selected cells');chart([6,None,34],[8,18,26]);assert 'blank' in ab('get','text','#omission-summary')
    d=js('document.querySelector("#chart-stage path[data-series=Current]").getAttribute("d")');assert d.count('M')==2 and 'L' not in d,d;screenshot('sheet05-line-gap.png');click('Undo');chart([6,28,34],[8,18,26]);
    click('Grouped columns');assert js('document.querySelectorAll("#chart-stage rect[data-address]").length')==6;click('Line chart');assert js('document.querySelectorAll("#chart-stage circle[data-address]").length')==6
    ab('focus','#splitter');ab('press','ArrowLeft');ab('press','ArrowLeft');ab('focus','#grid-resize');ab('press','ArrowDown');cells({'B2':'7','C2':'28','D1':'34'});chart([6,28,34],[8,18,26]);no_errors()


def sheet06():
    reset();edit('K1',"'=SUM(A1:B2)");edit('K2','FALSE');p=download_json('workbook-roundtrip.json')
    edit('A1','5');click('Chart settings');fill('Chart title','Before import');ab('select','#chart-type','line');click('Save settings');chart([15,20,35],[8,18,26]);
    import_text(p.read_text());cells({'A1':'2','C1':'6','K1':'=SUM(A1:B2)','K2':'FALSE'});assert raw('K1')=="'=SUM(A1:B2)";assert ab('get','text','#chart-select')=='Current vs Plan';click('Undo');cells({'A1':'5','C1':'15'});assert ab('get','text','#chart-select')=='Before import';chart([15,20,35],[8,18,26]);
    before=js('({cells:Array.from(document.querySelectorAll("#sheet-table td")).map(n=>n.textContent),undo:document.getElementById("undo").title,charts:document.getElementById("chart-select").textContent})')
    bad=json.loads(p.read_text());bad['cells'][0]['address']='AA1';import_text(json.dumps(bad));assert ('inside A1:Z100' in ab('get','text','#import-error') or 'valid address' in ab('get','text','#import-error'));after=js('({cells:Array.from(document.querySelectorAll("#sheet-table td")).map(n=>n.textContent),undo:document.getElementById("undo").title,charts:document.getElementById("chart-select").textContent})');assert before==after;screenshot('sheet06-invalid-json.png');click('Close import')
    bad=json.loads(p.read_text());bad['charts'][0]['range']='H1:AA4';import_text(json.dumps(bad));assert 'inside A1:Z100' in ab('get','text','#import-error');after=js('({cells:Array.from(document.querySelectorAll("#sheet-table td")).map(n=>n.textContent),undo:document.getElementById("undo").title,charts:document.getElementById("chart-select").textContent})');assert before==after;click('Close import')
    csv='label,value\n"alpha, beta",2\n"line\nbreak",=1+1';import_text(csv,'csv');cells({'A2':'alpha, beta','B2':'2','A3':'line\nbreak','B3':'=1+1'});assert js('document.getElementById("cell-B3").dataset.type')=='text';assert ab('get','text','#chart-count')=='0';screenshot('sheet06-csv-literals.png')
    click('Export');csvout=ROOT/'evidence/evaluated-roundtrip.csv';ab('download','#export-csv',str(csvout));click('Close export');assert csvout.read_bytes().decode()=='label,value\r\n"alpha, beta",2\r\n"line\nbreak",=1+1'
    before=js('({cells:Array.from(document.querySelectorAll("#sheet-table td")).map(n=>n.textContent),undo:document.getElementById("undo").title})');import_text('"unfinished','csv');assert 'Unterminated' in ab('get','text','#import-error');after=js('({cells:Array.from(document.querySelectorAll("#sheet-table td")).map(n=>n.textContent),undo:document.getElementById("undo").title})');assert before==after;click('Close import')
    edit('A4','<img src=x onerror="document.body.dataset.injected=1">');cells({'A4':'<img src=x onerror="document.body.dataset.injected=1">'});assert js('({images:document.querySelectorAll("#cell-A4 img").length,executed:document.body.dataset.injected||null})')=={'images':0,'executed':None};screenshot('sheet06-inert-html.png')
    click('Import');ab('upload','#import-file',str(p));ab('wait','--fn','document.getElementById("import-text").value.includes("spreadsheet-chart-studio")');click('Import workbook');cells({'C1':'6','K1':'=SUM(A1:B2)'});assert ab('get','text','#chart-count')=='1';no_errors()


def run(checks):
    global LOG
    status={}
    for n in checks:
        path=ROOT/'evidence/logs'/('sheet%02d-browser.log'%n);LOG=path.open('w');print('START SHEET-%02d'%n,flush=True)
        try:globals()['sheet%02d'%n]();status['SHEET-%02d'%n]='pass';print('PASS SHEET-%02d'%n,flush=True)
        except Exception as e:status['SHEET-%02d'%n]='fail';LOG.write(traceback.format_exc());print('FAIL SHEET-%02d:'%n,e,flush=True);screenshot('sheet%02d-failure.png'%n);raise
        finally:LOG.close();LOG=None;(ROOT/'evidence/logs'/('status-'+str(checks[0])+'.json')).write_text(json.dumps(status,indent=2))

if __name__=='__main__':run([int(x) for x in sys.argv[1:]] or list(range(1,7)))
