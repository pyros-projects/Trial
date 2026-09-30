// Engine unit + fuzz tests. Extracts <script id="engine"> from ../../index.html and runs it in a VM.
// Usage: node evidence/tests/engine.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const src = /<script id="engine">([\s\S]*?)<\/script>/.exec(html)[1];
const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);
const S = ctx.SCS;

let pass = 0, failN = 0;
const failures = [];
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { failN++; failures.push(`${label}: got ${g}, want ${w}`); }
}
const A = a => { const p = S.parseAddress(a); return S.idxOf(p.r, p.c); };
function show(v) { return v === null ? null : S.isErr(v) ? v.code : v; }

function seedSheet() {
  const wb = S.seedWorkbook();
  const sh = new S.Sheet();
  for (const [i, c] of wb.cells) sh.cells.set(i, c);
  sh.recalcAll();
  return { sh, wb };
}
function set(sh, a, raw) { const i = A(a); const c = S.classifyInput(raw); if (c) sh.cells.set(i, c); else sh.cells.delete(i); sh.recalc([i]); }
const val = (sh, a) => show(sh.value(A(a)));

// ---- seed
{
  const { sh, wb } = seedSheet();
  eq('C1', val(sh, 'C1'), 6); eq('C2', val(sh, 'C2'), 20); eq('D1', val(sh, 'D1'), 26);
  eq('E1', val(sh, 'E1'), 10); eq('F1', val(sh, 'F1'), 11);
  const cd = S.chartData(sh, wb.charts[0]);
  eq('seed Current', cd.series[0].points.map(p => p.value), [6, 20, 26]);
  eq('seed Plan', cd.series[1].points.map(p => p.value), [8, 18, 26]);
  eq('seed cats', cd.categories.map(c => c.label), ['Alpha', 'Beta', 'Total']);
  set(sh, 'A1', '5');
  eq('A1=5 C1', val(sh, 'C1'), 15); eq('A1=5 D1', val(sh, 'D1'), 35); eq('A1=5 F1', val(sh, 'F1'), 23);
  eq('A1=5 Current', S.chartData(sh, wb.charts[0]).series[0].points.map(p => p.value), [15, 20, 35]);
}
// ---- rebasing
eq('F1->F2', S.rebaseFormula('=$A1+B$1+$C$1', 1, 0), '=$A2+B$1+$C$1');
eq('C1->C5', S.rebaseFormula('=A1*B1', 4, 0), '=A5*B5');
eq('B10->A10', S.rebaseFormula('=A10', 0, -1), '=#REF!');
eq('range shift', S.rebaseFormula('=SUM(C1:C2)', 1, 1), '=SUM(D2:D3)');
eq('range off sheet', S.rebaseFormula('=SUM(A1:B2)', -1, 0), '=SUM(#REF!)');
eq('abs stays', S.rebaseFormula('=$A$1', 50, 20), '=$A$1');
eq('strings untouched', S.rebaseFormula('="A1"=A1', 1, 0), '="A1"=A2');
eq('untokenizable left alone', S.rebaseFormula('="A1"&A1', 1, 0), '="A1"&A1');
eq('lowercase ref', S.rebaseFormula('=a1+1', 1, 1), '=B2+1');
eq('rebase keeps #REF!', S.rebaseFormula('=#REF!+A1', 1, 0), '=#REF!+A2');
eq('zero offset preserves text', S.rebaseFormula('=sum( a1 : b2 )', 0, 0), '=sum( a1 : b2 )');
eq('bottom edge', S.rebaseFormula('=A100', 1, 0), '=#REF!');
eq('fn-like name not rebased', S.rebaseFormula('=LOG10(1)', 1, 0), '=LOG10(1)');
{
  const { sh } = seedSheet();
  set(sh, 'F2', S.rebaseFormula('=$A1+B$1+$C$1', 1, 0));
  eq('F2 value', val(sh, 'F2'), 13);
}
// ---- parser / evaluator semantics
function evalIn(formula, setup) {
  const { sh } = seedSheet();
  if (setup) setup(sh);
  set(sh, 'Z99', formula);
  return { v: val(sh, 'Z99'), sh, e: sh.value(A('Z99')) };
}
const cases = [
  ['=2+3*4', 14], ['=(2+3)*4', 20], ['=SUM(A1:B2)', 14], ['=MIN(A1:B2)', 2], ['=MAX(A1:B2)', 5],
  ['=TRUE+2', 3], ['=IF(FALSE,1/0,9)', 9], ['=#REF!', '#REF!'], ['=IF(FALSE,#REF!,9)', 9],
  ['=1/0', '#DIV/0!'], ['=AA1', '#REF!'], ['=NOPE(1)', '#NAME?'], ['=SUM("text")', '#VALUE!'], ['=1+', '#PARSE!'],
  ['=-2^2', '#PARSE!'], ['=2-3-4', -5], ['=24/4/2', 3], ['=-2*-3', 6], ['=--2', 2], ['=+-+2', -2],
  ['=1<2', true], ['=2<=2', true], ['=3<>3', false], ['=1<2=TRUE', true], ['=1+2>2', true],
  ['="a"<"b"', true], ['="B"<"a"', true], ['="a"="A"', false], ['="a"<1', '#VALUE!'], ['=TRUE=1', true],
  ['=Z98=0', true], ['=Z98', 0], ['=Z98+1', 1], ['=IF(Z98,1,2)', 2], ['=IF(0.5,1,2)', 1], ['=IF("x",1,2)', '#VALUE!'],
  ['=IF(1,2)', '#VALUE!'], ['=IF(1,2,3,4)', '#VALUE!'], ['=SUM()', '#VALUE!'], ['=MIN()', '#VALUE!'],
  ['=SUM(H1:H4)', 0], ['=MIN(H1:H4)', 0], ['=MAX(H1:H4)', 0], ['=SUM(A1:B2,10)', 24], ['=MAX(A1:B2,-1,TRUE)', 5],
  ['=MIN(A1:B2,TRUE)', 1], ['=A1:B2', '#VALUE!'], ['=IF(TRUE,1,A1:B2)', 1], ['=IF(FALSE,1,A1:B2)', '#VALUE!'],
  ['=sum(a1:b2)', 14], ['=Sum($A$1:$B$2)', 14], ['="He said ""hi"""', 'He said "hi"'], ['=""', ''],
  ['=1e308*10', '#NUM!'], ['=1e999', '#NUM!'], ['=0/0', '#DIV/0!'], ['=1/0+NOPE()', '#DIV/0!'], ['=NOPE()+1/0', '#NAME?'],
  ['="5"+1', 6], ['="abc"+1', '#VALUE!'], ['=H1*2', '#VALUE!'], ['=SUM(H1)', '#VALUE!'], ['=SUM(A1:A2, "3")', 9],
  ['=IF(A1>0,10,1/0)', 10], ['=A0', '#REF!'], ['=A101', '#REF!'], ['=foo', '#PARSE!'], ['=1 2', '#PARSE!'],
  ['=(1', '#PARSE!'], ['=1)', '#PARSE!'], ['=', '#PARSE!'], ['=SUM(1,)', '#PARSE!'], ['=#N/A', '#PARSE!'],
  ['="unterminated', '#PARSE!'], ['=1+#ref!', '#REF!'], ['=IF(TRUE,9,#REF!)', 9], ['=.5+.5', 1], ['=2.5e1', 25],
  ['=$A$1+A$2+$B1', 2 + 4 + 3], ['=SUM(B2:A1)', 14], ['=SUM(ZZ1:A1)', '#REF!'], ['=MAX(-5,-3)', -3], ['=MIN(3, FALSE)', 0],
  ['=1-1', 0], ['=IF(A1=2,"two","other")', 'two'], ['= 1 + 2 ', 3],
];
for (const [f, want] of cases) eq('eval ' + f, evalIn(f).v, want);
// A0: row 0 isn't a valid row number; our tokenizer reads it as ref row -1 => REF? verify intent below
// error propagation in ranges + recovery
{
  const { sh } = seedSheet();
  set(sh, 'K1', '=SUM(A1:C2)');
  eq('K1 ok', val(sh, 'K1'), 40);
  set(sh, 'B2', '=1/0');
  eq('K1 err', val(sh, 'K1'), '#DIV/0!');
  eq('origin', S.addrOfIdx(sh.value(A('K1')).origin), 'B2');
  eq('C2 err', val(sh, 'C2'), '#DIV/0!');
  set(sh, 'B2', '5');
  eq('K1 recovered', val(sh, 'K1'), 40);
  // first error left-to-right in range (row-major)
  set(sh, 'A2', '=NOPE()'); set(sh, 'B1', '=1/0');
  eq('range first error row-major', val(sh, 'K1'), '#DIV/0!');
}
// ---- cycles
{
  const { sh, wb } = seedSheet();
  set(sh, 'A1', '=C1');
  for (const a of ['A1', 'C1', 'D1', 'E1', 'F1', 'I2', 'I4']) eq('cycle ' + a, val(sh, a), '#CYCLE!');
  eq('C2 unaffected', val(sh, 'C2'), 20);
  const cd = S.chartData(sh, wb.charts[0]);
  eq('cycle omitted', cd.omitted.map(o => o.addr + ':' + o.reason), ['I2:error #CYCLE!', 'I4:error #CYCLE!']);
  set(sh, 'A1', '2');
  for (const [a, v] of [['A1', 2], ['C1', 6], ['D1', 26], ['E1', 10], ['F1', 11], ['I2', 6], ['I4', 26]]) eq('recover ' + a, val(sh, a), v);
  set(sh, 'G1', '=IF(FALSE,G1,7)'); eq('G1 lazy', val(sh, 'G1'), 7);
  set(sh, 'G1', '=IF(TRUE,G1,7)'); eq('G1 cycle', val(sh, 'G1'), '#CYCLE!');
  set(sh, 'G1', '=IF(FALSE,G1,7)'); eq('G1 back', val(sh, 'G1'), 7);
  // IF branch switched by a precedent
  set(sh, 'G2', 'FALSE'); set(sh, 'G3', '=IF(G2,G3,5)');
  eq('G3 lazy', val(sh, 'G3'), 5);
  set(sh, 'G2', 'TRUE'); eq('G3 cycle via precedent', val(sh, 'G3'), '#CYCLE!');
  set(sh, 'G2', '0'); eq('G3 recovers', val(sh, 'G3'), 5);
  // self reference
  set(sh, 'K5', '=K5+1'); eq('self', val(sh, 'K5'), '#CYCLE!');
  // long 3-cycle and a dependent
  set(sh, 'L1', '=L2'); set(sh, 'L2', '=L3'); set(sh, 'L3', '=L1+1'); set(sh, 'L4', '=L1*2');
  for (const a of ['L1', 'L2', 'L3', 'L4']) eq('3-cycle ' + a, val(sh, a), '#CYCLE!');
  set(sh, 'L3', '4');
  eq('3-cycle fix', [val(sh, 'L1'), val(sh, 'L2'), val(sh, 'L4')], [4, 4, 8]);
}
// ---- input classification
const ci = r => { const c = S.classifyInput(r); return c && [c.type, c.value]; };
eq('num', ci('42'), ['number', 42]); eq('neg dec', ci('-1.50'), ['number', -1.5]); eq('plus', ci('+3'), ['number', 3]);
eq('exp', ci('2e3'), ['number', 2000]); eq('dot', ci('.5'), ['number', 0.5]); eq('huge', ci('1e999'), ['text', '1e999']);
eq('bool', ci('true'), ['boolean', true]); eq('BOOL', ci('FALSE'), ['boolean', false]); eq('blank', ci(''), null);
eq('apos', ci("'=1+1"), ['text', '=1+1']); eq('apos num', ci("'42"), ['text', '42']); eq('formula', ci('=1+1'), ['formula', '=1+1']);
eq('text', ci('<b>hi</b>'), ['text', '<b>hi</b>']); eq('1,5', ci('1,5'), ['text', '1,5']); eq('#REF! text', ci('#REF!'), ['text', '#REF!']);
eq('raw text apostrophe', S.rawInputOf({ type: 'text', value: '=1+1' }), "'=1+1");
eq('raw text num-like', S.rawInputOf({ type: 'text', value: '42' }), "'42");
eq('raw text plain', S.rawInputOf({ type: 'text', value: 'hello' }), 'hello');
eq('raw text leading apos', S.rawInputOf({ type: 'text', value: "'x" }), "''x");
eq('raw text TRUE', S.rawInputOf({ type: 'text', value: 'TRUE' }), "'TRUE");
eq('raw text empty', S.rawInputOf({ type: 'text', value: '' }), "'");
{ // quoted #REF! text stays text
  const r = evalIn('="#REF!"'); eq('quoted #REF! text', r.v, '#REF!'); eq('quoted #REF! is string', typeof r.e, 'string');
}
// ---- JSON
{
  const { sh, wb } = seedSheet();
  set(sh, 'K1', '=#REF!'); set(sh, 'K2', '=IF(FALSE,#REF!,9)'); set(sh, 'K3', "'=1+1"); set(sh, 'K4', 'TRUE'); set(sh, 'K5', '<script>x</script>');
  const doc = S.serializeWorkbook({ name: 'T', cells: sh.cells, charts: wb.charts });
  const text = JSON.stringify(doc);
  const back = S.parseWorkbookJSON(text);
  eq('json ok', back.ok, true);
  const sh2 = new S.Sheet(); for (const [i, c] of back.value.cells) sh2.cells.set(i, c); sh2.recalcAll();
  eq('json K1', [sh2.cells.get(A('K1')).value, val(sh2, 'K1')], ['=#REF!', '#REF!']);
  eq('json K2', [sh2.cells.get(A('K2')).value, val(sh2, 'K2')], ['=IF(FALSE,#REF!,9)', 9]);
  eq('json K3 text', sh2.cells.get(A('K3')), { type: 'text', value: '=1+1' });
  eq('json K4 bool', sh2.cells.get(A('K4')), { type: 'boolean', value: true });
  eq('json D1', val(sh2, 'D1'), 26);
  eq('json charts', back.value.charts, wb.charts);
  eq('json types', doc.cells.C1, { type: 'formula', formula: '=A1*B1' });
  const mut = o => JSON.stringify(Object.assign(JSON.parse(text), o));
  const rej = (label, t) => { const r = S.parseWorkbookJSON(t); eq('reject ' + label, r.ok, false); };
  rej('oob cell', mut({ cells: { AA1: { type: 'number', value: 1 } } }));
  rej('row 101', mut({ cells: { A101: { type: 'number', value: 1 } } }));
  rej('bad chart range', mut({ charts: [{ id: 'x', title: '', type: 'column', range: 'H1:AA4' }] }));
  rej('1-row chart range', mut({ charts: [{ id: 'x', title: '', type: 'column', range: 'H1:J1' }] }));
  rej('dup chart id', mut({ charts: [{ id: 'x', title: '', type: 'line', range: 'H1:J4' }, { id: 'x', title: '', type: 'line', range: 'H1:J4' }] }));
  rej('bad version', mut({ version: 2 }));
  rej('no version', JSON.stringify({ cells: {} }));
  rej('bad type', mut({ cells: { A1: { type: 'date', value: 1 } } }));
  rej('num as string', mut({ cells: { A1: { type: 'number', value: '1' } } }));
  rej('formula w/o =', mut({ cells: { A1: { type: 'formula', formula: 'A1' } } }));
  rej('dup addr case', '{"version":1,"cells":{"a1":{"type":"number","value":1},"A1":{"type":"blank"}}}');
  rej('bad color', mut({ charts: [{ id: 'x', title: '', type: 'line', range: 'H1:J4', colors: ['red'] }] }));
  rej('not json', '{nope');
  eq('cache ignored', (() => { const r = S.parseWorkbookJSON('{"version":1,"cells":{"A1":{"type":"formula","formula":"=2*3","value":999}}}'); const s = new S.Sheet(); for (const [i, c] of r.value.cells) s.cells.set(i, c); s.recalcAll(); return val(s, 'A1'); })(), 6);
}
// ---- CSV
{
  const csv = 'label,value\n"alpha, beta",2\n"line\nbreak",=1+1\n';
  const r = S.parseCSV(csv);
  eq('csv ok', r.ok, true);
  const cells = S.csvRowsToCells(r.rows);
  eq('csv A2', cells.get(A('A2')), { type: 'text', value: 'alpha, beta' });
  eq('csv B2', cells.get(A('B2')), { type: 'number', value: 2 });
  eq('csv A3', cells.get(A('A3')), { type: 'text', value: 'line\nbreak' });
  eq('csv B3', cells.get(A('B3')), { type: 'text', value: '=1+1' });
  const sh = new S.Sheet(); for (const [i, c] of cells) sh.cells.set(i, c); sh.recalcAll();
  eq('csv export', S.sheetToCSV(sh), 'label,value\r\n"alpha, beta",2\r\n"line\nbreak",=1+1\r\n');
  eq('csv roundtrip', S.parseCSV(S.sheetToCSV(sh)).rows, r.rows);
  eq('unterminated', S.parseCSV('a,"b\nc').ok, false);
  eq('quote in unquoted', S.parseCSV('a,b"c').ok, false);
  eq('junk after quote', S.parseCSV('"a"b,c').ok, false);
  eq('doubled quotes', S.parseCSV('"say ""hi""",x').rows, [['say "hi"', 'x']]);
  eq('crlf', S.parseCSV('a,b\r\nc,d\r\n').rows, [['a', 'b'], ['c', 'd']]);
  eq('empty field quoted', S.parseCSV('"",1').rows, [['', '1']]);
  eq('too many rows', S.parseCSV(Array(101).fill('1').join('\n')).ok, false);
  eq('100 rows ok', S.parseCSV(Array(100).fill('1').join('\n')).ok, true);
  eq('too many cols', S.parseCSV(Array(27).fill('1').join(',')).ok, false);
  eq('26 cols ok', S.parseCSV(Array(26).fill('1').join(',')).ok, true);
  eq('empty csv', S.parseCSV('').ok, false);
  const { sh: s2 } = seedSheet(); set(s2, 'A5', '=1/0'); set(s2, 'B5', 'TRUE'); set(s2, 'C5', 'He said "x"');
  const out = S.sheetToCSV(s2).split('\r\n');
  eq('csv export values', out[0], '2,3,6,26,10,11,,Item,Current,Plan');
  eq('csv export err/bool/quote', out[4], '#DIV/0!,TRUE,"He said ""x""",,,,,,,');
}
// ---- chart omission
{
  const { sh, wb } = seedSheet();
  set(sh, 'B2', '7');
  eq('B2=7 Current', S.chartData(sh, wb.charts[0]).series[0].points.map(p => p.value), [6, 28, 34]);
  set(sh, 'I3', '');
  const cd = S.chartData(sh, wb.charts[0]);
  eq('I3 cleared', cd.series[0].points.map(p => p.value), [6, null, 34]);
  eq('I3 reason', cd.omitted, [{ series: 'Current', category: 'Beta', addr: 'I3', reason: 'blank cell' }]);
  set(sh, 'I3', '0'); eq('zero is a point', S.chartData(sh, wb.charts[0]).series[0].points[1].value, 0);
  set(sh, 'I3', 'n/a'); eq('text omitted', S.chartData(sh, wb.charts[0]).omitted[0].reason, 'text value');
  set(sh, 'I3', 'TRUE'); eq('bool omitted', S.chartData(sh, wb.charts[0]).omitted[0].reason, 'Boolean value');
  eq('bad range', S.chartData(sh, { range: 'H1:H4', colors: [] }).ok, false);
}
// ---- fuzz: incremental recalc must equal fresh full recalc
{
  let seed = 12345;
  const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const addrs = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) addrs.push(S.addr(r, c));
  const pick = () => addrs[rnd(addrs.length)];
  const expr = d => {
    const k = rnd(d > 2 ? 4 : 10);
    switch (k) {
      case 0: return String(rnd(10) - 3);
      case 1: return pick();
      case 2: return '"' + ['a', 'b', ''][rnd(3)] + '"';
      case 3: return ['TRUE', 'FALSE'][rnd(2)];
      case 4: return expr(d + 1) + ['+', '-', '*', '/', '<', '=', '>='][rnd(7)] + expr(d + 1);
      case 5: return 'SUM(' + pick() + ':' + pick() + ')';
      case 6: return 'IF(' + expr(d + 1) + ',' + expr(d + 1) + ',' + expr(d + 1) + ')';
      case 7: return ['MIN', 'MAX'][rnd(2)] + '(' + pick() + ':' + pick() + ',' + expr(d + 1) + ')';
      case 8: return '-(' + expr(d + 1) + ')';
      default: return pick();
    }
  };
  let mismatches = 0;
  for (let trial = 0; trial < 60; trial++) {
    const sh = new S.Sheet();
    for (let step = 0; step < 120; step++) {
      const a = pick(), i = A(a), kind = rnd(4);
      const raw = kind === 0 ? '' : kind === 1 ? String(rnd(20) - 5) : '=' + expr(0);
      const c = S.classifyInput(raw);
      if (c) sh.cells.set(i, c); else sh.cells.delete(i);
      sh.recalc([i]);
      const fresh = new S.Sheet(); for (const [k, v] of sh.cells) fresh.cells.set(k, v); fresh.recalcAll();
      for (const ad of addrs) {
        const x = show(sh.value(A(ad))), y = show(fresh.value(A(ad)));
        if (JSON.stringify(x) !== JSON.stringify(y)) { mismatches++; if (mismatches < 5) failures.push(`fuzz trial ${trial} step ${step} ${ad}: incr ${JSON.stringify(x)} vs full ${JSON.stringify(y)} (${JSON.stringify(sh.cells.get(A(ad)))})`); }
      }
    }
  }
  eq('fuzz mismatches', mismatches, 0);
}
// ---- deep chain does not overflow
{
  const sh = new S.Sheet();
  for (let r = 0; r < 100; r++) for (let c = 0; c < 26; c++) {
    const i = S.idxOf(r, c);
    const next = i + 1 < 2600 ? S.addrOfIdx(i + 1) : null;
    sh.cells.set(i, next ? { type: 'formula', value: '=' + next + '+1' } : { type: 'number', value: 0 });
  }
  sh.recalcAll();
  eq('deep chain A1', val(sh, 'A1'), 2599);
  const i = A('Z100'); sh.cells.set(i, { type: 'number', value: 1 }); sh.recalc([i]);
  eq('deep chain incremental', val(sh, 'A1'), 2600);
  const t0 = Date.now();
  const big = new S.Sheet();
  for (let k = 0; k < 2600; k++) big.cells.set(k, k < 26 ? { type: 'number', value: k } : { type: 'formula', value: '=SUM(A1:Z1)+' + S.addrOfIdx(k - 26) });
  big.recalcAll();
  const t1 = Date.now();
  big.cells.set(0, { type: 'number', value: 100 }); big.recalc([0]);
  const t2 = Date.now();
  console.log(`perf: full recalc of 2574 range formulas ${t1 - t0} ms, incremental edit of A1 ${t2 - t1} ms`);
  eq('perf sane', (t2 - t1) < 2000, true);
}

console.log(`engine tests: ${pass} passed, ${failN} failed`);
if (failures.length) { console.log(failures.join('\n')); process.exitCode = 1; }
