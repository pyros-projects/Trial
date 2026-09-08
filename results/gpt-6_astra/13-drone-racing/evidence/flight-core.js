(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var EPS = 1e-9;

  function clamp(value, low, high) {
    value = Number(value);
    if (!Number.isFinite(value)) value = 0;
    return Math.max(low, Math.min(high, value));
  }

  function setting(object, key, fallback, low, high) {
    var value = object && Number(object[key]);
    return Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
  }

  function copy3(a) {
    return [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0];
  }

  function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function length3(a) {
    return Math.hypot(a[0], a[1], a[2]);
  }

  function normalize3(a, fallback) {
    var length = length3(a);
    if (!Number.isFinite(length) || length < EPS) return copy3(fallback || [0, 0, -1]);
    return [a[0] / length, a[1] / length, a[2] / length];
  }

  function normalizeQuat(q) {
    var length = Math.hypot(q[0], q[1], q[2], q[3]);
    if (!Number.isFinite(length) || length < EPS) return [0, 0, 0, 1];
    return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
  }

  function rotateVector(q, v) {
    var x = q[0];
    var y = q[1];
    var z = q[2];
    var w = q[3];
    var tx = 2 * (y * v[2] - z * v[1]);
    var ty = 2 * (z * v[0] - x * v[2]);
    var tz = 2 * (x * v[1] - y * v[0]);
    return [
      v[0] + w * tx + y * tz - z * ty,
      v[1] + w * ty + z * tx - x * tz,
      v[2] + w * tz + x * ty - y * tx,
    ];
  }

  function inverseRotateVector(q, v) {
    return rotateVector([-q[0], -q[1], -q[2], q[3]], v);
  }

  function integrateQuat(q, omega, dt) {
    var x = q[0];
    var y = q[1];
    var z = q[2];
    var w = q[3];
    var ox = omega[0];
    var oy = omega[1];
    var oz = omega[2];
    return normalizeQuat([
      x + 0.5 * (w * ox + y * oz - z * oy) * dt,
      y + 0.5 * (w * oy + z * ox - x * oz) * dt,
      z + 0.5 * (w * oz + x * oy - y * ox) * dt,
      w - 0.5 * (x * ox + y * oy + z * oz) * dt,
    ]);
  }

  function expo(value, amount) {
    value = clamp(value, -1, 1);
    amount = clamp(amount, 0, 1);
    return value * (1 - amount) + value * value * value * amount;
  }

  function hashString(text) {
    var hash = 2166136261 >>> 0;
    text = String(text);
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return hash >>> 0;
  }

  function randomGenerator(seed) {
    var state = hashString(seed) || 0x9e3779b9;
    return function () {
      state += 0x6d2b79f5;
      var value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  var PRESETS = {
    canyon: {
      name: 'Redrock Canyon',
      description: 'Fast sandstone sweep with a high outer turn and a home-straight finish.',
      gates: [
        [0, 4, -24], [0, 4, -56], [25, 7, -91], [60, 9, -100],
        [85, 6, -70], [65, 5, -25], [35, 5, 12], [0, 4, 18],
      ],
    },
    foundry: {
      name: 'The Foundry',
      description: 'A compact industrial loop with low container lanes and a broad return arc.',
      gates: [
        [0, 4, -24], [0, 4, -56], [-24, 6, -88], [-58, 7, -74],
        [-72, 4.5, -31], [-51, 5, 10], [-19, 7, 31], [0, 4, 18],
      ],
    },
    alpine: {
      name: 'Alpine Run',
      description: 'A climbing ridge circuit with taller gates and a descending final sector.',
      gates: [
        [0, 4, -24], [0, 4, -56], [19, 11, -89], [53, 15, -82],
        [79, 10, -45], [62, 13, -8], [30, 8, 25], [0, 4, 18],
      ],
    },
  };

  function segmentIntersectsExpandedBox(a, b, box, margin) {
    var low = 0;
    var high = 1;
    for (var axis = 0; axis < 3; axis += 1) {
      var delta = b[axis] - a[axis];
      var min = box.min[axis] - margin;
      var max = box.max[axis] + margin;
      if (Math.abs(delta) < EPS) {
        if (a[axis] < min || a[axis] > max) return false;
      } else {
        var t0 = (min - a[axis]) / delta;
        var t1 = (max - a[axis]) / delta;
        if (t0 > t1) {
          var swap = t0;
          t0 = t1;
          t1 = swap;
        }
        low = Math.max(low, t0);
        high = Math.min(high, t1);
        if (low > high) return false;
      }
    }
    return true;
  }

  function obstacleClear(box, points) {
    for (var i = 1; i < points.length; i += 1) {
      if (segmentIntersectsExpandedBox(points[i - 1], points[i], box, 10)) return false;
    }
    if (points.length > 2 && segmentIntersectsExpandedBox(points[points.length - 1], points[1], box, 10)) return false;
    return true;
  }

  function makeObstacles(random, points, preset) {
    var obstacles = [];
    var wanted = preset === 'foundry' ? 20 : 15;
    for (var attempt = 0; attempt < 500 && obstacles.length < wanted; attempt += 1) {
      var width = 3 + random() * (preset === 'foundry' ? 9 : 13);
      var depth = 3 + random() * (preset === 'foundry' ? 16 : 11);
      var height = 2.5 + random() * (preset === 'alpine' ? 14 : 8);
      var x = -120 + random() * 240;
      var z = -125 + random() * 175;
      var box = {
        min: [x - width * 0.5, 0, z - depth * 0.5],
        max: [x + width * 0.5, height, z + depth * 0.5],
        kind: preset === 'foundry' || random() > 0.58 ? 'container' : 'rock',
      };
      if (!obstacleClear(box, points)) continue;

      var separated = true;
      for (var j = 0; j < obstacles.length; j += 1) {
        var other = obstacles[j];
        if (
          box.min[0] < other.max[0] + 2 && box.max[0] > other.min[0] - 2 &&
          box.min[2] < other.max[2] + 2 && box.max[2] > other.min[2] - 2
        ) {
          separated = false;
          break;
        }
      }
      if (separated) obstacles.push(box);
    }
    return obstacles;
  }

  function createCourse(seed, presetName) {
    seed = seed == null ? '' : String(seed);
    presetName = Object.prototype.hasOwnProperty.call(PRESETS, presetName) ? presetName : 'canyon';
    var preset = PRESETS[presetName];
    var random = randomGenerator(presetName + ':' + seed);
    var positions = preset.gates.map(function (point, index) {
      var result = point.slice();
      if (index >= 2 && seed !== '') {
        result[0] += (random() - 0.5) * 5;
        result[1] = Math.max(3.5, result[1] + (random() - 0.5) * 2.4);
        result[2] += (random() - 0.5) * 5;
      }
      return result;
    });
    var start = [0, 0.65, 8];
    var previous = start;
    var gates = positions.map(function (position) {
      var dx = position[0] - previous[0];
      var dz = position[2] - previous[2];
      var horizontal = Math.hypot(dx, dz) || 1;
      var normal = [dx / horizontal, 0, dz / horizontal];
      var gate = {
        p: position,
        normal: normal,
        right: [-normal[2], 0, normal[0]],
        radius: 4.5,
      };
      previous = position;
      return gate;
    });
    var points = [start].concat(positions);
    var length = 0;
    for (var i = 0; i < positions.length; i += 1) {
      var next = positions[(i + 1) % positions.length];
      length += Math.hypot(
        next[0] - positions[i][0],
        next[1] - positions[i][1],
        next[2] - positions[i][2],
      );
    }
    return {
      seed: seed,
      preset: presetName,
      name: preset.name,
      description: preset.description,
      length: Math.round(length * 10) / 10,
      gates: gates,
      obstacles: makeObstacles(random, points, presetName),
      start: start,
      bounds: 180,
    };
  }

  function crossGate(previous, current, gate, craftRadius) {
    craftRadius = craftRadius == null ? 0.35 : Math.max(0, Number(craftRadius) || 0);
    var p0 = copy3(previous);
    var p1 = copy3(current);
    var center = gate.p;
    var normal = normalize3(gate.normal, [0, 0, -1]);
    var startSide = (p0[0] - center[0]) * normal[0] + (p0[1] - center[1]) * normal[1] + (p0[2] - center[2]) * normal[2];
    var endSide = (p1[0] - center[0]) * normal[0] + (p1[1] - center[1]) * normal[1] + (p1[2] - center[2]) * normal[2];
    var forward = startSide < -EPS && endSide >= -EPS;
    var backward = startSide > EPS && endSide <= EPS;
    var direction = forward ? 1 : backward ? -1 : 0;
    if (!forward) return { crossed: false, missed: false, direction: direction };

    var denominator = startSide - endSide;
    var t = Math.abs(denominator) > EPS ? startSide / denominator : 0;
    t = clamp(t, 0, 1);
    var hit = [
      p0[0] + (p1[0] - p0[0]) * t,
      p0[1] + (p1[1] - p0[1]) * t,
      p0[2] + (p1[2] - p0[2]) * t,
    ];
    var offset = [hit[0] - center[0], hit[1] - center[1], hit[2] - center[2]];
    var axial = dot3(offset, normal);
    var radial = Math.sqrt(Math.max(0, dot3(offset, offset) - axial * axial));
    var aperture = Math.max(0, Number(gate.radius) - craftRadius);
    return {
      crossed: radial <= aperture + EPS,
      missed: radial > aperture + EPS && radial < 30,
      direction: 1,
    };
  }

  function sphereBoxContact(position, radius, box) {
    var closest = [
      clamp(position[0], box.min[0], box.max[0]),
      clamp(position[1], box.min[1], box.max[1]),
      clamp(position[2], box.min[2], box.max[2]),
    ];
    var delta = [position[0] - closest[0], position[1] - closest[1], position[2] - closest[2]];
    var distance = length3(delta);
    if (distance >= radius) return null;
    if (distance > EPS) {
      return { normal: [delta[0] / distance, delta[1] / distance, delta[2] / distance], depth: radius - distance };
    }

    var candidates = [
      { distance: position[0] - box.min[0], normal: [-1, 0, 0] },
      { distance: box.max[0] - position[0], normal: [1, 0, 0] },
      { distance: position[1] - box.min[1], normal: [0, -1, 0] },
      { distance: box.max[1] - position[1], normal: [0, 1, 0] },
      { distance: position[2] - box.min[2], normal: [0, 0, -1] },
      { distance: box.max[2] - position[2], normal: [0, 0, 1] },
    ];
    candidates.sort(function (a, b) { return a.distance - b.distance; });
    return { normal: candidates[0].normal, depth: radius + Math.max(0, candidates[0].distance) };
  }

  function sweptSphereBoxContact(start, end, radius, box) {
    var enter = 0;
    var exit = 1;
    var enterNormal = null;
    for (var axis = 0; axis < 3; axis += 1) {
      var delta = end[axis] - start[axis];
      var min = box.min[axis] - radius;
      var max = box.max[axis] + radius;
      if (Math.abs(delta) < EPS) {
        if (start[axis] < min || start[axis] > max) return null;
        continue;
      }
      var near = (min - start[axis]) / delta;
      var far = (max - start[axis]) / delta;
      var normalSign = -1;
      if (near > far) {
        var swap = near;
        near = far;
        far = swap;
        normalSign = 1;
      }
      if (near > enter) {
        enter = near;
        enterNormal = [0, 0, 0];
        enterNormal[axis] = normalSign;
      }
      exit = Math.min(exit, far);
      if (enter > exit) return null;
    }
    if (!enterNormal || enter < 0 || enter > 1) return null;
    return {
      t: enter,
      normal: enterNormal,
      point: [
        start[0] + (end[0] - start[0]) * enter,
        start[1] + (end[1] - start[1]) * enter,
        start[2] + (end[2] - start[2]) * enter,
      ],
    };
  }

  function ringDistance(position, gate) {
    var normal = normalize3(gate.normal, [0, 0, -1]);
    var center = gate.p;
    var offset = [position[0] - center[0], position[1] - center[1], position[2] - center[2]];
    var axial = dot3(offset, normal);
    var plane = [
      offset[0] - normal[0] * axial,
      offset[1] - normal[1] * axial,
      offset[2] - normal[2] * axial,
    ];
    var radial = length3(plane);
    var radialDirection = radial > EPS
      ? [plane[0] / radial, plane[1] / radial, plane[2] / radial]
      : normalize3(gate.right, [1, 0, 0]);
    var inner = Math.max(0, Number(gate.radius) || 4.5);
    var outer = inner + 0.5;
    var halfThickness = 0.325;
    var closestRadial = clamp(radial, inner, outer);
    var closestAxial = clamp(axial, -halfThickness, halfThickness);
    var deltaRadial = radial - closestRadial;
    var deltaAxial = axial - closestAxial;
    var distance = Math.hypot(deltaRadial, deltaAxial);
    var contactNormal;
    var insideDepth = 0;
    if (distance > EPS) {
      contactNormal = [
        (radialDirection[0] * deltaRadial + normal[0] * deltaAxial) / distance,
        (radialDirection[1] * deltaRadial + normal[1] * deltaAxial) / distance,
        (radialDirection[2] * deltaRadial + normal[2] * deltaAxial) / distance,
      ];
    } else {
      var toInner = radial - inner;
      var toOuter = outer - radial;
      var toFace = halfThickness - Math.abs(axial);
      if (toInner <= toOuter && toInner <= toFace) {
        contactNormal = [-radialDirection[0], -radialDirection[1], -radialDirection[2]];
        insideDepth = Math.max(0, toInner);
      } else if (toOuter <= toFace) {
        contactNormal = radialDirection;
        insideDepth = Math.max(0, toOuter);
      } else {
        var faceSign = axial < 0 ? -1 : 1;
        contactNormal = [normal[0] * faceSign, normal[1] * faceSign, normal[2] * faceSign];
        insideDepth = Math.max(0, toFace);
      }
    }
    return { distance: distance, normal: contactNormal, insideDepth: insideDepth };
  }

  function sphereRingContact(position, radius, gate) {
    var info = ringDistance(position, gate);
    if (info.distance >= radius) return null;
    return {
      normal: info.normal,
      depth: info.distance > EPS ? radius - info.distance : radius + info.insideDepth,
    };
  }

  function sweptSphereRingContact(start, end, radius, gate) {
    var path = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
    var pathLength = length3(path);
    if (pathLength < EPS) return null;
    var t = 0;
    for (var iteration = 0; iteration < 80; iteration += 1) {
      var point = [start[0] + path[0] * t, start[1] + path[1] * t, start[2] + path[2] * t];
      var info = ringDistance(point, gate);
      var gap = info.distance - radius;
      if (gap <= 1e-6) {
        return { t: t, point: point, normal: info.normal, depth: Math.max(1e-6, -gap + 1e-6) };
      }
      if (t >= 1) break;
      t = Math.min(1, t + Math.max(1e-6, gap * 0.9 / pathLength));
    }
    return null;
  }

  function Drone(settings) {
    this.settings = settings || {};
    this.mass = 0.7;
    this.radius = 0.35;
    this._collisionUntil = -1;
    this._lastImpactTime = -Infinity;
    this._altitudeTarget = 0.65;
    this._altitudeCommanded = false;
    this.reset({ start: [0, 0.65, 8] });
  }

  Drone.prototype.reset = function (course) {
    var start = course && Array.isArray(course.start) ? course.start : [0, 0.65, 8];
    this.p = copy3(start);
    this.v = [0, 0, 0];
    this.q = [0, 0, 0, 1];
    this.omega = [0, 0, 0];
    this.acc = [0, 0, 0];
    this.motor = 1 / Math.max(0.1, setting(this.settings, 'twr', 3.4, 0.1, 20));
    this.collision = { active: false, count: 0, impact: 0, kind: '' };
    this.time = 0;
    this._collisionUntil = -1;
    this._lastImpactTime = -Infinity;
    this._altitudeTarget = this.p[1];
    this._altitudeCommanded = false;
    return this;
  };

  Drone.prototype.recoverAt = function (position, orientation) {
    var count = this.collision && Number(this.collision.count) || 0;
    this.p = copy3(position || this.p);
    this.v = [0, 0, 0];
    this.q = normalizeQuat(orientation || [0, 0, 0, 1]);
    this.omega = [0, 0, 0];
    this.acc = [0, 0, 0];
    this.motor = 1 / Math.max(0.1, setting(this.settings, 'twr', 3.4, 0.1, 20));
    this.collision = { active: false, count: count, impact: 0, kind: '' };
    this._collisionUntil = -1;
    this._lastImpactTime = -Infinity;
    this._altitudeTarget = this.p[1];
    this._altitudeCommanded = false;
    return this;
  };

  Drone.prototype._recordContact = function (impact, kind, threshold) {
    if (impact >= threshold && this.time - this._lastImpactTime > 0.5) {
      this.collision.count += 1;
      this.collision.impact = impact;
      this.collision.kind = kind;
      this.collision.active = true;
      this._collisionUntil = this.time + 0.5;
      this._lastImpactTime = this.time;
      return true;
    }
    return false;
  };

  Drone.prototype._resolveContact = function (normal, depth, kind, forgiveness) {
    if (!(depth > 0)) return false;
    this.p[0] += normal[0] * depth;
    this.p[1] += normal[1] * depth;
    this.p[2] += normal[2] * depth;
    var into = dot3(this.v, normal);
    if (into < 0) {
      var impact = -into;
      var restitution = 0.1 + forgiveness * 0.18;
      this.v[0] -= normal[0] * into * (1 + restitution);
      this.v[1] -= normal[1] * into * (1 + restitution);
      this.v[2] -= normal[2] * into * (1 + restitution);
      var normalSpeed = dot3(this.v, normal);
      var tangent = [
        this.v[0] - normal[0] * normalSpeed,
        this.v[1] - normal[1] * normalSpeed,
        this.v[2] - normal[2] * normalSpeed,
      ];
      var friction = 0.28 + forgiveness * 0.24;
      this.v[0] -= tangent[0] * friction;
      this.v[1] -= tangent[1] * friction;
      this.v[2] -= tangent[2] * friction;
      this._recordContact(impact, kind, 2.3 + forgiveness * 2.3);
    }
    return true;
  };

  Drone.prototype._collide = function (previousPosition, course, forgiveness) {
    if (this.p[1] < this.radius) {
      this._resolveContact([0, 1, 0], this.radius - this.p[1], 'ground', forgiveness);
      if (Math.abs(this.v[1]) < 0.35) this.v[1] = Math.max(0, this.v[1]);
      this.v[0] *= 0.985;
      this.v[2] *= 0.985;
    }

    var obstacles = course && Array.isArray(course.obstacles) ? course.obstacles : [];
    for (var i = 0; i < obstacles.length; i += 1) {
      var obstacle = obstacles[i];
      if (!obstacle || !obstacle.min || !obstacle.max) continue;
      var contact = sphereBoxContact(this.p, this.radius, obstacle);
      if (contact) {
        this._resolveContact(contact.normal, contact.depth, obstacle.kind || 'obstacle', forgiveness);
      } else {
        var sweptBox = sweptSphereBoxContact(previousPosition, this.p, this.radius, obstacle);
        if (sweptBox) {
          this.p = sweptBox.point;
          this._resolveContact(sweptBox.normal, 1e-6, obstacle.kind || 'obstacle', forgiveness);
        }
      }
    }

    var gates = course && Array.isArray(course.gates) ? course.gates : [];
    for (var gateIndex = 0; gateIndex < gates.length; gateIndex += 1) {
      var gate = gates[gateIndex];
      if (!gate || !gate.p || !gate.normal) continue;
      var ringContact = sphereRingContact(this.p, this.radius, gate);
      if (ringContact) {
        this._resolveContact(ringContact.normal, ringContact.depth, 'gate', forgiveness);
      } else {
        var sweptRing = sweptSphereRingContact(previousPosition, this.p, this.radius, gate);
        if (sweptRing) {
          this.p = sweptRing.point;
          this._resolveContact(sweptRing.normal, sweptRing.depth, 'gate', forgiveness);
        }
      }
    }
  };

  Drone.prototype.step = function (dt, input, course) {
    dt = clamp(dt, 0, 1 / 60);
    if (dt <= 0) return { collision: false };
    var previousPosition = copy3(this.p);
    input = input || {};
    var throttle = clamp(input.throttle, -1, 1);
    var pitch = clamp(input.pitch, -1, 1);
    var roll = clamp(input.roll, -1, 1);
    var yaw = clamp(input.yaw, -1, 1);
    var gravity = setting(this.settings, 'gravity', 9.81, 0, 40);
    var twr = setting(this.settings, 'twr', 3.4, 0.1, 20);
    var drag = setting(this.settings, 'drag', 0.3, 0, 5);
    var rates = setting(this.settings, 'rates', 180, 10, 1440) * DEG;
    var expoAmount = setting(this.settings, 'expo', 0.3, 0, 1);
    var autoLevel = setting(this.settings, 'autoLevel', 0.9, 0, 1);
    var altHold = setting(this.settings, 'altHold', 0.85, 0, 1);
    var antiCrash = setting(this.settings, 'antiCrash', 0.6, 0, 1);
    var forgiveness = setting(this.settings, 'forgiveness', 0.65, 0, 1);
    var mode = this.settings && this.settings.mode;
    if (mode !== 'angle' && mode !== 'horizon' && mode !== 'acro') mode = 'angle';

    throttle = expo(throttle, expoAmount);
    pitch = expo(pitch, expoAmount);
    roll = expo(roll, expoAmount);
    yaw = expo(yaw, expoAmount);

    this.q = normalizeQuat(this.q);
    var localUp = inverseRotateVector(this.q, [0, 1, 0]);
    var angleLimit = 30 * DEG;
    var restorationGain = 7.5 * autoLevel;
    var commandGain = 7.5;
    var desiredUpX = -Math.sin(roll * angleLimit);
    var desiredUpZ = Math.sin(pitch * angleLimit);
    var anglePitchRate = clamp(localUp[2] * restorationGain - desiredUpZ * commandGain, -rates, rates);
    var angleRollRate = clamp(desiredUpX * commandGain - localUp[0] * restorationGain, -rates, rates);
    var acroPitchRate = -pitch * rates;
    var acroRollRate = -roll * rates;
    var targetOmega;
    if (mode === 'acro') {
      targetOmega = [acroPitchRate, -yaw * rates, acroRollRate];
    } else if (mode === 'horizon') {
      var pitchBlend = Math.min(1, Math.abs(pitch) * 1.25);
      var rollBlend = Math.min(1, Math.abs(roll) * 1.25);
      targetOmega = [
        anglePitchRate * (1 - pitchBlend) + acroPitchRate * pitchBlend,
        -yaw * rates,
        angleRollRate * (1 - rollBlend) + acroRollRate * rollBlend,
      ];
    } else {
      targetOmega = [anglePitchRate, -yaw * rates, angleRollRate];
    }

    var height = this.p[1] - this.radius;
    var danger = antiCrash * clamp((3 - height) / 3, 0, 1);
    var tilt = clamp(1 - localUp[1], 0, 1);
    if (danger > 0 && tilt > 0.08) {
      targetOmega[0] += localUp[2] * 8 * danger;
      targetOmega[2] -= localUp[0] * 8 * danger;
    }

    var inertia = [0.0045, 0.008, 0.0045];
    var responseTime = [0.065, 0.09, 0.065];
    for (var axis = 0; axis < 3; axis += 1) {
      var torque = inertia[axis] * (targetOmega[axis] - this.omega[axis]) / responseTime[axis];
      var angularAcceleration = torque / inertia[axis] - this.omega[axis] * 0.08;
      this.omega[axis] += angularAcceleration * dt;
      this.omega[axis] = clamp(this.omega[axis], -rates * 1.35, rates * 1.35);
    }
    this.q = integrateQuat(this.q, this.omega, dt);

    var bodyUp = rotateVector(this.q, [0, 1, 0]);
    var hoverMotor = 1 / twr;
    var rawMotorTarget = throttle >= 0
      ? hoverMotor + throttle * (1 - hoverMotor)
      : hoverMotor * (1 + throttle);
    var motorTarget = rawMotorTarget;
    if (mode !== 'acro' && altHold > 0) {
      var commanded = Math.abs(throttle) > 0.05;
      var desiredAcceleration;
      if (commanded) {
        var desiredVerticalSpeed = throttle * 6;
        desiredAcceleration = (desiredVerticalSpeed - this.v[1]) * 3.2;
        this._altitudeTarget = this.p[1] + clamp(desiredVerticalSpeed * 0.15, -1, 1);
        this._altitudeCommanded = true;
      } else {
        if (this._altitudeCommanded) {
          this._altitudeTarget = this.p[1] + clamp(this.v[1] * 0.15, -1.1, 1.1);
          this._altitudeCommanded = false;
        }
        var altitudeError = clamp(this._altitudeTarget - this.p[1], -3, 3);
        desiredAcceleration = altitudeError * 6 - this.v[1] * 6;
      }
      var verticalThrust = Math.max(0.2, bodyUp[1]);
      var controlledMotor = (gravity + desiredAcceleration) / Math.max(1, gravity * twr * verticalThrust);
      motorTarget = rawMotorTarget * (1 - altHold) + clamp(controlledMotor, 0, 1) * altHold;
    } else {
      this._altitudeTarget = this.p[1];
      this._altitudeCommanded = false;
    }
    motorTarget = clamp(motorTarget, 0, 1);
    var motorResponse = 1 - Math.exp(-dt / 0.075);
    this.motor += (motorTarget - this.motor) * motorResponse;
    this.motor = clamp(this.motor, 0, 1);

    var thrustAcceleration = gravity * twr * this.motor;
    var rescueAcceleration = danger * (Math.max(0, -this.v[1]) * 2.2 + tilt * 2);
    this.acc = [
      bodyUp[0] * thrustAcceleration - this.v[0] * drag / this.mass,
      bodyUp[1] * thrustAcceleration - gravity - this.v[1] * drag / this.mass + rescueAcceleration,
      bodyUp[2] * thrustAcceleration - this.v[2] * drag / this.mass,
    ];
    for (var component = 0; component < 3; component += 1) {
      if (!Number.isFinite(this.acc[component])) this.acc[component] = 0;
      this.v[component] += this.acc[component] * dt;
      this.v[component] = clamp(this.v[component], -150, 150);
      this.p[component] += this.v[component] * dt;
      if (!Number.isFinite(this.p[component])) {
        this.p[component] = component === 1 ? this.radius : 0;
        this.v[component] = 0;
      }
    }

    this.time += dt;
    var countBefore = this.collision.count;
    this._collide(previousPosition, course, forgiveness);
    if (this.time > this._collisionUntil) {
      this.collision.active = false;
      this.collision.impact = 0;
      this.collision.kind = '';
    }
    return { collision: this.collision.count !== countBefore, kind: this.collision.kind, impact: this.collision.impact };
  };

  root.DroneCore = {
    Drone: Drone,
    createCourse: createCourse,
    crossGate: crossGate,
    math: {
      clamp: clamp,
      dot3: dot3,
      normalize3: normalize3,
      normalizeQuat: normalizeQuat,
      rotateVector: rotateVector,
      inverseRotateVector: inverseRotateVector,
    },
  };
})(globalThis);
