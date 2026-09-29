# Raw validation log (agent-browser 0.31.1, headless Chromium, SwiftShader WebGL2)

## T1 load via file://
- `agent-browser open file://…/index.html` after `localStorage.clear()` + reload
- network requests: only `GET file:///…/index.html (Document) 200`
- `agent-browser errors`: empty; `agent-browser console`: empty
- studio.state(): compileState=ready, shaderError=null, software=true (SwiftShader), internal 172×183 (adaptive dyn 0.30), 9 objects, selected "Core"

## T2 add + transform
- clicked "Add Box", "Add Torus" buttons -> stack gains "Box" and "Torus 3" (inserted above Floor)
- selected Box row (click), filled Position X/Y/Z=1.7/0.6/0.9, Rotation Y=30, Scale X=1.6, Half Y=0.35
  -> object state {"pos":[1.7,0.6,0.9],"rot":[0,30,0],"scale":[1.6,1,1],"params":[0.6,0.35,0.6,0]}
  -> GPU pick at projected centre: hit "Box" t=5.429 (5 steps)
- selected Torus 3 row, real mouse drag on red X gizmo arrow (661,428)->(780,431):
  -> pos [0,1.35,0] -> [0.971,1.35,0]; camera unchanged (yaw 32 pitch 11 dist 7.4); inspector Position X field shows 0.971
- screenshot 02-added-transformed.png

## T3 composition ops (Torus 3 placed at (1.7,0.95,0.9) on the box top)
| op | pick tubeTop (1.7,1.17,0.1) | pick core (-0.3,2,0.4) | pick boxSide (1.7,0.6,1.5) |
|---|---|---|---|
| union | Torus 3 t=6.606 | Core t=6.785 | Box t=5.476 |
| subtract | Floor t=11.454 (torus removed) | Core t=6.785 (unchanged) | Box t=5.481 |
| intersect | Floor t=11.450 | Floor t=25.651 (sculpture clipped away) | Floor t=7.103 |
- screenshots 03a/03b/03c + 03-ops-sheet.png: subtract carves a groove into the box top (cut faces take the cutter's yellow), intersect leaves only box∩torus (everything above Torus 3 in the stack is intersected).

## T4 viewport picking (real mouse down/up on the canvas, no drag)
- groove pixel from coarse scan (689,504) -> selected "Floor": that scan pixel was a 1-px sliver at a notch edge (pick map below shows it); not a mis-pick
- pick map (T=Torus 3 cut faces, B=Box, .=Floor) around the box confirmed the notch faces belong to the cutter
- click (645,557) inside a solid T region -> selected "Torus 3" (op subtract), list row + inspector + overlay agree; cursor {slot:9,t:6.04,steps:15,outcome:0}
- click on box face (757,562) -> "Box"; click on core point (585,345) -> "Carve" (that pixel is the carved cavity face, whose owner is the cutter); click on sky (400,120) -> deselected (null)
- screenshots 04-pick-cutface-selects-cutter.png, 04-pick-deselect.png

## T5 reorder
- probe pixel (645,557): before = Torus 3 cut face t=6.042
- "Move selected object up" button (Torus 3 above Box) -> order [...,Glass Drop,Torus 3,Box,Floor]; same pixel = Box t=5.435 (box no longer carved)
- Alt+ArrowDown on focused canvas -> order restored, pixel = Torus 3 t=6.042 again
- HTML5 drag (agent-browser drag li:nth-child(10) -> li:nth-child(9)) -> Torus 3 moved above Box
- screenshot 05a-reorder-cutter-above-box.png

## T6 material
- Box selected, clicked "Metal" chip -> mat.metal=1, chip aria-pressed=true; Roughness value filled 0.15
- `agent-browser fill` on <input type=color> produced #000000 (tool limitation with native colour inputs); colour then set via value + dispatched `input` event -> mat.color "#d4a030"
- 06-material-sheet.png: blue glossy -> gold metal; Material ID view (key 5) shows Box in metal class colour, groove faces glossy class

## T7 visualization modes (select #modeSel)
- final, normal, depth, id, material, steps, shadow, ao, slice, outcome each rendered distinct output; legend text updated per mode
  (depth "near … far (60)", steps "0 … 160 steps", slice "outside d>0 / inside d<0 / d=0 / Y = 1 · bands 0.1u", outcome "hit / passed max distance / ran out of steps")
- 07-modes-sheet.png + 07-mode-*.png

## T8 resize
- 1280x800: viewport css 712×757.5, internal 171×182 (adaptive 0.24 on SwiftShader)
- 390x844: css 390×371.4, internal 94×89, no horizontal overflow, tabs Scene/Object/Render switch panels (08a/08b/08c)
- FAIL found: stats overlay covered most of the phone viewport and the Stats button wrapped behind it (08a)
  FIX: compact 3-line overlay when viewport < 560 css px, non-wrapping toolbar; retest 08d: toolbar fits (Stats right edge 364px < 390), overlay 3 lines
- back to 1280x800: css 712×757.5, internal 171×182 again

## T9 quality settings (Render tab inputs)
| change | avg steps | hit % | out-of-steps % | internal |
|---|---|---|---|---|
| baseline (160 steps, ε 1e-3) | 22.37 | 67.8 | 0 | 171×182 |
| Max steps 12 | 11.55 | 22.0 | 77.2 | 171×182 |
| Hit ε 0.03 | 12.02 | 73.6 | 0 | 171×182 |
| shadows Off, AO Off, bounces 0, resolution 0.4 | 22.35 | 67.8 | 0 | 85×91 (35 fps) |
| shadows Ultra, AO High, bounces 3, resolution 0.8 | 22.36 | 67.8 | 0 | 171×182 (3.9 fps) |
- 09-quality-sheet.png

## T10 export / import
- `agent-browser download "#btnExport" evidence/downloads/exported-scene.json` -> 11,188 bytes, format "sdf-csg-studio" v1, 11 objects, settings + camera included
- loaded preset "CSG primer" (6 objects) via #presetSel, then `agent-browser upload "#fileInput" exported-scene.json`
  -> 11 objects restored in order, Torus 3 op "subtract", toast "Imported “Orbital Bloom — smooth sculpture” (11 objects)"
- upload bad-syntax.json -> toast "Import failed: bad-syntax.json is not valid JSON (Unexpected end of JSON input)", scene unchanged (11 objects)
- upload bad-type.json (type "hypercube") -> toast "Import failed: objects[0] has unknown type "hypercube"", scene unchanged
- screenshots 10a-imported.png, 10b-import-error.png

## T11 copy deterministic representation
- clicked "Copy scene": toast "Copied canonical scene (4187 chars, fnv1a=85e1ceec …)"; copied text === studio.canonical(); two consecutive canonical() calls identical
- round trip: canonical before re-import === canonical after importing exported-scene.json (fnv1a=85e1ceec both)
- saved evidence/downloads/canonical-scene.txt (sorted keys, 4-decimal numbers, ids + animation clock excluded)
- note: headless clipboard write reported success; the pasted clipboard content itself was not read back by an external app

## T12 PNG export
- `agent-browser download "#btnPng" …/screenshot-export.png` -> "PNG image data, 570 x 606" (full internal res at scale 0.8, adaptive bypassed); image shows the full render (viewed)
- follow-up fix: PNG export now omits the selection highlight (editor-only); re-exported after fix
- outline visibility fix: the selection outline was a faint 1-px line on the light Core; changed falloff to smoothstep (solid within ~1 px, fades by 2.6 px); retest crop shows clear amber edge

## T13 rename + persistence
- FAIL found: double-clicking the name of a row that was not selected did not open the rename box (first click re-rendered the list, so the dblclick lost its target)
  FIX: selection now updates row attributes in place (updateListSelection) and dblclick is delegated to the list container
- retest: `agent-browser dblclick '#objList li:nth-child(10) .nm'` -> focused input "Rename object" = "Torus 3"; Ctrl+A, typed "Groove Cutter", Enter -> list + inspector show "Groove Cutter"
- reload (agent-browser open same file) -> names [...,"Box","Groove Cutter","Floor"], selection "Groove Cutter" restored from localStorage

## T14 shader compile error handling (test-only hook studio.debug.injectShaderError(), which appends a function using an undeclared identifier to the generated GLSL)
- error panel "Shader compilation failed — still showing the last working shader" with the ANGLE log and a generated-source excerpt around line 223; console: "[sdf-studio] shader compilation failed … undeclared identifier"
- the last working program kept rendering: GPU pick at the Core still returned an object; perf overlay shows "shader error"
- "Dismiss" hides the panel
- FAIL found: after clearShaderError() the state stayed "error" (identical source short-circuited without resetting error state); also a NUL char in the ANGLE log
  FIX: reuse path resets compileState/lastShaderError/panel; NUL stripped. Retest: compileState "ready", shaderError null, panel hidden (14a/14b screenshots)

## T15 unsupported WebGL2
- relaunched with `agent-browser --args "--disable-software-rasterizer,--disable-gpu"` -> canvas.getContext('webgl2') === null in page
- panel "WebGL2 is not available" (no dismiss), compileState "unsupported"; editor still usable: "Add Sphere" -> 10 objects, no page errors
- polish: perf overlay now reads "WebGL2 unavailable — rendering disabled" (was "0.0 fps · render 1×1"); 15-no-webgl2.png

## T16 camera (real input)
- first attempt made no change: after the relaunch the viewport was 1280×577, so drags at y=650 landed on <html>, and `agent-browser mouse wheel` dispatches at (0,0) (topbar), not at the cursor — both tool/setup issues, verified by logging pointer events
- `agent-browser set viewport 1280 800`, then:
  - left drag (450,700)->(600,650): yaw 32 -> -20.5, pitch 11 -> -6.5 (0.35°/px)
  - right drag (+80,-50): target [0,1.35,0] -> [-0.412,1.07,-0.188]
  - wheel via CDP Input.dispatchMouseEvent mouseWheel at (600,400): deltaY +300 -> dist 7.4 -> 10.607; -600 -> 5.163
  - Shift+left drag via CDP (modifiers=8): target moved to [0.343,1.35,-0.214], yaw unchanged (agent-browser keyboard-down Shift does not set shiftKey on its mouse events)
  - F with Glass Drop selected -> target [-1.35,0.38,0.95], dist 1.142 (animated); R -> home camera; "Reset cam" button -> home camera
- screenshots 16a-focus-selected.png, 16b-after-orbit.png

## T17 keyboard + structural edits
- Ctrl+D duplicated Halo -> "Halo copy" inserted after it (10 objects); H hid it (row class hidden-obj); Delete removed it, selection moved to next
- ] / [ cycle selection; Space toggles playing; 6 -> steps view; 1 -> final; Escape deselects
- Glass Drop: Type select -> Rounded Box (recompile, pick still "Glass Drop"); Repeat on + Spacing X 1 + Count X 1 -> probe 1 unit along +X now hits "Glass Drop" (was "Plinth"); eye button "Hide Glass Drop" -> centre probe hits Floor

## T18 animation time
- Render tab: unchecked "Playing", Time value 0 -> screenshot, Time value 2.5 -> screenshot; 5219 px changed (bbox around the Noise Blob and its reflections); time stayed 2.50 after 2 s while paused

## T19 WebGL context loss
- WEBGL_lose_context.loseContext(): panel "WebGL context lost", no runtime errors
- restoreContext(): compileState "ready", panel hidden, GPU pick at Core returns an object again, internal 171×182 (18-context-restored.png)

## T20 High-DPI (agent-browser set device "iPhone 14", DPR 3)
- css 390×371, internal 187×178 (= 390 × min(DPR,2) × 0.8 res × 0.3 adaptive), overlay canvas 1170×1114 (native DPR), no horizontal overflow
- idle refine frames: High-DPI off -> 312×297, on -> 624×594

## T21 touch pinch (CDP Input.dispatchTouchEvent, iPhone 14 emulation)
- fingers 80 px -> 220 px apart: camera dist 7.4 -> 2.691; 220 -> 80: back to 7.4

## T3b smooth ops / morph (New scene: Sphere + Floor, added Box at (0.6,0.8,0))
| op | sphere-only point | overlap point | box-only point |
|---|---|---|---|
| union | Sphere 4.377 | Box 4.141 | Box 4.185 |
| smoothUnion k .3 | Sphere 4.364 | Box 4.092 | Box 4.185 |
| smoothIntersect | Floor 8.903 | Sphere 4.266 | Floor 7.561 |
| smoothSubtract | Sphere 4.389 | Box 5.545 | Floor 7.562 |
| blend 0.3 | Sphere 4.518 | Sphere 4.191 | Floor 7.565 |
| blend 0.8 | Floor 8.899 | Box 4.157 | Box 4.465 |
- 20-ops-sheet.png

## T22 preset + mode tour
- all 7 presets via #presetSel, then all 10 modes via #modeSel: `agent-browser console` empty, `agent-browser errors` empty, compileState ready, runtimeErrors []

## Static self-containment
- `grep -nE "https?://|src=|<link|@import|import\(|\bimport |fetch\(|XMLHttpRequest|url\(" index.html` -> only 2 comment lines ("import / export", "import & storage"); only href is a blob: object URL for downloads
- index.html: 2235 lines, 128,306 bytes
