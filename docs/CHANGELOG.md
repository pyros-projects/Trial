# Changelog

## The first Capstones and a complete Grok collection: 2026-09-08

- Added Grok's spreadsheet, vector editor, project planner, and Capstone. Grok now has a submission for every prompt in the 24-task collection.
- Added Astra's spreadsheet, vector editor, and Capstone, bringing the showcase to 94 builds. All 24 prompts now have at least one submitted implementation.
- Included the first two Capstones: Grok's *Ut Pendet*, a hanging-chain and vault form-finding workshop, and Astra's *Selvedge*, an interactive pocket loom. Existing prompt comparisons and model collections include the new entries automatically.
- Added representative thumbnails and share previews while preserving original submissions and excluding raw evidence from the website.

## Gemini completes the first twenty prompts: 2026-09-08

- Added Gemini's logic lab, roguelike, echo-loop puzzler, weather lab, node graphics studio, and traffic simulator. Astra, Grok, and Gemini now each cover prompts 01–20.
- Added GLM's SDF/CSG studio and sand simulation, completing its first ten prompts. The gallery now contains 87 builds across six models.
- Added a slow-start notice to GLM's SDF/CSG studio after observing roughly 28 seconds of shader initialization before it rendered and accepted input.

## Shareable model collections and three new builds: 2026-09-08

- Selecting one model now displays its builds across prompts in a compact grid: three columns on desktop, two on smaller screens, and one on mobile. Cards identify the prompt and retain its Look for guidance, source access, notices, and implementation links.
- Added full-screen model collections with Copy link, model setup details, and all submitted builds. Shared links open the complete collection independently of saved filters; returning from an implementation restores its collection.
- Added model-specific share pages and small preview collages from up to three distinct prompts, with Open Graph and Twitter metadata. Existing implementation and prompt-comparison links remain intact.
- Included Opus's stealth and factory builds and Astra's traffic simulator, bringing the collection to 79 builds. Astra and Grok now each cover prompts 01–20. Supplied final screenshots illustrate the new entries; original submissions remain unchanged.

## A single-file collection and the Capstone: 2026-09-08

- Preserved the previous Real Apps prompts 21–30, fixtures, runtime contracts, and domain evaluation material on [`experimental/real-apps`](https://github.com/pyros-projects/Trial/tree/experimental/real-apps). The original 01–20 prompts and submitted results remain unchanged.
- Added Spreadsheet & Chart Studio (21), Vector & Layout Studio (22), and Project Planning Studio (23), with bounded algorithms, concrete public checks, embedded examples, offline HTML delivery, and disposable session state.
- Added The Capstone (24): live harness web research, a self-chosen distinct concept, a compact map of the other 23 briefs, an honest research trail, and a complete offline experience.
- Included Astra’s weather laboratory and node graphics studio with their supplied final screenshots, bringing the collection to 76 builds. Original artifacts remain unchanged.
- Updated the active catalog, README, selection and execution guidance, and metadata schema to 24 single-HTML tasks. Retained generic local project handling and public demo isolation for compatibility.
- Made prompt counts and track choices follow the loaded data. A single-track collection hides the track control, and stale retired track selections reset instead of hiding the new library.

## Trial: 2026-09-07

- Renamed the project to Trial - a Vibe Benchmark, with a small (by Pyro) byline. Renamed the existing GitHub repository to pyros-projects/Trial and updated website links and share metadata.
- Included Gemini 3.8 Flash's SDF/CSG studio with its supplied desktop screenshot, completing all eight current prompt groups with Astra, Grok, and Gemini builds.
- Replaced third-person self-references with first-person copy or neutral captions in the README, site, and project description.
- Added a model picker inside the maximized viewer, with configured ordering, same-prompt comparisons, preserved viewport presets, and browser history.
- Added an expandable Look for overlay that leaves the running app's size and state intact.
- Added per-implementation share pages with Open Graph and Twitter metadata using existing thumbnails, plus configurable canonical siteUrl.
- Included Grok 4.6's SDF/CSG studio and its supplied default-scene screenshot, bringing the collection to 23 HTML builds.
- Clarified that static-export exclusions do not make files in a public GitHub repository private.
- Added GitHub links in the masthead and footer for the public Trial repository.
- Added Copy link controls on cards and in the viewer, with direct links that open a specific build maximized and support reload and browser history.
- Added practical Look for guidance to all 30 catalog entries, displayed beside showcase prompt titles and stacked below them on small screens.
- Introduced the A Vibe Benchmark subtitle and an explicit, informal scope statement in the README and Why Trial? view: personal exploration, not a scientific model ranking.
- Added public appsettings.json configuration for model order, display names, and card colors, with Astra, Grok, and Gemini as the current order.
- Tinted model cards, missing-build placeholders, and viewer labels consistently, with stable colors for unlisted models.
- Explained why I prefer interactive demonstrations that expose behavior beyond a voxel fly-through.
- Kept model and track filters readable on mobile screens.
- Preserved exact public source downloads through attachment routes that avoid Netlify's HTML injection without duplicating artifact files.
- Expanded live previews to the full browser viewport with a compact control bar and explicit device-size presets.
- Added a first-person Why Trial? reading view and README rationale, with the Deep-SWE snapshot.
- Included seven Gemini 3.8 Flash builds and selected existing evidence screenshots for their gallery previews.
- Adopted the Trial name and visual identity.
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
