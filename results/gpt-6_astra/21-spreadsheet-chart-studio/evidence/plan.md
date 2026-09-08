# Spreadsheet & Chart Studio implementation plan

Goal: Deliver the complete offline application in ../index.html and validate all seven public workflows.
Architecture: One embedded model/parser section, one transaction and file section, and one DOM/SVG UI section. Typed raw cells remain authoritative; a dependency evaluator produces a fresh calculation snapshot after each transaction. SVG charts read that same snapshot. All state is memory-only.
Technology: Native HTML, CSS, JavaScript, SVG, canvas only for PNG export. No runtime dependencies.
Spec: The full user-provided Spreadsheet & Chart Studio requirements in this session.

The user has authorized one end-to-end run, so design and implementation proceed inline without an approval pause. This directory is a fresh standalone workspace without a Git repository.

- [x] 1. Write behavioral engine tests for seed calculation, precedence, lazy IF, cycles, rebasing, typed JSON and strict CSV. Run before implementation to establish a missing-feature failure.
- [x] 2. Implement tokenizer, AST parser, evaluation with active dependencies, types and copy rebasing. Use an explicit cell evaluation stack to handle long chains without recursive cell calls. Run the engine tests.
- [x] 3. Implement strict versioned JSON and CSV validation. Validate into a new object before swapping state. Centralize transaction snapshots, undo, redo and Reset.
- [x] 4. Build the responsive grid: rectangular pointer/keyboard selection, formula bar, in-cell editor, internal copy/paste and numeric summary. Keep the editor DOM stable across viewport resize.
- [x] 5. Build chart creation, settings, omission diagnostics, bar/point inspection, source selection, and actual SVG/PNG exports. Draw from current calculated cells and retain line gaps.
- [x] 6. Run agent-browser navigation and real controls for SHEET-01 through SHEET-07. Capture screenshots, exported artifacts, state diagnostics, console/errors and request logs. Test desktop, narrow, direct file and sandbox iframe with blocked external traffic.
- [x] 7. Reproduce and fix observed failures, rerun affected flows and a compact regression, then complete validation.md with honest pass/fail/blocked/not-run statuses.

UI design: Warm neutral application chrome, forest-green actions, a small left navigation rail, a large worksheet panel and a resizable chart/inspector panel. The initial view exposes the seed chart and table, with clear labels for imports, exports and Reset. On narrow screens the rail disappears and panels stack; every control stays accessible.

JSON v1 contract: {format:"spreadsheet-chart-studio",version:1,name:string,cells:{A1:{type:"number"|"text"|"boolean"|"blank"|"formula",raw:string}},charts:[{id,title,type:"column"|"line",range,colors:["#rrggbb"],legend:boolean}]}. Nonblank cells are exported sparsely; missing entries are blank. Raw strings preserve exact input. Explicit text entries may hold formula-looking strings. Cached values are never imported. All addresses are fixed A1:Z100. Chart ranges require at least two rows and columns.
