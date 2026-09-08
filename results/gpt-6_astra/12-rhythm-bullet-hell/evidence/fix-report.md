# Integration fix report

## Changes

- `evidence/audio.js`: added explicit stalled-run alignment. A performance pause now freezes transport at the current simulation time, clears the scheduler and scheduled voices, rebases both Web Audio and silent-fallback clocks, advances `nextBeat` to the next unsimulated sixteenth, and resets the scheduler lead marker. Ordinary pauses retain their existing clock origin.
- `evidence/app.js`: performance pauses align only after audio suspension; gamepad polling runs once per animation frame with a Start edge latch that survives input clearing; paused runs and replays accept Start while dialogs, title, and result states do not. Keyboard, pointer, dash, and touch-focus state still clear on focus loss.
- `evidence/app.js`: moved beat-light class changes to a per-frame helper that writes only when the active step changes. The 10 Hz statistics update remains unchanged.
- `evidence/app.js`: live telemetry now includes combo, active/completed run labels use `sim.config`, encounter measure display clamps to 24, the subdivision select commits on `change`, and narrow-canvas feedback text retains an 11 CSS-pixel minimum with aspect compensation and horizontal edge clamping.
- `evidence/app.js`: Space and Enter retain native activation on focused buttons and links while canvas/body shortcuts and global Escape handling remain active. The on-screen Pulse button now also converts keyboard-generated clicks into a dash latch.
- `index.html`: tightened replay/config validation, preserved encounter pattern form guards while allowing lab subdivision to control bloom, lanes, and accelerate emission density, embedded the updated audio/application modules, fixed the live footer to the viewport with responsive margins and content clearance, and restored stroke rendering for reset icons.
- `evidence/tests/lifecycle.test.cjs`: added valid and malformed replay cases plus focused audio-alignment, gamepad edge-latch/dialog guard, lab subdivision, telemetry, beat-indicator, and narrow-feedback assertions.

## Verification

- `node --check evidence/app.js` — pass.
- `node --check evidence/audio.js` — pass.
- `node evidence/tests/core.test.cjs` — 8/8 checks pass.
- `node evidence/tests/lifecycle.test.cjs` — 7/7 checks pass, including focused native-control and keyboard Pulse activation coverage.
- Embedded `audio-engine` and `application` scripts match their source modules byte for byte after `python3 evidence/embed.py`.

## Material concerns

Browser behavior and layout were intentionally left to the parent agent against the already-loaded application. The final keyboard correction requires that parent-owned browser retest. This work introduced no external dependencies.
