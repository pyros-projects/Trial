"""Inspect the delivered offline artifact without changing it."""
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent.parent
raw = (ROOT / 'index.html').read_bytes()
source = raw.decode('utf-8')

class Artifact(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []
        self.references = []
        self.scripts = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script':
            self.scripts += 1
        if tag == 'a' and attrs.get('href', '').startswith('https://'):
            self.references.append(attrs['href'])
        for attr in ('src', 'poster'):
            if attr in attrs:
                self.assets.append([tag, attrs[attr]])
        if tag in ('link', 'use') and 'href' in attrs:
            self.assets.append([tag, attrs['href']])

artifact = Artifact()
artifact.feed(source)
external = [item for item in artifact.assets if not item[1].startswith(('data:', '#'))]
for match in re.findall(r'url\(([^)]+)\)', source):
    value = match.strip(' \"\'')
    if not value.startswith(('data:', '#')):
        external.append(['css', value])
forbidden = re.findall(r'\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\b|localStorage\b|sessionStorage\b|indexedDB\b|serviceWorker\b|document\.cookie\b)', source)
report = {
    'artifact_bytes': len(raw),
    'sha256': hashlib.sha256(raw).hexdigest(),
    'inline_scripts': artifact.scripts,
    'external_runtime_assets': external,
    'asset_references': artifact.assets,
    'reference_links': artifact.references,
    'runtime_network_or_storage_tokens': forbidden,
}
assert artifact.scripts == 2
assert not external
assert not forbidden
assert len(artifact.references) == 3
(ROOT / 'evidence/logs/artifact-inspection.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
