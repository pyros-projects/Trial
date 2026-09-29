import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from player import *
ab('open','http://127.0.0.1:8765/index.html?v=8'); ab('set','viewport','1280','800'); time.sleep(1)
ab('find','role','button','click','--name','▶ BEGIN INFILTRATION'); time.sleep(0.4)
log('mission started (Quiet Hours, Operative)')
G1=lambda s:s['guards'][0]; G2=lambda s:s['guards'][1]
def go(x,y,label,safe=None,arrive=0.6,timeout=45,run=False,danger=True):
    for attempt in range(8):
        if run: ab('keydown','Shift')
        click(x,y)
        if run: ab('keyup','Shift')
        r,s=wait_until(lambda s: dist((s['player']['x'],s['player']['y']),(x,y))<arrive, timeout, danger=danger)
        if r=='ok': log('arrived '+label); return True
        if r=='outcome': log('OUTCOME '+json.dumps(s['outcome'])); return False
        if r=='timeout': log('timeout '+label); return False
        g=max(s['guards'],key=lambda g:g['aw']); log(f'DANGER on way to {label}: {g["id"]} {g["state"]} aw={g["aw"]}')
        shot(f'danger-{label.replace(" ","_")}-{attempt}.png')
        if safe:
            ab('keydown','Shift'); click(*safe); ab('keyup','Shift'); log('retreating (run) to '+str(safe))
        r2,s2=wait_until(lambda s: all(g['aw']<0.05 and g['state']!='CHASE' for g in s['guards']), 25, danger=False)
        log('danger over: '+r2)
        if s2['outcome']: log('OUTCOME '+json.dumps(s2['outcome'])); return False
    return False
def done(ok):
    s=snap(); log('FINAL ok=%s outcome=%s stats=%s'%(ok,json.dumps(s['outcome']),json.dumps(s['stats']))); sys.exit(0)
# Phase A: shadow G2 north, take the keycard
r,s=wait_until(lambda s: G2(s)['y']>14.5, 120, danger=False); log('G2 in Lounge B: '+r)
r,s=wait_until(lambda s: G2(s)['y']<7.2 and G2(s)['x']>9.4, 120, danger=False); log('G2 through Office B heading north: '+r)
if not go(17.5,8.5,'keycard',safe=(11.5,19.5),arrive=0.7): done(False)
ab('press','e'); time.sleep(0.15); log('pressed E (keycard)'); shot('07-keycard-taken.png')
if not go(18.3,9.5,'Office B east door',arrive=0.5): done(False)
# Phase B: G1 finishes Server->Office leg, then cross to the vault
r,s=wait_until(lambda s: G1(s)['x']<19.2 and G1(s)['y']<5, 150); log('G1 reached the Office: '+r)
if r!='ok': done(False)
if not go(31.5,11.4,'vault door',safe=(17.5,9.5),arrive=0.45): done(False)
ab('press','3'); time.sleep(0.1); ab('keydown','f'); time.sleep(0.15); ab('keyup','f'); time.sleep(0.25); log('EMP used at vault door'); shot('08-emp-vault.png')
ab('press','e'); time.sleep(0.45); log('pressed E (vault door, keycard)')
if not go(30.5,15.3,'objective',arrive=0.5): done(False)
ab('keydown','e'); r,s=wait_until(lambda s: s['player']['hasObj'], 6, danger=False); ab('keyup','e'); log('grab objective: '+r); shot('09-objective-taken.png')
# Phase D: hide in Office D, let G1 pass, trail it north, slip into the Garage
if not go(25.5,15.5,'Office D hideout',arrive=0.6): done(False)
r,s=wait_until(lambda s: G1(s)['x']>28.5 and 6.5<G1(s)['y']<10.5, 120); log('G1 at the Server Room: '+r)
r,s=wait_until(lambda s: G1(s)['x']<21.8 and G1(s)['y']<6.5, 120); log('G1 heading north in corridor: '+r)
shot('10-trailing-g1.png')
ok=go(31.9,2.0,'extraction',safe=(31.9,2.0),arrive=0.3,timeout=40)
if not ok:
    s=snap()
    if not s['outcome']:
        log('carrying the objective: sprinting for extraction'); ab('keydown','Shift'); click(31.9,2.0); r,s=wait_until(lambda s: s['outcome'] is not None, 20, danger=False); ab('keyup','Shift'); ok = bool(s['outcome'] and s['outcome']['type']=='win')
time.sleep(2.0); shot('11-debrief.png'); done(ok)
