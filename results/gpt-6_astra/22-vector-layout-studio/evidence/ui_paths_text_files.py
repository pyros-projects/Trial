from ui_helpers import *
newdoc();click('Toggle object snapping');click('Pen tool')
dragdoc((100,100),(100,0));dragdoc((200,100),(200,200));ab('press','Enter');field('Layer name','Arch')
pid=diag()['selection'][0]
select('Selected anchor',0);field('Anchor X',100);field('Anchor Y',100);field('Outgoing control X',100);field('Outgoing control Y',0)
select('Selected anchor',1);field('Anchor X',200);field('Anchor Y',100);field('Incoming control X',200);field('Incoming control Y',0)
for k,v in {'x':100,'y':25,'w':100,'h':75}.items():near(bounds()[k],v,.01)
save('10-curve-extrema.json');shot('10-curve-extrema.png');readout('PASS: real Pen-created cubic, numeric endpoints (100,100),(200,100), controls(100,0),(200,0), bounds exactly100,25,100,75.')
field('Incoming control Y',-40);assert bounds()['y']<25;field('Incoming control Y',0)
select('Selected anchor',0);dragdoc((100,0),(113,-15));assert abs(next(o for o in diag()['document']['items'] if o['id']==pid)['nodes'][0]['out']['x']-113)<1
field('Outgoing control X',100);field('Outgoing control Y',0)
field('Rotation degrees',20);eid=create('Ellipse',300,180,100,90,'Companion');click('Select layer Arch');addclick('Select layer Companion');click('Group selection');field('Layer name','Curve assembly');field('Rotation degrees',30);field('Uniform scale percent',125)
click('Select layer Arch');click('Node tool');select('Selected anchor',1);field('Incoming control X',215)
d=diag();o=next(o for o in d['document']['items'] if o['id']==pid);m=next(o['world'] for o in d['items'] if o['id']==pid);p=o['nodes'][1]['in'];world=(m[0]*p['x']+m[2]*p['y']+m[4],m[1]*p['x']+m[3]*p['y']+m[5]);dragdoc(world,(world[0]+20,world[1]-10));after=next(o for o in diag()['document']['items'] if o['id']==pid);det=m[0]*m[3]-m[1]*m[2];near(after['nodes'][1]['in']['x'],p['x']+(m[3]*20+m[2]*10)/det,2);near(after['nodes'][1]['in']['y'],p['y']+(-m[1]*20-m[0]*10)/det,2)
readout('PASS: numeric and pointer control edits within a rotated, scaled group account for complete parent transform.')
# Separate filled closed cubic path, then reopen and close via labeled checkbox.
click('Pen tool');dragdoc((600,150),(630,110));dragdoc((700,150),(730,190));dragdoc((650,250),(620,270));mouse(*point(600,150));ab('mouse','down','left');ab('mouse','up','left');field('Layer name','Closed petal');cid=diag()['selection'][0];assert next(o for o in diag()['document']['items'] if o['id']==cid)['closed'];click('Closed path');assert not next(o for o in diag()['document']['items'] if o['id']==cid)['closed'];click('Closed path')
# Multiline and hostile-looking plain text.
click('Text tool');mouse(*point(440,450));ab('mouse','down','left');ab('mouse','up','left');field('Layer name','Literal type');tid=diag()['selection'][0]
literal='<img src=x onerror=alert(1)> & "layout"\nSecond line'
field('Text content',literal,False);beforeUndo=diag();ab('click','#applyText');committed=diag();assert committed['history']['undo']==beforeUndo['history']['undo']+1
click('Undo');assert next(o for o in diag()['document']['items'] if o['id']==tid)['text']=='Your next idea';click('Redo');assert next(o for o in diag()['document']['items'] if o['id']==tid)['text']==literal
field('Text content','Cancelled edit',False);ab('press','Escape');assert next(o for o in diag()['document']['items'] if o['id']==tid)['text']==literal
select('Font family','mono');field('Font size',18);select('Font weight','bold');select('Text alignment','center');field('Line height',1.7);field('Fill hex or none','#667fda');field('Rotation degrees',-8)
assert ev('document.querySelectorAll("#scene img, #scene script, #scene foreignObject").length')==0
readout('PASS: safe literal markup-like multiline text, family/size/weight/alignment/line height/fill, rotation; text commit undo is one step, Escape cancels another.')
# Hidden and locked layer state for roundtrip.
click('Hide layer Companion');click('Lock layer Closed petal');click('Select layer Arch');click('Move layer forward')
save('11-export-source.json');shot('11-export-source.png');click('Preview artboard');shot('12-preview.png');click('Close preview');click('Export document')
ab('download','#jsonExport','evidence/roundtrip.json');ab('download','#svgExport','evidence/artwork.svg');ab('download','#pngExport','evidence/artwork-1x.png');select('PNG export scale',2);ab('download','#pngExport','evidence/artwork-2x.png');click('Close export')
src=json.loads((ROOT/'evidence/roundtrip.json').read_text());assert src==diag()['document']
click('Select layer Literal type');field('Selection X',50);ab('upload','#projectFile',str(ROOT/'evidence/roundtrip.json'));assert diag()['document']==src and diag()['history']=={'undo':0,'redo':0} and diag()['selection']==[]
readout('PASS: actual JSON/SVG/PNG downloads; JSON reimport restores exact scene hierarchy, geometry, text, styles, locks, hidden items and clears history.')
