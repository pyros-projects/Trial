# Evolutionary Ecosystem Laboratory implementation plan

Goal: Deliver a complete offline, single-file ecosystem laboratory in index.html.
Architecture: A deterministic fixed-step ecological engine exposes serializable state; an independent Canvas renderer and DOM interface consume that state. A uniform spatial grid bounds neighbor queries. Retained history powers all charts.
Technology: Embedded HTML, CSS, JavaScript, Canvas 2D and inline SVG; no runtime dependencies.
Authorization: The user requested one complete end-to-end run, so design and implementation proceed without intermediate approval gates. This empty workspace is the requested delivery location.

- [x] Engine: seeded environment, vegetation regeneration, grazer/predator sensors and steering, metabolism, finite feeding, damage, death, energy-funded inheritance, immutable species anchors and complete lineage records.
- [x] Interface: responsive laboratory layout, terrain rendering, pan/zoom/select/follow, brush tools, inspector, world/evolution parameters, presets and interventions.
- [x] Analysis and persistence: truthful modes/overlays, retained charts, distributions, ancestry navigation, validated JSON restore, autosave, CSV and PNG.
- [x] Verification: run real engine invariants; exercise browser workflow using labeled controls, mouse and keyboard; inspect Canvas and live state; test file URL offline, desktop/mobile, save/load/errors, ecology/interventions and accelerated dense performance.
- [x] Evidence: record exact commands, observations, screenshots, failures and retests in evidence/validation.md.

Engine contract: EcoEngine(seed, preset, size); step(); intervene(type); paint(x,y,tool,radius); spawn(role,x,y,parent); serialize(); static restore(text). State contains organisms, cells, species, lineage, history, climate, events, counters and RNG. Rendering and UI do not consume simulation randomness.

Tests catch: loss of deterministic replay; free reproduction or broken parent links; stale sensors; invalid energy/positions; restoration divergence; ineffective interventions; unsafe import mutation.
