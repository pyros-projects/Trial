import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from player import *
ab('open','http://127.0.0.1:8765/index.html?v=32'); ab('set','viewport','1280','800'); time.sleep(1)
ab('click','.preset[data-id="quiet-hours"]'); time.sleep(0.3); ab('click','#diffSeg button[data-k="rookie"]'); time.sleep(0.5)
ab('find','role','button','click','--name','▶ BEGIN INFILTRATION'); time.sleep(0.5)
G=lambda s:s['guards'][0]
avg="(()=>{const s=GHOSTLINE.sim;let a=0;for(const v of s.lm)a+=v;return +(a/s.lm.length).toFixed(3)})()"
# 1) camera loop terminal (Security Office) - far from the guard
click(10.5,5.5); r,s=wait_until(lambda s: dist((s['player']['x'],s['player']['y']),(10.5,5.5))<0.25, 60); log('at cams terminal: '+r)
ab('keydown','e'); time.sleep(3.4); ab('keyup','e')
log('cams terminal result: '+json.dumps(ev("JSON.stringify({camLoopT:+GHOSTLINE.sim.camLoopT.toFixed(1),hacks:GHOSTLINE.sim.stats.hacks,cool:GHOSTLINE.sim.terminals[0].cool.toFixed(0)})")))
shot('35-cams-looped.png')
# 2) power terminal: wait until the guard idles in the Garage
r,s=wait_until(lambda s: G(s)['state']=='IDLE' and G(s)['y']<5.5 and G(s)['x']>28.5, 150, danger=False); log('guard idling in the Garage: '+r)
click(26.5,11.5); r,s=wait_until(lambda s: dist((s['player']['x'],s['player']['y']),(26.5,11.5))<0.25, 40); log('at power terminal: '+r)
lm0=ev(avg); ab('keydown','e'); time.sleep(1.4); shot('36-terminal-hacking.png'); log('hack prompt: %s  progress %s'%(ev("document.getElementById('promptText').textContent"),ev("document.getElementById('promptBar').firstChild.style.width")))
time.sleep(2.0); ab('keyup','e'); time.sleep(0.3)
res=ev("JSON.stringify({powerCutT:+GHOSTLINE.sim.powerCutT.toFixed(1),hacks:GHOSTLINE.sim.stats.hacks,guard:GHOSTLINE.sim.guards.map(g=>g.state+' / '+g.bark)})")
log('power terminal: avg light %s -> %s ; %s'%(lm0,ev(avg),json.dumps(res))); shot('37-power-cut-lights-out.png')
r,s=wait_until(lambda s: G(s)['state']=='INVESTIGATE', 8, danger=False); log('guard reaction to the breakers: '+r+' '+G(s)['state'])
click(20.5,17.5); ab('press','c'); time.sleep(0.5)
