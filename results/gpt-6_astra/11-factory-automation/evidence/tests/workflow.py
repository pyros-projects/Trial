#!/usr/bin/env python3
"""Real-browser checks via installed agent-browser; live diagnostics are read-only."""
import json, subprocess, pathlib, time, shlex, sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
E=ROOT/'evidence'
LOG=E/'logs'/'workflow-commands.log'
SESSION='forge'
def ab(*args):
    command=['agent-browser','--session',SESSION,*map(str,args)]
    start=time.monotonic()
    p=subprocess.run(command,text=True,capture_output=True,timeout=45)
    with LOG.open('a') as f:
        f.write('$ '+shlex.join(command)+'\n'+p.stdout+p.stderr+'\n')
    if p.returncode: raise RuntimeError(p.stdout+p.stderr)
    return p.stdout.strip()
def ev(js): return json.loads(ab('eval',js))
def diag(): return ev('Forge.diagnostics()')
def state(): return json.loads(ev('JSON.stringify(Forge.exportState())'))
def button(name): return ab('find','role','button','click','--name',name)
def shot(name): return ab('screenshot',str(E/'screenshots'/name))
def pause():
    if not diag()['paused']:button('Pause simulation')
def resume():
    if diag()['paused']:button('Resume simulation')
def wait_for(js): return ab('wait','--fn',js)
def dump(name,obj): (E/'logs'/name).write_text(json.dumps(obj,indent=2))
def point(x,y):
    d=diag();r=ev("(()=>{const r=document.querySelector('#world').getBoundingClientRect();return {x:r.x,y:r.y};})()")
    return round(r['x']+d['camera']['x']+(x+.5)*32*d['camera']['z']),round(r['y']+d['camera']['y']+(y+.5)*32*d['camera']['z'])
def clickcell(x,y):
    px,py=point(x,y);ab('mouse','move',px,py);ab('mouse','down','left');ab('mouse','up','left')
def dragcells(coords):
    px,py=point(*coords[0]);ab('mouse','move',px,py);ab('mouse','down','left')
    for x,y in coords[1:]:
        px,py=point(x,y);ab('mouse','move',px,py)
    ab('mouse','up','left')
def structure(x,y):return next((s for s in diag()['structures'] if s['x']==x and s['y']==y),None)
def loadpreset(name):button('Choose factory preset');ab('snapshot','-i');button('Load '+name+' preset')
def result(name,details):
    print('PASS',name,details,flush=True)
    with (E/'logs'/'workflow-results.jsonl').open('a') as f:f.write(json.dumps({'check':name,'status':'pass','details':details})+'\n')

def core():
    loadpreset('Balanced factory');button('Simulation speed 4x')
    wait_for('(Forge.diagnostics().delivered.circuit || 0) >= 10')
    d=diag();assert d['power'][0]['supply']>0 and d['power'][0]['demand']>0
    assert d['consumed']['wire']==2*d['produced']['circuit']
    assert d['consumed']['plate']==2*d['produced']['gear']
    assert structure(11,6)['passed']>0 and structure(10,9)['inventory'].get('plate',0)>0
    assert structure(17,9)['passed']>0
    result('Multistage chain and junctions',{'delivered':d['delivered'],'produced':d['produced'],'power':d['power'],'splitStorage':structure(10,9)['inventory']})
    pause();first=state();time.sleep(.5);assert first==state(),'Paused state changed'
    button('Single step');second=state();assert second['tick']==first['tick']+1
    assert abs(second['time']-first['time']-1/30)<1e-8
    result('Pause and single-step',{'before':first['tick'],'after':second['tick'],'delta':second['time']-first['time']})
    ab('set','viewport',1280,800);button('Fit factory in view');shot('04-fixed-desktop-1280.png')
    d=diag();box=ev("(()=>{const r=document.querySelector('#world').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()")
    for s in d['structures']:
        n=1 if s['type'] in ['belt','splitter','merger','loader','pole'] else 2
        assert d['camera']['x']+s['x']*32*d['camera']['z']>=0
        assert d['camera']['y']+(s['y']+n)*32*d['camera']['z']<=box['height']
    result('Desktop fit after resize',d['camera'])
    # Remove an actual circuit delivery belt to create backpressure.
    before=len(diag()['structures']);button('Demolish area (X)');clickcell(22,9)
    assert structure(22,9) is None and len(diag()['structures'])==before-1
    resume();wait_for("Forge.diagnostics().structures.find(s=>s.x===19&&s.y===8).status==='blocked'")
    wait_for('Forge.diagnostics().deliveryRate===0')
    pause();d=diag();dump('deliberate-bottleneck.json',d);shot('05-deliberate-backpressure.png')
    assert structure(19,8)['queue']>=8
    result('Deletion and backpressure',{'queue':structure(19,8)['queue'],'deliveryRate':d['deliveryRate'],'blocked':d['bottlenecks']})
    # Restore the connection with the construction tool, then rotate with keyboard.
    button('Build Conveyor belt');clickcell(22,9);assert structure(22,9)['type']=='belt'
    button('Select (V)');clickcell(22,9);ab('press','r');assert structure(22,9)['dir']==1
    ab('press','r');ab('press','r');ab('press','r');assert structure(22,9)['dir']==0
    shot('06-belt-inspector-rotation.png')
    result('Build and keyboard rotation',structure(22,9))
    # A continuous drag includes corners and is one undoable edit.
    button('Build Conveyor belt');dragcells([(12,17),(16,17),(16,19)])
    assert structure(15,17)['dir']==0 and structure(16,17)['dir']==1
    assert structure(16,18)['dir']==1 and structure(16,19)
    count=len(diag()['structures']);button('Undo edit');assert structure(12,17) is None
    button('Redo edit');assert len(diag()['structures'])==count
    shot('07-belt-drag-corner.png')
    result('Continuous belt drawing, corners, undo/redo',{'newStructureCount':count})
    # Eyedropper + move preserve configuration; area demolish handles the whole route.
    button('Eyedropper (Q)');clickcell(16,18);clickcell(14,19);assert structure(14,19)['dir']==1
    button('Move structure (M)');clickcell(14,19);clickcell(13,19)
    assert structure(14,19) is None and structure(13,19)['dir']==1
    button('Demolish area (X)');dragcells([(12,17),(16,19)])
    assert structure(12,17) is None and structure(13,19) is None and structure(16,19) is None
    result('Eyedropper, move and multi-delete','Copied direction preserved; all new area structures deleted')
    # Upgrade changes actual machine level, speed and demand.
    button('Select (V)');clickcell(13,5);old=structure(13,5);ab('click','#upgrade-btn')
    assert structure(13,5)['level']==old['level']+1
    prior=diag()['delivered'].get('circuit',0);resume()
    wait_for(f"(Forge.diagnostics().delivered.circuit || 0) >= {prior+6}")
    pause();d=diag();dump('core-repaired-chain.json',d)
    result('Repaired chain and upgrade',{'level':structure(13,5)['level'],'delivered':d['delivered'],'circuitInventory':structure(19,8)['inventory']})
    button('Close structure inspector')
    # A save/load is byte-for-byte equivalent while paused.
    button('Save factory');ab('find','label','Save slot name','fill','Validation shift');button('Save slot')
    expected=state();dump('exact-save-before.json',expected)
    button('Close dialog');button('Single step');assert state()['tick']==expected['tick']+1
    button('Save factory');ab('snapshot','-i');button('Load slot Validation shift')
    actual=state();dump('exact-save-after.json',actual);assert actual==expected,'Save/load changed factory state'
    result('Exact named-slot round trip',{'tick':actual['tick'],'structures':len(actual['structures'])})
    button('Save factory');ab('fill','#import-text','{"version":1,"structures":[]}');button('Import text')
    error=ab('get','text','#import-error');assert error and state()==expected
    shot('08-invalid-import.png');result('Invalid import is rejected atomically',error)
    ab('download','#download-json',str(E/'factory-export.json'));ab('download','#export-png',str(E/'factory-export.png'))
    assert json.loads((E/'factory-export.json').read_text())==expected
    assert (E/'factory-export.png').read_bytes()[:8]==b'\x89PNG\r\n\x1a\n'
    button('Create share code');wait_for("document.querySelector('#import-text').value.startsWith('FG')")
    code=ab('get','value','#import-text');(E/'share-code.txt').write_text(code)
    button('Import text');wait_for('!document.querySelector(".modal")');assert state()==expected
    result('JSON/PNG export and compressed share import',{'jsonBytes':(E/'factory-export.json').stat().st_size,'pngBytes':(E/'factory-export.png').stat().st_size,'shareCharacters':len(code)})
    # Gesture-created audio; no claim that an automated session heard it.
    
    if not diag()['audio']['enabled']:button('Enable sound')
    d=diag();assert d['audio']['enabled'] and d['audio']['state']=='running'
    result('Procedural audio user gesture',d['audio'])
    button('Statistics');ab('snapshot','-i');shot('09-live-analytics.png');button('Close dialog')
    ab('errors');ab('console');dump('core-final.json',diag())
    result('Core browser console',diag()['errors'])

if __name__=='__main__':
    try: globals()[sys.argv[1] if len(sys.argv)>1 else 'core']()
    except Exception as e:
        print('FAIL',str(e),flush=True)
        shot('failure-'+(sys.argv[1] if len(sys.argv)>1 else 'core')+'.png')
        dump('failure-diagnostics.json',diag())
        raise
