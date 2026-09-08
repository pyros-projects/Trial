from ui_helpers import *
from png_utils import png_pixel
click('New blank document');field('New artboard width',400);field('New artboard height',300);ab('click','#createDocBtn');click('Toggle object snapping')
a=create('Rectangle',80,80,150,120,'Coral');field('Fill hex or none','#df855d');b=create('Rectangle',140,120,140,100,'Olive');field('Fill hex or none','#586740')
for n,x,y,w,h in [('Coral',80,80,150,120),('Olive',140,120,140,100)]:
 click('Select layer '+n);field('Selection X',x);field('Selection Y',y);field('Selection width',w);field('Selection height',h)
def png(name):
 click('Export document');select('PNG export scale',1);ab('download','#pngExport','evidence/'+name);click('Close export')
png('15-order-before.png');assert png_pixel(ROOT/'evidence/15-order-before.png',180,150)==(88,103,64,255)
click('Select layer Coral');before=diag();click('Move layer forward');after=diag();assert after['history']['undo']==before['history']['undo']+1;png('16-order-after.png');assert png_pixel(ROOT/'evidence/16-order-after.png',180,150)==(223,133,93,255)
click('Undo');assert diag()['document']==before['document'];click('Redo');assert diag()['document']==after['document'];readout('PASS: sibling reorder changes overlapping PNG pixel from olive to coral, and is one reversible history step.')
click('Hide layer Coral');click('Lock layer Olive');count=len(diag()['document']['items']);before=diag();dragdoc((250,160),(270,180));assert diag()['document']==before['document'];assert diag()['selection']==[b];ab('focus','#canvasArea');ab('press','Delete');assert diag()['document']==before['document'] and 'locked' in diag()['status'].lower();png('17-hidden-locked.png');assert png_pixel(ROOT/'evidence/17-hidden-locked.png',180,150)==(88,103,64,255);assert len(diag()['document']['items'])==count
click('Show layer Coral');click('Unlock layer Olive');click('Select layer Olive');before=diag();dragdoc((260,180),(280,190));near(bounds(b)['x'],before['bounds']['x']+20);near(bounds(b)['y'],before['bounds']['y']+10)
readout('PASS: hidden Coral is not hit-tested/deleted; locked Olive remains exported and refuses dragging/deletion; unlocking permits the same move.')
ab('focus','#canvasArea');ab('press','Escape');click('Transparent background');png('18-transparent.png');assert png_pixel(ROOT/'evidence/18-transparent.png',0,0)==(0,0,0,0)
before=diag();field('Artboard width',2049);assert diag()['document']==before['document'] and diag()['history']==before['history'];assert ev('Array.from(document.getElementById("pngScale").options).map(o=>o.value)')==['1','2']
readout('PASS: exported PNG has alpha0 corner for transparent artboard; width2049 is refused and resolution control offers only bounded 1x/2x.')
shot('19-layers-transparency.png');save('19-layers-transparency.json')
