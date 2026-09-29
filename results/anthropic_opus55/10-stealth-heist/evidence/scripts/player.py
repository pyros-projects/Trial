import subprocess, json, time, sys, os
os.environ['AGENT_BROWSER_SESSION']='heist'
EV='/home/pyro/projects/naked/opus55/_trial/10-stealth-heist/evidence/screenshots/'
LOG=[]
def ab(*a):
    r=subprocess.run(['agent-browser',*a],capture_output=True,text=True); return r.stdout.strip()
def ev(js):
    out=ab('eval',js)
    try: return json.loads(json.loads(out)) if out.startswith('"') else json.loads(out)
    except Exception: return out
def snap(): return ev("JSON.stringify(GHOSTLINE.snapshot())")
def w2s(x,y):
    p=ev(f"JSON.stringify(worldToScreen({x},{y}))"); return int(p[0]),int(p[1])
def click(x,y):
    sx,sy=w2s(x,y); ab('mouse','move',str(sx),str(sy)); ab('mouse','down','left'); ab('mouse','up','left'); log(f'click world({x},{y}) screen({sx},{sy})')
def log(m):
    s=snap(); line=f"[t={s['time']:6.2f}] {m} | P({s['player']['x']},{s['player']['y']}) {s['player']['stance']} key={s['player']['hasKey']} obj={s['player']['hasObj']} alert={s['alert']} | "+' '.join(f"{g['id']}:{g['state']}({g['x']},{g['y']}) aw{g['aw']}" for g in s['guards'])
    print(line,flush=True); LOG.append(line)
def shot(name): ab('screenshot',EV+name); log('screenshot '+name)
def wait_until(cond, timeout=60, danger=True, poll=0.05):
    t0=time.time()
    while time.time()-t0<timeout:
        s=snap()
        if s['outcome']: return 'outcome',s
        if cond(s): return 'ok',s
        if danger and any(g['aw']>0.28 or g['state']=='CHASE' for g in s['guards']): return 'danger',s
        time.sleep(poll)
    return 'timeout',snap()
def dist(a,b): return ((a[0]-b[0])**2+(a[1]-b[1])**2)**.5
def mm2s(x,y):
    p=ev(f"(()=>{{const r=R.mm.getBoundingClientRect(),t=R.mmT;return JSON.stringify([r.left+(t.ox+{x}*t.k)*r.width/R.mm.width, r.top+(t.oy+{y}*t.k)*r.height/R.mm.height]);}})()"); return int(round(p[0])),int(round(p[1]))
def click(x,y):
    sx,sy=w2s(x,y); vw,vh=ev("JSON.stringify([innerWidth,innerHeight])")
    if 8<sx<vw-8 and 8<sy<vh-8 and not ev(f"(()=>{{const e=document.elementFromPoint({sx},{sy});return JSON.stringify(e&&e.id!=='game');}})()"):
        ab('mouse','move',str(sx),str(sy)); ab('mouse','down','left'); ab('mouse','up','left'); log(f'click world({x},{y}) screen({sx},{sy})')
    else:
        mx,my=mm2s(x,y); ab('mouse','move',str(mx),str(my)); ab('mouse','down','left'); ab('mouse','up','left'); log(f'minimap click world({x},{y}) screen({mx},{my})')
