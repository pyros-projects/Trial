import browser_workflows as b
b.LOG=(b.ROOT/'evidence/logs/chart-color-red.log').open('w')
try:
    b.reset();b.click('Chart settings')
    count=b.js('Array.from(document.querySelectorAll("#series-colors input")).filter(n=>n.getAttribute("aria-label")==="Hex color for Current").length')
    assert count==1,'A labeled typable series hex color input is present'
finally:b.LOG.close()
