"""Real-browser regressions. All actions use the installed agent-browser CLI.
Read-only JS observes actual state and canvas pixels. No app state setters are used.
"""
import subprocess,json,pathlib,hashlib,time,sys
ROOT=pathlib.Path(__file__).resolve().parent
SESSION='selvedge'
DOWNLOAD_DIR=ROOT/'downloads'/('run-'+str(time.time_ns()))
DOWNLOAD_DIR.mkdir()
config_processes=[]
log=(ROOT/'logs/browser-commands.jsonl').open('a')
def ab(*args):
    args=tuple(round(a) if isinstance(a,float) else a for a in args)
    p=subprocess.run(['agent-browser','--session',SESSION,'--json',*map(str,args)],capture_output=True,text=True)
    log.write(json.dumps({'command':['agent-browser','--session',SESSION,'--json',*map(str,args)],'exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr})+'\n');log.flush()
    if p.returncode: raise AssertionError(p.stderr or p.stdout)
    data=json.loads(p.stdout)
    assert data.get('success'),data
    return data.get('data',{})
def ev(js):return ab('eval',js)['result']
def state():return ev('selvedge.getState()')
def diag():return ev('selvedge.diagnostics()')
def click(name):
    if name=='About this idea':return ab('click','#aboutBtn')
    return ab('find','role','button','click','--name',name,'--exact')
def select(label,value):return ab('select',{'Starting structure':'#pattern','Repeat':'#size','Yarn rhythm':'#rhythm','Flag over':'#threshold'}[label],value)
def shot(name):ab('screenshot',str(ROOT/'screenshots'/name))
def checksum():
    settle()
    return ev('(()=>{let h=2166136261;const c=document.getElementById("cloth"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=13)h=Math.imul(h^d[i],16777619);return h>>>0})()')
def settle():ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))')
def check(name,condition):
    assert condition,name
    print('PASS',name,flush=True)

def main():
    ab('open','file://'+str(ROOT.parent/'index.html'));ab('set','viewport',1280,800)
    ab('network','route','http*','--abort');ab('set','offline','on')
    config=subprocess.Popen(['node',str(ROOT/'cdp.mjs'),SESSION,'Browser.setDownloadBehavior',json.dumps({'behavior':'allow','downloadPath':str(DOWNLOAD_DIR),'eventsEnabled':True}),'--hold'],stdout=subprocess.PIPE,text=True)
    config_processes.append(config);assert config.stdout.readline().strip()=='{}'
    subprocess.run(['node',str(ROOT/'cdp.mjs'),SESSION,'Network.setCacheDisabled','{"cacheDisabled":true}'],check=True,capture_output=True)
    click('Reset');settle()
    baseline=state();before_hash=checksum()
    click('Row 2, column 3: weft over');ab('press','ArrowRight');ab('press','Space')
    edited=state();check('pointer + keyboard edit arbitrary adjacent crossings',edited['cells'][1][2:4]==[1,0] and diag()['undo']==2)
    check('actual canvas pixel content changes after edit',checksum()!=before_hash)
    click('Undo');check('undo reverses exactly the keyboard edit',state()['cells'][1][2:4]==[1,1])
    ab('press','Control+z');check('keyboard undo restores the initial project',state()==baseline)
    ab('press','Control+Shift+z');click('Redo');check('redo restores both real edits',state()==edited)
    click('Reverse');check('reverse uses the same project without changing crossings',state()==edited and diag()['view']['back'])
    reverse_hash=checksum();click('Front');check('two faces produce different rendered pixels',checksum()!=reverse_hash)
    # Inspect yarn pixels at crossing centers in two different repeats, not selection outlines.
    click('Reset');settle()
    def yarn_pixels(x,y):
        return ev(f"(()=>{{const c=document.getElementById('cloth'),g=selvedge.diagnostics().geometry,d=c.width/g.w,q=c.getContext('2d');return [0,8].map(offset=>Array.from(q.getImageData(Math.floor((g.ox+({x}+offset+.5)*g.c)*d),Math.floor((g.oy+({y}+.5)*g.c)*d),1,1).data))}})()")
    pale=yarn_pixels(4,2);check('unmodified crossing exposes pale horizontal yarn in repeated locations',all(p[0]-p[1]<45 for p in pale))
    click('Row 3, column 5: weft over');settle();rust=yarn_pixels(4,2)
    check('one crossing edit exposes the rust warp in two independent repeats',all(p[0]-p[1]>50 for p in rust))
    click('Reverse');settle();reverse_yarn=yarn_pixels(3,2)
    check('mirrored reverse exposes the complementary pale yarn at the same crossing',all(p[0]-p[1]<45 for p in reverse_yarn))
    # Real stroke on canvas, independent of the seeded repeat. Coordinates from live layout.
    click('Reset')
    g=diag()['geometry'];r=ev('document.getElementById("cloth").getBoundingClientRect().toJSON()')
    x=r['x']+g['ox']+g['c']*2.5;y=r['y']+g['oy']+g['c']*4.5
    ab('mouse','move',x,y);ab('mouse','down','left');ab('mouse','move',x+g['c']*3,y);ab('mouse','up','left')
    check('canvas drag paints all intervening crossings as one undo step',state()['cells'][4][2:6]==[1,1,1,1] and diag()['undo']==1)
    click('Undo');check('one Undo restores the complete drag',state()==baseline)
    # Drag exits the editing surface: releasing outside must terminate capture.
    ab('mouse','move',x,y);ab('mouse','down','left');ab('mouse','move',1250,120);ab('mouse','up','left')
    check('release outside the canvas ends the stroke',not diag()['strokeActive'])
    click('Undo');check('outside release remains undoable',state()==baseline)
    # Escape cancels the live stroke, before pointer up.
    ab('mouse','move',x,y);ab('mouse','down','left');check('live stroke changes real state before release',state()!=baseline)
    ab('press','Escape');ab('mouse','up','left');check('Escape cancels a partial stroke without a history entry',state()==baseline and diag()['undo']==0 and not diag()['strokeActive'])
    select('Starting structure','unbound');check('all warp boundary reports 16 unbound yarns',diag()['unbound']==16 and ev('document.getElementById("maxFloat").textContent')=='∞')
    click('Float lens');shot('desktop-unbound-lens.png')
    click('+ Bind one float');check('binding changes one crossing and shows matching 16 to 14 feedback',diag()['unbound']==14 and '16 → 14' in ev('document.getElementById("status").textContent'))
    # Repeat the repair; it can converge without a preset solution.
    for i in range(40):
        d=diag()
        if not d['unbound'] and not d['longFloats']:break
        click('+ Bind one float')
        if 'No single crossing' in ev('document.getElementById("status").textContent'):break
    check('repeat binding recovers an interlaced finite-float structure',diag()['unbound']==0)
    shot('desktop-repaired-lens.png')
    select('Starting structure','plain');check('plain weave reports float 1 and disables unnecessary binding',diag()['maxFloat']==1 and ev('document.getElementById("bindBtn").disabled'))
    select('Starting structure','twill');check('twill reports float 2',diag()['maxFloat']==2)
    click('Indigo and linen colorway');select('Yarn rhythm','alternating');select('Repeat','12')
    ab('find','label','Project name','fill','Indigo note 27');ab('press','Enter')
    click('Row 3, column 8: warp over' if state()['cells'][2][7] else 'Row 3, column 8: weft over')
    custom=state();check('custom name, yarn rhythm, 12-repeat and nonseed crossing are real state',custom['name']=='Indigo note 27' and custom['n']==12 and custom['rhythm']=='alternating' and custom['warp']=='#3d526c')
    rotated=[list(row) for row in zip(*custom['cells'][::-1])]
    click('↻ Rotate');check('Rotate computes the 90-degree matrix transform',state()['cells']==rotated)
    click('⇄ Invert');check('Invert complements every crossing',state()['cells']==[[1-v for v in row] for row in rotated])
    click('Undo');click('Undo');check('history restores authored matrix and project properties',state()==custom)
    click('Save');ab('snapshot','-i');ab('click','#downloadProject')
    saved=DOWNLOAD_DIR/'Indigo-note-27.selvedge.json'
    for _ in range(30):
        if saved.exists():break
        time.sleep(.1)
    check('user-initiated project download contains exact authored project',saved.exists() and json.loads(saved.read_text())['project']==custom)
    click('Save');ab('click','#downloadImage')
    png=DOWNLOAD_DIR/'Indigo-note-27-front.png'
    for _ in range(50):
        if png.exists():break
        time.sleep(.1)
    check('PNG download contains a real 1600 by 1200 image',png.exists() and png.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n' and int.from_bytes(png.read_bytes()[16:20],'big')==1600 and int.from_bytes(png.read_bytes()[20:24],'big')==1200)
    click('Reset');check('whole reset clears authored state, history and views',state()==baseline and diag()['undo']==0 and not diag()['view']['lens'] and not diag()['view']['back'])
    click('Open');ab('upload','#fileInput',saved);ab('wait','--fn','!selvedge.diagnostics().pendingImport')
    check('downloaded JSON restores through ordinary file input',state()==custom)
    click('Undo');check('valid import is a reversible transaction',state()==baseline)
    click('Redo');check('redo reinstates the imported project',state()==custom)
    bad=ROOT/'invalid-project.json';bad.write_text('{"format":"selvedge","version":1,"project":{"n":999}}')
    before=state();history_before=diag()['undo'];click('Open');ab('upload','#fileInput',bad);ab('wait','--fn','!selvedge.diagnostics().pendingImport')
    check('invalid imported schema preserves the exact project and history',state()==before and diag()['undo']==history_before and ev('document.getElementById("status").dataset.kind')=='error')
    check('import error is visible in the current viewport',ev('(()=>{const r=document.getElementById("status").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()'))
    shot('invalid-import-notice.png')
    bad.write_text('{broken JSON');click('Open');ab('upload','#fileInput',bad);ab('wait','--fn','!selvedge.diagnostics().pendingImport')
    check('malformed JSON preserves current cloth with useful feedback',state()==before and 'invalid JSON' in ev('document.getElementById("status").textContent'))
    huge=ROOT/'oversized-project.json';huge.write_text(' '*200001);click('Open');ab('upload','#fileInput',huge)
    check('oversized file is rejected without starting a reader',state()==before and not diag()['pendingImport'] and 'too large' in ev('document.getElementById("status").textContent'))
    click('Reset');ab('set','viewport',390,844);settle()
    check('390px layout has no horizontal document overflow',ev('document.documentElement.scrollWidth')==390)
    g=diag()['geometry'];r=ev('document.getElementById("cloth").getBoundingClientRect().toJSON()')
    x=r['x']+g['ox']+g['c']*4.5;y=r['y']+g['oy']+g['c']*2.5
    ab('mouse','move',x,y);ab('mouse','down','left');ab('mouse','up','left')
    check('narrow viewport canvas click updates the selected crossing',state()['cells'][2][4]==1 and diag()['undo']==1)
    click('Reverse');click('Float lens');shot('mobile-edited-reverse-lens.png')
    ab('scrollintoview','#grid');click('Row 4, column 6: weft over');ab('press','ArrowDown');ab('press','Space')
    check('narrow editor remains keyboard operable after scrolling',diag()['selected']=={'x':5,'y':4} and diag()['undo']==3)
    shot('mobile-editor.png')
    ab('scroll','up',1800);click('About this idea');check('about references have selectable titles and embedded URLs',ev('document.querySelectorAll("#aboutDialog .source .url").length')==4 and 'https://adacad.org/' in ev('document.getElementById("aboutDialog").innerText'))
    shot('mobile-about.png');ab('press','Escape');check('Escape closes about and restores page interaction',not ev('document.getElementById("aboutDialog").open'))
    click('Reset');ab('reload');check('reload returns to original memory-only project',state()==baseline and diag()['undo']==0)
    ab('set','viewport',1280,800);ab('snapshot','-i');shot('desktop-final.png')
    check('no uncaught errors reported',not ab('errors').get('errors'))
    print('FINAL DIAGNOSTICS',json.dumps(diag()),flush=True)
if __name__=='__main__':
    try:main()
    finally:
        for process in config_processes:process.terminate()
