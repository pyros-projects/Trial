from importlib.machinery import SourceFileLoader
import json,subprocess,time
v=SourceFileLoader('v','evidence/browser-validation.py').load_module()
v.ab('set','device','iPhone 14');v.ab('set','viewport','390','844','3');v.ab('set','offline','on');assert v.ev('navigator.onLine') is False;v.select('Experiment preset','interference');v.pause();v.click('Laboratory');v.ab('wait','--fn','window.scrollY === 0');v.snap();v.shot('mobile-initial.png')
d=v.state();assert d['canvas']['dpr']==3;assert v.ev('document.documentElement.scrollWidth <= window.innerWidth');v.report('390x844 high-DPI layout',{'diagnostics':d,'width':v.ev('innerWidth'),'height':v.ev('innerHeight')})
v.click('Source');v.fieldvisible();v.tap(.65,.3);d=v.state();assert d['sourceCount']==3;v.report('mobile source placement',d['sources'])
v.click('Select');v.fieldvisible();v.drag([(.65,.3),(.7,.34),(.76,.38)]);assert v.state()['sources'][-1]['x']>.7;v.report('mobile pointer source drag',v.state()['sources'])
# Real browser touch input, observed as a trusted touch PointerEvent.
v.click('Barrier');v.fieldvisible();v.ev('window.touchObserved=null;document.getElementById("field").addEventListener("pointerdown",e=>window.touchObserved={type:e.pointerType,trusted:e.isTrusted},{once:true});true')
cdp=v.ab('get','cdp-url');url=next(value for value in cdp.values() if isinstance(value,str) and value.startswith('ws:'))
points=[v.fieldpoint(.49,y) for y in [.2,.3,.42,.55,.7,.8]];scroll=v.ev('scrollY');before=v.state()['solidCells']
p=subprocess.run(['node','evidence/touch-drag.cjs'],input=json.dumps({'url':url,'points':points}),text=True,capture_output=True,timeout=20)
with v.LOG.open('a') as f:f.write('$ node evidence/touch-drag.cjs (CDP URL from agent-browser get cdp-url; points '+json.dumps(points)+')\n'+p.stdout+p.stderr+'\n')
assert p.returncode==0,p.stderr;d=v.state();observed=v.ev('window.touchObserved');assert observed=={'type':'touch','trusted':True} and d['solidCells']>before+100 and v.ev('scrollY')==scroll;v.report('trusted touch barrier drag without page scrolling',{'pointer':observed,'solidCells':d['solidCells'],'scrollY':scroll});v.shot('mobile-touch-barrier.png')
v.click('Probe');v.fieldvisible();v.tap(.82,.6);v.resume();v.waitsim(8);v.pause();d=v.state();assert d['probeCount']==3 and d['probes'][-1]['samples']>100;v.report('mobile added probe and live waveform',d['probes']);v.ab('scrollintoview','#probeCards');v.shot('mobile-probes.png')
v.click('Erase');v.fieldvisible();before=v.state()['solidCells'];v.drag([(.49,.25),(.49,.45),(.49,.65)]);after=v.state()['solidCells'];assert after<before;v.report('mobile continuous erasing',{'before':before,'after':after})
v.select('Selected source',str(v.state()['sources'][-1]['id']));v.ab('focus','#frequency');v.ab('press','ArrowRight');assert abs(v.state()['sources'][-1]['frequency']-1.45)<1e-6;v.shot('mobile-source-controls.png')
v.ab('find','text','Simulation settings','click');v.fill('Wave speed (m/s)','8');v.ab('press','Tab');v.fill('Timestep (s)','.1');v.ab('press','Tab');assert v.state()['clamped'];v.shot('mobile-simulation-controls.png')
v.click('Experiments');v.snap();v.shot('mobile-experiments.png');v.ab('click','[data-preset="double"]');assert v.state()['sourceCount']==1 and v.state()['solidCells']>0;v.pause();v.click('Laboratory');v.ab('wait','--fn','window.scrollY === 0');v.shot('mobile-double-slit.png')
v.click('Clear field');assert v.state()['fieldMax']==0;v.click('Advance one timestep');assert v.state()['steps']==1;v.click('Reset');v.pause();assert v.state()['solidCells']>0 and v.state()['fieldMax']>0;v.report('mobile clear, step, and reset',v.state())
v.ab('set','viewport','1280','800','2');v.ab('set','offline','on');d=v.state();assert d['canvas']['dpr']==2 and d['canvas']['width']>1500;v.report('resize preserves scene and high-DPI rendering',d);v.ab('errors');v.ab('console')
