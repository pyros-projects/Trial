import browser_checks as b
import subprocess,json,pathlib
b.ab('frame','main');b.ab('network','requests','--clear');b.ab('open','http://127.0.0.1:18765/index.html');b.ab('set','viewport','1280','800');b.ab('errors','--clear');b.ab('console','--clear')
with (b.ROOT/'evidence/network-guard.jsonl').open('a') as f:f.write(json.dumps({'event':'FINAL-REGRESSION-START'})+'\n')
for name,fn in [('PLAN-01',b.plan01),('PLAN-02',b.plan02),('PLAN-03',b.plan03),('PLAN-04',b.plan04),('PLAN-05',b.plan05),('PLAN-06',b.plan06)]:b.record(name,fn)
for script in ['focus-regression.py','review-regressions.py','boundary_checks.py','opaque_ref_checks.py']:
 p=subprocess.run(['python3','evidence/'+script],cwd=b.ROOT,text=True,capture_output=True,timeout=100)
 (b.ROOT/'evidence'/('final-'+script.replace('.py','.log'))).write_text(p.stdout+p.stderr)
 print(script+': '+p.stdout,flush=True)
 if p.returncode:raise RuntimeError(p.stderr)
b.OUT['PLAN-07']={'status':'pass','coverage':'1280x800 and 390x844, direct file, opaque iframe; see boundary and opaque logs'};b.RESULTS.write_text(json.dumps(b.OUT,indent=2))
b.ab('frame','main');b.ab('open','http://127.0.0.1:18765/index.html');b.ab('set','viewport','1280','800');b.reset();b.ab('click','#dismiss-notice');b.ab('scroll','up','2000');b.screenshot('final-desktop.png');b.ab('scroll','down','490');b.screenshot('final-inspector-resources.png')
(b.ROOT/'evidence/final-console.log').write_text(b.ab('console'))
(b.ROOT/'evidence/final-errors.log').write_text(b.ab('errors'))
(b.ROOT/'evidence/final-requests.log').write_text(b.ab('network','requests'))
print('PASS final browser regression and diagnostics captured',flush=True)
