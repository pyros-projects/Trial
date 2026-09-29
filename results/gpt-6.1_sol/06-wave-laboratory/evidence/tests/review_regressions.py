from browser_checks import *
import sys
prefix=sys.argv[1] if len(sys.argv)>1 else 'review-red';failed=[]
def check(name,fn):
 try:fn();report(name,'PASS')
 except AssertionError as e:failed.append(name);report(name,'FAIL: '+str(e))
ab('set','viewport',1280,800);ab('scroll','up',10000);ab('reload')
def group_pulse():
 ab('select','#preset','array');pause();t=diag()['time'];ab('focus','#edit-mode');ab('press','End');ab('press','Enter');d=state(prefix+'-group-pulse');shot(prefix+'-group-pulse');starts=[s['start'] for s in d['sources']];assert all(abs(v-t)<1e-8 for v in starts),f'group pulse starts are not synchronized: {starts}'
def horizontal_array():
 ab('select','#preset','blank');pause();click('Phased array');draw((3,4),(8,4));before=diag();slider('#edit-angle','End');d=state(prefix+'-horizontal-array');shot(prefix+'-horizontal-array');assert any(abs(s['phase'])>1 for s in d['sources']),f'horizontal steering left all phases zero at 60 degrees: {[s["phase"] for s in d["sources"]]}'
 resume();wait_sim(6);pause();shot(prefix+'-horizontal-array-propagated')
def erased_opening():
 ab('select','#preset','blank');pause();click('Point source');tap(2.8,4);click('Reflecting barrier');draw((6,.08),(6,7.92));click('Erase structures');draw((5.7,4),(6.3,4));resume();wait_sim(12);pause()
 for _ in range(60):
  value=read('waveLab.sample(6,4)')
  if abs(value)>.01:break
  click('Single step')
 assert abs(value)>.01,'a propagating field must reach the erased opening before this test'
 state(prefix+'-opening-before');shot(prefix+'-opening-before');click('Refractive lens');draw((8.5,1.6),(9.5,3));after=read('waveLab.sample(6,4)');state(prefix+'-opening-after');shot(prefix+'-opening-after');assert abs(after-value)<1e-7,f'unrelated material rebuild changed free-space sample from {value} to {after}'
check('phased group pulse synchronization',group_pulse);check('horizontal array steering',horizontal_array);check('erased opening retains field during material rebuild',erased_opening)
print('Review regression failures:',failed);sys.exit(1 if failed else 0)
