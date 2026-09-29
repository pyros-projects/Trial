# Elastic Lab — agent-authored validation

Artifact: `../index.html`. Browser: installed `agent-browser`, version-matched `skills get core` and `skills get dogfood` read before use. No browser substitution. Tests use the actual embedded physics engine or real browser controls; no evaluator files are modified.

## Final delivery status — 2026-09-29

The delivered `index.html` is 96,363 bytes and contains all runtime markup, styles, vector assets, simulation and UI code. Both scripts parse. No build or server is required. The final audit records the SHA256 and dependency scan in `logs/artifact-audit-final.txt`.

| Required behavior | Final observed result | Evidence |
| --- | --- | --- |
| Direct file, offline, no cached external resources | **Pass.** A newly launched Chrome profile opened the actual file with HTTP and HTTPS aborted before navigation; only the local file document was requested, with zero resource entries. | `logs/delivery-smoke-final.txt`, `logs/delivery-network.txt`, `tests/delivery-smoke.cjs` |
| Desktop 1280 × 800 and narrow 390 × 844 | **Pass.** Canvas, playback and metrics remain visible, with no horizontal overflow. Closed drawer transition is allowed to settle before final screenshots. | `screenshots/final-desktop-1280.png`, `screenshots/final-mobile-390.png`, `logs/browser-mobile-final.txt` |
| Grab, release, pin/unpin, fast cuts, pulling tears | **Pass.** Real mouse/pointer and keyboard input; cuts remove graph edges and dependent triangles; subsequent simulation preserves damage. All nine final desktop checks pass. | `logs/browser-desktop-final-retest.txt`, `logs/cut-before.json`, `logs/cut-after.json`, `logs/tear-before.json`, `logs/tear-after.json` |
| Six spawn types, forces and meaningful collisions | **Pass.** Cloth, rope, elastic body, pressure membrane, rigid ball and obstacle placement; impulse/gust velocity response; static drag; live inter-body contacts. Loaded-rope and dynamic overlap tests verify support/separation. | `logs/spawn-collision-after.json`, `logs/impulse-wind-after.json`, `logs/browser-utilities-final.txt`, `logs/physics-final.txt` |
| All eight demonstration scenarios | **Pass.** Genuine motion and finite states; destructive scenario tears; bridge load and suspended structures run after the joint-collision fix. | `logs/browser-scenes-final.txt`, `logs/scene-*.json`, `screenshots/scene-*.png` |
| All eight visualization modes | **Pass.** Switching views preserves exact paused particle state, step count and time. Stress uses measured strain; contacts/cells/pins/velocity render current state. | `logs/browser-scenes-final.txt`, `screenshots/mode-*.png`, `screenshots/06-stress-after-cut.png`, `screenshots/07-constraint-graph.png` |
| Solver, material, wind and gravity controls | **Pass.** Labeled slider clicks plus Home/End keys change live settings, fixed timestep, deformation/tearing and free-body wind response; preferences survive reload. | `logs/browser-controls-final.txt`, `logs/solver-control-after.json`, `logs/wind-control-after.json` |
| Pause, single-step, reset and navigation | **Pass.** Pause freezes time; keyboard and button step advance one fixed timestep; reset restores selected graph/time; drawers and guide retain keyboard access. | Desktop/mobile/scenario logs and `logs/delivery-smoke-final.txt` |
| Paused contact/hash/area diagnostics | **Pass.** Current-geometry measurements, overlapping paused placement, self-contact toggle and Defaults restoration without advancing time or moving particles. | `logs/paused-diagnostics-final.txt`, `logs/paused-self-contact-*.json`, physics regressions |
| High-DPI and resize continuity | **Pass.** Device scale 2 doubles backing dimensions; exact world coordinates and time survive resizing. | `logs/high-dpi.json`, `screenshots/27-high-dpi.png`, mobile/delivery logs |
| PNG export, stored-preference errors, object budget | **Pass.** Genuine PNG download/signature; malformed and null saved preferences safely restore defaults; 60-object limit gives feedback and reset recovers. | `logs/browser-utilities-final.txt`, `screenshots/final-canvas-export.png`, `logs/artifact-audit-final.txt` |
| Browser errors and failed external requests | **Pass.** Final fresh-profile console and uncaught-error outputs are empty. No external resources are attempted. | `logs/delivery-errors.txt`, `logs/delivery-console.txt`, `logs/delivery-network.txt` |
| Actual embedded physics regressions | **Pass: 20/20.** Includes constraints, pressure, collision/support, cuts/tears, gravity, density-dependent impulse, extreme controls, self collision, joint separation and diagnostic accuracy. | `logs/physics-final.txt`, `tests/physics.test.cjs` |

No required check remains blocked or not-run. Earlier failures below are retained as development history; each application defect was repaired and its failing flow repeated. The unexplained download cancellation in an older browser tab did not recur in the fresh application tab or the freshly launched offline profile. This is an agent-authored verification record, not an evaluator score.

Numerical limits: collisions use particle/edge approximations and discrete substeps, with approximate non-neighbor self-collision; this is not exact continuum cloth or guaranteed continuous collision detection. Very large impulse values with few substeps may penetrate thin geometry. Placement is bounded by 60 total objects and a particle-budget guard (a final cloth placement can bring the world to about 1,700 particles). Performance varies with scene density and view; recorded observations span roughly 38–60 FPS for the ordinary presets and slower intervals in the destructive preset during browser automation. No performance guarantee is claimed. No scene import/export format was requested; Capture exports a PNG, while settings/view persist locally. Hardware touch, other browser engines, and hours-long endurance are **not-run**; narrow-screen tests used real mouse pointer events and keyboard input. No audio is implemented or required.

Reproduce the development checks from the working directory:

```sh
node --test evidence/tests/physics.test.cjs
agent-browser skills get core --full
agent-browser skills get dogfood
agent-browser --session elastic-lab network route 'https://*' --abort
agent-browser --session elastic-lab network route 'http://*' --abort
agent-browser --session elastic-lab set viewport 1280 800
agent-browser --session elastic-lab open file:///home/pyro/projects/naked/sol61/04-deformable-physics/index.html
node evidence/tests/browser-checks.cjs desktop
node evidence/tests/browser-checks.cjs controls
node evidence/tests/browser-checks.cjs scenes
node evidence/tests/browser-checks.cjs mobile
node evidence/tests/browser-checks.cjs utilities
node evidence/tests/paused-diagnostics.cjs
node evidence/tests/browser-checks.cjs sustained
agent-browser --session elastic-delivery network route 'https://*' --abort
agent-browser --session elastic-delivery network route 'http://*' --abort
agent-browser --session elastic-delivery set viewport 1280 800
agent-browser --session elastic-delivery open file:///home/pyro/projects/naked/sol61/04-deformable-physics/index.html
node evidence/tests/delivery-smoke.cjs
```

Detailed actual navigation, labeled controls, mouse moves/down/up and keyboard commands are in `logs/browser-commands.txt` and `logs/delivery-browser-commands.txt`. The harness reads `Playground.snapshot()` for Canvas state assertions; it never sets simulation state. Only the stored-preference error case intentionally writes invalid localStorage strings and reloads.

## Initial implementation checks

- **Pass (after fix):** `node --test evidence/tests/physics.test.cjs`: 11 physics tests. Logs include the original missing-engine failures, first implementation 9/10, two regression failures, and final 11/11. Coverage: gravity, fixed pins, stiffness response, area pressure, dynamic overlap/contact reporting, static support, graph cuts/visible triangle removal, threshold tearing, membrane venting, mass-dependent impulse, extreme controls, horizontal gravity.
- **Pass:** Both embedded scripts parsed using `node:vm.Script`; artifact initially 91,964 bytes.
- **Pass:** Direct file navigation, `agent-browser --session elastic-lab open file:///home/pyro/projects/naked/sol61/04-deformable-physics/index.html`, after `set viewport 1280 800` and network routes `https://* --abort`, `http://* --abort`. Navigation loaded the actual file. No HTTP server or external cache needed. Network list contains only the local file document.
- **Pass:** `agent-browser ... errors` and `console`: empty at initial load. `Playground.snapshot()` reported all particle positions and velocities finite, 364 particles, 1,639 active constraints, 18 actual collision pairs, 7.65% maximum error; measured ~41 FPS at capture time. These values are observations, not target scores.

## Observed issues and repairs

### V-001 — desktop metrics below the viewport (initial fail; repaired)
At 1280 × 800 the default page put playback near the bottom and the metrics below the fold. Screenshot: `screenshots/01-desktop-initial.png`. The scene library's intrinsic height expanded the main grid. Constrain the desktop app to the available viewport and allow internal panels to scroll while keeping the central metrics visible. Retest the same viewport and mobile.

### V-002 — default cloth initially too taut (initial issue; repaired)
The initial default cloth has a nearly rectangular settled silhouette above its obstacle. Snapshot confirms its bottom around world y=363 and the obstacle top y=404, so they do not meet. Move the obstacle into reach and bring the anchors closer than the cloth's rest width so the default immediately demonstrates sagging and contour contact. Preserve real constraint lengths.

## Browser interaction checks

The following entries retain the successive runs, failures and retests in chronological order.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Pass:** Real pointer grab deforms cloth and releases pointer capture. See command log and matching observation/screenshot files.

- **Pass:** Pin and unpin change actual pinned particle count. See command log and matching observation/screenshot files.

- **Pass:** A rapid pointer cut permanently removes graph edges and surface triangles. See command log and matching observation/screenshot files.

- **Pass:** Stress and constraint modes preserve world state. See command log and matching observation/screenshot files.

- **Fail:** Pulling with Tear at a low threshold breaks real cloth constraints: ✗ Unknown subaction: focus
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

### Tool compatibility finding
The installed CLI advertises `find label ... focus` but returns `Unknown subaction: focus`. `agent-browser doctor --offline --quick` returned 17 pass, 0 warning, 0 fail (CLI 0.31.1, Chrome 143.0.7499.40). The harness now clicks the labeled slider and sends real Home/End keys. This was a browser-tool command failure, not evidence of a failed tear feature; that flow is rerun below.

V-001 retest: the metrics now end at viewport y=758.5 (1280 × 800), with no horizontal overflow. Screenshot `02-desktop-fit.png`; V-001 repaired.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Pass:** Real pointer grab deforms cloth and releases pointer capture. See command log and matching observation/screenshot files.

- **Pass:** Pin and unpin change actual pinned particle count. See command log and matching observation/screenshot files.

- **Pass:** A rapid pointer cut permanently removes graph edges and surface triangles. See command log and matching observation/screenshot files.

- **Pass:** Stress and constraint modes preserve world state. See command log and matching observation/screenshot files.

- **Pass:** Pulling with Tear at a low threshold breaks real cloth constraints. See command log and matching observation/screenshot files.

- **Pass:** Impulse and wind tools alter live velocity and gust state. See command log and matching observation/screenshot files.

- **Pass:** All six object types spawn through labeled menu and canvas placement. See command log and matching observation/screenshot files.

- **Fail:** Grabbing the center of a balloon selects and drags the body: a click inside the membrane should grab the body

false !== true
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

- **Fail:** Grabbing the center of a balloon selects and drags the body: a click inside the membrane should grab the body

false !== true
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

### V-003 — grabbing a balloon from its center (fail → repaired)
Reproduced twice with real pointer input: pause, select Full of air, choose Grab, press at the center of the first membrane. Live `dragging` stayed false, and moving the pointer did not move the body. The particle picker only searched within 22 screen pixels, shorter than the balloon radius. Video: `videos/balloon-center-grab-before.webm`; before/after screenshots and `browser-center-grab-repro.txt` preserve the failed flow.
The picker now tests the actual membrane polygon and attaches all ring particles when the click is inside but away from its edge. Vented membranes do not claim their empty interior. Near-edge grabbing still deforms individual particles. The same failed check and desktop regression are repeated below.

- **Pass:** Grabbing the center of a balloon selects and drags the body. See command log and matching observation/screenshot files.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Fail:** Real pointer grab deforms cloth and releases pointer capture: Cannot read properties of undefined (reading 'particleIds'). Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

Harness setup repair: the first desktop rerun after the balloon test reset the *balloon* scene, then incorrectly looked for a cloth. The application's reset behavior was correct. The agent-authored regression now explicitly selects The playground before asserting cloth behavior; no public requirements or expected results were changed.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Pass:** Real pointer grab deforms cloth and releases pointer capture. See command log and matching observation/screenshot files.

- **Pass:** Pin and unpin change actual pinned particle count. See command log and matching observation/screenshot files.

- **Pass:** A rapid pointer cut permanently removes graph edges and surface triangles. See command log and matching observation/screenshot files.

- **Pass:** Stress and constraint modes preserve world state. See command log and matching observation/screenshot files.

- **Pass:** Pulling with Tear at a low threshold breaks real cloth constraints. See command log and matching observation/screenshot files.

- **Pass:** Impulse and wind tools alter live velocity and gust state. See command log and matching observation/screenshot files.

- **Pass:** All six object types spawn through labeled menu and canvas placement. See command log and matching observation/screenshot files.

- **Pass:** Solver iterations, substeps, and timestep apply live through keyboard sliders. See command log and matching observation/screenshot files.

- **Pass:** Stiffness and tear sliders alter actual deformation and threshold. See command log and matching observation/screenshot files.

- **Fail:** Wind and gravity direction produce consistent live velocity changes: The expression evaluated to a falsy value:

  assert.ok(after.particles.filter(p=>!p.pinned).reduce((sum,p)=>sum+p.vx,0)>1000)
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

- **Pass:** Every visualization reads the same paused world without resetting it. See command log and matching observation/screenshot files.

- **Pass:** All eight scenarios run with finite dynamics and real contacts. See command log and matching observation/screenshot files.

- **Pass:** A pointer cut vents a balloon and its area collapses after release. See command log and matching observation/screenshot files.

- **Pass:** Reset restores the selected scenario graph and simulated time. See command log and matching observation/screenshot files.

Wind-check investigation: the first assertion summed velocities of *all* particles, including the anchored cloth recoiling from its compressed initial state. At the failure, the free balloon averaged +188.99 px/s, the soft body +135.89 px/s, and the rope +96.28 px/s; wind was acting correctly. The agent-authored check now measures the free membrane's mean velocity, which tests the force direction without conflating anchor recoil. Public requirements are unchanged.

- **Pass:** Solver iterations, substeps, and timestep apply live through keyboard sliders. See command log and matching observation/screenshot files.

- **Pass:** Stiffness and tear sliders alter actual deformation and threshold. See command log and matching observation/screenshot files.

- **Pass:** Wind and gravity direction produce consistent live velocity changes. See command log and matching observation/screenshot files.

- **Pass:** Preferences survive a direct-file reload and defaults restore all controls. See command log and matching observation/screenshot files.

- **Pass:** 390 × 844 layout has visible canvas and metrics without horizontal overflow. See command log and matching observation/screenshot files.

- **Fail:** Mobile physics drawer exposes sliders and closes back to canvas: ✗ Element '[data-agent-browser-located='true']' is covered by <div#scrim> at its click point, so the input would land on that element instead. Dismiss or interact with the covering element first (it is often a dialog, banner, or sticky header).
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

- **Fail:** Closed mobile drawers do not receive keyboard focus: Tab should move to a visible control instead of the offscreen library

'' !== 'scenes-open'
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

### Narrow drawer timing and keyboard focus
The rapid automation clicked a tab while the inspector was still sliding in. Its click landed on the moving World tab, leaving the requested Solver slider hidden; the scrim then correctly intercepted a click at the hidden element's zero-size bounds. The harness now waits for the actual drawer bounds to reach the viewport before using its controls. The transition remains intact.
A separate real keyboard test found a product issue: Tab from How to play focused “Close experiments” in the offscreen, closed library. Closed responsive drawers now use `inert` and `aria-hidden`; open drawers constrain Tab focus and return focus when closed. RED evidence: `logs/mobile-keyboard-red.txt`, `mobile-hidden-drawer-focus-before.png`. Retest follows.

The default cloth is now longer while its constraint rest lengths remain authentic, bringing its lower region into contact with the contour. Spawned ropes also clamp their anchor height so their full initial chain fits within the world. The timestep slider uses a 0.001 ms increment so its native value can represent the 16.667 ms solver default exactly.

- **Pass:** Closed mobile drawers do not receive keyboard focus. See command log and matching observation/screenshot files.

- **Pass:** 390 × 844 layout has visible canvas and metrics without horizontal overflow. See command log and matching observation/screenshot files.

- **Pass:** Mobile physics drawer exposes sliders and closes back to canvas. See command log and matching observation/screenshot files.

- **Pass:** Mobile scene navigation and pointer pinning work. See command log and matching observation/screenshot files.

- **Pass:** Mobile dragging and rapid cutting retain input continuity. See command log and matching observation/screenshot files.

- **Pass:** Help and keyboard shortcuts work at narrow width. See command log and matching observation/screenshot files.

- **Pass:** Resize keeps the same world coordinates and state. See command log and matching observation/screenshot files.

- **Pass:** Default cloth contacts its contour and stays stable over sustained motion. See command log and matching observation/screenshot files.

- **Fail:** Draped cloth visibly bends around static contours over sustained motion: draped sheet should curve rather than remain a straight rigid plank. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

- **Fail:** A narrow-screen interior grab preserves shape until the pointer moves: clicking the center without moving should not snap a boundary particle inward; observed 33.35. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

### V-004 — cloth draping too rigid (fail → repaired)
At 1440 × 900, after six simulated seconds, the sheet stayed nearly planar between supports. Center-row deviation from its end-to-end chord was **3.33 world pixels**, with no tearing. Failure screenshot and `sustained-drape.json` preserve the actual behavior. The stiff diagonal shear connections resisted the necessary cell-angle changes. Deterministic experiments kept the same geometry, particles, structural lengths, and forces and changed only shear compliance: factor 0.38 produced **78.43 px** curvature; 0.18 produced **243.79 px**. Factor **0.38** gives clear draping while retaining a woven sheet. The original ≥20 px curvature assertion is unchanged. Browser retest follows.

### Review fixes (independently reproduced)
- **Important, fixed:** bending constraints spanning torn structural connections kept rope fragments physically attached. The new test failed with 2 hidden live links, then passed after bending constraints acquired structural support dependencies. A break now removes dependent bends in ropes, cloth, and membranes. Detached particles remain detached in subsequent dynamics.
- **Important, fixed:** paused dragging left old contacts, old hash cells, and stale area strain. Two old touching balls reported a collision after being moved apart. Contact measurement now reads the current geometry without moving particles; paused drags rebuild the hash and contacts. Area error is recalculated from current ring area and the current pressure target. The three reproduced tests passed. A small contact tolerance includes surfaces touching at rest.
- **Stability repair:** object placement has a total object limit as well as the particle budget, bounding static-obstacle work. Obstacle geometry is included in the read-only live snapshot for inspection.
- **Touch picking repair:** at 390 × 844, the larger screen-space picking radius selected a membrane boundary from its center, snapping that point inward **33.35 world pixels** without pointer movement. Interior hits now take priority over nearby boundary particles; local grabs preserve their cursor offset. The failed real-pointer check is rerun below.

`node --test evidence/tests/physics.test.cjs`: **15/15 pass** after the graph, diagnostic, and drape repairs. `logs/review-regressions-red.txt` shows all four new regressions failing before fixes; `logs/review-regressions-green.txt` shows them passing.

- **Pass:** A narrow-screen interior grab preserves shape until the pointer moves. See command log and matching observation/screenshot files.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Pass:** Real pointer grab deforms cloth and releases pointer capture. See command log and matching observation/screenshot files.

- **Pass:** Pin and unpin change actual pinned particle count. See command log and matching observation/screenshot files.

- **Pass:** A rapid pointer cut permanently removes graph edges and surface triangles. See command log and matching observation/screenshot files.

- **Pass:** Stress and constraint modes preserve world state. See command log and matching observation/screenshot files.

- **Pass:** Pulling with Tear at a low threshold breaks real cloth constraints. See command log and matching observation/screenshot files.

- **Pass:** Impulse and wind tools alter live velocity and gust state. See command log and matching observation/screenshot files.

- **Pass:** All six object types spawn through labeled menu and canvas placement. See command log and matching observation/screenshot files.

- **Pass:** Default cloth contacts its contour and stays stable over sustained motion. See command log and matching observation/screenshot files.

- **Pass:** Draped cloth visibly bends around static contours over sustained motion. See command log and matching observation/screenshot files.

- **Pass:** 390 × 844 layout has visible canvas and metrics without horizontal overflow. See command log and matching observation/screenshot files.

- **Pass:** Mobile physics drawer exposes sliders and closes back to canvas. See command log and matching observation/screenshot files.

- **Pass:** Mobile scene navigation and pointer pinning work. See command log and matching observation/screenshot files.

- **Pass:** Mobile dragging and rapid cutting retain input continuity. See command log and matching observation/screenshot files.

- **Pass:** Help and keyboard shortcuts work at narrow width. See command log and matching observation/screenshot files.

- **Pass:** Resize keeps the same world coordinates and state. See command log and matching observation/screenshot files.

- **Pass:** The default preloaded hem actually tears on the first solver step. See command log and matching observation/screenshot files.

- **Pass:** Static obstacles spawn at pointer placement and can be dragged. See command log and matching observation/screenshot files.

- **Pass:** Object budget reports a clear error and reset recovers. See command log and matching observation/screenshot files.

- **Pass:** High-DPI resizing preserves world state and doubles the backing canvas. See command log and matching observation/screenshot files.

- **Fail:** Capture exports an actual PNG without a network dependency: ✗ Download was canceled
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

### V-005 — Capture data-URL download canceled (fail → repair retest)
`agent-browser download '#capture' .../canvas-export.png` was canceled twice by Chromium. Console and uncaught-error logs remained empty, so the failure was in the download path. A separate local `download-probe.html` with an appended anchor and Blob URL downloaded successfully through the same installed CLI, same browser, and same offline routes. Capture now uses `canvas.toBlob`, an appended temporary download anchor, and URL revocation after initiation. The toast says “Saving canvas image…” rather than claiming browser completion. The actual PNG signature and file size are verified below.

The default scenario now preloads two hem particles; the first genuine solver step breaks their overstretched constraints, reducing the active triangle count. Detached cloth points are rendered, and the main sheet label follows its surviving surface. This demonstrates actual tearing immediately instead of depending on a later user gesture. Stress colors separate compression (blue) from tension approaching the configured tear threshold (warm colors).

- **Pass:** The default preloaded hem actually tears on the first solver step. See command log and matching observation/screenshot files.

- **Pass:** Static obstacles spawn at pointer placement and can be dragged. See command log and matching observation/screenshot files.

- **Pass:** Object budget reports a clear error and reset recovers. See command log and matching observation/screenshot files.

- **Pass:** High-DPI resizing preserves world state and doubles the backing canvas. See command log and matching observation/screenshot files.

- **Fail:** Capture exports an actual PNG without a network dependency: ✗ Download was canceled
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

- **Pass:** The default preloaded hem actually tears on the first solver step. See command log and matching observation/screenshot files.

- **Pass:** Static obstacles spawn at pointer placement and can be dragged. See command log and matching observation/screenshot files.

- **Pass:** Object budget reports a clear error and reset recovers. See command log and matching observation/screenshot files.

- **Pass:** High-DPI resizing preserves world state and doubles the backing canvas. See command log and matching observation/screenshot files.

- **Pass:** Capture exports an actual PNG without a network dependency. See command log and matching observation/screenshot files.

- **Pass:** Malformed and null saved preferences fall back safely on direct-file reload. See command log and matching observation/screenshot files.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Pass:** Real pointer grab deforms cloth and releases pointer capture. See command log and matching observation/screenshot files.

- **Pass:** Pin and unpin change actual pinned particle count. See command log and matching observation/screenshot files.

- **Fail:** A rapid pointer cut permanently removes graph edges and surface triangles: The expression evaluated to a falsy value:

  assert.ok(after.stats.cuts>s.stats.cuts+15)
. Reproduction commands in `logs/browser-commands.txt`; failure state and screenshot saved.

## Final regression notes

The final default now includes a genuinely preloaded hem that tears on the first solver step. The initial desktop cut regression aimed at 65% of the body bounds; detached hem particles extended those bounds below the visible connected mesh. Real pointer input therefore crossed empty space and removed zero links (screenshot and snapshot retained). The agent-authored harness now selects the median particle Y as its pointer path through the actual sheet. The original assertions for >15 cuts and >15 surface triangles removed remain intact; no application or benchmark expectations were changed for this targeting correction.

Capture diagnosis: PNG and text probe downloads worked, while repeated capture in the older validation tab was canceled. The same final application Capture button succeeded in a fresh tab, including at device scale 2 with both HTTP/HTTPS routes aborted. The complete utilities retest passed all six checks, including PNG signature and size, malformed/null stored preferences, placement/editing, object-budget recovery, initial graph tearing, and high-DPI coordinates. This isolated the persistent cancellation to the older browser tab/context; its underlying browser reason was not exposed. The application now downloads via a Canvas Blob and appended temporary anchor. No browser substitution was used.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Pass:** Real pointer grab deforms cloth and releases pointer capture. See command log and matching observation/screenshot files.

- **Pass:** Pin and unpin change actual pinned particle count. See command log and matching observation/screenshot files.

- **Pass:** A rapid pointer cut permanently removes graph edges and surface triangles. See command log and matching observation/screenshot files.

- **Pass:** Stress and constraint modes preserve world state. See command log and matching observation/screenshot files.

- **Pass:** Pulling with Tear at a low threshold breaks real cloth constraints. See command log and matching observation/screenshot files.

- **Pass:** Impulse and wind tools alter live velocity and gust state. See command log and matching observation/screenshot files.

- **Pass:** All six object types spawn through labeled menu and canvas placement. See command log and matching observation/screenshot files.

- **Pass:** Solver iterations, substeps, and timestep apply live through keyboard sliders. See command log and matching observation/screenshot files.

- **Pass:** Stiffness and tear sliders alter actual deformation and threshold. See command log and matching observation/screenshot files.

- **Pass:** Wind and gravity direction produce consistent live velocity changes. See command log and matching observation/screenshot files.

- **Pass:** Preferences survive a direct-file reload and defaults restore all controls. See command log and matching observation/screenshot files.

- **Pass:** Every visualization reads the same paused world without resetting it. See command log and matching observation/screenshot files.

- **Pass:** All eight scenarios advance with finite dynamics and the stress scene tears. See command log and matching observation/screenshot files.

- **Pass:** A pointer cut vents a balloon and its area collapses after release. See command log and matching observation/screenshot files.

- **Pass:** Reset restores the selected scenario graph and simulated time. See command log and matching observation/screenshot files.

- **Pass:** 390 × 844 layout has visible canvas and metrics without horizontal overflow. See command log and matching observation/screenshot files.

- **Pass:** Mobile physics drawer exposes sliders and closes back to canvas. See command log and matching observation/screenshot files.

- **Pass:** Mobile scene navigation and pointer pinning work. See command log and matching observation/screenshot files.

- **Pass:** Mobile dragging and rapid cutting retain input continuity. See command log and matching observation/screenshot files.

- **Pass:** Help and keyboard shortcuts work at narrow width. See command log and matching observation/screenshot files.

- **Pass:** Resize keeps the same world coordinates and state. See command log and matching observation/screenshot files.

- **Pass:** Real paused overlapping-ball placement immediately reports the new pair without advancing time. Self-collision switch and Defaults refresh current diagnostics; a real pointer-folded cloth creates self contacts which disappear on disabling the switch, with exact particle positions/time unchanged. See logs/paused-diagnostics-final.txt and matching snapshots.

- **Pass:** Real paused overlapping-ball placement immediately reports the new pair without advancing time. Self-collision switch and Defaults refresh current diagnostics; a real pointer-folded cloth creates self contacts which disappear on disabling the switch, with exact particle positions/time unchanged. See logs/paused-diagnostics-final.txt and matching snapshots.

Paused self-contact regression setup initially reported zero actual contacts: the selected real drag left non-neighbor points 26.26 units apart, exceeding their 9.2-unit combined thickness. This was an insufficient overlap setup, not evidence of a faulty toggle. Both snapshots and command logs are retained. The development-only harness now lowers bending stiffness and continues actual pointer movement toward the live target until contact occurs. The final run observes a genuine self contact, toggles it off without changing positions or time, and restores it with Defaults. All four UI diagnostic regressions pass.

- **Pass:** Default cloth contacts its contour and stays stable over sustained motion. See command log and matching observation/screenshot files.

- **Pass:** Draped cloth visibly bends around static contours over sustained motion. See command log and matching observation/screenshot files.

- **Pass:** Every visualization reads the same paused world without resetting it. See command log and matching observation/screenshot files.

- **Pass:** All eight scenarios advance with finite dynamics and the stress scene tears. See command log and matching observation/screenshot files.

- **Pass:** A pointer cut vents a balloon and its area collapses after release. See command log and matching observation/screenshot files.

- **Pass:** Reset restores the selected scenario graph and simulated time. See command log and matching observation/screenshot files.

### Attachment collision correction
The final scenario logs exposed a suspended-rope junction reporting a large attachment error. Root cause: coincident endpoints in distinct rope bodies were both constrained together and treated as colliding particles. The meaningful regression `attached points share a joint without colliding, then collide when the attachment breaks` failed against the existing embedded engine (`logs/attachment-collision-red.txt`). The collision filter now excludes only the exact endpoints of a live attachment. Breaking that graph edge restores their collision eligibility. No complete body is excluded from collisions. The full suite and all scenario flows are rerun against this final correction.

- **Pass:** Desktop metrics stay visible at 1280 × 800. See command log and matching observation/screenshot files.

- **Pass:** Pause freezes time and keyboard single-step advances one timestep. See command log and matching observation/screenshot files.

- **Pass:** Real pointer grab deforms cloth and releases pointer capture. See command log and matching observation/screenshot files.

- **Pass:** Pin and unpin change actual pinned particle count. See command log and matching observation/screenshot files.

- **Pass:** A rapid pointer cut permanently removes graph edges and surface triangles. See command log and matching observation/screenshot files.

- **Pass:** Stress and constraint modes preserve world state. See command log and matching observation/screenshot files.

- **Pass:** Pulling with Tear at a low threshold breaks real cloth constraints. See command log and matching observation/screenshot files.

- **Pass:** Impulse and wind tools alter live velocity and gust state. See command log and matching observation/screenshot files.

- **Pass:** All six object types spawn through labeled menu and canvas placement. See command log and matching observation/screenshot files.

Final attachment retest: all 20 core tests pass. All eight scenarios pass after the correction. At approximately 0.63 simulated seconds, the suspended rope snapshot now reports maximum error 0.02557 (previous reproduction: 12.30638), and zero contact pairs at its coincident joints. The loaded bridge retains 83 genuine contacts at its captured instant. The full desktop workflow and fresh offline desktop/mobile smoke checks pass against the corrected artifact.
