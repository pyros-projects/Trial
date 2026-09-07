from importlib.machinery import SourceFileLoader
v=SourceFileLoader('v','evidence/browser-validation.py').load_module()
v.pause();v.select('Experiment preset','interference');v.pause();v.snap()
# Counter-phase cancellation with sources colocated by pointer input.
v.click('Select');v.fieldvisible();v.drag([(.35,.645),(.35,.5),(.35,.355)]);v.click('Clear field');v.resume();v.waitsim(12);v.pause();constructive=v.state();v.fieldvisible();v.shot('cancellation-in-phase.png')
v.ab('focus','#phase');v.ab('press','End');v.click('Clear field');v.resume();v.waitsim(12);v.pause();cancelled=v.state();ratio=cancelled['fieldRms']/constructive['fieldRms'];assert ratio<.2;v.report('real pointer-placed destructive cancellation',{'beforeRms':constructive['fieldRms'],'afterRms':cancelled['fieldRms'],'ratio':ratio,'sources':cancelled['sources']});v.fieldvisible();v.shot('cancellation-opposite-phase.png')
# Absorber, slit and obstacle creation/editing via the actual drawing tools.
v.click('Reset');v.pause();v.select('Additional drawing tools','absorber');v.fieldvisible();v.drag([(.56,.16),(.56,.4),(.56,.6),(.56,.85)]);d=v.state();assert d['absorbingCells']>200;v.report('absorbing barrier brush',d);v.resume();v.waitsim(5);v.pause();v.fieldvisible();v.shot('absorber-painted.png')
v.select('Additional drawing tools','slit');v.fieldvisible();v.drag([(.7,.15),(.7,.45),(.7,.85)]);before=v.state()['solidCells'];v.fill('Slit opening (m)','2');v.ab('press','Tab');after=v.state()['solidCells'];assert 0<after<before;v.report('slit opening edits live geometry',{'beforeSolid':before,'afterSolid':after})
v.select('Additional drawing tools','obstacle');v.fieldvisible();v.drag([(.82,.31),(.88,.37)]);d=v.state();assert d['solidCells']>after+100;v.report('obstacle drag creates finite reflecting body',d);v.fieldvisible();v.shot('extra-drawing-tools.png')
v.select('Additional drawing tools','array');v.fieldvisible();v.tap(.2,.5);assert v.state()['sourceCount']==10;v.report('phased-array tool creates eight elements',v.state()['sources'])
# Probe limit error state and removal.
v.click('Probe');v.fieldvisible()
for p in [(.12,.2),(.25,.7),(.4,.5),(.55,.3),(.8,.8),(.9,.5)]:v.tap(*p)
assert v.state()['probeCount']==8;v.tap(.9,.2);assert v.state()['probeCount']==8;v.report('probe limit preserves scene',v.ev('document.getElementById("toast").textContent'));v.shot('probe-limit.png');v.ab('scrollintoview','[aria-label="Remove probe 8"]');v.click('Remove probe 8');assert v.state()['probeCount']==7
# Real damping of an unforced field.
v.click('Reset');v.pause();initial=v.state()['fieldRms'];v.ab('scrollintoview','#sourceActive');v.ab('uncheck','#sourceActive');v.select('Selected source',str(v.state()['sources'][1]['id']));v.ab('scrollintoview','#sourceActive');v.ab('uncheck','#sourceActive')
if not v.ev('document.getElementById("simulationDetails").open'):v.ab('find','text','Simulation settings','click')
v.fill('Damping (s⁻¹)','1.5');v.ab('press','Tab');v.resume();v.waitsim(8);v.pause();end=v.state()['fieldRms'];assert end<initial*.2;v.report('unforced damped field decays',{'initialRms':initial,'finalRms':end})
# Spectral probe frequency at the minimum supported emitter frequency.
v.click('Reset');v.pause();v.ab('focus','#frequency');v.ab('press','Home');v.select('Selected source',str(v.state()['sources'][1]['id']));v.ab('focus','#frequency');v.ab('press','Home');v.click('Clear field');v.resume();v.waitsim(25);v.pause();d=v.state();assert all(p['frequency'] is not None and abs(p['frequency']-.2)<.035 for p in d['probes']);v.report('minimum-frequency live probes',d['probes']);v.fieldvisible();v.shot('slow-wave-probes.png')
# Under-resolved wavelength warning, distinct from temporal stability.
v.fill('Wave speed (m/s)','.5');v.ab('press','Tab');v.ab('focus','#frequency');v.ab('press','End');assert 'cells per wavelength' in v.ev('document.getElementById("sourceNote").textContent');v.report('under-resolved wavelength is indicated',v.ev('document.getElementById("sourceNote").textContent'));v.shot('wavelength-warning.png')
# Final default scene and clean console/network evidence from a fresh offline session.
v.click('Reset');v.resume();v.waitsim(12);v.pause();v.click('Laboratory');v.ab('wait','--fn','scrollY===0');v.ab('scrollintoview','#sourceSelect');v.shot('final-desktop-1280x800.png');v.ab('screenshot','--full',str(v.ROOT/'screenshots/final-desktop-full.png'));v.report('final default state',v.state());v.report('final external resources',v.ev('performance.getEntriesByType("resource").map(r=>r.name)'));v.ab('network','requests');v.ab('console');v.ab('errors')
