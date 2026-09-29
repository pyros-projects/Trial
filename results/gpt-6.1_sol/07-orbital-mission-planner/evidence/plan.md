# Orbital mission planner implementation plan

> Implement inline with the executing-plans and verification skills. Keep all delivered runtime code in index.html.

Goal: a complete, coherent offline mission sandbox.
Architecture: inline physics core → prediction/frame model → Canvas and controls. Use the same numerical implementation for live motion and prediction.
Tech stack: browser-native HTML/CSS/JavaScript/Canvas; Node for development tests; agent-browser for validation.
Spec: evidence/design.md.

Global constraints: one self-contained index.html; no runtime library, asset or network dependency; numerical integration; responsive and high-DPI; evidence outside the runtime.

Review focus: near-collision integration; stale predictions after input; event-time burns; focus continuity while telemetry updates; history in moving frames; malformed import atomicity; very large spatial scales; mobile accessible controls.

- [x] Task 1: Write failing numerical behavior tests in evidence/physics.test.cjs. Implement inline Physics: accelerations, verlet, advance, elements, totals, frame transforms and predict. Verify a circular two-body orbit, conservation, eccentric orbit, event timing, prediction/live agreement, frame velocity and collision behavior.
- [x] Task 2: Add the full semantic HTML and responsive design, presets, UI and renderer. State API consumes Physics with bodies {id,mass,radius,x,y,vx,vy}, config {G,dt,softening,collision}, nodes {id,bodyId,time,mode,a,b,executed}. Prediction points contain time plus cloned body state. Browser checks prove pointer, keyboard, primary controls, frames and telemetry behavior.
- [x] Task 3: Connect maneuver editing and timeline, body/state editing, overlays, configuration, checkpoints, save/load and JSON import/export. Immediate prediction recomputation and exact-time live burns are required. Reject invalid finite numeric inputs without corrupting state.
- [x] Task 4: Run complete real-browser flows in direct-file and restricted localhost modes, desktop and narrow sizes. Record failures as encountered, diagnose causes, fix and rerun failed flows plus regression. Use a fresh review of implementation and evidence before delivery.

No git repository exists here; use the supplied workspace and preserve reviewable artifacts without introducing a repository or a build process. Execution progress is recorded in validation.md and numerical logs.
