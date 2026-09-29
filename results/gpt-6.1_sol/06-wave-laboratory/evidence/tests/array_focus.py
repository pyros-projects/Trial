from browser_checks import *
import math,cmath,sys
prefix=sys.argv[1] if len(sys.argv)>1 else 'array-focus-red'
ab('select','#preset','array');pause();slider('#edit-focus','End');a=state(prefix);ss=a['sources'];mx=sum(s['x'] for s in ss)/len(ss);my=sum(s['y'] for s in ss)/len(ss)
coherence=abs(sum(cmath.exp(1j*(s['phase']*math.pi/180-2*math.pi*s['frequency']/1.6*math.hypot(mx+9-s['x'],my-s['y']))) for s in ss))/len(ss)
shot(prefix);report('wave phase alignment at 9 m focus',coherence);assert coherence>.995,'emitted wave phases must align at the focus after propagation delay'
resume();wait_sim(12);pause();click('Amplitude');shot(prefix+'-propagated');state(prefix+'-propagated')
