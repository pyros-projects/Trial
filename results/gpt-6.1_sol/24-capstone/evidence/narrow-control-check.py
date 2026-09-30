"""A visual boundary regression: visible drawing controls fit the actual card."""
import importlib.util, pathlib, json, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('checks',ROOT/'evidence/browser-checks.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
phase=sys.argv[1] if len(sys.argv)>1 else 'final'
b.LOG=ROOT/f'evidence/logs/narrow-controls-{phase}-commands.jsonl'
b.run('set','viewport',390,844);b.run('open','file://'+str(ROOT/'index.html'))
b.click('01Make a memory','tab');b.run('find','label','Word to inscribe','fill','KEEPTHIS');b.run('press','Enter')
observed=b.js("(() => {const card=document.querySelector('.workbench').getBoundingClientRect();return {card:{left:card.left,right:card.right},controls:['palette','drawSize','wordInput','inscribeButton','exampleSelect'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,left:r.left,right:r.right,fits:r.left>=card.left&&r.right<=card.right};}),title:Afterimage.diagnostics().title};})()")
b.shot(f'narrow-controls-{phase}.png',True)
observed['status']='pass' if all(x['fits'] for x in observed['controls']) else 'fail'
(ROOT/f'evidence/logs/narrow-controls-{phase}-result.json').write_text(json.dumps(observed,indent=2))
print(json.dumps(observed),flush=True)
b.check(observed['status']=='pass','All labeled drawing controls must fit the visible card, without being clipped by overflow')
