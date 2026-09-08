from ui_helpers import *
import copy,math
src=json.loads((ROOT/'evidence/roundtrip.json').read_text());d=copy.deepcopy(src);d['name']='Limits study';d['items']=[]
group=copy.deepcopy(next(o for o in src['items'] if o['type']=='group'))
for i in range(4):
 o=copy.deepcopy(group);o.update(id='g'+str(i),parent='g'+str(i-1) if i else None,name='Level '+str(i+1),transform=[1,0,0,1,0,0]);d['items'].append(o)
p=copy.deepcopy(next(o for o in src['items'] if o['type']=='path'));p.update(id='path32',parent='g3',name='32 anchors',transform=[1,0,0,1,0,0],nodes=[])
for i in range(32):
 x=100+60*math.cos(i*math.pi*2/32);y=100+60*math.sin(i*math.pi*2/32);p['nodes'].append({'x':x,'y':y,'in':{'x':x,'y':y},'out':{'x':x,'y':y}})
d['items'].append(p)
t=copy.deepcopy(next(o for o in src['items'] if o['type']=='text'));t.update(id='text2000',parent=None,name='2000 characters',text='x'*2000,fontSize=1,transform=[1,0,0,1,0,760]);d['items'].append(t)
for i in range(194):d['items'].append({'id':'tile'+str(i),'parent':None,'name':'Tile '+str(i).zfill(3),'type':'rect','visible':True,'locked':False,'transform':[1,0,0,1,220+(i%20)*25,50+(i//20)*25],'width':16,'height':16,'rx':0,'style':{'fill':'#7e8a53','stroke':'none','strokeWidth':0,'opacity':1}})
f=ROOT/'evidence/limits-200.json';f.write_text(json.dumps(d));ab('upload','#projectFile',str(f));assert len(diag()['document']['items'])==200;click('Select layer 32 anchors');select('Selected anchor',31);field('Outgoing control X',161);assert diag()['history']['undo']==1
click('Select layer Tile 000');field('Selection X',222);before=diag();click('Duplicate selection');assert diag()['document']==before['document'] and diag()['history']==before['history'];click('Rectangle tool');dragdoc((850,600),(950,650));assert diag()['document']==before['document']
shot('25-maximum-scene.png');readout('PASS: real import and editing at200 items,32 anchors,4 nested groups,2000 text characters; creation/duplicate above200 refused atomically.')
newdoc();click('Toggle object snapping');a=create('Rectangle',100,100,60,40,'A');b=create('Rectangle',220,150,60,40,'B');c=create('Rectangle',400,220,70,50,'C')
for n,x,y,w,h in [('A',100,100,60,40),('B',220,150,60,40),('C',400,220,70,50)]:
 click('Select layer '+n);field('Selection X',x);field('Selection Y',y);field('Selection width',w);field('Selection height',h)
click('Select tool');dragdoc((80,80),(300,210));assert set(diag()['selection'])=={a,b};readout('PASS: actual marquee selects enclosed A/B and excludes C.')
field('Scale selection percent',120);assert ev('document.getElementById("propScale").value')=='100';click('Undo');field('Rotate selection degrees',15);assert ev('document.getElementById("propAngle").value')=='0';click('Undo')
ab('focus','#canvasArea');ab('press','Control+a')
for label,axis,feature,target in [('Align left','x',0,100),('Align horizontal centers','x',.5,285),('Align right','x',1,470),('Align top','y',0,100),('Align vertical centers','y',.5,185),('Align bottom','y',1,270)]:
 click(label)
 for i in [a,b,c]:
  q=bounds(i);near(q[axis]+q['w' if axis=='x' else 'h']*feature,target)
 click('Undo')
click('Distribute horizontal gaps');near(bounds(b)['x'],250);click('Undo');click('Distribute vertical gaps');near(bounds(b)['y'],160);click('Undo');readout('PASS: all six alignment controls, both equal-gap axes, and relative multi-selection transform input reset.')
# Group containing hidden child cannot offer its hidden edges for snapping.
click('Select layer B');field('Selection X',400);field('Selection Y',200);field('Selection width',80);click('Select layer A');field('Selection width',80);addclick('Select layer B');click('Group selection');field('Layer name','Visibility group');click('Hide layer B');click('Select layer C');field('Selection X',600);field('Selection Y',300);field('Selection width',60);field('Selection height',40);click('Toggle object snapping');select('Workspace zoom',1);origin(100,80);dragdoc((630,320),(515,320));near(bounds()['x'],485,.7);readout('PASS: hidden descendant edge480 is not offered via its visible ancestor group.')
# Dirty inspector click transitions.
field('Selection X',490,False);click('Select layer A');assert diag()['selection']==[a];field('Selection X',110,False);click('Selection Y');assert ev('document.activeElement.id')=='propY';ab('press','Escape');readout('PASS: dirty inspector -> Layers and inspector -> next field preserve first-click continuity.')
save('26-regression.json')
