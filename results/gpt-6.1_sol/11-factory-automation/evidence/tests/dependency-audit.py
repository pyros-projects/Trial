from html.parser import HTMLParser
from pathlib import Path
import re
p=Path(__file__).resolve().parents[2]/'index.html'
s=p.read_text()
class Audit(HTMLParser):
    dependencies=[]
    scripts=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='script': self.scripts+=1
        for key in ('src','href','poster','data'):
            value=a.get(key,'')
            if value and not value.startswith(('data:','#')):
                self.dependencies.append((tag,key,value))
a=Audit();a.feed(s)
assert not a.dependencies,a.dependencies
assert a.scripts==1
assert not re.search(r'@import|@font-face|<iframe|<audio|<video',s)
script=re.search(r'<script>([\s\S]*?)</script>',s)[1]
assert not re.search(r'\bfetch\s*\(|\bimport\s*\(|XMLHttpRequest|new WebSocket',script)
print('PASS: one inline script; no external assets, fonts, imports, services, or runtime dependencies.')
print('Artifact bytes:',p.stat().st_size)
