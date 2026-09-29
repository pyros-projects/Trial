from browser_checks import *
ab('set','viewport',390,844,2);ab('reload');ab('wait','--fn','window.waveLab.diagnostics().time > 8');pause();ab('scrollintoview','#field');shot('mobile-retina-default');assert read('document.documentElement.scrollWidth <= innerWidth');assert diag()['viewport']['dpr']==2
url=ab('get','cdp-url')
def touch(world_points):
 pts=[xy(x,y) for x,y in world_points];cmd=['node',str(E/'tests'/'touch_input.cjs'),url,json.dumps(pts)];r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=20);log.write('$ '+shlex.join(cmd)+'\n'+r.stdout+r.stderr+'\n');assert r.returncode==0,r.stderr
ab('select','#quickTool','wall');touch([(6,1+i*.15) for i in range(35)]);a=state('mobile-touch-wall');assert a['wallCells']>250;shot('mobile-touch-wall')
ab('select','#quickTool','erase');touch([(5.8+i*.08,4) for i in range(9)]);b=state('mobile-touch-erased');assert b['wallCells']<a['wallCells'];shot('mobile-touch-erase')
ab('select','#quickTool','select');touch([(2.8+i*.04,2.65+i*.015) for i in range(21)]);c=state('mobile-source-moved');assert c['sources'][0]['x']>3.5
ab('select','#quickTool','point');touch([(3.7,5.8)]);assert diag()['sourceCount']==3
ab('select','#quickTool','probe');touch([(9.5,4.8)]);assert diag()['probeCount']==3;resume();wait_sim(7);pause();d=state('mobile-probe-live');assert d['probes'][-1]['samples']>100 and d['probes'][-1]['stats']['amp']>0;shot('mobile-probe-live')
click('Single step');ab('focus','#field');ab('press',' ');assert not diag()['paused'];ab('press',' ');assert diag()['paused'];before=diag();ab('press','.');after=diag();assert after['steps']==before['steps']+1
click('Clear field');assert diag()['maxAmplitude']==0;click('Reset scene');pause();assert diag()['sourceCount']==2 and diag()['structureCount']==0
ab('click','#quickExperiments');shot('mobile-experiment-library');ab('snapshot','-i');ab('click','[data-preset="double"]');pause();assert diag()['preset']=='double';click('Open field notes');shot('mobile-field-notes');ab('press','Escape');assert read("document.querySelectorAll('dialog[open]').length")==0
ab('select','#quickTool','lens');ab('scrollintoview','#field');touch([(7,2),(7.15,2.5),(7.4,3),(7.8,4),(8.2,5.7)]);assert diag()['mediumCells']>0;resume();wait_sim(3);pause();shot('mobile-drawn-lens');state('mobile-final');ab('errors');ab('console');report('390 × 844, 2× DPI, trusted touch workflow','PASS')
