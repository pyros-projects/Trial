from importlib.machinery import SourceFileLoader
m=SourceFileLoader('browser','evidence/browser-workflow.py').load_module()
globals().update({k:v for k,v in m.__dict__.items() if not k.startswith('__')})
click('[aria-label="Reset timeline"]')
click('[aria-label="Keyframe Contrast"]')
k=js('studio.project.nodes.find(n=>n.id===7).keys.contrast');assert len(k)==1
# Scrub with actual pointer, then edit and insert a second key.
r=js('(()=>{const r=document.querySelector("#timelineRail").getBoundingClientRect();return {x:r.x+17+(r.width-34)*.25,y:r.y+23}})()')
drag(r,r)
run('fill','[aria-label="Contrast value"]','0.65');run('press','Enter')
click('[aria-label="Keyframe Contrast"]')
k=js('studio.project.nodes.find(n=>n.id===7).keys.contrast');assert len(k)==2
run('select','[aria-label="Keyframe interpolation"]','linear')
r=js('(()=>{const r=document.querySelector("#timelineRail").getBoundingClientRect();return {x:r.x+17+(r.width-34)*.125,y:r.y+23}})()');drag(r,r)
h1=js('canvasHash()');t1=state()['time']
click('[aria-label="Step one frame"]');t2=state()['time'];assert abs(t2-t1-1/30)<.001
log('keyframes scrub interpolation frame step',{'keys':k,'t1':t1,'t2':t2,'hash':h1})
snap('08-keyframes.png')
# Actual Space key pause/play and time-dependent rendered output.
run('focus','#graphArea');run('press','Space');assert state()['playing']
run('wait','--fn','studio.diagnostics.frame > 65')
click('[aria-label="Pause playback"]');assert not state()['playing'];h2=js('canvasHash()');assert h1!=h2
log('time-driven animation changes rendered pixels',{'before':h1,'after':h2,'state':state()})
click('[aria-label="Red channel"]');d=js('(()=>{const c=document.querySelector("#previewCanvas"),p=c.getContext("2d").getImageData(c.width/2,c.height/2,1,1).data;return [...p]})()');assert d[0]==d[1]==d[2]
click('[aria-label="RGB channels"]')
click('[aria-label="Toggle tiling preview"]');assert state()['preview']['tile'];snap('09-tiling-preview.png');click('[aria-label="Toggle tiling preview"]')
click('[aria-label="Freeze reference"]');assert state()['preview']['compare'];drag({'x':995,'y':265},{'x':1060,'y':265});snap('10-frozen-comparison.png');click('[aria-label="Freeze reference"]')
click('[aria-label="Zoom preview in"]');assert state()['preview']['z']>1;drag({'x':991,'y':254},{'x':1025,'y':270});assert state()['preview']['x']!=0;click('[aria-label="Fit preview"]');assert state()['preview']['z']==1
run('mouse','move',990,258);log('pixel inspection',js('document.querySelector("#pixelRead").textContent'))
run('select','[aria-label="Preview output"]','5');assert state()['root']==5
log('selected intermediate output',{'hash':js('canvasHash()'),'state':state()})
run('select','[aria-label="Preview output"]','0')
click('#settingsTab')
for diag in [5,6,7,8,9,10,11,12]:
    run('select','#diagnostic',diag)
    assert js('studio.project.settings.diagnostic')==diag
    log('diagnostic '+str(diag),{'hash':js('canvasHash()'),'status':state()['status']})
run('select','#diagnostic','0')
run('select','#resolution','256')
click('#propertiesTab')
log('preview controls regression',state())
run('errors');run('console')
