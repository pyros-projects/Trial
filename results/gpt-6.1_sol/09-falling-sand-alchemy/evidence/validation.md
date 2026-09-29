# Materia — agent-authored validation

Delivered artifact: `../index.html` (90,701 bytes). This report describes my own development and browser checks; it is not an evaluator score or report.

## Environment and method

- Working directory: `/home/pyro/projects/naked/sol61/09-falling-sand-alchemy`.
- Browser: installed `agent-browser` **0.31.1**, Chrome **143.0.7499.40**, Linux, session `materia`.
- Read the installed agent-browser `SKILL.md`, then `agent-browser skills get core`, `agent-browser skills get core --full`, and `agent-browser skills get dogfood`. The version-matched exploratory workflow informed the interactions, screenshots, error checks, and retests.
- Opened the delivered artifact as **file://**, with the browser offline. No local HTTP server or cached external resource was needed.
- Desktop checks: **1280 × 800**, plus 1440 × 960 screenshots. Narrow checks: **390 × 844**, device scale factor **2**.
- Painting used real low-level mouse down/move/up commands, labeled material/tool buttons, native controls, and keyboard input. Simulation inspection read the live typed arrays through `lab.world`; it did not replace the simulation or insert reaction outcomes.
- Trusted touch input used Node's built-in WebSocket with CDP `Input.dispatchTouchEvent`, attached to the same agent-browser page. The Linux CLI exposes low-level mouse input; this supplemented its core workflow for touch. Captured pointer events reported `pointerType: touch` and `isTrusted: true`.

## Exact setup and runnable checks

```bash
agent-browser --version
agent-browser skills get core
agent-browser skills get core --full
agent-browser skills get dogfood
agent-browser --session materia open file:///home/pyro/projects/naked/sol61/09-falling-sand-alchemy/index.html
agent-browser --session materia set offline on
agent-browser --session materia set viewport 1280 800
agent-browser --session materia snapshot -i
node evidence/engine-tests.cjs
python3 -u evidence/browser-tests.py
python3 -u evidence/mobile-tests.py
python3 -u evidence/large-storage-checks.py
python3 -u evidence/final-checks.py
python3 -u evidence/regression-tests.py
agent-browser --session materia errors
agent-browser --session materia console
agent-browser --session materia network requests
```

The Python harnesses contain the exact click, select, key, pointer, download, upload, screenshot, and state-inspection commands. Their complete command transcripts and outputs are in `logs/`. `touch-flow.cjs` contains the exact trusted-touch CDP commands. Several diagnostic/retest harnesses were run separately as failures were corrected; the logs preserve those attempts.

## Actual browser outcomes

| Check | Status | Observed result / evidence |
|---|---|---|
| Direct-file, offline startup | **pass** | `file://.../index.html` ran with offline mode enabled. Final requests contained only the HTML file; no HTTP(S) requests. Both embedded scripts parsed and static inspection found no external runtime references. |
| Desktop controls and canvas | **pass** | Real 1280 × 800 and 1440 × 960 navigation and screenshots. Final live world contained about 15,805 particles. `32-final-desktop.png`, `33-desktop-presets.png`. |
| Continuous painting | **pass** | Painted sand, wood, stone, metal, water, oil, gas, fire and explosive using rapid continuous pointer strokes. A 51-cell wood centerline had **zero gaps** while paused. `03-continuous-material-strokes.png`. |
| Sample and erase | **pass** | Eyedropper selected actual wood. Right-pointer erasing reduced wood from **483 to 309** cells. |
| Walls, fill, keyboard brush | **pass** | Drew a closed wall using pointer input, filled **2,631** water cells, and found **zero** water cells outside the vessel. Arrow keys + Enter painted sand; bracket keys changed radius. `04-wall-fill-keyboard.png`. |
| Lava + water | **pass** | After 25 actual Step-button presses: **84 steam**, **33 stone**, lava decreased **354 → 321**; 117 recorded transformations. These were actual material IDs and persisted in grid state. `05-lava-water-temperature.png`, `06-lava-water-products.png`. |
| Fire + fuel | **pass** | After 125 Step-button presses: wood **743 → 369**, **374 ash** and **388 smoke** cells. Fuel decreased and solid fuel became residue. `07-fire-consumption-fuel.png`, `08-fire-ash-smoke.png`. |
| Electricity + metal | **pass** | Charge reached a distant cell in the painted metal path (**0.2496**), whose temperature rose to **21.63°C**. Charge was read from the real per-cell charge array. `09-charge-through-metal.png`. |
| Acid corrosion | **pass** | Equal painted samples lost **69 metal cells**, **0 stone cells**; **69 gas** cells were produced. Corrosion/activity diagnostics showed the reacting cells. `10-acid-corrosion-activity.png`. |
| Cool / heat | **pass** | Cooling froze **49 water cells**; heating melted **49** back to water; further heat produced **38 steam**. `11-heat-cool-phase-changes.png`. |
| Wind / explosion | **pass** | Wind produced velocity up to **12**. Explosion produced impulse up to **10** and temperature up to **1100°C**. Read from actual velocity and temperature arrays. `12-wind-explosion-velocity.png`. |
| All eight diagnostic views | **pass** | Normal, temperature, velocity, density, charge, fuel, reaction/corrosion, and update-order modes produced eight distinct rendered pixel hashes. Additional temperature and charge screenshots were visually inspected. `13-update-order.png`, `31-final-temperature-world.png`. |
| Pause / single step / resume | **pass** | Paused steps remained unchanged. Step advanced **exactly one tick**, even with speed 2× and substeps 4 selected. Resume advanced again. Space and `.` were tested on the narrow screen. |
| Speed, substeps, gravity | **pass** | Native controls updated live settings; up, left, right, none, and down were selected. Speed and substeps were restored to defaults afterward. |
| Plant growth | **pass** | Ecosystem plant count increased **2,660 → 2,769** in 65 genuine Step-button ticks, using available water. `14-growing-ecosystem.png`. |
| Presets and deterministic reset | **pass** | Loaded all nine scenes. Building, electrical, acid, engine, frozen, and fireworks scenes were stepped and inspected. Same-seed reset gave identical hashes. Separate engine checks confirmed electrical-preset conduction and fireworks propagation to distant charges. |
| Brush settings | **pass** | Circle/square, radius, amount, temperature, x/y velocity, spray randomness, and replace were exercised through native controls and keyboard. Touch-painted cells carried the chosen **2000°C**, **vx 8**, **vy −8** values. |
| All physics sliders and ambient | **pass** | Heat transfer, reaction rate, mobility, gas diffusion, fire intensity, and explosion strength were changed to **3×**. Ambient changed to **−60°C** and seed **12345** applied on Reset. Defaults were restored for final scenes. |
| Save / clear / load | **pass** | Actual Save downloaded JSON; Clear removed all cells; actual file upload restored all persistent arrays, RNG, step, source, dimensions, and settings with an identical hash. Default reset-scene save was about **7.9 kB**; evolving scenes are larger. `16-save-load-restored.png`. |
| Invalid imports | **pass** | Invalid file and invalid pasted JSON produced readable errors and left the original world unchanged. `17-invalid-import-preserves-world.png`, `27-mobile-json-error.png`. |
| Copy and paste JSON | **pass** | Used the Copy state JSON button, then native **Control+V** in the paste dialog; restored an identical world hash. The tested state text was **159,748 bytes**. `29-clipboard-json-restored.png`. |
| Small-state autosave | **pass** | Timed autosave, Restore button, and reload restored complete state. Empty-world persistence and a subsequent file round trip were retested after the storage fix. |
| Large-state autosave | **pass after fix** | A roughly **7 MB**, 512 × 320 snapshot exceeded localStorage quota. Added IndexedDB backup with newest-snapshot selection. A **138,118-cell** scene then restored exactly after clear/restore and reload, hash **548584178**. `37-large-autosave-restored.png`. |
| 384 × 240 stress | **pass** | Approximately **78,249 active cells**, observed **37.4 FPS**, pause response **0.168 s**. Resize preserved material state. `18-stress-desktop.png`. |
| 512 × 320 stress | **pass** | Latest run: **138,759 active cells**, observed **34.6 FPS**, pause response **0.155 s**, saved file **7,047,867 bytes**. Earlier runs measured about 29 FPS. These are observations, not frame-rate guarantees. `30-stress-512.png`. |
| All resolution choices | **pass** | 160 × 100, 256 × 160, 384 × 240, and 512 × 320 were exercised; resizing preserved occupied state through sampling. Browser viewport changes preserved the world hash exactly. |
| Narrow layout, drawers, guide | **pass** | No horizontal overflow at 390 px. Closed drawers are inert to keyboard focus; open drawers expose controls. Field guide opened, scrolled, and closed without horizontal clipping. `22-mobile-material-drawer.png`, `23-mobile-brush-settings.png`, `26-mobile-guide.png`, `34-final-mobile.png`. |
| Trusted touch continuity | **pass** | Trusted touch stroke painted **761 metal cells**. One Step melted **all 761**. Counts stopped changing after touch end while paused. `logs/touch-events.json`, `24-mobile-touch-molten-metal.png`. |
| PNG and high DPI | **pass** | Actual PNG downloads had valid PNG headers. Mobile export measured **720 × 449**, matching the DPR-2 backing canvas. Exported the temperature diagnostic and the mobile view. |
| Browser errors / requests | **pass** | Fresh final regression: **0 console errors**, **0 uncaught errors**, **0 external requests**. Exact logs: `logs/final-console.txt`, `logs/final-errors.txt`, `logs/final-requests.txt`. |

## Failures, diagnosis, and retests

1. **Initial engine baseline:** `index.html` did not yet exist. The initial test run failed intentionally before implementation (`engine-red.txt`).
2. **Lava cooling and wood burnout:** First engine run passed 10/12. Live engine traces showed lava staying just above solidification and wood retaining excess fuel. Increased the heat absorbed by water/lava contact and corrected wood's fuel consumption rate. Repeated the tests: 12/12, later extended to **15/15**. Browser assays independently confirmed stone, steam, ash, and smoke.
3. **State compactness:** Raw arrays made a default state unnecessarily large. Added per-array run encoding with raw fallback and exact binary round trips. Compact-state and next-tick determinism checks passed.
4. **Desktop canvas width:** The maximum-height/aspect-ratio combination left unused width. Explicit canvas-shell width corrected it. Subsequent desktop interactions and screenshots used the corrected layout.
5. **Closed mobile drawers:** They initially remained focusable while offscreen. Added inert state controlled by viewport and drawer openness. Mobile opening/closing, controls, keyboard, touch, and desktop resize were retested successfully.
6. **Large autosave quota:** Reproduced with the actual 7 MB stress snapshot; the UI reported storage full. Added IndexedDB mirroring and timestamp selection while retaining the small local cache. Large and small state restore/reload tests then passed. Before/after evidence: `large-autosave-before.txt`, `large-autosave-after.txt`, `large-storage-results.json`.

Automation friction was also retained rather than counted as application success:

- This CLI rejected fractional mouse coordinates. Rounded only the input coordinates and reran the complete pointer/reaction suite: **17/17 passed**.
- Immediate clicks during the drawer's 220 ms transition missed moving controls. Added waits for the final drawer bounds; reran narrow checks: **6/6 passed**.
- Programmatic clipboard reading was denied by browser permission. The actual Copy button followed by native keyboard paste worked and was verified without granting additional permission.
- Hidden/cropped nested-panel controls were not reliably reached by the CLI's ordinary click heuristic. Opened the relevant disclosure, used explicit `scrollintoview`, and used keyboard activation for the Restore/checkbox controls. The affected final regression passed.
- One browser session was observed at `about:blank` with a new daemon PID. Its cause was not established. Reopened the file, re-enabled offline mode, and repeated the storage and final regression checks successfully. `38-browser-interruption.png` preserves that interruption.

## Final fresh verification

`node evidence/engine-tests.cjs` passed **15/15** on the delivered file. Both embedded scripts parsed; the artifact is a closed, standalone HTML document with **no external runtime references**. Final actual-browser regression passed seeded reset, one-tick stepping, live desktop/narrow rendering, resizing, clean console/error checks, and offline request inspection. See `delivery-engine-tests.txt`, `artifact-check.json`, and `regression-results.json`.

All requested public workflows have passing evidence. No known application failure remains. Other browser engines and physical mobile hardware were **not run**; narrow/touch coverage used Chromium viewport and touch emulation. Runtime storage still depends on the browser permitting device storage; when storage is unavailable, the UI reports it and file Save remains available. No HTTP-only substitute was needed for the direct-file check.

Final screenshot refresh used `scroll up 2000 --selector` on the inspector/main containers, then Reset, Resume, a wait for more than 45 live ticks, screenshot, and Pause. The browser was left paused to release simulation CPU. This changes the inspection session only; a fresh artifact starts its moving default scene.
