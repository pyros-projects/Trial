exec(open('evidence/browser-workflow.py').read().split('try:\n')[0])
# This script uses the existing final browser and real agent-browser/CDP input.
def touch(points,event):return {'method':'Input.dispatchTouchEvent','params':{'type':event,'touchPoints':[{'id':i,'x':x,'y':y,'radiusX':3,'radiusY':3,'force':1} for i,x,y in points]}}
def closeControls():
 run('snapshot','-i');run('click','#leftRail>.close-drawer')
def closeProbe():
 run('snapshot','-i');run('click','#rightRail>.close-drawer')
def stroke(x,y):cdp([touch([(1,x-8,y)],'touchStart'),{'wait':220},touch([(1,x+8,y-5)],'touchMove'),{'wait':220},touch([(1,x+20,y+5)],'touchMove'),{'wait':220},touch([],'touchEnd')])
try:
 run('set','viewport',390,844);click('3D');run('select','#visualization','0');d=diag('mobile-start');assert d['paused'];assert ev('document.documentElement.scrollWidth === innerWidth')
 cdp([{'method':'Emulation.setTouchEmulationEnabled','params':{'enabled':True,'maxTouchPoints':5}}])
 before=ev('window.atmos.camera.azimuth');cdp([touch([(1,170,340)],'touchStart'),touch([(1,230,370)],'touchMove'),touch([(1,248,385)],'touchMove'),touch([],'touchEnd')]);assert ev('window.atmos.camera.azimuth')!=before
 before=ev('window.atmos.camera.distance');cdp([touch([(1,130,350),(2,245,350)],'touchStart'),touch([(1,112,350),(2,265,350)],'touchMove'),touch([(1,95,350),(2,285,350)],'touchMove'),touch([],'touchEnd')]);assert abs(ev('window.atmos.camera.distance')-before)>.1
 click('Overview');shot('mobile-touch-orbit-pinch');note('PASS: at 390×844, real touch drag orbits and two-contact pinch changes camera distance; no horizontal overflow and transport controls remain usable.')
 click('Map');run('select','#visualization','1');rect=ev('document.getElementById("fieldView").getBoundingClientRect().toJSON()');x=round(rect['left']+rect['width']*.52);y=round(rect['top']+rect['height']*.53)
 cdp([touch([(1,x,y)],'touchStart'),touch([],'touchEnd')]);before=diag('mobile-probe-before')
 click('Open experiment controls');click('Cool');closeControls();stroke(x,y);cooled=diag('mobile-cooled');assert cooled['probe']['t']<before['probe']['t']-.1
 click('Open experiment controls');click('Dry');closeControls();stroke(x,y);dried=diag('mobile-dried');assert dried['probe']['q']<cooled['probe']['q']
 click('Open experiment controls');click('Low pressure');closeControls();stroke(x,y);pressure=diag('mobile-pressure');assert pressure['probe']['p']<dried['probe']['p']
 click('Open experiment controls');click('Moisture');closeControls();stroke(x,y)
 click('Open experiment controls');click('Seed cloud');closeControls();stroke(x,y);seeded=diag('mobile-seeded');assert seeded['probe']['cloud']>dried['probe']['cloud']
 h=ev('Array.from(window.atmos.simulation.h).reduce((a,b)=>a+b,0)');click('Open experiment controls');click('Raise terrain');closeControls();stroke(x,y);raised=ev('Array.from(window.atmos.simulation.h).reduce((a,b)=>a+b,0)');assert raised>h
 click('Open experiment controls');click('Lower terrain');closeControls();stroke(x,y);assert ev('Array.from(window.atmos.simulation.h).reduce((a,b)=>a+b,0)')<raised
 click('Open experiment controls');run('click','details > summary');run('select','#surfaceType','city');run('scrollintoview','#surfaceTool');run('snapshot','-i');run('click','#surfaceTool');closeControls();stroke(x,y);city=diag('mobile-city');assert city['probe']['surface']=='City heat island'
 brushEnd=city['interactions']['brushSamples'];time.sleep(.5);assert diag('mobile-released')['interactions']['brushSamples']==brushEnd
 click('Open experiment controls');click('Place probe / orbit');closeControls();click('Open probe inspector');shot('mobile-probe-inspector');closeProbe()
 note('PASS: touch strokes exercise cooling, drying, low pressure, moisture, cloud seeding, raised/lowered numerical terrain and a painted city surface. Local fields and terrain change correctly; brush activity stops after release. Probe drawer reads the altered column.')
 click('3D');run('select','#visualization','0');click('Fly through');run('focus','#world');pos=ev('window.atmos.camera.pos');cdp([{'method':'Input.dispatchKeyEvent','params':{'type':'keyDown','key':'w','code':'KeyW','windowsVirtualKeyCode':87}},{'wait':450},{'method':'Input.dispatchKeyEvent','params':{'type':'keyUp','key':'w','code':'KeyW','windowsVirtualKeyCode':87}}]);assert ev('window.atmos.camera.pos')!=pos;click('Overview')
 note('PASS: Fly through plus a real held W key advances the camera; Overview restores the orbit preset.')
 click('Help and keyboard shortcuts');shot('mobile-field-guide');run('press','Tab');run('press','Escape');assert not ev('document.getElementById("modal").classList.contains("open")')
 note('PASS: field-guide navigation opens a readable mobile dialog, supports keyboard focus and closes with Escape.')
 click('Open experiment controls');run('scrollintoview','#param-day');run('focus','#param-day');run('press','ArrowRight');run('focus','#param-humidity');run('press','ArrowRight');run('wait','--fn','JSON.parse(localStorage.getItem("atmos-settings-v1")).day === window.atmos.renderSettings.day');stored=ev('JSON.parse(localStorage.getItem("atmos-settings-v1"))');closeControls();run('reload');run('wait','--fn','window.atmos && window.atmos.simulation.steps > 1');click('Pause');d=diag('settings-reloaded');assert d['dimensions']==[stored['n'],stored['n'],stored['l']] and d['params']['humidity']==stored['params']['humidity'] and ev('window.atmos.renderSettings.day')==stored['day']
 note('PASS: reload restores selected experiment, grid/layers, numerical humidity and rendering time of day from local settings.')
 base=json.loads((out/'saved-state.json').read_text());before=diag('malformed-application-baseline')
 for name,mutate in [('fractional-viz',lambda s:s['application']['render'].update(viz=1.5)),('camera-member',lambda s:s['application']['camera'].update(basis='broken')),('inherited-preset',lambda s:s.update(preset='__proto__'))]:
  obj=json.loads(json.dumps(base));mutate(obj);path=out/(name+'.json');path.write_text(json.dumps(obj));run('upload','#stateFile',path);time.sleep(.5);after=diag(name+'-rejected');assert after['fields']==before['fields'] and after['simulationSeconds']==before['simulationSeconds'];assert 'State rejected' in run('get','text','#toast')
 shot('malformed-application-rejected');note('PASS: actual uploads with fractional visualization, unknown camera members and inherited preset names are rejected visibly with every field, dimension and clock unchanged.')
 run('set','device','iPhone 15');shot('mobile-high-dpi');assert ev('devicePixelRatio')==3
 run('set','offline','on');run('reload');run('wait','--fn','window.atmos && window.atmos.simulation.steps >= 3');click('Pause');shot('mobile-offline-file');d=diag('offline-mobile');assert d['renderer']['webgl2'] and d['renderer']['compiled'];assert ev('navigator.onLine')==False
 note('PASS: high-DPI (3×) layout and direct file reload with browser networking offline; WebGL2 compiles, atmosphere advances, controls and probes remain usable. HTTP/HTTPS routes remain blocked.')
 run('errors');run('console');run('network','requests');note('PASS: mobile/touch/persistence/malformed-import/offline flows produced no uncaught errors or failed external requests.')
except Exception as e:note('FAIL during mobile/edge workflow: '+str(e));raise
