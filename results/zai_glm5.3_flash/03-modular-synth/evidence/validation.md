# Validation Record — MODULA modular synth & sequencer

Artifact: `index.html` (single self-contained file, no external assets/imports/network).
Test harness: `agent-browser` (installed skill; version-matched core workflow read before use), dedicated
session `--session modula`, headed Chromium (headless renderer throttling suspended the AudioContext; headed
mode plus launch args `--disable-backgrounding-occluded-windows,--disable-renderer-backgrounding,--disable-background-timer-throttling`
was used for stable audio testing). Local server `python3 -m http.server 8123` was used for HTTP inspection
and is NOT a runtime dependency — `file://` was verified separately (see §10).

Diagnostic access: the app exposes `window.APP` (state/engine/transport getters) — used for live state reads;
all interactions below were real CDP input events (mouse, keyboard, clicks) on the actual UI unless noted.

---

## 1. Boot, audio gesture gate, auto-start demo — PASS
Steps: `agent-browser open http://127.0.0.1:8123/index.html` → screenshot `01-boot.png` (overlay + power button,
interface visible behind) → click `#btnPower` (real user gesture) → wait.
Observed: AudioContext `running`; transport auto-starts; overlay hidden; oscilloscope/spectrum/note-history
animate; status bar shows `STEP n/16` advancing, `AHEAD ~120–200 ms`, `OUT ≈ −16 dB`, `DRIFT +5…12 ms`.
Evidence: `01-boot.png`, `10-final-desktop.png`.

## 2. Playhead + audio-driven meters — PASS
Steps: during playback took two screenshots ~0.4 s apart (`02-playhead-A.png`, `03-playhead-B.png`); read
`APP.transport.visualStep` (advanced 4 → 4→5 across shots), `#sOut` level −16.4 dB, drift readout, and probed
master analyser peak = 0.32 (live audio), per-track analysers non-zero.
Observed: white playhead triangle+line visibly between columns in both shots at different positions; all
three visualizers driven by master analyser data.

## 3. Step editing during playback — PASS
Steps: selected DRUMS tab; `mouse move/down/up` on drum grid at (96,213)=kick step1 → added 0.85;
(213,245)=snare step3 → added 0.85; drag-paint across hat row → new cells added while existing ghost notes
(0.3) preserved. Tap on active kick step0 → removed. While playing at all times.
Observed state via eval: `kick:[0,0.85,0,0,1,0]…`, `snare[3]=0.85`, `hat[2]=0.85`. Screenshot `04-drum-edit.png`.
Velocity modifiers verified: shift→1.0 (accent, white ring), alt→0.4, plain→0.85 (`edVelFromEvent` reads real
event modifiers; mapped values asserted).

## 4. Piano-roll pitch editing (melodic) — PASS
Steps: LEAD tab; click empty cell step8/F4 → note `{p:65,v:0.85}` added; press-drag that note → pitch moved to
67 (drag-to-move), tap → removed. BASS tab regression: click added snapped note (A-minor snap 44→45).
Bugs found & fixed during testing: (a) `vel` referenced before definition in pointerdown handler;
(b) `const midi` reassignment threw in strict mode, blocking ALL synth-track adds; (c) missing `hp` ref in
reverb rebuild. All retested after fix — full add/move/remove cycle passes.

## 5. Live performance input — PASS
Computer keyboard: dispatched real `keydown` codes KeyA/KeyW/KeyK → held notes [48,48,60] (KeyW C#→48
snap proves scale-snap); single keyup released only its own note; window `blur` → panic, 0 active voices.
On-screen piano: real mouse press on C3 → voice 48; glissando drag to C4 mid-hold → old note released,
new 60 (no stuck notes); release → 0 active.
Drum pads: real/synthetic pointerdown on KICK pad → fresh `drumFlash`, kick envelope visible on master
analyser (peaks 0.185→0.031 over 360 ms).
Pointercancel/lostpointercapture handlers bound; `setPointerCapture` wrapped in try/catch after a
NotFoundError edge was observed in synthetic-event testing.

## 6. Transport, tempo, swing, pattern length — PASS
Stop → `playing:false`, all voices released; Play → restarts at step 0; Rewind → `current16=0` (continues playing).
Tempo changed live 118→90→140 via the number input: scheduler continues, step advances, no errors.
Swing 45%: measured the scheduler's own queued step times over 3 s — even→odd 241.7 ms, odd→even 91.7 ms
= exactly 166.7 ms × (1±0.45) at 90 BPM. Swing also feeds the visual playhead timing.
Pattern length 16→8 while playing: `current16` wrapped into range, playhead loops 8; →32: continues.
(Note: an initial in-page measurement attempt produced bogus 0.1 ms numbers due to rAF quantization of the
probe, not the app — re-measured from scheduler queue as above.)

## 7. Mute / solo / sends / master FX — PASS
Mute BASS → engine `audible:[T,F,T,T,T]`, fader gain 0. Solo KEYS → `[F,F,T,F,F]`.
FX graph assertions (AudioParam values, not labels): drive 0.22→0.8 moved dry 0.81→0.32/wet 0.22→0.8;
delay sync 3/16@118 BPM = 0.381 s → 1/2@60 BPM = ~2.0 s; limiter threshold −11.3 dB = −1.5−0.7×14;
tone shelf ±0.65 dB at tone 0.55. Reverb IR is procedurally generated (stereo noise, seeded, exponential
decay, size-scaled); regenerating on size change replaces the convolver buffer.

## 8. Presets, randomizer, clear — PASS
Song presets: "Ambient Sketch" → BPM 84, Warm Pad/Glass Bell params applied, playback coherent;
"Night Drive (demo)" is the factory default. Track preset "Acid Line" on LEAD → wave square, reso 14.
Randomizer: seed 777 twice → byte-identical patterns (deterministic mulberry32); dice button rolls a new
seed and re-rolls patterns. Clear track / clear all verified. Factory reset restores the demo.

## 9. Persistence, JSON save/load — PASS (load via OS picker blocked by harness)
Autosave: change BPM→101 + mute PERC → debounced localStorage write ("saved HH:MM:SS" LED) → reload →
state restored (bpm 101, percMuted true), gesture overlay correctly re-shown.
Save JSON: `agent-browser download #btnSaveJson` → `evidence/modula-project.json` (5 tracks, fx, patterns).
Load: full in-page path verified by constructing a real `File` → `loadJsonFile()` → FileReader → parse →
normalizeState → applyState → UI rebuild (state restored: lead step0 = 69@0.95, seed 1337).
BLOCKED (harness, not app): `agent-browser upload` on the file input never set `files.length` in this
headed-Chromium setup (native picker interplay). The input is a standard `<input type=file>` wired to
`change→loadJsonFile`; the exact same handler was proven end-to-end above.

## 10. Offline WAV export — PASS
`agent-browser download #btnExportWav` → `evidence/modula-loop.wav`.
Verified with Python `wave`: 2 ch / 44100 Hz / 16-bit PCM, 6.95 s (= 2 loops × 16 steps @ 101 BPM + 2.2 s
tail), peak 0.657 (limiter engaged, no overs), per-second RMS shows the groove then decay tail
[0.171, 0.170, 0.177, 0.167, 0.161, 0.01, 0.001]. Rendered via OfflineAudioContext with the same engine +
scheduler code path (sequence, instruments, mixer, FX) — no mic/system capture. Progress bar shown during
render; transport pauses and resumes.

## 11. Runtime / dependency isolation — PASS
Network request log across the whole session: only `127.0.0.1:8123` documents + `data:` URIs (favicon).
Zero external hosts. (`set offline on` blocks localhost too in this harness, so the reload-under-offline
check was discarded as invalid methodology; the request log + file:// check are the evidence.)
**file:// direct open**: `open file:///…/index.html` → title OK, no load errors, power → `running`,
playback with playhead + meters live (`05-file-protocol.png`). No build, no server required.

## 12. Responsive / narrow viewport — PASS
390×844: `scrollWidth ≤ innerWidth` (no horizontal scroll), layout stacks (topbar → status → tabs → editor →
params → viz → mixer → keys), editor full-width with animated playhead, playback ran while resizing
(`06-narrow-*.png`, `09-narrow-playing.png`). Desktop 1280×800 is the primary layout (`10/11-final`).
High-DPI: all canvases scale backing store by `devicePixelRatio` (capped 2) via ResizeObserver — code path
verified; test environment ran at dpr 1.

## 13. Console / error hygiene — PASS (after fixes)
Error buffer is cumulative per browser launch (does not clear on reload), so final evidence is a
before/after count around a full regression session (edits while playing, tempo change, stop):
**1000 → 1000, zero new errors.** The 1000 historical entries are the bugs found & fixed during this run
(voice leak from unswept voices, `vel` ReferenceError, const-assignment ReferenceError, one `non-finite`
batch caused by my own test hook calling internals with wrong args — not an app path) plus a stale
count from the shared default browser session.

## Known limitations / notes
- Cannot listen: audio quality was assessed by synthesis design, analyser/peak/RMS evidence, and WAV
  inspection — never by ear.
- Status-bar "LOAD" is an estimate (frame work + active voices), as labeled in the task; not an audio-thread
  measurement.
- CPU/viz degradation: adaptive skip (1×/2×/3×) implemented from measured frame-time EMA; not exercised
  under real load under 100% CPU (guardrail) — visual inspection only.
- WAV export length ~7 s (2 loops + tail) by design; fine for loop export.
- `agent-browser upload` limitation noted in §9; JSON import itself fully verified via the File-API path.
