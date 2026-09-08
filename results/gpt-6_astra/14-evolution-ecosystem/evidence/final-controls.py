import importlib.util,json,time
sp=importlib.util.spec_from_file_location('checks','evidence/browser-checks.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
ab,ev,click,check,snap=m.ab,m.ev,m.click,m.check,m.snap
ab('open','file:///home/pyro/projects/naked/astra/bench/14-evolution-ecosystem/index.html');ab('network','route','https://*','--abort');ab('network','route','http://*','--abort');ab('set','offline','on');ab('wait','--fn','!!window.ecoLab');
if not ev('ecoLab.view.paused'):click('Pause')
ab('select','#presetSelect','balanced');
if not ev('ecoLab.view.paused'):click('Pause')
click('Reset');click('Cold snap');click('Single step');check('cold_snap',ev('ecoLab.state.climate.temperature')<10,ev('ecoLab.state.climate'))
click('Reset');click('Single step');solar=ev('ecoLab.state.ledger.solar');click('Reset');click('Bloom');click('Single step');bloom=ev('ecoLab.state.ledger.solar');check('bloom_growth',bloom>solar*2.9,{'normal_solar_input':solar,'bloom_solar_input':bloom})
click('Reset');pop=ev('ecoLab.state.organisms.length');click('Predators');check('predator_introduction',ev('ecoLab.state.organisms.length')==pop+16,{'before':pop,'after':ev('ecoLab.state.organisms.length')})
click('More interventions ↗');before=ev('ecoLab.state.cells.reduce((s,c)=>s+c.food,0)');ab('click','[data-disaster=pulse]');check('food_pulse_browser',ev('ecoLab.state.cells.reduce((s,c)=>s+c.food,0)')>before,{'before':before,'after':ev('ecoLab.state.cells.reduce((s,c)=>s+c.food,0)')})
click('Reset');click('More interventions ↗');ab('click','[data-disaster=disease]');infected=ev('ecoLab.state.organisms.filter(o=>o.disease>0).map(o=>o.id)');click('32×');click('Resume');ab('wait','--fn','ecoLab.state.tick>=130');click('Pause');injured=ev('ecoLab.state.organisms.filter(o=>o.disease>0&&o.health<95).length');check('disease_injury',len(infected)>0 and injured>0,{'initially_infected':len(infected),'living_injured_infected':injured})
click('Reset');ab('find','role','tab','click','--name','Evolution','--exact');ab('focus','#reproductionThreshold');ab('press','End');ab('focus','#sensorRange');ab('press','End');click('Resume');ab('wait','--fn','ecoLab.state.tick>=180');click('Pause');check('reproduction_threshold',ev('ecoLab.state.totals.births')==0 and ev('ecoLab.state.params.sensorRange')==2,{'births':ev('ecoLab.state.totals.births'),'params':ev('ecoLab.state.params')});ab('focus','#reproductionThreshold');ab('press','Home');click('Resume');ab('wait','--fn','ecoLab.state.totals.births>0');click('Pause');check('lower_threshold_births',ev('ecoLab.state.totals.births')>0,{'births':ev('ecoLab.state.totals.births')})
ab('find','role','tab','click','--name','Environment','--exact');click('Reset');
for id in ['foodGrowth','metabolism','climateAmplitude']:
 ab('focus','#'+id);ab('press','End')
check('environment_ranges',ev('ecoLab.state.params.foodGrowth')==3 and ev('ecoLab.state.params.metabolism')==3 and ev('ecoLab.state.params.climateAmplitude')==2,ev('ecoLab.state.params'));click('Reset')
# An unexpected decision member must fail before changing simulation or view controls.
before=m.state();bad=ev('JSON.parse(ecoLab.snapshot())');bad['simulation']['organisms'][0]['decision']['extra']='invalid';bad['view']['selected']=bad['simulation']['organisms'][0]['id'];bad['view']['inspectTab']='decisions';bad['view']['renderDetail']='minimal';bad['view']['overlays']['sensors']=True;(m.ROOT/'evidence/bad-decision.json').write_text(json.dumps(bad));view=ev('ecoLab.view');click('Load experiment');ab('upload','#loadFile',str(m.ROOT/'evidence/bad-decision.json'));ab('wait','--fn','document.getElementById("toast").textContent.includes("Decision fields")');check('extra_decision_atomic_import',m.digest(before)==m.digest(m.state()) and ev('ecoLab.view.overlays.sensors')==view['overlays']['sensors'] and ev('document.getElementById("density").value')=='adaptive',ev('document.getElementById("toast").textContent'));ab('press','Escape')
# Click a living species and check the actual highlighted species identity.
ab('click','#speciesList [data-species]');check('species_highlight',ev('Number.isInteger(ecoLab.view.highlight?.species)'),ev('ecoLab.view.highlight'));ab('click','#speciesList [data-species]');
check('final_console_clean',not ab('errors').get('errors'),ab('errors').get('errors'))
# Leave a healthy, observed habitat on screen for final screenshots.
ab('fill','#seedInput','042');click('Apply');click('5×');click('Resume');ab('wait','--fn','ecoLab.state.tick>=260');click('Pause');click('1×');ab('find','role','tab','click','--name','Genome','--exact');click('Fit world');click('Zoom in');
for key in ['sensors','targets','vectors','decisions','trails','grid']:
 if ev(f'ecoLab.view.overlays.{key}'):
  click('Diagnostic overlays');ab('uncheck',f'[data-overlay={key}]');click('Diagnostic overlays')
ab('scroll','up',1500);ab('set','viewport',1280,800);snap('desktop-final');ab('screenshot','--full','evidence/desktop-full.png');ab('set','viewport',1440,900);snap('desktop-wide');ab('console');ab('errors');ab('network','requests')
