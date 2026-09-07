import subprocess,json,time,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
log=open(root/'logs/browser-actions.txt','a',buffering=1)
def ab(*args):
    command=['agent-browser','--session','terra',*map(str,args)]
    log.write('$ '+__import__('shlex').join(command)+'\n')
    p=subprocess.run(command,capture_output=True,text=True)
    log.write(p.stdout+p.stderr+'\n')
    if p.returncode: raise RuntimeError(p.stderr or p.stdout)
    return p.stdout

def js(code):return json.loads(ab('eval',code))
def snap(name):ab('screenshot',root/'screenshots'/name)
def drag(points,seconds=.5):
    ab('mouse','move',*points[0]);ab('mouse','down','left')
    for pt in points[1:]:
        time.sleep(seconds/max(1,len(points)-1));ab('mouse','move',*pt)
    time.sleep(.2);ab('mouse','up','left')

if __name__=='__main__':
    records={}
    before=js('window.terra.diagnostics()')
    ab('find','role','button','click','--name','Add water')
    drag([(520,444),(540,443),(560,445),(575,448)],1.2)
    after=js('window.terra.diagnostics()');assert after['water']>before['water']+100
    assert after['time']==before['time'];records['add_water']={'before':before['water'],'after':after['water'],'time':after['time']};snap('08-water-brush-after.png')
    ab('find','role','button','click','--name','Raise terrain')
    before=js('window.terra.diagnostics()');drag([(433,428),(448,423),(465,419)],.9)
    after=js('window.terra.diagnostics()');assert after['terrain']>before['terrain']+10;records['raise']={'before':before['terrain'],'after':after['terrain']}
    ab('find','role','button','click','--name','Lower terrain')
    before=js('window.terra.diagnostics()');drag([(433,428),(448,423),(465,419)],.7)
    after=js('window.terra.diagnostics()');assert after['terrain']<before['terrain']-10;records['lower']={'before':before['terrain'],'after':after['terrain']}
    ab('find','role','button','click','--name','Add sediment')
    before=js('window.terra.diagnostics()');drag([(535,445),(551,448)],.7)
    after=js('window.terra.diagnostics()');assert after['sediment']>before['sediment']+10;records['sediment']={'before':before['sediment'],'after':after['sediment']}
    ab('find','role','button','click','--name','Dry area')
    before=js('window.terra.diagnostics()');drag([(520,444),(540,443),(560,445),(575,448)],.8)
    after=js('window.terra.diagnostics()');assert after['water']<before['water']-10;records['dry']={'before':before['water'],'after':after['water']}
    ab('find','role','button','click','--name','Orbit')
    before=js('window.terra.diagnostics()');drag([(600,400),(640,425),(678,444)],.4)
    after=js('window.terra.diagnostics()');assert after['camera']['yaw']!=before['camera']['yaw'];assert after['terrain']==before['terrain'];records['orbit']={'before':before['camera'],'after':after['camera']};snap('09-orbit-after.png')
    before=js('window.terra.diagnostics()');subprocess.run(['node',str(root/'tests/cdp.mjs'),'Input.dispatchMouseEvent',json.dumps({'type':'mouseWheel','x':550,'y':440,'deltaX':0,'deltaY':-150})],check=True,capture_output=True);time.sleep(.2);after=js('window.terra.diagnostics()');assert after['camera']['distance']<before['camera']['distance'];records['zoom']={'before':before['camera']['distance'],'after':after['camera']['distance']}
    ab('find','role','button','click','--name','Reset camera')
    before=js('window.terra.diagnostics()');ab('find','role','button','click','--name','Single step');after=js('window.terra.diagnostics()');assert abs(after['time']-before['time']-.08)<1e-8;assert after['steps']-before['steps']==4;assert after['paused'];records['single_step']={'before':before['time'],'after':after['time']}
    snap('10-editing-complete.png')
    (root/'logs/interaction-results.json').write_text(json.dumps(records,indent=2));print(json.dumps(records,indent=2))
