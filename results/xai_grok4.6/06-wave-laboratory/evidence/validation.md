# Wave Laboratory — validation record

Agent-authored. Not an evaluator score. Checks are **pass**, **fail**, **blocked**, or **not-run**.

## Artifact

- Path: `/home/pyro/projects/naked/grok46/06-wave-laboratory/index.html`
- Delivery: single self-contained HTML file (inline CSS + JS + SVG favicon data URI)
- No build step, no runtime imports, no CDN, no `fetch()`
- The only `http://` substring in the file is the SVG namespace inside the data-URI favicon (`xmlns='http://www.w3.org/2000/svg'`), which is not a network request

## Environment

- Host: Linux WSL2, 2026-09-07
- Browser tool: **agent-browser 0.31.1** (installed skill `agent-browser`, core workflow loaded via `agent-browser skills get core --full`)
- Local HTTP: `python3 -m http.server 8900 --bind 127.0.0.1` in the project directory
- Sessions: `wavelab` / `wavelab46` for HTTP, `wavefile` for `file://`
- Viewports: 1280×800 and 390×844
- Diagnostics API used for field/probe numbers: `window.WaveLab.getDiagnostics()`, `sample()`, `getProbes()` — live simulation state, not hard-coded UI text

## Commands used (representative)

```bash
agent-browser --session wavelab46 open "http://127.0.0.1:8900/"
agent-browser --session wavelab46 set viewport 1280 800
agent-browser --session wavelab46 wait --fn "window.WaveLab && document.title.indexOf('Wave Laboratory')>=0"
agent-browser --session wavelab46 snapshot -i
agent-browser --session wavelab46 find role button click --name "Pause or resume simulation"
agent-browser --session wavelab46 find role button click --name "Advance one simulation frame"
agent-browser --session wavelab46 find role button click --name "Clear the wave field"
agent-browser --session wavelab46 find role button click --name "Reset the current scene"
agent-browser --session wavelab46 click "#tools button[data-tool=wall]"
agent-browser --session wavelab46 mouse move …; mouse down left; mouse move …; mouse up left
agent-browser --session wavelab46 select "#sel-viz" intensity|phase|grad|medium|flow|amp
agent-browser --session wavelab46 select "#sel-preset" double-slit|…
agent-browser --session wavelab46 click "#rng-dt"; press End
agent-browser --session wavelab46 press Space
agent-browser --session wavelab46 errors
agent-browser --session wavelab46 console
agent-browser --session wavelab46 network requests
agent-browser --session wavelab46 set offline on
agent-browser --session wavefile open "file:///home/pyro/projects/naked/grok46/06-wave-laboratory/index.html"
```

Field samples and probe metrics were read with `agent-browser eval --stdin` against `WaveLab.*`.

---

## Public validation checks

### 1. Multiple sources form interference

**Result: pass**

- Default preset `two-source` places S1 at (0.22, 0.38) and S2 at (0.22, 0.62), same frequency 0.032.
- Vertical scan of `u` at x=0.62 was **symmetric about y=0.5**, with a central lobe (~0.36) and near-nulls near y=0.36 and 0.64 — the expected two-source fringe geometry, not painted sprites.
- Probe P1 (midline, x=0.72, y=0.5) RMS **0.269** vs P2 (off-axis, y=0.62) RMS **0.103**.
- Both probes recovered dominant frequency **0.0315** vs source **0.032**.
- Signed-amplitude view shows cyan (negative) and amber (positive) fringes.

Evidence: `screenshots/01-desktop-two-source.png`, `16-desktop-regression.png`

### 2. Adding a barrier changes diffraction through the actual field

**Result: pass**

- Pointer-dragged the **Reflecting wall** tool down x≈0.48, leaving a gap at the bottom.
- After evolution: sample **on the wall = 0** (Dirichlet), **left of wall ≈ 0.80**, **shadow behind wall ≈ 0.005**, gap still nonzero.
- Screenshot shows reflection on the illuminated side and diffraction around/through the gap.

Evidence: `screenshots/05-wall-diffraction.png`  
Mobile repeat: `screenshots/14-mobile-draw-wall.png`

### 3. Draw a refractive region / lens; observe altered propagation

**Result: pass**

- Dragged the **Lens** tool; **Propagation medium** view showed an elliptical high-n region (n>1 tint).
- Preset **Focusing lens**: wavefronts flatten / converge after the tinted lens region.
- Preset **Refraction at interface**: wavelength visibly shortens on the high-n side; P1 (incident medium) RMS **0.31** at f=0.032, P2 (inside n=1.7) weaker / still filling.

Evidence: `screenshots/06-medium-lens.png`, `10-preset-lens.png`, `10-preset-refraction.png`

### 4. Place a probe; waveform reflects local field state

**Result: pass**

- Default probes already plotted live `u`, RMS, phase, frequency, waveform, and spectrum.
- Clicked **Probe** and placed P3 at (0.85, 0.20). Count went 2→3. P3 recorded nonzero `inst`/`rms` from the simulation buffer (not a fake oscillator).
- Selecting S1 opened source controls (type, waveform, frequency, amplitude, phase, pulse, active).

Evidence: `screenshots/08-probe-placed.png`, `04-source-selected.png`

### 5. Change timestep and wave speed; inspect stability indicator

**Result: pass**

- Focused labeled sliders `#rng-dt` and `#rng-c`, pressed **End**.
- Diagnostics: `dt=1.15`, `c0=1.05`, Courant **1.208**, stability ratio **1.71**, HUD `UNSTABLE`, banner shown, field **blew up** and auto-paused.
- After restoring `dt=0.62`, `c=0.5` and clearing, Resume ran again (`paused=false`, `blowup=false`, energy growing).
- Offline mode after HTTP load: simulation continued at 60 fps with no further network.

Evidence: `screenshots/09-cfl-unstable.png`

### 6. Switch diagnostics while running

**Result: pass**

Cycled `#sel-viz` while the integrator was running:

| Mode | Observed |
|---|---|
| Signed amplitude | Cyan / amber bipolar field |
| Intensity | Time-averaged energy lobes + barrier shadow |
| Phase | Cyclic hue, HUD `view phase` |
| Gradient | Edge-strength map |
| Medium | n-scale + drawn lens |
| Energy flow | Direction-colored flux |

Evidence: `screenshots/07-viz-*.png`, `06-medium-lens.png`

### 7. Clear, pause, single-step, reset

**Result: pass**

| Control | Observed |
|---|---|
| Pause button | `paused: true`, button label **Resume**, HUD `PAUSED` |
| Space key | Toggled pause/resume |
| Step | `t` advanced by `substeps * dt` (1.24) while remaining paused |
| Clear field | `umin=umax=0`, `t=0`, sources/probes kept |
| Reset scene | Reloaded current preset, field restarted |

Evidence: `screenshots/02-paused.png`, `03-cleared.png`

---

## Presets

All eight required presets load and run. Recaptured after the wavefront had time to cross the tank (~3–5 s except the short pulse).

| Preset | Result | Notes |
|---|---|---|
| Two-source interference | pass | Immediate fringes; default scene |
| Double-slit | pass | Line source → barrier with two gaps → fringe field on the right. On-axis probe RMS > off-axis |
| Single-slit | pass | Single aperture; broader diffracted beam |
| Standing waves (cavity) | pass | Reflecting box; probes show large RMS |
| Focusing lens | pass | High-n ellipse; transmitted wavefronts change curvature |
| Refraction at interface | pass | Shorter λ in n=1.7 half-plane |
| Phased-array steering | pass | 10 elements, Δφ=58°. Beam tilts toward P1 (rms 0.035) vs P2 (0.016) |
| Pulse through obstacles | pass | Ricker pulse, hatched scatterers, reflections. Distant probe can miss a short packet (see limitations) |

Evidence: `screenshots/10-preset-*.png`

---

## Viewports, input, runtime

| Check | Result | Notes |
|---|---|---|
| Desktop 1280×800 | pass | Grid `220px 780px 280px` (tools \| stage \| inspector). 60 fps, 240×160 |
| Narrow 390×844 | pass after fix | First mobile shot hid the tank (DOM order). After CSS `grid-template-areas`, stage is on top (~390×260 field), pause works, wall drawing works, all ten tools visible |
| Pointer drawing | pass | Wall, lens, probe placement |
| Keyboard | pass | Space pause; End on range inputs for CFL |
| High-DPI | pass | `devicePixelRatio` used on overlay canvas; field rendered at grid resolution then CSS-scaled |
| Console errors (HTTP) | pass | Empty `agent-browser errors` / `console` |
| Console errors (`file://`) | pass | Empty |
| External network | pass | HTTP requests: document `127.0.0.1:8900` only (plus an earlier favicon 404, eliminated with a data-URI icon). `file://` session: single GET of `index.html` |
| Offline after load | pass | `set offline on`; still `fps 60`, `RUNNING` |
| Direct file open | pass | `file:///…/index.html` — WaveLab live, interference visible, no external fetches |

Evidence: `screenshots/11-mobile-390x844.png`, `12-mobile-paused.png`, `14-mobile-draw-wall.png`, `15-file-protocol.png`, `16-desktop-regression.png`

---

## Failures found during development (fixed, then retested)

1. **Materials rebuild before grid alloc** — range `input` handlers called `rebuildMaterials()` at bind time. Guarded `if (!sim.index) return`.
2. **Clear field left stale energy** in HUD. Now zeros `state.energy`.
3. **Line sources over-injected** (one additive kick per cell along a long line) → `umax≈8.5`, energy ~1e5 on double-slit. Scaled line injection (`amp * 0.22`). Retest: double-slit `umax≈1.9`, energy ~7610, visible fringes.
4. **Resume after CFL blow-up** stayed frozen because `blowup` was not cleared. Resume now clears `blowup`. Retest: restore Δt/c, clear, resume → `paused=false`, energy grows. If Δt/c stay illegal, the field correctly blows up again.
5. **Mobile layout** put the tool aside above the tank (DOM order). CSS grid areas put `stage` first. Retest at 390×844: field visible, tools under the tank.
6. **Medium/lens invisible in amplitude view** until late times. Subtle n-tint overlay added when “Show walls on field” is on.

## Remaining limitations (not claimed as pass)

- Probe FFT is a short-window DFT. Before the wavefront arrives, or at very low amplitude, reported `f` can be spurious. After arrival it tracks the source (0.0315 vs 0.032 in the two-source case).
- A short Ricker pulse plus absorbing sponge can die before a far probe; P2 in the obstacle field saw the packet, a probe at x=0.88 often did not. Probe P1 was later moved to x=0.78.
- Sidebar “Keys” / lower Display controls may require scrolling on short desktop windows.
- Unstable Δt/c is indicated and will dump the field; the app does not silently clamp the user’s sliders.
- No audio in this app (not required).

## Tooling notes

- Validation used the installed **agent-browser** CLI as required. Cursor IDE browser MCP was not substituted.
- Direct `file://` open **passed** in agent-browser (not blocked).
- A competing local app on port 8088 stole an earlier session named `wavelab`; subsequent work used session `wavelab46` pinned to port 8900.
