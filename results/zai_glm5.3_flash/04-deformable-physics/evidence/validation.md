# Validation Evidence — Deformable Physics Playground

Artifact: `index.html` (single self-contained file, no build, no external assets).
Tested with: `agent-browser` (Chrome via CDP) against a local HTTP server
(`python3 -m http.server 8137`) and against a direct `file://` URL.
All numbers below were read from the live page via `window.__sim` diagnostics
and real CDP pointer/keyboard input (`mouse move/down/up`, button clicks,
slider `input` events).

## Environment note (headless frame throttling)

The headless browser intermittently suspends `requestAnimationFrame` between
CLI commands. During those windows the page's timers/rAF pause (browser-level
throttling, no page errors) and canvas state looks "frozen". All physics
measurements below were therefore taken inside single evaluations or by
advancing the sim deterministically via the exposed `__sim.step(n)` hook
(`physicsStep` per call). A soak test with sustained real pointer interaction
held **60 steps/s** throughout (`samples: 60.0 st/s`). This is an environment
artifact, not an application defect; real (visible-tab) usage is unaffected.

## Results

| # | Check | Method | Result |
|---|-------|--------|--------|
| 1 | Boot, defaults | open page, read `__sim.stats()` | PASS — 265 particles, 1368 constraints, 11 pins, 60 fps, 0 tears |
| 2 | Console errors | `agent-browser errors` / `console` after every phase | PASS — no errors, no failed requests (final check below) |
| 3 | Grab & drag cloth | CDP `mouse down/move/up` slow drag across flag | PASS — cloth centroid followed pointer (22.7,24.6)→(35,19) world units; 0 constraints torn at gentle pace; 3-region nick only under sustained hard drag (see note) |
| 4 | Violent yank tears | 20-unit jump drag | PASS — 13–74 constraints torn (threshold-dependent), hole persists; `cons` count drops and never regenerates |
| 5 | Pin / unpin | Pin tool click on cloth particle | PASS — pinned 11→12→11, targeted particle `pin` flag toggled both ways |
| 6 | Cut constraints | Cut tool sweep across flag hoist | PASS — 65 constraints removed in slow sweep; **306 removed by a single fast jump sweep**; slit visible and permanent (cons count stable 1.2 s later) |
| 7 | Gust (impulse) | Burst at elastic ball; directed gust at flag | PASS — burst creates outward impulse (radial pop, max particle speed ≈14 u/s at speed 200); ball center cancels symmetric burst (expected); directed gust visibly deflects cloth |
| 8 | Tearing alters constraint graph | `torn` counter + `cons.length` after overload | PASS — torn constraints removed permanently; low threshold (1.15) under wind alone tore 380 constraints (988 left) |
| 9 | Solver iterations effect | Bridge at 1 vs 12 iterations | PASS — deck collapses to floor at 1 iteration; holds with ~4-unit sag at 12 |
| 10 | Stiffness effect | Flag free-end height at stiff 1.0 vs 0.3 (wind 0) | PASS — free end y=22.7 (near-rigid shelf) vs y=4 (fully draped) |
| 11 | Wind effect | Flag free-end position at wind 0 vs 14 | PASS — hangs/folds down (corner y=5.2) vs streams out (corner y≈26, x=31.8) |
| 12 | Tear threshold effect | Threshold 1.15 vs 3.0, same wind | PASS — 380 vs 0 tears |
| 13 | Timestep effect | 120 steps at 33 ms vs 8 ms | PASS — deck settles to 0.1 vs still falling at 2.1 (sim-time consistent) |
| 14 | Collision thickness effect | pairs at 0.4× vs 2.4× | PASS — 322 vs 11 335 collision pairs |
| 15 | Pause | Pause button; watch `__steps` | PASS — physics halted while paused |
| 16 | Single-step | Step button; free particle displacement | PASS — exactly 1 step (Δ=(0.0008, −0.0059) for free rope particle) |
| 17 | Reset | Reset button | PASS — world rebuilt (fresh counts, torn=0), scenario preserved |
| 18 | Viz modes don't reset | Cycle all 8 modes | PASS — particle/constraint counts identical after full cycle |
| 19 | Stress visualization | Stress mode during wrecking-ball run | PASS — blue→yellow→red strain colormap; red concentrations exactly at tearing regions (`viz_stress.png`) |
| 20 | Constraint / contacts / velocity / grid / pinned modes | Screenshots | PASS — constraint mesh, contact points+normals, velocity vectors, occupancy-shaded broad-phase cells, pin highlights (`viz_*.png`) |
| 21 | Scenarios (7) | Load each, settle 10 sim-seconds | PASS — flag 0 tears; drape 0; bridge 0 (sags under load, `bridge_sag.png`); stack 0 (pit walls added); ropes 0; balloons 0 (taut tethers, floats); stress intentionally shreds (892 tears at tear=1.3). No NaN, nothing below floor / above ceiling in any scenario |
| 22 | Spawn all types | Spawn tool drag-gestures: rope, cloth, ball, blob, balloon, circle, box | PASS — particles 265→616, obstacles 1→3, bodies 3→8; spawned blob wraps around spawned ball (deformable-deformable contact) |
| 23 | Inter-body collision | Spawned pile + scenarios | PASS — balls rest on deck, blob wraps ball, flag tip hits ground balls; collision pairs live-counted in HUD |
| 24 | Resize / world coherence | Live viewport change 1280×800→1280×577→back | PASS — walls/floor track viewport, bodies re-clamped, 0 particles outside bounds after shrink-back, coordinates continuous |
| 25 | Narrow viewport 390×844 | Set viewport, load scenario, screenshot | PASS — toolbar wraps, HUD compact, flag fills view, physics stable (`mobile_390x844.png`) |
| 26 | High-DPI | devicePixelRatio backing store + world transform | PASS by construction (canvas.width = css×dpr); rendered crispness visible in all screenshots |
| 27 | Direct file:// open | `open file://…/index.html` | PASS — sim boots and runs, 0 errors, network log shows only the document itself |
| 28 | Network isolation | `network requests` after fresh load | PASS — single document request; favicon is a data URI; no external assets |
| 29 | Performance | FPS HUD across scenarios | PASS — 57–60 fps flag/drape/stack/ropes/balloons; 52–56 fps heaviest (stress: 656 particles, 3287 constraints, ~2000 pairs) |
| 30 | Final atomic regression | One-eval sequence on fresh load: run, drag (pointer events), pin/unpin, cut sweep, gust, scenario switch, pause, step, reset, viz cycle | PASS — 10/10 checks (see below) |

Note on #3: cloth develops small nicks at the grab site under *sustained hard*
drag (grab-site strain concentration is physical). A 2-substep tear debounce
was added so single-frame spikes never tear; threshold/grab-strength sliders
control the sensitivity directly.

## Final atomic regression (fresh load, single evaluation)

```
r1_flag_running        true   (265 parts / 1368 cons / not paused)
r2_drag                true   (cloth centroid followed synthetic+CDP pointer drags;
                              confirmed twice with CDP mouse: Δcentroid ≈ 12 units)
r3_pin / r3_unpin      true / true   (11 → 12 → 11 pinned)
r4_cut                 true   (single fast sweep removed 306 constraints)
r5_gust                true   (burst impulse → max particle speed > 3 u/s)
r6_bridge              true   (scenario switch, 300 steps, all finite)
r7_pause               true   (physics halted)
r8_step                true   (exactly 1 solver step per Step press)
r9_reset               true   (world rebuilt, torn=0, scenario preserved)
r10_viz_no_reset       true   (mode cycle leaves world state untouched)
```

Two early "failures" during regression authoring were test errors, not app
errors: (a) aiming tool sweeps at stale screen coordinates after the browser
viewport changed, and (b) measuring centroid drift on a body pinned at both
ends (bridge deck centroid is invariant by design). Grab build was verified
directly (`grabCount=42` when aiming at a particle).

## Bugs found and fixed during validation

1. **Velocity energy pump** — collision response computed velocity after the
   positional correction, turning every clamp into injected velocity →
   spontaneous cloth shredding. Fixed by using pre-correction velocities.
2. **Cloth built through the ceiling** — grid rows advanced in −y-up world
   incorrectly; flag cloth was born above the ceiling and fought the boundary
   (304% strain at load). Fixed row direction.
3. **Rigid cloth (no sag/fold)** — per-iteration stiffness compensation
   compounded over substeps×iterations → ~99.9% convergence per frame.
   Replaced with **XPBD compliance** (iteration-count-independent softness,
   per-material multipliers); cloth now sags, folds, billows physically.
4. **Balloons couldn't lift tethers** — rope mass 23× balloon lift; balloons
   now light (m 0.1, gscale −2.4) with light tether ropes (density ×0.12),
   attached at the balloon's bottom with near-zero rest gap.
5. **Bridge/stress self-destruction on load** — shear/edge made non-tearable,
   tear debounce added, per-material stiffness (firm balls, stiff deck),
   scenario loads rebalanced.
6. **Stripe rendering artifacts** — stripes were keyed on world position and
   zigzagged while waving; now keyed on stored material row/col.
7. **Stack pyramid rolled apart / net let the ball through** — added pit
   walls; net converted to a sheared soft trampoline.

## Remaining limitations

- Self-collision is particle-based (approximate): dense crumples can let
  sheets interpenetrate slightly; cloth-vs-cloth uses a reduced same-body
  margin (selfK 0.55).
- Density slider affects newly spawned objects only (labeled as such).
- Max-constraint-error is a transient peak (includes impact spikes).
- Balloon in Balloon Chamber can get trapped under the shelf (physically
  plausible; gust tool frees it).
- Tear nicks can appear at the grab site during sustained hard drags
  (physical; adjustable via interaction strength / tear threshold).
