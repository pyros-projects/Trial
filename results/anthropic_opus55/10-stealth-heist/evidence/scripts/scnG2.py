import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from player import *
ab('open','http://127.0.0.1:8765/index.html?v=22'); ab('set','viewport','1280','800'); time.sleep(1)
ab('click','.preset[data-id="quiet-hours"]'); time.sleep(0.4); ab('click','#diffSeg button[data-k="rookie"]'); time.sleep(0.6)
ab('find','role','button','click','--name','▶ BEGIN INFILTRATION'); time.sleep(0.4)
ab('click','#diagBtn')
for k in ['vision','guards','lkp','nav']: ab('check',f'#diagPanel input[data-diag="{k}"]')
ab('focus','#game')
js=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'pursuit-bot2.js')).read()
print(subprocess.run(['agent-browser','eval','--stdin'],input=js,capture_output=True,text=True).stdout)
taken=set(); t0=time.time()
while time.time()-t0<300:
    st=ev("JSON.stringify({done:__bot.done,shots:__bot.shots,phase:__bot.phase})")
    for k in st['shots']:
        if k not in taken and k in ('SPOTTED','LOS','SEARCH','RETURN'):
            taken.add(k); time.sleep(0.5 if k in ('SEARCH','RETURN') else 0.05); shot({'SPOTTED':'21-chase-spotted.png','LOS':'22-chase-los-broken.png','SEARCH':'23-chase-search.png','RETURN':'24-chase-return.png'}[k])
    if st['done']: break
    time.sleep(0.1)
for l in ev("JSON.stringify(__bot.log)"): print(l[:260])
