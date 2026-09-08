import subprocess,json,shlex,pathlib,traceback,time
ROOT=pathlib.Path(__file__).resolve().parents[2]
log=open(ROOT/'evidence/logs/browser-final.txt','w',buffering=1);results=[]
def ab(*args):
 if args[:2]==('mouse','move'):args=(*args[:2],round(args[2]),round(args[3]))
 cmd=['agent-browser','--session','civic-audit',*map(str,args)];log.write('$ '+shlex.join(cmd)+'\n');p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=40);log.write(p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return p.stdout.strip()
def read(expr):
 v=json.loads(ab('eval','JSON.stringify('+expr+')'));return json.loads(v) if isinstance(v,str) else v
def click(name):ab('find','role','button','click','--name',name)
def tap(x,y):
 p=read('civic.screenOf({x:'+str(x)+',y:'+str(y)+'})');ab('mouse','move',p['x'],p['y']);ab('mouse','down');ab('mouse','up')
def check(name,ok,observed):
 r={'check':name,'status':'pass' if ok else 'fail','observed':observed};results.append(r);log.write(json.dumps(r)+'\n');print(json.dumps(r),flush=True)
 if not ok:raise AssertionError(name)
def shot(name):ab('screenshot','evidence/screenshots/'+name+'.png')
def layer(name):ab('click','#layersBtn');ab('click','[data-overlay="'+name+'"]')
try:
 ab('open','about:blank');ab('network','route','https://**','--abort');ab('network','route','http://**','--abort');ab('set','viewport',1280,800,2);ab('open','file://'+str(ROOT/'index.html'))
 presets=[]
 for key in ['crossroads','avenue','suburban','stadium','bridge','brt','strike','induced','stress','downtown']:
  ab('select','#scenarioSelect',key);click('Pause simulation');before=read('civic.sim.time');click('Single step one second');s=read('({key:civic.sim.scenarioKey,time:civic.sim.time,nodes:civic.sim.nodes.length,roads:civic.sim.roads.length,vehicles:civic.sim.vehicles.length,types:[...new Set(civic.sim.vehicles.map(v=>v.type))],transit:civic.sim.settings.transit,event:civic.sim.settings.event,closed:civic.sim.roads.filter(r=>r.closed).length,busLanes:civic.sim.roads.filter(r=>r.busLane).length,stops:civic.sim.stops.length,routes:civic.sim.routes.length,diagnostics:civic.sim.validate().issues})');s['stepDelta']=s['time']-before;presets.append(s)
 check('all ten presets instantiate and respond to single-step',len(presets)==10 and all(s['vehicles']>0 and abs(s['stepDelta']-1)<.00001 for s in presets),presets)
 p={s['key']:s for s in presets};check('scenario-specific state is functional',p['bridge']['closed']>0 and p['brt']['busLanes']>0 and p['stadium']['event'] and not p['strike']['transit'] and 'bus' not in p['strike']['types'],{'bridge':p['bridge']['closed'],'brtBusLanes':p['brt']['busLanes'],'event':p['stadium']['event'],'strikeTypes':p['strike']['types']})
 # Toggle the final three diagnostic renderers via labeled controls.
 layer('emissions');em=read('({overlay:civic.state.overlay,rates:Object.values(civic.sim.byRoad).reduce((n,r)=>n+r.emissions,0),vehicleRates:civic.sim.vehicles.filter(v=>v.edge).reduce((n,v)=>n+(v.emissionRate||0),0),cumulative:civic.sim.counters.emissions,allFinite:Object.values(civic.sim.byRoad).every(r=>Number.isFinite(r.emissions)&&r.emissions>=0),legend:document.getElementById("mapLegend").textContent})');check('emissions overlay displays finite sampled local rates',em['rates']>0 and em['allFinite'] and em['rates']<em['cumulative'] and '1 s samples' in em['legend'],em);shot('22-local-emissions')
 click('Traffic signal tool');tap(310,300);node=read('civic.state.selection.id');roads=read('civic.sim.roads.filter(r=>r.a==='+json.dumps(node)+'||r.b==='+json.dumps(node)+').map(r=>r.id)');ab('select','#turnFrom',roads[0]);ab('select','#turnTo',roads[1]);ab('scrollintoview','#banTurn');click('Prohibit this movement');ban=read('civic.sim.node('+json.dumps(node)+').bans');check('turn ban is editable through the junction inspector',roads[0]+'>'+roads[1] in ban,{'node':node,'bans':ban});layer('turns');shot('23-live-turn-movements');click('Close inspector');ab('press','Escape');layer('coverage');shot('24-transit-catchments');check('coverage uses active-stop walking catchments',read('civic.state.overlay')=='coverage' and '240' in read('document.getElementById("mapLegend").textContent'),{'servedStops':read('civic.sim.stops.length'),'legend':read('document.getElementById("mapLegend").textContent')})
 # Pan with actual keyboard/pointer input, then select a moving-agent footprint.
 layer('none');old=read('civic.state.camera');ab('press','h');ab('mouse','move',650,420);ab('mouse','down');ab('mouse','move',690,450);ab('mouse','up');new=read('civic.state.camera');check('camera hand tool does not draw roads',new['x']!=old['x'] and read('civic.sim.roads.length')==58,{'before':old,'after':new});click('Fit city to screen');ab('press','v')
 vp=read('(()=>{for(const v of civic.sim.vehicles){if(!v.edge||v.pos<25||v.pos>v.edge.len-25)continue;const p=vehiclePoint(v),s=civic.screenOf(p);if(s.x>430&&s.x<920&&s.y>240&&s.y<560)return {id:v.id,p,s}}return null})()');ab('mouse','move',vp['s']['x'],vp['s']['y']);ab('mouse','down');ab('mouse','up');selected=read('civic.state.selection');check('pointer selection opens a real vehicle with a remaining route',selected['type']=='vehicle' and read('civic.sim.vehicles.find(v=>v.id===civic.state.selection.id).path.length')>0,{'selection':selected,'path':read('civic.sim.vehicles.find(v=>v.id===civic.state.selection.id).path')});shot('25-vehicle-inspector');click('Close inspector')
 # Final screen captures after transient UI has cleared.
 ab('wait','--fn','!document.getElementById("toast").classList.contains("visible")');shot('26-delivered-desktop');ab('set','viewport',390,844,2);click('Fit city to screen');shot('27-delivered-mobile');check('final narrow viewport remains within its bounds',read('document.documentElement.scrollWidth')==390,{'viewport':390,'documentWidth':read('document.documentElement.scrollWidth')});ab('set','viewport',1280,800,2);click('Fit city to screen')
 errors=ab('errors');console=ab('console');requests=ab('network','requests');check('final direct-file console and offline audit',not errors and not console and 'https://' not in requests and 'http://' not in requests,{'errors':errors,'console':console,'requests':requests})
except Exception:
 log.write(traceback.format_exc());print(traceback.format_exc(),flush=True)
 try:shot('final-audit-failure-'+str(int(time.time())))
 except:pass
 raise
finally:(ROOT/'evidence/logs/browser-final-results.json').write_text(json.dumps(results,indent=2));log.close()
