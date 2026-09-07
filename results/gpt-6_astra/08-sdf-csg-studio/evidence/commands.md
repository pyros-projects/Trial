# Browser command record

Working directory for all relative paths: `/home/pyro/projects/naked/astra/bench/08-sdf-csg-studio`.
Commands were dispatched sequentially through the shell, in batches joined by `&&`. Snapshots, live-state reads, and screenshots were inspected between phases. The initial `sdf` session and final clean `sdf-final` session both used agent-browser 0.31.1 / Chrome 143.0.7499.40. `sdf-faults` was used only for explicit error injection.

## Numerical / syntax checks

```sh
node evidence/tests/core.test.cjs
node evidence/tests/review-regression.cjs
node evidence/tests/transform-regression.cjs
node - <<'JS'
const fs=require('fs'),vm=require('vm');
const h=fs.readFileSync('index.html','utf8');
for(const m of h.matchAll(/<script(?: id="sdf-core")?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
console.log('Embedded JavaScript parses.');
JS
```

## Desktop creation and CSG

After direct-file opening and 1280×800 setup documented in validation.md:

```sh
agent-browser --session sdf scrollintoview '#new-scene'
agent-browser --session sdf click '#new-scene'
agent-browser --session sdf find role button click --name 'Add object A'
agent-browser --session sdf snapshot -i
agent-browser --session sdf find role button click --name 'Add Sphere'
agent-browser --session sdf find label 'Object name' fill 'Boolean base'
agent-browser --session sdf find label 'Scale X' fill '1.2'
agent-browser --session sdf find label 'Scale Y' fill '1.2'
agent-browser --session sdf find label 'Scale Z' fill '1.2'
agent-browser --session sdf find role button click --name 'Add object A'
agent-browser --session sdf find role button click --name 'Add Box'
agent-browser --session sdf find label 'Object name' fill 'Cutting box'
agent-browser --session sdf find label 'Position X' fill '0.65'
agent-browser --session sdf find label 'Position Y' fill '0.5'
agent-browser --session sdf find label 'Rotation Z' fill '15'
agent-browser --session sdf find label 'Scale X' fill '0.9'
agent-browser --session sdf find label 'Scale Y' fill '0.8'
agent-browser --session sdf find label 'Scale Z' fill '0.9'
agent-browser --session sdf screenshot evidence/screenshots/04-csg-union.png
agent-browser --session sdf select '#operation' subtract
agent-browser --session sdf screenshot evidence/screenshots/05-csg-subtraction.png
agent-browser --session sdf select '#operation' intersect
agent-browser --session sdf screenshot evidence/screenshots/06-csg-intersection.png
agent-browser --session sdf select '#operation' subtract
agent-browser --session sdf find role button click --name 'Front view'
agent-browser --session sdf screenshot evidence/screenshots/07-picking-targets.png
agent-browser --session sdf find role button click --name 'Reset camera'
agent-browser --session sdf mouse move 540 425
agent-browser --session sdf mouse down
agent-browser --session sdf mouse up
agent-browser --session sdf screenshot evidence/screenshots/08-picked-base.png
agent-browser --session sdf mouse move 680 369
agent-browser --session sdf mouse down
agent-browser --session sdf mouse up
agent-browser --session sdf eval 'JSON.stringify({selected:studio.state.selected,lastPick:studio.diagnostics.lastPick})'
agent-browser --session sdf screenshot evidence/screenshots/09-picked-cutter.png
agent-browser --session sdf find role button click --name 'Move object up'
agent-browser --session sdf screenshot evidence/screenshots/10-reordered.png
agent-browser --session sdf find role button click --name 'Move object down'
agent-browser --session sdf select '#material-style' metallic
agent-browser --session sdf scrollintoview '[data-color="#e7bca0"]'
agent-browser --session sdf click '[data-color="#e7bca0"]'
agent-browser --session sdf screenshot evidence/screenshots/11-copper-cut.png
agent-browser --session sdf find role button click --name 'Move selected object'
agent-browser --session sdf mouse move 680 380
agent-browser --session sdf mouse down
agent-browser --session sdf mouse move 705 350
agent-browser --session sdf mouse up
agent-browser --session sdf screenshot evidence/screenshots/12-direct-translation.png
agent-browser --session sdf find role button click --name 'Select and orbit'
```

Modes were selected with `agent-browser --session sdf select '#view-mode' VALUE`, with VALUE in order `normals`, `depth`, `id`, `steps`, `shadow`, `ao`, `slice`, `final`. A screenshot was captured for every mode (`13`–`19`). The slice control was focused with `focus '#slice-z'`, followed by two `press ArrowRight` calls.

## Editing continuity and camera

```sh
agent-browser --session sdf scrollintoview '[aria-label="Position X"]'
agent-browser --session sdf focus '[aria-label="Position X"]'
agent-browser --session sdf press Control+a
agent-browser --session sdf keyboard type '-0.75'
agent-browser --session sdf press ArrowUp
agent-browser --session sdf eval 'JSON.stringify({active:document.activeElement.getAttribute("aria-label"),value:document.activeElement.value,position:studio.state.objects[1].position})'
agent-browser --session sdf find role button click --name 'Duplicate selected object'
agent-browser --session sdf find role button click --name 'Delete selected object'
agent-browser --session sdf find role button click --name 'Undo'
agent-browser --session sdf find role button click --name 'Redo'
agent-browser --session sdf find role button click --name 'Hide Cutting box'
agent-browser --session sdf screenshot evidence/screenshots/20-hidden-cutter.png
agent-browser --session sdf find role button click --name 'Show Cutting box'
agent-browser --session sdf mouse move 800 440
agent-browser --session sdf mouse down
agent-browser --session sdf mouse move 850 465
agent-browser --session sdf mouse up
agent-browser --session sdf find role button click --name 'Pan camera'
agent-browser --session sdf mouse move 800 440
agent-browser --session sdf mouse down
agent-browser --session sdf mouse move 770 460
agent-browser --session sdf mouse up
agent-browser --session sdf mouse wheel -180
agent-browser --session sdf find role button click --name 'Focus selected object'
agent-browser --session sdf find role button click --name 'Reset camera'
```

Camera state was read with `eval 'JSON.stringify({afterOrbit:studio.state.camera})'` and equivalent labels after pan/zoom and focus; logs `21-camera-*` preserve those results.

## Render settings and file workflows

```sh
agent-browser --session sdf find role button click --name 'Render settings'
agent-browser --session sdf select '#setting-resolution' 0.5
agent-browser --session sdf select '#setting-maxSteps' 64
agent-browser --session sdf fill '#setting-epsilon' '0.002'
agent-browser --session sdf fill '#setting-maxDistance' '80'
agent-browser --session sdf select '#setting-shadow' 8
agent-browser --session sdf select '#setting-ao' 2
agent-browser --session sdf select '#setting-reflection' 0
agent-browser --session sdf focus '#setting-fov'
agent-browser --session sdf press ArrowRight
agent-browser --session sdf focus '#setting-exposure'
agent-browser --session sdf press ArrowRight
agent-browser --session sdf screenshot evidence/screenshots/22-quality-settings.png
agent-browser --session sdf click '#settings-done'
agent-browser --session sdf find role button click --name 'Export'
agent-browser --session sdf click '#copy-json'
agent-browser --session sdf wait --fn 'document.querySelector("#export-feedback").textContent.includes("copied")'
agent-browser --session sdf download '#json-download' /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/downloads/roundtrip.json
agent-browser --session sdf download '#png-download' /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/downloads/viewport.png
agent-browser --session sdf click '.close-dialog'
agent-browser --session sdf find role button click --name 'Import'
agent-browser --session sdf fill '#import-json' '{broken json'
agent-browser --session sdf click '#import-submit'
agent-browser --session sdf screenshot evidence/screenshots/24-import-invalid.png
agent-browser --session sdf get text '#import-error'
```

The successful file round trip deleted the selected object before importing:

```sh
agent-browser --session sdf click '.close-dialog'
agent-browser --session sdf find role button click --name 'Delete selected object'
agent-browser --session sdf find role button click --name 'Import'
agent-browser --session sdf upload '#import-file' /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/downloads/roundtrip.json
agent-browser --session sdf wait --fn 'document.querySelector("#import-json").value.includes("Boolean base")'
agent-browser --session sdf click '#import-submit'
agent-browser --session sdf wait --fn 'studio.state.objects.length === 2 && !document.querySelector(".dialog")'
agent-browser --session sdf eval 'studio.serialize()'
agent-browser --session sdf reload
agent-browser --session sdf eval 'studio.serialize()'
```

Clipboard readback via `agent-browser --session sdf clipboard read` was denied. The content was instead verified through real paste:

```sh
agent-browser --session sdf find role button click --name 'Export'
agent-browser --session sdf click '#copy-json'
agent-browser --session sdf wait --fn 'document.querySelector("#export-feedback").textContent.includes("copied")'
agent-browser --session sdf click '.close-dialog'
agent-browser --session sdf find role button click --name 'Import'
agent-browser --session sdf focus '#import-json'
agent-browser --session sdf press Control+v
agent-browser --session sdf get value '#import-json'
```

The pasted JSON in `logs/44-clipboard-paste.json` equals the exported scene.

## Presets, animation, mobile and resizing

Each preset was loaded with `find role button click --name 'Load NAME preset'`, for names Mechanical, Impossible arch, Liquid glass, Lattice, Precision test, and Orbital study, with screenshots `29`–`34`.

```sh
agent-browser --session sdf find role button click --name 'Play animation'
agent-browser --session sdf wait --fn 'studio.state.settings.time > 0.35'
agent-browser --session sdf find role button click --name 'Pause animation'
agent-browser --session sdf find role button click --name 'Reset animation time'
agent-browser --session sdf set viewport 390 844
agent-browser --session sdf click '.mobile-nav [data-panel="scene"]'
agent-browser --session sdf click '#add-object'
agent-browser --session sdf find role button click --name 'Add Capsule'
agent-browser --session sdf find label 'Object name' fill 'Mobile capsule'
agent-browser --session sdf find label 'Position X' fill '1.1'
agent-browser --session sdf find label 'Scale Y' fill '0.8'
agent-browser --session sdf screenshot evidence/screenshots/36-mobile-inspector.png
agent-browser --session sdf click '.mobile-nav [data-panel="viewport"]'
agent-browser --session sdf mouse move 190 415
agent-browser --session sdf mouse down
agent-browser --session sdf mouse move 220 440
agent-browser --session sdf mouse up
agent-browser --session sdf find role button click --name 'Focus selected object'
agent-browser --session sdf screenshot evidence/screenshots/37-mobile-edited.png
agent-browser --session sdf set device 'iPhone 15'
agent-browser --session sdf screenshot evidence/screenshots/40-mobile-high-dpi.png
agent-browser --session sdf set viewport 1280 800
```

The initially requested tool profile `iPhone 13` was unsupported. `agent-browser doctor --offline --quick` passed (14 pass, 0 fail); the supported iPhone 15 profile was used instead (393×852, DPR 3).

The reproduced resizing failure and successful fix used these same transitions, recorded via `record start …/resize-before.webm` / `record stop` and `record start …/resize-after.webm` / `record stop`. The fixed result was checked with:

```sh
agent-browser --session sdf wait --fn 'document.querySelector("#viewport").getBoundingClientRect().height === 615'
agent-browser --session sdf screenshot evidence/screenshots/54-resize-fixed.png
```

## Error handling

```sh
agent-browser --session sdf eval 'window.formLoss=document.querySelector("#canvas").getContext("webgl2").getExtension("WEBGL_lose_context"); formLoss.loseContext(); true'
agent-browser --session sdf wait --fn '!studio.diagnostics.ready'
agent-browser --session sdf screenshot evidence/screenshots/45-context-lost.png
agent-browser --session sdf eval 'formLoss.restoreContext(); true'
agent-browser --session sdf wait --fn 'studio.diagnostics.ready && studio.diagnostics.shaderCompiled'
agent-browser --session sdf screenshot evidence/screenshots/46-context-restored.png
```

For unavailable WebGL / shader failure, the separate `sdf-faults` browser was launched with `--init-script /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/tests/faults.js`. This development-only script returns null for WebGL2, or injects invalid fragment source when the URL has `?simulate=shader`. HTTP and HTTPS were blocked in that session too. Screenshots `47` and `48` show actual app recovery messages. JSON export succeeded with no WebGL (`downloads/no-webgl-scene.json`).

## Final clean session

This session used **no `--allow-file-access` flag and no init script**:

```sh
agent-browser --session sdf-final --args '--enable-unsafe-swiftshader' --download-path /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/downloads open about:blank
agent-browser --session sdf-final network route 'https://**' --abort
agent-browser --session sdf-final network route 'http://**' --abort
agent-browser --session sdf-final set viewport 1280 800
agent-browser --session sdf-final open file:///home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/index.html
agent-browser --session sdf-final screenshot evidence/screenshots/final-desktop.png
agent-browser --session sdf-final find role button click --name 'Export'
agent-browser --session sdf-final download '#json-download' /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/downloads/final-roundtrip.json
agent-browser --session sdf-final click '.close-dialog'
agent-browser --session sdf-final find role button click --name 'Delete selected object'
agent-browser --session sdf-final find role button click --name 'Import'
agent-browser --session sdf-final upload '#import-file' /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/downloads/final-roundtrip.json
agent-browser --session sdf-final wait --fn 'document.querySelector("#import-json").value.includes("Counterform")'
agent-browser --session sdf-final click '#import-submit'
agent-browser --session sdf-final wait --fn 'studio.state.objects.length === 5'
agent-browser --session sdf-final eval 'studio.serialize()'
agent-browser --session sdf-final reload
agent-browser --session sdf-final eval 'studio.serialize()'
agent-browser --session sdf-final set viewport 390 844
agent-browser --session sdf-final wait --fn 'document.querySelector(".left-panel").getBoundingClientRect().right <= 0'
agent-browser --session sdf-final screenshot evidence/screenshots/final-mobile.png
agent-browser --session sdf-final click '.mobile-nav [data-panel="inspector"]'
agent-browser --session sdf-final wait --fn 'document.querySelector(".right-panel").getBoundingClientRect().right <= innerWidth+1'
agent-browser --session sdf-final find label 'Position X' fill '-0.05'
agent-browser --session sdf-final screenshot evidence/screenshots/final-mobile-inspector.png
agent-browser --session sdf-final click '.mobile-nav [data-panel="viewport"]'
agent-browser --session sdf-final set viewport 1280 800
agent-browser --session sdf-final find role button click --name 'Load Orbital study preset'
agent-browser --session sdf-final errors
agent-browser --session sdf-final console
agent-browser --session sdf-final network requests
agent-browser --session sdf-final eval 'JSON.stringify({viewport:[innerWidth,innerHeight],diagnostics:studio.diagnostics,scene:studio.state.title})'
```

Other final regression actions included all five CSG operations (`58`–`62`), normal/depth/ID/steps (`63`–`66`), creation/rotation and actual surface picking of a plane (`68`), dragging its X handle from (711,581) to (741,581), applying a checker material (`69`), and checking a live zero-step SDF slice probe (`74`). State logs preserve measured coordinates and GPU results.
