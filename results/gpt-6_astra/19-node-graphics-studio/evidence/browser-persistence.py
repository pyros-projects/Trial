from importlib.machinery import SourceFileLoader
m=SourceFileLoader('browser','evidence/browser-workflow.py').load_module()
globals().update({k:v for k,v in m.__dict__.items() if not k.startswith('__')})
run('fill','#localName','Validation currents')
click('#saveLocal')
assert js('JSON.parse(localStorage.getItem("formlab-projects-v1"))[0].name')=='Validation currents'
run('download','#downloadJSON',ROOT/'downloads'/'currents.json')
graph=json.loads((ROOT/'downloads'/'currents.json').read_text());assert len(graph['nodes'])==9 and len(graph['edges'])==12
log('named project and JSON export',{'name':graph['name'],'nodes':len(graph['nodes']),'keys':graph['nodes'][6]['keys']})
click('#closeModal')
# Change a parameter, restore the named project, and verify it was actually restored.
run('fill','[aria-label="Offset value"]','0.35');run('press','Enter')
click('#projectsBtn');click('[data-load-local="0"]')
assert js('studio.project.nodes.find(n=>n.id===7).p.offset')==0
log('named project reload restores parameters',state())
# Import the actual downloaded file using a file picker input.
run('upload','#projectFile',ROOT/'downloads'/'currents.json')
run('wait','--fn','!needsRender')
assert js('studio.project.name')=='Validation currents'
# Malformed inputs must not mutate current graph.
bad={**graph,'nodes':graph['nodes']+[graph['nodes'][0]]}
(ROOT/'invalid-duplicate.json').write_text(json.dumps(bad))
before=js('JSON.stringify(studio.project)')
run('upload','#projectFile',ROOT/'invalid-duplicate.json')
assert js('JSON.stringify(studio.project)')==before
msg=js('document.querySelector("#toast").textContent');assert 'duplicate' in msg
log('invalid JSON import rejected without mutation',msg);snap('11-invalid-import.png')
# Compact share text round trip through the real dialog.
click('#moreBtn');click('[data-menu="3"]')
run('wait','--fn','document.querySelector("#shareText")?.value.startsWith("FL1")')
share=js('document.querySelector("#shareText").value');assert len(share)<len(json.dumps(graph))
(ROOT/'downloads'/'currents.form').write_text(share)
click('#loadShare');assert js('studio.project.name')=='Validation currents'
log('compact graph round trip',{'shareBytes':len(share),'jsonBytes':len(json.dumps(graph))})
# Export still, with dimensions and pixels validated outside the browser.
click('#exportBtn');run('select','#exportResolution','256')
run('download','#exportGo',ROOT/'downloads'/'currents.png')
log('PNG export',js('lastExport'))
# Export genuine animation frames, then test safe export bounds.
run('select','#exportFormat','sequence');run('select','#exportResolution','256');run('fill','#exportFrames','4')
run('download','#exportGo',ROOT/'downloads'/'currents-frames.tar')
log('PNG frame sequence export',js('lastExport'))
run('select','#exportResolution','2048');click('#exportGo')
msg=js('document.querySelector("#exportError").textContent');assert 'budget' in msg
log('oversize animation export rejected',msg)
run('select','#exportFormat','glsl');run('download','#exportGo',ROOT/'downloads'/'currents.frag')
assert (ROOT/'downloads'/'currents.frag').stat().st_size>1000
click('#closeModal')
# Autosave navigation, preserving actual graph data.
run('wait','--fn','document.querySelector("#autosaveState").textContent.includes("Autosaved")')
before=js('studio.project.nodes')
run('reload');run('wait','--fn','studio.diagnostics.renderCount>2')
assert js('studio.project.nodes')==before
click('[aria-label="Pause playback"]')
log('direct-file autosave restoration after reload',state())
run('errors');run('console');run('network','requests')
