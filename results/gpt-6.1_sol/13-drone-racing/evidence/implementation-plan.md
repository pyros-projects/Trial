# APEX FPV implementation plan

Deliver `../index.html` as an entirely offline, self-contained WebGL simulator. The user's complete specification is the authority. Execute inline without approval pauses, as expressly requested. No Git repository exists; work in the supplied delivery directory.

Design: charcoal flight-console shell, orange accents, sunlit generated canyon, prominent FPV viewport, minimal instrument overlay, compact telemetry cards, full settings drawers, responsive mobile layout. Use native WebGL1 geometry/shaders, no dependencies or images. Use a 120 Hz fixed timestep and normalized quaternions. Physics is independent of all cameras.

1. **Flight and race core**: test real thrust/gravity, four independent inputs, assisted vs rate control, quaternion stability, swept ordered gates, reverse/missed gates, collision response, seeded reset, import validation. Create a pure core script in index.html; Node harness extracts and runs the delivered core.
2. **Renderer and UI**: generate terrain, mesas/trees/industrial landmarks, gates, drone, trail, dust/sparks, haze, directional shading/contact darkening. Create four cameras, OSD, responsive console, live telemetry. Browser-render checks and real keyboard/pointer inputs.
3. **Complete controls and race loop**: seed/presets/difficulty, physics tuning, camera/render/audio settings, gamepad calibration/deadzone/inversions/fallback, pause/reset/recovery, timing/penalties, recording, local best/ghost, JSON import/export, PNG download. Invalid imports leave current course intact.
4. **Validation and repair**: use installed agent-browser core and exploratory workflow. Test offline direct file; desktop 1280×800 and mobile 390×844; keyboard independence; 2 ordered gates; collision/recovery; manual mode; pause/input focus; all cameras; replay; import/export; quality; audio state after gesture; browser errors/requests. Record exact commands, observations, screenshots and failures/fixes in validation.md. Review the finished implementation.

Review focus: collision tunneling, reversed gate crossings, nonfinite imported values, localStorage exceptions, camera continuity, mobile control clipping, stale held keys on blur/pause, WebGL fallback/context loss, ghost recorded timestamps and orientation.

Progress: plan written; testing-first core next.

Task 1: pure core implemented. Initial absence produced the expected RED. Two agent-authored test expectations were overconstrained relative to requirements: the expo-reduced pitch travels 0.672 m in one second, and the canyon floor is -0.12 m (0.22 m center after a 0.34 m collision radius). Corrected those expectations to test independent physical translation and the actual hand-defined floor; no public requirement or supplied test was changed. Core suite rerun. Next: UI and native WebGL.

Tasks 1–4 complete: single-file core/UI/renderer, all controls and persistence, actual browser exploration and repairs. Pure-core tests, 3000 seeded-course clearance checks, 168 dynamics-based approaches, offline/direct-file browser workflows, desktop/mobile/retina, recordings/files and fallback verified. Five important review findings addressed. User-approved native delivery in supplied non-Git directory; no build artifacts or runtime dependencies added. Full validation and limitations in validation.md.
