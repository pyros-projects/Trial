# Node-Based Generative Graphics Studio

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
Create a polished, interactive node-based generative graphics and procedural-texture studio that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, editor logic, controls, examples, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, fonts, or network dependencies.

Provide a zoomable and pannable node-graph editor with a palette, search, typed input and output ports, drag-to-connect wires, connection previews, selection, box selection, move, duplicate, delete, group or frame, collapse, comments, undo, redo, copy, paste, and a property inspector. Connections must determine the generated image; the graph may not be a decorative diagram beside unrelated rendering code.

Include a useful library of procedural nodes covering coordinates and UVs, time and frame, constants, vectors and colors, arithmetic, remap, clamp, smoothstep, trigonometry, gradients, transforms, tiling, polar conversion, random or hash, value or gradient noise, fractal noise, Voronoi or cellular patterns, shapes and signed distances, blur or neighborhood approximation, normal-map derivation, color ramps, blend modes, masks, warp or distortion, lighting, and final output. Nodes must expose editable parameters and previews where helpful.

Implement type checking and conversion rules for scalar, vector, color, image or field, and execution dependencies. Reject incompatible connections clearly. Detect cycles and either prevent them or support an explicit feedback or delay node with well-defined frame behavior. Invalid graphs must retain editable state and show useful diagnostics instead of crashing or silently rendering stale output.

Evaluate or compile the graph into an actual CPU Canvas pipeline, WebGL shader pipeline, or hybrid system. Changes to nodes, connections, parameters, and time must update the preview incrementally. If using generated shaders, display compile errors with node-level context and preserve the last valid preview. If using CPU processing, keep interaction responsive through caching, dirty propagation, workers where available, or adaptive preview resolution.

Provide a large live preview with zoom, pan, fit, pixel inspection, tiling preview, channel isolation, checkerboard transparency, and comparison against a frozen reference. Support still images and animated procedural output driven by a timeline. Include playback, pause, frame step, duration, frame rate, loop, keyframes for numeric and color parameters, interpolation choices, and a compact curve or dope-sheet editor.

Include at least eight elaborate editable presets such as marble, wood, clouds, lava, circuit board, cellular organism, neon tunnel, terrain height and normal map, animated plasma, and a poster-like generative composition. Presets must be built from visible graph nodes rather than hidden special-case rendering.

Provide selectable diagnostic views for final color, individual channels, alpha, luminance, normal, node ID or contribution, value range, NaN or invalid pixels, shader or evaluation time, cached versus dirty nodes, and preview resolution. Allow selecting a node to preview its intermediate output.

Support project save and load as validated JSON, local named projects, autosave, graph export as a compact shareable text representation, PNG export at configurable resolution, animated frame-sequence export or a practical in-browser animation export, and optional GLSL or JavaScript source export for the compiled graph. Exported results must reflect the current graph and timeline.

Render the editor with deliberate professional polish: crisp nodes, readable ports, curved or orthogonal wires, minimap, alignment guides, search command palette, contextual menus, keyboard shortcuts, resizable panels, useful empty-state guidance, and color-contrast options. Maintain a coherent layout at both desktop and narrow viewport sizes.

Provide controls for preview and export resolution, color space approximation, antialiasing, animation time, seed, node-preview quality, evaluation backend where supported, cache behavior, grid and snap, theme, and performance limits. Include safe bounds to prevent a maliciously large graph or export size from freezing the page without warning.

The application must adapt to browser resizing, support high-DPI displays, provide usable mouse and touch or pointer interaction, handle pointer cancellation and focus loss, and remain responsive with graph presets containing dozens of nodes.

Display a compact live overlay containing frames per second, graph node and edge counts, dirty-node count, preview resolution, evaluation or shader time, current frame and time, selected node, compile or validation status, and autosave state.

Use defaults that open a visually striking animated graph and make it obvious that editing a node changes the final image. Treat graph semantics, editor ergonomics, compilation or evaluation correctness, animation behavior, error recovery, export fidelity, visual quality, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Node-Based Generative Graphics Studio

Create or modify a graph by adding nodes, connecting compatible ports, changing parameters, moving nodes, and confirming that the live preview changes from the evaluated graph. Attempt an incompatible connection or illegal cycle and verify useful feedback without corrupting the graph; test disconnect, undo, redo, copy and paste, pan, zoom, and selection. Animate a time-dependent parameter, switch preview diagnostics, load a complex preset, save and reload the graph, export a PNG and graph JSON, and verify responsive editing at a narrow viewport.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
