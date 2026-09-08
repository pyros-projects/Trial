from browser_checks import *
from boundary_checks import mobile
ab('open','http://127.0.0.1:18765/evidence/opaque-host.html');ab('set','viewport','1280','800');snap();ab('frame','#planner-frame');snap()
boundaries=js('(()=>{const r={origin:window.origin,title:document.title};for(const key of ["localStorage","sessionStorage","indexedDB"]){try{if(key==="indexedDB")window[key].open("test-denied");else void window[key];r[key]="unexpectedly available"}catch(e){r[key]=e.name}}try{void parent.document;r.parent="unexpectedly available"}catch(e){r.parent=e.name}return r})()')
(ROOT/'evidence/opaque-boundaries.json').write_text(json.dumps(boundaries,indent=2));assert boundaries['origin']=='null' and boundaries['localStorage']=='SecurityError' and boundaries['parent']=='SecurityError',boundaries
expect_intervals(SEED);fill('Duration for T1','3');ab('press','Tab');assert summary()[:2]==[9,7];click('Undo');expect_intervals(SEED)
click('Select T2 Build');fill('Not-before date','2026-09-12');ab('press','Enter');expect_intervals(GAP);click('Undo');expect_intervals(SEED)
drag_to('T2',5);expect_intervals(GAP);click('Undo');expect_intervals(SEED)
for kind in ['json','csv','svg']:assert export(kind,'opaque.'+kind)
m=source();m['tasks'][0]['duration']=3;import_text(m);assert summary()[:2]==[9,7];click('Undo');expect_intervals(SEED)
# Verify native file input in the opaque child as well as the text path.
button('Files');ab('upload','#import-file',str(ROOT/'evidence/downloads/tie-priority.json'));ab('wait','--fn','document.querySelector("#import-text").value.length>0');button('Import plan');expect_intervals(SEED)
button('Reset');assert js('document.querySelector("#undo").disabled && document.querySelector("#redo").disabled');screenshot('plan07-opaque-desktop.png')
ab('frame','main');ab('reload');ab('frame','#planner-frame');snap();expect_intervals(SEED);assert js('document.querySelector("#undo").disabled')
mobile();screenshot('plan07-opaque-mobile.png')
print('PASS opaque iframe editing, dates, drag, undo, downloads, both imports, reset/reload, mobile, denied storage and parent access')
