import subprocess, json, shlex, pathlib, csv, io, re, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
LOG=ROOT/'evidence/browser-actions.log'
RESULTS=ROOT/'evidence/browser-results.json'
OUT={}
def ab(*args,stdin=None,json_mode=False):
 cmd=['agent-browser','--session','planner']+(['--json'] if json_mode else [])+list(args)
 p=subprocess.run(cmd,input=stdin,text=True,capture_output=True,cwd=ROOT,timeout=45)
 with LOG.open('a') as f:f.write('$ '+shlex.join(cmd)+ (' <<JAVASCRIPT\n'+stdin+'\nJAVASCRIPT' if stdin else '')+'\n'+p.stdout+p.stderr+'\n')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 if json_mode:
  response=json.loads(p.stdout)
  if not response.get('success'):raise RuntimeError(str(response))
  return response['data'].get('result',response['data'])
 return p.stdout

def js(code):return ab('eval','--stdin',stdin=code,json_mode=True)
def snap():return ab('snapshot','-i')
def click(label):return ab('click',f'[aria-label="{label}"]')
def fill(label,value):return ab('find','label',label,'fill',str(value))
def button(name):return ab('find','role','button','click','--name',name,'--exact')
def reset():
 button('Reset');ab('click','.tabs [data-view="plan"]');snap()
def intervals():
 return js('Object.fromEntries([...document.querySelectorAll("#task-rows tr")].map(r=>[r.dataset.task,[...r.cells[3].innerText.matchAll(/\\d+/g)].slice(0,2).map(x=>+x[0])]))')
def expect_intervals(expected):assert intervals()==expected,(intervals(),expected)
def summary():return js('[...document.querySelectorAll(".stat-value")].map(e=>parseInt(e.textContent))')
def selected(id):
 state=js('({row:document.querySelector("#task-rows .selected")?.dataset.task,bar:document.querySelector(".bar.selected")?.dataset.id,slots:[...document.querySelectorAll(".slot.selected")].map(x=>x.dataset.select),inspector:document.querySelector(".detail-id")?.textContent})')
 assert state['row']==id and state['bar']==id and state['inspector']==id and all(s==id for s in state['slots']),state

def export(kind,name):
 button('Files');snap();ab('download',f'[data-export="{kind}"]',str(ROOT/'evidence/downloads'/name));click('Close dialog');return (ROOT/'evidence/downloads'/name).read_text()
def source():
 button('Files');button('Load current JSON into editor');text=js('document.querySelector("#import-text").value');click('Close dialog');return json.loads(text)
def import_text(model,expect=True):
 button('Files');fill('Project JSON text',json.dumps(model));button('Import plan')
 if expect:assert not js('document.querySelector("#modal").open')
 else:
  message=js('document.querySelector("#modal-error").textContent');assert message;click('Close dialog');return message

def screenshot(name):ab('screenshot',str(ROOT/'evidence/screenshots'/name))
def record(name,fn):
 try:
  fn();OUT[name]={'status':'pass'};print('PASS',name,flush=True)
 except Exception as e:
  OUT[name]={'status':'fail','error':str(e)};print('FAIL',name,str(e),flush=True);raise
 finally:RESULTS.write_text(json.dumps(OUT,indent=2))
SEED={'T1':[0,2],'T2':[2,5],'T3':[5,7],'T4':[7,8],'T5':[8,8]}
CAP={'T1':[0,2],'T2':[2,5],'T3':[2,4],'T4':[5,6],'T5':[6,6]}
GAP={'T1':[0,2],'T2':[5,8],'T3':[2,4],'T4':[8,9],'T5':[9,9]}

def plan01():
 reset();expect_intervals(SEED);assert summary()[:2]==[8,6]
 click('Select T3 Documentation');selected('T3')
 click('Select T3 Documentation, start 5, finish 7');selected('T3')
 click('Select T3 on 2026-09-14 in R1');selected('T3')
 text=js('document.querySelector("#inspector").innerText');assert 'Blocked [2, 5) T2' in text and '3 working days waiting for Studio' in text
 screenshot('plan01-resource-selection.png')
 click('Select T2 Build');text=js('document.querySelector("#inspector").innerText');assert '2026-09-11' in text and '14 Sep' in text
 rows=list(csv.DictReader(io.StringIO(export('csv','seed.csv'))));assert len(rows)==5
 row=next(r for r in rows if r['task_id']=='T2');assert row['actual_finish_date_exclusive']=='2026-09-14' and row['last_working_date']=='2026-09-11'
 assert next(r for r in rows if r['task_id']=='T5')['last_working_date']==''
 assert all(int(e.split('/')[0])<=1 for e in js('[...document.querySelectorAll("[data-resource=R1] .occ-ratio")].map(x=>x.textContent)'))
 click('Select T3 Documentation');ab('scroll','up','2000');screenshot('plan01-desktop.png')

def plan02():
 reset();ab('check','#critical-toggle');assert js('[...document.querySelectorAll(".bar.critical")].map(x=>x.dataset.id)')==['T1','T2','T4','T5']
 assert js('[...document.querySelectorAll(".dependency.critical")].map(x=>x.dataset.from+"→"+x.dataset.to)')==['T1→T2','T2→T4','T4→T5']
 for id,float_value in [('T1',0),('T2',0),('T3',1),('T4',0),('T5',0)]:
  ab('click',f'#task-rows tr[data-task="{id}"] .task-name');assert js('document.querySelector(".cpm-values div:last-child strong").textContent')==str(float_value)
 fill('Capacity for R1 Studio','2');ab('press','Tab');expect_intervals(CAP);assert summary()[:2]==[6,6];screenshot('plan02-capacity-two.png')
 click('Undo');expect_intervals(SEED);assert js('document.querySelector("[data-capacity=R1]").value')=='1'

def plan03():
 reset();fill('Duration for T1','3');ab('press','Tab');expected={'T1':[0,3],'T2':[3,6],'T3':[6,8],'T4':[8,9],'T5':[9,9]};expect_intervals(expected);assert summary()[:2]==[9,7]
 click('Undo');expect_intervals(SEED);assert summary()[:2]==[8,6]
 click('Redo');expect_intervals(expected);assert summary()[:2]==[9,7];assert js('document.querySelector("[data-id=T1][data-inline=duration]").value')=='3'

def drag_to(id,target,cancel=False):
 ab('scrollintoview',f'.bar[data-id="{id}"]')
 g=js('(()=>{const b=document.querySelector(".bar[data-id='+id+'] rect").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,scroll:document.querySelector("#gantt-scroll").scrollLeft}})()')
 # Width of a positive bar equals duration * working-day pixel width minus four.
 dur=int(js('document.querySelector("[data-id='+id+'][data-inline=duration]").value'));w=(g['width']+4)/dur;start=intervals()[id][0]
 ab('mouse','move',str(round(g['x'])),str(round(g['y'])));ab('mouse','down','left');ab('mouse','move',str(round(g['x']+(target-start)*w)),str(round(g['y'])))
 preview=js('document.querySelector("#drag-preview").textContent');assert f'requested day {target}' in preview,preview
 screenshot('drag-'+('cancel' if cancel else 'preview')+'.png')
 if cancel:ab('press','Escape')
 ab('mouse','up','left')

def plan04():
 reset();drag_to('T2',5);expect_intervals(GAP);assert source()['tasks'][1]['notBefore']=='2026-09-14'
 click('Undo');expect_intervals(SEED);click('Select T2 Build');fill('Not-before date','2026-09-12');button('Apply');expect_intervals(GAP)
 assert js('document.querySelector("#not-before").value')=='2026-09-14';assert 'weekend' in js('document.querySelector("#notice-text").textContent');screenshot('plan04-weekend-normalized.png')
 before=source();undo_title=js('document.querySelector("#undo").title');drag_to('T2',6,True);assert source()==before;expect_intervals(GAP);assert js('document.querySelector("#undo").title')==undo_title

if __name__=='__main__':
 ab('reload');snap()
 for name,fn in [('PLAN-01',plan01),('PLAN-02',plan02),('PLAN-03',plan03),('PLAN-04',plan04)]:record(name,fn)

def open_editor(id):
 ab('click',f'#task-rows tr[data-task="{id}"] .task-name')
 if not js('document.querySelector("#task-editor").open'):ab('click','#task-editor summary')

def plan05():
 reset();base=source();open_editor('T1')
 for predecessor in ['T5','missing_task']:
  fill('Predecessor IDs',predecessor);button('Save task');assert 'cycle' in js('document.querySelector("#notice-text").textContent').lower() if predecessor=='T5' else 'missing predecessor' in js('document.querySelector("#notice-text").textContent')
  expect_intervals(SEED);assert source()==base;assert js('document.querySelector("#undo").disabled')
 bad=json.loads(json.dumps(base));bad['tasks'].append(bad['tasks'][0].copy());assert 'Duplicate task ID' in import_text(bad,False);assert source()==base
 fill('Capacity for R1 Studio','0');ab('press','Tab');assert '1 through 4' in js('document.querySelector("#notice-text").textContent');assert source()==base
 click('Edit project');fill('Project start date','2026-02-30');button('Save changes');assert 'impossible' in js('document.querySelector("#modal-error").textContent');click('Close dialog');assert source()==base
 for label,value in [('Duration for T1','1000000000'),('Priority for T1','10000')]:
  fill(label,value);ab('press','Tab');assert source()==base;expect_intervals(SEED)
 click('Select T2 Build');fill('Not-before date','2040-01-02');button('Apply');assert '2600' in js('document.querySelector("#notice-text").textContent');assert source()==base;screenshot('plan05-horizon-rejected.png')
 open_editor('T1');button('Delete task');button('Cancel');assert source()==base
 button('Delete task');button('Delete task & remove edges');deleted=source();assert len(deleted['tasks'])==4 and all('T1' not in t['predecessors'] for t in deleted['tasks']);click('Undo');assert source()==base;expect_intervals(SEED)
 ab('click','[data-resource-edit="R1"]');button('Delete resource');assert 'assigned to T1, T2, T3' in js('document.querySelector("#modal-error").textContent');click('Close dialog');assert source()==base
 button('Add task');fill('New task ID','U');fill('New task name','Unassigned root');fill('New task duration','1');fill('New task priority','0');button('Create task')
 button('Add task');fill('New task ID','M');fill('New task name','Checkpoint');fill('New task duration','0');fill('New task priority','0');ab('check','input[name=dep][value=U]');button('Create task')
 expect_intervals({**SEED,'U':[0,1],'M':[1,1]});assert summary()[:2]==[8,6];screenshot('plan05-created-root-milestone.png')

def plan06():
 reset();fill('Priority for T3','2');ab('press','Tab');saved=json.loads(export('json','tie-priority.json'));reversed_plan=json.loads(json.dumps(saved));reversed_plan['tasks'].reverse();path=ROOT/'evidence/downloads/reversed-tie.json';path.write_text(json.dumps(reversed_plan))
 button('Files');ab('upload','#import-file',str(path));ab('wait','--fn','document.querySelector("#import-text").value.length > 0');assert json.loads(js('document.querySelector("#import-text").value'))==reversed_plan;button('Import plan');expect_intervals(SEED)
 fill('Duration for T1','3');ab('press','Tab');pre_import=source();import_text(saved);expect_intervals(SEED);click('Undo');assert source()==pre_import;assert summary()[:2]==[9,7]
 import_text(saved)
 # Predict an independent change: T3 duration 4 occupies [5,9), Review [9,10), Launch [10,10); dependency CPM becomes 7, T2 float 1.
 fill('Duration for T3','4');ab('press','Tab');expect_intervals({'T1':[0,2],'T2':[2,5],'T3':[5,9],'T4':[9,10],'T5':[10,10]});assert summary()[:2]==[10,7]
 m=source();m['tasks'][0]['name']='<img src=x onerror="window.injected=true">';m['tasks'][1]['name']='Build, "release"\nsecond line';m['resources'][0]['name']='Studio, "A"';import_text(m)
 assert js('document.querySelectorAll("#workspace img").length')==0 and js('Boolean(window.injected)')==False
 rows=list(csv.DictReader(io.StringIO(export('csv','quoted.csv'))));row=next(r for r in rows if r['task_id']=='T2');assert row['task_name']=='Build, "release"\nsecond line' and row['resource_name']=='Studio, "A"' and row['predecessors']=='T1' and row['dependency_only_float']=='1'
 svg=export('svg','current-gantt.svg');import xml.etree.ElementTree as ET;root=ET.fromstring(svg);assert '<img src=x onerror="window.injected=true">' in ''.join(root.itertext());assert '2026-09-21' in svg;assert len([e for e in root.iter() if e.tag.endswith('g') and 'bar ' in e.get('class','')])==5
 final=json.loads(export('json','roundtrip.json'));assert final==m
 screenshot('plan06-inert-name.png')
