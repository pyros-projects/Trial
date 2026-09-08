import subprocess,json,shlex,pathlib,time,traceback,struct
ROOT=pathlib.Path(__file__).resolve().parents[2]
(ROOT/'evidence/exports').mkdir(exist_ok=True)
log=open(ROOT/'evidence/logs/browser-mobile-stress.txt','w',buffering=1);results=[]
def ab(*args):
 if args[:2]==('mouse','move'):args=(*args[:2],round(args[2]),round(args[3]))
 cmd=['agent-browser','--session','civic-final',*map(str,args)];log.write('$ '+shlex.join(cmd)+'\n');p=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,timeout=40);log.write(p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return p.stdout.strip()
def read(expr):
 raw=ab('eval','JSON.stringify('+expr+')');v=json.loads(raw);return json.loads(v) if isinstance(v,str) else v
def click(name):
 scrolls={'Simulation settings':'#advancedBtn','Apply phase plan':'#applySignal','Remove':'#deleteSelected'}
 if name in scrolls:ab('scrollintoview',scrolls[name])
 ab('find','role','button','click','--name',name)
def point(x,y):return read('civic.screenOf({x:'+str(x)+',y:'+str(y)+'})')
def tap(x,y):
 p=point(x,y);ab('mouse','move',p['x'],p['y']);ab('mouse','down');ab('mouse','up')
def draw(points):
 ps=[point(x,y) for x,y in points];ab('mouse','move',ps[0]['x'],ps[0]['y']);ab('mouse','down')
 for p in ps[1:]:ab('mouse','move',p['x'],p['y'])
 ab('mouse','up')
def shot(name):ab('screenshot','evidence/screenshots/'+name+'.png')
def check(name,ok,observed):
 r={'check':name,'status':'pass' if ok else 'fail','observed':observed};results.append(r);log.write(json.dumps(r)+'\n');print(json.dumps(r),flush=True)
 if not ok:raise AssertionError(name)
def advance(n):
 target=read('civic.sim.time')+n
 while read('civic.sim.time')<target:ab('wait','--fn','civic.sim.time>='+str(min(target,read('civic.sim.time')+100)))
try:
 ab('--allow-file-access','--download-path',str(ROOT/'evidence/exports'),'open','about:blank');ab('network','route','https://**','--abort');ab('network','route','http://**','--abort');ab('set','viewport','1280','800','2');ab('open','file://'+str(ROOT/'index.html'));ab('select','#scenarioSelect','downtown');click('Pause simulation');shot('13-desktop-final')
 dims=read('({dpr:devicePixelRatio,css:document.getElementById("cityCanvas").clientWidth,pixels:document.getElementById("cityCanvas").width})');check('high-DPI canvas',dims['dpr']==2 and dims['pixels']==dims['css']*2,dims)
 click('City files');ab('download','#jsonExport',str(ROOT/'evidence/exports/city.json'));ab('download','#pngExport',str(ROOT/'evidence/exports/map.png'));ab('download','#csvExport',str(ROOT/'evidence/exports/metrics.csv'))
 city=json.loads((ROOT/'evidence/exports/city.json').read_text());png=(ROOT/'evidence/exports/map.png').read_bytes();csv=(ROOT/'evidence/exports/metrics.csv').read_text();check('JSON, PNG and CSV downloads contain real data',city['format']=='civic-city' and png[:8]==b'\x89PNG\r\n\x1a\n' and len(csv.splitlines())>3,{'jsonBytes':(ROOT/'evidence/exports/city.json').stat().st_size,'pngDimensions':struct.unpack('>II',png[16:24]),'csvRows':len(csv.splitlines())})
 click('Close dialog');ab('select','#scenarioSelect','crossroads');click('Pause simulation');click('City files');ab('upload','#importFile',str(ROOT/'evidence/exports/city.json'));ab('wait','--fn','civic.sim.name==="Downtown grid"');check('downloaded JSON reloads through file input',read('civic.sim.roads.length')==58,{'roads':read('civic.sim.roads.length'),'time':read('civic.sim.time')})
 ab('set','viewport','390','844','2');click('Fit city to screen');shot('14-mobile-initial');ab('snapshot','-i');layout=read('({width:innerWidth,scroll:document.documentElement.scrollWidth,canvasWidth:document.getElementById("cityCanvas").clientWidth})');check('390 by 844 layout has no horizontal overflow',layout['width']==390 and layout['scroll']==390,layout)
 click('Edit city');shot('15-mobile-editor');ab('find','role','tab','click','--name','Demand');ab('select','#weatherSelect','rain');ab('focus','#demandScale');ab('press','Home');ab('press','ArrowRight');ab('press','ArrowRight');ab('press','ArrowRight');check('mobile labeled demand and weather controls',read('civic.sim.settings.weather')=='rain' and abs(read('civic.sim.settings.demand')-.3)<.001,read('({weather:civic.sim.settings.weather,demand:civic.sim.settings.demand})'));click('Close city editor')
 click('Quick draw road');tap(130,300);ab('set','viewport','430','900','2');before=read('civic.sim.roads.length');draw([(130,300),(230,350),(350,395),(490,470)]);ab('press','Escape');after=read('civic.sim.roads.length');check('road drawing survives resize during a road chain',after>before and read('civic.sim.validate().components.length')==1,{'before':before,'after':after,'tool':read('civic.state.tool')});ab('set','viewport','390','844','2');draw([(490,470),(650,535),(790,610),(850,640)]);ab('press','Escape');after2=read('civic.sim.roads.length');check('continuous pointer drawing after narrow resize',after2>after and read('civic.sim.validate().components.length')==1,{'roads':after2,'components':read('civic.sim.validate().components.length')});shot('16-mobile-drawing-resize');ab('press','Control+z');check('mobile keyboard undo',read('civic.sim.roads.length')==after,{'roads':read('civic.sim.roads.length')});ab('press','Control+Shift+z')
 click('Edit city');ab('find','role','tab','click','--name','Build');click('Bus stop tool');tap(490,300);ab('fill','#stopName','North Library');click('Close inspector');check('mobile stop placement and rename',read('civic.sim.stops.some(s=>s.name==="North Library")'),read('civic.sim.stops.map(s=>({name:s.name,node:s.node}))'))
 click('Edit city');click('Land-use zone tool');tap(850,130);check('mobile trip-generator placement',read('civic.state.selection.type')=='zone',read('civic.state.selection'));click('Close inspector');ab('press','Escape');click('Analytics');ab('press','Tab');focus=read('!!document.activeElement.closest("#modalBackdrop")');check('dialog keyboard navigation',focus,{'focusRemainsInDialog':focus});shot('17-mobile-analytics');ab('press','Escape');check('Escape closes navigation dialog',read('!document.getElementById("modalBackdrop").classList.contains("open")'),{'closed':True})
 click('Edit city');click('Simulation settings');ab('fill','#settingsSeed','2026');ab('select','#settingsPolicy','fixed');ab('select','#settingsMapSize','2500');ab('uncheck','#settingsSandbox');ab('fill','#settingsBudget','0');click('Apply settings');check('seed, map size, fixed policy and budget controls',read('civic.sim.settings.seed')==2026 and read('civic.sim.settings.mapSize')==2500 and read('civic.sim.nodes.filter(n=>n.signal&&n.signal.mode!=="fixed"&&n.signal.mode!=="edited").length')==0,read('({seed:civic.sim.settings.seed,map:civic.sim.settings.mapSize,sandbox:civic.sim.settings.sandbox,budget:civic.sim.settings.budget,policy:civic.sim.settings.policy})'))
 click('Close city editor');click('Quick draw road');b=read('civic.sim.roads.length');draw([(130,640),(250,710),(310,810)]);check('insufficient road budget fails without mutation',read('civic.sim.roads.length')==b and 'budget' in read('document.getElementById("toast").textContent').lower(),{'roads':read('civic.sim.roads.length'),'message':read('document.getElementById("toast").textContent')});ab('press','Escape')
 ab('set','viewport','1280','800','2');ab('select','#scenarioSelect','stress');ab('find','role','button','click','--name','8×');before=read('civic.sim.time');advance(150);click('Pause simulation');m=read('civic.state');check('dense stress preset runs hundreds of real agents',m['metrics']['vehicles']>=500 and m['metrics']['completed']>0 and m['fps']>20,{'simTime':read('civic.sim.time'),'fps':m['fps'],'effectiveSpeed':m['effectiveSpeed'],'metrics':m['metrics'],'nodes':read('civic.sim.nodes.length'),'roads':read('civic.sim.roads.length')})
 coherence=read('(()=>{const s=civic.sim,groups=new Map();let badEdges=0,overlaps=0,nonfinite=0;for(const v of s.vehicles){if(!v.edge)continue;if(!s.edgeMap.has(v.edge.road+"|"+v.edge.from))badEdges++;if(!Number.isFinite(v.pos)||!Number.isFinite(v.speed)||v.pos<0||v.pos>v.edge.len+.01)nonfinite++;const key=s.laneKey(v.edge,v.lane);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(v)}for(const vs of groups.values()){vs.sort((a,b)=>b.pos-a.pos);for(let i=1;i<vs.length;i++)if(vs[i-1].pos-vs[i].pos<vs[i-1].length+1.8)overlaps++}return{badEdges,overlaps,nonfinite}})()');check('live stress agent geometry and lane gaps',coherence=={'badEdges':0,'overlaps':0,'nonfinite':0},coherence)
 ab('click','#layersBtn');ab('click','[data-overlay="density"]');shot('18-stress-density');ab('click','#layersBtn');ab('click','[data-overlay="signals"]');shot('19-stress-signals');ab('click','#layersBtn');ab('click','[data-overlay="validation"]');check('network validation overlay',read('civic.state.overlay')=='validation',read('civic.sim.validate()'));shot('20-network-validation')
 # Compact regression after the final signal-mode adjustment.
 click('Traffic signal tool');tap(360,245);ab('select','#signalMode','fixed');ab('scrollintoview','#applySignal');click('Apply phase plan');check('fixed junction selection persists',read('civic.sim.node(civic.state.selection.id).signal.mode')=='fixed',read('civic.sim.node(civic.state.selection.id).signal'));click('Close inspector')
 click('City files');ab('download','#jsonExport',str(ROOT/'evidence/exports/stress-city.json'));click('Close dialog');ab('select','#scenarioSelect','downtown');click('Pause simulation');shot('21-final-workspace');check('final console and request audit',not ab('errors'),{'console':ab('console'),'requests':ab('network','requests')})
except Exception:
 log.write(traceback.format_exc());print(traceback.format_exc(),flush=True)
 try:shot('mobile-stress-failure-'+str(int(time.time())))
 except:pass
 raise
finally:(ROOT/'evidence/logs/browser-mobile-stress-results.json').write_text(json.dumps(results,indent=2));log.close()
