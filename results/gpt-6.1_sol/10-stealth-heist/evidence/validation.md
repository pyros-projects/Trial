# Nightjar validation (agent-authored)

Artifact: `../index.html`. Browser: installed `agent-browser` 0.31.1 CLI, Chromium 143, isolated named sessions and final persistent QA profile. Skill stub plus version-matched `core` and `dogfood` workflows were read before browser use. No tool substitution.

## Development checks

- Initial `node evidence/tests/simulation.cjs` failed as expected because index.html did not exist.
- The simulation harness extracts and executes the actual embedded simulation in Node VM. It checks 270 seed/preset/difficulty combinations for primary, extraction, terminal and optional-loot reachability, deterministic layouts, door LOS, collision, acoustic decay/investigation/search/return, difficulty and finite tools/shared cooldown. Initial test assumptions corrected: capture sound source before the guard moves; wait out the shared tool cooldown before expecting EMP activation. These are agent-authored tests, not evaluator fixtures.
- `node evidence/tests/simulation.cjs` — PASS, five initial behavior groups (`logs/simulation.txt`); the final expanded suite passes thirteen groups (`logs/simulation-final.txt`).
- Embedded-script syntax parsed using `new Function` — PASS.

## Browser setup and direct-file check

Commands:
```
agent-browser --session nightjar --allow-file-access open file:///home/pyro/projects/naked/sol61/10-stealth-heist/index.html
agent-browser --session nightjar set viewport 1280 800
agent-browser --session nightjar network route 'http*://*' --abort
agent-browser --session nightjar snapshot -i
agent-browser --session nightjar click '#deployButton'
agent-browser --session nightjar press e
agent-browser --session nightjar wait --fn 'Nightjar.diagnostics().player.access === true'
```
Observed: direct file opened; live patrols rendered; Begin operation and E produced the timed terminal action, access=true and camera loopUntil > elapsed. Audio context running after Begin gesture; synthesized tones recorded. Audio quality was not listened to. Initial page errors and console: empty.
Evidence: `screenshots/01-desktop-briefing.png`, `02-desktop-active.png`.

## Observed failures and repairs

1. **Desktop controls below fold — FAIL, repaired.** 1280x800 screenshot showed loadout and live status below the visible area. Reduced vertical spacing/map height for short desktop displays. Retest screenshot `03-desktop-fit.png` shows all primary controls and live status within the viewport; a further rail-spacing refinement will keep the footer visible too.
2. **Held keyboard input through CLI — FAIL, repaired and retested below.** Commands `keydown d`, `wait 800`, `keyup d` left player at x=112. A browser event listener recorded `{key:'d',code:''}` from the installed tool's keydown command; press e supplied a code and interacted correctly. The application initially accepted only KeyboardEvent.code. Add a key fallback and repeat genuine held input; do not simulate movement by changing the player position.

## Playthrough configuration

Via labeled Mission settings controls: preset Dry run, difficulty Rookie, seed V-042, Deploy this mission, Begin operation, E. Access terminal succeeded with the 1.2s progress action. Screenshot `04-dryrun.png`.

The remaining outcomes appear below; early entries preserve the development chronology.

3. **Debrief re-entered itself — FAIL, reproduced.** The first genuine 25.4-second playthrough collected the primary dossier, used the EMP on two cameras, and extracted with rank A, zero detections and zero alarms. However, one completion filled all twenty history slots with duplicate records, and the browser reported blank uncaught error entries. Live state showed phase=escaped, historyCount=20. Root cause: updateHud called complete(), which opened the dialog and called updateHud again before lastPhase had been updated. Set lastPhase before opening the debrief, and assert one history increment on the repeated full playthrough. The prior screenshots/run JSON are retained as evidence of the pre-fix outcome. A CLI mouse command initially rejected fractional coordinates; the harness now rounds pointer coordinates to integers, matching the installed tool's interface.

- Held-key fix retest: actual `keydown d`, `wait 800`, `keyup d` moved x=112 to x=179.7833; keys=[] after release — PASS.
- Full mission retest after debrief repair: 25.5 seconds, dossier=true, phase=escaped, EMP on two cameras, rank A, score 1949, zero detections/alarms, historyCount=1 — PASS (`09-debrief-retest.png`, `logs/playthrough.txt`, `logs/completed-run.json`). Prior RangeError entries remained in the tool buffer; JSON error output identifies the original recursive complete/showDialog/updateHud stack. New-session error checks will distinguish fresh errors.
- Mobile first inspection at 390x844: no horizontal overflow (scrollWidth=390), touch terminal succeeds, but live status fell below the fold — FAIL, repaired by shortening the mobile map viewport. Retest pending.
- The CLI's structured eval transport sorts object keys. A record fixture saved through that transport failed the original order-dependent checksum even though data values were unchanged. The app correctly rejected it; improve record hashing to use canonical sorted object keys, then verify actual exported JSON round-trip and rejection of changed data.

## AI and mobile outcomes

- `python3 evidence/tests/browser-ai.py` in a fresh `nightjar-ai` browser session — PASS. Real mouse routes and E opened two doors. Q threw a distraction toward a pointer target; charges decreased 4→3 and a live investigation event/state appeared. The player intentionally entered the guard's forward cone; suspicion reached pursuit, metrics.detections=1, alarms=1, and another patrol responded. Smoke charge 3→2 blocked the sight query; running to the service corridor produced search states with sees=false and lastKnown >45 units from the actual player. The player hid in loading; a return-to-duty event followed. Final metrics: 3 investigations, 2 searches, 1 detection, 1 alarm, 2 tools. Screenshots 13–16 and `logs/playthrough-nightjar-ai.txt`. Fresh-session errors and console are empty (`logs/ai-errors.json`, `ai-console.json`).
- Mobile at 390x844 — PASS for joystick drag, release (analog=0), no continued movement after release, held ArrowUp/release, projected map tap reaching a floor tile, smoke via labeled Select smoke and Use selected gadget, RUN toggle, pause freezing elapsed time, and controls dialog. The tab-switch command initially used an unsupported positional integer; reran the failing focus-loss segment using stable tab id t1. Returning from about:blank showed paused=true, keys=[], analog={0,0}; resume and control-dialog close preserved correct pause state. Browser errors/console empty. Screenshots 12, 17, 18; `logs/playthrough-nightjar-mobile.txt`.
- Mobile viewport has no horizontal overflow, whole-page height=834 before the final time field, live status bottom=799. A compact actual-state minimap was added with tap routing.
- Retina change in place — FAIL then repaired. `set viewport 390 844 2` initially changed devicePixelRatio to 2 while canvas stayed 364x434 at view.dpr=1. The animation loop now checks display pixel ratio and resizes the backing store when it changes. Repeated 1x→2x→1x→2x at the same CSS viewport — PASS: CSS 364x426, canvas 728x852, view.dpr=2 (`22-retina-retest.png`).

## Export/import investigation

The first record upload wait timed out. Inspecting the actual visible import error revealed that Chromium could not read the relative upload path passed by the CLI, rather than an application checksum rejection. Retest uses absolute file paths. Independent Node inspection confirms the native downloaded record checksum and facility hash match the actual embedded engine. Canonical hashing additionally removes key-order dependence. The original relative-path invocation failure is retained, not counted as an application import pass.

## Final regression findings

- Two ephemeral browser sessions were unexpectedly relaunched to about:blank by the CLI environment. Doctor reported no installation errors. Final checks use one named session with a persistent /tmp profile and consistent --allow-file-access/--profile arguments on every command. The browser capability remains available; no substitution was needed.
- The added frame-timing diagnostic pushed the mission settings action below its scroll container. Selecting fields succeeded, but clicking the clipped Apply coordinate hit the backdrop and closed the dialog; the old mission remained selected. Reproduced and inspected: apply rect y=729–767, dialog bottom=722, scroll-body bottom=721 (`25-settings-footer-before-fix.png`). Move the mission action footer outside the scrolling body so it always stays visible. Also restrict backdrop handling to clicks whose target is the dialog itself, so keyboard-generated clicks on controls do not close the modal. Repeat all affected settings/seed/security flows after this change.
- Final embedded-engine tests: nine behavioral groups PASS, including 270 connected seeded maps, last-known-position pursuit/search, attenuation, tool cooldowns, canonical integrity, lockpick cancellation/completion, optional intel and victory score (`logs/simulation-final.txt`).

- Settings footer repair retest — PASS. Dry run / Rookie / FAIL-1 remains visible in the configuration and applies correctly; screenshot `26-settings-footer-retest.png`. The prior clipped-footer flow also left the old mission running, and a real patrol later intercepted the stationary player. This produced one legitimate failure record. The security harness's initial assumption of exactly one stored run was therefore stale; it now verifies unchanged history across reload and one increment relative to the actual starting history, rather than assuming the archive is empty. The stored victory and interception records both survived reload in the persistent browser profile.

## Final independent review and regressions

The requesting-code-review skill explicitly called for an independent reviewer. A read-only subagent inspected the delivered code and behavioral tests, then reviewed the fixes. It found three simulation/UI defects; the root agent reproduced them before changing the app.

1. **Resting doors opened on proximity — FAIL → PASS.** The anti-trap door reversal lacked an `open > 0` condition, so even locked resting doors opened when approached. Genuine Engine test `NIGHTJAR_TEST='resting locked' node evidence/tests/simulation.cjs` failed before the fix (`review-door-before.txt`), then passed. Only an already-opening/open door that is closing over the player now reverses. A follow-on test retained the blocked pointer route and revealed that E's lockpick immediately cancelled because the route still requested movement. Timed terminal/lockpick work now clears automatic navigation; fresh manual movement still cancels work. Before/after outputs: `review-route-action-before.txt`, `review-route-action-after.txt`. The real-browser `browser-lockpick.py` also passed: Dry Run / Rookie / LOCK-1, no terminal access, E opens loading door, Shift runs through corridor, tap a route across the locked vault → player stops south of the door with locked=true/open=0/access=false → smoke + E → 2.4-second lockpick finishes → tap crosses the door. No action-cancel event, no detections/alarms. Screenshot `31-lockpick-route.png`, `lockpick-browser-final.txt`.
2. **Off-center sources never reached search — FAIL → PASS.** Grid navigation ended at the cell center while arrival was measured against the original source. With source `(191.5,351.5)`, the guard investigated for thirty seconds without searching. Final navigation now ends at the exact collision-safe position, or the reachable tile center for a source too close to solid geometry. Arrival uses that selected endpoint. Focused noise/search/return and stationary corner pursuit tests each failed first (`review-navigation-before.txt`, `review-catch-before.txt`) and pass after the fix. This also fixes guards failing to catch a visible stationary player away from tile centers.
3. **Route review hid an active player — FAIL → PASS.** Real browser sequence: import exported run → review → Begin operation in the side brief → Run data → review again. Before the fix, review=true/phase=active and elapsed advanced 0.183→1.900 during inspection (`30-review-before-fix.png`, `review-browser-before.txt`, full diagnostic log). The review button now explicitly loads the recorded facility in briefing, as its label and nearby explanation state. Actual retest: review=true/phase=briefing, elapsed=0 across 1.7 seconds, same fingerprint; switching to Blackglass and reviewing restores the recorded Dry Run facility. Starting a mission or importing another mission hides stale scrub controls. `browser-review.py` PASS (`review-browser-after.txt`, `30-review-safety.png`). The first retest exposed a harness-only KeyError: the exported fingerprint is top-level, not under `mission`; that reference was corrected and the whole flow repeated.

Independent re-review found no remaining important/critical/minor issues within those fixes. Root verification remains the basis for pass claims.

## Repeatable final commands and observed results

All final browser scripts use the installed CLI with identical arguments on every invocation:

```bash
agent-browser --session nightjar-final --profile /tmp/nightjar-qa-file --allow-file-access open file:///home/pyro/projects/naked/sol61/10-stealth-heist/index.html
agent-browser --session nightjar-final --profile /tmp/nightjar-qa-file --allow-file-access network route 'http*://*' --abort
node evidence/tests/simulation.cjs
node evidence/tests/delivery.cjs
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-review.py
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-options.py
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-lockpick.py
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-ai.py
```

- **Embedded simulation — PASS:** thirteen behavioral groups, 270 reproducible connected layouts, wall/door/smoke perception, acoustic data and attenuation, real grid paths, last-known-position search/return, collision, finite tools, difficulty, score/loot/victory, lockpick cancellation, off-center pursuit and secure doors (`simulation-final.txt`).
- **Artifact inspection — PASS:** both embedded scripts parse, no external resource references, network APIs, runtime imports, or CSS assets; one 103,503-byte file (`delivery-final.txt`). The first CSS check accidentally matched JavaScript `createObjectURL`; restricting the CSS check to actual `<style>` content corrected that agent-authored harness issue.
- **JSON export/import — PASS:** native browser download of mission and completed-run JSON, absolute-path upload, canonical checksum, route scrub with keyboard Home, malformed JSON, modified coordinate/checksum rejection, wrong fingerprint rejection, and unchanged mission after rejected imports. Test fixtures are agent-authored; no evaluator fixtures were altered. Screenshots `19`, `20`, `27`, `28`; options/review logs.
- **Settings, restart, seed, history — PASS:** empty seed shows an error and retains mission; same seed reproduces fingerprint; Blackglass / Ghost changes to seven guards and scarce supplies; restart preserves hash. Actual slider pointer input changed master to 44 and effects to 30, reduced motion saved, frame timing overlay enabled without reset, focused native close button worked with Space. Preferences and stored runs survive reload. A malformed history value in this isolated QA profile safely fell back to an empty list, then the original archive was restored. `options-final.txt`, `29-seven-guard-mission.png`.
- **AI after navigation fixes — PASS:** decoy investigation, entering cone, pursuit, radio alarm, smoke plus running into another room, sees=false and last-known position separated from player, local search, then return. Both diagnostic toggles display actual ray hits, sounds, remembered coordinates, collision and paths. The initial repeated evasion used a hiding point directly on the second patrol's response route; that patrol saw and captured the player at 18.93 seconds. This is a legitimate systemic interception, preserved in `ai-route-intercepted.txt` and `ai-return-timeout-state.json`. Repeat uses real movement to `(48,592)` away from that response route and crouches: one detection, one alarm, three investigations, two searches, two tools; a guard returns at 19.9 seconds. `ai-final.txt`, screenshots `13`–`16`. No AI behavior was weakened to pass this check.

Audio is enabled through Begin operation or the audio button, which are user gestures. Running AudioContext and synthesized tone counts were inspected; audible quality has not been auditioned. Pointer/keyboard checks use a real Chromium browser; physical phone hardware is not covered.

### Delivery regression details

```bash
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-full.py
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-mobile-full.py
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-audio.py
BROWSER_SESSION=nightjar-final BROWSER_PROFILE=/tmp/nightjar-qa-file python3 evidence/tests/browser-security.py
./evidence/tests/browse network requests --json
./evidence/tests/browse errors --json
./evidence/tests/browse console --json
```

- **Full mission after door/navigation/record fixes — PASS:** actual labeled settings and Begin controls; E terminal; pointer routes through opened loading and vault doors; keyboard EMP; dossier collected at 13.42 seconds; green extraction interacted at 25.47 seconds. Rank A, score 1949, zero detections/alarms, one tool, history 4→5 exactly once. Screenshots `05-objective-secured.png`, `06-victory.png`; `full-mission-final.txt` and completed-run JSON. No simulation setters or teleports used in browser play.
- **Final narrow screen — PASS:** 390×844 at DPR 2, no horizontal overflow, live status within viewport; real joystick drag/release, keyboard arrow hold/release, map tap, smoke tool, RUN toggle, pause freezing time, native controls dialog, focus loss clearing held keys, and a captured stick gesture cancelled by moving browser focus to another tab. All input zero after return. In-place DPR 2→1→2 updates the backing store. `mobile-final.txt`, `32-mobile-final-retina.png`, `17-mobile-paused.png`, `18-mobile-focus-loss.png`. The minimap was also clicked using its rendered projection: actual player reached floor destination `(176,656)`, with full diagnostics recorded in the final playthrough log.
- **Audio focus recovery — FAIL then repaired, state retest PASS:** after repeated tab switches the AudioContext remained suspended despite UI enable state; a manual audio-button recovery wait timed out. Read-only resume logging plus a temporary silent context probe were installed only in the browser, then removed by reload (`audio-focus-probe.json`). Resume operation previously did not request audio recovery. It now calls the existing audio `ensure()` in that user gesture. Fresh real-browser retest: Begin → context running → new blank tab → return paused with cleared keys → Resume → context running → E terminal → synthesized tone count increases. `audio-final.txt`. This establishes state/gesture recovery, not audible quality.
- **Dense search simulation — PASS:** genuine Blackglass / Ghost engine with seven generated patrols receives a central camera alarm. Over thirty simulated seconds, at least three guards search simultaneously, all positions remain finite and outside solid geometry, all use real navigation, and the hidden player is not tracked through their closed room (`dense-patrols.txt`, final thirteen-group suite). Browser Blackglass/Ghost rendering and seven live patrols were separately exercised by the options workflow.
- **Debrief test synchronization — harness FAIL, corrected:** the final capture harness read history between the engine reaching failed and the next throttled HUD update (less than 0.12 seconds). A subsequent read confirmed one persisted run and the visible debrief. The check now waits for the actual debrief to open before checking persistence; the same visible-debrief wait is used for victory. `security-hud-race.txt` retains the early assertion and full diagnostics. This changes the agent-authored wait condition, not a benchmark requirement.
- **Direct-file/offline — PASS:** all recorded requests are local `file:` documents; zero non-file requests and zero failed recorded statuses. External HTTP(S) routing remains aborted. No external cached assets are needed: the artifact contains no external references or network APIs. Logs: `network-final.json`, `delivery-final.txt`. This check is not blocked; a local server was not needed for final browser execution.

Not run: audible quality audition and physical touchscreen hardware. No evaluator-owned score/report was written. The game score displayed in the debrief is the application's own performance metric.

- **Final camera/capture/restart retest — PASS:** real Dry Run / Rookie / FAIL-1 flow: camera sees=true/suspicion=1, alarm raises response, guard reaches the stationary player, debrief displays failed with score 0, two detections and one alarm at 14.85 seconds; history increments exactly once; Try again restores briefing with the same seed (`security-final.txt`, screenshots `23`/`24`).


## Final status

| Check | Result | Evidence |
| --- | --- | --- |
| Deliverable opens directly; offline, one file | PASS | `delivery-final.txt`, `network-final.json`, `final-runtime.json` |
| Complete dossier → extraction mission | PASS | `full-mission-final.txt`, screenshots 05/06 |
| Guard detection, noise investigation, LOS loss, local search, return | PASS | `ai-final.txt`, screenshots 13–16 |
| Camera alarm, capture, failure, same-seed restart | PASS | `security-final.txt`, screenshots 23/24 |
| Terminal, secure door/lockpick, decoy/smoke/EMP | PASS | playthrough logs, lockpick log, simulation suite |
| Diagnostics, pause/restart/new seed, meaningful difficulty | PASS | AI/options logs, seven-guard screenshot, dense search test |
| JSON download, import, route review, invalid data | PASS | exported JSON, review/options logs, screenshots 19/20/27/28/30 |
| Local history, preferences, malformed local data | PASS | options log and relative history increments |
| Desktop 1280×800 | PASS | screenshots 33/34; viewport and document are 1280×800 |
| Narrow 390×844; keyboard, joystick, map/minimap taps | PASS | mobile log, final playthrough log, screenshot 32 |
| Focus/captured-pointer cancellation, DPR changes | PASS | mobile log and actual pause/input diagnostics |
| Gesture audio and resume state/tone generation | PASS | `audio-final.txt` |
| Audible sound quality | NOT RUN | No listening claim; state/tone checks only |
| Physical phone touchscreen hardware | NOT RUN | Narrow Chromium pointer interactions were used |
| Uncaught errors, console errors, failed requests | PASS | final errors and console arrays empty; 20 file-only document requests, none failed |

Final artifact fingerprint: `logs/artifact-sha256.txt`. Final default mission screenshots: `33-desktop-final-briefing.png` and `34-desktop-final-active.png`. At the final active capture the live overlay reported about 57 FPS and 0.40 ms render time; this is a sampled headless-browser observation, not a sustained hardware performance claim. No unresolved observed gameplay failure remains after the documented fixes and retests.
