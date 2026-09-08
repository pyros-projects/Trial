# Falling-Sand Alchemy Sandbox — Validation Report

Artifact: `index.html` (single self-contained file, no build, no external assets/services)
Tester: agentic, using `agent-browser` (Chrome/CDP). Primary sessions run against `file://` directly.
Note: another agent process on this machine intermittently navigated/closed browser sessions during
testing; affected shots were retaken via in-page `canvas.toDataURL()` capture, which is immune to tab
switching. All behavioral results below were re-verified after the final code state.

Legend: ✅ pass · ❌ fail (fixed unless noted) · ⚠️ partial/limited

## Boot & runtime

| Check | Result | Evidence |
|---|---|---|
| Opens via `file://` directly, no server needed | ✅ | 01-boot-file.png, 04/05-boot screenshots |
| No console errors at boot & during long runs | ✅ (after fixes) | `window.onerror` hook = 0 entries; `agent-browser errors` clean |
| HUD shows fps, grid, active cells/chunks, Σ materials, avg T, rx/s, seed, tool, material, speed, viz, pause state, top material counts | ✅ | visible in all screenshots |
| Default scene produces immediate motion + interactions | ✅ | sand/water emitters raining, oil lamp burning at boot (05-boot-fixed.png) |
| No external network requests | ✅ | `agent-browser network requests`: only the local `file://` document; no sub-resource fetches |

### Bugs found & fixed during validation
1. **`gxv is not defined`** — gravity vector component never declared; any gas/fire cell crashed the frame
   (black canvas, frozen HUD). Fixed by declaring `gxv` and centralizing `setGravity()`.
2. **rAF starvation in headless/throttled tabs** — added a watchdog interval that pumps the loop when rAF
   is starved >280 ms, plus a 1-px readback once per second so accelerated-headless captures composite.
   No effect on normal browsers.
3. **Liquids didn't burn in place** — igniting oil/gas converted cells into mobile fire that floated away.
   Unified the burning-flag mechanism: any fuel (wood, plant, oil, gas) burns in place and is consumed.
4. **Gunpowder never detonated as a chain** (detonating grain survived and re-fused forever → 1900 °C runaway).
   Detonating grain is now consumed (→fire/smoke); chain verified: 840/840 cells consumed, nearby stone
   cratered, temp returns to ambient.
5. **`const` mutation crash** (`k *= .35` on ice-water interface) froze rendering the moment ice touched
   water. Fixed; loop also hardened with try/catch so render errors can never kill the sim display.
6. **Lake froze solid in seconds / ice cubes vanished in ~2 s** — added buried-cell ambient insulation
   (≥2 non-empty neighbors ⇒ 0.15× drift), ice↔water interface damping (×0.35), lower ambient drift for
   solids. Frozen Lake now quasi-stable (ice 238→243 after 10 s) and lab ice lasts realistically.
7. **Lava quenched instantly on any contact** — replaced raw symmetric exchange with a per-cell total
   flux budget (thermal-mass stand-in; molten materials budget 1.2°/frame). Lava persists ~10 s in the
   volcano crater, still flash-boils water.

## Materials & interactions (cross-system, persistent state)

| Check | Result | Measured |
|---|---|---|
| Paint liquids/solids/powders via continuous real pointer drag | ✅ | mouse drag painted 2087 water cells along the stroke; interpolation keeps strokes continuous at speed |
| Lava + water → steam + stone (persistent) | ✅ | 160 lava → 0, stone 800→960 (mass conserved), steam spike 36 then condenses back to water |
| Fire + fuel (oil) | ✅ | oil block ignites, burns in place, → smoke; fire 378 cells at peak, oil consumed over time |
| Electricity through metal | ✅ | spark emitter → 120-cell wire: far end energized (10/10 probe cells), far end heated 22→40.1 °C; lab circuit carries 126-140 energized cells |
| Acid differential corrosion | ✅ | wood 80→68 eaten; metal 80→80 intact; wall 280→280 untouched |
| Plant growth near water | ✅ | 20 → 63 plants in 5.4 s (absorbs pond water; saltwater inhibits growth) |
| Salt + water → saltwater | ✅ | salt 20→0, saltwater 0→20 |
| Salt melts ice | ✅ | ice 80→0 after salt contact; melt-water pooled |
| Heat tool melts ice | ✅ | ice 180→76 under 1.2 s of tool hold |
| Cool tool freezes water | ✅ | 20 water cells froze; avg temp 22→12.1 °C |
| Wind tool | ✅ | sand bbox [72,127] → [0,127] after wind stroke (brushVel=3) |
| Explosion tool + chain reaction | ✅ | crater 19 rows deep at center, 77-87 stone cells of a nearby block destroyed by chained detonations |
| Density displacement | ✅ | oil floats on water, sand sinks & settles below (10-density.png) |
| Gas rise / steam cycle | ✅ | steam rises, condenses back to water when cool (boil→condense samples in lava test) |
| Gravity direction (down/up/left/right) | ✅ | gravity=up: sand block fell from y20-30 up to ceiling y4-13 |

## Controls

| Check | Result | Measured |
|---|---|---|
| Pause freezes state | ✅ | frames held at 4843 for 1.5 s; PAUSED badge shows |
| Single step | ✅ | 4843 → 4844 → 4845 (exactly +1 per press) |
| Clear | ✅ | all cells → Air |
| Reset | ✅ | default scene restored (stone 1159, sand, wood 573, emitters 14) |
| Speed slider | ✅ | speed 4 → 244 steps/s; speed 0.25 → 15 steps/s (quarter rate confirmed) |
| Substeps, reaction rate, heat rate, mobility, diffusion, fire intensity, explosion strength, ambient | ✅ present & wired | ambient=-25 drives frozen lake; reactionRate=1.2 set by ecosystem preset; heatRate scales flux cap |
| Resolution change | ✅ | 200×130 ↔ 320×207 with content-preserving resample |
| Brush radius/shape/amount/heat/wind power/spray | ✅ present | circle & square, radius 1-40 (also `[`/`]`) |
| Eyedropper | ✅ | sampled Water from a pool via real click (tool + right-click) |
| Fill tool (enclosed areas) | ✅ | sealed 38×38 box: 1444/1444 cells filled; split regions fill only the clicked chamber (verified: deck splits a box into 722+722) |

## Visualization modes (reflect live per-cell state)

All 8 modes exercised on a live volcano/lab scene: normal, temperature, velocity, density, charge,
fuel, corrosion, update-order. ✅
- temperature: lava chamber glows white-hot, heat gradient through rock (12-viz-temperature.png)
- charge: spark packet + decaying charge trail along the wire (15-lab-charge.png)
- update-order: per-chunk scan banding visible, sleeping chunks dark (12-viz-updateorder.png)
- fuel/corrosion/density/velocity rendered and switchable via select or `V` key

## Presets (all deterministic by seed)

All 11 load without errors (sandbox, volcano, ocean, burning building, electrical lab, acid factory,
steam engine, frozen lake, plant ecosystem, fireworks, stress test). ✅
- Volcano: gunpowder vent charge erupts; lava glows in crater ~10 s then crusts to stone (17-volcano*.png)
- Fireworks: spark emitter → collar → ground fuse → 5 tube chain; 236 powder → 0 with fire/smoke plumes (13-fireworks-mid.png)
- Steam engine: firebox boils boiler water (steam 1-7 cells continuously), steam rises the riser,
  condenses on the ice condenser and returns (water cycle measured)
- Burning building: structure burns, spreads across floors, gunpowder barrel detonates
- Stress test: 60 fps at 200 cols and 320×207 (66k cells) with 4 emitters running (14-stress.png)

## State persistence

| Check | Result |
|---|---|
| Save to file (button) | ✅ download fired (blob >1 KB, `.sim.json`); 383 KB at 200×130 with RLE type + quantized temp/life/fuel/corrosion/velocity/flags |
| Load from file (real `<input type=file>` + FileReader path) | ✅ wood 662 exact match; fire/smoke counts only differ because the sim kept running after load |
| Serialize → clear → deserialize round-trip | ✅ exact count match |
| Local autosave | ✅ written to localStorage every 12 s while active (385 KB, valid schema) |
| Autosave restore after full page reload | ✅ toast offers Restore; restore brought back the exact burning scene (wood 662) |
| Deterministic seeds | ✅ same seed → same scene (all presets seeded; seed input + 🎲 reroll) |
| PNG export | ✅ `pngBtn` → canvas toBlob → download (blob + anchor verified) |

## Responsive / input

| Check | Result |
|---|---|
| 1280×800 desktop | ✅ grid auto-adapts (200×184), panels docked (22-desktop-1280.png) |
| 390×844 mobile | ✅ grid resamples to 200×217, side panels become drawers, 🧪/⚙️ toggle buttons open/close them (23-mobile-390.png) |
| High-DPI | ✅ canvas backing store scales with devicePixelRatio at load/resize |
| Pointer capture & continuous strokes | ✅ line-interpolated painting; per-frame tool refresh for heat/cool/wind |
| Keyboard shortcuts | ✅ Space, `.`, C, R, E/B/H/W/X/F, `[`/`]`, 1-0, V |

## Known limitations
- Audio not applicable (no sound design in this artifact; nothing was claimed as "heard").
- Real touch hardware wasn't available in the sandbox harness; touch is handled through the same
  Pointer Events path as mouse (pointerdown/move/up + `touch-action:none`), verified with pointer events.
- In accelerated-headless capture, canvas compositing needs the built-in 1-px/s readback shim
  (harmless; also fixes video capture there).
- Volcano lava fully crusts ~10-12 s after the eruption (thermal-mass approximation); pour more lava
  or raise "Heat transfer rate"=0 hot-spot to keep it molten longer.
