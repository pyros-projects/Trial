# Validation — Falling-Sand Alchemy Sandbox

- **Artifact:** `../index.html`, one self-contained file of 144,024 bytes.
  - sha256 `7859ad5277c41c9a23e23c2f5397db2af8e6122ddaef8acfe9b1c96c24ecd47f` (`logs/final-build.sha256`); last modified 20:41:39.
  - Every log in `logs/` was produced afterwards, against this exact file.
- **Date:** 2026-09-29.
- **Browser tooling:** `agent-browser` 0.31.1, as the task required.
  - I read the installed skill stub, the version-matched `agent-browser skills get core` (and `--full`), and the exploratory-testing workflow `agent-browser skills get dogfood`.
  - Browser: Google Chrome 143, headless, driven by agent-browser, on Linux (WSL2).
  - `agent-browser doctor --offline --quick`: 15 pass, 1 warn (stale state files), 0 fail.
- **Direct-file delivery:** every run opened `file:///…/index.html` directly. No HTTP server was used or needed.

## Method

- **Pointer input** is real CDP mouse input via `agent-browser mouse move / down / up`. `lib.sh` wraps it in three helpers:
  - `drag` presses at one grid cell, jumps through waypoints and releases;
  - `hold` presses and holds in place;
  - `click_at` presses and releases.
- Grid cells map to screen points through `alchemy.toScreen()`.
- **Keyboard** uses `agent-browser press`: app shortcuts, plus Home/End/arrow keys on focused sliders.
- **Controls** are driven with `click` on accessibility-snapshot refs (`btn`, which reports "button not clicked" on failure; no run logged any), and with `select`, `fill`, `upload` and `download`.
- **State inspection** uses `window.alchemy`, a small read-only hook the app exposes: `grid`, `cell`, `counts`, `stats`, `hash`, `find`, `sumWhere`, `toScreen`. It never changes the simulation; every change in these tests comes from UI input.
- **Clean starts.** Each scenario begins with `fresh_open`: open, press **Delete autosave**, reload. This way settings restored from an earlier run can't leak in.
- **Records.** Raw output is in `logs/`, screenshots in `screenshots/`, and downloaded or crafted files in `downloads/`.

```bash
cd evidence
./scenario-B.sh   # continuity of fast strokes
./scenario-C.sh   # painting + cross-system interactions
./scenario-D.sh && ./scenario-D2.sh   # tools, salt, plants, gas/oil, heat/cool, wind, fill, all views
./scenario-E.sh   # pause/step/reset/clear, seeds, save/load, bad files, PNG, autosave, resize, gravity, speed, keys
./scenario-F.sh   # 390x844 @3x
./scenario-G.sh   # world-physics sliders + brush settings
./scenario-P.sh > logs/presets.log   # every preset + stats + lab lamp
./scenario-H.sh   # regression checks for fixed issues (lake ice, fireworks timing, steam loop)
```

`logs/scenario-A.log` (first load) and `logs/perf.log` were produced with the same `lib.sh` helpers; the commands are recorded in this file.

## Results

| # | Check | Result | Evidence |
|---|---|---|---|
| A | **First load via `file:`, no autosave present.** No page errors and no console output. The only network request is the document; there are no sub-resource entries. The built file has 0 URLs, `fetch`, XHR, `<link>`, `src=` or `import`. It starts moving at once: volcano scene, tick 184, 12,428 active cells, 330 reactions. | **PASS** | `logs/scenario-A.log`, `A1-first-load-desktop.png` |
| B | **Continuous input.** Single-cell brush, sim paused, press/one move/release. A 270-cell horizontal jump painted **271 of 271** cells; a 250-column diagonal jump left **0 of 251** columns empty. | **PASS** | `logs/scenario-B.log`, `B1-continuous-strokes-paused.png` |
| C0 | Wall tool drags built the test containers (1,567 wall cells) | **PASS** | `logs/scenario-C.log`, `C0-walls-drawn.png` |
| C1 | **Lava + water.** 1 s after pouring: steam 725, stone 154. After 9 s, 288 stone cells remain as a crust in the basin (persistent). | **PASS** | `C1a-lava-hits-water.png`, `C5-after-all.png` |
| C2 | **Fire + fuel.** Fire painted onto a 1,482-cell wood stack burned it down to 837 ash cells, which remain. | **PASS** | `C2a-wood-ignites.png` |
| C3 | **Electricity through metal.** A spark painted on the wire end charged 66 wire cells, wavefront at x=250, within 0.4 s. The explosive at the far end then detonated (199 blasts; each explosive cell detonates). | **PASS** | `C3a-charge-view.png`, `C3b-tnt-detonated.png` |
| C4 | **Acid attacks materials selectively.** In 6 s the wood block dropped 503 → 370 cells. The metal block lost no cells; its mean integrity fell to 212/220, with 63 cells damaged. | **PASS** | `C4a-corrosion-view.png` |
| D1 | **Salt dissolves in water.** Salt 177 → 119 and brine 264 → 322 over 6 s. Surplus salt settles in saturated brine. | **PASS** | `logs/scenario-D.log`, `D1-salt-dissolves.png` |
| D2 | **Plants grow where water is.** Seeds on the water surface grew 9 → 283 cells while bay water fell 440 → 201 (drunk). Dry control seeds stayed at 2 local cells. | **PASS** (D2b) | `logs/scenario-D2.log`, `D2b-plant-growth.png` |
| D3 | **Heat and cool tools.** Heat melted ice (196 → 98 in 4 s). Heat on a metal block produced 100 molten-metal cells mid-hold; they dripped and re-solidified. Cool froze bay water (ice 98 → 258). | **PASS** (D3b) | `D3a-heat-tool-temperature-view.png`, `D3c-metal-melting-live.png` |
| D4 | Pick/eyedropper selected **Metal** from the grid | **PASS** | `logs/scenario-D.log` |
| D5 | **Density and gas.** Oil floats on water (mean y 221.8 vs 229.3). Gas rose from mean y 62.8 to 5.6 in 2 s. Fire applied to the cloud burned it 507 → 29 cells (fire 20, smoke 163). | **PASS** (D5b) | `D5-gas-oil.png`, `D5b-gas-ignited.png` |
| D6 | **Wind.** A 97-grain falling sand cloud got mean vx 6.8; the whole-sand mean x moved 160.0 → 160.8, i.e. the cloud drifted ≈15 cells right. A walled pile only moves at its exposed surface (+0.5 mean x). | **PASS** (D6c) | `D6c-wind-cloud.png`, `D6b-wind.png` |
| D7 | Explode tool: blast counter 0 → 1 | **PASS** | `D7-explosion.png` |
| D8 | Fill tool filled a closed wall box with exactly its 1,131 interior cells | **PASS** | `D8-fill.png` |
| D9 | All 8 visualization modes switch, with legends: normal, temperature, movement/velocity, density, electrical charge, remaining fuel, corrosion/reaction activity, update order. Each reads the live per-cell arrays (see note 1). | **PASS** | `D9-view-*.png` |
| E1 | **Pause.** The tick stayed at 127 over 1.5 s; the HUD showed "⏸ PAUSED". Space resumes. | **PASS** | `logs/scenario-E.log` |
| E2 | **Single step.** The Step button went 127 → 128 and the `.` key 128 → 129. | **PASS** | same |
| E3 | **Deterministic seeds.** Two resets, each followed by 40 steps, gave identical hashes (`7420d0bc`). Seed 4242 builds a different scene (`7bda4037`). Re-entering 1337 and 4242 reproduces `3df5548d` and `7bda4037`. | **PASS** | same, `E3b-seed-4242.png` |
| E4 | **Clear and Reset.** Clear left only air (78,876 cells). Reset restored the exact initial hash `3df5548d`. | **PASS** | same |
| E5 | **Save and load.** Save produced a 134,895-byte gzip+base64 JSON file (313×252, tick 25). After clearing and repainting, Load restored hash `6af7be3b` and tick 25; a probed cell is identical in every field. | **PASS** | `downloads/state.json` |
| E6 | **Error states.** Wrong-format, non-JSON and truncated files each gave a specific error toast, with the state hash unchanged. | **PASS** | `E6-load-error-toast.png` |
| E7 | **PNG export.** Valid PNG, 940×757 (the canvas area at DPR 1), 119 KB. | **PASS** | `downloads/view.png` |
| E8 | **Local autosave.** "Autosaved … 254 KB" every 10 s. After a reload: "Restored autosave from …" with the same scene. | **PASS** | `E8-autosave-restored.png` |
| E9 | **Browser resize.** 1280×800 → 1000×700 changed the grid 313×252 → 220×219, keeping the bottom-anchored content. No horizontal overflow (1000/1000). | **PASS** | `E9-resized-1000x700.png` |
| E10 | **Settings.** Resolution select: 5 px → 188×151, 3 px → 313×252. Gravity ↑: sand mean y 240.6 → 7.5. Speed 2× → 120 tick/s, 0.1× → 5.9 tick/s. | **PASS** | `E10-gravity-up.png` |
| E11 | **Shortcuts.** V cycles views, `3` selects Oil, `h` selects Heat, `?` opens help, `g` cycles gravity through all 5 modes and back. | **PASS** | `E11-help.png` |
| F | **390×844 at 3× DPR.** No horizontal overflow; the canvas backing store is 1170×1368 px for a 130×152 grid. Real mouse strokes painted 2,195 water cells. A condensed HUD and a scrollable control panel sit below the canvas. 56 fps. | **PASS** | `logs/scenario-F.log`, `F1-mobile-painting.png`, `F3-mobile-building.png`, `10-mobile-390x844.png` |
| F-touch | Real touch was not exercised: agent-browser's `tap`/`swipe` only work with its iOS provider. A synthetic `PointerEvent({pointerType:'touch'})` stroke dispatched from page JS painted 865 sand cells. | **PARTIAL (real touch BLOCKED)** | `logs/scenario-F.log` |
| G1 | Ambient slider: open air trends to −41.5 °C within 4 s at −60, and to 51.8 °C at +80 | **PASS** | `logs/scenario-G.log` |
| G2 | Heat-transfer slider: a cold bar beside a 2,500 °C bar stayed at 20.75 °C at 0×, then reached 70.7 °C within 3 s at 1× | **PASS** | same |
| G3 | Reaction-rate slider: at 0× salt sits on water with 0 brine; at 1× 606 brine cells form | **PASS** | same |
| G4 | **Brush settings.** Shapes are exact at radius 7, amount 100%, spray 0: square 169 = 13×13, diamond +85. Velocity 10 "right" gave painted water vx ≈ 8.9–11. Custom temperature painted metal at ≈2,460 °C. | **PASS** | `G4-brush-shapes.png` |
| P | **All 9 presets** ran for 8 s each, with 0 errors at 54–60 fps and 60 tick/s. The electrical-lab lamp, fed only through the water bridge, was energized in 17 of 25 samples over 5 s. | **PASS** | `logs/presets.log`, `P-*.png`, `P-electrical-lab-charge-view.png` |
| H | **Regression checks for issues fixed during development** (final build).<br>• Frozen lake: ice sheet 1,255 → 827 cells in 30 s but still spans the lake; melting is concentrated at the campfire, road salt and hot spring.<br>• Fireworks: rocket stacks launch in sequence over ≈12 s, with the TNT finale at ≈8 s.<br>• Steam engine: boiler water holds at ≈97.6 °C mean, the riser carries 1–24 steam cells, and the return pipe carries 5–11 condensate cells. A modest but continuous loop. | **PASS** | `logs/scenario-H.log`, `H1-lake-31s.png`, `H2-fireworks-4s.png`, `H3-steam-engine-temp-view.png` |
| — | Page errors across all logged runs | **0** | each log ends with `errors:` (empty) |
| — | Audio | **N/A** (the app has no audio) | — |

Note 1, on what each diagnostic view reads:
- **Temperature:** `temp`, with air dimmed.
- **Velocity:** `vx`/`vy` hue and brightness, plus the per-cell moved-this-tick stamp.
- **Density:** each cell's material density.
- **Charge:** `charge`.
- **Fuel:** `fuel`/initial fuel, with burning cells flagged.
- **Corrosion/activity:** `hp` loss (red), `act` reaction-activity decay (green), acid strength (blue).
- **Update order:** the real processing order `order[]` from the last tick's first sweep. Sleeping chunks show grey and awake 16×16 chunks are outlined.

The HUD probe line shows the raw values of the hovered cell.

## Performance

Measured in headless Chrome on this WSL2 machine (`logs/presets.log`, `logs/perf.log`). Other hardware will differ.

| Setup | Grid | Active cells | FPS | Sim tick/s | Cost |
|---|---|---|---|---|---|
| All presets at default 3 px | 313×252 (78.9k cells) | 2.3k–12.7k (stress: 29.7k) | 54–60 | 60 | sim 2–5 ms, draw ≈2 ms per tick/frame (stress: sim 8.2 ms) |
| Dense stress test, 3 px | 313×252 | 27k–37k | 41 at start, 54–58 after | 58–60 | sweep 5–8.6 ms, heat 1.4 ms |
| Dense stress test, Fine 2 px | 470×378 (177.7k cells) | 70k–80k | 25–31 | 26–31 (see note 2) | sweep 15–22 ms, heat 3 ms, draw 4.4 ms |
| Phone 390×844 @3× | 130×152 | — | 56–58 | 60 | — |

Note 2: when one frame's simulation exceeds its 13 ms budget, the simulation slows below real time rather than freezing input or rendering. The HUD shows fps and tick/s side by side.

The optimisations behind these numbers:
- typed-array structure-of-arrays storage;
- 16×16 chunk sleeping and wake-on-change (active-region tracking);
- a fast path for liquid cells buried in their own liquid;
- wavefront lists for electricity;
- a quarter-cost low-resolution bloom pass;
- the per-frame time budget.

## Problems found while testing, their fixes, and retests

1. **Clicking a preset scrolled the whole page and hid the header.** Cause: the hidden file input (`.sr`) was absolutely positioned with no positioned ancestor, so it overflowed the document. Fix: `aside.panel{position:relative}`. Retest: the header is intact in every later screenshot.
2. **Fireworks chain.**
   - Stacked rocket cells burst at ground level because they blocked each other. Fixed: a stack now lifts off together.
   - The shielded fuse stalled on air gaps. Fixed with deflagration: burning gunpowder or gas ignites its neighbours as it burns out.
   - Early embers skipped the chain ahead. Fixed: stars burn out mid-air.
   - Retest (H2): rockets launch in sequence over ≈12 s and the TNT finale fires at ≈8 s.
3. **Frozen lake melted in 12 s.**
   - Causes: every solid bled heat toward ambient even underground, and there was no latent heat.
   - Fixes: only open air exchanges heat with ambient; latent heat of fusion was added (ice/water pinned at 0 °C while 320 units are exchanged); realistic ground temperatures.
   - Retest (H1): the sheet persists; ice 1,255 → 827 in 30 s, melting at the campfire, salt and hot spring.
4. **The steam engine never reached a working cycle.** Four causes, each fixed:
   - Boiling discarded heat on failed rolls. Fixed: a conserved vaporisation accumulator (`F_BOIL`).
   - Collapsing bubbles lost their latent heat. Fixed: it is returned when steam condenses inside water.
   - Heat couldn't reach the bulk water. Fixed: buoyant thermal convection for liquids.
   - Air inside sealed vessels acted as a heat sink. Fixed: an "outdoor air" flood fill every 30 ticks, so only air connected to the border relaxes to ambient.
   - Retest (H3): steam rises through the insulated riser, condenses on the cryo fins, and condensate returns. The flux is modest: 1–24 steam cells in the riser at a time.
5. **Volcano lava froze at the vent.** Fixed with basalt-like rock conductivity, higher lava heat capacity and a caldera top. Retest: flows reach the forest (fire) and the sea (steam, stone crust, brine salt, fresh-water rain layered over brine).
6. **Lava under water formed no crust.** Added a quench reaction: contact flash-boils water and the melt pays latent plus sensible heat. Retest: C1 (288–373 persistent stone cells across runs).
7. **The boot-time autosave restore overwrote a user action.** An async race: a preset clicked during decompression was replaced. Fixed with a user-action epoch guard. Retest: every scenario starts clean.
8. **Preset buttons' accessible names included the icon glyph.** Added `aria-label`s.
9. **Electrical lab.**
   - The brine tank boiled away from Joule heating. Heating per pulse was reduced.
   - Water conductance of 0.35 was below the square-lattice bond-percolation threshold (0.5), so pulses died in water. Raised to 0.6; brine stays at 0.95.
   - The water fill overwrote an electrode. Build order fixed.
   - Retest: lamp lit in 17 of 25 samples.
10. **A truncated save said "Failed to fetch".** It now says "Cell data is corrupt or truncated (gzip)" (E6).
11. **Overload starved rendering.** Fine-resolution stress ran at 10 fps. A per-frame time budget plus the liquid fast path brought it to 25–36 fps.
12. **At 390 px the HUD covered ~40% of the canvas.** A condensed HUD carrying every required field now shows on narrow stages. The legend overflow and the toast/legend overlap were fixed too.

Some scenario steps that initially "failed" were harness mistakes, not app bugs:
- substring button matching (Fire vs Firework);
- keys sent to a focused button instead of a slider;
- the sim left paused by a debug step;
- measurement windows that missed the effect;
- settings leaking between runs through the autosave (fixed by `fresh_open`).

`scenario-D.sh` still contains three flawed probes, deliberately kept visible in `logs/scenario-D.log`; the corrected checks are D2b, D3b and D6c in `scenario-D2.sh`:
- "plant 3 → 3": seeds were painted in mid-air;
- "molten 0": the probe hit a cell the melt had already left;
- "airborneSand 0": the sand was measured after it landed.

## Known limitations

- **Real touch input: blocked** in this toolchain (no Chrome touch driver in agent-browser). Pointer Events cover touch by design, and the synthetic touch-type test passed.
- **Physics is a game model, not CFD:**
  - there is no pressure solver, so liquids don't equalise in U-tubes;
  - air is implicit, not a material;
  - steam condensing in open air or on cold walls dumps its latent heat (the condenser/atmosphere sink);
  - each explosive cell detonates individually, so big charges count hundreds of blasts;
  - the "steam engine" is a thermodynamic loop without mechanical work.
- **Autosave** runs every 10 s and when the tab is hidden; gzip is async, so the last few seconds before closing may be lost. Very large grids can exceed the localStorage quota; the File panel then reports it. That path was **not run**.
- **Performance** was measured only in headless Chrome on this machine.
- **Build process.** The file was assembled from dev-time source parts (session scratchpad) and syntax-checked with `node --check`. `index.html` is the complete artifact, with no runtime dependencies.
