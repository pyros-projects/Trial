# Public acceptance scenarios: Config Workbench: Structural Diff and Merge

These are model-visible domain checks, not an automated test suite. Start each independent scenario from a documented clean seed or explicitly record which preceding state it uses. UI paths must be exercised in the browser; concurrency, authorization, and durability must also be checked against real server responses and persisted state. Statuses are pass, fail, blocked, or not-run; only observed evidence earns pass. Fixed fixtures illustrate the rules, not permission to hard-code outcomes.

## CFG-01: Synchronized editing and invalid buffer

**Exercise:** Edit a nested primitive in the tree, then type invalid JSON in the text pane and switch views.

**Expected:** Valid edits synchronize. Invalid text remains recoverable; publish is blocked and the last valid model is not silently presented as the current saved edit.

## CFG-02: Known three-way merge

**Exercise:** Merge the supplied base/left/right fixture.

**Expected:** Exactly rate and description conflict. Independent beta=true, burst=250, and endpoints changes survive.

## CFG-03: Conflict resolution and undo

**Exercise:** Choose left rate and right description, publish the merged result, undo the draft merge application, then restore the saved version as a new version.

**Expected:** Resolved content equals expected.json. Input versions remain unchanged, undo restores the prior draft, and history records a new restore version.

## CFG-04: Presence, types, arrays, and paths

**Exercise:** Exercise missing versus null, deletion versus edit, reordered object keys, concurrent array edits, and keys containing / and ~.

**Expected:** Defined merge/diff rules are followed, JSON Pointer paths are correctly escaped, and conflicts do not discard data.

## CFG-05: Schema and stale saves

**Exercise:** Attempt an out-of-range port, a wrong Boolean type, an unsupported schema keyword, and two competing saves.

**Expected:** Validation is explicit, unsupported semantics are not silently ignored, and the stale save cannot replace the newer head.

## CFG-06: Persistence and import safety

**Exercise:** Restart and inspect histories/diffs. Import malformed or schema-invalid input.

**Expected:** Published versions persist unchanged; a failed import cannot destroy the current valid document.
