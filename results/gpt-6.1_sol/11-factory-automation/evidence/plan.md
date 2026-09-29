# FERRO Implementation Plan

> Agentic worker: execute inline with the executing-plans workflow, then obtain a fresh final review. The user's continuous-run instruction overrides skill approval pauses. The provided workspace is empty and is not a Git repository; deliver files here without creating a worktree or commits.

Goal: deliver a polished, fully connected offline factory game.
Architecture: one HTML artifact; pure Factory simulation class followed by canvas renderer, interaction controller, DOM panels, persistence, and procedural audio.
Tech stack: native HTML/CSS/JavaScript, Canvas 2D, Web Audio, localStorage.
Spec: evidence/design.md, plus the user's full application and public validation requirements.

Global constraints: self-contained index.html; no runtime dependencies or network calls; fixed 0.05 s ticks; direct file compatibility; evidence stored in sibling evidence/; honest browser outcomes.
Review focus: malformed imports must not partially replace state; drawing and panning must keep continuous input; recipe buffers must preserve ratios under blocking; pause/speed/save must preserve deterministic state; mobile dialogs and drawers must remain reachable.

- [x] Task 1 — Simulation. Write node:test behavioral tests, observe RED, implement Factory, then run GREEN. Expose Factory constructor, add(kind,x,y,dir,options), step(), advance(seconds,speed), dump(), static restore(data), loadPreset(id), upgrade(entity). Test extraction-to-delivery, ratios, splitter fairness, merging, backpressure and recovery, finite fuel and brownouts, two-component assembly, speed determinism, upgrades, exact save continuation, rejected imports, and presets.
- [x] Task 2 — Interface. Build the inline layout, canvas renderer and all construction interactions. Use the same Factory instance for all metrics and effects. Provide real charts, overlays, inspector and recipe controls, campaign progression, reset, presets, settings, slots, JSON/share/PNG, and audio. Re-run simulation tests and syntax checks.
- [x] Task 3 — Browser validation. Read installed agent-browser core/dogfood; open delivered file, block external traffic, interact using labelled controls, pointer and keyboard, and inspect live diagnostics and screenshots. Exercise build/rotate/delete, logistics and a splitter, bottleneck and recovery, pause/step/speed, exact save/load, malformed import, preset/resize, mobile, audio gesture, and performance. Document failures immediately, reproduce, repair cause, and retest plus compact regression.
- [x] Task 4 — Final review and delivery. Obtain fresh reviewer as required by executing-plans, fix material issues, run relevant regression. Update validation.md with exact commands, observed state and remaining limitations. Leave index.html and evidence on disk.
