from browser_checks import *
ab('set','viewport',1280,800);click('Experiments 08');ab('snapshot','-i');shot('experiment-library');ab('click','[data-preset="double"]');pause();assert diag()['preset']=='double';click('Field notes');shot('field-notes');ab('press','Escape');assert read("document.querySelectorAll('dialog[open]').length")==0
for key in ['double','single','cavity','lens','refraction','array','pulse']:
 ab('select','#preset',key);pause();d=state('preset-'+key);assert d['maxAmplitude']>0 and d['cfl']<=.921;shot('preset-'+key)
 if key in ['cavity','lens','array']:
  click('Intensity');shot('preset-'+key+'-intensity')
 if key=='lens':
  profile=read("(()=>{const f=waveLab.field(),a=f.meanSquared;let out=[];function box(x,y){let total=0,n=0;for(let j=0;j<f.ny;j++)for(let i=0;i<f.nx;i++)if(Math.abs(i*12/f.nx-x)<.25&&Math.abs(j*8/f.ny-y)<.25){total+=a[j*f.nx+i];n++;}return total/n;}for(let x=6;x<11.3;x+=.5)out.push({x,center:box(x,4),offAxis:(box(x,2)+box(x,6))/2});return out;})()")
  (E/'logs'/'lens-intensity-profile.json').write_text(json.dumps(profile,indent=2));report('lens intensity profile',profile)
 if key=='array':
  slider('#edit-angle','Home');resume();wait_sim(12);pause();state('array-steered-minus-60');shot('array-steered-minus-60');slider('#edit-angle','End');resume();wait_sim(12);pause();state('array-steered-plus-60');shot('array-steered-plus-60')
  slider('#edit-focus','End');a=diag();ss=a['sources'];mx=sum(s['x'] for s in ss)/len(ss);my=sum(s['y'] for s in ss)/len(ss);import math,cmath
  coherence=abs(sum(cmath.exp(1j*(s['phase']*math.pi/180-2*math.pi*s['frequency']/1.6*math.hypot(mx+9-s['x'],my-s['y']))) for s in ss))/len(ss)
  state('array-focus-before-fix');report('array phase coherence at focus',coherence)
 if key=='pulse':
  resume();wait_sim(3);pause();state('pulse-reflected');shot('pulse-reflected');click('Fire pulse');assert diag()['sources'][0]['mode']=='pulse';resume();wait_sim(3);pause();state('pulse-refired');shot('pulse-refired')
ab('select','#preset','interference');pause();report('preset and navigation workflow','PASS (array focus coherence investigated separately)')
