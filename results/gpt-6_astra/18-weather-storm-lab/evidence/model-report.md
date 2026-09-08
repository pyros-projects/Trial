# Atmosphere model verification

Implemented `evidence/model.js` as a dependency-free browser script with the requested `Atmosphere` and `DEFAULT_PARAMS` globals and CommonJS exports. The script is ready for verbatim embedding into the single HTML application.

## Integration contract

- `resize(n,l)` returns a **new** atmosphere. Assign `sim = sim.resize(n,l)`. It preserves time, steps, parameters, preset, seed, RNG state, and accumulated precipitation. Horizontal nearest-neighbor and vertical linear resampling preserve the physical domain.
- Simulation field buffers swap during each internal integration. Read `sim.t`, `sim.c`, etc. again after stepping; do not cache their array references across a step.
- Indexing is `x+n*(z+n*y)` with absolute atmospheric altitude. World coordinates span x/z −16…16 and y 0…12. Physical extent is 32×32×6 km.
- `sample().pressure` and column pressure are hydrostatic pressure plus anomaly in hPa. `stats().pressure` is mean pressure **anomaly** in hPa. `column().altitude` is km.
- `stats().humidity` is mean relative humidity in percent; `cloudCover` is the fraction of columns whose vertically normalized integrated cloud exceeds 0.45 g/kg world-height units. Cloud/rain statistics are volume means in g/kg; `precipTotal` is domain-mean accumulated ground precipitation in mm. Wind/updraft are m/s; vorticity is s⁻¹.
- `cfl` is the actual maximum last-step explicit stability budget: advective Courant terms, rain terminal velocity, diffusion contribution, and reduced-speed pressure waves. Internal steps use a maximum 0.8 budget. `substeps` reports the actual subdivision count, including adaptive splits.
- State exports include schema/version, all eight fields, terrain, moisture, surface classes, parameters, RNG/seed, preset, time, steps, accumulated precipitation, and last-step diagnostic metadata. Import validates every required field before allocating the replacement instance. Unknown parameters, invalid types/ranges, unsupported grids, and incomplete arrays throw.
- Brush effects are immediately inspectable while paused. Physical-field brushes scale by elapsed real time (clamped to 0…1 seconds per call); material surface painting is discrete. Brushes do not advance simulated time.

## Numerical behavior

The solver combines first-order upwind scalar/velocity transport, explicit spatial diffusion, approximate pressure-gradient acceleration and divergence response, rotational acceleration, buoyancy, dry adiabatic cooling, terrain uplift/drag, surface heating, vapor sources, condensation/evaporation with latent heat, cloud-to-rain conversion, and donor-flux rain/snow sedimentation. Condensate transfers conserve local water between phases. Rain flux across the freezing level uses the donor cell's terminal velocity. Surface moisture is replenished over water and slowly depleted over land. Saturation and buoyancy are deliberately simple parameterizations.

The ten presets initialize distinct temperature, humidity, cloud geometry, wind/rotation, and thermal forcing. The default is a developed, isolated supercell over a rugged island with ocean edges, a ridge, forest, a river, and a small city. Ongoing storms arise from evolved fields and continuous surface forcing; initial cloud shapes are never reinserted during stepping.

This is a bounded educational solver, not an operational forecast. First-order transport is numerically diffusive; horizontal boundaries are periodic, vertical boundaries closed for scalar transport, and ground interactions use a coarse terrain mask. There is no full compressible atmosphere, terrain-following mesh, separate ice phase, radiative transfer, or exact global water/energy conservation under environmental forcing and safety bounds. Extreme stress settings can reach explicit clamps (65 m/s updraft and high condensate) while remaining finite.

## Executed checks

Command: `node evidence/model-tests.cjs` under Node v25.8.1. Final run: **14 checks passed**, exit status 0.

The suite checks deterministic initial/evolved fields; all principal fields evolving; paused/time-scaled local brushes; delayed cloud/rain response to moisture and heat; wind/rotation/terrain coupling; monotonic ground precipitation; donor-flux mass conservation across freezing; actual adaptive subdivision and exact elapsed time; a 1,943.25-second extreme stress run; a 1,080-second supercell run; ten distinct presets and freezing snow temperatures; exact next-step state restoration; malformed import rejection; resampling; and every brush type.

Observed final default 32×32×12 runtime: **6.95 ms per 3-second model step**, measured over ten steps after three warmups. Rendering and serialization are excluded. A supplemental six-step maximum-resolution stress probe (64×64×24, nine adaptive subdivisions) measured roughly **167 ms per step**; the UI should limit work per frame when using that extreme configuration.

After 1,080 seconds at 24×24×8, the default supercell had 10.1% cloud cover, 0.0383 g/kg mean cloud, 0.00944 g/kg mean rain, 12.90 m/s maximum updraft, and 0.0393 mm accumulated mean ground precipitation. All fields and statistics were finite. The long stress run also remained finite with actual last-step CFL 0.8 and three internal subdivisions.

Evidence:

- `evidence/logs/model-tests-red.log`: expected initial assertion failure because the model was missing.
- `evidence/logs/model-tests-first.log`: early rain-evaporation issue, diagnosed and corrected with fractional rain evaporation.
- `evidence/logs/model-tests-second.log`: initial 13 passing behavioral checks.
- `evidence/logs/model-tests-sedimentation-red.log`: extra freezing-level conservation test detected a donor fall-speed mismatch (0.001369 g/kg column-sum error).
- `evidence/logs/model-tests-green.log`: final 14 passing checks after donor-flux correction.

Browser integration, WebGL rendering, and UI interaction validation belong to the parent implementation and are not claimed here.

## Follow-up review fixes and storm retention

This section supersedes the earlier 14-check count, default-run measurements, and supercell behavior measurements above. The final command `node evidence/model-tests.cjs` passed **17 checks**, exit status 0; `node --check evidence/model.js` also exited 0. Full final evidence is `evidence/logs/model-tests-final.log`.

Two reviewed defects were reproduced with failing regressions and corrected:

1. Soil now receives the actual per-column precipitation flux at the first voxel above terrain. It no longer samples underground `y=0` rain. The conversion is explicit: `outgoing g/kg × layer depth m × 1.08 kg/m³ / 1000` gives rainfall mm; rainfall divided by a stylized 100 mm available-water reservoir increases the dimensionless 0…1 soil-moisture fraction. The controlled raised-terrain test produced **0.018899995 mm** rainfall and increased wet soil from **0.5 to 0.5001890063** in 0.25 seconds, while its dry twin stayed at **0.5**. It also verifies the rainfall-to-reservoir unit conversion. Failure evidence: `model-review-soil-red.log`.
2. Both constructor and `fromState()` require a primitive string preset identifier before dictionary membership checks. Arrays, boxed strings, objects with a coercing `toString()`, null, and numbers are rejected. The malformed JSON `preset:["supercell"]` is explicitly covered. Failure evidence: `model-review-preset-red.log`.

The browser-observed early supercell collapse was reproduced by a new retention regression: the earlier solver fell to 4.1% column cover at 210 seconds. The final preset uses **humidity 94%** (overriding the unchanged exported `DEFAULT_PARAMS.humidity:82`), initial cloud amplitude **2.6** instead of 2.2, and **10% wider** initial supercell cloud masses. Thermal, wind, lapse, rotation, and other supercell controls remain unchanged.

Continued moisture support is physical field forcing: a deep moist inflow region is surrounded by drier air, and the environmental vapor relaxation uses this same spatial humidity profile. The inflow envelope is centered near world x=−3,z=0 with horizontal scales 10 and 8 units; its normalized envelope modulates the outside-air dryness and humidity decrease with altitude. Surface evaporation now weakens toward zero as the receiving air approaches saturation. The consistent vertical humidity target and evaporation-deficit correction apply to the general solver; the horizontal moist inflow region is specific to the supercell preset. No initial cloud is inserted again during evolution, and no extra state fields or schema changes were required.

Final default 32×32×12 trajectory using 3-second steps:

| Simulated time | Cloud cover | Mean cloud g/kg | Peak cloud g/kg | Maximum updraft m/s | Mean rain g/kg |
|---|---:|---:|---:|---:|---:|
| 210 s | 13.87% | 0.05329 | 2.684 | 5.80 | 0.01471 |
| 420 s | 14.45% | 0.07934 | 4.034 | 12.85 | 0.03215 |
| 630 s | 18.07% | 0.14447 | 6.367 | 20.90 | 0.07095 |
| 1,080 s | 37.89% | 0.19867 | 6.166 | 19.04 | 0.16839 |

The retention regression checks substantial developed cloud volume, a broad cloud footprint, open terrain, and convective flow throughout this interval. The 1,943.25-second stress run remained finite with actual final CFL 0.8 and three subdivisions. Exact next-step state restoration and all prior meaningful checks still pass. The final brief default benchmark measured **9.41 ms/step**, excluding rendering and serialization.

Additional logs: `model-review-fixes-green.log` records the 16-check review-fix stage; `model-storm-retention-red.log` records the reproduced early collapse; `model-storm-retention-green.log` records the tuned trajectory; `model-tests-final.log` is the authoritative complete final suite. Intermediate moisture-tuning logs preserve why the localized inflow was chosen: uniformly humid air eventually produced widespread cloud, so the final implementation preserves dry surroundings.

## Condensation threshold semantics — final verification

`params.condensation` now controls the relative-humidity threshold for cloud formation, matching the UI and requirements: condensation excess is `vapor - saturation × params.condensation`. The conversion rate is fixed at 0.07 s⁻¹. Existing cloud evaporates only when vapor is below actual saturation; a threshold greater than 1 does not make supersaturated cloud evaporate merely because the formation threshold has not been reached. The separate small cloud-mixing loss remains active.

Two regressions failed against the previous rate-multiplier implementation and pass after correction:

- With identical 110% RH air and initially zero cloud/rain, threshold 0.8 produces **0.0725445077 g/kg** cloud after 0.25 seconds; threshold 1.2 produces **zero** cloud. The lower threshold transfers vapor to liquid and releases latent heat.
- With initial cloud 1 g/kg and threshold 1.2, 110% RH leaves **0.9999799728 g/kg** cloud (only the weak mixing loss), while 90% RH evaporates cloud to **0.9912904501 g/kg**.

Default threshold 1 behavior is preserved exactly. The SHA-256 of the entire serialized default state after 30 steps matches before and after the change: `e786ae6ddc2b063a9bf7f6700a2e6e6ecd80c41ce2b6896fd9edbe009ba5228e`. The full suite also reproduces the same default storm trajectory through 1,080 seconds shown in the preceding table.

Final verification now totals **19 checks passed**, exit status 0, from `node evidence/model-tests.cjs`; `node --check evidence/model.js` also exited 0. The 1,943.25-second stress case remains finite with final CFL 0.8 and three subdivisions. Its intentionally high threshold 1.3 allows greater supersaturation than the default. The brief final default runtime measurement was **8.67 ms/step**.

The authoritative final suite log is now `evidence/logs/model-tests-threshold-final.log`, superseding earlier suite logs. Focused red/green and exact-default-preservation evidence is in `model-condensation-threshold-red.log`, `model-threshold-evaporation-red.log`, `model-condensation-threshold-green.log`, and `model-default-threshold-before.log` / `model-default-threshold-after.log` within `evidence/logs/`.
