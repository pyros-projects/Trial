import browser_checks as b
import json,os,traceback

def desktop_mobile():
    b.cmd('set','viewport',1280,800);b.reset()
    b.cmd('dblclick','#cell-A1');b.fill('.cell-editor','5');b.press('Enter');b.expect_cells({'A1':5,'C1':15,'D1':35,'F1':23});assert b.current_values()==[15,20,35]
    assert b.read('document.getElementById("address").value')=='A2'
    b.press('ArrowRight');assert b.read('document.getElementById("address").value')=='B2'
    b.press('Tab');assert b.read('document.getElementById("address").value')=='C2'
    b.press('Shift+Tab');assert b.read('document.getElementById("address").value')=='B2'
    b.go('A5');b.press('1');b.press('2');b.press('.');b.press('5');assert b.read('document.querySelector(".cell-editor").value')=='12.5'
    b.cmd('set','viewport',390,844);assert b.read('document.querySelector(".cell-editor").value')=='12.5';b.press('6');b.press('Tab');b.expect_cells({'A5':12.56});assert b.read('document.getElementById("address").value')=='B5'
    b.press('4');b.press('2');b.press('Escape');b.expect_cells({'B5':''});b.press('ArrowLeft');b.press('F2');b.fill('.cell-editor','-8');b.press('Enter');b.expect_cells({'A5':-8})
    b.go('A5');b.press('Control+c');b.go('A6');b.press('Control+v');b.expect_cells({'A6':-8});b.press('Control+z');b.expect_cells({'A6':''});b.press('Control+Shift+z');b.expect_cells({'A6':-8})
    b.go('A5');b.press('Shift+ArrowDown');assert b.read('document.getElementById("numeric-count").textContent')=='2';assert b.read('document.getElementById("numeric-sum").textContent')=='-16';b.press('Delete');b.expect_cells({'A5':'','A6':''});b.click('#undo');b.expect_cells({'A5':-8,'A6':-8})
    b.label('Formula bar','=-3.25');b.cmd('set','viewport',1280,800);assert b.read('document.getElementById("formula").value')=='=-3.25';b.click('#formula-apply');b.expect_cells({'A6':-3.25})
    b.reset();b.cmd('scrollintoview','#cell-A1')
    boxes=b.read('["A1","C2"].map(a=>{let r=document.getElementById("cell-"+a).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})')
    b.cmd('mouse','move',round(boxes[0]['x']),round(boxes[0]['y']));b.cmd('mouse','down');b.cmd('mouse','move',round(boxes[1]['x']),round(boxes[1]['y']));b.cmd('mouse','up')
    assert b.read('document.getElementById("address").value')=='A1:C2';assert b.read('document.getElementById("numeric-count").textContent')=='6';assert b.read('document.getElementById("numeric-sum").textContent')=='40'
    b.screenshot('sheet07-desktop-pointer-selection.png')
    b.cmd('set','viewport',390,844);b.reset();assert b.read('document.documentElement.scrollWidth')==390
    b.edit('A1','5');b.expect_cells({'C1':15});b.screenshot('sheet07-mobile-edit.png')
    b.click('#new-chart-top');b.fill('#new-title','Mobile view');b.cmd('select','#new-type','line');b.click('#create-chart');assert b.read('workbook.charts.length')==2
    b.fill('#chart-title','Mobile line');b.label('Hex color for Current','#c86c51');b.cmd('uncheck','#chart-legend');b.click('#apply-chart');assert b.read('workbook.charts[1].title')=='Mobile line';assert not b.read('workbook.charts[1].legend')
    b.screenshot('sheet07-mobile-chart-controls.png');b.cmd('download','#export-svg',str(b.EVIDENCE/'downloads'/'mobile-chart.svg'))
    b.click('#delete-chart');assert b.read('workbook.charts.length')==1;b.click('#undo');assert b.read('workbook.charts.length')==2
    saved=b.export_json('mobile-workbook.json');b.edit('A1','17');b.import_text(saved);b.expect_cells({'A1':5})
    b.cmd('reload');b.expect_cells({'A1':2,'C1':6,'D1':26});assert b.read('workbook.charts.length')==1 and b.read('undoStack.length')==0
    b.edit('A1','7');b.click('#reset');b.expect_cells({'A1':2});assert b.read('({undo:undoStack.length,redo:redoStack.length,copy:clipboard,charts:workbook.charts.length})')=={'undo':0,'redo':0,'copy':None,'charts':1}
    b.click('.topbar [data-help]');assert b.read('document.getElementById("help-dialog").open');b.screenshot('sheet07-mobile-guide.png');b.click('#help-dialog [data-close]')
    b.cmd('reload');b.screenshot('mobile-final.png')
    return 'Desktop and 390×844: in-cell editing, type-to-replace, Escape, arrow/Tab/Enter, F2, range keyboard/pointer selection, Ctrl copy/paste/history, Delete, numeric summaries. Editor and formula draft survived viewport resize. Mobile chart controls/create/delete/undo, color/legend, JSON/SVG downloads and import passed. Offline direct-file reload/reset restored seed and cleared history.'

if __name__=='__main__':
    try:
        result=desktop_mobile();entry={'check':'SHEET-07-desktop-mobile-direct-file','status':'pass','detail':result};print(json.dumps(entry))
    except Exception as e:
        b.screenshot('sheet07-boundary-failure.png');entry={'check':'SHEET-07-desktop-mobile-direct-file','status':'fail','detail':str(e),'trace':traceback.format_exc()};print(json.dumps(entry));raise
    finally:
        with b.RESULTS.open('a') as f:f.write(json.dumps(entry)+'\n')
