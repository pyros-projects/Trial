from html.parser import HTMLParser
import hashlib,pathlib,json,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parent;file=ROOT.parent/'index.html';source=file.read_text()
class Audit(HTMLParser):
    def __init__(self):super().__init__();self.external=[];self.scripts=[];self.current=False;self.script=''
    def handle_starttag(self,t,a):
        d=dict(a)
        if t in ['script','link','img','iframe','audio','video','source'] and any(d.get(k) for k in ['src','href']):self.external.append({'tag':t,'attributes':d})
        if t=='script':assert 'src' not in d and d.get('type')!='module';self.current=True
    def handle_endtag(self,t):
        if t=='script':self.current=False;self.scripts.append(self.script);self.script=''
    def handle_data(self,d):
        if self.current:self.script+=d
p=Audit();p.feed(source);assert not p.external and len(p.scripts)==1
assert not re.search(r'\b(localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|Worker)\b',p.scripts[0])
js=ROOT/'inline-script-check.js';js.write_text(p.scripts[0]);subprocess.run(['node','--check',str(js)],check=True)
d={'file':'index.html','bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'external_asset_elements':p.external,'runtime_libraries':0,'storage_calls':0,'delivery':'one classic inline script, inline CSS, editable SVG scenes','syntaxCheck':'pass'}
(ROOT/'artifact-audit.json').write_text(json.dumps(d,indent=2));print('PASS final self-contained artifact audit and JavaScript syntax',d['sha256'])
