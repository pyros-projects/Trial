# Afterimage validation — agent-authored evidence

Date: 2026-09-30. This is an authored test trail, not an evaluator report or score.

## Environment and workflow

- Working directory: `/home/pyro/projects/naked/sol61/24-capstone` (initially no product files; not a git repository).
- Node v25.8.1, Python 3.12.3, installed `agent-browser` 0.31.1.
- Read `.agents/skills/agent-browser/SKILL.md`, then `agent-browser skills get core`; consulted `agent-browser skills get dogfood` and version-matched full command reference before browser use.
- Research performed with live `web__run` calls; see `research.md`.
- No audio is part of the concept.

## Initial status

All application checks are **not-run** until results are appended. Screenshots and logs will be written under this evidence directory.

## Implementation ledger

- Design and plan recorded before implementation. The end-to-end autonomous instruction governs execution; no approval pauses. No worktree is applicable because this directory is not a repository and the delivery path is explicitly specified.

## Observed runs

### Codec development — pass

1. Wrote `codec.test.cjs` before implementation. Ran `node --test evidence/codec.test.cjs`: **5 fail / 0 pass**, all at the expected assertion `Delivered HTML and its codec must exist`.
2. Implemented the embedded codec, reran the same command: **5 pass / 0 fail**. Repeated after wiring the interface: **5 pass / 0 fail**, 137 ms total.
3. Coverage: systematic parity agrees with independent slow polynomial GF multiplication on a degree-one input; arbitrary 0–255 payloads recover at every loss count from zero through p for p=4/8/12; p+1 losses remain unknown; the same four-row physical fold fails in Rows and succeeds Woven; mapping is bijective; all-erased input has 576 unknown pixels.
4. Design clarification (before UI verification): the 32×24 physical grid interleaves 24 codewords, so a four-row fold spreads **5–6**, not exactly four, erasures per band. Eight pieces still suffice. The original behavioral commitment is unchanged; `design.md` was corrected to reflect the implemented mapping.

### Direct-file desktop startup and pointer recovery — pass

Actual commands (same session, browser offline before first navigation):

```sh
agent-browser --session afterimage set viewport 1280 800
agent-browser --session afterimage set offline on
agent-browser --session afterimage open file:///home/pyro/projects/naked/sol61/24-capstone/index.html
agent-browser --session afterimage snapshot -i
agent-browser --session afterimage screenshot evidence/screenshots/01-desktop-initial.png
agent-browser --session afterimage errors
agent-browser --session afterimage console
agent-browser --session afterimage network requests
agent-browser --session afterimage mouse move 340 425
agent-browser --session afterimage mouse down left
agent-browser --session afterimage mouse move 480 470
agent-browser --session afterimage mouse move 600 520
agent-browser --session afterimage mouse up left
agent-browser --session afterimage screenshot evidence/screenshots/02-desktop-scratch.png
agent-browser --session afterimage snapshot -i
agent-browser --session afterimage find role button click --name 'Recover memory'
agent-browser --session afterimage screenshot evidence/screenshots/03-desktop-recovered.png
agent-browser --session afterimage errors
agent-browser --session afterimage console
```

Read `Afterimage.diagnostics()` through `agent-browser eval --stdin` before and after recovery. After the actual pointer path: **64 erased**, **64 unknown pixels**, **24/24 recoverable bands**, loss counts 2–4 per band, **1 history transaction**, no active stroke. After the visible Recover button: **576 decoded bytes**, **0 unknown**, byte-by-byte comparison with original **true**, history length **2**. The rendered headline was `Every pixel came back.` Inspected the initial screenshot: generous usable surface, legible controls, source and live received previews. Console and error outputs were empty; the only request was the local `file://` document (200). No external cache/resources were used; browser was freshly launched offline.

### Browser harness correction

First `python3 evidence/browser-checks.py` stopped before the authored pointer stroke: the installed CLI rejected decimal coordinate strings (`mouse move 330.79 780.68`: `Missing arguments for: mouse move`). This was a harness command-format failure, not an application behavior pass or fail. Reproduced the command distinction: integer `mouse move 331 781` succeeded. Changed only the authored harness's coordinate rounding to integers, preserving all application expectations. Failure saved in `logs/harness-coordinate-failure.json`; exact command/output trail in `logs/browser-workflows.jsonl`. Rerun follows below.

Second run passed the novel `ECHO` inscription, custom 10-pixel pointer stroke, one-stroke undo/redo, and invalid inscription check, then failed an **authored harness assumption** that scattered 10% Rain must always recover with p=8. Inspection found one band had **9** missing tiles (other bands 0–7). The app correctly reported **6 unresolved original pixels** with the rest reconstructed. Screenshot: `screenshots/issue-001-rain-concentrated.png`; preserved run in `logs/rain-run-failure.json`. This is consistent with the original per-band promise and is not an application bug. Corrected the authored test to independently compute the expected partial output from the actual received bands, retain the history checks, and test exact recovery with 12 extra pieces on a new Rain trial. No benchmark tests, expected fixtures, or application algorithm were changed.

Third run hit another CLI interface mismatch: `find label ... select` is not a supported find subaction in 0.31.1. Reproduced selection with `agent-browser --session afterimage select '#paritySelect' 12`, which succeeded. Updated the harness to obtain a fresh `snapshot -i` and select the combobox ref matching its visible label. Recorded the failed command/output in `logs/harness-select-failure.json`. Application behavior and test expectations were unchanged.

### Complete direct-file workflow run — pass

Command: `python3 evidence/browser-checks.py` (all individual agent-browser commands, stdin expressions, output, exit codes and timestamps are in `logs/browser-workflows.jsonl`; result groups in `logs/workflow-results.json`). All **14 groups passed**. Actual results:

- New `ECHO` memory plus **10 changed pixels** through a continuous pointer stroke; undo/redo exact, one stroke transaction. Invalid emoji inscription preserved the drawing and explained accepted characters.
- 77 scattered erasures with p=8 produced the correct six unresolved pixels because one band lost nine tiles. Undo/redo restored identical received and decoded arrays. A fresh 87-erasure trial with p=12 recovered the entire custom payload.
- Keyboard arrows + Space erased one tile; recovery exact. Inspect + Space did not erase and reported the selected band's actual survivors.
- Identical four-row fold: **128 missing tiles** in each layout; Rows recovered 20 bands with **96 unknown** pixels; Woven recovered 24 bands with **0 unknown**, matching the edited source exactly.
- p=4 four-row fold left **80 unknown** pixels; p=12 sixteen-row fold left **432 unknown** pixels. Re-store recovered the intact authored source without changing the image.
- Actual project download **6,578 bytes**, decoded saved source and 128 missing positions. Actual PNG download **576×576**. File-input round trip restored source, settings, received bytes and decoded output. Undo/redo of import worked.
- Invalid JSON, wrong pixel length, duplicate erased positions and a 65,537-byte file each preserved the entire current experiment with useful feedback.
- Reset during an artificially delayed 1,200 ms native file read survived its later completion. The delay is browser-only test instrumentation, not product code.
- Actual Tab input during held mouse ended a stroke as one transaction; subsequent pointer motion did not continue it. Standard synthetic `pointercancel` after real pointerdown also terminated the stroke; this cancellation check is not claimed as native OS cancellation.
- About contained all three full selectable URLs; Escape closed the modal.
- At **390×844**, no horizontal overflow; pointer stroke erased **54 tiles** and recovered exactly. Enter inscribed new `BEAM`, pointer added custom pixels, Rows fold failed honestly and Woven restored that exact custom source. Screenshots `09`–`12` inspected for the working surface, controls and feedback.
- Reload returned to the original moth and empty history; **2× device scale** retained exact recovery and correct rendered output.
- Uncaught errors: **0**; console output: empty; requests: local file document only. Browser stayed offline throughout.

Screenshots `04`–`13` show authored input, both fold outcomes, error feedback, About, narrow state, and high-DPI rendering. `afterimage-roundtrip.json` and `afterimage-output.png` are real downloads from visible controls.

### Independent review and application race fix

The `superpowers:executing-plans` / `requesting-code-review` workflow explicitly called for an independent read-only reviewer. It reviewed the complete product and evidence, independently passed the five codec tests, and found one Important issue; no other Critical, Important, or Minor findings and no declined-to-judge behaviors.

**Observed application failure:** a file read completing while a newer pointer stroke was still held could overwrite it. Root cause: revision advanced only when the stroke finished, so the pre-commit file guard considered the active stroke unchanged; committing the import called `finishStroke()` and then replaced the model.

Reproduction command: `python3 evidence/import-stroke-regression.py red`. **Fail** as expected: before completion, original moth / 9 erased tiles / active stroke / revision 0; after completion, imported custom memory / 128 erased tiles / no active stroke / revision 2. Exact commands and live states: `logs/import-stroke-red-commands.jsonl`, `logs/import-stroke-red-result.json`; screenshot `screenshots/import-stroke-red.png`.

**Fix:** advance the session revision at the start of a destructive pointer stroke, so pending file reads are stale immediately. The gesture still creates one undo transaction at completion. No codec, fixture or expectation changed. Retest and regression results follow.

Retest: `python3 evidence/import-stroke-regression.py green` — **pass**. Before and after delayed completion: original moth / 9 erased / active stroke / revision 1. Feedback: `Import canceled because the experiment changed while reading.` Mouse release committed the stroke normally as one transaction. Logs: `logs/import-stroke-green-commands.jsonl`, `logs/import-stroke-green-result.json`; screenshot: `screenshots/import-stroke-green.png`. The five codec tests and all 14 direct-file browser groups passed again after this fix.

### Narrow control clipping — fixed and retested

Visual inspection of `19-opaque-narrow-compose.png` exposed the brush/example selectors clipped by the workbench edge, despite the page having no horizontal scrollbar. Reproduced with `python3 evidence/narrow-control-check.py red`: **fail**. At 390×844 the card ended at x=373, while the brush and example controls extended to x=387.86. Evidence: `logs/narrow-controls-red-result.json`, `screenshots/narrow-controls-red.png`.

Fix: allow the palette grid column to shrink (`minmax(0,1fr)`), reduce its narrow-screen gaps and selector padding. Retest: `python3 evidence/narrow-control-check.py green` — **pass**, all five drawing controls fit inside the card (rightmost x=360). Inscribed a new eight-letter `KEEPTHIS` memory through real input; the complete two-line image and controls are visible in `screenshots/narrow-controls-green.png`. The final iframe screenshot `19-opaque-narrow-compose.png` was refreshed and inspected after the fix.

### Local HTTP and opaque-origin gallery — pass

Started a development-only server:

```sh
python3 -m http.server 8779 --bind 127.0.0.1
agent-browser --session afterimage-http --proxy http://127.0.0.1:9 --proxy-bypass '127.0.0.1,localhost' open http://127.0.0.1:8779/index.html
```

This was a fresh browser session. Port 9 was closed, so all non-loopback internet requests were blocked, while the local server stayed reachable. Verified the boundary by opening `https://example.com/` in a separate tab: actual Chrome `ERR_PROXY_CONNECTION_FAILED` / `No internet` output is preserved in `logs/blocked-external-probe.txt`. That intentional probe is separate from application requests. There were no external resources cached for the app. Standalone HTTP Fold → Recover worked; screenshot `14-local-http-recovery.png`.

The authored `opaque-frame.html` contains exactly `sandbox="allow-scripts allow-downloads"` on its iframe. Ran `python3 evidence/iframe-checks.py` against the same proxy-blocked browser. All **5 groups passed** on the final artifact:

- Live frame origin was **`null`**. An isolated test probe of `localStorage` threw `SecurityError`. The app itself never touches storage and started normally.
- Used visible Make a memory, ordinary labeled text input and Enter to author `MEND`; a real pointer stroke erased **63 tiles**. Recover reconstructed that actual payload exactly.
- Same Fold comparison in the frame: Rows left **96 unknown**, Woven left **0**, preserving the authored image.
- Visible Save project produced a real **6,562-byte** Chrome download containing `MEND` and its damage. Reset, visible Open project and the ordinary file input restored it exactly. Duplicate-erasure import preserved the current state. About's full source URLs remained selectable without following links; Escape closed it.
- At **390×844**, Fold → Recover worked; new `TINY` inscription worked and controls fit with no horizontal overflow. Reload cleared memory edits, damage and history. Uncaught errors **0**, console empty, requests **local harness/index HTML only**.

Exact actions, live diagnostics and output are in `logs/iframe-commands.jsonl`; compact results in `logs/iframe-results.json`; screenshots `15`–`19`. `opaque-download.json` and the files in `opaque-downloads/` are actual downloads, not generated substitutes.

Tool and harness limitations were investigated rather than treated as passes:

- Agent-browser 0.31.1's CSS frame selector and semantic find/eval did not consistently scope into the opaque target. Fresh accessibility refs from `snapshot -i` did support actual clicks, fills and keyboard/pointer input. Those remain the primary browser workflow. The auxiliary `cdp-probe.mjs` attaches to Chrome's actual iframe target for read-only live diagnostics and `DOM.setFileInputFiles` on the ordinary file input after clicking Open project. It does not assign application state or call hidden UI handlers. Failure preserved in `logs/iframe-locator-tool-failure.json`.
- CLI `download` timed out inside the frame even though Chrome completed its download. Investigated Chrome download history and the genuine output file, retained as `opaque-completed-default-download.json`. A disconnected CDP download-path setting also reverted, so it was replaced with `cdp-download-watch.mjs`, which keeps its connection alive while agent-browser clicks Save and verifies the actual completed download event/path. Evidence: `logs/iframe-download-tool-failure.json`, `logs/iframe-download-path-probe.json`, and later successful events in `iframe-commands.jsonl`. No fake export or page-state shortcut was used.
- The initial local harness requested an absent favicon (404). Added an embedded data favicon to the **test harness**; this was not a runtime dependency of the app. The final app-only interval has no failed requests. An early network assertion included retained Chrome Downloads/proxy-probe traffic; preserved in `logs/iframe-request-scope-failure.json`, then cleared browser request history before the genuine app run. No app request was excluded from that run.
- A final rerun stopped with `ERR_CONNECTION_REFUSED` when the development server ended. Saved in `logs/iframe-server-interruption.json`. A background `nohup` restart did not persist in this harness. Restarted the foreground server in an active exec session and reran all five iframe groups successfully against the final CSS. This was infrastructure interruption, not a product fix.

### Final verification and delivery status

Final product changes were the import race fix and narrow-control CSS fix. Ran:

```sh
python3 evidence/narrow-control-check.py green
node --test evidence/codec.test.cjs
python3 evidence/browser-checks.py
python3 evidence/iframe-checks.py
python3 evidence/inspect-artifact.py
```

Observed: layout regression **pass**, codec **5/5 pass**, direct-file workflow **14/14 pass**, opaque iframe **5/5 pass**. The independent active-import regression also passed after its fix. Product source was unchanged during these final checks.

Static inspection reports **59,254 bytes**, two inline scripts, embedded favicon/SVG fragments only, zero external runtime asset references, and no network/storage API tokens. Only the three optional source hyperlinks are HTTPS references. SHA-256 and exact inspection output are in `logs/artifact-inspection.json`. The live request checks substantiate the source inspection; it is not used as a substitute for interaction.

| Public check | Final authored status | Evidence |
| --- | --- | --- |
| Live subject research and interactive prior art | pass | `research.md`, actual `web__run` history: three read sources / three domains |
| Distinct concept and three original commitments | pass | `research.md`, `design.md`, delivered About and verified workflows |
| Main interaction and non-preset authored input | pass | Pointer/keyboard workflows, decoded byte comparisons, screenshots |
| Second path, boundaries, history, portability and Reset | pass | Rows/Woven, excess loss, invalid imports, actual downloads, delayed-import regressions |
| Desktop, narrow, live state and browser errors | pass | 1280×800 / 390×844 / 2× DPI, refreshed screenshots, console/request logs |
| Direct file and opaque iframe without external resources | pass | Offline direct-file run, blocked-proxy iframe run, origin null and denied-storage probe |

All three original behavioral commitments are fulfilled. No required check remains blocked and no known application failure remains unresolved. Coverage limits: Chromium only; narrow viewport was browser emulation, not a physical touch device. Focus loss used real Tab during a held pointer; cancellation used a standard synthetic pointercancel after real pointerdown, not native OS cancellation. Exhaustive combinations of every possible erasure pattern were not enumerated; the codec tests cover every supported loss count through its threshold with varied band positions, independent polynomial values, failure thresholds and all-loss boundaries. Audio is not part of this experience. An optional Pillow-based PNG inspection was not run because Pillow was unavailable; the actual downloaded PNG header/dimensions and rendered browser output were checked.

The app is deliberately limited to known-location erasures, a 24×24 drawing and eight inks. It makes no archival, encryption, QR/CD compatibility, or arbitrary corruption-correction promise. Reload and whole-session Reset clear the session; user-initiated files are the only portable records.

After validation, stopped the owned temporary server (PID 2231742). It was inspection tooling only; delivered `index.html` runs directly from disk.
