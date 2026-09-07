# Results directory

Use results/<model_name>/<run_id>/ with exactly one index.html, project/ or project.zip. Optional: metadata.json, screenshot.png/webp/jpg/jpeg, report.json, notes.md, evidence/. A metadata-only folder records an incomplete run.

One prompt produces one result. Model and task comparisons occur across run entries, not within each entry. Each source snapshot is independently scored. Task IDs can be supplied in metadata, a project's benchmark.json, or the run folder name. See ../schema/ for singular score/report contracts and ../tools/new_run.py --help for import flags.

The gallery never starts or installs applications. Supply preview_url only after manually reviewing and launching a local project. The artifact server serves selected top-level HTML/screenshots/archives/reports, not arbitrary source or runtime data. Keep secrets out of the tree and run untrusted output in a disposable environment.
