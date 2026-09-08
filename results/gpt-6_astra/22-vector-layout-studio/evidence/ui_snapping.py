from ui_helpers import *
newdoc();click('Toggle object snapping')
a=create('Rectangle',100,100,80,40,'Target');b=create('Rectangle',260,170,60,40,'Moving')
for name,x,y,w,h in [('Target',100,100,80,40),('Moving',260,170,60,40)]:
 click('Select layer '+name);field('Selection X',x);field('Selection Y',y);field('Selection width',w);field('Selection height',h)
click('Toggle object snapping')
for z in [1,2]:
 select('Workspace zoom',z);origin(100,90);click('Select layer Moving')
 for css,snaps in [(5,True),(8,False)]:
  field('Selection X',260);field('Selection Y',170)
  start=(290,190);proposed=180+css/z;dragdoc(start,(start[0]+proposed-260,start[1]),up=False)
  during=diag();actual=during['bounds']['x'];
  if snaps:near(actual,180,.5);assert any(g['axis']=='x' and g['value']==180 for g in during['guides'])
  else:near(actual,proposed,.7);assert not any(g['axis']=='x' for g in during['guides'])
  if z==2 and snaps:shot('08-snap-guide-200.png')
  ab('mouse','up','left');near(bounds()['x'],actual,.001)
  readout(f'PASS: object snapping at {z*100}%: {css} CSS px approach -> x={actual}; guides={during["guides"]}')
# Grid independent, with all object snapping off.
click('Toggle object snapping');click('Toggle grid snapping');select('Workspace zoom',1);origin(100,90);field('Selection X',263);field('Selection Y',173);dragdoc((293,193),(295,195));near(bounds()['x'],260,.7);near(bounds()['y'],170,.7)
readout('PASS: grid-only snapping independently chooses lower target in equal-distance tie (x260,y170).')
click('Toggle grid snapping');click('Toggle object snapping');click('Hide layer Target');click('Select layer Moving');field('Selection X',260);field('Selection Y',170);dragdoc((290,190),(215,190));near(bounds()['x'],185,.7);readout('PASS: hidden target does not attract moving edge.')
# Nested child: own ancestor bounds must not attract; external target still attracts.
click('Show layer Target');click('Select layer Target');addclick('Select layer Moving');click('Group selection');field('Layer name','Pair');click('Select layer Moving');field('Selection X',260);field('Selection Y',170)
# moving to x265 would snap to its original ancestor right feature if ancestors were eligible.
dragdoc((290,190),(295,190));near(bounds()['x'],265,.7)
dragdoc((295,190),(215,190));near(bounds()['x'],180,.5)
readout('PASS: nested child excludes its ancestor as a target and still snaps to eligible sibling edge180.')
save('09-snapping.json')
