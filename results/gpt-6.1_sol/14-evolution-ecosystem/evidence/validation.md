# Evolab validation record

Agent-authored validation, 2026-09-29–30. This is a development record, not an evaluator score. Delivered artifact: `../index.html` (all markup, styles, SVG assets, engine, charts, and interface embedded). No build or runtime server is required.

## Environment and tools

- Installed agent-browser **0.31.1**, Chrome **143.0.7499.40**, Node **25.8.1**.
- Read `.agents/skills/agent-browser/SKILL.md`, then `agent-browser skills get core`, `agent-browser skills get dogfood`, and relevant full command references before automation.
- Main sessions: `evolab` (direct file), `evolab-offline` (offline HTTP/mobile), and `evolab-touch` (fresh native-touch and final direct-file checks).
- Desktop: **1280 × 800**, including **DPR 2**. Narrow: **390 × 844**, including iPhone 12 emulation at **DPR 3**.
- `python3 -m http.server 8874 --bind 127.0.0.1` was a temporary inspection server. An initial attempt on 8765 found that port already occupied; the existing service was left alone.

## Commands and genuine workflows

Commands below use the workspace as their working directory. JSON files and logs preserve measured state. Browser `eval` reads live diagnostics; it does not fabricate organisms, measurements, or curves.

### Standalone and offline delivery — PASS

```
agent-browser --session evolab set viewport 1280 800
agent-browser --session evolab open file:///home/pyro/projects/naked/sol61/14-evolution-ecosystem/index.html
agent-browser --session evolab snapshot -i
agent-browser --session evolab errors
agent-browser --session evolab console
```

The file loaded directly, rendered the world, and responded to controls. Final direct-file retest used `evolab-touch`, `set viewport 1280 800 2`, keyboard Space on the canvas, reset, 4× playback, and `wait --fn 'window.ecolab.state.tick >= 200'`. At tick 203 there were **340 living agents, 174 births, 30 deaths, 280 mutated traits, and generation 2**. See `logs/direct-file-main-workflow.json` and `screenshots/final-desktop.png`.

For HTTP without external internet or external cached assets:

```
agent-browser --session evolab-offline --args '--proxy-server=http://127.0.0.1:9,--proxy-bypass-list=localhost;127.0.0.1' open http://127.0.0.1:8874/index.html
agent-browser --session evolab-offline set viewport 390 844
```

A test-only `fetch('https://example.com/')` rejected with `Failed to fetch`; local HTTP remained reachable (`logs/offline-proxy-probe.json`, `offline-network-probe.txt`). That intentional failed probe is separate from app failures. Requests during app workflows were local document navigations only. Static inspection found **no external src/href references and no fetch, XMLHttpRequest, WebSocket, or importScripts calls in index.html**. Final console and uncaught-error logs are empty (`final-console.txt`, `final-console-errors.txt`). Direct-file opening is **passed**, not blocked.

### Feeding, reproduction, mutation, death, and response — PASS

```
agent-browser --session evolab click '#pauseBtn'
agent-browser --session evolab click '[data-speed="16"]'
agent-browser --session evolab click '#pauseBtn'
agent-browser --session evolab wait --fn 'window.ecolab.state.tick >= 1800'
agent-browser --session evolab click '#pauseBtn'
agent-browser --session evolab eval 'window.ecolab.diagnostics()'
```

The tuned browser run retained **143 grazers, 31 hunters, and 172 decomposers**, with **493 births, 343 deaths, and 825 mutations** (`browser-tuned-evolution.json`). Feeding and predation counters came from energy transfers and actual attacks. The independent engine run at precisely 180 seconds retained **124 / 39 / 172**; browser pause clicks can occur several ticks after a wait threshold.

Rapid radiation was selected through the preset control, run at 16× past tick 300, and paused. It produced **448 living agents, 191 living genetic clusters, generation 3, 266 births, and 2,391 mutated traits** (`rapid-radiation.json`, `screenshots/radiation-species.png`). These are actual distance-based clusters, not a scripted count.

Interventions were clicked through their labeled controls, with keyboard single-step or the step button where a tick was needed:

- Bloom: resources increased from about **4,847 to 8,574** units.
- Drought: mean moisture fell to **0.224**, with plant growth affected. A matched deterministic engine replay also confirmed lower resources than the untreated world after 50 seconds.
- Hunters: population increased **196 → 214**.
- Cold snap and disease: active interventions, climate fields, and illness were inspected after a real step.
- Extinction: population fell **214 → 59**, with **155 deaths** recorded immediately.

See `logs/intervention-*.json`. Protected observation cells exempt organisms from predation, disasters, and climate injury, while ordinary aging and metabolism continue.

### Pause, step, seeds, and keyboard controls — PASS

- A real pause stopped the clock; single-step changed **tick 503 → 504**, exactly one tick (`browser-pause.json`, `browser-step.json`).
- Two paused Reset button clicks with `meadow-42` produced identical complete initial snapshots (`reset-a.json`, `reset-b.json`). Engine tests also verify identical seeded continuation.
- Canvas Space toggled pause/resume; `.` advanced one tick. Mouse pan, wheel zoom, zoom buttons, and Fit world changed the live camera (`pan-zoom.json`).
- Keyboard Home/End on labeled range controls changed engine values to food growth **0**, mutation rate **1**, magnitude **0.6**, metabolic cost **3**, reproduction threshold **70**, sensor multiplier **2**, and climate amplitude **2** (`parameters-keyboard.json`).

### Selection, follow, ancestry, and retained charts — PASS

A live generation-2 decomposer was selected with actual pointer input:

```
agent-browser --session evolab mouse move 633 468
agent-browser --session evolab mouse down
agent-browser --session evolab mouse up
agent-browser --session evolab click '[data-action="follow"]'
```

Organism **596**, parent **277**, had four recorded inherited mutations. Its age changed **78.7 → 107.7 seconds**, energy **76.43 → 74.30**, sensors and decisions changed, and its genotype remained identical. The follow camera equaled its live position (`selected-before.json`, `selected-after.json`). The ancestry tree showed founder **171 → 277 → 596 → 602 → 686** with generations and mutations (`screenshots/lineage-tree.png`). Species clicks highlighted actual members.

Observation, Analytics, and Lineages were navigated through labeled tabs. Nine chart panels showed retained history and live trait histograms. Population, births/deaths, average energy, biomass, diversity, generations, resources, age, and living species are sampled from real engine state. CSV export contained **91 retained samples**, from time **0 to 180**, with **22 numeric columns** (`history.csv`).

All **13 visualization modes** were selected and their legends checked (`all-modes.txt`). Energy, sensors, moisture, temperature, species, and behavior received rendered screenshot inspection. All five overlays were enabled through checkboxes and inspected (`screenshots/all-overlays.png`).

### Habitat editing and accelerated input — PASS

Actual pointer down/move/up strokes used the toolbar:

- Food stroke: resources **4,846.61 → 5,063.00** while paused.
- Spawn hunter: population **196 → 197**, with a new lineage record.
- Sanctuary brush: **14 protected cells**.
- Barren habitat and warm climate strokes changed fertility and heat. Warm painting now changes visible temperature immediately while paused.
- Barrier painting at **16×** created **32 barrier cells**, with **0 agents left inside blocked terrain**, and **60 FPS** at the sampled moment.
- Erase retest removed barriers **29 → 0**. A separate pointer stroke centered on a living organism removed nearby agents; inspector Remove also removed its selected agent and retained the archived death record (`remove-inspector-*.json`, `remove-brush-after.json`).
- Pan drag and mouse wheel changed camera position/zoom; Fit restored the full-world view.

Exact stroke points are retained in tool-call logs and summarized by `tools-*.json`, `erase-before.json`, `pan-zoom.json`, and `screenshots/habitat-edited.png`.

### JSON, device persistence, CSV, and PNG — PASS

```
agent-browser --session evolab click '#saveBtn'
agent-browser --session evolab download '#downloadJson' evidence/complete-snapshot.json
agent-browser --session evolab click '#resetBtn'
agent-browser --session evolab click '#loadBtn'
agent-browser --session evolab upload '#importFile' /home/pyro/projects/naked/sol61/14-evolution-ecosystem/evidence/complete-snapshot.json
agent-browser --session evolab wait --text 'Snapshot loaded.'
```

A second UI download after loading was **exactly equal**, including organisms, evolved genes, lineage, RNG, terrain, history, interventions, and camera/settings (`complete-snapshot.json`, `reloaded-export.json`). The browser tool's numeric diagnostic serialization can round the last floating-point digit; the two actual downloaded JSON files are the equality check.

Save on device → Reset → Load device save preserved all extreme parameter values. Reload restored the autosave and paused it (`device-restored-raw.txt`, `reload-autosave.json`). Missing accounting and malformed live-mutation files were rejected before swapping the current world; the former left the complete state unchanged (`after-invalid-snapshot.json`, `screenshots/import-rejection.png`, `mobile-invalid-import.png`).

The original browser JSON, CSV, and PNG downloads succeeded. Later `agent-browser download` attempts canceled and introduced duplicate page targets. Supplementary **native CDP mouse input in the same agent-browser browser**, with the active page resolved by a temporary diagnostic marker, produced a completed JSON transfer of **439,142 bytes**, plus CSV and PNG (`download-active-page.json`, `offline-*-completed.json`, `native-downloads/`). This supplements the installed tool; no runtime dependency was added. PNGs are real nonblank Canvas captures: **709 × 298** and **360 × 301**. Rendered captures were inspected, and PNG headers/compressed raster content were checked.

### Narrow layout, high DPI, touch, and stress — PASS with automation caveats

Environment and Inspector drawers opened and closed at **390 × 844**. Presets, compact world size, temperature view, inspection, ancestry, and analytics were exercised. No horizontal page overflow was observed. Screenshots include `mobile-initial.png`, `mobile-controls.png`, `mobile-islands-validated.png`, `mobile-inspector.png`, `mobile-lineage.png`, and `mobile-analytics.png`.

The CLI has no Linux command for arbitrary simultaneous touch points. `tests/touch.mjs` connects to **agent-browser's own CDP endpoint** and uses Chrome's native `Input.dispatchTouchEvent`, not synthetic DOM pointer events. It reads the canvas bounds, performs two-finger pinch, releases finger 2, moves finger 1, and checks actual camera state and native pointer events.

```
agent-browser --session evolab-touch --args '--proxy-server=http://127.0.0.1:9,--proxy-bypass-list=localhost;127.0.0.1' open http://127.0.0.1:8874/index.html
agent-browser --session evolab-touch set device 'iPhone 12'
agent-browser --session evolab-touch click '#mobilePause'
agent-browser --session evolab-touch click '#fitBtn'
agent-browser --session evolab-touch get cdp-url > evidence/logs/touch-cdp-url.txt
node evidence/tests/touch.mjs evolab-touch
```

The fresh iPhone session passed at **390 × 844 / DPR 3**: zoom **0.8223 → 1.5075**, then the remaining finger moved the camera **(820.49, 550) → (717.33, 485.53)**. Native pointer events targeted the world canvas (`touch-fresh-final.json`). Repeated navigation and legacy duplicate-target sessions sometimes emitted **no native events**; those attempts are **failed/blocked automation attempts**, preserved in `touch-primary-*` and `touch-fresh-red/retest` logs, and are not counted as successful tests. The passing fresh native session is the touch coverage. The initial touch harness also ended the wrong finger; it was corrected and raw event logs retained.

Dense preset: **1,500 initial organisms**, **60 FPS** near tick 100. At 16×, the measured speed was **15.96×**, **56.4 FPS**, and **1,227 living agents** (`stress.json`, `stress-accelerated.json`). This is one machine's measurement, not a hardware-independent performance guarantee.

## Failures found, fixes, and retests

1. **Ecological imbalance — fixed.** Initial hunters eliminated grazers within about three minutes (`browser-evolved.json`). Inherited fear now increases escape speed with its movement cost, and attacks spend energy. Matched seeded and actual browser reruns retained all three roles.
2. **Restored legend mismatch — fixed.** Save moisture view, switch to energy, reload: colors restored to moisture while legend remained energy (`legend-before-fix.png`). Loading now refreshes the legend; the identical flow shows Dry/Wet (`legend-retest.png`).
3. **Toolbar clipping — fixed.** Erase was below the Canvas region and covered by the footer at 1280×800 (`tools-clipped-before.png`, `tool-clipping.webm`). Compact toolbar rows and bounded scrolling make it reachable; erase was clicked and its actual effects verified (`tools-retest.png`).
4. **Incomplete snapshot acceptance — fixed.** Missing totals or terrain coordinates could pass validation. Restore validates all mandatory state sections and numeric fields before applying state; regression checks reject both.
5. **Malformed mutations and ID reuse — fixed.** Review found `[null]` in live mutation arrays and an ID counter that could overwrite archived organisms, including unsafe integers. Live/archive genetics and mutation records must agree; counters are safe integers greater than all archived IDs. Regression and UI invalid-import checks pass.
6. **Introduction cap mismatch — fixed.** Repeated Hunters could exceed 4,000 although restore rejected that state. A central creation cap now limits reproduction, spawning, and introduction, with accurate user feedback. Stress plus 140 introductions remains saveable in the regression test.
7. **Total habitat removal — fixed.** While paused, painting all habitat into barriers left killed agents in living counts. Painting now filters deaths immediately, and the resulting empty world round-trips through persistence.
8. **Pinch-to-pan interruption — fixed.** Releasing one finger cleared dragging. It now reinitializes pan dragging for the remaining pointer. Event-handler reproduction and the fresh native-touch browser test verify the correction.
9. **Paused climate feedback — fixed.** Heat/moisture modifiers previously became visible only after stepping. Painting now updates the visible fields immediately; the regression test passes.
10. **Saved obstacle target — fixed.** Final review found that an obstacle target missing x/y could create NaN steering on the next step after import. Restore now rejects incomplete/nonfinite avoidance coordinates and negative distances before applying state. The red test reproduces the missing rejection (`obstacle-red.txt`); the final regression passes. A real file upload displays the rejection and preserves the complete prior snapshot (`obstacle-import-browser.json`, `screenshots/obstacle-import-rejection.png`). Loading the valid evolved snapshot then single-stepped **2105 → 2106**, retaining 316 finite live agents (`obstacle-valid-continuation.json`).

Some high-level clicks tried to target offscreen controls behind their panel header. Explicit `scrollintoview` resolved those automation attempts; Reset also returns the control panel to its top. Relative upload paths failed in Chrome; absolute paths worked. Neither was recorded as a successful attempt.

## Automated verification and review

```
node evidence/tests/engine.cjs
node evidence/tests/edge-cases.cjs
```

**PASS: 6 engine checks and 11 edge-case checks** on the delivered implementation (`logs/engine-final-verification.txt`, `logs/edge-final-verification.txt`; earlier delivery logs predate the eleventh edge check). Tests cover deterministic worlds/continuation, genuine ecological events, inheritance, energy transfer, drought response, invalid state, role coexistence, malformed imports, lineage counters, cap behavior, paused habitat loss, and immediate climate feedback. Red logs preserve the failures before fixes. An independent review also ran through 600 simulation seconds without numerical crashes, including a tuned 4,000-agent stress world.

### Final malformed-import and continuation retest — PASS

```
agent-browser --session evolab-touch reload
agent-browser --session evolab-touch eval 'window.__obstacleImportBefore=JSON.stringify(window.ecolab.snapshot())'
agent-browser --session evolab-touch click '#loadBtn'
agent-browser --session evolab-touch upload '#importFile' /home/pyro/projects/naked/sol61/14-evolution-ecosystem/evidence/invalid-obstacle.json
agent-browser --session evolab-touch wait --fn 'document.getElementById("loadError").textContent === "Invalid saved obstacle avoidance."'
agent-browser --session evolab-touch eval 'JSON.stringify(window.ecolab.snapshot())===window.__obstacleImportBefore'
agent-browser --session evolab-touch screenshot evidence/screenshots/obstacle-import-rejection.png
agent-browser --session evolab-touch upload '#importFile' /home/pyro/projects/naked/sol61/14-evolution-ecosystem/evidence/complete-snapshot.json
agent-browser --session evolab-touch wait --fn '!document.getElementById("loadDialog").open'
agent-browser --session evolab-touch click '#stepBtn'
agent-browser --session evolab-touch errors
agent-browser --session evolab-touch console
```

The full-state equality check returned true after rejection. Valid continuation advanced one tick without invalid agent coordinates or physiology; the final console and uncaught-error files are empty (`logs/final-browser-console.txt`, `logs/final-uncaught-errors.txt`). Final artifact parsing confirmed both embedded scripts compile, no external asset references, and no runtime networking (`logs/final-artifact-audit.json`).

## Remaining limits and checks not claimed

- No unresolved application failure was observed in the passing main workflows. Native-touch automation after repeated navigation was unreliable; those runs are not passes.
- Mobile is Chrome device emulation, not a physical handset. Cross-browser coverage beyond Chrome is **not run**.
- Ancestry previews show at most 160 nodes, 7 generations, and 12 children per node; complete records remain in snapshots. History retains 2,400 samples (80 simulation minutes). Import limits are 100 MB, 1,000,000 lineage records, and 50,000 archived species. Device autosave is subject to browser storage quota; JSON download remains available.
- Long-run numerical review reached 600 seconds; all presets are implemented, but indefinite survival or periodic oscillation for every seed is **not claimed**. Ecology can go extinct under user interventions.
- Audio is not an application feature; no audio quality or playback claim is made.
