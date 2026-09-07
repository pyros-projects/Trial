from importlib.machinery import SourceFileLoader
v=SourceFileLoader('v','evidence/browser-validation.py').load_module()
v.pause();v.snap()
# Source drag and keyboard movement on the real canvas.
v.click('Select');v.fieldvisible();v.drag([(.35,.355),(.39,.32),(.43,.3)]);a=v.state()['sources'][0];assert a['x']>.4 and a['y']<.32;v.ab('press','ArrowRight');b=v.state()['sources'][0];assert b['x']>a['x'];v.report('source pointer and keyboard movement',{'drag':a,'keyboard':b})
v.ab('press','Space');assert not v.state()['paused'];v.ab('press','Space');assert v.state()['paused'];n=v.state()['steps'];v.ab('press','.');assert v.state()['steps']==n+1;v.report('canvas keyboard pause and single-step',v.state())
# All source types, waveform and active state, plus line geometry and pulse trigger.
v.select('Source type','line');v.fill('Line angle (°)','65');v.ab('press','Tab');v.fill('Line length (m)','5');v.ab('press','Tab');v.select('Waveform','triangle');v.ab('uncheck','#sourceActive');assert not v.state()['sources'][0]['active'];v.ab('check','#sourceActive');v.select('Waveform','square');v.resume();v.waitsim(3);v.pause();v.fieldvisible();v.shot('line-soft-square.png');v.report('line source geometry and waveform controls',v.state())
# Stability and invalid values.
v.ab('find','text','Simulation settings','click');v.fill('Timestep (s)','.12');v.ab('press','Tab');v.fill('Wave speed (m/s)','8');v.ab('press','Tab');d=v.state();assert d['clamped'] and d['ratio']<=.920001 and d['requestedRatio']>1;v.report('unsafe request is clamped',d)
v.resume();v.waitsim(2);v.pause();assert v.state()['finite'];v.shot('stability-limited.png')
v.fill('Timestep (s)','0');v.ab('press','Tab');assert v.state()['requested']==.12 and v.ev('document.getElementById("timestep").getAttribute("aria-invalid")')=='true';v.report('invalid timestep preserves last valid settings',v.state());v.shot('invalid-timestep.png')
v.fill('Timestep (s)','.018');v.ab('press','Tab');v.select('Resolution','400');d=v.state();assert d['nx']==400 and d['ny']==160 and d['fieldMax']==0;v.report('resolution change clears and reapplies CFL',d);v.resume();v.waitsim(1);v.pause();assert v.state()['finite']
v.select('Resolution','240');v.fill('Wave speed (m/s)','3');v.ab('press','Tab');v.fill('Damping (s⁻¹)','.04');v.ab('press','Tab');v.select('Substeps / frame','8')
for boundary in ['reflecting','periodic','absorbing']:
 v.select('Boundary',boundary);v.resume();v.waitsim(2);v.pause();assert v.state()['finite'];v.report('boundary '+boundary,v.state())
# Review and capture every preset through native navigation and controls.
v.click('Experiments');v.snap();v.shot('experiment-gallery.png');v.click('Close experiments')
for preset in ['interference','double','single','cavity','lens','refraction','array','pulse']:
 v.select('Experiment preset',preset);v.resume();v.waitsim(3 if preset!='pulse' else .8);v.pause();d=v.state();assert d['finite'] and d['fieldMax']>0;v.fieldvisible();v.shot('preset-'+preset+'.png');v.report('preset '+preset,d)
# All diagnostics while running; phase/intensity pixels and live mode both inspected.
v.select('Experiment preset','array');v.select('Substeps / frame','4');v.resume()
for mode in ['intensity','phase','gradient','medium','flow','amplitude']:
 if mode in ['intensity','phase','amplitude']:v.click(mode.capitalize())
 else:v.select('More field diagnostics',mode)
 v.waitsim(.5);d=v.state();assert d['mode']==mode and not d['paused'] and d['finite'];v.fieldvisible();v.shot('diagnostic-'+mode+'.png');v.report('running diagnostic '+mode,{'time':d['time'],'fieldRms':d['fieldRms'],'mode':d['mode']})
# Relative array phases cause a measurable field redistribution, not a drawn beam.
v.ab('focus','#steering');v.ab('press','Home');v.click('Clear field');v.waitsim(10);v.pause();left=v.state();leftSamples=v.ev('Array.from({length:19},(_,i)=>Math.abs(window.waveLab.sample(.7,.05+i*.05)))');v.fieldvisible();v.shot('array-minus60.png')
v.ab('focus','#steering');v.ab('press','End');v.click('Clear field');v.resume();v.waitsim(10);v.pause();right=v.state();rightSamples=v.ev('Array.from({length:19},(_,i)=>Math.abs(window.waveLab.sample(.7,.05+i*.05)))');assert left['sources'][0]['phase']!=right['sources'][0]['phase'];assert sum(abs(a-b) for a,b in zip(leftSamples,rightSamples))>.02;v.report('array steering changes actual sampled field',{'minus60':leftSamples,'plus60':rightSamples,'phaseBefore':left['sources'][0]['phase'],'phaseAfter':right['sources'][0]['phase']});v.fieldvisible();v.shot('array-plus60.png')
# Meaningful display controls.
v.select('Color scale','ocean');v.ab('focus','#exposure');v.ab('press','End');v.ab('focus','#persistence');v.ab('press','End');v.ab('focus','#brush');v.ab('press','End');v.shot('display-controls.png')
# Keyboard modal navigation and expanded viewport.
v.click('Field notes ↗');v.snap();v.shot('field-notes.png');v.ab('press','Escape');assert not v.ev('!!document.querySelector("dialog[open]")');v.click('Expand field');assert v.ev('document.getElementById("fieldWrap").classList.contains("fullscreen-stage")');v.shot('expanded-field.png');v.ab('press','Escape');assert not v.ev('document.getElementById("fieldWrap").classList.contains("fullscreen-stage")')
v.click('Reset');v.pause();v.report('desktop controls completed',v.state())
