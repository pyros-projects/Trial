"""Real agent-browser input in sandbox=allow-scripts allow-downloads.
Auxiliary read-only CDP probes address agent-browser 0.31.1's top-frame eval scope.
"""
import importlib.util, json, pathlib, re, subprocess, time, shutil
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('checks',ROOT/'evidence/browser-checks.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
b.SESSION='afterimage-http';b.LOG=ROOT/'evidence/logs/iframe-commands.jsonl'
results=[]
endpoint=b.run('get','cdp-url').strip()
def frame_js(expression):
    cmd=['node',str(ROOT/'evidence/cdp-probe.mjs'),endpoint,'index.html']
    r=subprocess.run(cmd,input=expression,text=True,capture_output=True,cwd=ROOT,timeout=10)
    with b.LOG.open('a') as f:f.write(json.dumps({'command':cmd,'stdin':expression,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})+'\n')
    if r.returncode:raise RuntimeError(r.stderr)
    return json.loads(r.stdout)['result']
b.js=frame_js
def cdp_action(action,argument):
    cmd=['node',str(ROOT/'evidence/cdp-probe.mjs'),endpoint,'index.html',action,str(argument)]
    r=subprocess.run(cmd,input='true',text=True,capture_output=True,cwd=ROOT,timeout=10)
    with b.LOG.open('a') as f:f.write(json.dumps({'command':cmd,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr})+'\n')
    if r.returncode:raise RuntimeError(r.stderr)
    return json.loads(r.stdout)['result']
def import_file(path):
    # Real ordinary input in the live opaque target; the CLI CSS query is top-frame.
    b.click('Open project');cdp_action('upload',path)
def wait_notice(text):
    encoded=json.dumps(text)
    b.check(b.js(f"(async()=>{{for(let i=0;i<100;i++){{if(document.getElementById('notice').textContent.includes({encoded}))return true;await new Promise(r=>setTimeout(r,20));}}return false;}})()"),'Expected import feedback: '+text)
def ref(name,role):
    # The accessibility refs work across the opaque target, unlike semantic find.
    snapshot=b.run('snapshot','-i')
    match=re.search(r'\b'+re.escape(role)+r' "'+re.escape(name)+r'"[^\n]*ref=(e\d+)',snapshot)
    b.check(bool(match),'Missing labeled '+role+': '+name)
    return '@'+match.group(1)
def frame_click(name,role='button'):b.run('click',ref(name,role))
b.click=frame_click
def record(name,observed):
    results.append({'check':name,'status':'pass','observed':observed})
    (ROOT/'evidence/logs/iframe-results.json').write_text(json.dumps(results,indent=2))
    print('PASS',name,observed,flush=True)
try:
    b.run('frame','main');b.run('set','viewport',1280,800)
    # Begin a new application-only interval after the recorded proxy/download probes.
    b.run('network','requests','--clear')
    b.run('open','http://127.0.0.1:8779/evidence/opaque-frame.html')
    snapshot=b.run('snapshot','-i');match=re.search(r'Iframe [^\n]*ref=(e\d+)',snapshot)
    b.check(bool(match),'Must contain gallery frame');b.run('frame','@'+match.group(1))
    metadata=b.js("(() => {let denied=false;try{localStorage.length;}catch(e){denied=e.name==='SecurityError';}return {origin:origin,storageDenied:denied,ready:!!window.Afterimage};})()")
    b.check(metadata=={'origin':'null','storageDenied':True,'ready':True},'Must actually be an opaque origin with denied storage')
    b.shot('15-opaque-origin-initial.png')
    b.click('01Make a memory','tab');b.run('fill',ref('Word to inscribe','textbox'),'MEND');b.run('press','Enter')
    custom=b.diag();b.check(custom['title']=='MEND','Opaque frame must accept new authored input')
    b.click('02Let it weather','tab');b.drag([(5,6),(8,13),(11,20)]);loss=b.diag();b.click('Recover memory');d=b.diag()
    b.check(loss['erased']>0 and d['matchesOriginal'] is True,'Real pointer loss in opaque frame must recover new authored bytes')
    b.shot('16-opaque-custom-pointer-recovery.png',True)
    record('opaque origin, denied storage, authored pointer recovery',{**metadata,'erased':loss['erased'],'decoded_equal':True})

    b.click('Rows');b.click('Fold');b.click('Recover memory');b.check(b.diag()['unknown']==96,'Rows failure must work inside opaque frame')
    b.click('Woven');b.click('Fold');b.click('Recover memory');b.check(b.diag()['decoded']==custom['pixels'],'Woven must restore same source inside frame')
    record('opaque frame fold comparison',{'rows_unknown':96,'woven_unknown':0,'source_retained':True})

    downloads=ROOT/f'evidence/opaque-downloads/run-{time.time_ns()}';downloads.mkdir(parents=True)
    watch_cmd=['node',str(ROOT/'evidence/cdp-download-watch.mjs'),endpoint,str(downloads)]
    watcher=subprocess.Popen(watch_cmd,text=True,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    ready=watcher.stdout.readline();b.check(json.loads(ready)['ready'],'Real Chrome download monitor must be ready')
    b.click('Save project');output,err=watcher.communicate(timeout=15)
    with b.LOG.open('a') as f:f.write(json.dumps({'command':watch_cmd,'stdout':ready+output,'stderr':err,'exit':watcher.returncode})+'\n')
    b.check(watcher.returncode==0,'Real sandbox download must complete: '+err)
    completed=json.loads(output);downloaded=pathlib.Path(completed['path'])
    b.check(completed['state']=='completed' and downloaded.exists(),'A real sandbox download must complete after clicking Save')
    project=ROOT/'evidence/opaque-download.json';shutil.copyfile(downloaded,project)
    saved=b.diag();b.check(json.loads(project.read_text())['memory']['pixels']==saved['pixels'],'Sandbox download must contain actual custom payload')
    b.click('Reset session');b.check(b.diag()['history']==0 and b.diag()['erased']==0,'Opaque reset must work')
    import_file(project);wait_notice('Project restored.')
    b.check(b.same_project(saved,b.diag()),'Sandbox file input must round-trip full project')
    before=b.diag();import_file(ROOT/'evidence/fixtures/duplicate-erasure.json');wait_notice('Could not open project:')
    b.check(b.same_project(before,b.diag()),'Sandbox invalid import must preserve model')
    b.click('About this idea');text=b.js("document.getElementById('aboutDialog').innerText")
    b.check('https://sigh.github.io/reed-solomon/' in text and 'https://www.itu.int/' in text,'Sandbox sources must remain selectable without navigation')
    b.run('press','Escape');b.shot('17-opaque-project-restored.png',True)
    record('opaque downloads, restore, invalid import and About',{'project_bytes':project.stat().st_size,'roundtrip':True,'invalid_preserved':True,'selectable_sources':True})

    b.click('Reset session');b.run('set','viewport',390,844);b.run('scroll','up',2000)
    b.check(b.js('document.documentElement.scrollWidth <= innerWidth'),'Narrow sandbox must not overflow')
    b.click('Fold');b.click('Recover memory');b.check(b.diag()['matchesOriginal'] is True,'Narrow sandbox recovery must work')
    b.shot('18-opaque-narrow-recovery.png',True)
    b.click('01Make a memory','tab');b.run('fill',ref('Word to inscribe','textbox'),'TINY');b.run('press','Enter')
    b.check(b.diag()['title']=='TINY' and b.js('document.documentElement.scrollWidth <= innerWidth'),'Narrow canvas composition and controls must fit')
    b.shot('19-opaque-narrow-compose.png',True)
    record('390×844 opaque flow and composition',{'recovery_equal':True,'custom_word':'TINY','no_horizontal_overflow':True})

    b.run('frame','main');b.run('reload');b.run('snapshot','-i')
    d=b.diag();b.check(d['title']=='Night visitor' and d['history']==0 and d['erased']==0,'Gallery reload must clear session')
    errors=b.run('errors');console=b.run('console');requests=b.run('network','requests')
    b.check(not errors.strip() and not console.strip(),'Sandbox app must have no uncaught errors or console output')
    b.check(all('127.0.0.1:8779' in line for line in requests.splitlines() if line.strip()),'Only local harness and document requests may occur during app tests')
    record('sandbox reload, console and requests',{'reload_clears':True,'uncaught_errors':0,'console_empty':True,'requests':'local HTML documents only'})
except Exception as e:
    results.append({'check':'interrupted iframe workflow','status':'fail','observed':str(e)})
    (ROOT/'evidence/logs/iframe-results.json').write_text(json.dumps(results,indent=2))
    print('FAIL',e,flush=True);raise
