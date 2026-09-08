import subprocess,json,time,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
LOG=ROOT/'browser-commands.log'
def run(*args):
    cmd=['agent-browser','--session','formlab',*[str(round(a)) if isinstance(a,float) else str(a) for a in args]]
    r=subprocess.run(cmd,capture_output=True,text=True)
    with LOG.open('a') as f:f.write('\n$ '+' '.join(cmd)+'\n'+r.stdout+r.stderr)
    if r.returncode:raise RuntimeError(r.stderr or r.stdout)
    return r.stdout

def js(expr):
    o=json.loads(run('--json','eval',expr))
    if not o['success']:raise RuntimeError(o)
    return o['data']['result']
def rect(sel):return js(f"(()=>{{const r=document.querySelector({json.dumps(sel)}).getBoundingClientRect();return {{x:r.x+r.width/2,y:r.y+r.height/2}}}})()")
def drag(a,b):
    for cmd in [('mouse','move',a['x'],a['y']),('mouse','down'),('mouse','move',(a['x']+b['x'])/2,(a['y']+b['y'])/2),('mouse','move',b['x'],b['y']),('mouse','up')]:run(*cmd)
def click(sel):
    run('click',sel)
    run('wait','--fn','!needsRender')
def snap(name):run('screenshot',str(ROOT/'screenshots'/name))
def state():return js('studio.diagnostics')
def log(label,obj):
    print(label,json.dumps(obj),flush=True)
    with (ROOT/'workflow-results.jsonl').open('a') as f:f.write(json.dumps({'check':label,'result':obj})+'\n')
if __name__=='__main__':
    before=js('canvasHash()')
    drag(rect('.port.out[data-id="10"]'),rect('.port.in[data-id="7"][data-port="0"]'))
    e=js('studio.project.edges.find(e=>e.to===7&&e.port===0)')
    assert e['from']==10,e
    after=js('canvasHash()');assert before!=after
    log('drag compatible connection',{'edge':e,'before':before,'after':after,'state':state()})
    snap('04-connected-number.png')
    click('[aria-label="Value value"]');run('fill','[aria-label="Value value"]','0.2');run('press','Enter')
    changed=js('canvasHash()');assert changed!=after
    log('connected parameter affects final',{'hash':changed,'value':js('studio.project.nodes.find(n=>n.id===10).p.value')})
    count=state()['edges']
    drag(rect('.port.out[data-id="7"]'),rect('.port.in[data-id="9"][data-port="1"]'))
    message=js('document.querySelector("#toast").textContent')
    assert 'Incompatible' in message,message
    assert state()['edges']==count
    log('incompatible color to execution rejected',message);snap('05-incompatible-connection.png')
    drag(rect('.port.out[data-id="4"]'),rect('.port.in[data-id="3"][data-port="0"]'))
    message=js('document.querySelector("#toast").textContent')
    assert 'Cycle' in message,message
    assert state()['edges']==count
    log('indirect cycle rejected',message);snap('06-cycle-rejected.png')
    click('.node[data-id="7"] .node-head')
    click('[aria-label="Disconnect Factor"]')
    assert not js('studio.project.edges.some(e=>e.to===7&&e.port===0)')
    click('[aria-label="Undo"]');assert js('studio.project.edges.find(e=>e.to===7&&e.port===0).from')==10
    click('[aria-label="Redo"]');assert not js('studio.project.edges.some(e=>e.to===7&&e.port===0)')
    click('[aria-label="Undo"]')
    log('disconnect undo redo',state())
    click('.node[data-id="10"] .node-head')
    run('press','Control+c');run('press','Control+v');assert state()['nodes']==11
    run('press','Delete');assert state()['nodes']==10
    log('copy paste delete',state())
    click('.node[data-id="10"] .node-head');run('press','Control+d');assert state()['nodes']==11
    run('press','Control+g');assert len(js('studio.project.frames'))==3
    run('press','Delete');assert state()['nodes']==10
    log('duplicate frame delete',state())
    b=state()['view'];drag({'x':680,'y':140},{'x':642,'y':162});a=state()['view'];assert b['x']!=a['x']
    click('[aria-label="Zoom graph in"]');assert state()['view']['z']>a['z']
    click('[aria-label="Fit graph"]')
    log('pan zoom fit',state()['view'])
    # Restore the procedural Factor using tap-to-connect.
    click('.port.out[data-id="6"]');click('.port.in[data-id="7"][data-port="0"]')
    assert js('studio.project.edges.find(e=>e.to===7&&e.port===0).from')==6
    click('.node[data-id="10"] .node-head');run('press','Delete');assert state()['nodes']==9
    click('.node[data-id="7"] .node-head')
    log('click-to-connect restored procedural output',state())
    snap('07-editor-regression.png')
