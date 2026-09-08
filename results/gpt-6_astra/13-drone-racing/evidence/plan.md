# AERIS simulator implementation plan

Goal: deliver one offline, direct-file-compatible index.html with a complete physically simulated FPV racing loop.
Architecture: a pure fixed-step physics/course kernel, procedural WebGL renderer, and accessible DOM instrument panel. No runtime dependencies. Evidence and development tests live beside the artifact in evidence/.

Ruling: the user's explicit end-to-end instruction authorizes design and implementation without additional approval gates. This directory is an empty, non-git workspace, so work stays here and no branch operations apply.

Design: charcoal flight console with acid-lime accents, ochre canyon terrain, sandstone escarpments, industrial structures, physical emissive gates, clear start pad and course markings. Desktop sidebar + expansive viewport + live telemetry; narrow layout places tuning below the viewport and provides touch sticks.

Tasks:
- [x] Pure physics/course kernel: quaternion orientation, 120 Hz integration, motor lag, independent four-axis control, angle/horizon/acro, assists, sphere/box/ground collision, deterministic curated courses, swept ordered checkpoint crossing. Write and run independent behavioral tests before integrating.
- [x] Self-contained renderer and flight console: generated meshes and GLSL, four cameras, lighting/haze/contact shadows, particles, procedural audio, HUD/minimap/telemetry, keyboard/gamepad/touch input and every tuning control.
- [x] Race state and files: lap/sector/penalties, recovery/restart/pause, best recording and replay interpolation, local persistence, strictly validated bounded JSON import/export, PNG export.
- [x] Real-browser validation: required agent-browser core + exploratory workflow; file:// with offline network, actual keyboard and pointer flights, checkpoint/collision/modes/replay/camera/reset, 1280x800 and 390x844, console/network/error and diagnostics evidence. Fix reproduced failures and rerun.
- [x] Final independent review and regression; publish honest validation.md with remaining limitations.

Interfaces: window.DroneCore exposes createCourse(seed,preset), Drone(settings), math helpers. Drone.step(dt,input,course) mutates p,v,q,omega,acc,motor and collision diagnostics. Courses supply gate centers/normals/right/radius and clear-path obstacles. Rendering never writes the physics state. Checkpoint detection uses previous/current position and gate's signed plane crossing, aperture and direction.

Verification: fixed dt repeatability, unit quaternion/finite extremes, independent controls, collision nonpenetration and ordered crossing. Browser validates the delivered composition. No simulation state injection is counted as a flight check.

Final status: all implementation tasks complete. Functional browser regressions and bounded source review passed. Remaining coverage limits are recorded in validation.md; there is no git repository or remote integration step.
