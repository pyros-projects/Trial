# Results directory

Use `results/<model_name>/<full-task-id>-<run>/` with one self-contained `index.html` for each current task. The local importer also accepts `project/` or `project.zip` for legacy/custom projects. Optional: metadata.json, screenshot.png/webp/jpg/jpeg, report.json, notes.md, evidence/. A metadata-only folder records an incomplete run.

One prompt produces one result. Model and task comparisons occur across run entries, not within each entry. Each source snapshot is independently scored. Task IDs can be supplied in metadata, a project's benchmark.json, or the run folder name. See ../schema/ for singular score/report contracts and ../tools/new_run.py --help for import flags.

The gallery never starts or installs applications. Supply preview_url only after manually reviewing and launching a local project. The artifact server serves selected top-level HTML/screenshots/archives/reports, not arbitrary source or runtime data. Keep secrets out of the tree and run untrusted output in a disposable environment.

The current catalog has 24 single-HTML prompts. See [the results guide](../docs/results.md) for setup metadata and [the prompt library](../prompts/README.md) for active IDs. Older Real Apps tasks live on the separate `experimental/real-apps` branch; do not relabel those outputs as results of the new 21–24 prompts.
