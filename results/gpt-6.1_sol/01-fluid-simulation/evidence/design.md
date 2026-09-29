# Fluid study — design

Intent: a demonstration-ready, interactive fluid laboratory, delivered as one `index.html` that opens directly in a modern browser. All graphics, styling, code and shaders are embedded. No runtime libraries, assets or network access.

The main surface is a dark fluid canvas inside a light, restrained laboratory interface. A right-hand control panel groups dye, fluid dynamics and solver controls. A compact dock provides pause, clear dye, fresh flow and image capture. On narrow screens the controls move below the canvas, leaving a usable touch surface. Live status shows FPS, solver dimensions, mode and pause state.

Preferred implementation: a WebGL2 stable-fluids grid with floating-point framebuffer ping-pong, bilinear semi-Lagrangian advection, implicit viscosity, vorticity confinement, divergence, Jacobi pressure solve, pressure-gradient subtraction and exponential dissipation. Dye uses a denser grid than momentum. Alternatives considered: a CPU-only solver is simpler but restricts detail and speed; a particle system cannot satisfy incompressibility and transported continuous dye. A genuine CPU grid solver is the fallback when WebGL2 or floating-point targets are unsupported.

Pointer input uses capture, multiple pointer state, coalesced event samples, bounded queued segments and interpolation along each stroke. Force depends on measured drag displacement and elapsed time. Input clears on cancel, release and window blur. Pausing freezes simulation state; controls and mode switching still operate. Clear dye changes dye textures only. Reset restores default controls and a deterministic seeded flow. Resolution changes and resize resample fields; image capture downloads a local PNG.

Modes: dye, velocity (direction hue / speed brightness), pressure, curl and divergence. The signed modes have a centered color legend. Flow starts with several colored curved jets; continuous emitters are optional and disabled by default. A readable first-use instruction and brush outline explain interaction.

Diagnostics: on-demand readback reports actual velocity energy, dye mass, divergence, curl, finite state and step count. Readback is not part of every animation frame. A help dialog explains solver limits and shortcuts. Unsupported GPU capabilities select the CPU solver with an honest status; a WebGL context loss shows a recovery action.

Validation: real agent-browser pointer and keyboard interaction at 1280×800 and 390×844; rendered output and actual field diagnostics; slow/fast drags, sustained input, all modes and controls, viscosity/vorticity comparisons, pause/resume, clear dye, reset, resize, high DPI, touch, local PNG, unsupported GPU and context loss. Direct-file and local HTTP loads with outside network blocked; console and request inspection. Numerical fallback tests run independently under Node. Evidence records actual outcomes and failures.
