# Selvedge — agent-authored validation

Date: 2026-09-08. Artifact: `../index.html`. This is a development/test record, not an evaluator report.

## Tooling and setup

- Read installed `.agents/skills/agent-browser/SKILL.md`, then ran `agent-browser skills get core`, `agent-browser skills get core --full`, and `agent-browser skills get dogfood`. Browser CLI version 0.31.1; Chrome 143.0.7499.40.
- The optional, incorrectly guessed `--allow-file-access-from-files` flag was rejected as unknown. Ran `agent-browser doctor --offline --quick`: 11 passes, no failures. Standard `agent-browser --session selvedge open file:///home/pyro/projects/naked/astra/bench/24-capstone/index.html` succeeded with no special file flags. No substitute browser was needed.
- First temporary HTTP port 8765 was already in use. Started the permitted dev server on 8847 instead: `python3 -m http.server 8847 --bind 127.0.0.1`.
- Tests and evidence are separate files. The app itself uses no dependencies, build, network, storage or audio.

## Engine tests

Command: `node evidence/engine.test.cjs`.

- Pre-implementation RED: assertion failed because the delivered artifact/engine did not yet exist. Exact output: `logs/engine-red.txt`.
- Initial GREEN: 9 tests passed against the actual embedded script. Output: `logs/engine-green.txt`.
- Independent fixtures cover plain weave (max 1, 50% warp), 2/2 twill (max 2), a cyclic three-thread seam run, all-warp (8 unbound yarns for a 4×4 mathematical fixture), mirrored/complemented reverse, one-crossing binding (8→6 unbound), no unnecessary change to plain weave, exact project round trip, and invalid shapes/colors/size/name/version/rhythm.

## Desktop first workflow — PASS, with one feedback defect found

Commands used:

```sh
agent-browser --session selvedge set viewport 1280 800
agent-browser --session selvedge network route 'http*' --abort
agent-browser --session selvedge reload
agent-browser --session selvedge snapshot -i
agent-browser --session selvedge screenshot evidence/screenshots/desktop-initial.png
agent-browser --session selvedge errors
agent-browser --session selvedge console
agent-browser --session selvedge network requests
agent-browser --session selvedge find role button click --name 'Row 2, column 3: weft over'
agent-browser --session selvedge press ArrowRight
agent-browser --session selvedge press Space
agent-browser --session selvedge find role button click --name Reverse
agent-browser --session selvedge screenshot evidence/screenshots/desktop-edited-reverse.png
```

Observed: initial max float 3, no unbound yarns, warp fraction 0.5. First click changed row 2 column 3 from 0→1; keyboard moved to column 4 and changed 1→0. History contained two transactions; the selected cross-section and rendered reverse changed. Canvas screenshot was inspected, not just the DOM. No console or uncaught errors. Network list contained only the local file document.

## ISSUE-001 — binding status used old state — FAIL at discovery

Reproduction:

```sh
agent-browser --session selvedge select '#pattern' unbound
agent-browser --session selvedge find role button click --name 'Float lens'
agent-browser --session selvedge find role button click --name '+ Bind one float'
agent-browser --session selvedge --json eval '({diag:selvedge.diagnostics(),status:document.getElementById("status").textContent})'
agent-browser --session selvedge screenshot --full evidence/screenshots/first-binding-feedback.png
```

Observed: real diagnostics reported 14 unbound yarns after one binding, while the status said `16 → 16`. The canvas/lens and structural state updated correctly. Root cause: the message argument was interpolated before the `change` callback applied the next state. Fix and retest pending below.

ISSUE-001 fix: compute the message's resulting count from `result.cells` before applying the transaction. Retest: all-warp → Bind shows `16 → 14`, matching 14 in diagnostics. Evidence: `screenshots/binding-fixed.png`. The regression is also in browser-checks.py.

## ISSUE-002 — import error below the visible viewport — FAIL at discovery

A malformed import correctly preserved project/history and produced an explanatory message, but that message lived in the page footer below the 1280×800 viewport. A user clicking Open could not see it without scrolling. Reproduced by opening `evidence/invalid-project.json` (malformed JSON) with the Open control and ordinary file input. Screenshot: `screenshots/invalid-json-before-notice.png`; actual bounding rectangle: `logs/error-visibility-before.json`. Fix: show operation feedback as a compact floating notice; errors remain visible until the next action, and informational notices return to the footer after a bounded timer. Timers are replaced/canceled on subsequent actions and reset. Retest recorded below.

## Harness adjustments (not application defects)

The command log and intermediate run logs are preserved. Initial canvas comparisons read pixels before the next animation frame; tests now await two actual animation frames. This synchronization made the opposite-face pixel test pass. The installed CLI requires integer mouse coordinates and does not support `find label … select`; the harness now rounds pointer coordinates and uses the corresponding visible select control by its ID. A long exact accessible-name lookup for a download action was unreliable; the action was snapshotted and then clicked by ID. One browser session restarted to about:blank between commands; the test now explicitly opens the delivered file at its start. No app code was changed for these harness issues.

Download setup required a live auxiliary CDP connection: Chrome reverted Browser.setDownloadBehavior when that configuration client disconnected. Keeping the connection open during real Save-button actions produced the actual JSON and PNG files. The attempted explicit default browserContextId was rejected by Chrome; the successful setup leaves it omitted. Python websocket-client was unavailable, so the auxiliary CDP configuration uses Node's built-in WebSocket. All user interactions continue to use agent-browser; this is not a browser substitution. Re-uploading the exact same path without clicking Open did not fire another change event; tests now use the user's actual Open → file selection workflow, which clears the input before each selection.

## Final verification results

All three original behavioral commitments are fulfilled by the delivered application. No required validation capability remains blocked. The three application defects found during development and final review were fixed and their original flows retested.

| Check | Result | Observed evidence |
| --- | --- | --- |
| Research and concept choice | PASS | Four actually opened/read primary pages on four domains; subject explanations and nearby interactive tools; three candidates and explicit Trial comparison in research.md. |
| Crossing → cloth | PASS | Pointer, continuous canvas strokes, keyboard, undo/redo; two separate repeat locations change from pale weft pixels to rust warp pixels after one edit; mirrored reverse exposes the pale complementary yarn. Cross-section and live crossing state agree. |
| Beauty → structure | PASS | Plain=1, 2/2 twill=2, seam-spanning run=3; all-warp is explicitly unbound. Binding changes one real crossing (16→14 unbound for 8×8; 32→30 for 16×16). Repeated repair reaches an interlaced structure. Both-face inspection and local-improvement feedback work. |
| Experiment → keep → recover | PASS | Real JSON and 1600×1200 PNG downloads; ordinary file-input restore; exact state roundtrip; reversible import; malformed/schema-invalid/oversized imports preserve project and history. Reset/reload restore initial data and views. |
| Desktop / narrow layout | PASS | 1280×800 and 390×844 real input and screenshots; no horizontal overflow at 390. Canvas plus the scrolled repeat editor remain editable. |
| Pointer interruption | PASS | Release outside ends a stroke; Escape rolls back; native touchCancel rolls back; touch works again immediately; focusing the parent while a captured stroke is active cancels it without history pollution. |
| Direct-file offline operation | PASS | Opened file:///home/pyro/projects/naked/astra/bench/24-capstone/index.html in Chrome. All HTTP(S) routed to abort and offline mode enabled. Actual editing, downloads/imports/reset exercised. No external resource fetches. |
| HTTP without external internet | PASS | App document at http://127.0.0.1:8847/index.html; a fresh named browser used an unreachable external proxy with loopback bypass, plus HTTPS abort routing. Cache cleared and a live cache-disable CDP connection used. App resource entries remain empty; local server remains reachable. |
| Opaque gallery sandbox | PASS | Actual iframe uses exactly sandbox="allow-scripts allow-downloads". Live origin="null"; localStorage and parent-document access produce SecurityError. Pointer/keyboard edits, floats, binding, file downloads/restoration, invalid import, reset/reload, and narrow viewport work. |
| Late callback after Reset | PASS | Test-only delay around native FileReader: user Open → selected real file → pending=true → user Reset → delayed native read/load arrives. Initial project and empty history remain. Repeated inside the opaque-origin iframe. |
| Sources remain usable in sandbox | PASS | About opens/closes; four titles and full URL strings embedded. Actually dragged a selection over https://adacad.org/ inside the sandbox; selection returned that text and did not fetch a resource. |
| Console / requests | PASS | Final desktop and opaque runs: console messages=[], uncaught errors=[]. Latest local document loads return 200; external HTTP requests=[]. Earlier test-host failures are retained and explained below. |
| Audio / pause transport | NOT APPLICABLE | This is an immediate authoring/inspection tool with no audio or advancing simulation. No listening or playback claim is made. |

### Exact reproducible test commands

Run from `/home/pyro/projects/naked/astra/bench/24-capstone`:

```sh
node evidence/engine.test.cjs
python3 evidence/bands-checks.py
python3 evidence/browser-checks.py
python3 evidence/boundary-checks.py
python3 evidence/iframe-checks.py
```

- `engine.test.cjs`: **10 passing** engine tests. `logs/engine-final.txt`.
- `bands-checks.py`: **13 passing** rendered color-period and interaction assertions. `logs/bands-checks-final.txt`.
- `browser-checks.py`: **42 passing** browser assertions. `logs/browser-checks-final.txt`.
- `boundary-checks.py`: **9 passing** native touch, late callback, workload and high-DPI checks. `logs/boundary-checks-final.txt`.
- `iframe-checks.py`: **21 passing** sandbox assertions. `logs/iframe-checks-final.txt`.

Each Python harness contains the exact action order and independent assertions. Actual agent-browser invocations, arguments, responses, and auxiliary CDP diagnostics are retained in `logs/browser-commands.jsonl`. Browser actions use the installed CLI's navigation, snapshots/refs, labeled controls, mouse, keyboard, file input, and screenshot commands. The iframe harness starts and shuts down its own temporary local HTTP server.

To reproduce the HTTP browser's external-network isolation before the iframe script:

```sh
agent-browser --session selvedge-http --proxy http://127.0.0.1:9 --proxy-bypass '127.0.0.1,localhost' open http://127.0.0.1:8847/index.html
agent-browser --session selvedge-http network route 'https://*' --abort
node evidence/cdp.mjs selvedge-http Network.clearBrowserCache
node evidence/cdp.mjs selvedge-http Network.setCacheDisabled '{"cacheDisabled":true}' --hold
```

The initial server must be running for that first URL; `iframe-checks.py` manages it for its own test. The `--hold` helper intentionally stays connected until terminated. The file harness configures its own offline/abort behavior and temporary download directory. Tests need Node, Python and installed agent-browser only as development tools; none are runtime dependencies of index.html.

### Rendering optimization and retest

The first 16×16 high-DPI stress run observed long tasks of 108, 106 and 174 ms, with a binding-command round trip of 149.69 ms. The renderer was drawing every repeated yarn crossing separately. It now renders the least common repeat of crossing structure and yarn colors once and tiles that texture at the exact thread pitch; the float overlay uses the same approach. This changes the execution cost, not the crossing model.

The first optimized 24,576-visible-crossing, 2× backing-resolution check measured a 73.00 ms binding-command round trip and no observed long tasks. The final run after the color-period correction measured **102.88 ms** and one observed **51 ms** long task. These are observations on this shared machine, not a general performance guarantee. At most 16×16 authored crossings and 36,864 displayed crossings are allowed; redraws are scheduled only when needed, pixel ratio is capped, and zoom changes how many repeats are shown. Before/after logs: `logs/boundary-checks-before-optimization.txt`, `logs/boundary-checks-final.txt`. The whole browser suite plus opposite-face yarn-pixel checks and the sandbox workflow were rerun after this material change.

### Additional tooling limits and recovered setup failures

- The installed agent-browser successfully snapshots and clicks controls inside the opaque iframe, but its `eval` stayed in the parent context; it also initially failed a frame-selector lookup. Source-backed frame assertions use a read-only auxiliary CDP connection attached to the actual iframe's default execution context. User input and screenshots still use agent-browser. This is recorded as a tool limitation with successful supplemental coverage, not a blocked app check.
- Native touch start/cancel/end must share one CDP connection. The first attempt used separate connections; Chrome rejected touchCancel because the new connection had no prior touch. The final helper keeps the same session and reads actual app state between native input events.
- The original temporary HTTP server was terminated (exit 143), causing a later navigation to fail with connection refused. The iframe harness now owns a server process for the duration of the test. An early host-only `/favicon.ico` 404 was fixed by embedding a data favicon in `evidence/iframe.html`. These failed requests remain visible in historical logs; the delivered app had an embedded favicon from the start. Final app and host document loads are 200 and final console/error lists are empty.
- The FileReader timing wrappers exist only in the test harness evaluation, are explicitly documented, use the real native reader and file data, and are cleared by reload. No input fixture or expected result was altered to make application behavior pass.

### Screenshots and actual downloaded artifacts

- [Delivered desktop, full page](screenshots/delivered-desktop-full.png)
- [Delivered 390×844 view](screenshots/delivered-mobile.png)
- [Edited reverse face](screenshots/desktop-edited-reverse.png)
- [Unbound float lens](screenshots/desktop-unbound-lens.png)
- [Repaired cloth in float lens](screenshots/desktop-repaired-lens.png)
- [Visible invalid-import feedback after fix](screenshots/invalid-import-notice.png)
- [Mobile repeat editing and keyboard focus](screenshots/mobile-editor.png)
- [Native touch at 2× pixel density](screenshots/mobile-retina-touch.png)
- [Largest repeat at 2× pixel density](screenshots/maximum-repeat-retina.png)
- [Opaque iframe desktop interaction](screenshots/iframe-desktop-edited.png)
- [Opaque iframe narrow interaction](screenshots/iframe-mobile-edited.png)
- [Actual source URL selection in the sandbox](screenshots/iframe-selectable-sources.png)

`downloads/run-*/` contains actual saved editable JSON and PNG swatches from direct-file tests. `downloads/iframe-*/` contains actual downloads produced by the opaque-origin iframe. The PNG signatures/dimensions were checked and a real downloaded image was visually inspected. Representative desktop, narrow, reverse, lens, error-feedback and source-selection screenshots were opened and visually inspected during development; screenshots are evidence of rendering in addition to the interaction/state assertions.

### Artifact audit and remaining limitations

The delivered index.html has two embedded script blocks, one embedded stylesheet, a data-URI favicon and original procedural canvas artwork. Static inspection found no external script/style imports, runtime fetch/XMLHttpRequest, storage calls, cookies, service worker, or runtime assets. About-source URLs are selectable text/optional links and do not automatically load. The final file's size and SHA-256 are in `logs/artifact-audit.json`.

No unresolved application failures or blocked required checks remain. Other browser engines and a full screen-reader audit were **not run**; keyboard controls, accessible labels, focus recovery, Chrome desktop/mobile emulation and native touch were tested. Selvedge remains an educational periodic weave model: it does not calculate material strength, tension, friction, shrinkage, finishing, selvage behavior or loom feasibility. Binding is a local single-crossing improvement and may require manual coordinated edits. History is bounded to 80 project transactions; downloads preserve the current project rather than its history or view state.

Independent final code review found the color-period issue documented below; it was reproduced and corrected. The targeted follow-up found no remaining critical, important or minor findings. Its checks are summarized below.

## ISSUE-003 — 12-thread color-band seam — FAIL at discovery, PASS after fix

The independent reviewer found that “4 + 4 bands” wrapped yarn indices at the crossing repeat size. With 12 crossings, adjacent base-color blocks joined into eight threads. The actual browser reproduction used Reset → Repeat 12×12 → Yarn rhythm 4+4 bands → All warp. Sampling 24 rendered crossing centers observed `AAAABBBBAAAAAAAABBBBAAAA`, while the control promises `AAAABBBBAAAABBBBAAAABBBB`. The same failure was reproduced with a new engine test before editing implementation. Evidence: `logs/bands-render-before-fix.json`, `logs/engine-band-before-fix.txt`, `screenshots/12-thread-bands-before-fix.png`.

Fix: yarn colors now repeat independently every eight threads. The renderer tiles the least common repeat of color and crossings (24 threads for this case), so both axes retain four-and-four bands. Reverse mirroring includes the full yarn period. The outlined representative repeat stays aligned to the editor and cross-section yarn indices; float overlays retain the smaller structural repeat. A contextual note explains why color and structure meet again after 24. No original commitment was removed.

Retest: `python3 evidence/bands-checks.py` passed 13 real-browser assertions, including actual front/reverse cloth pixels, both yarn axes, rendered inspector colors, the overlay across both halves, a pointer edit in the second color phase, undo, keyboard editing, mobile layout and reset. The failing engine test now passes (10 total). Screenshots `12-thread-bands-front-fixed.png`, `12-thread-bands-reverse-fixed.png` and `12-thread-bands-mobile-fixed.png` were opened and visually inspected. The full 42-assertion authoring workflow, 9-assertion native-touch/async/performance boundary workflow, and 21-assertion opaque-iframe workflow were then rerun successfully against the delivered code.

## Independent review outcome

The read-only final reviewer confirmed the seam finding was resolved and reran all 10 engine tests. It also inspected the renderer with isolated recording contexts, checking 162 supported size/rhythm/face/zoom/viewport configurations, 25,056 outlined crossings, and float overlays against an independent cyclic-run calculation. This is supplementary code-level evidence; the real-browser rendered-pixel/input tests above remain the acceptance evidence. The reviewer reported no remaining findings.

Final handoff inspection: opened the current delivered desktop and 390×844 screenshots, the unbound and repaired lenses, maximum-size retina rendering, and the new mixed-period front/reverse/mobile screenshots. File resource entries remain empty. Final direct-file console and uncaught-error outputs are empty (`logs/final-console.json`, `logs/final-errors.json`). The artifact audit inspects executable scripts separately from selectable source prose, avoiding a false-positive match on the word “fetch” in the About text.

The reviewer supplied its exact two Node recording-context checks; their bodies are preserved in `review-renderer.test.cjs`. Reproduced with `node evidence/review-renderer.test.cjs` (exit 0): the same 162 configurations / 25,056 outlined crossings passed, and 8 front/reverse overlay cases / 2,496 flagged cells matched. Exact output: `logs/review-renderer-final.txt`.
