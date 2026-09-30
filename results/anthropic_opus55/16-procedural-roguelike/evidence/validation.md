# Emberdeep — validation record

Artifact: `index.html` (single self-contained file, 318 KB). No build step, server, libraries, fonts, images or audio files at runtime. Development tooling lives in `dev/` (sources, a concatenation script, test harnesses) and is **not** needed to run the game.

Date: 2026-09-30. Browser automation: **agent-browser 0.31.1** (Chromium via CDP). I read the installed skill stub, `agent-browser skills get core --full` (core workflow + command reference) and `skills get dogfood` (exploratory-testing workflow) before use. No substitution was needed. Genuine touch input was produced with CDP `Input.dispatchTouchEvent` (`dev/test/touch.mjs`) because `agent-browser tap` is a mouse-click alias.

Status legend: **PASS** = observed working in the real app · **FAIL** = observed broken · **BLOCKED** = could not be exercised · **NOT RUN** = not attempted.

---

## 1. How to reproduce

```bash
node dev/build.mjs                         # dev only: assembles dev/src/* into index.html
node dev/test/core-tests.mjs               # headless engine tests on the core code extracted FROM index.html
bash dev/test/browser-validation.sh        # scripted browser pass over file:// → evidence/browser-run.log
```
`dev/test/ab.sh` holds the agent-browser helpers (`ev`, `keys`, `walkto`, `fight`, `clicktile`). The helpers use the true map only to *choose* which key to press; every game action in the browser passes through real `keydown` / pointer / touch events (exception: the soak test in §5, which calls the UI's `doAction` directly for speed, and is labelled as such).

## 2. Headless engine tests — `evidence/core-tests.log` (final build: ALL PASSED, exit 0)

The loader extracts the code between `// ===CORE-START===` and `// ===CORE-END===` from the shipped `index.html`, so these test exactly what ships.

| Check | Result |
|---|---|
| 1200 floors (40 seeds × 6 style modes × 5 depths) pass generation validation | PASS — 0 fallbacks, 0 retries needed, ~2.3 ms/floor |
| Independent BFS (separately written, same movement rules) confirms every walkable tile + exit reachable from entry | PASS — 0 disagreements |
| Same seed ⇒ identical floor; different seed ⇒ different floor; Mixed mode visits all 5 styles | PASS |
| 24 bot runs, 7060 actions: no two actors on one tile, no actor in a wall, HP within bounds | PASS (23 deaths, 1 win, depth 5 reached) |
| Enemy move events never exceed the energy their speed grants | PASS — 0 violations |
| Replay: re-simulating each run's action log reproduces the exact state hash | PASS — 24/24 |
| Save mid-run → JSON → load is hash-identical and continues identically | PASS |
| Closed door blocks sight both ways; opening restores LOS | PASS — 12 doors |
| Hunting enemy paths around walls/doors to last-known position | PASS — 10/10 |
| Enemy that loses sight keeps only last-known position | PASS — 6/6 |
| Every visible tile within range 7 has a clear projectile line | PASS — 1323 tiles, 0 without |
| Foreign / newer / schema-1 saves rejected with an error, no crash | PASS |
| Schema-2 save migrated by replay equals the live state; corrupted state rebuilt from the action log | PASS |
| Log text contains no "The The", "a Ash…", `undefined`, `NaN` | PASS |

## 3. Scripted browser pass — `evidence/browser-run.log` (final build, file://, 1280×800 then 390×844)

| # | Check (public checks in bold) | Result | Observation |
|---|---|---|---|
| 1 | Direct `file://` load | PASS | title "Emberdeep — …", no server |
| 2 | **Two seeds give valid connected maps** | PASS | `kindle`: 10/10 checks, 1 region, exit 95 steps; `bravo`: 10/10, 1 region, exit 50 steps (`v/01-seed-bravo-regions.png`) |
| 3 | Different seeds differ / same seed identical | PASS | |
| 4 | **Movement** via keyboard | PASS | wall bumps cost 0 turns |
| 5 | **Closed-door occlusion** | PASS | tile beyond door invisible→visible, 45→54 visible tiles (`v/03-door-opened.png`) |
| 6 | **Enemy discovery** | PASS | hidden rats became visible, "The Gnaw Rat notices you!" (`v/04`) |
| 7 | **Item use** | PASS | Fire Bomb via quick slot `2` + targeting; 5 burning tiles. The bomb killed its target outright, so no enemy status was observable *from the bomb* in this run |
| 8 | **Status effect** | PASS | Second Wind → "Warded 4" in status chips, cooldown 21 set |
| 9 | **Combat & damage** dealt / taken | PASS / PASS | dealt 18→24; HP 36→34 |
| 10 | **Enemies take only legal turns** | PASS | audited on the live UI event stream: 0 of 15 move batches exceeded their speed budget |
| 11 | **No action while awaiting input** | PASS | state hash unchanged after 3 s idle |
| 12 | **No action while paused** | PASS | menu open: movement keys ignored, hash unchanged, HUD "PAUSED" (`v/07-paused-menu.png`) |
| 13 | **Inventory & equipment** | PASS | unequip by clicking the slot, re-equip via `i` → letter → `e`; 1 turn each; stats update |
| 14 | **Save and reload exact turn state** | PASS | Ctrl+S → page reload → identical hash `ek1hfcn3v3`, turn 18 |
| 15 | Deterministic replay (Diagnostics → Verify) | PASS | "✓ identical after 18 actions" |
| 16 | **Debug overlays** | observed | walkability, FOV/LOS/light, distance map, AI intent (incl. hidden enemies), occupancy screenshots `v/08-overlay-*.png`; panel shows collision ✓, RNG words/draws, generation checks (logged, not an assertion) |
| 17 | **Event log** | observed | 19 entries shown in the panel (logged, not an assertion) |
| 18 | **Compact later-floor preset** | PASS | "Preset: arena, depth 4" → depth 4 arena 33×23, level-7 kit |
| 19 | **Descend** | PASS | walked to stairs, `>` → depth 5 (`v/09-descended.png`) |
| 20 | **Narrow width** 390×844 layout | PASS | no horizontal scroll, touch pad shown, 349 px map (`v/10-narrow.png`) |
| 21 | Narrow: **keyboard** | PASS | turns advance |
| 22 | Narrow: on-screen pad (**pointer**) | PASS | |
| 23 | Narrow: genuine **touch** tap → preview, 2nd tap → travel | PASS | first tap spends no turn |
| 24 | Narrow: mouse click-to-travel | PASS | |
| 25 | No page errors / uncaught exceptions | PASS | `agent-browser errors` empty, in-app error list empty |

**Enemies lose knowledge outside LOS (browser):** PASS in a dedicated scenario — Ranger, seed `alpha`, 3 hunting rats. Smoke Bomb thrown between us: all rats switched to `searching` with last-known (17,7); I moved to (17,10); they walked to (17,7)/(17,6) and did not follow (`v/12-smoke-thrown.png`, `v/13-lost-track-ai-overlay.png`). The scripted pass's own sample happened to find no searching enemy at that moment (logged as "none currently searching").

**Enemies path around walls (browser):** observed during play (rats around the water basin in `22`/`23`, wraith/skeleton/archers through the arena corridor in `25`). Asserted headlessly in §2.

## 4. Exploratory checks (interactive, agent-browser)

| Area | Result | Notes / evidence |
|---|---|---|
| Hover tooltips with exact odds, armor, intent, behaviour | PASS | `05-enemy-tooltip.png`, `10-targeting.png` |
| Targeting (F / Z / X / throw), Tab cycling, Esc cancel, line-of-fire preview | PASS | `10-targeting.png` |
| Inspect mode (V) — cursor, no turn cost | PASS | |
| Pack AI (howl/squeak alert, regroup, flank), archer kiting, flee at low HP, brute/boss telegraphs, cultist summons, wraith lifesense/slow, sentinel guard | PASS (observed) | `23-pack-flank.png`, `25-arena-fight.png`, `28-boss-fight.png` |
| Shield Bash knockback into a creature (impact + stun) | PASS | wraith slammed into skeleton |
| Traps: hidden trap spotted by perception; stepping on it (spike + Bleeding) | PASS | |
| Sound feedback for unseen events ("You hear footsteps to the north-west", ring markers) | PASS | `10-targeting.png`, `25-arena-fight.png` |
| Level up, gold/arrow auto-pickup, chests, doors (`c` closes) | PASS | |
| Death → summary → Restart floor (forgiving) | PASS | `26-death-summary.png` |
| Boss (Hollow King) phase 2, Grave Slam, victory screen, records | PASS | `29-victory.png` (score 2913) |
| Permadeath: restart disabled, save deleted on death | PASS | after fixing bug #15 below |
| Daily seed from local date (`daily-2026-09-30`), no network | PASS | |
| Help dialog, key remapping (Wait → `w`), persistence, reset | PASS | `16-help.png` |
| Settings: animation speed, text size, high contrast, reduced motion, volume/mute, touch, tile size — applied & persisted | PASS | `17-settings-hc-large-rm.png` |
| Export JSON (textarea) → Import restores exact hash | PASS | hash `2au5akingqy`, turn 127 |
| "Download .json" | PASS up to browser boundary | intercepted: `application/json` blob 27.9 KB, schema 3, 108 actions, filename set. **Writing the file to disk was not verified** |
| "Copy" (clipboard) | NOT RUN | |
| Import errors: invalid JSON, newer schema, corrupt action log | PASS | clear messages, no crash (`19-import-error.png`) |
| Startup with corrupt / schema-1 / schema-2 save in localStorage | PASS | corrupt & schema-1 → backed up to `emberdeep.save.corrupt`, fresh run + message; schema-2 → migrated by replay |
| Replay viewer (menu → Watch replay) | PASS | `v/14-replay-verified.png` "✓ identical final state" |
| High-DPI (device scale 2) | PASS | canvas backing 1878×1510 for 939×755 CSS; `30-hidpi-2x.png` |
| Live resize 1280→390→900→1280 | PASS | state kept, no h-scroll, no errors |
| Audio | PASS (state only) | AudioContext created on first key/click, state `running`, `played` counter increments (e.g. `equip`). **I did not hear the audio**; quality is unverified |
| FPS | PASS | ~60 fps, ~0.3–0.5 ms/frame in steady state; brief 25–38 fps dips right after dialogs close (sprite-cache warm-up) |

## 5. Stability soak (in-page bot through the UI `doAction` path)

3000 actions, 5 runs (4 deaths, depth 4 reached), all rendering/animation/particles/log live: **0 errors**, min 54 fps, particles capped (max 548 of 600), log DOM capped at 220 nodes, JS heap 10 MB before and after (`31-after-soak.png`). This drives `doAction` directly rather than key events (stated for honesty).

## 6. Network / runtime-dependency checks

| Check | Result | Method |
|---|---|---|
| Source scan | PASS | no `<script src>`, stylesheet links, `@import`, `fetch`, XHR, WebSocket or `import()`. Only URL-like string is the SVG namespace inside the inline favicon |
| CSP | PASS | `default-src 'none'` meta; it even blocked my own test hook's `fetch(blob:)` |
| Direct `file://` | PASS | all browser passes above ran from `file://` |
| Local HTTP with external internet blocked | PASS | Chromium launched with a dead proxy for all traffic (`--proxy http://127.0.0.1:9`) bypassing only 127.0.0.1; a probe `fetch('https://example.com')` failed; the game loaded and played with **exactly one request** (the page) — `evidence/network-http.har` |
| Offline mid-session | PASS | `set offline on`, kept playing, saved, opened dialogs: no new requests, no errors |

Note: my first HTTP attempt used a port already taken by an unrelated local app, so it tested the wrong page; I discarded it and re-ran on a verified-free port. A second attempt with a too-broad route pattern aborted the page itself; also discarded.

## 7. Failures found during validation, fixed, and retested

| # | Symptom (how found) | Cause | Fix | Retest |
|---|---|---|---|---|
| 1 | Replay bar visible at start (`01-desktop-initial.png`) | `display:flex` overrode `[hidden]` | global `[hidden]{display:none!important}` | PASS |
| 2 | Stale tooltip after keyboard moves | tip only refreshed on mouse move | hide tip after actions | PASS |
| 3 | Walls read washed-out | wall tops brighter than floors | darker tops, lit brick faces | `04-dark-walls.png` |
| 4 | **Replay verification MISMATCH** in browser | UI injected a "Controls" line into `state.log` outside the action system | hint moved into deterministic `newGame()`; audited UI for other state writes | PASS |
| 5 | Arrow fired at a *visible* rat "clatters away", turn wasted | Bresenham line ≠ symmetric-shadowcast visibility | projectile uses the shadowcast-consistent centre line (+ offsets); blocked shots rejected at 0 cost; new test "visible ⇒ shootable" (found 2 more edge cases, then 0/1323) | PASS |
| 6 | Tooltip covered hero/line of fire; mode bar collided with HUD | placement | tooltip on side away from hero; mode bar at bottom | `10-targeting.png` |
| 7 | Throw cursor started on a wall | synthetic `pointermove` after a layout change moved the cursor | ignore moves with unchanged coordinates | PASS |
| 8 | Cursor offset (+1,−1) after choosing "Throw" with `u` | key bubbled from item menu to game (`u` = move NE) | `stopPropagation` in menu | PASS |
| 9 | Minimap overlapped HUD; Log leaked into Hero tab on phones | minimap size; CSS specificity | narrow minimap; tab selector fix | `13-narrow-initial.png` |
| 10 | Touch: first tap's preview vanished | `pointerleave` after touch `pointerup` cleared it | only mouse leave clears | PASS |
| 11 | **First key after closing any dialog ignored** | paused flag cleared by a deferred timeout | paused is now derived from "a dialog is open" | PASS (3 keys → 3 turns) |
| 12 | Replay diverged at action 32 | run recorded before the projectile fix, loaded from a save under new rules | saves now carry `engine: 1.0.0`; mismatch is reported; verified on clean runs (`21-replay-verified.png` shows the divergent dev-era run; `v/14` the fixed case) | PASS |
| 13 | Rat oscillated between two tiles | flank maps routed *through* the player; equal-cost sidestep jitter | player tile impassable for flank maps; sidesteps must get closer | PASS |
| 14 | Wraith perma-slowed the player | slow refreshed on every hit | 35 % chance, 2 turns, no refresh while slowed | tests PASS |
| 15 | Dead permadeath run resurrected after reload | autosave-on-page-hide re-saved the ended run | never persist a finished permadeath run | PASS |
| 16 | "Saved data … left untouched" but it was then overwritten | misleading message | unreadable save backed up to `emberdeep.save.corrupt`, message says so | PASS |
| 17 | "The The Hollow King", "a Ash Jackal" | article handling | `theName`/`aName` helpers, boss renamed; log-grammar test added | PASS |
| 18 | Crypt floors noisy, sanctum cracks busy, pillar called "Pillar" when drawn as a tree | art/text polish | rarer decals, style-aware names ("Ancient tree", "Sarcophagus", "Stalagmite") | observed |
| 19 | Diagnostics showed previous run's replay verdict | stale UI cache | reset on run change | PASS |

## 8. Limitations and not-verified items

- **Audio quality not heard** — only AudioContext state and play counters were inspected.
- **Download to disk not verified** (blob contents verified); clipboard **Copy NOT RUN**.
- Tested in Chromium only (agent-browser); Firefox/Safari not run. Touch was genuine CDP touch events in desktop Chromium, not a physical device.
- Balance was evaluated lightly (my own play plus random bots: 1 win in 24 bot runs; a scripted level-9 Warden beat the boss using 5 potions). Difficulty tuning could go further.
- Enemy "flanking" can only express itself where geometry allows; in 1-wide corridors packs queue (by design, now without jitter).
- Screen-reader support is limited to ARIA labels, a live region for important messages, and keyboard reachability; not tested with an actual screen reader.
- Replays are exact within one engine version; runs recorded under a different `engine` string load exactly from their saved state but may not re-simulate identically (reported to the user).
- `window.__emberdeep` is a deliberate test/diagnostic hook left in the build.
