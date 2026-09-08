# Lumen Graph — validation record

Standalone artifact: `../index.html` (single file, no build, no runtime network dependencies).
Browser automation: **agent-browser 0.31.1** (core + exploratory commands). Isolated session `lumenstudio` used after the default session was stolen by other local file:// pages.

Local HTTP: `python3 -m http.server 8766 --bind 127.0.0.1` in the project directory.
External HTTPS aborted via `agent-browser network route "https://**" --abort` after first load.
Network log showed only `GET http://127.0.0.1:8766/index.html` (200) and browser-initiated `favicon.ico` (404). The app itself does not fetch assets.

## Environment

- Host: WSL2 Linux, Chromium via agent-browser CDP
- Viewports exercised: **1280×800** and **390×844**
- Direct file check: `file:///home/pyro/projects/naked/grok46/19-node-graphics-studio/index.html`

## Public workflow checks

| Check | Result | Evidence |
|---|---|---|
| Open default animated graph; live preview is evaluated from nodes | **pass** | `02-desktop-plasma.png`; pixels avg RGB ~178,130,189, alpha 255; compile `ok`; FPS 50–60 |
| Add node, connect compatible ports, change parameters, move nodes; preview changes | **pass** | Palette click added `clampN`; inspector slider `scale` + eval scale 2.2→12 produced pixel `diff` 12 384 838; node `fb` moved +48,+24 |
| Incompatible connection | **pass** | Connecting Output→palette: toast `Incompatible: Output has no output`; Comment input: `Incompatible: Comment has no inputs`; edge count unchanged |
| Illegal cycle | **pass** | `addEdge('rm','out','fb','uv')` toast `Cycle blocked. Use a Feedback Delay node for temporal loops.`; existing `fb.uv` still from `sc` |
| Disconnect | **pass** | Deleted edge `uv→sc`; remain 10; later preset reload restored graph |
| Undo / redo | **pass** | Duplicate FBM 14 nodes → Ctrl+Z 13 → Ctrl+Shift+Z 14 |
| Copy / paste | **pass** | Ctrl+D duplicated selected Fractal Noise (`fbm` appeared twice) |
| Pan / zoom / selection | **pass** | Fit button; wheel on `#graph-viewport` changed `view.z`; click selected `Fractal Noise node` (`sel:["fb"]`) |
| Animate time-dependent parameter | **pass** | Default plasma keyframes `sn.phase` 0→6.28; Time node wired into Add; Play; `t` advanced (e.g. 0.47s, 2.00s, 3.63s) |
| Switch preview diagnostics | **pass** | Diagnostic select `luma`; sampled pixels `grayFrac: 1`; screenshot `05-diag-luma.png` |
| Load complex preset | **pass** | All 10 presets compile `ok` with distinct averages (see below) |
| Save and reload graph | **pass** | `projectJSON` → load after switching to Clouds; `nodesMatch: true`, `pixDiff: 0` |
| Export PNG | **pass** | `canvas.toDataURL('image/png')` header `data:image/png;base64,` length 617 118 at 385×512; export dialog PNG size control present (`09-export-dialog.png`) |
| Export graph JSON | **pass** | Click **Export graph JSON** wrote `~/Downloads/lumen-graph.json` (3987 bytes, `v:1`, 11 nodes / 11 edges); copy in `lumen-graph.json` |
| Narrow viewport 390×844 | **pass** | `innerWidth/innerHeight` 390×844; plasma still compiling; Palette/Inspector drawers; `11-narrow.png`, `12-narrow-palette.png`, `13-narrow-inspect.png` |
| Direct `file://` open | **pass** | `14-file-protocol.png`; `protocol:file:`, `__NGS` present, compile `ok`, 11 nodes, animated plasma visible |
| Console / uncaught errors | **pass** | `agent-browser errors` and `console` empty on the studio page |
| Pointer inspect | **pass** | Hover preview: `u 0.500 v 0.500 · rgb 79, 181, 247 a 255` |

## Preset compile + pixel probe

After `PRESETS[k].build()` + `applyNow()` (forces shader compile + draw):

| Preset | nodes | edges | compile | avg RGB (sampled) |
|---|---|---|---|---|
| plasma | 11 | 11 | ok | 177.5, 129.7, 190.2 |
| marble | 9 | 8 | ok | 205.0, 196.4, 187.2 |
| wood | 9 | 9 | ok | 137.4, 105.7, 77.2 |
| clouds | 7 | 5 | ok | 196.9, 218.7, 239.6 |
| lava | 8 | 7 | ok | 107.8, 48.9, 0.0 |
| circuit | 10 | 10 | ok | 71.4, 116.6, 100.5 |
| organism | 8 | 7 | ok | 185.3, 77.5, 242.5 |
| neon | 11 | 11 | ok | 180.4, 104.8, 145.5 |
| terrain | 8 | 9 | ok | 226.5, 226.4, 223.8 (later remap/light tweak; still brighter than others) |
| poster | 11 | 12 | ok | 60.3, 54.6, 61.3 |

Screenshots: `preset-marble.png`, `preset-lava.png`, `preset-neon.png`, `preset-terrain.png`, `preset-circuit.png`, `preset-poster.png`.

## Commands used (representative)

```bash
python3 -m http.server 8766 --bind 127.0.0.1
agent-browser --session lumenstudio open http://127.0.0.1:8766/index.html
agent-browser --session lumenstudio set viewport 1280 800
agent-browser --session lumenstudio snapshot -i
agent-browser --session lumenstudio find role group click --name "Fractal Noise node"
agent-browser --session lumenstudio fill @e125 "6.5"
agent-browser --session lumenstudio select "#diag-select" luma
agent-browser --session lumenstudio select "#preset-select" marble
agent-browser --session lumenstudio find role button click --name "Load selected preset"
agent-browser --session lumenstudio find role button click --name "Open export dialog"
agent-browser --session lumenstudio find role button click --name "Export graph JSON"
agent-browser --session lumenstudio open file:///.../index.html
agent-browser --session lumenstudio set viewport 390 844
```

Live diagnostics read through `window.__NGS` (`state`, `compile`, `applyNow`, `getPixels`, `projectJSON`).

## Failures found and fixed during this run

1. **Transparent preview** — Output `alpha` defaulted to `0.0` when unconnected, so WebGL composited over the checkerboard. Default alpha is now `1.0`; fragment writes opaque RGB. Retest: alpha 255, plasma visible (`02-desktop-plasma.png`).
2. **Warp GLSL missing `}`** — Marble/wood failed with `'{' : syntax error` / return type mismatch. Brace restored; warp result type follows the image input. Retest: all 10 presets `compile ok`.
3. **Typed ports not converting** — `sin(vec2)` from poly Add/Warp. Compiler now casts into non-`any` ports. Retest: marble/wood `ok`.
4. **Preview resolution explosion on narrow layouts** — `preview 2048×512` on 390px. Resolution now fits the stage aspect with a 2048 cap. Retest: `preview [512, 127]` at 390×844, compile `ok`, FPS 50.
5. **Preset syntax** — Plasma/clouds `recipe(` missing `)`; Frame time node id collided with Frame group. Fixed before first successful load.

## Remaining limitations

- Per-node preview strips are category-colored, not independent live shader thumbnails.
- Dope sheet is compact (key ticks + playhead); not a full multi-curve bezier editor. Keyframe interp fields exist (`linear` / `step` / `smooth` / `ease`) but the inspector diamond always writes `linear`.
- Wires are cubic bezier, not orthogonal.
- Evaluation backend is WebGL2 only (no CPU/worker fallback). Browsers without WebGL2 show a toast.
- `eval ms` HUD often reads ~0.1 ms; `gl.finish()` is not a reliable GPU timer here.
- Animation file export uses `MediaRecorder` → WebM when available; otherwise a capped PNG frame sequence with a confirm dialog. Audio N/A.
- Terrain preset compiles and lights a height field but remains high-luminance compared with lava/neon.
- Box-select, wire click-to-select, and some pan paths are implemented; this run exercised selection/fit/zoom more than Shift-drag box select in the UI.
- Named-project save uses `prompt()` + `localStorage` (not clicked in UI this run; autosave key is written).
- Clicking **Export PNG** was not captured as a Downloads file; PNG bytes were verified via `toDataURL` and on-screen preview. JSON download **was** captured.

## Honesty notes

- Early screenshots `15-desktop-replay.png` / first `11-narrow.png` were **blank** because `agent-browser set viewport` spawned a new about:blank window in the default session. Those frames are not passes. Later isolated-session / file:// captures are the valid ones.
- `01-desktop-initial.png` was taken while alpha was still 0 (checkerboard). Not a pass for preview; kept as the pre-fix record.
- No evaluator score is claimed.
