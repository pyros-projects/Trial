# Selvedge — research and concept choice

Access date for all sources: 2026-09-08. Research completed before implementation. Tools: `functions.exec` calling the live `web__run` tool, using `search_query`, `open`, and `find`. No source code or third-party assets were copied.

## Actual searches

1. `interactive weaving draft simulator weave structure warp weft float plain twill`
2. `museum weaving warp weft interlacing plain weave twill structure`
3. `weaving draft interactive tool weaveworld weave color weave prototype`

Search results were followed by opening and reading these pages (snippets were not used as substitutes):

| Source read | URL | Sourced observation | Design influence / own inference |
| --- | --- | --- | --- |
| Katonah Museum of Art, *Stories of Syria’s Textiles: Educator Materials*, p. 17, “Textile Weaving Basics” | https://katonahmuseum.org/content/KMA_Educator%20Materials_Syrian%20Textiles_2023_for%20web.pdf | Warp runs lengthwise; weft crosses it; plain weave alternates over and under. Read PDF text and used `find` for the weaving-basics section. | Teach with visible, perpendicular yarns and an editable plain-weave example. Do not simulate compound structures or imply a strength prediction. |
| Lauren Nishizaki, *Weaving draft software* | https://www.laurennishizaki.com/projects/2019/01/weaving-draft-software/ | Each crossing can be represented as warp-facing or weft-facing in a binary grid. Her tool accepts threading, treadling, and tie-up numbers, and shows fabric; examples include opposite faces and three-thread floats. | Use a binary crossing model and a complementary back face. Our inference: a cyclic run scan can expose otherwise-hidden floats at repeat seams. |
| Unstable Design Lab, *AdaCAD* | https://adacad.org/ | The project's own explanation describes a parametric dataflow tool for weave drafts, including complex and Jacquard work. | Keep our central action direct and tactile, without nodes or an industrial drafting workflow. This is a learning instrument, not an AdaCAD replacement. |
| Saldog3000, *WeaveWorld 26* | https://weaveworld.sallyholditch.com/ | Read the actual page and its help: threading/lifting grids, live weave simulation, plain/twill starters, drag editing, yarn colors, undo, and WIF export. | Closest researched counterpart. Our opening is inspecting two faces and cyclic floats directly from an over–under repeat, including an explicit all-unbound boundary and a local binding operation. Omit shaft/treadle setup and WIF machinery. |

## Three candidates considered

1. **Selvedge / pocket loom:** discover the hidden construction of fabric by changing crossings, turning it over, and tracing long floats across a repeating pattern.
2. **Common Ground / voting counterfactuals:** reorder a small electorate's ballots and compare winners under several voting rules, exposing spoiler effects. Different purpose and algorithms; rejected because explaining electoral-rule tradeoffs would take more room than the tactile weave interaction.
3. **Lost Alphabet / decipherment game:** infer an invented substitution script through consistent letter assignments and word constraints, then decode a generated note. Different puzzle interaction; rejected because producing satisfying, reliably solvable original content would consume more of the single-file build budget.

These are our proposals, not claims about researched products. Only weaving was researched in depth before selection.

## Choice and distinctness

Selected **Selvedge**, for accessible cause and effect, a strong physical visual identity, a genuine discrete structural model, and feasible offline performance. The closest Trial task is **19, Node Graphics Studio** (with some superficial overlap with 22, Vector & Layout Studio). Selvedge's purpose is learning and authoring textile interlacement: inputs specify which continuous yarn crosses above another; outcomes include opposite faces, periodic floats, and actual binding edits. It has no graphics nodes, generic drawing objects, or texture-expression graph. Trial 4 models deforming cloth mechanics; this app models cloth's weave construction, not elastic bodies.

Closest online work: **WeaveWorld 26**, a loom-draft editor. Selvedge instead edits the drawdown directly, exposes a thread cross-section and complementary mirrored reverse, scans both faces across periodic boundaries, and can make a single computed binding edit. This is a distinctive contribution to this collection; this short search does not establish worldwide originality.

## Original behavioral commitments — recorded before implementation

1. **Crossing → cloth.** The user edits arbitrary crossings by pointer strokes or keyboard. Every visible repeat and the cross-section recompute from those crossings; the reverse is mirrored and complementary. We will compare real edited state, rendered pixels, and opposite-face values, including a change outside the seed.
2. **Beauty → structure.** The user inspects floats or chooses an unbound draft. The system scans warp and weft cyclically on both faces, counts runs that cross repeat seams, distinguishes an entirely unbound yarn from a finite float, and offers a computed single-crossing binding edit when one improves the diagnostic. We will test plain/twill, a seam-spanning run, all-warp, and a user-authored pattern, and inspect the visible lens and feedback.
3. **Experiment → keep → recover.** The user can undo/redo edits, download a project and a PNG, restore a valid project, recover from invalid imports without losing current work, and reset the entire session. We will round-trip files through ordinary input/download controls and verify reset invalidates pending imports and returns to the original state, including in a sandboxed opaque-origin iframe.

## Deliberate limits

An educational binary, periodic interlacement model: no yarn tension, stretch, shrinkage, friction, finishing, edge construction, multilevel weave, or loom feasibility. A short float is not a certificate of fabric strength. The binding operation is a bounded local improvement, not a global solver. All artwork will be procedurally drawn with original code, using system fonts. No audio is planned. No assets, data, scripts, or services will be fetched by the application.

## Later scope changes

No behavioral commitments were removed or reduced. Rendering was optimized to tile the actual authored repeat after a measured stress-test slowdown; feedback was made visible after an import-error usability finding. Final review also found a 12-thread color-band seam error: color periods now run independently of structure, with their least common repeat rendered and explained. These changes preserved the original scope. All three commitments were exercised successfully; see validation.md for the original failures, fixes, retests and limitations.
