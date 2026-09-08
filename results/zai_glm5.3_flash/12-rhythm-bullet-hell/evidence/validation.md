# PULSEFALL — Validation Evidence

Artifact: `index.html` (single self-contained file, ~133 KB, no external assets,
no build step, no network use). Dev parts live in `parts/` (p1 HTML/CSS, p2 core,
p3 audio/transport, p4 game/sim, p5 render/UI) and are concatenated into
`index.html` at build time; `index.html` is the delivered artifact.

Test environment: Linux host, headless Chrome (agent-browser managed, SwiftShader
software rendering, **no system audio hardware** — no ALSA/Pulse/PipeWire devices),
local HTTP server `python3 -m http.server 8123`. Browser console and error buffers
were checked throughout; the game surfaced **zero page errors** across all sessions
(`agent-browser errors` returned empty). A second Chrome instance (custom flags)
was also used; it exhibited an unstable **fake audio clock** (freezing, 4% speed,
and forward/backward jumps) which drove several transport-robustness fixes below.

Test instrumentation: the app exposes `window.__PF` (GAME, MUSIC, AUDIO, CLOCK,
SETTINGS, RENDER, UI, INPUT, helpers) used to read live state. All gameplay
interactions were performed through real event paths: CDP mouse clicks on labeled
buttons, synthetic `KeyboardEvent` key events consumed by the game's own input
handlers, PointerEvents on the canvas, and the on-screen touch buttons.

---

## 1. Boot, audio gesture, transport, sync — PASS

- Open page → title screen renders (01-title.png). `START RUN` click creates the
  `AudioContext` inside the click handler; state `running` verified.
- Count-in: 4 metronome ticks scheduled at exact beat times; `gameT` reached 0.57 s
  after 2.6 s wall (expected 0.57 ✓) — count-in duration exact.
- Scheduler drift: `nextStepTime − (t0 + stepIndex×stepDur) = 0.000 ms` over a full
  run (transport is drift-free; rechecked after pause/resume: 0.00 ms).
- Event punctuality: polled the gameplay event queue at 4 ms for 2 s while events
  streamed; **max lateness of applied events = 0 ms** (≤ poll granularity).
- Audio graph output: `AnalyserNode` energy sampled each frame; waveform + spectrum
  drawn on canvas (visible in screenshots) — sound is genuinely flowing through the
  master chain. (Caveat: the host has no audio hardware; "audible" is verified by
  the graph/analyser, not by ear.)
- Grid alignment: gameplay emission times are generated as `k×stepDur` on the
  transport grid inside the fixed-step sim (by construction); the audio voices are
  scheduled for the same grid via `ctxTime = t + _aoff`, with `_aoff` tracked from
  the audio clock and measured stable (drift −0.68 ms over 3 s).

## 2. Controls — PASS

- **Movement**: holding `KeyD` moved the ship at exactly **335 px/s**; with focus
  held exactly **150 px/s** (fixed-step sim, measured over 0.5 s windows).
- **Focus**: hitbox dot + ring rendered, speed drops ✓ (`focus=true` while held).
- **Fire / judging**: holding Z for 1.5–2.5 s produced judged shots with the
  expected P/G/M distribution at 118 BPM (e.g. 36/156 ≈ 23% perfect ≈ ±12% window);
  combo and multiplier responded (combo 112 → ×6; ×1 base), score accrued,
  `lastErrMs` reported (e.g. +247 ms on a miss). Judgement flashes appear on the
  beat lane; PERFECT/GOOD floaters appear near the ship.
- **Dash**: X triggers dash with i-frames; cooldown measured **1.29 s remaining**
  right after use (1.4 s nominal; perfect dashes refund to 0.8 s + longer i-frames).
  Also verified with zero-gap keydown/keyup (edge-triggered) and with touch button.
- **Bomb**: C consumes stock (2→1), cleared 13 on-screen bullets → 0 with score
  gain, grants 2 s i-frames, ring + shake effect.
- **Graze**: weaving through bullet halos increased graze counter and score;
  near-beat grazes pay the ✦ bonus (35 vs 10).
- **Pointer/touch**: drag on canvas moves ship (270 → 183.6 px) and auto-fires;
  touch buttons (FIRE/FOCUS/DASH/BOMB) appear on touch and work (dash via touch ✓).
- **Gamepad**: polling is active and guarded; no gamepad hardware present in the
  environment, so stick/button behavior is **not exercised** (not-run; no errors
  from the poll path).
- **Key rebinding**: bound dash to `KeyK` via Settings → capture → new key works
  in-run ✓. Control reference table in How To Play.

## 3. Damage, invulnerability, health, game over — PASS

- Standing in streams took hits: hearts decrement (5→0 on easy across several
  hits), each hit grants 1.7 s invulnerability (blink + collision gate verified:
  `invulnUntil > t` after hit), mercy-clears bullets within 115 px, resets combo.
- hearts=0 → death explosion, defeat arrangement (6), then SIGNAL LOST screen with
  full stats (score, best, graze/combo, timing accuracy P/G/M, hits, time, seed,
  difficulty, track). Best score persisted to `localStorage` and shown on title.

## 4. Boss encounter, phases, arrangements — PASS

- Phase 1→2 crossed through **real bullet damage**: banner “MOVEMENT II — SPIRAL
  DRIVE”, boss bar switches to phase color/segment, boss becomes invulnerable
  (dashed ring), all bullets convert to star particles, arrangement changes to 2
  (lead enters), master duck + sting sound. Screenshot 11-phase2.png.
- A long run reached **phase 4** (“FINAL — OVERDRIVE” visible in 04-victory.png)
  and boss death → victory sequence: bullets→stars, fanfare arrangement (5),
  CONDUCTOR SILENCED screen with stats and NEW BEST badge, best saved.
- Phase rules differ per phase (radial+aimed → spiral+wall → lanes+accel+curve →
  overdrive stutter/orbit/lanes) and density scales with phase, difficulty, and
  boss health within a phase band.

## 5. Pause / resume — PASS

- Esc during run/countdown/lab → pause screen; `AudioContext.suspend()` — status
  overlay shows “■ PAUSED”, audio state `suspended`.
- Paused 6 s wall-clock mid-run, resumed: transport jump = **+100 ms** total
  (this environment runs the degraded fallback clock; on healthy audio the ctx
  clock freezes so pause is exact — measured drift 0.000 ms post-resume).
  Beat position continued from the same point (6.14 beats at pause → continued),
  no bullet backlog (`evq` returned to ≤ horizon), scheduler healthy after resume
  (`schedDriftMs 0.00`).
- Real-button flows: pause → settings → back to pause → quit to title ✓.

## 6. Tempo / live music controls — PASS

- Changing tempo 118→150 mid-run re-anchored the beat grid immediately (beat
  counter advanced at the new rate; scheduler cursor kept pace; drift 0).
- Track mutes: drums mute checkbox → bus gain 0.9→0.000 (measured after 350 ms
  ramp), unmute restores. Master volume slider updates master gain + persists.
- Music presets (4 scales) selectable; lead motif is regenerated per run seed.
  Arrangements verified: menu (0), phase 1–4 (1–4), victory (5), defeat (6).

## 7. Pattern Laboratory — PASS

- Real UI: pattern select, BPM slider, subdivision select (1/4, 1/8, 1/8T, 1/16 —
  triplet builds a 12-cell grid), density, speed, seed, curated presets.
- **Step grid edits change actual scheduling** (spawn counts measured over equal
  windows, same seed/pattern): grid `[1,0,0,0]` → 60 bullets; `[1,0,1,0]` → 108;
  `[1,1,1,1]` → 216. Subdivision 1/8T produced triplet-grid spiral emission.
- Lab runs are invincible practice runs with ESC-to-exit; live status shows
  “PHASE LAB” and pattern info on canvas.

## 8. Determinism, seeds, replay — PASS

- Same seed twice from title: identical world hash, score, and bullet count at
  t=5 s (two independent fresh runs).
- Record→export→import→replay: a scripted-input run (fire/dash/move/bomb at fixed
  game-times) replayed with **bit-identical world state** at t=9 s: same state
  hash, same score, same boss HP, same player position, and the entire bullet
  list (positions, velocities, colors, kinds) equal.
- Death-run replay: recorded a lunatic run to its natural death, imported, replay
  died at the same point — over screen shows **“REPLAY VERIFIED ✓ 5/5 HASHES”**
  (05-replay-verified.png). Import also exercised through the real file input
  (`IMPORT REPLAY` → upload .json) with settings applied from the replay.
- Replay export uses a Blob download (`EXPORT REPLAY` buttons); import validates
  schema and rejects foreign JSON with a toast.

## 9. Visuals, accessibility, viewports — PASS

- 1280×800: canvas letterboxed 3:4, 60 FPS typical; screenshots 03/12.
- 390×844: panel and HUD reflow, canvas fits width, touch controls appear and
  function (07/08-narrow pngs).
- High-DPI: emulated iPhone 16 Pro (DPR 3) → backing store capped at 2× (784×1045
  for 392 CSS px) — crisp, bounded cost.
- Reduced flash: suppresses screen flashes (verified flag + code path; hurt
  vignette and phase flash skipped).
- High contrast: body class + white bullet outlines + flat background (verified
  body class and draw path flag).
- Reduced motion: disables trails, screen shake, beat-ring and parallax (defaults
  on for `prefers-reduced-motion`).
- Screen shake toggle + amplitude, particle density slider — all live.
- Adaptive quality: sustained <34 FPS steps render quality down automatically
  (bloom first), with toast; quality select also manual (Low/Medium/High).
- DIAG panel (`` ` `` or button): scheduler horizon, steps scheduled, evq pending,
  ctx time, base latency, transport bar:beat:16th, game time, bullets/pool, phase,
  player collision bounds, last timing error, judge counts, state, seed, fps,
  dropped frames (>22 ms), backing store — all from live state (verified populated).
- Status overlay (always on during play): FPS, BPM, BAR/BEAT, AUDIO state,
  LOOKAHEAD ms, BULLETS, PHASE, SCORE, COMBO, OFFSET, paused/count-in/replay
  state — verified in every screenshot.

## 10. Failure handling & degraded environments — PASS

- **No Web Audio**: game fully playable on a fallback monotonic clock (exercised
  extensively when this host's fake audio clock was dead); waveform shows
  “AUDIO N/A/OFF”, status shows audio state; no crashes.
- **Broken audio clocks** (this host): transport hardens — rate monitor trusts the
  audio clock only while it tracks wall time, backward jumps blacklist it for the
  session, scheduler fast-forwards instead of dumping a storm of notes, sim has a
  full-catch-up budget with a bounded bailout. (Fixes added after reproducing
  frozen/slow/jumping audio clocks in headless Chrome.)
- **Focus loss / hidden tab**: releases all held inputs (no stuck keys) and
  auto-pauses (verified: keys cleared, pause screen shown).
- **localStorage unavailable** (file:// in some configs): settings/best degrade to
  in-memory with try/catch (verified on file:// run).

## 11. Standalone / file:// — PASS

- `file://…/index.html` opens and runs: boot → start → run with bullets; zero
  `performance` resource entries (no fetches); `<noscript>` fallback present.
- Source scan: no `http(s)` URLs, no `fetch`/XHR, no imports, no external
  fonts/images/audio; all fonts are system stacks; audio is synthesized.

## Not-run / limitations (honest)

- **Audibility**: host has no audio device. Sound production was verified via the
  live analyser/waveform/spectrum and node graph, not by listening.
- **Gamepad hardware**: none attached; mapping code is guarded but unexercised.
- **Multi-second replay tails on this host**: replay determinism is bit-exact for
  the scripted/probed windows and full short runs (5/5 hashes); on this
  software-rendered host very long replays can drift if frame rates collapse
  (determinism requires the sim to keep up; a 1 s bailout exists for pathological
  stalls). On normal 60 FPS machines the sim processes every tick.
- Headless Chrome's fake audio clock proved unreliable in this environment
  (freezes/4% speed/backward jumps across launches); the transport therefore runs
  its own monotonic timeline and maps audio voices onto the AudioContext clock —
  on real hardware this mapping is constant (≈ output latency) and the behavior
  equals the classic ctx-time look-ahead design.

## Bug ledger (found → fixed during validation)

1. Countdown never transitioned to run; boss/player started permanently
   invulnerable (`1e9`) → fixed (state transition at t=0; real grace values).
2. Status overlay covered HUD → moved to left-center.
3. `AudioContext.resume()` could stay suspended after flaky gestures → global
   gesture listeners retry resume; toast hint.
4. Transport froze when audio clock froze (no fallback) → hybrid clock.
5. Audio-clock mode oscillation (sub-quantum sampling) corrupted timeline →
   debounced stall detection, then replaced by rate monitor + final single-
   timeline design.
6. Fallback-clock resync could leave the scheduler cursor in the past →
   fast-forward guard; also “stuck ahead” resync.
7. Zero-gap press/release pairs (dash/bomb) lost one-shot actions → edge-drained
   `pending` set (also benefits fast tapplayers).
8. Scheduler catch-up storms under timeline resync could flood audio nodes/event
   queue (renderer crash risk) → skip-ahead + stale-event skip + evq cap +
   full-catch-up sim budget with bounded bailout.
9. Gameplay emission depended on timer callbacks (throttled under load) → moved
   to the deterministic sim step grid (audio scheduler still drives all sound).
10. Synthetic-pointer capture threw (breaks drag) → guarded `setPointerCapture`.
11. Replay verification badge empty when replay started outside the import
    handler → `startRun` records `pendingReplay` for all paths.
12. Per-frame forced layout (resize writes) and string-key sprite lookups →
    resize-on-change + numeric sprite cache keys; trail thinning >900 bullets.

## Evidence index (screenshots)

- 01-title.png — title screen (1280×800)
- 03-run.png / 12-final-run.png — live run: patterns, HUD, status overlay, viz
- 04-victory.png — victory screen, stats, NEW BEST, phase-4 bar label
- 05-replay-verified.png — “REPLAY VERIFIED ✓ 5/5 HASHES”
- 06-lab-spiral.png — pattern lab running spiral, 1/8T, live lab HUD
- 07-narrow.png / 08-narrow-run.png — 390×844 layout + touch controls
- 09-file-direct.png — direct file:// run
- 10-highdpi.png — DPR-3 emulation (backing @2×)
- 11-phase2.png — phase transition banner, star-clear, phase UI

All checks above were executed against the running application in this
environment on the dates of this session; results recorded verbatim from live
probes and screenshots.
