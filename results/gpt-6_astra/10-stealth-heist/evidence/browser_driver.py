"""Real agent-browser interactions. Diagnostics are read only; game state is never injected."""
import subprocess,json,time,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parent
LOG=ROOT/'logs'/'browser-commands.log'
def ab(*args,timeout=40):
    cmd=['agent-browser','--session','blackline',*map(str,args)]
    out=subprocess.run(cmd,text=True,capture_output=True,timeout=timeout)
    with LOG.open('a') as f:f.write('\n$ '+ ' '.join(repr(x) if ' ' in x else x for x in cmd)+'\n'+out.stdout+out.stderr)
    if out.returncode:raise RuntimeError(out.stdout+out.stderr)
    return out.stdout.strip()
def ev(js):return json.loads(ab('eval',js))
def state():return ev('BLACKLINE.snapshot()')
def screenshot(name):return ab('screenshot',str(ROOT/'screenshots'/name))
def save(name):
    s=state();(ROOT/'logs'/name).write_text(json.dumps(s,indent=2));return s
def click_world(x,y,button='left'):
    pos=ev('(()=>{const s=BLACKLINE.snapshot(),r=document.getElementById("game").getBoundingClientRect();return {x:r.x,y:r.y,v:s.view}})()')
    sx=pos['x']+pos['v']['x']+x*pos['v']['scale'];sy=pos['y']+pos['v']['y']+y*pos['v']['scale']
    if sx<0 or sy<0 or sx>1280 or sy>800:raise ValueError(f'World target outside viewport: {sx},{sy}')
    ab('mouse','move',round(sx),round(sy));ab('mouse','down',button);ab('mouse','up',button)
def aim_world(x,y):
    pos=ev('(()=>{const s=BLACKLINE.snapshot(),r=document.getElementById("game").getBoundingClientRect();return {x:r.x,y:r.y,v:s.view}})()')
    ab('mouse','move',round(pos['x']+pos['v']['x']+x*pos['v']['scale']),round(pos['y']+pos['v']['y']+y*pos['v']['scale']))
def wait(js):return ab('wait','--fn',js)
def arrived(x,y):return wait(f'Math.hypot(BLACKLINE.snapshot().player.x-{x},BLACKLINE.snapshot().player.y-{y})<0.2')
def action(button):return ab('find','role','button','click','--name',button)
def generate(seed='DOCK-031',preset='Dockside',difficulty='ghost'):
    action('New mission');action(preset);ab('find','label','Mission seed','fill',seed);ab('select','#difficultyInput',difficulty);action('Generate mission');action('Infiltrate')
if __name__=='__main__':print(state())
