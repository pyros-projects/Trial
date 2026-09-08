from importlib.machinery import SourceFileLoader
m=SourceFileLoader('browser','evidence/browser-workflow.py').load_module()
globals().update({k:v for k,v in m.__dict__.items() if not k.startswith('__')})
# Open real presets from the browser collection, including a graph with dozens of nodes.
for idx in [1,2,3,4,5,6,7,9,8]:
    if not js('!!document.querySelector(".modal")'):click('#presetsBtn')
    run('scrollintoview',f'[data-preset="{idx}"]')
    run('click',f'[data-preset="{idx}"]')
    run('wait','--fn','studio.diagnostics.status === "ready" && studio.diagnostics.renderCount > 0')
    click('[aria-label="Pause playback"]')
    d=state();assert d['status']=='ready',d
    pixel=js('(()=>{const c=document.querySelector("#previewCanvas"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let min=255,max=0;for(let i=0;i<d.length;i+=4){min=Math.min(min,d[i]);max=Math.max(max,d[i])}return {min,max}})()')
    assert pixel['max']>pixel['min']+20
    log('editable preset '+str(idx),{'name':js('studio.project.name'),'state':d,'redRange':pixel})
assert state()['nodes']>=24
snap('13-complex-terrain-desktop.png')
# Set a practical preview budget then change a complex graph parameter using the inspector.
click('#settingsTab');run('select','#resolution','128');run('wait','--fn','!needsRender');click('#propertiesTab')
run('fill','[aria-label="Contrast value"]','1.4');run('press','Enter');run('wait','--fn','!needsRender')
log('complex graph parameter editing',state())
# Resize the actual browser, navigate mobile panels and edit.
run('set','viewport','390','844','2')
snap('14-mobile-graph.png')
assert js('document.documentElement.scrollWidth')==390
click('button[data-mobile="preview"]');snap('15-mobile-preview.png')
assert js('document.querySelector("#previewCanvas").getBoundingClientRect().width')>200
click('button[data-mobile="inspector"]');snap('16-mobile-inspector.png')
run('fill','[aria-label="Contrast value"]','1.8');run('press','Enter');run('wait','--fn','!needsRender')
assert js('studio.project.nodes.find(n=>n.type==="ramp").p.contrast')==1.8
click('button[data-mobile="graph"]');click('#addNode')
run('fill','#commandSearch','Number');run('press','Enter');run('wait','--fn','!document.querySelector(".modal")')
assert js('studio.project.nodes.at(-1).type')=='constant'
click('button[data-mobile="inspector"]');run('fill','[aria-label="Value value"]','0.37');run('press','Enter');assert js('studio.project.nodes.at(-1).p.value')==.37
log('mobile command search add and parameter edit',state())
click('button[data-mobile="graph"]')
# Move selected node using pointer and verify state coordinates.
nid=js('studio.project.nodes.at(-1).id');p=rect(f'.node[data-id="{nid}"] .node-head');before=js('studio.project.nodes.at(-1).x');drag(p,{'x':p['x']+18,'y':p['y']+30});assert js('studio.project.nodes.at(-1).x')!=before
click('[aria-label="Zoom graph in"]');click('[aria-label="Fit graph"]')
click('button[data-mobile="preview"]');click('[aria-label="Play animation"]');run('wait','--fn','studio.diagnostics.frame>30');click('[aria-label="Pause playback"]')
log('mobile movement zoom animation',state());snap('17-mobile-animated-result.png')
run('errors');run('console');run('network','requests')
