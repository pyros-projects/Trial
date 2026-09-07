# Deploy Trial by Pyro to Netlify

The deployment scripts build a small public gallery in `dist/site`, then upload that directory through Netlify CLI. A draft deploy is the default. Production requires an explicit flag.

The published showcase is [trial-by-pyro.netlify.app](https://trial-by-pyro.netlify.app/). Its Netlify project ID is `80ef3988-ce08-4df7-b6ea-713e2f9ac354`.

## Requirements

- Python 3.11 or newer.
- Netlify CLI installed with `npm install -g netlify-cli` and authenticated with `netlify login`, or an existing `NETLIFY_AUTH_TOKEN` environment variable.
- Optional Pillow for optimized screenshots: `python -m pip install Pillow`. Install it into the Python interpreter used for the build.

No Node packages or Python packages are required by the exporter itself. Without Pillow, it copies only the selected top-level screenshot for each run unchanged, retaining its original extension. Previews remain available, and the build prints the size plus the Pillow installation command. Install Pillow when a smaller upload is preferred.

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
| Gallery HTML, CSS, JavaScript, favicon and logo | Source code for the gallery server and build scripts |
| Public prompt catalog, prompt and acceptance Markdown | Prompt fixtures, private evaluator material and extra documents |
| One top-level HTML result per model/run folder | Raw projects, project archives, dependencies and extra HTML variants |
| One screenshot per run: metadata-free WebP up to 1280 pixels with Pillow, or the original selected screenshot otherwise | Extra screenshots, recordings, logs, audio and `evidence/` |
| Minimal public JSON and CSV | Run `metadata.json`, `report.json`, notes, environments, metrics, manifests and check details |

Model and run labels come from folder names. Tasks are inferred from catalog IDs in run-folder names. Only runs with `index.html`, `result.html`, or `app.html` appear, using that precedence. HTML bytes are copied unchanged; the public SHA-256 identifies the exact published bytes.

The public data declares `mode: "public"` and a generation timestamp. Scores are `null`, check lists are empty, and check counts are zero because evaluation data is omitted. This does not turn missing evidence into a passing result. The local gallery continues to read full results with its existing behavior.

## Public routes and previews

`/api/data` rewrites to `/api/data.json`; `/api/export.csv` downloads the public inventory. Prompt documents use `/prompts/<task-id>/prompt.md` and `/prompts/<task-id>/acceptance.md`.

Public artifact URLs live below `/artifacts/`. Source buttons download those same files using the HTML `download` attribute, avoiding duplicate payloads and rewrite-dependent attachment headers. The generated `_headers` applies a CSP sandbox to artifact pages, without `allow-same-origin`. The gallery also uses an opaque-origin iframe for public previews. This keeps submitted scripts from accessing the gallery's document, storage or service workers. Browser features that require a normal origin, including local storage, may be unavailable in public previews; download the HTML and run it separately when those features matter.

No source HTML is rewritten, executed, installed, or bundled by the exporter. Netlify serves the generated files and the explicitly generated `_headers` and `_redirects`. Submitted artifacts cannot supply their own deployment configuration.

References: [Netlify CLI deploy](https://docs.netlify.com/cli/get-started/), [custom headers](https://docs.netlify.com/manage/routing/headers/), and [rewrites](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).
