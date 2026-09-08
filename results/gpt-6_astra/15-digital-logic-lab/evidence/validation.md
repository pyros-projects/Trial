# Bitwise laboratory validation

Agent-authored implementation evidence. No evaluator results are claimed.

Artifact: `../index.html`. Runtime: one HTML file, embedded CSS/JavaScript/SVG; no runtime dependencies.
Tool: installed `agent-browser`, core and dogfood workflows loaded with `agent-browser skills get core` and `agent-browser skills get dogfood`; taxonomy read from the version-matched skill directory.

## Development checks

- `node evidence/tests/engine.test.cjs`: initially FAIL because the deliverable did not exist (`logs/engine-red.txt`). Implemented the engine and reran: PASS all nine behavioral groups (`logs/engine-green.txt`). Independent expected values cover half-adder rows, counter rollover/reset, rising-edge register, connected CPU instructions, invalid direction/width, unknown imported component, bounded feedback, and preset compilation.
- `node --check < evidence/app.tmp`: PASS. An earlier `node --check evidence/app.tmp` was rejected by Node because `.tmp` is an unsupported extension; rerun through stdin passed.

## Browser checks

Started with:
```
agent-browser --session bitwise open file:///home/pyro/projects/naked/astra/bench/15-digital-logic-lab/index.html
agent-browser --session bitwise set viewport 1280 800
agent-browser --session bitwise snapshot -i
agent-browser --session bitwise screenshot evidence/screenshots/01-desktop-initial.png
agent-browser --session bitwise errors
agent-browser --session bitwise console
agent-browser --session bitwise network requests
```
Direct file navigation loaded successfully. Initial console and uncaught-error logs were empty. Network showed only the local HTML document.

### Issue 1 — overlapping multi-input ports (high, fixed and retested)
Observed in `screenshots/02-desktop-fit.png`, after clicking `Fit circuit (F)`: both XOR inputs occupy the same point above the component. Live bounding boxes confirmed identical y coordinates. `node evidence/tests/port-layout.cjs` fails with “Separate input ports must have distinct usable pointer targets” (`logs/ports-red.txt`). Root cause: port layout computed an index by object identity across separately generated port definitions. Fix will index by port name.

### Issue 2 — initial viewport fit (medium, fixed and retested)
`screenshots/01-desktop-initial.png` shows the initial circuit at 22% after browser viewport was set to 1280×800. Clicking Fit produces 62% and a usable layout (`screenshots/02-desktop-fit.png`). Add automatic fit during resize until the user explicitly pans or zooms; preserve user views afterward.

### Issue 3 — source selection also chosen as truth-table output (low, fixed)
After toggling B, generating the table automatically included selected input B as an output, producing an extra B column. The actual Sum and Carry values were correct. Evidence: `screenshots/issue-03-truth-selection.png`, `logs/browser-main-first-failure.txt`. Fixed implicit output selection to exclude source components; explicit output marking still permits them. Retest: exact four-row half-adder table PASS in `logs/browser-main.txt`.

### Accessible Run label (low, fixed)
The Run label became `RunSpace` after pause, because adjacent spans had no text separator. Added stable explicit `Run simulation` / `Pause simulation` accessible names. The recorded failed locator is in `logs/browser-main-label-observation.txt`; subsequent real Run/Pause workflow passed.

### Desktop public workflows — PASS
`node evidence/tests/browser-main.cjs` ran the actual controls and live diagnostics. Exact commands and observed values are in `logs/browser-main.txt`:
- All four half-adder inputs, correct Sum/Carry.
- Delete AND→Carry wire, observe Z, reconnect using labeled output/input ports, toggle B and observe Carry=1.
- Attempt output→output connection: rejected, wire count unchanged.
- Enumerate actual graph: 00→00, 01→10, 10→10, 11→01; original state preserved.
- Palette add, duplicate, selection deletion, keyboard undo/redo.
- Counter steps 0→1→2, Run until >=5 ticks, Pause, matching live waveform, Reset to 0.
- Register holds its value between rising edges; captures 6 then 7.
- Tiny CPU manually executes ten instructions; output sequence 0,0,0,1,1,1,2,2,2,3 and analyzer agrees.
- Named project save/open, reload autosave, pan by mouse drag, zoom and fit.
- Console/uncaught errors empty; only file document requests.
Screenshots: `04` through `10`.

### Issue 4 — mobile toolbar overflow (medium, fixed and retested)
At 390×844, the rightmost toolbar controls are clipped (`screenshots/11-mobile-initial.png`). Make the tool strip horizontally scrollable and keep mobile settings reachable in the header. Circuit and analyzer themselves fit the viewport; editing validation follows the fix.

## Final status and additional coverage

All checks listed as PASS below completed against the delivered implementation. No known failing application check remains. Automation mistakes were retested with the corrected interaction, rather than counted as passes.

| Check | Status | Evidence |
|---|---|---|
| Self-contained artifact opens directly with `file://` | PASS | `logs/browser-main.txt`, `logs/browser-mobile.txt`, direct-file screenshots |
| Desktop at 1280×800 | PASS | `screenshots/28-final-desktop-clean.png`, `logs/browser-http.txt` |
| Narrow viewport at 390×844, DPR 2 | PASS | `screenshots/26-final-mobile.png`, `logs/browser-mobile.txt` |
| Real palette add, move, ports, switch/gate/output propagation | PASS | `logs/browser-main.txt`, `logs/browser-mobile.txt` |
| Selection rectangle, copy/paste, internal wires, delete/undo/redo | PASS | `logs/browser-editing.txt`, `logs/browser-events-large.txt` |
| Keyboard port connection and focus continuity during Run | PASS | `logs/browser-editing.txt` |
| Selected components/wires preserved across resize | PASS | `logs/browser-editing.txt` |
| Trusted touch tap, connected gate drag, two-finger pinch | PASS | `logs/touch-smoke.json`, `screenshots/24-touch-pinch.png` |
| Manual propagation event visibly precedes downstream settling | PASS | `logs/browser-events-large.txt`, `screenshots/22-event-stepping.png` |
| Clock step, run, pause, speed control, reset and live samples | PASS | `logs/browser-http.txt`, `logs/browser-mobile.txt` |
| CPU program execution and same-edge register capture | PASS | `logs/browser-http.txt`, `logs/review-final.txt` |
| Named probes and stable historical identity after edits | PASS | `logs/browser-editing.txt`, `logs/review-final.txt` |
| Analyzer time axis, zero-delay timestamps, bounded capture/HOLD | PASS | `logs/review-final.txt`; `screenshots/28-final-desktop-clean.png` |
| Truth-table rows and Boolean expression from actual graph | PASS | `screenshots/06-truth-table.png`, `logs/browser-http.txt` |
| Invalid direction, incompatible width, malformed/prototype JSON | PASS | `logs/browser-portable.txt`, screenshots `05`, `17`, `18` |
| Actual seeded oscillator contained at step limit, X displayed | PASS | `screenshots/19-oscillation-contained.png`, `logs/browser-portable.txt` |
| Diagnostics: loops, queue, order, domains, floating values | PASS | `screenshots/20-diagnostics.png`, `logs/browser-portable.txt` |
| Named project save/open and local autosave reload | PASS | `logs/browser-http.txt`, `logs/browser-main.txt` |
| Download JSON, SVG, PNG, waveform CSV; reimport; share link | PASS | `exports/counter.*`, `exports/share-link.txt`, `logs/browser-portable.txt` |
| RAM write/read, SR latch memory, ALU operations | PASS | `logs/browser-portable.txt`, `screenshots/21-memory-read-write.png` |
| All gate families, buses, mux, decoder, adder, comparator, latch | PASS | `logs/component-semantics-green.txt` |
| Dark appearance and distinguishable signal-color option | PASS | `logs/browser-mobile.txt`; screenshot `15`; final dark palette lightened for contrast |
| 300 components / 299 wires in actual browser | PASS | `screenshots/23-large-circuit.png`, `logs/browser-events-large.txt` |
| 1,500 components, engine propagation stress | PASS | `logs/performance-final.txt` |
| Uncaught errors and browser console after final flows | PASS | Empty `logs/final-browser-errors.txt`, `logs/final-browser-console.txt`, `logs/final-file-errors.txt`, `logs/final-file-console.txt` |
| Firefox, Safari, physical mobile hardware | NOT-RUN | Chromium desktop and emulated touch were tested |
| Audio | NOT APPLICABLE | This laboratory has no audio feature |

### Final commands

The scripts below call `agent-browser` for navigation, semantic controls, pointer and keyboard input, screenshots, downloads and uploads. Their logs contain every exact command and observed diagnostic value.

```
node evidence/tests/engine.test.cjs
node evidence/tests/component-semantics.cjs
node evidence/tests/review-edge-cases.cjs
node evidence/tests/review-performance.cjs
node evidence/tests/port-layout.cjs
node evidence/tests/browser-main.cjs
node evidence/tests/browser-mobile.cjs
node evidence/tests/browser-portable.cjs
node evidence/tests/browser-http.cjs
node evidence/tests/browser-events-large.cjs
node evidence/tests/browser-editing.cjs
node evidence/tests/touch-smoke.cjs
```

`port-layout.cjs` expects the file-session half-adder preset; the final port regression was also exercised by keyboard wiring and touch drag tests. `browser-http.cjs` repeats the main direct-file workflow against the isolated local HTTP origin. Test scripts and staging snapshots in this directory are development evidence, not application dependencies.

### Network isolation

Port 8765 was already occupied, so the temporary server used 18473; the preexisting server was untouched.

```
python3 -m http.server 18473 --bind 127.0.0.1
agent-browser --session bitwise-http open about:blank
agent-browser --session bitwise-http set viewport 1280 800
node evidence/tests/network-guard.cjs
agent-browser --session bitwise-http open http://127.0.0.1:18473/index.html
node evidence/tests/browser-http.cjs
```

The network guard uses CDP on the agent-browser browser to disable caching and intercept every HTTP(S) request, allowing only `127.0.0.1:18473`. All other HTTP(S) requests are failed with `BlockedByClient`. The guarded session was fresh. `logs/network-guard.txt` and `logs/final-http-requests.txt` show only the local document, with no external requests. The artifact also includes `connect-src 'none'` CSP and embeds its icon, styles, simulation, rendering, and controls. The final syntax/dependency audit is in `logs/artifact-final.txt`.

### Touch and tool limitations

The installed CLI exposes mouse/pointer controls but no desktop multi-touch command. For multi-touch only, `touch-smoke.cjs` uses the CLI's `get cdp-url` and sends trusted Chromium `Input.dispatchTouchEvent` commands to the same app. This supplements, rather than replaces, the main agent-browser workflow. Tap, drag and pinch were observed in live simulation/transform diagnostics and screenshots. No physical-device claim is made.

### Fixes from the second pass

- **Issue 1 retest:** port-name indexing gives distinct target positions; `logs/ports-green.txt` passes, and real reconnect/keyboard/touch flows pass.
- **Issue 2 retest:** automatic initial fit on resize works before user navigation; explicit pan/zoom views are preserved afterward. Resize tests preserve selection and every wire.
- **Issue 4 retest:** mobile toolbar now fits the primary tools and scrolls if needed; settings remain reachable in the header. 390×844 editing passes.
- **Waveform history:** preserved-state edits now restore simulation time before enqueueing new evaluations. The axis uses actual simulation units, and zero-delay external events and half-cycles advance logical time. Future uncaptured samples are not invented.
- **Review fixes:** type validation, full-ring HOLD, stable probe IDs, safe sample dictionaries, and uncertain RAM writes are described and reproduced in `review.md` and `tests/review-edge-cases.cjs`.
- **Floating latch enable:** a disconnected tri-state driving EN previously chose hold silently. The failing regression is in `logs/component-semantics-red.txt`; the fix reports X, and `logs/component-semantics-green.txt` passes.
- **Focus:** circuit rerendering preserves focused ports; inspector text entry is not rebuilt during simulation refreshes. Both are tested while Run is active.
- **Large circuit fit:** the fit scale can now go below 22%, so large examples remain visible as an overview.

Automation observations preserved honestly: an initial mobile locator targeted the hidden desktop Truth table control (`logs/browser-mobile-locator-observation.txt`); it was rerun through the visible analyzer tab. An import assertion ran before asynchronous file reading finished (`logs/browser-portable-import-wait.txt`); a condition wait for the circuit name fixes the harness. The first touch CDP attachment selected a different page; target selection now uses the exact file URL (`logs/touch-initial-target.json`). A combined regression inherited the Pan tool from the large-circuit flow and therefore panned instead of drawing a selection; it now explicitly selects the Select tool before marquee input (`logs/browser-editing-tool-state.txt`). Mouse coordinates were rounded because the CLI requires integers. These tool/harness failures were not application passes.

### Remaining limits

The simulator is idealized digital logic with whole-bus X/Z states, not per-bit uncertainty or analog timing. Configurable buses are 1–16 bits; RAM is 16 words; the CPU is an intentionally small 4-bit architecture. Truth tables accept at most 8 input bits, Boolean summaries at most 6 one-bit inputs. Capture retains 1,024 samples and up to 24 probes. Imports accept at most 1,500 components, 6,000 wires, and 4 MB of data. Browser performance was exercised with 300 components (96 ms for a complete CLI click plus propagation/render return in the first measured run); 1,500-component timings cover the engine only. A 24-probe, full-history analyzer at maximum clock speed was not stress-tested. Named projects depend on local browser storage; direct-file compact links need the recipient to have the same HTML file. Cross-browser and physical-device coverage remains not-run, with no blocked required check.

Final delivery check: `agent-browser --session bitwise set offline on`, direct-file reload, settings interaction and a real B input toggle still produced Carry=1; `performance.getEntriesByType('resource')` was empty (`logs/final-file-offline.txt`). Offline mode was restored to off afterward. The final dark contrast palette is shown in `screenshots/29-final-dark-contrast.png`; a small mobile analyzer-footer wrapping issue was corrected with non-wrapping metadata and an ellipsized hover readout. `screenshots/30-final-mobile-clean.png` is the final narrow default view. Latest inline-script syntax, artifact size and SHA-256 are in `logs/artifact-final.txt`. The temporary HTTP server and network guard were stopped after validation; the delivered file needs neither.
