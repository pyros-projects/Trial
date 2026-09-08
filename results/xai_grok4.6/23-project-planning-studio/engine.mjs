export const LIMITS = {
  MIN_DATE: "2000-01-01",
  MAX_DATE: "2099-12-31",
  MIN_OFFSET: 0,
  MAX_OFFSET: 2600,
  MIN_DURATION: 0,
  MAX_DURATION: 260,
  MIN_PRIORITY: 0,
  MAX_PRIORITY: 9999,
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 4,
  MAX_TASKS: 200,
  MAX_RESOURCES: 16,
  MAX_NAME_LENGTH: 400,
  MAX_PRED: 200,
  ID_RE: /^[A-Za-z0-9_-]+$/,
};

const DIM = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y, m) {
  return m === 2 && isLeap(y) ? 29 : DIM[m];
}

export function parseYMD(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > daysInMonth(y, m)) return null;
  const iso = fmtYMD(y, m, d);
  if (iso < LIMITS.MIN_DATE || iso > LIMITS.MAX_DATE) return null;
  return { y, m, d, iso };
}

export function fmtYMD(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function dow(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let yy = y;
  if (m < 3) yy -= 1;
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7;
}

export function isWeekend(date) {
  const w = dow(date.y, date.m, date.d);
  return w === 0 || w === 6;
}

export function addCalendarDays(date, n) {
  let { y, m, d } = date;
  let left = n;
  const step = left >= 0 ? 1 : -1;
  left = Math.abs(left);
  while (left > 0) {
    d += step;
    if (d > daysInMonth(y, m)) {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    } else if (d < 1) {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      d = daysInMonth(y, m);
    }
    left -= 1;
  }
  const iso = fmtYMD(y, m, d);
  return { y, m, d, iso };
}

export function normalizeToMonday(date) {
  const w = dow(date.y, date.m, date.d);
  if (w === 6) return { date: addCalendarDays(date, 2), shifted: true, from: date.iso };
  if (w === 0) return { date: addCalendarDays(date, 1), shifted: true, from: date.iso };
  return { date, shifted: false, from: date.iso };
}

function inSupportedRange(date) {
  return date.iso >= LIMITS.MIN_DATE && date.iso <= LIMITS.MAX_DATE;
}

export function addWorkingDays(date, n) {
  if (n === 0) return { ok: true, date };
  if (n < 0) return { ok: false, error: "Negative working-day offset is not supported." };
  let cur = date;
  let left = n;
  while (left > 0) {
    cur = addCalendarDays(cur, 1);
    if (!inSupportedRange(cur) && dow(cur.y, cur.m, cur.d) !== 0 && dow(cur.y, cur.m, cur.d) !== 6) {
      return { ok: false, error: `Derived date ${cur.iso} is outside ${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}.` };
    }
    if (cur.y > 2100) {
      return { ok: false, error: `Derived date exceeds ${LIMITS.MAX_DATE}.` };
    }
    const w = dow(cur.y, cur.m, cur.d);
    if (w !== 0 && w !== 6) {
      left -= 1;
      if (!inSupportedRange(cur)) {
        return { ok: false, error: `Derived date ${cur.iso} is outside ${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}.` };
      }
    }
  }
  if (!inSupportedRange(cur)) {
    return { ok: false, error: `Derived date ${cur.iso} is outside ${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}.` };
  }
  return { ok: true, date: cur };
}

export function workingDayOffset(start, target) {
  if (target.iso <= start.iso) return 0;
  let cur = start;
  let off = 0;
  while (cur.iso < target.iso) {
    cur = addCalendarDays(cur, 1);
    if (!inSupportedRange(cur) && dow(cur.y, cur.m, cur.d) !== 0 && dow(cur.y, cur.m, cur.d) !== 6) {
      return null;
    }
    const w = dow(cur.y, cur.m, cur.d);
    if (w !== 0 && w !== 6) {
      off += 1;
      if (off > LIMITS.MAX_OFFSET + 1) return off;
    }
    if (cur.y > 2101) return null;
  }
  return off;
}

export function isSafeInt(n) {
  return typeof n === "number" && Number.isSafeInteger(n);
}

function fail(error) {
  return { ok: false, error };
}

export function cloneSource(src) {
  return JSON.parse(JSON.stringify(src));
}

export function seedSource() {
  return {
    project: { name: "Studio Launch", startDate: "2026-09-07" },
    resources: [
      { id: "R1", name: "Studio", capacity: 1 },
      { id: "R2", name: "Review", capacity: 1 },
    ],
    tasks: [
      { id: "T1", name: "Design", duration: 2, priority: 1, resourceId: "R1", predecessors: [], notBefore: null },
      { id: "T2", name: "Build", duration: 3, priority: 2, resourceId: "R1", predecessors: ["T1"], notBefore: null },
      { id: "T3", name: "Documentation", duration: 2, priority: 3, resourceId: "R1", predecessors: ["T1"], notBefore: null },
      { id: "T4", name: "Review", duration: 1, priority: 4, resourceId: "R2", predecessors: ["T2", "T3"], notBefore: null },
      { id: "T5", name: "Launch", duration: 0, priority: 5, resourceId: null, predecessors: ["T4"], notBefore: null },
    ],
  };
}

function checkId(id, kind) {
  if (typeof id !== "string" || id.length === 0) {
    return `${kind} ID is empty.`;
  }
  if (id.length > 64) return `${kind} ID "${id}" is longer than 64 characters.`;
  if (!LIMITS.ID_RE.test(id)) {
    return `${kind} ID "${id}" must use ASCII letters, digits, underscores, or hyphens.`;
  }
  return null;
}

function checkName(name, kind, id) {
  if (typeof name !== "string") return `${kind} ${id}: name must be a string.`;
  if (name.length > LIMITS.MAX_NAME_LENGTH) {
    return `${kind} ${id}: name exceeds ${LIMITS.MAX_NAME_LENGTH} characters.`;
  }
  return null;
}

function detectCycles(tasks) {
  const ids = tasks.map((t) => t.id);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const vis = Object.create(null);
  const stack = Object.create(null);
  const rec = (id, path) => {
    vis[id] = true;
    stack[id] = true;
    for (const p of byId[id].predecessors) {
      if (!byId[p]) continue;
      if (!vis[p]) {
        const hit = rec(p, path.concat(p));
        if (hit) return hit;
      } else if (stack[p]) {
        return `Cycle in finish-to-start predecessors: ${path.concat(p).join(" → ")}.`;
      }
    }
    stack[id] = false;
    return null;
  };
  for (const id of ids) {
    if (!vis[id]) {
      const hit = rec(id, [id]);
      if (hit) return hit;
    }
  }
  return null;
}

function buildCalendar(startIso) {
  const parsed = parseYMD(startIso);
  if (!parsed) {
    return { ok: false, error: `Project start date "${startIso}" is not a supported calendar date (${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}).` };
  }
  const norm = normalizeToMonday(parsed);
  if (!inSupportedRange(norm.date)) {
    return { ok: false, error: `Normalized project start ${norm.date.iso} is outside ${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}.` };
  }
  const dates = [];
  let cur = norm.date;
  dates[0] = cur;
  for (let off = 1; off <= LIMITS.MAX_OFFSET; off++) {
    const next = addWorkingDays(cur, 1);
    if (!next.ok) {
      return {
        ok: true,
        start: norm.date,
        normalized: norm.shifted,
        normalizedFrom: norm.from,
        dates,
        maxOffset: off - 1,
        calendarErrorFrom: off,
        calendarError: next.error,
      };
    }
    cur = next.date;
    dates[off] = cur;
  }
  return {
    ok: true,
    start: norm.date,
    normalized: norm.shifted,
    normalizedFrom: norm.from,
    dates,
    maxOffset: LIMITS.MAX_OFFSET,
  };
}

function notBeforeOffset(cal, notBefore) {
  if (notBefore == null) return { ok: true, offset: 0, has: false, normalized: false };
  const parsed = parseYMD(notBefore);
  if (!parsed) {
    return { ok: false, error: `Not-before date "${notBefore}" is not a supported calendar date (${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}).` };
  }
  const norm = normalizeToMonday(parsed);
  if (!inSupportedRange(norm.date)) {
    return { ok: false, error: `Normalized not-before date ${norm.date.iso} is outside ${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}.` };
  }
  const off = workingDayOffset(cal.start, norm.date);
  if (off == null) {
    return { ok: false, error: `Not-before date ${norm.date.iso} cannot be converted within the supported calendar.` };
  }
  if (off > LIMITS.MAX_OFFSET) {
    return {
      ok: false,
      error: `Not-before date ${norm.date.iso} is working-day offset ${off}, beyond the horizon of ${LIMITS.MAX_OFFSET} working days from ${cal.start.iso}.`,
    };
  }
  if (cal.maxOffset < off) {
    return {
      ok: false,
      error: `Not-before date ${norm.date.iso} (offset ${off}) exceeds the supported calendar range ${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE} from project start ${cal.start.iso}.`,
    };
  }
  return {
    ok: true,
    offset: off,
    has: true,
    normalized: norm.shifted,
    stored: norm.date.iso,
    from: norm.from,
  };
}

function occupancyPlusFits(occ, start, duration, cap) {
  for (let d = start; d < start + duration; d++) {
    if ((occ[d] ? occ[d].length : 0) + 1 > cap) return false;
  }
  return true;
}

function blockingSlices(occ, start, end) {
  const slices = [];
  let i = start;
  while (i < end) {
    const ids = occ[i] || [];
    if (ids.length === 0) {
      i += 1;
      continue;
    }
    let j = i + 1;
    const key = ids.join("\0");
    while (j < end && (occ[j] || []).join("\0") === key) j += 1;
    slices.push({ start: i, finish: j, taskIds: ids.slice() });
    i = j;
  }
  return slices;
}

export function compile(source) {
  if (!source || typeof source !== "object") return fail("Plan is missing.");
  const project = source.project;
  if (!project || typeof project !== "object") return fail("Project object is required.");
  const nameErr = checkName(project.name, "Project", "name");
  if (nameErr) return fail(nameErr);
  if (typeof project.startDate !== "string") return fail("Project startDate must be a YYYY-MM-DD string.");

  const resources = source.resources;
  if (!Array.isArray(resources)) return fail("Resources must be an array.");
  if (resources.length > LIMITS.MAX_RESOURCES) {
    return fail(`At most ${LIMITS.MAX_RESOURCES} resources are supported (received ${resources.length}).`);
  }
  const tasks = source.tasks;
  if (!Array.isArray(tasks)) return fail("Tasks must be an array.");
  if (tasks.length > LIMITS.MAX_TASKS) {
    return fail(`At most ${LIMITS.MAX_TASKS} tasks are supported (received ${tasks.length}).`);
  }

  const resById = Object.create(null);
  for (const r of resources) {
    if (!r || typeof r !== "object") return fail("Each resource must be an object.");
    const idErr = checkId(r.id, "Resource");
    if (idErr) return fail(idErr);
    if (resById[r.id]) return fail(`Duplicate resource ID "${r.id}".`);
    const nErr = checkName(r.name, "Resource", r.id);
    if (nErr) return fail(nErr);
    if (!isSafeInt(r.capacity) || r.capacity < LIMITS.MIN_CAPACITY || r.capacity > LIMITS.MAX_CAPACITY) {
      return fail(`Resource ${r.id}: capacity must be a safe integer from ${LIMITS.MIN_CAPACITY} through ${LIMITS.MAX_CAPACITY}.`);
    }
    resById[r.id] = { id: r.id, name: r.name, capacity: r.capacity };
  }

  const taskById = Object.create(null);
  const normalizedTasks = [];
  const notices = [];
  for (const t of tasks) {
    if (!t || typeof t !== "object") return fail("Each task must be an object.");
    const idErr = checkId(t.id, "Task");
    if (idErr) return fail(idErr);
    if (taskById[t.id]) return fail(`Duplicate task ID "${t.id}".`);
    const nErr = checkName(t.name, "Task", t.id);
    if (nErr) return fail(nErr);
    if (!isSafeInt(t.duration) || t.duration < LIMITS.MIN_DURATION || t.duration > LIMITS.MAX_DURATION) {
      return fail(`Task ${t.id}: duration must be a safe integer from ${LIMITS.MIN_DURATION} through ${LIMITS.MAX_DURATION} working days.`);
    }
    if (!isSafeInt(t.priority) || t.priority < LIMITS.MIN_PRIORITY || t.priority > LIMITS.MAX_PRIORITY) {
      return fail(`Task ${t.id}: priority must be a safe integer from ${LIMITS.MIN_PRIORITY} through ${LIMITS.MAX_PRIORITY}.`);
    }
    if (t.resourceId != null) {
      if (typeof t.resourceId !== "string") return fail(`Task ${t.id}: resourceId must be a string or null.`);
      if (!resById[t.resourceId]) return fail(`Task ${t.id}: unknown resource "${t.resourceId}".`);
    }
    if (t.duration === 0 && t.resourceId != null) {
      return fail(`Task ${t.id}: a duration-zero milestone cannot be assigned a resource.`);
    }
    if (!Array.isArray(t.predecessors)) return fail(`Task ${t.id}: predecessors must be an array.`);
    if (t.predecessors.length > LIMITS.MAX_PRED) {
      return fail(`Task ${t.id}: too many predecessors (max ${LIMITS.MAX_PRED}).`);
    }
    const preds = [];
    const seenP = Object.create(null);
    for (const p of t.predecessors) {
      if (typeof p !== "string") return fail(`Task ${t.id}: predecessor IDs must be strings.`);
      const pErr = checkId(p, "Predecessor");
      if (pErr) return fail(`Task ${t.id}: ${pErr}`);
      if (p === t.id) return fail(`Task ${t.id}: a task cannot precede itself.`);
      if (seenP[p]) return fail(`Task ${t.id}: duplicate predecessor "${p}".`);
      seenP[p] = true;
      preds.push(p);
    }
    if (t.notBefore != null && typeof t.notBefore !== "string") {
      return fail(`Task ${t.id}: notBefore must be a YYYY-MM-DD string or null.`);
    }
    const nt = {
      id: t.id,
      name: t.name,
      duration: t.duration,
      priority: t.priority,
      resourceId: t.resourceId == null ? null : t.resourceId,
      predecessors: preds,
      notBefore: t.notBefore == null ? null : t.notBefore,
    };
    taskById[nt.id] = nt;
    normalizedTasks.push(nt);
  }
  for (const t of normalizedTasks) {
    for (const p of t.predecessors) {
      if (!taskById[p]) return fail(`Task ${t.id}: missing predecessor "${p}".`);
    }
  }
  const cycle = detectCycles(normalizedTasks);
  if (cycle) return fail(cycle);

  const cal = buildCalendar(project.startDate);
  if (!cal.ok) return fail(cal.error);
  if (cal.normalized) {
    notices.push(`Project start ${cal.normalizedFrom} falls on a weekend and was moved forward to Monday ${cal.start.iso}.`);
  }

  const nbInfo = Object.create(null);
  for (const t of normalizedTasks) {
    const nb = notBeforeOffset(cal, t.notBefore);
    if (!nb.ok) return fail(`Task ${t.id}: ${nb.error}`);
    nbInfo[t.id] = nb;
    if (nb.normalized) {
      notices.push(`Task ${t.id} not-before ${nb.from} falls on a weekend and was moved forward to Monday ${nb.stored}.`);
      t.notBefore = nb.stored;
    } else if (nb.has) {
      t.notBefore = nb.stored;
    }
  }

  const remaining = new Set(normalizedTasks.map((t) => t.id));
  const placed = Object.create(null);
  const occ = Object.create(null);
  for (const r of resources) occ[r.id] = Object.create(null);

  const explanations = Object.create(null);
  const order = [];

  while (remaining.size) {
    const ready = [];
    for (const id of remaining) {
      const t = taskById[id];
      if (t.predecessors.every((p) => Object.prototype.hasOwnProperty.call(placed, p))) ready.push(id);
    }
    if (ready.length === 0) return fail("Could not schedule tasks because of a dependency cycle.");
    ready.sort((a, b) => {
      const pa = taskById[a].priority - taskById[b].priority;
      if (pa !== 0) return pa;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    const id = ready[0];
    const t = taskById[id];
    let predBound = 0;
    const predFinishes = [];
    for (const p of t.predecessors) {
      predFinishes.push({ id: p, finish: placed[p].finish });
      if (placed[p].finish > predBound) predBound = placed[p].finish;
    }
    const nbBound = nbInfo[id].has ? nbInfo[id].offset : 0;
    const candidate = Math.max(0, nbBound, predBound);
    let start = candidate;
    let blocked = [];
    if (t.duration > 0 && t.resourceId) {
      const cap = resById[t.resourceId].capacity;
      const bucket = occ[t.resourceId];
      const maxStart = LIMITS.MAX_OFFSET - t.duration;
      if (candidate > maxStart) {
        return fail(
          `Task ${t.id} cannot fit within the working-day horizon 0–${LIMITS.MAX_OFFSET}: candidate start ${candidate} with duration ${t.duration} would finish after offset ${LIMITS.MAX_OFFSET}.`
        );
      }
      let found = null;
      for (let s = candidate; s <= maxStart; s++) {
        if (occupancyPlusFits(bucket, s, t.duration, cap)) {
          found = s;
          break;
        }
      }
      if (found == null) {
        return fail(
          `Task ${t.id} cannot find ${t.duration} consecutive free working days on ${t.resourceId} (capacity ${cap}) within offsets 0–${LIMITS.MAX_OFFSET}.`
        );
      }
      if (found > candidate) blocked = blockingSlices(bucket, candidate, found);
      start = found;
    } else {
      if (t.duration === 0) {
        if (candidate > LIMITS.MAX_OFFSET) {
          return fail(`Milestone ${t.id} candidate offset ${candidate} exceeds the horizon ${LIMITS.MAX_OFFSET}.`);
        }
      } else if (candidate + t.duration > LIMITS.MAX_OFFSET) {
        return fail(
          `Unassigned task ${t.id} cannot fit within the working-day horizon 0–${LIMITS.MAX_OFFSET}: start ${candidate} + duration ${t.duration}.`
        );
      }
      start = candidate;
    }
    const finish = start + t.duration;
    if (finish > LIMITS.MAX_OFFSET) {
      return fail(`Task ${t.id} finish offset ${finish} exceeds the horizon ${LIMITS.MAX_OFFSET}.`);
    }
    if (start > cal.maxOffset || finish > cal.maxOffset) {
      return fail(
        `Task ${t.id} requires working-day offset ${Math.max(start, finish)} whose calendar date would exceed ${LIMITS.MAX_DATE} from project start ${cal.start.iso}.`
      );
    }
    if (!cal.dates[start] || !cal.dates[finish]) {
      return fail(`Task ${t.id}: derived schedule dates fall outside ${LIMITS.MIN_DATE}–${LIMITS.MAX_DATE}.`);
    }
    if (t.duration > 0 && t.resourceId) {
      const bucket = occ[t.resourceId];
      for (let d = start; d < finish; d++) {
        if (!bucket[d]) bucket[d] = [];
        bucket[d].push(t.id);
      }
    }
    const lastWork = t.duration > 0 ? cal.dates[finish - 1].iso : null;
    placed[id] = {
      id,
      start,
      finish,
      startDate: cal.dates[start].iso,
      finishDate: cal.dates[finish].iso,
      lastWorkDate: lastWork,
    };
    const delay = [];
    if (nbInfo[id].has && nbBound > predBound && start >= nbBound) delay.push("not-before");
    if (start > candidate) delay.push("resource");
    if (predBound > 0 && start >= predBound) delay.push("dependency");
    explanations[id] = {
      predBound,
      predFinishes,
      notBeforeBound: nbInfo[id].has ? nbBound : null,
      notBeforeDate: t.notBefore,
      candidate,
      chosenStart: start,
      chosenFinish: finish,
      resourceId: t.resourceId,
      blockedIntervals: blocked,
      delayKinds: delay,
    };
    order.push(id);
    remaining.delete(id);
  }

  const cpm = computeCpm(normalizedTasks);
  let actualCompletion = 0;
  for (const id of Object.keys(placed)) {
    if (placed[id].finish > actualCompletion) actualCompletion = placed[id].finish;
  }
  if (normalizedTasks.length === 0) actualCompletion = 0;
  if (actualCompletion > cal.maxOffset) {
    return fail(`Schedule completion offset ${actualCompletion} exceeds the supported calendar range.`);
  }

  const occupancy = Object.create(null);
  for (const r of resources) {
    const days = [];
    const bucket = occ[r.id];
    const last = actualCompletion;
    for (let d = 0; d < last; d++) {
      const ids = bucket[d] ? bucket[d].slice() : [];
      days.push({ offset: d, date: cal.dates[d].iso, used: ids.length, capacity: r.capacity, taskIds: ids });
    }
    occupancy[r.id] = days;
  }

  const scheduled = normalizedTasks.map((t) => {
    const p = placed[t.id];
    const c = cpm.tasks[t.id];
    return {
      ...t,
      start: p.start,
      finish: p.finish,
      startDate: p.startDate,
      finishDate: p.finishDate,
      lastWorkDate: p.lastWorkDate,
      es: c.es,
      ef: c.ef,
      ls: c.ls,
      lf: c.lf,
      float: c.float,
      zeroFloat: c.float === 0,
    };
  });

  const sourceOut = {
    project: { name: project.name, startDate: cal.start.iso },
    resources: resources.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity })),
    tasks: normalizedTasks.map((t) => ({
      id: t.id,
      name: t.name,
      duration: t.duration,
      priority: t.priority,
      resourceId: t.resourceId,
      predecessors: t.predecessors.slice(),
      notBefore: t.notBefore,
    })),
  };

  return {
    ok: true,
    source: sourceOut,
    notices,
    calendar: {
      start: cal.start.iso,
      normalized: cal.normalized,
      dates: cal.dates.map((d) => d.iso),
      maxOffset: cal.maxOffset,
      weekendBreakAfter: weekendBreaks(cal),
    },
    tasks: scheduled,
    taskById: Object.fromEntries(scheduled.map((t) => [t.id, t])),
    resources: sourceOut.resources,
    occupancy,
    explanations,
    order,
    actualCompletion,
    actualCompletionDate: cal.dates[actualCompletion].iso,
    cpmCompletion: cpm.completion,
    cpm,
    criticalEdges: cpm.criticalEdges,
  };
}

function weekendBreaks(cal) {
  const breaks = [];
  const n = Math.min(cal.dates.length, cal.maxOffset + 1);
  for (let i = 0; i < n; i++) {
    const dt = cal.dates[i];
    if (dow(dt.y, dt.m, dt.d) === 5) breaks.push(i);
  }
  return breaks;
}

export function computeCpm(tasks) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const ids = tasks.map((t) => t.id);
  const succs = Object.create(null);
  for (const id of ids) succs[id] = [];
  for (const t of tasks) {
    for (const p of t.predecessors) succs[p].push(t.id);
  }
  const remaining = new Set(ids);
  const es = Object.create(null);
  const ef = Object.create(null);
  const order = [];
  while (remaining.size) {
    const ready = [];
    for (const id of remaining) {
      if (byId[id].predecessors.every((p) => Object.prototype.hasOwnProperty.call(ef, p))) ready.push(id);
    }
    if (ready.length === 0) break;
    ready.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const id of ready) {
      let start = 0;
      for (const p of byId[id].predecessors) start = Math.max(start, ef[p]);
      es[id] = start;
      ef[id] = start + byId[id].duration;
      order.push(id);
      remaining.delete(id);
    }
  }
  let completion = 0;
  if (tasks.length === 0) completion = 0;
  else {
    for (const id of ids) if (ef[id] > completion) completion = ef[id];
  }
  const ls = Object.create(null);
  const lf = Object.create(null);
  const flt = Object.create(null);
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const s = succs[id];
    if (s.length === 0) lf[id] = completion;
    else {
      let m = Infinity;
      for (const u of s) m = Math.min(m, ls[u]);
      lf[id] = m;
    }
    ls[id] = lf[id] - byId[id].duration;
    flt[id] = ls[id] - es[id];
  }
  const info = Object.create(null);
  for (const id of ids) {
    info[id] = { es: es[id], ef: ef[id], ls: ls[id], lf: lf[id], float: flt[id] };
  }
  const criticalEdges = [];
  for (const t of tasks) {
    for (const p of t.predecessors) {
      if (flt[p] === 0 && flt[t.id] === 0 && ef[p] === es[t.id]) {
        criticalEdges.push({ from: p, to: t.id });
      }
    }
  }
  return { completion, tasks: info, criticalEdges };
}

export function parseProjectJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return fail("JSON is not parseable.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail("JSON root must be an object.");
  if (data.version !== 1) return fail('JSON version must be 1 (field "version": 1).');
  if (!data.project || typeof data.project !== "object") return fail("JSON must include a project object.");
  if (typeof data.project.name !== "string") return fail("project.name must be a string.");
  if (typeof data.project.startDate !== "string") return fail("project.startDate must be a YYYY-MM-DD string.");
  if (!Array.isArray(data.resources)) return fail("resources must be an array.");
  if (!Array.isArray(data.tasks)) return fail("tasks must be an array.");
  const source = {
    project: { name: data.project.name, startDate: data.project.startDate },
    resources: data.resources.map((r) => ({
      id: r && r.id,
      name: r && r.name,
      capacity: r && r.capacity,
    })),
    tasks: data.tasks.map((t) => ({
      id: t && t.id,
      name: t && t.name,
      duration: t && t.duration,
      priority: t && t.priority,
      resourceId: t ? (t.resourceId === undefined ? null : t.resourceId) : null,
      predecessors: t && Array.isArray(t.predecessors) ? t.predecessors : t ? t.predecessors : [],
      notBefore: t ? (t.notBefore === undefined ? null : t.notBefore) : null,
    })),
  };
  return compile(source);
}

export function toExportJson(source) {
  return {
    version: 1,
    project: { name: source.project.name, startDate: source.project.startDate },
    resources: source.resources.map((r) => ({ id: r.id, name: r.name, capacity: r.capacity })),
    tasks: source.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      duration: t.duration,
      priority: t.priority,
      resourceId: t.resourceId,
      predecessors: t.predecessors.slice(),
      notBefore: t.notBefore,
    })),
  };
}

export function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(plan) {
  const headers = [
    "taskId",
    "name",
    "resourceId",
    "predecessors",
    "duration",
    "notBefore",
    "startOffset",
    "finishOffset",
    "startDate",
    "finishDate",
    "lastWorkDate",
    "dependencyOnlyFloat",
  ];
  const lines = [headers.join(",")];
  for (const t of plan.tasks) {
    lines.push(
      [
        csvEscape(t.id),
        csvEscape(t.name),
        csvEscape(t.resourceId == null ? "" : t.resourceId),
        csvEscape(t.predecessors.join(";")),
        csvEscape(t.duration),
        csvEscape(t.notBefore == null ? "" : t.notBefore),
        csvEscape(t.start),
        csvEscape(t.finish),
        csvEscape(t.startDate),
        csvEscape(t.finishDate),
        csvEscape(t.lastWorkDate == null ? "" : t.lastWorkDate),
        csvEscape(t.float),
      ].join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export function intervalsOf(plan) {
  const o = {};
  for (const id of Object.keys(plan.taskById).sort()) {
    const t = plan.taskById[id];
    o[id] = [t.start, t.finish];
  }
  return o;
}
