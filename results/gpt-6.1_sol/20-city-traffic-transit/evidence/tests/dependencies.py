from pathlib import Path
from html.parser import HTMLParser
import re,hashlib,subprocess
root=Path(__file__).resolve().parents[2]
artifact=root/'index.html'
html=artifact.read_text()
class Audit(HTMLParser):
    def __init__(self):super().__init__();self.scripts=0;self.external=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='script':
            self.scripts+=1
            assert 'src' not in attrs,'script must be embedded'
        for key in ['src','href']:
            value=attrs.get(key,'')
            if re.match(r'^(?:https?:)?//',value):self.external.append((tag,key,value))
audit=Audit();audit.feed(html)
assert audit.scripts==1
assert not audit.external,audit.external
assert not re.search(r'@import|url\(\s*[\"\']?(?:https?:)?//',html)
script=re.search(r'<script>([\s\S]*?)</script>',html).group(1)
assert not re.search(r'\b(?:fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(|\bimport\s+(?:[\"\']|\{)',script)
Path('/tmp/flowstate-script.js').write_text(script)
subprocess.run(['node','--check','/tmp/flowstate-script.js'],check=True)
print('PASS: one inline script, embedded assets, no external src/href/CSS dependencies or network APIs; JavaScript syntax valid')
print('SVG xmlns identifiers are namespace declarations; no request or dependency.')
print('SHA256:',hashlib.sha256(artifact.read_bytes()).hexdigest())
print('Bytes:',artifact.stat().st_size)
