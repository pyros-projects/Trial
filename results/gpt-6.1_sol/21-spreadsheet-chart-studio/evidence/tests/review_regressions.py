import browser_workflows as b
import pathlib, json, sys, time, traceback
kind=sys.argv[1]; phase=sys.argv[2]
b.LOG=(b.ROOT/'evidence/logs'/('review-'+kind+'-'+phase+'.log')).open('w')
try:
    if kind=='range':
        if phase=='red':b.ab('record','start',str(b.ROOT/'evidence/screenshots/review-range-repro.webm'))
        b.reset();b.edit('B2','=SUM(A1:A2)');b.goto('B2');b.click('Copy');b.screenshot('review-range-source-'+phase+'.png')
        if phase=='red':time.sleep(1)
        b.goto('A2');b.click('Paste');a=b.ab('get','text','#cell-A2 .cell-content');raw=b.raw('A2');b.screenshot('review-range-invalid-'+phase+'.png')
        if phase=='red':time.sleep(1)
        b.reset();b.edit('B2','=IF(FALSE,SUM(A1:A2),7)');b.goto('B2');b.click('Copy');b.goto('A2');b.click('Paste');lazy=b.ab('get','text','#cell-A2 .cell-content');b.screenshot('review-range-lazy-'+phase+'.png')
        if phase=='red':b.ab('record','stop')
        print('range formula=',raw,'active=',a,'inactive=',lazy)
        assert a=='#REF!' and lazy=='7',(a,lazy)
    if kind=='tiny':
        b.reset();b.import_text('Item,Value\nTiny,5e-324\nSmaller,1e-323','csv');b.goto('A1:B3');b.click('Chart');b.fill('Chart title','Very small finite values');b.click('Create chart')
        geom=b.js('({points:Array.from(document.querySelectorAll("#chart-stage [data-address]")).map(n=>({address:n.dataset.address,y:n.getAttribute("y"),height:n.getAttribute("height")})),bad:/NaN|Infinity/.test(document.getElementById("chart-stage").innerHTML)})')
        print('geometry=',geom);b.screenshot('review-tiny-'+phase+'.png');assert not geom['bad'],geom
        if phase!='red':b.no_errors()
finally:b.LOG.close()
