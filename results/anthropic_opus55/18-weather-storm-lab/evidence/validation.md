# Validation report: Stormlab, a 3D Weather & Storm Laboratory (`index.html`)

Author: Claude (Opus 5.5, agent run on 2026-09-30).
Browser observations come from a real Chromium driven by the **agent-browser** CLI. Model-level numbers come from running the exact simulation code of `index.html` headless in Node. Every figure below is copied from a file in `evidence/logs/`, and every screenshot named lives in `evidence/screenshots/`.

Result legend:
- **pass**: observed working.
- **fail**: observed broken.
- **blocked**: could not be exercised here.
- **not run**: not attempted.

---

## 1. Environment and tool availability

| Item | Value |
|---|---|
| Browser automation | **agent-browser 0.31.1** (the installed skill). Before use I read `agent-browser skills get core --full` (the version-matched core workflow and command reference) and `agent-browser skills get dogfood` (the exploratory-testing workflow). All runs used an isolated daemon namespace (`AGENT_BROWSER_NAMESPACE=stormlab18`). |
| Browser | Headless Chromium launched by agent-browser |
| WebGL implementation | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`. This is a **CPU software rasteriser**. The WSL2 host exposes no GPU to headless Chrome, so every FPS number below understates real-GPU performance. |
| Host | Linux 6.6.87.2-microsoft-standard-WSL2 x86_64, 32 cores, Node v25.8.1 |
| Touch input | agent-browser has no generic touch command for local Chromium. Real touch events were dispatched through CDP `Input.dispatchTouchEvent` on agent-browser's own browser (`scripts/touch.mjs`). |
| Wheel input | `agent-browser mouse wheel` produced **no** wheel event on the page (verified with a page listener: 0 events). Wheel input therefore goes through CDP `Input.dispatchMouseEvent(mouseWheel)` (`scripts/wheel.mjs`). |
| Radio buttons | `find role radio --name …` did not match the tool radios. `find label "<name> tool" click` does, and so do `@ref` clicks from `snapshot -i`. |

No substitute browser tool was needed. All UI checks used agent-browser plus the two CDP input helpers, both of which act on agent-browser's own browser.

## 2. How to reproduce

```bash
cd <working dir>                                   # contains index.html and evidence/
evidence/scripts/run-validation.sh                 # all browser checks v01..v21 (≈40 min under SwiftShader)
evidence/scripts/run-validation.sh v04 v12         # any subset
node evidence/scripts/sim-sweep.mjs 90             # every preset, 90 simulated minutes, headless
node evidence/scripts/sim-regions.mjs mountain 90  # windward vs lee precipitation
node evidence/scripts/sim-regions.mjs snowband 90  # upwind vs downwind lake-effect snow
node evidence/scripts/sim-tc.mjs                   # tropical-cyclone radial structure
node evidence/scripts/sim-determinism.mjs          # same seed → same hash, all presets
node evidence/scripts/sim-profile.mjs squall 48 16 # cost per model stage
```

**Rules the suite follows** (`evidence/scripts/run-validation.sh`):
- The app is driven only through real input:
  - clicks: `find role button` / `find label` / CSS selectors;
  - `select` for drop-downs;
  - keyboard: `press`, and Home/End/arrows on focused sliders;
  - mouse strokes: `mouse move/down/up` in interpolated steps;
  - wheel and touch: via CDP, as described in §1.
- `window.stormLab.*` is a **read-only observer**. It returns state, hashes and field sums, and the suite never drives the app through it.
- `evidence/scripts/screenpos.js` only projects a model location to screen pixels, so that real mouse strokes can be aimed at a known model cell.
- Downloads (CSV, JSON, PNG) are captured with `agent-browser download` after scrolling the button into view.

The Node scripts load the `// === CORE BEGIN/END ===` blocks straight out of `index.html`, so they test the shipped model code rather than a copy.

## 3. Model-level checks (headless, same code)

Sweep of all presets, 90 simulated minutes each, at 48×48×16 (`logs/sim-sweep-90min.log`).

```text
squall     init 644ms step 17.5ms dt~6.0 cfl0.32 guard0 acc0.33mm snow0.00 | 17m w24/-6 cc8 pr17 fl0 | 32m w22/-8 cc21 pr27 fl11 | 47m w31/-10 cc28 pr54 fl21 | 62m w27/-16 cc37 pr79 fl32 | 77m w38/-26 cc45 pr68 fl45
supercell  init 452ms step 17.4ms dt~5.0 cfl0.32 guard0 acc0.15mm snow0.00 | 17m w31/-9 cc6 pr26 fl1 | 32m w19/-18 cc14 pr12 fl10 | 47m w29/-23 cc26 pr7 fl10 | 62m w35/-32 cc35 pr11 fl17 | 77m w41/-29 cc51 pr7 fl26
mountain   init 597ms step 16.9ms dt~6.0 cfl0.14 guard0 acc0.87mm snow0.00 | 18m w4/-4 cc34 pr10 fl0 | 33m w4/-3 cc30 pr9 fl0 | 48m w4/-3 cc35 pr5 fl0 | 63m w6/-3 cc36 pr10 fl0 | 78m w9/-4 cc36 pr15 fl0
seabreeze  init 38ms step 16.0ms dt~6.0 cfl0.10 guard0 acc0.00mm snow0.00 | 15m w1/-1 cc0 pr0 fl0 | 30m w4/-1 cc1 pr0 fl0 | 45m w5/-3 cc2 pr0 fl0 | 60m w6/-3 cc3 pr0 fl0 | 75m w7/-4 cc3 pr0 fl0 | 90m w9/-4 cc4 pr1 fl0
cumulus    init 62ms step 16.0ms dt~5.0 cfl0.14 guard0 acc0.00mm snow0.00 | 15m w6/-3 cc7 pr0 fl0 | 30m w7/-4 cc5 pr0 fl0 | 45m w8/-4 cc4 pr0 fl0 | 60m w10/-5 cc8 pr0 fl0 | 75m w9/-12 cc14 pr0 fl0 | 90m w12/-9 cc9 pr0 fl0
tropical   init 379ms step 16.0ms dt~20.0 cfl0.59 guard0 acc1.07mm snow0.00 | 22m w18/-3 cc2 pr48 fl0 | 37m w24/-5 cc20 pr167 fl0 | 52m w28/-15 cc19 pr176 fl2 | 67m w26/-19 cc18 pr171 fl5 | 82m w23/-17 cc17 pr213 fl5
coldfront  init 285ms step 17.5ms dt~8.0 cfl0.53 guard75 acc3.56mm snow0.00 | 17m w13/-11 cc33 pr4 fl0 | 32m w19/-14 cc47 pr17 fl0 | 47m w21/-17 cc44 pr64 fl3 | 62m w28/-21 cc59 pr48 fl11 | 77m w30/-22 cc86 pr77 fl14
heatisland init 43ms step 16.7ms dt~6.0 cfl0.23 guard0 acc0.03mm snow0.00 | 15m w5/-1 cc0 pr0 fl0 | 30m w6/-2 cc1 pr0 fl0 | 45m w13/-2 cc1 pr0 fl0 | 60m w38/-9 cc2 pr59 fl1 | 75m w42/-17 cc3 pr45 fl4 | 90m w24/-15 cc5 pr2 fl6
snowband   init 343ms step 17.1ms dt~8.0 cfl0.38 guard0 acc0.06mm snow0.04 | 18m w11/-5 cc8 pr0 fl0 | 33m w16/-7 cc23 pr3 fl0 | 48m w19/-8 cc52 pr1 fl0 | 63m w19/-9 cc31 pr2 fl0 | 78m w19/-9 cc33 pr1 fl0
stress     init 47ms step 15.3ms dt~8.0 cfl1.00 guard98 acc0.25mm snow0.00 | 15m w55/-16 cc18 pr42 fl5 | 30m w16/-11 cc13 pr11 fl30 | 45m w45/-14 cc23 pr6 fl34 | 60m w11/-11 cc11 pr2 fl53 | 75m w31/-11 cc22 pr2 fl55 | 90m w11/-11 cc13 pr5 fl65
```

Format: `w<max>/<min>` is the extreme vertical velocity (m/s); `cc` is cloud cover (%), `pr` the maximum surface rain rate (mm/h) and `fl` the cumulative lightning flashes, all at the indicated simulated time. `guard` counts cells clamped by the range guards. It is 0 for 8 of 10 presets; the numerical stress test and the cold front (75 hits over 90 min) are the exceptions.

Highlights:

- **Orographic precipitation.** Mountain preset, westerly flow over a north–south ridge, 90 min (`logs/sim-regions-mountain.log`):

  | Band | Accumulation | Cloud fraction |
  |---|---|---|
  | Windward slope (x 0.40–0.55) | 3.02 mm | 0.99 |
  | Crest (0.55–0.70) | 2.66 mm | 0.54 |
  | Lee (0.70–0.85) | 0.19 mm | 0.10 |
  | Far lee (0.85–1.00) | 0.002 mm | 0.01 |
  | Upwind plain (0.20–0.40) | 0.05 mm | 0.66 |

  That is a clear rain shadow.

- **Lake-effect snow.** Snow band preset, 90 min (`logs/sim-regions-snowband.log`):

  | Band | Cloud fraction | Snow |
  |---|---|---|
  | Upwind land | 0.03 | 0 |
  | Over the lake | 0.27–0.54 | 0.008–0.034 mm |
  | Downwind shore (0.70–0.85) | 0.54 | 0.160 mm |

  These are row-averaged values. The band itself is narrower and locally several times heavier.

- **Tropical-cyclone approximation.** Warm-pool SST plus exaggerated Coriolis (`logs/sim-tc-structure.log`). A coherent vortex with 7–11 m/s azimuthal-mean tangential wind inside 50 km persists for 3 h+. Cloud is concentrated in the core (0.75–1.0 within 20 km), falling to 0.0–0.3 beyond 70 km, and there is low-level inflow (−3 to −5 m/s at hour 3). It does **not** intensify into a mature hurricane: it slowly spins down. This is labelled "approx." in the UI and is listed as a limitation.

- **Determinism.** For all ten presets, seed 777 run twice gives identical FNV hashes after 40 steps, and seed 778 gives a different hash (`logs/sim-determinism.log`).

- **Cost per step** (`logs/sim-profile.log`, measured while the browser suite was also running): 23 ms at 48×48×16, 46 ms at 64×64×20, 113 ms at 96×96×24. The pressure projection and advection dominate.

## 4. Browser checks

The final full run is `logs/summary-final.log`; v02 was re-run after a test-pattern fix (see below). Every check drives the UI with real input and records its steps and raw values in `logs/<id>.log`.

| ID | Check | Result | Key observations (log / screenshots) |
|---|---|---|---|
| v01 | Direct `file://` load, errors, network, offline | **pass** | Title "Stormlab · 3D Weather & Storm Laboratory"; WebGL2 via ANGLE/SwiftShader. Page errors: none. Console: empty. The only network request is the `file://…/index.html` document. `performance` resource entries: `[]`. No external `src`/`href` in the file, and the file ships a CSP of `default-src 'none'`. A reload under `set offline on` works (simulation at t = 318 s). `v01-load.png` |
| v02 | Local HTTP with external network blocked | **pass** | Own `python -m http.server` on a free port (127.0.0.1:53013); Chromium routed through a dead proxy (`--proxy http://127.0.0.1:9`, bypass only loopback). App title correct; state `{webgl:true, time:642, steps:107}`. Requests: the document only. Navigating to `https://example.com` fails with `net::ERR_PROXY_CONNECTION_FAILED`. *Earlier runs of this check were invalid: ports 8765/8766 belonged to other processes, and one verdict was hard-coded. Both were fixed before the final pass.* |
| v03 | Storm preset evolves in the actual fields | **pass** | Three samples ~12 s apart (t = 234 s → 1368 s → 2472 s). Every prognostic field's mean/min/max changes, and the hashes are `a20a21cf` → `2f4541ee` → `0ae3301e`. Max w goes 8.5 → 24.8 → 24.5 m/s; max qc 1.24 → 1.83 → 2.08 g/kg; max qr 0.02 → 5.94 → 6.29 g/kg; min θ drops 303.7 → 285.1 K (rain-cooled cold pool); cloud cover 1.8% → 14.7% → 21.3%; flashes 0 → 2 → 18. `v03-t1/t2/t3.png` |
| v04 | Heat + moisture brush versus a same-seed control | **pass** | The probe is placed by a map click at cell (36,30), east of the initial line. **Control run** (reset, 25 sim-min, probe CSV exported): qc_max stays 0.00 and w_max ≤ 0.4 m/s throughout. **Intervention run** (reset; while paused, one Heat stroke and one Moisten stroke with the mouse on the 3D terrain; 80 brush stamps; Σθ in the target box +89.6 K·cells and Σqv +67 g/kg·cells *immediately*, sim time frozen): w_max climbs 0.4 → 6.0 m/s over 9 min, cloud first appears at 3.5 min (0.14 g/kg) and peaks at 1.19 g/kg at 8 min, light rain of 0.1 mm/h falls at 10.5–12.5 min, and the cell decays by 15 min. Surface rain stayed below the 1 mm/h threshold for this single-stroke dose. In an earlier exploratory session, a longer heat + moisture stroke over a larger box gave 18–32 mm/h surface rain ~15–20 min later. `logs/v04-control.csv`, `logs/v04-intervention.csv`, `v04-*.png` |
| v05 | Wind impulse brush and wind-strength control | **pass** | While paused, a mouse drag with the Wind tool raises Σv (northward wind) in the target box 92.3 → 326.2 m/s·cells immediately. Pressing End on the focused "Wind strength" slider (→ 3.0×) raises the environmental u at 3 km to 35.9 m/s, and over ~20 sim-min the domain-mean u at 3 km rises 11.97 → 28.00 m/s through mean-state nudging and boundary inflow. `v05-after.png` |
| v06 | Diagnostic modes | **pass** | All 11 non-cinematic modes were selected with the drop-down. Map titles, legends and 3D slices update. Field ranges were computed from the live fields at the same moment, e.g. w −14.0..24.2 m/s against the model's max updraft statistic of 24.2; RH 2..100%; cloud 0..1.87 g/kg. Key V cycles modes. Pressure is shown 1-2-1 filtered and labelled as such (F11). `v06-<mode>.png` |
| v07 | Probe: click, readout, profile, time series, CSV | **pass** | A click on the 3D terrain at the projected position of cell (19,14) moves the probe to exactly (19,14). The readout table matches the observer sample: T 27.0 °C, Td 24.4 °C, RH 85%. All four diagnostic canvases are non-blank (pixel standard deviation 62–103). CSV: header plus 53 data rows = 53 recorded samples, 19 columns. `v07-probe.png`, `logs/v07-probe.csv` |
| v08 | Lightning | **pass** | The ⚡ button gives a manual CG flash at the most charged column (charge 100.0); the channel is visible in `v08-manual-flash.png`. With the storm active (max w 29.1 m/s) the automatic flash count rose 9 → 20 in 10 s; after pressing Home on "Lightning probability" (→ 0) it stayed 21 → 21 over the next 10 s. Thunder: after clicking the sound button, the AudioContext state was `running` and a manual flash scheduled thunder 16.3 s later for a flash 55.9 km away (sound speed ×10 time compression, stated in the UI). **The audio itself was not listened to.** |
| v09 | Camera | **pass** | Orbit drag: yaw 0.55 → −0.35, pitch 0.42 → 0.66. CDP wheel: distance 62 → 30.2. Right-drag pan: target (0,2.9,0) → (4.5,2.9,1.7). Camera presets Satellite, Horizon, Cross-section, Storm chase, Cinematic orbit and Overview each animate to their pose. F then W (free-fly) moves the eye. `v09-*.png` |
| v10 | Pause / step / resume | **pass** | Paused for 2.5 s: time 228 s and step 38 unchanged, and the HUD shows PAUSED. The Step button gives step 39 (t +6.0 s = dt); the "." key gives step 40. After Resume, 2.5 s later: step 78. |
| v11 | Quality and resolution while running | **pass** | Cloud quality Ultra (140 march steps) and Low (40). Render resolution slider Home/End: 320×200 ↔ 1280×800. Resolution 48→64 is resampled in 46 ms; time is kept and cloud cover is continuous. Layers 16→20 work the same way. The sim keeps running after each change, and there were no page errors. `v11-*.png` |
| v12 | Reset with the same seed | **pass** | Reset plus 15 single steps: hash `a20a21cf`, twice. Seed 12345: `237cb631`. Seed restored: `a20a21cf` again. Headless, all 10 presets reproduce hashes for the same seed and differ for another seed (`logs/sim-determinism.log`). |
| v13 | Narrow viewport 390×844, touch | **pass** | No horizontal overflow (scrollWidth 390 = innerWidth). The top bar wraps; Controls and Diagnostics open as bottom sheets; tapping a tool works. Real touch through CDP: a one-finger drag changes yaw 0.55 → −0.03 and a two-finger pinch changes distance 62 → 18.2. `v13-narrow*.png` |
| v14 | Save / load; invalid files | **pass** | Saved state is 1.93 MB JSON (all prognostic and surface fields, terrain, parameters, RNG, probe history). Running on changed the hash to `00c82906` (t = 1212 s); loading the file restored hash `7c6608dd` and t = 750 s exactly, with 21 probe samples. Six invalid files were each rejected with an error toast and an **unchanged hash**: malformed JSON, wrong format, truncated field, NaN in θ, out-of-range dt, unsupported grid. `v14-rejected.png` |
| v15 | Settings persistence | **pass** | Exposure +0.15 EV, mode w, map level "slice" and preset Mountain survive a reload (with a toast saying so). "Reset saved settings" restores the defaults. |
| v16 | PNG export | **pass** | A 1280×828 PNG (the 3D view plus a caption strip) with a valid signature, 533 KB. `v16-exported-view.png` |
| v17 | Missing WebGL2 | **pass** | `?webgl=off` shows the "3D view unavailable" panel with an explanation, and the simulation keeps running. A **real** launch with `--disable-webgl --disable-webgl2` shows the panel with "WebGL2 is not available…" while the simulation reaches t = 516 s and the map, section and probe keep updating. `v17-*.png`. A shader-compile failure uses the same path; it was observed for real during development (F1). |
| v18 | All ten presets | **pass** | Each preset loads its own domain (28–180 km), sounding (T0 264–304 K, lapse 6.0–9.2 K/km), wind profile, terrain (ridge 2.2 km, coast, ocean, city, lake, rugged 2.3 km), surface map and parameters. Observed after ~15 s wall: squall cloud cover 17% and 31 mm/h; supercell max w 29 m/s and 52 mm/h; mountain 30% orographic cloud; TC with rotating cloud over a 99% ocean domain; cold front 45% cloud and 22 mm/h; snow band 50% cloud; stress test max w 47 m/s with "limited" shown. `v18-*.png`, `v18-presets-montage.png` |
| v19 | Stability constraint and indication | **pass** | Stress preset with auto-limit on: dt is limited 30 → 6.2 s (Courant 1.00), which the panel reports as "Timestep auto-limited 30.0 → 6.2 s (Courant ≤ 1)". Clicking the checkbox off (param now false): dt 30 s, Courant **4.25**, diffusion number **0.73**. The panel shows red badges and the warnings "⚠ Courant number > 2 …" and "⚠ Diffusion number > 0.5: explicit diffusion is unstable …". The HUD values turn red, all fields stay finite, and the guards clamped values 26,102 times over the whole stress run. Turning it back on restores dt 8.1 s at Courant 1.0. `v19-limited.png`, `v19-unlimited.png` |
| v20 | Performance / adaptive resolution | **pass (software GPU)** | SwiftShader, Low→Ultra cloud quality: 26–30 fps with adaptive resolution settling at 0.33–0.39× (426×266 to 501×313). Sim step ≈ 12.6 ms; achieved speed 81–96× real time (90× requested). Real-GPU performance is **not measured** (see §6). |
| v21 | Terrain and surface tools | **pass** | A Raise-tool stroke at the centre lifts the ground 210 → 743 m and adds one solid layer, so airflow now sees the obstacle. A Surface-tool stroke with Water raises the water fraction in the box 0 → 31.9 cells. Orographic rain shadow: §3. `v21-*.png` |

Page errors at the end of the run: none (`logs/final-errors.log`).

## 5. Failures found during development, their causes, fixes and retests

| # | Symptom (how it was observed) | Cause | Fix | Retest |
|---|---|---|---|---|
| F1 | First load showed the red "3D view unavailable" panel. Log: *Precisions of uniform 'uMode' differ between VERTEX and FRAGMENT shaders* (the graceful fallback worked as designed). | Default `mediump int` in the precipitation fragment shader | `precision highp int` | Reloaded: renderer `ANGLE … SwiftShader`, no error panel; v01 pass |
| F2 | Convection spun up very slowly (w = 6 m/s after 7 min) in the headless run | First-order semi-Lagrangian advection in 16 m/s shear gives ~10⁴ m²/s numerical diffusion, which erodes the 3 km bubbles | Limited MacCormack correction for θ and qv | w = 11 m/s at 7 min, 20 m/s at 12 min |
| F3 | With MacCormack on w, updrafts ran away to ±60 m/s and guard hits grew into the thousands | Collocated grid: momentum needs the SL damping of 2Δx modes | Momentum back to plain SL; quadratic entrainment drag on w | 90-minute sweep: guard 0 for 8 of 10 presets, and w stays within 20–40 m/s |
| F4 | "Guard hits" appeared after 55 min | Explicit diffusion of the vapour perturbation produced −0.00 g/kg in the dry stratosphere | Positivity clamp in diffusion; the guard now counts only genuine anomalies | guard 0 |
| F5 | Sea breeze, cumulus and heat island showed nothing within 60 min | Realistic surface exchange is too slow for a time-lapse | Bulk exchange ≈2.5× real; well-mixed boundary layer option; pre-seeded thermals | Cumulus now forms in 3–7 min; heat-island storm at ~60 min |
| F6 | The TC preset made widespread convection with no vortex (91% cloud, 5 m/s tangential wind) | Uniform warm ocean; the initial vortex was not in balance | Warm-pool SST field; near-barotropic vortex; moist core | Coherent vortex (§3) |
| F7 | Lake-effect preset produced a domain-wide stratus deck and almost no snow | Sounding too moist relative to ice saturation | Drier sounding, stronger lake fluxes | Upwind 3% cloud; snow maximum at the downwind shore |
| F8 | White speckles over the clouds, noise in the top-down TC view | Snow and rain particles were drawn after the cloud composite, including inside or behind clouds | Particles fade with local qc and a 4-sample cloud-occlusion estimate toward the camera; snow limited to the low troposphere | Visually clean (v18 screenshots) |
| F9 | Manual lightning "did nothing" in screenshots | Automatic flashes (≈5 per wall-second) filled all 4 bolt slots, so the manual bolt was never added. Additive white light was also invisible on white cloud. | Manual flashes always get a slot and linger ~1.2 s; auto flash rate reduced; premultiplied violet-glow bolt | `screenshots/v08-manual-flash.png` shows the channel |
| F10 | Diverging slice modes were covered in noisy contour lines | An emphasised zero contour was drawn wherever values hovered near 0 | Zero-line removed; contours only for \|v\| ≥ half an interval; slices blended after tone mapping; zero-valued rain/cloud slices transparent | v06 screenshots |
| F11 | p′ map showed row striping | The collocated grid's 2Δx pressure mode | The **display** uses a 1-2-1 filtered p′ (labelled as such); the dynamics are unchanged | v06 pressure screenshot |
| F12 | The tool radios could not be clicked by automation | The radio `<input>` had `pointer-events:none` behind the styled tile | The real input now covers the tile, invisibly | `find label "Heat tool" click` → tool = heat |
| F13 (suite) | v01 landed on about:blank; v02 read another session's page on a busy port; CSV downloads were empty; wheel had no effect | Close→reopen relaunch; ports 8765/8766 owned by other processes on this machine; buttons inside collapsed or scrolled panels; `mouse wheel` not dispatched | Fresh session name per check; free port chosen at run time plus a title check; scroll-into-view before download; CDP wheel | Final run |

## 6. Honest limitations, blocked and not-run items

- **Real-GPU performance: not run.** Only a CPU software rasteriser (SwiftShader) was available, so FPS and the adaptive render scale reflect that. The simulation runs on the CPU: 16–23 ms per step at the default 48×48×16 grid, 46 ms at 64×64×20, 113 ms at 96×96×24. On the heavy grids, the frame budget (≤ 42 ms of simulation per frame) caps the achieved speed below the requested speed, and the HUD shows the achieved value.
- **Thunder audio: blocked for listening.** It is synthesised with Web Audio after a user gesture and verified only through the AudioContext state and the computed delay. Nothing was heard. The delay uses sound speed ×10 (time compression, stated in the UI).
- **Model simplifications, stated honestly in the UI and here:**
  - The dynamics are a Boussinesq, incompressible core on a collocated grid. Its 2Δx pressure mode is filtered for display only.
  - Terrain is represented as step obstacles plus an orographic forcing term.
  - Microphysics is Kessler-type with a diagnosed rain/snow phase.
  - There is no radiation scheme beyond surface heating/cooling and slow mean-state nudging.
  - Surface exchange is ≈2.5× real, and the flash rate is reduced so the time-lapse stays readable.
  - Manual flashes linger ~1.2 s so they can be inspected.
- **The tropical cyclone is an approximation.** It holds a coherent 7–11 m/s rotating system with a cloudy core for 3 h+, but does not intensify into a mature hurricane.
- **Some heating-driven presets develop slowly.** Sea-breeze cumulus and the heat-island storm need ~60 simulated minutes, i.e. ~15–25 s of wall time at their preset speeds. Fair-weather cumulus now forms within 3–7 minutes.
- **The stress test is meant to hit the guards.** Its extreme settings trip the range guards thousands of times over an hour, even with auto-limit on (mostly w > 60 m/s). The count is displayed, not hidden.
- **The v04 single-stroke intervention yielded only light rain** (0.1 mm/h) at the probe cell within 25 minutes. The cloud and updraft response is clear. Heavier rain appeared in exploratory runs with a larger dose.
- **agent-browser quirks worked around in the suite** (§1): wheel via CDP, radios via label, downloads need scroll-into-view.
- **Concurrent sessions on this machine.** While debugging the harness, before I switched to an isolated agent-browser namespace, I ran one `agent-browser close --all` and one broad `pkill -f run-validation.sh`. On a machine where other agent sessions are active, either could have affected another session's browser or an identically named script. I saw no evidence that they did, and the other sessions' HTTP servers I found were still running afterwards.
