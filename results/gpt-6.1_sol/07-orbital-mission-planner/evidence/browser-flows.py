"""Real-browser checks via the installed agent-browser CLI; eval is read-only."""
import json,subprocess,pathlib,time,shlex,math
ROOT=pathlib.Path(__file__).resolve().parent
SESSION='orbit-validation'
log=open(ROOT/'logs/browser-flows.txt','a',buffering=1)
def ab(*args):
    cmd=['agent-browser','--session',SESSION,*map(str,args)]
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

ab('open','file://'+str(ROOT.parent/'index.html'));ab('set','viewport',1280,800);click('Pause simulation');click('Plan a maneuver');
state=data();check('direct-file delivery loaded',ab('get','url').startswith('file:///'));check('initial state finite',all(math.isfinite(b['x']) for b in state['bodies']));check('all four default bodies present',len(state['bodies'])==4)
requests=ab('network','requests');check('direct-file has no external requests','http://' not in requests and 'https://' not in requests,requests)
pred0=data('window.orbitLab.getPrediction()');old=next(b for b in pred0['planned']['final'] if b['id']=='odyssey')
fill('Prograde Δv · u/t','.35');fill('Radial Δv · u/t','.025');fill('Burn time · mission t',str(state['time']+5));click('Apply maneuver');ab('wait','--fn','window.orbitLab.getPrediction().planned.events.some(e=>e.dv>.34)')
pred1=data('window.orbitLab.getPrediction()');new=next(b for b in pred1['planned']['final'] if b['id']=='odyssey');difference=math.hypot(new['x']-old['x'],new['y']-old['y']);check('editing maneuver changes future trajectory before execution',difference>1,difference);check('maneuver remains unexecuted during paused preview',not data()['nodes'][0]['executed']);screenshot('02-maneuver-preview.png')
click('Play simulation');ab('wait','--fn','window.orbitLab.getState().nodes[0].executed === true');click('Pause simulation');after=data();check('scheduled burn actually executes',after['nodes'][0]['executed']);check('burn execution logged',any(e['type']=='Burn executed' for e in after['events']));actual_e=data('(()=>{const s=window.orbitLab.getState();return Physics.elements(s.bodies.find(b=>b.id==="odyssey"),s.bodies.find(b=>b.id==="terra"),s.config.G).ecc})()');check('actual post-burn eccentricity increases',actual_e>.1,actual_e);screenshot('03-burn-executed.png')
check('simulation advances with coherent telemetry',after['time']>state['time']+4.9,(state['time'],after['time']));check('energy error remains finite',math.isfinite(after['energyError']),after['energyError']);
click('Telemetry');paused=data();ab('wait','--fn','window.orbitLab.getState().paused');time.sleep(.25);check('pause freezes physical time',data()['time']==paused['time']);click('Single step');step=data();check('single step advances maximum timestep',abs(step['time']-paused['time']-step['config']['dt'])<1e-8);check('single step leaves paused',step['paused']);
click('Save checkpoint');checkpoint=data();click('Single step');click('Single step');click('Return to checkpoint');restored=data();check('checkpoint restores exact time',restored['time']==checkpoint['time']);check('checkpoint restores body vectors',restored['bodies']==checkpoint['bodies']);
select('Reference frame','inertial');inertial=data();frame=data('window.orbitLab.getFrame()');check('inertial frame has zero translation',frame['x']==0 and frame['y']==0);screenshot('04-inertial-frame.png');select('Reference frame','centered');frame=data('window.orbitLab.getFrame()');body=next(b for b in data()['bodies'] if b['id']=='odyssey');check('selected-centered frame follows selected body',abs(frame['x']-body['x'])<1e-10);check('selected-centered telemetry is zero position',abs(float(ab('get','text','#tel-x').replace('−','-')))<1e-6);screenshot('05-selected-centered.png');select('Reference frame','rotating');frame=data('window.orbitLab.getFrame()');check('rotating frame angular velocity is nonzero',abs(frame['omega'])>1e-5);screenshot('06-rotating-frame.png');select('Reference frame','primary');
click('Increase time warp');check('time-warp control doubles target',ab('get','text','#warp-output')=='16×');click('Decrease time warp');check('time-warp deceleration control returns target',ab('get','text','#warp-output')=='8×');
click('Save mission');saved=data();click('Single step');click('Simulation settings');click('Load saved mission');loaded=data();check('local save/load preserves state vectors',loaded['bodies']==saved['bodies']);check('local save/load restores time',loaded['time']==saved['time']);
click('Restart scenario');click('Pause simulation');reset=data();check('restart clears maneuver schedule',not reset['nodes']);check('restart returns near epoch',reset['time']<2);check('restart has coherent conservation baseline',abs(reset['energyError'])<.001);
click('Open field guide');check('field guide opens',ab('get','text','#help-dialog').find('Keyboard shortcuts')>=0);click('Ready for flight');ab('focus','#space');ab('press','s');check('keyboard single-step works',data()['time']>reset['time']);ab('press','Space');ab('wait','--fn',f"window.orbitLab.getState().time > {reset['time']+1}");ab('press','Space');check('keyboard pause works',data()['paused']);
check('no uncaught browser errors',ab('errors')=='');check('console is clean',ab('console')=='');
print('Desktop primary flows completed',flush=True)
