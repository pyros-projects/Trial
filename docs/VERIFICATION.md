# Verification record

These checks validate the package and gallery, not implementations or model performance on the thirty challenges.

## GLM stealth and cancelled-run context: 2026-09-08

GLM's stealth submission brings the collection to **74 HTML builds across twenty prompts and six models**, including eight GLM builds. All **27 original files totaling 5,572,878 bytes** remain unchanged. Its thumbnail is an exact copy of the visually inspected supplied `evidence/16-run.png`, showing active gameplay at **1280 × 800**.

The new `run-cancelled` notice type labels an interrupted agent run separately from runtime errors and slow startup. GLM's entry records my reported observation: the agent kept unsuccessfully trying to finish its own game during playtesting, got stuck repeating those attempts, and I cancelled the run after about an hour. This account is curator context, not an independent determination that the game cannot be completed. The submitted game remains available.

All **three focused notice browser tests passed**, including public and local display, invalid settings, text escaping, source/privacy boundaries, shared links, model switching, and preserving app state while collapsing or reopening a cancellation notice. JavaScript syntax and package whitespace checks passed. Actual Netlify Dev and production checks verified Start Mission, brief movement input, the cancellation message, its narrow layout, and removal of the notice when switching to an unflagged model. The iframe occupied **1440 × 1057** on desktop and **390 × 765** on mobile and was removed on close. No uncaught JavaScript errors or external requests appeared during these brief checks; a complete playthrough was not attempted.

The bounded publication review scanned all **11 original text files** and metadata of all **16 PNGs**. No confirmed credentials, private-identity linkage, private endpoints, or identifying image metadata were found. Four supplied images were visually inspected. Raw evidence, development files, and build fragments remain excluded from the website.

Production deployment **`6aa044027037af0092c3c856`** publishes **334 files totaling 13,595,683 bytes (12.97 MiB)**. The exact public file inventory passed. Live HTTPS checks verified all **74** original source hashes, implementation share pages, thumbnails and attachment/sandbox headers, plus **20** comparison pages and preview images. The public code, settings, four notices, and six model profiles match the reviewed export. **Fifty-three** representative private routes returned 404.

## Grok completes the HTML track: 2026-09-08

The collection contains **73 HTML builds across all twenty HTML prompts and six models**: Astra 17, Opus 9, Grok 20, GLM 7, Gemini 14, and Qwen 6. New submissions are Grok's weather laboratory, node graphics studio, and city traffic simulator; Astra's echo-loop puzzler; and Opus's sand sandbox. Grok now has one submission for every HTML prompt. All **265 original files totaling 42,256,107 bytes** remain unchanged. Four thumbnails are exact copies of visually inspected supplied images. Grok's node studio has a fresh capture of the final HTML in the public sandbox at **1440 × 1057**, because its supplied desktop images predate visible source changes. No screenshot pixels or submitted HTML were edited.

All five new apps launched through their implementation share links on Netlify Dev and production, with no uncaught JavaScript errors or external requests during the bounded checks. Native input exercised movement and echo creation in Astra's puzzler, advancing animation and Pause in Grok's node studio, and Pause, Step, and resume in the other three simulations. The viewer iframe filled **1440 × 1057** on desktop and **390 × 765** after a narrow resize, and closing the viewer removed it. These checks cover gallery integration and brief interaction, not complete application correctness or an exhaustive audit of each app's mobile layout. No additional build notices were warranted by these observations.

The five affected expanded comparisons show their recorded builds in the configured model order, with missing entries hidden by default. The sand comparison now includes five models. All **73** exported HTML hashes match the originals, every build has a valid thumbnail, and all **20** populated comparisons have a share page and a **1200 × 630** preview image. An exact file inventory check confirmed the export contains only the expected public files.

The bounded publication review covered all **99 original text files** and metadata of all **166 original PNGs**. No confirmed credentials, private-identity linkage, or private endpoints were found. Pseudonymous local paths remain in raw GitHub evidence, which is excluded from Netlify. Selected thumbnail pixels were inspected; the remaining evidence images were not exhaustively reviewed.

Production deployment **`6aa03fb3076b8a0066950964`** publishes **331 files totaling 13,440,462 bytes (12.82 MiB)**. Live HTTPS checks passed for all **73** original source hashes, implementation share pages, thumbnails, and attachment/sandbox headers, plus all **20** comparison pages and preview images. The public JavaScript, CSS, settings, three existing notices, and six model profiles match the reviewed export. **Fifty** representative private routes returned 404.

## Build notices and eleven new submissions: 2026-09-08

The collection contains **68 HTML builds across seventeen prompts and six models**: Astra 16, Opus 8, Grok 17, GLM 7, Gemini 14, and Qwen 6. New submissions cover Qwen 05; Opus 08; Gemini 12/13/14; Astra 15/16; Grok 14/16/17; and GLM 07. The roguelike and echo-loop puzzler now have their first entries. All **428 original files totaling 86,428,910 bytes** remain unchanged. Eleven thumbnails are exact copies of individually inspected supplied images, whose viewport sizes and renderers vary.

Curated `buildNotices` in the existing public settings file bind to exact run IDs. Cards show an attention label; build details and the maximized viewer show the explanation. The viewer's collapsible overlay preserves iframe dimensions and state, follows model changes, and works with direct implementation links. A public-only scope describes sandbox-specific behavior. No submitted HTML, runtime policy, scanner, or public metadata allowlist was changed.

All **40 focused tests passed**: three new notice browser tests, six existing gallery browser tests, and thirty-one static-export/deployment checks. Coverage includes repeated-run isolation, invalid settings, literal hostile text, refresh, public scope, source/privacy boundaries, shared links, model changes, native dismissal controls, and frame preservation at **1440, 768, 390, and 320 pixels**. Static review identified a clipped keyboard focus outline; the final stylesheet uses an inset ring. JavaScript syntax and whitespace checks passed.

The new runtime observations are retained with their original submissions:

- **Opus 08:** one isolated Chrome run compiled its shader in **47.2 seconds**, then rendered Bloom and responded to Play/Pause. A separate user observation reported approximately three minutes. Its notice describes potentially lengthy initialization.
- **Qwen 05:** the rendering loop references an undefined `syncMode`, producing repeated JavaScript errors even though a scene can appear.
- **Grok 16:** an uncaught startup `localStorage` read is blocked by the public opaque sandbox. The notice appears only in the public gallery; the downloaded HTML has a different storage context.

The bounded publication review scanned all **169 text files**, including the complete 21,535,770-byte Astra roguelike log, and metadata of all **259 original PNGs**. No confirmed credentials, private-identity linkage, or private endpoints were found. Pseudonymous local paths remain in raw GitHub evidence, which is excluded from Netlify. Selected thumbnail pixels were reviewed; the remaining evidence images were not exhaustively inspected.

Production deployment **`6aa02e09ffff7bc1ba180358`** publishes **310 files totaling 12,493,358 bytes (11.91 MiB)**. Live HTTPS checks passed for all **68** implementation share pages, original source hashes, thumbnails and attachment/sandbox headers, plus all **17** comparison pages and preview images. The published JavaScript, CSS, settings, and three configured notices match the reviewed files; all six profiles remain intact. Forty-five representative private routes returned 404. Production visual checks confirmed the three card labels and the collapsible notice overlay at four viewport widths, without iframe replacement or resizing.

Seven production previews were exercised at desktop and mobile sizes, including Opus after initialization. All occupied the full **1440 × 1057** or **390 × 765** app area and removed their iframe on close. The documented Qwen and Grok runtime errors reproduced; no other uncaught exceptions or external requests appeared during these checks. This is a gallery integration record, not a complete evaluation of the submitted applications.

## Qwen modular synth: 2026-09-08

Qwen's modular synthesizer brings the collection to **57 HTML builds across fifteen prompts and six models**, with five Qwen submissions. The expanded synth comparison now contains all six models in the configured order. All **25 original files totaling 2,231,144 bytes** remain unchanged; the thumbnail is an exact copy of the inspected supplied `h-02-playing.png`.

Chromium checks against Netlify Dev and production verified the direct implementation link, user-initiated audio start with active voices and nonzero output, and an advancing sequencer playhead. The viewer occupies **1440 × 1057** on desktop and **390 × 765** on mobile; closing it removes the iframe. The six-card comparison and default missing-build filter passed, with no uncaught JavaScript errors or external requests during the smoke checks. These checks establish gallery integration and audio startup, not musical quality or complete task correctness.

The bounded publication review covered all **17 text files** and metadata of all **eight original PNGs**. No confirmed credential or private-identity leak was found. Pseudonymous local paths remain in raw GitHub evidence, which is excluded from the website. Only selected screenshot pixels were visually reviewed.

Production deployment **`6aa009fe492c63bcd69d1538`** publishes **273 files totaling 10,490,475 bytes (10.00 MiB)**. Live HTTPS verification passed for all **57** implementation share pages, source hashes, thumbnails and attachment/sandbox headers, plus all **15** comparison pages and preview images. All six model profiles remain intact, and thirty-four representative private routes returned 404.

## Thirteen new builds: 2026-09-08

The collection contains **56 HTML builds across fifteen prompts and six models**: Astra 14, Opus 7, Grok 14, GLM 6, Gemini 11, and Qwen 4. This batch adds Qwen 04; Opus 06/07; Gemini 09/10/11; Astra 13/14; Grok 09/12/13/15; and GLM 06. Drone racing, the evolutionary ecosystem, and the digital logic lab now have their first submissions. Prompt IDs still group skipped submissions correctly, including Grok's task 15 without task 14.

All **432 original files totaling 145,234,578 bytes** remain unchanged. Twelve thumbnails are byte-for-byte copies of individually inspected supplied screenshots. Gemini's stealth-game thumbnail is a fresh **1280 × 800** capture of the delivered HTML after starting its default mission: the supplied active desktop captures showed an older diagnostic-overlay position.

All **thirteen new builds** launched in Chromium through the actual Netlify Dev public sandbox, with rendered canvases, no uncaught JavaScript errors, and no external requests during the smoke checks. Desktop previews occupied the full area beneath the 43-pixel bar; mobile previews measured **390 × 765** beneath the 79-pixel bar. Closing each viewer removed its iframe. The expanded sand, drone, ecosystem, and logic comparisons showed four, two, one, and one recorded builds respectively, with empty columns hidden by default. These are gallery integration and launch checks, not complete domain evaluations or model scores.

The bounded privacy review scanned all **127 text files**, including the complete 59,090,464-byte Astra ecosystem log, and metadata of all **305 original PNGs**. No confirmed real credentials, private-identity linkage, or private endpoints were found. Pseudonymous local paths remain in raw GitHub evidence; that evidence is excluded from the website. Selected thumbnail pixels were reviewed, but the remaining evidence screenshots were not exhaustively inspected.

Production deployment **`6aa00772ea058d91f5c3db8a`** publishes **270 files totaling 10,241,867 bytes (9.77 MiB)**. Live HTTPS checks passed for all **56** implementation share pages, source hashes, thumbnails and attachment/sandbox headers, plus all **15** comparison pages and preview images. All six model profiles remain intact; thirty-three representative private routes returned 404. Four focused production browser checks also passed for Gemini stealth, Astra drone racing and ecosystem, and Grok logic, together with the updated comparison groups and default visibility filter.

## Recorded builds only: 2026-09-08

The showcase and expanded comparison now share a **Recorded builds only** checkbox, enabled by default. It removes empty model columns before layout, including both missing submissions and placeholders caused by other filters. Existing builds, repeated attempts, and configured model order remain intact. The preference is saved in the existing browser settings; older settings default to enabled, and Reset restores that default. Shared comparisons honor the preference while retaining their independent model and search selection.

All **seven focused Windows Chromium tests** passed: four new preference tests, two existing placeholder tests, and the responsive model-comparison test. Coverage includes both placeholder types, duplicates, search and empty states, reload persistence, Reset, synchronization between controls, category close/focus behavior, and real exported comparison links with saved filters. JavaScript syntax and whitespace checks passed. The final layout was also inspected against the actual 43-build export at **1440, 768, 390, and 320 pixels**, including both controls and horizontal overflow checks. The [gallery preview](gallery-results-preview.png) shows the new filter.

Production deployment **`6a9ff401a0f119ccb4da974a`** publishes **225 files totaling 7,972,939 bytes (7.60 MiB)**. The published HTML, JavaScript, and stylesheet match the reviewed source hashes. Live Chromium checks passed for default visibility, toggling, persistence, Reset, expanded and shared comparisons, search, empty states, and responsive layouts, with no uncaught errors. This presentation update retains the existing 43-build, twelve-prompt collection.

## Opus lensing and Astra rhythm game: 2026-09-08

The collection contains **43 HTML builds across twelve prompts and six models**: Astra 12, Opus 5, Grok 10, GLM 5, Gemini 8, and Qwen 3. New submissions are Opus's `05-black-hole-lensing` and Astra's `12-rhythm-bullet-hell`. All **132 original files totaling 24,670,034 bytes** remain unchanged. The two top-level thumbnails are exact copies of the supplied `22-final-high-quality.png` and `24-final-desktop-gameplay.png`, inspected before publication.

All **31 static-export and deployment-script tests** passed. Chromium checks against the actual Netlify Dev export verified both direct implementation links, rendered canvases, comparison grouping, and iframe removal on close. The black-hole comparison has five builds and six model columns; the rhythm-game comparison has one build and the other models' placeholders. Both apps occupy **1440 × 1057** on desktop and **390 × 765** on mobile beneath the viewer bar. Astra's game advanced beyond four musical beats after clicking its start button. No uncaught JavaScript errors or external requests occurred during these checks. These are gallery integration and launch checks, not a full evaluation of physics, gameplay, or sound quality.

The bounded publication review scanned all 72 text files and metadata of all 60 original PNGs plus the two thumbnail copies. No confirmed credentials or private-identity linkage were found. Pseudonymous local paths and browser test IDs remain in the raw GitHub evidence. Only the selected screenshot pixels were visually reviewed; this is not a visual privacy review of every evidence image.

Production deployment **`6a9fdccebfaaad00e9b244f1`** publishes **225 files totaling 7,971,255 bytes (7.60 MiB)**. Live HTTPS verification passed for all **43** implementation share pages, original source hashes, thumbnails and attachment/sandbox headers, plus all **12** comparison pages and preview images. All six model profiles remain intact, and twenty representative private routes returned 404. Both new implementations also passed the same desktop/mobile Chromium checks on production. Raw evidence and metadata remain excluded from the website.

## Qwen and ten new builds: 2026-09-08

The collection now contains **41 HTML builds across eleven prompts and six models**: Astra 11, Opus 4, Grok 10, GLM 5, Gemini 8, and Qwen 3. New submissions cover Qwen 01/02/09, Opus 03/04, Astra 10/11, Grok 10, and GLM 04/05. The original five-model order and colors are retained; Qwen is sixth in teal. Its shared setup records **Pi / xhigh**, **MTPLX (local)**, and the linked **Optimized Speed (4-bit, 8-bit attention)** quantization. Runtime and quantization are separate optional, bounded public profile fields with the same URL validation as provider and harness links.

All **13 focused checks** passed: nine profile checks, two public-export profile checks, and two Chromium profile/share checks. Coverage includes local/public parity, rejected URLs and unknown fields, escaped labels, responsive Setup panels at 1440/768/390/320 pixels, and opening Setup without restarting the live app. JavaScript syntax and package whitespace checks passed. All ten submitted HTML files also launched in the actual public sandbox at 1440 × 1057 beneath the 43-pixel viewer bar, with no uncaught JavaScript errors during the smoke check. The six-model comparison renders as **3 + 3**, and Qwen's runtime/quantization links remain readable on mobile. These are launch and gallery checks, not evaluations of each application's complete task requirements.

All **467 original files totaling 114,180,613 bytes** remain unchanged. Ten top-level screenshots are exact copies of supplied images, individually inspected before publication. The bounded pre-publication audit found no confirmed real credentials or private-identity linkage in the reviewed text and media metadata; pseudonymous local paths and diagnostic IDs remain in raw evidence on GitHub. Raw evidence stays outside Netlify. The [gallery image](gallery-results-preview.png), [six-model comparison](prompt-comparison-preview.png), and [Qwen setup](qwen-setup-preview.png) record the updated presentation.

Production deployment **`6a9fac2d467bf9483fcba785`** publishes **217 files totaling 7,592,208 bytes (7.24 MiB)**. Live HTTPS checks passed for all **41** implementation share pages, source SHA-256 values, attachment/sandbox headers and thumbnails; all **11** comparison pages and images; and all **six** model profiles. Eighteen representative private routes returned 404.

## Disposable Real Apps demos: 2026-09-08

All ten Real Apps prompts now require a generated `project/gallery/index.html` alongside the complete local application. Every prompt embeds the same static-demo contract and adds task-specific in-memory workflows. Canonical application/runtime blocks, all original acceptance documents, and public fixtures retain their existing hashes. Demo-only actor, device, transport, and recovery simulations are explicitly separated from genuine backend acceptance checks.

The full WSL suite passed **109 tests with no skips**, including both browser modes. New coverage verifies fixed-path discovery for all ten Real Apps tasks, omission without a demo, exact source bytes and hashes, source/config/evidence exclusions, link/reparse rejection, atomic build failure, Netlify Forms opt-in rejection across all submitted HTML, local demo fallback, and explicit full-app preview precedence. Browser checks verify opaque storage and parent isolation, blocked request/resource/form attempts, real JSON import and Blob download, frame reset during pending work, reload, independent direct visits, and a usable mobile toolbar. A source-encoding compatibility check was added after review; the final focused exporter checks also passed.

Netlify draft **`6a9f39afac84dc39abe6b08f`** hosted a clearly labeled integration fixture from a temporary package, separate from the benchmark collection. Live Chromium and HTTPS checks passed for direct and framed response policies, source download hashes and attachment headers, blocked connections/resources, storage isolation, import/export, reset with a pending timer, independent instances, reload, and the mobile toolbar. The showcase's Netlify settings report `ignore_html_forms: true` and zero registered forms.

No submitted Real Apps implementations exist in this verified collection yet. These checks establish the prompt/delivery contract and gallery hosting boundary, not that ten future applications satisfy their domain requirements or that arbitrary submitted code is harmless. A concurrently appearing Astra task-10 folder was excluded from this publication snapshot.

Production deployment **`6a9f3aedd38bd24bf1552ef7`** publishes **185 files totaling 5,843,916 bytes (5.57 MiB)** and retains the 31 reviewed builds. The live viewer JavaScript matches the verified source hash, and all ten published Real Apps prompts include their new gallery contract. The final focused checks passed all **12 demo/export contract tests** and **31 existing static-export/deployment tests** after the encoding compatibility fix.

## Grok task 11 and skipped prompts: 2026-09-07

Grok's **Factory Automation and Logistics Game** brings the collection to **31 HTML builds across ten prompts**. Discovery correctly assigns `11-factory-automation` by its complete task ID despite Grok's missing tasks 09 and 10. Browser checks confirmed Grok's missing-build card remains in task 09, task 10 with no submissions creates no showcase group, and task 11 contains one Grok build plus the other four models' placeholders in the configured order. No gallery code changes were needed.

The new top-level screenshot is an exact copy of `evidence/screenshots/13-congested-preset.png`. All 19 original submission files remain byte-for-byte unchanged. The factory canvas starts in the public sandbox, and its direct implementation link opens a 1440 × 1057 app beneath the 43-pixel bar. These checks cover discovery, display, and launching the app; they do not establish simulation correctness or an evaluator score.

Production deployment **`6a9f330e5a5ea6f49c974f18`** publishes **185 files totaling 5,786,525 bytes (5.52 MiB)**. Live HTTPS verification passed for all 31 implementation share pages, thumbnails, exact source hashes and attachment/sandbox headers; all ten comparison pages and images; and the five model profiles. Fifteen representative private paths, including the new result's evidence and copied harness skill, returned 404. The new category Copy link and direct app handoff also passed production browser checks.

## Expanded category grid: 2026-09-07

Expanded categories now show every model entry in a wrapping grid: three columns above 1100 pixels, two from 581–1100, and one at 580 or below. Later models occupy additional rows reached by vertical scrolling. The expanded view shows a total model count and Copy link; the main showcase retains horizontal paging. Opening an expanded category starts at the top, and closing it preserves the main gallery's filters, carousel position, and focus.

All **28 browser checks passed**: 26 core checks and the two bridge presentation checks, enabled in separate runs. Updated assertions verify row geometry and no horizontal scrolling at six widths, native End navigation to the final mobile entry, opening an app from the second row, and unchanged nested-viewer and sharing behavior. JavaScript syntax and whitespace checks passed. The [desktop](prompt-comparison-preview.png) and [mobile](prompt-comparison-mobile.png) comparison images show the new layout.

Production deployment **`6a9f305139b5a6cbb1fe169b`** publishes **180 files totaling 5,613,113 bytes (5.35 MiB)**. Published JavaScript and CSS match the verified build byte-for-byte. Live browser checks confirm the hydraulic-erosion category displays five models as **3 + 2** on desktop and five vertically scrollable entries on mobile, with no horizontal overflow and the correct Copy link URL.

## Five-model comparisons and category sharing: 2026-09-07

The collection now contains **30 HTML builds across nine prompts and five models**, ordered **GPT-6 Astra, Opus 5, Grok 4.6, GLM 5.3 Flash, Gemini 3.8 Flash**. The new profiles record **Claude Code / Max** for Opus and **Pi / High** for GLM. Their five top-level screenshots are exact copies of supplied final evidence images; the original HTML and evidence files remain unchanged. The masthead and README now give *a Vibe Benchmark* the same font size as Trial, with a smaller **by Pyro** line and no parentheses.

The complete WSL suite with both browser modes enabled passed **97 tests with no skips**. JavaScript syntax and Git whitespace checks also passed. Coverage includes three columns above 1100 pixels, two from 581 through 1100, and one at 580 or below; one-column arrow steps, native scrolling, keyboard navigation, missing builds, and repeated runs. Expanded categories preserve the main gallery's position and filters. Closing a nested app or prompt returns to the comparison, and closing the comparison restores focus to its Expand control.

Category **Copy link** is available beside the arrows and inside the expanded view. Real-server browser tests verify local hash links, exported `/compare/<task-id>/` pages, saved-filter bypass, configured model order, browser history, close and reload, invalid links, and complete dialog/iframe cleanup. Export tests cover prompt-specific metadata, exact counts, safe paths and escaped text, distinct-model image selection, source metadata removal, and fallbacks without Pillow or screenshots.

Visual checks of the actual gallery, expanded comparison, title, and Why view found no page overflow at desktop, tablet, or mobile sizes. See the [expanded desktop comparison](prompt-comparison-preview.png), [mobile comparison](prompt-comparison-mobile.png), and refreshed gallery and README images. Both the five-model fluid preview and the one-model sand preview were inspected. The export contains **nine 1200 × 630 comparison JPEGs totaling 608,015 bytes**, composed from already published thumbnails, with no additional submitted HTML or raw evidence copies.

Production deployment **`6a9f2d0dd4b8356b274415ca`** publishes **180 files totaling 5,612,861 bytes (5.35 MiB)**. Live HTTPS verification passed for all 30 implementation share pages, thumbnails, exact source hashes and attachment/sandbox headers; all nine comparison pages, canonical URLs, titles, counts and metadata-free JPEGs; and the five allowlisted model profiles. Thirteen representative private routes returned 404. Social-platform cache refresh and actual message unfurling were not tested.

Production browser checks confirmed a shared fluid comparison opens all five models despite saved filters that hide every main-gallery result. Copy link returned the canonical comparison URL. Opus and GLM's fluid canvases opened without page errors in 1600 × 1057 frames below the 43-pixel bar, and closing the app restored the expanded comparison and its URL. The sand comparison opened and copied its correct link at 390 × 844 without page overflow. These are gallery smoke checks, not an evaluation of the submitted simulations.

## Shared model setups and Astra task 09: 2026-09-07

Each model now has an optional `results/<model>/model.toml` containing its reported provider, harness, setting, and homepage links. The current profiles record **Codex CLI / Max**, **Cursor Desktop / High Fast**, and **Antigravity CLI / High**. Cards show the harness and setting; **Setup** in the maximized viewer and the build-details tab show the profile and external links. The copy identifies this as shared collection context, rather than equivalent budgets or a complete per-run record. Model order and colors remain in `appsettings.json`.

The complete WSL suite with both browser modes enabled passed **81 tests with no skips**. After adding the Windows Python 3.11 reparse-point fallback, all **seven focused profile tests** passed again. Coverage includes local/public profile parity, unknown-field exclusion, bounded input, malformed TOML, unsafe URLs, linked paths, refresh, escaped text, public share entry, and profile updates when switching models. No raw TOML or run metadata is copied into the public export.

Chromium checks confirm Setup and Look for dismiss each other, close on Escape or app interaction, and leave the running app's dimensions and state intact. Visual checks across 320–1600 pixel widths found no toolbar overflow. The app still fills the viewport below the 43-pixel desktop bar or 79-pixel mobile bar. See the [desktop setup](model-setup-preview.png), [mobile setup](model-setup-mobile.png), and refreshed gallery and README images.

Astra's **Falling-Sand Alchemy Sandbox** brings the collection to **25 HTML builds across nine prompts**. Its top-level screenshot is an exact copy of the supplied final desktop evidence image. Its live canvas opens in the public sandbox without a page error; this is a gallery smoke check, not a verification of the simulation's full requirements. All original submitted HTML and evidence files remain unchanged.

Production deployment **`6a9f21119c3114c0bb192941`** publishes **147 files totaling 4,206,020 bytes (4.01 MiB)**. Live HTTPS checks passed for all 25 share pages, thumbnails, source hashes, and attachment/sandbox headers, plus the three allowlisted profiles. Nine representative private routes, including raw model TOML and the new run's evidence, returned 404. Production browser checks confirmed the three setup values follow model selection and retain the full mobile app area.

## Trial name and complete model coverage: 2026-09-07

The existing public repository was renamed to [pyros-projects/Trial](https://github.com/pyros-projects/Trial), preserving its repository ID and commit history. Website and README branding now reads **Trial - a Vibe Benchmark**, with **(by Pyro)** on a smaller line below. The masthead, footer, page title, source documentation, and share metadata use the new name. The existing Netlify origin and model/run link paths continue to serve the same builds.

All **23 static-export and deployment-script tests passed** with the bundled Python runtime, and the existing mobile browser test passed. Visual checks at 1600, 1024, 800, 768, 580, 390, and 320 pixels confirmed the title and byline fit beside the GitHub link without page overflow. Gallery, Why view, and README images were refreshed.

Gemini 3.8 Flash's new SDF/CSG studio completes **24 HTML builds: three models across all eight current prompts**. Its thumbnail is an unchanged copy of the supplied desktop screenshot. Browser inspection confirmed its live canvas opens in the public sandbox and the model picker offers Astra, Grok, and Gemini. This is a gallery smoke check, not a verification of the model's full task requirements.

Production deployment **`6a9f1be7512a4232e7ae0d83`** contains **144 files totaling 4,026,929 bytes (3.84 MiB)**. Live checks verified all 24 share documents, updated Open Graph site names, thumbnail URLs, source-download hashes, and attachment/sandbox headers. Six representative private routes returned 404. The new public GitHub link returned HTTP 200; the published title, byline, build count, and direct Gemini share entry were also verified in the browser.

## Viewer comparisons and implementation previews: 2026-09-07

The complete WSL suite with both browser modes enabled passed **all 72 tests, with no skips**. Windows system Python passed **51 tests with 21 expected skips** for opt-in browser checks, optional Pillow, timezone data, and symlink permissions. Four focused viewer tests passed again after the final iframe-focus dismissal change. The existing Why view browser test also passed after replacing third-person self-references with first-person copy and neutral captions; the updated reading view was inspected at desktop and mobile sizes. JavaScript syntax and whitespace checks passed.

Browser coverage verifies configured model order, independent gallery filters, multiple runs from the same model, unavailable-model omission, separate unassigned builds, safe text rendering, iframe replacement, source sandboxing, browser history, and preserved device sizes. Look for opens above the app without changing its dimensions or counter state; Escape closes the hint first, and interacting with the iframe dismisses it. A real exported share page opens the matching opaque-origin preview and copies its share URL from the viewer and gallery card.

The actual collection now includes **23 HTML builds across eight prompts and three models**. Grok 4.6's SDF/CSG studio uses an unchanged copy of its supplied default-scene screenshot. Its model picker offers Astra and Grok, while prompts with all three submissions also offer Gemini. Measurements across 320–1600 pixel widths found no toolbar overflow. The app occupies the full width below a 43-pixel desktop bar or a 79-pixel mobile bar. Visual records: [desktop viewer](live-preview.png), [mobile viewer](live-preview-mobile.png), and updated gallery and README images.

Production deployment **`6a9f1918c0f4f7767824f7b4`** publishes **141 files totaling 3,843,619 bytes (3.67 MiB)**. This includes 23 small share documents that reuse existing thumbnails rather than duplicate images or builds. Direct HTTP requests using a crawler user agent verified all 23 canonical URLs, model/prompt titles, Open Graph images, and Twitter large-image declarations in the initial HTML. All 23 image URLs loaded, all 23 source downloads matched their recorded SHA-256 values and retained attachment/sandbox headers, and six representative private routes returned 404. Actual social-platform unfurling and cache refresh behavior were not tested.

Production browser checks verified direct shared entry, model switching, Copy link for the selected model, preserved 768×1024 dimensions through Back/Forward, hint dismissal on app interaction, 390×765 live content in a 390×844 mobile viewport, and complete iframe removal on close. Public previews retain the existing sandbox without `allow-same-origin`.

## Public repository links: 2026-09-07

Trial is publicly accessible on GitHub. The masthead and footer now link to that repository in a separate tab. Browser checks confirmed the correct destination, visible header controls, and no page overflow at 1600, 1024, 800, 768, 390, and 320 pixels. The existing mobile layout test passed. Showcase screenshots and the README comparison were refreshed.

Production deployment `6a9f0e99206f4fccdf71e8a5` publishes **116 files totaling 3,661,854 bytes (3.49 MiB)**. Live verification followed the GitHub link to the public repository and checked the header at 320 pixels; both repository links have the expected URL and new-tab attributes. Anonymous GitHub API access also confirmed the repository is public.

## Look for only: 2026-09-07

Removed the What it tests copy and catalog field, keeping the practical Look for hints for all 30 prompts. Both focused guidance tests passed, covering browser layout at four widths, HTML escaping, and public export. JavaScript syntax and whitespace checks passed. Desktop and mobile showcase screenshots and the README comparison were refreshed.

Production deployment `6a9f087dd6821a8284e32c5e` publishes **116 files totaling 3,661,003 bytes (3.49 MiB)**. Live checks confirmed exactly one Look for label in each of the eight displayed prompt groups, all 30 hints in the public catalog, no obsolete guidance field, and no horizontal page overflow at 390 pixels.

## Shared builds, prompt guidance, and Vibe Benchmark scope: 2026-09-07

The complete WSL suite with both browser modes enabled passed **all 64 tests, with no skips**. Windows system Python passed **47 tests with 17 expected skips** for opt-in browser modes, optional Pillow, timezone data, and symlink permissions. JavaScript syntax validation and Git whitespace checks passed.

Direct-link tests cover copying from cards and the maximized viewer, omitting temporary query parameters, opening a known build despite saved filters or a different saved view, reload, browser Back/Forward, and iframe cleanup. Unicode and reserved characters in folder names round-trip correctly. Denied clipboard access offers a manual-copy fallback. Invalid links cannot launch arbitrary URLs; their notice and any open prompt dialog clear when navigating to another view or build. Both route-state issues found during review were reproduced before their fixes and covered by regression checks.

All 30 catalog entries now include practical What it tests and Look for guidance, grounded in their public checks. Original catalog fields, task requirements, fixtures, and submitted results remain unchanged. Browser checks exercise escaped guidance text and non-overlapping controls at 1440, 1024, 768, and 390 pixels. Export tests confirm the guidance reaches both public catalog routes while private fields stay excluded.

Visual inspection of the actual 22-build collection covered the prompt headers, Copy link controls, updated branding, and the explicit non-scientific scope statement on desktop and mobile. The reading view and showcase have no page-level horizontal overflow at 390 pixels. The README, comparison image, and gallery screenshots were refreshed to match the current presentation.

Production deployment `6a9f05839c31141973192913` publishes **116 files totaling 3,670,815 bytes (3.50 MiB)**. Live HTTPS checks confirmed all 30 guidance entries, eight displayed prompt groups, and the new scope statement. Copying the Astra deformable-physics card produced its canonical link without query parameters; opening and reloading it launched the correct app at 1600 by 957 and 390 by 801 pixels beneath the 43-pixel toolbar. All 22 source downloads matched their recorded SHA-256 values and retained attachment and sandbox headers. Representative metadata, evidence, evaluator, and local Netlify-state URLs returned 404.

## Configurable model presentation: 2026-09-07

The WSL suite with both browser modes enabled passed **all 59 tests, with no skips**. Windows system Python passed **46 tests with 13 expected skips** for opt-in browser modes and unavailable optional dependencies or platform permissions. JavaScript syntax validation passed. A targeted mobile browser check passed after improving the filter layout.

Browser tests use temporary settings files to verify configured labels, column and picker order, exact model border colors, distinct card tints, reordering and recoloring on Refresh, stable colors for unlisted models, and recovery from malformed JSON without hiding submitted builds. The static exporter copies only the explicitly listed presentation settings, byte-for-byte; unlisted configuration files remain excluded.

The actual 22-build collection displays Astra, Grok, and Gemini in that order, with mint, amber, and blue model identity. Desktop and mobile visual inspection covered the tinted cards and the new voxel-demo rationale in the reading view. At 390 pixels, the model and track pickers each have 166 pixels of usable width and the page has no horizontal overflow. Original artifact screenshots retain their colors.

Live HTTP verification found Netlify adding its badge and hosting metadata to HTML responses. The badge is now disabled for this project. Source downloads use an attachment route to the same stored HTML, preventing response rewriting without adding duplicate files. All 22 source downloads matched their recorded SHA-256 values on a real Netlify draft; the browser downloaded `index.html` and still launched the full-viewport preview. Netlify Dev is not sufficient evidence for these rewrite headers.

Production deployment `6a9efca8a8f140bb82b3b115` publishes **116 files totaling 3,645,429 bytes (3.48 MiB)**. Production browser checks confirmed all 22 source hashes, attachment responses, configured order and colors, the voxel rationale, and full-viewport frames at 1600 by 957 and 390 by 801 pixels. Raw metadata, reports, evidence, evaluator files, and unlisted configuration remain excluded.

## Full viewport, rationale, and Gemini results: 2026-09-07

The full WSL suite with both browser modes enabled passed **55 tests with no skips**. The Windows system-Python run passed **44 tests with 11 expected skips**: eight opt-in browser checks, optional Pillow, IANA timezone data, and symlink permissions. JavaScript syntax validation passed. A subsequent targeted browser check also passed after hardening unknown URL-fragment handling.

Live previews now fill the browser viewport below a 43-pixel control bar. Real browser measurements were 1920 by 1037 pixels in a 1920 by 1080 viewport and 390 by 801 in a 390 by 844 viewport. Tests exercise resizing without restarting the running app, exact fixed device sizes, returning to build inspection, and removing the iframe when closed. The public sandbox restrictions remain intact.

The gallery now includes **22 submitted HTML builds from three models**, grouped into eight prompts. Seven Gemini 3.8 Flash runs were added for tasks 01-07. Their top-level screenshots are exact copies of visually inspected evidence images; the supplied HTML and evidence remain unchanged. Model search resolves the displayed Gemini name.

The new [Why Trial? view](https://trial-by-pyro.netlify.app/#why) and README distinguish benchmark measurements from my experience using models. Runtime observations refer to my own runs. The Deep-SWE image is included unchanged and labeled as a snapshot with different effort settings. No current-ranking or controlled model-performance claims were inferred from it.

Desktop and mobile visual checks covered the reading view, the expanded live app, and the three-model gallery. See the [live app](live-preview.png), [project rationale](why-project-preview.png), and [mobile rationale](why-project-mobile.png). Public-mode interaction was checked with Netlify Dev; the export continues to omit raw metadata, reports, evaluator files, and development evidence.

## Production deployment: 2026-09-07

Published [Trial](https://trial-by-pyro.netlify.app/) through the authenticated Netlify CLI using the repository's PowerShell deployment script with production enabled and Pillow available. Deployment `6a9ee49ec0f4f7387924fa13` uploaded the 100-file, 2.27 MiB public export. No raw metadata, reports, evidence, or private evaluator files were uploaded.

Verification against the live HTTPS site confirmed all 15 HTML files match their declared SHA-256 values, all 15 WebP previews load, and all artifact responses include the expected sandbox header. Representative metadata, evidence, local Netlify state, and private evaluator URLs return 404. Browser checks confirmed eight prompt groups, 15 builds, prompt reading, source download, a working live canvas preview, iframe cleanup, and no horizontal overflow at 390 pixels.

## Trial verification: 2026-09-07

### Automated checks

- Windows: `python -m unittest discover -s tests -v` ran **52 tests: 43 passed, 9 skipped**. Six browser checks require explicit opt-in; the other skips reflect unavailable IANA timezone data, symlink permissions, and optional Pillow in the system Python environment.
- Ubuntu-D through WSL, with Playwright, Pillow, Google Chrome, and both browser modes enabled: **all 52 tests passed, with no skips**.
- `node --check gallery/static/app.js` passed.

The enabled-browser command was:

```sh
RUN_BROWSER_TESTS=1 RUN_BRIDGE_UI_TESTS=1 CHROMIUM_PATH=/usr/bin/google-chrome \
  uv run --no-project --with playwright --with pillow --python /usr/bin/python3 \
  python -m unittest discover -s tests -v
```

Coverage includes stable model columns within prompt groups, missing builds, filters, separate unassigned runs, prompt reading and copying, live previews, mobile layout, original fixture integrity, UTF-8 imports on Windows, and the existing evaluator and source-hash contracts. All 15 static-export and deployment-script tests passed on both Windows and WSL. Deployment tests execute the real PowerShell and POSIX scripts against a fake CLI, checking target selection, explicit production flags, authentication failures, and build failures without uploading anything.

### Current gallery and public export

Browser inspection used the actual 15 submitted HTML builds: eight from GPT-6 Astra and seven from Grok 4.6, covering eight prompts. The first seven prompts have both model columns; the eighth includes an explicit missing-build placeholder. No model evaluations were created.

Desktop, tablet, and mobile widths of 1600, 1024, 768, and 390 pixels had no page-level horizontal overflow. Checks covered displayed model-name search, task and model filters, the 30-prompt library, clipboard copying, source downloads, local live previews, and iframe unloading when leaving a preview.

The optimized public export contains **100 files totaling 2,382,766 bytes (2.27 MiB)**: the static gallery, public prompt documents, minimal public inventory, 15 unchanged HTML builds, and 15 WebP previews. Preview images decreased from 5,445,686 to 661,828 bytes, an **87.8% reduction**. All 15 exported HTML SHA-256 values match their source files. The export includes no raw metadata, reports, evidence directories, recordings, source projects, archives, or evaluator files.

Netlify Dev served the actual export with its generated redirects and response headers. Public API and prompt routes, source downloads, opaque-origin live previews, and private-route 404 responses were checked. Hidden local score filters did not suppress public results. The public gallery reported no browser console errors or warnings. Public preview storage restrictions are documented in the hosting guide.

Current visual records are [desktop](gallery-results-preview.png), [mobile](gallery-results-mobile.png), and the [README comparison](readme-comparison.png). These show submitted artifacts; they are not evidence that those applications satisfy their benchmark requirements. Netlify routing was verified locally; **no site was created and no online deployment was performed** during this pass.

## Historical verification: 2026-09-06

The record below describes the single-run edition before the Trial redesign. Its test counts and environment limitations belong to that run, not to later changes or the current result collection.

### Automated suite

The full run enabled both optional browser modes:

```sh
RUN_BROWSER_TESTS=1 RUN_BRIDGE_UI_TESTS=1 python -m unittest discover -s tests -v
node --check gallery/static/app.js
```

Result: **35 tests, 33 passed, 2 skipped because direct Chromium navigation to loopback was administratively blocked** (`net::ERR_BLOCKED_BY_ADMINISTRATOR`). The JavaScript syntax check passed. Python syntax compilation also passed.

The passing tests cover 30 singular prompts; preserved domain-requirement text after explicit protocol edits; unchanged data fixtures and Real Apps public scenarios; valid JSON; example score arithmetic and rubric totals; date/time and scheduling fixture expectations; source hashes and exclusions; real temporary HTTP servers; prompt serving; source ZIPs; artifact access restrictions; path traversal/symlink rejection; singular metadata/report/CSV contracts; changed-source report invalidation; actual importer subprocesses; explicit overwrite behavior; and removal of stale evaluation data on source replacement.

Example metadata and report JSON documents were also validated with the included JSON Schemas using the installed jsonschema validator. The gallery itself does not depend on that validator.

### Browser evidence and limitation

Direct browser-to-localhost end-to-end tests were attempted against actual temporary servers. Both hit the environment's browser administrative policy. These are blocked checks, not successful live-preview tests, and the policy was not disabled or bypassed.

Two separate browser-presentation tests ran the actual HTML, CSS and JavaScript in Chromium. A **test-only fetch bridge** delivered responses from the real running Python gallery HTTP endpoints; no production frontend file was changed and no canned model-result payload replaced the scanner. This validates frontend presentation and interaction, not the browser's normal HTTP transport or successful loading of a live application iframe.

These tests exercised the empty state, all 30 prompt entries, prompt opening/copying, 20/10 track selection, actual scanner refresh over temporary source fixtures, result filters, source-only project views, declared manifests, evaluator-check display, notes and track-specific model-score tables. Desktop and 390-pixel layouts were inspected. A mobile navigation overflow was reproduced, fixed and retested; no page-level horizontal overflow or JavaScript page errors remained in the passing presentation tests.

The preview PNGs captured during this run showed the tested frontend. Cards labeled `UI fixture - not a model evaluation` were temporary integration fixtures, not benchmark submissions or measured model scores. At that time, `results/` contained only instructions. The prompt-library screenshot contained the actual task catalog. Later screenshots and submitted builds are not evidence for this historical run.

Test environment: Python 3.13.5, Node v22.16.0, Playwright 1.57.0, Chromium 144.0.7559.96 built on Debian GNU/Linux 13 (trixie).

### Repeat the checks

The ordinary stdlib-only command `python -m unittest discover -s tests -v` skips four opt-in browser tests. It does not install browser dependencies. To run the direct tests on a machine where local Chromium navigation is permitted, provision Playwright plus Chromium and set `RUN_BROWSER_TESTS=1`; `CHROMIUM_PATH` may identify a custom Chromium executable. The separate `RUN_BRIDGE_UI_TESTS=1` presentation mode requires the same browser tooling but is not a replacement for direct integration.

The final ZIP for that edition was integrity-checked, extracted to a separate directory, and tested again from that copy. MANIFEST.sha256 bound packaged files; the release ZIP had its own SHA-256 sidecar. Generated caches, runtime state, and test-result directories were excluded from the archive.
