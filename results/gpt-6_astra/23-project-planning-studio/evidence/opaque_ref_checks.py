import browser_checks as b
import subprocess,json,re,time,shlex
native=b.ab

def js(code):
 p=subprocess.run(['node','evidence/iframe-eval.cjs'],input=code,text=True,capture_output=True,cwd=b.ROOT,timeout=20)
 with b.LOG.open('a') as f:f.write('$ node evidence/iframe-eval.cjs <<JAVASCRIPT\n'+code+'\nJAVASCRIPT\n'+p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError(p.stderr)
 return json.loads(p.stdout)
def ref(name,role=None):
 snapshot=native('snapshot','-i')
 for line in snapshot.splitlines():
  match=re.search(r'- ([^ ]+) "(.*?)".*?ref=(e\d+)',line)
  if match and match[2]==name and (role is None or match[1]==role):return '@'+match[3]
 raise RuntimeError('No accessible ref for '+repr(name))
def selector_ref(selector):
 name=js('(()=>{const e=document.querySelector('+json.dumps(selector)+');return e?.getAttribute("aria-label")||e?.innerText?.replace(/\\s+/g," ").trim()||e?.textContent?.replace(/\\s+/g," ").trim()})()')
 return ref(name)
def ab(*args,**kw):
 if args[0]=='find':
  if args[1]=='label':return native('fill',ref(args[2]),args[4])
  if args[1]=='role':return native('click',ref(args[5],args[2]))
 if args[0]=='download':
  target=selector_ref(args[1]);capture_dir=b.ROOT/'evidence/downloads'/('opaque-capture-'+str(time.time_ns()))
  proc=subprocess.Popen(['node','evidence/capture-download.cjs',str(capture_dir)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,cwd=b.ROOT)
  assert proc.stdout.readline().strip()=='READY'
  native('click',target)
  stdout,stderr=proc.communicate(timeout=25)
  if proc.returncode:raise RuntimeError(stderr)
  info=json.loads(stdout);b.pathlib.Path(args[2]).write_bytes(b.pathlib.Path(info['path']).read_bytes())
  with b.LOG.open('a') as f:f.write('Browser-level download completed: '+json.dumps(info)+' -> '+args[2]+'\n')
  return info
 if args[0] in ['click','fill','upload','scrollintoview','check','uncheck'] and not args[1].startswith('@'):
  return native(args[0],selector_ref(args[1]),*args[2:],**kw)
 if args[0]=='wait' and args[1]=='--fn':
  deadline=time.monotonic()+10
  while time.monotonic()<deadline:
   if js(args[2]):return
   time.sleep(.05)
  raise RuntimeError('Iframe condition did not become true')
 return native(*args,**kw)
b.ab=ab;b.js=js

def enter():
 native('frame','main');s=native('snapshot','-i');m=re.search(r'- Iframe .*?ref=(e\d+)',s);assert m,s;native('frame','@'+m[1]);native('snapshot','-i')

native('frame','main');native('open','http://127.0.0.1:18765/evidence/opaque-host.html');native('set','viewport','1280','800');enter()
boundaries=js('(()=>{const r={origin:window.origin,title:document.title};for(const key of ["localStorage","sessionStorage","indexedDB"]){try{if(key==="indexedDB")window[key].open("test-denied");else void window[key];r[key]="unexpectedly available"}catch(e){r[key]=e.name}}try{void parent.document;r.parent="unexpectedly available"}catch(e){r.parent=e.name}return r})()')
(b.ROOT/'evidence/opaque-boundaries.json').write_text(json.dumps(boundaries,indent=2));assert boundaries['origin']=='null' and boundaries['localStorage']=='SecurityError' and boundaries['parent']=='SecurityError',boundaries
b.expect_intervals(b.SEED);b.fill('Duration for T1','3');ab('press','Tab');assert b.summary()[:2]==[9,7];b.click('Undo');b.expect_intervals(b.SEED)
b.click('Select T2 Build');b.fill('Not-before date','2026-09-12');ab('press','Enter');b.expect_intervals(b.GAP);b.click('Undo');b.expect_intervals(b.SEED)
b.drag_to('T2',5);b.expect_intervals(b.GAP);b.click('Undo');b.expect_intervals(b.SEED)
for kind in ['json','csv','svg']:assert b.export(kind,'opaque.'+kind)
m=b.source();m['tasks'][0]['duration']=3;b.import_text(m);assert b.summary()[:2]==[9,7];b.click('Undo');b.expect_intervals(b.SEED)
b.button('Files');ab('upload','#import-file',str(b.ROOT/'evidence/downloads/tie-priority.json'));ab('wait','--fn','document.querySelector("#import-text").value.length>0');b.button('Import plan');b.expect_intervals(b.SEED)
b.button('Reset');assert js('document.querySelector("#undo").disabled && document.querySelector("#redo").disabled')
b.button('Add task');b.fill('New task ID','O');b.fill('New task name','Opaque task');b.button('Create task');assert 'O' in b.intervals();b.click('Undo');b.expect_intervals(b.SEED)
b.click('Edit project');b.fill('Project name','Opaque project');b.fill('Project start date','2026-09-05');b.button('Save changes');assert b.source()['project']=={'name':'Opaque project','startDate':'2026-09-07'};b.click('Undo');b.expect_intervals(b.SEED)
b.button('Reset');b.screenshot('plan07-opaque-desktop.png')
native('frame','main');native('reload');enter();b.expect_intervals(b.SEED);assert js('document.querySelector("#undo").disabled')
native('set','viewport','390','844');b.button('Table');b.click('Select T2 Build');b.button('Details');b.fill('Not-before date','2026-09-14');ab('press','Enter');b.expect_intervals(b.GAP);b.click('Undo');b.expect_intervals(b.SEED)
for name in ['Gantt','Resources','Details','Table']:b.button(name)
b.fill('Duration for T1','3');ab('press','Tab');assert b.summary()[:2]==[9,7];b.click('Undo');b.expect_intervals(b.SEED)
assert b.export('json','opaque-mobile.json');b.button('Reset');b.screenshot('plan07-opaque-mobile.png')
print('PASS opaque iframe on desktop and mobile: actual edits, keyboard dates, drag, undo, downloads, file/text import, navigation, Reset/reload; storage and parent access denied.')
