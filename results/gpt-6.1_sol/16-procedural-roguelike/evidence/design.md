# Hollowkeep design

The user authorizes one uninterrupted implementation and validation run. Deliver one self-contained index.html; documentation and harnesses live beside it in evidence/.

A five-floor lantern-lit tactical dungeon. The default Warden begins immediately in a furnished mossbound room. New runs select seed, Warden/Wayfarer/Arcanist, difficulty, generation style, forgiving/permadeath, or a compact final encounter. Curated styles: ruins, fortress, cavern, crypt, arena. Floor generation uses a connected room/corridor tree, optional connectivity-preserving pillars, distant enemies and safe spawn. Stairs lie on reachable far tiles.

Engine: serializable seeded RNG, map/entities/player/statuses/log/actions. Accepted actions commit one turn. Sequential enemy occupancy resolution and a snapshot turn queue prevent double turns and immediate summoned actions. Field of view and enemy sight use wall/door-blocked lines. Pursuers, archers, flankers, guardians, fleeing vermin, summoners and a telegraphing boss use actual pathfinding and bounded last-seen memory. Combat has guaranteed strikes, explicit armor and seeded critical effects.

Interface: hand-drawn code-generated tile art, sage/copper dark palette, responsive canvas camera, minimap, character stats, objective, action bar, log, item/equipment panel and labeled dialogs. Pointer paths preview first and stop on danger; keyboard movement and target confirmation; mobile arrows and actions. Settings include pause, seed/new run, floor checkpoint, visual accessibility and procedural sound enabled by gesture.

Persistence: schema-validated localStorage, exact turn reload, complete JSON export/import, local records and re-simulation of deterministic action history. Invalid data preserves the current run. Diagnostics expose live connectivity, visibility, path distances, AI memory/intent, occupancy, queue and RNG.

Validation: meaningful engine tests, real Chromium via installed agent-browser, file:// delivery, external network blocked, 1280x800 and 390x844, movement/discovery/combat/items/doors, equip, final floor, persistence/replay, pause/idle invariants, console/network checks and screenshots.
