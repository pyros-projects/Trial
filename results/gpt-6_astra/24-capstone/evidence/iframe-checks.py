"""Opaque-origin checks using agent-browser input + screenshots.
CDP Frame.evaluate supplies read-only live diagnostics because agent-browser's eval
remains in the parent context for this OOPIF in the installed version.
"""
import pathlib,subprocess,json,time,importlib.util,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('checks',ROOT/'browser-checks.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b);b.SESSION='selvedge-http'
ab=b.ab;check=b.check

def ev(js):
    p=subprocess.run(['node',str(ROOT/'cdp.mjs'),b.SESSION,'Frame.evaluate',json.dumps({'expression':js})],capture_output=True,text=True)
    b.log.write(json.dumps({'frame_eval':js,'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})+'\n');b.log.flush()
    assert p.returncode==0,p.stderr
    r=json.loads(p.stdout);assert not r.get('exceptionDetails'),r
    return r['result'].get('value')
def ref(name,role='button',partial=False):
    refs=ab('snapshot','-i')['refs']
    for key,val in refs.items():
        n=' '.join(val.get('name','').split())
        if val.get('role')==role and ((name in n) if partial else n==name):return '@'+key
    raise AssertionError('No accessible '+role+' named '+name)
def click(name,partial=False):ab('click',ref(name,partial=partial))
def select(name,value):ab('select',ref(name,'combobox'),value)
def state():return ev('selvedge.getState()')
def diag():return ev('selvedge.diagnostics()')
def shot(name):ab('screenshot',str(ROOT/'screenshots'/name))
configs=[]
server=None
def main():
    global server
    server=subprocess.Popen(['python3','-m','http.server','8847','--bind','127.0.0.1'],cwd=ROOT.parent,stdout=(ROOT/'logs/http-server.txt').open('a'),stderr=subprocess.STDOUT)
    for _ in range(50):
        try:urllib.request.urlopen('http://127.0.0.1:8847/index.html');break
        except Exception:time.sleep(.1)
    ab('console','--clear');ab('errors','--clear')
    ab('frame','main');ab('open','http://127.0.0.1:8847/evidence/iframe.html');ab('set','viewport',1280,800)
    ab('wait','--load','networkidle');click('Reset');baseline=state()
    safety=ev('({origin:origin,storage:(()=>{try{return localStorage.length}catch(e){return e.name}})(),parent:(()=>{try{return parent.document===document}catch(e){return e.name}})(),resources:performance.getEntriesByType("resource").map(e=>e.name)})')
    check('actual gallery frame has opaque origin and storage denial',safety['origin']=='null' and safety['storage']=='SecurityError' and safety['parent']=='SecurityError')
    check('sandbox startup uses no resource fetches',safety['resources']==[])
    click('Row 3, column 2: weft over');ab('press','ArrowRight');ab('press','Space')
    check('sandbox pointer and keyboard change genuine crossings',state()['cells'][2][1:3]==[1,0] and diag()['undo']==2)
    click('Reverse');click('Float lens');shot('iframe-desktop-edited.png')
    check('sandbox reverse and float lens are live',diag()['view']['back'] and diag()['view']['lens'] and diag()['longFloats']==2)
    select('Starting structure','unbound');click('+ Bind one float');check('sandbox binding handles unbound structure',diag()['unbound']==14)
    click('Undo');check('sandbox undo restores unbound draft',diag()['unbound']==16);click('Redo')
    # Save a native project and PNG from the opaque origin; no parent access or privileged FS API.
    folder=ROOT/'downloads'/('iframe-'+str(time.time_ns()));folder.mkdir()
    config=subprocess.Popen(['node',str(ROOT/'cdp.mjs'),b.SESSION,'Browser.setDownloadBehavior',json.dumps({'behavior':'allow','downloadPath':str(folder),'eventsEnabled':True}),'--hold'],stdout=subprocess.PIPE,text=True);configs.append(config);assert config.stdout.readline().strip()=='{}'
    saved_state=state();click('Save');click('Selvedge project',True)
    jsonfile=folder/'Study-01-Diamond-twill.selvedge.json'
    for _ in range(40):
        if jsonfile.exists():break
        time.sleep(.1)
    check('opaque sandbox allows actual user-requested project download',jsonfile.exists() and json.loads(jsonfile.read_text())['project']==saved_state)
    click('Save');click('Cloth image',True)
    png=folder/'Study-01-Diamond-twill-reverse.png'
    for _ in range(40):
        if png.exists():break
        time.sleep(.1)
    check('opaque sandbox PNG download is a real image',png.exists() and png.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n')
    click('Reset');click('Open');ab('upload',ref('Open Selvedge project file'),str(jsonfile));ab('wait','--load','networkidle')
    check('opaque sandbox restores downloaded project through native file input',state()==saved_state)
    click('Open');ab('upload',ref('Open Selvedge project file'),str(ROOT/'invalid-project.json'))
    check('opaque sandbox invalid file leaves prior state intact',state()==saved_state and ev('document.getElementById("status").dataset.kind')=='error')
    # Same late-file callback challenge inside the opaque origin.
    click('Reset')
    ev('(()=>{const native=FileReader.prototype.readAsText;window.__lateReadDone=false;FileReader.prototype.readAsText=function(file){this.addEventListener("load",()=>window.__lateReadDone=true,{once:true});setTimeout(()=>native.call(this,file),1000)};return true})()')
    click('Open');ab('upload',ref('Open Selvedge project file'),str(jsonfile))
    check('opaque sandbox import is pending before whole-session reset',diag()['pendingImport'])
    click('Reset')
    for _ in range(30):
        if ev('window.__lateReadDone'):break
        time.sleep(.05)
    check('opaque sandbox ignores a native file callback arriving after reset',ev('window.__lateReadDone') and state()==baseline and not diag()['pendingImport'] and diag()['undo']==0)
    ab('reload');ab('wait','--load','networkidle')
    # Actual focus loss during a captured pointer stroke.
    click('Reset');d=diag();r=ev('document.getElementById("cloth").getBoundingClientRect().toJSON()');g=d['geometry']
    x=r['x']+g['ox']+g['c']*3.5;y=34+r['y']+g['oy']+g['c']*3.5
    outside=ref('Focus outside the app');ab('mouse','move',x,y);ab('mouse','down','left')
    check('opaque canvas pointer capture begins a real stroke',diag()['strokeActive'] and state()!=baseline)
    ab('focus',outside);ab('mouse','up','left')
    check('moving keyboard focus outside frame cancels partial stroke',not diag()['strokeActive'] and state()==baseline and diag()['undo']==0)
    # Actual URL text selection without opening an external source.
    click('About this idea');ab('scrollintoview',ref('Unstable Design Lab — AdaCAD','link'))
    r=ev('document.querySelector("#aboutDialog .source:last-of-type .url").getBoundingClientRect().toJSON()')
    x=r['left']+1;y=r['top']+34+r['height']/2
    ab('mouse','move',x,y);ab('mouse','down','left');ab('mouse','move',x+122,y);ab('mouse','up','left')
    selection=ev('getSelection().toString()');check('source URL text can be selected in sandbox without navigation','adacad' in selection)
    shot('iframe-selectable-sources.png');ab('press','Escape')
    check('reference selection triggers no resource requests',ev('performance.getEntriesByType("resource").length')==0)
    # Resize the same sandbox to a narrow device, then use its canvas.
    ab('set','viewport',390,844);click('Reset');ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))')
    check('narrow iframe app fits its viewport',ev('document.documentElement.scrollWidth')==390)
    click('Zoom in');check('zoom enlarges threads and updates actual render geometry',diag()['view']['zoom']==0 and diag()['geometry']['ny']==16)
    r=ev('document.getElementById("cloth").getBoundingClientRect().toJSON()');g=diag()['geometry'];x=r['x']+g['ox']+g['c']*2.5;y=34+r['y']+g['oy']+g['c']*1.5
    ab('mouse','move',x,y);ab('mouse','down','left');ab('mouse','up','left')
    check('narrow sandbox canvas edit is usable',state()['cells'][1][2]==1 and diag()['undo']==1)
    shot('iframe-mobile-edited.png');click('Reset');check('sandbox reset restores initial project and views',state()==baseline and diag()['undo']==0 and diag()['view']['zoom']==1)
    ab('reload');ab('wait','--load','networkidle');check('sandbox reload returns to the initial session',state()==baseline and diag()['undo']==0)
    print('OPAQUE FINAL',json.dumps(ev('({origin:origin,diag:selvedge.diagnostics(),resources:performance.getEntriesByType("resource").map(e=>e.name)})')),flush=True)
    print('CONSOLE',json.dumps(ab('console')),flush=True);print('ERRORS',json.dumps(ab('errors')),flush=True);requests=ab('network','requests')['requests'];print('REQUEST SUMMARY',json.dumps({'external_http':[r['url'] for r in requests if r['url'].startswith(('http:','https:')) and not r['url'].startswith('http://127.0.0.1:8847/')],'last_documents':[{'url':r['url'],'status':r.get('status')} for r in requests if r.get('resourceType')=='Document'][-6:]}),flush=True)
try:main()
finally:
    for p in configs:p.terminate()
    if server:server.terminate()
