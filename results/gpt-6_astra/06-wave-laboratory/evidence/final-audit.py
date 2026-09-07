from importlib.machinery import SourceFileLoader
import json, hashlib, runpy
v=SourceFileLoader('v','evidence/browser-validation.py').load_module()
artifact_url=(v.ROOT.parent/'index.html').as_uri()
# Explicit navigation also recovers a browser session after its daemon idle timeout.
v.ab('set','offline','on')
v.ab('network','route','http://**','--abort');v.ab('network','route','https://**','--abort')
v.ab('set','viewport','1280','800','1');v.ab('set','offline','on');v.ab('open',artifact_url)
assert v.ev('location.protocol')=='file:' and v.ev('navigator.onLine') is False
runpy.run_path(str(v.ROOT/'review-retest.py'))
v.ab('open',artifact_url)
runpy.run_path(str(v.ROOT/'mobile-checks.py'))
# Final desktop navigation, normal probe readings, and pause/clear/step regression.
v.ab('set','viewport','1280','800','1');v.ab('set','offline','on');v.ab('open',artifact_url);v.pause();v.click('Clear field')
assert v.state()['time']==0 and v.state()['fieldMax']==0 and all(p['samples']==0 for p in v.state()['probes'])
v.click('Advance one timestep');d=v.state();assert d['steps']==1 and d['paused']
v.resume();v.waitsim(15);v.pause();d=v.state();assert d['finite'] and all(abs(p['frequency']-1.4)<.025 for p in d['probes'])
v.click('Laboratory');v.ab('wait','--fn','scrollY===0');v.ab('wait','--fn','!document.getElementById("toast").classList.contains("show")')
v.snap();v.shot('final-desktop-1280x800.png');v.ab('screenshot','--full',str(v.ROOT/'screenshots/final-desktop-full.png'))
health={'url':v.ev('location.href'),'online':v.ev('navigator.onLine'),'diagnostics':v.state(),'externalResources':v.ev('performance.getEntriesByType("resource").map(r=>r.name)'),'console':v.ab('console'),'errors':v.ab('errors'),'requests':v.ab('network','requests'),'sha256':hashlib.sha256((v.ROOT.parent/'index.html').read_bytes()).hexdigest()}
assert health['online'] is False and not health['externalResources'] and not health['console']['messages'] and not health['errors']['errors']
assert all(not r.get('url','').startswith(('http:','https:')) for r in health['requests'].get('requests',[]))
(v.ROOT/'final-browser-health.json').write_text(json.dumps(health,indent=2))
v.report('FINAL PASS offline direct-file desktop, mobile, regression and browser health',health)
