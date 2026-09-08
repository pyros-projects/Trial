import {
  compile,
  seedSource,
  cloneSource,
  parseProjectJson,
  toExportJson,
  toCsv,
  csvEscape,
  intervalsOf,
  parseYMD,
  normalizeToMonday,
  workingDayOffset,
  addWorkingDays,
  dow,
  LIMITS,
} from "../engine.mjs";

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log("ok  " + name);
  } else {
    failed += 1;
    failures.push(name + (detail ? " — " + detail : ""));
    console.error("FAIL " + name + (detail ? " — " + detail : ""));
  }
}

function eq(name, got, expected) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(expected);
  ok(name, a === b, "got " + a + " expected " + b);
}

const seed = compile(seedSource());
ok("seed compiles", seed.ok, seed.error);
eq("seed intervals", intervalsOf(seed), {
  T1: [0, 2],
  T2: [2, 5],
  T3: [5, 7],
  T4: [7, 8],
  T5: [8, 8],
});
eq("seed actual completion offset", seed.actualCompletion, 8);
eq("seed actual completion date", seed.actualCompletionDate, "2026-09-17");
eq("T2 last work date", seed.taskById.T2.lastWorkDate, "2026-09-11");
eq("T2 exclusive finish date", seed.taskById.T2.finishDate, "2026-09-14");
eq("T5 last work empty", seed.taskById.T5.lastWorkDate, null);
eq("cpm completion", seed.cpmCompletion, 6);
eq("T3 float", seed.taskById.T3.float, 1);
eq("T1 float", seed.taskById.T1.float, 0);
eq("T2 float", seed.taskById.T2.float, 0);
eq("T4 float", seed.taskById.T4.float, 0);
eq("T5 float", seed.taskById.T5.float, 0);
eq("T3 cpm es", seed.taskById.T3.es, 2);
eq("T3 actual start", seed.taskById.T3.start, 5);

const r1days = seed.occupancy.R1;
ok("R1 occupancy days exist", r1days.length === 8);
ok(
  "R1 never exceeds capacity 1",
  r1days.every((d) => d.used <= 1)
);

const start = parseYMD("2026-09-07");
ok("2026-09-07 parses", start && start.iso === "2026-09-07");
ok("2026-09-07 is Monday (dow 1)", start && dow(2026, 9, 7) === 1);
eq("offset 5 date", seed.calendar.dates[5], "2026-09-14");
eq("offset 8 date", seed.calendar.dates[8], "2026-09-17");

ok("invalid date 2026-02-29 rejected", parseYMD("2026-02-29") == null);
ok("invalid date 2026-09-31 rejected", parseYMD("2026-09-31") == null);
ok("1999-12-31 rejected", parseYMD("1999-12-31") == null);
ok("2100-01-01 rejected", parseYMD("2100-01-01") == null);

const sat = normalizeToMonday(parseYMD("2026-09-12"));
eq("Saturday normalizes to Monday", sat.date.iso, "2026-09-14");
ok("Saturday marked shifted", sat.shifted);

const cap2src = cloneSource(seedSource());
cap2src.resources[0].capacity = 2;
const cap2 = compile(cap2src);
ok("capacity 2 compiles", cap2.ok, cap2.error);
eq("capacity 2 intervals", intervalsOf(cap2), {
  T1: [0, 2],
  T2: [2, 5],
  T3: [2, 4],
  T4: [5, 6],
  T5: [6, 6],
});
eq("capacity 2 actual", cap2.actualCompletion, 6);
eq("capacity 2 cpm unchanged", cap2.cpmCompletion, 6);

const nbSrc = cloneSource(seedSource());
nbSrc.tasks.find((t) => t.id === "T2").notBefore = "2026-09-14";
const nb = compile(nbSrc);
ok("not-before compiles", nb.ok, nb.error);
eq("not-before intervals", intervalsOf(nb), {
  T1: [0, 2],
  T2: [5, 8],
  T3: [2, 4],
  T4: [8, 9],
  T5: [9, 9],
});
eq("not-before cpm still 6", nb.cpmCompletion, 6);
eq("T3 fills gap", [nb.taskById.T3.start, nb.taskById.T3.finish], [2, 4]);

const satNb = cloneSource(seedSource());
satNb.tasks.find((t) => t.id === "T2").notBefore = "2026-09-12";
const satPlan = compile(satNb);
ok("Saturday not-before compiles", satPlan.ok, satPlan.error);
eq("Saturday not-before same intervals", intervalsOf(satPlan), intervalsOf(nb));
ok("Saturday not-before notice", satPlan.notices.some((n) => n.includes("T2") && n.includes("2026-09-14")));
eq("stored not-before is Monday", satPlan.taskById.T2.notBefore, "2026-09-14");

const d3 = cloneSource(seedSource());
d3.tasks.find((t) => t.id === "T1").duration = 3;
const d3p = compile(d3);
ok("T1 duration 3 compiles", d3p.ok, d3p.error);
eq("T1 duration 3 intervals", intervalsOf(d3p), {
  T1: [0, 3],
  T2: [3, 6],
  T3: [6, 8],
  T4: [8, 9],
  T5: [9, 9],
});
eq("T1 duration 3 cpm", d3p.cpmCompletion, 7);

const cycleSrc = cloneSource(seedSource());
cycleSrc.tasks.find((t) => t.id === "T1").predecessors = ["T5"];
const cycle = compile(cycleSrc);
ok("cycle rejected", !cycle.ok);
ok("cycle mentions cycle", /cycle/i.test(cycle.error));

const missing = cloneSource(seedSource());
missing.tasks[0].predecessors = ["TX"];
ok("missing pred rejected", !compile(missing).ok);

const dup = cloneSource(seedSource());
dup.tasks.push({ ...dup.tasks[0], name: "Copy" });
ok("duplicate ID rejected", !compile(dup).ok);

const badCap = cloneSource(seedSource());
badCap.resources[0].capacity = 0;
ok("capacity 0 rejected", !compile(badCap).ok);
badCap.resources[0].capacity = 5;
ok("capacity 5 rejected", !compile(badCap).ok);
badCap.resources[0].capacity = 1.5;
ok("capacity 1.5 rejected", !compile(badCap).ok);

const badDate = cloneSource(seedSource());
badDate.project.startDate = "2026-02-29";
ok("impossible start rejected", !compile(badDate).ok);

const hugeDur = cloneSource(seedSource());
hugeDur.tasks[0].duration = 1000000000;
ok("duration 1e9 rejected", !compile(hugeDur).ok);

const badPri = cloneSource(seedSource());
badPri.tasks[0].priority = 10000;
ok("priority 10000 rejected", !compile(badPri).ok);

const far = cloneSource(seedSource());
far.tasks.find((t) => t.id === "T2").notBefore = "2099-12-31";
const farR = compile(far);
ok("far not-before rejected", !farR.ok);
ok("far not-before mentions horizon or range", /2600|horizon|outside|exceed/i.test(farR.error), farR.error);

const mileRes = cloneSource(seedSource());
mileRes.tasks.find((t) => t.id === "T5").resourceId = "R1";
ok("milestone with resource rejected", !compile(mileRes).ok);

const um = cloneSource(seedSource());
um.tasks.push({ id: "U", name: "Unassigned", duration: 1, priority: 0, resourceId: null, predecessors: [], notBefore: null });
um.tasks.push({ id: "M", name: "Mark", duration: 0, priority: 0, resourceId: null, predecessors: ["U"], notBefore: null });
const ump = compile(um);
ok("U+M compiles", ump.ok, ump.error);
eq("U interval", [ump.taskById.U.start, ump.taskById.U.finish], [0, 1]);
eq("M interval", [ump.taskById.M.start, ump.taskById.M.finish], [1, 1]);
eq("original five unchanged with U+M", {
  T1: [ump.taskById.T1.start, ump.taskById.T1.finish],
  T2: [ump.taskById.T2.start, ump.taskById.T2.finish],
  T3: [ump.taskById.T3.start, ump.taskById.T3.finish],
  T4: [ump.taskById.T4.start, ump.taskById.T4.finish],
  T5: [ump.taskById.T5.start, ump.taskById.T5.finish],
}, intervalsOf(seed));

const tie = cloneSource(seedSource());
tie.tasks.find((t) => t.id === "T3").priority = 2;
const tiePlan = compile(tie);
ok("equal priority compiles", tiePlan.ok, tiePlan.error);
eq("T2 wins ID tie", intervalsOf(tiePlan), intervalsOf(seed));

const json = toExportJson(tiePlan.source);
json.tasks = json.tasks.slice().reverse();
const reimp = parseProjectJson(JSON.stringify(json));
ok("reversed import compiles", reimp.ok, reimp.error);
eq("reversed import same intervals", intervalsOf(reimp), intervalsOf(seed));

const csv = toCsv(seed);
ok("csv has header lastWorkDate", csv.includes("lastWorkDate"));
ok("csv T2 last work", /T2,Build,R1,T1,3,,2,5,2026-09-09,2026-09-14,2026-09-11,0/.test(csv), csv);
ok("csv T5 empty last work", /T5,Launch,,T4,0,,8,8,2026-09-17,2026-09-17,,0/.test(csv), csv);
eq('csv escape quote', csvEscape('say "hi"'), '"say ""hi"""');
eq("csv escape comma", csvEscape("a,b"), '"a,b"');

const xss = cloneSource(seedSource());
xss.tasks[0].name = '<img src=x onerror="alert(1)">';
const xssp = compile(xss);
ok("html name compiles", xssp.ok, xssp.error);
eq("html name stored raw", xssp.taskById.T1.name, '<img src=x onerror="alert(1)">');

const empty = compile({ project: { name: "Empty", startDate: "2026-09-07" }, resources: [], tasks: [] });
ok("empty compiles", empty.ok, empty.error);
eq("empty actual 0", empty.actualCompletion, 0);
eq("empty cpm 0", empty.cpmCompletion, 0);

const unsafe = cloneSource(seedSource());
unsafe.tasks[0].duration = Number.MAX_VALUE;
ok("non-safe duration rejected", !compile(unsafe).ok);

const extra = cloneSource(seedSource());
extra.tasks.find((t) => t.id === "T2").duration = 4;
const extraP = compile(extra);
ok("extra duration 4 compiles", extraP.ok, extraP.error);
eq("extra duration intervals", intervalsOf(extraP), {
  T1: [0, 2],
  T2: [2, 6],
  T3: [6, 8],
  T4: [8, 9],
  T5: [9, 9],
});

const self = cloneSource(seedSource());
self.tasks[0].predecessors = ["T1"];
ok("self pred rejected", !compile(self).ok);

const weekendStart = cloneSource(seedSource());
weekendStart.project.startDate = "2026-09-06";
const ws = compile(weekendStart);
ok("weekend start compiles", ws.ok, ws.error);
eq("weekend start normalized to Monday", ws.source.project.startDate, "2026-09-07");
ok("weekend start notice", ws.notices.some((n) => n.includes("2026-09-07")));

ok("T3 explanation resource wait", seed.explanations.T3.chosenStart === 5 && seed.explanations.T3.candidate === 2);
ok("T3 blocked by T2", seed.explanations.T3.blockedIntervals.some((b) => b.taskIds.includes("T2")));

const dst = parseYMD("2026-03-08");
const mon = parseYMD("2026-03-09");
ok("DST weekend Saturday parses", dst && dst.iso === "2026-03-08");
const dstOff = workingDayOffset(parseYMD("2026-03-02"), parseYMD("2026-03-09"));
ok("working days across US DST not using ms", dstOff === 5, String(dstOff));

const horizonTask = {
  project: { name: "H", startDate: "2026-09-07" },
  resources: [{ id: "R1", name: "A", capacity: 1 }],
  tasks: [{ id: "Z", name: "Long", duration: 260, priority: 1, resourceId: "R1", predecessors: [], notBefore: "2037-01-01" }],
};
const hz = compile(horizonTask);
ok("task that cannot fit horizon rejected", !hz.ok, hz.ok ? "unexpectedly ok" : hz.error);

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) {
  console.error(failures.join("\n"));
  process.exit(1);
}
