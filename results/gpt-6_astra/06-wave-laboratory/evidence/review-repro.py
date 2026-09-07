from importlib.machinery import SourceFileLoader
v=SourceFileLoader('v','evidence/browser-validation.py').load_module()
# Finish the medium/probe flow after replacing an unsupported CLI locator subaction.
v.click('Probe');v.fieldvisible();v.tap(.87,.51);d=v.state();assert d['probeCount']==3
v.resume();v.waitsim(6);v.pause();d=v.state();assert d['probes'][-1]['samples']>100;v.report('probe in edited field records waveform',d['probes']);v.fieldvisible();v.shot('edited-field-probes.png')
v.click('Erase');v.fieldvisible();before=v.state()['solidCells'];v.drag([(.64,.25),(.64,.4),(.64,.55)]);after=v.state()['solidCells'];v.report('eraser material removal',{'before':before,'after':after});assert after<before
v.select('Experiment preset','array');v.pause();v.ab('focus','#phase');v.ab('press','Home');v.ab('press','ArrowRight');before=v.state()['sources'];v.report('custom phase before save',before)
v.ab('find','text','Your workspace','click');v.click('Save locally');v.click('Restore');after=v.state()['sources'];v.report('custom phase after restore before fix',after);v.shot('array-phase-before-fix.png');assert before[0]['phase']!=after[0]['phase']
v.select('Experiment preset','interference');v.pause();v.ab('find','text','Simulation settings','click');v.fill('Timestep (s)','.001');v.ab('press','Tab');v.select('Substeps / frame','12');v.resume();v.waitsim(6);v.pause();d=v.state();v.report('tiny timestep probe history before fix',d['probes']);assert all(p['samples']<=1200 for p in d['probes']);v.fieldvisible();v.shot('probe-history-before-fix.png')
