#!/usr/bin/env node
"use strict";
var E = require("./engine.js");
var fails = 0;
var passes = 0;

function assert(cond, msg) {
  if (cond) {
    passes++;
    return;
  }
  fails++;
  console.error("FAIL:", msg);
}

function eq(a, b, msg) {
  if (a === b) {
    passes++;
    return;
  }
  fails++;
  console.error("FAIL:", msg, "| got", JSON.stringify(a), "expected", JSON.stringify(b));
}

function val(eng, addr) {
  return eng.computedValue(addr);
}

function raw(eng, addr) {
  return eng.cellRaw(addr);
}

var eng = E.createEngine();

eq(val(eng, "C1"), 6, "seed C1");
eq(val(eng, "C2"), 20, "seed C2");
eq(val(eng, "D1"), 26, "seed D1");
eq(val(eng, "E1"), 10, "seed E1");
eq(val(eng, "F1"), 11, "seed F1");
eq(raw(eng, "C1"), "=A1*B1", "seed C1 raw");
eq(raw(eng, "E1"), "=IF(A1>0,10,1/0)", "seed E1 raw");
eq(raw(eng, "F1"), "=$A1+B$1+$C$1", "seed F1 raw");
eq(eng.kindOf("H1"), "text", "H1 text");
eq(val(eng, "I2"), 6, "I2 =C1");
eq(val(eng, "J2"), 8, "J2 plan");

var ch = eng.getCharts()[0];
eq(ch.title, "Current vs Plan", "seed chart title");
eq(ch.type, "column", "seed chart type");
eq(ch.range, "H1:J4", "seed chart range");
var model = eng.chartModel(ch);
eq(model.series[0].name, "Current", "series Current");
eq(model.series[1].name, "Plan", "series Plan");
eq(model.series[0].points[0].value, 6, "Current[0]");
eq(model.series[0].points[1].value, 20, "Current[1]");
eq(model.series[0].points[2].value, 26, "Current[2]");
eq(model.series[1].points[0].value, 8, "Plan[0]");
eq(model.series[1].points[1].value, 18, "Plan[1]");
eq(model.series[1].points[2].value, 26, "Plan[2]");

eng.setRaw("A1", "5");
eq(val(eng, "C1"), 15, "A1=5 C1");
eq(val(eng, "D1"), 35, "A1=5 D1");
eq(val(eng, "F1"), 23, "A1=5 F1");
model = eng.chartModel(eng.getCharts()[0]);
eq(model.series[0].points[0].value, 15, "Current after A1=5 [0]");
eq(model.series[0].points[1].value, 20, "Current after A1=5 [1]");
eq(model.series[0].points[2].value, 35, "Current after A1=5 [2]");
eng.undo();
eq(val(eng, "C1"), 6, "undo C1");
eq(val(eng, "A1"), 2, "undo A1");
model = eng.chartModel(eng.getCharts()[0]);
eq(model.series[0].points[0].value, 6, "undo chart Current[0]");

eng.resetToSeed();
eng.copyRect(5, 1, 5, 1); // F1
var p = eng.pasteAt(5, 2); // F2
assert(p.ok, "paste F1 to F2 ok");
eq(raw(eng, "F2"), "=$A2+B$1+$C$1", "F2 rebased raw");
eq(val(eng, "F2"), 13, "F2 value 13");

eng.copyRect(0, 1, 2, 2); // A1:C2
p = eng.pasteAt(0, 5); // A5
assert(p.ok, "paste A1:C2 to A5 ok");
eq(raw(eng, "C5"), "=A5*B5", "C5 rebased");
eq(raw(eng, "C6"), "=A6*B6", "C6 rebased");
eq(val(eng, "C5"), 6, "C5 value");
eq(val(eng, "C6"), 20, "C6 value");
eq(raw(eng, "F2"), "=$A2+B$1+$C$1", "F2 retained after second paste");
eng.undo();
eq(eng.kindOf("C5"), "blank", "undo paste rectangle C5 blank");
eq(eng.kindOf("A5"), "blank", "undo paste A5 blank");
eq(raw(eng, "F2"), "=$A2+B$1+$C$1", "F2 still there after undo of A5 paste");
eng.redo();
eq(val(eng, "C5"), 6, "redo C5");
eq(val(eng, "C6"), 20, "redo C6");

eng.copyRect(0, 1, 2, 2);
p = eng.pasteAt(24, 99); // Y99: 3 cols -> Y Z AA, 2 rows 99-100. AA is col 26, exceeds
assert(!p.ok, "paste beyond Z100 rejected");
eq(eng.kindOf("Y99"), "blank", "no partial Y99");
eq(eng.kindOf("Z99"), "blank", "no partial Z99");

eng.resetToSeed();
eng.setRaw("B10", "=A10");
eng.copyRect(1, 10, 1, 10);
p = eng.pasteAt(0, 10);
assert(p.ok, "paste B10 to A10");
eq(raw(eng, "A10"), "=#REF!", "A10 raw #REF! operand");
assert(E.isErr(val(eng, "A10")) && val(eng, "A10").error === "#REF!", "A10 value #REF!");
eng.undo();
eq(eng.kindOf("A10"), "blank", "undo restores blank A10");

eng.resetToSeed();
eng.setRaw("A1", "=C1");
assert(E.isErr(val(eng, "A1")) && val(eng, "A1").error === "#CYCLE!", "A1 cycle");
assert(E.isErr(val(eng, "C1")) && val(eng, "C1").error === "#CYCLE!", "C1 cycle");
assert(E.isErr(val(eng, "D1")) && val(eng, "D1").error === "#CYCLE!", "D1 cycle dependent");
model = eng.chartModel(eng.getCharts()[0]);
assert(model.series[0].points[0].omitted, "chart omits cycle error point");
eq(model.series[0].points[0].reason, "#CYCLE!", "omitted reason cycle");
eng.setRaw("A1", "2");
eq(val(eng, "C1"), 6, "cycle recovery C1");
eq(val(eng, "D1"), 26, "cycle recovery D1");
eq(val(eng, "E1"), 10, "cycle recovery E1");

eng.setRaw("G1", "=IF(FALSE,G1,7)");
eq(val(eng, "G1"), 7, "lazy IF false self-ref");
eng.setRaw("G1", "=IF(TRUE,G1,7)");
assert(E.isErr(val(eng, "G1")) && val(eng, "G1").error === "#CYCLE!", "IF true self-ref cycle");
eng.setRaw("G1", "=IF(FALSE,G1,7)");
eq(val(eng, "G1"), 7, "switch back to 7");

function evalIn(addr, formula) {
  eng.setRaw(addr, formula);
  return val(eng, addr);
}

eng.resetToSeed();
eq(evalIn("Z1", "=2+3*4"), 14, "precedence * over +");
eq(evalIn("Z1", "=(2+3)*4"), 20, "parens");
eq(evalIn("Z1", "=SUM(A1:B2)"), 14, "SUM A1:B2");
eq(evalIn("Z1", "=MIN(A1:B2)"), 2, "MIN A1:B2");
eq(evalIn("Z1", "=MAX(A1:B2)"), 5, "MAX A1:B2");
eq(evalIn("Z1", "=TRUE+2"), 3, "TRUE+2");
eq(evalIn("Z1", "=IF(FALSE,1/0,9)"), 9, "IF skip div0");
var v = evalIn("Z1", "=#REF!");
assert(E.isErr(v) && v.error === "#REF!", "=#REF! yields #REF!");
eq(evalIn("Z1", "=IF(FALSE,#REF!,9)"), 9, "IF skip #REF!");
v = evalIn("Z1", "=1/0");
assert(E.isErr(v) && v.error === "#DIV/0!", "div0");
v = evalIn("Z1", "=AA1");
assert(E.isErr(v) && v.error === "#REF!", "AA1 #REF!");
v = evalIn("Z1", "=NOPE(1)");
assert(E.isErr(v) && v.error === "#NAME?", "NOPE #NAME?");
v = evalIn("Z1", '=SUM("text")');
assert(E.isErr(v) && v.error === "#VALUE!", 'SUM("text")');
v = evalIn("Z1", "=1+");
assert(E.isErr(v) && v.error === "#PARSE!", "=1+ parse");

eng.resetToSeed();
eng.setRaw("Z1", "=SUM(A1:B2)");
eq(val(eng, "Z1"), 14, "sum before error in range");
eng.setRaw("A1", "=1/0");
v = val(eng, "Z1");
assert(E.isErr(v) && v.error === "#DIV/0!", "sum propagates range error");
eng.setRaw("A1", "2");
eq(val(eng, "Z1"), 14, "sum recovers");

eng.setRaw("Y20", "=A2+B2");
eq(val(eng, "Y20"), 9, "independent arithmetic A2+B2=9");
eng.setRaw("A2", "10");
eq(val(eng, "Y20"), 15, "after A2=10, 10+5=15");
eng.setRaw("A2", "4");

eq(E.rebaseFormula("=$A1+B$1+$C$1", 0, 1), "=$A2+B$1+$C$1", "rebase F1 down");
eq(E.rebaseFormula("=A1*B1", 0, 4), "=A5*B5", "rebase C1 to C5");
eq(E.rebaseFormula("=A10", -1, 0), "=#REF!", "rebase A10 left is #REF!");

var exported = eng.exportJSON();
eq(exported.version, 1, "json version");
eq(exported.cells.C1.kind, "formula", "json C1 formula");
eq(exported.cells.C1.raw, "=A1*B1", "json C1 raw");
eq(exported.cells.H1.kind, "text", "json H1 text");
eng.setRaw("Z1", "=#REF!");
eng.setRaw("Z2", "=IF(FALSE,#REF!,9)");
var js = eng.exportJSON();
eq(js.cells.Z1.raw, "=#REF!", "export #REF! formula");
eq(js.cells.Z2.raw, "=IF(FALSE,#REF!,9)", "export IF #REF!");
eng.setRaw("A1", "99");
var imp = eng.importJSON(js);
assert(imp.ok, "reimport ok");
eq(val(eng, "A1"), 2, "import restored A1");
eq(raw(eng, "Z1"), "=#REF!", "import preserved #REF! raw");
eq(val(eng, "Z2"), 9, "import IF #REF! still 9");
assert(E.isErr(val(eng, "Z1")) && val(eng, "Z1").error === "#REF!", "imported #REF! evaluates");

eng.resetToSeed();
var before = eng.exportJSON();
eng.setRaw("A1", "5");
var bad1 = JSON.parse(JSON.stringify(before));
bad1.cells.AA1 = { kind: "number", raw: "1" };
var r1 = eng.importJSON(bad1);
assert(!r1.ok, "reject AA1");
eq(val(eng, "A1"), 5, "invalid import no mutation");
var bad2 = JSON.parse(JSON.stringify(before));
bad2.charts[0].range = "H1:ZZ4";
r1 = eng.importJSON(bad2);
assert(!r1.ok, "reject bad chart range");
eq(val(eng, "A1"), 5, "still no mutation");

eng.resetToSeed();
var csv = 'label,value\n"alpha, beta",2\n"line\nbreak",=1+1\n';
var csvRes = eng.importCSV(csv);
assert(csvRes.ok, "csv import ok");
eq(eng.kindOf("A2"), "text", "A2 text");
eq(val(eng, "A2"), "alpha, beta", "A2 comma field");
eq(eng.kindOf("B2"), "number", "B2 number");
eq(val(eng, "B2"), 2, "B2 2");
eq(val(eng, "A3"), "line\nbreak", "A3 newline");
eq(eng.kindOf("B3"), "text", "B3 text not formula");
eq(val(eng, "B3"), "=1+1", "B3 literal =1+1");
assert(eng.getCharts().length === 0, "csv clears charts");
var csvOut = eng.exportCSV();
assert(csvOut.indexOf('"alpha, beta"') >= 0, "csv export quotes comma");
assert(csvOut.indexOf("=1+1") >= 0, "csv export evaluated/literal text");
assert(csvOut.indexOf('"line\nbreak"') >= 0, "csv export quotes newline");

eng.resetToSeed();
var snap = JSON.stringify(eng.exportJSON());
var badCsv = eng.importCSV('"unterminated');
assert(!badCsv.ok, "unterminated csv rejected");
eq(JSON.stringify(eng.exportJSON()), snap, "csv reject no mutation");
eq(val(eng, "C1"), 6, "still seed after csv reject");

eng.resetToSeed();
eq(evalIn("Z5", '=IF(FALSE,1/0,SUM(1,2,3))'), 6, "IF then SUM");
v = evalIn("Z5", "=A1:B1");
assert(E.isErr(v) && v.error === "#VALUE!", "range as value is #VALUE!");
v = evalIn("Z5", "=IF(1,2)");
assert(E.isErr(v) && v.error === "#VALUE!", "IF arity");
eq(evalIn("Z5", '=IF(0,5,8)'), 8, "IF 0 is false");
eq(evalIn("Z5", '=IF("",5,8)') && E.isErr(val(eng, "Z5")) ? val(eng, "Z5").error : evalIn("Z5", '=IF("",5,8)'), "#VALUE!", "IF text cond");
v = evalIn("Z5", '=IF("x",1,2)');
assert(E.isErr(v) && v.error === "#VALUE!", "IF text condition");
eq(evalIn("Z5", "=SUM(TRUE,FALSE,2)"), 3, "SUM booleans");
eng.setRaw("Y1", "hello");
eq(evalIn("Z5", "=SUM(Y1:Y1)"), 0, "range ignores text -> 0");
v = evalIn("Z5", "=SUM(Y1)");
assert(E.isErr(v) && v.error === "#VALUE!", "scalar text SUM");
eq(evalIn("Z5", '=1=1'), true, "eq");
v = evalIn("Z5", '=1="1"');
assert(E.isErr(v) && v.error === "#VALUE!", "mixed compare");
eq(evalIn("Z5", '="a"="a"'), true, "string eq");
eq(evalIn("Z5", '="A"="a"'), false, "case sensitive");
eq(evalIn("Z5", "=-2-3"), -5, "unary then binary");
eq(evalIn("Z5", "=--4"), 4, "double unary");
v = evalIn("Z5", "=FOO");
assert(E.isErr(v) && v.error === "#NAME?", "bare ident NAME");

eng.resetToSeed();
eng.setRaw("Z10", "'=A1*B1");
eq(eng.kindOf("Z10"), "text", "apostrophe formula-looking is text");
eq(val(eng, "Z10"), "=A1*B1", "apostrophe strips");
eng.setRaw("Z11", "'#REF!");
eq(eng.kindOf("Z11"), "text", "quoted-apostrophe #REF! is text");
eq(val(eng, "Z11"), "#REF!", "apostrophe #REF! text value");

eng.setRaw("I3", "");
model = eng.chartModel(eng.getCharts()[0]);
assert(model.series[0].points[1].omitted, "cleared I3 omitted");
eq(model.series[0].points[1].reason, "blank", "omit reason blank");
eq(model.omitted.length >= 1, true, "omitted count");
eng.undo();
model = eng.chartModel(eng.getCharts()[0]);
eq(model.series[0].points[1].value, 20, "undo restore I3");

eng.updateChart(eng.getCharts()[0].id, { type: "line", title: "Renamed" });
eq(eng.getCharts()[0].type, "line", "chart type line");
eq(eng.getCharts()[0].title, "Renamed", "chart title");
eng.undo();
eq(eng.getCharts()[0].type, "column", "undo chart type");

var id2 = eng.addChart({ type: "line", range: "H1:J4", title: "Line" });
assert(eng.getCharts().length === 2, "two charts");
eng.deleteChart(id2);
eq(eng.getCharts().length, 1, "delete chart");

eng.resetToSeed();
eq(eng.canUndo(), false, "reset clears undo");
eng.setRaw("A1", "5");
assert(eng.canUndo(), "can undo after edit");
eng.resetToSeed();
eq(val(eng, "A1"), 2, "reset A1");
eq(eng.canUndo(), false, "reset clears history");
eq(eng.getCharts()[0].title, "Current vs Plan", "reset chart");

var htmlish = "<img src=x onerror=alert(1)>";
eng.setRaw("Z99", htmlish);
eq(val(eng, "Z99"), htmlish, "html stored as text");

console.log(passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
