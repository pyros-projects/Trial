from importlib.machinery import SourceFileLoader
m=SourceFileLoader('browser','evidence/browser-workflow.py').load_module()
globals().update({k:v for k,v in m.__dict__.items() if not k.startswith('__')})
r=js('(()=>{const r=document.querySelector("#timelineRail").getBoundingClientRect();return {x:r.x+17+(r.width-34)*.25,y:r.y+23}})()');drag(r,r)
run('fill','[aria-label="Shadows hex"]','#ee8844');run('press','Enter');click('[aria-label="Keyframe Shadows"]')
run('select','#interpolation','linear')
assert js('GraphCore.sampleKeys(studio.project.nodes.find(n=>n.id===7).keys.shadow,1,"linear")')=='#885e77'
log('real color parameter and keyframes',js('studio.project.nodes.find(n=>n.id===7).keys'))
# Add and move a comment through the actual graph context menu.
run('mouse','move',677,150);run('mouse','down','right');run('mouse','up','right');run('click','[data-menu="5"]');run('fill','#commentText','Flow study — try a warmer palette.');click('#saveComment')
assert js('studio.project.frames.some(f=>f.comment&&f.label.includes("Flow study"))')
log('context-menu comment creation',js('studio.project.frames.filter(f=>f.comment)'))
# Clear test changes with a fully visible preset load and retain a polished default.
click('#presetsBtn');run('wait','--fn','thumbData.size===10');click('[data-preset="0"]');run('wait','--fn','studio.project.name==="Chromatic currents"&&studio.diagnostics.nodes===9');click('[aria-label="Pause playback"]');click('[aria-label="Reset timeline"]')
# A focused graph edit and connection regression after compiler/history changes.
click('[data-add="constant"]');nid=js('studio.project.nodes.at(-1).id');p=rect(f'.node[data-id="{nid}"] .node-head');drag(p,{'x':p['x']-110,'y':p['y']+58})
drag(rect(f'.port.out[data-id="{nid}"]'),rect('.port.in[data-id="7"][data-port="0"]'));assert js('studio.project.edges.find(e=>e.to===7&&e.port===0).from')==nid
run('fill','[aria-label="Value value"]','.25');run('press','Enter');run('wait','--fn','!studio.diagnostics.needsRender')
log('final added node and drag connection',state())
# Restore through actual ports and delete the temporary node.
click('.port.out[data-id="6"]');click('.port.in[data-id="7"][data-port="0"]');click(f'.node[data-id="{nid}"] .node-head');run('press','Delete');click('.node[data-id="7"] .node-head')
click('[aria-label="Fit graph"]');click('[aria-label="Play animation"]');run('wait','--fn','studio.diagnostics.frame>35');run('wait','--fn','studio.diagnostics.fps>10')
log('final animated desktop',state());snap('25-final-desktop.png')
run('set','viewport','390','844','2');click('button[data-mobile="preview"]');snap('26-final-mobile-preview.png');click('button[data-mobile="inspector"]');run('fill','[aria-label="Offset value"]','0.12');run('press','Enter');assert js('studio.project.nodes.find(n=>n.id===7).p.offset')==.12
run('fill','[aria-label="Offset value"]','0');run('press','Enter');click('button[data-mobile="graph"]');click('[aria-label="Toggle box selection"]');drag({'x':8,'y':168},{'x':377,'y':569});assert len(state()['selection'])>=6;click('[aria-label="Toggle box selection"]');snap('27-final-mobile-box-selection.png')
log('final narrow editing and touch-friendly box mode',{'width':js('document.documentElement.scrollWidth'),'state':state()})
run('set','viewport','1280','800','1');click('.node[data-id="7"] .node-head');click('[aria-label="Fit graph"]');snap('28-final-workspace.png')
run('errors');run('console');run('network','requests')
