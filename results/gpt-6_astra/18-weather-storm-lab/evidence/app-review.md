# Application and renderer review

Scope: read-only review of `evidence/app.js`, `evidence/render.js`, and delivered HTML. Numerical solver implementation was excluded; the documented `sample()` coordinate contract was inspected to assess the UI integration. Findings below are code-derived, not claims of browser reproduction. Parent is performing browser validation.

Verdict: broad feature coverage is present, including real field uploads, continuous interpolated brush strokes, gesture cleanup, explicit audio enablement, paused stepping, offline exports and graphics context recovery. Resolve the import validation and diagnostic coordinate issues before claiming complete, truthful laboratory behavior.

## Findings

1. **P1 — Malformed optional state can be accepted and break the live renderer.** `app.js:90–91` validates only selected fields, commits `sim = next`, then copies entire untrusted `effects` and `camera` objects with `Object.assign`. Reproduction input: export an ordinary state, add `ui.effects.bolt = {}`, then load it. Required effects numbers still validate, but the next `drawOverlay()` (`app.js:83`) calls `line(undefined, ...)` and stops rendering. Likewise, `ui.camera.preset = "invalid"` passes import but the next camera preset click fails at `app.js:55`. Finite but out-of-range history times are accepted and can suppress new samples indefinitely (`lastHistory` at line 91, sampling condition at line 72). Construct sanitized next-state objects using explicit allowlisted keys and type/range/invariant validation before committing any live state. Ignore unknown keys; do not copy them into operational objects. Check history time ordering/range against simulation time. Browser check should assert a rejected import leaves existing field checksums, camera, and rendering intact.

2. **P2 — Section wind vectors do not represent the displayed section.** `app.js:80` samples seven different z rows at a single altitude and projects them using `project()` (`app.js:56`), whose section branch discards z. The result overlays seven unrelated wind arrows per x coordinate. Streamlines similarly integrate away from the section plane and project onto it. The section shader samples only `sliceZ = probe.z` (`render.js:38`). For section mode, sample an x/y grid at `probe.z` and draw the in-plane u/w components; constrain sectional streamline integration to that plane or hide those lines with a clear explanation.

3. **P2 — Probe labels and rendering do not use the same spatial sampling convention.** UI readings and CSV rows claim the exact requested position/altitude (`app.js:73,75–76`), but the model's public `sample()` contract snaps to the nearest grid node. With 12 layers, a requested 2.5 km is read from 2.727 km and still labeled/exported as 2.5 km. The marker is also placed at the requested altitude, and is moved still higher above terrain by `Math.max(ground + .5, slice * 2)` (`app.js:81`). Separately, the renderer maps normalized world coordinates directly to textures (`render.js:15,17`), although grid nodes lie at endpoint coordinates; texture center coordinates should account for `(N - 1)` and the half texel. This further shifts the rendered fields relative to probes and interventions. Use one consistent sampling convention: interpolate at the declared position, or expose snapped sample coordinates and position the marker there; align texture coordinates to the numerical grid. Avoid presenting a below-ground sample as an above-ground marker.

4. **P2 — The map clips the domain on tall screens and cannot navigate to the hidden edges.** `render.js:37`, `app.js:56–57` fix the map extent to ±18 vertically and ±18 × aspect horizontally. At aspect < 0.889, part of the 32 km domain is outside the viewport. The mobile stage is intentionally tall (`index.html:11`); for a 390 × 844 viewport its interior is roughly 364 × 487, hiding several kilometers on each east/west edge. Wheel/pinch only modifies `camera.distance` (`app.js:62,65`) and pan returns immediately outside view 0 (`app.js:63`), while the map shader ignores that camera. Fit both dimensions initially and share a map center/zoom transform between renderer, projection, and picking, or at minimum fit the complete domain and disable irrelevant navigation hints.

5. **P2 — The fixed distance scale is quantitatively false.** `index.html:50` always displays “8 km”; its CSS width is 67 px on desktop and 35 px on mobile (`index.html:8,11`). It does not respond to camera zoom, perspective, map extent, or section width. At a 390 px-tall map, a 67 px bar spans about 6.18 km, not 8. Compute the bar from the actual orthographic transformation, and either define a ground-reference depth for perspective mode or hide the quantitative scale there.

6. **P2 — Saving in fly mode does not restore the saved camera.** `app.js:91` imports `camera.fly` and fly position, then calls `setView()`. `setView()` always turns fly off (`app.js:43`), so every fly-mode state reload becomes an orbit view at the old orbit target. This is reproducible using an ordinary application-generated state, without malformed data. Restore the selected view before applying validated camera state, then synchronize the fly button without reinitializing the saved fly pose.

7. **P2 — Probe history conflates altitude changes with weather evolution and has an incorrect time axis after timestep changes.** `setSlice()` (`app.js:45`) changes the live sample altitude without clearing or marking existing history. `drawChart()` (`app.js:74`) connects all samples using array index rather than their recorded `time`; after changing dt, 0.25-second and 12-second intervals receive equal widths. CSV preserves the row metadata, but the displayed line appears to be a continuous local time series. Clear/start a new series on altitude change (or mark changes), and position points by simulation timestamps with basic time/value labels.

## Additional graphics observation

`render.js:58–66` counts successful uploads/draws without checking WebGL error state. Texture allocation/draw errors often set GL error flags rather than throw, so the JS try/catch at `app.js:100` cannot detect those failures. Check initialization/allocation errors and context loss explicitly before reporting readiness; ordinary per-frame error polling is not necessary. Existing null-context, shader compile/link, and context-lost handlers are otherwise useful.

## Verification limits

No source edits or redundant syntax tests were performed. Review was against the source line numbers at inspection time; rebuilding or ongoing edits may move lines. Most useful targeted browser checks: malformed optional effects import; ordinary fly-state roundtrip; section vectors at two different probe z values; portrait map edge reachability; probe selected altitude versus sampled layer; zoom and scale consistency.

## Scoped re-review after corrections

The optional effects/camera allowlist, validation before commit, bounded ordered history timestamps, sectional x/y vector sampling, snapped probe readouts/CSV/marker, grid-centered GPU coordinates, shared map transform, timestamp chart x axis, and allocation error check address the primary original code paths. Remaining concrete issues:

1. **P2 — Valid interactive fly states can fail their own import validation.** `app.js:55` sets `flyPitch = -camera.pitch`, while orbit permits `pitch = 1.5` (`app.js:65`) and import rejects `flyPitch < -1.45` (`app.js:104`). Orbit upward to maximum, enable fly, save, load: import rejects its own exported state. Likewise, fly entry copies an orbit eye that can exceed ±50 (`distance` permits 90), while import rejects all flyPos coordinates outside ±50 (`app.js:105`); fly wheel motion at line 68 is also unbounded. A focused execution of the actual validator confirmed “Invalid camera flyPitch” for the maximum-pitch transition and “Invalid camera position” for distance 90/pitch 0.8 (eye approximately `[34.36,67.86,52.45]`). Make interactive camera limits and the saved-state schema agree without silently changing a restored pose.

2. **P2 — Restored fly mode can retain a painting tool, breaking fly controls.** `app.js:114` restores `camera.fly` and its button but leaves `tool` unchanged. Save while flying, select Heat, then load the fly state: the camera is flying but subsequent dragging routes through painting because pointer handling branches on `tool === 'orbit'` (`app.js:64–65`). Synchronize the interaction tool to orbit when restoring a fly camera.

3. **P2 — Diagnostic map fields are painted outside the simulation domain.** `render.js:41` assigns `terrainT` for the surrounding sea outside ±16. The following map branch at line 42 treats every finite terrain hit as a valid field sample, including that sea. Texture clamp-to-edge then repeats boundary temperature, humidity, etc. across outside-domain areas revealed by the newly fitted/zoomable map. Require the map sample's x/z to be inside ±16 before applying field colors, cloud/rain totals, or diagnostic grid; render outside-domain space as neutral scenery. This prevents the expanded map from presenting fabricated spatial coverage.

4. **P3 — Map altitude caption becomes stale after changing the number of layers.** `app.js:42` changes layers then calls `syncUI()`/`updateStats()`. These update the slice outputs but not `viewCaption`; only `setView()` and `setSlice()` refresh that caption. With Map active, change 12 layers to 8 at requested 2.5 km: actual sample and output become 2.57 km while the map caption remains 2.73 km. Update that caption wherever the snapped altitude is refreshed.

No application edits or UI syntax reruns were performed during this re-review. The two camera-bound rejection cases above used the actual extracted validation function; remaining findings are code-path analysis awaiting the parent's browser checks.

## Final scoped closure

Confirmed from the final source that all four residual findings above are resolved:

- `app.js:55,68` clamp fly entry and wheel movement to positions accepted by import, and clamp entry pitch to ±1.45.
- `app.js:114` selects the orbit interaction tool when restoring a fly camera, while retaining the restored pose.
- `render.js:42` restricts map diagnostic sampling to the simulation's ±16 x/z domain.
- `app.js:79` refreshes the map altitude caption alongside the actual snapped sample altitude, including after layer changes.

No unresolved findings remain within the requested review scope. This closure is source verification; the parent separately reports successful real-browser movement/pose roundtrip and rejected-import preservation checks. No broader review or repeated tests were performed.
