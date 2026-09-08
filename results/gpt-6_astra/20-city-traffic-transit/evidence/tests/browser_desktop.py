import subprocess,json,shlex,pathlib,time,traceback
ROOT=pathlib.Path(__file__).resolve().parents[2]
log=open(ROOT/'evidence/logs/browser-desktop.txt','w',buffering=1)
results=[]
def ab(*args):
 if args[:2]==('mouse','move'):args=(*args[:2],round(args[2]),round(args[3]))
 cmd=['agent-browser','--session','civic',*map(str,args)]
 log.write('$ '+shlex.join(cmd)+'\n')
 p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=45)
 log.write(p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return p.stdout.strip()
def read(expr):
 raw=ab('eval','JSON.stringify('+expr+')');result=json.loads(raw)
 return json.loads(result) if isinstance(result,str) else result
def click(name):
 if name=='Apply phase plan':ab('scrollintoview','#applySignal')
 ab('find','role','button','click','--name',name)
def point(x,y):return read('civic.screenOf({x:'+str(x)+',y:'+str(y)+'})')
def tap_world(x,y):
 p=point(x,y);ab('mouse','move',p['x'],p['y']);ab('mouse','down');ab('mouse','up')
def advance(seconds):
 target=read('civic.sim.time')+seconds
 while read('civic.sim.time')<target:
  next_time=min(target,read('civic.sim.time')+110)
  ab('wait','--fn','civic.sim.time >= '+str(next_time))
def shot(name):ab('screenshot','evidence/screenshots/'+name+'.png')
def check(name,condition,details):
 status='pass' if condition else 'fail';r={'check':name,'status':status,'observed':details};results.append(r);log.write(json.dumps(r)+'\n');print(json.dumps(r),flush=True)
 if not condition:raise AssertionError(name+': '+str(details))
def save(): (ROOT/'evidence/logs/browser-desktop-results.json').write_text(json.dumps(results,indent=2))
try:
 ab('open','file://'+str(ROOT/'index.html'));ab('set','viewport','1280','800');ab('network','route','https://**','--abort');ab('network','route','http://**','--abort');ab('select','#scenarioSelect','downtown');click('Pause simulation');s=read('civic.state');t=read('civic.sim.time');click('Single step one second');u=read('civic.sim.time');check('pause and single step',abs(u-t-1)<1e-7 and read('civic.state.paused'),{'before':t,'after':u})
 n=read('({nodes:civic.sim.nodes.length,roads:civic.sim.roads.length})');click('Quick draw road');points=[point(x,y) for x,y in [(130,300),(220,340),(320,375),(420,420),(490,470)]]
 ab('mouse','move',points[0]['x'],points[0]['y']);ab('mouse','down')
 for p in points[1:]:ab('mouse','move',p['x'],p['y'])
 ab('mouse','up');ab('press','Escape');edited=read('({nodes:civic.sim.nodes.length,roads:civic.sim.roads.length,components:civic.sim.validate().components.length})');check('continuous road draw with crossings',edited['roads']>n['roads'] and edited['components']==1,edited);shot('04-desktop-road-connected')
 click('Undo edit');undone=read('civic.sim.roads.length');click('Redo edit');redone=read('civic.sim.roads.length');check('undo and redo',undone==n['roads'] and redone==edited['roads'],{'undo':undone,'redo':redone})
 click('One-way tool');tap_world(760,640);rid=read('civic.state.selection.id');oneway=read('civic.sim.road('+json.dumps(rid)+').oneway');route=read('(()=>{let r=civic.sim.road('+json.dumps(rid)+');return civic.sim.route(r.b,r.a)})()');check('one-way direction affects path choice',oneway==1 and (route is None or all(e['road']!=rid for e in route)),{'road':rid,'direction':oneway,'reverseTripPath':route})
 ab('select','#roadLanes','2');check('lane count inspector',read('civic.sim.road('+json.dumps(rid)+').lanes')==2,{'lanes':2});click('Close inspector')
 click('Traffic signal tool');tap_world(310,300);node=read('civic.state.selection.id');ab('select','#signalMode','edited');ab('find','label','Phase 1 duration','fill','12');ab('find','label','Phase 2 duration','fill','42');click('Apply phase plan');phases=read('civic.sim.node('+json.dumps(node)+').signal');check('user-edited signal timing',phases['phases'][0]['duration']==12 and phases['phases'][1]['duration']==42,phases);shot('05-signal-editor')
 ab('select','[aria-label="Phase 1 movement"]','ALL');click('Apply phase plan');issues=read('civic.sim.validate().issues');check('conflicting phase diagnostics',any('conflicting' in i['text'] for i in issues),issues);ab('select','[aria-label="Phase 1 movement"]','EW');click('Apply phase plan');click('Close inspector')
 click('Road closure tool');tap_world(580,470);closed=read('civic.state.selection.id');before=read('civic.state.metrics');holds=read('civic.sim.vehicles.filter(v=>v.edge?.road==='+json.dumps(closed)+').map(v=>({id:v.id,pos:v.pos,len:v.edge.len,speed:v.speed}))');check('closure applied',read('civic.sim.road('+json.dumps(closed)+').closed'),{'road':closed,'agentsOnRoad':holds});click('Close inspector');ab('find','role','button','click','--name','8×');click('Resume simulation');advance(125);click('Pause simulation');after=read('civic.state.metrics');afterholds=read('civic.sim.vehicles.filter(v=>v.edge?.road==='+json.dumps(closed)+').map(v=>({id:v.id,pos:v.pos,len:v.edge.len,speed:v.speed}))');stable=all(any(w['id']==v['id'] and w['pos']<w['len']/2 and w['speed']==0 for w in afterholds) for v in holds if v['pos']<v['len']/2);cleared=any(not any(w['id']==v['id'] for w in afterholds) for v in holds if v['pos']>=v['len']/2);check('closure barrier holds traffic and permits junction clearance and rerouting',after['rerouted']>before['rerouted'] and stable and cleared,{'before':before,'after':after,'strandedBefore':holds,'strandedAfter':afterholds});
 click('Map layers');ab('click','[data-overlay="queue"]');check('queue heatmap selected',read('civic.state.overlay')=='queue',{'overlay':'queue','queue':after['queue']});shot('06-closure-queue-heatmap')
 click('Quick select tool');ab('find','role','tab','click','--name','Transit');click('Create a transit route');
 for x in [130,670,1210]:tap_world(x,470)
 click('Finish route');routeid=read('civic.state.selection.id');check('create ordered transit route',read('civic.sim.routes.length')==2,read('civic.sim.routes.map(r=>({id:r.id,stops:r.stops,frequency:r.frequency}))'))
 ab('focus','#routeFrequency');ab('press','Home');ab('press','ArrowRight');ab('press','ArrowRight');ab('focus','#routeCapacity');ab('press','End');check('modify transit frequency and capacity',read('civic.sim.routes.find(r=>r.id==='+json.dumps(routeid)+').frequency')==20 and read('civic.sim.routes.find(r=>r.id==='+json.dumps(routeid)+').capacity')==160,read('civic.sim.routes.find(r=>r.id==='+json.dumps(routeid)+')'))
 click('Close inspector');click('Queue length');ab('click','[data-overlay="waiting"]');click('Resume simulation');advance(260);click('Pause simulation');m=read('civic.state.metrics');check('transit carries and completes real passenger trips',m['ridership']>after['ridership'] and m['transitCompleted']>0 and m['buses']>0,m);shot('07-transit-passengers')
 click('Analytics');click('Record current baseline');click('Car-only scenario');check('car-only comparison control',not read('civic.sim.settings.transit'),read('document.getElementById("baselineComparison").textContent'));click('Enable public transit');shot('08-analytics');click('Close dialog')
 click('City files');ab('fill','#saveName','Validation City');click('Save locally');saved=read('JSON.parse(localStorage.getItem("civic-named-v1"))["Validation City"].runtime.time');ab('fill','#importText','{"format":"civic-city","version":1,"city":{}}');click('Validate & load JSON');now=read('civic.sim.time');message=read('document.getElementById("importMessage").textContent');check('invalid JSON import is transactional',now==saved and 'supported' in message.lower(),{'savedTime':saved,'currentTime':now,'message':message});shot('09-invalid-import')
 click('Download JSON');click('Map PNG');click('Metrics CSV');click('Close dialog');click('Reset simulation');check('reset preserves road network',read('civic.sim.time')==0 and read('civic.sim.roads.length')==edited['roads'],read('({time:civic.sim.time,roads:civic.sim.roads.length})'));click('City files');ab('select','#namedCity','Validation City');click('Load saved city');check('named save reload restores exact time',abs(read('civic.sim.time')-saved)<1e-6,{'restored':read('civic.sim.time'),'saved':saved})
 click('City files');click('Set replay start here');click('Close dialog');replay_time=read('civic.sim.time');click('Single step one second');click('City files');click('Replay from saved start');check('deterministic replay start control',abs(read('civic.sim.time')-replay_time)<1e-6,{'replayedTime':read('civic.sim.time')});ab('reload');check('autosave survives browser reload',read('civic.sim.name')=='Validation City',{'city':read('civic.sim.name'),'time':read('civic.sim.time')});click('Pause simulation');
 click('Enable city audio');check('gesture enables procedural audio',read('civic.state.audio.state')=='running',read('civic.state.audio'));click('Mute city audio')
 errors=ab('errors');console=ab('console');requests=ab('network','requests');check('console and offline requests',not errors and ('https://' not in requests and 'http://' not in requests),{'errors':errors,'console':console,'requests':requests})
except Exception as e:
 log.write(traceback.format_exc());print('FAILED',str(e),flush=True);shot('desktop-test-failure-'+str(int(time.time())));raise
finally:save();log.close()
