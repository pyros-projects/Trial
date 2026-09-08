import subprocess,json,shlex,pathlib,traceback,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
log=open(ROOT/'evidence/logs/browser-import-regression.txt','w',buffering=1);results=[]
def ab(*args):
 if args[:2]==('mouse','move'):args=(*args[:2],round(args[2]),round(args[3]))
 cmd=['agent-browser','--session','civic-import',*map(str,args)];log.write('$ '+shlex.join(cmd)+'\n');p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=40);log.write(p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return p.stdout.strip()
def read(expr):
 v=json.loads(ab('eval','JSON.stringify('+expr+')'));return json.loads(v) if isinstance(v,str) else v
def click(name):ab('find','role','button','click','--name',name)
def tap(x,y):
 p=read('civic.screenOf({x:'+str(x)+',y:'+str(y)+'})');ab('mouse','move',p['x'],p['y']);ab('mouse','down');ab('mouse','up')
def check(name,ok,observed):
 r={'check':name,'status':'pass' if ok else 'fail','observed':observed};results.append(r);log.write(json.dumps(r)+'\n');print(json.dumps(r),flush=True)
 if not ok:raise AssertionError(name)
def shot(name):ab('screenshot','evidence/screenshots/'+name+'.png')
def layer(name):ab('click','#layersBtn');ab('click','[data-overlay="'+name+'"]')
try:
 ab('open','about:blank');ab('network','route','https://**','--abort');ab('network','route','http://**','--abort');ab('set','viewport',1280,800,2);ab('open','file://'+str(ROOT/'index.html'));ab('select','#scenarioSelect','downtown');click('Pause simulation')
 before=read('({time:civic.sim.time,roads:civic.sim.roads.length,vehicles:civic.sim.vehicles.length,name:civic.sim.name})');bad=json.loads((ROOT/'evidence/exports/city.json').read_text());bad['runtime']['byRoad']=None;(ROOT/'evidence/exports/invalid-diagnostics.json').write_text(json.dumps(bad));click('City files');ab('upload','#importFile',str(ROOT/'evidence/exports/invalid-diagnostics.json'));ab('wait','--fn','document.getElementById("toast").textContent.includes("Invalid road diagnostics")');after=read('({time:civic.sim.time,roads:civic.sim.roads.length,vehicles:civic.sim.vehicles.length,name:civic.sim.name})');check('corrupt road diagnostics rejected before replacing city',before==after,{'before':before,'after':after,'message':read('document.getElementById("toast").textContent')});shot('28-invalid-diagnostics-rejected')
 ab('upload','#importFile',str(ROOT/'evidence/exports/city.json'));ab('wait','--fn','!document.getElementById("modalBackdrop").classList.contains("open")');click('Single step one second');check('valid saved city imports and advances after schema change',read('civic.sim.roads.length')==58 and read('civic.sim.time')>91,{'roads':read('civic.sim.roads.length'),'time':read('civic.sim.time')});click('City files');ab('download','#jsonExport',str(ROOT/'evidence/exports/final-city.json'));click('Close dialog');ab('wait','--fn','getComputedStyle(document.getElementById("toast")).opacity==="0"');shot('29-final-desktop-clean');ab('set','viewport',390,844,2);click('Fit city to screen');shot('30-final-mobile-clean');ab('set','viewport',1280,800,2);click('Fit city to screen');check('import regression console and offline audit',not ab('errors') and not ab('console'),{'console':ab('console'),'requests':ab('network','requests')})
except Exception:
 log.write(traceback.format_exc());print(traceback.format_exc(),flush=True);raise
finally:(ROOT/'evidence/logs/browser-import-regression-results.json').write_text(json.dumps(results,indent=2));log.close()
