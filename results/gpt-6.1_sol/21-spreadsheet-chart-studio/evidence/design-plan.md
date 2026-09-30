# Spreadsheet & Chart Studio implementation plan

Goal: a complete, polished spreadsheet and chart application delivered as one dependency-free index.html, with honest browser evidence.

Architecture: a typed fixed-grid workbook and recursive-descent formula engine; an action/history layer owns memory snapshots; DOM editing and custom SVG charts consume freshly calculated values. User-provided text enters DOM through textContent or XML escaping. Runtime uses no origin-dependent storage, clipboard access, network, or parent-frame access.

Spec: the user's Spreadsheet & Chart Studio brief and SHEET-01 through SHEET-07 checks.

Global constraints: A1:Z100; seed on every load; exact lazy IF/error semantics; actual-cell chart data; atomic validation before import/paste; JSON v1 typed raw cells and chart definitions; evaluated CSV; scripts/downloads-only sandbox compatibility.

Execution: native in this harness. The user's explicit end-to-end run supersedes intermediate design approval gates. This is an empty, non-git workspace, so git worktrees/commits do not apply. Development and tests remain adjacent to the artifact in evidence/.

Review focus: inactive IF cycles; quoted strings during copy; malformed CSV/JSON atomicity; resize while editing; zero and omitted/negative chart points.

- [x] Task 1 — Write failing calculation/serialization tests; implement StudioCore in an embedded script; verify precedence, errors, dependency/cycle recovery, rebase, CSV and typed JSON validation with node evidence/tests/core.test.cjs.
- [x] Task 2 — Implement the responsive editing/history interface and SVG chart studio in the same artifact. Verify real keyboard edits, rectangle copy/paste, undo, settings, and import/download flows in the browser.
- [x] Task 3 — Run SHEET-01–07 through agent-browser, record screenshots and live diagnostics. Verify SVG/PNG outputs, direct file, sandbox iframe, blocked external network, fresh-load seed and mobile continuity. Reproduce/fix failures and repeat affected checks plus regression.
- [x] Task 4 — Fresh review, final standalone/dependency checks, final evidence accounting and delivery.

JSON v1: {format:"spreadsheet-chart-studio",version:1,name:string,cells:[{address,type,raw}],charts:[{id,title,type,range,colors,legend}]}. Cell raw values are source strings. Types are blank, number, text, boolean, formula; a leading apostrophe forces text. Missing cells are blank; export includes all 2600 typed cells. Chart types are column and line, ranges have at least two rows and columns, colors are hex RGB, and IDs are unique. Cached values are never imported.
