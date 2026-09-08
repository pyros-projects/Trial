# BLACKLINE implementation plan

Goal: deliver the complete procedural stealth-heist sandbox in one offline index.html.
Architecture: embedded pure simulation core (seeded map assembly, collision, navigation, sight, sound and AI), a fixed-step live simulation, Canvas rendering, and DOM mission controls. No runtime dependencies. The workspace is a new, non-git directory; direct delivery here is the requested integration.

The user explicitly authorized an uninterrupted end-to-end run, so design and execution proceed without the optional review gates in the planning skills.

Design: a nocturnal industrial facility with curated Dockside, Glasshouse and Black Vault mission profiles. A connected central corridor and paired room entrances guarantee reachability. Cover is placed away from critical routes. The first terminal is beside the entry; the objective sits behind access control, with a free terminal override and a noisy manual bypass. Extraction returns to the insertion area. Guards use grid navigation, occluded perception, memory, hearing, local searches and radio communication. A compact HUD and optional overlays expose actual state.

- [x] 1. Write and run failing simulation contract tests for deterministic generation, map validity, occluded vision and pathfinding. Implement the embedded core and rerun.
- [x] 2. Implement the live systemic loop: movement, access, objective, sound events, stateful guards, cameras, alarm, smoke/distraction/EMP, failure and extraction. Verify core behavior with independent geometric fixtures and simulation steps.
- [x] 3. Build polished Canvas lighting, plan rendering, cones, animations, minimap and DOM command console; responsive pointer/touch controls, settings, help, diagnostics and briefing.
- [x] 4. Finish pause/reset/new seed, history, JSON import/export with validation and a verifiable sampled run record. Verify malformed input and round-trip behavior.
- [x] 5. Use installed agent-browser core workflow and exploratory testing to play a complete mission using real pointer/keyboard input. Test sight, hearing, pursuit loss and search, devices and gadgets. Capture screenshots and live diagnostics.
- [x] 6. Check 1280x800 and 390x844, focus/pointer cancellation, direct-file operation, blocked external networking, console and requests. Fix observed failures and rerun relevant flows. Write evidence/validation.md with exact commands and honest coverage.

Test tools live in evidence/. The final HTML remains self-contained. No evaluator files or fixtures will be touched.
