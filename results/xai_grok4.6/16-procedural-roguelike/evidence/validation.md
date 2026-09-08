# Cinder Reliquary — validation

Agent-authored. No evaluator score. Outcomes: pass / fail / blocked / not-run.

**Artifact:** `/home/pyro/projects/naked/grok46/16-procedural-roguelike/index.html` (single self-contained HTML, ~99 KB, 2117 lines).  
**Harness:** `agent-browser` 0.31.1 (installed skill `agent-browser` core + dogfood). Local HTTP `python3 -m http.server 8766 --bind 127.0.0.1`.  
**Date:** 2026-09-08.

## How it was exercised

Commands (representative):

```bash
python3 -m http.server 8766 --bind 127.0.0.1
agent-browser --session reliquary open http://127.0.0.1:8766/
agent-browser --session reliquary set viewport 1280 800
agent-browser --session reliquary snapshot -i
agent-browser --session reliquary click @e3          # New Run
agent-browser --session reliquary fill @e15 "relic-alpha"
agent-browser --session reliquary select @e16 "fortress"
agent-browser --session reliquary click @e3          # Start
agent-browser --session reliquary press ArrowRight   # movement
agent-browser --session reliquary click @e1          # Wait
agent-browser --session reliquary click @e17         # Heart Tincture
agent-browser --session reliquary mouse move 558 400 && mouse down/up   # path walk
agent-browser --session reliquary set viewport 390 844
agent-browser --session filetest open file:///.../index.html
agent-browser --session reliquary eval 'JSON.stringify(window.__RL.getState())'
```

Live diagnostics via `window.__RL` (generation, FOV, occupancy, AI lastKnown, import/export). Interactions used labeled buttons, keyboard, pointer, and touch D-pad — not source inspection alone.

Network during HTTP checks: only `http://127.0.0.1:8766/` document loads plus browser `/favicon.ico` probes (404 before an inline SVG icon was added). No CDN, fonts, images, or XHR from the game.

---

## Public validation checks

| Check | Result | Evidence |
|---|---|---|
| Two seeds, connected maps | **pass** | `relic-alpha` fortress: `validation.ok`, reach 419, stairs (37,28). `cavern-beta` cavern: ok, reach 451, stairs (4,2). Screenshots `03-play-fortress.png`. |
| Several turns of movement | **pass** | Keyboard arrows moved (9,8)→(10,9); later arena (2,3)→(7,4). Turns incremented 1:1 with accepted actions. `04-after-moves.png`. |
| Closed-door occlusion | **pass** | Arena spawn: `visE=0`, `seesBow=false`, tiles beyond door `9,4` not in FOV. After opening: `The door yawns.`, `visE=['bow']`, `sees 11,3` and `9,4`. `06-arena-closed-door.png`, `07-door-opened.png`. |
| Enemy discovery | **pass** | Emberbow appeared in visE only after the door opened; overlay `visE 1`. |
| Combat + damage | **pass** | Log: `A bolt hits you for 1` (HP 32→29), `The shot misses (60%)`. Melee: `Emberbow dies.` at turn 17. `08-combat-item.png`. |
| Item or status | **pass** | Spikes −3 HP; Heart Tincture restored 32 and consumed. Pickup `Taken: Ash Knife.` Binder: `Powder veils the air (1 foes)` and miss chance 45%→30%; lantern oil `status.oil=21`. Equipment slots populated. |
| Enemies path around walls | **pass** | Bow moved 11,3→12,4 after door opened (not through wall). After the vertical wall was sealed, bow stayed on the east side (15,9) and wandered instead of clipping west. |
| Legal turns only | **pass** | Second action during `phase==='anim'` rejected. One player action → one `turn++`. |
| Knowledge lost outside LOS | **pass** | After seeing player (`lastKnown.turn=6`) and closing the door: `bowVis=false`, lastKnown kept. After retreat + 9 waits: `lk=null`, `intent.wander`. |
| No AI while paused / awaiting input | **pass** | Pause: `__RL.act({wait})` → `acted:false`, turn unchanged. rAF only renders; enemies run inside `finishPlayerTurn` after a committed player action. |
| Inventory + equipment | **pass** | Warden pack/steel visible and clickable; tincture use via labeled button; Get added ash-knife. |
| Descend / later-floor preset | **pass** | `__RL.preset('late')` → floor 4 crypt, `validation.ok`, reach 278, spawn (26,19), stairs (1,10), `visE=0`. |
| Save/reload exact turn | **pass** | `exportJSON` at turn 10 / rng 116570063 / (2,11); two waits → turn 12; `importJSON` restored turn 10 and rng. Autosave slot is live (overwrites on each turn) — snapshot is export/import. Corrupt `{not-json}` Load → toast `No valid save`, run still at turn 4. Future schema `v:99` throws `future save`. |
| Event log | **pass** | DOM `#log` and overlay messages: lantern, door, bolts, deaths, pickups. |
| Debug overlays | **pass** | Diagnostics panel with walkability, regions, FOV, AI paths/intent, turn queue, occupancy, RNG, gen validation. Overlay text `gen ok reach 258`. `09-diagnostics.png`, `10-diag-checked.png`. |
| Keyboard + pointer at 390×844 | **pass** | Viewport 390×844, `touch: grid`, N/W/E/S + Look/Pack/Skill. Touch east + Get worked (x=5, ash-knife). Live overlay still filled. `12-narrow-390.png`, `13-narrow-touch.png`. Pointer path: first click `Path 2 steps…`, second click walked (2,3)→(4,3) in 2 turns. |
| Direct file:// open | **pass** | `file:///home/pyro/projects/naked/grok46/16-procedural-roguelike/index.html` loaded menu + `__RL`. Instant fortress run `validation.ok` reach 342; wait → turn 1. No console errors. `15-file-protocol.png`. |
| Audio quality heard | **not-run** | Web Audio oscillators fire after `pointerdown`/`keydown` (`ensureAudio`). No one listened to output; not claimed. |
| Full boss victory / permadeath wipe | **not-run** | Floor 5 preset exists (`__RL.preset('boss')`). Not played to the Abbot kill + stair win. Permadeath checkbox present; death wipe not executed end-to-end. |
| Key remapping press-cycle | **not-run** | Settings UI lists actions (`16-settings.png`); a full remap + replay was not done. |

---

## Other observed behavior

- Default new run starts in a furnished room (altar, chest, ground item, closed door), not an empty corridor (`03-play-fortress.png`).
- Replay of a 3-action arena fragment restored the same turn and tile (`matched: true`).
- Console: no uncaught errors on HTTP or file:// sessions.
- Favicon.ico 404s appeared under HTTP before an inline SVG icon was added; not a runtime dependency.

## Fixes during validation

1. A* `Map` constructor syntax error (missing `]`).
2. Look key conflicted with vi `l`; look rebound to `q`.
3. Animation `setTimeout` could finish a turn after `load()`; turns are now epoch-gated.
4. Arena north gap let the archer walk around a “closed” door; vertical wall now spans the map with a single door, which is how the lastKnown-expiry test passed.
5. Save/load test initially used the autosave slot (always latest turn). Exact restore is export/import JSON.

## Remaining limitations

- Autosave and the pause **Save** button share one localStorage key, so Save-then-play-then-Load returns the latest autosave, not a frozen bookmark. **Export JSON** is the frozen snapshot.
- Status durations decrement at the end of the same turn they are applied (veil duration 3 is effectively shorter in the dumped `status` object; combat accuracy still changed that turn).
- Replay of a late-floor *preset* starts generation at floor 1; a natural run with `descend` actions in the log is the intended replay path.
- Audio is procedural and gesture-gated; quality was not heard.
- Boss/victory and permadeath were implemented but not fully play-tested to the end screen.

## Screenshots

| File | What |
|---|---|
| `screenshots/01-menu-1280.png` | Main menu, 1280×800 |
| `screenshots/02-newrun.png` | Class / seed / style |
| `screenshots/03-play-fortress.png` | Seed `relic-alpha` start room |
| `screenshots/04-after-moves.png` | After keyboard moves |
| `screenshots/05-paused.png` | Pause (enemies do not act) |
| `screenshots/06-arena-closed-door.png` | Door blocking the emberbow |
| `screenshots/07-door-opened.png` | Discovery after open |
| `screenshots/08-combat-item.png` | Damage / tincture |
| `screenshots/09-diagnostics.png` | Gen/RNG overlay |
| `screenshots/10-diag-checked.png` | FOV / walk / intent toggles |
| `screenshots/11-help.png` | Keyboard help |
| `screenshots/12-narrow-390.png` | 390×844 + touch pad |
| `screenshots/13-narrow-touch.png` | Touch move + Get |
| `screenshots/14-invalid-save.png` | Corrupt save toast |
| `screenshots/15-file-protocol.png` | Direct `file://` play |
| `screenshots/16-settings.png` | Settings + remapping |
| `screenshots/17-replay-desktop.png` | Post-replay desktop view |
