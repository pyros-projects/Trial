# Validation record — evo. ecosystem laboratory

Agent-authored evidence. No evaluator score is claimed.

Environment: Chrome 143.0.7499.40, agent-browser 0.31.1, Node v25.8.1. The installed agent-browser skill, CLI version-matched core workflow, full command reference, and exploratory-testing workflow were read before use.

Final result: PASS for the tested delivery requirements. `../index.html` is a 133,463-byte standalone artifact (SHA-256 `b1db819aa894d4a11462c2e5163248aeba22b2a3857698aaccd41827a194752a`). It was opened directly with a `file://` URL while the browser was offline and HTTP/HTTPS requests were blocked. No external requests, console errors, or uncaught exceptions occurred in the final desktop/mobile runs. All 89 distinct browser assertions have a passing final result. Limitations are stated at the end of this record.

## Implementation checks
- RED: `node evidence/engine-tests.cjs` initially failed because the application did not exist.
- PASS: after implementing and correcting the real engine, the same test ran 1,840 ticks and validated feeding, reproduction, death, finite positions/energy, parent/child and generation links, deterministic initialization, exact evolved state round-trip and deterministic continuation, food pulse, and extinction. Final totals: 1,209 births, 1,312 deaths including the final extinction, 1,451 mutations, 524 hunts; 8 historical species, 95 retained samples, generation 8, 77 survivors. See `engine-results.log`.

## Direct-file browser startup
Commands:
```
agent-browser --session evo --allowed-domains localhost,127.0.0.1 open file:///home/pyro/projects/naked/astra/bench/14-evolution-ecosystem/index.html
agent-browser doctor --offline --quick
agent-browser --session evo network route 'https://*' --abort
agent-browser --session evo network route 'http://*' --abort
agent-browser --session evo open file:///home/pyro/projects/naked/astra/bench/14-evolution-ecosystem/index.html
agent-browser --session evo set viewport 1280 800
agent-browser --session evo snapshot -i
agent-browser --session evo errors --json
agent-browser --session evo screenshot evidence/desktop-initial.png
```
- The hostname allowlist rejected the file URL (`No hostname in URL`). Removed that CLI option; used explicit HTTP/HTTPS request blocking for the direct-file run. No browser substitution was necessary.
- FAIL, startup: `TypeError: Cannot set properties of null (setting 'onclick')` at index.html line 252. Live DOM inspection showed the fit-view button missing and its SVG unexpectedly 300 px wide. Screenshot: `desktop-initial.png`.
- Root cause: malformed button markup around the fit-view control. Fix/retest follows below.

## Iteration failures and corrections

- Startup markup: corrected `</button id="fitView"` to a closed Zoom-in button followed by the Fit-world button. Retest: real file navigation initialized the model, rendered the habitat, and accepted Pause. Fresh session `evo-final` reported zero uncaught errors. The first session's error-clearing command kept returning its historical error, so final console checks use the fresh session.
- Compact controls: scrolling to Drought moved the Environment/Evolution tabs above the panel's visible bounds; the next tab click was intercepted by the header. Recorded `controls-scroll-failure.png`, with control scrollTop 222 and tab top −14.5. Fixed by keeping the panel heading and tabs sticky. Repeated the same intervention → Evolution flow successfully.
- Compact toolbar and legend: shortened tool buttons to keep the complete toolbar within the canvas, separated the mobile legend from live diagnostics, and allowed zooming out from the narrower viewport's fitted scale. Retested at 390 × 844, DPR 2, without horizontal overflow.
- Inspector review: Genome → Sensors → Genome retained sensor text under the Genome tab because only one tab used a cached renderer. Recorded `genome-tab-failure.png`. All detail panels now use the same cache. The final browser regression observed actual Movement/Vision/Efficiency/Fertility content when returning to Genome.
- Energy review: predation could count consumed body matter again in the carcass, and reproduction did not fund edible offspring body matter. `node evidence/accounting-tests.cjs` first failed on a prey not being archived in its kill tick. Fixed immediate death removal, explicit carcass residue, and parent-funded offspring body matter. Tests now reconcile both isolated hunt and birth energy balances to floating-point precision. Scavenging also updates feeding counters.
- Import review: invalid sensor ID/distance combinations could pass model validation and fail after installing state. Validation now checks paired sensors and numeric targets; unexpected UI errors roll back to prior state. Zero-fertility growth also avoids division by zero. Both model tests and a real JSON upload verify rejection without replacing the open experiment.
- Autosave review: reload previously started a default world that could overwrite an older autosave. Startup now restores valid local state paused. A corrupt local snapshot is preserved until an explicit reset or save. The final real-browser regression saved tick 1323, reloaded the file, and recovered the exact evolved simulation at tick 1323.
- Import shape review: an extra nonnumeric decision field could survive import validation and fail in the Decisions renderer. The focused `import-shape-tests.cjs` reproduced this before the fix. Controller and archived genome keys are now validated completely, and transactional rollback restores view controls as well as model state. Retest: the focused test passes; an actual file upload reports `Load failed: Decision fields are invalid.` while preserving both the experiment and its controls.
- Archived size review: saving an experiment with archived #486 selected, resetting to founder #18, then loading that archive retained #18's size label (10.8 u instead of 6.6 u). The actual upload reproduced the failure (`archived-size-failure.png`). Size now updates from either the living or archived selected genome. The same save/reset/upload flow passes with 6.6 u, followed by a reset/step and clean-console regression. See `archive-ui-regression.py` and `archived-inspector.png`.

## Browser-tool details and harness corrections

The actual CLI commands and read-only live-state inspections are retained in `browser-commands.log`. Python drivers call agent-browser for navigation, labeled buttons/tabs, keyboard input, screenshots, uploads and downloads. They never advance or mutate the simulation via evaluation.

- The CLI mouse move command required integer coordinates; changed the harness to round coordinates before issuing the real pointer input.
- File upload completes asynchronously; the invalid-import test now waits for the observed error toast before inspecting it.
- The restore-autosave button's accessible name includes its descriptive paragraph. Used a fresh snapshot and its specific button selector rather than an incorrectly exact short name.
- The protected-area test initially retained organism IDs from before a barrier displaced them. Protection belongs to the area. The corrected check samples which organisms occupy protected cells at the moment of extinction; every such organism survived.
- `agent-browser mouse wheel` reported success but dispatched at (0,0), confirmed by a capture listener recording real wheel events with an empty target ID. It therefore missed the canvas. The core CLI has no wheel position argument. `evidence/wheel-check.cjs` supplements this one operation with Chrome's real `Input.dispatchMouseEvent` wheel event at canvas coordinates, connected to the same agent-browser session. Observed zoom 0.7054 → 0.9241.
- CLI 0.31.1 does not expose multi-touch input. `evidence/touch-checks.cjs` uses the same browser's CDP `Input.dispatchTouchEvent` for genuine touch selection, one-finger dragging and two-finger pinch. Touch emulation reported 5 touch points; selection and pan changed live state, and pinch changed zoom 1× → 2×. This supplements agent-browser; no replacement browser was used.
- A browser session was unexpectedly recreated at `about:blank`, and a later mobile session returned to the default 1280 × 633 viewport. The mobile assertion correctly failed, and a subsequent touch test could not locate a candidate in its mobile bounds. These were setup failures. The browser drivers now explicitly navigate to the file and establish viewport/offline settings. Final retest measured 390 × 844, scroll width 390, and DPR 2. The incorrect capture is retained as `mobile-viewport-setup-failure.png`.
- The first final touch attempt selected the wrong location because a smooth Observe navigation was still scrolling after coordinates were sampled. It observed selected #18 instead of the intended #4. The harness now chooses the tool, waits for scrolling to settle, then reads coordinates immediately before real touch input; drag positions derive from the current canvas rectangle. The repeated flow passed: selected #4, camera (640, 416) → (549.481, 382.055), and pinch zoom 0.95794 → 1.91587. No application behavior or expected result was changed to pass these setup checks.

## Final commands and actual workflow

All commands run from `/home/pyro/projects/naked/astra/bench/14-evolution-ecosystem`. Each browser driver's commands and returned observations are retained in `browser-commands.log`; assertions and intermediate failures/retests are appended in `browser-results.jsonl`. JSON files for import errors are intentionally malformed copies produced by the agent, not supplied benchmark fixtures.

```sh
node evidence/engine-tests.cjs > evidence/engine-results.log
node evidence/accounting-tests.cjs > evidence/accounting-results.log
node evidence/import-shape-tests.cjs > evidence/import-shape-results.log
python evidence/browser-checks.py
python evidence/interventions.py
python evidence/final-controls.py
python evidence/mobile-checks.py
node evidence/touch-checks.cjs
python evidence/final-coverage.py
python evidence/archive-ui-regression.py
```

The browser scripts use these explicit runtime settings (mobile uses `390 844 2`):

```sh
agent-browser --session evo-final set viewport 1280 800
agent-browser --session evo-final network route 'https://*' --abort
agent-browser --session evo-final network route 'http://*' --abort
agent-browser --session evo-final set offline on
agent-browser --session evo-final open file:///home/pyro/projects/naked/astra/bench/14-evolution-ecosystem/index.html
agent-browser --session evo-final snapshot -i
agent-browser --session evo-final console
agent-browser --session evo-final errors
agent-browser --session evo-final network requests
```

`rg -n 'https?://|\bfetch\(|XMLHttpRequest|import\s|src=' index.html` found only the SVG namespace declarations, including the embedded data-URL favicon. Both embedded scripts compile with `new vm.Script(...)` under Node. There are no runtime imports, external assets, fonts, fetches, or services. Direct-file compatibility is PASS, not inferred from a local server. Local HTTP was unnecessary and not run.

| Check | Status | Steps and observations |
| --- | --- | --- |
| Pause, step, seed and keyboard | PASS | Pause left the complete state unchanged; Single step advanced tick 0 → 1 while paused. Reset with seed `042` reproduced SHA-256 `489e7b7a37d7fbc263dba9b9819eae533b35d0aee5597b3b943997e69454b677`. Space resumed then paused after tick 71. |
| Real ecology over time | PASS | Selected 32×, resumed through tick 1319, then paused. Population changed from 180 to 150, with 859 births, 889 deaths, 148,120 feeding events, 455 hunts, 1,018 mutations, generation 8 and 66 actual history samples. These are observed run statistics, not fixed display data. |
| Live inspection and following | PASS | Clicked descendant #656 on the canvas. Genome, Sensors and Decisions tabs displayed its current state. Four steps changed age 141.28 → 141.92 and energy 35.0967 → 38.5434; sensors changed. A separate running follow check tracked #18 at tick 22 with camera distance 0.492 world units. |
| Inheritance and ancestry | PASS | The engine audit checked 1,176 archived children and 1,422 recorded mutations against parent genomes, including unchanged traits, root, role, generation and parent/child links. Browser lineage navigation opened #656's archived parent #486, generation 1, with its actual ten genes, mutations, death tick 642 and starvation cause. Highlight this lineage selected founder root #104. Archived inspection and its displayed size also survived save/reset/load. |
| Energy accounting | PASS | Isolated real hunt: starting energy/body matter 130.66819019809367 equals ending accounted energy 130.66819019809364. Isolated reproduction: starting and accounted totals both 208.15953726453242. Parent pays offspring reserves, edible body matter and reproductive dissipation. Dead prey is archived at its kill tick; infertile cells remain finite. |
| Drought response | PASS | Reset the same seed and compare retained samples at exactly tick 580. Baseline: 474 organisms, resource 1334.039, 27.172°C. Drought: 61 organisms, resource 283.509, 37.172°C. |
| Other interventions | PASS | Cold snap produced 5.018°C. Bloom tripled one-step solar input (75.156 → 225.468). Predator introduction added 16 organisms (180 → 196). Food pulse raised resources 4177.359 → 7413.870. Disease infected 85, with 60 living infected organisms subsequently injured. Extinction reduced 183 → 49; the organism occupying a protected cell at the intervention survived. |
| Evolution and environment controls | PASS | Keyboard adjusted mutation rate to 1 and magnitude to 0.8; observed 4,613 mutations and the 96-cluster cap. Reproduction threshold 200 yielded zero births during observation; lowering to 75 allowed 378. Sensor range 2, food growth 3, metabolism 3 and climate amplitude 2 were reflected in the model. |
| Pointer interventions | PASS | Real clicks spawned 3 grazers, raised cell food 3.9 → 6.9, fertility 0.7885 → 0.9285, cooled a cell by 2°C, and painted 7 protected cells. A continuous barrier stroke made 26 tiles and displaced inhabitants out of barriers. Erase removed the barrier; a separate creature-removal test removed #18 and reduced population 180 → 177. |
| Input continuity and navigation | PASS | At 32×, a seven-command brush stroke took 299 ms including CLI overhead while reporting 57 FPS. Drag changed camera position; wheel and keyboard zoom/pan changed the camera. Fit and real fullscreen API worked. Field notes, modal Escape, mobile Observe/Inspect/Controls and Enter to apply the seed worked. |
| Desktop, narrow and high DPI | PASS | Actual 1280 × 800 and 1440 × 900 desktop captures; 390 × 844 mobile with no horizontal overflow. Mobile canvas is 724 bitmap pixels wide for 362 CSS pixels at DPR 2. Zoom out from Fit reduced scale 0.61308 → 0.49046. Seed typing at 32× preserved `field-seed-314` at tick 501; Enter reset to that seed, tick 0, paused. Small world produced width 800 and 117 initial agents. |
| Touch | PASS | Genuine CDP touch events in the agent-browser Chrome selected #4, panned both axes, and doubled zoom with a two-finger pinch. Results saved in `touch-results.json`; rendered result inspected in `mobile-touch-final.png`. |
| Charts and diagnostic modes | PASS | Used all eight chart choices and all thirteen view modes. Opened the 12-bin inherited lifespan distribution (70–190), species phylogeny, ancestry, energy, temperature and behavior views. Enabled and inspected rays, steering, nearby targets, decision output, spatial cells and movement trails. Charts and exported series come from retained engine history. |
| JSON and autosave | PASS | Saved evolved state at tick 1323 through the real download button, stepped/reset, uploaded the file and compared the entire simulation exactly: SHA-256 `77ef262c0b43c4496b81bfbecbee7d929d72a7fd592438cfa24366a6d77d8b98`, including 1,040 lineage records. Reload and the local-restore button recovered the same state. Edited habitat/protection also round-tripped exactly. |
| Import errors | PASS | Invalid JSON structure, inconsistent sensor pairs and extra decision fields produced explicit errors without replacing simulation or view controls. Engine tests additionally reject corrupt ancestry, history and archived genomes. |
| CSV and PNG | PASS | Real downloads produced `history-export.csv` with 68 lines including the header, matching retained samples, and `habitat-export.png` with valid PNG signature (107,198 bytes). Exported view and charts were visually inspected. |
| Presets and stress | PASS | Loaded balanced, oscillation (270), islands (172), desert (103), radiation (182), recovery (48), and dense (2,000) initial populations through the dropdown. Dense accelerated run reported 32.46 FPS and 169.19 simulation ticks/sec, with 960 organisms remaining after over 250 ticks. Requested 32× is adaptively budgeted, not guaranteed throughput. |
| Console and offline requests | PASS | Final desktop and mobile console/error inspections were empty. Network records contained only the local `file://` document, status 200; no external or failed requests. |

## Screenshots and retained artifacts

- [Desktop, 1280 × 800](desktop-final.png), [desktop full page](desktop-full.png), [1440 × 900](desktop-wide.png), [mobile, 390 × 844 at DPR 2](mobile-final.png).
- [Live sensors](desktop-sensors.png), [decisions](desktop-decisions.png), [sensor/steering/target overlays](diagnostic-overlays.png), [partition cells and trails](grid-and-trails.png).
- [Energy](mode-energy.png), [temperature](mode-temperature.png), [behavior](mode-behavior.png), [history/species](history-and-species.png), [trait distribution](trait-distribution.png).
- [Ancestry](lineage.png), [species phylogeny](species-phylogeny.png), [drought](drought-response.png), [painted habitat](painted-habitat.png), [dense run](dense-stress.png), [touch result](mobile-touch-final.png).
- `evolved-browser-save.json`, `edited-habitat.json`, `history-export.csv`, and `habitat-export.png` are actual downloads. Failure screenshots and prior results are retained, not silently discarded.

## Remaining limitations

- No unresolved functional failure remains in the tested flows. Chrome was tested; Firefox, Safari, physical touch devices and other operating systems were **not run**. Touch was real browser input under emulation, not physical-device coverage.
- This is an exploratory ecological model, not a calibrated biological prediction. Reproduction is asexual; crossover was optional. A role can become extinct. Interventions and replenished vegetation are explicit energy inputs.
- Performance uses adaptive render density and a frame budget. The model caps live organisms at 7,000, stable genetic anchors at 96, and retained history at 1,800 samples; the chart shows the latest 180. Complete lineage archives remain retained, so very long experiments can consume memory and exceed browser local-storage quota. JSON export remains available; import has defensive limits of 50 MB and 250,000 lineage records.
- There is no audio feature or audio requirement in this laboratory; audio playback was not run. No required check is marked blocked, and no evaluator-owned score is claimed.
