# Validation — RIFT LINE 3D FPV drone-racing simulator

Artifact: `/home/pyro/projects/naked/grok46/13-drone-racing/index.html`  
Harness: `agent-browser` 0.31.1 (installed skill `agent-browser`, core workflow loaded from CLI)  
Serve: `python3 -m http.server 45197 --bind 127.0.0.1` from the working directory  
Date: 2026-09-08

Checks are **pass / fail / blocked / not-run** against live application behavior. No evaluator-owned score is claimed.

## Environment

- Desktop viewport: `agent-browser --session rift set viewport 1280 800`
- Narrow viewport: `390 844`
- Direct file: `file:///home/pyro/projects/naked/grok46/13-drone-racing/index.html`
- Local HTTP: `http://127.0.0.1:45197/index.html`
- External network: `performance.getEntriesByType('resource')` empty; `rg` found no `http(s)://`, `fetch(`, or imports in `index.html`. Later `set offline on` still ran the sim (fps ~60).
- Audio: click/key gesture hides `#audio-hint` and resumes `AudioContext`. **Sound quality was not heard** (meters/state only).

## Fixes found during validation (then retested)

1. Hover climb — throttle expo was applied around 0.5, so keyboard hover (~0.39) became ~0.43 TWR and the craft climbed. **Fix:** linear throttle command; hover = `1/TWR`. Retest: rest pose `y=7.22` then `6.24` (taller gates), `vel ≈ 0`.
2. Scene too dark / first gate not obvious. **Fix:** brighter palettes, weaker AO/fog, separate emissive gate/path mesh, default camera tilt 10°. Retest: gates and racing line visible in FPV spawn shots.
3. Angle-mode tumble — Euler extraction vs body axes caused positive feedback. **Fix:** vector attitude (`asin`/`atan2` on body axes) and first-order rate tracking. Retest: independent axis table below.
4. Keyboard `e.code` only — `keydown w` did not raise throttle. **Fix:** also map `e.key`. Retest: `thr ≈ 1`, `velY ≈ 9.4`.
5. Missed-gate +2s applied every physics frame while inside a later gate (penalty 198). **Fix:** one `_missed` flag per gate per race. Retest: penalty **2.00** once, banner `MISSED GATE +2.00s`.
6. Top-right HUD overlapped toolbar. **Fix:** offset `#hud-tr`.

## Public checks

| Check | Result | Evidence |
| --- | --- | --- |
| Independent throttle | **pass** | `thr=1` → `dpos.y +3.6` to `+5.4`, orientation unchanged |
| Independent yaw | **pass** | heading `0 → -0.205` (and larger holds), position ~unchanged |
| Independent pitch | **pass** | `pit=1` → `dpos.z +3.2` (forward), pitch ~34°, not a camera path |
| Independent roll | **pass** | `rol=1` → `dpos.x +1.9` |
| Pass ≥2 ordered checkpoints | **pass** | Gate 1 at t=5.29s, gate 2 at t=10.43s; later full lap gate 10/10 |
| Collide with terrain, recover/reset | **pass** | Fall: `colliding: true`, `hitCount` increased, bounce `velY>0`; Reset button returned `gate 0`, spawn `[0, 6.25, 0]` |
| Switch camera mode | **pass** | UI **Camera** → chase; eval `fpv/chase/orbit/track`; position unchanged across switches (`physSame: true`) |
| Assisted vs manual flight mode | **pass** | Angle: pitch 0.585 then release → **0** (auto-level). Acro: pitch −0.80 then release → **−0.63** (stays unlevel) |
| Lap timing | **pass** | Finish `50.450s NEW BEST`; HUD `57.067`, sector `06.617`, BEST `50.450` |
| Checkpoint order | **pass** | `nextGate` only advanced on current gate; skip path left `gate: 0` until miss |
| Telemetry changes | **pass** | Graph ALT/SPD/THR/ROLL RATE; HUD speed/alt/thr/fps/res update in screenshots |
| Seed reset | **pass** | Import seed 4242 / forest → `gateMoved: true`; restore 1337/canyon |
| Ghost / replay | **pass** | Live rec imported as replay (200 frames mid-run); finish stored **1514** frames in `localStorage` `riftline-best-1337-canyon-medium` |
| Gamepad fallback messaging | **pass** | Settings text: `No controller detected — keyboard: W/S throttle, A/D yaw, arrows pitch/roll.` No hardware pad attached |
| Quality controls | **pass** | Quality **Low** → internal res `704×440` (from `1280×800`), lighting 0, particles 0.30 |
| Stable render after desktop resize | **pass** | 1280×800 ↔ 390×844; fps ~55–60; projection remained coherent |
| Narrow 390×844 | **pass** | Virtual sticks shown (`vstick show`); HUD + toolbar still usable. Settings is a full-width sheet when open |
| Direct `file://` | **pass** | Session `riftfile`: protocol `file:`, WebGL on, `__SIM` live, fps ~55, **zero** resource fetches. Screenshot `15-file-protocol.png` |
| Invalid import | **pass** | `{bad json` → `Import failed: Expected property name...`; `{foo:1}` → `Unrecognized JSON` |
| PNG export capability | **pass** | Canvas `toDataURL` available, 1280×800 buffer. Download click not fully exercised in headless (no file picker assert) |
| WebGL fallback | **not-run** | WebGL2 available here; fallback DOM exists (`#fallback`) but was not force-failed |
| Audio quality | **not-run** | Gesture enabled context (hint `display:none` in one session). **Not heard.** After later reloads the hint can reappear until another gesture |
| Physical gamepad calibration | **blocked** | No controller in the automation environment. UI + dead zone + invert + calibrate button present |
| Console / failed requests | **pass** | `agent-browser errors` / `console` empty on checked loads; resource list empty (no CDN) |

## Commands actually used (representative)

```bash
python3 -m http.server 45197 --bind 127.0.0.1
agent-browser --session rift open http://127.0.0.1:45197/index.html
agent-browser --session rift set viewport 1280 800
agent-browser --session rift snapshot -i
agent-browser --session rift screenshot evidence/screenshots/….png
agent-browser --session rift click @eN | find role button click --name "…"
agent-browser --session rift keydown w / keyup w
agent-browser --session rift eval --stdin   # __SIM.getState / applyControls / import
agent-browser --session rift set viewport 390 844
agent-browser --session rift set offline on
agent-browser --session riftfile open file:///home/pyro/projects/naked/grok46/13-drone-racing/index.html
```

Flight proofs used the **live integration** (`applyControls` + RAF physics), not a canned animation. Keyboard `w` was also held and raised throttle independently.

## Screenshot index

| File | What it shows |
| --- | --- |
| `01-help.png` | Help overlay, HUD, 60 fps |
| `03-fpv-after-hover-fix.png` | Hover-stable FPV, gates 1…n visible, racing line |
| `05-two-gates-passed.png` | After two ordered gates |
| `07-ready-fpv.png` | Default spawn, GATE 1/10, graph, attitude indicator |
| `08-chase-after-gates.png` / `12-chase-camera-button.png` | Chase camera, visible craft, gates |
| `09-settings-diag-low.png` | Diagnostics + quality Low |
| `10-narrow-390.png` | 390×844 settings sheet, gamepad fallback text |
| `13-narrow-gameplay.png` | Narrow chase + virtual sticks |
| `14-desktop-final.png` | 1280×800 after resize |
| `15-file-protocol.png` | Direct file:// run |
| `16-missed-gate.png` | Missed-gate feedback |
| `18-finish-new-best.png` | GATE 10/10, BEST 50.450, CONTACT after finish |

## Remaining limitations

- Default acro rates (720°/s) will flip past 90° in under a second; that is flyable for a human with small sticks but harsh for full-deflection holds.
- Ground contact while resting can report many small hits; crash reset only on high impact.
- A full human-paced race (not scripted `applyControls`) was not flown; the 10-gate finish used the same physics/inputs as the two-gate pass.
- Audio was enabled by gesture in some sessions only; **do not treat as a listening test**.
- Gamepad axis calibration was not run against real hardware.
- WebGL-unavailable fallback was not triggered on this GPU.
- Headless PNG *download* was not confirmed as a saved file; canvas capture API works.

## Verdict

The delivered `index.html` is a self-contained WebGL FPV sim with real rigid-body-style flight (throttle/yaw/pitch/roll), three modes, race loop, cameras, telemetry, persistence, and import/export. Public workflow checks above were exercised in a real browser. Remaining items are listed honestly, not as passes.
