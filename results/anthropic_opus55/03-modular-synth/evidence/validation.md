# PULSEGRID — validation log

Artifact: `../index.html` (single self-contained file, ~170 KB; no build, no imports, no external URLs).
Browser tooling: **agent-browser 0.31.1** (installed skill `agent-browser`; read `skills get core --full` and `skills get dogfood` before use). Headless Chromium launched by agent-browser, session `synth`.
All checks below were run against the real page loaded **directly from disk** via `file:///home/pyro/projects/naked/opus55/_trial/03-modular-synth/index.html` (no HTTP server was used).

Status legend: **pass** · **fail** (then fixed + retested, noted) · **blocked** · **not-run**.

## 0. Environment notes that affect readings

- Headless Chromium runs a fake audio sink. `AudioContext.outputLatency` reported 0.11–1.1 s and fluctuating; `baseLatency` 11.6 ms. The playhead is intentionally driven by *audible* time (`getOutputTimestamp`), so in headless it trails the scheduler by that fake latency. On real hardware this is ~10–40 ms.
- `ctx.currentTime` measured against `performance.now()` over 5 s: ratio 1.00208 (audio clock ≈ real time).
- **I could not listen to audio.** Every "audio" verdict below is from analysers, offline renders, or parsed WAV data — not from hearing it.
- Real touch input is **blocked**: agent-browser's `tap` is a mouse-click alias outside its iOS provider. Touch code paths were exercised with synthetic `PointerEvent({pointerType:'touch'})` and are labelled as such.
- Machine load average was ~17–20 on 32 cores (other workloads) during testing.

## 1. Load, direct-file open, network

| Check | How | Result |
|---|---|---|
| Opens directly from `file://` | `agent-browser open file://…/index.html`; `errors`, `console` | **pass** — no page errors, no console errors/warnings |
| No external fetches | `agent-browser network requests` | **pass** — only `file://…/index.html` (Document) and `blob:null/…` (the inline scheduler Worker). Source grep for `http(s)://`, `import`, `fetch(`, `url(` → none |
| Static syntax | extracted `<script>` → `node --check` | **pass** |

## 2. Audio start (user gesture) and main loop

| Check | How | Result |
|---|---|---|
| Gate explains the gesture requirement | screenshot `01-gate-1280.png` | **pass** |
| Real click enables audio + plays demo | `find role button click --name "Enable audio & play"` then eval | **pass** — `ctx.state: running`, 44.1 kHz, `playing: true`, Worker timer, 0 late events |
| Play button also works as the gesture | `find role button click --name "Play"` on a fresh page | **pass** |
| Playhead animates, meters move from real audio | eval of `ui.ph`, per-track analyser meters, master analyser `outDb` over time; screenshot `03-playing-1280.png` | **pass** — step 10→15 in 0.7 s, meters e.g. `[0.93,0.19,0.43,…]`, out −2.2 dBFS |
| Scope/spectrum/spectrogram/phase driven by master output | screenshots `03`, `10`, `18-desktop-1920x1080.png` | **pass** |
| Suspended context → Resume | `ctx.suspend()` (simulating a browser interruption), click **Resume** | **pass** — status shows `suspended`, Resume button appears, click → `running`, playback continues, 0 late. *Bug found*: drift jumped to −455 ms after resume → **fixed** (re-baseline on `statechange`), retest −2.5 ms |

## 3. Sequencer editing during playback

| Check | How | Result |
|---|---|---|
| Toggle steps while playing | `click '.trow[data-t="0"] .step[data-s="2"]'` (+ step 11) during playback; engine per-track trigger counter over one full loop (4.29 s) | **pass** — kick 9 → 11 hits/loop, `aria-pressed` false→true |
| Mute | `find role button click --name "Mute Kick" --exact` | **pass** — kick meter 0.93 → 0, triggers frozen, `audible[0]=false` |
| Solo | "Solo Bass" | **pass** — all other meters → 0; un-solo restores |
| Pattern length change while playing | `select #len 12` | **pass** — scheduled positions `…10,11,0,1…`, grid shows 12 steps |
| Tempo change while playing | `fill #bpm 140` | **pass** — step 0.1339 s → 0.1071 s with one transitional interval, no gap/burst (`logs/tempo-change-steps.json`) |
| Swing | focus `[aria-label="Swing"]`, `press End` | **pass** — at 75 % offbeat gaps are exactly 1.5 / 0.5 steps (`logs/swing-steps.json`); `Home`/`PageUp` → 55 % |
| Stop | click Stop | **pass** — queue 0, future voices 0, playhead cleared, tails decay to 0 voices in 1.5 s |
| Pause / resume | Pause then Play | **pass** — resumes at the next unplayed step (8) |
| Restart | click Restart while playing | **pass** — already-scheduled step 30 killed, playback re-enters at step 0 |

## 4. Live playing and stuck-note prevention

| Check | How | Result |
|---|---|---|
| Computer keyboard chord | `keydown z/c/b`, `keyup …` | **pass** — 3 sustaining voices (48/52/55), release → 0 voices after 1.2 s pad release. *Bug found*: agent-browser's `keydown` sends an empty `e.code`, so nothing played → **fixed** with an `e.key` fallback (also covers virtual/IME keyboards), retest pass |
| Focus loss while holding keys | hold x+v, `tab new about:blank`, `tab t1` | **pass** — both notes released on `visibilitychange` |
| Rapid repeated input | 46 `press` events in ≈213 ms | **pass** — 46 note-on / 46 note-off, 0 sustaining, 0 voices after tail |
| Duplicate keydown without keyup | `keydown g` ×3, `keyup g` | **pass** — one voice, released by the single keyup |
| Pointer glissando + release outside keyboard | `mouse down` on C3, move across keys to G3, move to page, `mouse up` | **pass** — retriggers per key, released outside |
| `pointercancel` mid-hold | synthetic `PointerEvent('pointercancel')` (CDP cannot produce a real one) | **pass** — note released |
| Drum pads | click Kick/Snare/Hats/Perc pads; synthetic touch `pointerdown` on Kick pad | **pass** — each pad triggers its voice; velocity from tap position |
| Scale lock | A minor; press S (C#) and G (F#) with lock off/on | **pass** — 49/54 → 50/55 (D, G) |
| Octave | Octave-up button + `]`, then `z` | **pass** — octave 5, `z` plays MIDI 72, key labels follow |

## 5. Piano roll

| Check | How | Result |
|---|---|---|
| Create + drag-lengthen | mouse down on empty A5/step 5, drag to step 8 | **pass** — note `[4,81,len 4]`, row shows ties |
| Move | drag note body +2 semitones, +2 steps | **pass** — `[6,83,len 4]` |
| Delete | click without drag | **pass** |
| Keyboard-only editing | focus canvas; Enter, →→, ↑↑, Enter, Shift+→ ×2, Delete, Enter | **pass** — `[[0,69,1],[2,71,3]]` → delete → re-add |
| Velocity lane | mouse drag down in lane at step 3 | **pass** — velocity 0.149, step shown dimmed |

## 6. Synthesis and effects alter the real audio

Live checks read the master `AnalyserNode` for 1.2 s (`scripts/meas.js`); offline checks use `PG.renderOffline`, the same Engine code path as export (`scripts/*.js`).

| Check | Result |
|---|---|
| Bass cutoff via knob keyboard (`End`) and mouse drag (live) | **pass** — spectral centroid 93 Hz → 152 Hz → 39 Hz |
| Master Tone filter fully LP / HP (live) | **pass** — centroid 50 Hz / 12,996 Hz (share >3 kHz 0 → 0.998) |
| Drive 100 % / mix 100 % (live) | **pass** — centroid 85 → 130 Hz, >3 kHz share ×3 |
| Reverb / delay returns (offline, dry-vs-wet difference) | **pass** — reverb wet −37.3 dB vs dry −35.4 dB at full send, decorrelated (corr 0.02); ping-pong delay wet corr −0.1 |
| LFO → cutoff / amp / pan / pitch (offline, `scripts/lfo.js`, `lfo2.js`) | **pass** — brightness SD 0.012 → 0.073; level SD 1.5 → 9.1 dB; L/R balance SD 0.15 → 13.3 dB; sine A4 440 Hz → 400–480 Hz |
| Tuning | **pass** — A4 renders at 440 Hz (zero-crossing) |
| Metronome | **pass** — with all tracks muted: −108 dBFS → −19 dBFS clicks when enabled (gain then raised +6 dB) |

**Gain staging (found and fixed during testing).** First solo measurements with master dynamics bypassed (`scripts/solo_raw.js`) showed the kick at −14 dB RMS while bass/keys/lead/hats sat at −36…−42 dB (≈20 dB imbalance hidden by the compressor), stereo correlation 0.999, and ~9 dB of gain reduction. Fixes: voice gain re-staging, kick level applied after its drive shaper, clap burst peaks lowered, bus headroom (0.8 → 0.5), stereo spread for polyphonic voices, reverb return ×2, gentler song compressor settings. Final raw levels: kick −20, bass −26, keys −29.5, lead −30, snare −31.5 (peaks −4), hats −33, perc −38 dB RMS; full chain −11 dBFS RMS / −1.4 dBFS peak, corr 0.92, GR ≈ 3 dB. All five song presets render finite audio peaking −1.4…−2.0 dBFS (`scripts/songs.js`).

## 7. Presets, randomisation, clearing

| Check | Result |
|---|---|
| Track preset (Bass → Acid 303) | **pass** — params, knob (`Reso 15.0`), row label update |
| Song preset load (UI select + Load) | **pass** — full project replaced, Undo toast |
| Seeded generation determinism | **pass** — seed 4242 twice → identical hash; 4243 differs; back to 4242 reproduces. *Improved*: first generator rolled every step independently (clustered kicks); replaced with a bar grammar (anchored kick/backbeat, per-seed hat style, fill) — `12-generated-v2-seed4242.png` |
| Clear track / clear all | **pass** (with Undo) |

## 8. Save / load / persistence / export

| Check | How | Result |
|---|---|---|
| Save JSON | `agent-browser download "#btnSave" artifacts/saved-project.json` | **pass** — valid project JSON, bpm 97 captured |
| Load JSON | `upload "#fileIn" <abs path>` with a modified file | **pass** — name/bpm/steps/notes applied, UI synced, cutoff 999999 clamped to 16000. (First attempt with *relative* upload paths failed with `NotReadableError` — tool path issue; the app showed the error toast correctly.) |
| Invalid JSON / non-project JSON | `artifacts/broken.json`, `not-a-project.json` | **pass** — error toasts "not valid JSON" / "Missing tracks array", project unchanged |
| localStorage autosave + restore | edit bpm/step/selection, reload | **pass** — all restored, gate reappears, "Restored" toast |
| WAV export | `download "#btnWav" artifacts/export-imported-test.wav`, parsed with Python `wave` | **pass** — RIFF PCM 16-bit, 2 ch, 44.1 kHz, 10.138 s = 2 loops (7.218 s) + 2.92 s reverb tail, peak −1.64 dBFS |
| Export reflects mixer | same export with Kick muted | **pass** — RMS −8.56 → −12.58 dB |

Note: each `DynamicsCompressorNode` has a ~6 ms internal look-ahead, so the master chain delays the whole output by ~12 ms (visible in the exported envelope). It is a constant offset for every track, so timing stays coherent.

## 9. Viewports, status, stability

| Check | Result |
|---|---|
| 1280×800, 1440×900, 1920×1080 | **pass** — no horizontal overflow. *Bug found*: empty band between sequencer and editor (side column height distributed into grid row 1) → **fixed** with `grid-template-rows: auto 1fr` |
| 390×844 | **pass** after fixes — *bug found*: document 490 px wide (side column `align-items:start` leaking into phone flex layout) → **fixed**; track names truncated → **fixed**. Grid scrolls horizontally with sticky track heads; mouse clicks toggle steps; synthetic touch tap toggles and a cancelled touch (scroll) does not |
| Status area | **pass** — context state, tempo/swing, step, look-ahead + timer + margin, voices, main-thread load + fps + viz level (+ DSP load when `renderCapacity` exists — not exposed in this Chromium), output dB meter, clip latch, drift (ms, ppm after 5 s), jitter, late count, latency. *Bug found*: drift mixed two clock-pairing methods → **fixed** |
| High-DPI | **pass** — `set viewport 1280 800 2`: canvases allocate 2× backing stores (scope 414 px for 207 CSS px, piano roll 1528 for 764); `19-hidpi-dpr2.png` |
| Viz quality Auto/High/Low/Off | **pass** |
| Undo after Clear all | **pass** — 79 events → 0 → 79 via the toast's Undo button |
| 60 s soak | **pass** — voices 6–20, queue ≤10, 0 late, 0 resyncs, heap flat 9.5 MB |

## 10. Independent code review → fixes → retests

A read-only reviewer subagent audited `index.html` for correctness bugs. All 8 findings were verified against the code and fixed:

| # | Finding (severity) | Fix | Retest |
|---|---|---|---|
| 1 | `"scale":"__proto__"` in imported JSON passed validation (`SCALES[k]` truthy via prototype), crashed rendering, was autosaved and bricked later boots (high) | own-property checks for scales/presets/key maps; `setProject` rolls back on render failure; boot falls back to the demo if the saved session cannot render | **pass** — `artifacts/proto-scale.json` loads with scale → `minor`, reload OK |
| 2 | Mono (poly=1) live notes: fallback voice created in `liveNoteOff` was not tracked → stuck note (high) | holders re-pointed to the new voice; auditions use their own flag; transport stop/restart no longer releases notes the user is holding | **pass** — hold A, hold B, start playback (sequencer steals), release B then A → 0 live voices |
| 3 | `slide()` wiped the filter envelope when filter attack > amp attack (medium) | `unrelease()` cancels only the release (rebuilding attack/decay when needed) | **pass** — `scripts/env-automation-test.js`: rendered automation vs analytic model max error 0 (1e‑4 precision) in 4 envelope scenarios; negative control with the old code: error 1.0 (`scripts/env-negative-control.js`) |
| 4 | `slide()` snapped pitch back while an earlier glide was still running (medium) | re-end the running glide with an exponential ramp to its current value | **pass** — glide re-anchor error 0 Hz (old code: 81 Hz) |
| 5 | Notes extending past a shortened pattern played beyond the loop (low–medium) | note length clipped to the pattern end at schedule time | **pass** — 12-step note at step 12 of 16 → scheduled 0.607 s (4 steps = 0.619 s minus gap) |
| 6 | Future slides on already-sounding voices could jump pitch during stop/restart release tails (low) | voices with a pending slide get a 12 ms fade instead | covered by stop/restart regression |
| 7 | Piano-roll keyboard cursor not clamped after pattern shrink (low) | clamp in `layout()` | code fix |
| 8 | Offline render's 110-voice guard "stole" finished voices, slowing export (low) | guard applies to realtime only | export regression **pass** |

Also added: the scheduler catches exceptions per step so playback can never stall on bad data.

**Final compact regression (fresh browser profile, `file://`)**: play via gesture → playhead/meters move, 0 late; perc step toggled during playback; keyboard note; Hats muted (meter 0.00); tempo 118; WAV export 11.056 s (2 × 4.068 s + tail, peak −1.56 dBFS) parsed as 2 ch / 44.1 kHz / 16‑bit; JSON saved; Stop → 0 voices; 390 px width → no overflow; `agent-browser errors` / `console` empty. Screenshots `30-final-regression-1280.png`, `31-final-regression-390.png`.

## 11. Remaining limitations

- Audio quality was verified numerically only; nobody listened to it in this run.
- Real multi-touch hardware not tested (synthetic pointer events only).
- The DSP load figure depends on `AudioContext.renderCapacity`, unavailable here; the status shows main-thread load and fps instead.
- Headless output-latency numbers are not representative of real devices.
