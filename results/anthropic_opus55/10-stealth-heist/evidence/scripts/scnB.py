import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from player import *
ab('open','http://127.0.0.1:8765/index.html?v=14'); ab('set','viewport','1280','800'); time.sleep(1)
ab('find','role','button','click','--name','▶ BEGIN INFILTRATION'); time.sleep(0.4)
ab('click','#diagBtn')
for k in ['sound','lkp','guards','nav']: ab('check',f'#diagPanel input[data-diag="{k}"]')
G2=lambda s:s['guards'][1]
trans=[]; prev=[None]
def track(s):
    st=G2(s)['state']
    if st!=prev[0]: trans.append(f"{prev[0]}->{st}@{s['time']}(aw{G2(s)['aw']})"); prev[0]=st
click(10.3,18.35); wait_until(lambda s: dist((s['player']['x'],s['player']['y']),(10.3,18.35))<0.2, 12, danger=False)
r,s=wait_until(lambda s: G2(s)['state']=='IDLE' and G2(s)['y']>16.5, 150, danger=False); log('G2 idling in Lounge B: '+r)
ab('press','e'); time.sleep(0.45); log('opened door (9,17) from behind the frame')
AWAY="(()=>{const g=GHOSTLINE.sim.guards[1];const a=Math.atan2(17.45-g.y,10.45-g.x);return g.state==='IDLE'&&Math.abs(angDiff(g.facing,a))>1.3;})()"
t0=time.time()
while time.time()-t0<20 and ev(AWAY) is not True: time.sleep(0.03)
ab('keydown','w'); time.sleep(0.32); ab('keyup','w'); log('stepped in front of the doorway while G2 faces away')
# hold right mouse to aim (preview), release to throw the noisemaker through the doorway
sx,sy=w2s(4.3,16.4); ab('mouse','move',str(sx),str(sy)); ab('mouse','down','right'); time.sleep(0.12); shot('18-noise-aim-preview.png'); ab('mouse','up','right')
log('noisemaker thrown (hold/release right mouse) toward (4.2,15.8)')
ab('keydown','s'); time.sleep(0.35); ab('keydown','d'); time.sleep(0.25); ab('keyup','s'); ab('keyup','d')
got=False; t0=time.time()
while time.time()-t0<30:
    s=snap(); track(s)
    if s['outcome']: break
    g=G2(s)
    if g['state']=='INVESTIGATE' and not got:
        time.sleep(0.25); got=True; shot('19-noise-investigate.png')
        inv=ev("JSON.stringify({inv:GHOSTLINE.sim.guards[1].invPos,reason:GHOSTLINE.sim.guards[1].invReason,heard:GHOSTLINE.sim.guards[1].heard,land:GHOSTLINE.sim.sounds.filter(x=>x.kind==='clatter').map(x=>({x:x.x,y:x.y,r:x.r,heard:x.heard}))})")
        log('INVESTIGATE target: '+json.dumps(inv))
    if got and g['state'] in ('RETURN','PATROL','IDLE'): break
    time.sleep(0.05)
time.sleep(0.3); shot('20-noise-return.png')
log('G2 transitions: '+'  '.join(trans))
print('RESULT', json.dumps(trans), json.dumps(snap()['outcome']))
