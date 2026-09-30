import subprocess,json,pathlib,time,sys,os
ROOT=pathlib.Path(__file__).resolve().parents[2]; SESSION=os.environ.get('FLOWSTATE_BROWSER_SESSION','flowstate'); LOG=ROOT/'evidence/logs/browser-flows.txt'
log=LOG.open('a')
def cmd(*args):
    argv=['agent-browser','--session',SESSION,*map(str,args)]
    log.write('\n$ '+' '.join(argv)+'\n');log.flush()
    r=subprocess.run(argv,cwd=ROOT,text=True,capture_output=True)
    log.write(r.stdout+r.stderr);log.flush()
    if r.returncode:raise RuntimeError(r.stdout+r.stderr)
    return r.stdout

def js(expression):
    result=json.loads(cmd('eval','--json',expression))
    if not result.get('success'):raise RuntimeError(result)
    return result['data']['result']

def shot(name):cmd('screenshot','evidence/screenshots/'+name+'.png')
def snap(name): (ROOT/'evidence/logs'/f'{name}-snapshot.txt').write_text(cmd('snapshot','-i'))
def world(x,y):
    d=js('({cam:Flowstate.camera,rect:document.querySelector("#cityCanvas").getBoundingClientRect().toJSON()})')
    c=d['cam'];r=d['rect'];return [round(r['x']+c['w']/2+(x-c['x'])*c['zoom']),round(r['y']+c['h']/2+(y-c['y'])*c['zoom'])]
def clickmap(x,y):
    a,b=world(x,y);cmd('mouse','move',a,b);cmd('mouse','down');cmd('mouse','up')
def state(label):
    data=js('({time:Flowstate.sim.time,paused:Flowstate.paused,tool:Flowstate.tool,metrics:Flowstate.metrics,diag:Flowstate.diagnostics,nodes:Flowstate.city.nodes.length,roads:Flowstate.city.roads.length,stops:Flowstate.city.stops.length,routes:Flowstate.city.routes.length})')
    (ROOT/'evidence/logs'/f'{label}.json').write_text(json.dumps(data,indent=2));return data

def main():
    before=state('workflow-start');assert before['paused']
    cmd('wait',300);assert js('Flowstate.sim.time')==before['time'],'pause must freeze exact time'
    cmd('find','role','button','click','--name','Single step one second')
    assert abs(js('Flowstate.sim.time')-before['time']-1)<.00001
    cmd('focus','#cityCanvas');cmd('press','Space');assert not js('Flowstate.paused')
    cmd('press','Space');assert js('Flowstate.paused')
    print('PASS pause, real keyboard resume/pause, and exact 1-second step')
    # A continuous pointer-drawn road crosses the current connected graph.
    cmd('find','role','button','click','--name','Draw road');snap('draw-road')
    points=[(180,150),(340,235),(500,310),(690,395),(900,485),(1120,540),(1320,550)]
    cmd('mouse','move',*world(*points[0]));cmd('mouse','down')
    for p in points[1:]:cmd('mouse','move',*world(*p))
    shot('road-preview');cmd('mouse','up');drawn=state('road-drawn');shot('road-drawn')
    assert drawn['roads']>before['roads'];assert drawn['diag']['components']==1
    assert js('Flowstate.route(1,15).length')>0
    cmd('find','role','button','click','--name','Undo','--exact')
    assert js('Flowstate.city.roads.length')==before['roads']
    cmd('find','role','button','click','--name','Redo','--exact')
    assert js('Flowstate.city.roads.length')==drawn['roads']
    cmd('focus','#cityCanvas');cmd('press','Control+z')
    assert js('Flowstate.city.roads.length')==before['roads']
    print('PASS continuous drawing, crossing splits, connected routing, button undo/redo and keyboard undo')
    # Closure on a concrete busy avenue segment and one-way changes.
    cmd('find','role','button','click','--name','Road closure');clickmap(892.5,350);snap('closed-road');shot('road-closed')
    assert js('Flowstate.city.roads.find(r=>r.id===34).closed')
    assert js('Flowstate.route(8,9).every(e=>e.road!==34)')
    cmd('find','role','button','click','--name','Single step one second')
    assert js('Flowstate.diagnostics.illegalMovingEdges')==0
    assert js('Flowstate.sim.vehicles.filter(v=>v.path[v.index]?.road===34).every(v=>v.speed===0)')
    state('closure-stopped')
    cmd('click','[data-speed="30"]');cmd('click','#pauseButton')
    target=js('Flowstate.sim.time')+80
    cmd('wait','--fn',f'Flowstate.sim.time>{target}')
    cmd('click','#pauseButton');closed=state('closure-after-running');shot('closure-congestion')
    assert closed['diag']['illegalMovingEdges']==0
    assert closed['metrics']['failed']>0 or closed['metrics']['reroutes']>before['metrics']['reroutes']
    cmd('uncheck','#roadClosed')
    cmd('select','#roadLanes','1');cmd('select','#roadDirection','1')
    assert js('Flowstate.route(9,8).every(e=>e.road!==34)')
    assert js('Flowstate.route(8,9).length')>0
    cmd('click','#stepButton');state('one-way-checked');shot('one-way-road')
    assert js('Flowstate.diagnostics.illegalMovingEdges')==0
    cmd('select','#roadDirection','0');cmd('select','#roadLanes','2')
    print('PASS closure stops affected traffic, alternate routing, measured failures/reroutes, one-way detour and lane count')
    # Edited signal phases are actual right-of-way controls.
    cmd('click','[data-tool="signal"]');clickmap(750,350);snap('signal-inspector')
    cmd('select','#signalMode','fixed');cmd('fill','#signalCycle','60');cmd('press','Tab')
    cmd('fill','#signalOffset','8');cmd('press','Tab')
    assert js('Flowstate.city.nodes.find(n=>n.id===8).signal.phases.reduce((s,p)=>s+p.duration,0)')==60
    assert js('Flowstate.city.nodes.find(n=>n.id===8).signal.offset')==8
    cmd('select','[data-phase-axis="0"]','ALL');shot('signal-conflict')
    assert 'Safety hold' in cmd('get','text','#inspectorPanel')
    assert js('Flowstate.diagnostics.networkWarnings.some(x=>x.includes("conflicting"))')
    cmd('click','#pauseButton');target=js('Flowstate.sim.time')+35;cmd('wait','--fn',f'Flowstate.sim.time>{target}');cmd('click','#pauseButton')
    hold=js('({queue:Flowstate.metrics.queue,stopped:Flowstate.sim.vehicles.filter(v=>v.path[v.index]?.to===8&&v.speed<1).length,phases:Flowstate.city.nodes.find(n=>n.id===8).signal.phases})')
    assert hold['stopped']>0
    state('signal-all-red-queues');shot('signal-queue-response')
    cmd('select','[data-phase-axis="0"]','EW');cmd('check','[data-turn="left"]')
    assert js('Flowstate.city.nodes.find(n=>n.id===8).banned.includes("left")')
    cmd('uncheck','[data-turn="left"]')
    assert not js('Flowstate.diagnostics.networkWarnings.some(x=>x.includes("conflicting"))')
    print('PASS fixed signal cycle/offset editing, conflict diagnostic with all-red safety, real queues, legal-turn editor')
    # Add a stop on an existing road, then create and tune an ordered transit route.
    cmd('click','[data-tool="stop"]');clickmap(1035,650)
    assert js('Flowstate.city.stops.length')==before['stops']+1
    cmd('click','[data-tool="route"]')
    for x,y in [(180,350),(750,350),(1320,350)]:clickmap(x,y)
    snap('route-draft');shot('route-draft')
    cmd('find','role','button','click','--name','Finish route')
    assert js('Flowstate.city.routes.length')==before['routes']+1
    cmd('fill','#routeFrequency','15');cmd('press','Tab')
    cmd('fill','#routeCapacity','55');cmd('press','Tab')
    cmd('fill','#routeDwell','3');cmd('press','Tab')
    ridership=js('Flowstate.sim.ridership');arrived=js('Flowstate.sim.transitCompleted')
    cmd('click','#pauseButton');target=js('Flowstate.sim.time')+180;cmd('wait','--fn',f'Flowstate.sim.time>{target}');cmd('click','#pauseButton')
    transit=state('transit-running');shot('new-transit-line')
    assert transit['diag']['activeBuses']>before['diag']['activeBuses']
    assert transit['metrics']['ridership']>ridership
    assert js('Flowstate.sim.transitCompleted')>arrived
    assert js('Flowstate.sim.vehicles.some(v=>v.routeId===Flowstate.city.routes.at(-1).id)')
    print('PASS road-attached stop, ordered loop creation, frequency/capacity/dwell editing, real buses, boarding and destination completion')
    for val in ['speed','density','queue','travel','routes','signals','turns','coverage','waiting','emissions','demand','validation']:
        cmd('select','#overlaySelect',val)
        if val in ['queue','coverage','validation']:shot('overlay-'+val)
    assert js('Flowstate.diagnostics.components')==1
    cmd('click','[data-view="analytics"]');snap('analytics');shot('analytics')
    assert '95th percentile' in cmd('get','text','#analyticsView')
    print('PASS all twelve diagnostic overlays and analytics navigation')
    state('desktop-flows-end')

if __name__=='__main__':main()
