import json, subprocess, pathlib, time, shlex
ROOT=pathlib.Path(__file__).resolve().parents[2]
E=ROOT/'evidence'; S='wave-lab'
log=open(E/'logs'/'browser-transcript.txt','a',buffering=1)
def ab(*args):
 cmd=['agent-browser','--session',S,*map(str,args)]
 r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=40)
 log.write('$ '+shlex.join(cmd)+'\n'+r.stdout+r.stderr+'\n')
 if r.returncode: raise RuntimeError(r.stdout+r.stderr)
 return r.stdout.strip()
def read(js):return json.loads(ab('eval',js))
def diag():return read('window.waveLab.diagnostics()')
def state(name):
 d=diag();(E/'logs'/f'{name}.json').write_text(json.dumps(d,indent=2));return d

def shot(name):ab('screenshot',str(E/'screenshots'/f'{name}.png'))
def click(name):ab('find','role','button','click','--name',name,'--exact')
def pause():
 if read('innerWidth')<=760:ab('scroll','up',10000)
 if not diag()['paused']:click('Pause simulation')
def resume():
 if read('innerWidth')<=760:ab('scroll','up',10000)
 if diag()['paused']:click('Resume simulation')
def point(x,y):
 z=read("(()=>{const r=document.getElementById('field').getBoundingClientRect();return {x:r.x,y:r.y,...window.waveLab.diagnostics().viewport}})()")
 return z['x']+z['w']*x/12,z['y']+z['h']*y/8 # rect x/y get overwritten by viewport; correct below

def xy(x,y):
 z=read("(()=>{const r=document.getElementById('field').getBoundingClientRect();return {left:r.left,top:r.top,v:window.waveLab.diagnostics().viewport}})()")
 return round(z['left']+z['v']['x']+z['v']['w']*x/12),round(z['top']+z['v']['y']+z['v']['h']*y/8)
def tap(x,y):
 a,b=xy(x,y);ab('mouse','move',a,b);ab('mouse','down');ab('mouse','up')
def draw(a,b,count=14,outside=False):
 x,y=xy(*a);ab('mouse','move',x,y);ab('mouse','down')
 for k in range(1,count+1):
  x,y=xy(a[0]+(b[0]-a[0])*k/count,a[1]+(b[1]-a[1])*k/count);ab('mouse','move',x,y)
 if outside:ab('mouse','move',1010,780)
 ab('mouse','up')
def wait_sim(seconds):
 target=diag()['time']+seconds;ab('wait','--fn',f'window.waveLab.diagnostics().time >= {target}')
def slider(selector,key):ab('focus',selector);ab('press',key)
def report(name,observed):
 print(name,observed);log.write('OBSERVED '+name+': '+json.dumps(observed)+'\n')

if __name__=='__main__':
 ab('set','offline','on');ab('open','file://'+str(ROOT/'index.html'));ab('wait','--fn','window.waveLab && window.waveLab.diagnostics().time > 8');pause();shot('desktop-default-paused');a=state('default-interference');assert a['sourceCount']==2 and a['maxAmplitude']>0 and a['probeCount']==2
 report('default interference',{'freqs':[p['stats']['freq'] for p in a['probes']],'amplitudes':[p['stats']['amp'] for p in a['probes']],'fps':a['fps']})
 click('Reflecting barrier');draw((5.3,.08),(5.3,3.3));draw((5.3,4.7),(5.3,7.92));b=state('barrier-drawn');assert b['wallCells']>300 and b['structureCount']==2
 resume();wait_sim(7);pause();shot('barrier-diffraction');state('barrier-propagated')
 click('Select and move');draw((5.3,1.5),(6.1,1.5));c=state('barrier-moved');assert c['structureCount']==2;resume();wait_sim(3);pause();shot('barrier-moved')
 click('Refractive region');slider('#brush','End');draw((7.1,1.5),(7.1,6.5));d=state('medium-painted');assert d['mediumCells']>3000
 click('Refractive lens');draw((8.6,1.7),(9.7,6.3));l=state('lens-drawn');assert l['mediumCells']>d['mediumCells'];resume();wait_sim(8);pause();shot('painted-medium-and-lens')
 click('Place probe');tap(10.6,4);resume();wait_sim(6);pause();p=state('placed-probe');assert p['probeCount']==3 and p['probes'][-1]['samples']>100 and p['probes'][-1]['stats']['amp']>0;shot('probe-live-waveform')
 old=diag();ab('snapshot','-i');new=diag();assert old['time']==new['time'] and old['steps']==new['steps'];click('Single step');step=state('single-step');assert step['steps']==old['steps']+1 and abs(step['time']-old['time']-old['dt'])<1e-8
 click('Clear field');clear=state('cleared-paused');assert clear['paused'] and clear['time']==0 and clear['maxAmplitude']==0 and all(p['samples']==0 for p in clear['probes']);shot('clear-field')
 click('Reset scene');reset=state('reset-scene');assert reset['sourceCount']==2 and reset['structureCount']==0 and reset['probeCount']==2 and not reset['paused']
 slider('#timestep','End');slider('#speed','End');safe=state('stability-clamped');assert safe['clamped'] and safe['cfl']<=.921 and safe['dt']<safe['requestedDt'];wait_sim(2);shot('stability-clamped');report('CFL clamp',{'requested':safe['requestedDt'],'actual':safe['dt'],'CFL':safe['cfl']})
 for label,m in [('Intensity','intensity'),('Phase','phase'),('Amplitude','amplitude')]:
  click(label);assert diag()['mode']==m;shot('diagnostic-'+m)
 for m in ['gradient','medium','flow']:
  ab('select','#diagnostic',m);assert diag()['mode']==m;shot('diagnostic-'+m)
 pause();assert diag()['maxAmplitude']<20
 click('Refractive region');draw((6.5,2),(6.5,6));before=diag();ab('select','#resolution','480');after=state('resolution-retained');assert after['grid']==[480,320] and after['structureCount']==before['structureCount'] and after['mediumCells']>0 and after['maxAmplitude']==0 and after['cfl']<=.921
 shot('resolution-480');ab('select','#resolution','270');click('Reset scene');pause();ab('errors');ab('console');ab('network','requests');report('desktop editing workflow','PASS')
