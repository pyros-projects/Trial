# RE:SYNC — Validation Evidence

Artifact: `/home/pyro/projects/naked/swe2/12-rhythm-bullet-hell/index.html` (single
self-contained file, zero external requests — verified via `network requests`:
only the Document GET, nothing else).

Test tool: `agent-browser` 0.31.1 (headless Chromium via CDP), sessions
`rbh`/`rbh2`/`rbh3`/`rbh4`/`rbh5`. Local HTTP server `python3 -m http.server 8931`
used for convenience; `file://` direct-open also verified (session rbh2).

Environment caveat: WSL2 headless Chrome has **no audio device**, so the
AudioContext null sink either runs at ~1.0× realtime or freezes at 0. The game
detects both failure modes (rate outside 0.4–2.2 sustained >0.5s) and falls back
to a wall-clock transport, showing `audio silent` in the HUD. Both paths were
exercised across sessions.

## Results

| Check | Result | Evidence |
|---|---|---|
| Audio via user gesture | PASS | `bt-start` click → `ctx.state=running` (rbh4), or silent fallback where clock frozen (rbh2/rbh3) |
| Transport beat = tempo | PASS | beatRate 2.129/s @128bpm, clockRate 0.998; 3.02/s @180bpm; 2.67/s @160bpm |
| Scheduler→beat alignment | PASS | `next16Time - timeAtBeat(next16/4) = 0.0000` |
| Synth output live | PASS | Analyser FFT max 240, 289–424 bins active (spectrum strip renders this data) |
| Bullets spawn on beat grid | PASS | emissions quantized to 16th-note ticks via catch-up loop; field populated |
| 8-dir movement | PASS | held `KeyA` (synthetic keydown) moved player 292px left, clamped at wall |
| Focus mode | PASS | `Input.mask&16` set on Shift; visible hitbox ring drawn |
| Dash + i-frames + cooldown | PASS | `press Space` → dashCd 1.21s, judged `+50ms` off beat |
| Lost-tap input | FIXED | keydown edge queue added (`Input.qmask`) — sub-frame taps no longer dropped |
| Collision / lives / iframes | PASS | standing still → lives 3→0 → `SYNC LOST`; post-hit if=2.2s |
| Pulse bomb | PASS | 33→16 bullets cleared, charge 2→1 |
| Graze | PASS | grazes counter incremented (9 in unattended run) |
| Pause freeze | PASS | beat drift exactly 0, `ctx=suspended`, bullet count frozen (31→31), no backlog |
| Resume | PASS | +4.28 beats / 2s, no jump |
| Pause in stall fallback | PASS | drift 0 via frozen `pauseBeat`, resume re-anchors wall clock |
| Restart / countdown | PASS | R + RESTART button → fresh run, count-in 4→1→GO |
| Game over → hi-score | PASS | score 2585 persisted → BEST shown; 2755 on later run |
| Victory | PASS | `TRACK CLEARED` screen, stats block, replay export button |
| Pattern lab | PASS | all 8 patterns fire; pattern/subdivision/density/speed/seed edits live; 16-step grid cells toggle ring bursts (verified bullets appear on lit steps) |
| Lab tempo change | PASS | 132→180bpm live via `setBpm` (beatRate 3.02) |
| Replay export/import | PASS | 140-char b64 code; replayed run reached identical player.x=592, all 4 input events consumed |
| Determinism (same seed) | PASS | per-step rolling hash of bullet positions identical for 959 overlapping steps; boss hp & score identical |
| Invalid replay | PASS | `Invalid replay: ...` shown, stays on title |
| Stuck inputs on blur | PASS | `blur` clears `Input.keys`, mask→0, auto-pauses |
| Reduced flash | PASS | pixel-sampled flash alpha: rgb(105) full vs rgb(35) reduced |
| Viewport 1280×800 | PASS | gameplay screenshot, 59–60fps |
| Viewport 390×844 | PASS | field scales 0.624, touch buttons appear, pause menu usable |
| Diagnostics overlay | PASS | backquote toggles: ctx time, beat, simStep, sched.ahead, hitbox x/y/r, drops, drift |
| External assets | PASS | none — single Document request only |
| JS errors (fresh session) | PASS | 0 errors over ~40 beats of play (session rbh4) |

## Bugs found & fixed during validation

1. `rng is not a function` — `curve`/`orbit`/`wall` patterns crashed when the boss
   conductor called them without rng → defaulted to `Sim.rng` inside each pattern.
2. Lab never stepped — `startLab` didn't reset `run.step`, so `run.step*DT`
   exceeded `simNow` forever → run object now reset.
3. Countdown showed "5" — transport delay made beat −4.32; display clamped to 4.
4. `Sim.step` never incremented → background grid frozen; now incremented per step.
5. `beatAt` divergence under tempo changes → sim beat is now step-derived
   (`simBeat += DT*bpm/60`) for replay determinism; audio clock drives
   visuals/scheduler separately.
6. Frozen/racing audio clock (headless null sink, real-world weird audio stacks)
   → stall detector + wall-clock fallback + seamless re-anchor on recovery.

## Not-run / limitations

- **Gamepad**: no device attached; code path is try/catch-guarded, untested live.
- **Audible quality**: verified via analyser data only — no human ear in headless.
- **Tap calibration**: code path present, exercised via button (no error), but the
  8-tap measurement flow wasn't run end-to-end.
- Bullet cap (900) unverified under extreme density.
