"""Native touch cancellation, adversarial async reset, and bounded maximum load."""
import pathlib,subprocess,json,time,importlib.util
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('checks',ROOT/'browser-checks.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
ab=b.ab;ev=b.ev;diag=b.diag;state=b.state;click=b.click;check=b.check

def cdp(method,params):
 p=subprocess.run(['node',str(ROOT/'cdp.mjs'),b.SESSION,method,json.dumps(params)],capture_output=True,text=True)
 b.log.write(json.dumps({'cdp_method':method,'params':params,'stdout':p.stdout,'stderr':p.stderr})+'\n');b.log.flush();assert p.returncode==0,p.stderr
 return json.loads(p.stdout)
ab('open','file://'+str(ROOT.parent/'index.html'));ab('set','viewport',390,844,2);click('Reset');b.settle();baseline=state()
r=ev('document.getElementById("cloth").getBoundingClientRect().toJSON()');g=diag()['geometry'];x=round(r['x']+g['ox']+g['c']*2.5);y=round(r['y']+g['oy']+g['c']*1.5)
touch=cdp('Harness.touchCheck',{'x':x,'y':y})
check('native touch begins a captured edit',touch['during']['diag']['strokeActive'] and touch['during']['state']!=baseline)
check('native pointer cancellation restores the stroke transaction',touch['canceled']['state']==baseline and not touch['canceled']['diag']['strokeActive'] and touch['canceled']['diag']['undo']==0)
check('touch input works again immediately after cancellation',touch['tapped']['state']['cells'][1][2]==1 and touch['tapped']['diag']['undo']==1)
ab('screenshot',str(ROOT/'screenshots/mobile-retina-touch.png'));click('Reset')
# Adversarial delay: native FileReader is still used, but starts after Reset.
# This test-only timing wrapper does not change imported data or the app controller.
fixture=sorted((ROOT/'downloads').glob('run-*/Indigo-note-27.selvedge.json'))[-1]
ev('(()=>{const native=FileReader.prototype.readAsText;window.__readerDone=false;FileReader.prototype.readAsText=function(file){this.addEventListener("load",()=>{window.__readerDone=true},{once:true});setTimeout(()=>native.call(this,file),500)};return true})()')
click('Open');ab('upload','#fileInput',str(fixture));check('the delayed real import is pending before reset',diag()['pendingImport'])
click('Reset');reset_epoch=diag()['epoch'];ab('wait','--fn','window.__readerDone===true')
check('late native file callback cannot restore discarded session',state()==baseline and diag()['epoch']==reset_epoch and not diag()['pendingImport'] and diag()['undo']==0)
ab('reload');ab('set','viewport',1280,800,2);ab('select','#size','16');ab('select','#pattern','unbound')
ev('(()=>{window.__longTasks=[];window.__observer=new PerformanceObserver(l=>window.__longTasks.push(...l.getEntries().map(e=>e.duration)));window.__observer.observe({type:"longtask",buffered:false});return true})()')
t=time.perf_counter();click('+ Bind one float');elapsed=(time.perf_counter()-t)*1000
check('maximum repeat binding reduces 32 unbound yarns to 30',diag()['unbound']==30)
click('Zoom out');b.settle();d=diag();canvas=ev('({width:document.getElementById("cloth").width,height:document.getElementById("cloth").height,css:document.getElementById("cloth").getBoundingClientRect().toJSON()})')
check('render workload stays capped at 36864 crossings',d['geometry']['nx']*d['geometry']['ny']<=36864)
check('high-DPI canvas uses actual 2x backing resolution',abs(canvas['width']/canvas['css']['width']-2)<.01)
print('PERFORMANCE',json.dumps({'binding_agent_browser_roundtrip_ms':round(elapsed,2),'observed_long_tasks_ms':ev('window.__longTasks'),'visible_crossings':d['geometry']['nx']*d['geometry']['ny'],'backing_size':[canvas['width'],canvas['height']]}),flush=True)
click('Float lens');ab('screenshot',str(ROOT/'screenshots/maximum-repeat-retina.png'));click('Reset')
check('reset clears maximum-size experiment and all view changes',state()==baseline and diag()['undo']==0 and diag()['view']['zoom']==1 and not diag()['view']['lens'])
print('ERRORS',json.dumps(ab('errors')),flush=True);print('CONSOLE',json.dumps(ab('console')),flush=True)
