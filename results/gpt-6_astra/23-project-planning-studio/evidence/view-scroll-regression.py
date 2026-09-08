from browser_checks import *
ab('frame','main');ab('open','http://127.0.0.1:18765/index.html');ab('set','viewport','1280','800');reset();m=source();m['tasks']=[{'id':'A'+str(i),'name':'Task '+str(i),'duration':1,'priority':i,'resourceId':None,'predecessors':[],'notBefore':None} for i in range(20)];import_text(m)
button('Table');ab('scroll','down','300','--selector','.table-wrap');button('Overview')
pos=js('({table:document.querySelector(".table-wrap").scrollTop,gantt:document.querySelector("#gantt-scroll").scrollTop})');print(pos);assert pos['table']==pos['gantt'],'Entering Overview must align the table and Gantt scroll positions'
button('Gantt');ab('scroll','down','200','--selector','#gantt-scroll');button('Overview');pos=js('({table:document.querySelector(".table-wrap").scrollTop,gantt:document.querySelector("#gantt-scroll").scrollTop})');assert pos['table']==pos['gantt'],pos
print('PASS entering Overview from scrolled Table and Gantt')
