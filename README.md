<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset=".github/logo-light.svg">
    <img alt="Trial by Pyro" src=".github/logo-light.svg" width="80" height="80">
  </picture>
  <h1>Trial by Pyro</h1>
  <p><strong>Show me what it built.</strong><br>Compare coding agents through the apps they actually deliver.</p>
</div>

<div align="center">

[![30 complete prompts][prompts-shield]][prompts-url]
[![2 tracks][tracks-shield]][tracks-url]
[![Python 3.11+][python-shield]][python-url]

</div>

<div align="center">
  <a href="https://trial-by-pyro.netlify.app/">Live Showcase</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="prompts/README.md">Prompts</a> &middot;
  <a href="docs/results.md">Results Guide</a> &middot;
  <a href="docs/DEPLOYMENT.md">Hosting</a>
</div>

---

![Trial by Pyro gallery comparing submitted builds for the same prompt](docs/gallery-results-preview.png)

## Why this exists

A finished app tells you more than a confident summary. Trial by Pyro puts each prompt beside the builds it produced, so you can compare the results, open the app, and inspect the source. Bring your curiosity. There is plenty to click, break, and learn from.

## What you can do

- **Compare the same brief.** Browse builds grouped by prompt, with each model's screenshots side by side. Filter by model, task, track, status, or text.
- **Try the output.** Open live HTML builds and check desktop, tablet, and mobile layouts. Download the source to inspect it yourself.
- **Run any of the 30 prompts.** Read and copy the complete task, including validation checks and delivery requirements, from the prompt library.
- **Inspect complete applications locally.** Review project source downloads, declared setup commands, notes, and manually started app previews.
- **Keep evaluation honest.** The local gallery shows evaluator checks, source hashes, stale reports, per-track score summaries, and CSV export. Missing scores stay missing.
- **Share a focused showcase.** Export the gallery, public prompts, HTML builds, and thumbnails for static hosting. Evaluation records and project archives remain local.

## When to use it

Use Trial by Pyro when you want to inspect what a coding model can build, choose challenges for a comparison, or try the same prompt with your own agent. The gallery displays submitted work; an independent evaluator determines whether it meets the brief.

| Track | Tasks | What the agent delivers |
|---|---|---|
| Standalone HTML | 01-20 | One self-contained `index.html`: simulations, games, audio tools, and editors |
| Real Apps | 21-30 | A runnable `project/`: source, tests, a README, and a runtime manifest |

## Quick Start

From the project root, with Python 3.11 or newer:

```sh
python gallery/server.py --open
```

The gallery opens at [127.0.0.1:8765](http://127.0.0.1:8765/). Choose a prompt, compare its builds, and open a result. **Refresh** rescans the results directory.

## Install

The local gallery requires **Python 3.11+** and a modern browser. It uses the Python standard library; there is no package-install or frontend-build step.

On Windows, you can also double-click [`run-gallery.bat`](run-gallery.bat) or run `./run-gallery.ps1`. On macOS or Linux, run `sh run-gallery.sh`. Each Real Apps submission declares its own additional dependencies.

## Usage

### Run a challenge

1. Choose a task from the [prompt library](prompts/README.md) or [task selection guide](prompts/SELECTION_GUIDE.md).
2. Give your agent the entire `prompt.md` and that task's public `fixtures/`, if present, in a separate workspace. Keep `evaluator/` outside it.
3. Let the agent build, run, inspect, and test within your chosen budget. Keep the delivered artifact and its sibling `evidence/` directory for independent evaluation.

Each prompt contains the full workflow. Use comparable tool access and budgets across models; record checks that could not run. The [execution protocol](docs/AGENTIC_PROTOCOL.md) explains the common contract, and the [Real Apps guide](docs/REAL_APPS.md) covers runtime setup and persistent data.

### Add a result

For example, to import an HTML build saved in a sibling `work/` directory:

```sh
python tools/new_run.py --model "Model Name" --run 01-fluid-simulation-001 --task 01-fluid-simulation --html ../work/index.html
```

Then choose **Refresh** in the gallery. Use `--project ../work/project` for a complete application. The [results guide](docs/results.md) covers folder layout, screenshots, model metadata, reports, source hashes, and replacement behavior.

### Build a public showcase

```powershell
# Windows
./scripts/build-site.ps1
```

```sh
# macOS / Linux
sh scripts/build-site.sh
```

The export is written to `dist/site/`. The [hosting guide](docs/DEPLOYMENT.md) explains optional thumbnail generation and the Netlify scripts, including explicit site selection and draft versus production deployment.

## Read the evidence

The two tracks use different rubrics. Compare matching tasks and budgets before drawing conclusions from scores; a screenshot alone does not establish correctness. [Evaluation](EVALUATION.md) defines the checks and scoring, while the [verification record](docs/VERIFICATION.md) separates tests of this gallery from tests of submitted applications.

## Contributing

Keep task requirements and public fixtures stable. For gallery or importer changes, include a reproducible example and run the checks in the [verification guide](docs/VERIFICATION.md). For new results, retain the original source and record the model, tools, budget, and observed limitations.

## License

A project license has not been specified.

---

Crafted with [Readme Craft](https://github.com/motiful/readme-craft)

[prompts-shield]: https://img.shields.io/badge/prompts-30-F26B38?style=flat-square
[prompts-url]: prompts/README.md
[tracks-shield]: https://img.shields.io/badge/tracks-2-30343B?style=flat-square
[tracks-url]: #when-to-use-it
[python-shield]: https://img.shields.io/badge/Python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white
[python-url]: #install
