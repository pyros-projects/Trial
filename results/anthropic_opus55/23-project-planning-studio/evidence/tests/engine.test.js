// Dev-only unit test: extracts the engine <script> from ../../index.html and checks scheduling rules.
const fs = require("fs"), path = require("path"), vm = require("vm");
const html = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
const src = html.match(/<script id="pps-engine">([\s\S]*?)<\/script>/)[1];
const ctx = { module: {} }; vm.createContext(ctx); vm.runInContext(src, ctx);
const E = ctx.module.exports;
let pass = 0, fail = 0;
function eq(name, got, exp) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) { pass++; } else { fail++; console.log("FAIL", name, "\n  got", g, "\n  exp", e); }
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const iv = (r) => Object.fromEntries(r.model.tasks.map((t) => [t.id, [r.schedule.byId.get(t.id).start, r.schedule.byId.get(t.id).finish]]));
const fl = (r) => Object.fromEntries(r.model.tasks.map((t) => [t.id, r.cpm.byId.get(t.id).float]));

let r = E.evaluate(clone(E.SEED));
eq("seed ok", r.ok, true);
eq("seed intervals", iv(r), { T1: [0, 2], T2: [2, 5], T3: [5, 7], T4: [7, 8], T5: [8, 8] });
eq("seed completion", r.schedule.completion, 8);
eq("completion date", r.cal.iso(8), "2026-09-17");
eq("T2 last workday", r.cal.iso(4), "2026-09-11");
eq("T2 excl finish", r.cal.iso(5), "2026-09-14");
eq("cpm completion", r.cpm.completion, 6);
eq("floats", fl(r), { T1: 0, T2: 0, T3: 1, T4: 0, T5: 0 });
eq("T3 cpm es", r.cpm.byId.get("T3").es, 2);
eq("T3 blocks", r.schedule.byId.get("T3").blocks, [{ from: 2, to: 5, ids: ["T2"] }]);
eq("crit edges", [...r.cpm.critEdges].map((e) => e.replace("\u0000", ">")).sort(), ["T1>T2", "T2>T4", "T4>T5"]);

let s = clone(E.SEED); s.resources[0].capacity = 2; r = E.evaluate(s);
eq("cap2", iv(r), { T1: [0, 2], T2: [2, 5], T3: [2, 4], T4: [5, 6], T5: [6, 6] });
eq("cap2 cpm", r.cpm.completion, 6);

s = clone(E.SEED); s.tasks[1].notBefore = "2026-09-14"; r = E.evaluate(s);
eq("nb T2", iv(r), { T1: [0, 2], T2: [5, 8], T3: [2, 4], T4: [8, 9], T5: [9, 9] });
eq("nb cpm", r.cpm.completion, 6);
s.tasks[1].notBefore = "2026-09-12"; r = E.evaluate(s);
eq("nb sat normalized", r.model.tasks[1].notBefore, "2026-09-14");
eq("nb sat note", r.notes.length, 1);
eq("nb sat intervals", iv(r).T2, [5, 8]);

s = clone(E.SEED); s.tasks[0].duration = 3; r = E.evaluate(s);
eq("T1 dur3", iv(r), { T1: [0, 3], T2: [3, 6], T3: [6, 8], T4: [8, 9], T5: [9, 9] });
eq("T1 dur3 cpm", r.cpm.completion, 7);

s = clone(E.SEED); s.tasks[0].predecessors = ["T5"]; r = E.evaluate(s);
eq("cycle rejected", r.ok, false); console.log("  cycle msg:", r.errors[0]);
s = clone(E.SEED); s.tasks[0].predecessors = ["NOPE"]; r = E.evaluate(s); eq("missing pred", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.tasks[3].id = "T2"; r = E.evaluate(s); eq("dup id", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.resources[0].capacity = 5; r = E.evaluate(s); eq("cap 5", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.tasks[0].notBefore = "2026-02-30"; r = E.evaluate(s); eq("bad date", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.tasks[0].duration = 1000000000; r = E.evaluate(s); eq("huge dur", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.tasks[0].priority = 10000; r = E.evaluate(s); eq("prio 10000", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.tasks[0].notBefore = "2037-01-05"; r = E.evaluate(s); eq("beyond horizon", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.tasks[4].resourceId = "R1"; r = E.evaluate(s); eq("ms with res", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.tasks[0].duration = 2.5; r = E.evaluate(s); eq("frac", r.ok, false);
s = clone(E.SEED); s.project.startDate = "2099-06-01"; r = E.evaluate(s); eq("start 2099 ok", r.ok, true);
s = clone(E.SEED); s.project.startDate = "2099-12-28"; r = E.evaluate(s); eq("derived date beyond 2099", r.ok, false); console.log("  ", r.errors[0]);
s = clone(E.SEED); s.project.startDate = "2026-09-05"; r = E.evaluate(s); eq("start sat -> mon", r.model.project.startDate, "2026-09-07");

// horizon edge: task finishing exactly at 2600 allowed; 2601 rejected
s = clone(E.SEED); s.tasks = [{ id: "A", name: "a", duration: 1, priority: 0, resourceId: null, predecessors: [], notBefore: null }];
const cal = E.makeCalendar(E.parseDate("2026-09-07").dn);
s.tasks[0].notBefore = cal.iso(2599); r = E.evaluate(s); eq("finish 2600 ok", r.ok && r.schedule.completion, 2600);
s.tasks[0].notBefore = cal.iso(2600); r = E.evaluate(s); eq("finish 2601 rejected", r.ok, false);
s.tasks[0].duration = 0; r = E.evaluate(s); eq("milestone at 2600 ok", r.ok, true);

// tie-break: priority equal, ID order, independent of array order
s = clone(E.SEED); s.tasks[2].priority = 2; s.tasks.reverse(); r = E.evaluate(s);
eq("tie reversed", iv(r), { T5: [8, 8], T4: [7, 8], T3: [5, 7], T2: [2, 5], T1: [0, 2] });
// U and M
s = clone(E.SEED); s.tasks.push({ id: "U", name: "u", duration: 1, priority: 0, resourceId: null, predecessors: [], notBefore: null });
s.tasks.push({ id: "M", name: "m", duration: 0, priority: 0, resourceId: null, predecessors: ["U"], notBefore: null }); r = E.evaluate(s);
eq("U/M", iv(r), { T1: [0, 2], T2: [2, 5], T3: [5, 7], T4: [7, 8], T5: [8, 8], U: [0, 1], M: [1, 1] });
// case-sensitive IDs distinct
s = clone(E.SEED); s.tasks.push({ id: "t1", name: "lower", duration: 1, priority: 1, resourceId: "R1", predecessors: [], notBefore: null }); r = E.evaluate(s);
eq("case-sensitive", r.ok && [iv(r).T1, iv(r).t1, iv(r).T2], [[0, 2], [2, 3], [3, 6]]);
// 50 tasks x 8 resources perf
s = { version: 1, project: { name: "big", startDate: "2026-09-07" }, resources: [], tasks: [] };
for (let i = 0; i < 8; i++) s.resources.push({ id: "R" + i, name: "r", capacity: 1 + (i % 4) });
for (let i = 0; i < 500; i++) s.tasks.push({ id: "K" + i, name: "k", duration: 1 + (i % 5), priority: i % 7, resourceId: "R" + (i % 8), predecessors: i > 3 ? ["K" + (i - 3)] : [], notBefore: null });
let t0 = Date.now(); r = E.evaluate(s); eq("500 tasks ok", r.ok, true); console.log("  500 tasks in", Date.now() - t0, "ms; completion", r.ok && r.schedule.completion);
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
