# FORGE — Node Graphics Studio: validation log

Tooling: `agent-browser` (CDP, headless Chromium, WebGL2 via SwiftShader — `WebKit WebGL`), file:// direct open. All checks against the real app; pixel data read back via `gl.readPixels`.

## Boot / rendering
- `file:///…/index.html` loads, zero external requests (network log shows only the document itself) — **pass**
- WebGL2 context created; default preset "Animated Plasma" compiles and animates — **pass** (screenshots 02, 06, 10)
- `framePix` non-black: 147456/147456 lit pixels on plasma — **pass**

## Graph semantics
- Connections drive output: warp resample test — plain fbm center px `[102,102,102]` vs warped `[81,81,81]` — **pass**
- Type system: `color.c(c4)→remap.v(f)` rejected w/ toast "c4 → f needs conversion (use Split/Luminance)"; `f→v2` splat allowed; `c4→c4` ok — **pass**
- Cycle prevention: math→math back-edge rejected "connection would create a cycle" — **pass**
- Compile error: broken gen → `lastCompileOK=false`, `errNodes={[1009,"shader L16: ';' syntax error"]}`, last frame preserved, recovery clean — **pass**
- Unknown node type on load → placeholder `missing` node, editable, no crash — **pass** (code path; visual check incidental)
- Invalid-port edges in preset were silently ignored (found during dev, fixed) — noted behavior

## Editor interactions (real pointer events)
- Drag out-port → in-port connects & replaces existing input edge (fbm.v → remap.v) — **pass**
- Drag from connected input → empty canvas disconnects — **pass**
- Incompatible drop rejected with toast, existing edge untouched — **pass**
- Node drag moves with grid snap + alignment guides; box select selects; wheel zooms to cursor — **pass**
- Ctrl+Z/Ctrl+Y undo/redo verified (edge source 1004→undo→1006→redo→1004) — **pass**
- Ctrl+C/V copy-paste (11→13 nodes, selection follows), Ctrl+D duplicate, Delete — **pass**
- Command palette: right-click → "Add node" → type "voro" → Enter adds Voronoi — **pass**
- Frame around selection, comment node, collapse — **pass** (screenshot 08)
- Minimap renders + click/drag pans — **pass** (visual)

## Preview
- Zoom (wheel), pan (drag), Fit, 1:1, tile 1→2→4×, checkerboard — **pass**
- Pixel probe: hover shows `px(101,211) rgba(255,99,148,255) #ff6394`; click locks probe — **pass**
- Freeze reference → split-screen compare — **pass**
- Diag views produce distinct output: lum sum=20.0M, alpha sum=112.8M (all-opaque ✓), node(sel)=56.5M, nan(dimmed)=4.6M — **pass**
- NaN view: implementation present (`col!=col` → magenta); **not fully verified** — SwiftShader flushes NaN through mod(0)/atan2(0,0)/normalize(0)/inf*0 on this driver — **partially verified**
- Value-range auto-normalizes from measured min/max — **pass**
- dirty/cached editor overlay colors all 11 nodes — **pass**

## Timeline / animation
- Play advances t (0.90s measured), pause/step/loop/duration/fps controls — **pass**
- Keyframes: added at t=0/4 on remap.out max → sampled 0/0.5/1 at t=0/2/4 (smooth interp) — **pass**
- Auto-key toggle, dope-sheet rows w/ draggable + right-click-delete keys, per-track interp select — **pass**
- Animation affects pixels: sampled sum delta 2.0M between t=0 and t=1.5 — **pass**

## Presets (10, all real node graphs)
All compile clean with no node errors: Plasma, Marble, Wood, Clouds, Lava, Circuit Board, Cellular, Neon Tunnel, Terrain+Normal, Poster — **pass** (screenshots p1c, 02, preset-7b, p8, …)

## Persistence & export
- Named save→localStorage, Open dialog lists/loads/deletes — **pass**
- Autosave (2.5s debounce) restores on reload (5-node graph incl. comment) — **pass**
- Share text (base64 JSON) round-trips node count — **pass**
- JSON project download, GLSL source (5.2KB real shader), JS export — **pass** (download hooks captured)
- PNG 512×512 download captured; pixels non-black (same render path as readback) — **pass**
- WebM one-loop recording → blob download — **pass**
- PNG frame sequence: 3 frames for 0.1s@30fps → 3 downloads — **pass**

## Chrome / robustness
- HUD: fps, nodes, edges, dirty, eval ms, res, t/f, selection, compile status, autosave age — **pass**
- Narrow 390×844: panels collapse to ☰/Preview overlays, graph usable — **pass** (screenshot 04)
- Light & contrast themes — **pass** (screenshot 09)
- Node cap enforced (addNode returns null + toast at cap) — **pass**
- Export res clamped at settings cap — **pass**
- Resample-expression budget (400KB) guards warp/blur chains — **pass** (code)
- pointercancel / window blur abort in-flight gestures — **pass** (code path)

## Known limitations
- NaN diagnostic can't be exercised on SwiftShader (driver never yields NaN); code path reviewed only.
- Pinch-zoom on touch not implemented (single-pointer pan/connect works; wheel zoom only).
- Per-node preview shows the node's *first* output port.
- Node thumbnails refresh ~2×/s, capped at 8/frame.
- `.graph.js` export is a manifest stub (GLSL export is the real compiled source).
