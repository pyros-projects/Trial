import importlib.util
spec=importlib.util.spec_from_file_location('driver',__import__('pathlib').Path(__file__).parent/'browser-checks.py')
driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
globals().update({k:v for k,v in vars(driver).items() if not k.startswith('_')})
res=[]
for name,key in [('The playground','playground'),('Hanging flag','flag'),('Cloth & stone','drape'),('Bridge under load','bridge'),('Soft-body stack','stack'),('Suspended ropes','ropes'),('Balloon chamber','balloons'),('Destructive stress test','stress')]:
    ensurepause();click('Load '+name);before=state();t=runframes(150);ab('select','#view-mode','stress' if key=='stress' else 'material');snap('scene-'+key+'.png')
    finite=t['stats'].get('recoveries',0)==0 and all(math.isfinite(p['x']) and math.isfinite(p['y']) and 0<=p['x']<=1100 and 0<=p['y']<=660 for p in t['particles'])
    motion=max(math.dist((a['x'],a['y']),(b['x'],b['y'])) for a,b in zip(before['particles'],t['particles']))
    pressures=[round(b['area']/b['restArea'],5) for b in t['bodies'] if b['type']=='balloon' and b['closed']]
    r={'scene':key,'status':'pass' if finite and motion>1 and (key!='stress' or t['stats']['tears']>0) else 'fail','motion':motion,'stats':t['stats'],'pressureRatios':pressures};res.append(r);print(json.dumps(r),flush=True)
(ROOT/'logs'/'scenarios.json').write_text(json.dumps(res,indent=2))
print(ab('errors'));print(ab('console'));print(ab('network','requests'))
