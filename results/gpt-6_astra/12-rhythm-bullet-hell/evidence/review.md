# ECHO / SHIFT focused source review

Reviewed `index.html` (all three embedded modules and UI), `evidence/design.md`, `evidence/plan.md`, and the existing validation record. This was a read-only source review except for this report. I did not repeat documented tests or operate the browser. Findings refer to the source as reviewed before integration fixes.

## Verdict

Two functional lifecycle defects should be fixed before delivery. Ordinary fixed-tick recording/playback, normalized pointer input, deterministic RNG, swept projectile collision, invulnerability, and reachable encounter endings are coherent in the inspected implementation. Browser validation remains the parent agent's responsibility.

## Required fixes

### 1. High: performance pause cannot recover

**References:** `index.html:909`, `index.html:835`, `index.html:235`.

The active frame loop pauses whenever `audio.elapsed() - sim.t > .75`. Pausing suspends the AudioContext at its already advanced time, while simulation time is unchanged. Resume preserves the original AudioContext origin. Consequently the first resumed frame observes the same greater-than-750 ms lag and immediately pauses again. A main-thread stall longer than this threshold permanently traps an otherwise valid run in the pause/resume loop until restart.

**Recommended fix:** reconcile the deterministic simulation to the frozen audio time before enabling Resume. Bounded catch-up chunks while paused can preserve recorded inputs and checksums without blocking the page; show recovery progress, suppress accumulated visual feedback, and honor failure/victory/replay termination during catch-up. Ensure the audio scheduler does not play missed notes as a backlog. Alternatively a transport rebase must cancel and reconstruct already scheduled voices to avoid breaking synchronization. Add a focused stall/recovery regression check.

### 2. Medium: gamepad Start cannot resume a paused run

**References:** `index.html:826`, `index.html:825`, `index.html:909`.

Controller Start is polled only by `inputSnapshot()`, which is called only while the screen is playing or counting down. Start successfully enters pause; after that no controller polling executes, so pressing Start again cannot call `togglePause()` and resume. A player using the advertised gamepad controls must switch to mouse, touch, or keyboard. Replays also bypass `inputSnapshot()` entirely and therefore cannot be paused with the controller.

**Recommended fix:** poll controller lifecycle buttons once per render frame independently of simulation input sampling. Keep the Start rising-edge latch across entry into pause, so a held button does not immediately resume; reset it on release/disconnect. Continue to isolate replay movement from live controls. Verify Start press, hold, release, resume, and replay pause.

## Import and replay observations

- Import limits files to 3 MB, replay duration to 30 minutes, input and change array sizes, numeric configuration ranges, enum values, grid contents, pointer coordinates, tick ordering, and engine version. Dynamic seed/history text is assigned through text/value properties; no direct script injection route was identified in those fields.
- Recording calls `packed()` and then steps with `unpack(a)`, so pointer rounding applies equally to the original simulation and replay. Settings changes are timestamped before the next fixed step and applied in the same order during playback. Checksums compare the final recorded tick's selected logical state.
- Low-priority hardening: `validateConfig()` does not enforce booleans for `shake`, `reducedMotion`, `reducedFlash`, and `contrast`; `validateReplay()` allows six-element action tuples although the writer emits five or seven; and checksum validation relies on regular-expression string coercion rather than requiring a string. Reject these malformed values explicitly. I found no consequential code-execution or unbounded-simulation exploit from these permissive cases, so they are not delivery blockers.
- The checksum is a compact state check, not cryptographic proof or a hash of every field: cooldowns, hazards, shots, settings and some timing statistics are omitted. Current result copy should not be interpreted as verification of the file's authenticity.

## Scope and residual verification

The supplied design defines victory by surviving three 32-beat phases; `onSub()` implements that endpoint, and health exhaustion implements failure. Practice restores health as documented. The same tempo map is shared by simulation and audio, and the nominal future tempo-change horizon exceeds the audio look-ahead. Audio gain/mute routing and analyser placement are internally consistent; audio quality cannot be established by source review or RMS alone.

Desktop/narrow layout, imported and edited replay completion, mobile multi-touch, actual audio output, damage/victory flow, and error presentation should rely on the parent's ongoing browser checks. No new pass claims are made for those interactions in this report.

## Final scoped integration re-review

Reviewed `evidence/fix-review.diff`, `evidence/fix-report.md`, `evidence/logs/browser-regression.json`, and the updated validation record without rerunning tests or operating the browser.

**Verdict: the two required findings are resolved; no consequential new defect was identified in the scoped fix diff.**

- Performance recovery uses the valid transport-rebase alternative: after suspension, `AudioRack.align(sim.t)` clears scheduled voices, resets the scheduling cursor, and aligns Web Audio/fallback origins with the preserved simulation tick. The recorded real 1.1-second stall keeps tick 282 and checksum `800ba73e`, reduces the paused gap to zero, and resumes to tick 325 without another performance pause. This avoids a catch-up damage backlog while retaining deterministic simulation state.
- Controller polling now occurs independently once per animation frame, including paused gameplay and replays. The Start edge latch survives input clearing, preventing held-button toggles; dialogs and inactive screens are excluded. The virtual-controller evidence records successful gameplay resume and replay pause/resume. Final replay reaches tick 421 with both checksums equal to `ef1d9b58`.
- Boolean configuration validation, action tuple lengths, and checksum types are hardened. Lab emission guards, native Space/Enter activation, per-frame beat indicators, and narrow feedback changes are localized and consistent with the recorded regression evidence. Twenty 180-BPM samples follow the offset-adjusted beat step; the native mixer-control and final replay checks pass in the supplied evidence.

The earlier required-fix section is retained as historical review evidence, not a statement of remaining defects. Physical controller hardware and audible sound quality remain outside the established evidence; the virtual-controller and analyser checks are described accurately. Existing pre-fix lab replay artifacts can differ after the corrected subdivision behavior, so final replay claims should use post-fix recordings, as the supplied regression does.
