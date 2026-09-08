# Forma implementation plan

Goal: deliver one self-contained, offline vector and layout editor in index.html.

Architecture: an editable SVG scene backed by a versioned flat hierarchy; positive similarity matrices; exact cubic extrema and declared text layout metrics; transactional document history in RAM. The viewport has independent pan and zoom. Renderer and exports share leaf creation. No runtime dependencies, storage, or remote resources.

Design: warm white panels, charcoal typography, olive accent, a compact tool rail, hierarchical Layers, document-space inspector, and a central editorial artboard. Opening composition: FORM / FIELD, a graphic study with a large geometric botanical form, cubic line work, and editable type. Second composition: an indigo orbital event poster. Narrow screens use toggleable side panels and a horizontal tool rail.

Constraints: 200 items, 32 anchors/path, 4 group levels, 2000 characters/text, project input ≤2 MiB, local numeric coordinates ±100000, world bounds ±1000000, uniform positive transform scales 0.001–1000, 64–2048 artboard, PNG 1x/2x ≤4096 per side and ≤16777216 pixels. No raster import.

- [x] Geometry and schema: implement matrix composition/inversion, curve extrema, shared text metrics, hierarchy, strict input validation, atomic history. Test extrema and transform invariance, hierarchy and hostile input rejection with real production helpers.
- [x] Workspace: build responsive interface, editable templates, native SVG scene rendering, hierarchy and inspector controls, numeric exact edits and history.
- [x] Interaction: direct tools, cubic anchors/control handles, parent-aware movement, selection bounds handles, marquee, pan/zoom, deterministic snapping, cancellation and keyboard continuity.
- [x] Authoring: alignment/distribution, grouping/ungrouping, sibling order, inherited locks and visibility, safe text editing, style scrubs.
- [x] Files: validated project round trip, safe scene SVG and PNG export, preview, reset and import cancellation boundaries.
- [x] Browser validation: agent-browser actual workflows at 1280×800 and 390×844, offline file and opaque iframe; download and inspect JSON/SVG/PNG; capture screenshot/log evidence, diagnose and retest failures.

Tests will use UI actions for mutations; read-only live diagnostics and actual downloaded files corroborate outcomes. Test code and evidence stay outside the delivered HTML.
