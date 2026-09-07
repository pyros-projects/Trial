# Independent engine review

Reviewed `evidence/physics.js` against `evidence/engine-brief.md`, including the implementation report and behavioral tests. No engine or test code was modified.

**Current specification verdict: approved for the reviewed scope.** The requested API, Newtonian pairwise backreaction, softened force/potential, velocity Verlet, exact ordinary scheduled burns, adaptive integration, conservation offsets, frames, and seven scenarios are implemented. Both findings from the initial review below have been repaired and independently verified.

**Current quality verdict: approved for the reviewed scope.** The numerical foundation and the two targeted fixes are sound. New behavioral regressions cover interpolation across merge/bounce events and durations smaller than the current clock's floating-point precision. The original findings are retained below as historical evidence, not outstanding requests.

## Targeted re-review

Command: `node --test evidence/physics.test.cjs`

Observed after the fixes: **14 tests passed, 0 failed, exit 0**, duration 127.824979 ms.

- **P2 resolved:** prediction detects collision events within an interpolation interval and uses the entire preceding body snapshot before contact. This preserves mass, topology and velocities coherently; at the event boundary it uses the actual integrated post-contact state. The regression verifies both merge and bounce behavior, all sample live-mass totals, and unchanged pre-event velocities. Holding positions during that one integration interval is the documented approximation and does not alter live dynamics or event times.
- **P3 resolved:** `advanceInternal` now rejects a positive duration when adding it leaves the current time unchanged, before processing burns or integration. The regression verifies both `time=1e16, duration=1` and `time=1, duration=1e-20`, and confirms zero duration remains valid.

No additional findings were identified in this targeted re-review. Engine files were not modified by the reviewer.

## Verification

Command: `node --test evidence/physics.test.cjs`

Observed: **12 tests passed, 0 failed, exit 0**, duration 122.456665 ms. The suite exercises a full-period binary, backreaction, momentum/energy stability, exact burn timing and offsets, shared live/prediction final integration, rotating-frame velocity, merge conservation and primary reassignment, elastic bounce, orbital elements, and all preset horizons.

Code inspection confirms pair accelerations use opposite forces and the same softened distance as potential. Burn offsets measure actual total invariant change. The rotating velocity transform correctly subtracts origin velocity and the angular cross product before rotating. Prediction does not mutate its input and shares the full integration interval with `advance`.

## Findings

### Resolved P2: Collision intervals interpolate incompatible pre/post-collision body states

Location: `evidence/physics.js:127`–`135`.

`predict` starts an interpolated sample by cloning the post-step bodies. When a merger occurs at the end of the step, it restores the absorbed body's earlier state but leaves the survivor's new mass, radius and primary in every earlier sample. The survivor's position and velocity are then interpolated toward the merged center of mass and velocity. Thus both bodies can be alive while the survivor already includes the absorbed mass. Bounce velocity is likewise smoothly interpolated across an instantaneous contact rather than using the preceding state. This also contradicts the report's statement that collision-discontinuous intervals keep the preceding body state until contact.

Reproduce from the project root:

```js
require('./evidence/physics.js');
const body = (id, mass, x, vx) => ({
  id, name:id, type:'planet', mass, radius:1, scale:1,
  x, y:0, vx, vy:0, primary:null, alive:true
});
const s = {
  bodies:[body('a',2,-1.01,1), body('b',1,1.01,-1)],
  time:0, nodes:[], events:[], energyOffset:0,
  momentumOffset:{x:0,y:0}
};
const p = Orbital.predict(s, {
  G:0, dt:.04, softening:.02, collision:'merge',
  horizon:.04, resolution:4
});
console.log(p.events[0].time); // 0.04
console.log(p.samples[1].time); // 0.01
console.log(p.samples[1].bodies.map(b => [b.id,b.mass,b.alive,b.x]));
// [['a',3,true,-0.8977083333333333], ['b',1,true,1.01]]
```

The original total mass is 3, but the sample before the logged collision has total live mass 4. Switching to `collision:'bounce'` gives velocities `2/3` and `-1/3` at time .01 despite the logged impulse occurring at .04; the original velocities are 1 and -1.

Suggested repair: recognize collision events affecting either body in the interpolation interval and use a coherent preceding state for all affected body properties until the event, as already intended by the implementation report; alternatively expose actual pre-contact integration endpoints for interpolation. Add a regression that conserves sampled live mass and prevents early contact impulses. Do not change final integration/event timing just to align display samples.

### Resolved P3: Positive durations below clock precision silently do nothing

Location: `evidence/physics.js:105`–`107`.

The step-level precision guard only runs inside the loop. If `state.time + duration === state.time`, the loop never runs and `advance` returns zero without an error. This violates the brief's explicit no-silent-time-skipping contract.

Reproduce using the state above:

```js
s.time = 1e16;
console.log(Orbital.advance(s, 1, {G:0})); // 0, no exception
console.log(s.time); // 10000000000000000
```

The same issue occurs at ordinary time values with sufficiently tiny positive durations. Suggested repair: after calculating `end`, reject `duration > 0 && end === state.time`; retain zero-duration advances for immediate burns. Add a focused exception regression.

## Accepted limitations

The report accurately discloses approximate substep contact times, encounter minima measured on substeps, variable-step differences when callers partition the live interval differently, and osculating elements based on unsoftened two-body formulas. These are reasonable for this bounded planar engine. Ordinary burn interpolation explicitly removes endpoint impulse delta-v before interpolating preceding velocities. Collision intervals now hold the preceding complete snapshot until the contact event.
