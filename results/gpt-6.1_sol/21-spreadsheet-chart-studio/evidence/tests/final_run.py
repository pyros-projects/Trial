from pathlib import Path
import subprocess, json, time

root=Path(__file__).resolve().parents[2]
commands=[
    ['python3','evidence/tests/opaque_workflow.py'],
    ['agent-browser','--session','studio-verified','frame','main'],
    ['agent-browser','--session','studio-verified','open','http://127.0.0.1:8765/index.html'],
    ['python3','evidence/tests/browser_workflows.py','1','2','3','4','5','6'],
    ['python3','evidence/tests/browser_boundaries.py','desktop-mobile'],
    ['python3','evidence/tests/browser_boundaries.py','direct-file'],
    ['node','--test','evidence/tests/core.test.cjs'],
    ['python3','evidence/tests/standalone_check.py']
]
results=[]
log=(root/'evidence/logs/final-run.log').open('w')
try:
    for command in commands:
        print('$ '+' '.join(command),flush=True);log.write('$ '+' '.join(command)+'\n');log.flush();start=time.monotonic()
        p=subprocess.Popen(command,cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        for line in p.stdout:print(line,end='',flush=True);log.write(line);log.flush()
        code=p.wait();results.append({'command':command,'status':'pass' if code==0 else 'fail','exitCode':code,'elapsedSeconds':round(time.monotonic()-start,2)});(root/'evidence/logs/final-run-status.json').write_text(json.dumps(results,indent=2))
        if code:raise SystemExit(code)
finally:log.close()
