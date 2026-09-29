# Storm Lab 3D — Validation Report

Artifact: `index.html` (single self-contained file, 1811 lines / ~90 KB, zero external
dependencies — verified: only one network request fired, the document itself).
Test tool: `agent-browser` 0.31.1 (Chromium via CDP), plus `window.SL` debug API exposed
by the app for field-level assertions (`SL.stats()`, `SL.F()`, `SL.step(n)`,
`SL.preset(k)`, `SL.brush(tool,i,j)`, `SL.probe(i,j)`, `SL.probeSample`, `pickGround`,
`buildDiag`).

Dev tooling kept in repo (not runtime deps): `head.html`, `part_sim.js`,
`part_render.js`, `part_ui.js`, `assemble.sh` — source chunks that concatenate into
`index.html`. Server used for testing only: `python3 -m http.server 8931`.

## Environment
- Headless Chromium (SwiftShader GL) at 1280×800 and 390×844.
- `file://` direct-open verified working (screenshots taken via both HTTP and file).

## Checks

| # | Check | Method | Result |
|---|-------|--------|--------|
| 1 | Fields evolve (not texture anim) | `SL.step` + per-cell checksums of u/v/w/tp/qv/qc/qr/p across presets | **PASS** — all fields mutate continuously; tp/qv profiles shift plausibly (see also #14) |
| 2 | Inject heat + moisture → delayed coherent response | real pointer drag with `heat` tool over terrain → `tp` +4.6 at picked cell; repeated moist+heat brush → column qc 0 → 1.85 → decay over ~30 steps | **PASS** (screenshot free; numbers via API, input via real `mouse down/move/up`) |
| 3 | Alter wind → response | `wind` brush drag → `u` +30 at cell (clamped ±30) | **PASS** |
| 4 | ≥4 diagnostic modes | viz select (`temp, humidity, cloud, precip, pressure, wind, vertical, vort, terrain, wetness, cinematic` — all 11 produce real field ranges) | **PASS** — `viz-wind.png`, `slice-humidity.png` |
| 5 | Vertical / point probe | Probe tool + real canvas click → probe placed, panel opened, live sample {T, RH, p, wind, w↑, qc, rain}; history sparkline draws | **PASS** |
| 6 | Lightning | auto from charge proxy (supercell chg → 1225 → 115 auto-strikes), manual `SL.strike` + Bolt tool | **PASS** — `bolt.png`, `supercell-bolts.png` show branching bolts under storm cells; thunder queued with distance delay (WebAudio; AC correctly `suspended` w/o real gesture) |
| 7 | Orbit / pan / zoom / fly | mouse drag = orbit (verified visually), wheel = zoom, fly preset + WASD | **PASS** — `orbit.png`, `flycam.png`; 6 camera presets present |
| 8 | Pause / single-step | Pause button + Space: sim time frozen; Step advances exactly `substeps×dt` (878.4 → 880.0) | **PASS** |
| 9 | Quality/resolution change while running | Resolution X select 64→48 live → grid rebuilt, sim restarted; render-scale/adaptive sliders | **PASS** — adaptive scale auto-adjusts (HUD `scale` line) |
| 10 | Same seed → same state | preset fair twice, 40 steps, field checksum identical (10109203.634…) | **PASS** |
| 11 | Narrow viewport 390×844 | `set viewport 390 844` → usable: scrolling panel, HUD, probe sparkline, warnings all reachable | **PASS** — `narrow.png` |
| 12 | Offline / no external fetch | `network requests` shows only the document | **PASS** |
| 13 | Save / load state | Save → 2.1 MB JSON (fields+terrain+params+probes). Load restores t & fields; corrupt file → "Load failed: not JSON" toast, app survives | **PASS** — `dl/saved.json` |
| 14 | Preset battery | every preset stepped 40–300× post-tuning: fair(0.02 cloud, scattered), sea-breeze(coastal band), mtn-rain(0.39 cloud, sustained orographic drizzle to t=620+), squall(drifting band via forceBand), supercell(chg→1225, 115 bolts), cyclone(0.39 cloud ring), cold-front, heat-island(w 2.4), snow-band(50k precip), stress(w clamped 9.0, no NaN) | **PASS** |
| 15 | Surface paint + terrain tools | `surf`+ocean drag → 112 ocean cells → lake; `raise` → +3 units height; wet-ground darkening after rain | **PASS** |
| 16 | Map + cross-section | 2D map canvas (field + arrows + probes + slice line) always visible; 3D vertical slice plane w/ axis+position | **PASS** — `slice-humidity.png` |
| 17 | Vector arrows / streamlines | arrows overlay for wind/vort viz + toggle; wind streak particles | **PASS** — `viz-wind.png` |
| 18 | HUD overlay | fps, dims, sim time, dt, cloud %, precip, max updraft, wind, CFL, preset, viz, probes, charge, pause | **PASS** — `hud-check.png` |
| 19 | WebGL2 fallback / shader failure | `fatal()` overlay path exists (verified firing during dev — samplers3D precision bug, now fixed) | **PASS** (path exercised) |
| 20 | Invalid state rejection | malformed JSON + truncated data rejected with toast, no crash | **PASS** |
| 21 | Console errors | error hook injected, exercised presets/viz/tools/camera: `errCount: 0` | **PASS** |
| 22 | Settings persistence | exposure/lapse in localStorage across reload (render params restore; sim params are preset-owned) | **PASS** |
| 23 | PNG + CSV export | `📄 Probe CSV` → real probe time series; `🖼 PNG` → 1152×519 PNG | **PASS** — `dl/probes.csv`, `dl/view.png` |

## Physics notes (what the model actually does)
- Semi-Lagrangian advection for u,v,w,tp,qv,qc,qr,p on a 64³-lite grid (up to 128×128×24).
- Backtrace clamped to terrain (fixed a mass/heat bleed at boundaries).
- Buoyancy from tp+qv−condensate loading; pressure ≈ column-integrated buoyancy
  (hydrostatic proxy) driving horizontal inflow; Coriolis; terrain orographic lift + drag.
- Microphysics: evaporation→baseRH target, saturation condensation (hysteresis:
  evaporate only below RH~0.8), autoconversion to rain, fall + bounded virga
  evaporation, latent heat both ways, entrainment drying aloft, per-column heating
  variance (convective organization), per-layer mean-w removal (continuity proxy).
- Lightning: charge proxy = max(0, maxColumnUpdraft−0.6)·column-condensate, decays
  slowly; auto-strike probability scales with charge and lightningProb;
  branching bolt geometry; manual trigger supported.
- Clouds raymarched per-pixel from the live `qc` texture — not an animation.

- Long-run behaviour: mtn-rain now sustains light orographic precipitation
  (precip still accumulating at t=621) via stronger forced ascent (×2.2) and a
  slow ambient moisture flux-convergence feed in the boundary layer.
- Convective episodes still decay — the closed domain equilibrates — but
  interventions/presets restart activity, which is the intended lab workflow.

## Failures found & fixed during development
1. sampler3D missing precision + vec2 hash call → shader compile fail → fixed.
2. Semi-Lagrangian sampling below terrain → qv/tp bleed → backtrace clamped.
3. Uniform overcast slab → qsat vertical gradient flattened (−21%/layer → −10%),
   evaporation retargeted to `baseRH`, entrainment drying aloft, heating variance,
   per-layer mean-w removal, cloud evap hysteresis.
4. Global cold-pool collapse (−40 clamp) → bounded rain/cloud evaporation cooling.
5. Probe panel overlapping File buttons → moved to bottom-right.
6. HUD occluded by open panel → shifts right/below.
7. Squall line dying instantly → sustained `forceBand` moist inflow (drifts downwind).
8. Cyclone vortex killed by near-ground drag → reduced.
9. Fly camera could leave domain → clamped.

## Remaining limitations (honest list)
- Cyclone/supercell vortices partially decay (semi-Lagrangian damping + weak
  pressure-driven inflow); they visibly rotate, rain, and fire lightning, but
  are not self-sustaining like real systems.
- Squall line completes a form→rain→dissipate lifecycle over ~3–4 sim-minutes
  rather than persisting indefinitely.
- Headless SwiftShader reached ~20 fps with adaptive scale; dedicated GPUs should be
  much faster. Adaptive quality is on by default.
- Rain renders as streak lines (not camera-faced drops); snow uses same system
  slower/whiter.
- Thunder synthesis is code-complete but was not *heard* (headless); only the audio
  pipeline state was inspected (`suspended` until user gesture — correct).
- Semi-Lagrangian advection is intentionally diffusive — fine for stylized
  phenomenology, not a high-order solver.

## Screenshot inventory
`boot.png` first render · `fair4.png` broken cumulus field · `supercell2.png`
supercell+streaks · `bolt.png` lightning bolt · `viz-wind.png` wind vectors+map ·
`slice-humidity.png` diag plane + vertical slice + tinted terrain ·
`sea-breeze.png` coast/cloud band · `mtn-rain.png` orographic bank · `squall3.png`
moving line · `supercell-bolts.png` dense auto-lightning under cells ·
`mtn-rain-final.png` sustained orographic regime · `night.png` time-of-day
lighting · `narrow.png` 390×844 · `hud-check.png` overlay · `clean-view.png`
panel closed · `orbit.png` `flycam.png` camera · `dl/` exports.
