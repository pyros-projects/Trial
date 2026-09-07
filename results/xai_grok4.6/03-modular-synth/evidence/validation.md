# CATHODE validation

Artifact: `/home/pyro/projects/naked/grok46/03-modular-synth/index.html`  
Local HTTP used for most checks: `python3 -m http.server 8766 --bind 127.0.0.1` in the project directory.  
Browser: `agent-browser` 0.31.1, session `cathode` (HTTP) and `cathode-file` (file://).  
Audio quality was **not heard**. Playback was judged from playhead, meters, analyser canvases, voice counts, and offline WAV statistics.

## Environment

- Viewport A: 1280 × 800
- Viewport B: 390 × 844
- No build step. Delivered file is self-contained HTML/CSS/JS.
- External URL scan of `index.html`: the only `http://` substring is the SVG namespace inside a data-URI favicon (`xmlns='http://www.w3.org/2000/svg'`). Zero `<script src>`, zero stylesheet hrefs, zero `fetch(`.

## Checks

### 1. Enable audio with a real user gesture — **pass**

Steps: open `http://127.0.0.1:8766/index.html`, click `Enable audio`.

Observed: `window.__CATHODE.getDiag()` → `unlocked: true`, `ctx: "running"`. Gate dismissed. Screenshot `screenshots/03-audio-enabled.png`.

Eval-only `.click()` after reload did **not** resume AudioContext (autoplay policy). A real `agent-browser` click did.

### 2. Playback, playhead, meters, analysers — **pass**

Steps: click `Play`, sample diagnostics twice ~800 ms apart, screenshot, measure canvas pixel variance.

Observed:

- Step advanced 6 → 13 while `playing: true`.
- Voices 11 → 16.
- Master RMS `out` ~0.23–0.30.
- Meter widths changed across Lead/Bass/Keys/Drums/Master.
- Canvas variance non-zero: scope ~16986, spectrum ~2584, phase ~7259, history ~3269.
- Status text: `CTX running`, `STEP` moving, `OUT` ~-11 dB.
- Screenshot `screenshots/04-playing.png` shows live scope, spectrum, stereo phase, note history, and an amber playhead.

### 3. Edit steps during playback — **pass**

Steps: while playing, click `Lead step 5 A4`.

Observed: `tracks[0].roll[4]` gained note `{n:69,...}` in addition to the existing C5. Playback continued (`playing: true`).

### 4. Live notes (pointer / pads / keyboard) — **pass**

Pointer/pads:

- `Pad kick` during play: drum meter rose (later 31% with other hits).
- `Piano A3` during play: voices 13 → 18.
- Isolated after Stop: pointer down on piano → 1 voice, lead meter ~30%, `out` ~0.22; pointercancel → 0 voices, class not `active`.

Computer keyboard:

- `agent-browser press a` while `Stop` was focused did not sound a note.
- After blur, `window` `KeyboardEvent` `keydown` `{key:'a'}` produced 1 voice, `out` ~0.198, lead meter ~38% within 150 ms. Keyup/release path then dropped output.

On-screen keyboard and pads are the reliable pointer/touch path. The A–K handler is wired and produced audio when a `keydown` reached `window`.

### 5. Synthesis and effect parameters — **pass**

Steps: dispatch `input` on tempo/swing/cutoff/saturation/delay mix (range `fill` is unreliable). Also earlier slider fills moved tempo 118 → 130 and saturation 0.28 → 0.5.

Observed after precise `input` events: `tempo 144`, `swing 0.28`, lead cutoff `1100`, `sat 0.62`, delay mix `0.4`. Playback stayed coherent (`playing: true`, voices ~22).

Mute: `Lead mute` → `tracks[0].mute === true` and lead meter `0%` while master still ~88%.

### 6. Tempo and swing while running — **pass**

Tempo 118 → 144 and swing 0.14 → 0.28 during playback. Step continued to advance; no scheduler stall (`drift: 0`).

### 7. Stop and restart — **pass**

Stop: `playing: false`, `step: 0`. After ~800 ms, `voices: 0`.  
Restart: `playing: true`, step advancing (4), meters live again.

### 8. Stuck-note prevention — **pass** (after a fix)

First attempt (pre-fix): live voices pre-called `osc.stop()` at a far future time; a second `stop()` on release could throw. After cancel, UI cleared but the voice list still held the note.

Fix: live oscillators are not pre-stopped; `voice.stop()` ramps gain, stops osc/lfo with try/catch, and shortens `voice.end`.

Retest after reload: hold piano A3 → 1 voice / `out` 0.22; `pointercancel` + 350 ms → **0 voices**, `out` ~0.004, key not `active`. Window `blur` clears `.active` keys. `visibilitychange` handler still requires `document.hidden`.

### 9. Project save / load JSON — **pass**

- Upload `evidence/load-probe.json` to `#file-json` → hint `Loaded LoadProbe.`, `tempo: 99`.
- Download via `agent-browser download "#btn-save"` → `evidence/saved-project.json` (4 tracks, valid JSON, 23389 bytes).

### 10. localStorage persistence — **pass**

Reload after parameter edits restored `tempo: 144` from `cathode-project-v1`. After JSON load, `localStorage` name was `LoadProbe`.

### 11. Offline WAV render — **pass** (not heard)

`window.__CATHODE.exportWav({silentDownload:true})` uses `OfflineAudioContext`, not microphone or system loopback.

| Run | duration | peak | rms | rate | ch |
|-----|----------|------|-----|------|----|
| 2 bars after edits | 4.83 s | 0.513 | 0.246 | 44100 | 2 |
| 1 bar Night Bus | 3.53 s | 0.503 | 0.205 | 44100 | 2 |

Peak ≫ 0, so the file is not silence. Musical quality was not auditioned.

### 12. Pattern length, randomize, clear, song presets — **pass**

- Length 16 → 8 during play: `length: 8`, still `playing: true`.
- Seed `4242`: two Randomize clicks produced identical lead rolls (`same: true`).
- Clear: lead notes 0, bass ons 0, kick ons 0.
- Song preset `night`: name `Night Bus`, tempo 118, 13 lead notes.

### 13. Desktop 1280×800 — **pass**

Screenshot `screenshots/12-desktop-final.png`. Transport, visualizers, four tracks + master FX, and the lead piano roll are usable. Keyboard, pads, and the status strip sit below the fold and are reached by scrolling.

### 14. Narrow 390×844 — **pass**

Screenshots `screenshots/06-mobile.png`, `07-mobile-scrolled.png`, `08-mobile-top.png`, `09-mobile-playing.png`.

- `innerWidth/Height` 390×844, Play control present.
- Mixer stacks; sequencer, piano, pads, and status remain usable after scroll.
- Playback on mobile after restoring Night Bus: step 7, 16 voices, meters including drums ~50%, `out` ~0.24.

### 15. Direct `file://` open — **pass**

`file:///home/pyro/projects/naked/grok46/03-modular-synth/index.html`

- Title CATHODE; 1 inline script; 0 `script[src]`; 0 `link[href^="http"]`.
- Enable audio + Play: `ctx: running`, `playing: true`, step 5, 10 voices, `out` ~0.24, meters moving.
- Network log: only the document GET. Screenshot `screenshots/11-file-playing.png`.

An earlier `wait` after `close` left a blank `about:blank` tab; a subsequent `open` of the file URL worked.

### 16. Console / network — **pass** with a note

- `agent-browser errors` produced no application exceptions during the successful flows.
- HTTP session requests: `index.html` 200, plus browser probes of `/favicon.ico` 404 (not requested by app JS). After adding a data-URI icon, Chromium may still probe `/favicon.ico`.
- HTTPS was routed `--abort`; no aborted app requests were observed.

### 17. Status strip — **pass**

Live values observed: AudioContext state, BPM, current step, lookahead 120 ms, active voices, load %, output dB, clip yes/no, drift ms.

## Failures and retests

1. **Silent offline WAV (code review, pre-test)** — first engine builder skipped `destination` when `silent=true`, which would have rendered zeros. Fixed before the WAV checks above. Retest: peak 0.51.
2. **Metronome gain 0 (code review)** — click bus gain was 0. Set to 1 before interaction tests.
3. **Analyser `getFloatTimeDomainData` size** — meter FFT is 256; a 128-sample view would throw and freeze rAF. Fixed; playhead/meters ran for minutes of testing.
4. **Live-note double `osc.stop`** — failed first stuck-note check; fixed; retest passed (section 8).
5. **Range `fill` typing** — `fill "#tempo" "140"` became 130, cutoff fill missed 800. Not an app bug. Used `input` events and still performed pointer clicks on transport/sequencer.

## Not-run / blocked

- **Listening to speakers or headphones** — not-run. No claim about timbre or mix quality beyond analyser/WAV energy.
- **Touch on a physical phone** — not-run. Pointer events and a 390×844 viewport were used instead.
- **Import of a user-supplied JSON from disk picker UI** — the hidden file input was driven with `agent-browser upload`, which fires the same `change` handler.

## Remaining limitations

- 1280×800 does not show the whole workstation without scrolling (keyboard/status below the fold).
- Piano roll is two octaves plus; lower rows require in-grid scroll.
- Scheduler load estimate is callback time / lookahead, not a full audio-thread CPU meter.
- Clip LED is peak-of-analyser-window, not an analog-style hold on the limiter reduction.
- Default loop is enjoyable by construction, but that was not verified by ear.

## Commands (summary)

```bash
python3 -m http.server 8766 --bind 127.0.0.1
agent-browser --session cathode open http://127.0.0.1:8766/index.html
agent-browser --session cathode set viewport 1280 800
agent-browser --session cathode find role button click --name "Enable audio"
agent-browser --session cathode find role button click --name "Play"
agent-browser --session cathode eval "JSON.stringify(window.__CATHODE.getDiag())"
agent-browser --session cathode-file open file:///home/pyro/projects/naked/grok46/03-modular-synth/index.html
```
