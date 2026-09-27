# Validation — Orbital Mission Planner

Artifact: `index.html` (single self-contained file, no external assets).
Tool: `agent-browser` 0.31.1 (headless Chromium via CDP), session `orbital-test`.
Server for inspection only: `python3 -m http.server 8734` (not a runtime dependency).
Viewport tests: 1280×800 desktop, 390×844 narrow.

## Results

| Check | Result | Evidence |
|---|---|---|
| Page loads, sim runs immediately | pass | `01-initial.png`, HUD `T+` advancing, `RUNNING` |
| N-body integration correctness | pass | Verlet dt=0.05; circular orbit e=0.000 (rp=ra=80); elliptical e=0.5 matches design (rp 26.7/ra 80); escape e=2.38 hyperbolic |
| Energy/momentum tracking | pass | ΔE ≈ −1.5e-9 rel. at T+1500; drift −1.3e-9 per 200u (symplectic); ΔP err ~1e-15; RK4 mode drift −6.4e-14; adaptive substeps functional (tol-gated) |
| Pause / resume | pass | `togglePause`/`Space` key: simT froze at 218.15 across 2 s |
| Single-step | pass | two `Step ▸` → simT advanced exactly +0.05 each |
| Time warp | pass | slider (log) + −/+ buttons; HUD shows ×factor; sim rate scales |
| Checkpoint save / rewind | pass | saved at T+332.95, ran past 400, rewind restored exactly 332.95 |
| Restart / scenario load | pass | all 8 presets load and run (see below) |
| Predicted trajectory | pass | dashed path rendered from live state; 1200-pt resolution; recomputes on state change |
| Maneuver node via canvas click | pass | click on dashed path at screen (950,315) → node created at predicted T+397 |
| Node editing recomputes prediction | pass | `nd_pro` fill 0.5 → dvP=0.5, post-burn elements e=0.78 / Ap=41 displayed, path reshaped |
| Burn executes at node time | pass | node at T+102 → `done=true`, craft velocity changed, craft left planet orbit (heliocentric e=0.30) — `03-post-burn.png` |
| Node list / delete | pass | list row selects node; Delete removes it |
| Reference frames | pass | inertial (barycenter), body-centered (`04-focus-planet.png`), rotating pair (`05-rotating.png`): Planet↔Moon lock, moon screen-angle drift = 0.000° over 130 u |
| Trails transform in frames | pass | trails stored in world coords, re-transformed per frame — correct in focus/rotating views |
| Drag spacecraft position (paused) | pass | pointer drag moved craft (155,0)→(196,43) |
| Drag velocity arrow (paused) | pass | arrow-tip drag set v (0,4.00)→(2.28,2.28) |
| Select body by canvas click | pass | click on Star → selected index 0 |
| Pan / zoom | pass | drag pans; wheel zooms at cursor (zoom 1.85→2.47) |
| Telemetry panel | pass | pos, vel, speed, primary, dist, ε, h, e, Pe, Ap, period, sched. Δv, closest encounter (Moon 3.03u @ T+495), sys ΔE/ΔP |
| Overlays | pass | trails, prediction, velocity vectors, accel vectors, orbit guides (osculating ellipse + Pe/Ap), SOI circles, gravity-potential field, encounter markers, labels, grid — `07-overlays.png` |
| Scenario: solar (default) | pass | 4 bodies, craft bound e≈0.11, stable to T+1400 (verified by stepping) |
| Scenario: circular | pass | e=0.000 |
| Scenario: elliptical | pass | e=0.5 |
| Scenario: Hohmann | pass | 2 preset burns; burn 1 executed → transfer a=130, ra=200 = target orbit — `06-scenario-hohmann.png` |
| Scenario: moon transfer | pass | predicted+actual moon flyby ~3.0u, all bodies survive — `06-scenario-moonTransfer.png` |
| Scenario: slingshot | pass | hyperbolic flyby e=1.97, Pe=18.3 — `06-scenario-slingshot.png` |
| Scenario: unstable 3-body | pass | binary pair + chaotic Wanderer (ejects ~T+200) — `06-scenario-threeBody.png` |
| Scenario: escape | pass | e=2.38 hyperbolic |
| Spawn spacecraft | pass | + button adds craft in low orbit around selected/primary body |
| Collision modes | pass | merge/destroy/none(softened); verified via early impact events during tuning |
| Export / import JSON | pass | exported state re-imported via file input; bodies+simT restored |
| Invalid input | pass | `dt=-5` rejected, `.bad` styling, value unchanged |
| Narrow viewport 390×844 | pass | HUD wraps; panel becomes bottom sheet via ☰ Controls — `08/09-*.png` |
| High-DPI | pass | canvas scaled by devicePixelRatio (≤2.5) |
| Direct file:// open | pass | opened `file:///…/index.html`, runs, no network |
| No external requests | pass | network log: only the document itself; no CDN/font/script fetches |
| Console errors | pass | `errors`/`console` empty |

## Fixes made during validation

1. **Craft spawned at collision boundary** (r=4 = planet r3 + craft r1) → immediate impact. Raised to r=6.
2. **Moon at r=12 was Hill-unstable** — eccentricity pumped by star until planet impact (~T+88–250). Moved to r=8; verified stable to T+3000 headless.
3. **Moon mass 0.5 perturbed craft into moon impact** — reduced to 0.05 (solar) / 0.2 (moonTransfer).
4. **moonTransfer retuned** — dead-on impact → 2.7–3.1u flyby (r=9 moon, transfer apo=9, phase +0.35).
5. **threeBody Wanderer died in <100u** — retuned to chaotic wander then ejection ~T+200.
6. `onchange` → `oninput` on numeric fields so programmatic/UI edits apply immediately.
7. `dominant()` hardened against invalid index (crash on `elements(-1)`).
8. `updateNodeList` DOM rebuilt every frame → signature-gated rebuild (click stability).
9. `zoomFit` now accounts for the 312 px side panel; default frame focus skips craft.
10. Spawn-craft targets selected craft's primary instead of always the star.

## Known limitations

- Rotating-frame selection requires choosing the lock body in the dropdown; defaults to the focus body's dominant perturber.
- At very high warp (≥1e4) the 9 ms/frame physics budget throttles effective rate; steps/frame is shown in the HUD.
- Maneuver nodes are time-tagged; if the craft's actual state diverges from prediction (e.g., unplanned collision), the burn still fires at its scheduled time.
- 2-D simulation; the "normal" Δv input is intentionally disabled.
