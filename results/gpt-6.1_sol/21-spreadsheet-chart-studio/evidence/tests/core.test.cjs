const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const artifact = path.resolve(__dirname, '../../index.html');
const context = { console, Map, Set, structuredClone };
vm.createContext(context);
if (fs.existsSync(artifact)) {
  const source = fs.readFileSync(artifact, 'utf8').match(/<script id="studio-core">([\s\S]*?)<\/script>/);
  if (source) vm.runInContext(source[1], context);
}
const Core = context.StudioCore || {};
const plain = x => JSON.parse(JSON.stringify(x));
function set(book, address, raw) { book.cells[Core.indexOf(address)] = Core.parseInput(raw); }
function val(book, address) { return Core.valueAt(Core.recalculate(book), address).value; }
function expectCells(book, expected) { const calc = Core.recalculate(book); for (const [a, v] of Object.entries(expected)) assert.equal(Core.valueAt(calc,a).value,v,a); }

test('seed recalculates and a changed precedent reaches formulas and chart', () => {
  assert.equal(typeof Core.seed, 'function', 'workbook engine is implemented');
  const b = Core.seed();
  expectCells(b,{C1:6,C2:20,D1:26,E1:10,F1:11});
  assert.deepEqual(plain(Core.chartData(b,Core.recalculate(b),b.charts[0]).series.map(s=>s.points.map(p=>p && p.value))),[[6,20,26],[8,18,26]]);
  set(b,'A1','5'); expectCells(b,{C1:15,D1:35,F1:23});
});

test('recursive parser obeys grammar, coercion, lazy evaluation, and error order', () => {
  assert.equal(typeof Core.seed,'function','formula engine is implemented');
  const b=Core.seed();
  const cases=[
    ['=2+3*4',14],['=(2+3)*4',20],['=SUM(A1:B2)',14],['=MIN(A1:B2)',2],['=MAX(A1:B2)',5],['=TRUE+2',3],
    ['=IF(FALSE,1/0,9)',9],['=#REF!','#REF!'],['=IF(FALSE,#REF!,9)',9],['=1/0','#DIV/0!'],['=AA1','#REF!'],
    ['=NOPE(1)','#NAME?'],['=SUM("text")','#VALUE!'],['=1+','#PARSE!'],['=SUM()','#VALUE!'],['=IF(TRUE,1)','#VALUE!'],
    ['=A99',0],['=A99+TRUE',1],['="a"<"b"',true],['="A"="a"',false],['="2"=2','#VALUE!'],
    ['=A1:B2','#VALUE!'],['=SUM(H1:H4)',0],['=MIN(H1:H4)',0],['=MAX(H1:H4)',0],['=IF("text",1,2)','#VALUE!'],
    ['=IF(FALSE,1+,9)','#PARSE!'],['=IF(TRUE,7,NOPE(1))',7],['=10-3-2',5],['=24/4/2',3],
    ['=-2*-3+4',10],['=SUM(2,TRUE,A1:B2)',17],['="a""b"','a"b'],['=1/0+#REF!','#DIV/0!'],['=#REF!+1/0','#REF!'],
    ['=1e308*10','#NUM!'],['=IF(TRUE, A1:B2, 9)','#VALUE!']
  ];
  for(const [formula,expected] of cases){set(b,'L1',formula);assert.equal(val(b,'L1'),expected,formula);}
  set(b,'L1','=SUM(A1:B2)');set(b,'B2','=1/0');assert.equal(val(b,'L1'),'#DIV/0!');set(b,'B2','-7');assert.equal(val(b,'L1'),2);
  set(b,'M1','-3.5');set(b,'N1','=M1*4+SUM(A1:B1)');assert.equal(val(b,'N1'),-9);
});

test('active dependency cycles recover and inactive self-reference stays lazy', () => {
  assert.equal(typeof Core.seed,'function','dependency engine is implemented');
  const b=Core.seed();set(b,'A1','=C1');expectCells(b,{A1:'#CYCLE!',C1:'#CYCLE!',D1:'#CYCLE!',F1:'#CYCLE!'});
  set(b,'A1','2');expectCells(b,{A1:2,C1:6,D1:26,F1:11});
  set(b,'G1','=IF(FALSE,G1,7)');assert.equal(val(b,'G1'),7);assert.equal(Core.recalculate(b).deps.get(Core.indexOf('G1')).size,0);
  set(b,'G1','=IF(TRUE,G1,7)');assert.equal(val(b,'G1'),'#CYCLE!');set(b,'G1','=IF(FALSE,G1,7)');assert.equal(val(b,'G1'),7);
  set(b,'G1','=IF(A1>0,B1,C1)');const c=Core.recalculate(b);assert.deepEqual(plain(Array.from(c.deps.get(Core.indexOf('G1'))).map(Core.addressOf)),['A1','B1']);
});

test('copy rebases mixed references while preserving strings and is atomic at boundaries', () => {
  assert.equal(typeof Core.seed,'function','copy engine is implemented');
  const b=Core.seed();Core.pasteRange(b,Core.copyRange(b,'F1'),'F2');assert.equal(b.cells[Core.indexOf('F2')].raw,'=$A2+B$1+$C$1');assert.equal(val(b,'F2'),13);
  Core.pasteRange(b,Core.copyRange(b,'A1:C2'),'A5');expectCells(b,{C5:6,C6:20});assert.equal(b.cells[Core.indexOf('C5')].raw,'=A5*B5');
  const before=JSON.stringify(b);assert.throws(()=>Core.pasteRange(b,Core.copyRange(b,'A1:C2'),'Z100'));assert.equal(JSON.stringify(b),before);
  set(b,'B10','=A10');Core.pasteRange(b,Core.copyRange(b,'B10'),'A10');assert.equal(b.cells[Core.indexOf('A10')].raw,'=#REF!');assert.equal(val(b,'A10'),'#REF!');
  assert.equal(Core.rebase('=IF(TRUE,"A1 ""B2""",$A1+B$1+$C$1)',1,0),'=IF(TRUE,"A1 ""B2""",$A2+B$1+$C$1)');
});

test('JSON preserves typed raw cells and validates all inputs before replacement', () => {
  assert.equal(typeof Core.seed,'function','JSON engine is implemented');
  const b=Core.seed();set(b,'M1',"'=1+1");set(b,'M2','=#REF!');set(b,'M3','=IF(FALSE,#REF!,9)');set(b,'M4','false');
  const json=Core.exportWorkbook(b);const restored=Core.validateWorkbook(JSON.parse(json));expectCells(restored,{M1:'=1+1',M2:'#REF!',M3:9,M4:false});
  assert.deepEqual(plain(restored),plain(b));
  for(const change of [o=>o.version=999,o=>o.cells[0].address='AA1',o=>o.cells.push(o.cells[0]),o=>o.charts[0].range='H1:AA4',o=>o.charts.push(o.charts[0]),o=>o.cells[0].type='text',o=>o.charts[0].colors[0]='red']){
    const o=JSON.parse(json);change(o);assert.throws(()=>Core.validateWorkbook(o));assert.equal(Core.exportWorkbook(b),json);
  }
});

test('CSV handles quoted delimiters and newlines, refuses malformed files, and forces literals', () => {
  assert.equal(typeof Core.parseCSV,'function','CSV engine is implemented');
  const b=Core.parseCSV('label,value\n"alpha, beta",2\n"line\nbreak",=1+1\n');
  expectCells(b,{A2:'alpha, beta',B2:2,A3:'line\nbreak',B3:'=1+1'});assert.equal(b.cells[Core.indexOf('B3')].type,'text');assert.equal(b.charts.length,0);
  const exported=Core.exportCSV(b);assert.equal(exported,'label,value\r\n"alpha, beta",2\r\n"line\nbreak",=1+1');
  expectCells(Core.parseCSV('"say ""hi""",-2.5\r\nTRUE,\r\n'),{A1:'say "hi"',B1:-2.5,A2:'TRUE'});
  for(const bad of ['"unfinished', 'a"b,c', '"ok"x,2',Array(28).fill('x').join(','),Array(101).fill('x').join('\n')]) assert.throws(()=>Core.parseCSV(bad));
});

test('charts keep numeric zero, omit Boolean/text/blank/errors, and preserve row order', () => {
  assert.equal(typeof Core.seed,'function','chart data engine is implemented');
  const b=Core.seed();set(b,'I2','0');set(b,'I3','');set(b,'I4','TRUE');
  let d=Core.chartData(b,Core.recalculate(b),b.charts[0]);assert.deepEqual(plain(d.series[0].points.map(p=>p && p.value)),[0,null,null]);assert.equal(d.omissions.length,2);assert.deepEqual(plain(d.categories.map(c=>c.label)),['Alpha','Beta','Total']);
  set(b,'I3','=1/0');d=Core.chartData(b,Core.recalculate(b),b.charts[0]);assert.ok(d.omissions.some(o=>o.address==='I3' && o.reason==='#DIV/0!'));
});

test('copied invalid range endpoints remain REF operands and inactive branches stay lazy', () => {
  const b=Core.seed();set(b,'B2','=SUM(A1:A2)');Core.pasteRange(b,Core.copyRange(b,'B2'),'A2');
  assert.equal(b.cells[Core.indexOf('A2')].raw,'=SUM(#REF!:#REF!)');assert.equal(val(b,'A2'),'#REF!');
  set(b,'B2','=IF(FALSE,SUM(A1:A2),7)');Core.pasteRange(b,Core.copyRange(b,'B2'),'A2');assert.equal(val(b,'A2'),7);
  set(b,'L1','=SUM(#REF!:A1)');assert.equal(val(b,'L1'),'#REF!');
  set(b,'L1','=IF(FALSE,MAX(A1:#REF!),9)');assert.equal(val(b,'L1'),9);
});
