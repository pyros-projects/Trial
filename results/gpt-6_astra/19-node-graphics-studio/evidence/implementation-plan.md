# Form Lab implementation plan

Goal: deliver a single-file procedural graphics studio with a real typed graph, animation, editing, persistence, exports, and browser evidence.

Architecture: a data-only DAG and validation core; an embedded node catalog that emits GLSL sampling functions; a WebGL2 renderer with uniform-only parameter updates and cached programs; DOM/SVG graph editing and Canvas preview/timeline. No runtime dependencies or requests. The supplied working directory is empty and is not a Git repository.

Design: charcoal panels, mint actions, violet/cyan port colors, compact typography, visible node thumbnails, a square live artwork, and a persistent timeline. On narrow screens, Graph / Preview / Inspector tabs preserve usable controls. Export and project dialogs use native labeled fields.

Implementation and verification:
- [x] Pure graph validation and keyframe interpolation: reject incompatible ports, cycles, duplicate IDs, nonfinite/out-of-bounds parameters, unsafe project sizes. Test real core behavior in Node.
- [x] GLSL node catalog and compilation: coordinate sampling, time, scalar/vector/color constants, arithmetic, noise/FBM/cellular, shapes, transform/warp, color/blend/mask, blur, normals, lighting, output. Compile visible presets from ordinary nodes.
- [x] Studio: graph pointer/keyboard editing, history, selection, group/comments, palette/search, inspector, preview diagnostics and navigation, timeline/keyframes.
- [x] Durable workflows: JSON import/export, named local projects/autosave, share text, PNG/GLSL, bounded PNG frame sequences.
- [x] Browser: direct file startup with external requests blocked; real graph edits/wires/cycles/history/animation/diagnostics/persistence/exports at 1280×800 and 390×844; inspect canvas pixels/live diagnostics, errors, network, screenshots. Reproduce and repair failures.

Safety limits: 80 nodes, 200 edges, 2 MB JSON input, bounded coordinates/parameters, maximum sample expansion cost of 256, 2048px still export, 120 frames/1024px sequence with a 32-million-pixel total budget. WebGL2 is required and failures are visible. No arbitrary imported code.
