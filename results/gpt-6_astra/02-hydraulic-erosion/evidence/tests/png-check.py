from importlib.machinery import SourceFileLoader
from pathlib import Path
import json,base64
m=SourceFileLoader('actions',str(Path(__file__).with_name('browser-actions.py'))).load_module()
b64=base64.b64encode((m.root/'downloads/terra-4242-heightfield.png').read_bytes()).decode()
code='(async()=>{const im=new Image();im.src="data:image/png;base64,'+b64+'";await im.decode();const c=document.createElement("canvas");c.width=im.width;c.height=im.height;const ctx=c.getContext("2d");ctx.drawImage(im,0,0);return {width:c.width,height:c.height,pixels:Array.from(ctx.getImageData(0,0,c.width,c.height).data)}})()'
image=m.js(code);s=json.loads((m.root/'downloads/terra-4242-state.json').read_text());n=s['n'];h=s['layers']['h'];lo=min(h);hi=max(h);assert image['width']==image['height']==n;grays=set()
for i in range(n*n):
 r,g,b,a=image['pixels'][i*4:i*4+4]
 assert r==g==b and a==255
 assert r==int((h[i]-lo)/(hi-lo)*255+.5)
 grays.add(r)
result={'dimensions':[n,n],'distinct_grays':len(grays),'all_pixels_match_normalized_height':True,'decoder':'Actual Chromium Image and 2D canvas'}
(m.root/'logs/png-check.json').write_text(json.dumps(result,indent=2));print(result)
