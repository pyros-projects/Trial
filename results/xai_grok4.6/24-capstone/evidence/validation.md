# Validation — Ut Pendet

Agent-authored record of live checks against the delivered `index.html`.
Harness: `agent-browser` CLI (core + dogfood skill loaded from the installed CLI).
Local server: `python3 -m http.server 8877 --bind 127.0.0.1` in the project root (development only; not a runtime dependency).
Date: 2026-09-08.

Screenshots live in `evidence/screenshots/`.

---

## Public check 1 — Research trail

**Result: pass**

Tools: Cursor `WebSearch` and `WebFetch` (full pages, not snippets).

Read sources across independent domains (see `evidence/research.md` for queries, titles, URLs, dates, facts vs inferences):

- `block.arch.ethz.ch` — Algebraic Graph Statics preprint
- `blockresearchgroup.github.io` — COMPAS 3gs graphic statics overview
- `par.nsf.gov` — PolyFrame / Hooke–Gaudí paper
- `blockresearchgroup.gitbook.io` — Force density method
- `sciencedirect.com` — extended FDM paper
- plus prior-art pages for rejected candidates (`mysimulator.uk`, `mrbertman.com`, cam/linkage/anamorphosis tools)

Three candidates recorded; **Ut Pendet** chosen before implementation. Commitments recorded before the build.

---

## Public check 2 — Concept vs Trial and related work

**Result: pass**

- Chosen concept: hanging-chain / funicular form-finding with a reciprocal force diagram (`Ut Pendet`).
- Closest Trial brief: **#4 Deformable Physics**. Difference: axial pin-jointed FDM + Cremona-style force diagram and invert-to-vault, not cloth/rope grabbing, collisions, cutting, or tearing.
- Closest related work: eQuilibrium / AGS, PolyFrame, compas-FoFin, PushMePullMe. Difference: a self-contained hanging-model workshop, not a CAD plugin or general physics engine.
- Delivered interaction matches the stated difference (solver + pole + invert + authoring), not a theme swap.

---

## Public check 3 — Main workflow and three commitments

**Result: pass**

Browser: `agent-browser --session utpendet`, viewport **1280×800**, `http://127.0.0.1:8877/index.html`.

### Initial state

- Title *Ut Pendet*; Hooke’s chain seeded (7 joints, 6 cables).
- Live eval `window.__utPendet()`: `ok: true`, residual `5.68e-14`, `sumLoad 110`, `sumRy -110`, `balance 0`.
- Cable labels reported forces ~127.7 … 116.2 (symmetric).
- Screenshot: `01-desktop-chain.png`.
- Console: empty. Page errors: none.

### Commitment 1 — user changes load, tightness/pole, plan position, custom topology

| Action | Observed |
|---|---|
| Click *Weight n5 load 30*, keyboard `End` on Load slider | `loadY` 30 → **80**; mid-joint `y` 197.5 → **275.6**; `maxF` 127.7 → **140.3**; residual still ~0; Undo enabled |
| Global tightness `Home` | tightness 96 → **24**; `y` 275.6 → **844.3** (deeper sag); `maxF` **85.0** |
| Drag pole (pointer) | tightness 96 → **216.6**; mid `y` 197 → **135.4** (shallower) |
| Drag *Weight n3* toward left abutment | `x` 240 → **120**; residual still ~0 |
| Chapel example + pointer-placed *Weight n12* | disconnected: `ok: false`, residual **18** (= unmatched load) |
| Cable tool: n12 → abutment n3 | `ok: true`, residual ~1e-13, **17** cables; n12 `y` solved to **86.4** |

Screenshot: `02-heavier-midweight.png`, `03-looser-chain.png`.

### Commitment 2 — FDM + force diagram

- Residual ~0 whenever the net is connected.
- Force slate shows load line, pole, rays, and selected-joint polygon **close 0.00**.
- Member `aria-label`s carry live |F|.
- `ΣFy` reactions equal −Σ loads (balance 0).

### Commitment 3 — invert preserves forces; custom net is not a canned morph

- Invert after looser chain: `inverted: true`, `invertT: 1`, Mode **Vault**, `maxF` stayed **85.026**.
- Screenshot: `04-inverted-vault.png` (arch on abutments, same brass loads).
- Custom n12 was not in any seed; connecting it changed the solved `y` rather than replaying a preset.

Chapel / bridge / fan also solved (`ok: true`, residual ~1e-13):

| Example | nodes | edges | residual |
|---|---|---|---|
| hanging chapel | 11 | 16 | 1.1e-13 |
| suspension span | 14 | 13 | 1.1e-13 |
| fan vault | 10 | 15 | 8.5e-14 |

Screenshots: `05-chapel.png`, `09-bridge.png`, `10-fan.png`.

---

## Public check 4 — Second path, boundary, reset, undo, import

**Result: pass**

- **Disconnected joint:** adding a weight too far from the net left it unconnected; solver `ok: false`, residual 18, toast to add a cable. Connecting recovered equilibrium (`07-weight-connected.png`).
- **Invalid import:** uploaded `{"oops":true}` via the file input. Toast: `Import failed: Missing nodes or edges. Current model kept.` Node/edge counts unchanged (12 / 17).
- **Delete with no selection:** Escape, then Delete. Toast: `Select a weight, abutment, or cable first.` Count unchanged.
- **Undo:** restored the custom 12-node / 17-edge chapel after later deletes.
- **Reset:** restored Hooke’s chain (7 / 6), tightness 96, `inverted: false`, undo stack cleared, residual ~0.
- Export/SVG buttons present; downloads are user-initiated Blob links (not tested as a saved-file round-trip beyond invalid import). Valid import path uses the same `FileReader` + schema check; a second fixture with a missing cable endpoint is rejected by `validateImport`.

No unfulfilled commitments.

---

## Public check 5 — Guidance, viewports, console, cancellation

**Result: pass** (audio **not-run** — the app has no audio)

- First-use hint bar present; dismissible with *Got it*.
- Desktop 1280×800: main canvas + force slate + inspector; residual 0.000 on screen.
- Narrow **390×844**: tools wrap; form above force slate; clicked *Weight n7*, Invert → `inverted: true`, Mode Vault. Screenshots `11-narrow.png`, `12-narrow-invert.png`.
- Console and uncaught errors: none on the HTTP session.
- Network (HTTP session): only `GET /index.html` 200 and a browser `favicon.ico` 404 (no app fetch). After adding `<link rel="icon" href="data:,">` the app still has no external URLs.
- `pointercancel` on the form SVG and `window` `blur` dispatched on the file:// session: model stayed `ok: true`, 7 nodes.
- Audio: not applicable.

---

## Public check 6 — file://, sandboxed iframe, storage, About sources

### Direct file

**Result: pass**

```
agent-browser --session utfile open file:///home/pyro/projects/naked/grok46/24-capstone/index.html
```

- `location.protocol === "file:"`
- Solver `ok: true`, residual ~5.7e-14, 7 nodes
- Invert: `inverted: true`, `maxF` unchanged 127.66
- Network: only the file document (200)
- Console/errors: empty
- Screenshot: `14-file-protocol.png`

### Opaque-origin iframe

**Result: pass**

Harness page: `evidence/sandbox.html` (`sandbox="allow-scripts allow-downloads"`, no `allow-same-origin`).
`https://**` aborted via `network route`. Local server left reachable.

- Iframe snapshot showed the full chain UI (cables, weights, pole).
- Clicked n5, Load `End` → weight **80**, cable e1 **140.3**.
- About opened inside the iframe; source headings present; Close worked.
- Reset restored load **30** and cable e1 **127.7**; undo disabled.
- Network: `sandbox.html`, `index.html` only (plus browser favicon 404). No research URLs fetched.
- Screenshot: `13-sandbox-iframe.png`
- `contentWindow` eval from the parent is blocked by the opaque origin (expected). Interaction used labeled controls in the iframe accessibility tree instead.

### About / sources vs research

**Result: pass**

In-app titles/URLs (selectable `span.url`, `user-select: all`) match `evidence/research.md`:

1. https://block.arch.ethz.ch/brg/files/2014-cad-vanmele-algebraic-graph-statics-preprint_1397824709.pdf
2. https://blockresearchgroup.github.io/compas_3gs/latest/overview/00_graphic_statics.html
3. https://par.nsf.gov/servlets/purl/10209861
4. https://blockresearchgroup.gitbook.io/compas-fofin/theoretical-background/force-densities-method
5. https://www.sciencedirect.com/science/article/pii/S2214399815000041

No invented papers. Limitations in About match the FDM polygonal-funicular disclaimer.

Storage: the app does not use localStorage / IndexedDB / cookies. Startup in the sandboxed iframe succeeded.

---

## Fixes during validation

1. Uniform force density `q = tightness/100` (the earlier `H/Δx` rule blew up vertical hangers).
2. Vertical equilibrium check is `ΣR_y + ΣP_y ≈ 0`.
3. Accessible names on joints, cables, and the pole so pointer tests hit labeled controls.
4. Slider undo also starts on `input`/`keydown`, not only `pointerdown`.
5. Invalid JSON import no longer had a broken dual `onload`.
6. Auto-fit form `viewBox` so deep sag still frames.
7. Empty `data:,` favicon to avoid a decorative external icon request.

Retested the chain residual, invert, custom cable, invalid import, reset, file://, and sandbox after the solver/import fixes.

---

## Remaining limitations (not failures of the checks)

- Linear FDM, axial-only; not a catenary of uniform self-weight; not a buckling or masonry check (disclosed).
- Valid JSON round-trip was not saved to disk in this run (invalid import + export button presence were). The importer is the same function that would accept `cloneProject()` output.
- Browser may still request `/favicon.ico` depending on the engine; the document itself does not fetch it as a script/asset.
- `agent-browser frame "iframe"` failed to switch CDP context; iframe testing used nested snapshot refs instead. That is a harness limit, not an app failure.
