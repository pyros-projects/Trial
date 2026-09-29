# Validation — Oatworks (a slime-mould network foundry)

Artifact: `index.html` (single self-contained file, no external deps).
Tool: `agent-browser` 0.31.1 (Chrome via CDP), session `capstone24`, served via
`python3 -m http.server 8642` for HTTP checks; also opened via `file://`.
Viewports tested: 1280×577–800 (desktop) and 390×844 (narrow/mobile).

## Public checks

### 1. Research — PASS
`evidence/research.md` records tool names, queries, and 7 sources actually opened
and read via `webfetch`/`web_search` across 5+ domains (arxiv.org,
nationalgeographic.com, abc.tools, apps.amandaghassaei.com, kody-w.github.io,
hayden.gg; Science/HUSCAP abstracts read via search output). Three candidate
concepts, an explained choice, Trial-task and prior-art comparison, and three
behavioural commitments are documented.

### 2. Distinctness — PASS (judged)
Primary interaction: the user programs a *growth substrate* (food nodes,
terrain, light) and audits the network an organism grows — never draws a link.
Different from #20 (drawn transit networks) and #14 (evolutionary agents).
Different from all researched Physarum demos (pattern toys): this adds live
graph extraction, cost/efficiency/fault-tolerance metrics, and wound/heal
experiments.

### 3. Commitments — PASS

- **Grow-and-connect.** Tokyo preset (15 cities) → dense web grows, then prunes
  into a persistent vein network. Analysis read `15/15` linked in one component.
  Screenshots: `shot-45s.png`, `shot-final.png`.
- **Measure what grew.** Live metrics computed from the actual trail field:
  skeletonised length (≈1200–4000 px depending on consolidation), cost vs
  straight-line MST (1.47×–2.66× observed), avg detour (1.24×–1.33×), loop share
  (13–85% across states), bridge count. Numbers change as the field evolves and
  as cities are added — verified via repeated evals.
- **Wound and self-repair.** Pause → "Sever strongest link" → connectivity
  dropped 15/15 → 11/15 in 2 components (`shot-severed2.png`, toast
  "Severed — 4 cities isolated"). Resume → healed to 15/15 within ~10 s
  (`shot-healed.png`). A hand-dragged Sever stroke through a loopy region kept
  15/15 — genuine fault tolerance, and the app says so.

### 4. Second path / boundaries — PASS

- Undo: painted terrain stroke (wall cells 8260) → Undo → 3319 → Redo → 8260.
- Import invalid JSON (malformed syntax; wrong schema) → error toast, dish
  unchanged (2 cities / 8260 walls preserved).
- Export JSON (10 KB) + PNG (298 KB) downloads work; JSON re-imported through
  the real file input restores cities+walls exactly.
- City lifecycle: pointer-click adds "City 3"; click-select + Delete removes it.
- Blank dish → "0 — drop some oats" guidance instead of dead metrics.
- Pause halts growth; Step advances exactly one tick; speeds 0.5× (30 t/s
  measured) → 4× verified; quality selector 15k/45k/90k/140k applied.
- Whole-session Reset all restores the opening dish and empties undo history.

### 5. First-use guidance, rendering, viewports — PASS

- Dismissible 4-step "First dish" card; tooltips/hints per tool; keyboard
  shortcuts (Space, ., R, Ctrl+Z/Y, 1–6, Delete).
- Desktop 1280: ~53–60 fps at 45k agents. Narrow 390×844: canvas on top, panel
  stacks below, scrollable, all controls reachable (`shot-mobile.png`).
- Console: zero errors/warnings across the whole session (`__errs` listener
  + `agent-browser console` both empty).
- Pointer cancel/focus loss: `pointercancel` ends strokes; `visibilitychange`
  resets frame timing.

### 6. Standalone + sandbox — PASS

- `file://` direct open: app fully functional (no server needed).
- Sandboxed iframe (`sandbox="allow-scripts allow-downloads"`, opaque origin):
  sim runs, analysis computes, 59 fps — no storage/network dependency
  (`shot-sandbox.png`). (In-frame `eval` returned "undefined" for globals — a
  CDP context quirk of the sandbox probe, not an app failure; visual + snapshot
  state confirmed working.)
- Network audit (`agent-browser network requests`): only the document itself —
  zero external requests (favicon inlined via `data:,`).
- Reload/Reset clears session; nothing persisted (no localStorage/cookies used).

## Bugs found and fixed during validation

1. Analysis pump recreated the graph generator every time-slice → `analysing…`
   never finished. Fixed by hoisting the generator across slices.
2. Trail cap missing → monopoly dynamics collapsed the web into one artery.
   Fixed by clamping trail deposits + continuous re-inoculation at cities.
3. Fractional brush radius in `blob()` produced fractional typed-array indices
   (silent no-op) → preset light fields never painted. Fixed by flooring loop
   bounds in `paintAt`/`cutAt`. Verified: light zone holds 0 agents vs 5598 in
   a control zone; blobs render as haze the network routes around.
4. Point-sever couldn't disconnect fat veins → sever now sweeps a corridor-wide
   swath perpendicular to the link and reports the observed connectivity.
5. Reset left a stale undo entry that blanked the dish → fixed ordering.
6. Stale chunked analysis could overwrite state after Reset → epoch+runId guards.

## Not run / limitations

- Audio: intentionally absent (concept doesn't use it); no audio checks needed.
- Real-device touch gestures untested (pointer events used; `touch-action:none`
  set on the dish). Mobile tested via 390×844 viewport + mouse-equivalent input.
- Metrics are approximations from a rasterised trail field — stated in About.
