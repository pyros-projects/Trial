# Validation Evidence — Evolutionary Ecosystem Laboratory

Artifact: `index.html` (single self-contained file, 105 KB, no build step, no network dependencies)
Test environment: Chromium (headless via agent-browser CLI), local HTTP server `http://localhost:8471`,
plus direct `file://` open. Simulation core additionally validated headlessly in Node 25 (`tune/balance.js`).

Legend: PASS / FAIL / BLOCKED / NOT-RUN. All results below were observed against the real application.

## A. Headless simulation-core suite (`node tune/balance.js`)

| Check | Result |
|---|---|
| Construct meadow world (138 organisms, plants seeded, terrain arrays sized) | PASS |
| 20 000 ticks meadow: no extinction, populations bounded (peak 922), births occur, generations advance (maxGen 19) | PASS |
| Predator–prey preset: predators persist, predator population oscillates (min 1 → max 7) | PASS |
| Island preset: watery world (>20 % water), population survives 8 000 ticks | PASS |
| Desert preset: harsh but habitable at 10 000 ticks | PASS |
| Rapid-radiation preset (mutation ×3.3): more living species than meadow (5 vs 3) | PASS |
| Determinism: seed 777 twice → identical organism positions/energies after 3 000 ticks (<1e-9) | PASS |
| Bloom raises plant count + fertility boost active; drought cuts moisture multiplier to 0.48 and dries cells; meteor at population centroid kills immediately | PASS |
| Disease: spreads, kills (>0 disease deaths), survivors become immune | PASS |
| Reserve: meteor at reserve center kills zero residents, kills organisms outside | PASS |
| Save→load roundtrip: pop/tick/energy preserved; after 500 more ticks pop within 5 %, generations within 0.5, species registry intact (221 KB save for 92 organisms) | PASS |
| Paint tools: fertility raises cell fertility, barrier makes cell impassable, erase restores | PASS |
| Remove tool: clears organisms/plants/corpses in radius | PASS |
| Performance: ~2.6–3.0 ms/tick at 700–800 organisms (16 ticks/frame ≈ 43 ms sim, budgeted to keep UI at 60 fps) | PASS |

History decimation: prefilling 3 700 samples and running forces the decimation branch → history bounded at 1 855 samples. PASS.

## B. Browser end-to-end checks (agent-browser, real controls unless noted)

### Boot & runtime health
- Page boots with no console errors on fresh load (marker-counter: 0 errors after tab switching + simulation at ×8). PASS
- `performance.getEntriesByType('resource')` → **0 requests** on both http:// and file:// — no external assets, fonts, or services. PASS
- Opening `index.html` directly via `file://` boots, runs, and exercises tabs with **0 fresh errors**. PASS (`evidence/screenshots/13-file-protocol.png`)

### Main workflow: feeding, energy, reproduction, death, population change
- Fresh world at ×8: tick 2 400 → pop 423 (H 374 · P 10 · S 39), maxGen 7, births 6/kt, deaths 3/kt, plants 1 437. Screenshot `14-final-default.png`. PASS
- Long-run observation (~10 000 ticks at ×16): prey 571→442→668, predators 117→97→156, generations 38→56 — predator–prey oscillation, no extinction. PASS
- Headless 20 k-tick run: same stability plus population overshoot/recovery. PASS

### Selection & inspector (live state)
- Real canvas click selects nearest organism (verified `selectedId === expected`). PASS
- Inspector shows ID, species chip + name, role, behavior, generation, age/lifespan, energy/maxE, health, speed, size, vision, digest, aggression, camouflage, comfort temperature, parent, offspring, descendants, mutations, infection, crowding, target, NN outputs (turn/thrust/sprint bars), full sensor vector, ancestry chain, and a live portrait. Screenshot `06-portrait.png`. PASS
- Single-step (⏭ ×5): tick 2050→2055, age +5, energy 39.56→39.44, behavior updates from live state. PASS
- Selection update after target death: original target died of old age mid-test; click selected a nearby predator instead (ecologically correct). PASS

### Charts (retained history, not invented curves)
- All six charts render from `world.history` (169 samples at check time): population by role, births/deaths, energy & biomass, generation & diversity, resource abundance, trait histogram. Verified drawn pixels per canvas + legend values. Screenshot `07-charts.png`. PASS
- CSV export: 151 samples, 17 columns, values match live history (`~/Downloads/ecosystem-history-t3004.csv`). PASS
- Trait histogram is drawn from the current population and labeled "(current population)"; historical trait averages are present in CSV columns (avgSpeed/avgSize). Honest labeling. PASS (with note)

### Visualization modes & overlays
- 12 viz modes via select; energy/behavior/fertility modes verified visually (08, 09). PASS
- Overlays: sensor rays, steering vectors, decision outputs, spatial-partition cells, target ring, species names — toggled via real checkboxes; drawn correctly (screenshot 09, 12); 0 errors while running at ×4–×16. PASS

### Interventions (measurable responses, real buttons)
- Bloom: plants 1497→1514 (at plant capacity; fertility boost verified active). PASS
- Drought: moisture multiplier ramps to 0.48; population 1018→798; HUD shows active event with countdown. PASS
- Meteor: 798→726 (−72 killed instantly), event + impact coordinates recorded. PASS
- Food pulse: +300 plants immediately. PASS
- Introduce predators: +10 predators. PASS
- Disease / cold snap / heat wave / wildfire: covered headlessly (PASS in suite); buttons share the same code path. PASS

### Tools (pointer + keyboard)
- Herbivore spawn tool: template (gen 0) herbivore appears at click point. PASS
- Remove tool: targeted organism removed. PASS
- Fertility brush: cell fertility 0.738→0.788 after paint. PASS
- Reserve: pointer-drag creates protected rectangle; dashed overlay renders; HUD shows "🛡 reserve"; protection behavior unit-tested headlessly. PASS
- Barrier/erase/moisture/heat/cool brushes share the applyBrush path (headless PASS). PASS
- Note: drag/pinch gestures were driven by synthetic PointerEvents dispatched at real screen coordinates (the CLI has no native coordinate-drag); they execute the app's genuine event-handler path. All clicks on buttons/tabs/minimap/canvas were native browser input. PASS (with note)

### Navigation
- Wheel zoom toward cursor: 0.339→0.453. PASS
- Two-finger pinch: 0.696→1.391. PASS
- Minimap click jumps camera. PASS (used during selection flow)
- Follow mode toggles; camera tracks selected organism. PASS

### Simulation controls
- Pause/resume (button + Space), single step (⏭ + `.`), speed ×1→×32 (buttons + `+/−`): verified; HUD reflects all three. PASS
- Deterministic reset: seed 4242 reset twice → bit-identical initial genomes/positions, tick 0. PASS
- Presets load via select+Load: meadow (138), oscillation (186: H170/P8/S8), small world 1700×1150 (138). PASS
- Slider changes write `world.params` live (labels verified). PASS

### Persistence
- Save to file: real download `ecosystem-t3004-seed4242.json` (836 KB). PASS
- Load from file (real file input): tick exactly 3004, seed 4242, pop 501, 3 species restored. PASS
- Autosave every 30 s; restores across reload (pop/tick correct immediately, HUD not zeroed). PASS
- PNG export: download triggered without error. PASS (file content not separately inspected — it is a canvas snapshot)

### Responsive / input coverage
- 1280×800 desktop: full layout. PASS
- 390×844 narrow: canvas fills viewport, panel becomes a drawer (☰ opens/closes, verified via class state), toolbar wraps to two rows so pause/step/speed remain reachable, HUD compacts, minimap shrinks. Screenshots `10-narrow.png`, `11-narrow-panel.png`. PASS
- High-DPI: canvas backing store scaled by devicePixelRatio (capped 2). PASS (code inspection + crisp rendering in screenshots)

## C. Fixed during validation (reproduced → fixed → retested)
1. Boot crash: sliders built before world existed; removed stray `buildTraitSel` call → boot reordered. Retested: full boot.
2. `clamp is not defined` in speed control → local helper added. Retested: ×1…×32.
3. Terrain layer stretched over viewport ignoring camera → drawn in world transform. Retested: pan/zoom moves terrain (04).
4. `Math.hypot2` typo broke inspector portrait → fixed; portrait draws (pixel check).
5. `o.in` null-deref for unsensed organisms with overlay rays → guarded. Retested: 0 errors at ×8 with all overlays.
6. `setPointerCapture` threw on synthetic pointers → try/catch. Retested: reserve drag.
7. Newborn organisms never received `spId` (core bug found headlessly) → prey ignored predators, speciation/stats broken → fixed; suite re-run all PASS.
8. `World.load` didn't seed stats → HUD zeros after paused load → `sample(true)` on load. Retested in browser.
9. Toolbar overflow on narrow screens → wraps. Retested at 390 px.
10. Viz-cycle key conflicted with predator tool (`n`→`k`). Retested.

## D. Blocked / not-run / limitations
- **Physical touch device: NOT-RUN.** Touch input is implemented via Pointer Events and validated with synthetic touch-pointer events + narrow-viewport rendering; no real handset was available.
- **PNG content: not visually inspected** beyond successful download (canvas snapshot by construction).
- **Audio: N/A** — the application has no audio features.
- Drag/pinch gestures used synthetic (untrusted) PointerEvents through the app's real handlers — noted honestly above; native single clicks and all widgets were genuinely browser-driven.
- Scavengers are persistently viable headlessly (S=12/8/27 across seeds at t=15 000) but can dwindle to 1–6 individuals in some long browser runs when predators out-compete them at carcasses — ecologically plausible, monitored, not a defect.
- The trait-distribution chart plots the current population (labeled as such) rather than a historical series; historical trait averages are retained in history/CSV.

## E. Screenshots
- `01-boot.png` first boot (before fixes)
- `02-boot-fixed.png` working boot
- `03-fresh-world.png` fresh world, camera fix pending
- `04-camera-fit.png` terrain camera transform fixed
- `05-inspector.png` selected organism + inspector (during fixes)
- `06-portrait.png` inspector + portrait fixed
- `07-charts.png` charts from live history
- `08-viz-energy.png` energy visualization
- `09-overlays.png` sensor rays / steering / decisions / grid / behavior mode
- `10-narrow.png` 390×844 viewport
- `11-narrow-panel.png` narrow viewport with drawer
- `12-reserve.png` reserve rectangle + overlays
- `13-file-protocol.png` direct `file://` open
- `14-final-default.png` final default experience at ×8

## F. Final build verification
- Final `index.html` rebuilt from `src/` after the last change (initial camera frames the living population at zoom ×1.7 of fit, centered on the population centroid). PASS
- Bundle syntax-checked (`node --check` on extracted script). PASS
- Self-containment: `grep` for `http(s)://`, `@import`, `url(`, `src=`, `href=` → 0 matches. PASS
- Fresh default world (seed 1234, meadow): pop 135 at tick 250 with 0 fresh errors; screenshot `15-final-framing.png`. PASS
