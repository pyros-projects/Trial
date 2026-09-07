# Phase workstation — agent-authored validation

**Delivered:** [index.html](../index.html), one self-contained 110,416-byte HTML file. Six configurable tracks, two polyphonic synths, four procedural percussion voices, step sequencer, piano roll, performance keyboard/pads, mixer, five real master effects, three audio visualizations, JSON/local persistence, and offline stereo WAV export.

**Result:** All final application checks below passed. Earlier failures were reproduced, fixed, and retested. No known application failure remains from these checks. Physical listening and other browser engines were not tested; signal measurements do not establish subjective sound quality. This is an agent-authored validation record, not an evaluator report or score.

Artifact SHA-256: `662ce16a2b3904d9178b817a78503fdfda3e4c33b735a02b4241d2aba55ba4e5`.

## Environment and method

- Validation date: 2026-09-07. Linux Chromium 143, **agent-browser 0.31.1**, session `phase-synth`.
- Read installed `/home/pyro/.agents/skills/agent-browser/SKILL.md`, then the installed version's `agent-browser skills get core`, `core --full`, `dogfood`, and `dogfood --full` workflows. The requested capability was available and used throughout.
- Main driver: agent-browser navigation, role/name locators, native selects, pointer dragging, keydown/up, upload, tabs, screenshots, and JavaScript reads of actual state/audio. Supplemental CDP uses the **same browser** for Shift-click, touchStart/touchCancel, download paths, cache clearing and network failure events. It is not a substitute browser.
- Opened `file:///home/pyro/projects/naked/astra/bench/03-modular-synth/index.html` directly. No HTTP server was needed. External `http*` requests were aborted and browser offline mode enabled before loading the artifact.
- Final direct-file check cleared browser cache and disabled it, with internet still blocked. The only new requests were the HTML file and its generated Blob scheduler worker. No failed requests, console messages, or uncaught exceptions occurred. [Cache/network result](logs/clean-cache.json), [protocol events](logs/clean-cache-events.json), [artifact dependency audit](logs/artifact-audit.json).
- Live audio was enabled by a real click. Default-device startup and real signal passed initially and in the final uncached check. During development, intermittent host output failures required Chromium's silent output sink for repeatable automation. Test scripts inject that native AudioContext option before clicking Enable; the artifact contains no sink override or test dependencies. See the environment note below.

## Final coverage

| Check | Status | Actual exercise and evidence |
| --- | --- | --- |
| Single-file/direct-file/offline runtime | **PASS** | Uncached `file:` navigation, real Enable/Play, external internet blocked, no external assets or network API dependencies. [Command/result](logs/clean-cache.log), [audit](logs/artifact-audit.json). |
| Desktop main workflow, 1280×800 | **PASS — 15 checks** | Start and sample real audio; live step toggle/accent/pitch/velocity/gate; piano chords; both synths; mixer; mute/solo signal; tempo/swing/length; transport; keyboard/pointer; percussion; randomize/clear/undo; presets; effects. [Final log](logs/desktop-workflow-final3.log), [structured observations](logs/desktop-workflow.json). |
| Narrow viewport, 390×844 | **PASS — 8 checks** | Actual playback/editing, 32-step horizontal navigation, piano/mixer/instrument controls, touch onset and cancellation, effects, dialogs, Space/octave/tab keys. Also 1280×800 at DPR 2. [Final log](logs/mobile-workflow-final.log), [observations](logs/mobile-workflow.json), [touch diagnostics](logs/touch-cancel.log). |
| Final responsive bounds | **PASS** | No document overflow at 1280×800, 768×1024, or 390×844. Instrument controls fit inside their panels; corrected mobile layout visually inspected. [Runtime observations](logs/final-runtime.json), [mobile screenshot](screenshots/mobile-instrument-final.png). |
| JSON save, load, persistence, errors | **PASS** | Downloaded actual JSON and compared complete state; reloaded page; replaced song and uploaded download; rejected malformed JSON and volume 99 without mutating project. Waits verify the specific completed import error. [Final log](logs/project-export-final2.log), [observations](logs/project-export.json), [invalid-value screenshot](screenshots/invalid-value-error.png). |
| Offline WAV and real effects | **PASS** | Downloaded and parsed stereo PCM, compared repeat renders, changed each effect individually and rendered it, changed instrument/mixer, verified master-zero silence. Ten project/export checks total. [Final log](logs/project-export-final2.log), [sample statistics](logs/project-export.json). |
| WAV tail edge cases | **PASS — 2 checks** | Actual downloaded WAV at 40 BPM retains first echo with feedback 0; long gate/release plus 5-second reverb fits. [Log](logs/export-tails-green.log), [observations/download paths](logs/export-tails.json). |
| Voice/envelope/phase/import regressions | **PASS — 6 checks** | Native OfflineAudioContext voice limits, early release envelope comparison, future-note cancellation; genuine import controls; real pause/resume scheduling; mobile bounds. [Final log](logs/review-regressions-final.log), [observations](logs/review-regressions.json). |
| Audio startup failure and retry | **PASS** | A real native context with a test-controlled unresolved resume reports an error, closes safely, then succeeds after restoring native resume and clicking Enable again. [Runtime result](logs/final-runtime.json), [error screenshot](screenshots/audio-error-retry.png). |
| Pending Play followed by Stop | **PASS** | Controlled 500 ms native-resume delay; real Play then Stop; no late start. [Final log](logs/pending-play-final.log). |
| Actual rendered visualizations | **PASS** | Five samples of oscilloscope, spectrum, and stereo-canvas pixel hashes change alongside real analyser output. [Samples](logs/final-runtime.json), [desktop screenshot](screenshots/desktop-final.png). |
| Core state/WAV encoding and script syntax | **PASS** | Seed repeatability, independent presets, exact paired swing timing, invalid project/note/effect rejection, independently checked PCM header/interleaving/scaling. All three inline scripts parse. [Core log](logs/core-final.log), [parse log](logs/parse-final.log). |
| Control value precision/select dispatch | **PASS** | Preset values exactly match native controls; instrument/effect select changes update actual state. [Precision log](logs/control-precision-final.log), [select log](logs/select-change-final.log). |
| Final console/errors/requests | **PASS** | Final direct-file run: no console messages, uncaught errors, or failed request events. [Clean-cache observations](logs/clean-cache.json). |
| Physical listening/audio-quality judgment | **NOT RUN** | No claim that audio was heard. Actual live signals and downloaded samples were measured. |
| Firefox, Safari, physical phone hardware, long background stress | **NOT RUN** | Chromium desktop and emulated narrow/touch/high-DPI coverage only. |

## Main workflow steps and commands

Run commands from `/home/pyro/projects/naked/astra/bench/03-modular-synth`. Every generated agent-browser command and relevant evaluation body is recorded in [browser-commands.log](logs/browser-commands.log); raw results are in [browser-json.log](logs/browser-json.log). Supplementary CDP operations are in [cdp-commands.log](logs/cdp-commands.log). Harnesses and fixtures are agent-authored and outside the delivered HTML.

Initial browser setup:

```bash
agent-browser --session phase-synth open
agent-browser --session phase-synth network route 'http*' --abort
agent-browser --session phase-synth set offline on
agent-browser --session phase-synth set viewport 1280 800
agent-browser --session phase-synth open file:///home/pyro/projects/naked/astra/bench/03-modular-synth/index.html
```

Final successful workflow commands (exact scripts contain the individual locators, drags, key events, assertions, and file inspections):

```bash
node evidence/tests/core.test.cjs > evidence/logs/core-final.log 2>&1
node evidence/tests/desktop-workflow.cjs > evidence/logs/desktop-workflow-final3.log 2>&1
node evidence/tests/project-export.cjs > evidence/logs/project-export-final2.log 2>&1
node evidence/tests/mobile-workflow.cjs > evidence/logs/mobile-workflow-final.log 2>&1
node evidence/tests/review-regressions.cjs > evidence/logs/review-regressions-final.log 2>&1
node evidence/tests/export-tails.cjs > evidence/logs/export-tails-green.log 2>&1
node evidence/tests/control-precision.cjs > evidence/logs/control-precision-final.log 2>&1
node evidence/tests/select-change.cjs > evidence/logs/select-change-final.log 2>&1
node evidence/tests/pending-play.cjs > evidence/logs/pending-play-final.log 2>&1
node evidence/tests/final-runtime.cjs > evidence/logs/final-runtime.log 2>&1
node evidence/tests/clean-cache.cjs > evidence/logs/clean-cache.log 2>&1
```

The desktop script reloads, chooses the factory song and clicks Enable audio then Play. It samples AudioContext time, step position, all six track analysers, output RMS/peak, voice count, drift and clipping. It uses a real Shift-modified pointer click for accent; native pitch selection and slider drags; piano-grid clicks that add/remove chord notes; both melodic instruments' controls; mixer faders/pan/sends; and mute/solo with signal assertions after fades. It then edits tempo to 128 BPM, swing to about 40%, and pattern length to 8 while running. Pause/resume, Stop/restart, A/S/D chords, repeated A key cycles, pointer hold/release outside, and an actual tab focus change exercise note cleanup. Drum controls, three complete song presets, deterministic seed 4242, Clear, Undo and five effect bypasses complete that flow.

The mobile script uses 390×844, scrolls a 32-step sequence to step 32 and edits it, changes piano and mixer state, touches a note with real CDP touch events and cancels the pointer, then exercises dialogs, keyboard shortcuts and DPR 2 canvases. Final screenshots additionally show the corrected control widths/layout.

## Measured audio and export results

- Desktop sample: AudioContext time advanced from **0.16254 to 2.62966 seconds**. Maximum track RMS values were approximately **0.0824, 0.0454, 0.2270, 0.0358, 0.0174, 0.00323**. Every track had real signal. No late scheduler ticks or clipping appeared in that sample; UI rendering estimate at its end was **0.281 ms/frame** (this is not an audio-thread CPU measurement).
- Final default-device runtime check: maximum observed master RMS **0.18577**. The final uncached check also used the default output successfully. These are signal/clock checks, not listening claims.
- [Final baseline WAV](downloads/run-1788749001603/baseline/midnight-circuitry-118bpm.wav): **44.1 kHz, stereo, 16-bit PCM, 266,462 frames, 6.04222 seconds, 1,065,892 bytes**. Peak **0.46756**, RMS **0.037924**, **330,147** nonzero interleaved samples, **0** clipped samples. The waveform contains a stereo difference and effects tail.
- Repeat render differed by at most **one PCM least-significant bit**. The assertion allows native floating-point variation; it does not claim byte-identical browser DSP.
- Individual effect edits changed actual WAV samples. RMS differences from the baseline were **delay 0.004260**, **reverb 0.003028**, **saturation 0.037058**, **tone 0.024312**, **dynamics 0.029269**. Separate files are retained under [the final download run](downloads/run-1788749001603/).
- Instrument/pan/volume edits changed the exported sequence; master volume zero produced exactly **zero nonzero PCM samples**.
- At 40 BPM, the zero-feedback echo starts at **3.42 seconds**. The repaired WAV lasts **4.095 seconds**, with measured echo-window RMS **0.021319**. Long gate/release followed by reverb exports **11.935 seconds**. [Tail downloads and measurements](logs/export-tails.json).
- Early note-off now preserves the preceding audio: attack comparison difference **0**, decay comparison RMS difference approximately **8×10⁻⁹**. Cancelling a note before onset produces **peak 0** for both normal and fast cancellation. Four simultaneous notes with polyphony 1 leave one voice after the brief steal fades.

## Reproduced failures, fixes and retests

The original red logs and intermediate failed runs are retained. A failure in those historical files is not counted as a final pass. Audio defects were captured with measured samples/state rather than invented listening observations or videos.

| ID / severity | Reproduction and observed failure | Cause, fix, and retest |
| --- | --- | --- |
| 001 / low | Factory step velocity .68 displayed as slider .70; LFO .32 Hz displayed .30. [Screenshot](screenshots/issue-001-control-precision.png), [red log](logs/control-precision-red.log). | Slider increments did not represent presets. Refined velocity/attack/LFO/drum increments and rounded derived presets. [Final pass](logs/control-precision-final.log). |
| 002 / medium | Play, then Stop during a controlled pending audio resume; playback started later anyway. [Red](logs/pending-play-red.log). | Added cancellable play-request generation, awaited resume, bounded startup errors and context/worker cleanup. [Final pass](logs/pending-play-final.log), plus timeout/retry in final-runtime. |
| 003 / medium | Native automation selection emitted change without input; polyphony/LFO/effect UI changed while project state did not. [Red](logs/select-change-red.log). | Handle change for selects without double-applying native input events. [Final pass](logs/select-change-final.log). |
| 004 / medium | Trusted A/S/D events had empty physical key codes and shared a held-note identity. | Fall back to normalized key, including Space. Actual three-note chords, repeated input, key-up and focus cleanup pass in the desktop flow. |
| 005 / medium | Polyphony 1 retained two voices because an already releasing voice could not be stolen. | Permit a short, continuous forced fade of release tails. [Original regression](tests/polyphony.cjs), [green log](logs/polyphony-green.log). |
| 006 / high | Import a track name containing quote/markup characters; it created 45 unintended DOM nodes. | Escape names in all generated attributes, as well as visible text. Actual file upload with literal markup now creates zero injected nodes. [Red](logs/review-regressions-red.log), [final pass](logs/review-regressions-final.log). |
| 007 / medium | Schedule a .1-second gate during a .65-second attack; audio before note-off differed from the same note with a longer gate. | Cancelling automation deleted the preceding ramp endpoint. Preserve it with cancel-and-hold and a ramp-preserving fallback. Native offline pre-note-off comparison passes. [Red](logs/review-regressions-red.log), [final measurements](logs/review-regressions.json). |
| 008 / medium | Four simultaneous pitches at polyphony 1 left three sounding voices after the fade. | Repeatedly stole the same fading voice. Exclude already stolen allocations and retire all excess voices when lowering the budget. Chord and reduced-polyphony checks pass. [Final](logs/review-regressions-final.log). |
| 009 / medium | Pause with a future step queued; resumed step index and swing/metronome phase disagreed. | Track absolute musical position in scheduled events and reconcile both counters from audible events on pause. Real resume timing and phase checks pass. [Final](logs/review-regressions.json). |
| 010 / medium | At 40 BPM with feedback 0, WAV ended at 2.595 s before its first echo at 3.42 s. Long release plus reverb also truncated. [Red](logs/export-tails-red.log). | Include the first echo even without feedback and combine final source duration with subsequent effect decay. Both actual download regressions pass. [Green](logs/export-tails-green.log). |
| 011 / medium | At 390 px, instrument controls extended past the panel and were hidden by overflow; some transport values were truncated. [Red bounds](logs/review-regressions-red.log). | Stack narrow instrument sections, constrain grid children, widen value selects. Desktop/tablet/mobile bounds and screenshots pass. [Corrected view](screenshots/mobile-instrument-final.png). |
| 012 / medium | Cancel a future note before its .005 s onset; cancel-and-hold retained default gain 1, causing an unintended burst (peak .194 normal release / .00304 fast). [Red](logs/future-note-red.log). | Explicitly cancel automation, set gain 0 and stop the source before onset. Both rendered peaks are exactly zero. [Green](logs/future-note-green.log), [final regression](logs/review-regressions-final.log). |
| 013 / medium | Solo after instrument/mixer editing produced a later quiet snare transient despite a silent snapshot. Reproduced twice. [Failure](logs/desktop-workflow-final2.log). | Live AudioParam reads showed remaining gain .001568 after 200 ms on the silent track. Replace asymptotic smoothing with held, bounded 16 ms ramps. The same unchanged full mute/solo assertion now passes. [Final desktop](logs/desktop-workflow-final3.log). |
| 014 / medium | Validator accepted unknown effect keys, although effect definitions are a fixed set. [Red unit log](logs/unknown-effect-red.log). | Reject unknown effect definitions before UI generation. Actual JSON upload containing a markup-like effect key is rejected without state/DOM mutation. [Final runtime](logs/final-runtime.json), [core](logs/core-final.log). |

## Automation and environment notes

- **Host audio:** `PULSE_SERVER=unix:/mnt/wslg/PulseServer`. Earlier repeated default-output reloads sometimes reported running with `currentTime=0`, then suspended. Switching the same native context to Chromium's `{type:"none"}` sink restored audio-clock progression and analyser data. Most repeatable signal scripts use that test-only native sink. Final default-device and uncached default-device checks both passed after resource cleanup; no physical listening was performed.
- **Shift-click:** agent-browser keydown Shift followed by its high-level click produced `shiftKey:false`. Captured trusted events established this. CDP mouse dispatch with modifier 8 drove the real accent control; application behavior was not rewritten to satisfy the tool.
- **Touch:** supplemental CDP sends actual touchStart/touchCancel into Chromium, causing pointer events in the application. Held input changed 1→0 and real voices released. This is emulation, not physical phone hardware.
- **Downloads:** Chrome download configuration must remain on an open CDP connection. Initial missing-download attempts failed; after retaining the connection, actual JSON/WAV files were downloaded and independently read. Files were not synthesized by the test harness as substitutes for application exports.
- **Other harness corrections:** integer mouse coordinates; drag from the native slider thumb; explicit document readiness; wait for the scheduled 5 ms note onset and mixer fades. Import error waits now check the specific new error text, avoiding a stale prior toast. Earlier attempts remain in logs.
- **Visual inspection:** final desktop, full-page, narrow, instrument, piano, mixer and dialog screenshots were inspected. No screenshot alone was treated as a functional pass. All primary functionality has accompanying actual interactions and state or signal evidence.

## Screenshot references

- [Final desktop, 1280×800](screenshots/desktop-final.png)
- [Final desktop, full page](screenshots/desktop-final-full.png)
- [Final mobile, 390×844](screenshots/mobile-final.png)
- [Final mobile, full page](screenshots/mobile-final-full.png)
- [Corrected narrow instrument](screenshots/mobile-instrument-final.png)
- [Piano-roll editing](screenshots/desktop-piano-roll.png)
- [Mixer editing](screenshots/desktop-mixer.png)
- [Pointer note held](screenshots/pointer-note-held.png)
- [WAV export result](screenshots/wav-export-ready.png)
- [High-DPI rendering](screenshots/desktop-retina.png)

The browser is left stopped on the factory Midnight circuitry project. The delivered artifact has no build, server, framework, font, sample, external asset, or network dependency.
