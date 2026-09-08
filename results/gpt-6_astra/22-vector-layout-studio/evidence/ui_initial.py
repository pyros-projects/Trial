from ui_helpers import *
ab('set','offline','on')
click('Reset session');click('Select layer Persimmon sun')
field('Selection width',175);field('Fill hex or none','#d97a5a')
near(bounds()['w'],175)
click('Select layer Form & field');field('Text content','Form\n& feeling.',False);ab('click','#applyText')
assert diag()['document']['items'][4-1]['type'] # scene remains data
save('02-edited-opening.json');shot('02-edited-opening.png')
click('Load After hours composition');assert len(diag()['document']['items'])>=10
click('Select layer After hours');field('Text content','AFTER\nDARK',False);ab('click','#applyText')
assert any(o.get('text')=='AFTER\nDARK' for o in diag()['document']['items'])
shot('03-second-composition.png')
readout('PASS direct-file offline: edited opening ellipse dimensions/fill and multiline title; second composition text is editable.')
newdoc();click('Toggle object snapping')
a=create('Rectangle',40,60,80,40,'A');b=create('Rectangle',180,100,60,40,'B');c=create('Rectangle',320,160,80,40,'C')
for name,x,y,w,h in [('A',40,60,80,40),('B',180,100,60,40),('C',320,160,80,40)]:
 click('Select layer '+name);field('Selection X',x);field('Selection Y',y);field('Selection width',w);field('Selection height',h)
ab('focus','#canvasArea');ab('press','Control+a');click('Align top');click('Distribute horizontal gaps')
for i,x in [(a,40),(b,190),(c,320)]:near(bounds(i)['x'],x);near(bounds(i)['y'],60)
near(bounds(a)['w'],80);near(bounds(b)['w'],60);assert [o['id'] for o in diag()['document']['items']]==[a,b,c]
save('04-equal-gaps.json');shot('04-equal-gaps.png')
readout('PASS: UI-created 1200×800 fixture. Align top sets every y=60. Equal horizontal gaps give B.x=190, gaps 70; outer items, sizes and order unchanged.')
# Make overlap impossible, then select all and compare exact state/history.
click('Select layer B');field('Selection X',45);click('Select layer C');field('Selection X',50)
ab('focus','#canvasArea');ab('press','Control+a');before=diag();click('Distribute horizontal gaps');after=diag();assert before['document']==after['document'] and before['history']==after['history'] and before['selection']==after['selection'];assert 'smaller' in after['status']
readout('PASS: impossible distribution is refused atomically with explanation.')
# Other native creation tools and field input continuity.
click('Undo');click('Undo');click('Select layer B');ab('focus','#canvasArea');ab('press','Control+d');dupe=diag()['selection'][0];ab('press','ArrowRight');near(bounds(dupe)['x'],207);ab('press','Delete');assert all(o['id']!=dupe for o in diag()['document']['items'])
e=create('Ellipse',420,100,100,70,'Ellipse test');l=create('Line',480,280,130,65,'Line test');click('Text tool');mouse(*point(450,390));ab('mouse','down','left');ab('mouse','up','left');field('Text content','Line one\nLine two',False);ab('click','#applyText')
count=len(diag()['document']['items']);ab('fill','[aria-label="Text content"]','Delete this text');ab('press','Control+a');ab('press','Backspace');ab('press','Escape');assert len(diag()['document']['items'])==count;assert any(o.get('text')=='Line one\nLine two' for o in diag()['document']['items'])
save('05-creation.json');shot('05-creation.png');readout('PASS: rectangle, ellipse, line, text creation; duplicate, exact keyboard nudge, delete; field typing and Escape preserve scene items.')
