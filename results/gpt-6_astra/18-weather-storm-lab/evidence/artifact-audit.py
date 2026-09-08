import re,hashlib,json
from pathlib import Path
html=Path('index.html').read_text()
for name in ('model','render','app'):
 marker=f'<!-- {name.upper()}_SCRIPT -->\n<script>\n';start=html.index(marker)+len(marker);end=html.index('\n</script>\n<!-- END_'+name.upper()+'_SCRIPT -->',start)
 assert html[start:end]==Path(f'evidence/{name}.js').read_text(),name+' embedded source differs'
assert not re.search(r'<script[^>]+src=|<link[^>]+href=|\bfetch\s*\(|\bimport\s*\(',html,re.I)
assert not re.search(r'url\([\"\']?https?://',html,re.I)
assert not re.search(r'<(?:img|video|audio|iframe)[^>]+src=',html,re.I)
print(json.dumps({'status':'pass','path':'index.html','bytes':len(html.encode()),'sha256':hashlib.sha256(html.encode()).hexdigest(),'embedded_sources_match':True,'external_runtime_dependencies':0},indent=2))
