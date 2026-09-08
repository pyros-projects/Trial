# Validation Report — Orbital Mechanics & Mission-Planning Sandbox

**Artifact:** `index.html` (single self-contained file, ~120 KB, no external assets/dependencies)
**Tested with:** `agent-browser` (Chromium via CDP) against `http://localhost:8377/index.html` (temporary local server, dev-only) **and** direct `file://` open of the delivered artifact.
**Date:** build session of 2025 (single agentic run)

All checks below were executed against the running application through real browser interaction
(mouse, keyboard, labeled controls), `eval`-based state inspection of live application objects
(`Sim`, `P`, `Nodes`, `Predict`, `Frames`, `Cam`), and screenshots. Screenshots are in
`evidence/screenshots/`.

---

## 1. Runtime / delivery constraints

| Check | Result | Evidence |
|---|---|---|
| Direct `file://` open of `index.html` renders and runs | **PASS** | 60 FPS, sim advancing, scene drawn — `screenshots/17-file-direct.png` |
| No external fetches (assets, fonts, libs) | **PASS** | No `<link>`, `url()`, `fetch`, `import`, or image refs in the file; network log shows only the browser's own favicon probe during the HTTP phase, nothing from the app; under `file://` nothing is requested |
| Single self-contained file, no build step at runtime | **PASS** | `dev/` sources + `dev/build.sh` are dev tooling only; `index.html` is standalone |
| High-DPI backing store | **PASS** | dpr=1: canvas 390×754 = CSS size; with dpr=3 emulation (`set device iPhone 16 Pro`): backing store 1005 px vs 402 CSS px (2.5× cap engaged by design) — `screenshots/16-mobile-highdpi.png` |
| Console errors / uncaught exceptions | **PASS (none)** | `agent-browser errors` empty after full session |

---

## 2. Public validation checks

### 2.1 Advance simulation → coherent motion + telemetry changes — **PASS**
- 2 500 integrator steps: craft position moved > 1 u, speed and eccentricity telemetry both changed; energy error −2.1e-11.
- Screenshots `02-after-fix.png`, `20-final-desktop.png` (60 FPS, MET ticking, steps/frame ≈ 17).

### 2.2 Maneuver node: prediction changes before burn; actual sim changes at burn — **PASS**
- Created node by real pointer click **on the predicted path** (top-bar “＋ Node”, then mouse click at path point): node created at the clicked row's time, auto-selected, shown in editor (`screenshots/03-node-created.png`).
- Edited ΔV prograde to 0.15 via the slider pipeline (native keyboard ArrowRight verified: pro 0→0.001 and editor |ΔV| updated; precise value via same `input` event): predicted end position moved (Δ = 1.22 u), encounter list changed, before/after orbital-element compare table populated (a: 1.984 → 2.342, e: 0.0357 → 0.1378) — `screenshots/04-node-dv015-prediction.png`.
- Ran the clock past the burn: node auto-executed, event logged `⚙ Maneuver #1 executed by Craft: ΔV=0.15`, ΔV-remaining dropped to 0, orbit e jumped 0.0017 → 0.144 matching the prediction — `screenshots/05-node-executed.png`.
- Same-time A/B: identical run with the node zeroed differs by **2.474 u** in position at t≈27.32 (test-time jitter 0.022 u) — the node alters the *actual* simulation.
- Dragging a node marker **along the predicted path** changes its burn time (2.725 → 67.591), prediction re-plots (`screenshots/10-node-dragged.png`).
- Bug found & fixed during validation: predictor's node-search used strict `>` and skipped the node when the integration landed exactly on it; the real simulator was unaffected. Fixed, re-verified.

### 2.3 Reference frames transform trails and vectors coherently — **PASS**
- Rotating “Planet–Moon” frame: over 3 u of real dynamics the moon stays pinned at frame position (4, 0), frame-relative speed ≈ 0.005, planet exactly at origin; craft trajectory renders as pre/post-encounter spirals — `screenshots/06-frame-rotating.png`.
- Same instant in inertial frame: clean ellipse trail + apo/peri markers, identical frame-independent telemetry — `screenshots/07-frame-inertial.png`.
- Body-centered mode and velocity-vector transformation verified numerically (`Frames.vpx/vpy` subtract center velocity + ω×r in rotating mode).
- Bug found & fixed during validation: `Frames.update()` only ran on frame-mode changes, leaving live transforms stale between physics frames (moon drifted 4.66 u in rotating frame). Fixed — update now runs every rendered frame; re-verified (drift 0.005 u ≈ physical radial perturbation).
- Prediction end-state, trails, node markers and encounter markers all use per-row frame transforms (consistent by construction).

### 2.4 Pause, single-step, time warp, reset, energy-error reporting — **PASS**
- Pause: freezing verified; single step advances exactly one Δt (2×Δt for two steps, still paused).
- Warp: ± buttons halve/double (2 → 1 → 0.5 verified), slider spans 0.02–200 u/s.
- Reset (⟲ / R): back to t=0, nodes cleared, scenario reloaded.
- Rewind (⏮ / V): checkpoint stack pops correctly — manual checkpoint restored exactly (t=20.768, position exact); next rewind popped the auto-checkpoint (every 4 u, 80 kept); manual ⚑ save verified.
- Energy error: HUD `ΔE/E₀` live (+2.3e-11 green after minutes of running), `|ΔP|` reported; error-graph overlay draws the log-|ΔE| history (`screenshots/11-overlays.png`).

---

## 3. Physics & numerical correctness

| Check | Result |
|---|---|
| Circular orbit stays circular | **PASS** — a=5.000, e=0.0000 after 12 u; ΔE/E₀ = 6.9e-14 (velocity-Verlet, symplectic) |
| Elliptic orbit (rp=2, ra=9) | **PASS** — measured rp=2.0000, ra=9.0000, e=0.6364 |
| Hohmann transfer (6 → 14) with two auto-nodes | **PASS** — both burns fire on schedule; final a=13.999, e=0.0074 (`screenshots/08-hohmann-complete.png`) |
| Moon transfer (phased flyby) | **PASS** — close approach d=0.62 (2 moon radii, no impact), post-flyby a=2.505/e=0.4946 as designed |
| Gravity slingshot | **PASS** — specific orbital energy +0.216 gained in the flyby (tuned numerically in `dev/phys.mjs`); visible orbit pumping in rotating frame |
| Unstable three-body | **PASS** — unequal-mass figure-8 (1, 1, 1.05) starts ordered then destabilizes; bounded (maxR<4), ΔE = −5.6e-9 over 12 u at Δt=1e-4 (`screenshots/19-threebody.png`) |
| Escape trajectory | **PASS** — heliocentric ε=+6.43, e=1.79, r=81.7 at t=12 u (1.3× planetary escape velocity, prograde) |
| Integrator cross-validation | **PASS** — Verlet / RK4 / adaptive Dormand–Prince 5(4) all agree to 4 decimals on final position after 20 u; drift ≤ 3e-14 |
| Conservation at warp 20 soak | **PASS** — 60 FPS at 166 steps/frame, ΔE 2.2e-10 after 160 u |

Scenario presets were numerically tuned *before* implementation with a standalone prototype
(`dev/physlib.mjs`, `dev/tune*.mjs`) — burn magnitudes, phasing angles, and the three-body
initial conditions are analytically/numerically derived, not eyeballed.

---

## 4. Interaction & UI

| Check | Result | Evidence |
|---|---|---|
| Select body by click | **PASS** | selection ring + panel updates (`Sel.idx`) |
| Drag spacecraft **position** while paused | **PASS** | body moved 5.68 u, velocity untouched, prediction re-plots live |
| Drag spacecraft **velocity arrow tip** while paused | **PASS** | Δv=3.616 applied (speed 6.324 → 8.913) — bug found (hit-test gated behind body hit) and fixed during validation |
| Pan (drag) / zoom (wheel, cursor-centric) | **PASS** | pan moves camera; wheel zoom holds the point under the cursor to 0 px; clamped 1e-4–5e5 px/u. Note: agent-browser dispatches synthetic wheel at (0,0), so zoom was validated with a canvas-targeted WheelEvent through the app's real handler (tool coordinate quirk, not an app issue) |
| Drag node along path | **PASS** | burn time re-targeted to dropped path point |
| Keyboard: Space / . / R / C / V / N / Esc / 1-2-3 / ± | **PASS** | verified via `press` (pause toggle, exact step, node mode, cancel) |
| Add craft | **PASS** | inserts craft on a circular orbit clamped inside the primary's SOI (r=4.19, e=0, auto-selected); improved after first test spawned outside the Hill sphere |
| Delete craft | **PASS** | removed, baseline recomputed |
| Collisions: merge / bounce / pass | **PASS** | impact event + removal; elastic rebound with correct escape-profile speed; pass-through |
| G slider + tolerance + body mass/radius/pos/vel edits | **PASS** | all re-baseline E₀/P₀ (drift stays ~1e-7 after edits); DP54 tolerance field shows only in adaptive mode |
| Overlays: potential field, SOI, acceleration, error graph, encounters, orbital guides, labels, trails, predictions, velocity vectors | **PASS** | `screenshots/11-overlays.png`, `12-soi-acc.png` |
| Narrow viewport 390×844 | **PASS** | full-bleed canvas, drawers off-canvas with toggle buttons, scrim, bottom timebar (`screenshots/13-mobile-initial.png`, `14-mobile-drawer.png`, `15-mobile-right-drawer.png`) |
| Desktop 1280×800 | **PASS** | all panels visible (`screenshots/02`, `20`) |
| Help card | **PASS** | `screenshots/18-help.png` |
| Off-screen body indicators, scale bar, MET clock | **PASS** | visible in most screenshots |

---

## 5. Failures found & fixed during the run

1. **Render loop crash on load** — `for (const nd of Nodes)` (missing `.list`) killed the first rAF tick; app appeared black. Fixed; root-caused via in-page stack capture.
2. **Predictor skipped nodes** — strict `nd.t > t` failed when a step landed exactly on the burn time, so predictions ignored the maneuver. Fixed with `>= t - 1e-12` (matches the real-sim path).
3. **Stale frame transforms** — `Frames.update()` ran only on frame-mode change, so rotating-frame vectors/trails lagged one physics state during runs. Fixed (per-frame update).
4. **Velocity-arrow drag unreachable** — handle hit-test required the pointer to be simultaneously near the body and the tip. Fixed (handle checked first).
5. **Elastic bounce crashed** — `rr` referenced out of scope in `Sim.bounce`. Fixed.
6. **Add-craft spawned unstable orbits** — insertion radius now clamped to 0.45× the primary's SOI.
7. **Encounter detector flagged the orbited primary** as an “encounter” (Planet d=2.01). Fixed — primary excluded.

Each fix was rebuilt (`dev/build.sh`), reloaded, and the failed flow re-run plus a compact
regression pass (§2 sequence re-executed on the final artifact over `file://`).

## 6. Remaining limitations (honest notes)

- **Pinch-zoom** is implemented via the standard two-pointer Pointer-Events path, but agent-browser drives a single mouse pointer, so a true two-finger pinch was not exercised end-to-end (single-pointer pan/zoom fully verified). Not blocked by design, blocked by tooling.
- **Wheel zoom** was validated through the app's real handler with a canvas-targeted event because the CLI dispatches synthetic wheel at viewport (0,0); a physical wheel was not available.
- Prediction uses a coarse fixed substep (`horizon/resolution`), so predicted elements differ a few percent from the high-fidelity run around deep flybys (e.g. Hohmann final e=0.0074 vs 0 target) — resolution is user-adjustable up to 20 000 steps.
- Momentum-error display is absolute (|ΔP|) because barycentric correction makes the relative form meaningless (P₀≈0).
- No import/export or localStorage persistence is implemented (not a stated requirement; restart/checkpoint/rewind are).
- Audio: none (not required).
