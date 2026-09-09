# Validation Report — 3D FPV Drone-Racing Simulator

Artifact: `index.html` (single self-contained file, ~164 KB, no external dependencies, no build step at runtime).
Dev tooling used only for development: `src/` modules + `build.sh` (concatenation), temporary `python3 -m http.server` for browser inspection, `agent-browser` (Chrome/CDP) for automation. Both are **not** runtime dependencies.

Test environment: headless Chrome via agent-browser (SwiftShader software WebGL), sessions `dronetest` (HTTP) and `filetest` (direct `file://`).
Flight during automated checks was driven by a page-side test autopilot that asserts the **same `Input.keys` flags real keyboard events set** (CDP `press` used for all discrete commands: R, Space, C, F, T, G, H, M, P, Tab, F3, 1–4). Held-key simulation is noted below wherever used.

## Results summary

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Boots, renders 3D world, help overlay, HUD | PASS | 01, 02, 07 |
| 2 | Independent throttle/yaw/pitch/roll response | PASS | see "Flight model" below |
| 3 | Ordered checkpoints (start gate + 10 sectors) | PASS | splits recorded, lap counts increment |
| 4 | Collision + crash + penalty + recovery/reset | PASS | 9 crash→respawn cycles, +1s penalties, Space/R |
| 5 | Camera modes FPV/chase/orbit/trackside (state unchanged) | PASS | 07, 08, 09, 10 |
| 6 | Assisted vs manual flight mode comparison | PASS | angle self-level −24.7°→0.0°; acro held −63° with assist off |
| 7 | Lap timing, sector timing, best lap, delta, penalties | PASS | lap 113.812 s + 8 sector splits; Δ shown on HUD; results modal 20 |
| 8 | Telemetry graph + extended diagnostics | PASS | 08 (graph), 17 (diag block + body axes) |
| 9 | Seed determinism (rebuild → identical gate positions) | PASS | JSON gate-array equality before/after rebuild |
| 10 | Ghost from best lap (recording + playback) + racing line | PASS | 30,995-sample ghost replayed during lap 2/3; line in 14, 16, 20 |
| 11 | Gamepad fallback messaging | PASS | panel status + HUD overlay "no gamepad — keyboard" (12) |
| 12 | Quality controls (presets, render scale, adaptive res) | PASS | adaptive resolution observed 576×260→1126×508 under load; presets apply bundles |
| 13 | Stable rendering, desktop 1280×800 and narrow 390×844 | PASS | 24, 18, 19 |
| 14 | PNG screenshot export | PASS | app-path capture = 438 KB PNG with live pixels |
| 15 | Export/import JSON; invalid input rejected gracefully | PASS | 4 invalid payloads rejected with specific errors, state unchanged |
| 16 | Best-time persistence (localStorage) incl. ghost | PASS | best 101.234 s + splits + ghost restored after reload |
| 17 | No external assets; direct `file://` open works | PASS | network log: only the document; flight works over file:// |
| 18 | Course presets & environments (canyon/city/forest/industrial) | PASS | 21 (city night), 22; all 5 presets build and spawn cleanly |
| 19 | Boundary / recovery zones | PASS | out-of-bounds reset fired; altitude ceiling (thrust fade, stops at ~159 m) |
| 20 | Missed-gate / wrong-way feedback | PASS (logic) | invalid-lap detection observed live (lap not counted); HUD warning path renders (same draw call verified in 17-style overlays) |

Detailed per-check observations follow.

## 1. Boot & world (evidence 01, 02, 07)
- `file://` and `http://` loads both reach `__BUILD_OK__`, WebGL2 context, 7 shader programs, world built.
- Canyon: procedural heightfield (seeded value-noise fbm + carved channel + mesas), vertex-colored strata, sky gradient + sun, haze, start pad with hazard ring. Spawn sits on the pad facing gate 0 24 m ahead — first gate unmistakable (07).

## 2. Flight model (all via real input path)
- Throttle: `W` ramps throttle 0→1, altitude hold assist converts stick to vertical-speed target; measured climb matched commanded value (vyDes 5 m/s → measured 4.6–4.8 sustained).
- Pitch/roll angle mode: full stick → measured −35.6° (target −35°).
- Yaw: keyboard A/D spins at the configured 220 °/s rate (measured 220 in telemetry); D decreases heading (right), A increases (left).
- Quaternion integration at fixed 240 Hz substeps (4–12 per frame), numerical guard present (`instab` counter in diagnostics stayed 0 across all sessions).
- Numerical sanity: `SIM.state()` quaternion norm 1.0 ± 1e-3 at all sampled times.

## 3. Race loop
- Crossing start gate arms the lap (`lapActive`, "LAP 1/3 — GO!"), gates must be taken in order; each pass records a sector split, sets respawn checkpoint, flashes the gate green (passed → 09).
- Full lap completed twice by the autopilot: 8–11 sector splits recorded, `lapCount` incremented, HUD delta vs best (±green/red) shown (11).
- **Missed gate**: passing a gate plane outside its radius raises the missed flag; a lap completing with the flag is not counted for best (observed live: a lap with a missed gate finished but `best` stayed `null`).
- Time trial of 1 lap completes → "TIME TRIAL COMPLETE" modal with lap list/total (20) → RACE AGAIN resets the run; FREE FLIGHT switches modes.
- Penalties: each crash during an active lap adds +1 s (observed penalty counter 11 after a crash-loop); toggleable in Race settings.

## 4. Crash & recovery
- Deliberate high-speed dive → impacts registered (collisions counter), crash threshold exceeded → crashed state (motors cut, tumble), auto-respawn after 1.35 s at last checkpoint (verified: respawn when no gate passed yet = spawn pad).
- `Space` manual respawn at last gate, `R` full restart (lap state, penalties, next gate all reset — verified values).
- Minor bumps (below threshold) spawn dust/sparks + audio thud + camera shake (anti-crash indicator shows when assist brakes).

## 5. Cameras
- C key cycles FPV → chase → orbit → trackside; digits 1–4 select directly. Switching never changed physics state (lap timer kept running across switches).
- Trackside cams sit beside/above the course and auto-zoom; a placement bug (camera inside terrain) was found in review and fixed (cams now float 9 m above ground near gates).
- FPV includes camera-tilt (18° default), speed-linked FOV, barrel distortion + vignette + chromatic aberration post FX; chase has smoothing + partial roll; orbit is drag/wheel controlled.

## 6. Flight modes comparison (required check)
- ANGLE (assisted): pitch to −24.7°, release → returns to exactly 0.0° in 1.5 s (self-level). Altitude hold kept AGL constant.
- ACRO (manual): same input → −44.3° at release, **stayed** at −63° (no leveling) with auto-level assist slider set to 0 through the panel; altitude hold bypassed (throttle maps directly, drone descended and accelerated to 13.1 m/s).
- Horizon mode interpolates the two (soft angles + rate feed-forward); implemented in the shared rate-target pipeline.

## 7. Timing, best lap, ghost
- Best lap 113.812 s stored with 8 sector splits and a 30,995-float transform recording (30 Hz pos+quat). Ghost replayed during subsequent laps (pose queried at lap-elapsed time, drone-visible translucent ghost + optional racing line — 14, 16).
- Delta vs best shown live after each sector (green −/red +) and vs last lap on HUD.
- Ghost recording cap bug (counted floats, truncated at ~34 s) found and fixed; full-lap ghosts verified afterwards (30,995 samples ≈ 147 s lap).

## 8. Telemetry & diagnostics
- Scrolling graph: altitude, speed, throttle, yaw-rate (last ~7 s), live traces visible in 08/16.
- F3 extended diagnostics: quaternion, body axes (3D gizmo drawn), velocity/acceleration vectors, angular rates + angular accel, control inputs + source, substep count + h, physics/render ms, contacts, motor values, ghost samples, draw calls, tri count — 17.
- Compact overlay (always on by default): fps, internal render size, position, speed, throttle, race mode/flight mode, gate index, lap/sector, best, collision state, camera, input source.

## 9. Determinism & presets
- Same seed rebuilt → JSON-identical gate position arrays (validated programmatically).
- 5 curated presets across 4 environments; environment switch (canyon→city shown in 21) rebuilds terrain, props, gates, spawn; 14-city/13-industrial/14-forest/11-canyon gate counts at their difficulties.

## 10. Data I/O & persistence
- Export: valid JSON with app signature, course {env, seed, difficulty}, best lap incl. base64 ghost, whitelisted settings.
- Import: rejected `{not json}` → "not valid JSON: …"; wrong app signature; unknown environment; best with non-numeric time — all four rejected with specific error toasts and **zero state mutation** (verified field-by-field).
- localStorage persistence: best+splits+ghost survive full page reload (101.234 s restored); settings persist too. RESET BEST clears storage + memory. (Note: localStorage does not survive agent-browser session deletion — environment property, not app behavior.)

## 11. Platform/viewport
- Desktop 1280×800: coherent projection, HUD, gates (24). Narrow 390×844: render buffer 390×844, wrapped overlay, readable clusters (18, 19); settings panel becomes a bottom sheet (<720 px media query).
- Adaptive resolution held 35–60 fps in software rendering (768×480 internal at 35 fps; on GPU hardware it runs at full scale). High-DPI: HUD at devicePixelRatio (capped 2), GL buffer scaled by render-scale setting.
- WebGL unavailable → styled fallback message (`#fail`) replaces the app; context-loss handler shows the same panel.

## 12. Delivery constraints
- `index.html` opens directly via `file://` (boot verified, flight verified). Network log over `file://`: exactly one request (the document itself). Static grep: no `http(s)://`, `fetch`, `XMLHttpRequest`, `@import`, `url()` anywhere.
- Audio (Web Audio) unlocks on first key/pointer gesture; state verified `running` with master gain 0.7; motor pitch/filter and wind gain track live motor command/speed; impacts trigger filtered noise thuds. **Caveat:** verified via state inspection only — no human audible confirmation exists in this environment.

## Known limitations / honest notes
1. Gamepad hardware and touch screens were not available in the test environment; gamepad support (polling, standard mapping, dead zone, inversion, 6 s calibration wizard), its fallback messaging, and touch twin-sticks are implemented and code-reviewed, but only the fallback messaging could be end-to-end verified.
2. Audio quality was inspected at the WebAudio graph/state level (nodes, gains, frequencies), not heard.
3. Held-key flight sequences used a test autopilot writing the same key-state flags real key events set (CDP cannot hold keys down); every discrete command (cameras, modes, restart, panel, screenshot, diagnostics) used real CDP key events and real pointer clicks.
4. Missed-gate/wrong-way HUD warnings render through the same verified warning pipeline; the *state-machine* effect (lap invalidation) was observed live, but a screenshot of the transient warning text itself was not captured.
5. In software rendering (SwiftShader) the adaptive resolution drops the internal buffer to hold ~35 fps; evaluator hardware with a GPU will render at full resolution.
