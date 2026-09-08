import subprocess,json,time,hashlib,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
LOG=ROOT/'evidence/browser-commands.log'
SESSION='evo-final'
def ab(*args):
    command=['agent-browser','--session',SESSION,'--json',*map(str,args)]
    p=subprocess.run(command,capture_output=True,text=True,cwd=ROOT,timeout=35)
    with LOG.open('a') as f:f.write('$ '+' '.join(command)+'\n'+p.stdout+p.stderr+'\n')
    try:data=json.loads(p.stdout)
    except Exception:raise RuntimeError(p.stdout+p.stderr)
    if not data.get('success'):raise RuntimeError(data)
    return data.get('data',{})
def ev(js):return ab('eval',js).get('result')
def click(name):ab('find','role','button','click','--name',name,'--exact')
def snap(name):ab('screenshot','evidence/'+name+'.png')
def check(name,ok,detail):
    r={'check':name,'status':'pass' if ok else 'fail','observed':detail}
    print(json.dumps(r),flush=True)
    with (ROOT/'evidence/browser-results.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
    if not ok:raise AssertionError(name)
def state():return ev('JSON.parse(ecoLab.state.serialize())')
def digest(s):return hashlib.sha256(json.dumps(s,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def load(path):
    click('Load experiment');ab('snapshot','-i');ab('upload','#loadFile',str(ROOT/'evidence'/path));ab('wait','--fn','!document.querySelector("[role=dialog]")')
if __name__=='__main__':
    ab('set','viewport',1280,800)
    ab('network','route','https://*','--abort');ab('network','route','http://*','--abort');ab('set','offline','on')
    ab('open','file:///home/pyro/projects/naked/astra/bench/14-evolution-ecosystem/index.html');ab('wait','--fn','!!window.ecoLab');
    if not ev('ecoLab.view.paused'):click('Pause')
    ab('select','#presetSelect','balanced');
    if not ev('ecoLab.view.paused'):click('Pause')
    ab('select','#worldSize','medium');ab('fill','#seedInput','042');click('Apply')
    ab('snapshot','-i');click('Reset');a=state();time.sleep(.5);b=state();check('pause_stable',digest(a)==digest(b),{'tick':a['tick'],'population':len(a['organisms'])})
    click('Single step');c=state();check('single_step',c['tick']==a['tick']+1 and ev('ecoLab.view.paused'),{'before':a['tick'],'after':c['tick']})
    click('Reset');d=state();check('deterministic_reset',digest(a)==digest(d),{'initial_sha256':digest(d)})
    ab('focus','#world');ab('press','Space');ab('wait','--fn','ecoLab.state.tick > 70');ab('press','Space');e=state();check('keyboard_resume_pause',ev('ecoLab.view.paused') and e['tick']>70,{'tick':e['tick'],'totals':e['totals']})
    click('32×');click('Resume');ab('wait','--fn','ecoLab.state.tick >= 1200');click('Pause');e=state();check('ecology_over_time',e['totals']['births']>0 and e['totals']['deaths']>0 and e['totals']['mutations']>0 and e['totals']['fed']>0,{'tick':e['tick'],'population':len(e['organisms']),'totals':e['totals'],'generation':max(o['generation'] for o in e['organisms']),'samples':len(e['history'])})
    # Select a living descendant through a real canvas click, using live coordinates only to locate it.
    loc=ev('(()=>{const v=ecoLab.view,s=ecoLab.state,r=document.getElementById("world").getBoundingClientRect(),scale=Math.max(r.width/s.width,r.height/s.height)*1.01*v.camera.zoom;const o=s.organisms.find(o=>o.generation>0&&Math.abs(o.x-v.camera.x)<r.width/scale*.3&&Math.abs(o.y-v.camera.y)<r.height/scale*.3);return {id:o.id,x:r.x+r.width/2+(o.x-v.camera.x)*scale,y:r.y+r.height/2+(o.y-v.camera.y)*scale}})()')
    click('Select organism');ab('mouse','move',round(loc['x']),round(loc['y']));ab('mouse','down','left');ab('mouse','up','left');check('canvas_selection',ev('ecoLab.view.selected')==loc['id'],loc)
    ab('find','role','tab','click','--name','Sensors','--exact');before=ev('ecoLab.state.byId.get(ecoLab.view.selected)');snap('desktop-sensors');ab('find','role','tab','click','--name','Genome','--exact');check('genome_tab_returns',bool(ev('document.getElementById("inspectorDetails").textContent.includes("Movement")')),ev('document.getElementById("inspectorDetails").textContent'));ab('find','role','tab','click','--name','Sensors','--exact');click('Single step');click('Single step');click('Single step');click('Single step');after=ev('ecoLab.state.byId.get(ecoLab.view.selected)');check('live_inspector',after['age']>before['age'] and after['energy']!=before['energy'] and after['sensors']!=before['sensors'],{'id':after['id'],'parent':after['parent'],'age_before':before['age'],'age_after':after['age'],'energy_before':before['energy'],'energy_after':after['energy'],'sensors':after['sensors']})
    ab('find','role','tab','click','--name','Decisions','--exact');snap('desktop-decisions');click('Follow');check('follow_enabled',ev('ecoLab.view.following'),ev('ecoLab.view'));click('Lineage');ab('snapshot','-i');snap('lineage');check('lineage_tree',bool(ev('document.querySelectorAll("[data-ancestor]").length > 1')),ev('document.getElementById("dialogTitle").textContent'));ab('press','Escape')
    # Preserve the exact evolved state via the real download control, then load it via a file input.
    ab('download','#saveBtn','evidence/evolved-browser-save.json');saved=state();click('Single step');click('Reset');load('evolved-browser-save.json');loaded=state();check('json_round_trip',digest(saved)==digest(loaded),{'tick':loaded['tick'],'sha256':digest(loaded),'lineage_records':len(loaded['lineage'])})
    # The exact saved experiment survives a real navigation reload.
    ab('reload');ab('wait','--fn','window.ecoLab && ecoLab.view.paused');check('reload_autorestore',digest(loaded)==digest(state()),{'tick':ev('ecoLab.state.tick')})
    # Invalid JSON is rejected atomically.
    (ROOT/'evidence/invalid.json').write_text('{"version":1,"organisms":[]}')
    click('Load experiment');ab('upload','#loadFile',str(ROOT/'evidence/invalid.json'));ab('wait','--fn','document.getElementById("toast").textContent.startsWith("Load failed")');err=ev('document.getElementById("toast").textContent');check('invalid_import',digest(loaded)==digest(state()) and 'Load failed' in err,err);ab('press','Escape')
    # Reject a structurally plausible but inconsistent sensor state before replacement.
    bad=ev('JSON.parse(ecoLab.snapshot())');bad['simulation']['organisms'][0]['sensors']['threat']=1;bad['simulation']['organisms'][0]['sensors']['threatDistance']=None;bad['view']['selected']=bad['simulation']['organisms'][0]['id'];bad['view']['inspectTab']='sensors';(ROOT/'evidence/bad-sensors.json').write_text(json.dumps(bad));click('Load experiment');ab('upload','#loadFile',str(ROOT/'evidence/bad-sensors.json'));ab('wait','--fn','document.getElementById("toast").textContent.includes("sensor pair")');check('malformed_sensor_atomic_import',digest(loaded)==digest(state()),ev('document.getElementById("toast").textContent'));ab('press','Escape')
    # Autosave restoration uses the button in the load dialog.
    autosaved=ev('JSON.parse(localStorage.getItem("evo.autosave.v1")).simulation');click('Reset');click('Load experiment');ab('click','#restoreLocal');check('local_restore',digest(autosaved)==digest(state()),{'tick':ev('ecoLab.state.tick')})
    ab('download','#csvBtn','evidence/history-export.csv');rows=(ROOT/'evidence/history-export.csv').read_text().splitlines();check('csv_export',len(rows)==len(state()['history'])+1,{'rows':len(rows),'header':rows[0]})
    click('Field notes ↗');ab('download','#notesPNG','evidence/habitat-export.png');check('png_export',(ROOT/'evidence/habitat-export.png').read_bytes()[:8]==b'\x89PNG\r\n\x1a\n',{'bytes':(ROOT/'evidence/habitat-export.png').stat().st_size});ab('press','Escape')
    for mode in ['energy','temperature','moisture','behavior','vision','species','fertility','resources','generation','age','speed','lineage','natural']:
        ab('select','#viewMode',mode);check('view_'+mode,ev('ecoLab.view.mode')==mode,mode)
        if mode in ['energy','temperature','behavior']:snap('mode-'+mode)
    click('Diagnostic overlays');ab('check','[data-overlay=sensors]');ab('check','[data-overlay=targets]');ab('check','[data-overlay=vectors]');ab('check','[data-overlay=decisions]');click('Diagnostic overlays');snap('diagnostic-overlays');check('overlays',all(ev('ecoLab.view.overlays')[k] for k in ['sensors','targets','vectors','decisions']),ev('ecoLab.view.overlays'))
    for metric in ['vitality','energy','biomass','diversity','resources','traits','species','population']:
        ab('select','#chartMetric',metric)
    ab('scrollintoview','#historyChart');snap('history-and-species');click('Species phylogeny');snap('species-phylogeny');ab('press','Escape');ab('scroll','up',1000)
    check('console_clean',not ab('errors').get('errors'),ab('errors').get('errors'))
    requests=ab('network','requests').get('requests',[]);check('no_external_requests',not any(r['url'].startswith(('http://','https://')) for r in requests),[r['url'] for r in requests])
