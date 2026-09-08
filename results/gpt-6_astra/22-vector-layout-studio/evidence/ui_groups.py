from ui_helpers import *
newdoc();click('Toggle object snapping')
a=create('Rectangle',100,100,80,60,'A');b=create('Ellipse',230,150,90,70,'B');c=create('Rectangle',380,220,70,80,'C')
click('Select layer A');addclick('Select layer C');before=diag();click('Group selection');after=diag();assert after['document']==before['document'] and after['selection']==before['selection'] and after['history']==before['history'];assert 'contiguous' in after['status'];readout('PASS: noncontiguous A+C grouping refused atomically.')
click('Select layer A');field('Rotation degrees',22);addclick('Select layer B');before=diag();click('Group selection');g=diag()['selection'][0];field('Layer name','Study group')
for i in [a,b]:
 old=next(o['bounds'] for o in before['items'] if o['id']==i)
 for k,v in old.items():near(bounds(i)[k],v)
field('Selection X',140);field('Selection Y',160);field('Rotation degrees',35);field('Uniform scale percent',145)
# Parent/descendant selection transformation applies once.
addclick('Select layer A');before=diag();field('Selection X',before['bounds']['x']+15);after=diag()
for i in [a,b]:
 old=next(o['bounds'] for o in before['items'] if o['id']==i);near(bounds(i)['x'],old['x']+15)
# Mixed-parent grouping refuses.
click('Select layer A');addclick('Select layer C');before=diag();click('Group selection');after=diag();assert before['document']==after['document'] and before['selection']==after['selection'];assert 'same parent' in after['status']
# Locked descendant protects parent transform and deletion.
click('Lock layer A');click('Select layer Study group');before=diag();field('Selection X',200);after=diag();assert before['document']==after['document'] and before['history']==after['history'];assert 'locked' in after['status'].lower();ab('focus','#canvasArea');ab('press','Delete');assert diag()['document']==before['document']
click('Unlock layer A');click('Select layer Study group');field('Selection X',170)
# Nested group. C is adjacent top-level sibling.
addclick('Select layer C');click('Group selection');outer=diag()['selection'][0];field('Layer name','Outer group');field('Rotation degrees',-18);field('Uniform scale percent',120)
save('06-nested-group.json');shot('06-nested-group.png')
before=diag();click('Ungroup selection');after=diag()
for i in [a,b,c]:
 old=next(o['bounds'] for o in before['items'] if o['id']==i)
 for k,v in old.items():near(bounds(i)[k],v)
click('Undo');assert diag()['document']==before['document'];click('Redo');assert diag()['document']==after['document']
click('Select layer Study group');before=diag();click('Ungroup selection');after=diag()
for i in [a,b,c]:
 old=next(o['bounds'] for o in before['items'] if o['id']==i)
 for k,v in old.items():near(bounds(i)[k],v)
assert [o['id'] for o in after['document']['items']]==[a,b,c]
save('07-ungrouped.json');readout('PASS: group and nested group transforms, rotated child, ancestor+descendant apply once, inherited lock refusal, mixed-parent refusal, ungroup world invariance, exact order, undo/redo.')
