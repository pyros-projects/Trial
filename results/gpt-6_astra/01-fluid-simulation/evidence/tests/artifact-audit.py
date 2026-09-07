from pathlib import Path
from html.parser import HTMLParser
import re, json
html=Path('index.html').read_text()
class Audit(HTMLParser):
    def __init__(self):
        super().__init__(); self.dependencies=[]; self.ids=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        for key in ['src','href','poster','action']:
            if a.get(key) and not a[key].startswith(('#','data:')): self.dependencies.append([tag,key,a[key]])
a=Audit();a.feed(html)
assert not a.dependencies, a.dependencies
assert len(a.ids)==len(set(a.ids)), 'Duplicate IDs'
assert not re.search(r'\b(fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\()',html), 'Network or dynamic import code'
assert not re.search(r'@import|url\(\s*["\']?https?:',html), 'External styles'
print(json.dumps({'status':'pass','bytes':len(html.encode()),'external_dependencies':a.dependencies,'unique_ids':len(a.ids),'single_inline_script':len(re.findall(r'<script>',html))==1},indent=2))
