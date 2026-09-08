from ui_helpers import *
newdoc();click('Toggle object snapping');select('Workspace zoom',1);origin(100,80)
a=create('Rectangle',100,100,80,60,'A');b=create('Rectangle',420,300,90,70,'B');click('Select layer A');before=diag();dragdoc((140,130),(220,180),20);after=diag();near(bounds()['x'],before['bounds']['x']+80);near(bounds()['y'],before['bounds']['y']+50);assert after['history']['undo']==before['history']['undo']+1
click('Undo');assert diag()['document']==before['document'];click('Redo');assert diag()['document']==after['document'];readout('PASS: a 20-move pointer drag is one undo/redo transaction, with selection restored.')
# Selection, pan, zoom consume no history.
history=diag()['history'];click('Select layer B');origin(130,100);select('Workspace zoom',2);assert diag()['history']==history
select('Workspace zoom',1);origin(100,80);click('Select layer A')
# One native range scrub.
ab('scrollintoview','[aria-label="Opacity scrub"]');r=ev('(()=>{const r=document.getElementById("opacityRange").getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()');before=diag();mouse(r['x']+r['w']-8,r['y']+r['h']/2);ab('mouse','down','left')
for t in [.85,.75,.65,.5]:mouse(r['x']+8+(r['w']-16)*t,r['y']+r['h']/2)
ab('mouse','up','left');after=diag();assert after['history']['undo']==before['history']['undo']+1;assert .45<next(o for o in after['document']['items'] if o['id']==a)['style']['opacity']<.55
click('Undo');assert diag()['document']==before['document'];click('Redo');assert diag()['document']==after['document'];readout('PASS: continuous opacity slider scrub is one undo/redo step; pan, zoom and selection add no history.')
# Escape and redo during an active drag.
click('Undo');before=diag();bb=bounds(a);center=(bb['x']+bb['w']/2,bb['y']+bb['h']/2);dragdoc(center,(center[0]+30,center[1]+20),up=False);ab('press','Escape');ab('mouse','up','left');assert diag()['document']==before['document'] and diag()['history']==before['history']
dragdoc(center,(center[0]+30,center[1]+20),up=False);ab('press','Control+Shift+z');ab('mouse','up','left');assert diag()['document']==before['document'] and diag()['history']==before['history'] and diag()['gesture'] is None
readout('PASS: Escape and redo shortcut during uncommitted drag restore starting geometry without adding history.')
# Real tab focus loss during drag.
active=next(t['tabId'] for t in json.loads(ab('tab','--json'))['data']['tabs'] if t['active']);dragdoc(center,(center[0]+30,center[1]+20),up=False);ab('tab','new','about:blank');ab('tab',active);ab('mouse','up','left');assert diag()['document']==before['document'] and diag()['history']==before['history'];readout('PASS: actual tab focus loss cancels active drag.')
# Native touch cancellation via CDP; agent-browser has no touchCancel CLI.
p=point(*center);cdp([{'method':'Emulation.setTouchEmulationEnabled','params':{'enabled':True}},{'method':'Input.dispatchTouchEvent','params':{'type':'touchStart','touchPoints':[{'x':p[0],'y':p[1],'id':1}]}},{'method':'Input.dispatchTouchEvent','params':{'type':'touchMove','touchPoints':[{'x':p[0]+35,'y':p[1]+20,'id':1}]}},{'method':'Input.dispatchTouchEvent','params':{'type':'touchCancel','touchPoints':[]}},{'method':'Emulation.setTouchEmulationEnabled','params':{'enabled':False}}]);assert diag()['document']==before['document'] and diag()['history']==before['history'] and diag()['gesture'] is None
# New edit truncates redo.
ab('focus','#canvasArea');ab('press','ArrowRight');assert diag()['history']['redo']==0;near(bounds(a)['x'],bb['x']+1)
# Handle scales around current center.
click('Select layer A');before=diag();handles=ev('Array.from(document.querySelectorAll("[data-handle]")).map(e=>({k:e.dataset.handle,x:e.getBoundingClientRect().x+e.getBoundingClientRect().width/2,y:e.getBoundingClientRect().y+e.getBoundingClientRect().height/2}))');h=next(h for h in handles if h['k']=='1,1');mouse(h['x'],h['y']);ab('mouse','down','left');mouse(h['x']+40,h['y']+30);ab('mouse','up','left');after=diag();near(after['bounds']['w'],160,.5);near(after['bounds']['h'],120,.5);near(after['bounds']['x']+80,before['bounds']['x']+40,.5)
# Invalid scale and empty number restore cleanly.
before=diag();field('Uniform scale percent',0);assert diag()['document']==before['document'] and diag()['history']==before['history'];field('Selection X','');assert diag()['document']==before['document'];readout('PASS: touchCancel, redo-branch clearing, center-based resize handle, and invalid numeric/zero-scale refusal.')
save('14-history.json');shot('14-history.png')
