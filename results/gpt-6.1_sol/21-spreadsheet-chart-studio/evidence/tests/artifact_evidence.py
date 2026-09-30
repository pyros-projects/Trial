from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET
import struct, hashlib, json

e=Path(__file__).resolve().parents[1]
svg=ET.parse(e/'current-chart.svg').getroot()
ns={'s':'http://www.w3.org/2000/svg'}
assert svg.find('s:title',ns).text=='A clearer quarter'
paths=[n for n in svg.findall('.//s:path',ns) if n.get('data-series')=='Current']
assert len(paths)==1 and paths[0].get('stroke')=='#9c6b45'
points={n.get('data-address'):n.get('aria-label') for n in svg.iter() if n.get('data-address')}
for address,value in {'I2':6,'I3':28,'I4':34,'J2':8,'J3':18,'J4':26}.items():assert ': '+str(value)+' · '+address in points[address]
png=(e/'current-chart.png').read_bytes();assert png[:8]==b'\x89PNG\r\n\x1a\n';size=struct.unpack('>II',png[16:24]);assert size==(1200,744)
assert png==(e/'current-chart-verified.png').read_bytes(),'Final PNG matches the image opened and visually inspected in the browser'
print('PASS SVG: exact title, chosen color, all six current points, labels, axes and legend')
print('PASS PNG: dimensions',size,'bytes',len(png),'sha256',hashlib.sha256(png).hexdigest(),'; matches browser-inspected image')
for name in ['opaque-frame.har','direct-file.har']:
    entries=json.loads((e/'logs'/name).read_text())['log']['entries']
    urls=[x['request']['url'] for x in entries]
    assert all(urlparse(u).scheme in ['file','blob'] or urlparse(u).hostname=='127.0.0.1' for u in urls)
    assert all(x['response']['status']==200 for x in entries)
    print('PASS',name,len(entries),'requests:',urls)
events=[json.loads(line) for line in (e/'logs/iframe-runtime-events.jsonl').read_text().splitlines()]
assert not any(x.get('event') in ['Runtime.exceptionThrown','Network.loadingFailed'] for x in events)
assert not any(x.get('event')=='Log.entryAdded' and x['params']['entry']['level'] in ['error','warning'] for x in events)
assert not any(x.get('event')=='Runtime.consoleAPICalled' and x['params']['type'] in ['error','warning'] for x in events)
completed=[x for x in events if x.get('event')=='Browser.downloadProgress' and x['params']['state']=='completed']
assert len(completed)==3
print('PASS iframe diagnostics: JSON, SVG and PNG real download events completed; no runtime, security-log, console or request failures')
for name in ['final-browser-console.log','final-browser-errors.log']:assert not (e/'logs'/name).read_text().strip()
probe=json.loads((e/'logs/external-network-probe.json').read_text());assert probe['externalBlocked']
print('PASS external probe blocked; fresh app console and uncaught-error logs empty')
