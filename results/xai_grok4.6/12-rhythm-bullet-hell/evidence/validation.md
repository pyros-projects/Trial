# CADENCE validation

Artifact: `/home/pyro/projects/naked/grok46/12-rhythm-bullet-hell/index.html`  
Tooling: `agent-browser` 0.31.1 (Chrome for Testing 152) plus a temporary `python3 -m http.server 18080` for HTTP inspection. The delivered game has no runtime server or network dependency.

Local server bind: `127.0.0.1:18080`. External HTTPS was aborted via `agent-browser network route "https://*" --abort`.

Audio quality was **not heard**. Claims about soundtrack use AudioContext state, scheduled note kinds, and AnalyserNode peaks only.

## Checks

### 1. Enable audio with a real gesture, play multiple measures, sync
**Status: pass** (audio *heard*: not-run; meters/state inspected)

Steps:
1. `agent-browser --session cadence set viewport 1280 800`
2. `open http://127.0.0.1:18080/`
3. Click `#btn-start` (“Enable audio and play”)
4. Wait until `window.__CADENCE.S.mode === 'play'`
5. Wait ~4s wall time and read `getDiagnostics()`

Observed:
- After the click, `audioState` was `running`.
- At gameplayTime **10.995s**, overlay beat was **7:1**. That matches `10.995 / (60/132) ≈ 24.19` beats → measure 7, beat 1.
- Active bullets **34**, phase **0 / OVERTURE**, FPS **60**.
- Scheduler queue included `{step:96, kinds:["kick","hat","bass"]}` with transport time aligned to the same clock as `gameTime`.
- `analyserPeak` **0.863** (non-zero AnalyserNode output after the gesture).
- Screenshots: `screenshots/02-countdown.png`, `screenshots/03-play-early.png`, `screenshots/09-midrun.png`.

### 2. Move (normal + focus), dash, bomb, damage, restart, scoring
**Status: pass**

Steps:
1. Set `input.keys.KeyA` + `ShiftLeft` (focus), wait 500ms.
2. Switch to `KeyD` + `KeyW`, wait 400ms.
3. Pulse `dashEdge`, then `bombEdge`.
4. Also issued real keys: `ArrowLeft`, `ArrowUp`, `Space`, `KeyX`.
5. Pointer: `input.ptr=true` toward field `(120,400)`.
6. `hitPlayer()` after clearing i-frames.
7. Failure: set `hp=1` then `hitPlayer()` → BREAK → `#btn-fail-retry`.

Observed:
- Focus-left: `x 240 → 195.9`, `player.focus === true`.
- Up-right: `x 221.9, y 473.2`.
- Pointer: `240,499 → 128.3,406.9`.
- Dash set cooldown (~1.16s). Bomb: `bombs 3 → 2`, rating **GOOD**, combo 1, score increased.
- Hit: `hp 4 → 3`, `invuln = 2`, combo reset to 0, `hits` incremented.
- Fail screen showed HP 0, replay JSON, Restart restored `mode=play`, `hp=5`, `score=0`. Best score persisted (`2892`).
- Screenshots: `screenshots/05-after-move-dash.png`, `screenshots/14-fail.png`.

### 3. Pause / resume without timeline jump or bullet backlog
**Status: pass**

Steps:
1. Snapshot `{gt:20.052, step:179, bullets:26, beat:12:1}`.
2. Click `#touch-pause`, wait until PAUSED, wait 1500ms.
3. Click `#btn-resume`, wait 700ms.

Observed during pause (after 1.5s):
- `mode=pause`, `step` still **179**, `gameTime` **20.077** (≈25ms click slop, not 1.5s).
- Bullet count **34** vs pre-click **26**: an 8-way radial can spawn in the frames *before* pause latches. Count did **not** keep climbing across the 1.5s hold.

Observed after resume:
- `mode=play`, `gt=20.78`, `step=184`, `dt=0.73s`, `stepDelta=5`.
- At 16th notes / 132 BPM, 0.73s ≈ 6.4 ticks. Delta 5 is catch-up of the post-resume wait, **not** the paused 1.5s (that would be ~13 extra steps).
- `audioState` returned to `running`.
- Screenshots: `screenshots/06-paused.png`, `screenshots/07-resumed.png`.

Fix applied during this run: `resumeGame()` used to `await audio.ctx.resume()` first, which can hang in headless Chrome and leave the pause overlay stuck. Resume now starts the performance-clock immediately and races `resume()` against a 400ms timeout.

### 4. Practice lab / step grid / live pattern change
**Status: pass**

Steps:
1. Title → Practice Lab.
2. Click preset **Chaos Seed**, toggle steps 2 and 3, screenshot editor.
3. Enable Audio & Test; wait for `mode==='lab'`.
4. Set `lab.pattern='spiral'` and `lab.dens=14` while running.

Observed:
- Grid after edits: `[1,0,1,1,1,0,1,1,1,0,1,1,0,1,1,1]` (chaos mask plus extra ons).
- Lab at 2.09s / beat 2:2 had **244** bullets (chaos density).
- After live spiral/density change: **164** bullets, pattern `spiral`, dens 14, `analyserPeak` 0.757, audio running.
- Screenshots: `screenshots/12-lab-editor.png`, `screenshots/13-lab-running.png`.

### 5. Seeded replay
**Status: pass**

Steps:
1. Start with seed **77**, hold left (`mask=4`) from ~1.6s, `exportReplay()`.
2. Title → paste JSON → Play Replay.
3. Wait until `mode==='replay'` then 1.8s.

Observed export: `{"v":1,"seed":77,...,"inputs":[[0.0225,0,-1,-1],[1.606,4,-1,-1]]}`.
Playback: `playing=true`, `seed=77`, at `gt=1.89` player `x=180.5` (moved left from 240). Replay index consumed both events.

### 6. Reduced flash + settings
**Status: pass** (control exercised; A/B flash screenshots not taken)

Steps: Instructions screen, Settings, check `#set-flash` and `#set-diag`, screenshot.
Observed: Settings panel exposes tempo, offset, difficulty, preset, master/track volumes, mutes, particles, quality, shake, reduced motion/flash, contrast, diagnostics. Reduced-flash checkbox accepted. Diagnostics overlay then showed scheduler horizon, ctx/game time, step, bullets, hitbox, timing error, drops, seed.
Screenshots: `screenshots/10-howto.png`, `screenshots/11-settings.png`.

### 7. Narrow viewport 390×844
**Status: pass**

Steps: `set viewport 390 844` during an active run, then return to title.

Observed:
- `innerWidth=390`, `innerHeight=844`, canvas **390×500**, FPS 60, transport `5:1`.
- `#touch-bar` `display:flex` (Focus / Dash / Bomb / Pause).
- Title remains usable (Enable Audio, Practice Lab, seed, replay paste).
- Screenshots: `screenshots/15-narrow-play.png`, `screenshots/16-narrow-title.png`.

### 8. Direct file:// open
**Status: pass**

Steps:
1. New session, viewport 1280×800, then `open file:///home/pyro/projects/naked/grok46/12-rhythm-bullet-hell/index.html`
2. Click Enable audio and play.

Observed:
- Title `CADENCE — Rhythm Bullet Hell`, URL `file:///.../index.html`, labeled controls present.
- Play: `audio=running`, `gt=1.55`, beat `1:4`, bullets 10, `analyserPeak=0.745`, FPS 60, `errors=[]`.
- Screenshots: `screenshots/17-file-protocol.png`, `screenshots/18-file-play.png`.

An earlier file:// attempt screenshotted a blank white page because `set viewport` relaunched the session *after* `open`. Retry with viewport-then-open succeeded.

### 9. Victory path
**Status: pass** (forced boss kill, not a full four-phase human clear)

Steps on the file:// session: set `boss.hp=1`, push a player shot at the boss, wait for “CADENCE CLEAR”.

Observed: overlay with score/combo/graze/accuracy, replay JSON, Restart / Copy Replay / Title. Phase label **CADENZA**. Screenshot: `screenshots/19-victory.png`.

### 10. Console / network / self-contained artifact
**Status: pass**

- `window.__CADENCE.errors` remained `[]` across HTTP and file:// runs.
- `agent-browser network requests` on HTTP: `GET http://127.0.0.1:18080/` 200, and a browser `favicon.ico` 404 (not requested by game JS). No CDN/API/font/audio file fetches. Log: `logs/network-http.txt`.
- `index.html` grep: no `http(s)://`, `fetch(`, ES `import`, or external `<script src>`. Favicon is `data:,`.

### 11. Gamepad
**Status: not-run**

Code reads `navigator.getGamepads()` (stick, A dash, B bomb, LB focus, Start pause). No physical gamepad was attached in this environment.

### 12. Latency calibration (8 taps)
**Status: not-run**

UI exists (`#btn-calibrate`, tap-on-downbeat averaging into `settings.offsetMs`). The 8-tap procedure was not completed.

## Failures found and fixed during the run

| Issue | Fix |
| --- | --- |
| Status overlay HTML typo (`BLTspan`) | Restored `BLT <span id="st-bullets">` |
| Headless `AudioContext.currentTime` stalling froze the whole fight | Pause-aware `performance.now()` transport; Web Audio scheduled via `audioWhen(transportTime)` |
| `S.origin = 0` made `S.origin \|\| now()` always `now()`, so beat stayed `1:1` | Use `now() - S.origin` directly |
| Opening 1-way aimed shots + low boss HP melted/killed AFK instantly | Phase-0 2-way spread, longer start i-frames, higher boss HP, slightly slower auto-fire |
| `await ctx.resume()` on Resume hung the pause menu | Clock resumes first; `resume()` raced at 400ms |
| Lab BPM leaked into the next story run | Story start re-reads `#set-bpm` |
| Replay dashes/bombs ignored edge bits | `applyReplay` sets dash/bomb edges from mask rises |

Retested after those fixes: countdown→play (~2s), audio peak > 0, pause/resume step math, lab live pattern, seed-77 replay, file:// play.

## Remaining limitations

- Soundtrack was validated with context state, scheduled instrument kinds, and analyser peaks, not listening.
- Full Overture→Cadenza clear by dodging was not played out; victory used a colliding player shot after HP was forced down.
- Gamepad and 8-tap latency calibration were not executed.
- Headless Chrome may still report `AUD suspended` until a gesture plus the resume watchdog; file:// and the later HTTP session both reached `running` with peaks ~0.7–0.86.
- Chaos lab can exceed 200 bullets; FPS stayed 60 in this machine’s capture, but low-end devices should use the Gentle preset or Low quality.
