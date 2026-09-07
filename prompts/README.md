# Prompt library

30 tasks, 30 complete agentic prompts. Open one task's `prompt.md` and give its entire contents to your coding agent. Every prompt contains the product requirements, tool-enabled development workflow, browser validation, domain checks, and delivery contract. No additional protocol prompt is needed.

Tasks 01–20 deliver `index.html`. Tasks 21–30 deliver `project/`. Each run may plan, execute, test and improve from the start. Keep screenshots and agent-authored validation notes in `evidence/` alongside the artifact. Supply `fixtures/` for a Real Apps task read-only when available; expected behavior is stated in the prompt itself.

`acceptance.md` is a convenient standalone copy of the public checks, not an alternative prompt. Evaluator-only variations live under `evaluator/`; do not expose those to the tested agent. Copy only the selected prompt and its public fixtures into an isolated agent workspace, not the entire package.

See `SELECTION_GUIDE.md` for task combinations. `catalog.json` is read by the gallery and importer.

The catalog's optional `look_for` field provides the showcase's practical guidance. Edit that string to change the hints beside a prompt title, then restart the local gallery or rebuild the public site. These hints help visitors explore a build; the complete prompt and acceptance checks define the requirements.

## Choose a prompt

| ID | Prompt | Track |
|---|---|---|
| 01 | [Real-Time 2D Fluid Simulation](01-fluid-simulation/prompt.md) | HTML |
| 02 | [3D Hydraulic Erosion Laboratory](02-hydraulic-erosion/prompt.md) | HTML |
| 03 | [Modular Synthesizer and Sequencer](03-modular-synth/prompt.md) | HTML |
| 04 | [Soft-Body, Cloth, and Constraint Playground](04-deformable-physics/prompt.md) | HTML |
| 05 | [Black Hole and Gravitational Lensing Explorer](05-black-hole-lensing/prompt.md) | HTML |
| 06 | [Wave Interference and Diffraction Laboratory](06-wave-laboratory/prompt.md) | HTML |
| 07 | [Orbital Mechanics and Mission-Planning Sandbox](07-orbital-mission-planner/prompt.md) | HTML |
| 08 | [SDF and Constructive Solid Geometry Studio](08-sdf-csg-studio/prompt.md) | HTML |
| 09 | [Falling-Sand Alchemy Sandbox](09-falling-sand-alchemy/prompt.md) | HTML |
| 10 | [Procedural Stealth Heist Sandbox](10-stealth-heist/prompt.md) | HTML |
| 11 | [Factory Automation and Logistics Game](11-factory-automation/prompt.md) | HTML |
| 12 | [Rhythm-Synchronized Bullet-Hell Game](12-rhythm-bullet-hell/prompt.md) | HTML |
| 13 | [3D FPV Drone-Racing Simulator](13-drone-racing/prompt.md) | HTML |
| 14 | [Evolutionary Ecosystem Laboratory](14-evolution-ecosystem/prompt.md) | HTML |
| 15 | [Digital Logic and Tiny-CPU Laboratory](15-digital-logic-lab/prompt.md) | HTML |
| 16 | [Procedural Tactical Roguelike](16-procedural-roguelike/prompt.md) | HTML |
| 17 | [Time-Loop Physics Puzzle Game and Editor](17-echo-loop-puzzler/prompt.md) | HTML |
| 18 | [3D Weather and Storm Laboratory](18-weather-storm-lab/prompt.md) | HTML |
| 19 | [Node-Based Generative Graphics Studio](19-node-graphics-studio/prompt.md) | HTML |
| 20 | [City Traffic and Transit Simulator](20-city-traffic-transit/prompt.md) | HTML |
| 21 | [Import Studio: Reliable Data Onboarding](21-import-studio/prompt.md) | Real Apps |
| 22 | [Resource Booker: Conflict-Free Reservations](22-resource-booker/prompt.md) | Real Apps |
| 23 | [Stockroom: Inventory and Order Fulfillment](23-stockroom/prompt.md) | Real Apps |
| 24 | [Workflow Desk: Durable Visual Automation](24-workflow-desk/prompt.md) | Real Apps |
| 25 | [API Workbench: Stateful Request Laboratory](25-api-workbench/prompt.md) | Real Apps |
| 26 | [Config Workbench: Structural Diff and Merge](26-config-workbench/prompt.md) | Real Apps |
| 27 | [Field Notebook: Offline Inspections and Sync](27-field-notebook/prompt.md) | Real Apps |
| 28 | [Approval Desk: Versioned Change Requests](28-approval-desk/prompt.md) | Real Apps |
| 29 | [Sheetcraft: Spreadsheet with a Formula Engine](29-sheetcraft/prompt.md) | Real Apps |
| 30 | [Project Planner: Dependencies and Capacity](30-project-planner/prompt.md) | Real Apps |
