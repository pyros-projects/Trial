from html.parser import HTMLParser
from pathlib import Path
import re,json,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[2]
p=ROOT/'index.html';text=p.read_text()
class Audit(HTMLParser):
 def __init__(self):super().__init__();self.resources=[];self.csp=''
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag in ('script','img','audio','video','source','iframe','link'):
   for key in ('src','href'):
    if d.get(key) and not d[key].startswith(('#','data:','blob:')):self.resources.append([tag,key,d[key]])
  if tag=='meta' and d.get('http-equiv','').lower()=='content-security-policy':self.csp=d.get('content','')
a=Audit();a.feed(text)
syntax=subprocess.run(['node','-e',"const fs=require('fs');const html=fs.readFileSync('index.html','utf8');let n=0;for(const m of html.matchAll(/<script[^>]*>([\\s\\S]*?)<\\/script>/g)){new Function(m[1]);n++;}console.log(n+' embedded scripts compiled');"],cwd=ROOT,text=True,capture_output=True,check=True)
r={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'externalResourceAttributes':a.resources,'cssImport':bool(re.search(r'@import',text)),'cssExternalUrl':bool(re.search(r'url\([\"\']?https?://',text)),'networkCode':bool(re.search(r'\b(fetch|XMLHttpRequest|WebSocket|importScripts)\s*\(',text)),'contentSecurityPolicy':a.csp,'scriptSyntax':syntax.stdout.strip()}
(ROOT/'evidence/logs/artifact-audit.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
assert not a.resources and not r['cssImport'] and not r['cssExternalUrl'] and not r['networkCode']
