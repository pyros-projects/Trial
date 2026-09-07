# Falling-Sand Alchemy Sandbox

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Standalone HTML delivery and runtime checks

Write the final application to `index.html` in the working directory. The delivered application must remain one self-contained file with the original runtime/dependency restrictions; development tools, test scripts, and a temporary local HTTP server for browser inspection are allowed and are not runtime dependencies of the delivered artifact. Keep evidence and test harnesses outside `index.html`.

Verify that opening the delivered file directly works as required, and that it does not fetch external assets or services. If your browser tool only supports local HTTP, also inspect the artifact's dependency assumptions, record the direct-file check as blocked rather than passed, and preserve direct-file compatibility. When checking via local HTTP, block external internet but leave that local server reachable; test without external cached resources. For audio, explicitly enable playback with a user gesture. Do not claim audio quality was heard when only meters or audio state were inspected.

## Application requirements
Create a polished, interactive real-time falling-sand and material-alchemy sandbox that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, controls, simulation logic, rendering, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, textures, or network dependencies.

The application must simulate a large grid of interacting materials rather than merely displaying colored pixels with independent downward movement. Materials must exhibit coherent behavior based on state such as density, velocity or movement tendency, temperature, lifetime, flammability, conductivity, corrosion resistance, and phase.

Include at least sand, water, oil, salt, wood, plant matter, fire, smoke, steam, ice, lava, stone, metal, molten metal, acid, gas, electricity, and an explosive material. Implement meaningful interactions including density-based displacement, liquid flow, gas rise, dissolving, combustion, heat transfer, ignition, cooling, freezing, melting, boiling, condensation, corrosion, electrical conduction, plant growth where water is available, and pressure or impulse from explosions.

The simulation must support emergent chain reactions. For example, lava should heat water into steam, fire should spread through suitable materials while consuming fuel, hot metal should transfer heat, salt should dissolve in water, electricity should travel through conductive paths, and acid should affect some materials more strongly than others. Material transformations must alter actual grid state and persist after the triggering event.

Allow the user to paint materials continuously using mouse or touch or pointer input, erase, sample a material with an eyedropper, heat, cool, apply wind, create an explosion, draw walls, and fill enclosed areas. Support configurable brush radius, brush shape, amount, temperature, velocity, and spray randomness.

Provide controls for pause/resume, single-step, reset, clear, simulation resolution, simulation speed, update substeps, gravity direction, ambient temperature, heat-transfer rate, reaction rate, liquid mobility, gas diffusion, fire intensity, explosion strength, and brush settings.

Include selectable visualization modes for normal material rendering, temperature, movement or velocity, density, electrical charge, remaining fuel, corrosion or reaction activity, and update-order diagnostics. Diagnostic modes must reflect actual per-cell simulation properties.

Provide several elaborate presets such as volcano and ocean, burning building, electrical laboratory, acid factory, steam engine, frozen lake, plant ecosystem, fireworks chain reaction, and a dense stress-test scene.

Support saving and loading the complete simulation state as a compact file or JSON representation, local autosave, deterministic seeds for presets, and exporting the current view as PNG.

The application must adapt to browser resizing, support high-DPI displays, provide smooth continuous input during rapid pointer movement, and remain responsive with a substantial number of active cells. Use appropriate spatial updates, typed arrays, chunking, active-region tracking, GPU techniques, or other optimizations as desired.

Display a compact live overlay containing frames per second, grid dimensions, active-cell count, material counts, average temperature, reaction count, current tool, selected material, simulation speed, and pause state.

Use defaults that immediately produce movement and interesting material interactions. Treat material-system coherence, reaction depth, simulation stability, interaction quality, emergent behavior, visual polish, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Falling-Sand Alchemy Sandbox

Paint several solids, liquids, gases, and reactive materials using continuous pointer input. Trigger at least three cross-system interactions such as lava and water, fire and fuel, electricity through metal, acid corrosion, or plant growth. Confirm persistent state transformations, not transient visual effects. Use heat and cool tools, switch diagnostics, stress the simulation, and test pause, single-step, clear, reset, save, and load.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
