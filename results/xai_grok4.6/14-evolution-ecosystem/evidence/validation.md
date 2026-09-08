# Evolutionary Ecosystem Laboratory — validation

Artifact: `/home/pyro/projects/naked/grok46/14-evolution-ecosystem/index.html`  
Tester: agent-browser  (skill `agent-browser` core + dogfood workflows)  
Date: 2026-09-08

## Environment

- Local HTTP: `python3 -m http.server 8766 --bind 127.0.0.1` in the project directory
- URL: `http://127.0.0.1:8766/`
- External HTTPS aborted with `agent-browser network route "https://**" --abort`
- Direct file: `file:///home/pyro/projects/naked/grok46/14-evolution-ecosystem/index.html`
- Viewports: `1280x800` and `390x844`
- No evaluator score is recorded here

The delivered file has no `http(s)` URLs, `fetch`, `import`, CDN, fonts, or image files. Runtime network on `file:` was a single document GET of `index.html`. On HTTP, requests were the local document (and, before a blank `data:` favicon was added, a browser-initiated `/favicon.ico` 404). Cached external resources were not used.

## How the main workflow was exercised

Not just page load. The run used labeled buttons, sliders, selects, pointer down/move/up on the canvas, keyboard Space, screenshots, console/network inspection, and live `window.EvoLab` reads of organism sensors, decisions, genomes, history arrays, and grid food.

## Check results

| Check | Result | Evidence |
| --- | --- | --- |
| Opens as standalone HTML (`file:`) | **pass** | Session `evolab-file`; title Evolutionary Ecosystem Laboratory; sim ran; feeding/births at tick 555 |
| Opens over local HTTP without external assets | **pass** | Session `evolab`; network log only localhost documents after favicon fix |
| Default biome shows foraging, feeding, reproduction, death | **pass** | Seed 42, 180–240 ticks: herbivores forage (`behavior: foraging`, `foodS` ~1.1–2.0), `lastMeal` tracks tick, population 102 → 160–197, generation 2, births/deaths > 0 |
| Organisms are agents, not particles | **pass** | Inspector: energy, health, age, generation, parents, descendants, mutations, sensors, decision outputs, genotype |
| Select creature; live inspector updates | **pass** | Canvas click at organism screen coords selected `#1`; HUD SELECTED `#1`; inspect panel Role/Behavior/Energy/Sensors/Decisions/Genotype |
| Single-step changes live state | **pass** | Tick 372→373 via Step button; energy of `#1` changed on `EvoLab.step()` after 180 ticks |
| Pause / resume | **pass** | Pause button, Resume button, Space key (`paused` true→false), HUD STATE |
| Deterministic reset | **pass** | `reset(42)` twice at tick 0: identical `pop`/`herb`/`pred` |
| Reset control | **pass** | Reset button: tick 0, pop 102, gen 0 |
| Charts from retained history | **pass** | `history.t.length` grows; herb series `[72,71,68,…]` not a fake curve; Charts tab canvases visible |
| Lineage / phylogeny | **pass** | After fix: “LINEAGE OF #1”, ancestors `#1 g0`, living offspring `#103`, species chips, phylogeny canvas |
| Species highlight | **pass** | Click `sp 2 (14)` → `highlightSpecies=2`, viz=`species` |
| Drought / food pulse alter resources | **pass** | Food 1992.47 → 1059.4 under drought; pulse 1059 → 1565.82 |
| Climate / preset population response | **pass** | Tick 200 meadow pop 169 / food 2035 vs desert pop 59 / food 528 |
| Starvation after food wipe | **pass** | Food filled to 0, growth 0: pop 130→110, energy 13255→7516 |
| Predator introduction | **pass** | Predators 14→32 after disaster (spawn + time) |
| Save / load preserves genotypes and lineages | **pass** | `serialize`/`hydrate`: tick, org id, diet gene, population match |
| Autosave | **pass** | `localStorage evolab-autosave` ~342 KB, `v===1`, orgs array |
| Invalid save error | **pass** | `hydrate({v:9})` throws `Unrecognized save format` |
| PNG export generation | **pass** | `canvas.toDataURL('image/png')` starts `data:image/png;base64,` |
| CSV history shape | **pass** | Keys include t, herb, pred, scav, births, deaths, energy, biomass, food, gen, species, diversity, speed, vision, size |
| OS file-download / file-picker dialogs | **not-run** | Save JSON / Load JSON / Export CSV / Export PNG buttons exist; OS dialog not completed |
| Visualization modes | **pass** | UI select: natural, energy, species, temperature (island heat field screenshot) |
| Overlays | **pass** | Sensor rays + steering toggled on; screenshot 06 shows rays/vectors |
| Pan | **pass** | Pointer drag on Select tool: camera `{400,320}` → `{350,282.5}` |
| Zoom (wheel handler) | **pass** | Native `WheelEvent` on canvas: z 1.6 → 1.776 → 1.598 |
| Zoom via agent-browser `mouse wheel` | **blocked** | Command ran over canvas; camera.z unchanged. Handler works; automation wheel did not land on the canvas listener |
| Spawn / paint terrain | **pass** | `paint('spawnH')` 300→301; `paint('rock')` set `block=1`; Food tool spawn path |
| Protected observation area | **pass** | Protect tool + pointer drag set `{x:201,y:83.5,w:100,h:80}` |
| Follow | **pass** | Follow tool clickable; camera lerp toward selected organism reduced distance (`closer: true`) |
| Desktop 1280×800 | **pass** | Screenshots 01, 02, 05, 06, 12 |
| Narrow 390×844 | **pass** | Screenshot 07; tools wrap; Inspect opens bottom sheet (08); Pause still clickable after layout fix |
| Accelerated sim stays interactive | **pass** | Speed filled to ~10×; painting/tools still handled on pointer events independent of tick cap |
| Console uncaught errors | **pass** | `agent-browser errors` / `console` empty on HTTP and `file:` |
| High-DPI / resize | **pass** | Viewport switches 1280×800 and 390×844 re-laid out; canvas uses `devicePixelRatio` |
| Presets | **pass** | balanced meadow, island isolation (1794 blocked water cells, pop 66), dense stress (310 start, ~60 FPS at pop ~294) |
| Audio quality | **not-run** | No audio in this artifact |

## Failures found and fixed during the run

1. **Herbivore population exploded** (~1100 at tick 1065, one species). Tightened reproduction (crowd/food gates, higher cost/cooldown), founder genome noise, role-aware species distance. Retest: 240 ticks → pop 207, 4 species, feeding/births/deaths still occurring.
2. **`makeOrg` briefly referenced undefined `o`** while adding founder mutation. Restored `blankOrg`. Retest: reset and run succeeded.
3. **Lineage tab kept empty-state copy** after a selection (tree drew under the placeholder). Rebuilding lineage HTML on tab switch. Retest: “LINEAGE OF #1”, offspring `#103`, species chips (screenshot 13).
4. **Pause button label lagged API pause.** `statsHTML` now mirrors Pause/Resume. Retest: after Pause click, button reads Resume.
5. **Mobile inspector covered tools/transport.** Bottom sheet + `position:relative` on workspace. Retest: Inspect open, Pause still received the click (`paused: true`).
6. **Pan while spawn tool was active** spawned instead of panning. Expected. Retest pan with Select: camera moved.
7. **Stale lastMeal after reset.** Cleared on preset apply. Retest: after 180 ticks `lastMeal` is 180, not a previous-run tick.

## Remaining limitations

- Species assignment is a centroid distance approximation; clusters can merge or split when mutation is high.
- Herbivores may still reproduce without a mate if energy is high; predators/scavengers require a nearby mate.
- Chart series are clickable via lineage species chips, not by picking a polyline on the chart canvas.
- Pinch-to-zoom is not implemented; pan uses pointer drag, zoom uses wheel.
- `agent-browser mouse wheel` could not drive zoom; real-browser wheel events do.
- OS download/file-picker flows for JSON/CSV/PNG were not completed end-to-end.
- Dense-stress default is hundreds of organisms (310 start), not thousands; the engine ran ~1100 earlier before reproduction limits.

## Screenshots

All under `evidence/screenshots/`:

- `01-desktop-1280.png` — default meadow, HUD, tools
- `02-selected-organism.png` — inspect live sensors/decisions
- `03-lineage.png` — lineage tab (pre-fix placeholder still visible)
- `04-lineage-selected.png` — phylogeny after selection
- `05-charts.png` — live history charts
- `06-energy-viz-overlays.png` — energy view, sensor/steer overlays, drought event
- `07-mobile-390.png` — 390×844 layout
- `08-mobile-inspect.png` — mobile inspect sheet
- `09-file-protocol.png` — direct `file:` open
- `10-island-temperature.png` — island isolation + temperature field
- `11-dense-stress.png` — dense population
- `12-regression.png` — post-fix meadow, selected forager
- `13-lineage-regression.png` — lineage + offspring after the empty-state fix
