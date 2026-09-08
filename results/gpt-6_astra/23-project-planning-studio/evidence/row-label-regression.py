from browser_checks import *
reset();m=source()
for i in range(20):m['tasks'].append({'id':'A'+str(i),'name':'Branch '+str(i),'duration':1,'priority':0,'resourceId':None,'predecessors':[],'notBefore':None})
m['tasks'][3]['predecessors']+=['A'+str(i) for i in range(20)]
m['resources'][0]['name']='Resource '*22
import_text(m)
geometry=js('({heights:[...document.querySelectorAll("#task-rows tr")].map(x=>x.getBoundingClientRect().height),width:document.documentElement.scrollWidth})')
print(geometry)
assert all(h==54 for h in geometry['heights']), 'Dependency labels must not change the common table/Gantt row height'
assert js('document.querySelector(".table-wrap").scrollWidth')==js('document.querySelector(".table-wrap").clientWidth'),'Task labels must not create hidden horizontal overflow'
assert geometry['width']==1280,'Long resource text must stay within its table cell'
print('PASS long dependency/resource labels retain aligned rows')
