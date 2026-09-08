# Deploy Trial to Netlify

The deployment scripts build a small public gallery in `dist/site`, then upload that directory through Netlify CLI. A draft deploy is the default. Production requires an explicit flag.

The published showcase is [trial-by-pyro.netlify.app](https://trial-by-pyro.netlify.app/). Its Netlify project ID is `80ef3988-ce08-4df7-b6ea-713e2f9ac354`.

## Requirements

- Python 3.11 or newer.
- Netlify CLI installed with `npm install -g netlify-cli` and authenticated with `netlify login`, or an existing `NETLIFY_AUTH_TOKEN` environment variable.
- Optional Pillow for optimized screenshots: `python -m pip install Pillow`. Install it into the Python interpreter used for the build.

No Node packages or Python packages are required by the exporter itself. Without Pillow, it copies only the selected top-level screenshot for each run unchanged, retaining its original extension. Previews remain available, and the build prints the size plus the Pillow installation command. Install Pillow when a smaller upload is preferred.

Generated comparison and model preview images also reuse the catalog's prompt icons. The renderer uses an available symbol font and omits only the decorative glyph if it cannot render it. No font download is required; titles, screenshots, and share metadata remain available. The gallery itself renders icons using browser fonts.

## Name runs for public grouping

**Include the full task ID in the run-folder name.** The public exporter intentionally ignores `metadata.json`, so it can associate a result with its prompt only from a catalog ID such as `01-fluid-simulation` in that name.

```sh
python tools/new_run.py --model my-model --run 01-fluid-simulation-001 --task 01-fluid-simulation
```

This creates `results/my-model/01-fluid-simulation-001/`. A name such as `fluid-001` remains valid in the local gallery when its metadata declares the task, but the public export displays it without an assigned prompt or prompt comparison group.

## Build and inspect locally

From the package root, run:

```powershell
.\scripts\build-site.ps1
netlify dev --offline --dir dist/site --port 8888 --no-open
```

On macOS or Linux:

```sh
sh scripts/build-site.sh
netlify dev --offline --dir dist/site --port 8888 --no-open
```

Open `http://localhost:8888`. Netlify Dev applies the exported redirects and response headers. A plain file server does not apply those rules and is insufficient for checking preview isolation and the API routes.

The build prints the file count, total byte size, and screenshot size reduction. For a machine-readable report, use `python tools/build_site.py --json`. The public data is saved at `dist/site/api/data.json`.

PowerShell accepts `-Python 'C:\path\to\python.exe'`, `-Screenshots none`, and `-Json`. POSIX accepts `PYTHON=/path/to/python sh scripts/build-site.sh --screenshots none --json`. The Python CLI also accepts `--screenshots none`.

Only `dist/site` is replaced by a rebuild. The exporter refuses to overwrite unrelated files or follow symlinks and Windows junctions. `dist/.site-export-owned` records ownership; retain it when rebuilding an existing export.

## Deploy to an existing site

Pass the existing Netlify project ID:

```powershell
.\scripts\deploy-netlify.ps1 -SiteId 'YOUR_SITE_ID'
```

```sh
sh scripts/deploy-netlify.sh --site-id YOUR_SITE_ID
```

Alternatively, set `NETLIFY_SITE_ID` or link this directory once with `netlify link`, then run the deployment script without a site argument. Explicit site IDs take precedence over the environment and the local link. If no target is selected, the script stops before deployment.

The scripts check authentication, rebuild the public export, and call `netlify deploy --dir dist/site --no-build --json`. The returned JSON contains the deploy URL. They set `CI=true` for the CLI so missing information causes an error instead of an interactive prompt.

## Create a site explicitly

When creating the first site is intended, choose its name:

```powershell
.\scripts\deploy-netlify.ps1 -SiteName 'trial-by-pyro'
```

```sh
sh scripts/deploy-netlify.sh --site-name trial-by-pyro
```

If the account belongs to multiple teams, also pass `-Team 'YOUR_TEAM_SLUG'` or `--team YOUR_TEAM_SLUG`. No team or account is hardcoded. Netlify may choose a suffixed name if the requested name is unavailable; use the project ID returned by the CLI for subsequent deployments.

An existing local link to a different name is rejected. Use its intended project ID, or explicitly run `netlify unlink` before creating another site. Supplying a new site name is the action that requests site creation; building the package never creates or links a site.

## Publish to production

After inspecting the draft URL, deploy the same current source with production enabled:

```powershell
.\scripts\deploy-netlify.ps1 -SiteId 'YOUR_SITE_ID' -Production
```

```sh
sh scripts/deploy-netlify.sh --site-id YOUR_SITE_ID --prod
```

The deployment scripts also accept the Python and screenshot options described above. They rebuild each time, so the uploaded data reflects the files present when the script runs.

## What the public export contains

| Included | Excluded |
| --- | --- |
| Gallery HTML, CSS, JavaScript, model presentation settings, favicon, logo and supplied Deep-SWE reference snapshot | Source code for the gallery server and build scripts |
| Public prompt catalog, prompt and acceptance Markdown | Prompt fixtures, private evaluator material and extra documents |
| One top-level HTML result per run; legacy custom catalog demos only at `project/gallery/index.html` | The rest of each project, project archives, dependencies and extra HTML variants |
| A small share page per implementation, reusing its existing screenshot | Duplicate HTML builds or screenshot copies for link previews |
| A share page per submitted prompt, plus one compact JPEG comparison preview when Pillow and thumbnails are available | Raw evidence images or additional copies of submitted applications |
| A share page per model, plus one compact JPEG using existing thumbnails from different prompts | Duplicate submitted builds or raw evidence for model previews |
| One screenshot per run: metadata-free WebP up to 1280 pixels with Pillow, or the original selected screenshot otherwise | Extra screenshots, recordings, logs, audio and `evidence/` |
| Minimal public JSON and CSV | Run `metadata.json`, `report.json`, notes, environments, metrics, manifests and check details |
| Selected provider, harness, setting, runtime, quantization, and homepage fields from model-level `model.toml`, in public JSON | Raw TOML files and unrecognized profile fields |

Model keys and run labels come from folder names. Public model display labels, order and colors are supplied by `/appsettings.json`, which is copied byte-for-byte from `gallery/static/appsettings.json`, including with `--screenshots none`. Unlisted configuration files remain excluded. Tasks are inferred from catalog IDs in run-folder names. All current catalog tasks use `index.html`, `result.html`, or `app.html`, in that precedence. Compatibility support for an explicitly declared `real-apps` task in a custom catalog uses only `project/gallery/index.html`, with no top-level HTML fallback. The current catalog has no such entries. HTML bytes are copied unchanged; the public SHA-256 identifies the exact published bytes.

The supplied reference image is explicitly included as `/deep-swe-snapshot.png` with its original bytes. It is independent of run screenshots and remains included when `--screenshots none` is selected.

Optional `results/<model>/model.toml` profiles are an explicit public input. Only `provider`, `provider_url`, `harness`, `harness_url`, `setting`, `runtime`, `runtime_url`, `quantization`, and `quantization_url` are read into the `model_profiles` mapping, once per model present in the export. They supply the setup shown on cards and in the viewer; they do not pull data from run `metadata.json`. See [shared model setup](results.md#shared-model-setup) for the format and scope.

The current export includes all 24 prompt/acceptance pairs. The old Real Apps prompts and fixtures are retained on [`experimental/real-apps`](https://github.com/pyros-projects/Trial/tree/experimental/real-apps) and are not published by a main-branch build. Prompt 24 requires live research during development; its finished artifact remains offline, and `evidence/research.md` stays excluded like other raw evidence.

Public catalog entries include `look_for` when present. These short hints power the guidance beside each showcase prompt and the expandable overlay in the maximized viewer; private catalog fields are still excluded.

These exclusions apply to the static deployment, not GitHub. Evidence and other files committed to a public repository remain publicly accessible there. Inspect submissions before committing them; the exporter does not scan HTML for secrets or remove personal information visible in screenshot pixels.

Turn off **Project configuration > General > Powered by Netlify badge** for this showcase. Netlify can inject that badge into HTML responses at its edge, including submitted builds, which changes their downloaded hashes. The setting is already off for `trial-by-pyro.netlify.app`; check it when creating a different site. [Netlify documents the per-project setting and edge injection](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/).

Netlify may also add hosting comments and metadata to HTML preview responses. The **Source** button uses `/sources/*`, an internal rewrite to the same stored artifact with `application/octet-stream` and attachment headers. This preserves original download bytes without publishing another copy. The SHA-256 in the public inventory identifies those original bytes. Verify source downloads on a real Netlify draft or production deploy; Netlify Dev may apply rewrite headers differently.

The public data declares `mode: "public"` and a generation timestamp. Scores are `null`, check lists are empty, and check counts are zero because evaluation data is omitted. This does not turn missing evidence into a passing result. The local gallery continues to read full results with its existing behavior.

## Public routes and previews

Legacy custom-catalog demos use `/demos/<model>/<run>/index.html`, with attachment downloads under `/demo-sources/`. Their response CSP applies both inside the viewer and to direct visits: opaque-origin sandbox, no scripted network connections, external resources, nested frames, or form submissions. Scripts/styles must be inline and assets embedded. The viewer adds **Reset demo**, which replaces the entire frame; in-memory work is discarded. See [Gallery demos](GALLERY_DEMOS.md) for the complete contract. A static demonstration does not establish full-app backend acceptance results.

The exporter rejects `netlify` and `data-netlify` attributes in **all** submitted HTML, because those could provision a Forms endpoint at deploy time. It never uploads application servers, functions, database files, or submitted deployment configuration. Keep Netlify form detection disabled as well; the current showcase has `processing_settings.ignore_html_forms: true` and no registered forms. This is a static publication boundary, not a general-purpose malware or secret scanner.

`/api/data` rewrites to `/api/data.json`; `/api/export.csv` downloads the public inventory. Prompt documents use `/prompts/<task-id>/prompt.md` and `/prompts/<task-id>/acceptance.md`.

Public artifact URLs live below `/artifacts/`. Source buttons use the `/sources/` attachment routes described above. The generated `_headers` applies a CSP sandbox to artifact pages, without `allow-same-origin`. The gallery also uses an opaque-origin iframe for public previews. This keeps submitted scripts from accessing the gallery's document, storage or service workers. Browser features that require a normal origin, including local storage, may be unavailable in public previews; download the HTML and run it separately when those features matter.

**Copy link** creates a URL such as `https://trial-by-pyro.netlify.app/share/gpt-6_astra/04-deformable-physics/`. The exported `index.html` at that path contains the model label, prompt title, description, canonical URL, and Open Graph / Twitter card metadata. Its image points to the run's existing published screenshot. With screenshots disabled or absent, the page omits image metadata and uses a summary card. Link-preview appearance and refresh timing depend on the receiving platform.

Set the top-level `siteUrl` in `gallery/static/appsettings.json` to the site's public origin, for example `https://trial-by-pyro.netlify.app`. It supplies absolute canonical and image URLs in share-page metadata. It must be an HTTP(S) origin without credentials, a path, a query, or a fragment. A trailing slash is accepted. If omitted, it defaults to the existing Trial production origin. Draft deploys use that configured production origin in preview metadata; set a different origin before building if the draft itself should be canonical.

A real browser runs a tiny `location.replace` into the existing `/#play/<model>/<run>` viewer. Crawlers receive metadata in the initial HTML without executing JavaScript; there is no HTTP or meta-refresh redirect. A plain link remains available when JavaScript is disabled. The local Python gallery continues to copy `#play` links, and older public `#play` links still work.

**Copy link** beside a prompt shares `/compare/<task-id>/`. Each populated catalog prompt gets its own page with the prompt title, model and build counts, canonical URL, and Open Graph / Twitter metadata. The public data exposes these paths in `comparison_urls`. With Pillow and published screenshots available, the exporter creates one 1200 × 630 JPEG from up to three distinct models' thumbnails in the configured order. Without Pillow, it reuses the first available published screenshot; without screenshots, it emits a text-only summary card.

Comparison pages use the same crawler-friendly HTML pattern and send browsers to `/#compare/<task-id>`. That route opens the expanded category with every model, regardless of saved gallery filters. The local gallery copies this hash route directly. Closing the comparison clears its hash; opening and then closing an app returns to the comparison beneath it. Task IDs keep category links stable when titles or model order change.

**Copy link** in a selected model's heading shares `/models/<model-key>/`. Every model with exported builds gets a page with its configured display name, build and prompt counts, canonical URL, and Open Graph / Twitter metadata. The public data exposes these paths in `model_urls`. Browsers open `/#model/<model-key>`, a full-screen grid of that model's builds in prompt order, independently of saved gallery filters. The local gallery copies that hash directly. Individual build and prompt-comparison links retain their existing behavior.

With Pillow, each model page has one 1200 × 630 JPEG at `/models/<model-key>/preview.jpg`, built from up to three existing thumbnails for different prompts in catalog order. Repeated attempts for the same prompt do not consume additional panels; unassigned builds follow known prompts. Without Pillow, the page reuses an available published thumbnail; without screenshots, it uses a text-only summary card. These additions publish no new evidence or duplicate app source. Renaming a model's display label preserves the link; renaming its folder changes the key and URL.

Links identify model and run folders, so they survive display-name and sorting changes; renaming or removing those folders invalidates existing links. Shared links omit temporary query parameters and open at full viewport size. The viewer's model picker offers available builds for that same prompt, in the configured model order, independently of gallery filters. Multiple runs from one model include their run labels. Switching replaces the current iframe, updates the link and color, and keeps the selected viewport size. **Look for** overlays the running app without restarting or resizing it.

No source HTML is rewritten, executed, installed, or bundled by the exporter. Netlify serves the generated files and the explicitly generated `_headers` and `_redirects`. Submitted artifacts cannot supply their own deployment configuration.

References: [Netlify CLI deploy](https://docs.netlify.com/cli/get-started/), [custom headers](https://docs.netlify.com/manage/routing/headers/), and [rewrites](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
