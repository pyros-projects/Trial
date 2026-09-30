import pathlib,json,xml.etree.ElementTree as ET,runpy
ROOT=pathlib.Path(__file__).resolve().parent
dimensions=runpy.run_path(str(ROOT/'png-checks.py'))['dimensions']
NS='{http://www.w3.org/2000/svg}'
allowed={'svg','title','defs','clipPath','g','rect','ellipse','line','path','text','tspan'}
results=[]
for name in ['artwork.svg','direct-final.svg','layer-order.svg','locked-visible.svg','clipped.svg']:
    raw=(ROOT/'downloads'/name).read_text();root=ET.fromstring(raw)
    assert root.tag==NS+'svg' and root.find(NS+'defs/'+NS+'clipPath') is not None
    for e in root.iter():
        assert e.tag.removeprefix(NS) in allowed,e.tag
        for k,v in e.attrib.items():
            assert not k.lower().startswith('on') and not k.endswith('href')
            if 'url(' in v:assert v=='url(#form-artboard-clip)'
        assert 'data-item' not in e.attrib and 'data-handle' not in e.attrib
    results.append({'file':name,'result':'pass','dimensions':[root.attrib['width'],root.attrib['height']],'vectorElements':sum(e.tag in [NS+'rect',NS+'ellipse',NS+'line',NS+'path',NS+'text'] for e in root.iter())})
root=ET.parse(ROOT/'downloads'/'artwork.svg').getroot();raw=(ROOT/'downloads'/'artwork.svg').read_text()
assert '&lt;img src=x onerror=alert(1)&gt; &amp; "layout"' in raw
spans=list(root.iter(NS+'tspan'));assert spans[0].text=='<img src=x onerror=alert(1)> & "layout"'
assert len(list(root.iter(NS+'path')))==1 and ' C ' in next(root.iter(NS+'path')).attrib['d']
assert len(list(root.iter(NS+'line')))==0 # Rule is hidden in the downloaded project.
assert [e.attrib['fill'] for e in ET.parse(ROOT/'downloads'/'layer-order.svg').getroot().iter(NS+'rect') if e.attrib.get('fill') and e.attrib['fill']!='#ffffff']==['#6674c0','#bb593e']
assert {e.attrib.get('fill') for e in ET.parse(ROOT/'downloads'/'locked-visible.svg').getroot().iter(NS+'rect')} >= {'#6674c0','#bb593e'}
scene=json.loads((ROOT/'export-scene.json').read_text());note=next(e for e in scene['items'] if e['name']=='Notes');w=max(float(e.attrib['textLength']) for e in spans);h=18+18*1.6;m=note['worldMatrix']
points=[(m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]) for x,y in [(0,0),(w,0),(w,h),(0,h)]]
derived={'x':min(p[0] for p in points),'y':min(p[1] for p in points),'w':max(p[0] for p in points)-min(p[0] for p in points),'h':max(p[1] for p in points)-min(p[1] for p in points)}
assert all(abs(derived[k]-note['bounds'][k])<1e-7 for k in derived)
for name,size in [('direct-final.png',(960,680)),('clipped.png',(64,512))]:assert dimensions(ROOT/'downloads'/name)==size
files=json.loads((ROOT/'opaque-files.json').read_text());assert dimensions(pathlib.Path(files['#downloadPNG']))==(960,680)
(ROOT/'svg-results.json').write_text(json.dumps({'files':results,'literalTextSafe':True,'hiddenRuleExcluded':True,'layerOrderPreserved':True,'lockedVisibleExported':True,'exportTextBounds':derived,'pngFinalDimensionsVerified':True},indent=2))
print('PASS downloaded vector SVG safe subset, escaped literal text, curve data, hidden/layer/lock behavior, transformed text metrics, final direct and opaque PNG dimensions')
