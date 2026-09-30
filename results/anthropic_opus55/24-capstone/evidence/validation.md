# Validation — Starfix (`index.html`)

Validated on 2026-09-30 by Claude (Opus 5.5) in Claude Code. The delivered build is `../index.html`: 148,535 bytes, sha256 `43963ceab786d3d929631ae842e94d9461b8b70dc3a5790e841493cc76d7757b` (`logs/final-build.sha256`).

## Tools and setup

- **Browser automation:** `agent-browser` 0.31.1, with headless Chromium driven over CDP. Before use I read the installed skill stub `.agents/skills/agent-browser/SKILL.md` and the version-matched guides `agent-browser skills get core --full` and `agent-browser skills get dogfood` (the exploratory-testing workflow). All sessions ran in a private namespace (`AGENT_BROWSER_NAMESPACE=starfix`).
- **Local server:** a temporary one for HTTP inspection only, `uv run python -m http.server <free port> --bind 127.0.0.1` (port 51257), serving the project directory. It is not a runtime dependency.
- **Unit tests:** `node` runs `tests/test_astro.js` and `tests/test_fix.js`. Both execute against the core extracted from the shipped `index.html` (`tests/core-extract.js` and `tests/data-extract.js`, cut between the `/*<CORE>*/` markers).
- **Scripts:** the evidence scripts are `tests/e2e_1…5_*.sh`, with helpers in `tests/lib.sh`, `face.sh`, `sight.sh`, `align.sh`, `sunsight.sh` and `shoot_suggested.sh`. Rerun with `PORT=<port> tests/e2e_1_bermuda.sh`, and so on.
- **Input used:** every interaction in the scripts uses real browser input through agent-browser: clicks on buttons, tabs and table rows; `mouse move/down/up` on the canvases; `press ArrowDown/ArrowUp/Space/Enter/Escape/Tab`; `fill`, `check`, `select`, `upload` and `download`. `eval` is used only to **read** state through the read-only `window.starfix` diagnostics (`summary()`, `screenOf(name)` for canvas click coordinates) and to measure frame times. The exceptions, where a browser capability was missing, are marked **(synthetic)** below.

## Results

All five scripts were re-run on the delivered build (sha256 above). Their output is in `logs/e2e_{1..5}_*.final.log`, and the numbers below come from those runs. The logs without `.final` are the first runs on earlier builds; they are kept for the history of fixes.


Status meanings: **pass** means observed working, **partial** means only part of the check was possible, and **blocked** means the capability was unavailable.

| # | Check | How | Observed | Status |
|---|---|---|---|---|
| U1 | Almanac engine against an independent reference | `node tests/test_astro.js`: my GHA Aries, Sun GHA/Dec, star SHA/Dec, Hc and Zn at 2021-09-10 19:00 UTC, AP N39°58′ W075°32′, compared with Astron's published sample page | All values agree within 0.11′. Polaris SHA differs by 0.27′, which is about 0.003′ of arc at dec 89.35°. Dip at 3 m is 3.05′ (Astron 3.1′). Bennett refraction at 49.9° is 0.84′ (0.8′). Sun SD is 15.89′ (15.9′). `logs/astro-vs-astron.txt` | pass |
| U2 | Fix solver | `node tests/test_fix.js` | 3 exact LOPs give 0.000 nm error. A 15° cut gives a 13.3 × 1.7 nm ellipse. Near-parallel lines are flagged degenerate. A 5.3 h running-fix advance widens the ellipse to 10.9 × 2.4 nm. `logs/fix-solver.txt` | pass |
| E1 | First impression, desktop 1280×800 | `e2e_1`: fresh load, screenshot, errors | Opens in evening twilight near Bermuda. Guide step 1/6, planner suggests three stars (rings on deck), clock running. No console errors. `screenshots/01-initial-desktop.png` | pass |
| E2 | **Commitment 1**: sight by hand → LOP | `e2e_1`: click planner row → click the star on the canvas → *Take sight* → arrow keys until the image touches the horizon → Space when roll ≈ 0 | Antares: reading error −0.014′, LOP passes **0.09 nm** from the hidden true position. The on-screen working shows Hs → IC → dip → Ha → refraction → Ho → GHA/SHA/Dec → LHA → Hc/Zn → intercept. `02-body-card.png`, `03-sextant-eyepiece.png` | pass |
| E2b | Commitment 1: deliberate misalignment | `e2e_2` (E5): align, then 10 × ArrowDown (+5′) and mark, with practice mode on | Reading error +4.96′, so the LOP moved **4.90 nm toward** the body (intercept 4.3 T → 8.7 T), as predicted. The two aligned reference sights were 0.3 and 0.55 nm off. `09-practice-misaligned-sight.png` | pass |
| E3 | **Commitment 2**: fix from three bodies | `e2e_1`: Antares, Arcturus, Eltanin, cut 63° | Fix **0.76 nm** from truth, 95% ellipse 2.0 × 2.0 nm, sights re-worked 1× because intercepts were long (DR 27 nm off). Morning fix (Sirius, Aldebaran, Alpheratz) **0.44 nm**. `04-three-lops-fix.png`, `05-morning-twilight.png` | pass |
| E3b | Commitment 2: geometry matters | `e2e_2` (E6): Antares + Rasalhague (about 12° apart in azimuth), then Arcturus + Alphecca (0.03° apart) | Poor cut (12.6°) gives a 15.8 × 1.7 nm ellipse and a "Poor cut" warning. That fix is 3.1 nm off. Near-parallel gives "almost parallel … cannot fix a point". `10-poor-cut.png`, `11-parallel-lops.png` | pass |
| E3c | Commitment 2: running fix (Sun only) | `e2e_3` (E7): Clipperton morning Sun lower-limb sight, *Local noon*, noon sight | Running fix error 5.0 nm (current during the 5.3 h advance). Ellipse widened to 10.9 × 2.4 nm, with a running-fix explanation. `12-sun-lower-limb.png`, `13-running-fix.png` | pass |
| E4 | **Commitment 3**: fixes find the island | `e2e_1`: adopt fix → *Steer for Bermuda* → *Next star twilight* → 3 stars → adopt → steer → *+1 h* × 6 | "Land ho! Bermuda" at 21.7–21.8 nm (visibility range 21.8 nm), about 17 h after the start. Debrief shows the stats and the hidden current. The chart reveals the true track. `06-landfall-debrief.png`, `07-true-track-revealed.png` | pass |
| E4b | Commitment 3: DR only misses | `e2e_2` (E4): *Steer for Bermuda* from the starting DR, *+6 h* jumps, no sights | Closest sampled approach 30.2 nm, which is outside the 21.8 nm range. Ends "Out of water: … DR was 81 nm from where you really were". `08-dr-only-out-of-water.png` | pass |
| E5 | Second path: unknown clock error | `e2e_3` (E8): Pitcairn stars → fix; steer for the island's parallel 60 nm east (by fix); evening fix; turn west on the parallel | First fix: latitude within **0.09′**, longitude **1.510° west**. A 360 s chronometer error gives 1.50°, as designed. Latitude sailing makes landfall at dawn (13.4 nm), about 48 h in. Debrief explains the chronometer. `15-pitcairn-debrief.png`, `16-pitcairn-chart-truth.png` | pass |
| E5b | Second path: Clipperton | `e2e_3` (E7) | Landfall at 14.5 nm (day range of a 29 m atoll), 9 h 45 m. `14-clipperton-landfall.png` | pass |
| E6 | Changed input not in the seeded examples | Voyages → *Design your own passage*: invalid values first, then 2031-06-21 20:45 UTC, start 37.60 N 28.40 W, island Flores, calm sea, chronometer −40 s, practice on | Latitude 95 is rejected ("between −70 and 70"). 12 nm from the island is rejected ("at least 30 nm"). Year 1949 is rejected ("1950–2050"). The valid voyage starts at sunset with the Sun suggested. A Sun sight with −0.3′ reading error still gives a 7.8 nm LOP error, which is the chronometer's 10′ of longitude. The practice panel now says so. Run interactively; the datetime was set by script (see limits). | pass |
| E7 | Export → change → import round trip | `e2e_4` (E9): `download #btnExport`, *+6 h*, `upload` the file | Time, true position, DR, sights (identical Hs) and fixes are restored. The clock is held after import. | pass |
| E8 | Invalid imports keep state | `e2e_4` (E10): not-JSON, wrong app, sight Hs = 400, year 1900, speed 99 kn | Five specific error toasts ("…Your current voyage is unchanged."). Time and sight count are unchanged after each. `17-invalid-import-toast.png` | pass |
| E9 | Whole-session Reset | `e2e_4` (E11): practice on, rough sea, sound on, labels off, 2 sights, then click Reset | Back to 22:19:00, no sights or fixes, starting true position, DR and leg, clock running. Audio off, labels on, guide shown, sea moderate, practice off. | pass |
| E10 | Reset invalidates pending work | `e2e_4` (E12): start an import, then Reset in the same tick **(synthetic: the File object is built with DataTransfer and dispatched as a `change` event; Reset is a DOM `click()`)** | The in-flight import is ignored: no sights, and only the "Session reset" toast. The landfall debrief timer is also guarded by the session generation (code review). | pass |
| E11 | Abandon / retry | Helm → *Abandon voyage* → *Sail it again* | Debrief "Voyage abandoned …". Retry restores the voyage start state. `28-abandon-debrief.png` | pass |
| E12 | Narrow 390×844 | `e2e_5` (E16): tap star → card → *Take sight* (full-screen sextant) → drag eyepiece 50 px → tap ±0.2′ buttons → MARK → Chart, Sights, Helm, Planner tabs | No horizontal overflow (scrollWidth 390) before and after navigation. The drag turned the drum (+9.3′). The mark by buttons gave a −0.22′ error and a 0.29 nm LOP error. `18–24-narrow-*.png`, `29-narrow-voyages.png` | pass |
| E13 | Opaque-origin sandbox iframe `sandbox="allow-scripts allow-downloads"` | `e2e_5` (E17) with `tests/sandbox-harness.html`; external `https://**` requests aborted by `network route` | App boots with no storage access needed. Canvas click → Take sight → keys → Space logs "Sight #1". Import (upload into the frame) restores a log. Export downloads `starfix-bermuda-1Oct2026-2219.json` when the session has a `--download-path`. `25-sandbox-iframe.png` | pass (see limits) |
| E14 | Direct `file://` open, network offline | `e2e_5` (E18): `set offline on`, then open `file:///…/index.html` | `performance.getEntriesByType('resource')` is 0 (nothing fetched). A sight was taken and there are no errors. `26-file-protocol.png` | pass |
| E15 | No external requests over HTTP | `agent-browser network requests` | Only the local `index.html` documents. The earlier favicon 404 was fixed with an inline SVG icon. The `data:` SVG entry is Chrome's own datetime-picker icon. Static scan: no `src=`/`href=` to URLs, no `fetch`, no storage APIs. | pass |
| E16 | Pointer cancel and focus loss | `e2e_4` (E14): real mouse drag on deck and eyepiece; **(synthetic)** `pointercancel` event and `window` `blur` event | Deck drag ends without selecting a body. Eyepiece drag ends on blur, and further mouse movement no longer turns the drum. Enter on the deck opens the sextant for the selected body. | pass (synthetic events) |
| E17 | Performance | `tests/fps.js` requestAnimationFrame probe, 180 frames | Deck (about 990 stars, sea, glitter): median 16.7 ms, p95 16.7 ms. Eyepiece: median 16.7 ms, p95 16.8 ms (60 fps). The chart only redraws when dirty. | pass |
| E18 | Audio after a user gesture | `e2e_4` (E13): click *Sound off* → *Sound on* → *Sound off* | AudioContext state goes `off` → `running` → `off`. **I did not hear the audio.** Only its state was inspected. | partial |
| E19 | About view and references | Click *About this idea* | 11 source entries (14 URLs) as text spans (`user-select: all`, no anchors, nothing fetched). The text matches research.md. One overclaim ("sailing simulators lack a sextant") was corrected to what the source shows (eSail). `27-about.png` | pass |
| E20 | Console / uncaught errors | `agent-browser errors` after every script | Empty in every final run. | pass |

## The three commitments

1. **Hand-taken sight → correct LOP: fulfilled** (U1, E2, E2b). An aligned sight lands within 0.1 nm of the truth. A 5′ misread moves the LOP 4.9 nm toward the body. Almanac values match Astron within 0.11′.
2. **Fix quality follows the navigator's choices: fulfilled** (E3, E3b, E3c). Spread bodies give sub-mile fixes. A 12.6° cut gives a 15.8 nm ellipse and a warning. Parallel LOPs are refused. Running fixes widen honestly.
3. **Voyage with a hidden current: fulfilled** (E4, E4b, E5, E5b). With no sights the ship misses Bermuda and runs out of water. Fixes lead to landfall. Reset and restart restore the initial state (E9, E11).

## Failures found in the browser, their fixes and retests

Most of these would not have been caught by logic tests alone:

1. **Horizon off-screen at start.** The camera pitched up to a high star. Fix: `frameAlt()` keeps the horizon in view. Retested in E1.
2. **Swing asymmetry.** The lateral swing of the tilted sextant always went to one side because `sign(φ)` was applied twice. Fixed; eyepiece retested.
3. **Page shifted under the header.** Automated scroll-into-view scrolled the `overflow:hidden` body, and clicks landed on the wrong element. Retested: the layout is locked and the document scroll is 0.
4. **Helm rebuilt every frame.** The real-time clock bumped the state tick 60×/s, so the Helm panel (including inputs) was rebuilt every frame. This stole focus and caused misclicks. Fix: only discrete events re-render, panels use `setHTML` diffing, and a focused input defers the rebuild. Retested (course typed with `fill` + Tab).
5. **Scenarios too forgiving.** In Clipperton and Pitcairn, DR-only sailing reached the island. Found by an offline Node sweep of closest approach. Fix: Bermuda current 1.1 → 1.4 kn; Pitcairn start moved north of the island with a larger DR error; Clipperton DR error reversed. Retested in E4b (miss 30 nm), E5 and E5b.
6. **Running-fix ellipse too small.** It (2.7 × 2.2 nm) failed to cover the true error (5.4 nm). Fix: weighted LOPs whose sigma grows 0.8 nm per hour of advance. Retested in U2 and E3c (10.9 × 2.4 nm).
7. **Latitude bias from long intercepts.** Pitcairn fixes carried a 2.8′ latitude error because 60–127 nm intercepts were plotted as straight lines. Fix: the fix is iterated by re-reducing from the provisional fix. Retested: latitude error 0.38′.
8. **"Next star twilight" jumped only 7 minutes.** It mixed true-position and DR sun altitudes. Fix: DR-based and always the next window. Retested in E5.
9. **Narrow sextant overlay.** It sat under the sticky tab bar, was see-through, and its drum buttons overflowed. Fix: z-index, opaque background, 3-column drum. Retested in E12.
10. **Invisible island at landfall.** The island was sub-pixel at the exact visibility limit. Fix: a small minimum silhouette plus a bearing and distance label. Retested in E5 and E14 screenshots.
11. Smaller fixes, retested in the final runs:
    - The daytime planner listed every invisible star. It now shows the Sun and a note.
    - Toasts stacked duplicates.
    - The chart did not fit on first show on narrow screens and did not fit after a sight.
    - The ⏸ glyph rendered as a box.

## Blocked, partial or not run (honest limits)

- **Audio listening: not done.** Only the AudioContext state was inspected (E18). No claim is made about how the sea wash, chronometer tick or bells sound.
- **Touch: partial.** The narrow-viewport flow was driven with mouse pointer events (`pointerType: mouse`). The code uses pointer events with `touch-action: none` on the canvases, but real touch input was not emulated. agent-browser 0.31 touch emulation was unreliable in a previous session (memory LS-0006), so I did not use it.
- **`pointercancel` and window focus loss: synthetic events** (E16). The browser tool cannot produce OS-level focus loss.
- **Inside the sandboxed iframe, `eval` is blocked** (opaque cross-origin frame). Validation there used the accessibility tree, screenshots and real input. The agent-browser `download` command could not observe a download started from the out-of-process iframe. Its success was proven instead with a fresh browser session using `--download-path` (E13).
- **Offline emulation:** with `set offline on` before a `file://` open, `navigator.onLine` still reported `true`. So the emulation's effect is not independently confirmed. The measurement that matters, zero resource fetches, was made directly (E14).
- **`datetime-local` input:** agent-browser `fill` could not type into Chrome's segmented date control. The custom-voyage date was set with `input.value = …` before a real submit click. Other form fields were typed with `fill`.
- **Not tested:** other browsers (Firefox, Safari); real high-DPI hardware (the canvases scale by `devicePixelRatio`, capped at 2, as reviewed in code); screen readers beyond the accessibility-tree snapshot.

## Remaining limitations of the product

- No Moon, planets, clouds or haze variation. Refraction uses standard conditions.
- The sea model is sextant roll plus horizon roughness. Personal error and abnormal refraction are not modelled.
- The Earth is a sphere and the chart is a local flat projection. Custom voyages are limited to ±70° latitude and 900 nm, and the almanac to 1950–2050.
- Island visibility uses the geographic-range rule plus a haze cap, and lights are simplified (a 10 s flash is a stylisation). Scenario currents and DR errors are invented for play.
- The deck labels navigational stars by default. Identifying stars by constellation, as real navigators must, is optional: turn off *Star names*.
- No undo. This is a game, with restart, abandon, per-sight delete and export/import instead.
