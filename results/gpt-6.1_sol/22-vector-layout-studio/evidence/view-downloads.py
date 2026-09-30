from browser_checks import *

run('set','viewport',1280,800,1)
results=[]
for filename,screenshot in [('artwork.svg','29-downloaded-svg.png'),('artwork-1x.png','30-downloaded-png.png'),('artwork-2x.png','33-downloaded-png-2x.png'),('direct-final.svg','31-direct-export-svg.png')]:
    run('open',(ROOT/'downloads'/filename).as_uri());shot(screenshot)
    if filename.endswith('.png'):
        dims=ev('({w:document.querySelector("img").naturalWidth,h:document.querySelector("img").naturalHeight})');assert dims==({'w':1200,'h':800} if filename=='artwork-1x.png' else {'w':2400,'h':1600});results.append({'file':filename,'dimensions':dims,'opened':'pass'})
    else:
        d=ev('({root:document.documentElement.localName,paths:document.querySelectorAll("path").length,text:[...document.querySelectorAll("tspan")].map(x=>x.textContent)})');assert d['root']=='svg' and d['paths']>0
        if filename=='artwork.svg':assert d['text'][0]=='<img src=x onerror=alert(1)> & "layout"'
        results.append({'file':filename,'opened':'pass','content':d})
    assert not json.loads(run('errors','--json'))['data']['errors']
record('opened-export-files',results)
(ROOT/'export-view-console.json').write_text(run('console','--json'))
(ROOT/'export-view-errors.json').write_text(run('errors','--json'))
print('PASS actual downloaded SVG/PNG/2× PNG/edited poster SVG opened in browser, natural dimensions and literal text inspected, screenshots captured')
