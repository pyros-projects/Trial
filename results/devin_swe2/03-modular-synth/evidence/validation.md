# Validation — MODULA Modular Synth & Sequencer

Artifact: `../index.html` (single self-contained file, no external deps)
Tool: `agent-browser` 0.31.1 (Chrome 152, CDP) against `file://` URL — direct-file
opening verified working; no local HTTP server needed, no network access used or required.

## Method

All interactions used real CDP input events (click/press/drag/upload) or, where
noted, in-page `eval` to inspect live audio-graph state (AudioParam values,
analyser data, voice sets). Screenshots in this directory.

## Results

| Check | Result | Evidence |
|---|---|---|
| Audio starts only after user gesture | pass | `00-overlay.png`; `AC===null` before POWER ON, `ctx.state==="running"` after |
| Playback + playhead + audio-driven analysers change over time | pass | `gstep`/`currentStep()` advance (32→66→…), scope/spectrum/spectrogram draw live (`01-playing.png`, `05-default-playing.png`), per-track meters animate |
| Toggle/edit steps during playback | pass | kick step 3 toggled on mid-play → `pattern[2].on=true`, cell `.on` class set |
| Piano-roll pitch editing | pass | synthetic pointerdown on cell `(s5,m48)` → `pattern[5].notes=[48]` |
| Velocity lane + accent | pass | vbar drag → `pattern[7].v≈0.94`; shift+click → `pattern[5].a=true` |
| Pointer note input (on-screen piano) | pass | click `.pkey[7]` → voice count +1 |
| Computer keyboard input | pass | `press s`/`j` → voice spawned on selected track |
| Stuck-note prevention | pass | live note held → `blur` → `ENG.live` cleared (1→0); `pointercancel`/`visibilitychange`/`window pointerup` also wired |
| Tempo + swing change while playing | pass | bpm 122→160, swing→0.4 mid-play; step continued advancing, no errors |
| Pattern-length change while playing | pass | BASS len 16→8 live, playback coherent |
| Mute / solo | pass | M → `muteG.gain`→0; S on DRUMS → other tracks' muteG→0, drum bus peak 0.167 |
| Stop / restart / resume | pass | stop halts (step −1, playing=false); restart resets gstep=0; play resumes |
| Metronome | pass | toggle on → clicks scheduled every 4 steps, scheduler kept advancing |
| Knob drag (synth param) | pass | CUTOFF drag → `s.cut` 640→16000 |
| Track preset | pass | "FM Bell" applied → `fm=0.8, wave=sine` |
| Song preset | pass | "Dub Pressure" → bpm 96, D minor, patterns loaded |
| Seeded randomize | pass | `randMelodic` with mulberry32(42) twice → identical patterns |
| Send levels | pass | `sendD=0.8` → `sD.gain` ramped to 0.8 |
| FX toggles alter graph | pass | delay off → `dWet`/`dFb` gains →0 |
| Save/load JSON roundtrip | pass | `serialize()`→mutate→`applyLoaded` restored state exactly |
| localStorage persistence | pass | reload → bpm/mute/pattern edits restored |
| IMPORT via real file input | pass | uploaded JSON → bpm 77 + track name applied |
| Offline WAV render | pass | `renderWav(1)` → 1.23 MB `audio/wav`, RIFF header, peak≈0.9 FS, 65% non-zero samples — real rendered audio incl. FX tail |
| Scheduler timing | pass | lookahead 120 ms + 25 ms tick; `nextTime` stays ~0.2 s ahead of `currentTime`; `eng 0.05 ms/tick`; drift display live |
| Console errors (post-fix) | pass | fresh session: 0 errors over sustained playback + metronome |
| Viewport 1280×800 | pass | `03-desktop-1280.png` |
| Viewport 390×844 | pass | `02-mobile-390.png`, `06-mobile-playing.png` — cards collapse to horizontal scroll row, grid scrolls, controls usable |
| Status area | pass | ctx state, bpm, step, lookahead, voices, eng ms/tick, out dB, clip flag, drift, key |
| No external fetches | pass | grep of file: no http(s)/src/import/fetch refs |

## Bugs found during validation and fixed

1. **Infinite loop in voice stealing** — `countVoices` included already-released
   voices (removed only later via `onended`), so `while(count>=poly) steal()`
   never terminated → tab pegged at 100% CPU. Fixed by excluding released
   voices and adding a scheduler sweep for stragglers.
2. **Metronome killed the scheduler** — `E.click` shadowed `g` (engine graph vs
   local gain): `g.connect(g.postSat)` → connect(undefined) threw every bar,
   freezing `tick()` mid-loop while `playing` stayed true. Renamed local,
   verified fix; also hardened `tick` with try/catch so no single step can
   freeze the sequencer again.
3. **Voice zombies** — `release()` was invoked before `o1.start(t)` for
   sequenced notes; reordered start-then-release; added `endAt` sweep in tick.
4. **`setPointerCapture` throw** killed cell toggles when a pointer id wasn't
   active (synthetic/edge input); now guarded.
5. **Grid hint raw HTML** — `<b>` tags shown literally; switched to innerHTML.
6. **Duplicate window pointerup listener** per `buildKeys` rebuild → hoisted to
   one-time registration.
7. **Piano-roll window didn't cover default bass notes** — auto-fits window to
   the pattern's lowest note on render.

## Not verified / limitations

- Perceptual audio quality not judged by ear (headless env); correctness shown
  via analyser peaks, non-silent WAV content, param/gain state.
- Drum one-shots are transient nodes and intentionally not counted in the
  "voices" status figure (melodic voices only).
- `AudioParam.value` reads lag `setTargetAtTime` by a few ms — cosmetic in
  automation-driven verification only.
- Per-track pattern length lives in the track editor (STEPS select), not the
  transport strip; it is live-safe during playback.
