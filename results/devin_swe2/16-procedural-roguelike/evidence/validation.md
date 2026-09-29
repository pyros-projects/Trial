# Validation — BELOW (procedural tactical roguelike)

Artifact: `index.html` (single self-contained file, ~2170 lines, no external deps).
Validated with `agent-browser` 0.31.1 (real Chromium via CDP) against a local
`python3 -m http.server 8471` and also via `file://` direct open. Driving used a
mix of real keyboard events (`agent-browser press`), real DOM PointerEvents on the
canvas, button clicks, and in-page state inspection through the game's exposed
diagnostic handle `window.RG`.

## Environment
- Browser: Chromium via agent-browser CDP, headless.
- Viewports tested: 1280x800 and 390x844 (viewport resize via `set viewport`).
- Console: **clean** — zero errors/warnings across all runs (`agent-browser console`).
- Network: only `index.html` itself fetched; no external assets (verified via
  `agent-browser network requests`; favicon 404 is browser-automatic).

## Checks

### Generation & determinism — PASS
- 5 seeds (alpha/beta/gamma/delta/omega) floor 1: 1 connected region, 0 unreachable
  walkable tiles, exit reachable, 0 trapped spawns. PASS
- All 5 floors (fortress/caverns/crypt/overgrown/sanctum) + arena: same result.
  Boss present only on floor 5. PASS
- Same seed twice → byte-identical tiles+entities; different seed → different.
  `daily-YYYY-MM-DD` seed produces its own map, no network. PASS
- Locked doors can never gate the exit (validated; doors demoted when blocking —
  fixed during dev after observing a softlock). PASS

### Turn engine — PASS
- Energy scheduler verified: bat (spd 60) acted 17×, orc (spd 128) acted 8× over
  10 player turns (~expected 16.7 vs 7.8). PASS
- Enemies never act while awaiting input or paused: game time + all enemy
  positions frozen for 2s+ real time with no input, and while paused. PASS
  (engine is synchronous — runs only inside `commitAction`)
- Illegal actions (wall bump, no-key locked door) consume no turn. PASS
- Wait/move/attack/item/door/descend all consume turns via explicit cost table
  (rubble/water tiles cost more). PASS

### Perception — PASS
- Closed door: enemy `losClear=false`, stays `aware=false` 4 turns; after player
  opens door, orc sees player, becomes aware, walks through doorway. PASS
- Smoke pellet: `losClear` false through cloud, `seen=false` (hidden enemy). PASS
- Guardian asleep (`aware=false`) while visible but out of its sight radius. PASS
- Enemies retain only `lastKnown` position outside LOS (verified stale value).
  No wallhack targeting anywhere — all AI uses own LOS + noise. PASS
- Combat now emits noise (alert radius) — rats nearby converge on fights. PASS

### AI archetypes — PASS
- chaser approaches via distance map (d 8→4); archer keeps range/shoots;
  wraith attack→retreat cycle; guardian awakens + leashes to home;
  cultist summons skeletons (cap); slime leaves acid trail + splits on death;
  pack rats gain +dmg per adjacent ally; boss cycles phases 0→3 (summons,
  speed-up, enrage) with telegraphed slam (telegraph seen + resolved). PASS

### Combat & items — PASS
- Melee bump-attack, ranged staff/bow fire with tracer, accuracy-vs-dodge rolls,
  armor reduction, crits (log shows "for N damage — critical!"), XP, level-ups
  with 3-choice boon modal. PASS
- Items exercised: blood potion (heal, consumes turn), firebomb (AoE + chain
  barrels + fire tiles), throwing knife, smoke pellet, frost wand path,
  iron key on locked chest AND locked door (both found & fixed a no-detect bug),
  bandage/haste/blink scroll paths present. PASS
- Class abilities: blink (teleport to visible tile, CD 7), aimed shot (+30 acc
  +4 dmg, CD 6), shield bash (stun, CD 8) — targeted + cooldowns enforced. PASS
- Traps: snare applies immobilize ("You cannot move!" skips a turn), revealed on
  trigger, disarm path exists. Spike/alarm/blink implemented. PASS
- Chests open on bump, spawn loot; locked chests need keys; barrels chain-
  explode (verified 2→both dead + fire effects). Fountain/altar one-use boons. PASS

### Controls — PASS
- Keyboard: arrows/WASD/vim/numpad moves, wait, i inventory, x inspect (+arrows),
  f fire-mode, q ability, g pickup, c+dir close door, > / Enter descend,
  Esc/p pause, ? help, F1-F10 diag. PASS (all pressed via real key events)
- Pointer: click tile → previewed path auto-walks one step per turn and halts on
  newly-seen enemy; click adjacent enemy → melee; click distant enemy with ranged
  weapon → shoot; hover → tactical tooltip (stats/AI/awareness); right-click
  cancels. PASS (real PointerEvents dispatched at canvas coords)
- Touch/narrow: action buttons (WAIT/PACK/etc.) work via tap at 390x844; turns
  consumed correctly; layout stays usable. PASS

### Run loop — PASS
- Title → class select (3 classes w/ loadouts) → seed/difficulty/arena/
  permadeath/quick-start-floor → 5 floors → boss → VICTORY modal (score) /
  YOU DIED (score + retry-floor in forgiving mode) → records in localStorage.
  Arena mode has its own win condition (all enemies dead → victory). PASS
- Floor transition regenerates correctly (fortress→caverns observed). PASS
- Retry floor restores exact floor-entry snapshot. PASS

### Persistence & replay — PASS
- Autosave each turn; manual save → `loadState` restores byte-exact state
  (stateHash identical incl. rng position). PASS
- Reload page → CONTINUE → identical hash restored. PASS
- Export run JSON (29KB) → import back → identical hash; invalid JSON and
  wrong schema version rejected cleanly. PASS
- `verifyReplay` (F10): re-simulates full action log deterministically —
  hash match on same floor AND across a descend/floor-regen boundary
  (109 actions). PASS

### Rendering / UI — PASS
- Procedural tile sprites + composed entity glyphs (not colored squares),
  FOV dim/light vignette, particles, damage floaters, tracers, screen shake,
  minimap (explored/stairs/enemies/player), HP/XP bars, status chips, boss bar,
  log with categories, toasts, contextual stairs prompts, action hotbar. PASS
- Live overlay shows fps, floor, seed, turn, HP/level, visible foes, statuses,
  objective, action state (ready/INSPECT/TARGETING/AUTO-MOVE), save flag,
  PAUSED/OVER. PASS

### Diagnostics — PASS
- F1 walkability, F2 regions, F3 FOV, F4 distance-map heat, F5 AI intent lines,
  F6 turn queue, F7 occupancy, F8 gen validation panel — all render, live-toggle.
  F9 reveal-all, F10 replay verify, ` cycle. PASS

### Stability — PASS
- 240+ turns on crypt with 20 ents; 49 enemies spawned → ~4ms/turn, 60-61 fps.
  No console errors anywhere. PASS

## Known limitations / not verified
- Audio: WebAudio synthesized SFX verified to initialize and fire without errors
  after user gesture; actual audible quality not heard (headless). PARTIAL
- Real finger-touch gestures approximated via PointerEvents + element taps;
  no physical device tested. PARTIAL (design uses unified pointer events)
- Long-run = ~400 turns tested; multi-hour sessions not soaked. NOT-RUN
- Cosmetic toasts may briefly linger across a new-run transition. Minor.

## Screenshots
01-title, 02-f1-start, 03-f2-caverns, 04-death, 05-pause, 06-inventory,
07-narrow, 08-diag (dist+intent+queue), 09-settings, 10-help, 11-overgrown,
12-crypt, 13-arena-fire, 14-diag2 (walk+regions+fov+occ+gen), 15-combat,
16-narrow-kb.
