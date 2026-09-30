# Vector & Layout Studio implementation plan

Goal: deliver the user's complete vector editor as one offline index.html.
Authority: the complete Vector & Layout Studio brief and its twelve public validation checks.
Architecture: native SVG scene graph; nested positive similarity matrices; cubic extrema and declared text metrics for bounds; one shared renderer for editing, preview and exports; transactional RAM history.
Runtime: embedded HTML/CSS/classic JavaScript only. No storage, network, external fonts, modules or libraries.

- [x] Geometry and schema: finite matrices, transformed leaf boxes, exact cubic extrema, hierarchy validation, strict 2 MiB / 200 items / 32 anchors / four group levels / 2000 text characters.
- [x] Authoring: two editable compositions, blank, selection/marquee, tools, handles and nodes, numeric properties, hierarchy and locks, undo transactions, alignment and deterministic snapping.
- [x] Delivery: safe own JSON import, vector SVG, 1x/2x PNG, preview, fresh-session reset, responsive panels and diagnostics.
- [x] Browser validation: real pointer/keyboard operations at desktop and narrow sizes; direct file and opaque sandbox; actual download parsing; hostile import rejection; cancellation and regression checks.
- [x] Final review and evidence: record commands, outcomes, defects/fixes and untested limits in validation.md.

Review focus: nested transforms, text injection, cancelled edits, hidden/locked hierarchy, delayed import/export callbacks after reset.
Ruling: use the user's authorized continuous end-to-end run; no intermediate approval gates or separate worktree (new empty delivery workspace). Evidence is preserved in this directory; final artifact stays at the requested path.
