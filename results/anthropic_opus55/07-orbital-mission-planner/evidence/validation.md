# Validation log — Orbital Mechanics & Mission-Planning Sandbox

Artifact: `../index.html`: a single self-contained file (~157 KB) with no external assets, imports, fonts or network calls.
Agent: Claude Opus 5.5 in Claude Code, 2026-09-29.

## Tooling

| Item | Status |
|---|---|
| Browser automation | `agent-browser` **0.31.1** (installed skill). Loaded the version-matched guide with `agent-browser skills get core --full` and the exploratory-testing guide with `agent-browser skills get dogfood` before use. It drives headless Chromium over CDP. |
| Direct-file check | **pass**. Every browser session opened `file:///…/index.html` directly (agent-browser supports `file://`). |
| Touch input | agent-browser has no Chrome touch command. I used `agent-browser get cdp-url` plus `evidence/scripts/cdp-touch.mjs` (Node 25, built-in WebSocket) to send **real `Input.dispatchTouchEvent`** events to the same page. |
| Error capture | Every session used an init script (`--init-script`) that records `error` and `unhandledrejection` events into `window.__errs`. I also checked `agent-browser errors` and `console`. |
| State inspection | The page exposes a read-only diagnostics object, `window.OrbitLab` (snapshot, forecast, frame helpers). Checks read real application state through it; no app behaviour depends on it. |
| Syntax | I extracted the `<script>` and ran `node --check` on it: OK. |

Re-runnable checks (from the project directory):

```bash
bash evidence/scripts/regression.sh     # real keyboard/mouse E2E + in-page physics suite, prints PASS/FAIL
node evidence/scripts/cdp-touch.mjs "$(agent-browser --session <s> get cdp-url)"   # touch pinch/pan/tap
```

Final regression run on the delivered build: **32 passed, 0 failed** (`logs/regression-195344.log`). Earlier logs are from intermediate builds.

---

## 1. Loading, runtime restrictions, network

| Check | Steps | Result |
|---|---|---|
| Direct file open | `agent-browser open file://$PWD/index.html`, wait 1.5 s, read `window.__errs` | **pass**. No uncaught errors; the default system runs immediately at 60 fps. |
| No external fetches | `network har start` → open file → `har stop logs/direct-file-load.har` | **pass**. The HAR has one entry: the `file://` document itself. |
| Static scan | `grep -i "https\?://\|@import\|<link\|<script src\|fetch(\|XMLHttpRequest\|import("` | **pass**. No matches. The only `<link>` is `rel=icon href="data:,"`, added so browsers don't probe `/favicon.ico`. |
| Local HTTP cross-check | Served on `127.0.0.1:8765` with `uv run python -m http.server`, blocked `https://**` via `network route … --abort`, then loaded | **pass**. Before the inline favicon was added, the only extra request was Chromium's automatic `/favicon.ico` probe (404). The server was stopped afterwards. |

## 2. Public validation checks (main workflow)

### 2.1 Advance the simulation; motion and telemetry change coherently — pass
- Opened the file. Two snapshots 2 s apart: t went 14.95 → 35.15 h, which matches the default 10 h/s warp (×36 000). The craft's frame position moved (5.04, 10.89) → (−12.32, 5.18). Selene moved, and the telemetry eccentricity changed 8.2e-4 → 0.3569 once the scheduled t = 24 h burn fired. The burn toast and log read `Pe 11.99 Ap 25.23 e 0.356`.
- Screenshots: `dev-03-1280.png`, `val-J6-desktop-hud.png`.

### 2.2 Maneuver node: forecast changes before the burn; the actual simulation changes when it executes — pass
1. **Reset** (R), then **Space** to pause at t = 2.35 h.
2. Moved the real mouse onto the dashed forecast about 70 h ahead. The canvas cursor became `copy` and the tooltip read "add node at t=72.357 h". Clicked there. **Node created** (count 1 → 2), auto-selected, and the Maneuvers tab opened (`val-C1-hover-path.png`, `val-C2-node-created.png`).
3. Pressed on the node's **P+** handle and dragged it 70 px outward in 4 moves (`val-D1-dragging-prograde.png`). Result: prograde Δv 0 → 0.1037 Mm/h. The forecast was recomputed during the drag. Node readout after the burn: Ap 25.229 → 32.296, Pe 11.912 → 17.090, e 0.359 → 0.308, period 159.0 → 243.8 h. The forecast end point moved from (1921.8, 476.3) to (1956.2, 508.4) (`val-D2-after-drag.png`).
4. Recorded the forecast (1472 samples). Clicked **Warp to next burn**: the HUD showed "WARP TO BURN", warp stopped just before t = 24 h and normal warp resumed. Ran through both burns to t = 81 h.
5. Compared the actual history against the recorded forecast at identical times: **136 matched samples, max position difference 0** (bit-identical). Burn 2 executed at t = 72.357 h with |Δv| 0.1037, and the log shows `Pe 17.09 Ap 32.30 e 0.308`, exactly as forecast (`val-E2-after-burns.png`).
6. Regression script: the same flow in a fresh session gives **164 matched samples, max diff 0**.

Also exercised in the maneuver editor:
- **Next Ap** snapped a new node to t = 93.858 h (analytic Hohmann apoapsis 93.8577).
- Typing prograde 0.1691 gave a forecast after-burn orbit with e = 1e-5 and rp = ra = 30.
- Switching components to **Cartesian** and back preserved the physical inertial Δv (0.08107, −0.1484).
- Setting an explicit reference body worked.
- **Next Pe** correctly reported "no periapsis within horizon".
- Dragging the node marker slid it along the coast arc (t 93.86 → 100.09 h) with a live forecast and table (`val-Q3-hohmann-replanned.png`, `val-Q9-node-time-drag.png`).
- Keyboard: **N** added a node, the arrows nudged it (pro 0.0105 / rad 0.005), and **Delete** removed it.

### 2.3 Reference frames: trails and vectors transform — pass
Switched the toolbar frame `<select>` with `agent-browser select` at t = 150 h and checked the transformed state against the page's own transforms:

| Frame | Observation |
|---|---|
| Inertial (barycentric) | Gaia's frame velocity is (−0.38, 2.20), i.e. heliocentric; trails are long heliocentric arcs; the craft trail is a trochoid (`val-F-frame-inertial-inertial.png`). |
| Centered · Gaia | Gaia at exactly (0,0) with velocity (0,0). Selene's 140 h trail spans 15×60 Mm, i.e. an orbit arc. |
| Rotating · Gaia–Selene | Gaia at (−0.55, 0), Selene at (45.83, 0) with frame speed 0.019 Mm/h (radial breathing only). **Selene's whole 140 h trail collapses to a 1.37 × 0 Mm segment.** The craft trail becomes a rosette (`val-F-frame-rot-GAIA.png`). |
| Centered · Pathfinder | Craft at the origin; Gaia's velocity is the exact negative of the craft's Gaia-relative velocity. |

- Round-trip inertial → frame → inertial error: 0 to 4.4e-16 for both positions and velocities.
- Velocity arrows are drawn from the frame velocity (incl. −ω×r in rotating frames). The craft speed read 1.72 (inertial), 0.72 (Gaia), 0.55 (rotating), as displayed.
- Trails and forecasts store full-system snapshots and are re-projected with the frame state at each sample time. That is why the Moon's trail collapses in the rotating frame and the Moon-transfer forecast bends into the capture (`dev-moon-2.png`).

### 2.4 Pause, single-step, time warp, reset, energy-error reporting — pass
| Check | Result |
|---|---|
| Space pauses | t frozen at 35.15 h for 1 s; HUD "PAUSED". |
| S single-steps | 35.15 → 35.20 → 35.25 h: exactly dt = 0.05 per press; positions and telemetry update. |
| Warp `.` ×3 | Target 10 → 100 h/s. The rate eases smoothly: 25.9 → 77.5 → 100 h/s over ~0.5 s; steps/frame 3 → 12 → 33; measured sim rate 101.6 h/s. `,` ×3 eases back to 10. |
| Reset button | t = 0, the scenario node is restored, energy error 0. |
| Save / Rewind | Save at t = 150.45; run 2 s (t = 170.8); Rewind → t = 150.45 with the craft position identical to 5 decimals and the same energy error. |
| Energy error | Elliptical scenario, Physics tab: integrator → RK4, dt → 1 h. The HUD error rose to 3.8e-6 in amber (`val-H-rk4-energy-drift.png`); the regression run gives 1.94e-6. Switching back to Yoshida and pressing **Rebaseline** gave ~1e-8 (`val-H-yoshida-after-rebaseline.png`). The HUD sparkline shows log₁₀ of the E, L and p errors. |

## 3. Physics suite (`scripts/physics-suite.js`, run inside the page with the app's own stepper) — 15/15 pass

| Check | Result |
|---|---|
| Circular: r stays 12, e ≈ 0 | r = 12.000002, e = 2.4e-7. The residual is the genuine pull of the second craft's 1e-6 mass under full N-body; I set the threshold at 1e-5 for that reason. |
| Circular energy | \|ΔE/E\| < 1e-12 |
| Ellipse (leapfrog) | back at periapsis after one analytic period; energy error < 1e-5 (bounded, oscillatory) |
| Hohmann | final a = 30.000, e < 1e-3, both burns executed |
| Moon transfer | TLI plus capture burn gives Pe 2.997 / Ap 3.004 around Selene, still bound at t = 300 h |
| Slingshot | heliocentric ε: −3.50 → −1.21 (orbit roughly triples in size) |
| Escape | after the burn, e = 1.23 and ε > 0 relative to Gaia; later a heliocentric orbit |
| Three-body (DOPRI 1e-10) | \|ΔE/E\| ~1e-8 to 1e-7 over 900 h; ends as a binary plus an ejected star (the known outcome) |
| Three-body merge | momentum error ~1e-14 across two merges |
| Three-body bounce | integration error < 1e-3 (max 1.8e-5) with ~30 elastic bounces |
| Forecast vs live sim through a burn | position difference 0 |
| Rotating frame | Selene on the +x axis with frame speed < 0.05 |

## 4. Interaction, layout, input devices

| Check | Result |
|---|---|
| Paused craft drag (mouse) | Circular scenario: dragged Pathfinder 40 px. Frame position (11.89, 1.59) → (15.09, 3.22) with frame velocity held; orbit became e 0.29 / Ap 27.9; forecast recomputed; energy reference rebaselined (`val-I1…`). |
| Velocity-handle drag (mouse) | The v handle drag set velocity (0.383, 1.40): e 2.05, hyperbolic, and the forecast shows escape (`val-I2…`). |
| Keyboard | V (cycle frame), `[` `]` (selection), F (focus: scale 6.2 → 24.8), `+`/`−`, N, arrow keys, Del, K/L, `?` (help, `val-N1-help.png`), Esc, `.`/`,`, R: all verified by reading state after each key. Shortcuts deliberately do nothing while a form control has focus. |
| Touch (CDP) | Pinch from 100 → 220 px finger spread: zoom ×**2.200** exactly. One-finger pan: world shift equals −80 px / scale exactly. Tap on Gaia selects Gaia; tap on Pathfinder selects Pathfinder (`logs/touch-cdp.json`). |
| Wheel zoom | Zooms about the cursor. |
| Pan | Drag on empty space (desktop) and one finger (touch). |
| High-DPI | `set viewport 1280 800 2`: canvas backing 2560×1600, error plot 432×128 for 216×64 CSS px; screenshot is 2560×1600 (`val-O1-hidpi-2x.png`). |
| Resize | 1280×800 → 900×640 → 700×900 → back: the canvas tracks the viewport with no page scroll or errors (`val-S1…`, `val-S2…`). |
| Narrow 390×844 | No horizontal overflow; compact 2-column HUD; toolbar on 2 rows plus a warp slider; ☰ opens the panel as a bottom sheet and all tabs work (`val-J5…`, `val-J4-mobile-sheet-mnv.png`, `reg-mobile*.png`). |
| Very different scales | Whole system at 0.14 px/Mm (scale bar 500 Mm) down to the craft at 7.8 px/Mm with camera tracking. Bodies have minimum pixel radii, a body-scale control, off-screen edge indicators with distances, Fit all, and Focus (`val-S3…`, `val-S4…`). |
| Add / delete | +Craft and +Body start circular orbits around the selection (e ≈ 1e-15); both appear in the frame list; Delete removes the object and its nodes (`val-M1…`). |
| Property editor | Mass, radius, position, velocity (inertial) and display scale. Apply only when paused; invalid entries are highlighted red and rejected. |

## 5. Collisions and error states

| Check | Result |
|---|---|
| Craft crash (merge mode) | Set Pathfinder's velocity to (0, 0.05) in the editor. The forecast showed a red ✕ "IMPACT Gaia in 13.4 h" and periapsis in red below the surface (`val-K1…`). When run, the craft landed at t ≈ 15.1 h and the log reads "Pathfinder impacted Gaia" (`val-K2…`). |
| Merge (three-body) | Beta merged into Gamma (mass 90), then Alpha into Gamma. Momentum error ~1e-14. |
| Bounce (three-body) | Contact-time elastic bounces with energy bookkeeping, ~30 bounces; the triple stays bound. |
| Blow-up / stall | Pure radial plunge with point masses, DOPRI tolerance 1e-12. The step exceeded 60 000 sub-steps; the banner appeared, the whole state (incl. energy reference, log and trail) rolled back to the start of that frame (the last state known to be good), and the sim paused with "Rewind to checkpoint" offered (`val-L1-blowup-banner.png`, which shows the banner's earlier wording). |

## 6. Performance (`logs/perf.json`, final build, 2 s rAF probe per case)

| Scenario | default warp | max warp (5000 h/s) |
|---|---|---|
| Star · planet · moon | 59.9 fps, p95 16.7 ms | 59.5 fps, 1671 steps/frame, achieved 5009 h/s |
| Moon transfer | 59.1 fps | 59.5 fps, achieved 5013 h/s |
| Slingshot | 59.3 fps | 57.6 fps, achieved 5021 h/s |
| Three-body (DOPRI) | 59.1 fps | 58.9 fps, 836 steps/frame, achieved 4944 h/s |

A regression found here was fixed (row 11 below): three-body at max warp fell to 18–23 fps (p95 100 ms) after other changes. It is back at 58.9 fps.

## 7. Failures found during validation, and their fixes

| # | Failure observed | Cause | Fix | Retest |
|---|---|---|---|---|
| 1 | First load threw `Cannot read properties of null (reading 'bodies')` and nothing rendered (`dev-01-first-load.png`) | `select()` ran telemetry before the SOI hierarchy existed | `select()` calls `computeNow()` first | pass (`dev-02-load.png`) |
| 2 | Circular/Hohmann telemetry had no primary; burns logged "ref barycentre" | `Infinity < Infinity` meant a root body with infinite SOI was never picked as primary | tie-safe comparison in `primaryOf` / `hierarchy` | pass (Hohmann log shows ref Gaia) |
| 3 | Right part of the scene hidden under the panel (Selene in the rotating view) | camera centre was the viewport centre | projection centre moved to the visible area left of the panel / above the toolbar | pass (`dev-moon-2.png`) |
| 4 | Potential overlay: blocky halo, grey blobs, no useful contours in the planet frame | clamped out-of-range cells were treated as contour lines; the star's uniform gradient dominated | robust range, gradient-aware contour width, effective potential of the frame (gravity + fictitious origin acceleration + centrifugal) | pass (`dev-pot-center2.png`, `dev-pot-rot3.png`) |
| 5 | Bounce mode: energy error 57, then 1e-3, and the bound triple flew apart | overlaps resolved without energy bookkeeping; end-of-step velocities reused at the contact point (energy injection); the straight-chord swept test missed a near-radial in-and-out pass within one step (pericentre 1e-5 Mm) | Hermite-curve swept detection with bisected contact time; contact-state resolution with pair-energy-consistent speed; every change reported so the reference shifts; nearest-neighbour-scaled DOPRI tolerance | pass: error max 1.8e-5, triple stays bound |
| 6 | Relative energy / momentum error read 1.0 after everything merged | normalised by \|E\| or Σm\|v\|, both ≈ 0 at the end | normalise by the running energy scale and characteristic momentum √(2M·E_scale) and size | pass (merge momentum error ~1e-14) |
| 7 | HUD rows spaced 2× on mobile | HUD rows reused the panel's `.row` class (6 px margins) | dedicated `.hr` class | pass (`val-J5-mobile-hud.png`) |
| 8 | Radial orbit showed apoapsis 0; blow-up advice suggested switching to the integrator already in use | p/(1−e) is 0/0 when h = 0; static message | a(1±e) for bound orbits; context-aware advice | pass |
| 9 | Minor UI issues: stale path tooltip after adding a node; toasts overlapping HUD/panel; post-burn forecast colour too close to the craft colour; "1 bodies"; steps/frame shown as 0 below 1 step per frame; node Δv label overlapping the Ap label; straight trail chords during very fast close passes | — | each fixed (DOPRI sub-step observer now also feeds trail/forecast samples) | pass (visual) |
| 10 | Independent code review (a sub-agent read the code and reproduced issues in a browser). Findings are listed in §7a. | — | all eight fixed | pass (see §7a) |
| 11 | Three-body at max warp: 18–23 fps. A CPU profile (`agent-browser profiler`) showed 68% in native "(program)" time, not physics (the whole 900 h run steps in 25 ms). | Canvas dashing/rasterising walks entire paths; an ejected star put dashed forecasts, guides and SOI circles hundreds of thousands of pixels off-screen. Separately, turn-driven trail sampling at every sub-step of a tight binary flooded the history. | Liang–Barsky clipping of every polyline to the padded canvas; big SOI circles culled or clipped; turn-driven samples capped; frame-time budget checked after every step | pass: 58.9 fps (p95 16.8 ms) |

### 7a. Code-review findings, each reproduced before fixing and retested afterwards

| Finding (severity) | Reproduction | Fix | Retest |
|---|---|---|---|
| Warp to next burn stays stuck at the target (high) | `system`, step to t = 1.3, press Warp: stuck at t = 23.5 (target 23.546) with "WARP TO BURN" | arrive when another full step would overshoot the target | from 6 start offsets, arrival t = 23.50–23.55 with the burn **not yet** executed; normal warp resumes |
| Forecast sample cap makes drawing throw and freezes the app (high) | `circular`, dt 0.25, horizon 20 000 h, node at t = 6285: `TypeError … reading 'n'`, time frozen | burn/collision samples always stored; `requestAnimationFrame` scheduled first and the frame body wrapped in try/catch | no errors, sim advances, node info present (6002 samples) |
| Reset/load throws after `+ Body` (medium) | `+ Body`, then R: `reading 'name'` | clear the stale forecast before the scenario UI refresh (also before restore) | reset reloads cleanly (no errors, camera and frame reset) |
| Landed craft cannot take off (medium) | crash into Gaia, set 3 Mm/h outward: immediately re-impacts | rest at (r_b+r_c)(1+1e-6); a start-of-step contact that is already separating is not a new hit | craft climbs to 27.6 Mm in 10 h, no new impact |
| Blow-up rollback incomplete (medium) | failure injected right after a burn: energy reference, log and trail not restored; the burn's energy shift counted twice | back up and restore ref, log, error history, steps, epochs, SOI memory; history restored by time | failure forced inside the frame containing the t = 24 burn: back to t = 23.8 with identical ref.E, log and trail; replay runs the burn once, \|ΔE/E\| = 0 |
| Mass 0 gives NaN and a rollback loop (low) | editor allowed m = 0; bounce with μ = 0 → NaN | editor requires m > 0; collision maths guarded for massless partners | m = 0 rejected with a red field and message |
| Craft landed on a body that is then merged ends up inside the merged body (low) | craft on Selene, Selene merged into Gaia | re-seat on the survivor's new surface | distance from Gaia 4.055685 vs surface 4.055681 |
| Trail jumps after centring on a body added later (low) | samples predating the body used the inertial fallback | strict frame lookup: such samples break the path | 101 pre-existence samples are breaks, not jumps |

Test-script mistakes that were **not** app bugs (recorded for honesty):
- `mouse move` needs integer coordinates.
- `find … --name "Delete node"` substring-matched "Delete node 1" and deleted the wrong node; I now use `--exact`.
- `Space` after `Tab` landed on the dt slider, where shortcuts are intentionally ignored; I now click Play.
- One drag test ran while the sim was unpaused, so the drag panned (by design).

## 8. Remaining limitations / not covered

- **Planar (2-D) model.** The "normal" burn component is shown as n/a; prograde/radial and Cartesian x/y components are provided.
- **Audio:** none in the app, so not applicable.
- **Touch:** tested via CDP `Input.dispatchTouchEvent` in desktop Chromium, **not** on a physical phone. Mobile Safari/WebKit was not run (agent-browser drives Chromium only). Status: **not-run** for WebKit and real devices.
- **Bounce mode** is an approximation: the relative motion is resolved at the contact configuration, but the pair's leftover part of the step is not re-integrated. The energy reference absorbs the change, so the reported error stays integration-only.
- **Point-mass singularities:** with collisions off, an exactly radial plunge can exceed the adaptive integrator's sub-step budget. This is reported and rolled back, not silently wrong.
- **Forecast accuracy:** the forecast is bit-identical to the simulation only when "Match simulation dt" is on (the default) and a fixed-step integrator is used. With Dormand–Prince, the carried step-size memory makes them agree to within the tolerance instead.
