import importlib.util,pathlib,json
spec=importlib.util.spec_from_file_location('flow',pathlib.Path(__file__).with_name('browser-flows.py'));f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
for name in ['ROOT','cmd','js','shot','snap','world','clickmap','state']:globals()[name]=getattr(f,name)
def checksum():return js('JSON.stringify({city:Flowstate.snapshot().city,sim:Flowstate.snapshot().sim,paused:Flowstate.paused})')
def main():
    cmd('reload');cmd('set','viewport','1280','800');cmd('select','#scenarioSelect','downtown')
    if not js('Flowstate.paused'):cmd('click','#pauseButton')
    assert js('Flowstate.sim.passengers.some(p=>p.origin===12||p.destination===12)')
    cmd('click','#zoomIn');cmd('click','#zoomIn');cmd('click','[data-tool="delete"]')
    # Choose a junction hit unobstructed by a rendered car. The removal is a real pointer action.
    p=js('(()=>{const n=Flowstate.city.nodes.find(n=>n.id===12);for(let dx=-15;dx<=15;dx+=3)for(let dy=-15;dy<=15;dy+=3){const p={x:n.x+dx,y:n.y+dy},hit=hitTest(p);if(hit?.type==="node"&&hit.id===12)return p;}return null;})()')
    assert p,'junction must have an accessible hit target'
    before=checksum();clickmap(p['x'],p['y'])
    assert not js('Flowstate.city.nodes.some(n=>n.id===12)')
    assert not js('Flowstate.sim.passengers.some(p=>p.origin===12||p.destination===12)')
    assert js('validateSnapshot(Flowstate.snapshot());true')
    deleted=checksum();state('endpoint-deletion-retest');shot('endpoint-deletion-retest')
    cmd('click','#undoButton');assert checksum()==before
    cmd('click','#redoButton');assert checksum()==deleted
    # Export edited city, then change live time and reimport the downloaded file exactly.
    path=ROOT/'evidence/exports/deleted-endpoint-city.json'
    cmd('click','#saveButton');cmd('download','#downloadJson',str(path));cmd('click','[data-close="saveDialog"]')
    cmd('click','#stepButton');cmd('click','#saveButton');cmd('upload','#importFile',str(path));cmd('wait','--fn','!document.querySelector("#saveDialog").open')
    assert checksum()==deleted
    cmd('reload');assert checksum()==deleted
    print('PASS actual junction deletion cleans affected passenger endpoints; undo/redo, downloaded JSON import and autosave reload are exact')
    cmd('select','#scenarioSelect','downtown');cmd('click','#pauseButton');cmd('click','#settingsButton')
    cmd('fill','#setting-mapSize','600');cmd('press','Tab')
    assert js('Flowstate.city.size')==600
    assert js('Flowstate.diagnostics.overlaps')==0
    assert js('validateSnapshot(Flowstate.snapshot());true')
    cmd('click','[data-close="settingsDialog"]:not(.icon)');cmd('click','#stepButton')
    assert js('Flowstate.diagnostics.overlaps')==0
    state('map-shrink-retest');shot('map-shrink-retest')
    shrunken=checksum();cmd('reload');assert checksum()==shrunken
    cmd('click','[data-speed="30"]');cmd('click','#pauseButton');target=js('Flowstate.sim.time')+30
    cmd('wait','--fn',f'Flowstate.sim.time>{target}');cmd('click','#pauseButton')
    assert js('Flowstate.diagnostics.overlaps')==0 and js('Flowstate.diagnostics.illegalMovingEdges')==0
    assert js('validateSnapshot(Flowstate.snapshot());true')
    print('PASS actual populated map shrink, safe lane spacing, full state validation, exact reload and 30 seconds at 30x without overlaps')
    cmd('select','#scenarioSelect','downtown');cmd('click','#pauseButton');cmd('click','#overviewTab');cmd('click','#fitMap');cmd('select','#overlaySelect','city')
    shot('delivery-city')
if __name__=='__main__':main()
