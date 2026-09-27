# Validation — 3D Hydraulic Erosion Laboratory

Artifact: `/home/pyro/projects/naked/swe2/02-hydraulic-erosion/index.html` (single self-contained file, ~1100 lines, no external assets, libraries, imports, or network requests).

Tool: `agent-browser 0.31.1` (Chromium via CDP, SwiftShader software GL — `ANGLE/Vulkan SwiftShader`; FPS numbers below are software-rendering bound, not hardware-GPU representative).

All checks ran against `file:///home/pyro/projects/naked/swe2/02-hydraulic-erosion/index.html` — **direct file:// loading works** (verified repeatedly; every session opened via `agent-browser open file:///...`). `performance.getEntriesByType('resource')` returned `[]` — zero network requests.

Diagnostics: the app exposes `window.__lab` (fields `b,d,s_,eD,vx,vz,F,wet,N,steps,simTime,recoveries,hMin,hMax`, fns `step(n),reset(),regen(),exportPNG/JSON,applyPreset`). All field statistics below were measured on live arrays.

## Checks

| # | Check | Result | Evidence / notes |
|---|-------|--------|------------------|
| 1 | Loads from `file://`, no console errors | **pass** | `console` and `errors` empty across ~20 reloads. `01-initial.png` … `21-fresh.png` |
| 2 | Sim evolves autonomously | **pass** | `steps`/`simTime` advance; `Σ|eD|` grows; terrain heightfield changes (not just shading): `Σb` signature changes, eD non-zero at hundreds of cells |
| 3 | Water flows downhill, pools, carves channels | **pass** | Water-depth mode shows dendritic drainage (`10-mode-water.png`); shaded view shows carved gullies + alluvial aprons (`20-tuned.png`); island preset forms a pooled moat ring (`13-preset-island.png`) |
| 4 | Sediment transport + deposition | **pass** | `s_` advected semi-Lagrangian; deposition deltas land at channel mouths/aprons (`11-mode-erode.png` red=erode, blue=deposit); sediment exports off open boundaries |
| 5 | Orbit / pan / zoom | **pass** | right-drag: yaw 0.70→1.98, pitch 0.95→0.39; wheel: dist 3→4.85; middle-drag pan: tx −0.128, tz +0.151 |
| 6 | Brush tools via real pointer input | **pass** | Raise: `Σb` +1.96 along drag path (paused, isolated); +Water: `Σd` +2.95; Dry: `Σd` −5.03 along stroke; Inspect: pinned probe `cell(0,16) elev −1.5 water 0.032 …`; brush interpolates along segments (`paintSeg`) |
| 7 | Brush vs camera no conflict | **pass** | left-drag paints with tool active, orbits only in Orbit tool; right-drag always orbits |
| 8 | Pause / resume | **pass** | `#btnPause` → `steps` frozen at 1412 across 0.5 s; Space key also toggles |
| 9 | Single-step | **pass** | `#btnStep` advanced exactly `substeps` steps (1412→1414 with substeps=2); N key also steps |
| 10 | Reset | **pass** | `#btnReset` → water 0, sediment 0, steps 0, time 0, terrain restored to generated state |
| 11 | Regenerate + deterministic seed | **pass** | two regenerations at seed 1337 produced identical `Σ(b·1000.7)` = 2095537.81 |
| 12 | Presets | **pass** | mountain / canyon / island / valley / stress all apply + regenerate (`13`, `14`, `15` pngs); each sets distinct params |
| 13 | All 7 view modes | **pass** | Shaded, Elevation, Water depth, Sediment, Erosion/Deposition, Slope, Flow — all render distinct meaningful data; switching does not reset sim (`steps` keeps advancing, fields unchanged) |
| 14 | Probe / hover readout | **pass** | hover shows cell, elev, water, sediment, slope, flow speed, Δ erosion; Inspect tool pins it; readout refreshes on a timer |
| 15 | PNG export | **pass** | `agent-browser download #btnPNG` → valid 128×128 grayscale PNG (`file` verified, 15 KB) |
| 16 | JSON export / import | **pass** | export → 262 KB JSON `{v,N,seed,time,params,h,w,s,e}`; re-import restored `simTime=13.408` and exact field values (`b[1000]=0.2656…`, `d[…]` all match decoded base64) |
| 17 | Import error states | **pass** | malformed JSON → `errbar: "import failed: …is not valid JSON"`; wrong-shape JSON → `"import failed: bad format"`; no crash |
| 18 | Parameter changes while running | **pass** | sliders respond to keyboard (erode 1.2→1.35 via ArrowUp ×3, step 0.05) and pointer; changing rain/evap/erode mid-run produces visibly different regimes (maxed-aggression run → deep badlands, `18-hostile.png`) |
| 19 | Resolution rebuild | **pass** | `#inRes` 128→64 rebuilt sim (`N=64`, steps reset) without errors; 192² stress preset ran 800 steps @ ~3 ms/step |
| 20 | Numerical stability / graceful recovery | **pass** | maxed params (erode=3, deposit=3, flow=3, rain=0.1, evap=0, speed=4) → 2000+ steps, **0 NaN, 0 recoveries**, terrain bounded [−1.02, 0.77]; auto-substepping caps dt ≤ 0.012; NaN sanitizer + recovery counter present (never triggered in tests) |
| 21 | Resize + narrow viewport | **pass** | `set viewport 390 844` → tools wrap, panel becomes bottom sheet w/ ☰ toggle (toggled `.min` verified), HUD readable (`16-narrow.png`); DPR-capped canvas resize handled |
| 22 | Persistence | **pass** | settings serialize to `localStorage['erosion-lab']` on change and restore on reload (stored JSON inspected: all params round-trip) |
| 23 | Status overlay | **pass** | live HUD: fps, sim ms, grid, step, sim time, water volume, sediment, mode, pause state, recovery count |
| 24 | Touch / pinch | **partial** | implemented via Pointer Events (pinch zoom + two-finger pan in `pointermove` handler); agent-browser has no multi-touch injection — code path shared with mouse drag which was verified, but real touch not directly exercised |
| 25 | Shadows / wireframe / contours / fog | **pass** | all toggle via checkboxes; `22-wireframe.png` shows slope-hued grid; self-shadowing via heightfield ray-march in shader |

## Bugs found and fixed during validation

1. **Boot order** — `buildMesh()` ran before `generate()` → `N=0`, buffers sized −4, `TypeError` on first frame. Fixed by reordering boot.
2. **Terrain shader never compiled** — `fwidth()` requires `GL_OES_standard_derivatives` under ESSL 1.00 → terrain program dead, scene invisible (diagnosed via `ACTIVE_ATTRIBUTES=0` + `gl.getError()=1282`). Replaced with fixed-width contours; added persistent `GL ERROR` line to HUD so shader failures can't go silent again.
3. **Uniform water sheet** — rain ≫ evap equilibrium flooded the map. Retuned defaults + depth-gated water alpha.
4. **Needle-spike instability** — undamped flux + uncapped velocity + no repose limit → runaway pits/spires. Added flux damping (0.995), velocity clamp, anti-spike repose clamp.
5. **Mass-creating pit clamp** — `b[i]+=df` with insufficient `s_` inflated the entire map (+1.7 uniform lift, bMax 1149). Removed pit-fill clamp; pits are legal (they become pools).
6. **Sediment exported nowhere** — water drained off boundary but sediment stayed → border berms. Boundary outflow now carries proportional `s_`.
7. **Dry-cell sediment trap** — drying cells dumped all `s_` locally; convergence zones (summit crater) ratcheted into a 0.4-unit dome/spire. Now: dry cells hand load to the *lowest wet* neighbor; fallback deposit capped at local neighbor-average (+0.15·cell). Summit bMax stable at 0.79 across 1000 steps after fix.
8. **Checkerboard shard-walls at dt=0.05** — maxed speed with substeps=1. Fixed by auto-raising substeps (dt≤0.012) and per-step incision floor (cell can't be dug below repose-depth of lowest neighbor in one step).
9. **Thin-film deposition dust** — `s_` settling on ~0.02-depth film tinted/raised everything; deposit rate now scaled by `min(1, d·10)` and erosion requires `d>0.003`.

## Known limitations

- **FPS ~20–25 @128²** under SwiftShader (software rasterizer). `sim 2–3 ms/step` CPU-bound loop is fine; a real GPU should be far faster. Shadows toggle exists for weak hardware.
- Deposition slightly outweighs erosion spatially (~15k cells net-positive vs ~500 net-negative) — eroded mass concentrates in aprons; visually plausible but the Erosion/Deposition mode reads mostly blue.
- The summit dome fills its crater with sediment (a silting crater lake) — physical, but it makes the massif slightly dome-like over very long runs.
- Real multi-touch gestures untested (no tool support); pointer path shared with verified mouse input.
- Audio: not applicable (no audio feature).
