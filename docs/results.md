# Results and evaluation data

Trial reads one artifact per run from a results directory. The local gallery lets you compare builds for the same prompt, inspect the source, and review optional evaluation records. It does not generate implementations, start submitted projects, or automatically judge their correctness.

The public static export contains a smaller set: the gallery, public prompt text, standalone HTML builds, thumbnails, and small share pages with link-preview metadata. Metadata, evaluator reports, notes, evidence, project source, and archives are excluded. These exclusions apply to the static website: files committed to a public Git repository are still public. See [Hosting](DEPLOYMENT.md) for the export and deployment commands.

## Included results

The 2026-09-07 checkout contains 24 submitted HTML builds for eight tasks across three model folders:

| Model folder | HTML builds | Task coverage |
|---|---:|---|
| `gpt-6_astra` | 8 | 01-08 |
| `xai_grok4.6` | 8 | 01-08 |
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

## Metadata

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

The local score view groups by track, averages repeated runs within each task, then averages those task means per model. Repeated attempts therefore do not silently give one task more weight. Different task coverage or budgets still prevent a controlled ranking.

Use a matched task subset, comparable tools and budgets, and the same rubric. Publish sample counts and per-task results when sharing evaluated comparisons. Keep the HTML and Real Apps rubrics separate. See [Evaluation](../EVALUATION.md) for the complete scoring and independent-check guidance.

## Run contract

Give the tested agent only the selected `prompt.md` and its public fixtures in a separate workspace. `acceptance.md` duplicates public checks for convenience; it is not a second task. Keep `evaluator/` outside that workspace.

Every prompt permits planning, file creation, dependencies, execution, inspection, testing, and improvements from the start, within the assigned tools and budget. The preferred browser workflow is the installed `agent-browser` skill; a documented real-browser fallback is allowed if it is unavailable. Record missing checks as blocked rather than passed.

Tasks 01-20 deliver one self-contained runtime HTML file. Development tools and temporary local servers are allowed. Tasks 21-30 deliver complete multi-file applications with declared dependencies, a local backend where needed, and durable storage. After setup, applications must work without external internet services while their local backend remains reachable, except when a task explicitly calls for disconnected editing.

Both tracks keep agent-authored validation evidence beside the artifact. The final agent response summarizes the delivery, tests, and limitations; the implementation lives in actual files. See the [execution protocol](AGENTIC_PROTOCOL.md) and [runtime contract](RUNTIME_CONTRACT.md) for the full requirements.
