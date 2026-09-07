# Results and evaluation data

Trial reads one artifact per run from a results directory. The local gallery lets you compare builds for the same prompt, inspect the source, and review optional evaluation records. It does not generate implementations, start submitted projects, or automatically judge their correctness.

The public static export contains a smaller set: the gallery, public prompt text, standalone HTML builds, thumbnails, selected shared model setup fields, and small share pages with link-preview metadata. Raw run metadata, evaluator reports, notes, evidence, project source, and archives are excluded. These exclusions apply to the static website: files committed to a public Git repository are still public. See [Hosting](DEPLOYMENT.md) for the export and deployment commands.

## Included results

The 2026-09-07 checkout contains 31 submitted HTML builds for ten tasks across five model folders:

| Model folder | HTML builds | Task coverage |
|---|---:|---|
| `gpt-6_astra` | 9 | 01-09 |
| `anthropic_opus5` | 2 | 01-02 |
| `xai_grok4.6` | 9 | 01-08, 11 |
| `zai_glm5.3_flash` | 3 | 01-03 |
| `google_gemini3.8_flash` | 8 | 01-08 |

These are submitted artifacts, not verified passes. This snapshot includes no evaluator reports or scores. The gallery reads the files that are present, so its totals change as results are added.

## Start the local gallery

Python 3.11+ is required. No third-party Python packages are needed for the gallery.

```sh
python gallery/server.py --open
```

The default gallery address is [127.0.0.1:8765](http://127.0.0.1:8765/); standalone artifacts are served at [127.0.0.1:8766](http://127.0.0.1:8766/). Use `--port`, `--artifact-port`, and `--results-dir` for other ports or an existing result directory. The two ports must differ. **Refresh** rescans the directory without a build step or generated local result manifest.

Windows launchers are `run-gallery.bat` and `run-gallery.ps1`; macOS and Linux can use `sh run-gallery.sh`, from the project root.

## Result layout

Example directory structure:

```text
results/
  model_name/
    model.toml
    fluid-001/
      index.html
      metadata.json
      screenshot.png
      report.json
      evidence/
        validation.md
    import-001/
      project/
        benchmark.json
        README.md
      metadata.json
      screenshot.png
      report.json
      evidence/
        validation.md
```

Keep exactly one `index.html`, `project/`, or `project.zip` per run. `result.html` and `app.html` are accepted aliases for standalone HTML results. ZIP archives are retained and downloaded without extraction.

`metadata.json`, screenshots, `report.json`, `notes.md`, and `evidence/` are optional. Screenshots may be named `screenshot` or `preview`, with `.png`, `.webp`, `.jpg`, or `.jpeg` extensions. A metadata-only entry can document a failed or blocked run.

A task is identified by `metadata.json.task_id`, a project's `benchmark.json.task_id`, or the full task ID within the run folder name, in that order. If no model display name is supplied, the original model folder spelling is preserved.

## Import a build

Run the importer from the project root. These examples assume agent output in a sibling `work/` directory:

```sh
python tools/new_run.py --model "Model Name" --run fluid-001 --task 01-fluid-simulation --html ../work/index.html
python tools/new_run.py --model "Model Name" --run import-001 --task 21-import-studio --project ../work/project
```

`--project` accepts a directory or ZIP. Directory imports exclude known dependency, runtime, and secret-file patterns, plus symlinks. ZIP inputs are copied unchanged; inspect them before sharing or extracting.

Optional flags include `--score 85`, `--report ../work/report.json`, `--screenshot ../work/screenshot.png`, `--url http://127.0.0.1:8811/`, `--tag`, `--notes`, `--provider`, `--model-version`, `--results-dir`, `--model-folder`, and `--run-folder`. Supply scores only after evaluation.

Existing runs are not overwritten unless `--force` is explicit. Replacing a source clears its old scores, reports, screenshots, preview URL, and evidence before adding supplied replacements. Use a new run ID for another independent attempt.

## Shared model setup

Place an optional `model.toml` directly inside each model folder. It records the shared setup used for that model's current collection, separately from individual run records:

```toml
# results/gpt-6_astra/model.toml
provider = "OpenAI"
provider_url = "https://openai.com/"
harness = "Codex CLI"
harness_url = "https://developers.openai.com/codex/cli"
setting = "Max"
```

The supported fields are `provider`, `provider_url`, `harness`, `harness_url`, and `setting`. All are optional strings. Keep setting labels as reported by the tool, such as `High Fast`; the gallery does not translate them into comparable budgets. Provider and harness URLs must be absolute HTTP(S) links without credentials. Model names, colors, and sorting remain in [`appsettings.json`](../gallery/static/appsettings.json).

Cards show the harness and setting. The viewer's **Setup** panel and **Build details** show the full selected profile, with external links. Opening Setup leaves the live app running; switching models updates the profile. Local **Refresh** reloads these files. Rebuild and redeploy to update the public snapshot.

The local and public inventories expose these selected fields once per model in `model_profiles`. Unknown fields are ignored, and raw TOML files are not copied to the website. Missing, malformed, oversized, or linked files leave builds available without a profile. This is intentionally public configuration: do not put secrets or private notes here.

These profiles are collection-level context, not exact historical provenance for every run. Keep per-run versions, tool access, budgets, and differences in the run's own records. If future runs use different setups, do not relabel older builds by treating this shared profile as their execution record.

## Run metadata

Example metadata for a manually started Real Apps submission:

```json
{
  "task_id": "21-import-studio",
  "model": "Model Name",
  "run_id": "import-001",
  "preview_url": "http://127.0.0.1:8811/"
}
```

You can also record `provider`, `model_version`, `parameters`, `environment`, `metrics`, `tags`, and `notes`. Preserve exact model versions and record actual tool access and budgets when comparing runs.

`score` is optional: a number from 0 to 100, or an object containing `total` and rubric dimensions. A metadata score takes display precedence over `report.json.total`; keep them consistent. The gallery never invents a score or replaces missing scores with zero. Files in [schema/](../schema/) are illustrative contracts and examples, not automatically loaded results.

## Evaluator reports and source hashes

An evaluator-owned `report.json` may contain `total`, `rubric`, `evaluator`, `artifact_sha256`, and `checks`. Each check can have `id`, `label`, `status`, `evidence`, and `notes`.

| Status | Meaning |
|---|---|
| `pass` | The evaluator observed the required behavior |
| `fail` | The observed behavior did not meet the requirement |
| `blocked` | The check could not be completed because a required capability was unavailable |
| `not-run` | The check was not performed |

Freeze the source, evaluate it, and copy the gallery's exact artifact digest into `artifact_sha256`. A changed source marks a bound report stale and removes its score from summaries. A report without a digest is explicitly unbound. Agent-authored logs in `evidence/` remain separate from evaluator reports.

HTML and submitted ZIP hashes are ordinary SHA-256 hashes of file bytes. Directory projects use a deterministic authored-source digest, with dependency and runtime exclusions. The [Real Apps guide](REAL_APPS.md#source-hashing-and-download) defines that digest and its limits. The report structure is defined in [report.schema.json](../schema/report.schema.json).

## Use the local viewer

Browse builds grouped by prompt and filter by model, task, track, status, or text. Open a result to inspect its screenshot, live preview, source download, prompt, project manifest, evaluator checks, notes, metadata, and source hash. The prompt library supports reading and copying the full brief. CSV export and model-score summaries are available locally.

Live artifacts load after an explicit action. Switching viewer tabs unloads an active iframe. The viewer offers desktop, tablet, and mobile viewport sizes.

For a Real Apps submission, review the source and declared commands, start it manually, then set an explicit HTTP(S) loopback `preview_url` with a port. The gallery never installs or starts applications. Use a dedicated top-level browser context for authentication, offline state, concurrent-user tests, or an app whose embedding policy prevents iframe previews.

The local gallery, a separate port, and an iframe do not provide security isolation. HTML previews share the artifact server's origin, and cookies are not isolated by port. Run unfamiliar submissions in a disposable environment with dedicated browser profiles or contexts. Keep secrets and mutable application data outside the results tree. The source exclusion list is not a comprehensive secret scanner. Use the static export for public hosting rather than exposing the local gallery server.

## Compare results

Each prompt keeps models in the configured order, with three columns above 1100 pixels, two from 581–1100 pixels, and one at 580 pixels or below. The arrows move one model at a time; the range label shows your position in the full lineup. Native horizontal scrolling and touch swipes work too. Focus the comparison row to use Left/Right or Home/End. Missing submissions retain their labeled place, and repeated attempts stay together in one model column.

Choose **Expand** to see every entry for one prompt in a full-screen grid. Models flow into as many rows as needed, with three columns on desktop, two from 581–1100 pixels, and one on mobile. Scroll vertically to reach later rows; the expanded view has no horizontal paging. Read the prompt, inspect builds, open live apps, or copy implementation links from there. Closing a nested viewer returns to the comparison; closing the comparison restores the main page's filters, position, and focus. Shared implementation URLs continue to open the selected app directly.

**Copy link** beside a prompt's model arrows shares the whole comparison. The same control is available inside the expanded view. Public links use `/compare/<task-id>/`, with an initial link-preview document and a compact image composed from up to three models' existing screenshots. Opening the link enters `/#compare/<task-id>` and includes all models for that prompt, independent of saved filters. Local links use the hash route directly. Closing the comparison clears that route; closing an app above it returns to the comparison.

The local score view groups by track, averages repeated runs within each task, then averages those task means per model. Repeated attempts therefore do not silently give one task more weight. Different task coverage or budgets still prevent a controlled ranking.

Use a matched task subset, comparable tools and budgets, and the same rubric. Publish sample counts and per-task results when sharing evaluated comparisons. Keep the HTML and Real Apps rubrics separate. See [Evaluation](../EVALUATION.md) for the complete scoring and independent-check guidance.

## Run contract

Give the tested agent only the selected `prompt.md` and its public fixtures in a separate workspace. `acceptance.md` duplicates public checks for convenience; it is not a second task. Keep `evaluator/` outside that workspace.

Every prompt permits planning, file creation, dependencies, execution, inspection, testing, and improvements from the start, within the assigned tools and budget. The preferred browser workflow is the installed `agent-browser` skill; a documented real-browser fallback is allowed if it is unavailable. Record missing checks as blocked rather than passed.

Tasks 01-20 deliver one self-contained runtime HTML file. Development tools and temporary local servers are allowed. Tasks 21-30 deliver complete multi-file applications with declared dependencies, a local backend where needed, and durable storage. After setup, applications must work without external internet services while their local backend remains reachable, except when a task explicitly calls for disconnected editing.

Both tracks keep agent-authored validation evidence beside the artifact. The final agent response summarizes the delivery, tests, and limitations; the implementation lives in actual files. See the [execution protocol](AGENTIC_PROTOCOL.md) and [runtime contract](RUNTIME_CONTRACT.md) for the full requirements.
