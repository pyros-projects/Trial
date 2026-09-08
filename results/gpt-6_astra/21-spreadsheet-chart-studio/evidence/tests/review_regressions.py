import browser_checks as b
import json,sys
b.cmd('set','viewport',1280,800)
if sys.argv[1]=='range':
    b.reset();b.edit('C5','=IF(FALSE,SUM(A1:B2),9)');b.go('C5');b.click('#copy');b.go('B5');b.click('#paste');b.screenshot('review-range-'+sys.argv[2]+'.png');b.expect_cells({'B5':9});b.edit('B5','=IF(TRUE,SUM(#REF!:A2),9)');b.expect_cells({'B5':'#REF!'})
elif sys.argv[1]=='literal':
    b.reset();b.import_text('text\n=1+1','csv');b.go('A2');before=b.state();b.press('F2');b.press('Enter');b.go('A2');b.screenshot('review-literal-'+sys.argv[2]+'.png');b.expect_cells({'A2':'=1+1'});assert b.cells('A2')['A2']['type']=='text';assert b.state()==before
print('PASS',sys.argv[1])
