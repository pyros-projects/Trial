import subprocess,json,time,pathlib,sys,struct,zlib,shutil
root=pathlib.Path(__file__).resolve().parents[2]
log=(root/'evidence/logs/files-mobile-workflow.log').open('a');results=[]
def run(*args,js=None):
    command=['agent-browser','--session','strata',*map(str,args)];log.write('$ '+' '.join(command)+'\n');log.flush()
    r=subprocess.run(command,input=js,text=True,capture_output=True);log.write(r.stdout+r.stderr+'\n');log.flush()
    if r.returncode:raise RuntimeError(r.stderr or r.stdout)
    return r.stdout.strip()
def ev(js):return json.loads(run('eval','--stdin',js=js))
def diag():return ev('window.strata.diagnostics()')
def check(name,ok,detail=None):
    results.append({'name':name,'status':'pass' if ok else 'fail','observed':detail});print(('PASS ' if ok else 'FAIL ')+name,flush=True);(root/'evidence/logs/files-mobile-results.json').write_text(json.dumps(results,indent=2))
    if not ok:raise AssertionError(name+': '+str(detail))
def shot(name):run('screenshot',root/'evidence/screenshots'/name)
def focuskey(sel,key):run('focus',sel);run('press',key)
def native(op,*values):
    r=subprocess.run(['node',str(root/'evidence/tests/native-input.cjs'),op,*map(str,values)],text=True,capture_output=True);log.write(r.stdout+r.stderr);log.flush()
    if r.returncode:raise RuntimeError(r.stderr)
    return json.loads(r.stdout)
def download_button(selector,destination,extension):
    directory=root/'evidence/downloads';before={p:p.stat().st_mtime_ns for p in directory.iterdir()};run('click',selector)
    for _ in range(80):
        candidates=[p for p in directory.iterdir() if (p not in before or p.stat().st_mtime_ns!=before[p]) and p.suffix==extension]
        if candidates:
            shutil.copy2(max(candidates,key=lambda p:p.stat().st_mtime),destination);return
        time.sleep(.1)
    raise RuntimeError('Download did not complete: '+selector)
def upload(path):run('upload','#fileInput',path);run('wait','--fn',"document.getElementById('toast').classList.contains('visible')");run('wait',150)
try:
    if not diag()['paused']:run('click','#pause')
    hold=subprocess.Popen(['node',str(root/'evidence/tests/native-input.cjs'),'downloads_hold',str(root/'evidence/downloads')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    ready=hold.stdout.readline();log.write('Native download policy held: '+ready);log.flush();assert json.loads(ready)['ready']
    run('select','#mode','4');run('find','role','button','click','--name','Inspect terrain','--exact');p=ev('window.strata.project(0,2)');run('mouse','move',round(p['x']),round(p['y']));run('mouse','down');run('mouse','up');saved=diag();savedCamera=ev('window.strata.camera');savedView=ev('window.strata.view')
    run('click','#exportBtn');statepath=root/'evidence/simulation-roundtrip.json';download_button('#exportJson',statepath,'.json');state=json.loads(statepath.read_text());check('Complete JSON is downloaded through the Export menu',state['format']=='strata-erosion' and len(state['h'])==saved['n']**2 and len(state['flux'])==4*saved['n']**2 and 'baseline' in state and state['view']['mode']==4,{'bytes':statepath.stat().st_size,'resolution':state['n']})
    run('click','#exportBtn');pngpath=root/'evidence/heightfield.png';download_button('#exportPng',pngpath,'.png');png=pngpath.read_bytes();w,h=struct.unpack('>II',png[16:24]);check('Heightfield PNG is a genuine image at the simulation dimensions',png[:8]==b'\x89PNG\r\n\x1a\n' and w==h==saved['n'],{'width':w,'height':h,'bytes':len(png)})
    # Decode actual exported PNG pixels using only the standard library.
    depth,ctype,interlace=png[24],png[25],png[28];assert depth==8 and ctype in [2,6] and interlace==0
    bpp=4 if ctype==6 else 3;offset=8;compressed=b''
    while offset<len(png):
        length=struct.unpack('>I',png[offset:offset+4])[0];kind=png[offset+4:offset+8]
        if kind==b'IDAT':compressed+=png[offset+8:offset+8+length]
        offset+=length+12
    raw=zlib.decompress(compressed);previous=[0]*(w*bpp);colors=[]
    for y in range(h):
        start=y*(w*bpp+1);kind=raw[start];row=list(raw[start+1:start+1+w*bpp])
        for i in range(len(row)):
            a=row[i-bpp] if i>=bpp else 0;b=previous[i];c=previous[i-bpp] if i>=bpp else 0
            if kind==1:predict=a
            elif kind==2:predict=b
            elif kind==3:predict=(a+b)//2
            elif kind==4:
                p=a+b-c;pa,pb,pc=abs(p-a),abs(p-b),abs(p-c);predict=a if pa<=pb and pa<=pc else b if pb<=pc else c
            else:predict=0
            row[i]=(row[i]+predict)&255
        colors.extend(tuple(row[i:i+3]) for i in range(0,len(row),bpp));previous=row
    check('Exported pixels are grayscale and encode varying heights',all(r==g==b for r,g,b in colors) and len(set(colors))>30,{'distinctLevels':len(set(colors))})
    run('click','#reset');run('select','#preset','island');run('select','#mode','1');run('click','#zoomIn');changed=diag();check('The state differs before restoring JSON',changed['heightChecksum']!=saved['heightChecksum'])
    run('click','#exportBtn');run('click','#importJson');upload(statepath);restored=diag();check('JSON import restores exact terrain, water, sediment and clock',restored['heightChecksum']==saved['heightChecksum'] and restored['waterChecksum']==saved['waterChecksum'] and restored['sedimentChecksum']==saved['sedimentChecksum'] and restored['time']==saved['time'] and restored['paused']==saved['paused'],{'saved':saved,'restored':restored});check('JSON restores display settings, camera, brush and baseline',ev('window.strata.camera')==savedCamera and ev('window.strata.view')==savedView and ev('window.strata.tool')==state['controls']['tool'],{'camera':ev('window.strata.camera'),'view':ev('window.strata.view')});shot('json-restored.png')
    run('click','#step');check('Imported state continues with a real single step',diag()['steps']==saved['steps']+1 and diag()['time']>saved['time'])
    upload(statepath);frozen=diag();fixtures=root/'evidence/fixtures';fixtures.mkdir(exist_ok=True);bad=fixtures/'malformed.json';bad.write_text('{ this is not valid JSON }');upload(bad);check('Malformed JSON shows an error without changing the simulation',diag()['heightChecksum']==frozen['heightChecksum'] and ev("document.getElementById('toast').classList.contains('error')"),ev("document.getElementById('toast').textContent"));shot('invalid-json.png')
    badstate=json.loads(statepath.read_text());badstate['w'][0]=-1;bad=fixtures/'negative-water.json';bad.write_text(json.dumps(badstate));upload(bad);check('Negative water state is rejected atomically',diag()['heightChecksum']==frozen['heightChecksum'] and diag()['waterChecksum']==frozen['waterChecksum'],ev("document.getElementById('toast').textContent"))
    badstate=json.loads(statepath.read_text());badstate['controls']['radius']=99;bad=fixtures/'bad-controls.json';bad.write_text(json.dumps(badstate));upload(bad);check('Invalid control metadata is rejected before changing solver or camera',diag()['heightChecksum']==frozen['heightChecksum'] and ev('window.strata.camera')==savedCamera,ev("document.getElementById('toast').textContent"))
    # High DPI and real narrow-viewport controls.
    run('set','viewport','1280','800','2');run('wait',250);retina=diag();check('High-DPI rendering uses a larger backing buffer with a bounded pixel budget',retina['devicePixelRatio']==2 and retina['canvasSize'][0]>996 and retina['canvasSize'][0]*retina['canvasSize'][1]<=1800000*1.02,retina);shot('desktop-dpr2.png')
    run('set','viewport','390','844','1');run('click','#home');run('select','#mode','0');run('wait',250);shot('mobile-initial.png');check('Narrow viewport fits without horizontal page overflow',ev('document.documentElement.scrollWidth')==390 and ev('innerHeight')==844,diag())
    run('click','#openPanel');run('wait','--fn',"Math.abs(document.getElementById('sidebar').getBoundingClientRect().left)<1");check('Mobile controls open as an accessible panel',ev("document.getElementById('sidebar').classList.contains('open')") and ev("document.getElementById('openPanel').getAttribute('aria-expanded')")=='true');shot('mobile-controls.png')
    run('find','role','tab','click','--name','Terrain','--exact');run('fill','#seed','90210');run('scrollintoview','#regenerate');run('click','#regenerate');check('Mobile terrain generation works with keyboard input',diag()['seed']==90210 and diag()['time']==0,diag());run('click','#closePanel');run('wait','--fn',"document.getElementById('sidebar').getBoundingClientRect().right<=0");check('Mobile panel closes and returns the interactive scene',not ev("document.getElementById('sidebar').classList.contains('open')"))
    run('find','role','button','click','--name','Orbit camera','--exact');touch=native('touch',170,410,220,440);check('Native one-finger touch orbits the camera',touch['before']['camera']['theta']!=touch['after']['camera']['theta'],touch['after']['camera']);run('click','#home');pinch=native('pinch_continue',200,430);check('Native pinch zooms the camera',pinch['after']['camera']['distance']<pinch['before']['camera']['distance'],pinch['after']['camera']);check('Surviving touch continues orbit after a pinch',pinch['middle']['theta']!=pinch['after']['camera']['theta'] or pinch['middle']['phi']!=pinch['after']['camera']['phi'],{'middle':pinch['middle'],'after':pinch['after']['camera']});run('click','#home')
    run('find','role','button','click','--name','Add water','--exact');p=ev('window.strata.project(0,2)');touch=native('touch',round(p['x']),round(p['y']),round(p['x']+20),round(p['y']+15));check('Native touch brush adds water to the genuine heightfield',touch['after']['diagnostics']['water']>touch['before']['diagnostics']['water']+.01,touch['after']['diagnostics']);shot('mobile-water-brush.png')
    before=diag();pinch=native('pinch',195,430);check('A two-finger camera gesture does not inject water in an editing tool',abs(pinch['after']['diagnostics']['water']-before['water'])<.00001,{'before':before['water'],'after':pinch['after']['diagnostics']['water']});run('click','#home')
    run('select','#mode','2');shot('mobile-water-depth.png');run('click','#mobilePause');run('wait','--fn','window.strata.diagnostics().time > 1');run('click','#mobilePause');check('Mobile pause/resume drives and freezes the simulation',diag()['paused'] and diag()['time']>1,diag())
    run('click','#helpBtn');check('Mobile guide is usable and fits the viewport',not ev("document.getElementById('helpModal').hidden") and ev("document.querySelector('.modal').getBoundingClientRect().height")<844);shot('mobile-guide.png');run('click','#closeHelp')
    run('set','viewport','1280','800','1');run('click','#home');check('Returning to desktop preserves the simulation and WebGL',diag()['time']>1 and diag()['glError']==0,diag());shot('desktop-after-mobile.png')
    run('console');run('errors');run('network','requests')
    hold.stdin.close();hold.wait(timeout=10);log.write(hold.stdout.read()+hold.stderr.read());print('File and mobile workflow complete',flush=True)
except Exception as error:
    if 'hold' in globals():hold.stdin.close();hold.wait(timeout=10);log.write(hold.stdout.read()+hold.stderr.read())
    print('STOPPED '+str(error),flush=True);shot('files-mobile-failure.png');sys.exit(1)
