# Agentic execution protocol

Every task has one complete `prompt.md`. Tools and validation are available throughout the run. The following common workflow is already embedded in each prompt; do not send it as a second prompt.

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Standalone HTML delivery and runtime checks

Write the final application to `index.html` in the working directory. The delivered application must remain one self-contained file with the original runtime/dependency restrictions; development tools, test scripts, and a temporary local HTTP server for browser inspection are allowed and are not runtime dependencies of the delivered artifact. Keep evidence and test harnesses outside `index.html`.

Verify that opening the delivered file directly works as required, and that it does not fetch external assets or services. If your browser tool only supports local HTTP, also inspect the artifact's dependency assumptions, record the direct-file check as blocked rather than passed, and preserve direct-file compatibility. When checking via local HTTP, block external internet but leave that local server reachable; test without external cached resources. For audio, explicitly enable playback with a user gesture. Do not claim audio quality was heard when only meters or audio state were inspected.

### Session state in tasks 21–24

The four new tasks target the existing public viewer directly: one offline HTML document, opaque-origin iframe compatibility, and all session changes in memory. They include explicit Reset/Restart and appropriate user-initiated file exports. Do not require persistent browser storage, a backend, credentials, or runtime network access. The original 01–20 task texts remain unchanged; use their own stated runtime requirements when evaluating those artifacts.

### Live research in the Capstone

Prompt 24 additionally requires actual harness web research before choosing the concept. Preserve its queries, opened sources, candidate ideas, selection rationale, and three behavioral commitments in `evidence/research.md`. Research happens during development; the final HTML must still work with external requests blocked. Missing web access is a blocked research check, not permission to invent a research trail or a reason to stop useful implementation work.

### Archived Real Apps protocol

The previous multi-file delivery, backend, persistence, and concurrent-session checks are retained on [`experimental/real-apps`](https://github.com/pyros-projects/Trial/tree/experimental/real-apps/docs/AGENTIC_PROTOCOL.md). They are not requirements for the current 24 single-HTML tasks. Generic project inspection remains available locally for compatibility.
