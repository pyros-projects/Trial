# Alchemia validation

Agent-authored evidence. This is a development validation record, not an evaluator score.

Artifact: `../index.html`. Runtime: embedded HTML/CSS/JavaScript/Canvas, no dependencies.
Browser: installed **agent-browser 0.31.1**, Chromium. Read installed `SKILL.md`, version-matched `agent-browser skills get core`, `skills get dogfood`, and dogfood issue taxonomy before testing.

## Environment and commands

- `node evidence/tests/engine.test.cjs` extracts and executes the actual embedded engine in Node, without DOM mocks.
- `agent-browser --session alchemia --allow-file-access --download-path .../evidence/downloads open file:///home/pyro/projects/naked/astra/bench/09-falling-sand-alchemy/index.html`
- `agent-browser --session alchemia set viewport 1280 800`
- `agent-browser --session alchemia set offline on`, followed by `reload`: genuine direct-file operation with networking disabled and a fresh browser session. No local HTTP server was necessary.
- `node evidence/tests/browser-validation.cjs` performs actual labeled-control clicks, keyboard range changes, pointer down/move/up strokes, pause/resume, and read-only live diagnostics. Exact command transcript: `logs/browser-main.txt`.
- Screenshots and engine logs are in the adjacent folders.

## Results

| Check | Result | Observed evidence |
|---|---|---|
| Direct-file offline runtime | PASS | File URL loaded and reloaded offline. Network log contains only the file document. No console errors or uncaught exceptions. |
| Initial scene motion | PASS | 34,812 active particles, 1,678 moving, 1,082 steam, 3,597 cumulative reactions; 60 FPS and approximately 3.6 ms/step on this machine. `01-desktop-initial.png`. |
| Engine behaviors and snapshot validation | PASS | 16/16 executable checks. `logs/engine-final.txt`. |
| Pause / single step / clear | PASS | Complete state fingerprint unchanged while paused; one click advances exactly one tick; clear gives zero particles. |
| Rapid continuous stroke | PASS | One fast wood stroke; all 18 sampled intermediate points were wood. `02-continuous-stroke.png`. |
| Solids / liquids / gases / reactive painting | PASS | Wood 1,204; Sand, Water, Oil, Gas, Acid each 993 in the paused test world. `03-material-strokes.png`. |
| Density / gravity | PASS | Resume produced 4,965 moving cells while wood remained fixed. Engine test additionally verifies sand sinks into water. |
| Lava + water | PASS | 2,932 lava and 2,932 water painted; evolved into 263 steam and 106 stone with 1,173 reactions. Stone persisted through further steps. `04-...` / `05-...`. |
| Combustion | PASS | Wood decreased from 3,832 to 551, leaving 3,281 ash and 6,759 smoke; stored fuel fell from 1,916,000 to 237,102. `06-fire-consumption.png`. |
| Electrical conduction | PASS | Painting electricity onto metal produced 118 charged cells. A distal metal cell held charge 0.371. `07-conducting-metal.png`. |
| Acid corrosion | PASS | Wood decreased from 11,673 to 7,720, with 3,988 reactions. `08-acid-corrosion.png`. |
| Heat / cool | PASS | Heat converted water to steam. Cool created 1,055 ice cells that remained ice over further steps. `09-cooled-ice.png`. |
| Eyedropper / erase / keyboard | PASS | Sampled actual ice; erase reduced occupancy from 1,055 to 300; B/E/Space/bracket controls changed the corresponding state. |
| Diagnostics | PASS | All seven diagnostic views selected and rendered distinct images; data read from live simulation. `10-update-order.png`. Moving update-order regression also passes. |
| Walls / enclosed fill | PASS | Four drawn walls enclosed 20,196 water cells; outside remained air. `18-enclosed-fill.png`. |
| Shape / amount / randomness / temperature / velocity | PASS | At radius 3 and amount 100%, Circle/Square/Diamond produced 29/49/25 cells. Temperature −100 °C and velocity (6, −4) were read from the painted particle. |
| Wind / explosion | PASS | Wind set 3,439 particles moving. Explosion added fire and impulse; 3,735 cells still moved after five steps. `19-explosion-impulse.png`. |
| All world controls | PASS | Exercised speed, substeps, gravity, ambient temperature, heat transfer, reactions, mobility, diffusion, fire intensity and explosion strength via real controls; live state matched. |
| Deterministic reset | PASS | Seed 98765, reset, three steps, reset: exact initial fingerprint restored at tick 0. |
| Resolution change and stale-hover regression | PASS | 384 → 192 → 384 resampling, with pointer over old out-of-range coordinates. Simulation advanced normally afterward. |
| World file save/load | PASS | Downloaded 553,564-byte world using Save world, cleared all particles, uploaded that actual file. Full grid/property/RNG/tick fingerprint matched exactly. `20-loaded-world.png`. |
| Invalid imports | PASS | Invalid JSON, negative event radius, unknown physics key, nested event property, nonboolean pause state, and unknown brush property all rejected without changing the complete fingerprint. `21-invalid-load-preserved.png`. |
| PNG export | PASS | Actual downloaded PNG was 766 × 378, matching the Canvas backing size for the desktop view. Header and dimensions inspected; file in `downloads/view.png`. |
| Autosave and reload | PASS | After recording context setup, created a distinct paused wood world, toggled autosave, reloaded the file offline, and verified exact fingerprint `384x240:0:636924589:1070563447`. `logs/autosave-final.txt`, `autosave-final.webm`, screenshots 16/17. |
| Nine presets | PASS | Loaded and advanced all nine worlds. Each had at least four materials and thousands of cells; live movement/reactions recorded. Screenshots 22 and transcript `browser-advanced.txt`. |
| Stress and responsiveness | PASS | 512 × 320, 113,186 active particles; approximately 21 FPS, 27.7 ms/step, and 595 ms pause-command round trip while another browser session was active. Earlier isolated run: 113,227 cells, 25.6 FPS, 139 ms pause. `23-stress-512.png`. |
| Navigation / help | PASS | Opened Field guide, switched guide tabs, closed with Escape, returned to canvas. |
| Narrow viewport / touch / high DPI | PASS | Exact 390 × 844 CSS viewport, DPR 3, 1080 × 1029 Canvas backing store. Native CDP touch input on the agent-browser-owned Chromium page generated trusted pointerType=touch events, 1,646 wood cells and 15 continuous intermediate samples. No horizontal overflow. |
| Mobile controls / resize | PASS | Touch paint, diagnostics, single-step, resume/pause, guide, world gravity and resolution controls exercised. `logs/mobile.txt`, screenshots 24–27. |
| Browser errors / network | PASS | Fresh final browser sessions reported zero uncaught exceptions and no HTTP(S) requests. Direct-file network disabled. Earlier fixed error preserved separately in `resolution-hover-error.json`. |

## Failures found, diagnosis, and retests

1. **Explosive ignition (engine):** Direct flame contact initially waited for slow thermal heating. The pre-implementation explosion test failed to observe an impulse. Added flame-contact ignition for gas and explosive material. The same test and all initial engine checks passed. Logs: `engine-first-run.txt`, `engine-fixed.txt`.
2. **Offscreen material automation:** Initial semantic clicks on clipped palette items did not reliably select them. Live diagnostics showed selected material remained Wood or Metal, so early combustion/conduction results were invalid. The test now navigates the visible Solids/Liquids/More tabs and verifies material selection before drawing. All 15 main browser checks pass; original failures preserved in `browser-main-first-failures.txt`.
3. **Autosave reload data loss:** Returning to the page created the default scene without restoring the prior snapshot; later autosave could overwrite it. Identified in source review. The first recorded browser reproduction was confounded by the recording tool creating a fresh storage context; those original recordings are retained but do not prove this app defect. Startup now restores the existing enabled autosave before allowing writes; a corrupt stored copy disables autosaving and remains preserved. The corrected test starts recording before creating its saved world; exact paused state survives offline reload (`autosave-final.txt`).
4. **Invalid explosion metadata:** Negative radii were accepted and could break Canvas rendering. Added bounds/type validation before state replacement. Original failing and passing tests in `review-regressions-before.txt` and `engine-review-fixed.txt`.
5. **Unknown physics keys:** An invalid selector-like key was accepted into imported settings and could fail during UI synchronization after world replacement. Physics keys are now whitelisted before commit. The regression verifies rejection leaves the world unchanged.
6. **Moving update-order diagnostics:** Movement initially left traversal order on the empty source cell. Order now travels with the moved particle. A fixture of eight moving grains produces eight distinct real traversal values.

## Scope notes

No audio was requested or implemented. No audio playback or quality claim is made. Simulation physics are intentionally stylized cellular rules. Performance observations are specific to this machine and scene, not a guaranteed frame rate on other devices.

7. **Nested import fields:** Unknown event/brush fields and nonboolean pause values could preserve arbitrarily nested input through validation. They are now rejected before world replacement. Engine and real file-input regressions pass.
8. **Stale inspector coordinates after resampling:** Hovering at x=300+ and selecting a smaller grid produced `TypeError` in `inspectCell`, stopping animation. Captured `15-resolution-hover-failure.png` and `logs/resolution-hover-error.json`. World replacement now clears active pointer state, and the inspector checks bounds. Retest advanced 17 ticks after resampling; advanced suite also repeats this flow successfully.
9. **Dynamic high DPI:** Changing device scale from 1 to 3 while retaining CSS viewport size initially left Canvas backing dimensions at 360 × 343. Added device-pixel-ratio change detection in the render loop. Same test now measures 1080 × 1029. `mobile-dpr-before.txt` and final `mobile.txt`.

## Additional automation diagnostics

- Some nested controls required explicit `scrollintoview`; clicks on offscreen controls are not claimed as successful application interactions.
- File upload dispatches an asynchronous change handler. The initial harness asserted before file reading completed and then cascaded through an open dialog. The final harness waits for the load dialog to close (valid files) or the file input to reset after error handling (invalid files). All 14 advanced checks pass.
- Scrolling an inspector control also shifted document position. A stale stored canvas rectangle caused a temperature assertion to sample air. The corrected harness reads the live bounding rectangle before every stroke; temperature and velocity now match exactly.
- The installed device list lacked “iPhone 13”; `doctor --offline --quick` reported 10 passes and no failures. iPhone 15 emulation followed by viewport override reset DPR/touch, so explicit CDP emulation on the existing agent-browser session established exact 390 × 844, DPR 3, and five touch points. No alternate browser tool was substituted.
- The CLI accepts integer mouse coordinates. A final regression command with fractional coordinates was rejected before dispatch; the command was corrected to integer coordinates and rerun.

## Remaining limitations

- No unresolved application failures from the executed checks. Final compact regression result is recorded in `logs/final-browser.txt`.
- Dense 113k-cell scenes run around 21–26 FPS on this machine; default scenes run near 60 FPS. High resolution, speed, or substeps may reduce throughput; the World panel exposes those controls.
- Touch was tested using native Chromium touch emulation, not physical phone hardware. Safari and Firefox were not run.
- Physics are deliberately simplified; this is an interactive cellular sandbox, not a scientific chemistry model.
- No blocked checks for direct-file delivery, networking, saves, desktop/narrow layouts, or touch. Audio is outside the requested feature set.

## Final verification

`node evidence/tests/engine.test.cjs` passed 16/16 against the final artifact. `node evidence/tests/final-regression.cjs` passed against the final code after the DPR fix. `logs/artifact-audit.json` records 104,718 bytes, two compiling inline scripts, no external runtime assets or network APIs, and no build requirement. Final desktop screenshot: `screenshots/28-desktop-final.png`. Mobile touch evidence: `screenshots/26-mobile-touch-stroke.png`.
