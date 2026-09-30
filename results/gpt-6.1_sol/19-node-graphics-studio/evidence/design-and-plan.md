# Fieldwork implementation plan

Goal: deliver the complete, offline node-based procedural graphics studio as one index.html.
Architecture: an editable typed DAG compiles to WebGL2 functions with per-node uniforms. A DOM/SVG graph editor, canvas preview, inspector, keyframe timeline and validated project store all consume the same graph. The GPU handles rendering; uniforms update animation and parameters without recompilation. A bounded program cache avoids redundant compilation. GLSL errors retain the previous valid program.
Stack: embedded HTML, CSS, JavaScript, GLSL only. No runtime dependencies or requests.
Spec: the user brief in this session. Execution: native in this session; no git repository exists.

Constraints: single self-contained index.html; direct-file operation; no network; max 100 nodes, 250 edges, 2048px exports and bounded animation; desktop 1280x800 and narrow 390x844; actual browser input and rendered-output validation; honest evidence.

Review focus: cyclic imports, incompatible ports, interrupted drags, shader/resource cost of neighborhood nodes, project persistence and export fidelity.

- [x] 1. Write and run initially failing graph-engine tests: numeric graph evaluation through GLSL generation, connection rejection and cycles, bounded validated JSON, interpolation. Implement schema and compiler in index.html; re-run tests.
- [x] 2. Build the workspace and graph interactions: palette/search, ports, node/box selection, movement, pan/zoom, history, clipboard, frames/comments/collapse, minimap and inspector. Interfaces: graph {nodes,edges,frames}, compileGraph(graph,target), validateProject(project), canConnect(graph,from,to,port).
- [x] 3. Connect WebGL rendering, diagnostics, intermediate views, pixel inspector and preview navigation. Handle shader failures without losing graph or previous preview. Implement visible-node presets and thumbnails.
- [x] 4. Implement timeline, keyframes, interpolation, save/load/autosave and named projects, share text, PNG/JSON/GLSL/WebM exports and settings. Export uses the same compiled graph at chosen frame and resolution.
- [x] 5. Use version-matched agent-browser core and dogfood workflows. Test real graph edits, incompatible links/cycles, history, clipboard, pan/zoom, animation, diagnostics, complex presets, imports, exports, persistence, direct file, offline HTTP and narrow editing. Fix and re-run failed flows. Record exact commands, screenshots, diagnostics and limitations in evidence/validation.md.
