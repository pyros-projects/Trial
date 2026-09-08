from pathlib import Path
import xml.etree.ElementTree as ET,struct,json
ns='{http://www.w3.org/2000/svg}'
s=Path('evidence/artwork.svg').read_text();root=ET.fromstring(s)
print('SVG dimensions:',root.attrib['width'],root.attrib['height'])
print('SVG geometry:',[(t,len(root.findall('.//'+ns+t))) for t in ['path','rect','ellipse','text']])
assert root.attrib['width']=='1200' and root.attrib['height']=='800'
assert len(root.findall('.//'+ns+'path'))==2
assert not root.findall('.//'+ns+'ellipse'),'hidden Companion excluded'
for el in root.iter():
 assert el.tag not in [ns+t for t in ['script','foreignObject','image']]
 for k,v in el.attrib.items():
  assert not k.lower().startswith('on')
  assert not any(v.startswith(t) for t in ['http:','https:','//','javascript:'])
text=''.join(root.itertext());assert '<img src=x onerror=alert(1)> & "layout"' in text
from png_utils import png_pixel
for filename,size in [('artwork-1x.png',(1200,800)),('artwork-2x.png',(2400,1600))]:
 b=Path('evidence/'+filename).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';dims=struct.unpack('>II',b[16:24]);assert dims==size;print(filename,dims,len(b),'bytes')
 assert png_pixel('evidence/'+filename,0,0)==(255,255,255,255)
print('PASS: vector SVG, literal escaped text, hidden ellipse omitted, matching PNG dimensions and background.')
# Declared multiline layout box is the same one serialized to vector text.
src=json.loads(Path('evidence/roundtrip.json').read_text());text_item=next(o for o in src['items'] if o['type']=='text');lines=root.findall('.//'+ns+'text');width=max(float(e.attrib['textLength']) for e in lines);height=text_item['fontSize']+(len(lines)-1)*text_item['fontSize']*text_item['lineHeight'];m=text_item['transform'];points=[(m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]) for x,y in [(0,0),(width,0),(width,height),(0,height)]];actual={'x':min(p[0] for p in points),'y':min(p[1] for p in points),'w':max(p[0] for p in points)-min(p[0] for p in points),'h':max(p[1] for p in points)-min(p[1] for p in points)};diagnostics=json.loads(Path('evidence/11-export-source.json').read_text());expected=next(o['bounds'] for o in diagnostics['items'] if o['id']==text_item['id']);assert all(abs(actual[k]-expected[k])<.001 for k in actual);print('PASS: exported multiline advances/baselines and rotation reproduce inspector text layout bounds:',actual)
