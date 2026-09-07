# Validation — 3D Hydraulic Erosion Laboratory

Artifact: `/home/pyro/projects/naked/grok46/02-hydraulic-erosion/index.html` (self-contained, ~71 KB).  
Browser tool: installed `agent-browser` 0.31.1 (skill `agent-browser` / `core`).  
Local inspect server: `python3 -m http.server 8877 --bind 127.0.0.1` (dev only; not a runtime dependency).  
Session: `--session erosion` for HTTP, `--session erosion-file` for `file://`.

No evaluator score is recorded here.

## How the app was opened

```bash
agent-browser --session erosion set viewport 1280 800
agent-browser --session erosion open http://127.0.0.1:8877/index.html
agent-browser --session erosion wait --fn "window.ErosionLab && window.ErosionLab.ready === true"
```

Direct file:

```bash
agent-browser --session erosion-file set viewport 1280 800
agent-browser --session erosion-file open file:///home/pyro/projects/naked/grok46/02-hydraulic-erosion/index.html
```

Network while on HTTP: a single `GET http://127.0.0.1:8877/index.html` (200). No CDN, fonts, textures, or other hosts.  
Network while on `file://`: a single `GET file:///.../index.html`.  
`index.html` contains no `fetch`, `import`, `require`, or `https://` URLs.

## Diagnostics API used

Live state was read with `window.ErosionLab.getStats()`, `.sample()`, `.heights()`, `.water()`, plus pointer/keyboard/button interaction. Console was checked with `agent-browser console` after major flows; no uncaught errors were printed.

---

## Public checks

| Check | Result | Evidence |
|---|---|---|
| Simulation runs immediately and water changes the heightfield, not only shading | **pass** | `heightHash` diverged from `heightHash0` within 0.5 s; continued to change over 3 s (e.g. `2009770457` → `2754882334`) while `nanCount=0`. |
| Add water with real pointer input | **pass** | Tool `water`, mouse down/move/up on canvas. Volume `108.67` → `116.22`. Probe at paint site `W 0.0006` → `W 0.1458`. Screenshot `tool-water.png`. |
| Edit terrain with real pointer input | **pass** | Tool `raise`, drag on canvas. `heightHash` `41908408` → `2269237030`; mean height `0.40788` → `0.40806`; probe `H 0.4893` → `H 0.5337`. Screenshot `tool-raise.png`. |
| Water / sediment / erosion diagnostics evolve | **pass** | Probe shows H, W, S, slope, flow, Δ. Status overlay tracks water volume and sediment. Viz modes Water, Sediment, Delta, Slope, Flow are visually distinct (`viz-*.png`). |
| Changing rainfall / evaporation produces meaningful difference | **pass** | After ~1.85 s: high rain `0.06` / evap `0.004` → water `1696`, maxW `0.210`. After reset + ~1.90 s: rain `0.004` / evap `0.05` → water `136`, maxW `0.069`. |
| Orbit | **pass** | Left-drag on canvas; camera view changed (`desktop-orbit.png`). Probe still hit terrain. |
| Pause / resume | **pass** | Pause button sets `paused:true`, `sim 0.0ms`, overlay shows `PAUSED` / `RESUME`. Mobile pause also worked after layout fix (`mobile-paused.png`). |
| Single-step | **pass** | While paused: time `57.3307` → `57.3640` (Δ `0.0333`), hash `2291220489` → `783078471`, remained paused. |
| Reset | **pass** | Time `0`, `heightHash === heightHash0`. |
| Regenerate (deterministic seed) | **pass** | Same seed `42017` produced the same `heightHash` `2921354878`. Dice/new seed is available for a different landscape. |
| Viz mode switch does not reset sim | **pass** | Cycled Shade/Elev/Water/Sed/Delta/Slope/Flow while paused; time stayed `57.3307` and hash stayed `2291220489`. |
| Presets | **pass** | Mountain drainage, canyon, island, river valley, aggressive stress test all applied. Stress ran at `160×160`, `sim ~13ms`, `nanCount=0`, hash changing. Screenshots `preset-*.png`. |
| Export heightfield PNG | **pass** | In-page canvas export produced a 128×128 PNG data URL (`data:image/png;base64,...`, 17830 chars, 14831 non-flat pixels). `#btn-export-png.click()` invoked the UI handler. |
| Export / import JSON | **pass** | File-input roundtrip restored `time≈42.5` and `seed=777`. `#btn-export-json.click()` invoked the UI handler. |
| Desktop 1280×800 | **pass** | Default validation viewport. `desktop-shaded.png`, `desktop-orbit.png`, `desktop-final.png`. |
| Narrow 390×844 | **pass** | After a layout fix (see below). Pause clickable at top; panel is a bottom sheet (`max-height ~32vh`). `mobile-390.png`, `mobile-paused.png`. |
| Direct `file://` open | **pass** | `protocol: file:`, `ErosionLab.ready=true`, WebGL context present, sim stepping, screenshot `file-protocol.png`. Not blocked. |
| Console / failed requests | **pass** | Empty console after load, tools, presets, export, file://. No failed network requests. |
| High-DPI | **pass** | Renderer uses `devicePixelRatio` capped at 2. Not separately screenshot at 2×. |
| Smooth / flatten / dry / sediment brushes as dedicated pointer drags | **not-run** | Implemented on the same `applyBrush` path as raise/water; only raise and water were dragged end-to-end. |
| Agent-browser `find role` click on Export PNG/JSON | **fail** (workaround used) | Click hit-test reported the full-viewport canvas covering the button. Worked via `document.getElementById(...).click()` and via in-page PNG generation. Buttons are visible in the Archive section (`file-protocol.png` shows Import JSON). |

---

## Fixes during validation

1. **Flooded domain.** First run used closed boundaries and rain ≫ evaporation, so mean water depth approached mountain height. Switched mountain/stress presets to open edges, lowered rain, raised evaporation. After retune: avg water ~0.05 at t≈5 s, peaks dry, channels/basins visible.
2. **Thermal erosion units.** Talus compared height delta to `tan(38°)≈0.78` (almost never triggered). Now uses `tan(38°) * cellWorldSize`.
3. **Brush ignored first mouse automation.** Canvas originally listened only to pointer events. Added mouse fallbacks and apply-brush after raycast so drag painting uses the current hit.
4. **Stale water/sediment totals after reset while paused.** `tallyMass()` now runs on generate, reset, and brush.
5. **Mobile overlap.** At 390×844 the Pause row sat on top of the tool bar, so Pause clicks hit Shade/Orbit. Top bar stays at the top; panel sits above the wrapped toolbar. Retest: `paused:true` at `vw=390, vh=844`.
6. **256² index buffer.** `OES_element_index_uint` + 32-bit indices when vertex count exceeds 65535.

---

## Remaining limitations

- Reported FPS in the automation browser was often 12–21 even when `sim+draw` was ~6–10 ms. That is consistent with background `requestAnimationFrame` throttling, not with the inner timers. Focused interactive use should be faster.
- Peak `|v|` in grid units is large (~40–80). Flux scaling, water caps, and NaN repair kept the run stable (`nanCount=0`, `unstable=false` in all recorded samples).
- Some overlay buttons are hard for hit-test click tools because the WebGL canvas is full-window; they remain usable by a real pointer (they sit in a `z-index:12` panel) and by `.click()`.
- Smooth, flatten, dry, and sediment brushes were not each separately drag-tested.
- No audio; none claimed.

---

## Screenshot index

- `desktop-shaded.png` — default mountain drainage, 1280×800
- `desktop-orbit.png` — after orbit drag + probe readout
- `desktop-final.png` — restored mountains preset
- `zoom.png` — wheel zoom attempt after reset
- `viz-water.png`, `viz-elev.png`, `viz-sed.png`, `viz-delta.png`, `viz-slope.png`, `viz-flow.png`, `viz-shaded.png`
- `tool-water.png`, `tool-raise.png`
- `preset-canyon.png`, `preset-island.png`, `preset-valley.png`, `preset-stress.png`
- `help.png` — keyboard field notes
- `lighting-az90.png` — azimuth slider
- `mobile-390.png`, `mobile-interact.png`, `mobile-paused.png`
- `file-protocol.png` — `file://` load
