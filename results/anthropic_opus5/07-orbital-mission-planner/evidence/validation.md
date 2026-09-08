# Validation record — ORBITAL, Mission Planning Sandbox

Artifact under test: `../index.html` (163,708 bytes, 3,574 lines, one `<style>` + one inline
`<script>`, no external references).

Author of this record: the implementing agent. All results below were observed in a real
Chrome browser driven by `agent-browser 0.31.1` (the installed browser-automation skill).
No result here is inferred from source reading alone.

Legend: **PASS** / **FAIL** / **BLOCKED** / **NOT RUN**.

---

## 1. Tooling and method

| Item | Value |
|---|---|
| Browser driver | `agent-browser 0.31.1` (`agent-browser skills get core`, `… get dogfood` read first) |
| Browser | Google Chrome (system), headless, CDP |
| Local server | `python3 -m http.server 8731 --bind 127.0.0.1` (dev-only; not a runtime dependency) |
| Direct-file check | `file:///home/pyro/projects/naked/opus5/07-orbital-mission-planner/index.html` |
| Viewports exercised | 1280×800, 1600×900, 1024×768, 900×600, 390×844, 402×874 @ DPR 3 |
| Static syntax gate | `node --check` on the extracted `<script>` after every edit |

The page exposes a read-only diagnostics object, `window.SIM`, used to read live application
state (`SIM.state()`, `SIM.body()`, `SIM.prediction()`, `SIM.conservation()`, `SIM.screenOf()`,
`SIM.handles()`). It is a genuine part of the artifact, not test scaffolding, and it reads the
same numbers the on-screen telemetry renders. Every functional check below was *driven* through
real UI affordances (clicks on labelled controls, typed values into number inputs, real
`mousedown`/`mousemove`/`mouseup` sequences, real key presses) and only *read back* through
`SIM` or the rendered DOM text.

Reproduce the harness with:

```bash
cd /home/pyro/projects/naked/opus5/07-orbital-mission-planner
python3 -m http.server 8731 --bind 127.0.0.1 &
export AGENT_BROWSER_SESSION=orbital
agent-browser set viewport 1280 800
agent-browser open http://127.0.0.1:8731/index.html
agent-browser eval "JSON.stringify(SIM.state())"
```

---

## 2. Required public checks

### 2.1 Advance the simulation; verify coherent motion and telemetry — **PASS**

Default scenario (`Kestrel System`: star + planet + moon + spacecraft, full 4-body N-body).
Sampled `SIM.state()` / `SIM.body()` repeatedly while running.

```
t = 374.8   craft (399.24, 434.94)  |v| 1.0622   a 11.957  e 0.0059  T 149.98  primary kestrel
            moon  heliocentric a 483.5 …         planet a 604.6  e 0.0085
```

Positions change continuously, orbital elements stay bounded, and each body's dominant
attractor is identified correctly. Long-run integrity, warp 500× (autoDt enlarging `dt`):

| sim time | moon r | moon a | moon e | craft a | craft e | ΔE/E₀ |
|---|---|---|---|---|---|---|
| 0.7 | 30.00 | 29.52 | 0.016 | 12.000 | 0.0001 | −1.4e−15 |
| 45,092 | 31.55 | 29.81 | 0.126 | 11.986 | 0.0075 | 2.8e−11 |
| 90,090 | 33.18 | 31.08 | 0.071 | 11.996 | 0.0047 | 4.0e−11 |
| 135,171 | 32.05 | 29.70 | 0.127 | 11.994 | 0.0017 | 8.6e−12 |

135,000 TU ≈ 1,465 spacecraft orbits ≈ 46 planetary years, ~6.7 M integration steps, energy
drift ~1e−11 and bounded. Solar perturbation of the moon's eccentricity (0.07 ↔ 0.13) is
real physics, not drift.

### 2.2 Create/modify a maneuver node; prediction changes before the burn — **PASS**

Driven entirely through the UI: `#tabScenarios` → `#scn-circular` → `#btnPause` →
`#tabNodes` → `#btnAddNode` → typed `100` into `#nodeTNum` and `0.15` into `#nodeProNum`.

Before adding the node: `a = 80`, `e = 0`, predicted max radius `80.000`.

After typing the Δv (simulation still paused, burn 100 TU in the future):

```
node          : id 1, t_abs 612.96 (= now + 100), prograde 0.15
ACTUAL craft  : a = 80,   e = 0             <- unchanged, burn has not happened
PREDICTED max radius            : 144.193
predicted path deviation vs. pre-node path : max 208.3 LU,
                                  first deviation > 0.01 LU at t = 614.07
post-burn panel: a 112.096 (+32.10)  e 0.28633  rp 80.0000  ra 144.193  T 745.705  ε −0.44604
```

The prediction is bit-identical before the node time and diverges only after it. Closed-form
check: v_c = √(100/80) = 1.118034; after +0.15, ε = −0.446075, a = 112.09, e = 0.2862,
r_a = 144.17 — matches the application to 4–5 significant figures.

Screenshot: `screenshots/02-node-planned.png`.

### 2.3 The burn changes the actual simulation when it executes — **PASS**

Resumed and let the clock reach the node time.

```
t = 167.98 (past node)   flight log: "BURN #1  Δv 0.150 LU/TU  (pro 0.150 / rad 0)"
ACTUAL  a = 112.0963   e = 0.286328   rp = 80.0000   ra = 144.1927   T = 745.705
PREDICTED (from 2.2)  a = 112.096     e = 0.28633    rp = 80.0000    ra = 144.193   T = 745.705
```

Exact agreement to six significant figures. Node row flips to `executed`, the post-burn panel
switches to `burn already executed`, a toast confirms. Screenshot: `screenshots/03-node-executed.png`.

**Prediction fidelity, independent measurement.** For three scenarios, a node was added, the
predicted craft position at 85 % of the horizon was recorded, then the simulation was stepped to
that exact time and the real position compared:

| scenario | t | predicted (x, y) | actual (x, y) | abs err | rel err | pred dt / sim dt |
|---|---|---|---|---|---|---|
| kestrel | 356.9 | (413.2822, 410.3482) | (413.2794, 410.3491) | 0.0030 | 5.1e−6 | 0.035 / 0.020 |
| moon | 220.9 | (559.3590, 252.7069) | (559.3570, 252.7144) | 0.0077 | 1.3e−5 | 0.0163 / 0.010 |
| slingshot | 765.2 | (−193.3536, 915.1353) | (−193.3491, 915.1326) | 0.0053 | 5.7e−6 | 0.0409 / 0.010 |

### 2.4 Switch reference frames; trails and vectors transform coherently — **PASS**

Same instant, five frames, read via `SIM.body()`:

| frame | Kestrel pos / \|v\| | Vela pos / \|v\| | Odyssey \|v\| |
|---|---|---|---|
| Inertial (origin) | (594.99, 16.11) / 1.291681 | (588.60, 45.41) / 1.296206 | 1.941404 |
| Inertial (barycentre) | (594.99, 16.11) / 1.291681 | identical (balanced system) | 1.941404 |
| Centred: Kestrel | (0.000, 0.000) / **0.000000** | (−6.40, 29.30) / 0.517018 | 0.815698 |
| Rotating: Kestrel–Vela | (−0.186, **0.000**) / **1.5e−5** | (29.799, **0.000**) / **2.3e−3** | 0.608737 |
| Rotating: Sol-K–Kestrel | (595.239, **0.000**) / **2.1e−4** | (589.64, 29.46) / 0.451744 | 0.789496 |

The two frame-defining bodies pin exactly to `y = 0` and to near-zero frame speed in each
rotating frame; the residual (1e−5 … 2e−3) is the bodies' real orbital eccentricity, not a
transform error. Vela's frame speed of 0.517 in the Kestrel-centred frame equals
√(8/30) = 0.5164, its true orbital speed. Sol-K's 9.04 LU/TU in the Kestrel–Vela frame is the
expected ω×r centrifugal term.

**Trails** transform with each historical sample's own frame state (a shared position ring
buffer of the whole system is kept, so no approximation is used). Visual proof, identical zoom
and epoch: `screenshots/06-trails-centred.png` (Vela's trail is a full circle) vs
`screenshots/07-trails-rotating.png` (the same trail collapses to a stationary point on the
+x axis, while the craft's trail becomes the expected rosette and the star's trail sweeps out
of frame). Velocity vectors are drawn from the frame velocity including the Coriolis term
`ω ẑ × r`, and the state-vector panel shows both frame and inertial components.

### 2.5 Pause, single-step, time warp, reset, energy-error reporting — **PASS**

All driven by clicking the labelled transport buttons.

```
running                 t = 15.48   paused false  warp 1     steps/f 8   ΔE −1.92e−13
click "Pause or resume" t = 15.82   paused true   steps/f 0
+1 s wall clock         t = 15.82   <- clock frozen exactly
3× "Single step"        t = 15.88   <- exactly 3 × dt (0.02) = 0.06 TU
3× "Increase time warp" warpTarget 1 -> 2 -> 5 -> 10 (still paused, t unchanged)
click resume            warp 4.48 -> 7.32 -> 9.12 -> 9.94 -> 10   (smooth log-space ramp)
                        steps/frame 8 -> 61 -> 77 -> 83
click "Restart"         t 1831.48 -> ~0, warp target back to 1, nodes cleared
```

Energy-error reporting is live in the HUD (`ΔE/E₀`), in the Mission tab (ΔE, Δ|p|, ΔL, peak,
baseline epoch and reason) and as a log-scale sparkline drawn on the canvas. The baseline is
re-taken automatically after any *discontinuous* change (burn, collision, manual state edit)
so the number reported is pure integrator drift, never the intentional Δv — the flight log
records each re-baseline.

Integrator comparison, identical scenario, 600 TU:

| integrator | dt | wall ms | ΔE/E₀ | Δp | ΔL | craft a | craft e |
|---|---|---|---|---|---|---|---|
| Velocity Verlet | 0.05 | 2 | 4.86e−11 | 8.5e−15 | −2.2e−14 | 11.9724 | 0.00438 |
| Velocity Verlet | 0.20 | 1 | 7.79e−10 | 3.5e−15 | 8.3e−15 | 11.9724 | 0.00443 |
| Yoshida 4 | 0.05 | 4 | 1.44e−14 | 2.6e−15 | 7.2e−15 | 11.9724 | 0.00437 |
| Yoshida 4 | 0.20 | 1 | −3.60e−15 | 7.2e−15 | 3.8e−15 | 11.9724 | 0.00437 |
| RK4 | 0.05 | 8 | 2.29e−14 | 3.8e−15 | 1.2e−14 | 11.9724 | 0.00437 |
| RK4 | 0.20 | 1 | −9.33e−16 | 2.8e−15 | −2.9e−16 | 11.9724 | 0.00437 |
| Dormand–Prince 4(5) | 0.05 | 25 | 2.28e−14 | 3.9e−15 | 1.1e−14 | 11.9724 | 0.00437 |
| Dormand–Prince 4(5) | 0.20 | 7 | 3.73e−15 | 4.5e−15 | 1.8e−15 | 11.9724 | 0.00437 |

All four methods converge to the same orbit (a = 11.9724, e = 0.00437) — independent
cross-validation of the force model. Verlet's error scales as dt² (16× for 4× dt), as expected
for a 2nd-order method. Over 20,000 TU at dt = 0.25, Verlet's error oscillates in a band around
1e−9 with no secular growth (the symplectic signature); RK4 sits at ~4e−14 and Yoshida 4 creeps
from 1e−16 to 1e−13 through round-off accumulation.

---

## 3. Feature checks

| # | Check | Result | Evidence |
|---|---|---|---|
| 3.1 | Real N-body: every body attracts every other, spacecraft included | PASS | craft e oscillates 0.0001→0.0075 from lunar/solar perturbation; planet acquires e = 0.0085 from the moon's tug |
| 3.2 | Four integrators selectable, tolerance active only for the adaptive one | PASS | Tolerance slider renders greyed/disabled for Verlet, live for DP45 (`screenshots/16-physics-tab.png`) |
| 3.3 | Default system: star, planet, moon, spacecraft, coherent units | PASS | `screenshots/00-hero-default.png` |
| 3.4 | Pan (drag) | PASS | drag +120,+80 px at scale 12.7665 → camera −9.399, +6.266 LU (exact: 120/12.7665 = 9.399) |
| 3.5 | Zoom (wheel), cursor-anchored | PASS | wheel −240 at (500,400): scale 8.6957 → 12.7665 = exp(240×0.0016) = 1.468×, anchor point preserved |
| 3.6 | Select body by click | PASS | click on canvas body and on `#body-<id>` rows both select |
| 3.7 | Drag spacecraft position while paused | PASS | real mouse drag 816,400 → 816,290 (110 px at scale 2.2) moved craft to exactly (80, 50); speed unchanged (frame velocity preserved), elements recomputed to a = 114.943, e = 0.55137 |
| 3.8 | Drag spacecraft velocity while paused | PASS | dragged the arrow head to (880,160); resulting frame velocity (1.0222, 2.0763) equals the predicted (64/62.61, 130/62.61) exactly; orbit flipped to hyperbolic e = 2.298 (`screenshots/08-drag-velocity.png`) |
| 3.9 | Inspect state vectors | PASS | Mission tab shows frame + inertial position/velocity/speed, mass, radius, r, altitude, ε, h, a, e, rp, ra, T, v_circ, v_esc, radial velocity, regime |
| 3.10 | Numeric state-vector editor (paused only) | PASS | four number inputs + CIRCULARISE / HALT; inputs render disabled while running |
| 3.11 | Smooth time acceleration/deceleration | PASS | see 2.5 ramp trace |
| 3.12 | Single-step | PASS | exactly 1 × dt per press; Shift+`.` = 10 |
| 3.13 | Checkpoint + revert | PASS | saved at t = 12.48, ran to t = 812.42, reverted → t = 12.48 with craft at (602.926050, 25.120264), identical to 6 dp; nodes and conservation baseline restored |
| 3.14 | Restart scenario | PASS | see 2.5 |
| 3.15 | Configurable timestep | PASS | slider + exact-value number box, log scale 1e−4 … 2 TU |
| 3.16 | Maneuver node: prograde/retrograde, radial in/out, Cartesian x/y | PASS | `#nodeMode` → `cart` rebuilds the editor with `nodeDvx`/`nodeDvy`; typed (0.10, −0.06) gives \|Δv\| 0.11662 and logs "(cartesian)". **Exact impulse check**: identical run with and without the node differs at t = 50.1 by exactly (0.100000, −0.060000) |
| 3.17 | Node time editable by slider, number, and by dragging the marker | PASS | `#nodeT`/`#nodeTNum` verified by typing. Real mouse drag of the marker from (440,208) to (530,338): burn re-timed 120 → 26.693 TU, marker snapped onto the predicted path at (605,309), `#nodeTNum` updated to 26.6933 |
| 3.18 | Node shows time, Δv magnitude, closest approaches, resulting orbit | PASS | node list row + post-burn panel + encounter panel |
| 3.19 | Reference frames: inertial, barycentric, body-centred (any body), rotating (auto-generated hierarchy pairs) | PASS | see 2.4; degenerate pairs are filtered by requiring the primary to be the heavier body |
| 3.20 | Controls for G, softening, dt, warp, horizon, resolution, trail length, collision behaviour, body scale, trajectory visibility, velocity vectors, orbital guides, tolerance | PASS | `screenshots/16-physics-tab.png`, `17-view-tab.png`; 16 overlay toggles enumerated in the DOM |
| 3.21 | Scenario: circular orbit | PASS | e stays 0.000000 over 60 TU; ΔE/E₀ −1.3e−14 |
| 3.22 | Scenario: elliptical orbit | PASS | a = 137.143, e = 0.5625 held exactly |
| 3.23 | Scenario: Hohmann transfer | PASS | see 3.28 |
| 3.24 | Scenario: moon transfer | PASS | pre-loaded TLI raises a 11.95 → 20.838 (design 21) and r_a to 29.68 (design 30); Vela flyby at 5.41 LU; craft survives; SOI-transition markers drawn (`screenshots/18-moon-transfer.png`) |
| 3.25 | Scenario: gravitational slingshot | PASS | heliocentric ε −0.4725 → −0.0817 (+83 %), a 1058 → 6123, closest approach to Jove 38.0 LU (3.5 planet radii); system ΔE/E₀ 1.3e−11 — the probe's gain comes out of Jove's orbit, as it must |
| 3.26 | Scenario: unstable three-body | PASS | Pythagorean 3-4-5 released from rest; chaotic evolution, ejection of the test craft on a hyperbolic arc (e = 1.11, ε > 0); all four bodies survive to t = 500 with ΔE/E₀ ~1e−11 (`screenshots/12-threebody.png`) |
| 3.27 | Scenario: escape trajectory | PASS | a = −93.023, e = 1.645, apoapsis reported "— (unbound)", regime "hyperbolic" |
| 3.28 | Hohmann executes correctly end-to-end | PASS | t=39: a 100, e 0, v 1.4142 → t=41 (burn 1): a 175, e 0.4286 → t=553: at apoapsis v 0.6761 → t=556 (burn 2): **a 250, e 0, v 0.89443** = √(200/250); still a = 250, e = 3e−8 at t = 4400. Predicted station rendezvous 0.358 LU |
| 3.29 | Telemetry completeness | PASS | see 3.9 plus: scheduled Δv remaining, next burn countdown, closest predicted encounter (body, distance, altitude, lead time, relative speed), predicted impact |
| 3.30 | System energy and momentum error tracked | PASS | E, KE, PE, \|p\|, L, ΔE/E₀, Δ\|p\|, ΔL, peak, baseline epoch |
| 3.31 | Overlays: trajectories, potential, velocity vectors, acceleration vectors, orbital elements, SOI, encounter markers, integration error | PASS | `screenshots/11-potential-field.png` shows the banded log-potential field, the SOI circles, apsis markers, and the error sparkline |
| 3.32 | Collision behaviour: none / crash / bounce / merge | PASS | probe dropped into the planet in each mode: none → passes through (r 14.4, alive); crash → "LOSS OF VEHICLE — Probe-1 impacted Terra"; bounce → "CONTACT", speed 4.17 → 1.24, rests at r = 10.12; merge → "MERGE — Probe-1 absorbed by Terra" |
| 3.33 | HUD: fps, MET, warp, steps/frame, body count, ΔE/E₀, frame, pause state | PASS | all eight fields present and live in every screenshot |
| 3.34 | Keyboard | PASS | Space, `[`, `]`, `f`, `b`, `n`, `Delete`, `c`, `Backspace`, `t v a g o p l e`, `h`, `Esc` verified with real key presses. `.` = +0.02 TU (1×dt), `Shift+.` = +0.20 TU (10×dt) exactly; `c` then `x` reverted t 40.54 → 15.54, the exact checkpoint epoch |
| 3.35 | Resize adaptation | PASS | 1280×800 → 900×600 → 1600×900 → 1024×768 → 1280×800 while running: backing store tracks exactly, 60 fps throughout, sim time continuous, no horizontal scroll, no errors |
| 3.36 | High-DPI | PASS | iPhone 16 Pro emulation, DPR 3, CSS 402×874 → backing store 1005×2185 = round(402×2.5)×round(874×2.5) (deliberate 2.5 cap); 57 fps |
| 3.37 | Narrow viewport 390×844 | PASS | panel auto-hides to a bottom sheet, HUD compacts to two columns, transport wraps; opening the sheet re-centres the world view into the visible strip (`screenshots/09-…`, `10-…`) |
| 3.38 | Touch / pointer | PASS (emulated) | `pointerType:'touch'` events dispatched into the live handlers under iPhone 16 Pro emulation: two-finger spread 100 px → 280 px zoomed by **exactly 2.8×**; one-finger drag of +100,+100 px panned by exactly (−100/scale, +100/scale) = (−8.173, +8.173); tap on a body changed the selection odyssey → kestrel. Physical touch hardware: **BLOCKED** (see §6.6) |
| 3.39 | Export / import / persistence | PASS | EXPORT writes 2,166 bytes of complete state; loading a different scenario then IMPORT restores the original 4-body system; SAVE/LOAD LOCAL round-trips through `localStorage` — verified under `file://` too |
| 3.40 | Console clean, no failed requests | PASS | `agent-browser errors` and `console` empty across every session; the only network entries are the document itself and the browser's own `/favicon.ico` |

---

## 4. Standalone-file and runtime restriction checks

| Check | Result | Detail |
|---|---|---|
| Single self-contained file | PASS | one `<style>`, one inline `<script>`, zero `src=`/`@import`/`http(s)://` occurrences |
| No network at runtime | PASS | `agent-browser network requests` filtered for non-`127.0.0.1` entries: none. No `fetch`, `XMLHttpRequest`, `WebSocket`, or `importScripts` anywhere in the file |
| No build step, no libraries | PASS | plain ES5-style JavaScript, Canvas 2D only |
| No image assets | PASS | starfield, nebulae, planets, star glow and the spacecraft icon are all procedurally drawn (deterministic `mulberry32` PRNG seeded once) |
| **Opening the delivered file directly works** | **PASS** | opened `file:///…/index.html`: 60 fps, running 4-body simulation, `SIM.state()` healthy, ΔE/E₀ −4.9e−13, zero console errors, zero network requests (`screenshots/15-file-protocol.png`). Persistence, JSON export/import, keyboard, tabs and the full node workflow were all re-exercised under `file://` |

The local HTTP server was used only for convenience during development; the direct-file check
above is a genuine PASS, not a substitution.

---

## 5. Defects found during validation and fixed

All were found by these tests, not by inspection, and each was re-tested afterwards.

1. **Prograde was measured against the wrong frame.** `maneuverBasis` normalised the craft's
   *barycentric inertial* velocity. Around a moving planet, that points nowhere useful: the
   translunar injection produced a = 15.8 instead of the designed 21. Fixed to use the velocity
   relative to the dominant attractor. Retest: a = 20.835, r_a = 29.68 (design 21 / 30).
2. **A massless station could become the "primary".** During the (deliberately exact) Hohmann
   rendezvous, the station's 1/r² term briefly exceeded the planet's, so `dominantIndex`
   returned the station and the prograde basis was taken against a near-zero relative velocity
   — the circularisation burn fired ~113° off-axis and left a = 165 instead of 250. Fixed by
   excluding bodies below 1e−6 of the system's largest mass from ever being a primary, and by
   giving the station exactly zero mass. Retest: a = 250, e = 0, v = 0.89443 = √(μ/r).
3. **Two point masses passing within ~3e−5 LU exchanged a singular impulse**, knocking the
   station from a = 250 to a = 240.6. Physically correct for point masses with zero softening,
   but a poor default: the rendezvous phase now carries 0.02 rad of lead (~5 LU miss), after
   which the pair holds station indefinitely (separation 5.000 at t = 556, 5.001 at t = 4400).
4. **The slingshot was not a slingshot.** v_∞ = 0.34 was below Jove's escape speed at the
   start range, so the probe was *captured* and spiralled into the planet on every parameter
   variant tried. Redesigned as a genuine hyperbolic encounter (v_∞ = 0.9, impact parameter
   −65, start range 260); now a clean 38 LU flyby with a +83 % heliocentric energy gain.
5. **The three-body scenario merged itself away**, leaving 1 of 4 bodies by t = 122. Switched
   to `collide: none` with Plummer softening 0.45 and a more compact/faster configuration; all
   four bodies now survive with ΔE/E₀ ~1e−11 while remaining genuinely chaotic.
6. **The default moon at 0.5 Hill radii was not long-term stable** — moon and craft both
   escaped the planet by t ≈ 32,000. Planet mass raised 3 → 8 MU (moon now at 0.36 R_Hill);
   stable through 135,000 TU (see 2.1).
7. **The moon-transfer default impacted the moon** ("LOSS OF VEHICLE — Ferry-2 impacted Vela").
   Moon phase given 0.34 rad of lead; flyby is now 5.41 LU with the craft intact.
8. **Time-dependent control readouts went stale** (a node's "Δt from now" froze at whatever it
   was when the panel last synced). Controls now re-sync every UI tick, skipping the focused
   element so typing and dragging are never fought.
9. **Apoapsis marker printed a negative radius** (`Ap −80.00`) because the label reused the
   signed perifocal coordinate. Now prints the radius.
10. **Panel toggle and transport layout were driven by CSS sibling selectors that could never
    match** (the elements precede `#panel` in the DOM). Replaced with a `body.panelOn/panelOff`
    class and a `--panelW` custom property.
11. **The world view was centred on the whole viewport**, so with the mobile bottom sheet open
    the system sat behind the panel. Rendering now centres on the visible canvas region.
12. **Encounter countdowns could read negative** ("−00:02:26") when the ≤10 Hz prediction was a
    frame stale; sub-zero lead times now render as "now".
13. **Closest-approach markers labelled the body the craft was already orbiting**, cluttering
    the view with a restatement of periapsis. The current primary is now excluded from the
    canvas markers and the summary line (it is still listed, tagged "current primary", in the
    encounters panel).
14. **Node dragging read a shared scratch buffer** that was only valid if the prediction had
    just been drawn. Now recomputes the frame transform per sample.

---

## 6. Known limitations

1. **The model is planar (2-D).** A normal (out-of-plane) Δv component has no meaning in the
   plane, so the maneuver editor deliberately offers prograde/retrograde, radial in/out and
   Cartesian x/y only. This is stated in the app's Help tab. Inclination, RAAN and argument of
   ascending node are correspondingly absent from the element readout.
2. **Zero softening plus point masses is stiff by construction.** Two bodies that pass within
   ~1e−4 LU exchange a large impulse in a single step. That is correct Newtonian behaviour, not
   a bug, and the Softening ε control exists to regularise it — but a user who engineers an
   exact intercept with softening 0 will see the encounter kick their orbit.
3. **Time warp is bounded by the step budget.** Above it the app either enlarges `dt` (default,
   "Auto-enlarge dt at high warp") or throttles the clock; both states are reported in the HUD
   (`⚠` marker, `steps/f @dt` readout, "warp achieved" diagnostic). Accuracy at very high warp
   is therefore lower — visible directly in the error plot.
4. **Prediction refresh is capped** at ~10 Hz while running and at a 55 ms compute budget per
   pass (`pred.truncated` is surfaced in the diagnostics panel as "(budget)"). Countdowns can
   therefore be up to ~100 ms stale.
5. **RK4's secular energy drift was not demonstrated.** Over the 20,000 TU tested it stays at
   ~4e−14; showing the classic drift would need a much longer run or repeated close encounters.
   The claim in the integrator label ("non-symplectic") is a statement about the method, not a
   measurement made here.
6. **Touch was exercised through Pointer Events and mobile device emulation only.** Pinch,
   pan and tap were dispatched as genuine `pointerType:'touch'` events into the live handlers
   and gave exact results (§3.38), but no physical touch hardware was available — the driver's
   iOS path needs `xcrun simctl`, which is absent on this Linux host, so real-device gesture
   behaviour (momentum, palm rejection, browser gesture interception) is **BLOCKED**, not passed.
7. **`localStorage` under `file://` worked in the Chrome build tested** but is browser- and
   policy-dependent; failures are caught and surfaced as a toast rather than breaking the app.
8. **Sub-pixel label crowding** persists when several markers (apsides, encounter, node)
   coincide at low zoom. Labels can be turned off (`L`), and zooming separates them.

---

## 7. Screenshot index

| File | What it shows |
|---|---|
| `00-hero-default.png` | Default Kestrel System, planet-centred frame |
| `01-default-1280x800.png` | Early desktop capture |
| `02-node-planned.png` | Node planned: violet prediction diverging after the marker, post-burn panel |
| `03-node-executed.png` | Same node after execution — trail shows the actual orbit change |
| `04-frame-centred-kestrel.png` | Kestrel-centred frame |
| `05-frame-rotating-kestrel-vela.png` | Rotating Kestrel–Vela frame, state vector panel |
| `06-trails-centred.png` | Vela's trail as a full circle (centred frame) |
| `07-trails-rotating.png` | The same trail collapsed to a point (rotating frame) |
| `08-drag-velocity.png` | After dragging the velocity handle to a hyperbolic orbit |
| `09-narrow-390x844-closed.png` | 390×844, panel closed |
| `10-narrow-390x844-panel.png` | 390×844, bottom sheet open |
| `11-potential-field.png` | Gravitational potential overlay, SOI, apsis markers |
| `12-threebody.png` | Pythagorean three-body chaos with an ejected probe |
| `13-hohmann.png` | Completed Hohmann transfer, circular at 250 LU |
| `14-highdpi-mobile.png` | iPhone 16 Pro emulation at DPR 3 |
| `15-file-protocol.png` | Running from `file://` |
| `16-physics-tab.png` | Physics controls incl. disabled tolerance/restitution |
| `17-view-tab.png` | Reference frame, 16 overlay toggles, scale sliders, camera |
| `18-moon-transfer.png` | Post-flyby lunar transfer trajectory |
