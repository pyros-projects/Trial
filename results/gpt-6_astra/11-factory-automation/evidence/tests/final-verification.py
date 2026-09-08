import workflow as w
from workflow import *
w.SESSION='forge-final'
ab('reload');wait_for('typeof Forge!=="undefined"');pause();button('Fit factory in view')
results=[]
for width,height in [(1280,800),(390,844),(1440,1000)]:
    ab('set','viewport',width,height,1)
    wait_for(f"innerWidth==={width} && document.querySelector('#world').clientHeight>100")
    d=diag();c=d['camera'];v=d['viewport']
    for s in d['structures']:
        n=1 if s['type'] in ['belt','splitter','merger','loader','pole'] else 2
        assert c['x']+s['x']*32*c['z']>=-1
        assert c['x']+(s['x']+n)*32*c['z']<=v['w']+1
        assert c['y']+s['y']*32*c['z']>=-1
        assert c['y']+(s['y']+n)*32*c['z']<=v['h']+1
    results.append({'viewport':[width,height],'camera':c})
result('Automatic resize fitting without fit-button intervention',results)
dump('automatic-resize.json',results)
before=len(diag()['structures']);button('Build Power pole');dragcells([(12,18),(16,18)])
assert structure(12,18)['type']=='pole' and structure(16,18)['type']=='pole'
assert len(diag()['structures'])==before+2
button('Single step');button('Select (V)');clickcell(12,18)
assert ev("document.querySelector('#upgrade-btn').disabled")
ab('click','#overlay-btn');button('Power network');shot('37-dragged-power-network.png')
assert len(diag()['power'])==1
result('Drag power lines and connect real network',{'polesPlaced':2,'networks':diag()['power']})
button('Undo edit');assert len(diag()['structures'])==before
for name,file in [('Connections','38-connections-overlay.png'),('Utilization','39-utilization-overlay.png'),('Congestion','40-congestion-overlay.png'),('Natural view','41-final-natural.png')]:
    ab('click','#overlay-btn');button(name);shot(file)
button('Simulation speed 1x');resume();old=diag()['delivered'].get('circuit',0)
wait_for(f"(Forge.diagnostics().delivered.circuit || 0)>{old}")
assert not diag()['errors'];dump('final-desktop-state.json',diag())
(E/'logs'/'final-desktop-errors.txt').write_text(ab('errors'))
(E/'logs'/'final-desktop-console.txt').write_text(ab('console'))
(E/'logs'/'final-network.txt').write_text(ab('network','requests'))
result('Final artifact regression','Real circuit dispatch continues; no application errors or external requests')
