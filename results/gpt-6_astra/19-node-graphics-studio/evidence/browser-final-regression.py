from importlib.machinery import SourceFileLoader
m=SourceFileLoader('browser','evidence/browser-workflow.py').load_module()
globals().update({k:v for k,v in m.__dict__.items() if not k.startswith('__')})
# Save the present graph for restoration.
original=js('studio.project');(ROOT/'regression-original.json').write_text(json.dumps(original))
# Redo remains available after selecting a header.
click('.node[data-id="7"] .node-head');run('fill','[aria-label="Contrast value"]','1.8');run('press','Enter')
click('[aria-label="Undo"]');assert not js('document.querySelector("#redoBtn").disabled')
click('.node[data-id="3"] .node-head');assert not js('document.querySelector("#redoBtn").disabled')
click('[aria-label="Redo"]');assert js('studio.project.nodes.find(n=>n.id===7).p.contrast')==1.8
log('selection preserves redo',state())
# Box selection using real held Shift plus pointer drag.
run('keydown','Shift');drag({'x':225,'y':170},{'x':670,'y':560});run('keyup','Shift');assert len(state()['selection'])>=6
log('box selection',state()['selection'])
# Collapse and expand a real node, pan with held Space, then focus-loss cancellation.
click('[aria-label="Collapse Time"]');assert js('studio.project.nodes.find(n=>n.id===2).collapsed')
click('[aria-label="Expand Time"]');assert not js('studio.project.nodes.find(n=>n.id===2).collapsed')
b=state()['view'];run('keydown','Space');drag({'x':676,'y':200},{'x':638,'y':235});run('keyup','Space');assert state()['view']['x']!=b['x']
click('[aria-label="Fit graph"]')
log('collapse and space-pan',state()['view'])
# An imported but valid dense graph may never be invalidated by paste.
nodes=[{'id':i,'type':'constant','x':30+(i-1)*190,'y':70,'p':{'value':.3},'keys':{}} for i in range(1,4)]
for i in range(4,69):nodes.append({'id':i,'type':'blend','x':30+((i-1)%10)*190,'y':70+((i-1)//10)*180,'p':{'opacity':.5,'mode':0},'keys':{}})
dense={**original,'name':'Dense edge limit test','nodes':nodes,'edges':[{'from':j+1,'to':i,'port':j} for i in range(4,69) for j in range(3)],'frames':[]}
dense['settings']['resolution']=128;dense['settings']['quality']=0
(ROOT/'dense-limit.json').write_text(json.dumps(dense))
run('upload','#projectFile',ROOT/'dense-limit.json');run('wait','--fn','studio.diagnostics.nodes===68 && !needsRender')
click('.node[data-id="1"] .node-head');run('keydown','Shift')
for i in [2,3,4,5]:click(f'.node[data-id="{i}"] .node-head')
run('keyup','Shift');assert len(state()['selection'])==5
run('press','Control+c');before=js('JSON.stringify(studio.project)');run('press','Control+v')
assert js('JSON.stringify(studio.project)')==before
msg=js('document.querySelector("#toast").textContent');assert '200' in msg
assert js('studio.validate(studio.project).ok')
log('paste transaction rejects edge overflow',{'toast':msg,'state':state()});snap('21-paste-boundary.png')
run('upload','#projectFile',ROOT/'regression-original.json');run('wait','--fn','studio.diagnostics.nodes===9 && !needsRender')
# Invalid output is editable and recovers via Undo.
click('.node[data-id="9"] .node-head');run('scrollintoview','[aria-label="Disconnect Surface"]');click('[aria-label="Disconnect Surface"]')
assert state()['status']=='incomplete';assert 'no Surface' in state()['error'];assert js('studio.validate(studio.project).ok')
snap('22-incomplete-output.png');click('[aria-label="Undo"]');assert state()['status']=='ready'
log('incomplete graph recovery',state())
# Final shader specialization regression: intermediates, diagnostics, exports of FINAL while intermediate selected.
run('select','[aria-label="Preview output"]','5');run('wait','--fn','!needsRender');assert state()['root']==5
click('#exportBtn');run('select','#exportResolution','256');run('download','#exportGo',ROOT/'downloads'/'final-from-intermediate.png');click('#closeModal')
run('select','[aria-label="Preview output"]','0');run('wait','--fn','!needsRender')
click('#settingsTab');run('select','#resolution','256');run('wait','--fn','!needsRender')
# Store actual Canvas pixels for an independent comparison with the PNG decoder.
b64=js('document.querySelector("#previewCanvas").toDataURL().split(",")[1]')
import base64
(ROOT/'downloads'/'live-final.png').write_bytes(base64.b64decode(b64))
for diag in [5,6,7,8,9,10,11,12]:
    run('select','#diagnostic',diag);run('wait','--fn','!needsRender')
    log('settled diagnostic '+str(diag),{'status':state()['status'],'pixel':js('Array.from(document.querySelector("#previewCanvas").getContext("2d").getImageData(120,120,1,1).data)')})
run('select','#diagnostic','0');run('select','#theme','contrast');run('wait','--fn','!needsRender');snap('23-high-contrast.png')
run('select','#theme','dark');click('#propertiesTab')
# Test cancellation via ×, backdrop, and button, then a successful sequence.
for method in ['#closeModal','backdrop','#exportCancel']:
    click('#exportBtn');run('select','#exportFormat','sequence');run('select','#exportResolution','256');run('fill','#exportFrames','120');run('click','#exportGo')
    if method=='backdrop':drag({'x':50,'y':50},{'x':50,'y':50})
    else:run('click',method)
    assert not js('exporting'),method
    log('export cancellation '+method,{'exporting':js('exporting'),'modal':js('!!document.querySelector(".modal")')})
click('#exportBtn');run('select','#exportFormat','sequence');run('select','#exportResolution','256');run('fill','#exportFrames','4');run('download','#exportGo',ROOT/'downloads'/'final-frames.tar');click('#closeModal')
log('successful sequence after cancellation',js('lastExport'))
run('errors');run('console');run('network','requests')
