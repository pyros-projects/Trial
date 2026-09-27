# Validation — Deformable Lab (soft-body, cloth & constraint playground)

Artifact: `../index.html` (single self-contained file, 185 KB, no external assets).
Validation date: 2026-09-27. Everything below was run against the final `index.html` unless marked as history.

## 1. Tooling and method

| Item | Detail |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (headless Chromium over CDP). Read `agent-browser skills get core`, `core --full` and the exploratory-testing skill `dogfood` before use. |
| Page load | **Direct file**: `agent-browser open file:///…/04-deformable-physics/index.html`. No HTTP server was needed or used. |
| Input | Every functional check drives the app with real browser input: `mouse move/down/up` (CDP input events, incl. multi-sample drags), `press` for keys, `click`/`select` on labelled controls. Sliders were set by clicking their tracks and then nudging with arrow keys. |
| State read-back | The app exposes a read-only diagnostics handle `window.__lab` (particle/body positions, constraint counts, stats). Tests read it through `agent-browser eval` to measure outcomes; they do not use it to cause the behaviour they check. The one exception is restoring gravity to 980 after the mobile drawer test (`test_viewport.py`), which is setup, not a check. |
| Test scripts | `evidence/scripts/harness.py` (driver), `test_tools.py`, `test_params.py`, `test_collisions.py`, `test_viewport.py`, `capture_stress.py` |
| Raw results | `evidence/interaction-*.json` (one per script) and `evidence/regression-summary.txt` (all 43 records) |
| Screenshots | `evidence/screenshots/` (85 PNGs; the key ones are listed per check below) |

Commands (run from `evidence/scripts/`, browser session `lab`, viewport 1280×800 unless the test changes it):

```bash
agent-browser --session lab set viewport 1280 800 1
agent-browser --session lab open "file://$PWD/../../index.html"
python3 test_tools.py        # edit tools + spawning
python3 test_params.py       # sliders, visualization modes, pause/step/reset, help
python3 test_collisions.py   # inter-body collisions, self-collision
python3 test_viewport.py     # fast input, resize, HiDPI, 390x844, network, performance, console
python3 capture_stress.py    # stress view / imminent-tear highlighting
```

## 2. Final results (final build): 42 pass, 0 fail, 1 informational

### Edit tools (real pointer drags and clicks) — `test_tools.py`
| Check | Result | Observed |
|---|---|---|
| Grab & drag a soft body | **pass** | Soft box carried from (1510,876) to (1439,540) for target (1438,540); it fell back after release. `t01-grab-drag-held.png` |
| Tear cloth by dragging | **pass** | Yanking the showcase screen tore 257 constraints (79→336). The holes are still there after release. `t02-tear-drag-held.png`, `t02-tear-after-release.png` |
| Pin / unpin | **pass** | Pin tool click froze the rope tip exactly at (1214.3,229.4) for 1 s. A second click released it and it swung to (1373,268). `t03-pinned-rope-end.png` |
| Cut constraints | **pass** | Cut stroke across the chain hammock severed a link; the jelly blob it held dropped (y 574→766). `t04-cut-chain.png` |
| Cut a balloon string | **pass** | Helium balloon rose (y 816→653) once its string was cut. `t05-cut-balloon-string.png` |
| Impulse blast | **pass** | Soft-box peak speed went from 1 to 251 cm/s and it was displaced 35 cm. `t06-impulse.png` |
| Wind swipe tool | **pass** | Flag peak speed went from 174 to 239 cm/s during the swipe. `t07-wind-swipe.png` |
| Global gust button | **pass** | Flag reach went from x=307 to 340 during the gust. `t08-gust.png` |
| Spawn every type | **pass** | Ball (click and drag-throw), jelly blob, soft box, balloon with string, crate, rope (drag, pinned start), chain, cloth (drag rectangle, 2 pins), static box, static circle, and a rope attached to a ball. `t09-spawned-objects.png` |
| Attachment holds a load | **pass** | Built while paused (Space): a ball on a 270 cm rope hung at y=430 after resuming; the floor is at 1000. `t09b-rope-holds-ball.png` |

### Parameters (each slider set by real clicks, then the physics measured) — `test_params.py`
| Check | Result | Observed |
|---|---|---|
| Solver iterations | **pass** | Hanging sheet at 1 iteration: max constraint error 0.74 cm, lowest point y=408. At 40 iterations: 0.09 cm, y=393. `p01-iterations-1.png`, `p01-iterations-40.png` |
| Structural stiffness | **pass** | At 0.15 the sheet sags to y=874 (40 % strain). At 1.00 it sags only to y=415 (7 %). `p02-stiffness-low.png` |
| Bending stiffness | **pass** | Rope clamped horizontally (3 points pinned with the pin tool). Its mid-point reaches x=416 at bending 0 (floppy) vs x=602 at bending 1 (cantilever). `p03-bending-high.png` |
| Wind speed | **pass** | Corner-pinned sheet centroid x=730 at 0 m/s, x=798 at 7.5 m/s. `p04-wind-0.png`, `p04-wind-max.png` |
| Tear threshold | **pass** | Balloon chamber at 1.5× pressure: 2/12 balloons popped at +35 %, 12/12 at +15 %. `p05-tear-threshold-35.png`, `p05-tear-threshold-15.png` |
| Balloon pressure | **pass** | Mean balloon area was 50 % of rest at 0.5× pressure and 147 % at 1.5×. `p06-pressure-low.png`, `p06-pressure-high.png` |
| Restitution | **pass** | Ball dropped from y=300: rebound apex y=982 (no bounce) at e=0, y=568 at e=0.9. |
| Gravity direction | **pass** | At +90° a ball spawned at x=800 fell sideways to x=636. `p07-gravity-sideways.png` |
| Collision thickness | **pass** | Particle radius 1.1 at thickness 2, 13.2 at thickness 24. `p08-thickness-max.png` |
| Substeps, timestep, density, damping, friction, strength, radius | **pass** | All applied live; the HUD reported "3 iterations × 16 substeps · dt 4.0 ms" right after the change. |
| Visualization modes 1–8 (keys) | **pass** | Cycled render, particles, constraints, velocity, stress, contacts, pins, grid. Sim time kept advancing and particle count was unchanged, so no reset. `v1-render.png` … `v8-grid.png` |
| Visualization select | **pass** | `#vizMode` → stress. |
| Pause + single step | **pass** | Paused t stayed at 6.997. Key N → 7.014; Step button → 7.031 (exactly one 16.67 ms step each). `s01-paused-stepped.png` |
| Resume, Reset button, R key | **pass** | Resumed; reset brought t back to ≈0.1 s and torn count to 0. |
| Help dialog | **pass** | `?` opens it, Esc closes it. `k01-help-open.png` |

### Collisions — `test_collisions.py`
| Check | Result | Observed |
|---|---|---|
| Self-collision toggle | **pass** | Unpinned 77×6 strip dropped on a beam: settled pile is 254 cm tall with self-collision, 235 cm without. With it off the layers interpenetrate (visible in the second screenshot). `x01-selfcollision-on.png`, `x01-selfcollision-off.png` |
| Loads on the rope bridge | **pass** | Crates, blob, soft box and balls all rest on the plank deck (deck low point y=694); none passed through. `x02-bridge-loads.png` |
| Cloth catches balls | **pass** | 3/3 balls dropped on a corner-pinned sheet stayed on it (no tunnelling). `x03-balls-on-sheet.png` |
| Soft body on a rope; soft boxes stack | **pass** | Blob rests above a pinned rope; the upper soft box sits on the lower one. `x04-soft-on-rope-and-stack.png` |

### Stress diagnostics — `capture_stress.py`
| Check | Result | Observed |
|---|---|---|
| Imminent-tear highlighting | **pass** | Stress view while pulling a sheet 72 cm: 3 constraints above 80 % of their tear limit (pulsing red), and the HUD "near-tear" count agreed. Pulling to 200 cm then tore 4. `st01-stress-imminent-tear.png`, `st02-stress-after-tear.png` |

### Viewports, input continuity, isolation — `test_viewport.py`
| Check | Result | Observed |
|---|---|---|
| Rapid cut (3 pointer samples) | **pass** | One fast stroke across the whole flag cut 79 constraints: a continuous severing line, since segments between samples are tested. `c01-fast-cut-flag.png` |
| Rapid grab-drag (3 samples, ~700 cm) | **pass** | Blob tracked the target to within 5 cm; no NaN recovery; solver stayed stable. `c02-fast-grab-drag.png` |
| Resize keeps world coordinates | **pass** | Paused, then resized 1280×800 → 900×700: world positions drifted 0.0 cm. A click at the new screen position pinned the intended particle. `r01-resized-900x700.png` |
| High-DPI | **pass** | DPR 2: canvas CSS 896×748 → backing store 1792×1496. `r02-hidpi-2x.png` |
| 390×844 layout | **pass** | No horizontal page scroll (scrollWidth 390 = clientWidth 390). Stage 715 px tall; tool rail scrolls horizontally. `m01-narrow-390x844.png`, `m04-narrow-compact-topbar.png` |
| 390×844 settings drawer | **pass** | Drawer opens, slider responds to a click, drawer closes. `m02-narrow-settings-drawer.png` |
| 390×844 tools on canvas | **pass** | Ball spawned via the rail; grab-drag worked. `m03-narrow-interaction.png` |
| No external requests | **pass** | `performance` resource entries: none. The agent-browser network log shows only the `file://` document. |
| CSP | **pass** | `default-src 'none'` plus inline script/style only, so the page cannot fetch anything. |
| Console / page errors | **pass** | Empty after all runs. |
| Performance | info | Headless Chromium at 1280×800 on this WSL2 machine, 3 iterations × 8 substeps: showcase 60 fps (10.1 ms phys/step, 1192 particles); flag 60 (8.5 ms, 1508); drape 58 (10.3 ms); bridge, stack, ropes and balloons 60 (0.7–2.0 ms); **stress test 43 fps at 72 % sim speed** (14.7 ms, 1813 particles, 6691 constraints). |

A robustness sweep through the page handle also ran; it drove the solver directly and was not part of the pass/fail suite. It covered 9 extreme parameter combinations × 3 scenes: 1×1 iterations at 33 ms; 40×16 at 4 ms; g=3000 with wind 15 m/s; zero-g; density 5 with thickness 24; stiffness 0; pressure 3 with tearing off. Every run produced 0 non-finite and 0 out-of-world particles.

## 3. Failures found during development, their causes and fixes (history)

1. **Cloth rendering was 9–22 ms/frame** (one path per triangle). Rewrote it as shaded quad strips with a seam-hiding expansion → about 0.5 ms (flag) and 1.2 ms (stress).
2. **Broad phase took most of the physics time.** Switched to 20 cm cells, per-particle speculative margins, candidate reuse across two substeps, and early rest-space rejection → about 2× faster.
3. **Flag tore on its own at the pole.** Edge-vs-obstacle sampling near pinned endpoints applied huge lever corrections. Now only edges whose endpoints are clear of the obstacle are sampled.
4. **40 iterations blew the cloth apart.** The cloth tension/compression compliance switch reused a stale XPBD multiplier. They are now two one-sided constraints with the multiplier reset when the regime flips. Retest: error 0.09 cm at 40 iterations.
5. **"Max constraint error" did not respond to iterations.** It counted deliberately compliant constraints (shear, bending, folding). Redefined as the violation of inextensible constraints only; it now falls from 0.74 to 0.09 cm as iterations rise.
6. **Balloons popped at modest pressure** from local pressure spikes. Replaced with a compressible-gas area constraint (solved first each iteration) and a whole-membrane stretch pop criterion.
7. **The whole app failed to start** (`__lab` undefined). A duplicate `const t` in the key handler was a syntax error in that scope. Fixed; every JavaScript edit afterwards was checked with `node --check` on the extracted script.
8. **Space double-toggled pause** when a button had focus. Buttons now drop focus after mouse clicks, and shortcuts also work while a slider has focus.
9. **Shift-modified gestures failed** because pointermove overwrote the Shift state. Now tracked via keydown/keyup.
10. **Zero-length attachments tore instantly.** Tearing now uses an absolute stretch floor, and the attachment rest length defaults to the actual distance.
11. **Wrecking-ball and pendulum ropes over-stretched.** Added unilateral long-range-attachment (LRA) limits, disabled once the rope is cut.
12. **Newton's cradle didn't transfer momentum.** Added velocity-level restitution for ball–ball contacts.
13. **Grab felt weak, so tear-by-drag failed.** Default interaction strength is now 100 % (hard grab); soft bodies are carried by a patch instead of a single node.
14. **Regression: phantom wind after switching scenario.** A gust timestamp from the old timeline fired in the new one. `state.gustT` is now reset on world reset. The exact failing flow was re-run (cloth stays at x=730, no wind), then the tools and params suites passed in full.

## 4. Blocked / not run / limitations (honest)

- **Real touch hardware: not run.** agent-browser offers touch only through its iOS provider. The 390×844 checks used mouse events; pointer handling is shared (Pointer Events with `touch-action: none`), but real multi-touch devices were not exercised.
- **Other browsers: not run.** Chromium only; Firefox and Safari were not tested.
- **Audio:** the app has none, so nothing to check.
- **Performance** is headless Chromium on a WSL2 machine. The stress test drops to about 43 fps / 72 % sim speed by design: the adaptive step cap slows the simulation instead of freezing the UI. 40 iterations × 16 substeps costs 75–90 ms per step on the heavy scenes, so those settings run in slow motion.
- **Physics-model limits:**
  - The world is 2D and in-plane. Cloth is a planar membrane: "folding" is in-plane buckling plus self-collision and back-face shading, not true 3D folding.
  - Self-collision is approximate: particle-vs-edge with rest-space neighbour exclusion. There is no continuous collision detection, so extreme speeds on very thin geometry can still tunnel. This is mitigated by 8 substeps and speculative margins, and no tunnelling was seen in the tests.
  - Balls are single-particle disks; their rotation is visual, derived from rolling contact, not angular dynamics. Crates are near-rigid 4-particle quads.
- **Visual quality** was judged from the screenshots by the agent; there was no human review.
- **Persistence / import / export:** not part of the requirements and not implemented.
