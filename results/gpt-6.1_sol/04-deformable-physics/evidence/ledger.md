# Development ledger

The requested end-to-end run authorizes implementation and validation without intermediate approval gates. No git repository exists; all development records and test outputs are kept in evidence instead of commits.

Task 1: Initial physics tests failed 10/10 because the embedded engine was absent (`logs/physics-red.txt`). First implementation passed 9/10. Extreme-controls reproduction identified one non-collidable internal soft-body particle falling outside the world after its spokes tore. World bounds now constrain internal particles too; internal obstacle/particle collisions remain disabled. A separate test exposed horizontal gravity being scaled by a material's aerodynamic factor; gravity is now independent of that factor. Pair collision impulses are deduplicated per substep while displayed pair counts remain unique per frame.

Task 1: complete — `node --test evidence/tests/physics.test.cjs` → 11/11 pass (`logs/physics-green.txt`).

Task 2: complete — both embedded scripts parse; complete responsive UI, eight scenes/modes, six placement types, all material/world/solver controls, pointer capture and coalesced input, guide, preferences and canvas export. No external runtime dependency.

Task 3: final regressions in progress — real direct-file desktop/mobile, keyboard/pointer, high DPI, all scenario/mode, graph deformation, venting, offline and console checks recorded in validation.md. First review reproduced invisible bending tethers and stale paused diagnostics; regression tests went red then green after structural support dependencies and current-geometry diagnostic measurement. Follow-up review confirmed fixes and a 60-object budget, then found three UI invalidation paths; spawn, self-collision toggle and Defaults now flag diagnostics dirty. Parent validates those paths through real UI separately.

Fresh core suite: 19/19 passing (logs/physics-final.txt), including actual support separation, paused contacts/hash/area geometry, cloth contour curvature, non-neighbor self collision, ball loading a rope, solver iteration accuracy and pressure expansion.

Final: complete. The attachment-collision regression went red, then green after exact live-joint endpoint exclusion; cutting restores collision eligibility. Full core suite now 20/20 pass, all eight scenes and the full desktop workflow pass after that change, and a fresh offline profile passes seven direct-file desktop/mobile/PNG/error checks. Final dependency/syntax audit is clean. Final required outcomes and honest remaining numerical/coverage limits are at the top of validation.md.
