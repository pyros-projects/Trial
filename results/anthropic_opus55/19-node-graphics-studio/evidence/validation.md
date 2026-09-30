# Node Studio — validation record

Artifact: `index.html` (single self-contained file, ~426 KB, no external requests).
Browser tool: `agent-browser` 0.31.1 (skill + `skills get core` + `skills get dogfood` read before use), headless Chrome, WebGL2 on **SwiftShader** (software GL, so all perf figures are CPU-rendered worst case).
All runs opened the delivered file **directly via `file://`** (no HTTP server). Downloads captured with `AGENT_BROWSER_DOWNLOAD_PATH=evidence/downloads`.
Live state read via the read-only `window.NGS` hook; all editing used real pointer and keyboard input unless marked *synthetic*.

## Automated regression
`bash evidence/regression.sh` covers startup, all 11 presets, building a graph from scratch (Tab quick-add plus drag-to-connect), scrub edits, rejections, disconnect, undo/redo, select/copy/paste/delete, keyframes, 9 diagnostic views, save/autosave reload, PNG and JSON downloads, share link, narrow viewport, and runtime errors.
- Runs 1–2 failed. Causes: 2 harness bugs (overlapping node placement; `F` frames the selection) and 1 **app bug** (debounced autosave lost on fast reload, now fixed by flushing on pagehide/beforeunload/hidden).
- Final: **52 passed, 0 failed** (`logs/regression-run-final.txt`).

## Manual checks (screenshots in `screenshots/`)
| Check | Result |
|---|---|
| Empty graph → Tab quick-add → drag-connect uv→noise→ramp→output renders (01–04) | pass |
| Node scrub changes param and image hash (05) | pass |
| Color→Coords rejected with reason and tooltip; cycle rejected; graph unchanged (06–07) | pass |
| Disconnect by drag; undo gives identical hash; redo; box select; copy/paste (08) | pass |
| Pan tool, toolbar and keyboard zoom, fit; preview zoom/pan/dblclick fit; pixel inspector | pass |
| Wheel zoom | pass via *synthetic* WheelEvent. agent-browser `mouse wheel` dispatches at (0,0), a tool limitation |
| Keyframes via Inspector ◇ plus auto-key; dope sheet; curves drag; interpolation (10–12) | pass after fix (plans cached stale time-dependence) |
| All 13 diagnostic views, contribution, eval time, cache (14, 18) | pass after fix (eval view now forces timed re-render) |
| Save named project → switch → reopen → reload: identical md5 | pass |
| PNG 800×800 2×AA downloaded; matches preview orientation (19) | pass |
| JSON export; share code (67% smaller) exact round trip | pass |
| Hostile JSON import: 7 warnings, clamping, cycle diagnosed, last valid preview kept, repaired by deleting wire (20–22) | pass after 3 fixes (report closed by file handler; SCC cycle attribution; GC freed displayed texture) |
| Expression compile error: node, GLSL snippet, banner, recovery; `;`/loop sanitizer (23) | pass |
| 390×844: no h-overflow, tabs, menu, Inspector edit changes image (24, 25, 37) | pass after top-bar fix |
| Feedback determinism: stepped f40 == re-simulated f40 hash (26) | pass |
| Frames, collapse, comment, context menu, bypass/M (28) | pass |
| pointercancel mid-drag reverts; blur mid-wire-drag aborts | pass (*synthetic* events) |
| Touch pan and pinch | pass with *synthetic* touch PointerEvents only. Real touch is **blocked** (agent-browser touch needs iOS provider) |
| Splitters resize and persist (29); themes light/contrast (30); HiDPI 2× backing (31) | pass (DPR redraw fixed) |
| Frame-sequence ZIP: valid CRCs, 12 distinct PNGs; WebM 30 frames | pass (WebM stream bug fixed) |
| GLSL + Shadertoy export; 400 MP export blocked; node limit enforced | pass (Settings Enter fixed) |
| WebGL context loss and restore | pass |
| Network: only `file://index.html`; no fetch/XHR/imports | pass |
| Share link `#g=` loads graph, clears hash, later reload keeps user edits | pass (after fix, see below) |
| Perf (SwiftShader), 33-node circuit: ~30 render fps at adaptive res, rAF median 31 ms / p95 37 ms. Paused edit latency fell 160 ms → ~20–40 ms after fix | pass |

## Known limitations / open issues
- (Fixed after the first write-up) `#g=` share links left the hash in the URL, so reloads re-imported the shared graph. Cause: the global undo object named `history` shadowed `window.history`, and the `replaceState` error was swallowed. Now uses `window.history.replaceState`. Verified on `file://` for both the initial load and the same-document `hashchange` path: hash cleared, and after loading Lava Flow a reload restores Lava Flow.
- Real touch input not verified (tool limitation); only synthetic touch events.
- Audio: not applicable.
- Visual quality was judged by screenshots only. Under SwiftShader the preview often runs at 25–50% adaptive resolution; it refines to full resolution when idle.
