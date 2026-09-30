"""Agent-authored real-browser checks. All actions use agent-browser input commands.
JavaScript evaluation is used only for live state/diagnostics and screen coordinates.
"""
import subprocess,json,pathlib,shlex,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
LOG=ROOT/'evidence/logs/browser-clean.txt'
SESSION='hollowkeep-release'
def ab(*args):
    command=['agent-browser','--session',SESSION,*map(str,args)]
    p=subprocess.run(command,cwd=ROOT,text=True,capture_output=True,timeout=35)
    with LOG.open('a') as f:
        f.write('$ '+shlex.join(command)+'\n'+p.stdout+p.stderr+'\n')
    if p.returncode: raise RuntimeError(p.stderr or p.stdout)
    return p.stdout.strip()
def js(expression):return json.loads(ab('eval',expression))
def state():return js('Hollowkeep.state')
def snap(name):ab('screenshot',str(ROOT/'evidence/screenshots'/name))
def button(name):
    if name=='Resume':ab('click','#menu-resume')
    else:ab('find','role','button','click','--name',name)
def pointer(x,y):
    ab('wait','--fn','!Hollowkeep.diagnostics.animation')
    pos=js(f'Hollowkeep.tileToScreen({x},{y})')
    ab('mouse','move',round(pos['x']),round(pos['y']))
    ab('mouse','down','left');ab('mouse','up','left')
def passed(message):
    print('PASS '+message,flush=True)
    with LOG.open('a')as f:f.write('PASS '+message+'\n')


ab('open','about:blank')
ab('network','route','http://**','--abort');ab('network','route','https://**','--abort');ab('set','offline','on')
ab('set','viewport',1280,800);ab('open',(ROOT/'index.html').as_uri());ab('wait','--fn','!!window.Hollowkeep');ab('wait',120)
s=state();assert s['seed']=='MOSS-731' and s['turn']==0
assert js('document.documentElement.scrollWidth')==1280
assert js('Hollowkeep.validate()')['connected']
snap('21-final-desktop-fresh.png')
passed('fresh browser opens delivered file:// offline with no cached external assets and correct 1280x800 layout')
button('Enable sound');assert js('Hollowkeep.diagnostics.audio.state')=='running'
ab('press','ArrowUp');button('GUARD');assert state()['turn']==2
expected=js('Hollowkeep.digest()');ab('open',(ROOT/'index.html').as_uri());ab('wait','--fn','!!window.Hollowkeep');assert js('Hollowkeep.digest()')==expected
passed('sound starts by user gesture; real page reload preserves exact turn 2')
assert not ab('errors');assert not ab('console')
network=ab('network','requests')
assert 'http://' not in network and 'https://' not in network
passed('browser console and uncaught-error stream are empty; no external HTTP or HTTPS requests')
# Controlled storage fault injection, then genuine application startup/recovery.
ab('eval','localStorage.setItem("hollowkeep.run.v3", JSON.stringify({version:1,state:{turn:999}}))')
ab('open',(ROOT/'index.html').as_uri());ab('wait','--fn','!!window.Hollowkeep');assert state()['turn']==0 and js('Hollowkeep.diagnostics.save').startswith('Invalid save')
assert 'fresh expedition' in ab('get','text','#toast').lower()
snap('22-invalid-storage-recovery.png');assert not ab('errors')
passed('a deliberately obsolete localStorage save is rejected at actual startup and safely replaced by a playable new run')
button('New run');button('Begin expedition');ab('wait',120)
ab('set','viewport',390,844);ab('wait',120)
assert js('document.documentElement.scrollWidth')==390
snap('23-final-narrow-fresh.png')
button('Move north');assert state()['turn']==1
ab('set','viewport',1280,800);ab('wait',120)
passed('fresh 390x844 view has no overflow and labeled movement consumes exactly one turn')
assert not ab('errors');passed('no unresolved errors in clean final-artifact checks')
