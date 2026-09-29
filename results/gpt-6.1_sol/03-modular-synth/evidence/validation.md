# Agent-authored validation — Forma

Status: final validation completed. Browser: installed agent-browser 0.31.1, core and dogfood workflows read. The supplemental taxonomy CLI lookup returned `Skill not found`; `agent-browser skills path dogfood` resolved the installed directory, and the version-matched taxonomy was read from there.

No previous application existed and the directory is not a git repository. Runtime deliverable is index.html. Development tests and logs stay in evidence/.

## Execution log

- Read installed agent-browser stub and version-matched core/dogfood workflows.
- Design and plan recorded in design.md / plan.md; user authorized autonomous end-to-end implementation.

### Desktop/direct-file first pass

Commands: `agent-browser --session forma --allow-file-access open file:///home/pyro/projects/naked/sol61/03-modular-synth/index.html`; `set viewport 1280 800`; route `http://*` and `https://*` with `--abort`; `set offline on`. No HTTP server required. External requests blocked and browser offline.

- PASS: real click Enable audio then Play. AudioContext running at 44100 Hz; first master RMS 0.2014, peak 0.3839, 6 voices. Subsequent step 6/8 and RMS 0.1413/0.1039 showed progression. Screenshots desktop-initial.png / desktop-playing.png / desktop-full.png.
- PASS: clicked Glass keys step 2, drew C4 at step 2, selected it and used Home/ArrowRight on velocity then selected 2-step length. Actual state contained A3 plus C4 with velocity .02 and gate 1.9. Playback continued with 0 scheduler resyncs.
- PASS: selected Envelope; changed attack to .004 s; selected sawtooth waveform; cutoff 80 Hz via keyboard slider; tempo 132, swing 60%, length 8; restart reached step 1 with active voices.
- PASS: effects changed using focused range controls and Home/End. Live graph read delay .8, feedback .75, reverb .8, IR duration 4 s, drive curve 2048 samples, tone 300 Hz, compressor threshold −30 dB. FFT peak 176/255 and master RMS .077.
- PASS: mixer pan moved to 1, volume .01, delay send 1; solo Glass keys reduced other track gain nodes to zero; mute Analog bass also reduced its gain node to zero. Navigation to Mixer/Visualizations exercised; screenshots mixer-solo.png / visualizations.png / effects-spectrum.png.
- PASS: Stop yielded 0 active voices and 0 held notes. Effect tails remain deliberately audible in the bus.
- TEST HARNESS ERROR: an initial pointer-hold check used coordinates from a prior scroll position and timed out. Inspected current rectangles and elementFromPoint; target was the note-editor header. Repeated after scrollintoview and fresh coordinates. This was not an app failure.
- INVESTIGATING: stopped drum nodes remain in engine resource registry even after their end time; active count correctly returns zero, but cleanup needs correction. Audio event logs show real A keydown/up creates a C3 voice. Rapid-key tests must inspect event history, since short released notes may have ended by the next CLI read.

### Input, state and export checks

- FIXED: drum resource cleanup. Before fix `check-resources.js` failed with active=0, held=0, resources=2. Root cause: the onended guard compared the shortened stop time with a later release end and skipped cleanup. Removed the guard on the longest drum source. Reloaded, enabled audio, played, stopped, waited for registry=0; resources-green.txt passes.
- PASS: agent-browser pointer click and real key `a` events exercised performance input. For sustained-key tests, supplementary native CDP input was used through the browser endpoint because the CLI `press` command immediately releases keys. Browser navigation, normal controls and screenshots still use agent-browser.
- PASS: CDP held A/C3 produced RMS .06294 and one lit key/held voice; key-up returned active/held/pending to zero. Three held notes produced 3 voices and RMS .1164. Twenty rapid repetitions left zero voice resources. Logs keyboard-hold.json / keyboard-chord.json / keyboard-rapid.json.
- PASS: downloaded real JSON via `agent-browser download '#saveProject' ...`; changed name to Round trip test, tempo 107 and length 24, waited for saved indicator, reloaded; all three values persisted, audio correctly began off.
- TEST HARNESS ERROR: relative upload paths could not be read by Chrome (permission/FileReader error). Repeated with an absolute path; full project import succeeded and restored Midnight circuit, 116 BPM, 16 steps. Application displayed the unreadable-file error and preserved existing state.
- PASS: version-999 fixture and malformed JSON rejected, with toast error and original project preserved.
- PASS: real offline render downloaded midnight-circuit.wav: stereo, PCM 16-bit, 44100 Hz, 314783 frames, 7.13794 s, peak .481964, RMS .079876. All-muted WAV: stereo 48000 Hz, 243311 frames, 5.06898 s, peak/RMS 0 and zero nonzero samples. Python wave + PCM inspection saved to wav-inspection.json. Audio quality was not heard; these are signal/data checks.

### Narrow viewport first pass

- PASS: 390×844 page width and body width both 390; no document horizontal overflow. Actual Play, step edit and length-32 change produced running output (RMS .13566), playhead step 4, no scheduler resync.
- FOUND: 32-step columns became too narrow and ruler labels overlapped on phone. Screenshots mobile-initial.png / mobile-playing.png / mobile-32-steps.png. Correcting minimum cell width with local horizontal scrolling, plus larger touch note cells.

### Final review fixes and retests

See review.md for the independent findings. Exact production failures are preserved in `*-red.txt`; passing checks in matching `*-green.txt`.

- PASS: imported names remain text (attribute-fixture.json had `" data-x="y`); after fix no `[data-x]` element exists. Before fix 4 attributes were injected.
- PASS: prototype scale `toString` rejected as an allowed scale; normalizes to minor. Core suite now has 7 meaningful tests.
- PASS: real shared-engine OfflineAudioContext long attack (.8 s), short gate (.12 s) test has early RMS .003103. Before fix early RMS was exactly 0.
- PASS: active sequenced triangle oscillator changes to square through the waveform button. Before fix the same oscillator remained triangle.
- PASS: held LFO route changes reconnect to the new AudioParam and use its units. Filter-to-amplitude transition resets old modulation automation, then reaches depth .5. Measured peak .1906 during the retest; node state is sampled after an audio rendering quantum because AudioParam.value may briefly describe the previous quantum.
- PASS: pending metronome click nodes and all voice nodes clean up after a quick start/stop (0 clicks, 0 resources).
- PASS: last-step long gate/release + feedback .75 export. Commands: upload long-tail-project.json with absolute path, Export WAV, select 1 loop/44100 Hz, `download '#renderWav' evidence/downloads/long-tail.wav`. Real WAV duration 46.91 s, peak .168213, RMS at 8–9 s .014641, final .25 s RMS .00000309. This preserves sound past the former cutoff and fades to near silence.
- PASS: seeded generation through Library: seed 4242, density 11%, Generate all tracks twice yielded identical note arrays. Initial counts 1/6/9/2. Clear all yielded 0/0/0/0.
- PASS: mobile 32-step editors now have local horizontal scrolling: step width 23.03 px, note width 22.94 px, note height 20 px, document width 390. Clicked step 32 and inspected its actual A3 event. Real touch tap created C4 at step 31. Touch horizontal scrolling preserves notes (before fix it painted an unwanted note). Touch cancel released held performance notes; final active/held/pending counts zero.
- PASS: native device metrics override 390×844, deviceScaleFactor=3. Reported DPR 3, monitor CSS width 340, backing canvas width 680 (intentional 2× drawing cap). Screenshots mobile-last-steps.png / mobile-32-fixed.png.
- PASS: single-voice Acid circuit preset: three held keys produced one actual sounding voice. After release, resources clean up. Glass keys preset restored correctly.
- PASS: both Daylight drift (94 BPM, C major) and Warehouse 04 (132 BPM) started actual audio in the final fresh browser. Preset logs saved. Scale/key controls also update note-grid guides; C major marks 10 non-scale rows in the 24-row grid.
- PASS: real Space play/pause/resume and Escape stop/reset. Stop leaves zero voice resources. Tempo 240, swing 60%, length 32 progressed steps 1/3/6 with zero scheduler resync/drift; live shrink to 8 and tempo 40 followed by Restart reached step 1 and produced nonzero RMS.
- FIXED: short pointer/keyboard pad taps cut off percussion decay. Before fix a 1.5-second snare ended by .15 seconds. After fix the tap leaves a finite snare voice sounding with RMS .09315 and its proper end time. Stop still cancels it.
- FIXED: selecting bass or Orbit initially opened the wrong note-grid range. A1 and E5 were inaccessible/absent before fix. The grid now includes C1–C7, selects the first existing note, and opens the appropriate range. Actual controls selected A1 step 1 and E5 step 3, then drew E5 at step 4. Logs bass-range-* / orbit-range-*.
- FIXED: changing drum mix in the inspector left the Mixer slider stale. Before fix it displayed .65 after actual volume was set to .01. Returning to Mixer now refreshes the real .01 value. Logs mixer-sync-*.

### Browser audio-clock anomaly

One long-lived Chromium session, after many reloads/renders, showed AudioContext.state=`running` while its clock advanced very slowly (.19737 s unchanged across 750 ms of wall time). No JavaScript exception or failed asset request accompanied it. The first Daylight preset playback wait failed. System observation showed other unrelated Chromium processes with high CPU use; this is context, not a proven cause. Root cause was not established.

Preserved library-audio-clock-stall.png. Closed only the test's own `forma` browser and opened a fresh `formafinal` session; the same artifact's audio advanced .09288→.70240 s across ~611 ms wall time, with changing nonzero output and steps. The lifecycle now explicitly closes its AudioContext on pagehide and recreates closed contexts on the next gesture. Three subsequent reload/enable/play tests each advanced .348–.360 s over a 350 ms wait, with nonzero RMS and zero drift. See reload-audio-regression.json. The final preset and transport checks passed. A long-duration hardware/sink stress check is not established by these short retests.

### Final artifact check

- PASS: final WAV from the default Midnight circuit: 2 loops, stereo 44100 Hz PCM16, 1512920 bytes, duration 8.57639 s, float peak .483400, RMS .067870 (shared engine with corrected envelopes and tails). Saved final-midnight-circuit.wav and final-wav.json.
- PASS: modal keyboard focus wraps with Shift+Tab from its first select to Render WAV; Close restores the invoking control.
- PASS: real master analyser FFT had 712 nonzero bins and maximum 164/255, L/R peaks .05217/.05409, RMS .04423, zero drift and render estimate 2.48 ms. This proves actual signal and stereo diagnostics; no listening claim is made.
- PASS: desktop 1280×800 and phone 390×844 flows and screenshots. Vertical page scrolling exposes the keyboard/effects, and each larger note/step editor scrolls locally on narrow screens.

## Explicit coverage limits

- NOT RUN: human listening/audio quality assessment, physical touch hardware, non-Chromium browsers, very long session stress, heap/GC profiling.
- Recovered anomaly: the audio-clock stall above; root cause unconfirmed, fresh-session and repeated reload checks passed.
- No optional browser capability was substituted for agent-browser. Native CDP supplemented it only for sustained key and touch events, device pixel ratio and focus-loss events. No external assets/services are required; no HTTP server was used.

### Final commands and observed audit

Commands run against the final artifact:

```bash
node evidence/tests/core.test.cjs
# Extracted the sole inline script to /tmp/forma-script.js using Python regex.
node --check /tmp/forma-script.js
agent-browser --session formafinal reload
agent-browser --session formafinal click '#enableAudio'
agent-browser --session formafinal click '#playBtn'
agent-browser --session formafinal wait --fn 'window.forma.diagnostics.rms>.001 && window.forma.diagnostics.step>0'
agent-browser --session formafinal screenshot evidence/screenshots/final-desktop-1280.png
agent-browser --session formafinal screenshot --full evidence/screenshots/final-desktop-full.png
agent-browser --session formafinal set viewport 1024 800
agent-browser --session formafinal set viewport 390 844
agent-browser --session formafinal screenshot evidence/screenshots/final-mobile-390.png
agent-browser --session formafinal screenshot --full evidence/screenshots/final-mobile-full.png
agent-browser --session formafinal select '#patternLength' 32
agent-browser --session formafinal eval --stdin < evidence/tests/check-mobile-layout.js
agent-browser --session formafinal select '#patternLength' 16
agent-browser --session formafinal set viewport 1280 800
agent-browser --session formafinal click '#stopBtn'
agent-browser --session formafinal wait --fn 'window.forma.engine.voices.size===0 && window.forma.engine.clicks.size===0'
agent-browser --session formafinal eval --stdin < evidence/tests/check-resources.js
agent-browser --session formafinal errors
agent-browser --session formafinal console
agent-browser --session formafinal network requests
agent-browser --session formafinal close
```

PASS: seven pure behavior tests; JavaScript syntax check; no browser uncaught errors or console errors in the final flow. Final network log contains only eight successful file:// document navigations, no external requests. Performance resource entries are empty. The artifact audit found one inline script, zero external src/href, CSS imports, JS imports or external scripts. Embedded favicon is a data URI. File size 120338 bytes; audit includes SHA-256.

PASS: 1024×800 also retains the Master volume control with no page horizontal overflow. Final state restored Midnight circuit, four tracks, 116 BPM, 16 steps; Stop yielded zero held notes, active voices and resource nodes, with zero timing drift. Screenshots were visually inspected. The test browser was closed after evidence collection.
