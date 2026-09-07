# Changelog

## Trial by Pyro: 2026-09-07

- Added public appsettings.json configuration for model order, display names, and card colors, with Astra, Grok, and Gemini as the current order.
- Tinted model cards, missing-build placeholders, and viewer labels consistently, with stable colors for unlisted models.
- Expanded the project rationale with Pyro's preference for interactive demonstrations that expose behavior beyond a voxel fly-through.
- Kept model and track filters readable on mobile screens.
- Preserved exact public source downloads through attachment routes that avoid Netlify's HTML injection without duplicating artifact files.
- Expanded live previews to the full browser viewport with a compact control bar and explicit device-size presets.
- Added the Why Trial? reading view and README rationale in Pyro's voice, with the supplied Deep-SWE snapshot.
- Included seven Gemini 3.8 Flash builds and selected existing evidence screenshots for their gallery previews.
- Adopted the Trial by Pyro name and visual identity.
- Grouped the showcase by prompt so submitted builds can be compared side by side.
- Added a focused static export and Netlify scripts for public hosting.
- Rewrote the README around the finished builds, with detailed result and evaluation guidance in docs/results.md.
- Kept project documentation in English and removed the separate German quickstart.
- Preserved the original submitted artifacts, public prompt requirements, and fixtures.

## Single-run edition: 2026-09-06

- Consolidated the suite into 30 complete prompt.md files, one per challenge.
- Enabled planning, implementation, execution, browser validation, debugging and tests throughout every run.
- Retained all 30 domain specifications, the ten Real Apps' 60 public scenarios and their data fixtures; updated only protocol text in fixture README files.
- Kept dependency-free single-HTML runtime deliverables for tasks 01–20 and genuine multi-file project deliverables for tasks 21–30.
- Unified output conventions around index.html, project/ or project.zip plus optional metadata, screenshot, report and evidence.
- Reworked the gallery, viewer, prompt library, score tables, CSV, schemas and importer for singular results.
- Added explicit stale-report detection, source-download restrictions and overwrite invalidation of prior scores/evidence.
- Removed obsolete protocol documents, duplicate task prompts and screenshots depicting the prior interface.
- Added package, source, fixture, HTTP, importer and browser-level checks for the revised contract.
