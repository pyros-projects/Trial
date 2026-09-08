# Afterlight validation

Artifact: `/home/pyro/projects/naked/grok46/17-echo-loop-puzzler/index.html` (self-contained HTML/CSS/JS, ~98 KB).

Browser tool: `agent-browser` 0.31.1 (version-matched core + dogfood workflow). Local HTTP on `127.0.0.1:8900` for most checks; direct `file://` also opened.

Commands below were run against the live app (pointer, labeled buttons, keyboard, and `window.__ECHO__` diagnostics). Screenshots live in `evidence/screenshots/`.

## Environment

- Desktop viewport: 1280 × 800
- Narrow viewport: 390 × 844
- Offline after load: `agent-browser set offline on`
- Network log: only `index.html` 200 and browser `favicon.ico` 404 (later replaced with an inline data-URI icon). No CDN, fonts, images, or API calls from the app.

## Public checks

### Echo records actions, resets, and cooperates

**Result: pass**

Steps:

1. Restart Afterimage (`Restart level`).
2. Pointer-hold labeled `Move right` (~1.15 s) until standing on plate CH1.
3. Click `Commit loop and spawn echo`.
4. Pointer-hold `Move right` again.

Observed (`06-on-plate.png`, `07-after-loop.png`, `08-echo-coop.png`):

- On plate: `player.x ≈ 300`, `switches: "1"`, `channels: {1:1}`.
- After loop: `loop 2`, `echoes: 1`, player back at spawn `x=48`.
- During next walk: echo at `x ≈ 310` on the plate, player at `x ≈ 606` **past the door at x=560**, `switches: "1"`, `div: ok`.

Deterministic finish (paused `runFrames`, same physics): walk 72 frames right + 36 idle on plate, `loopNow()`, 260 frames right.

Observed (`12-victory.png`):

- Echo remained at `x=300.51` on the plate.
- Player reached `x=802` in the goal.
- `last: "win"`, overlay open, **Loops 2 (par 2) · Time 5.4s · Rank GOLD**.

Live world and echo used the same input bitfield / timestep. Player acted independently after reset.

### Jumping

**Result: pass**

`runFrames(20, jump)` from spawn: `y` 472 → 367.5, `grounded: false`, `rose: true`.

Simultaneous right+jump: `state: "jump"`, `x` increased, `vy < 0`.

Real pointer: labeled `Jump` also used as the user gesture that resumed Web Audio.

### Switches and doors

**Result: pass**

Plate CH1 opened the channel-1 door. Without the echo on the plate, the player stopped at the closed door (`x=540`, door `x=560`). With the echo holding the plate, the player walked through.

### Player / crate collision

**Result: pass**

Imported a lab with a crate at `x=120`. After 40 frames of walking into it: crate `x` 120 → 128.63, player `x=108.63`, `pushed: true`.

Carry cube (Handoff + Chorus): `hold` set to the cube entity id after action frames.

### Hazards

**Result: pass**

Imported a spike pit. After walking off the ledge: `alive: false`, `x ≈ 227` over spikes (`23-mobile-390.png` still shows the dead state). Loop snaps back after the death timer (no echo committed for a death).

### Undo last echo / clear / restart

**Result: pass**

- After a recorded walk + `loopNow()`: `echoes: 1`, `loop: 2`.
- `undoEcho()`: `echoes: 0`, `loop: 1`.
- Record again, `clearEchoes()`: `echoes: 0`, `loop: 1`.
- Labeled `Restart level` restores spawn and loop 1.

### Level editor (place, undo/redo, play-test, save/load)

**Result: pass**

Steps:

1. Click `Open level editor` (`13-editor.png`). Palette lists all core types.
2. Place crate, extra plate, and carry cube (`place()` + real canvas `pointerdown`).
3. Click `Undo edit`: entity count 12 → 11 (canvas crate removed).
4. Click `Redo edit`: 11 → 12 (crate restored) (`15-editor-undo-redo.png`).
5. Click `Play-test level`: `mode: "play"` with crates/cube/plate in the running sim (`16-playtest.png`).
6. Return via `Open level editor` (`mode: "edit"`).
7. `Save named slot` as `chamber-alpha` → `localStorage` key present.
8. Level select shows `Play slot chamber-alpha`; loading restores crates/plate/cube (`21-slot-reload.png`).

### Import / malformed JSON

**Result: pass**

UI Apply on `not-json{{{{` → `Rejected: Unexpected token 'o'...` (`17-bad-import.png`). App stayed up.

API rejects:

| payload | result |
|---|---|
| `{}` | entities must be an array |
| `[]` | entities must be an array |
| `__proto__` key | Rejected prototype key |
| `entities: "alert(1)"` | entities must be an array |
| NaN geometry | Need spawn/goal |
| XSS name | tags stripped; names rendered via `textContent` |

Imported levels never use `eval` / `fetch` / dynamic `import`.

### Timeline inspect while paused

**Result: pass** (after adding `mousedown` alongside `pointerdown`)

Paused at live `t=3.00`, `player.x=540`. Real mouse down on the timeline at ~20%.

Observed (`30-scrub-20pct.png`):

- Live state **unchanged**: `t=3.00`, `x=540`.
- Inspect playhead / label: `scrub=1.60`, `T 1.58 / 8.0s`.
- Preview-only; existing recordings were not edited.

Earlier attempts that clicked below the canvas (`y=747` vs bar `top=711` on a different layout, or unpaused) showed the toast “Pause to inspect the timeline” (`22-timeline-scrub.png`) — those were misses, not a desync.

### Diagnostics overlay after resize

**Result: pass**

F3-equivalent: Settings → Diagnostics. Overlay shows accumulator, tick, dt, pose, velocity, grounded, coyote, hold, bits, channels, object ids.

After `set viewport 390 844`: FPS/level/loop/remain/echoes/div/state still update (`26-mobile-layout.png`). Touch stick + Grab/Loop appear (`touch.use`, `display:block`). Editor remains openable (`27-mobile-editor.png`).

### Keyboard, pointer, focus

**Result: pass** (with a note)

- Pointer: labeled Left/Right/Jump/Grab and virtual stick work; Right hold walked `x` 48 → 404 (`05-pointer-hold-right.png`).
- Keyboard: `keydown ArrowRight` before focusing the page did not move the player (`03-walking.png`). After focusing the canvas, `state: "run"` and `vx=210`. Capture-phase listeners now record both `e.code` and `e.key`.
- Pointer cancel / leave clears jump/action/stick.
- Blur clears sticky keys. Pause-on-blur is off by default (optional in Settings).

### Gamepad

**Result: not-run**

Standard mapping is implemented (`axes`, A jump, X grab, LB loop, Start pause, disconnect clears sticks). No physical gamepad was attached in this session.

### Audio / music

**Result: pass** for “starts after a user gesture”; **not-run** for heard quality.

Clicking `Jump` resumed Web Audio: `{ started: true, state: "running" }`. Tones are procedural oscillators. Quality was not heard by a human; only context state was inspected.

### Direct file open

**Result: pass**

```
agent-browser --session fileopen open file:///home/pyro/projects/naked/grok46/17-echo-loop-puzzler/index.html
```

`location.protocol === "file:"`, title Afterlight, level Afterimage, 60 FPS (`29-file-protocol.png`). No external loads required.

### Console / failed requests

**Result: pass**

`agent-browser console` stayed empty of application errors during play, editor, import, and resize. Network: local document only (plus browser favicon 404 before the data-URI icon).

Offline mode after load: game still evaluated and rendered (`31-offline.png`).

### Victory / levels / settings / help

**Result: pass**

- Victory overlay with Next / Replay / Export Replay / Levels (`12-victory.png`).
- Six chambers + custom slots (`20-levels.png`).
- Help copy describing loop/echo (`18-help.png`).
- Settings: volume, music, reduced motion/flash, contrast, diagnostics, slow-mo, remappable keys (`19-settings.png`). Contrast class applied on the document element.

## Viewport matrix

| viewport | result | evidence |
|---|---|---|
| 1280 × 800 | pass | `01-desktop-load.png`, play + editor |
| 390 × 844 | pass | `26-mobile-layout.png`, `27-mobile-editor.png` |

Input continuity: pointer buttons remain labeled; touch cluster shows on the narrow viewport. HUD wraps; dense but usable.

## Fixes applied during validation

1. Idle auto-loops no longer spawn empty echoes.
2. Decorative solid that blocked the Afterimage walkway removed.
3. Ground friction increased so echoes stop on plates instead of sliding off.
4. Jump height raised so balcony / one-way chains are reachable.
5. Handoff lift and Clockwork lift extents reach both ledges.
6. JSON sanitizer no longer rejects every object via `"__proto__" in raw`; prototype keys still rejected.
7. Level names strip `<>` and render with `textContent`.
8. `resize` re-applies touch layout; timeline gets `mousedown` for inspect-while-paused.
9. Variable jump cut only once per jump.

Retest after those changes: echo cooperation + gold victory (`12-victory.png`), crate push, editor undo/redo/play-test/slot, malformed import, timeline scrub, file://, mobile.

## Remaining limitations

- Gamepad hardware was not present (**not-run**).
- Audio was confirmed via `AudioContext.state`, not listening (**not-run** for subjective quality).
- The first physics tick after a hard restart is not yet grounded, so a jump bit on that single tick does not leave the floor; the next tick does. Normal play is unaffected.
- 390 px HUD is crowded (wrapping + touch still playable).
- Divergence is flagged from pose snapshots every 4 ticks; it stayed `ok` on the cooperative solve and is not a silent-drift path, but a dedicated “force a crate steal” divergence screenshot was not captured.
- Export Replay writes validated JSON of input bitfields; it was not round-tripped as a cinematic playback file.

## Check summary

| check | result |
|---|---|
| Echo records / resets / independent player | pass |
| Echo holds plate / cooperative door | pass |
| Jump + move+jump | pass |
| Crate collision / carry | pass |
| Switches, doors | pass |
| Hazards | pass |
| Undo echo / clear / restart | pass |
| Editor place ≥3 types | pass |
| Editor undo / redo | pass |
| Play-test edited level | pass |
| Save / reload named slot | pass |
| Malformed import safe | pass |
| Timeline scrub while paused (no desync) | pass |
| Diagnostics + resize 1280 and 390 | pass |
| Keyboard (after focus) + pointer | pass |
| Gamepad | not-run |
| Audio starts after gesture | pass |
| Audio quality heard | not-run |
| file:// direct open | pass |
| No external runtime deps | pass |
| Console errors | pass |
