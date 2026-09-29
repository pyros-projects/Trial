from browser_checks import *

ab('set','offline','on');ab('set','viewport',1280,800,1)
ab('open','file://'+str(ROOT/'index.html'));pause()
# A new line source runs on two grids. Resolution changes preserve its geometry.
ab('select','#preset','blank');pause();click('Line source');draw((2,1),(2,7))
line=diag()['sources'][0]
for resolution in [180,360]:
 ab('select','#resolution',resolution);assert diag()['sources'][0]['x']==line['x'] and diag()['sources'][0]['y2']==line['y2']
 resume();wait_sim(6);pause();d=state('final-line-'+str(resolution));assert d['maxAmplitude']>0 and d['maxAmplitude']<10 and d['cfl']<=.921
 report('line emitter on grid '+str(resolution),{'maximum':d['maxAmplitude'],'CFL':d['cfl']})
ab('select','#resolution',270);ab('select','#preset','blank');pause()
# Pointer capture: leave the canvas with the mouse held down, release outside,
# then make another stroke. No stuck drag may connect the separate structures.
click('Reflecting barrier');draw((5,1),(5,6),outside=True);a=diag();assert a['structureCount']==1 and a['wallCells']>250
draw((8,1),(8,3));b=diag();assert b['structureCount']==2 and b['wallCells']>a['wallCells'];shot('final-pointer-outside-release')
ab('scroll','down',300,'--selector','.left');click('Delete structure');assert diag()['structureCount']==1
ab('scroll','up',10000,'--selector','.left');click('Point source');tap(2.8,4);ab('focus','#field');ab('press','Delete');assert diag()['sourceCount']==0
click('Place probe');tap(9,4);ab('focus','#field');ab('press','Delete');assert diag()['probeCount']==0
ab('select','#preset','interference');resume();wait_sim(2);pause();a=diag();ab('wait',200);assert diag()['time']==a['time'];click('Single step');assert diag()['steps']==a['steps']+1
for label in ['Intensity','Phase','Amplitude']:click(label)
for mode in ['gradient','medium','flow']:ab('select','#diagnostic',mode);assert diag()['mode']==mode
click('Amplitude');click('Reset scene');pause();ab('wait',4000);shot('desktop-final-verified');state('desktop-final-verified')
ab('set','viewport',390,844,2);ab('scroll','up',10000);assert read('document.documentElement.scrollWidth <= innerWidth');shot('mobile-final-verified');state('mobile-final-verified')
ab('set','viewport',1280,800,1)
for command in [('errors',),('console',),('network','requests')]:
 result=ab(*command);(E/'logs'/('final-'+command[0]+'.txt')).write_text(result+'\n')
report('final compact regression','PASS')
