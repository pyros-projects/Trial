# Validation — VECTOR//ONE FPV Drone Racing Sim

Artifact: `index.html` (single self-contained file, WebGL2, zero external deps).
Tooling: `agent-browser` 0.31.1 (headless Chromium via CDP) + in-page telemetry via `window.SIM` debug handle. Two sessions: default (http://localhost:8931) for flight, `--session b` for settings/cameras/file://.
Input method for flight: real `KeyboardEvent`s dispatched to `window` by an in-page control bot (bang-bang PD toward each active gate). No internal state was written to steer the drone; `SIM` used read-only.

## Results

| Check | Result | Evidence |
|---|---|---|
| Page loads, no console errors | pass | `boot.png`, `boot2.png`; `agent-browser errors` → null |
| Independent throttle | pass | ArrowUp 900ms: dy +4.65, dv.y +4.99 only |
| Independent yaw | pass | ArrowLeft 900ms: fwd (-0.66,0,-0.75)→(-0.96,0,0.26) |
| Independent pitch | pass | KeyW 900ms: fwd.y 0→-0.61 (nose down), fwd accel |
| Independent roll | pass | KeyA 900ms: dv aligned with body-left |
| Ordered checkpoints | pass | Bot passed gates 0→9 sequentially, `R.next` tracked |
| Lap + sector timing | pass | lapTimes=[366.9s] (laps=2 run), sectorTimes=[34.8,45.2], HUD "SEC" |
| Missed-gate feedback + penalty | pass | `missed` incremented, +3s each; finish lap 133.2 = 106.2 flight + 27 pen |
| Race finish + best lap | pass | `finished:true`, `best=133.2` written to localStorage `v1.best:*` |
| Persistence across reload | pass | after reload: `best=133.2`, ghost (25488 floats/3186 samples) loaded |
| Deterministic seed | pass | gate positions bit-identical across reload; seed 99 → different layout |
| Ghost/replay | pass | 30 Hz transform recording; ghost renders when race active (sample idx tracks tRace); export `v1-replay` 25488 floats; import replay → `G.best` set |
| Crash + recover | pass | forgive=0 + g=20 dive → `crashed:true`; R → respawn at start, `crashed:false`; dust/spark burst visible in `crashed.png`/`cam-chase.png` |
| Anti-crash assist | pass | with antiCrash on, terminal dive from 120 m soft-landed (contact, no crash) |
| Altitude hold | pass | bot used climb-rate semantics successfully |
| Modes differ | pass | angle: sustained W caps tilt (rate→0); horizon: blends to rate at full stick (1400°/s — retuned to match acro rate); acro: 700°/s continuous flip |
| Cameras | pass | FPV/Chase/Orbit/Trackside cycled via button+key; `cam-chase.png`, `cam-orbit.png`, `cam-track.png` show distinct working views; physics state unchanged by switching |
| Presets | pass | canyon, neon (building keep-out fixed), industrial, forest all render coherent distinct worlds; `neon2.png`, `forest.png`, `industrial.png` |
| Settings panel | pass | all controls enumerated in a11y snapshot; gravity/TWR/drag/rates/expo/level/altHold/antiCrash/forgive/FOV/tilt/quality/resScale/shadows/particles/volume/ghost/telemetry/diag wired |
| Quality presets | pass | ultra → resScale 1.5/shadow high/particles 2; low → 0.6/off/0.5; FBO resized live |
| Diagnostics overlay | pass | live dt×substeps, frame ms, pos/vel/acc, body rates °/s, inputs, motor, batt, state; 3D debug lines (body axes, vel vector, collision sphere, gate volumes) visible in `narrow.png` |
| Telemetry graph | pass | T toggles; 4 traces (alt/speed/thr/pitch-rate) render on canvas strip |
| Resize | pass | 1280×800 → 390×844: aspect coherent, HUD scaled, sim unaffected (`narrow.png`) |
| Free flight | pass | mode switch works; no timer, gates still tracked |
| Pause | pass | P freezes physics (pos identical 1.5 s), resumes on second press |
| Export course | pass | blob `{"type":"v1-course","seed":7,"preset":"neon","difficulty":"normal","laps":2}` |
| Export replay | pass | `v1-replay`, 25488 samples (8-aligned) |
| Import | pass | valid course JSON applied (forest/42/hard, 12 gates); `{"garbage":true}` → "Invalid file" toast; non-JSON → "Import failed" toast; app state intact |
| PNG screenshot | pass | `btnShot` → `canvas.toBlob` → 42 KB blob, PNG magic `89504e47` |
| Gamepad fallback | pass | panel shows "No gamepad detected — connect a controller and press any button."; deadzone/invert/calibrate controls present |
| Audio | pass (state) | AudioContext + motor oscs + noise created on first key gesture; state `suspended` in headless (autoplay policy); gain tracks master volume; freq driven by `D.motor` — not audible-verified |
| file:// direct open | pass | `file:///.../index.html` runs fully (gates built, frames advance) — confirmed separately from HTTP |
| No external fetches | pass | zero network requests in file; only same-origin HTTP during dev-server test |

## Fixes found during validation

1. `Mesh` instance stride (80→84 B) so per-instance emit attribute fits.
2. Sun direction sign in shaders (preset stores direction *to* sun).
3. Pitch sign inverted in level-mode desired attitude (W tilted nose-up).
4. Battery never restored on respawn and drain could hard-strand the drone → batt resets on spawn, limp-power floor added.
5. Lap-completion off-by-one: `R.next >= total` blocked the finish-ring crossing; `>` fixes it.
6. Horizon extreme rate was 2× acro; unified to `rates`.
7. Obstacle keep-out now covers spawn point and gate surroundings (neon spawn was walled in).

## Known limitations / honest gaps

- **Ghost visual**: verified via data path + render branch, but no screenshot clearly shows the translucent ghost drone (it was ~160 m ahead in `ghost.png`). Confident it draws; visual proof weak.
- **WebGL-unavailable fallback**: cannot force `webgl2` context failure in this environment; the code path (`if(!gl)` → fallback overlay + throw) is inspected only — **blocked**.
- **Performance**: 20–28 fps under headless SwiftShader (software GL, ~0.7–1.4 ms CPU frame). Real GPU performance not measurable here.
- **Touch sticks**: implemented (pointer events on two virtual sticks), untested — no touch environment — **not-run**.
- **Gamepad**: no physical/virtual pad available; fallback messaging verified, axis path untested — **partial**.
- **Audio audibility**: graph verified (nodes, params driven by live motor), but nothing was actually heard — headless. **state-verified only**.
