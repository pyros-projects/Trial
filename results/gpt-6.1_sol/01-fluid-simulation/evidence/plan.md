# Fluid study implementation plan

> Execute inline using superpowers:executing-plans. The user requested one autonomous end-to-end run; approval checkpoints are superseded by that explicit instruction. This directory has no Git repository; no branch/worktree or commits are required for filesystem delivery.

**Goal:** deliver the complete standalone fluid application and inspectable validation evidence.

**Architecture:** embed two grid solvers behind `resize(w,h)`, `splat(x,y,vx,vy,color,radius)`, `step(dt,params)`, `clearDye()`, `reset()`, `render(mode)` and `stats()` methods. UI owns input, frame timing and accessible controls; solvers own state and rendering.

**Tech stack:** HTML/CSS, browser JavaScript, WebGL2/GLSL and Canvas2D; Node for development-only numerical checks; agent-browser for actual application behavior.

**Spec:** `evidence/design.md`.

## Constraints

- Deliver only one runtime file, `index.html`, with no build process or external resources.
- Preserve continuous fluid velocity, pressure, dye advection, viscosity, vorticity and dissipation.
- All required controls must work and modes must switch without resetting.
- Desktop, touch and high-DPI resizing must remain usable.
- Validation artifacts and harnesses remain under `evidence/`.

## Review focus

- Pointer capture across canvas bounds, rapid coalesced motion and cancellation.
- Paused field must remain frozen even with active pointers or emitters.
- Resolution/aspect changes must retain finite fields and transport coordinates correctly.
- Unsupported GPU and lost-context recovery must remain actionable.
- Minimum/maximum control settings and projection boundaries must remain stable.

## Tasks

1. [x] Numerical fallback. Write tests first for projection lowering RMS divergence, dye-only clear preserving velocity, advected dye centroid displacement, viscosity reducing energy, curl confinement changing motion and finite extreme steps. Run red, implement `FluidCPU` inside the artifact, then run green.
2. [x] GPU engine and interface. Add floating-point solver and five visualization shaders, resampling, initial curved dye jets, controls, status, responsive styling, pointer continuity, keyboard help and PNG capture. Check script syntax. Shared solver parameters: speed, viscosity, pressureIterations, vorticity, velocityDecay, dyeDecay, force, radius and color.
3. [x] Browser validation. Launch file directly using agent-browser; inspect snapshots and screenshots; exercise public validation with real input and field readback; test local HTTP with internet blocked, narrow and high-DPI viewports, touch and failure states. Document failures as found, reproduce, fix and retest the affected flow and compact regression.
4. [x] Final verification and review. Run numerical suite, browser regression, console and request checks. Review artifact against the complete brief and update `validation.md` with honest pass/fail/blocked/not-run outcomes and any limitations. Leave the finished HTML and evidence on disk.

## Completion ledger

- Numerical implementation: 7/7 tests passing; initial missing-engine red run recorded.
- GPU implementation: both embedded scripts pass `node --check`; actual float readback finite with GL error 0.
- Browser verification: 48 passing assertions across core, modes, controls, materials and mobile workflows. Genuine touch, rapid CDP input, PNG export, unsupported GPU, context recovery and blocked-internet local HTTP checks additionally passed.
- Final read-only review: no critical/important findings. Both display issues reproduced and fixed; pressure preserved on resize and clean-dye message restricted to Dye. Root agent also found and fixed fallback resolution options that all selected the same grid.
- Compact regression after repairs: core, modes, mobile and numerical suite passed. No console errors or uncaught exceptions in final file, fallback or local HTTP runs.
- Delivery decisions: no persistence/import added because neither is requested; PNG capture is local. CPU resolution scales compactly (43/64/85/96 short-side cells) instead of allocating GPU-sized grids. Context loss recovery reloads to restore default state. Other browser engines remain not-run; no requested check is blocked.
