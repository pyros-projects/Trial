# ECHO / SHIFT design

A self-contained Canvas 2D rhythm bullet-hell with Web Audio synthesis. The interface uses ink/navy surfaces, lilac controls, mint rhythm accents, a large arena, a compact sound rack, a transport strip, and keyboard/touch control hints. Initial preview exposes the arena behind a clear enable-audio/start action. Desktop uses arena plus rack; narrow screens stack the rack below a playable arena and expose touch focus and pulse.

A 120 Hz fixed simulation owns logical projectiles, continuous swept collision, player movement, health, grazes, shots, cooldowns, score, and three 32-beat boss phases. A tempo-map transport starts with four countdown beats. The same map converts between beat and elapsed seconds for simulation emissions and an AudioContext look-ahead sequencer. Audio pause uses suspension, freezing audio time; simulation follows that clock. Long stalls pause rather than produce a backlog. No external resources exist.

Inputs are normalized and recorded by simulation tick; seed and settings initialize the RNG, while setting changes are recorded with ticks. Import validates bounds and version before running. Replays use the original fixed tick rate and stop at the recorded final tick; a logical-state checksum permits verification. Practice has selectable pattern, subdivisions, density, speed, tempo, seed, and an actual 16-step gate. The encounter lasts 24 measures; auto fire and rhythm pulses weaken the boss, with on-beat pulses/grazes earning extra score.

Audio voices: synthesized kick, snare, hats, bass, arpeggiated melody, pads; track gain/mute and master compression; analyser after the master gain. Three musical scales and phase arrangement changes. Accessibility includes reduced motion/flash, contrast, shake, particles, focus hitbox, control reference, quality, and timing offset.

User authorization: requested complete one-run implementation and autonomous validation, overriding skill approval checkpoints. Delivery is index.html plus sibling evidence/; no Git workflow or runtime dependencies.
