from browser_checks import *

run('open','file:///home/pyro/projects/naked/sol61/22-vector-layout-studio/index.html')
run('set','viewport',1280,800,1)
run('wait','--fn','typeof studioDiagnostics === "object"')
assert state()['counts']['items']==17 and state()['history']=={'undo':0,'redo':0}
layer('Lavender gesture');prop('Fill color','#a2bccd')
layer('Headline');run('fill','[aria-label="Text content"]','Make room\nfor layout.');run('press','Control+Enter')
assert state()['document']['items'][3]['g']['text']=='Make room\nfor layout.'
layer('Small green sun');before=state();gesture(screen(863,447),screen(881,459))
assert state()['document']!=before['document']
shot('14-direct-file.png')
saved=state()['document']
button('Open export dialog')
run('download','#downloadProject',str(ROOT/'downloads'/'direct-final.json'))
run('download','#downloadSVG',str(ROOT/'downloads'/'direct-final.svg'))
run('download','#downloadPNG',str(ROOT/'downloads'/'direct-final.png'))
button('Close dialog');button('Reset')
run('upload','#projectFile',str(ROOT/'downloads'/'direct-final.json'))
run('wait','--fn','studioDiagnostics.status.startsWith("Imported")')
assert state()['document']==saved and state()['history']=={'undo':0,'redo':0}
run('reload');assert state()['counts']['items']==17 and state()['history']=={'undo':0,'redo':0}
assert state()['document']['items'][3]['g']['text']=='Make room\nfor ideas.'
errors=json.loads(run('errors','--json'))['data']['errors'];assert not errors,errors
record('direct-final-state',state())
(ROOT/'direct-final-errors.json').write_text(run('errors','--json'))
(ROOT/'direct-final-console.json').write_text(run('console','--json'))
(ROOT/'direct-final-network.json').write_text(run('network','requests','--json'))
print('PASS delivered file opens directly, shape/text editing and pointer drag, actual JSON/SVG/PNG downloads, reimport, reload fresh start, zero uncaught errors')
