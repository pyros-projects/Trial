from pathlib import Path
from html.parser import HTMLParser
import re, subprocess, hashlib

p=Path(__file__).resolve().parent.parent/'index.html'
s=p.read_text()
class Audit(HTMLParser):
 def __init__(self):super().__init__();self.urls=[];self.ids=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  for k in ['src','href','srcset','poster','action']:
   if k in a and not a[k].startswith(('#','data:','blob:')):self.urls.append((tag,k,a[k]))
a=Audit();a.feed(s)
assert not a.urls,a.urls
assert len(a.ids)==len(set(a.ids)),'Duplicate DOM ids'
assert not re.search(r'@import|url\(\s*[\x22\x27]?(?:https?:|//)',s)
assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|Worker|importScripts)\s*\(',s)
scripts=re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)
assert len(scripts)==3
for i,body in enumerate(scripts):
 q=Path('/tmp')/f'wave-final-script-{i}.js';q.write_text(body)
 subprocess.run(['node','--check',str(q)],check=True)
 print(f'PASS inline script {i+1}: node --check {q}')
print('PASS: no external document, script, style, font, image, import, or network dependency found')
print('PASS: all DOM ids unique')
print('Bytes:',p.stat().st_size)
print('SHA256:',hashlib.sha256(p.read_bytes()).hexdigest())
