"""Agent-authored static audit of the delivered standalone HTML."""
from html.parser import HTMLParser
from pathlib import Path
import re,json
root=Path(__file__).resolve().parents[2]
p=root/'index.html';s=p.read_text();issues=[]
class Audit(HTMLParser):
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','img','iframe','audio','video','source') and a.get('src'):issues.append([tag,a['src']])
        if tag=='link' and a.get('href'):issues.append([tag,a['href']])
Audit().feed(s)
for pattern in [r'@import\s',r'url\(\s*[\"\']?(?:https?:|//)',r'\bfetch\(',r'\bXMLHttpRequest\b',r'\bWebSocket\b',r'\bimport\s*\(']:
    if re.search(pattern,s):issues.append(['pattern',pattern])
report={'file':'index.html','bytes':p.stat().st_size,'externalRuntimeDependencies':issues,'inlineEngine':bool(re.search('<script id="engine">',s)),'inlineApplication':bool(re.search('<script id="application">',s))}
(root/'evidence/logs/dependency-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2));assert not issues
