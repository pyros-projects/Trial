# Verification record

These checks validate the package and gallery, not implementations or model performance on the thirty challenges.

## Production deployment: 2026-09-07

Published [Trial by Pyro](https://trial-by-pyro.netlify.app/) through the authenticated Netlify CLI using the repository's PowerShell deployment script with production enabled and Pillow available. Deployment `6a9ee49ec0f4f7387924fa13` uploaded the 100-file, 2.27 MiB public export. No raw metadata, reports, evidence, or private evaluator files were uploaded.

Verification against the live HTTPS site confirmed all 15 HTML files match their declared SHA-256 values, all 15 WebP previews load, and all artifact responses include the expected sandbox header. Representative metadata, evidence, local Netlify state, and private evaluator URLs return 404. Browser checks confirmed eight prompt groups, 15 builds, prompt reading, source download, a working live canvas preview, iframe cleanup, and no horizontal overflow at 390 pixels.

## Trial by Pyro verification: 2026-09-07

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

The record below describes the single-run edition before the Trial by Pyro redesign. Its test counts and environment limitations belong to that run, not to later changes or the current result collection.

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
