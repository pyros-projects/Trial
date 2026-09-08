from pathlib import Path
exec(Path('evidence/browser-flows.py').read_text().split('\ntry:\n')[0].replace('results={}',"results=json.loads((root/'logs/browser-results.json').read_text())"))
def cdp(*args):
 cmd=['node',str(root/'cdp-input.cjs'),*map(str,args)];log.write('$ '+shlex.join(cmd)+'\n');subprocess.run(cmd,check=True,stdout=log,stderr=log,timeout=20)
def load(path):
 run('upload','#stateFile',str(path));run('wait','--fn','document.getElementById("stateFile").value === ""')
try:
 button('Map');run('select','#modeSelect','2');shot('mobile-map-fit');box=js("(()=>{let r=document.getElementById('weatherCanvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()")
 x=round(box['x']+box['w']/2);y=round(box['y']+box['h']/2+30)
 button('Inject moisture');a=diag('touch-before');cdp('touch',x-40,y,x+40,y+25);b=diag('touch-after');check('touch-brush-continuity',b['fields']['q']['checksum']!=a['fields']['q']['checksum'] and b['input']['activePointers']==0 and b['input']['brushStrokes']>a['input']['brushStrokes'])
 button('Orbit camera');a=diag('pinch-before');cdp('pinch',x,y,80,145);b=diag('pinch-after');check('touch-pinch-zoom',b['camera']['mapZoom']<a['camera']['mapZoom'] and b['input']['activePointers']==0)
 button('Place probe');cdp('touch',x+60,y,x+60,y);button('Inspect vertical probe column');shot('mobile-probe');button('Close probe');button('3D view');run('select','#modeSelect','0');button('Resume simulation');run('wait','--fn','weatherLab.diagnostics().steps > 12');button('Pause simulation');shot('mobile-weather-final')
 check('mobile-rendering',diag('mobile-final')['ready'])
 # High DPI resize, final logs.
 run('set','viewport','1280','800','2');button('Open settings');run('select','#qualitySelect','low');button('Close settings');d=diag('high-dpi');check('high-dpi-resize',js('devicePixelRatio')==2 and d['ready'])
 run('set','viewport','1280','800','1');run('select','#presetSelect','supercell');button('Open settings');run('select','#resolutionSelect','32');run('select','#layersSelect','12');run('select','#qualitySelect','balanced');run('uncheck','#vectorsToggle');button('Close settings');button('Reset simulation');button('Resume simulation');run('wait','--fn','weatherLab.diagnostics().time >= 75');button('Pause simulation');shot('desktop-final');diag('final-desktop');run('console');run('errors');run('network','requests');

 print('MOBILE AND FINAL REGRESSION FINISHED',flush=True)
except Exception as e:
 log.write('FAILURE: '+repr(e)+'\n');print('FAILED:',repr(e),flush=True);sys.exit(1)
