# Amber Protocol — validation log

Standalone artifact: `/home/pyro/projects/naked/grok46/10-stealth-heist/index.html`  
Browser tool: installed `agent-browser` (core + dogfood skills loaded). No substitution.  
Local server: `python3 -m http.server 8792 --bind 127.0.0.1` from the project directory.  
Session: `heist-val` at `http://127.0.0.1:8792/index.html`. File protocol: `heist-file`.

Checks use **pass / fail / blocked / not-run** only. No evaluator score.

## Environment

- Desktop viewport: 1280 × 800
- Narrow viewport: 390 × 844
- Date: 2026-09-08
- Network observed on HTTP load: `index.html` 200 and an embedded `data:image/svg+xml` grain. No remote hosts.
- Favicon is a data URI (no `favicon.ico` 404 after that change).

## Commands used (representative)

```bash
agent-browser skills get core --full
agent-browser skills get dogfood
python3 -m http.server 8792 --bind 127.0.0.1
node --check /tmp/heist-check.js
agent-browser --session heist-val set viewport 1280 800
agent-browser --session heist-val open http://127.0.0.1:8792/index.html
agent-browser --session heist-val snapshot -i
agent-browser --session heist-val screenshot evidence/screenshots/….png
agent-browser --session heist-val select "#preset" training
agent-browser --session heist-val click "#btnBegin"
agent-browser --session heist-val press e|f|Escape
agent-browser --session heist-val mouse move|down|up
agent-browser --session heist-val eval "HEIST.getState()"
agent-browser --session heist-file open file:///…/index.html
```

Movement used real `keydown`/`keyup` `KeyboardEvent`s (`KeyW/A/S/D`, `KeyE`, `KeyF`, `ShiftLeft`) plus pointer hold-to-move. Live state was read from `window.HEIST.getState()` (guards, sounds, doors, loot, alert) — not from screenshots alone.

## Check results

| Check | Result | Evidence |
| --- | --- | --- |
| Loads as one self-contained HTML, no build, no external libs | **pass** | `index.html` only. No `import`, no `type=module`, no remote `http(s)` URLs except SVG xmlns in a data URI. |
| Direct `file://` open | **pass** | Retry session: title `Amber Protocol — Night Circuit`, `typeof HEIST === "object"`, Begin starts `mode: play`, 58 fps, `performance` resource list empty. First `wait --fn` on file:// timed out (tool wait), page was not blank on retry. Screenshots `35-file-retry.png`, `36-file-play.png`. Initial `34-file-protocol.png` was a blank capture during the timed-out wait. |
| HTTP load without external network | **pass** | Requests: local document + data-URI grain only. |
| Default briefing readable, patrols moving | **pass** | Desktop briefing `01-briefing-desktop.png`. During briefing, `HEIST.getState()` showed Night Vault guards already in `patrol`/`idle` (e.g. guard 0 at x≈357). First interaction: **Begin infiltration**. |
| Complete mission: take objective + extract | **pass** | Training Wing / Easy / seed `1847`. Lockpicked vault door (`Pins yield. Door unlocked.`), took `Ledger folio`, walked to green hatch, pressed E. Result: `mode: win`, time 118.6s, loot 1, rank **SILK**, score **1412**. Screenshots `15-vault-door.png`, `16-ledger-taken.png`, `20-extract-attempt.png`, `21-victory.png`. |
| Enter and leave a vision cone | **pass** | Walked onto the lobby guard. State went to `search` with `suspicion≈0.30` and `lastKnown.reason: "sight"`. After leaving south, guard returned to `return` and suspicion decayed to 0. Screenshots `11-cone-enter.png`, `12-leave-cone.png`. Diagnostics showed LKP marker and vision rays. |
| Noise causes investigation | **pass** | After leaving the cone, selected Coin and pressed F. Sound `{kind:"coin", intensity:2.5}`. Guard transitioned `return → investigate` toward the impact `(181,179)`, then `search` at that point. Charges 4→3. Screenshots `13-coin-investigate.png`. Earlier door-close also produced `{kind:"door"}` and moved the guard to `search` at the door. |
| Break LOS during pursuit + search | **partial** | A later run logged `patrol → suspicious (0.29–0.60) → pursue (0.72)` with `alert: 2`, then **catch** (`mode: fail`, rank BURNED, detections 1). Screenshots `26-pursue.png`, `28-caught.png`. A dedicated escape after pursue ended in catch before search-after-loss could be re-sampled. Search-after-lost-sight **was** observed on the earlier sighting (guard at LKP in `search`, then `return`). The pursue→search branch exists and was not cleanly photographed mid-escape. |
| Door or terminal + gadget | **pass** | Doors toggled with E (`[E] Door`, `[E] Lockpick door`); vault lockpick used. Gadgets: Coin (charges consumed + sound), Smoke (3→2, `{kind:"smoke"}`), EMP (2→1, `{kind:"emp"}`, cooldown). Terminal path was reached in security on a later attempt but that run was already in pursue/`IN VIEW`; vault lockpick is the completed interact. |
| Perception / navigation diagnostics | **pass** | `HEIST.setDiag({nav,ai,los,snd,lkp,perf})` without restart. Overlay checkboxes appeared; guard state labels, vision rays, sound rings/labels, LKP, nav paths, and `MS` frame timing showed on-canvas and matched `getState()`. Collision overlay available, not left on for the full run. |
| Pause and restart | **pass** | Esc opened pause overlay (`paused: true`). Resume returned to play. Restart with same seed `1847` placed player at `(98,182)` and guard 0 at `(126,126)` `idle` — identical to the pre-restart snapshot. Screenshots `24-pause.png`. Narrow pause via labeled **PAUSE** also worked (`33-narrow-pause.png`). |
| Same-seed regenerate | **pass** | See restart comparison above. |
| Keyboard + pointer, desktop and narrow | **pass** | Keyboard walker moved the player through the map. Pointer hold-to-move: mouse down at screen `(730,288)` moved player x `98 → 173` (`25-pointer-move.png`). Narrow 390×844 showed virtual stick + USE / RUN / GAD / PAUSE (`31-narrow-briefing.png`, `32-narrow-play.png`). `view: {w:390,h:844}`. |
| Live status overlay | **pass** | Always-on bar: FPS, SEED, ALERT, OBJ, T, AI-by-state (`1i`, `1p`, `1r`), NOISE, GAD, PAUSE, optional MS. |
| Difficulty changes systems | **pass** | Easy Training: 1 guard, Coin 4/4, Smoke 3/3, EMP 2/2. Default Night Vault / Normal: 4 guards, Coin 3/3 (briefing state). Hard option present in the control. |
| Settings: volume, reduced motion, remap UI | **pass** (controls present and clickable) | Settings sheet with master/FX sliders, reduced-motion checkbox, diagnostic toggle, remap buttons (`23-settings.png`). Remap capture (click then press a new key) was not fully exercised end-to-end. |
| Persistence + export/import JSON | **pass** | Run ledger showed `WIN SILK 1412 t118 det0 training #1847` after refresh (`22-history.png`). Pause `ioBox` contained `amber-protocol-run` JSON with seed/preset/replay frames. `HEIST.importPayload` reloaded Training / 1847 into `mode: play`. Export download button was clicked (browser download not inspected). |
| Cameras / alarms | **partial** | Camera cone rendered in Training security (start screenshot). EMP is radius-limited; at spawn the distant camera stayed `disabled: 0` while `{kind:"emp"}` fired — correct local sim, not a full camera-disable demo. Camera alarm-to-broadcast was not separately completed. |
| Procedural preset | **pass** with fallback | Seed `99` assembled a playable map; loot name `Amber ledger` at Night Vault coords showed the generator repaired/fell back to a known-good layout when a raw assembly failed flood-fill. Later a hall-carve repair was added so more seeds stay unique. Not a full procedural extract run. |
| Audio | **not-run** (quality) / **pass** (hookup) | Web Audio starts on **Begin infiltration** (user gesture). No one listened to the speakers. Do not treat meters as heard audio. |
| Console / uncaught errors | **pass** | `agent-browser errors` and `console` were empty on the successful briefing, Training start, victory, file:// retry, and HTTP reload. |
| High-DPI / resize | **pass** (basic) | Viewport switches 1280×800 ↔ 390×844 redraw the canvas via `devicePixelRatio` clamp and `resize()`. No separate 2× DPR screenshot. |
| Focus loss / pointer cancel | **not-run** as a dedicated blur test. Code auto-pauses on `visibilitychange` / `window.blur` and clears pointer/stick on `pointercancel`. |

## Mission play (Training Wing, seed 1847, Easy)

1. Briefing → Training Wing → Easy → Begin infiltration.
2. Diagnostics on (nav, AI, rays, sound, LKP, timing).
3. Walked north into the lobby watchman; `search` + sight LKP; walked south out of the cone; guard `return`.
4. Faced east, F-threw a coin; guard `investigate` then `search` at the impact.
5. Opened lobby–hall door from in-range (`[E] Door`, door `open: true`).
6. Opened hall–archive door.
7. Lockpicked vault (`[E] Lockpick door`).
8. Took ledger; objective `extract`.
9. Path around vault cover (cover tile had pinned the player — collision later allowed leaving a closed/occupied tile).
10. Returned along the y=4 corridor to the green hatch; E → **EXTRACTED**.

A later run stayed in the cone until `pursue` / alert 2 and produced the **COMPROMISED** sheet (failure loop works).

## Fixes made after failed flows

1. **Closed-door trap** — standing on a door tile and closing it rejected every collision sample. Fixed by ignoring the current tile in collision and nudging out of unwalkable cells. Re-tested: movement after vault/door use worked (`18-leaving-vault.png` → extract).
2. **Hearing too weak** — coin at ~130px did not retarget a searching guard. Raised attenuation reach, coin intensity, and retarget from `search`. Re-test: coin produced `investigate` at the impact point.
3. **Suspicion operator bug** — `A && B || C` sent idle guards into suspicious incorrectly. Parentheses added.
4. **Door close while occupied** — toast `Stand clear to close`.
5. **Spawn spotlight** — after widening FOV, Training spawn could start `IN VIEW`. Patrol origin moved into the hall. Narrow-play retest: guard idle at `(434,126)`, player unseen.
6. **Favicon 404** — replaced with data-URI icon.

## Remaining limitations

- Pursue → local search after a clean LOS break was not captured as a completed screenshot sequence (catch happened first).
- Camera disable via EMP/terminal was not finished in a quiet security-room visit.
- Procedural uniqueness is repaired when flood-fill fails; some seeds still resemble curated annexes.
- Control remapping UI is present; a full remap was not confirmed.
- Audio was not aurally judged.
- Replay JSON records inputs; a full watch-replay playback was not stepped on video.
- `HEIST.giveLoot` / `teleport` exist for diagnostics and were **not** used to complete the scored extract run.

## Screenshots

All under `evidence/screenshots/`. Key frames: `01` briefing, `02` training start, `11–13` cone and coin AI, `15–16` lockpick and loot, `21` victory, `22` history, `24` pause, `25` pointer, `26/28` pursue/fail, `32` narrow play, `35–36` file://.
