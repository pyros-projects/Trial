# AudioRack implementation report

Implemented `AudioRack` as a standalone browser class in `evidence/audio.js` with no runtime dependencies.

- Uses the shared transport's `timeAt(beat)` for a 25 ms / 120 ms look-ahead scheduler, beginning at beat -4 and advancing in quarter-beat subdivisions.
- Provides procedural countdown clicks, drums, syncopated bass, arpeggiated melody, and atmospheric pads through four mix buses, compression, master gain, and a real analyser connected to the destination.
- Includes `neon`, `drift`, and `ember` scale/timbre presets plus clear phase 1 and phase 2 rhythm, density, register, and chord-voicing changes.
- Uses finite, smoothly enveloped sources, a 56-voice limit, ended-source cleanup, and explicit tail cleanup on restart/stop.
- Serializes AudioContext suspension/resumption and uses lifecycle tickets so overlapping pause/resume calls cannot apply stale state. The AudioContext origin remains fixed across pauses, while frozen elapsed time is captured after suspension settles; already-scheduled sources therefore retain coherent absolute timing across repeated pauses.
- Falls back to a pause-aware `performance.now()` clock without throwing when Web Audio is unavailable. A failed resume of an existing context now closes and detaches that context, marks audio unavailable, and transfers a running clock to the silent fallback.
- Exposes analyser samples and diagnostics for context state/time, schedule lead, event count, average late scheduling error, late events, and output RMS.

Validation: `node --check evidence/audio.js` completed successfully. Focused Node checks with a minimal mocked AudioContext also covered stable-origin pause/resume and existing-context resume failure. Browser integration and listening tests were not performed; those remain with the parent implementation.
