from browser_checks import *
import xml.etree.ElementTree as ET

def drag_undo():
 reset();fill('Duration for T1','3');ab('press','Tab')
 ab('scrollintoview','.bar[data-id="T3"]');g=js('(()=>{const b=document.querySelector(".bar[data-id=T3] rect").getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,width:b.width}})()')
 ab('mouse','move',str(round(g['x'])),str(round(g['y'])));ab('mouse','down','left');ab('mouse','move',str(round(g['x']+(g['width']+4)/2)),str(round(g['y'])));ab('press','Control+z');screenshot('issue-drag-undo-before-release.png');ab('mouse','up','left')
 assert js('document.querySelector("[data-inline=duration][data-id=T1]").value')=='2','Pointer release must not restore the source that Undo removed'
 expect_intervals(SEED)

def xml_export():
 reset();m=source();m['tasks'][0]['name']='Design\x01review';import_text(m);svg=export('svg','control-name.svg');ET.fromstring(svg)
 print('PASS XML-safe export of accepted control characters')

def dependency_draft():
 reset();click('Select T3 Documentation');ab('click','#task-editor summary');fill('Task name','Revised documentation');button('Choose dependencies');ab('check','input[name=dep][value=T2]')
 # Updated dialog must put choices into the editor without discarding other draft fields.
 button('Use dependencies');assert js('document.querySelector("#edit-task-form input[name=name]").value')=='Revised documentation'
 button('Save task');m=source();t=next(t for t in m['tasks'] if t['id']=='T3');assert t['name']=='Revised documentation' and t['predecessors']==['T1','T2']
 print('PASS dependency selection preserves task draft')

if __name__=='__main__':
 drag_undo();print('PASS undo invalidates drag preview');xml_export();dependency_draft()
