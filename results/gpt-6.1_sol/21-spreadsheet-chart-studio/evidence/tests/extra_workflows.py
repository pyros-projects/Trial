import browser_workflows as b
import json, sys, traceback

mode=sys.argv[1] if len(sys.argv)>1 else 'extras'
b.LOG=(b.ROOT/'evidence/logs'/('extra-'+mode+'.log')).open('w')
try:
    b.ab('frame','main');b.ab('set','viewport',1280,800);b.ab('open','http://127.0.0.1:8765/index.html');b.reset()
    if mode=='identical':
        p=b.download_json('identical-seed.json');assert b.ab('is','enabled','#undo')=='false';b.import_text(p.read_text());b.cells({'C1':'6','D1':'26'});assert b.ab('is','enabled','#undo')=='true','Every valid import is one undoable operation, including identical input';b.click('Undo');assert b.ab('is','enabled','#undo')=='false';b.cells({'C1':'6','D1':'26'});b.click('Redo');b.cells({'C1':'6','D1':'26'});b.no_errors();print('PASS identical import creates exactly one undo step')
    else:
        compact={'format':'spreadsheet-chart-studio','version':1,'name':'Typed text entry','cells':[{'address':'A1','type':'number','raw':'5'},{'address':'B1','type':'formula','raw':'=A1*2+1','value':99999},{'address':'C1','type':'text','raw':"'=1+1"},{'address':'D1','type':'boolean','raw':'FALSE'},{'address':'E1','type':'blank','raw':''}],'charts':[]}
        b.import_text(json.dumps(compact));b.cells({'A1':'5','B1':'11','C1':'=1+1','D1':'FALSE','E1':''});assert b.raw('B1')=='=A1*2+1';assert b.raw('C1')=="'=1+1";assert b.ab('get','text','#chart-count')=='0';b.screenshot('extra-compact-json-text.png');b.click('Undo');b.cells({'C1':'6','D1':'26'});assert b.ab('get','text','#chart-count')=='1'
        b.reset();b.click('Chart');b.fill('Chart title','Extra line');b.fill('Source range','A1');b.click('Create chart');assert not b.js('document.getElementById("new-chart-error").hidden');assert b.ab('is','enabled','#undo')=='false';b.fill('Source range','H1:J4');b.ab('select','#new-chart-type','line');b.click('Create chart');assert b.ab('get','text','#chart-count')=='2';b.chart([6,20,26],[8,18,26])
        b.click('Chart settings');b.fill('Chart title','Extra saved');b.fill('Source range','H1:AA4');b.click('Save settings');assert not b.js('document.getElementById("chart-error").hidden');assert b.js('document.getElementById("chart-select").selectedOptions[0].textContent')=='Extra line';b.fill('Source range','H1:J4');b.fill('Hex color for Current','#738A42');b.ab('uncheck','#chart-legend');b.ab('focus','#chart-title');b.ab('press','Enter');assert b.js('document.getElementById("chart-select").selectedOptions[0].textContent')=='Extra saved';assert b.js('document.querySelector("#chart-stage path[data-series=Current]").getAttribute("stroke")')=='#738a42';assert b.js('document.querySelector("#chart-stage svg").getAttribute("height")')=='348';b.screenshot('extra-chart-controls.png')
        b.click('Chart settings');b.click('Delete chart');assert b.ab('get','text','#chart-count')=='1';b.click('Undo');assert b.ab('get','text','#chart-count')=='2';assert b.js('document.getElementById("chart-select").textContent.includes("Extra saved")');b.ab('select','#chart-select',b.js('Array.from(document.getElementById("chart-select").options).find(o=>o.textContent==="Extra saved").value'));b.chart([6,20,26],[8,18,26])
        b.edit('I2','TRUE');b.edit('I3','no data');b.edit('I4','=1/0');b.chart([None,None,None],[8,18,26]);reason=b.ab('get','text','#omission-summary');assert all(s in reason for s in ['Boolean','text','#DIV/0!']),reason;b.screenshot('extra-chart-omission-reasons.png');b.click('Undo');b.click('Undo');b.click('Undo');b.chart([6,20,26],[8,18,26]);b.no_errors();print('PASS compact JSON text import/cache rejection, chart range errors, keyboard save, colors/legend, delete/undo, Boolean/text/error omissions')
except Exception:
    b.LOG.write(traceback.format_exc());b.screenshot('extra-'+mode+'-failure.png');raise
finally:b.LOG.close()
