# Hollowkeep — agent-authored validation

Artifact: ../index.html. Evidence is the sibling evidence/ directory next to the delivered artifact. Dates: 2026-09-29–30.

Status at start: implementation and all checks not-run.

Authorization: the user requested a complete uninterrupted run; design/plan approval handoffs in general skills are superseded by that instruction. The supplied directory is not a Git repository; use the supplied workspace, with no branch/commit operations. No runtime dependencies will be introduced.

Installed agent-browser skill read, then `agent-browser skills get core` and `agent-browser skills get dogfood` loaded successfully. No browser substitution.

## Checks and observations

Results will be appended as performed. Test harnesses are agent-authored, not evaluator-owned.

Engine command: `node evidence/tests/engine.cjs`. Initial missing-artifact assertion failed as expected (logs/engine-red.txt). First 10 behavioral checks passed, including 300 generated maps (5 styles × 12 seeds × 5 floors).

Engine regression: a focused pursuer test reproduced no movement (distance 4 instead of 3). Cause: the player was included in the full path's blocked occupancy, so construction discarded the entire route at its final tile. Remove the target player from that particular path's blocked set; movement still rejects occupied destinations. The pursuit test then passed. A second test reproduced forgiving restart rejection after death; the ended-run action gate now permits the explicitly supported restart action. All 12 checks pass after both fixes (logs/engine-green.txt). These are engine checks, not yet browser workflow results.

Browser workflow (file://, 1280×800): enabled sound by clicking its labeled button; Web Audio diagnostic reported `running`, enabled true and 30% volume. Sound was not assessed by listening. Inventory stopped game input; pressing ArrowUp while it was open left the serialized state identical. Equipped the notched axe (turn 1), then ArrowUp, ArrowUp, ArrowRight, Space (turn 5). Ash vermin legally approached and attacked; health became 38/42 and poison duration 2. Screenshot 03 and logs/combat-discovery.json.

`python3 evidence/tests/browser_flow.py` uses only actual browser clicks, mouse input and keyboard input for actions; JavaScript reads live state/diagnostics and canvas coordinates. First run passed combat/status, pointer targeting, keyboard ranged attacks, equipment and inspection checks. It then stopped on a harness locator error: partial name `Resume` resolved to the underlying `Resume expedition` control, covered by the native modal. Changed that harness locator to the dialog's `#menu-resume` and added a fresh-run prelude so the full workflow can be repeated. This was a tool locator failure, not an application turn-state failure. Exact commands are retained in logs/browser-flow.txt.

Additional engine regressions reproduced mutation of the previous sound event on an invalid action and accepted malformed combat/inventory values. Sound events now have a turn stamp and only accepted actions clear stale sound; schema validation rejects corrupt combat, inventory, equipment and enemy memory. All 14 engine checks pass (logs/engine-hardened.txt).

Desktop flow retest: all 15 browser checks pass in `python3 evidence/tests/browser_flow.py` (exact commands and results in logs/browser-flow.txt). The first door assertion had guessed a corridor coordinate; live diagnostics showed the generated door one tile farther. The harness now discovers a genuine closed door and reachable adjacent tile from live map data, walks there with keys, and checks the tile directly behind it before and after opening. This is a corrected agent-authored test assumption; generation code was not changed. Screenshots 05–09 show status, invalid import, path distances and door occlusion/discovery.

Independent code review (skill-authorized reviewer /root/review) identified four concrete Important issues and no Critical issues. Reproduced each before fixing: structural schema validation gaps and duplicate enemy IDs; manual save during replay overwriting the backed-up run; archer aim surviving sight loss; canceled path callbacks stopping their replacements. Added required collection/enum/count/ID checks, persist the original replay backup, clear archer aim on sight loss, and invalidate old route/replay callbacks with tokens. Red/green outputs are in logs/review-engine-red.txt, archer-red.txt, review-engine-green.txt, review-ui-red.txt, path-token-red.txt and review-ui-green.txt. No supplied fixtures or evaluator code were changed. The two focused UI regressions and all 18 engine checks passed after the fixes.

Narrow workflow: `python3 evidence/tests/browser_mobile.py` passed eight groups of actual browser checks at 390×844. Started seed EMBER-92 / caverns / Wayfarer; map differs from MOSS-731 and is connected with reachable stairs and safe entry. Arrow keys, labeled touch arrows and actual canvas pointer input all moved one tile and consumed one turn. Used a trail ration (focus status). Tested HJKL, speed, volume, contrast, reduced motion and visibly enlarged journal text; menus changed no game turns. Pause blocked inputs and idle progression, then touch movement resumed. No horizontal overflow (scrollWidth 390) and no uncaught errors.

Actual export command: `agent-browser --session hollowkeep download '#menu-export' evidence/exported-run.json` clicked the Export JSON control and saved the downloaded Blob. Uploaded that file through the real import file input; exact original turn 21 digest restored. Watched its replay, paused it, clicked Save run, and checked localStorage still held original turn 21. Finished replay, observed VERIFIED, and returned to the exact original run. Screenshots 10–12. `set offline on` plus HTTP/HTTPS abort routes kept external network unavailable while file:// remained usable.

Additional combat check found that the King's original cross marked all four immediately adjacent tiles, forcing a hit without blink. A failing engine test demonstrated no ordinary one-step escape. The crown now marks center and the four tiles two steps away, leaving adjacent escape lanes. The test also performs the escape and verifies zero blast damage; it passes with the full 19-check suite.

## Final regression fixes

Descent originally did not decrement ability cooldowns. A focused failing test reproduced it; accepted descent now advances cooldowns while leaving newly generated enemies at `lastAct: -1` with an empty queue. Generation validation now also verifies a route to the exit that excludes locked caches, proving keys are optional rather than required for completion. Import enum checks use own properties so strings such as `toString` cannot pass through an object prototype. Red outputs: logs/descent-red.txt, keyless-red.txt, prototype-red.txt. Green outputs: logs/engine-20.txt and engine-21.txt.

Review follow-up found posthumous burning XP could level up and heal a dead player, and nested replay could replace the original backup with a playback state. Reproduced both before changing production code. Level-up applies healing only while alive; nested replay is guarded and its menu control disabled. Dead saves now round-trip with health zero. Red: logs/posthumous-red.txt and nested-replay-red.txt. Final engine and UI tests pass: logs/engine-final.txt (22 checks), logs/ui-final.txt (3 checks).

Narrow touch arrows and auxiliary controls were enlarged to at least 44 pixels. Connectivity-region diagnostics distinguish the current closed-door regions from the full connected map. Keyboard help explains hearing and last-seen memory. The final desktop and narrow browser workflows were repeated after these changes and after re-opening the delivered file.

## Complete run and endings — PASS

`python3 evidence/tests/browser_runs.py` continued the real MOSS-731 / standard / Warden / ruins run through floor I and descended to floor II at turn 80. Rekindling floor II restored its checkpoint at turn 81 with a 200-point penalty, and the entire action history still replayed exactly.

The same script started a fresh CROWN-57 / gentle / Warden / compact arena expedition at floor I and played all five floors through actual keyboard, targeting, item and equipment controls. Floor arrivals were turns 54, 106, 155 and 203. It defeated the King and claimed the final stair at turn 268: victory, level 6, 71 HP, 28 defeated enemies, game run score 5483. The local Records dialog showed the run, and seed/action replay reproduced the complete final state and RNG. This number is the application's run score, not an evaluator score. Screenshots 13–15, logs/victory-summary.json, and victory-run.json retain the result.

Across these runs, 320 actual enemy phases had legal occupancy, unique queue IDs and at most one action per actor. Every surviving enemy moved at most one cardinal tile per phase. Three actual summons remained at `lastAct: -1` and outside the creating phase's queue, then acted in following phases. Boss warnings were rendered and dodged. The 325 accepted-turn trace is in logs/long-run-trace.json; it includes four states where searching enemies retained an old position different from the player's current position (logs/perception-trace.json). The engine's focused wall/memory test additionally verifies eventual expiration and canceled archer targeting after sight breaks.

An initial long-run driver tried to enter a locked cache with no remaining key at floor III, turn 146. The application correctly refused with no turn consumed. A live BFS found an alternate route; the driver was corrected to route around locked caches. The subsequent full run and final repeat completed successfully. No production map or benchmark fixture was changed to accommodate the driver.

`python3 evidence/tests/browser_endings.py` started the visible date-based daily seed twice offline and verified identical initial states. It used the Floor V preset with ASH-013 / veteran / Arcanist, moved toward enemies and waited until genuine death. Permadeath disabled rekindling and rejected further actions; the dead save reloaded exactly and its failed action history replayed. A separate forgiving death offered Rekindle, restored 32 HP from the complete checkpoint, advanced exactly one turn and added the expected penalty. Screenshots 16 and death-run.json. The latest-code repeat passed all four ending check groups.

## Pointer travel, diagnostics and high DPI — PASS

`python3 evidence/tests/browser_paths.py` uses generated PATH-206 / gentle / arena with no initially visible enemies. A real pointer click previews the route without consuming a turn; confirming reaches tile 7,11 in four legal turns. Waiting at the destination advances no additional turns. The script then genuinely navigates to discover enemies and confirms travel halts after one legal step with a visible foe and a danger message. It switches all nine diagnostics (generation, walkability, regions, FOV, paths, intent, queue, occupancy, RNG), reads each live presentation and verifies the game digest does not change. Screenshots 17–19.

Supported `iPhone 15` emulation reports devicePixelRatio 3. The game canvas is 1101 pixels for a 367 CSS-pixel width, and the page has no horizontal overflow at width 393. A labeled movement button still performs one turn. Screenshot 20 was visually inspected. The required 390×844 viewport was separately exercised in both the complete mobile workflow and a clean browser.

Driver corrections were retained honestly: its first navigation excluded all caches and roots, leaving no chosen route; it now allows actually openable caches and routes around locked ones without keys. A proposed return-to-entry safe route crossed poison, so the driver selects an actually explored clear route. It initially called LOS with objects instead of numeric coordinates; this was corrected to the actual engine signature. `iPhone 13` was unavailable in this installed CLI's device presets; `iPhone 15` was explicitly reported as supported and used. Screen-coordinate reads and DPR assertions now wait for the actual first frame or resize to complete, rather than reading the previous frame. The final five groups pass in logs/browser-final-paths.txt. These were agent-authored driver failures, not hidden application passes.

## Clean delivered-file runtime — PASS

`python3 evidence/tests/browser_clean.py` opened a new browser session (`hollowkeep-release`) at about:blank, set HTTP and HTTPS routes to abort, enabled offline mode, selected 1280×800, then navigated directly to the delivered file URI. No local server or network fallback was used. The fresh run started at MOSS-731, turn 0, with connected generation and no horizontal overflow. Screenshots 21 and 23 were visually inspected at desktop and 390×844.

It clicked Enable sound, inspected AudioContext `running`, used ArrowUp and the labeled GUARD control, then re-opened the file and compared the exact turn-2 digest. Both console and uncaught-error streams were empty; request inspection showed no external HTTP/HTTPS resources. A deliberate obsolete v1 localStorage fixture tested startup recovery: the application rejected it, displayed an explanation, and offered a playable fresh turn-0 run. A new run then saved a valid schema. Screenshot 22. This is explicit persistence fault injection, not injected gameplay or fabricated progress. The six clean-browser groups pass in logs/browser-final-clean.txt.

The clean driver initially requested the case-sensitive button name `Guard`; the actual accessible name contains uppercase `GUARD`. Corrected the locator and used a new clean session for the full successful repeat. The exact command log includes the failure and corrected steps.

`python3 evidence/tests/dependency-audit.py` parses the delivered HTML and inspects asset tags, external CSS URLs/imports and network APIs. It reports zero external runtime dependencies; all scripts, styles, SVG definitions, tile drawing and procedural audio are inline. The artifact is 125346 bytes. Report: logs/dependency-audit.json.

## Final commands and results

Working directory for every command: `/home/pyro/projects/naked/sol61/16-procedural-roguelike`.

```bash
node evidence/tests/engine.cjs > evidence/logs/engine-final.txt
node evidence/tests/ui-regressions.cjs > evidence/logs/ui-final.txt
agent-browser --session hollowkeep open file:///home/pyro/projects/naked/sol61/16-procedural-roguelike/index.html
python3 evidence/tests/browser_flow.py > evidence/logs/browser-final-desktop.txt
python3 evidence/tests/browser_mobile.py > evidence/logs/browser-final-mobile.txt
python3 evidence/tests/browser_clean.py > evidence/logs/browser-final-clean.txt
python3 evidence/tests/browser_runs.py > evidence/logs/browser-final-runs.txt
python3 evidence/tests/browser_endings.py > evidence/logs/browser-final-endings.txt
python3 evidence/tests/browser_paths.py > evidence/logs/browser-final-paths.txt
python3 evidence/tests/dependency-audit.py
```

Detailed CLI steps and actual observed outputs are in logs/browser-flow.txt, logs/browser-runs.txt and logs/browser-clean.txt. The scripts retain every locator, key, pointer coordinate, uploaded/downloaded file, assertion and adaptive navigation rule. Evaluated JavaScript reads live state and supplies screen coordinates or plans routes; gameplay is performed through real controls. The only explicit browser state mutation is the documented obsolete-save fault fixture in the clean startup check.

| Required coverage | Final result | Evidence |
| --- | --- | --- |
| Two seeds, all five generation styles, reachable exit and safe entry | PASS | 300 engine maps; real MOSS-731, EMBER-92 and CROWN-57 runs |
| Coherent turns, door occlusion, discovery, combat, damage and status | PASS | Desktop 15 groups; screenshots 03, 05, 08, 09 |
| Pathfinding, occupancy, bounded enemy perception, summons, boss warnings | PASS | Engine cases; 320 live phases; long-run and perception traces |
| Inventory, equipment, stairs, complete victory/death/restart | PASS | Full run and endings; actual downloaded victory/death files |
| Exact save/reload, invalid schema, file export/import, deterministic replay | PASS | Desktop/mobile/clean workflows; 22 engine and 3 UI regressions |
| Pointer paths, pause/idle, keyboard/touch controls, all diagnostics | PASS | Desktop/mobile/path check groups |
| 1280×800, 390×844, 3× DPR, resizing and settings | PASS | Browser snapshots, live measurements and input after resize |
| Direct file, offline operation, no external resources, console/errors | PASS | Fresh session; dependency audit; actual request stream |
| Procedural audio enabled with user gesture and playback state inspected | PASS | Context `running`; no listening claim |
| Subjective sound quality, physical touch device, Firefox/Safari | NOT-RUN | Browser validation used Chromium with pointer/touch emulation |

Final state: no known unresolved functional failures; no required runtime or browser check blocked. Evidence is agent-authored and contains no evaluator-owned score or report. The date spans September 29–30, 2026 (Europe/Berlin final date September 30).
