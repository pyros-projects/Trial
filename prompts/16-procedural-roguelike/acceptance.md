# Public validation checks: Procedural Tactical Roguelike

Start two seeds and verify valid connected maps, then play several turns with movement, closed-door occlusion, enemy discovery, combat, damage, and at least one item or status effect. Confirm that enemies path around walls, take only legal turns, lose knowledge outside line of sight as designed, and do not act while the game is awaiting input or paused. Use inventory and equipment, descend or load a compact later-floor preset, save and reload the exact turn state, inspect the event log and debug overlays, and test keyboard plus pointer controls at narrow width.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.
