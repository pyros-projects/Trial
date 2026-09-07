from importlib.machinery import SourceFileLoader
import json, statistics
v=SourceFileLoader('v','evidence/browser-validation.py').load_module()
v.ab('reload');v.pause();v.select('Experiment preset','lens');v.pause()
# Move the real probe into the visible focal region, then compare the same point without the lens.
v.click('Select');v.fieldvisible();v.drag([(.72,.5),(.65,.5),(.59,.5)])
v.resume();v.waitsim(12);v.pause();with_lens=v.state();v.fieldvisible();v.shot('lens-focus-measurement.png')
v.click('Select');v.fieldvisible();v.tap(.46,.58);assert v.state()['selected']['kind']=='structure';v.click('Remove selected structure');assert v.state()['mediumCells']==0
v.click('Clear field');v.resume();v.waitsim(16);v.pause();without_lens=v.state();v.fieldvisible();v.shot('lens-removed-reference.png')
focus=with_lens['probes'][0]['amplitude'];reference=without_lens['probes'][0]['amplitude']
assert focus>reference*1.1
v.report('lens increases measured amplitude at the focal region',{'withLens':with_lens['probes'],'withoutLens':without_lens['probes'],'amplitudeRatio':focus/reference})
# Read spatial zero crossings from the actual field on each side of the interface.
v.select('Experiment preset','refraction');v.resume();v.waitsim(12);v.pause();v.fieldvisible();v.shot('refraction-spatial-measurement.png')
trace=v.ev('Array.from({length:481},(_,i)=>({x:i/480,u:window.waveLab.sample(i/480,.5)}))')
def wavelength(a,b):
 crossings=[]
 for p,q in zip(trace,trace[1:]):
  if a<=p['x']<b and p['u']*q['u']<0:crossings.append((p['x']+(q['x']-p['x'])*(-p['u'])/(q['u']-p['u']))*24)
 return {'zeroCrossingsMeters':crossings,'medianWavelengthAlongX':2*statistics.median([y-x for x,y in zip(crossings,crossings[1:])])}
incident=wavelength(.2,.43);transmitted=wavelength(.57,.9);assert transmitted['medianWavelengthAlongX']<incident['medianWavelengthAlongX']*.85
v.report('refraction changes spatial wavelength in the actual field',{'incident':incident,'transmitted':transmitted,'probes':v.state()['probes']})
(v.ROOT/'refraction-trace.json').write_text(json.dumps(trace))
v.ab('errors');v.ab('console')
