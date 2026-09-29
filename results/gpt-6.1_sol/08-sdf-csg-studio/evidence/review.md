# Independent implementation review

Read-only review by the final_review agent, followed by root-agent reproductions and fixes. This is agent-authored evidence, not an evaluator report.

1. **P1: smooth-union acceleration bounds omitted blend expansion.** Two coincident radius-0.2 spheres with blend radius 4 should create radius 1.2. Actual GPU picking initially missed. Fixed by expanding the enclosing sphere by the sum of non-seed smooth-min `k/4` reductions divided by the smallest conservative distance slope. The slope includes min/max scale and deformation's Lipschitz factor. Actual hit changed from a miss to 4.79927 versus expected 4.8. A deformed, nonuniform case hit 3.85992 versus independently calculated 3.86077. Re-review confirmed the conservative bound proof; extreme scale/deformation can make this bound loose, with a performance cost.
2. **P1: material color array passed regex coercion.** Embedded core accepted `["#aabbcc"]` as a color, which would fail during GPU upload. Added an explicit string check. The real import UI now displays its color validation error, preserves the prior scene exactly, and leaves the renderer ready. See logs/malformed-color-ui.json.
3. **P2: per-axis resolution caps changed aspect.** 1200×700 at 200% became 2048×1400. A shared cap now scales both dimensions. Tests cover landscape/portrait and DPR 1/2; actual 1368×768 viewport rendered at 2048×1150, preserving aspect within pixel rounding.

All three changes passed independent code re-review. Embedded scene core tests passed. GPU and UI regressions were performed by the root agent and retained in logs. No additional material defect was identified in cutter ownership, conservative primitive scaling, or ordinary pointer drags.

A subsequent real context-loss/compile-error recovery test found stale renderer error diagnostics and footer text. Successful renderer initialization now clears the old error and restores the footer; the failure and successful retest are recorded in logs/shader-recovery-before-fix.json and logs/shader-recovery-green.json.
