# Independent simulation review

Reviewed `index.html`, `evidence/plan.md`, and the existing engine tests. Review edits were limited to this document and `evidence/tests/review-*`; the primary agent applied all runtime fixes. No browser session was used by the reviewer.

All confirmed findings below are fixed in the current artifact. The final `node evidence/tests/review-edge-cases.cjs` run passes all 11 groups.

## Confirmed findings and reproductions

1. **Component type validation accepted inherited object keys and non-string types.** The original `TYPES[n.type]` check accepted `"__proto__"` and `"constructor"`; an own-property check alone still accepted JSON `type:["SWITCH"]` through key coercion. Import `{nodes:[{id:"a",type:["SWITCH"],bits:1,x:0,y:0}],wires:[]}` to reproduce the latter. These types violate engine and renderer assumptions. Fixed with string validation and an own-property check. Regression covers all three cases plus `"toString"`.

2. **Analyzer HOLD changed a full capture ring.** Fill the counter analyzer with 512 ticks, switch capture to HOLD, then tick again. The original handler captured two samples, evicted two older samples, and called `splice(1024)`, removing nothing. Fixed by preventing captures inside the engine tick operation. The regression executes the actual app tick handler and checks the complete 1,024-sample history for equality.

3. **Probe changes assigned historical values to another signal.** In the half-adder preset, A has probe `p0` and value 1; B has `p1` and value 0. Remove A's probe and rebuild: validation originally renamed B to `p0`, so retained samples displayed A's historical 1 for B. Separately, adding a new probe after deleting `p0` reused that identifier and inherited the deleted signal's history. Fixed by retaining safe unique probe IDs and avoiding identifiers present in retained samples. Both paths have regressions; the add-probe test executes the actual confirmation handler.

4. **RAM silently ignored an unknown-address write.** Connect a disabled 4-bit tri-state output to RAM.ADDR, set WE=1 and D=9, then tick. ADDR is Z, but the original engine left all 16 words known zero despite a possible write to any address. Fixed by marking all potential target words X. Regression checks every word.

5. **Simulation-time waveform coordinates collapsed zero-delay history.** With zero-delay mode, counter ticks originally produced repeated `time:0` samples. A waveform positioned solely by simulation time rendered all transitions at the same x coordinate. Fixed by advancing logical time for external input changes and each clock half-cycle. Regression checks strictly increasing half-cycle and external-input times while the zero-delay register and CPU checks still pass.

6. **A preserved imported probe ID could invoke a prototype accessor.** Once probe IDs were retained, importing a probe with `id:"__proto__"` caused `capture()`'s plain-object assignment to lose the signal: a switch value of 1 serialized as `values:{}`. Fixed by using a dictionary without a prototype for capture values. Regression checks both direct reads and JSON serialization.

The primary agent also identified and fixed preserved-state rebuilds scheduling evaluations before restoring the old simulation time. That finding is tracked by the primary validation work.

## Additional verification

The review suite verifies three cascaded registers capture pre-edge state simultaneously, edited CPU instructions execute LDI 14 / ADD 3 / OUT / HALT with 4-bit wrapping, and CPU reset returns PC/ACC/OUT to zero. These checks run in unit, gate, and zero-delay modes. RAM asynchronous reads, edge-only writes, and reset memory all pass. A seeded inverter feedback loop actually toggles, reaches a 32-event limit, empties its queue, and propagates X to its downstream output; this supplements the existing unresolved-feedback test.

`node evidence/tests/review-performance.cjs` passes two 1,500-component inverter chains with opposing component-array order and a 1,500-component reconvergent XOR graph. Final local Node VM measurements were 14.4–20.3 ms for construction/reset and 3.0–3.7 ms for a complete source propagation. Every source change processed 1,500 events, settled correctly, and produced no oscillation warning.

## Limitations

Performance measurements cover the engine in Node, not SVG painting, pointer interaction, or a full 24-probe/1,024-sample analyzer in a browser. Browser/mobile/export coverage remains with the primary agent. The simulator uses idealized event propagation and whole-bus X/Z values; these checks do not establish analog timing or partially known bus-bit behavior.
