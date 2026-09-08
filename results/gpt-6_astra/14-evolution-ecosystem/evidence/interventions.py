import importlib.util,time,json,subprocess
spec=importlib.util.spec_from_file_location('checks','evidence/browser-checks.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
ab,ev,click,snap,check,state,load=m.ab,m.ev,m.click,m.snap,m.check,m.state,m.load
ab('press','Escape');click('Reset');click('32×')
# Matching seed, parameters and initial population. Compare retained samples at precisely tick 580.
click('Resume');ab('wait','--fn','ecoLab.state.tick >= 610');click('Pause');baseline=ev('ecoLab.state.history.find(h=>h.tick===580)')
click('Reset');click('Drought');click('Resume');ab('wait','--fn','ecoLab.state.tick >= 610');click('Pause');drought=ev('ecoLab.state.history.find(h=>h.tick===580)')
check('drought_population_response',abs(drought['population']-baseline['population'])>25 and drought['resource']<baseline['resource'],{'baseline':{k:baseline[k] for k in ['tick','population','grazers','predators','resource','temperature','deaths']},'drought':{k:drought[k] for k in ['tick','population','grazers','predators','resource','temperature','deaths']}})
snap('drought-response')
# Evolution controls accept continuous keyboard edits during accelerated simulation.
click('Reset');ab('find','role','tab','click','--name','Evolution','--exact');ab('focus','#mutationRate');ab('press','End');ab('focus','#mutationMagnitude');ab('press','End');click('Resume');ab('wait','--fn','ecoLab.state.tick>=260');click('Pause')
check('mutation_controls',ev('ecoLab.state.params.mutationRate')==1 and ev('ecoLab.state.totals.mutations')>100,{'params':ev('ecoLab.state.params'),'mutations':ev('ecoLab.state.totals.mutations'),'species':ev('ecoLab.state.species.length')});snap('rapid-variation')
ab('find','role','tab','click','--name','Environment','--exact');click('Reset')
# Real pointer tools; no application state is written by the harness.
def point(x,y):
 return ev(f'(()=>{{const v=ecoLab.view,s=ecoLab.state,r=document.getElementById("world").getBoundingClientRect(),scale=Math.max(r.width/s.width,r.height/s.height)*1.01*v.camera.zoom;return {{x:Math.round(r.x+r.width/2+({x}-v.camera.x)*scale),y:Math.round(r.y+r.height/2+({y}-v.camera.y)*scale)}}}})()')
def tap(x,y):
 p=point(x,y);ab('mouse','move',p['x'],p['y']);ab('mouse','down','left');ab('mouse','up','left')
def stroke(points):
 p=point(*points[0]);ab('mouse','move',p['x'],p['y']);ab('mouse','down','left')
 for xy in points[1:]:
  p=point(*xy);ab('mouse','move',p['x'],p['y'])
 ab('mouse','up','left')
click('Spawn grazer');before=ev('ecoLab.state.organisms.length');tap(600,420);check('spawn_tool',ev('ecoLab.state.organisms.length')>before,{'before':before,'after':ev('ecoLab.state.organisms.length')})
click('Add food');before=ev('ecoLab.state.cellAt(600,420).food');tap(600,420);check('food_tool',ev('ecoLab.state.cellAt(600,420).food')>before,{'before':before,'after':ev('ecoLab.state.cellAt(600,420).food')})
click('Paint fertility');before=ev('ecoLab.state.cellAt(600,420).fertility');tap(600,420);check('fertility_tool',ev('ecoLab.state.cellAt(600,420).fertility')>before,{'before':before,'after':ev('ecoLab.state.cellAt(600,420).fertility')})
click('Cool local climate');tap(600,420);check('local_climate_tool',ev('ecoLab.state.cellAt(600,420).temperature')<0,ev('ecoLab.state.cellAt(600,420)'))
click('Protected observation area');tap(600,420);protected=ev('ecoLab.state.organisms.filter(o=>ecoLab.state.cellAt(o.x,o.y).protected).map(o=>o.id)');check('protected_area',len(protected)>0,{'protected_ids':protected,'tiles':ev('ecoLab.state.cells.filter(c=>c.protected).length')})
click('Paint barrier');stroke([(480,360),(530,360),(580,360),(630,360),(680,360)]);check('barrier_continuity',ev('ecoLab.state.cells.filter(c=>c.type==="barrier").length')>15,{'tiles':ev('ecoLab.state.cells.filter(c=>c.type==="barrier").length'),'inside_barriers':ev('ecoLab.state.organisms.filter(o=>ecoLab.state.cellAt(o.x,o.y).type==="barrier").length')});snap('painted-habitat')
protected=ev('ecoLab.state.organisms.filter(o=>ecoLab.state.cellAt(o.x,o.y).protected).map(o=>o.id)');click('More interventions ↗');before=ev('ecoLab.state.organisms.length');ab('click','[data-disaster=extinction]');after=ev('ecoLab.state.organisms.length');survivors=ev('ecoLab.state.organisms.map(o=>o.id)');check('extinction_and_protection',after<before*.5 and all(i in survivors for i in protected),{'before':before,'after':after,'protected_survived':len(protected)})
click('Remove entities and barriers');stroke([(480,360),(530,360),(580,360),(630,360),(680,360)]);check('erase_barriers',ev('ecoLab.state.cells.filter(c=>c.type==="barrier").length')==0,{'remaining':ev('ecoLab.state.cells.filter(c=>c.type==="barrier").length')})
# Acceleration keeps pointer painting and text input active.
click('32×');click('Resume');click('Paint fertility');t0=time.perf_counter();stroke([(480,500),(530,500),(580,500),(630,500),(680,500)]);latency=(time.perf_counter()-t0)*1000;click('Pause');check('accelerated_brush',ev('ecoLab.state.cellAt(580,500).fertility')>=.9,{'stroke_ms_including_cli':round(latency),'tick':ev('ecoLab.state.tick'),'fps':ev('ecoLab.view.fps')})
# Pan, wheel zoom, fit and keyboard navigation.
click('Pan world');old=ev('ecoLab.view.camera');stroke([(600,420),(660,445)]);new=ev('ecoLab.view.camera');check('pointer_pan',old['x']!=new['x'] and old['y']!=new['y'],{'before':old,'after':new})
subprocess.run(['node','evidence/wheel-check.cjs','evo-final'],check=True);newzoom=ev('ecoLab.view.camera.zoom');check('wheel_zoom',newzoom!=new['zoom'],{'before':new['zoom'],'after':newzoom});click('Fit world');ab('focus','#world');old=ev('ecoLab.view.camera.x');ab('press','ArrowRight');check('keyboard_pan',ev('ecoLab.view.camera.x')>old,ev('ecoLab.view.camera'));ab('press','0')
# Full screen uses the browser's real full-screen API.
click('Expand world');ab('wait','--fn','!!document.fullscreenElement');check('fullscreen',ev('document.fullscreenElement.id')=='worldPanel',ev('document.getElementById("world").getBoundingClientRect().toJSON()'));ab('press','Escape');ab('wait','--fn','!document.fullscreenElement')
# Preserve and restore brushes, protected cells and barriers via the delivered UI.
ab('download','#saveBtn','evidence/edited-habitat.json');before=state();click('Reset');load('edited-habitat.json');check('edited_habitat_persistence',m.digest(before)==m.digest(state()),{'tick':before['tick'],'protected_cells':sum(c['protected'] for c in before['cells'])})
# All curated presets initialize through the visible dropdown.
for preset in ['oscillation','islands','desert','radiation','recovery','dense']:
 ab('select','#presetSelect',preset);click('Pause');check('preset_'+preset,ev('ecoLab.state.preset')==preset,{'population':ev('ecoLab.state.organisms.length'),'width':ev('ecoLab.state.width'),'params':ev('ecoLab.state.params')})
 if preset=='islands':snap('island-preset')
 if preset=='dense':
  click('32×');click('Resume');ab('wait','--fn','ecoLab.state.tick>250');v=ev('ecoLab.view');click('Pause');check('dense_performance',v['fps']>15 and v['actualTPS']>30,{'fps':v['fps'],'ticks_per_second':v['actualTPS'],'population':ev('ecoLab.state.organisms.length')});snap('dense-stress')
check('no_browser_errors',not ab('errors').get('errors'),ab('errors').get('errors'))
