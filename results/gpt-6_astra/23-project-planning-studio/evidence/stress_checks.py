from browser_checks import *
import xml.etree.ElementTree as ET
ab('frame','main');ab('open','http://127.0.0.1:18765/index.html');ab('set','viewport','1280','800');reset();seed=source()
# Minimum required scale; general IDs and no injected expected schedule.
m=json.loads(json.dumps(seed));m['resources']=[{'id':'r'+str(i),'name':'Resource '+str(i),'capacity':1} for i in range(8)];m['tasks']=[{'id':'job_'+str(i),'name':'Job '+str(i),'duration':2,'priority':i,'resourceId':'r'+str(i%8),'predecessors':[],'notBefore':None} for i in range(50)]
import_text(m);assert summary()[:2]==[14,2];assert len(intervals())==50
ab('scroll','down','300','--selector','.table-wrap');ab('wait','--fn','document.querySelector(".table-wrap").scrollTop===document.querySelector("#gantt-scroll").scrollTop && document.querySelector(".table-wrap").scrollTop>0');screenshot('stress-50-row-alignment.png')
ab('scroll','down','240','--selector','#gantt-scroll');ab('wait','--fn','document.querySelector(".table-wrap").scrollTop===document.querySelector("#gantt-scroll").scrollTop');assert js('document.querySelector(".table-wrap").scrollTop')>=500
# Same-date resource slots never overbook at scale.
assert js('[...document.querySelectorAll(".occ-ratio")].every(x=>{let [a,b]=x.textContent.split("/").map(Number);return a<=b})')
print('PASS 50 tasks/eight resources, occupancy, bidirectional row scroll alignment',flush=True)
# Published maximum task/resource capacity and bounded rejection of larger imports.
large=json.loads(json.dumps(m));large['resources']=[{'id':'r'+str(i),'name':'Resource '+str(i),'capacity':4} for i in range(16)];large['tasks']=[{'id':'job_'+str(i),'name':'Job '+str(i),'duration':260,'priority':i,'resourceId':'r'+str(i%16),'predecessors':[],'notBefore':None} for i in range(200)]
started=time.monotonic();import_text(large);elapsed=time.monotonic()-started;assert len(intervals())==200 and summary()[:2]==[1040,260];assert elapsed<15
button('Resources');button('Later →');assert js('document.querySelector(".occ-cell").dataset.day')=='20';button('← Earlier');assert js('document.querySelector(".occ-cell").dataset.day')=='0'
svg=export('svg','200-tasks.svg');root=ET.fromstring(svg);assert len([e for e in root.iter() if e.tag.endswith('g') and 'bar ' in e.get('class','')])==200
bad=json.loads(json.dumps(large));bad['tasks'].append({'id':'overflow','name':'Overflow','duration':1,'priority':0,'resourceId':None,'predecessors':[],'notBefore':None});assert '200' in import_text(bad,False);assert source()==large
print('PASS 200 tasks/16 resources, 1040-day schedule, pagination, complete SVG, 201-task rejection; import workflow %.2fs'%elapsed,flush=True)
# Empty plan and no-resource states.
empty=json.loads(json.dumps(seed));empty['tasks']=[];empty['resources']=[];import_text(empty);button('Overview');assert summary()[:2]==[0,0];assert len(intervals())==0;assert 'No resources yet' in js('document.querySelector("#resource-panel").innerText')
assert len(list(csv.DictReader(io.StringIO(export('csv','empty.csv')))))==0;ET.fromstring(export('svg','empty.svg'));screenshot('empty-plan.png')
button('Add task');fill('New task ID','__proto__');fill('New task name','Prototype is just a stable ID');fill('New task duration','1');fill('New task priority','0');button('Create task');assert intervals()=={'__proto__':[0,1]}
print('PASS empty states and arbitrary __proto__ task ID',flush=True)
# Long names: inspect actual exported SVG text bounding boxes in Chrome.
long=json.loads(json.dumps(seed));long['project']['name']='W'*200;long['tasks'][4]['name']='Milestone '+('W'*190);long['tasks'][0]['name']='Full exported task name '+('W'*176);import_text(long);export('svg','long-labels.svg')
ab('open','http://127.0.0.1:18765/evidence/downloads/long-labels.svg')
bounds=js('(()=>{const s=document.documentElement,box=s.viewBox.baseVal;return {width:box.width,height:box.height,outside:[...s.querySelectorAll("text")].filter(t=>{const b=t.getBBox();return b.x<0||b.y<0||b.x+b.width>box.width+1||b.y+b.height>box.height+1}).map(t=>t.textContent)}})()')
(ROOT/'evidence/svg-bounds.json').write_text(json.dumps(bounds,indent=2));assert bounds['outside']==[],bounds
print('PASS full long export labels inside SVG viewBox',flush=True)
ab('open','http://127.0.0.1:18765/index.html');reset()
