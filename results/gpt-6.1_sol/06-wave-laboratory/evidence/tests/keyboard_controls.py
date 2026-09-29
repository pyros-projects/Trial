from browser_checks import *
import sys
prefix=sys.argv[1] if len(sys.argv)>1 else 'keyboard-red'
ab('set','viewport',1280,800,1);ab('open','file://'+str(ROOT/'index.html'));pause();before=diag();ab('focus','#step');ab('press','Space');after=state(prefix+'-step');shot(prefix+'-step');report('Space on focused single-step button',{'beforeSteps':before['steps'],'afterSteps':after['steps'],'paused':after['paused']});assert after['steps']==before['steps']+1 and after['paused'],'Space must activate the focused button rather than the global pause shortcut'
ab('focus','#tools button[data-tool="wall"]');ab('press','Space');assert diag()['tool']=='wall';ab('focus','#field');ab('press','Space');assert not diag()['paused'];ab('press','Space');assert diag()['paused'];report('native button Space and canvas Space shortcut','PASS')
