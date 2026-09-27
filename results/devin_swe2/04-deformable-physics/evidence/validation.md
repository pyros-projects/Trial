# Validation — Deformables soft-body/cloth playground

Artifact: `index.html` (single self-contained file, no external deps).
Tool: `agent-browser` 0.31.1 (headless Chromium via CDP), served via `file://` URL —
direct-file opening verified working. `network requests` shows only `file://` document
loads; zero external fetches.

## Checks

| Check | Method | Result |
|---|---|---|
| Boot, no console errors | `agent-browser errors` + `console` after every session | pass — no errors/page errors at any point |
| Real deformable dynamics | eval `SIM.parts[n]` position tracking | pass — ball fell 200→316px, rope end swung to hang, cloth drapes/sags |
| Grab + drag (pointer) | `mouse move/down/move.../up` on flag corner | pass — cloth stretched to pointer, tether rendered (`07-grab-drag.png`) |
| Rapid drag continuity | 9 fast `mouse move` steps while dragging stress-test cloth | pass — grabbed particle tracked to (850,620), cloth followed, 60fps |
| Pin / unpin | key `2`, click particle 82 | pass — pin toggled on/off verified via `SIM.parts[82].pin` |
| Cut constraints | key `3`, swipe through flag | pass — 59 constraints severed, permanent slit visible (`08-cut.png`) |
| Tear from stress | hard drag / impact | pass — constraints die at strain > threshold, tear graph persists |
| Balloon pop | cut through pressurized balloon ring | pass — 6 ring cons cut, pressure constraint killed, deflated scrap fell (`34-popped2.png`) |
| Impulse | key `4`, click near flag | pass — maxErr jumped 2%→10%, ring-flash feedback |
| Wind gust | key `5`, drag | pass — gust force applied, visible arrow streak |
| Spawn all types | spawn tool + select: rope, cloth, ball, blob, balloon, circle, box, bar | pass — all spawn at pointer (`09-spawned.png`) |
| Object-object collision | stack scenario + spawned objects | pass — balls rest on blobs, cloth wraps obstacles, pairs>0 (`10-stack.png`) |
| Pause / single-step / reset | topbar buttons + Space/N/R keys | pass — positions frozen when paused, step advances one frame, reset rebuilds |
| Solver params | slider input events | pass — iterations 8→1 raised maxErr 0.7%→15%; wind 420→900 flew flag horizontal; gravity angle 90→270 floated bodies up (`28-grav-up.png`); pressure 1→2.2 inflated balloons r≈30→51; timestep 1→0.3 slowed sim |
| Viz layers | view toggle buttons | pass — particles, constraints, velocity, stress heat, contacts, hash grid all render without resetting world (`11`, `12`, `31`, `35`) |
| Stress viz responds to strain | stress layer under load | pass — green→yellow/red gradient at contact/strain points (`12-stress-grid.png`) |
| Scenarios | select each of 7 | pass — flag, drape, bridge (sags under blob), stack (squishy pile), net (caught a ball), balloon chamber, stress test — all live sim |
| HUD overlay | visual + `SIM.stats()` | pass — fps, particles, constraints live/total, collision pairs, iter×sub, maxErr, tool, scenario, pause state |
| High-DPI / resize | `set viewport` 1280→390 | pass — canvas rescales, world coords coherent, pinned cloth stayed put, bodies clamped into new bounds (`29-mobile.png`) |
| Narrow viewport 390×844 | viewport + panel toggle | pass — wrapped topbar, drawer panel via ⚙, all controls reachable (`30-mobile-panel.png`) |
| Self-collision toggle | checkbox change event | pass — `P.selfCollide` toggles, fold contacts enforced |

## Bugs found & fixed during validation

1. `clearWorld` reassigned `const ringFlash` — scenario build threw, empty world. Fixed: `.length=0`.
2. Cloth locked rigid: shear/bend solved every iteration (32 passes) made the sheet a
   rigid plate — flag couldn't droop. Fixed: soft constraints (shear/bend) solve once
   per substep; struct/rope every iteration.
3. Torn-quad rendering artifact: a quad whose far corner particle was fully detached
   still drew a stretched triangle to it. Fixed: per-quad connected-particle check,
   draws triangle of surviving corner set; detached particles render as scraps.
4. Impact self-tearing: cloth dropped on sphere tore a hole from contact-vs-constraint
   strain spikes. Fixed: tear check forgives contact-adjacent constraints; default
   threshold 1.6→2.4.
5. `setParam` display bug: any value ≥99 showed "4". Fixed.
6. Drape scenario iterated 3× (single apex → cloth slid off; final: two posts + sphere,
   wide sheet spans and sags into gap — `23-drape7.png`).

## Known limitations

- Cloth self-collision is approximate (particle-radius based, bonded pairs skipped);
  fine at default thickness, dense folds can interpenetrate slightly.
- Balloon ring cut requires hitting the thin ring on a moving body — by design.
- At extreme narrow resize, compressed bodies pile with elevated strain — physical
  consequence, not a fault.
- `pointer.vx` fling uses smoothed pointer velocity; feel is tuned, not physically exact.

Verdict: all public validation checks pass; no blocked or not-run items.
