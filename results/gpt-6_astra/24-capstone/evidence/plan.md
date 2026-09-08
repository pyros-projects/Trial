# Selvedge implementation plan

**Goal:** Deliver a complete, tactile, offline pocket loom as index.html.
**Architecture:** One embedded pure weave engine, a transactional in-memory project/history controller, accessible DOM editing controls, and a high-DPI Canvas renderer. Async file callbacks carry a session generation token. Test scripts and evidence remain outside the artifact.
**Spec:** research.md contains the choice, original commitments, and limitations.
**Constraints:** One self-contained HTML; no runtime network, libraries, imports, storage, or build; direct-file and opaque iframe; desktop 1280×800 and mobile 390×844; ordinary input/download.

The user explicitly authorized autonomous design choice and end-to-end implementation. The writing-plans and test-driven-development skills inform this inline plan; their further design-approval and handoff questions are superseded by that instruction. The provided workspace is empty and is not a git repository, so no branch integration or worktree is needed.

- [x] 1. Write independent expected-result tests for the actual embedded engine: plain/twill float lengths, periodic seam merging, unbound detection, reverse mapping, useful binding edits, and validated import bounds. Run the pre-implementation failure.
- [x] 2. Implement the pure engine in index.html and rerun those tests. Model n×n bits, two yarn colors and a color rhythm. Scan every cyclic row/column into maximal runs; all-identical rows/columns are explicitly unbound. A binding operation searches one-bit changes for a lexicographically better structural score.
- [x] 3. Implement the full working surface: tactile cloth, 8/12/16 repeat grid with pointer capture and keyboard navigation; presets, palette, project name, front/reverse, float lens, cross-section, repeat scale, statistics, bounded undo/redo, downloads/import and whole-session reset.
- [x] 4. Browser validation using installed agent-browser core and dogfood workflows: actual edit/inspect/bind/export/import/reset paths, canceled stroke, focus loss, malformed files; screenshots, live diagnostics, console and request inspection.
- [x] 5. Validate direct-file and HTTP with external traffic blocked, narrow layout, opaque iframe, and no storage. Reproduce and fix failures, retest the failed flow and compact regression. Finish evidence/validation.md with exact commands and honest outcomes.

- [x] 6. Independent final review: reproduce and correct the 12-thread / 8-color-period seam, add rendered color and inspector regressions, and rerun the complete direct-file, interruption and opaque-sandbox workflows.
