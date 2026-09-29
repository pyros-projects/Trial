"""Real-browser checks via the installed agent-browser CLI; eval is read-only."""
import json,subprocess,pathlib,time,shlex,math
ROOT=pathlib.Path(__file__).resolve().parent
SESSION='orbit-offline'
FLAGS=['--proxy','http://127.0.0.1:9','--proxy-bypass','127.0.0.1,localhost','--allowed-domains','127.0.0.1,localhost']
log=open(ROOT/'logs/browser-extended.txt','a',buffering=1)
def ab(*args):
    cmd=['agent-browser','--session',SESSION,*FLAGS,*map(str,args)]
    log.write('$ '+shlex.join(cmd)+'\n')
    r=subprocess.run(cmd,text=True,capture_output=True,timeout=45)
    log.write(r.stdout+r.stderr+'\n')
    if r.returncode:raise RuntimeError(r.stdout+r.stderr)
    return r.stdout.strip()
def data(expr='window.orbitLab.getState()'):return json.loads(ab('eval',expr))
def check(name,condition,detail=''):
    line=('PASS ' if condition else 'FAIL ')+name+(' — '+str(detail) if detail else '')
    log.write(line+'\n');print(line,flush=True)
    if not condition:raise AssertionError(name)
def click(name):
    ab('snapshot','-i')
    if name=='Telemetry':return ab('click','#tab-telemetry')
    return ab('find','role','button','click','--name',name,'--exact')
def fill(label,value):
    ab('snapshot','-i')
    return ab('find','label',label,'fill',value)
def select(label,value):
    ab('snapshot','-i')
    return ab('select',{'Reference frame':'#reference-frame','Scenario preset':'#scenario','Burn coordinate system':'#node-mode'}[label],value)
def screenshot(name):return ab('screenshot',str(ROOT/'screenshots'/name))

