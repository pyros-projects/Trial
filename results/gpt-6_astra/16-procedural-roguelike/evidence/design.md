# Embervault design and implementation plan

Goal: Deliver a complete offline tactical roguelike in index.html, with a playable default run and no external resources.

Architecture: A pure deterministic game engine owns generation, visibility, pathfinding, action resolution, AI, combat, inventory, and run history. A separate canvas renderer and DOM interface consume this state; time and animation never advance simulation. Save files carry a schema, initial configuration, action history, complete current state, and floor checkpoint. Replay recreates the initial state and dispatches the same actions.

Visual direction: A charcoal and moss expedition console with amber accents, serif display type, code-drawn stone tiles, hooded adventurers, lanterns, particles, and layered fog. Canvas camera follows the player; an explored minimap gives orientation. On narrow screens the battlefield and action controls lead, and expedition details remain accessible below.

Rules: One valid move, melee/ranged attack, wait, door action, interaction, item, equipment change, or descent costs one turn. Invalid/cancelled actions, inspection, inventory, menu, save and targeting cost none. Each living enemy can act at most once per player turn. Enemy sight uses the same blocking geometry; remembered positions expire after four turns, and sounds reveal only their origin. Attacks are guaranteed within reach/LOS; armor reduces damage, seeded criticals add a transparent 15% chance. Three floors end with an Ash Warden and a recoverable heart.

Implementation tasks (inline execution authorized by user):
- [x] Engine: seeded rooms/corridors, five styles, validated connectivity and safe spawn; LOS/FOV; BFS; coherent turn queue and AI.
- [x] Run systems: three loadouts, melee/bow, eight abilities/items, equipment, keys, hazards, progression, boss, outcomes, records, save validation and replay.
- [x] Interface: polished high-DPI renderer, explored minimap, combat journal, inventory/tooltips, mobile controls, targeting, inspect, help, pause, settings and diagnostics.
- [x] Validation: execute invariant tests, then agent-browser desktop and narrow real-input workflows, direct-file operation, offline network/console, persistence/import/replay, failure fixes and retests.

Files: index.html is the sole delivered runtime. evidence/ contains this plan, independent tests, agent-authored validation.md, screenshots and actual tool logs. There is no Git repository or existing implementation to preserve.

Checks: deterministic equal-seed maps; connected reachable stairs across seeds/styles; no unsafe spawn; doors block LOS; paths never cross walls; enemies never advance from frames; exact save/load; malformed data rejection; replay final-state equality; real desktop/mobile pointer and keyboard; complete boss and death loops.

Completed: inline implementation, independent engine review, browser correction/retest cycles, and direct-file offline artifact verification. See validation.md for exact coverage and limits.
