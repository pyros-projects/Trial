# Flight core report

Implemented `evidence/flight-core.js` as an offline IIFE exposing:

```js
globalThis.DroneCore = {
  Drone,
  createCourse,
  crossGate,
  math: { clamp, dot3, normalize3, normalizeQuat, rotateVector, inverseRotateVector }
};
```

`Drone` keeps the supplied settings object by reference, so tuning changes apply on the next fixed step. Its state includes position, velocity, body-to-world quaternion, body angular velocity, world acceleration, lagged collective motor value, collision diagnostics, mass, radius, and simulation time. The integrator clamps frames to 1/60 s and is intended for 1/120 s calls. `recoverAt(position, quaternion)` clears motion and active contact state, primes altitude hold at the selected recovery height, and preserves elapsed race time plus the total collision count.

The flight model includes body-up thrust, gravity, linear aerodynamic drag, motor lag, inertia-based angular response, signed pitch/roll/yaw controls, angle/horizon/acro controllers, assisted altitude hold, descent/tilt-triggered anti-crash correction, quaternion normalization, and finite-state guards. Stick expo applies to throttle as well as rotational axes. Assisted throttle blends raw collective with a gravity-compensated controller targeting up to 6 m/s vertically; release captures a bounded predicted altitude without target windup. Acro remains raw, and partial `altHold` values preserve proportional manual authority. Angle mode retains pitch/roll command authority at `autoLevel=0` while the slider continues to control attitude restoration.

Ground, AABB, and circular gate-rim contacts resolve sphere penetration with restitution and tangent friction. Gate rims use the rendered dimensions: 4.5 m inner radius, 5.0 m outer radius, and 0.65 m axial thickness. Conservative swept sphere/ring contact catches a 150 m/s one-frame strike while leaving the craft-adjusted aperture clear; swept expanded-box contact prevents the same tunneling failure on thin obstacle faces. Hard impacts have a forgiveness-scaled threshold and a 0.5 s event cooldown/active window, preventing repeated landing penalties.

`createCourse(seed, preset)` produces deterministic canyon, foundry, and alpine eight-gate loops named Redrock Canyon, The Foundry, and Alpine Run. The default canyon positions match the specified centers. Seed variation affects gates 3–8 modestly while preserving the opening two gates. Gate normals follow each incoming horizontal segment, frames use right vectors orthogonal to those normals, and loop length includes the final-to-first leg. Generated rock/container boxes are rejected whenever their 10 m expansion intersects a route segment or spawn corridor.

`crossGate(previous, current, gate, craftRadius)` performs swept signed-plane intersection. It reports only negative-to-positive aperture crossings as successful, subtracts craft radius from the aperture, distinguishes reverse direction, reports near-plane misses, and ignores distant plane crossings.

Test-first evidence:

- Initial run: 0/12 tests passed because `flight-core.js` did not exist.
- First implementation run: 11/12 passed; the failed descent check exposed an overly strong quadratic drag interpretation, corrected to linear drag.
- Added loop-length regression: failed at 315.1 m versus the 324.9 m closed loop, then passed after closing-leg accounting.
- Added neutral anti-crash regression: failed after an unintended 0.65 m climb in one second, then passed after rescue lift was limited to descent/tilt demand.
- Integration review regressions first failed for preset labels, missing `recoverAt`, absent gate collisions, obstacle tunneling, uncontrolled assisted climb, missing throttle expo, and zero angle-mode authority at `autoLevel=0`; each passed after its focused implementation.
- Final suite covers API/reset/recovery state, deterministic preset generation and path clearance, gate frames and swept aperture crossings, physical gate/obstacle impacts through 150 m/s, motor/gravity/thrust behavior, independent signed axes, assisted versus acro response, commanded climb and release capture, throttle expo, altitude hold, anti-crash behavior, sustained quaternion stability, frame clamping/live settings, and ground contact behavior.

Verification command: `node --test evidence/core.test.cjs`.
