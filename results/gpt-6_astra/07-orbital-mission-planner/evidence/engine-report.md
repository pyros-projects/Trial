# Orbital engine verification

Delivered `evidence/physics.js` as a browser-independent IIFE exposing the requested `globalThis.Orbital` API. No API changes were required. `accelerations` returns an array of `{x,y}` accelerations aligned with the input body order; it accepts a state or body array. Inactive merged bodies remain in the body array with `alive:false`; all physics and diagnostics exclude them.

Implemented pairwise softened Newtonian forces, velocity Verlet integration, encounter-dependent substeps, exact scheduled impulses, merge/bounce/pass contact behavior, conservation diagnostics, osculating elements, four reference frames, shared live/prediction dynamics, and seven presets. Merges redirect surviving body primary IDs and node primary IDs. Energy/momentum offsets account for impulses and collision changes. Prediction closest approaches are measured at every integration substep, including the initial state.

## Test commands and results

Command: `node --test evidence/physics.test.cjs`

Initial test-first run with no engine: 11 tests, 1 pass, 10 fail; the explicit API assertion failed because the engine was absent. First implementation: 10 pass, 1 fail. Prediction endpoint differed by 0.00577 units because display sample boundaries changed encounter integration steps. Prediction now runs the identical full integration interval as live advance and obtains evenly spaced display positions by cubic Hermite interpolation between its integration states. Endpoint agreement test then passed.

A further preset check initially failed: lunar departure angle missed Luna by 99.27 units. The departure angle now anticipates Luna's travel during the ellipse's half-period, and the encounter check passes.

Final run: **12 tests passed, 0 failed, exit 0**, duration 234.47 ms.

Coverage:
- Full-period isolated binary radial error below 0.2%, relative energy error below 1e-7, momentum error below 1e-10; both massive bodies move.
- Cartesian impulse executes once at time 0.073 within a larger interval; exact post-burn displacement and intentional energy/momentum offsets.
- Orbital impulse basis uses relative velocity and outward radial direction.
- Predictions preserve their source, include exactly resolution+1 samples, reproduce live final positions within 5e-4, and include burn events and closest approaches.
- Rotating reference frame centers its primary and removes circular moon velocity.
- Merge conserves mass and momentum and redirects children; elastic contact reverses equal-mass approach velocities.
- Circular versus escaping osculating elements.
- All seven presets remain finite for their complete default horizon.
- Invalid dt and singular unsoftened force throw errors.
- Lunar intercept enters within 20 units of Luna.

## Practical limits

- Planar Newtonian model in dimensionless units. Orbital elements use unsoftened two-body osculating formulas; perturbers and softening mean these are instantaneous approximations.
- Prediction position samples use cubic Hermite interpolation; sampled velocity uses linear interpolation. The final state and event times come directly from the same integration as live advance. Sample positions are exact at integration boundaries, and collision-discontinuous intervals keep the preceding body state until contact.
- Live calls with different externally imposed interval boundaries can produce the normal small differences of variable-step numerical integration; prediction and a live call over the same full duration share identical steps.
- Closest approaches and contact times are resolved to integration substeps, rather than continuous root finding. Encounter control uses 4% of the pair dynamical time and 8% of the pair crossing time; minimum substep is 1e-7. Failure beyond two million substeps or floating-point time precision throws explicitly instead of silently skipping time.
- Three-body preset is deliberately unstable and produces mergers in its default prediction horizon. The two scheduled Hohmann burns are a two-body design with all perturbations still active.
- `advance` executes already-due, unexecuted nodes at current simulation time; a UI should disallow adding a node in the past if retroactive burns are undesired.

## Independent review corrections

Addressed both findings in `evidence/engine-review.md` without changing the API:

- Collision-discontinuous prediction samples now preserve the entire preceding body snapshot before the logged contact time. This preserves pre-merge masses, radii, primary relationships and alive flags together, and prevents an elastic impulse from appearing early. At the collision integration endpoint, the sample contains the actual post-contact state. The brief freeze lasts at most one integration substep; final state and event times are unchanged.
- A positive requested duration that rounds away when added to the simulation clock now throws a time-precision error before executing any burns. Zero-duration advances still execute immediately due burns as before.

Regression-first command: `node --test evidence/physics.test.cjs` produced **12 passes, 2 failures**: sampled live mass was 4 instead of 3 before a merger, and a positive duration below clock precision failed to throw.

After the precision guard, `node --test --test-name-pattern='positive duration' evidence/physics.test.cjs` produced **1 pass, 0 failures**.

After the collision fix, `node --test evidence/physics.test.cjs` produced **14 passes, 0 failures, exit 0**, duration 127.87 ms. The collision regression exercises both merge and bounce; the precision regression covers a large clock (1e16 plus 1), an ordinary clock (1 plus 1e-20), and valid zero-duration advance.
