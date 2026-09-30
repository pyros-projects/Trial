from html.parser import HTMLParser
from pathlib import Path
import re, hashlib, json, subprocess

root=Path(__file__).resolve().parents[2]
artifact=root/'index.html'
source=artifact.read_text()
class Inspect(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.resources=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag in ['script','img','iframe','audio','video','source'] and a.get('src'):self.resources.append(a['src'])
        if tag in ['link','use'] and a.get('href'):self.resources.append(a['href'])
parser=Inspect();parser.feed(source)
assert len(parser.ids)==len(set(parser.ids)),'Duplicate static HTML IDs'
assert all(u.startswith(('#','data:')) for u in parser.resources),parser.resources
for pattern in [r'\beval\s*\(',r'\b(?:new\s+)?Function\s*\(',r'\bfetch\s*\(',r'\bXMLHttpRequest\b',r'\blocalStorage\b',r'\bsessionStorage\b',r'\bindexedDB\b',r'\bserviceWorker\b',r'\bdocument\.cookie\b',r'\bnavigator\.clipboard\b',r'\bparent\.']:
    assert not re.search(pattern,source),pattern
css=re.search(r'<style>([\s\S]*?)</style>',source)[1]
assert not re.search(r'@import|url\(\s*[\"\']?(?:https?:|//)',css)
subprocess.run(['node','-e','const fs=require("node:fs"),vm=require("node:vm");const html=fs.readFileSync(process.argv[1],"utf8");for(const [,code] of html.matchAll(/<script[^>]*>([\\s\\S]*?)<\\/script>/g))new vm.Script(code);console.log("Embedded JavaScript syntax: pass");',str(artifact)],check=True)
print(json.dumps({'status':'pass','artifact':str(artifact),'bytes':artifact.stat().st_size,'sha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),'runtimeDependencies':[],'originDependentAPIs':[],'formulaInterpreter':'tokenizer/parser; no eval/Function'},indent=2))
