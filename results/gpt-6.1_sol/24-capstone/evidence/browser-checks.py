"""Agent-authored real-browser checks using the installed agent-browser CLI.
No runtime dependencies of index.html. Actions use labeled controls and real input.
Read-only evals inspect the actual byte model and rendered controls; the two
explicit interruption probes dispatch standard cancellation / delayed-file events.
"""
import json, subprocess, pathlib, datetime, struct, re

ROOT=pathlib.Path(__file__).resolve().parent.parent
EVIDENCE=ROOT/'evidence'
SESSION='afterimage'
LOG=EVIDENCE/'logs'/'browser-workflows.jsonl'
RESULTS=[]

def run(*args, stdin=None):
    cmd=['agent-browser','--session',SESSION,*map(str,args)]
    result=subprocess.run(cmd,input=stdin,text=True,capture_output=True,cwd=ROOT,timeout=40)
    with LOG.open('a') as f:
        f.write(json.dumps({'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':cmd,'stdin':stdin,'exit':result.returncode,'stdout':result.stdout,'stderr':result.stderr})+'\n')
    if result.returncode: raise RuntimeError(f'{cmd}: {result.stderr} {result.stdout}')
    return result.stdout

def js(expression): return json.loads(run('eval','--stdin',stdin=expression))
def diag(): return js('Afterimage.diagnostics()')
def click(name,role='button'): run('find','role',role,'click','--name',name)
def select(label,value):
    # The CLI's find-label subactions do not include select; use a fresh labeled ref.
    snapshot=run('snapshot','-i')
    match=re.search(r'combobox "'+re.escape(label)+r'"[^\n]*ref=(e\d+)',snapshot)
    if not match: raise AssertionError('No labeled combobox: '+label)
    run('select','@'+match.group(1),value)
def shot(name,full=False): run('screenshot',*(['--full'] if full else []),EVIDENCE/'screenshots'/name)
def check(condition, message):
    if not condition: raise AssertionError(message)
def result(name, details):
    RESULTS.append({'check':name,'status':'pass','observed':details})
    (EVIDENCE/'logs'/'workflow-results.json').write_text(json.dumps(RESULTS,indent=2))
    print('PASS',name,details,flush=True)
def same_project(a,b):
    return all(a[key]==b[key] for key in ['title','parity','layout','pixels','received','decoded'])
def surface_point(r,c):
    rect=js("(() => {const r=document.getElementById('surface').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cols:Afterimage.diagnostics().mode==='draw'?24:24+Afterimage.diagnostics().parity};})()")
    # The installed CLI accepts integer mouse coordinates (decimal strings fail).
    return (round(rect['x']+(c+.5)/rect['cols']*rect['w']),round(rect['y']+(r+.5)/24*rect['h']))
def drag(cells):
    x,y=surface_point(*cells[0]);run('mouse','move',x,y);run('mouse','down','left')
    for r,c in cells[1:]: run('mouse','move',*surface_point(r,c))
    run('mouse','up','left')

def main():
    LOG.parent.mkdir(exist_ok=True);(EVIDENCE/'fixtures').mkdir(exist_ok=True)
    run('set','offline','on');run('set','viewport',1280,800)
    run('open','file://'+str(ROOT/'index.html'));run('snapshot','-i')
    initial=diag();check(initial['erased']==0 and initial['history']==0,'Initial state must be intact')

    # Novel authored data, not any built-in example.
    click('01Make a memory','tab');run('find','label','Word to inscribe','fill','ECHO');click('Inscribe')
    echo=diag();check(echo['title']=='ECHO' and echo['pixels']!=initial['pixels'],'Actual word must change payload')
    click('Forest ink');drag([(21,3),(21,9),(22,12)])
    painted=diag();changed=sum(a!=b for a,b in zip(echo['pixels'],painted['pixels']))
    check(changed>=9 and painted['history']==echo['history']+1,'Continuous paint stroke must be a single transaction')
    click('Undo');check(diag()['pixels']==echo['pixels'],'Undo must restore authored word')
    click('Redo');check(diag()['pixels']==painted['pixels'],'Redo must restore custom paint')
    shot('04-authored-memory.png')
    result('novel authored memory and drawing undo/redo',{'word':'ECHO','custom_changed_pixels':changed,'stroke_transactions':1})

    # Invalid authored text is a recoverable error with unchanged payload.
    run('find','label','Word to inscribe','fill','💥');before=diag();click('Inscribe')
    check(diag()['pixels']==before['pixels'],'Invalid inscription must preserve source')
    check('Use 1–8' in run('get','text','#notice'),'Must explain valid input')
    result('invalid inscription',{'input':'💥','drawing_preserved':True})

    click('02Let it weather','tab');click('Rain');rain=diag()
    check(rain['erased']==77,'10 percent rain must really erase bytes')
    click('Recover memory');recovered=diag()
    # Scattered rain is not a guarantee: inspect the real per-band budget.
    expected=[]
    for i,pixel in enumerate(painted['pixels']):
        band=i//24; survivors=rain['received'][band*32:(band+1)*32]
        expected.append(pixel if survivors.count(None)<=8 else survivors[i%24])
    check(recovered['decoded']==expected,'Rain must decode every eligible band and leave underdetermined bytes unknown')
    click('Undo');check(diag()['decoded'] is None and diag()['received']==rain['received'],'Undo recovery must return received state')
    click('Undo');check(diag()['erased']==0 and diag()['pixels']==painted['pixels'],'Undo rain must retain authored input')
    click('Redo');check(diag()['received']==rain['received'],'Redo rain must restore identical losses')
    click('Redo');check(diag()['decoded']==recovered['decoded'],'Redo recovery must re-compute the same result')
    # Increase the budget through the visible select, then run a fresh rain trial.
    select('Recovery pieces per band','12');click('Rain');resilient_loss=diag();click('Recover memory');resilient=diag()
    check(all(b['missing']<=12 for b in resilient_loss['bands']) and resilient['decoded']==painted['pixels'],'A sufficiently protected novel image must recover exactly')
    result('novel payload rain loss, partial recovery, history and resilient recovery',{'erased':rain['erased'],'max_band_loss':max(b['missing'] for b in rain['bands']),'balanced_unknown':recovered['unknown'],'resilient_erased':resilient_loss['erased'],'resilient_exact':True})

    # Real keyboard input on the non-DOM canvas state, then inspector without damage.
    select('Recovery pieces per band','8');click('Re-store drawing');select('Scratch width','1');run('focus','#surface')
    run('press','ArrowLeft');run('press','ArrowUp');run('press','Space')
    keyboard=diag();check(keyboard['erased']==1,'Keyboard Space must erase the focused tile')
    click('Recover memory');check(diag()['matchesOriginal'] is True,'Single keyboard erasure must recover')
    click('Inspect');run('hover','#surface');run('focus','#surface');run('press','ArrowRight');run('press','Space')
    check(diag()['erased']==1,'Inspector must never erase')
    check('Band ' in run('get','text','#bandInfo'),'Inspector must explain real selected band')
    result('keyboard erasure and inspect',{'erased':1,'exact_recovery':True,'inspection_non_destructive':True})

    # Same physical fold; identical authored input, different storage distribution.
    click('Rows');rows_source=diag()['pixels'];click('Fold');row_loss=diag();click('Recover memory');row_result=diag()
    check(row_loss['erased']==128 and sum(b['recoverable'] for b in row_loss['bands'])==20,'Rows must lose four entire bands')
    check(row_result['unknown']==96 and row_result['matchesOriginal'] is False,'Rows must show 96 unknown pixels honestly')
    check(all(v is None or v==row_result['pixels'][i] for i,v in enumerate(row_result['decoded'])),'Surviving pixels must stay correct')
    shot('05-rows-fold-partial.png',True)
    click('Woven');check(diag()['erased']==0 and diag()['pixels']==rows_source,'Rearrangement must re-store the same payload')
    click('Fold');woven_loss=diag();click('Recover memory');woven_result=diag()
    check(woven_loss['erased']==128 and max(b['missing'] for b in woven_loss['bands'])==6,'Woven must distribute same loss')
    check(woven_result['matchesOriginal'] is True and woven_result['unknown']==0,'Woven fold must recover')
    shot('06-woven-fold-recovered.png',True)
    result('four-row fold comparison',{'same_loss_tiles':128,'rows_recoverable_bands':20,'rows_unknown':96,'woven_recoverable_bands':24,'woven_unknown':0})

    # Configuration boundaries and a large loss, through visible controls.
    select('Recovery pieces per band','4');click('Fold');click('Recover memory');low=diag()
    check(sum(b['recoverable'] for b in low['bands'])==8 and low['unknown']==80,'Four extra pieces cannot fix five missing in one band')
    select('Recovery pieces per band','12');run('focus','#foldWidth');run('press','End');click('Fold');click('Recover memory');large=diag()
    check(sum(b['recoverable'] for b in large['bands'])==0 and large['unknown']==432,'Large fold must remain unresolved')
    click('Re-store drawing');check(diag()['erased']==0 and diag()['pixels']==rows_source,'Re-store must clear only damage')
    run('focus','#foldWidth');run('press','Home')
    for _ in range(3):run('press','ArrowRight')
    select('Recovery pieces per band','8');click('Fold');click('Recover memory')
    result('recovery budget boundaries and recovery from excess loss',{'p4_fold_unknown':80,'p12_sixteen_row_fold_unknown':432,'restored_drawing_retained':True})

    # Actual user-initiated downloads and file input imports.
    saved=diag();project=EVIDENCE/'afterimage-roundtrip.json';run('download','#saveProject',project)
    parsed=json.loads(project.read_text());check(parsed['memory']['pixels']==saved['pixels'] and len(parsed['erased'])==128,'Downloaded project must contain real state')
    png=EVIDENCE/'afterimage-output.png';run('download','#pngButton',png)
    data=png.read_bytes();check(data[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',data[16:24])==(576,576),'Actual PNG must have the documented dimensions')
    click('Reset session');reset=diag();check(reset['title']=='Night visitor' and reset['history']==0 and reset['erased']==0,'Whole-session Reset must clear all changes')
    run('upload','#projectFile',project);run('wait','--text','Project restored.');restored=diag()
    check(same_project(saved,restored),'Round-trip project must restore source, choices, damage and recovered data')
    click('Undo');check(diag()['pixels']==initial['pixels'] and diag()['erased']==0,'Undo import must restore previous experiment')
    click('Redo');check(same_project(saved,diag()),'Redo import must restore project')
    result('JSON and PNG downloads and round-trip restore',{'project_bytes':project.stat().st_size,'png_dimensions':[576,576],'restored_erased':restored['erased'],'import_undo_redo':True})

    fixtures=[('invalid-json.json','{ broken json'),('invalid-pixels.json',json.dumps({**parsed,'memory':{**parsed['memory'],'pixels':[7]}})),('duplicate-erasure.json',json.dumps({**parsed,'erased':[1,1]})),('oversized.json',' '*65537)]
    for name,content in fixtures:
        fixture=EVIDENCE/'fixtures'/name;fixture.write_text(content);before=diag();run('upload','#projectFile',fixture)
        run('wait','--text','Could not open project:');check(same_project(before,diag()),f'{name} must preserve current project')
    shot('07-import-error-preserves-project.png',True)
    result('four invalid file cases',{'cases':[n for n,_ in fixtures],'current_project_preserved':True})

    # Artificially delay only the browser's file-read API to expose the pending-read race.
    js("window.__originalFileText=File.prototype.text;window.__fileReadFinished=false;File.prototype.text=function(){return window.__originalFileText.call(this).then(v=>new Promise(resolve=>setTimeout(()=>{window.__fileReadFinished=true;resolve(v);},1200)));};true")
    run('upload','#projectFile',project);click('Reset session');run('wait','--fn','window.__fileReadFinished === true')
    d=diag();check(d['pixels']==initial['pixels'] and d['erased']==0 and d['history']==0,'A stale read after Reset must never restore old state')
    js('File.prototype.text=window.__originalFileText;true')
    result('Reset invalidates pending import',{'file_read_delayed_ms':1200,'reset_survived_late_completion':True})

    # Focus loss via real Tab while a pointer is held. Then explicit pointercancel.
    click('Scratch');select('Scratch width','3');x,y=surface_point(8,10)
    run('mouse','move',x,y);run('mouse','down','left');check(diag()['activeStroke'] is True,'Must start actual pointer stroke')
    run('press','Tab');after_blur=diag();check(after_blur['activeStroke'] is False and after_blur['history']==1,'Blur must finish stroke as one transaction')
    run('mouse','move',*surface_point(18,20));run('mouse','up','left');check(diag()['erased']==after_blur['erased'],'Mouse move after focus loss must not continue painting')
    click('Re-store drawing');run('mouse','move',*surface_point(5,7));run('mouse','down','left');check(diag()['activeStroke'] is True,'Pointer must be down before cancellation')
    js("document.getElementById('surface').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}));true")
    canceled=diag();check(canceled['activeStroke'] is False,'Pointer cancellation must finish the stroke')
    run('mouse','move',*surface_point(19,27));run('mouse','up','left');check(diag()['erased']==canceled['erased'],'Canceled pointer must not continue erasing')
    result('focus loss and pointer cancellation',{'blur':'real Tab key during held mouse','cancel':'standard synthetic pointercancel after real pointerdown','no_stuck_stroke':True})

    # About remains local with selectable complete citations, and Escape closes it.
    click('About this idea');run('snapshot','-i');text=run('get','text','#aboutDialog')
    for url in ['https://www.backblaze.com/blog/reed-solomon/','https://sigh.github.io/reed-solomon/','https://www.itu.int/ITU-T/studygroups/com15/otn/OTNtutorial.pdf']:check(url in text,'Embedded references must contain full selectable URLs')
    shot('08-about-sources.png');run('press','Escape');check(not js("document.getElementById('aboutDialog').open"),'Escape must close modal')
    result('About, sources and modal navigation',{'complete_selectable_urls':3,'escape_closes':True})

    # Narrow workflow with real controls and input; no horizontal overflow.
    click('Reset session');run('set','viewport',390,844);run('scroll','up',2000);shot('09-narrow-initial.png');shot('10-narrow-full.png',True)
    check(js('document.documentElement.scrollWidth <= innerWidth'),'Narrow viewport must not overflow horizontally')
    run('scrollintoview','#surface');drag([(7,8),(10,14),(13,19)]);narrow_loss=diag();click('Recover memory');narrow_result=diag()
    check(narrow_loss['erased']>0 and narrow_result['matchesOriginal'] is True,'Narrow pointer/recovery flow must work')
    shot('11-narrow-recovered.png',True)
    click('01Make a memory','tab');run('find','label','Word to inscribe','fill','BEAM');run('press','Enter');check(diag()['title']=='BEAM','Narrow inscription via Enter must work')
    run('scrollintoview','#surface');click('Lake ink');drag([(20,4),(21,9)]);narrow_source=diag()['pixels'];click('02Let it weather','tab');click('Rows');click('Fold');click('Recover memory');check(diag()['unknown']==96,'Narrow Rows failure path must work')
    click('Woven');click('Fold');click('Recover memory');check(diag()['decoded']==narrow_source,'Narrow woven recovery must match custom source')
    shot('12-narrow-custom-recovery.png',True)
    result('390×844 main and second workflow',{'no_horizontal_overflow':True,'pointer_scratch_tiles':narrow_loss['erased'],'new_word':'BEAM','rows_unknown':96,'woven_unknown':0})

    # Reload returns to original in memory, then high-DPI render/interaction.
    run('reload');d=diag();check(d['pixels']==initial['pixels'] and d['history']==0 and d['erased']==0,'Reload must clear session')
    run('set','viewport',1280,800,2);click('Fold');click('Recover memory');check(diag()['matchesOriginal'] is True,'2× high-DPI rendering must preserve interaction')
    shot('13-retina-recovered.png');run('set','viewport',1280,800,1)
    result('reload and high-DPI',{'reload_returns_initial':True,'device_scale':2,'exact_recovery':True})

    errors=run('errors');console=run('console');network=run('network','requests')
    check(not errors.strip(),'There must be no uncaught browser errors')
    check(not console.strip(),'There must be no console errors/warnings')
    check('http://' not in network and 'https://' not in network,'Direct-file offline workflow must not request external resources')
    result('offline direct file diagnostics',{'uncaught_errors':0,'console_output':console,'network':'local file document only'})

if __name__=='__main__':
    try: main()
    except Exception as e:
        RESULTS.append({'check':'interrupted workflow','status':'fail','observed':str(e)})
        (EVIDENCE/'logs'/'workflow-results.json').write_text(json.dumps(RESULTS,indent=2))
        print('FAIL',str(e),flush=True)
        raise
