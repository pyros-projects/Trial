# Independent embedded-engine and persistence review

Reviewed `index.html` and `evidence/design.md`; did not edit the delivered runtime. Findings below describe the pre-fix implementation. Root is implementing fixes and owns final regression verification.

## Important findings

1. **Directional LOS allows invisible ranged damage** — original line 81. On the generated default EMBER-7241 map, player at (2,1), archer at (6,3): `los(player, archer) === false`, reversed LOS is true, FOV hides the archer, but `perceived` is true. Waiting loses 3 HP to its arrow. Use reciprocal blocking geometry for player and AI. Exact embedded-engine reproduction: `probe.cjs`, output `probe.log`.

2. **Malformed imports replace the current run with state that throws** — original lines 145–146, with failures at 99/133. A valid save modified only to `telegraphs: [null]` passes `decode`; the next wait throws `Cannot read properties of null (reading 'due')` after turn increments. An added valid-coordinate loot object of type `unknown-relic` also passes; moving onto it mutates position and inventory, then throws reading `ITEMS[type].name`, before turn increments. Validate nested object types, enum values, and numeric fields before accepting a save. Exact reproduction: `probe.cjs` / `probe.log`.

3. **Starting replay during replay loses the original return state** — original line 249, reachable via the menu at 234/251. Four-turn run → replay one action → Menu / Replay actions → Escape returns to turn 1, not turn 4. Observed fingerprints `3bb1fb05` → `492141ec`. `startReplay` replaces `replayInfo.original` with a partial playback and leaves the previous timer outstanding. New/load/import/restart are also available during replay without ending that lifecycle. The actual interface functions were run with DOM rendering and timer scheduling stubs in `replay-ui.cjs`; `replay-ui.log` records observed state.

4. **The Warden's warning cannot be evaded by ordinary movement** — original lines 103/133. Final arena fixture, player (15,9), Warden (19,9), otherwise unmodified open geometry. Waiting marks a radius-2 cross centered on the player due next turn. Each of the four valid cardinal moves takes 12 damage. The instruction “Move out before next turn!” cannot be followed without a rift stone or killing the boss. Root plans a two-turn warning so a second cardinal move can leave the cross. Reproduction: `probe.cjs` / `probe.log`.

## Minor finding

- Player action log entries use the preceding turn number; enemy responses use the committed turn. Example: the first `wait` leaves state.turn = 1 and journal text “You hold your ground.” at turn 0. Original lines 84, 115, and 132. Root should stamp player entries when the accepted action commits, while preserving free invalid actions. Observed in `checkpoint-status.log`.

## Passing bounded checks

- 2,000 generated floor-three maps across all five styles (400 seeds each) were connected and contained an Ash Warden.
- Floor-one checkpoint restoration reproduces the initial fingerprint; encoding/decoding is accepted and replay agrees after restoration.
- Guard duration after cast and successive waits was 2, 1, 0, 0 remaining, consistent with protection during exactly three enemy phases. Its cooldown remained 2 after the cast plus three waits.

Full three-floor checkpoint replay and real browser interaction were left to the root's integration tests. No browser session or `index.html` was mutated by this reviewer.
