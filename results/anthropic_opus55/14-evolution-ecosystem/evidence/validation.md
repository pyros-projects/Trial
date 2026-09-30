# Evolution Lab: validation record

Artifact: `index.html`, a single self-contained file of about 189 KB. It has no imports, fonts, images or network calls; the favicon is `data:`.
Browser tooling: `agent-browser` 0.31.1 (headless Chromium), used with its version-matched `core` skill.
There is one supplement, `tests/cdp-input.mjs`. It sends trusted CDP `Input.*` events (wheel at the cursor, multi-touch pinch/tap/drag) to the same browser session. I needed it because the agent-browser 0.31.1 `mouse wheel` command always fires at client (0,0). I confirmed that with an in-page event log (`[["topbar",240,0,0]]`).

Most browser checks ran on `file://` directly. One check ran on local HTTP (`uv run python -m http.server 8765`).

Most flows below were run on intermediate builds during development. The fixes those runs triggered are listed under the flow. The final build then got a compact regression (`logs/final-regression.txt`) and the headless suite (`tests/sim-tests.out`).

## Results

| Check | Result | Evidence |
|---|---|---|
| Direct `file://` load, no console/page errors | pass | screenshots/01, logs/final-regression.txt |
| No external requests (grep of the artifact + HTTP request log with `https://**` aborted) | pass: the only request was `GET /index.html` | see HTTP section |
| Pause (Space), single step (`.` = exactly +1 tick), resume | pass: 49→50→52, idle while paused | final-regression |
| Real mouse click selects an organism (paused and while running) | pass | screenshots/02, 03 |
| Inspector updates from live state (energy, age, sensors, utilities, steering) | pass: values changed between samples; the followed herbivore was then killed by a predator and the inspector switched to its death record | screenshots/03, 04 |
| Follow (F), cursor-anchored wheel zoom (CDP) | pass: z 0.377→0.687, organism under the cursor moved ≤1 px | |
| Deterministic reset (two UI resets, same seed → same hash at tick 3000) | pass: `99b840bc`=`99b840bc`; final build `7aca9bf7`=`7aca9bf7` | final-regression |
| Save file → Load file restores exact state, and the continuation is bit-identical | pass: final build saved `ee0a97b0` = loaded; original@7000 `9209cbe6` = loaded-continued@7000 | final-regression, files/save-t6000.json |
| Load errors: bad JSON, wrong format, truncated field, old organism layout → message shown, sim kept | pass (4/4) | screenshots/10, final-regression |
| Autosave → page reload → Restore | pass. Intermediate build: hash `cf5acc08` restored exactly. Final build: the first attempt was invalid because the reloaded page was running when sampled. Re-check with the sim paused: autosaved tick 6000 `ee0a97b0` → reload → Restore → tick 6000 `ee0a97b0`, match | logs/final-autosave-recheck.txt |
| Drought A/B vs deterministic control | pass: moisture 0.43→0.07, plants 39k→20k, population 238→14 by tick 6000 | |
| Predator introduction A/B | pass: herbivores 108 vs 143 (t4500), 76 vs 180 (t6000) | |
| Food painting via real mouse drag | pass: regional plants 7.3k→15.8k; region held 26 vs 16 organisms 1500 ticks later | screenshots/08 |
| Spawn, remove, terrain (rock→water→sand), fertility, climate heat/dry, barrier drag, reserve drag | pass: each changed the targeted cell/state | screenshots/09 |
| Lineage highlight (50 archived descendants, 24 alive), ancestry tree, phylogeny row click, species list click | pass | screenshots/05 |
| All 8 chart tabs, hover tooltip from retained samples, trait histogram | pass | screenshots/06, 07 |
| All 14 colour modes and all 6 overlays (rays, steering, targets, spatial hash, decisions, vision) | pass | screenshots/11, 12, 23 |
| CSV export (68 samples × 49 cols), PNG export (1232×1504 at DPR 2) | pass | files/history.csv, files/view.png |
| High-DPI backing store, live resize (1280×800 → 1000×700) | pass | screenshots/20 |
| 390×844: no horizontal overflow, panel tabs, touch tap-select, one-finger pan/paint, two-finger pinch (no stray paint) | pass after fixes | screenshots/13–18 |
| Performance, stress preset (3–4.5k organisms) | 60 fps at 1×, 59 fps at 4× (127 ticks/s), 37 fps at Max (292 ticks/s). Painting at 16×: input-to-frame latency median 17 ms, worst 21 ms; the stroke was continuous | screenshots/19 |
| All 7 presets × 4 modes at Max, in-page error capture | pass: 0 errors | |
| Mass extinction preset: crash at the tick-5400 event marker (down to 23), recovery to 427 by tick 12k | pass | screenshots/21, 22 |
| Headless suite `node evidence/tests/sim-tests.mjs` (29 checks against the sim embedded in index.html) | pass: 29/29 | tests/sim-tests.out |
| Audio | not applicable (the app has no audio) | |

## Failures found and fixed (each retested)
- Herbivores could sense and eat carrion (diet 0.06 passed the threshold). Raised the threshold to meat efficiency > 0.3.
- Global key handler swallowed arrow keys on focused sliders and Space on focused buttons. Form controls now keep native keys, and mouse-clicked buttons blur themselves.
- Mobile: picking a tool scrolled the canvas off-screen, and toasts blocked taps. The stage is now pinned with the panel scrolling internally; plain toasts are click-through and sit at the top on narrow screens.
- A touch pinch left a stray brush dab. Touch strokes now commit after 90 ms or on movement.
- Headless suite caught a save/load continuation divergence: the new vigilance logic read unsaved sensor state. Crowding is now a persisted organism field; retest 29/29.
- Ecology: predators overhunted and then collapsed; predator–prey preset went fully extinct. Fixed with satiety that counts stomach contents, a stamina mechanic, "many eyes" vigilance, dilution (hunters prefer isolated prey), a carnivore basal premium, and a warm thermal niche for omnivores. Predator–prey now coexists on 3/3 seeds for 20k ticks (logs/predprey-stabiliser-sweep.txt, logs/preset-sweep.txt).
- Harness mistake (not an app bug): a relative upload path made the first load fail. The app correctly reported "Could not read file" and kept the sim.

## Known limitations
- Dedicated scavengers usually die out within 4–9k ticks in balanced/desert/extinction. The carrion flux is only about 1–2 meat/tick world-wide and they are hunted. Scavenger phenotypes do re-emerge in rapid radiation. Omnivores fade after about 12k ticks in balanced on some seeds; the desert ends herbivore-only.
- The lineage archive is capped at 12,000 records. Old dead ancestors get pruned, and pruned links show as "pruned".
- Autosave uses localStorage (about 1.2 MB per save). Very large worlds can exceed the quota; the UI reports it and points to Save file.
- Final-build ecology runs (20k ticks × 3 seeds, `logs/final-predprey.txt`, `logs/final-balanced.txt`): predator–prey coexists on 3/3 seeds, with herbivore minimums of 3–14 before recovery, so it is close to the edge. In balanced, herbivores and predators persist on 3/3 seeds; omnivores fade at 10–12k ticks and scavengers at 4–7k.

## Commands
- Build fragments → `index.html`: scratch `build.sh` (cat + `node --check`).
- Headless: `node evidence/tests/sim-tests.mjs`; `node evidence/tests/ecology-eval.js <preset> <ticks> <seeds…>`.
- Browser: `agent-browser open file://…/index.html`, `snapshot -i`, `mouse move/down/up`, `press`, `select`, `check`, `upload`, `download`, `set viewport 390 844` / `1280 800 2`, `screenshot`, `eval`. Wheel/touch: `node evidence/tests/cdp-input.mjs "$(agent-browser get cdp-url)" wheel|pinch|tap|touchdrag …`.
