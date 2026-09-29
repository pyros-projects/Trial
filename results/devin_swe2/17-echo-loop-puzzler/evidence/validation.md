# ECHOLOOP — validation evidence

App: `index.html` (single file, ~88KB, zero external deps). Validated with `agent-browser`
(headless Chromium, CDP) driving the real page at `file://…/index.html`. Input via real
dispatched DOM KeyboardEvents + pointer events; physics exercised via the game's own
`simStep()`/`pollBits()` path (scripted keyDown maps) for deterministic multi-loop solves.

## Environment
- agent-browser headless Chromium, viewports 1280×800, 900×600, 390×844
- `performance.getEntriesByType('resource')` → 0 external fetches (file:// only) — PASS

## Core loop mechanics — PASS
- Movement/jump/coyote/buffer: ArrowRight moves player at 165px/s; Space jumps (~67px held,
  ~15px tap via variable-height cut); coyote+jump-buffer implemented. PASS
- Record→echo: drove player onto plate (plateCh.A=true, doorAnim→1), R ended loop,
  echo spawned and replayed recorded bits on the same physics timeline. PASS
- Echo cooperation: L1 won while echo held plate open; L2 won with echoes on plates A+B;
  L6 won with 2 echoes + player carry. PASS
- Determinism: `resimTo(step)` reproduces player AND echo positions bit-for-bit
  (x===x exact). PASS
- Divergence detection: recorded tape blocked at closed door, then opened door early —
  echo walked 266px past its tape; `diverged` flagged at step 256, `G.diverged=true`,
  toast + red outline. PASS
- Crate push: player pushed crate 940→1031 through echo-held door. PASS
- Cube carry/throw: E grabs (carry=0), F throws (vx=290,vy=-57, lands and rests). PASS
- Moving platform: rode elevator from floor to ledge in L4 (carry by mover delta). PASS
- Lasers: timed crossings in L5; beam blocked by crates (beamRect casts to first obstacle).
  Laser kills → respawn (deaths observed, checkpoint respawn verified in L6). PASS
- Timed switch: L4 timer button B opens door for 12s, countdown rendered. PASS
- Lever: L5 lever toggles channel B (latch persists across loop). PASS
- Undo echo (U): echoes 2→1, timeline rewoven via deterministic resim. PASS
- Clear echoes: echoes→0, resim preserves exact live step/state. PASS
- Pause + timeline scrub: pointer-drag on timeline pauses and previews world state at any
  step via resim (scrubT=593 → previewStep=593); resume restores live state. PASS
- Frame step: exactly +1 step while paused. Slow-mo: 15 steps/s (0.25×). PASS
- Level select, medals (GOLD recorded for L1/L6), loop counts, restart, victory screen
  ("TIMELINE RESTORED — all loops closed") after final level. PASS

## All six levels solved through real physics (scripted harness, zero cheats)
| L1 FIRST LIGHT | PASS — plate-echo → door → goal |
| L2 TWO KEYS    | PASS — echo per plate, chained doors |
| L3 RELAY       | PASS — echo holds door A; player carries cube out, drops on plate C |
| L4 ESCALATOR   | PASS — echo plate + timed switch B + elevator ride |
| L5 CROSSFIRE   | PASS — echo lever+plate; player times two staggered lasers |
| L6 QUARTET     | PASS — echo plateA + echo climbs to plateB + player carries cube over spikes to plateC |

## Editor — PASS
- Opened via menu; palette has all types: wall/oneway/spawn/goal/plate/lever/timer/door/
  mover/laser/crate/cube/spikes/checkpoint/erase.
- Placed wall+plate+laser via real canvas clicks (snapped to grid 8). PASS
- Click-drag moved wall; Ctrl+Z restored (undo/redo depth tracked). PASS
- Marquee box-select multi-select (2 crates), shift-add supported; delete removes. PASS
- Property panel edits live (plate channel A→B); validation surfaced
  "door listens on channel A but nothing triggers it". PASS
- Playtest (Enter/button) runs the doc in the engine; pause menu has "BACK TO EDITOR"
  restoring the doc. PASS
- Save slot (localStorage `elp.slots`), export/import JSON with whitelist sanitizer —
  malformed inputs clamped/dropped, no crash, no code execution. PASS
- Pan (MMB/RMB/pan tool), zoom (wheel), laser rotate (R), nudge (arrows). PASS (code + spot)

## Input & windowing — PASS
- Keyboard incl. remapping UI (settings → capture key), alt bindings.
- Virtual touch buttons appear at narrow/touch; produce input bits (R+J=6). PASS
- blur/visibilitychange clears all held keys — no stuck actions. PASS
- Gamepad code path present (axes/buttons mapped); NOT hardware-tested — NOT-RUN.
- pointercancel handled on virtual buttons. PASS

## Presentation & options
- Layered parallax (stars+grid), echo trails + per-echo colors, door anim, laser beams,
  particles, loop-reset flash, camera ease+lookahead, contextual prompts, level hints. PASS
- Web Audio procedural SFX + generative music: AudioContext `running` after real gesture. 
  Audio quality not verified by ear (meters/state only). NOT-RUN for quality.
- Reduced motion, high contrast, master/music volume, mute — toggles verified. PASS
- Live overlay: fps, level, loop idx, time left, echoes, divergence, state, channels,
  mode, tool. Diagnostics mode (`) draws hitboxes/grounded. PASS
- HiDPI via DPR-scaled canvas; mid-play resize re-fits camera, sim continues. PASS

## Bugs found & fixed during validation
1. Open doors shoved the player out (de-penetration condition inverted) — blocked L1. FIXED.
2. `char.trail` undefined → render threw inside save/restore → transform corruption →
   ghosted multi-level smear. FIXED.
3. Crate spawned 2px inside floor got X-ejected to x=1400 by the dx==0 overlap branch.
   FIXED (axis resolution now owns only min-penetration axis).
4. Cube dropped at player's feet got pushed off its plate by char collision — cubes now
   ignore char bodies (carried/physics consistency). FIXED.
5. L3 cube room had no right exit → added second door on channel A. FIXED.
6. L4 elevator: tri-wave had no dwell + 20px side gaps dropped player onto spikes.
   FIXED (smoothstep easing, lift fills shaft width).
7. L6: ledge hop too precise → widened step/ledge; spikes narrowed to fair hop. FIXED.
8. Editor panel could linger over gameplay; timeline bar lingered on menu. FIXED.

## Remaining limitations (honest)
- Gamepad path is implemented but not hardware-verified.
- Audio verified only to AudioContext state (no listening test).
- Rect "resize" is via numeric property fields, not drag handles (spec allows either).
- Slot naming uses `prompt()` (works in real browsers; headless auto-cancels).
- `agent-browser press` for Ctrl+D/Delete didn't reach the page in one attempt; the same
  actions verified via dispatched DOM keydown (works). Possibly a focus quirk in the tool.
