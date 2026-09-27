# Validation — Evolutionary Ecosystem Laboratory

Artifact: `index.html` (single self-contained file, ~1700 lines, no external deps).
Browser tool: `agent-browser` 0.31.1 (headless Chromium, CDP), served via `python3 -m http.server 8777` for inspection; direct `file://` open also verified.
Viewports tested: 1280×800 and 390×844.

## Core simulation

| Check | Result | Evidence |
|---|---|---|
| Boots, organisms move/seek/graze immediately | pass | `shot-boot.png`, eval: 186 orgs @ t182 |
| Feeding & energy transfer | pass | herbivores deplete plant field (50k→10k under grazing), `avgE` tracks food |
| Reproduction, inheritance, mutation | pass | births/deaths accrue; offspring `gen` increments (maxGen 21+ observed); `muts` recorded |
| Predator-prey dynamics | pass | carns 26→52 while herbs oscillate 1500↔2000 over 10k ticks; hunt/flee/attack states observed |
| Death + causes | pass | starvation 5055, injury(age) 1276, predation 179 counted in lineage archive |
| Corpse/scavenger channel | pass | corpses spawn on death, eaten by diet>0.3 organisms, decay → soil fertility |
| Speciation + phylogeny | pass | Sp-3, Sp-4, Sp-5 emerged from Sp-1 under mutation; species list clickable; phylo tree renders parent links (`shot-phylo.png`) |
| Deterministic seed | pass | two `resetWorld()` calls, same seed → byte-identical first-10 positions & plant field; different seed → different |
| Resource-limited population | pass | pop stabilizes/oscillates ~1000–2000 under plant depletion + crowding suppression, never pinned at cap post-fix |

## Controls & tools (all driven via real DOM clicks + pointer events)

| Check | Result | Evidence |
|---|---|---|
| Pause / Resume | pass | tick frozen across 1s when paused; resumes on click & Space key |
| Single-step | pass | +1 tick per Step click |
| Reset / seed field / reroll | pass | world regenerates deterministically |
| Speed slider 0.25×–32× | pass | 32× sustains ~330–500 ticks/s; frame-time cap keeps pointer responsive (22fps @ 1300 orgs, stress preset) |
| Wheel zoom | pass | cam.z 0.38→0.55 via `mouse wheel` |
| Right-drag pan | pass | cam 1200,800→829,482 |
| Select + inspect (real click) | pass | org #2 selected; inspector shows id/species/gen/age/energy/hp/parents/steer/sensed/genes/lineage |
| Follow | pass | camera lerps to selected org |
| Highlight kin | pass | 23 live kin for org #345; siblings+descendants listed correctly |
| Spawn herbivore/predator | pass | carn count +10 via Introduce predators; spawn tool adds orgs at pointer |
| Spawn food | pass | cell plant biomass +~25 on paint |
| Erase | pass | org #3 killed + archived via drag; walls/sanct/plants also cleared |
| Paint fertility/barren | pass | fert 0.86→1.0 under brush |
| Paint barrier | pass | walls 65→83 after drag |
| Paint heat/cold | pass | tempOff 0→+0.14 under brush |
| Sanctuary | pass | prey beside predator at hp100 after 200t inside sanct; control prey killed outside |
| Disasters | pass | drought: plants 10.3k→6.2k, herbivores →15 then recovered to 77+; extinction 70%: 1454→433; food pulse: 23.8k→120.9k plants; introduce predators: +10 carns |
| Presets | pass | all 7 load: balanced, lotka, islands (253 water cells carved), desert (harsh: dips to ~70 then recovers), radiation, extinction (auto-fires @t1500), stress (pop ~1300 on large world) |

## Display & data

| Check | Result | Evidence |
|---|---|---|
| 12 viz modes | pass | all cycled error-free; temp shows latitude gradient + diurnal; behavior shows flee/hunt/graze/mate clusters (`shot-trait-behavior.png`, `shot-viz-temp.png`) |
| Overlays | pass | sensor rays, steering vectors, vision rings, spatial grid, decision text, trails, night tint all render (`shot-overlays.png`) |
| Charts (7 modes) | pass | pop by role, by species, births/deaths, energy/biomass, trait histogram, diversity/gen, resources — all from retained `hist` samples (CSV row count matches sample count) |
| HUD | pass | fps, tick, speed, pop, births/deaths per 10t, species, maxGen, biomass, plants, selected, intervention, pause state |
| Save JSON / Load | pass | serialize→deserialize restores identical pop/tick/species/archive; file-input load path verified via DataTransfer |
| Autosave | pass | localStorage `ecolab.autosave` written (0.4MB @ t19211), Restore button wired |
| CSV export | pass | real blob, correct header, 1847 rows of live history |
| PNG export | pass | image/png blob, 111KB |
| file:// direct open | pass | runs clean, sim ticking, zero console errors |
| External requests | pass | none — only the document itself + own blob: URLs |
| Narrow viewport 390×844 | pass | canvas + HUD + collapsible panel (`☰ Controls`), `shot-mobile.png` |

## Fixes made during validation

1. Herbivores ran to cap / predators extinct → flee bonus 1.25→1.08, carn chase boost 1.18, attack energy steal, corpse meat ↑, slower plant regrow, repro cooldown 500t, crowding suppression, mate compatibility by genetic distance (<0.28) not strict species id.
2. Mid-diet scavenger niche added: diet>0.3 eats corpses, diet<0.6 eats plants, diet>0.55 hunts.
3. Species `parent` stored organism id → fixed to parent species id (phylogeny now correct).
4. Species names off-by-one (`Sp-2` for id 1) → fixed.
5. Species colors too similar in species mode → golden-angle palette per species id.
6. `bornTick` missing on organism records → added (lineage archive).
7. Desert preset wiped instantly → softened moisture/fert; now harsh-but-viable (~70–115 equilibrium).
8. Highlight-kin computed but never rendered → draw now honors `kinSet`.
9. Per-frame tick budget (34ms) added so pointer stays smooth at 32×.

## Known limitations / notes

- Saved-state RNG stream is reseeded from (seed, tick) on load — evolved world state is fully preserved; only post-load noise stream differs from an uninterrupted run.
- Autosave skipped if serialized state >24MB (stress preset + deep history can exceed it).
- Phylogeny view is species-level; individual ancestry is shown in the inspector lineage line.
- HUD births/deaths are per-10-tick sampled values (can read 0 momentarily between samples).
- Audio: none (not required).
