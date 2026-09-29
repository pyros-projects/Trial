// test-core.js - Verification of scheduling, CPM, calendar, and validation algorithms
const assert = require('assert');

function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (y < 2000 || y > 2099 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === mo && dt.getUTCDate() === d;
}

function normalizeDateToMonday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  let normalized = false;
  if (dow === 6) { // Sat -> Mon (+2)
    dt.setUTCDate(dt.getUTCDate() + 2);
    normalized = true;
  } else if (dow === 0) { // Sun -> Mon (+1)
    dt.setUTCDate(dt.getUTCDate() + 1);
    normalized = true;
  }
  return { date: dt.toISOString().slice(0, 10), normalized, original: dateStr };
}

function offsetToDate(projectStart, offset) {
  const [y, m, d] = projectStart.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  let remaining = offset;
  while (remaining > 0) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  return dt.toISOString().slice(0, 10);
}

function dateToOffset(projectStart, dateStr) {
  const { date: normDate } = normalizeDateToMonday(dateStr);
  if (normDate <= projectStart) return 0;
  const [y1, m1, d1] = projectStart.split('-').map(Number);
  const [y2, m2, d2] = normDate.split('-').map(Number);
  let dt = new Date(Date.UTC(y1, m1, d1));
  const target = new Date(Date.UTC(y2, m2, d2)).getTime();
  let offset = 0;
  while (dt.getTime() < target) {
    dt.setUTCDate(dt.getUTCDate() + 1);
    const dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      offset++;
    }
  }
  return offset;
}

function validateAndSchedule(projectData) {
  if (!projectData || typeof projectData !== 'object') {
    return { valid: false, error: 'Invalid project data.' };
  }
  if (!projectData.name || typeof projectData.name !== 'string' || !projectData.name.trim()) {
    return { valid: false, error: 'Project name is required.' };
  }
  if (!isValidCalendarDate(projectData.startDate)) {
    return { valid: false, error: `Invalid project start date: ${projectData.startDate}. Must be YYYY-MM-DD between 2000-01-01 and 2099-12-31.` };
  }

  const startNorm = normalizeDateToMonday(projectData.startDate);
  const normalizedStart = startNorm.date;
  const warnings = [];
  if (startNorm.normalized) {
    warnings.push(`Project start date ${startNorm.original} is a weekend; normalized forward to Monday ${normalizedStart}.`);
  }

  if (!Array.isArray(projectData.resources) || projectData.resources.length === 0) {
    return { valid: false, error: 'At least one resource is required.' };
  }
  if (projectData.resources.length > 50) {
    return { valid: false, error: 'Maximum 50 resources supported.' };
  }

  const resourceMap = new Map();
  for (const res of projectData.resources) {
    if (!res || typeof res !== 'object') return { valid: false, error: 'Invalid resource entry.' };
    if (!res.id || typeof res.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(res.id)) {
      return { valid: false, error: `Resource ID '${res.id}' must be non-empty and contain only letters, numbers, hyphens, and underscores.` };
    }
    if (resourceMap.has(res.id)) {
      return { valid: false, error: `Duplicate resource ID: ${res.id}` };
    }
    if (!res.name || typeof res.name !== 'string' || !res.name.trim()) {
      return { valid: false, error: `Resource ${res.id} must have a name.` };
    }
    if (!Number.isSafeInteger(res.capacity) || res.capacity < 1 || res.capacity > 4) {
      return { valid: false, error: `Resource ${res.id} capacity must be an integer between 1 and 4. Got: ${res.capacity}` };
    }
    resourceMap.set(res.id, { id: res.id, name: res.name.trim(), capacity: res.capacity });
  }

  if (!Array.isArray(projectData.tasks)) {
    return { valid: false, error: 'Tasks must be an array.' };
  }
  if (projectData.tasks.length > 500) {
    return { valid: false, error: 'Maximum 500 tasks supported.' };
  }

  const taskMap = new Map();
  const normalizedTasks = [];
  for (const t of projectData.tasks) {
    if (!t || typeof t !== 'object') return { valid: false, error: 'Invalid task entry.' };
    if (!t.id || typeof t.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(t.id)) {
      return { valid: false, error: `Task ID '${t.id}' must be non-empty and contain only letters, numbers, hyphens, and underscores.` };
    }
    if (taskMap.has(t.id)) {
      return { valid: false, error: `Duplicate task ID: ${t.id}` };
    }
    if (!t.name || typeof t.name !== 'string' || !t.name.trim()) {
      return { valid: false, error: `Task ${t.id} must have a non-empty name.` };
    }
    if (!Number.isSafeInteger(t.priority) || t.priority < 0 || t.priority > 9999) {
      return { valid: false, error: `Task ${t.id} priority must be an integer between 0 and 9999. Got: ${t.priority}` };
    }
    if (!Number.isSafeInteger(t.duration) || t.duration < 0 || t.duration > 260) {
      return { valid: false, error: `Task ${t.id} duration must be an integer between 0 and 260 working days. Got: ${t.duration}` };
    }

    let resourceId = t.resourceId || null;
    if (resourceId !== null) {
      if (!resourceMap.has(resourceId)) {
        return { valid: false, error: `Task ${t.id} references unknown resource: ${resourceId}` };
      }
      if (t.duration === 0) {
        return { valid: false, error: `Task ${t.id} is a milestone (duration 0) and cannot be assigned a resource (${resourceId}).` };
      }
    }

    const preds = Array.isArray(t.predecessors) ? [...t.predecessors] : [];
    const predSet = new Set();
    for (const p of preds) {
      if (p === t.id) {
        return { valid: false, error: `Task ${t.id} cannot have itself as a predecessor.` };
      }
      if (predSet.has(p)) {
        return { valid: false, error: `Task ${t.id} has duplicate predecessor: ${p}` };
      }
      predSet.add(p);
    }

    let notBefore = t.notBefore || null;
    let notBeforeOffset = 0;
    if (notBefore !== null) {
      if (!isValidCalendarDate(notBefore)) {
        return { valid: false, error: `Task ${t.id} has invalid not-before date: ${notBefore}. Must be YYYY-MM-DD between 2000-01-01 and 2099-12-31.` };
      }
      const nbNorm = normalizeDateToMonday(notBefore);
      if (nbNorm.normalized) {
        warnings.push(`Task ${t.id} not-before date ${nbNorm.original} is a weekend; normalized forward to Monday ${nbNorm.date}.`);
      }
      notBefore = nbNorm.date;
      notBeforeOffset = dateToOffset(normalizedStart, notBefore);
      if (notBeforeOffset > 2600) {
        return { valid: false, error: `Task ${t.id} not-before date ${notBefore} corresponds to working-day offset ${notBeforeOffset}, exceeding the maximum schedule horizon of 2600 working days.` };
      }
    }

    const taskObj = {
      id: t.id,
      name: t.name.trim(),
      priority: t.priority,
      duration: t.duration,
      resourceId,
      predecessors: preds,
      notBefore,
      notBeforeOffset
    };
    taskMap.set(t.id, taskObj);
    normalizedTasks.push(taskObj);
  }

  // Verify all predecessors exist
  for (const t of normalizedTasks) {
    for (const p of t.predecessors) {
      if (!taskMap.has(p)) {
        return { valid: false, error: `Task ${t.id} references missing predecessor: ${p}` };
      }
    }
  }

  // Cycle check using DFS
  const visited = new Map(); // id -> 0: unvisited, 1: visiting, 2: visited
  const cyclePath = [];
  function checkCycle(taskId) {
    visited.set(taskId, 1);
    cyclePath.push(taskId);
    const t = taskMap.get(taskId);
    // edges are pred -> task
    // but in task definition, task has predecessors!
    // If pred -> task, path from pred to task.
    // Let's check successors or predecessors:
    // A dependency cycle exists if following predecessors leads back to taskId.
    for (const p of t.predecessors) {
      const state = visited.get(p) || 0;
      if (state === 1) {
        const cycleStartIndex = cyclePath.indexOf(p);
        const loop = cyclePath.slice(cycleStartIndex).concat(p);
        return loop.join(' -> ');
      }
      if (state === 0) {
        const cycle = checkCycle(p);
        if (cycle) return cycle;
      }
    }
    cyclePath.pop();
    visited.set(taskId, 2);
    return null;
  }

  for (const t of normalizedTasks) {
    if (!visited.get(t.id)) {
      const cycle = checkCycle(t.id);
      if (cycle) {
        return { valid: false, error: `Dependency cycle detected: ${cycle}` };
      }
    }
  }

  // Dependency-only CPM calculation
  const cpm = computeDependencyCPM(normalizedTasks);

  // Deterministic Serial Scheduling
  // occupancy per resource: Uint8Array for offsets 0 to 2601
  const occupancy = {};
  const occupancyBookings = {}; // resId -> Array of { taskId, start, finish }
  for (const resId of resourceMap.keys()) {
    occupancy[resId] = new Uint8Array(2602);
    occupancyBookings[resId] = [];
  }

  const placedTasks = new Map();
  const unscheduled = new Set(normalizedTasks.map(t => t.id));

  while (unscheduled.size > 0) {
    // Find ready tasks
    const ready = [];
    for (const id of unscheduled) {
      const t = taskMap.get(id);
      const allPredsPlaced = t.predecessors.every(p => placedTasks.has(p));
      if (allPredsPlaced) {
        ready.push(t);
      }
    }

    if (ready.length === 0) {
      return { valid: false, error: 'Scheduling deadlock: ready queue is empty while unscheduled tasks remain.' };
    }

    // Tie-breaker: lowest numeric priority, then lexicographically smallest stable ID (ASCII code-point)
    ready.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });

    const chosen = ready[0];

    // Candidate boundary: max(0, notBeforeOffset, every predecessor's placed finish)
    let candidateBoundary = 0;
    if (chosen.notBeforeOffset > 0) {
      candidateBoundary = Math.max(candidateBoundary, chosen.notBeforeOffset);
    }
    let predecessorBound = 0;
    const drivingPredecessors = [];
    for (const p of chosen.predecessors) {
      const pFinish = placedTasks.get(p).finishOffset;
      if (pFinish > predecessorBound) {
        predecessorBound = pFinish;
      }
    }
    for (const p of chosen.predecessors) {
      if (placedTasks.get(p).finishOffset === predecessorBound) {
        drivingPredecessors.push(p);
      }
    }
    candidateBoundary = Math.max(candidateBoundary, predecessorBound);

    let startOffset = candidateBoundary;
    let finishOffset = candidateBoundary;
    const blockingIntervals = [];

    if (chosen.duration === 0) {
      // Milestone: duration 0, no resource
      startOffset = candidateBoundary;
      finishOffset = candidateBoundary;
    } else if (!chosen.resourceId) {
      // Unassigned: no capacity limit, needs no slot search
      startOffset = candidateBoundary;
      finishOffset = candidateBoundary + chosen.duration;
    } else {
      // Search from candidateBoundary for earliest consecutive working-day interval
      // where occupancy + 1 <= capacity
      const res = resourceMap.get(chosen.resourceId);
      const occ = occupancy[chosen.resourceId];
      let foundSlot = false;

      for (let t = candidateBoundary; t + chosen.duration <= 2600; t++) {
        let fits = true;
        for (let d = 0; d < chosen.duration; d++) {
          if (occ[t + d] + 1 > res.capacity) {
            fits = false;
            break;
          }
        }
        if (fits) {
          startOffset = t;
          finishOffset = t + chosen.duration;
          foundSlot = true;
          break;
        }
      }

      if (!foundSlot) {
        return { valid: false, error: `Task ${chosen.id} (${chosen.name}) cannot fit within the 2600 working-day schedule horizon on resource ${res.name}.` };
      }

      // If delayed, identify blocking tasks
      if (startOffset > candidateBoundary) {
        // Examine days from candidateBoundary to startOffset - 1
        for (let day = candidateBoundary; day < startOffset; day++) {
          if (occ[day] >= res.capacity) {
            // Find tasks occupying this day
            const blockersOnDay = occupancyBookings[chosen.resourceId].filter(b => day >= b.start && day < b.finish);
            blockingIntervals.push({
              day,
              date: offsetToDate(normalizedStart, day),
              blockingTaskIds: blockersOnDay.map(b => b.taskId)
            });
          }
        }
      }

      // Book occupancy
      for (let d = 0; d < chosen.duration; d++) {
        occ[startOffset + d] += 1;
      }
      occupancyBookings[chosen.resourceId].push({
        taskId: chosen.id,
        start: startOffset,
        finish: finishOffset
      });
    }

    if (finishOffset > 2600) {
      return { valid: false, error: `Task ${chosen.id} (${chosen.name}) finishes at working-day offset ${finishOffset}, which exceeds the 2600 working-day horizon.` };
    }

    const finishDate = offsetToDate(normalizedStart, finishOffset);
    if (finishDate > '2099-12-31') {
      return { valid: false, error: `Task ${chosen.id} (${chosen.name}) finish date ${finishDate} exceeds the maximum calendar date 2099-12-31.` };
    }

    const startDate = offsetToDate(normalizedStart, startOffset);
    const lastWorkDate = chosen.duration > 0 ? offsetToDate(normalizedStart, finishOffset - 1) : null;

    placedTasks.set(chosen.id, {
      ...chosen,
      startOffset,
      finishOffset,
      startDate,
      finishDate,
      lastWorkDate,
      candidateBoundary,
      predecessorBound,
      drivingPredecessors,
      notBeforeBound: chosen.notBeforeOffset,
      resourceDelay: startOffset - candidateBoundary,
      blockingIntervals,
      dependencyFloat: cpm.taskCpm.get(chosen.id).totalFloat,
      isDependencyCritical: cpm.taskCpm.get(chosen.id).isZeroFloat
    });

    unscheduled.delete(chosen.id);
  }

  const scheduledTasks = normalizedTasks.map(t => placedTasks.get(t.id));
  const actualCompletionOffset = scheduledTasks.length > 0 ? Math.max(...scheduledTasks.map(t => t.finishOffset)) : 0;
  const actualCompletionDate = offsetToDate(normalizedStart, actualCompletionOffset);

  return {
    valid: true,
    warnings,
    project: {
      name: projectData.name.trim(),
      startDate: normalizedStart,
      resources: Array.from(resourceMap.values()),
      tasks: normalizedTasks
    },
    schedule: {
      tasks: scheduledTasks,
      actualCompletionOffset,
      actualCompletionDate,
      occupancyBookings,
      cpm
    }
  };
}

function computeDependencyCPM(tasks) {
  if (!tasks || tasks.length === 0) {
    return {
      dependencyCompletion: 0,
      taskCpm: new Map(),
      criticalEdges: new Set()
    };
  }

  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const succMap = new Map(tasks.map(t => [t.id, []]));
  const inDegree = new Map(tasks.map(t => [t.id, t.predecessors.length]));

  for (const t of tasks) {
    for (const p of t.predecessors) {
      succMap.get(p).push(t.id);
    }
  }

  // Kahn's algorithm for topological sort
  const queue = tasks.filter(t => t.predecessors.length === 0).map(t => t.id);
  const topoOrder = [];
  while (queue.length > 0) {
    const u = queue.shift();
    topoOrder.push(u);
    for (const s of succMap.get(u)) {
      inDegree.set(s, inDegree.get(s) - 1);
      if (inDegree.get(s) === 0) {
        queue.push(s);
      }
    }
  }

  // Forward pass
  const es = new Map();
  const ef = new Map();
  for (const id of topoOrder) {
    const t = taskMap.get(id);
    let earlyStart = 0;
    for (const p of t.predecessors) {
      earlyStart = Math.max(earlyStart, ef.get(p));
    }
    es.set(id, earlyStart);
    ef.set(id, earlyStart + t.duration);
  }

  const depCompletion = Math.max(...Array.from(ef.values()));

  // Backward pass
  const ls = new Map();
  const lf = new Map();
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const id = topoOrder[i];
    const t = taskMap.get(id);
    const succs = succMap.get(id);
    let lateFinish = depCompletion;
    if (succs.length > 0) {
      lateFinish = Math.min(...succs.map(s => ls.get(s)));
    }
    lf.set(id, lateFinish);
    ls.set(id, lateFinish - t.duration);
  }

  const taskCpm = new Map();
  for (const t of tasks) {
    const earlyStart = es.get(t.id);
    const earlyFinish = ef.get(t.id);
    const lateStart = ls.get(t.id);
    const lateFinish = lf.get(t.id);
    const totalFloat = lateStart - earlyStart;
    taskCpm.set(t.id, {
      es: earlyStart,
      ef: earlyFinish,
      ls: lateStart,
      lf: lateFinish,
      totalFloat,
      isZeroFloat: totalFloat === 0
    });
  }

  // Critical edges: endpoints both zero-float and predecessor earliest finish === successor earliest start
  const criticalEdges = new Set();
  for (const t of tasks) {
    for (const p of t.predecessors) {
      const pCpm = taskCpm.get(p);
      const tCpm = taskCpm.get(t.id);
      if (pCpm.isZeroFloat && tCpm.isZeroFloat && pCpm.ef === tCpm.es) {
        criticalEdges.add(`${p}->${t.id}`);
      }
    }
  }

  return {
    dependencyCompletion: depCompletion,
    taskCpm,
    criticalEdges
  };
}

// RUN TESTS
console.log('Running test suite...');

// Seed Data
const seedProject = {
  name: 'Studio Launch',
  startDate: '2026-09-07',
  resources: [
    { id: 'R1', name: 'Studio', capacity: 1 },
    { id: 'R2', name: 'Review', capacity: 1 }
  ],
  tasks: [
    { id: 'T1', name: 'Design', duration: 2, priority: 1, resourceId: 'R1', predecessors: [], notBefore: null },
    { id: 'T2', name: 'Build', duration: 3, priority: 2, resourceId: 'R1', predecessors: ['T1'], notBefore: null },
    { id: 'T3', name: 'Documentation', duration: 2, priority: 3, resourceId: 'R1', predecessors: ['T1'], notBefore: null },
    { id: 'T4', name: 'Review', duration: 1, priority: 4, resourceId: 'R2', predecessors: ['T2', 'T3'], notBefore: null },
    { id: 'T5', name: 'Launch', duration: 0, priority: 5, resourceId: null, predecessors: ['T4'], notBefore: null }
  ]
};

// Test PLAN-01: Seed
const res1 = validateAndSchedule(seedProject);
assert(res1.valid, `Seed should be valid: ${res1.error}`);
const taskMap1 = new Map(res1.schedule.tasks.map(t => [t.id, t]));

console.log('PLAN-01 Checks:');
assert.strictEqual(taskMap1.get('T1').startOffset, 0);
assert.strictEqual(taskMap1.get('T1').finishOffset, 2);
assert.strictEqual(taskMap1.get('T2').startOffset, 2);
assert.strictEqual(taskMap1.get('T2').finishOffset, 5);
assert.strictEqual(taskMap1.get('T3').startOffset, 5);
assert.strictEqual(taskMap1.get('T3').finishOffset, 7);
assert.strictEqual(taskMap1.get('T4').startOffset, 7);
assert.strictEqual(taskMap1.get('T4').finishOffset, 8);
assert.strictEqual(taskMap1.get('T5').startOffset, 8);
assert.strictEqual(taskMap1.get('T5').finishOffset, 8);

assert.strictEqual(res1.schedule.actualCompletionOffset, 8);
assert.strictEqual(res1.schedule.actualCompletionDate, '2026-09-17');
assert.strictEqual(taskMap1.get('T2').lastWorkDate, '2026-09-11');
assert.strictEqual(taskMap1.get('T2').finishDate, '2026-09-14');
console.log('PLAN-01 Passed!');

// Test PLAN-02: Critical path and capacity
console.log('PLAN-02 Checks:');
assert.strictEqual(res1.schedule.cpm.dependencyCompletion, 6);
assert.strictEqual(taskMap1.get('T3').dependencyFloat, 1);
assert.strictEqual(taskMap1.get('T1').dependencyFloat, 0);
assert.strictEqual(taskMap1.get('T2').dependencyFloat, 0);
assert.strictEqual(taskMap1.get('T4').dependencyFloat, 0);
assert.strictEqual(taskMap1.get('T5').dependencyFloat, 0);

// Increase R1 capacity to 2
const seedCap2 = JSON.parse(JSON.stringify(seedProject));
seedCap2.resources[0].capacity = 2;
const resCap2 = validateAndSchedule(seedCap2);
assert(resCap2.valid);
const taskMapCap2 = new Map(resCap2.schedule.tasks.map(t => [t.id, t]));
assert.strictEqual(taskMapCap2.get('T1').startOffset, 0);
assert.strictEqual(taskMapCap2.get('T1').finishOffset, 2);
assert.strictEqual(taskMapCap2.get('T2').startOffset, 2);
assert.strictEqual(taskMapCap2.get('T2').finishOffset, 5);
assert.strictEqual(taskMapCap2.get('T3').startOffset, 2);
assert.strictEqual(taskMapCap2.get('T3').finishOffset, 4);
assert.strictEqual(taskMapCap2.get('T4').startOffset, 5);
assert.strictEqual(taskMapCap2.get('T4').finishOffset, 6);
assert.strictEqual(taskMapCap2.get('T5').startOffset, 6);
assert.strictEqual(taskMapCap2.get('T5').finishOffset, 6);
assert.strictEqual(resCap2.schedule.actualCompletionOffset, 6);
assert.strictEqual(resCap2.schedule.cpm.dependencyCompletion, 6);
console.log('PLAN-02 Passed!');

// Test PLAN-03: Propagation and range of effects
console.log('PLAN-03 Checks:');
const seedT1Dur3 = JSON.parse(JSON.stringify(seedProject));
seedT1Dur3.tasks[0].duration = 3;
const resT1Dur3 = validateAndSchedule(seedT1Dur3);
assert(resT1Dur3.valid);
const taskMapT1Dur3 = new Map(resT1Dur3.schedule.tasks.map(t => [t.id, t]));
assert.strictEqual(taskMapT1Dur3.get('T1').startOffset, 0);
assert.strictEqual(taskMapT1Dur3.get('T1').finishOffset, 3);
assert.strictEqual(taskMapT1Dur3.get('T2').startOffset, 3);
assert.strictEqual(taskMapT1Dur3.get('T2').finishOffset, 6);
assert.strictEqual(taskMapT1Dur3.get('T3').startOffset, 6);
assert.strictEqual(taskMapT1Dur3.get('T3').finishOffset, 8);
assert.strictEqual(taskMapT1Dur3.get('T4').startOffset, 8);
assert.strictEqual(taskMapT1Dur3.get('T4').finishOffset, 9);
assert.strictEqual(taskMapT1Dur3.get('T5').startOffset, 9);
assert.strictEqual(taskMapT1Dur3.get('T5').finishOffset, 9);
assert.strictEqual(resT1Dur3.schedule.cpm.dependencyCompletion, 7);
console.log('PLAN-03 Passed!');

// Test PLAN-04: Drag / Not-before offset 5
console.log('PLAN-04 Checks:');
const seedT2Nb5 = JSON.parse(JSON.stringify(seedProject));
seedT2Nb5.tasks[1].notBefore = '2026-09-14';
const resT2Nb5 = validateAndSchedule(seedT2Nb5);
assert(resT2Nb5.valid);
const taskMapT2Nb5 = new Map(resT2Nb5.schedule.tasks.map(t => [t.id, t]));
assert.strictEqual(taskMapT2Nb5.get('T1').startOffset, 0);
assert.strictEqual(taskMapT2Nb5.get('T1').finishOffset, 2);
assert.strictEqual(taskMapT2Nb5.get('T2').startOffset, 5);
assert.strictEqual(taskMapT2Nb5.get('T2').finishOffset, 8);
assert.strictEqual(taskMapT2Nb5.get('T3').startOffset, 2);
assert.strictEqual(taskMapT2Nb5.get('T3').finishOffset, 4);
assert.strictEqual(taskMapT2Nb5.get('T4').startOffset, 8);
assert.strictEqual(taskMapT2Nb5.get('T4').finishOffset, 9);
assert.strictEqual(taskMapT2Nb5.get('T5').startOffset, 9);
assert.strictEqual(taskMapT2Nb5.get('T5').finishOffset, 9);
assert.strictEqual(resT2Nb5.schedule.cpm.dependencyCompletion, 6);

// Enter Saturday 2026-09-12 for T2
const seedT2Sat = JSON.parse(JSON.stringify(seedProject));
seedT2Sat.tasks[1].notBefore = '2026-09-12';
const resT2Sat = validateAndSchedule(seedT2Sat);
assert(resT2Sat.valid);
assert(resT2Sat.warnings.length > 0);
console.log('Weekend normalization warning:', resT2Sat.warnings[0]);
const taskMapT2Sat = new Map(resT2Sat.schedule.tasks.map(t => [t.id, t]));
assert.strictEqual(taskMapT2Sat.get('T2').startOffset, 5);
assert.strictEqual(taskMapT2Sat.get('T3').startOffset, 2);
console.log('PLAN-04 Passed!');

// Test PLAN-05: Validation
console.log('PLAN-05 Checks:');
// Cycle: T1 depends on T5
const seedCycle = JSON.parse(JSON.stringify(seedProject));
seedCycle.tasks[0].predecessors = ['T5'];
const resCycle = validateAndSchedule(seedCycle);
assert(!resCycle.valid, 'Cycle should be rejected');
console.log('Cycle error:', resCycle.error);

// Missing pred
const seedMissingPred = JSON.parse(JSON.stringify(seedProject));
seedMissingPred.tasks[0].predecessors = ['T99'];
const resMissing = validateAndSchedule(seedMissingPred);
assert(!resMissing.valid, 'Missing predecessor should be rejected');

// Duplicate ID
const seedDupId = JSON.parse(JSON.stringify(seedProject));
seedDupId.tasks[1].id = 'T1';
const resDup = validateAndSchedule(seedDupId);
assert(!resDup.valid, 'Duplicate ID should be rejected');

// Invalid capacity
const seedInvCap = JSON.parse(JSON.stringify(seedProject));
seedInvCap.resources[0].capacity = 5;
const resInvCap = validateAndSchedule(seedInvCap);
assert(!resInvCap.valid, 'Invalid capacity should be rejected');

// Duration 1000000000
const seedHugeDur = JSON.parse(JSON.stringify(seedProject));
seedHugeDur.tasks[0].duration = 1000000000;
const resHugeDur = validateAndSchedule(seedHugeDur);
assert(!resHugeDur.valid, 'Huge duration should be rejected');

// Priority 10000
const seedHugePrio = JSON.parse(JSON.stringify(seedProject));
seedHugePrio.tasks[0].priority = 10000;
const resHugePrio = validateAndSchedule(seedHugePrio);
assert(!resHugePrio.valid, 'Priority 10000 should be rejected');

// Horizon overflow
const seedBeyondHorizon = JSON.parse(JSON.stringify(seedProject));
seedBeyondHorizon.tasks[0].notBefore = '2040-01-01'; // way beyond 2600 working days (~10 years)
const resBeyond = validateAndSchedule(seedBeyondHorizon);
assert(!resBeyond.valid, 'Beyond horizon should be rejected');
console.log('Horizon error:', resBeyond.error);

// Add unassigned root U and milestone M
const seedWithUM = JSON.parse(JSON.stringify(seedProject));
seedWithUM.tasks.push({ id: 'U', name: 'Unassigned Root', duration: 1, priority: 0, resourceId: null, predecessors: [], notBefore: null });
seedWithUM.tasks.push({ id: 'M', name: 'Milestone', duration: 0, priority: 0, resourceId: null, predecessors: ['U'], notBefore: null });
const resUM = validateAndSchedule(seedWithUM);
assert(resUM.valid);
const taskMapUM = new Map(resUM.schedule.tasks.map(t => [t.id, t]));
assert.strictEqual(taskMapUM.get('U').startOffset, 0);
assert.strictEqual(taskMapUM.get('U').finishOffset, 1);
assert.strictEqual(taskMapUM.get('M').startOffset, 1);
assert.strictEqual(taskMapUM.get('M').finishOffset, 1);
// Original 5 tasks unchanged
assert.strictEqual(taskMapUM.get('T1').startOffset, 0);
assert.strictEqual(taskMapUM.get('T1').finishOffset, 2);
assert.strictEqual(taskMapUM.get('T2').startOffset, 2);
assert.strictEqual(taskMapUM.get('T2').finishOffset, 5);
assert.strictEqual(taskMapUM.get('T3').startOffset, 5);
assert.strictEqual(taskMapUM.get('T3').finishOffset, 7);
assert.strictEqual(taskMapUM.get('T4').startOffset, 7);
assert.strictEqual(taskMapUM.get('T4').finishOffset, 8);
assert.strictEqual(taskMapUM.get('T5').startOffset, 8);
assert.strictEqual(taskMapUM.get('T5').finishOffset, 8);
console.log('PLAN-05 Passed!');

// Test PLAN-06: Determinism and Tie breaking
console.log('PLAN-06 Checks:');
const seedTie = JSON.parse(JSON.stringify(seedProject));
seedTie.tasks[2].priority = 2; // T3 priority = 2 (same as T2)
// Reverse tasks array
seedTie.tasks.reverse();
const resTie = validateAndSchedule(seedTie);
assert(resTie.valid);
const taskMapTie = new Map(resTie.schedule.tasks.map(t => [t.id, t]));
// T2 ('T2' < 'T3') should be scheduled first at [2, 5), T3 at [5, 7)
assert.strictEqual(taskMapTie.get('T2').startOffset, 2);
assert.strictEqual(taskMapTie.get('T2').finishOffset, 5);
assert.strictEqual(taskMapTie.get('T3').startOffset, 5);
assert.strictEqual(taskMapTie.get('T3').finishOffset, 7);
console.log('PLAN-06 Passed!');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
