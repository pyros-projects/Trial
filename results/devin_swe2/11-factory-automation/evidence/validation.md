# Validation — Foundry (factory automation game)

**Artifact:** `index.html` — one self-contained file (~111 KB), zero external
assets/scripts/fonts/network deps (verified: `grep` for `src="http`, `link rel`,
`fetch(`, CDN hosts → 0 matches; `performance.getEntriesByType('resource')` shows
only `favicon.ico`).

**Tool:** `agent-browser` 0.31.1 (Chromium via CDP). Local server: `python3 -m http.server 8749`.

## Environment

- Viewports tested: 1280×800 (desktop), 390×844 (narrow/mobile)
- `file://` direct open: **pass** — app boots, sim ticks, starter preset produces.
- Console after latest build: **clean** (zero errors, zero preset-placement warnings).

## Simulation correctness (browser-evaluated live state)

| Preset | Result | Evidence |
|---|---|---|
| starter | **pass** | 46 iron_plate delivered @tick1120, supply 200, stalled 0 |
| balanced | **pass** | full chain to `circuit` delivered, supply 300, nopower 0 |
| congested | **pass** | 21 plates delivered, artery visibly queued (blocked:3, items 153) |
| powercrisis | **pass** | supply 100 vs demand 189 → real ~53% brownout, intended |
| multibus | **pass** | circuits delivered (3+), nopower 0, inserter-fed inputs work |
| stress | **pass** | 60 fps @ 4× speed, 375+ items, supply 700, plates delivered both lanes |
| contract c1 | **pass** | won: 40/40 plates in 4:00, score 2369 shown in banner |
| contract c2 | **pass** (runs) | produces circuits toward 30/540s target; designed to require expansion |

## Interaction checks (real pointer/keyboard via agent-browser)

- Pause button → `W.paused=true`, tick frozen. **pass**
- Single-step button → exactly +1 tick per click. **pass**
- Space key → resumes, tick advances. **pass**
- Speed select → `W.speed` changes (1x→4x), sim scales coherently. **pass**
- Select tool + canvas click → smelter selected, inspector shows
  power/draw/recipe/progress/modules. **pass**
- Belt tool + mouse drag → 7-cell belt lane placed with correct directions. **pass**
- `R` rotates hovered belt (dir 0→1). **pass**
- `Delete` removes hovered ent. **pass**
- Erase tool drag → 4+ cells cleared in one drag. **pass**
- Undo/redo: remove→undo→belt back→redo→belt gone. **pass** (after fix, see below)
- Overlays menu → power-net web + congestion tint render on canvas. **pass**
- Analytics panel → live per-item rates, power supply/demand, per-machine util. **pass**
- Settings menu → belt speed / cost mode take effect live. **pass**
- Preset menu → all 6 presets + 2 contracts listed; click loads. **pass**
- Save menu → Export JSON (valid v3 file, 7 KB), PNG (valid render),
  named slot save, autosave (localStorage `foundry.slots`/`foundry.autosave`). **pass**
- Share code → `shareEncode`/`shareDecode`+`deserializeWorld` roundtrip exact
  (tick, ents, delivered all identical). **pass**
- Corrupt import → `{err:'bad header'}` / `decode failed` / `bad dimensions`,
  app unaffected. **pass**
- Audio: AudioContext `running` after pointer gesture; sfx calls wired. **pass**
  (state verified only — audible quality not claimed)
- Reset button (⟲, confirm intercepted) → reloads preset, tick restarts. **pass**
- Deterministic seed: `newWorld(40,30,42)` twice → identical terrain; seed 43 differs. **pass**

## Required public-check items

- Extraction→transport→processing→delivery chain: **pass** (all presets deliver;
  multibus produces circuits = 3-stage chain ore→plate→gear+wire→circuit)
- Item movement / recipes / power consumption: **pass**
- Blocking/backpressure: **pass** — smelter `blocked` when output lane cut;
  miners `blocked` when downstream saturates
- Belt rotation / item deletion: **pass**
- Splitter: **pass** — congested bypass splitter alternates both outputs
  (items observed on both branch cells, `nextSide` toggles)
- Inserter: **pass** — recipe-filtered feed verified (circuit asm gets wire+gear
  only; inserter `blocked` when target buffer full)
- Deliberate bottleneck → metrics change: **pass** — cutting bus belt at (20,10)
  backed up queue (beltQueue 3), smelter stall `blocked`, delivery rate dropped
- Pause / single-step / speed / save+reload exact state / preset survives resize:
  **all pass**

## Bugs found & fixed during validation

1. **Bootstrap deadlock** — miners needed power, gens needed coal: miners now
   hand-crank at 25% when `powerFactor<=0`.
2. **`e.net` never assigned to poles/gens** → `net.supply` never accumulated →
   supply stayed 0. Fixed in `rebuildPower`.
3. **`undo()` broke redo history** — `deserializeWorld` cleared both stacks;
   stacks now preserved across restore.
4. **Preset geometry**: several dead-end lanes, head-on merges, splitter inputs
   from wrong side, belt trunks inside deposit patches (rejected by canPlace),
   bus crossing a vertical collector (belt-over-belt merge leaked copper onto
   iron bus), pole chains exceeding `POLE_RANGE` → fragmented nets. All fixed;
   final console clean.
5. `POLE_RANGE` 3→4 and `GEN_OUT` 80→100 for sane coverage/supply.

## Honest limitations

- `contract c2` (30 circuits / 9:00) verified producing and completable-in-
  principle, but full completion not waited out — layout alone is slow without
  expansion (intended difficulty).
- Audio verified as `AudioContext.state==='running'` + sfx dispatch on events;
  no subjective audio-quality claim.
- Pinch/zoom touch path exists in code (pointer events) but only mouse was
  exercised on this desktop harness.
- `merger` ent exists and is placeable; not exercised in presets (splitters
  cover the demo).
