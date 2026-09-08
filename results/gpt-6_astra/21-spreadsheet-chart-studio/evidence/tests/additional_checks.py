import browser_checks as b
import json,sys
from pathlib import Path

def unchanged_import():
    b.cmd('set','viewport',1280,800);b.reset();saved=b.export_json('identical.json');before=b.state();b.import_text(saved);after=b.state();assert after['undo']==before['undo']+1,'A valid identical import must still be one undoable operation';assert after['workbook']==before['workbook'];b.click('#undo');assert b.state()['workbook']==before['workbook']

def multiline_edit():
    b.reset();b.import_text('label,value\n"line\nbreak",2','csv');b.go('A2');before=b.state();b.press('F2');b.press('Enter');b.expect_cells({'A2':'line\nbreak'});assert b.state()==before,'No-op multiline editing must preserve raw input and history'

def crlf_file():
    b.reset();p=b.EVIDENCE/'tests'/'multiline-crlf.csv';p.write_bytes(b'label,value\r\n"line\r\nbreak",2')
    b.click('#import-open');b.cmd('upload','#import-file',str(p));b.click('#import-confirm');b.expect_cells({'A2':'line\r\nbreak'})
    b.click('#export-open');b.cmd('select','#export-format','csv');dest=b.EVIDENCE/'downloads'/'multiline-crlf.csv';b.cmd('download','#export-download',str(dest));b.click('#export-dialog [data-close]');assert dest.read_bytes()==p.read_bytes(),'CSV download must preserve evaluated multiline values'

def charts_mixed():
    b.reset();b.edit('I2','0');b.edit('I3','-4');assert b.current_values()==[0,-4,26]
    b.cmd('hover','#chart-host [data-source="I2"]');assert ' · 0 · Source I2' in b.read('document.getElementById("point-detail").textContent')
    vals=b.read('[...document.querySelectorAll("#chart-host rect[data-source]")].map(e=>({source:e.dataset.source,y:+e.getAttribute("y"),height:+e.getAttribute("height")}))');z=next(p for p in vals if p['source']=='I2');neg=next(p for p in vals if p['source']=='I3');pos=next(p for p in vals if p['source']=='I4');assert neg['y']>pos['y'] and neg['height']>0 and z['height']>0
    b.screenshot('additional-negative-zero.png')
    b.edit('I2','TRUE');b.edit('I3','missing');b.edit('I4','=1/0');summary=b.read('document.getElementById("omission-summary").textContent');assert '3 omitted points' in summary and all(t in summary for t in ['Boolean','text','#DIV/0!']);assert b.current_values()==[]
    b.edit('J2','FALSE');b.edit('J3','');b.edit('J4','=1/0');assert 'No numeric points' in b.read('document.getElementById("chart-host").textContent');b.screenshot('additional-empty-chart.png')
    b.cmd('select','#chart-type','line');b.click('#apply-chart');assert len(b.points())==0;b.click('#undo');b.reset()

for name in sys.argv[1:]:
    try:globals()[name]();entry={'check':name,'status':'pass'};print(json.dumps(entry))
    except Exception as e:b.screenshot(name+'-failure.png');entry={'check':name,'status':'fail','detail':str(e)};print(json.dumps(entry));raise
    finally:
        with b.RESULTS.open('a') as f:f.write(json.dumps(entry)+'\n')
