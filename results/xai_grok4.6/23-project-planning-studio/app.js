const NS = "http://www.w3.org/2000/svg";
const LABEL_W = 132;
const ROW_H = 30;
const HEAD_H = 44;

let source = seedSource();
let compiled = compile(source);
if (!compiled.ok) throw new Error(compiled.error);
source = compiled.source;
let undoStack = [];
let redoStack = [];
let selectedId = null;
let showCritical = false;
let dayWidth = 26;
let errorMsg = "";
let noticeMsg = "";
let preview = null;
let drag = null;
let pan = null;
let modal = null;
let viewName = "table";

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function $(id) {
  return document.getElementById(id);
}

function setText(node, text) {
  node.textContent = text == null ? "" : String(text);
}

function el(tag, attrs) {
  const n = document.createElement(tag);
  applyAttrs(n, attrs);
  return n;
}

function applyAttrs(n, attrs) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "dataset") {
      for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    } else if (typeof v === "boolean") n.setAttribute(k, "");
    else n.setAttribute(k, String(v));
  }
}

function svg(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      n.setAttribute(k, String(v));
    }
  }
  return n;
}

function download(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function spanDays(plan) {
  let m = 16;
  if (plan.actualCompletion + 6 > m) m = plan.actualCompletion + 6;
  for (const t of plan.tasks) if (t.finish + 3 > m) m = t.finish + 3;
  if (m > LIMITS.MAX_OFFSET + 1) m = LIMITS.MAX_OFFSET + 1;
  return m;
}

function colorHex(task) {
  if (task.duration === 0) return "#1a120c";
  if (task.resourceId === "R1") return "#1f4f45";
  if (task.resourceId === "R2") return "#c24e1d";
  if (!task.resourceId) return "#5c5348";
  let h = 0;
  for (let i = 0; i < task.resourceId.length; i++) h = (h * 33 + task.resourceId.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 32%)`;
}

function showError(msg) {
  errorMsg = msg;
  renderBanners();
}

function commit(next) {
  const result = compile(next);
  if (!result.ok) {
    showError(result.error);
    return false;
  }
  undoStack.push(clone(source));
  if (undoStack.length > 120) undoStack.shift();
  redoStack = [];
  source = result.source;
  compiled = result;
  noticeMsg = result.notices.join(" ");
  errorMsg = "";
  preview = null;
  render();
  return true;
}

function patch(mut) {
  const next = clone(source);
  mut(next);
  return commit(next);
}

function undo() {
  if (!undoStack.length || drag) return;
  redoStack.push(clone(source));
  source = undoStack.pop();
  const result = compile(source);
  compiled = result.ok ? result : compiled;
  noticeMsg = compiled.notices ? compiled.notices.join(" ") : "";
  errorMsg = "";
  render();
}

function redo() {
  if (!redoStack.length || drag) return;
  undoStack.push(clone(source));
  source = redoStack.pop();
  const result = compile(source);
  compiled = result.ok ? result : compiled;
  noticeMsg = compiled.notices ? compiled.notices.join(" ") : "";
  errorMsg = "";
  render();
}

function resetPlan() {
  source = seedSource();
  compiled = compile(source);
  source = compiled.source;
  undoStack = [];
  redoStack = [];
  selectedId = null;
  preview = null;
  drag = null;
  errorMsg = "";
  noticeMsg = "Seed plan restored. Undo history cleared.";
  render();
}

function nextId(prefix, existing) {
  const used = new Set(existing);
  for (let i = 1; i < 10000; i++) {
    const id = prefix + i;
    if (!used.has(id)) return id;
  }
  return prefix + "x";
}

function selectTask(id) {
  selectedId = id;
  render();
}

function visiblePlan() {
  return preview && preview.ok ? preview : compiled;
}

function renderBanners() {
  const box = $("banners");
  box.replaceChildren();
  if (errorMsg) box.appendChild(el("div", { class: "banner error", role: "alert", id: "error-banner", text: errorMsg }));
  if (noticeMsg) box.appendChild(el("div", { class: "banner notice", id: "notice-banner", text: noticeMsg }));
  if (drag && drag.request != null) {
    const d = drag;
    let t = "Requested not-before offset " + d.request;
    if (d.requestDate) t += " (" + d.requestDate + ")";
    if (preview && preview.ok && preview.taskById[d.id]) {
      const p = preview.taskById[d.id];
      t += ". Preview start " + p.start + " [" + p.start + "," + p.finish + ") · " + p.startDate + ".";
      if (p.start > d.request) t += " Scheduler placed it later than the constraint.";
    } else if (preview && !preview.ok) {
      t += ". Preview rejected: " + preview.error;
    }
    box.appendChild(el("div", { class: "banner preview", id: "drag-preview", text: t }));
  }
}

function renderSummary() {
  const plan = visiblePlan();
  setText($("metric-actual-offset"), plan.ok === false ? "—" : String(plan.actualCompletion));
  setText($("metric-actual-date"), plan.ok === false ? "—" : plan.actualCompletionDate);
  setText($("metric-cpm"), plan.ok === false ? "—" : String(plan.cpmCompletion));
  setText($("metric-counts"), plan.ok === false ? "—" : plan.tasks.length + " tasks · " + plan.resources.length + " resources");
  $("project-name").value = source.project.name;
  $("project-start").value = source.project.startDate;
  $("btn-undo").disabled = undoStack.length === 0 || !!drag;
  $("btn-redo").disabled = redoStack.length === 0 || !!drag;
  $("chk-critical").checked = showCritical;
}

function renderTable() {
  const plan = compiled;
  const tb = $("task-body");
  tb.replaceChildren();
  if (!plan.tasks.length) {
    const tr = el("tr");
    const td = el("td", { text: "No tasks. Add a task or milestone to begin. Empty-plan completion is 0." });
    td.colSpan = 8;
    tr.appendChild(td);
    tb.appendChild(tr);
    return;
  }
  for (const t of plan.tasks) {
    const src = source.tasks.find((s) => s.id === t.id);
    const tr = el("tr", { dataset: { task: t.id } });
    if (t.id === selectedId) tr.classList.add("selected");
    if (showCritical && t.zeroFloat) tr.classList.add("critical");
    const exp = compiled.explanations[t.id];
    if (exp && exp.delayKinds.includes("resource")) tr.classList.add("waiting");
    tr.addEventListener("click", (e) => {
      if (e.target.closest("input,select,button")) return;
      selectTask(t.id);
    });
    tr.addEventListener("focusin", () => {
      if (selectedId !== t.id) selectTask(t.id);
    });
    const idTd = el("td");
    idTd.appendChild(el("span", { class: "tid", text: t.id }));
    if (t.zeroFloat) idTd.appendChild(el("span", { class: "chip crit", text: " zero float " }));
    if (exp && exp.delayKinds.includes("resource") && t.start > t.es) {
      idTd.appendChild(el("span", { class: "chip wait", text: " resource wait " }));
    } else if (exp && exp.delayKinds.includes("not-before") && exp.notBeforeBound > exp.predBound) {
      idTd.appendChild(el("span", { class: "chip wait", text: " date wait " }));
    }
    tr.appendChild(idTd);

    const nameIn = el("input", { type: "text", id: "name-" + t.id, "aria-label": "Name for " + t.id, value: t.name });
    nameIn.addEventListener("change", () => {
      patch((s) => {
        s.tasks.find((x) => x.id === t.id).name = nameIn.value;
      });
    });
    tr.appendChild(el("td")).appendChild(nameIn);

    const durIn = el("input", {
      type: "number",
      id: "dur-" + t.id,
      min: "0",
      max: String(LIMITS.MAX_DURATION),
      step: "1",
      "aria-label": "Duration for " + t.id,
      value: String(t.duration),
    });
    durIn.addEventListener("change", () => {
      const n = Number(durIn.value);
      patch((s) => {
        const row = s.tasks.find((x) => x.id === t.id);
        row.duration = n;
        if (n === 0) row.resourceId = null;
      });
    });
    tr.appendChild(el("td")).appendChild(durIn);

    const priIn = el("input", {
      type: "number",
      id: "pri-" + t.id,
      min: "0",
      max: String(LIMITS.MAX_PRIORITY),
      step: "1",
      "aria-label": "Priority for " + t.id,
      value: String(t.priority),
    });
    priIn.addEventListener("change", () => {
      patch((s) => {
        s.tasks.find((x) => x.id === t.id).priority = Number(priIn.value);
      });
    });
    tr.appendChild(el("td")).appendChild(priIn);

    const sel = el("select", { id: "res-" + t.id, "aria-label": "Resource for " + t.id });
    sel.appendChild(el("option", { value: "", text: t.duration === 0 ? "(milestone)" : "(unassigned)" }));
    for (const r of source.resources) {
      const opt = el("option", { value: r.id, text: r.id + " " + r.name });
      if (t.resourceId === r.id) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.disabled = t.duration === 0;
    sel.addEventListener("change", () => {
      patch((s) => {
        s.tasks.find((x) => x.id === t.id).resourceId = sel.value || null;
      });
    });
    tr.appendChild(el("td")).appendChild(sel);

    tr.appendChild(el("td", { class: "mono", text: t.predecessors.join(", ") || "—" }));
    tr.appendChild(el("td", { class: "mono", text: "[" + t.start + "," + t.finish + ")" }));
    tr.appendChild(el("td", { class: "mono", text: String(t.float) }));
    tb.appendChild(tr);
  }
}

function dateForOffset(off) {
  const dates = compiled.calendar.dates;
  return dates[off] || "";
}

function ganttGeometry(plan) {
  const days = spanDays(plan);
  const rows = plan.tasks.length || 1;
  const w = LABEL_W + days * dayWidth + 24;
  const h = HEAD_H + rows * ROW_H + 16;
  return { days, rows, w, h };
}

function drawAxis(root, plan, days) {
  const breaks = new Set(plan.calendar.weekendBreakAfter || []);
  for (let i = 0; i < days; i++) {
    const x = LABEL_W + i * dayWidth;
    if (breaks.has(i)) {
      const mark = svg("rect", {
        x: x + dayWidth - 3,
        y: 0,
        width: 6,
        height: HEAD_H + (plan.tasks.length || 1) * ROW_H,
        fill: "rgba(26,18,12,0.12)",
      });
      mark.setAttribute("data-weekend-break", String(i));
      root.appendChild(mark);
    }
    const tick = svg("line", {
      x1: x,
      y1: HEAD_H - 8,
      x2: x,
      y2: HEAD_H,
      stroke: "#1a120c",
      "stroke-width": breaks.has(i) ? 2.4 : 1,
    });
    root.appendChild(tick);
    const iso = plan.calendar.dates[i];
    if (!iso) continue;
    const lab = iso.slice(5);
    const show = i === 0 || iso.slice(8) === "01" || (plan.calendar.dates[i] && compiled.calendar && true);
    const isMon = i === 0 || (plan.calendar.weekendBreakAfter || []).includes(i - 1);
    if (isMon || i % 5 === 0) {
      const t = svg("text", {
        x: x + 2,
        y: 14,
        fill: "#1a120c",
        "font-size": "10",
        "font-family": "ui-monospace, monospace",
      });
      t.textContent = lab;
      root.appendChild(t);
    }
    const n = svg("text", {
      x: x + 2,
      y: 28,
      fill: "#4a3c2e",
      "font-size": "9",
      "font-family": "ui-monospace, monospace",
    });
    n.textContent = String(i);
    root.appendChild(n);
    void show;
  }
}

function edgePath(plan, fromId, toId, indexMap) {
  const a = plan.taskById[fromId];
  const b = plan.taskById[toId];
  if (!a || !b) return null;
  const y1 = HEAD_H + indexMap[fromId] * ROW_H + ROW_H / 2;
  const y2 = HEAD_H + indexMap[toId] * ROW_H + ROW_H / 2;
  const x1 = LABEL_W + a.finish * dayWidth;
  const x2 = LABEL_W + b.start * dayWidth;
  const m = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}`;
}

function renderGantt() {
  const plan = visiblePlan();
  const host = $("gantt-svg-host");
  const scroll = $("gantt-scroll");
  const savedLeft = scroll.scrollLeft;
  const savedTop = scroll.scrollTop;
  host.replaceChildren();
  if (!plan || plan.ok === false) {
    host.appendChild(el("p", { class: "empty", text: "No valid preview." }));
    return;
  }
  const { days, w, h } = ganttGeometry(plan);
  const svgRoot = svg("svg", {
    class: "gantt",
    width: String(w),
    height: String(h),
    viewBox: "0 0 " + w + " " + h,
    role: "img",
    "aria-label": "Gantt chart of scheduled tasks",
  });
  const bg = svg("rect", { x: 0, y: 0, width: w, height: h, fill: "#fbf4e6" });
  svgRoot.appendChild(bg);
  drawAxis(svgRoot, plan, days);
  const indexMap = {};
  plan.tasks.forEach((t, i) => {
    indexMap[t.id] = i;
  });
  const critSet = new Set((plan.criticalEdges || []).map((e) => e.from + "→" + e.to));
  for (const t of plan.tasks) {
    for (const p of t.predecessors) {
      const d = edgePath(plan, p, t.id, indexMap);
      if (!d) continue;
      const crit = showCritical && critSet.has(p + "→" + t.id);
      const path = svg("path", {
        d,
        fill: "none",
        stroke: crit ? "#9b1c12" : "#7a6a55",
        "stroke-width": crit ? 2.4 : 1.2,
        "stroke-dasharray": crit ? "0" : "4 3",
        "marker-end": "url(#arrow)",
        "data-edge": p + "→" + t.id,
      });
      svgRoot.appendChild(path);
    }
  }
  const defs = svg("defs");
  const marker = svg("marker", { id: "arrow", markerWidth: "8", markerHeight: "8", refX: "7", refY: "4", orient: "auto" });
  marker.appendChild(svg("path", { d: "M0,0 L8,4 L0,8 z", fill: "#7a6a55" }));
  defs.appendChild(marker);
  svgRoot.insertBefore(defs, svgRoot.firstChild);

  plan.tasks.forEach((t, i) => {
    const y = HEAD_H + i * ROW_H;
    const lab = svg("text", {
      x: 8,
      y: y + 20,
      fill: "#1a120c",
      "font-size": "11",
      "font-family": "ui-monospace, monospace",
    });
    lab.textContent = t.id;
    svgRoot.appendChild(lab);
    const rowBg = svg("rect", {
      x: LABEL_W,
      y: y,
      width: days * dayWidth,
      height: ROW_H,
      fill: t.id === selectedId ? "rgba(184,134,11,0.12)" : i % 2 ? "rgba(26,18,12,0.03)" : "transparent",
    });
    svgRoot.appendChild(rowBg);
    const x = LABEL_W + t.start * dayWidth;
    const g = svg("g", { "data-task": t.id, class: "gantt-item" });
    if (t.duration === 0) {
      const cx = x;
      const cy = y + ROW_H / 2;
      const dia = svg("polygon", {
        points: `${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`,
        fill: "#1a120c",
        stroke: t.id === selectedId ? "#b8860b" : "#fbf4e6",
        "stroke-width": t.id === selectedId || (showCritical && t.zeroFloat) ? 3 : 1,
        "data-task": t.id,
        role: "img",
        "aria-label": "Milestone " + t.id,
      });
      g.appendChild(dia);
    } else {
      const bw = Math.max(t.duration * dayWidth, 4);
      const bar = svg("rect", {
        x,
        y: y + 6,
        width: bw,
        height: ROW_H - 12,
        rx: 2,
        fill: colorHex(t),
        stroke: showCritical && t.zeroFloat ? "#9b1c12" : t.id === selectedId ? "#b8860b" : "rgba(255,255,255,0.35)",
        "stroke-width": showCritical && t.zeroFloat ? 3 : t.id === selectedId ? 2.5 : 1,
        "data-task": t.id,
        role: "img",
        "aria-label": "Task " + t.id + " interval " + t.start + " to " + t.finish,
      });
      g.appendChild(bar);
      if (bw > 36) {
        const tx = svg("text", {
          x: x + 4,
          y: y + 20,
          fill: "#fbf4e6",
          "font-size": "10",
          "font-family": "ui-monospace, monospace",
          "pointer-events": "none",
        });
        tx.textContent = t.id;
        g.appendChild(tx);
      }
    }
    g.style.cursor = "ew-resize";
    g.addEventListener("pointerdown", (ev) => onBarDown(ev, t.id));
    g.addEventListener("click", (ev) => {
      ev.stopPropagation();
      selectTask(t.id);
    });
    svgRoot.appendChild(g);
  });
  if (!plan.tasks.length) {
    const empty = svg("text", { x: LABEL_W + 12, y: HEAD_H + 28, fill: "#4a3c2e", "font-size": "14" });
    empty.textContent = "Empty plan — completion offset 0.";
    svgRoot.appendChild(empty);
  }
  host.appendChild(svgRoot);
  scroll.scrollLeft = savedLeft;
  scroll.scrollTop = savedTop;
}

function onBarDown(ev, id) {
  ev.preventDefault();
  ev.stopPropagation();
  selectedId = id;
  const task = compiled.taskById[id];
  drag = {
    id,
    pointerId: ev.pointerId,
    originX: ev.clientX,
    originStart: task.start,
    originNotBefore: task.notBefore,
    request: null,
    requestDate: null,
    moved: false,
  };
  ev.currentTarget.setPointerCapture(ev.pointerId);
  document.addEventListener("pointermove", onBarMove, true);
  document.addEventListener("pointerup", onBarUp, true);
  document.addEventListener("pointercancel", onBarUp, true);
  renderBanners();
}

function onBarMove(ev) {
  if (!drag) return;
  const delta = Math.round((ev.clientX - drag.originX) / dayWidth);
  if (delta !== 0) drag.moved = true;
  const req = Math.max(0, drag.originStart + delta);
  drag.request = req;
  drag.requestDate = dateForOffset(req);
  const next = clone(source);
  const row = next.tasks.find((t) => t.id === drag.id);
  row.notBefore = drag.requestDate || compiled.calendar.start;
  preview = compile(next);
  renderGantt();
  renderBanners();
  renderSummary();
  syncPps();
}

function cancelDrag() {
  if (!drag) return;
  drag = null;
  preview = null;
  document.removeEventListener("pointermove", onBarMove, true);
  document.removeEventListener("pointerup", onBarUp, true);
  document.removeEventListener("pointercancel", onBarUp, true);
  render();
}

function onBarUp(ev) {
  if (!drag) return;
  const d = drag;
  document.removeEventListener("pointermove", onBarMove, true);
  document.removeEventListener("pointerup", onBarUp, true);
  document.removeEventListener("pointercancel", onBarUp, true);
  if (ev && ev.type === "pointercancel") {
    drag = null;
    preview = null;
    noticeMsg = "Drag cancelled. Plan and history unchanged.";
    render();
    return;
  }
  if (!d.moved) {
    drag = null;
    preview = null;
    selectTask(d.id);
    return;
  }
  const next = clone(source);
  const row = next.tasks.find((t) => t.id === d.id);
  row.notBefore = d.requestDate || compiled.calendar.start;
  drag = null;
  const ok = commit(next);
  if (!ok) {
    preview = null;
    render();
  }
}

function renderResources() {
  const plan = compiled;
  const host = $("resource-body");
  host.replaceChildren();
  if (!plan.resources.length && !plan.tasks.length) {
    host.appendChild(el("p", { class: "empty", text: "No resources and no tasks." }));
    return;
  }
  for (const r of plan.resources) {
    const lane = el("div", { class: "lane", dataset: { resource: r.id } });
    const head = el("h3");
    head.appendChild(document.createTextNode(r.id + " · " + r.name + " · capacity "));
    const cap = el("input", {
      type: "number",
      min: "1",
      max: "4",
      step: "1",
      value: String(r.capacity),
      id: "cap-" + r.id,
      "aria-label": "Capacity for " + r.id,
    });
    cap.addEventListener("change", () => {
      patch((s) => {
        s.resources.find((x) => x.id === r.id).capacity = Number(cap.value);
      });
    });
    head.appendChild(cap);
    const del = el("button", { class: "secondary", type: "button", text: "Delete " + r.id });
    del.addEventListener("click", () => {
      const users = source.tasks.filter((t) => t.resourceId === r.id);
      if (users.length) {
        showError("Cannot delete resource " + r.id + " while it is assigned to " + users.map((u) => u.id).join(", ") + ".");
        return;
      }
      patch((s) => {
        s.resources = s.resources.filter((x) => x.id !== r.id);
      });
    });
    head.appendChild(del);
    lane.appendChild(head);
    const days = plan.occupancy[r.id] || [];
    if (!days.length) {
      lane.appendChild(el("p", { class: "tiny", text: "No occupied days on this resource." }));
    }
    const row = el("div");
    for (const d of days) {
      const cell = el("div", { class: "res-day" + (d.used > d.capacity ? " over" : "") });
      cell.appendChild(el("div", { class: "tiny", text: d.offset + " · " + d.date.slice(5) + " · " + d.used + "/" + d.capacity }));
      if (!d.taskIds.length) {
        cell.appendChild(el("div", { class: "tiny", text: "free" }));
      }
      for (const tid of d.taskIds) {
        const b = el("button", { class: "res-slot" + (tid === selectedId ? " sel" : ""), type: "button", text: tid });
        b.addEventListener("click", () => selectTask(tid));
        cell.appendChild(b);
      }
      row.appendChild(cell);
    }
    lane.appendChild(row);
    host.appendChild(lane);
  }
  const un = plan.tasks.filter((t) => t.duration > 0 && !t.resourceId);
  const box = el("div", { class: "lane" });
  box.appendChild(el("h3", { text: "Unassigned tasks (no capacity limit)" }));
  if (!un.length) box.appendChild(el("p", { class: "tiny", text: "None. Unassigned work can overlap freely." }));
  else {
    for (const t of un) {
      const b = el("button", { class: "secondary", type: "button", text: t.id + " [" + t.start + "," + t.finish + ")" });
      b.addEventListener("click", () => selectTask(t.id));
      box.appendChild(b);
    }
  }
  host.appendChild(box);
}

function renderInspector() {
  const host = $("inspector-body");
  host.replaceChildren();
  const t = selectedId ? compiled.taskById[selectedId] : null;
  if (!t) {
    host.appendChild(el("p", { class: "empty", text: "Select a task in the table, Gantt, or a resource slot to inspect why it starts when it does." }));
    return;
  }
  const exp = compiled.explanations[t.id];
  host.appendChild(el("h3", { text: t.id + " · " + t.name }));
  const chips = el("div");
  if (t.zeroFloat) chips.appendChild(el("span", { class: "chip crit", text: "dependency-only zero float" }));
  if (exp && exp.delayKinds.includes("resource") && t.start > exp.candidate) {
    chips.appendChild(el("span", { class: "chip wait", text: "resource waiting" }));
  }
  if (exp && exp.notBeforeBound != null && exp.notBeforeBound > exp.predBound) {
    chips.appendChild(el("span", { class: "chip wait", text: "not-before constraint" }));
  }
  host.appendChild(chips);

  const dl = el("dl", { class: "inspector" });
  function item(dt, dd) {
    dl.appendChild(el("dt", { text: dt }));
    const d = el("dd");
    if (typeof dd === "string") d.textContent = dd;
    else d.appendChild(dd);
    dl.appendChild(d);
  }
  item("Chosen start", t.start + " · " + t.startDate);
  item("Exclusive finish", t.finish + " · " + t.finishDate);
  item("Last working date", t.lastWorkDate || "(milestone — none)");
  item("Predecessor bound", String(exp.predBound) + (exp.predFinishes.length ? " from " + exp.predFinishes.map((p) => p.id + "=" + p.finish).join(", ") : " (root / offset 0)"));
  item("Not-before bound", exp.notBeforeBound == null ? "None" : String(exp.notBeforeBound) + " · " + (t.notBefore || ""));
  item("Candidate boundary", String(exp.candidate) + " = max(0, not-before, predecessor finishes)");
  item("Dependency-only ES/EF", t.es + "–" + t.ef);
  item("Dependency-only LS/LF", t.ls + "–" + t.lf);
  item("Dependency-only total float", String(t.float) + " (not resource-constrained float)");
  if (exp.blockedIntervals && exp.blockedIntervals.length) {
    item(
      "Resource blocking intervals",
      exp.blockedIntervals.map((b) => "[" + b.start + "," + b.finish + ") " + b.taskIds.join(", ")).join("; ")
    );
  } else if (t.resourceId) {
    item("Resource blocking intervals", "None between candidate and chosen start on " + t.resourceId + ".");
  } else {
    item("Resource blocking intervals", t.duration === 0 ? "Milestones occupy no capacity." : "Unassigned — no slot search.");
  }
  if (t.start > t.es) {
    const reasons = [];
    if (exp.notBeforeBound != null && exp.notBeforeBound > t.es) reasons.push("a not-before date constraint");
    if (t.start > exp.candidate) reasons.push("resource occupancy");
    item("Why later than dependency-only ES", reasons.length ? "Delayed by " + reasons.join(" and ") + "." : "Other source constraints.");
  }
  host.appendChild(dl);

  const nbLab = el("label", { class: "field" });
  nbLab.appendChild(el("span", { text: "Not-before date" }));
  const nb = el("input", {
    type: "date",
    id: "not-before",
    min: LIMITS.MIN_DATE,
    max: LIMITS.MAX_DATE,
    "aria-label": "Not-before date for " + t.id,
  });
  if (t.notBefore) nb.value = t.notBefore;
  nb.addEventListener("change", () => {
    patch((s) => {
      s.tasks.find((x) => x.id === t.id).notBefore = nb.value || null;
    });
  });
  nbLab.appendChild(nb);
  host.appendChild(nbLab);
  const clear = el("button", { class: "secondary", type: "button", text: "Clear date constraint" });
  clear.addEventListener("click", () => {
    patch((s) => {
      s.tasks.find((x) => x.id === t.id).notBefore = null;
    });
  });
  host.appendChild(clear);

  host.appendChild(el("h3", { text: "Predecessors (finish-to-start)" }));
  const list = el("div", { class: "pred-list" });
  for (const o of compiled.tasks) {
    if (o.id === t.id) continue;
    const lab = el("label");
    const ck = el("input", { type: "checkbox" });
    ck.checked = t.predecessors.includes(o.id);
    ck.setAttribute("aria-label", "Predecessor " + o.id + " of " + t.id);
    ck.addEventListener("change", () => {
      patch((s) => {
        const row = s.tasks.find((x) => x.id === t.id);
        const set = new Set(row.predecessors);
        if (ck.checked) set.add(o.id);
        else set.delete(o.id);
        row.predecessors = Array.from(set);
      });
    });
    lab.appendChild(ck);
    lab.appendChild(document.createTextNode(o.id + " " + o.name));
    list.appendChild(lab);
  }
  host.appendChild(list);

  const del = el("button", { class: "danger", type: "button", text: "Delete " + t.id });
  del.addEventListener("click", () => askDeleteTask(t.id));
  host.appendChild(del);
}

function askDeleteTask(id) {
  const dependents = source.tasks.filter((t) => t.predecessors.includes(id));
  if (!dependents.length) {
    patch((s) => {
      s.tasks = s.tasks.filter((t) => t.id !== id);
    });
    if (selectedId === id) selectedId = null;
    return;
  }
  modal = { type: "delete", id, dependents: dependents.map((d) => d.id) };
  renderModal();
}

function renderModal() {
  const wrap = $("modal-root");
  wrap.replaceChildren();
  if (!modal) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const back = el("div", { class: "modal-back", role: "dialog", "aria-modal": "true" });
  const box = el("div", { class: "modal" });
  if (modal.type === "delete") {
    box.appendChild(el("h3", { text: "Delete " + modal.id + "?" }));
    box.appendChild(
      el("p", {
        text:
          modal.id +
          " is a predecessor of " +
          modal.dependents.join(", ") +
          ". Delete the task and remove those edges, or cancel. Undo will restore the task and the edges.",
      })
    );
    const actions = el("div", { class: "modal-actions" });
    const cancel = el("button", { class: "secondary", type: "button", text: "Cancel deletion" });
    cancel.addEventListener("click", () => {
      modal = null;
      renderModal();
    });
    const go = el("button", { class: "danger", type: "button", text: "Delete and remove edges" });
    go.addEventListener("click", () => {
      const id = modal.id;
      modal = null;
      patch((s) => {
        s.tasks.forEach((t) => {
          t.predecessors = t.predecessors.filter((p) => p !== id);
        });
        s.tasks = s.tasks.filter((t) => t.id !== id);
      });
      if (selectedId === id) selectedId = null;
      renderModal();
    });
    actions.appendChild(cancel);
    actions.appendChild(go);
    box.appendChild(actions);
  } else if (modal.type === "task") {
    box.appendChild(el("h3", { text: modal.milestone ? "Add milestone" : "Add task" }));
    const idDef = nextId(modal.milestone ? "M" : "T", source.tasks.map((t) => t.id));
    const fields = [
      ["new-id", "ID", "text", idDef],
      ["new-name", "Name", "text", modal.milestone ? "Milestone" : "New task"],
      ["new-dur", "Duration (working days)", "number", modal.milestone ? "0" : "1"],
      ["new-pri", "Priority", "number", "0"],
    ];
    for (const [id, lab, type, val] of fields) {
      const row = el("div", { class: "row field" });
      row.appendChild(el("label", { for: id, text: lab }));
      const inp = el("input", { id, type, value: val });
      if (type === "number") {
        inp.min = id === "new-pri" ? "0" : "0";
        inp.max = id === "new-pri" ? String(LIMITS.MAX_PRIORITY) : String(LIMITS.MAX_DURATION);
      }
      if (modal.milestone && id === "new-dur") inp.readOnly = true;
      row.appendChild(inp);
      box.appendChild(row);
    }
    if (!modal.milestone) {
      const row = el("div", { class: "row field" });
      row.appendChild(el("label", { for: "new-res", text: "Resource" }));
      const sel = el("select", { id: "new-res" });
      sel.appendChild(el("option", { value: "", text: "(unassigned)" }));
      for (const r of source.resources) sel.appendChild(el("option", { value: r.id, text: r.id + " " + r.name }));
      row.appendChild(sel);
      box.appendChild(row);
    }
    const actions = el("div", { class: "modal-actions" });
    const cancel = el("button", { class: "secondary", type: "button", text: "Cancel" });
    cancel.addEventListener("click", () => {
      modal = null;
      renderModal();
    });
    const go = el("button", { type: "button", text: modal.milestone ? "Create milestone" : "Create task" });
    go.addEventListener("click", () => {
      const id = $("new-id").value.trim();
      const name = $("new-name").value;
      const duration = Number($("new-dur").value);
      const priority = Number($("new-pri").value);
      const resourceId = modal.milestone ? null : $("new-res").value || null;
      const next = clone(source);
      next.tasks.push({ id, name, duration, priority, resourceId, predecessors: [], notBefore: null });
      modal = null;
      if (commit(next)) {
        selectedId = id;
      }
      renderModal();
    });
    actions.appendChild(cancel);
    actions.appendChild(go);
    box.appendChild(actions);
  } else if (modal.type === "resource") {
    box.appendChild(el("h3", { text: "Add resource" }));
    const idDef = nextId("R", source.resources.map((r) => r.id));
    for (const [id, lab, val] of [
      ["nr-id", "ID", idDef],
      ["nr-name", "Name", "Resource"],
    ]) {
      const row = el("div", { class: "row field" });
      row.appendChild(el("label", { for: id, text: lab }));
      row.appendChild(el("input", { id, type: "text", value: val }));
      box.appendChild(row);
    }
    const row = el("div", { class: "row field" });
    row.appendChild(el("label", { for: "nr-cap", text: "Capacity (1–4)" }));
    row.appendChild(el("input", { id: "nr-cap", type: "number", min: "1", max: "4", value: "1" }));
    box.appendChild(row);
    const actions = el("div", { class: "modal-actions" });
    const cancel = el("button", { class: "secondary", type: "button", text: "Cancel" });
    cancel.addEventListener("click", () => {
      modal = null;
      renderModal();
    });
    const go = el("button", { type: "button", text: "Create resource" });
    go.addEventListener("click", () => {
      const next = clone(source);
      next.resources.push({
        id: $("nr-id").value.trim(),
        name: $("nr-name").value,
        capacity: Number($("nr-cap").value),
      });
      modal = null;
      commit(next);
      renderModal();
    });
    actions.appendChild(cancel);
    actions.appendChild(go);
    box.appendChild(actions);
  }
  back.appendChild(box);
  back.addEventListener("click", (e) => {
    if (e.target === back && modal && modal.type !== "delete") {
      modal = null;
      renderModal();
    }
  });
  wrap.appendChild(back);
  const focus = box.querySelector("input, button");
  if (focus) focus.focus();
}

function exportSvgString() {
  const plan = compiled;
  const dw = dayWidth;
  const { days, w, h } = ganttGeometry(plan);
  const extra = 90;
  const parts = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + extra}" viewBox="0 0 ${w} ${h + extra}" font-family="ui-monospace, monospace">`
  );
  parts.push(`<rect width="100%" height="100%" fill="#fbf4e6"/>`);
  const title = plan.source ? source.project.name : source.project.name;
  parts.push(`<text x="12" y="22" font-size="16" fill="#1a120c">${escapeXml(title)} — Gantt</text>`);
  parts.push(
    `<text x="12" y="40" font-size="11" fill="#4a3c2e">Start ${source.project.startDate} · actual completion ${plan.actualCompletion} (${plan.actualCompletionDate}) · dependency-only ${plan.cpmCompletion}</text>`
  );
  const yOff = 50;
  const breaks = new Set(plan.calendar.weekendBreakAfter || []);
  for (let i = 0; i < days; i++) {
    const x = LABEL_W + i * dw;
    if (breaks.has(i)) {
      parts.push(`<rect x="${x + dw - 3}" y="${yOff}" width="6" height="${HEAD_H + plan.tasks.length * ROW_H}" fill="rgba(26,18,12,0.12)"/>`);
    }
    const iso = plan.calendar.dates[i] || "";
    const isMon = i === 0 || breaks.has(i - 1);
    if (isMon) parts.push(`<text x="${x + 2}" y="${yOff + 14}" font-size="10" fill="#1a120c">${escapeXml(iso.slice(5))}</text>`);
    parts.push(`<text x="${x + 2}" y="${yOff + 28}" font-size="9" fill="#4a3c2e">${i}</text>`);
  }
  const indexMap = {};
  plan.tasks.forEach((t, i) => {
    indexMap[t.id] = i;
  });
  for (const t of plan.tasks) {
    for (const p of t.predecessors) {
      const a = plan.taskById[p];
      const b = t;
      const y1 = yOff + HEAD_H + indexMap[p] * ROW_H + ROW_H / 2;
      const y2 = yOff + HEAD_H + indexMap[t.id] * ROW_H + ROW_H / 2;
      const x1 = LABEL_W + a.finish * dw;
      const x2 = LABEL_W + b.start * dw;
      const m = (x1 + x2) / 2;
      parts.push(`<path d="M ${x1} ${y1} C ${m} ${y1}, ${m} ${y2}, ${x2} ${y2}" fill="none" stroke="#7a6a55" stroke-width="1.2"/>`);
    }
  }
  plan.tasks.forEach((t, i) => {
    const y = yOff + HEAD_H + i * ROW_H;
    parts.push(`<text x="8" y="${y + 20}" font-size="11" fill="#1a120c">${escapeXml(t.id)} ${escapeXml(t.name)}</text>`);
    const x = LABEL_W + t.start * dw;
    if (t.duration === 0) {
      const cy = y + ROW_H / 2;
      parts.push(`<polygon points="${x},${cy - 8} ${x + 8},${cy} ${x},${cy + 8} ${x - 8},${cy}" fill="#1a120c"/>`);
      parts.push(`<text x="${x + 12}" y="${y + 20}" font-size="10" fill="#1a120c">${escapeXml(t.startDate)}</text>`);
    } else {
      const bw = Math.max(t.duration * dw, 4);
      parts.push(`<rect x="${x}" y="${y + 6}" width="${bw}" height="${ROW_H - 12}" rx="2" fill="${colorHex(t)}"/>`);
      parts.push(
        `<text x="${x + 4}" y="${y + 20}" font-size="10" fill="#fbf4e6">${escapeXml(t.id)} ${escapeXml(t.startDate)}–${escapeXml(t.lastWorkDate)} fin ${escapeXml(t.finishDate)}</text>`
      );
    }
  });
  const ly = h + extra - 28;
  parts.push(`<text x="12" y="${ly}" font-size="11" fill="#1a120c">Legend:</text>`);
  parts.push(`<rect x="72" y="${ly - 12}" width="22" height="12" fill="#1f4f45"/>`);
  parts.push(`<text x="98" y="${ly}" font-size="11">task bar (occupied [start, finish))</text>`);
  parts.push(`<polygon points="280,${ly - 6} 288,${ly} 280,${ly + 6} 272,${ly}" fill="#1a120c"/>`);
  parts.push(`<text x="294" y="${ly}" font-size="11">milestone</text>`);
  parts.push(`<rect x="380" y="${ly - 12}" width="8" height="14" fill="rgba(26,18,12,0.2)"/>`);
  parts.push(`<text x="394" y="${ly}" font-size="11">weekend break after Friday</text>`);
  parts.push(`<line x1="560" y1="${ly - 6}" x2="600" y2="${ly - 6}" stroke="#7a6a55"/>`);
  parts.push(`<text x="606" y="${ly}" font-size="11">finish-to-start dependency</text>`);
  parts.push(`</svg>`);
  return parts.join("");
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function importJsonText(text) {
  const result = parseProjectJson(text);
  if (!result.ok) {
    showError(result.error);
    return;
  }
  undoStack.push(clone(source));
  if (undoStack.length > 120) undoStack.shift();
  redoStack = [];
  source = result.source;
  compiled = result;
  noticeMsg = "Imported JSON. Schedule recomputed from source (cached intervals ignored)." + (result.notices.length ? " " + result.notices.join(" ") : "");
  errorMsg = "";
  preview = null;
  render();
}

function render() {
  document.body.dataset.view = viewName;
  const ae = document.activeElement;
  const focusId = ae && ae.id;
  const selStart = ae && typeof ae.selectionStart === "number" ? ae.selectionStart : null;
  renderSummary();
  renderBanners();
  renderTable();
  renderGantt();
  renderResources();
  renderInspector();
  renderModal();
  if (focusId) {
    const n = document.getElementById(focusId);
    if (n) {
      n.focus();
      if (selStart != null && n.setSelectionRange) {
        try {
          n.setSelectionRange(selStart, selStart);
        } catch (e) {}
      }
    }
  }
  syncPps();
}

function syncPps() {
  window.PPS = {
    source,
    plan: compiled,
    preview,
    undo: undoStack.length,
    redo: redoStack.length,
    selectedId,
    limits: LIMITS,
  };
}

function bind() {
  $("project-name").addEventListener("change", () => {
    patch((s) => {
      s.project.name = $("project-name").value;
    });
  });
  $("project-start").addEventListener("change", () => {
    patch((s) => {
      s.project.startDate = $("project-start").value;
    });
  });
  $("btn-reset").addEventListener("click", resetPlan);
  $("btn-undo").addEventListener("click", undo);
  $("btn-redo").addEventListener("click", redo);
  $("btn-add-task").addEventListener("click", () => {
    modal = { type: "task", milestone: false };
    renderModal();
  });
  $("btn-add-mile").addEventListener("click", () => {
    modal = { type: "task", milestone: true };
    renderModal();
  });
  $("btn-add-res").addEventListener("click", () => {
    modal = { type: "resource" };
    renderModal();
  });
  $("chk-critical").addEventListener("change", () => {
    showCritical = $("chk-critical").checked;
    render();
  });
  $("zoom").addEventListener("input", () => {
    dayWidth = Number($("zoom").value);
    renderGantt();
  });
  $("btn-export-json").addEventListener("click", () => {
    download("plan.json", "application/json", JSON.stringify(toExportJson(source), null, 2));
  });
  $("btn-export-csv").addEventListener("click", () => {
    download("schedule.csv", "text/csv", toCsv(compiled));
  });
  $("btn-export-svg").addEventListener("click", () => {
    download("gantt.svg", "image/svg+xml", exportSvgString());
  });
  $("import-file").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => importJsonText(String(reader.result || ""));
    reader.readAsText(f);
  });
  $("btn-import-file").addEventListener("click", () => $("import-file").click());
  $("btn-import-text").addEventListener("click", () => importJsonText($("import-text").value));
  document.querySelectorAll(".view-tabs button").forEach((b) => {
    b.addEventListener("click", () => {
      viewName = b.getAttribute("data-view");
      document.querySelectorAll(".view-tabs button").forEach((x) => x.removeAttribute("aria-current"));
      b.setAttribute("aria-current", "page");
      render();
    });
  });
  const scroll = $("gantt-scroll");
  scroll.addEventListener("pointerdown", (ev) => {
    if (drag) return;
    if (ev.target.closest(".gantt-item")) return;
    pan = { x: ev.clientX, y: ev.clientY, sl: scroll.scrollLeft, st: scroll.scrollTop };
    scroll.classList.add("dragging");
    scroll.setPointerCapture(ev.pointerId);
  });
  scroll.addEventListener("pointermove", (ev) => {
    if (!pan || drag) return;
    scroll.scrollLeft = pan.sl - (ev.clientX - pan.x);
    scroll.scrollTop = pan.st - (ev.clientY - pan.y);
  });
  scroll.addEventListener("pointerup", () => {
    pan = null;
    scroll.classList.remove("dragging");
  });
  scroll.addEventListener(
    "wheel",
    (ev) => {
      if (ev.ctrlKey) {
        ev.preventDefault();
        const z = $("zoom");
        const next = Math.min(48, Math.max(12, Number(z.value) + (ev.deltaY > 0 ? -2 : 2)));
        z.value = String(next);
        dayWidth = next;
        renderGantt();
      } else if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
        scroll.scrollLeft += ev.deltaY;
      }
    },
    { passive: false }
  );
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (drag) {
        e.preventDefault();
        cancelDrag();
        noticeMsg = "Drag cancelled. Plan and history unchanged.";
        render();
      } else if (modal && modal.type !== "delete") {
        modal = null;
        renderModal();
      }
    }
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });
  window.addEventListener("resize", () => {
    renderGantt();
  });
}

bind();
render();
