# NEBULA-7 — validation record

Artifact: `../index.html` (single self-contained file, 156,927 bytes, 3,055 lines,
sha256 prefix `48dca19e7bfafc7e`).

Tooling: **agent-browser 0.31.1** (Chrome/Chromium via CDP, headless), driven from bash.
Skill `agent-browser` + its version-matched `skills get core` workflow were loaded before use.
All checks were run against `file:///home/pyro/projects/naked/opus5/03-modular-synth/index.html`
— **no local HTTP server was used at any point**, so the direct-file requirement is exercised
by every check below, not merely inspected.

Diagnostics were read from the app's own live state surface `window.__synth.diag()` (AudioContext
clock, analyser peak/RMS, per-track analyser meters, voice counts, scheduler headroom/jitter/late
counters) plus independent measurements taken directly from the master `AnalyserNode` inside the
page, and from the exported `.wav`/`.json` files on disk. Screenshots are in `shots/`, downloaded
artifacts in `artifacts/`.

---

## 0. Environment note (real failure found and worked around)

**Symptom:** on first run the AudioContext reported `state:"running"` but `currentTime` stayed at
`0` forever and `outputLatency` was `0` — no audio rendering at all.

**Diagnosis:** bisected by building a bare `AudioContext` + oscillator inside the same page (still
stuck at t=0), then re-running the same minimal probe in a *fresh browser instance* (clock advanced
normally, RMS 0.097). The stall is **per browser instance**, not per page and not caused by the
app's graph: this WSL2 host exposes a single non-mixing audio sink, and once a browser instance's
audio service is wedged by an earlier context, every later context in that instance silently fails
to render.

**Consequence for testing:** each audio-critical run starts with `agent-browser close --all` and a
fresh session. This is an environment property, not an application defect — the app creates exactly
one `AudioContext`, and it renders correctly in every fresh instance.

---

## 1. Audio enable via a real user gesture — PASS

| step | command | observed |
|---|---|---|
| load | `open file:///…/index.html` | title `NEBULA-7 · Modular Synthesizer & Sequencer`, gate overlay present, `window.__synth.state.tracks.length === 7` |
| gesture | `find text "ENABLE AUDIO" click` (trusted CDP input) | gate hides, badge → `AUDIO LIVE` |
| +1.5 s | `__synth.diag()` | `ctxState:"running"`, `currentTime:1.5702`, `sampleRate:44100`, `playing:true`, `step:10/16` |
| +6 s | `__synth.diag()` | `currentTime:6.072`, `stepCounter:46`, `voices:15`, `outPeakDb:-5.36`, `clip:false`, `late:0`, `jitterMs:2.18`, `loadPct:3.4` |

The clock, the step counter, the analyser peak and all seven per-track analyser meters change over
time (`trackRms` non-zero on every track across samples). Screenshot: `shots/01-gate-1280.png`,
`shots/07-final-lead-1280.png`.

## 2. Every track actually makes sound — PASS

Soloed each track in turn and measured the master analyser for one full bar (in-page loop over
`AnalyserNode.getFloatTimeDomainData`):

| track | peak | max RMS |
|---|---|---|
| LEAD | 0.2282 | 0.0742 |
| BASS | 0.4316 | 0.1317 |
| PAD | 0.1169 | 0.0384 |
| KICK | 0.5977 | 0.2890 |
| SNARE | 0.3542 | 0.0835 |
| HAT | 0.0987 | 0.0224 |
| PERC | 0.0651 | 0.0141 |
| ALL | 0.5657 | 0.2934 |

**Fix applied from this measurement:** the first hi-hat implementation used the classic 40 Hz
oscillator-bank fundamental, whose partials sit two octaves below the 8.2 kHz band-pass, leaving
almost no energy. Rebuilt on a 318 Hz fundamental plus a noise layer cross-faded by the `Metal`
control; HAT/PERC mixer levels raised (0.50→0.64, 0.55→0.70).

## 3. Scheduler timing: tempo, swing, pattern length — PASS

The transport keeps a ring buffer of the **actually scheduled** AudioContext times. Deltas between
consecutive scheduled steps, vs. the analytic expectation `stepDur ± swing·0.5·stepDur`:

| setting | expected even→odd / odd→even | measured (16 consecutive steps) |
|---|---|---|
| 112 BPM, swing 14 % | 143.30 / 124.55 ms | `143.30, 124.55, 143.30, 124.55, …` |
| 112 BPM, swing 38 % | 159.38 / 108.48 ms | `108.48, 159.37, 108.48, 159.37, …` |
| 130 BPM, swing 38 % | 137.31 / 93.46 ms | `137.31, 93.46, 137.31, 93.46, …` |

Exact to ±0.01 ms, with `late: 0` throughout. Tempo and swing were changed **while playing** and
took effect on the next scheduled step with no dropout.

Pattern length changed live (`#steps` focused, arrow keys): 16 → 24 → 12 while playing.
Result: `steps:24 step:13 late:0 playing:true`, then `steps:12 step:6 late:0`, audio continuous,
grid and ruler rebuilt to the new length.

Look-ahead scheduling is a self-rescheduling `setTimeout` loop (25 ms tick, 120 ms schedule-ahead)
driven entirely off `AudioContext.currentTime`; the animation frame only *consumes* a queue of
`{step, time}` pairs to move the playhead, so the visuals follow the audio clock, never the reverse.
When the tab is hidden the schedule-ahead widens to 1300 ms to survive timer throttling
(verified: `lookAheadMs` 120 → 1300 → 120, §7).

## 4. Live pattern editing during playback — PASS

- Drum grid, clicks on `[data-ti="3"][data-s="N"]` while playing: kick `1000100010001001` →
  `0010101010001001` (step 0 off, steps 2 and 6 on), `noteCounts[3]` 5 → 6, audio uninterrupted.
- Hi-hat tri-state cycle verified: `hat[1]` 0 → 1 (closed) → 2 (open).
- Piano roll, pointer only (`mouse move`/`down`/`up`):
  - drag on empty grid → new note `{s:6, p:69 (A4), l:3}`, DOM note count 10 → 11;
  - drag the note body → `{s:7, p:72 (C5), l:3}` (moved 1 step right, 3 semitones up, snapped to the
    A-minor scale by Scale Lock);
  - right-click on the note → deleted, 11 → 10 in both state and DOM.
- Velocity: drum cells carry per-step velocity (vertical drag) plus a dedicated VEL lane; every VEL
  cell is exposed as a labelled `role="slider"` in the accessibility tree with a live `aria-valuenow`.

## 5. Playing notes: pointer, keyboard, pads — PASS

| check | observed |
|---|---|
| pointer down on on-screen C4 | `live:1` |
| glissando (move to G4 while held) | still `live:1`, pitch follows the pointer |
| pointer up | `live:0` |
| press-and-drag off the keyboard, release outside | `live:0` — no stuck note |
| computer keys `f h k` (A-minor, octave 4, Scale Lock on) | note history gains 3 entries: **F5, C6, F6** — the correct scale degrees |
| octave up (`x`) then `f` | `octave:5`, note **F6** |
| number keys / pad taps | pads fire the matching drum voice |
| 24 rapid keypresses across 3 keys | `live:0` afterwards, lead voice list back to its sequencer steady state — no leak |

## 6. Stuck-note prevention under adverse events — PASS

Dispatched with `pointerType:"touch"` to exercise the touch path:

| event | before | after |
|---|---|---|
| `pointercancel` on a held key | `live:1`, 1 key lit | `live:0`, 0 lit |
| `window` `blur` while holding | `live:1` | `live:0`, 0 lit |
| `visibilitychange` → hidden | `live:1` | `live:0`, look-ahead 120 → 1300 ms |
| back to visible | — | look-ahead 1300 → 120 ms |

HOLD (latch) then PANIC: 3 latched voices → `live:0, latched:0, litKeys:0`.
A 3-second sweeper also releases any live note older than 30 s as a last resort.

## 7. Transport: stop / restart / metronome — PASS

- **Stop**: `playing:false`, `step:-1`, playhead cleared, output decays to tails only (peak 0.041).
- **Restart**: `playing:true` from step 0 (`stepCounter:5` two steps later), peak back to 0.388.
- **Metronome** toggles `state.metro` with matching `aria-pressed`; it is routed post-FX to the
  master gain and is deliberately excluded from the offline render.
- Master volume slider to minimum → `master:0`, `outPeak:0`, readout `-∞`.

## 8. Synthesis controls change the actual audio — PASS

Spectral bands measured from the master analyser (peak-hold over 2.4 s), LEAD soloed:

| LEAD filter state | 60–400 Hz | 400–2 k | **4–12 kHz** |
|---|---|---|---|
| cutoff 18 kHz | 79.8 | 158.7 | **85.6** |
| cutoff 30 Hz (filter envelope still open) | 97.3 | 171.7 | **61.6** |
| cutoff 30 Hz + env amount 0 | 123.9 | 158.3 | **18.8** |

High-frequency energy collapses as the cutoff and the filter-envelope amount are reduced — and the
middle row correctly shows that the envelope still opens the filter when only the base cutoff is
lowered, which is the expected synth behaviour.

Track presets: selecting **Acid 303** applied `poly:1 (mono), Q:16.0, glide:55 ms` to both the state
and the UI readouts. `RAND PATCH` mutated deterministically to `Bell FM-ish` with derived
cutoff/LFO values.

## 9. Master effects change the actual audio graph — PASS

Mean master RMS over 2.6 s, PERC soloed (sparse source so tails are visible):

| state | mean RMS | peak |
|---|---|---|
| delay ON | 0.00392 | 0.1055 |
| delay OFF | 0.00338 | 0.1070 |
| delay ON again | 0.00391 | 0.1067 |
| reverb OFF | 0.00346 | 0.1065 |
| reverb ON | 0.00409 | 0.1077 |

Delay contributes ≈ +16 % and reverb ≈ +18 % sustained energy, reproducibly, with peak unchanged
(tails, not level).

**Limiter** (full mix): ceiling −0.6 dB → peak 0.5999 / mean RMS 0.1254; ceiling −12 dB → peak
**0.4296** with mean RMS **rising** to 0.1463; back to 0 dB → peak 0.5737. Peaks squashed, density
up — the signature of real limiting.

**Saturation**: mix 0 % → bands `low 233.0 / mid 179.4 / hi 129.9`; mix 100 %, drive 12× →
`low 248.6 / mid 215.7 / hi 166.2`. Added harmonics, as expected.

## 10. Project state: JSON export/import, localStorage — PASS

- `EXPORT .JSON` (plain click, page survives — verified `location.href` unchanged and
  `playing:true` afterwards) → `artifacts/project.json`, 10,795 bytes.
  Keys: `app, bpm, fx, key, master, metro, name, octave, playing, scale, scaleLock, seed, steps,
  swing, tracks, v`; 7 tracks with the edited contents (`lead 10, bass 6, pad 6, kick 6, snare 2,
  hat 16, perc 4`); `fx` carries `comp, delay, reverb, sat, tone`.
- Mutated state (loaded **VOID GARDEN**: 68 BPM, 32 steps, Lydian), then `CLEAR ALL`
  (`noteCounts` all zero), then imported the file back via the real file input:
  restored `NEON DRIFT, bpm 130, swing 38, steps 16, noteCounts [10,6,6,6,2,16,4]`, playback
  continued, `outPeak 0.406`.
- `SAVE → BROWSER` wrote 5,344 bytes to `localStorage["nebula7.project.v2"]`; after `CLEAR ALL`,
  `LOAD ← BROWSER` restored the patterns; after a **full page reload** the state came back
  automatically (`hint: "restored from browser storage"`, bpm 130, swing 38).

## 11. Offline WAV render — PASS

`RENDER LOOP TO WAV (offline)` builds the identical graph inside an `OfflineAudioContext` from a
snapshot of the project and encodes 16-bit stereo PCM in-page. Render of the full mix
(2 loops, 44.1 kHz, 2 s tail) completed in < 1 s.

`artifacts/loop.wav` — 2 ch / 16 bit / 44100 Hz / 266,466 frames / **6.042 s**
(expected `32 × 0.11538 + 2 + 0.35 = 6.042 s` — exact).
Peak −4.19 dBFS, RMS −17.79 dBFS, mean |L−R| = 0.016 (genuinely stereo), first 50 ms silent as
designed (scheduling starts at t = 0.06 s).

**Strict correctness test** — KICK soloed, 1 loop, no tail, kick pattern `1000100010001001`
(hits on steps 0, 4, 8, 12, 15), 112 BPM, swing 14 %:

`artifacts/kick-solo.wav` — duration **2.4929 s**, exactly `16 × 0.13393 + 0.35`.
Onset detection (2 ms windows, 18 % threshold) put a transient within **9–12 ms** of every expected
step time, with only ~1 ms spread across the five hits — the constant offset is the
`DynamicsCompressor` look-ahead plus the kick's own attack ramp:

```
step-time 0.0600 -> onset 0.0718  Δ 11.8 ms
step-time 0.5957 -> onset 0.6066  Δ 10.9 ms
step-time 1.1314 -> onset 1.1434  Δ 12.0 ms
step-time 1.6671 -> onset 1.6782  Δ 11.1 ms
step-time 2.0783 -> onset 2.0873  Δ  9.0 ms
```

A smoothed-envelope pass on the same file found **additional** onsets exactly one dotted-eighth
(3 steps) after each kick — i.e. at steps 3, 7 and 11. Those are the tempo-synced `1/8.` delay
repeats. So the render provably reflects the **sequence**, the **soloed mixer state**, and the
**master effects**, and is not a recording of anything.

## 12. Seeded randomisation is deterministic — PASS

`GENERATE` with seed 1234 → `bpm 149, swing 7, steps 16, key F#, Mixolydian`,
patches `[Bell FM-ish, Pluck, Init Saw, Soft Thud, Noise Burst, Tight 909, Cowbell]`,
609-character pattern fingerprint.
Seed 999 → a completely different song (`bpm 93, Dorian, …`, 680-char fingerprint).
Seed 1234 again → **byte-identical** to the first run (patterns, velocities, note pitches/lengths,
tempo, key, scale and patch selection all match). Playback continued across every regeneration.

## 13. Visualisations are driven by real output — PASS

Pixel sampling of each canvas' backing store (`getImageData`), full mix playing:

| canvas | lit pixels (of ~7050 samples) | mean luminance |
|---|---|---|
| Oscilloscope | 4547 | 97.4 |
| Spectrum | 3612 | 76.7 |
| Aux — stereo phase | 290 | 11.6 |
| Aux — spectrogram | 4097 | 66.0 |
| Aux — note history | 897 | 21.3 |
| Quality = **Off** | 0 / 0 / 0 | 0 |
| Quality = **Low** | 5032 / 3689 / 295 | still rendering |

All three modes of the third visualiser draw. `Quality: Off` clears them; `Low` halves the frame
rate and thins the phase-scope sampling; an automatic downgrade to Low fires if the frame EMA
exceeds 26 ms while load is above 45 %.

## 14. Viewports, high-DPI, touch

- **1280 × 800** (`shots/07-final-lead-1280.png`, `shots/08-final-drums-1280.png`) — two-column
  layout, everything reachable, status bar on one row.
- **1440 × 900** — same, wider sequencer.
- **390 × 844** (`shots/05-mobile-390-top.png`, `shots/06-mobile-390-full.png`) — single column,
  `document.scrollWidth === window.innerWidth === 390`, **no horizontal page overflow**; the step
  grid scrolls inside its own container (`--cw` drops to 15 px); playback and audio unaffected
  (`peak 0.408`, `ctxState running`).
  **Fix applied:** a leftover `@media (max-width:430px)` rule from an earlier vertical-mixer design
  was forcing 52 px-tall meters and single-column send sliders, making each mixer strip ~5× too
  tall. Replaced with a narrow-width rule that keeps the three send sliders in a row.
- **High-DPI**: emulated iPhone 16 (`devicePixelRatio: 3`) → canvas backing stores `897 × 260` for
  359 CSS px, i.e. the DPR-2.5 clamp applied correctly; audio and all interactions still worked
  (tapping a step toggled `kick[1]`, a pad fired, an on-screen key played **D4**).
- **Touch events — BLOCKED (tooling).** agent-browser's device emulation sets user-agent and DPR but
  not touch input (`ontouchstart:false`, `maxTouchPoints:0`), so genuine `touchstart`/`touchmove`
  could not be generated. Mitigation: all input handlers are Pointer Events with
  `touch-action:none`, and the touch-specific hazard (`pointercancel`) was exercised directly with
  `pointerType:"touch"` events (§6). Real multi-touch chording on a physical device remains untested.

## 15. Self-containment and console hygiene — PASS

- `grep -cEio 'https?://|<script src|<link|@import|fetch\(|XMLHttpRequest' index.html` → **0**.
  No external scripts, stylesheets, fonts, images, audio files, workers or network calls.
- Network log for a complete session (load, enable, play, edit, render, export):
  **two entries, both `GET file:///…/index.html (Document) 200`** — the initial load and one reload.
  Nothing else was ever requested.
- `agent-browser console` and `agent-browser errors`: **empty** across every run.

---

## Fixes made during validation

1. **Hi-hat inaudible** — oscillator bank fundamental raised 40 Hz → 318 Hz and a `Metal`-controlled
   noise layer added, so energy actually reaches the 8 kHz band-pass (§2).
2. **Voice counter always 0** — sequenced voices were spliced out of the per-track list the instant
   their release was *scheduled*, so the polyphony cap never engaged and the status read 0. Voices
   now leave the list in `onended`; stealing prefers already-released voices.
3. **LFO disconnect clobbered other voices** — `lfoGain.disconnect()` with no argument tore down the
   modulation routing for every sounding voice on that track. Now disconnects only the specific
   `AudioParam` targets it connected.
4. **Meter colour ramp compressed** — the gradient lived on the width-limited fill element, so the
   ramp rescaled with the level. Moved to the track, with the fill acting as a mask.
5. **Track LEDs lit early** — `trackHits` stores a *future* AudioContext time; the comparison now
   requires the time to have arrived.
6. **Stale playhead classes** — `.cur` left behind in the hidden view when switching drum ↔ roll.
7. **Key highlight targeted one element** — `markKeyDown` used `querySelector`, so it lit a hidden
   piano-roll key instead of the on-screen keyboard. Now `querySelectorAll`.
8. **Narrow-viewport mixer** — stale media query (§14).
9. **Layout imbalance** — the mixer was moved into the left column; previously the right column ran
   ~1800 px past the end of the left one.
10. **Truncated status readouts** at narrow widths — `LOOK-AHEAD`, `LOAD`, `TEMPO`, `ENGINE` shortened.
11. **FX enable buttons unlabelled** — five identical `ON` buttons in the accessibility tree; each
    now has an id and an `aria-label` ("Delay enable", "Reverb enable", …).

## Known limitations

- **Touch-event emulation blocked** (§14) — pointer paths incl. `pointercancel` are covered; real
  multi-touch is not.
- **Audio was measured, not listened to.** Every claim about sound here comes from analyser
  data, spectral band energy and offline-rendered PCM. No subjective judgement of audio *quality* is
  being asserted.
- **Host audio-service quirk** (§0) requires a fresh browser instance per audio run in this
  environment; unrelated to the artifact.
- `agent-browser download <sel> <path>` leaves the tab on `about:blank` after capturing the file.
  Verified this is a tool artifact: a plain `click` on the same button downloads and leaves the page
  running normally. Download-based checks were therefore always run last in a session.
- Randomised **patterns** are exactly reproducible from the seed; randomised **synth patches** merge
  preset fragments onto the current parameter set, so a field a preset does not mention keeps its
  prior value. Patch *selection* is deterministic; the resulting parameter set is only fully
  deterministic from a freshly loaded song.
- Per-track pattern length (polyrhythm) is not implemented — pattern length is global, 1–64 steps.
