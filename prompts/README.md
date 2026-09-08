# Prompt library

24 tasks, 24 complete agentic prompts. Open one task's `prompt.md` and give its entire contents to your coding agent. Every prompt contains the product requirements, tool-enabled development workflow, browser validation, public checks, and delivery contract. No additional protocol prompt or external fixture package is needed.

Every task delivers one self-contained `index.html`. Tasks 01–20 cover simulations, games, instruments, and studios; 21–23 add a spreadsheet, a vector editor, and a project planner. **24 is the Capstone:** the agent researches the web, chooses its own distinct concept, and builds it. The prompt includes a short map of the other 23 briefs so the idea adds a new experience to Trial.

Each run may plan, execute, test, and improve from the start. Keep screenshots and agent-authored validation notes in `evidence/` beside the artifact. The Capstone also records its actual research and concept choice in `evidence/research.md`. Its live web access is for development; the delivered HTML still runs offline. Tasks 21–24 keep session changes in memory, with explicit reset and appropriate file downloads instead of required persistent storage.

`acceptance.md` is a convenient standalone copy of the public checks, not an alternative prompt. Give the agent only the selected prompt in an isolated workspace. Keep evaluator-owned reports and independent variation checks outside it.

See [SELECTION_GUIDE.md](SELECTION_GUIDE.md) for task combinations and the Capstone's comparison limits. `catalog.json` is read by the gallery and importer. Its optional `look_for` field supplies the practical hints beside each prompt title and in the viewer. These hints help visitors explore; the complete prompt and acceptance checks define the requirements.

The previous multi-file Real Apps prompts 21–30, fixtures, runtime contract, and evaluator guidance are preserved on [`experimental/real-apps`](https://github.com/pyros-projects/Trial/tree/experimental/real-apps). That experimental track is outside the current collection. Task IDs include their full slug: the old `21-import-studio` and new `21-spreadsheet-chart-studio` are different tasks.

## Choose a prompt

| ID | Prompt | Focus |
|---|---|---|
| 01 | [Real-Time 2D Fluid Simulation](01-fluid-simulation/prompt.md) | GPU simulation |
| 02 | [3D Hydraulic Erosion Laboratory](02-hydraulic-erosion/prompt.md) | GPU simulation |
| 03 | [Modular Synthesizer and Sequencer](03-modular-synth/prompt.md) | Audio application |
| 04 | [Soft-Body, Cloth, and Constraint Playground](04-deformable-physics/prompt.md) | Physics simulation |
| 05 | [Black Hole and Gravitational Lensing Explorer](05-black-hole-lensing/prompt.md) | Shader rendering |
| 06 | [Wave Interference and Diffraction Laboratory](06-wave-laboratory/prompt.md) | Numerical simulation |
| 07 | [Orbital Mechanics and Mission-Planning Sandbox](07-orbital-mission-planner/prompt.md) | Scientific application |
| 08 | [SDF and Constructive Solid Geometry Studio](08-sdf-csg-studio/prompt.md) | 3D editor |
| 09 | [Falling-Sand Alchemy Sandbox](09-falling-sand-alchemy/prompt.md) | Cellular simulation |
| 10 | [Procedural Stealth Heist Sandbox](10-stealth-heist/prompt.md) | AI game |
| 11 | [Factory Automation and Logistics Game](11-factory-automation/prompt.md) | Systems game |
| 12 | [Rhythm-Synchronized Bullet-Hell Game](12-rhythm-bullet-hell/prompt.md) | Audio game |
| 13 | [3D FPV Drone-Racing Simulator](13-drone-racing/prompt.md) | 3D game |
| 14 | [Evolutionary Ecosystem Laboratory](14-evolution-ecosystem/prompt.md) | Agent simulation |
| 15 | [Digital Logic and Tiny-CPU Laboratory](15-digital-logic-lab/prompt.md) | Engineering editor |
| 16 | [Procedural Tactical Roguelike](16-procedural-roguelike/prompt.md) | Turn-based game |
| 17 | [Time-Loop Physics Puzzle Game and Editor](17-echo-loop-puzzler/prompt.md) | Puzzle game |
| 18 | [3D Weather and Storm Laboratory](18-weather-storm-lab/prompt.md) | Atmospheric simulation |
| 19 | [Node-Based Generative Graphics Studio](19-node-graphics-studio/prompt.md) | Creative editor |
| 20 | [City Traffic and Transit Simulator](20-city-traffic-transit/prompt.md) | Urban simulation |
| 21 | [Spreadsheet & Chart Studio](21-spreadsheet-chart-studio/prompt.md) | Data application |
| 22 | [Vector & Layout Studio](22-vector-layout-studio/prompt.md) | Creative application |
| 23 | [Project Planning Studio](23-project-planning-studio/prompt.md) | Planning application |
| 24 | [The Capstone: Build the Unexpected](24-capstone/prompt.md) | Open-ended creation |
