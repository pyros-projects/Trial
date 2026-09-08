# ECHO / SHIFT Implementation Plan

> Execute continuously under the user's end-to-end authorization, using the subagent-driven-development skill for the independent audio task and review. Tightly coupled game/UI integration is local.

**Goal:** Deliver a polished, complete standalone rhythm bullet-hell and genuine browser validation.
**Architecture:** One HTML file with embedded CSS, a pure deterministic core, AudioContext soundtrack, and DOM/Canvas presentation. A shared tempo map drives both audio scheduling and 120 Hz gameplay.
**Tech Stack:** HTML, CSS, Canvas 2D, Web Audio, JavaScript. Node and agent-browser are development-only.
**Spec:** evidence/design.md and the user requirements.

## Global constraints
- Final application: index.html in working directory, fully self-contained, no external runtime requests.
- Actual user-gesture audio, look-ahead transport, deterministic simulation and action replay.
- Desktop 1280×800 and narrow 390×844 browser interaction and screenshot checks.
- Evidence stays beside index.html in evidence/; report blocked checks honestly.

## Tasks
- [x] 1. Pure simulation and transport: write behavior tests for tempo continuity, seed determinism, input replay, collision/invulnerability, and sequencer gating; run red; implement embedded core; run green.
- [x] 2. Audio: independent AudioRack class with gesture enable, scheduler, real synthesis, mute/mix/analyser, pause, fallback; integrate shared Transport.
- [x] 3. Presentation/game loop: arena, preview, countdown, navigation, instructions, responsive rack, results, replay import/export, settings, persistence. Inspect in real browser.
- [x] 4. Exercise desktop/narrow main flow, controls, damage/failure/restart, phase progression, pause, editor, timing, replay, audio output diagnostics, storage, import errors, reduced effects, and direct-file offline loading.
- [x] 5. Review source for synchronization, collision, replay and lifecycle defects; fix/retest; finalize validation.md with exact commands and evidence.

## Interface contracts
Transport(bpm): beatAt(seconds) starts at -4; timeAt(beat); setTempo(bpm, now) quantizes changes to next measure outside a 160ms horizon. Config includes bpm, music, master, drums, bass, melody, pad. Phase = clamp(floor(max(0,beat)/32),0,2).
AudioRack: constructor(transport, config), async enable(), start(), elapsed(), async pause(), async resume(), stop(), mix(config), getWave() => Uint8Array, getSpectrum() => Uint8Array, diagnostics(). Read-only context and state. start sets origin=currentTime+0.12 and schedules from beat -4. Audio elapsed and simulation seconds both begin at zero.
