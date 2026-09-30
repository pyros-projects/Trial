# Afterimage implementation plan

> **For agentic workers:** use superpowers:executing-plans to implement this plan task-by-task. This run is executed inline as explicitly requested by the user.

**Goal:** Deliver a complete offline creative experiment in erasure coding and spatial resilience.

**Architecture:** A pure byte codec feeds in-memory transactional application state and two Canvas renderers. UI operations mutate actual payload/damage state; decoding consumes only surviving encoded bytes. Everything is embedded in one HTML file.

**Tech stack:** HTML, CSS, vanilla JavaScript, Canvas 2D, inline SVG. Node built-in test runner for codec development; agent-browser for real-browser inspection.

**Spec:** `evidence/design.md`; commitments in `evidence/research.md`.

## Global constraints

- Deliver self-contained `index.html`; no runtime network, libraries, imports, build step, or persistent stores.
- Keep all session changes in memory; Reset invalidates pending imports and returns the initial state.
- Support direct disk opening and `sandbox="allow-scripts allow-downloads"`.
- Main workflow works at 1280×800 and 390×844 with pointer and keyboard input.
- Keep evidence and test harnesses outside `index.html`.

## Review focus

- Exactly p versus p+1 missing symbols: correct threshold, honest partial recovery.
- Same physical fold under both layouts: damage distribution changes, payload does not.
- Malformed/oversized/stale import: never overwrite the current experiment.
- Pointer cancellation or focus loss: no stuck brush, one undo transaction.
- Opaque origin, direct file, blocked internet: no denied storage or runtime fetch assumption.

## Task 1 — Exact codec

Produces `AfterimageCodec.encode(pixels, p)`, `.decode(received, p)`, `.physicalToLogical(row, col, p, layout)`.

- [x] Write `evidence/codec.test.cjs` against the embedded codec. Assert systematic encoding, exact round trips on novel data, varied patterns at every supported loss count through p erasures, and honest unresolved pixels above the threshold.
- [x] Run `node --test evidence/codec.test.cjs`; observe missing-codec assertion failures.
- [x] Implement the GF(256) arithmetic, interpolation, and layout mapping in `index.html`.
- [x] Run the suite and inspect all results. Include fold comparison and zero/all-loss boundaries.

## Task 2 — Complete workshop

Consumes the codec. Produces source composition, damage surface, actual recovery, diagnostics, and transaction history.

- [x] Build deliberate responsive visual identity and initial moth artwork.
- [x] Connect draw/inscribe, scratch/inspect, brush sizes, rain/fold, re-store, redundancy/layout, recover, comparison preview, and per-band diagnostics.
- [x] Connect stroke transactions, undo/redo and keyboard navigation. End strokes on cancellation/focus loss.
- [x] Browser-test main workflow and non-preset input; inspect result bytes and rendered output.

## Task 3 — Portable lifecycle

- [x] Implement project JSON download and validated file restore, guarded against pending stale reads. Implement recovered PNG download.
- [x] Add Reset session and selectable secondary About/source note.
- [x] Test round-trip, malformed import, reset/reload, and arbitrary source edits with browser controls.

## Task 4 — Validation and repairs

- [x] Exercise both declared paths and all commitments at desktop and narrow sizes.
- [x] Inspect errors, console, requests, rendered output, focus loss, pointer cancellation, and high-DPI resizing.
- [x] Check direct file and opaque-origin iframe with external network blocked and uncached resources.
- [x] Reproduce each observed failure, fix its cause, retest its flow and a compact regression.
- [x] Record commands, observed results, limitations, and screenshot/log paths in `evidence/validation.md`.
- [x] Final source/behavior review and fresh verification before delivery.

## Completion

All tasks completed. The erasure suite covers varied positions at every supported loss count, not an exhaustive enumeration of every possible subset. Final codec, real direct-file workflow, opaque iframe workflow and repaired boundary regressions pass; detailed evidence and limitations are in `validation.md`. No runtime dependency or server is required.
