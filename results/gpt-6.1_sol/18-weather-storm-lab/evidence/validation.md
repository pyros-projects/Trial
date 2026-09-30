# Atmos validation record

Tool: installed `agent-browser`; read `.agents/skills/agent-browser/SKILL.md`, then `agent-browser skills get core` and `agent-browser skills get dogfood` before automation. Artifact opened directly at `file:///home/pyro/projects/naked/sol61/18-weather-storm-lab/index.html`. Both HTTP and HTTPS routes aborted before navigation. Viewport: 1280×800.

## Initial checks
- PASS: direct-file opening, WebGL2 shader compilation, actual grid stepping, accessible controls and live probe rendered. `agent-browser wait --fn 'window.atmos && window.atmos.simulation.steps > 4'` returned true.
- PASS: `node evidence/numerical-tests.cjs` — same-seed vapor equality; all eight fields evolve; precipitation emerges; heat/moisture produce more cloud after 70 intervals; exact state round trip; malformed state rejection; ten presets remain finite.
- Initial numerical FAIL: uplift lacked parcel expansion cooling. Heat/moisture clouds evaporated after early growth. Added vertical transport cooling, reran full tests: PASS.
- Initial syntax FAIL: unary minus before exponentiation required parentheses. Corrected the three affected expressions; `node --check evidence/check-syntax.js`: PASS.
- PASS: no uncaught errors or console entries on initial load. Network log showed only the delivered file and an embedded data-URI SVG; no external resources.
- Initial performance FAIL: 5–6 FPS in this browser’s software WebGL path, including after adaptive resolution. Scene rendered but interaction cadence was too low. Screenshot: `screenshots/desktop-initial.png`. Root cause identified: every cloud-shadow sample evaluated procedural terrain FBM and multiple cloud FBM octaves. Refining shader sample work; retest pending.

Commands used: `agent-browser --session atmos set viewport 1280 800`; `network route 'https://**' --abort`; `network route 'http://**' --abort`; `open file:///home/pyro/projects/naked/sol61/18-weather-storm-lab/index.html`; `snapshot -i`; `screenshot evidence/screenshots/desktop-initial.png`; `errors`; `console`; `network requests`; `eval 'window.atmos.diagnostics()'`; `find role button click --name 'Pause' --exact`.

- PASS: pause holds numerical time; single-step advances one requested interval (5.4 simulated seconds) and stays paused.

- PASS: two paused resets of seed 731 reproduce all eight field hashes exactly.

- PASS: Rotating supercell evolves wind u/v/w, temperature, vapor, cloud, precipitation and pressure over 30 actual browser simulation steps; precipitation remains positive.

- FAIL during browser workflow: 

- Browser-harness FAIL: agent-browser `mouse wheel` delivered wheel events at viewport (0,0), even after `mouse move`/`hover`, so the scene did not receive them. Event-capture evidence confirmed this. Supplemented the installed CLI with `evidence/cdp-input.cjs`, attaching to the same agent-browser browser and delivering actual CDP wheel events with scene coordinates. This is real browser input, not synthetic DOM dispatch. Held Shift and touch gestures also use this helper where the CLI lacks held-key/multitouch operations. Application wheel handler was not changed to hide this tool behavior.
- Performance retest PASS: 38–44 FPS in software WebGL after reduced shadow work and adaptive sampling (323×208 internal rendering at 1280×800 layout). Full numerical suite reran and passed. Screenshots retained from before and after refinement.

- PASS: pause holds numerical time; single-step advances one requested interval (5.4 simulated seconds) and stays paused.

- PASS: two paused resets of seed 731 reproduce all eight field hashes exactly.

- PASS: Rotating supercell evolves wind u/v/w, temperature, vapor, cloud, precipitation and pressure over 30 actual browser simulation steps; precipitation remains positive.

- PASS: real pointer drag changes orbit, wheel and labeled Zoom in change distance; Windward, Storm eye and Overview presets render.

- FAIL during browser workflow: Missing arguments for: mouse move
Usage: agent-browser mouse move <x> <y>


- PASS: pause holds numerical time; single-step advances one requested interval (5.4 simulated seconds) and stays paused.

- PASS: two paused resets of seed 731 reproduce all eight field hashes exactly.

- PASS: Rotating supercell evolves wind u/v/w, temperature, vapor, cloud, precipitation and pressure over 30 actual browser simulation steps; precipitation remains positive.

- PASS: real pointer drag changes orbit, wheel and labeled Zoom in change distance; Windward, Storm eye and Overview presets render.

- PASS: continuous real pointer strokes inject heat and vapor and change wind in the actual sampled fields while paused; more than 20 continuous brush samples recorded.

- Observed delayed intervention response: local cloud 0.143 → 0.726 g/kg; rain 0.0 → 0.042 mm/h; vertical wind 0.576 → 4.979 m/s after 24 simulation intervals.

- PASS: delayed local cloud and precipitation growth after heat/moisture/wind input, with actual uplift and transport.

- PASS: temperature, relative humidity, cloud water, precipitation and pressure diagnostic maps visibly render; vertical section and keyboard-controlled column altitude read actual fields.

- PASS: manual procedural lightning triggered at a storm column; user-gesture sound enable puts Web Audio into running state and schedules thunder. Audio quality was not heard or claimed.

- PASS: labeled Save state, Export probe CSV and Export view as PNG create genuine JSON, CSV and PNG downloads.

- PASS: importing the downloaded JSON after reset restores all eight field hashes and saved simulation time exactly.

- PASS: invalid imported state is rejected visibly and atomically, with all fields and clock unchanged.

- PASS: switching to Performance quality and resampling a running atmosphere to 24 × 24 × 18 preserves finite evolving fields and a compiled, updated renderer.

- PASS: no browser uncaught errors or console errors through the desktop main workflow; network remains file/data only.

- PASS: pause holds numerical time; single-step advances one requested interval (5.4 simulated seconds) and stays paused.

- PASS: two paused resets of seed 731 reproduce all eight field hashes exactly.

- PASS: Rotating supercell evolves wind u/v/w, temperature, vapor, cloud, precipitation and pressure over 30 actual browser simulation steps; precipitation remains positive.

- PASS: real pointer drag changes orbit, wheel and labeled Zoom in change distance; Windward, Storm eye and Overview presets render.

- PASS: continuous real pointer strokes inject heat and vapor and change wind in the actual sampled fields while paused; more than 20 continuous brush samples recorded.

- Observed delayed intervention response: local cloud 0.149 → 0.709 g/kg; rain 0 → 0.035 mm/h; vertical wind 0.58 → 4.896 m/s after 24 simulation intervals.

- PASS: delayed local cloud and precipitation growth after heat/moisture/wind input, with actual uplift and transport.

- PASS: temperature, relative humidity, cloud water, precipitation and pressure diagnostic maps visibly render; vertical section and keyboard-controlled column altitude read actual fields.

- PASS: manual procedural lightning triggered at a storm column; user-gesture sound enable puts Web Audio into running state and schedules thunder. Audio quality was not heard or claimed.

- PASS: labeled Save state, Export probe CSV and Export view as PNG create genuine JSON, CSV and PNG downloads.

- PASS: importing the downloaded JSON after reset restores all eight field hashes and saved simulation time exactly.

- PASS: invalid imported state is rejected visibly and atomically, with all fields and clock unchanged.

- PASS: switching to Performance quality and resampling a running atmosphere to 24 × 24 × 18 preserves finite evolving fields and a compiled, updated renderer.

- PASS: no browser uncaught errors or console errors through the desktop main workflow; network remains file/data only.

## Review repair and regression
- Six edge tests first FAILED: cloud brush temperature bound, inherited preset names, fractional visualization, fractional altitude layer, unknown camera member, and cloud-color normalization. After repairing all causes, `node evidence/edge-regressions.cjs`: six PASS. The full numerical suite and embedded JavaScript syntax checks passed again.
- Imports now validate the entire application configuration before staging and committing a new Simulation. Preset lookups use own keys. Render enums/layers are integers. Unknown camera/render properties are rejected.
- Cloud seeding clamps latent warming to 60°C. Cloud map/volume colors now correspond to the same 0–12 g/kg scale as probe readings.
- Actual desktop workflow reran after these repairs (`ATMOS_BROWSER_SESSION=atmos-final python3 evidence/browser-workflow.py`), all checks passed. Delayed local cloud 0.149→0.709 g/kg, precipitation 0→0.035 mm/h, and vertical motion 0.58→4.896 m/s.
- Settings persistence extended to selected experiment, seed, grid/layers, brush controls, field mode and rendering flags, in addition to environment and numerical/render parameters.

- PASS: at 390×844, real touch drag orbits and two-contact pinch changes camera distance; no horizontal overflow and transport controls remain usable.

- FAIL during mobile/edge workflow: ✗ Element '[data-agent-browser-located='true']' is covered by <svg inside button#resetBtn> at its click point, so the input would land on that element instead. Dismiss or interact with the covering element first (it is often a dialog, banner, or sticky header).


- Touch checks initially PASS: actual drag and pinch altered the camera, and continuous cooling/drying/pressure/moisture/cloud/terrain strokes changed fields. Mobile workflow then FAILED while closing the controls after scrolling to surface painting: automation reported the close action’s click point covered by the transport Reset button. Screenshot `screenshots/mobile-drawer-close-before-fix.png`; commands in `logs/browser-commands.log`. Kept drawer close buttons sticky at the top of their scrollable panels to keep them accessible throughout long control workflows; retest below.

- PASS: at 390×844, real touch drag orbits and two-contact pinch changes camera distance; no horizontal overflow and transport controls remain usable.

- FAIL during mobile/edge workflow: ✗ Element '[data-agent-browser-located='true']' is covered by <svg inside button#resetBtn> at its click point, so the input would land on that element instead. Dismiss or interact with the covering element first (it is often a dialog, banner, or sticky header).


- PASS: at 390×844, real touch drag orbits and two-contact pinch changes camera distance; no horizontal overflow and transport controls remain usable.

- FAIL during mobile/edge workflow: ✗ Element '[data-agent-browser-located='true']' is covered by <svg inside button#resetBtn> at its click point, so the input would land on that element instead. Dismiss or interact with the covering element first (it is often a dialog, banner, or sticky header).

- Refined mobile failure diagnosis: the covered click was **Paint surface**, rather than Close, after opening an offscreen details section. The semantic locator computed its click before the controls panel finished scrolling. Explicit `scrollintoview '#surfaceTool'`, a fresh snapshot, and a direct click placed the real pointer on the visible button and worked. The sticky close control remains as a usability improvement. No application field behavior was bypassed or simulated by the harness.

- PASS: at 390×844, real touch drag orbits and two-contact pinch changes camera distance; no horizontal overflow and transport controls remain usable.

- PASS: touch strokes exercise cooling, drying, low pressure, moisture, cloud seeding, raised/lowered numerical terrain and a painted city surface. Local fields and terrain change correctly; brush activity stops after release. Probe drawer reads the altered column.

- PASS: Fly through plus a real held W key advances the camera; Overview restores the orbit preset.

- PASS: field-guide navigation opens a readable mobile dialog, supports keyboard focus and closes with Escape.

- PASS: reload restores selected experiment, grid/layers, numerical humidity and rendering time of day from local settings.

- PASS: actual uploads with fractional visualization, unknown camera members and inherited preset names are rejected visibly with every field, dimension and clock unchanged.

- FAIL during mobile/edge workflow: 

## Mobile, touch and persistence outcomes
- PASS: 390×844 layout has document width exactly 390, readable scene/transport and functional drawers. Screenshots: `mobile-initial.png`, `mobile-refined.png`, `mobile-probe-inspector.png`.
- PASS: real CDP touch drag, two-contact pinch, continuous field brushes and terrain/surface painting; release stops brush samples. Cooling, drying, pressure, moisture, cloud, terrain heights and city surface changed the numerical data. Commands and per-stage diagnostics are recorded.
- PASS: held W moves the Fly through camera; help dialog navigates and closes with Escape.
- PASS: reload restored selected experiment, grid/layers, humidity and time of day from local storage.
- PASS: fractional visualization, unrecognized camera member and inherited preset **actual uploaded files** were rejected with all fields, dimensions and clock unchanged (`fractional-viz-rejected.json`, `camera-member-rejected.json`, `inherited-preset-rejected.json`).
- High-DPI harness FAIL: a device-metrics override on a short-lived supplemental CDP session was removed when that session detached. Replaced it with installed `agent-browser set device 'iPhone 15'` on its persistent connection. Actual viewport 393×852 and devicePixelRatio 3 verified; screenshot `mobile-high-dpi.png`. An unavailable `iPhone 13` profile was reported by the tool and replaced with the supported profile.
- PASS: `set offline on`, direct-file reload, wait for three numerical steps, then pause; WebGL2 and controls worked without internet. Screenshot `mobile-offline-file.png`; diagnostics `logs/offline-mobile.json`; network log `logs/final-network.txt`. No audio quality was heard.

## Graphics error handling
- PASS: test-only init script returned null for WebGL2 context creation. Application displayed a useful explanation and Open field map action. Map/Section, evolving model, pause and step remained usable. `webgl-unavailable.png`, `webgl-fallback-section.png`, `logs/webgl-fallback.json`.
- PASS: test-only init script caused an intentional shader compile failure. Application displayed the shader failure and a usable map fallback; numerical time advanced. `shader-failure.png`, `shader-fallback-map.png`.
- Expected caught console errors from fault injection are saved separately. No uncaught browser error was observed in either fallback workflow. Fault scripts are outside the delivered HTML.

- PASS: all ten presets selected through the real browser have distinct initial field fingerprints and advance one finite interval; snow band visibly renders.

- PASS: stress preset at timestep 0.4 and four substeps remains finite and reports CFL below 0.6 with a strong-transport warning.

- PASS: automatic lightning count increases while a real supercell evolves with a positive cloud/updraft charge proxy; manual trigger remains independently available.

- PASS: remaining wind, vertical motion, rotation, terrain height and surface moisture modes rendered; actual vectors remain visible.

- PASS: labeled full-screen toggle enters and exits the scene without losing simulation state.

- PASS: final normal application regression has no console or uncaught errors; direct-file scene, model, controls and adaptive rendering remain functional.

## Final verification and delivery

- PASS: final `node evidence/numerical-tests.cjs`, six `node evidence/edge-regressions.cjs`, and `node --check evidence/check-syntax.js`. Outputs: `logs/final-numerical-tests.txt`, `logs/final-edge-regressions.txt`.
- PASS: HTML dependency audit — exactly three embedded script blocks, no external `src`/`href`/`poster`, no fetch, XHR or import. `logs/artifact-audit.json`. The SVG namespace is a namespace identifier, not a fetched asset.
- PASS: actual browser preset sweep — ten unique coherent field fingerprints and finite single steps. `logs/presets-summary.json`; `snow-band.png`.
- PASS: stress timestep 0.4 with at least four requested substeps remains finite; automatic subdivisions keep CFL below 0.6. `logs/stress-extreme-timestep.json`, `numerical-stress.png`.
- PASS: automatic lightning increased during the supercell run with positive cloud/updraft charge (`logs/automatic-lightning-before.json`, `logs/automatic-lightning-after.json`).
- PASS: all eleven visualization modes, full-screen enter/exit and desktop Field guide/About/Laboratory navigation were exercised. Main rendered scenes and all diagnostic screenshots remain on disk.
- PASS: terrain-coupling comparison from the delivered numerical engine, same seed and thirty intervals: maximum updraft 6.15 m/s with terrain influence versus 1.86 m/s with it disabled. Rain, cloud, temperature and vapor also differed; `logs/orographic-comparison.json`. This is a field-coupling check, not a forecast-accuracy claim.
- PASS: final direct-file desktop and 390×844 mobile reload with networking offline. `screenshots/desktop-final-adaptive.png`, `screenshots/mobile-390-offline-final.png`, `logs/final-verified.json`, `logs/offline-390-final.json`.
- PASS: final normal browser console and uncaught-error logs empty. Final requests consist only of local file/data resources. No external cache was needed; external routes were blocked before first navigation.

Exact reproducible workflow scripts: `browser-workflow.py`, `mobile-and-edge-workflow.py`, `final-browser-checks.py`. Full agent-browser/CDP command log: `logs/browser-commands.log`. Supplemental real CDP input: `cdp-input.cjs`; it delivers coordinate-correct wheel, held keyboard and touch events to the installed agent-browser session. No application state is changed through hidden testing hooks. Live diagnostics read actual arrays.

Additional exact commands: `agent-browser --session atmos-final set device 'iPhone 15'` (393×852, DPR 3); `set offline on`; `reload`; `wait --fn 'window.atmos && window.atmos.simulation.steps >= 3'`; `find role button click --name Pause --exact`. Then `set viewport 390 844`, repeat offline reload and pause for exact narrow dimensions. Fallback sessions used `open --init-script /absolute/path/to/evidence/no-webgl.js file:///absolute/path/to/index.html` and the analogous `shader-failure.js`, clicked Open field map, waited for steps, and navigated Section. Those scripts only inject test environment faults and are not referenced by index.html.

Remaining limitations: audible thunder quality **not-run**; only user-gesture activation, running audio context and distance-delayed scheduling were inspected. The simulation is qualitative and bounded, as described in About the model; no forecast validation or exact water/energy conservation is claimed. No unresolved functional failures from the exercised workflows. No benchmark-owned fixture, test expectation, or score/report was modified or invented.

Delivered artifact: `../index.html` (118,570 bytes, self-contained). Evidence is a sibling directory to the HTML file.

- Final quality regression found and fixed: selecting Balanced again after an earlier adaptive downgrade restored the expensive sample count while retaining the old “adapted” latch. Actual FPS fell to roughly 14. Reset the adaptation latch/timer whenever a quality preset is selected. Replayed Performance→Balanced, waited for an actual fresh adaptive downgrade and FPS ≥24, then exercised zoom, camera preset, pause and single-step. PASS, no console/uncaught errors. Before/after state is in `logs/quality-readaptation-before-fix.json` and `logs/quality-readaptation-after-fix.json`. Final screenshot updated.
