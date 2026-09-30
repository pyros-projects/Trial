// Dev-only probe: reads what each rendered view shows and compares it with the live model snapshot.
(() => {
  const S = PPS.snapshot(), px = S.pxPerDay, out = { ok: true, problems: [] };
  const bad = (m) => { out.ok = false; out.problems.push(m); };
  for (const [id, [st, fi]] of Object.entries(S.intervals)) {
    const td = document.querySelector(`tr[data-id="${id}"] td.c-sched`);
    if (!td || td.dataset.sched !== `${st},${fi}`) bad(`table ${id} shows ${td && td.dataset.sched} expected ${st},${fi}`);
    const g = document.querySelector(`.g-bar[data-id="${id}"]`);
    const rect = g && g.querySelector(".bar-rect"), ms = g && g.querySelector(".ms-shape");
    if (rect) { const x = +rect.getAttribute("x"), w = +rect.getAttribute("width"); if (Math.round((x - 0.5) / px) !== st || Math.round((x + w + 0.5) / px) !== fi) bad(`gantt ${id} bar at ${x}/${w}`); }
    else if (ms) { const m = /^M([\d.]+)/.exec(ms.getAttribute("d")); if (Math.round(+m[1] / px) !== st) bad(`gantt milestone ${id} at ${m[1]}`); }
    else bad(`gantt ${id} missing`);
    const lane = document.querySelector(`.lane-bar[data-id="${id}"] rect`);
    if (lane) { const x = +lane.getAttribute("x"); if (Math.round((x - 0.5) / px) !== st) bad(`lane ${id} at ${x}`); }
    else if (fi > st) bad(`lane ${id} missing`);
  }
  // capacity never exceeded in the lane cells
  document.querySelectorAll(".slot[data-res] rect.cell").forEach((c) => { if (c.getAttribute("fill") === "#d9363e") bad("over-capacity cell drawn"); });
  const stats = document.getElementById("stats").innerText;
  if (!stats.includes(`offset ${S.completion} ·`)) bad(`stats missing actual completion ${S.completion}`);
  if (!stats.includes(`offset ${S.dependencyOnlyCompletion} ·`)) bad(`stats missing dependency-only ${S.dependencyOnlyCompletion}`);
  out.intervals = JSON.stringify(S.intervals); out.completion = S.completion; out.dep = S.dependencyOnlyCompletion;
  out.undo = S.undo.length; out.redo = S.redo.length;
  return out;
})()
