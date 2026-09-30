import importlib.util,pathlib,json
spec=importlib.util.spec_from_file_location('flow',pathlib.Path(__file__).with_name('browser-flows.py'));f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
for name in ['ROOT','cmd','js','shot','snap','world','clickmap','state']:globals()[name]=getattr(f,name)
def drag(points):
    cmd('mouse','move',*world(*points[0]));cmd('mouse','down')
    for p in points[1:]:cmd('mouse','move',*world(*p))
    cmd('mouse','up')
def setting(sel,val):cmd('fill',sel,val);cmd('press','Tab')
def main():
    cmd('reload');cmd('set','viewport','1280','800');cmd('select','#scenarioSelect','stress');cmd('click','#pauseButton');cmd('scroll','up','2000')
    r=js('(()=>{const r=Flowstate.city.roads.filter(r=>r.lanes>1).sort((a,b)=>b._queue-a._queue)[0],a=Flowstate.city.nodes.find(n=>n.id===r.a),b=Flowstate.city.nodes.find(n=>n.id===r.b);return {id:r.id,x:(a.x+b.x)/2,y:(a.y+b.y)/2};})()')
    cmd('click','[data-tool="incident"]');clickmap(r['x'],r['y']);cmd('uncheck','#roadClosed');cmd('select','#roadLanes','1');cmd('click','#stepButton')
    lane=state('lane-removal-browser-retest');shot('lane-removal-retest');assert lane['diag']['overlaps']==0 and lane['diag']['illegalMovingEdges']==0 and lane['metrics']['failed']>0
    cmd('select','#roadLanes','2')
    n=js('(()=>{const n=Flowstate.city.nodes.find(n=>n.signal);return {id:n.id,x:n.x,y:n.y};})()');cmd('click','[data-tool="roundabout"]');clickmap(n['x'],n['y']);assert js(f'Flowstate.city.nodes.find(n=>n.id==={n["id"]}).junction')=='roundabout';cmd('click','#stepButton');assert js('Flowstate.diagnostics.overlaps')==0
    print('PASS busy-lane removal regression in actual browser: affected trips fail, zero overlaps; reserved roundabout control edit')
    cmd('select','#scenarioSelect','empty');cmd('click','#pauseButton');cmd('click','[data-tool="road"]');cmd('scroll','up','2000')
    drag([(250,250),(1250,250),(1250,800),(250,800),(250,250)])
    drag([(750,250),(750,800)])
    assert js('Flowstate.city.roads.length')>=7 and js('Flowstate.diagnostics.components')==1
    cmd('click','[data-tool="zone"]');cmd('select','#zoneType','residential');clickmap(300,750)
    cmd('click','[data-tool="zone"]');cmd('select','#zoneType','commercial');clickmap(800,300)
    cmd('click','[data-tool="zone"]');cmd('select','#zoneType','industrial');clickmap(1300,750)
    cmd('click','[data-tool="parking"]');clickmap(1000,860)
    assert js('Flowstate.city.zones.length')==4
    cmd('click','#settingsButton');cmd('uncheck','#setting-sandbox');setting('#setting-budget','1');cmd('click','[data-close="settingsDialog"]:not(.icon)')
    count=js('Flowstate.city.roads.length');nodes=js('Flowstate.city.nodes.length');cmd('click','[data-tool="road"]');drag([(250,250),(250,100)])
    assert js('Flowstate.city.roads.length')==count and js('Flowstate.city.nodes.length')==nodes
    assert 'budget exhausted' in cmd('get','text','#toast')
    cmd('click','#settingsButton');cmd('check','#setting-sandbox');setting('#setting-mapSize','1800');setting('#setting-seed','42');setting('#setting-demand','2');setting('#setting-headway','.8');cmd('select','#setting-policy','fixed');cmd('click','[data-close="settingsDialog"]:not(.icon)')
    cmd('click','#resetButton');assert js('Flowstate.sim.time')==0 and js('Flowstate.sim.rng')==42
    cmd('click','[data-speed="30"]');cmd('click','#pauseButton');cmd('wait','--fn','Flowstate.sim.time>220');cmd('click','#pauseButton')
    custom=state('custom-built-city');shot('custom-built-city')
    assert custom['metrics']['completed']>0 and custom['diag']['activeCars']>0 and custom['diag']['activeFreight']>0
    assert js('Flowstate.sim.vehicles.every(v=>v.origin!==v.destination)')
    assert custom['diag']['overlaps']==0 and custom['diag']['illegalMovingEdges']==0
    print('PASS empty-city construction, crossing graph, actual residential/commercial/industrial/parking demand, budget rejection without mutation, map size, seed replay, fixed policy and real OD completions')
    cmd('select','#scenarioSelect','downtown');cmd('click','#pauseButton');cmd('click','[data-view="analytics"]');cmd('click','#compareButton');cmd('wait','--fn','window.lastComparison && document.querySelector("#compareResults table")')
    comparison=js('lastComparison');assert comparison['carOnly']['generated']==comparison['transit']['generated'];assert comparison['transit']['ridership']>0 and comparison['transit']['transitCompleted']>0
    (ROOT/'evidence/logs/final-comparison.json').write_text(json.dumps(comparison,indent=2));shot('final-mode-comparison');cmd('click','[data-close="compareDialog"]');cmd('click','[data-view="map"]')
    cmd('select','#scenarioSelect','stress');cmd('click','[data-speed="30"]');cmd('wait','--fn','Flowstate.sim.time>340');cmd('click','#pauseButton')
    stress=state('final-browser-stress');assert stress['diag']['overlaps']==0 and stress['diag']['illegalMovingEdges']==0;assert js('Flowstate.sim.vehicles.length+Flowstate.sim.passengers.length')>1000
    shot('final-stress');print('PASS final matched mode comparison and >1000 actual agents in stress preset with zero lane-overlap / illegal-edge diagnostics')
    cmd('select','#scenarioSelect','downtown');cmd('click','#pauseButton');cmd('click','#overviewTab');cmd('select','#overlaySelect','city');cmd('click','#fitMap');cmd('scroll','up','2000');shot('delivery-city')
    cmd('errors','--json');cmd('console','--json');cmd('network','requests')

if __name__=='__main__':main()
