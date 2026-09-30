import browser_workflows as b
import subprocess, json, pathlib, traceback, time, os, shutil
ROOT=b.ROOT;SESSION=b.SESSION;N=0;DOWNLOADS=ROOT/'evidence/iframe-downloads'/('run-'+str(os.getpid()));LOG=(ROOT/'evidence/logs/sheet07-opaque-ref.log').open('w');b.LOG=LOG

def snap():
 global N
 N+=1;cmd=['agent-browser','--session',SESSION,'snapshot','-i','--json'];r=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=30);p=ROOT/'evidence/logs'/('iframe-snapshot-%d-%02d.json'%(os.getpid(),N));p.write_text(r.stdout)
 LOG.write('$ '+' '.join(cmd)+' > '+str(p)+'\n');LOG.flush();assert r.returncode==0,r.stderr
 data=json.loads(r.stdout);assert data['success'],data;return data['data']['refs']

def ref(role,name,prefix=False):
 refs=snap();matches=[i for i,v in refs.items() if v['role']==role and (v['name'].startswith(name) if prefix else v['name']==name)]
 assert len(matches)==1,(role,name,matches);return '@'+matches[0]

def click(name):b.ab('click',ref('button',name))
def fill(name,text):b.ab('fill',ref('textbox',name),text)
def goto(a):fill('Go to cell or range',a);b.ab('press','Enter')
def raw(a):goto(a);return b.ab('get','value',ref('textbox','Formula bar'))
def cells(expected):
 refs=snap();by={v['name'].split(',')[0]:'@'+i for i,v in refs.items() if v['role']=='gridcell'};actual={a:b.ab('get','text',by[a]) for a in expected};assert actual==expected,(actual,expected);print('Opaque cells:',actual,flush=True)
def import_csv():
 click('Import');b.ab('select',ref('combobox','File format'),'csv');fill('File contents','label,value\n"alpha, beta",2\n"line\nbreak",=1+1');click('Import workbook')


def actual_download(button_name,filename,out):
 folder=DOWNLOADS;folder.mkdir(exist_ok=True);path=folder/filename
 # Fresh test filenames (separate directory per test run) are configured by CDP.
 click(button_name);deadline=time.monotonic()+10
 while not path.exists() or not path.stat().st_size:
  assert time.monotonic()<deadline,('Download completed after real click',filename);time.sleep(.05)
 while any(folder.glob('*.crdownload')):
  assert time.monotonic()<deadline,'Download finished';time.sleep(.05)
 shutil.copyfile(path,out);LOG.write('Observed download: '+str(path)+' -> '+str(out)+' ('+str(out.stat().st_size)+' bytes)\n');LOG.flush()

monitor=None
try:
 b.ab('frame','main');b.ab('set','viewport',1280,800);b.ab('network','har','start');b.ab('open','http://127.0.0.1:8765/evidence/opaque-frame.html');b.ab('wait','#studio-frame')
 diagnostic=json.loads(subprocess.check_output(['node','evidence/tests/iframe_cdp.cjs','diagnostics'],cwd=ROOT,text=True));LOG.write('$ node evidence/tests/iframe_cdp.cjs diagnostics\n'+json.dumps(diagnostic)+'\n');assert diagnostic['origin']=='null' and diagnostic['storage']=='SecurityError' and diagnostic['parentAccess']=='SecurityError';print('Actual sandbox:',diagnostic,flush=True)
 events=ROOT/'evidence/logs/iframe-runtime-events.jsonl';events_log=events.open('w');monitor=subprocess.Popen(['node','evidence/tests/iframe_cdp.cjs','watch',str(DOWNLOADS)],cwd=ROOT,stdout=events_log,stderr=events_log,text=True)
 deadline=time.monotonic()+10
 while '"ready":true' not in events.read_text():
  assert time.monotonic()<deadline,'CDP diagnostic subscription ready';time.sleep(.05)
 click('Reset');cells({'C1':'6','D1':'26','F1':'11'});goto('A1');b.ab('press','5');b.ab('press','Enter');cells({'A1':'5','C1':'15','D1':'35','F1':'23'})
 for name in ['Alpha · Current: 15 · I2','Beta · Current: 20 · I3','Total · Current: 35 · I4']:assert any(v['name']==name for v in snap().values())
 click('Undo');goto('F1');click('Copy');goto('F2');click('Paste');assert raw('F2')=='=$A2+B$1+$C$1';cells({'F2':'13'})
 click('Export');p=ROOT/'evidence/opaque-frame-workbook.json';actual_download('JSON Studio workbook Typed raw cells, formulas, and all chart settings.','Performance-workbook.json',p);click('Close export')
 actual_download('SVG','Current-vs-Plan.svg',ROOT/'evidence/opaque-frame-chart.svg');actual_download('PNG','Current-vs-Plan.png',ROOT/'evidence/opaque-frame-chart.png')
 import_csv();cells({'A2':'alpha, beta','B2':'2','A3':'line\nbreak','B3':'=1+1'});assert not any(v['role']=='combobox' and v['name']=='Selected chart' for v in snap().values())
 click('Import');r=subprocess.run(['node','evidence/tests/iframe_cdp.cjs','file',str(p)],cwd=ROOT,text=True,capture_output=True,timeout=10);LOG.write('$ node evidence/tests/iframe_cdp.cjs file '+str(p)+'\n'+r.stdout+r.stderr+'\n');assert r.returncode==0,r.stderr
 deadline=time.monotonic()+10
 while 'spreadsheet-chart-studio' not in b.ab('get','value',ref('textbox','File contents')):assert time.monotonic()<deadline,'File read completes'
 click('Import workbook');cells({'C1':'6','F2':'13'});click('Undo');cells({'B3':'=1+1','F2':''});click('Redo');cells({'C1':'6','F2':'13'});b.screenshot('sheet07-opaque-frame.png')
 click('Chart');fill('Chart title','Opaque line');fill('Source range','H1:J4');b.ab('select',ref('combobox','Chart type'),'line');click('Create chart');assert b.ab('get','text',ref('combobox','Selected chart'))=='Current vs Plan\nOpaque line';assert any(v['name']=='Alpha · Current: 6 · I2' for v in snap().values())
 click('Chart settings');fill('Chart title','Sandbox saved');fill('Hex color for Current','#A26C3D');b.ab('press','Enter');assert b.ab('get','text',ref('combobox','Selected chart'))=='Current vs Plan\nSandbox saved';b.screenshot('sheet07-opaque-chart-forms.png');click('Chart settings');click('Delete chart');assert b.ab('get','text',ref('combobox','Selected chart'))=='Current vs Plan';click('Undo');assert b.ab('get','text',ref('combobox','Selected chart'))=='Current vs Plan\nSandbox saved'
 click('Reset');cells({'F2':'','D1':'26'});assert b.ab('is','enabled',ref('button','Undo'))=='false';b.ab('frame','main');b.ab('reload');cells({'C1':'6','F2':''});b.no_errors();b.ab('network','har','stop',str(ROOT/'evidence/logs/opaque-frame.har'))
 observed=[json.loads(line) for line in events.read_text().splitlines() if line.startswith('{')];bad=[e for e in observed if e.get('event') in ['Runtime.exceptionThrown','Network.loadingFailed'] or (e.get('event')=='Runtime.consoleAPICalled' and e['params']['type'] in ['error','warning']) or (e.get('event')=='Log.entryAdded' and e['params']['entry']['level'] in ['error','warning'])];assert not bad,bad
 print('PASS opaque-origin iframe keyboard/internal copy/text CSV/native file JSON/undo/redo/downloads/chart create-save-delete/reset/reload; no runtime, security-log, or request failures',flush=True)
except Exception:
 LOG.write(traceback.format_exc());b.screenshot('sheet07-opaque-ref-failure.png');raise
finally:
 if monitor:
  monitor.terminate()
  try:monitor.wait(timeout=5)
  except subprocess.TimeoutExpired:monitor.kill();monitor.wait()
  events_log.close()
 LOG.close()
