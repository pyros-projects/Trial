from browser_checks import *

def mobile():
 ab('set','viewport','390','844');button('Reset');ab('click','.tabs [data-view="table"]');snap()
 assert js('document.documentElement.scrollWidth')==390
 fill('Duration for T1','3');ab('press','Tab');assert js('document.activeElement.getAttribute("aria-label")')=='Priority for T1';assert summary()[:2]==[9,7];click('Undo');expect_intervals(SEED)
 click('Select T2 Build');button('Details');snap();fill('Not-before date','2026-09-12');ab('press','Enter');expect_intervals(GAP);assert js('document.querySelector("#not-before").value')=='2026-09-14';screenshot('plan07-mobile-details.png');click('Undo');expect_intervals(SEED)
 button('Gantt');button('Zoom out');button('Zoom out');drag_to('T2',5);expect_intervals(GAP);screenshot('plan07-mobile-drag.png');click('Undo');expect_intervals(SEED)
 # Pan and zoom use controls and keyboard without entering source history.
 before=source();undo_state=js('document.querySelector("#undo").disabled');button('Pan timeline right');assert js('document.querySelector("#gantt-scroll").scrollLeft')>0;button('Pan timeline left');button('Zoom in');button('Fit');assert source()==before;assert js('document.querySelector("#undo").disabled')==undo_state
 button('Resources');snap();ab('scroll','right','220','--selector','#occupancy-scroll');click('Select T3 on 2026-09-14 in R1');selected('T3');screenshot('plan07-mobile-resources.png');button('Details');assert 'Documentation' in js('document.querySelector("#inspector").textContent')
 for kind in ['json','csv','svg']:assert export(kind,'mobile.'+kind)
 # All essential controls remain within the viewport while the document/timeline is scrolled.
 boxes=js('[...document.querySelectorAll(".head-actions button")].map(b=>{let r=b.getBoundingClientRect();return {label:b.getAttribute("aria-label")||b.textContent.trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom}})')
 assert all(x['x']>=0 and x['right']<=390 and x['y']>=0 and x['bottom']<=844 for x in boxes),boxes
 retained=source();ab('set','viewport','1280','800');assert source()==retained;selected('T3');ab('set','viewport','390','844');assert source()==retained;selected('T3')
 button('Reset');assert js('document.querySelector("#undo").disabled && document.querySelector("#redo").disabled');button('Table');screenshot('plan07-mobile-final.png')
 print('PASS mobile 390x844 workflows, controls, resize continuity')

def direct_file():
 ab('open','file://'+str(ROOT/'index.html'));ab('set','viewport','1280','800');snap();expect_intervals(SEED);assert summary()[:2]==[8,6]
 fill('Duration for T1','3');ab('press','Tab');assert summary()[:2]==[9,7];click('Undo');expect_intervals(SEED)
 saved=export('json','direct-file.json');m=json.loads(saved);m['tasks'][2]['duration']=4;import_text(m);assert summary()[:2]==[10,7]
 for kind in ['csv','svg']:assert export(kind,'direct-file.'+kind)
 ab('reload');snap();expect_intervals(SEED);assert js('document.querySelector("#undo").disabled');screenshot('plan07-direct-file.png')
 print('PASS direct file edit, undo, exports, import and reload-to-seed')

if __name__=='__main__':mobile();direct_file()
