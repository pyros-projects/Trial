# MODSYN-8 — validation evidence

Everything in this folder is test evidence and is **not** referenced by `index.html`.
The app itself stays a single self-contained file (one inline `<script>`, one inline
`<style>`, no `fetch`, no CDN, no build step at runtime).

- Date: 2026-09-08
- Target: `index.html` (168 kB, built by `build.mjs` from `src/*`)
- Runner: Chrome for Testing 152.0.7977.54 (headless=new), driven over raw CDP by
  dependency-free Node 25 scripts (`tests/harness.mjs`, `tests/netcheck.mjs`)
- Input model: **real** `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` at
  measured element coordinates — not synthetic `el.click()` — so hit-testing,
  `pointerdown` capture and focus behaviour are on the tested path.

## How to re-run

```sh
node build.mjs                     # src/* -> index.html (syntax gate included)
node tests/harness.mjs             # 35 checks, file:// scenario, exits non-zero on failure
node tests/netcheck.mjs            # 14 checks, http:// + no-DNS/no-proxy isolation
node tests/harness.mjs --url "http://127.0.0.1:PORT/index.html"   # any other URL
```

Both scripts print `PASS`/`FAIL` lines plus measured values, and write
`harness-report.json` / `netcheck-report.json` (plus `h-*.png` screenshots) here.

## Determinism

- `localStorage` is cleared and the page reloaded at the start of each run, so a
  previous run's edits cannot leak into the next one.
- The HTTP test picks a **free loopback port** and verifies the served byte count
  matches `index.html` before launching the browser (an earlier attempt silently
  talked to a stale server that owned port 8899 and returned someone else's bytes).
- Clicks on controls are hit-tested immediately before dispatch and retried; the
  test asserts that a `click` actually landed on the intended element, so a
  "passed" check always means the app's own handler ran.

## Network isolation (netcheck)

Chrome runs with `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1,
EXCLUDE localhost"` and `--proxy-server=direct://`:

- N0 proves the isolation is real — an in-page `fetch('https://example.com')` fails.
- Only **2 requests** happen for the whole app: the document and `favicon.ico`,
  both to `127.0.0.1`. No other host is contacted during load, playback, editing,
  presets, randomise, WAV export or JSON export.
- Run under `http://` (not `file://`) so no file-URL privileges are assumed.

## Check groups (35 harness + 14 netcheck)

| Area | Checks |
| --- | --- |
| Boot | gate visible before audio; AudioContext reaches `running` after one real click; auto-demo plays with voices and non-zero output |
| Transport / scheduler | playhead transform animates; master meter reacts; stop halts and restart resumes from step 1; live tempo change keeps scheduling (late-tick count and clock drift stay bounded); pattern-length change rebuilds the grid mid-playback |
| Step editor | click toggles a cell during playback; shift+click cycles velocity/accent; editing while running is safe |
| Piano roll | empty cell resolves through the app's own hit test; click inserts a note in the clicked cell; drag moves a note in time **and** pitch; no note stacking (collisions refused) |
| Play surface | computer-keyboard play creates and releases a voice; 14 rapid repeats + focus loss leave no latched keys and all voices retire; pads and on-screen keys are hold-to-play and release cleanly |
| Mixer | mute drives the track output gain to 0 **and** the master level collapses (0.099 → 0.0002 rms, i.e. audible silence); solo gates all 7 other outputs to 0 |
| Synth | knob drag changes cutoff; per-track preset dropdown changes the real voice parameters; per-track randomise touches only the selected track |
| FX | saturation bypass rewires the graph (11 → 8 path wires) and changes the measured output level |
| Project I/O | snapshot→restore is byte-identical; localStorage save + reload replays; JSON import through the real `<input type=file>` restores tempo/notes; three WAV export buttons produce non-silent stereo files (a 7.6 s, 1.34 MB RIFF/WAVE was written to disk); rendering leaves the live engine clean (`dropped: 0`, no errors) |
| Visualisation | scope, spectrum, spectrogram, phase and note-history canvases all contain live pixels (1.3 %–51 % lit, 10–73 distinct colours) — a blank-canvas detector |
| Layout | 390×844: no horizontal page overflow, audio keeps running, no runtime errors |
| Hygiene | zero uncaught page errors, zero console errors, zero failed requests, no failed scheduler ticks or voice drops during the whole session |

## Defects found by this pass and fixed

1. **Voice pool could wedge (audio bug).** The poly cap (`maxTotal = 48`) was tested
   *before* finished voices were reclaimed, so once the array filled, every
   subsequent note was refused forever. Reclamation also only happened when a new
   note arrived or during `requestAnimationFrame` — which is throttled/paused in
   background tabs. Now voices are pruned on every 25 ms scheduler tick and at the
   top of the frame loop, and the cap is checked *after* pruning.
2. **Metronome could never sound (naming split).** `newProject` stored `proj.metro`
   while the scheduler, UI toggle and snapshot used `proj.metroOn`: the click gate
   required both, so it never armed, and the setting was dropped on save/load.
   Unified on `proj.metro`; the harness now asserts the click bus gain actually
   rises to 0.25 and that the flag survives a project round trip.
3. **Three inspector controls threw `TypeError`.** Module 40 kept a local
   `var UI = {}` and called `UI.repaintSeq()`; the populated object is `App.ui`,
   so per-track **RANDOMISE**, **CLEAR** and the **TRACK ON** toggle threw on every
   click (the change partly applied, then aborted). They now call `repaintSeq()`
   directly — all modules share one function scope, so the declaration hoists.
4. **Whole page scrolled sideways below ~760 px.** `#app` was a grid with no
   explicit column, so the implicit `auto` track sized to max-content (~617 px) and
   pushed the topbar and panels past the viewport. Fixed with
   `grid-template-columns: minmax(0,1fr)`, `min-width:0` panels, and narrow-screen
   rules for the transport/parameter groups. Verified with a "widest element" scan.
5. **Piano roll was unreadable and mis-clickable at short heights.** Rows were
   drawn at ~3 px in a 118 px canvas. The visible semitones are now capped so no
   row is thinner than ~6.5 px (the pitch window auto-fits the track instead), and
   drawing + hit-testing share the single `rollGeo()` source of truth.

## Test-harness defects fixed along the way

- `getBoundingClientRect()` returned through CDP arrives as `{}` (DOMRect is not
  serialisable) → coordinates became `NaN` and CDP rejected the input events.
- A drag synthesised as `mousePressed(buttons:0)` + moves is not treated as a drag
  by the browser; the helper now presses with the button held and moves with
  `buttons: 1`, matching a real mouse.
- Synthetic coordinates need the hover target settled; `clickEl()` now re-measures,
  verifies the hit target and retries, instead of reporting a miss as an app failure.
- Assertions that depended on sub-pixel row geometry were rewritten to go through
  the app's own `rollGeo`/`rollHit`, so they test behaviour, not pixel assumptions.

## Not covered (honest limits)

- Pointer input is synthesised mouse/CDP input; real touch (`touch-action`,
  multi-touch glissando) is only structurally exercised.
- Audio is verified through analyser taps, master peak/RMS and rendered WAV
  statistics — no external signal analysis or A/B listening test.
- No long-duration stability run (hours) and no screenshot regression diffing.
- Screenshots: `h-01-gate` (boot), `h-02-playing` (1280×800, mid-playback),
  `h-03-narrow` (390×844), `h-04-reload` (cold reload with restored project).
