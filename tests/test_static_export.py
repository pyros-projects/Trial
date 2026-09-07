"""The public export is an allowlist of display assets, never a results archive."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools import build_site


class StaticExportTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "package"
        self.output = self.root / "dist/site"
        self.run = self.root / "results/Model One/01-fluid-simulation"
        self.run.mkdir(parents=True)
        static = self.root / "gallery/static"
        static.mkdir(parents=True)
        for name, body in {
            "index.html": "<!doctype html><title>Gallery</title>",
            "app.js": "fetch('/api/data')",
            "styles.css": "body { color: white; }",
            "favicon.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
            "logo-mark.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
            "debug.json": '{"secret":"STATIC-PRIVATE"}',
        }.items():
            (static / name).write_text(body, encoding="utf-8")
        self.reference_snapshot = b"\x89PNG\r\n\x1a\nUser-supplied Deep-SWE reference snapshot."
        (static / "deep-swe-snapshot.png").write_bytes(self.reference_snapshot)
        (static / "unlisted-snapshot.png").write_bytes(b"Unlisted static image")
        self.model_settings = b'{ "models": [{ "key": "Model One", "label": "Display name", "color": "#ff774f" }] }\n'
        (static / "appsettings.json").write_bytes(self.model_settings)
        (static / "private-config.json").write_bytes(b'{"secret":"PRIVATE-CONFIG"}')
        prompt = self.root / "prompts/01-fluid-simulation"
        prompt.mkdir(parents=True)
        (prompt / "prompt.md").write_text("# Build fluid\nPublic task.", encoding="utf-8")
        (prompt / "acceptance.md").write_text("# Acceptance\nPublic requirements.", encoding="utf-8")
        (prompt / "private.md").write_text("PROMPT-PRIVATE", encoding="utf-8")
        (self.root / "prompts/catalog.json").write_text(json.dumps([{
            "id": "01-fluid-simulation", "title": "Fluid", "category": "Simulation",
            "icon": "~", "description": "Interactive fluid.", "track": "html",
            "rubric": "html-v1", "artifact_type": "single-html",
            "prompt_file": "01-fluid-simulation/prompt.md", "internal_note": "CATALOG-PRIVATE",
        }]), encoding="utf-8")
        self.html = b'<!doctype html>\r\n<title>Original</title>\n<script>window.a = 7;</script>\n'
        (self.run / "index.html").write_bytes(self.html)

    def export(self, **kwargs):
        report = build_site.build_site(self.root, **kwargs)
        data = json.loads((self.output / "api/data.json").read_text(encoding="utf-8"))
        return report, data

    def resolve_url(self, url):
        return self.output / unquote(url).lstrip("/")

    def test_private_files_and_fields_are_never_published_or_read(self):
        for name in ("metadata.json", "report.json", "notes.md", "notes.txt"):
            (self.run / name).write_text(json.dumps({
                "model": "PRIVATE-MODEL", "score": 99, "notes": "PRIVATE-NOTE",
                "environment": {"TOKEN": "PRIVATE-ENV"}, "metrics": {"cost": 9},
                "preview_url": "http://127.0.0.1:9888/", "checks": [{"id": "SECRET", "status": "pass"}],
            }), encoding="utf-8")
        for name in ("evidence/log.jsonl", "evidence/demo.webm", "project/.env", "project/benchmark.json",
                     "node_modules/package.js", "agents/trace.md", "debug.log", "project.zip"):
            path = self.run / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("PRIVATE-PAYLOAD", encoding="utf-8")
        original_read_text = Path.read_text

        def checked_read(path, *args, **kwargs):
            if path.is_relative_to(self.run) and path.name != "index.html":
                raise AssertionError(f"Private input was read: {path}")
            return original_read_text(path, *args, **kwargs)

        with mock.patch.object(Path, "read_text", checked_read):
            _, data = self.export(screenshots="none")
        row = data["results"][0]
        self.assertEqual(row["model"], "Model One")
        self.assertIsNone(row["score"])
        self.assertIsNone(row["reported_score"])
        self.assertEqual(row["checks"], {"pass": 0, "fail": 0, "blocked": 0, "not-run": 0})
        self.assertEqual(row["artifact"]["checks"], [])
        self.assertEqual(data["summary"]["scored_runs"], 0)
        for field in ("notes", "parameters", "environment", "metrics", "metadata", "score_details"):
            self.assertNotIn(field, row)
        for field in ("manifest", "report_url", "warning"):
            self.assertNotIn(field, row["artifact"])
        for path in self.output.rglob("*"):
            if path.is_file():
                self.assertNotIn(b"PRIVATE", path.read_bytes(), path)
                self.assertNotIn(b"127.0.0.1", path.read_bytes(), path)
        self.assertFalse((self.output / "debug.json").exists())
        self.assertFalse((self.output / "prompts/01-fluid-simulation/private.md").exists())

    def test_artifact_hash_and_bytes_match_unchanged_source(self):
        report, data = self.export(screenshots="none")
        artifact = data["results"][0]["artifact"]
        self.assertEqual(self.resolve_url(artifact["url"]).read_bytes(), self.html)
        self.assertEqual((self.run / "index.html").read_bytes(), self.html)
        self.assertEqual(artifact["sha256"], hashlib.sha256(self.html).hexdigest())
        self.assertEqual(artifact["bytes"], len(self.html))
        self.assertEqual(report["html_files"], 1)
        self.assertEqual(report["bytes"], sum(p.stat().st_size for p in self.output.rglob("*") if p.is_file()))
        self.assertEqual(data["mode"], "public")
        self.assertTrue(data["generated_at"].endswith("Z"))

    def test_reference_snapshot_is_exported_without_changes(self):
        self.export(screenshots="none")
        self.assertEqual((self.output / "deep-swe-snapshot.png").read_bytes(), self.reference_snapshot)
        self.assertEqual((self.root / "gallery/static/deep-swe-snapshot.png").read_bytes(), self.reference_snapshot)
        self.assertFalse((self.output / "unlisted-snapshot.png").exists())

    def test_model_presentation_settings_are_copied_exactly(self):
        self.export(screenshots="none")
        self.assertEqual((self.output / "appsettings.json").read_bytes(), self.model_settings)
        self.assertEqual((self.root / "gallery/static/appsettings.json").read_bytes(), self.model_settings)
        self.assertFalse((self.output / "private-config.json").exists())
        self.assertFalse((self.output / "debug.json").exists())

    def test_public_links_and_netlify_routes_have_targets(self):
        _, data = self.export(screenshots="none")
        row = data["results"][0]
        self.assertIn("Model%20One", row["artifact"]["url"])
        for url in (row["artifact"]["url"], *row["prompts"].values()):
            self.assertTrue(self.resolve_url(url).is_file(), url)
        source_url = row["artifact"]["source_url"]
        self.assertTrue(source_url.startswith("/sources/"))
        self.assertEqual(source_url.replace("/sources/", "/artifacts/", 1), row["artifact"]["url"])
        self.assertTrue(self.resolve_url(source_url.replace("/sources/", "/artifacts/", 1)).is_file())
        self.assertTrue((self.output / "api/export.csv").is_file())
        self.assertTrue((self.output / "prompts/catalog.json").is_file())
        redirects = (self.output / "_redirects").read_text(encoding="utf-8")
        self.assertIn("/api/data /api/data.json 200", redirects)
        self.assertIn("/sources/* /artifacts/:splat 200", redirects)
        self.assertNotIn("/downloads/", redirects)
        headers = (self.output / "_headers").read_text(encoding="utf-8")
        self.assertIn("/artifacts/*", headers)
        self.assertIn("Content-Security-Policy: sandbox allow-scripts", headers)
        self.assertNotIn("allow-same-origin", headers)
        self.assertIn("Content-Disposition: attachment", headers)

    def test_source_alias_uses_existing_bytes_and_download_headers(self):
        _, data = self.export(screenshots="none")
        artifact = data["results"][0]["artifact"]
        self.assertEqual(artifact["source_url"], "/sources/Model%20One/01-fluid-simulation/index.html")
        self.assertEqual(artifact["url"], "/artifacts/Model%20One/01-fluid-simulation/index.html")
        self.assertFalse((self.output / "sources").exists())
        self.assertEqual(list((self.output / "artifacts").rglob("*.html")), [self.resolve_url(artifact["url"])])
        original_bytes = self.resolve_url(artifact["source_url"].replace("/sources/", "/artifacts/", 1)).read_bytes()
        self.assertEqual(original_bytes, self.html)
        self.assertEqual(hashlib.sha256(original_bytes).hexdigest(), artifact["sha256"])
        headers = (self.output / "_headers").read_text(encoding="utf-8")
        source_headers = headers.split("/sources/*\n", 1)[1].split("\n/", 1)[0]
        self.assertIn("Content-Type: application/octet-stream", source_headers)
        self.assertIn("Content-Disposition: attachment", source_headers)
        self.assertIn("no-transform", source_headers)

    def test_non_html_runs_and_extra_artifacts_are_excluded(self):
        (self.run / "result.html").write_text("Do not publish duplicate variants.")
        for name in ("source-only", "archive-only", "metadata-only"):
            folder = self.root / "results/Other Model" / name
            folder.mkdir(parents=True)
            if name == "source-only":
                (folder / "project").mkdir()
                (folder / "project/main.py").write_text("PRIVATE SOURCE")
            elif name == "archive-only":
                (folder / "project.zip").write_bytes(b"PRIVATE ARCHIVE")
            else:
                (folder / "metadata.json").write_text("{}")
        _, data = self.export(screenshots="none")
        self.assertEqual(len(data["results"]), 1)
        self.assertFalse(any(p.name == "result.html" for p in self.output.rglob("*")))

    def test_unsafe_destinations_are_rejected_without_changing_existing_files(self):
        for destination in (self.root, self.root / "results", self.root / "gallery", self.root.parent / "elsewhere"):
            with self.subTest(destination=str(destination)):
                with self.assertRaises(ValueError):
                    build_site.build_site(self.root, output=destination, screenshots="none")
                self.assertEqual((self.run / "index.html").read_bytes(), self.html)
        self.output.mkdir(parents=True)
        sentinel = self.output / "keep.txt"
        sentinel.write_text("User data", encoding="utf-8")
        with self.assertRaises(ValueError):
            build_site.build_site(self.root, screenshots="none")
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "User data")

    def test_rebuild_removes_stale_generated_artifacts(self):
        self.export(screenshots="none")
        (self.run / "index.html").unlink()
        _, data = self.export(screenshots="none")
        self.assertEqual(data["results"], [])
        self.assertFalse(any(p.name == "index.html" for p in (self.output / "artifacts").rglob("*")))

    def test_screenshot_fallback_preserves_only_selected_top_level_image(self):
        screenshot = b"\x89PNG\r\n\x1a\nOriginal screenshot bytes are retained without Pillow."
        (self.run / "screenshot.png").write_bytes(screenshot)
        (self.run / "preview.jpg").write_bytes(b"Unselected extra screenshot")
        (self.run / "evidence").mkdir()
        (self.run / "evidence/screenshot.png").write_bytes(b"Private evidence screenshot")
        with mock.patch.object(build_site, "pillow_modules", return_value=None):
            report, data = self.export()
        image = self.resolve_url(data["results"][0]["artifact"]["screenshot_url"])
        self.assertEqual(image.suffix, ".png")
        self.assertEqual(image.read_bytes(), screenshot)
        self.assertEqual((self.run / "screenshot.png").read_bytes(), screenshot)
        self.assertEqual(report["screenshots"], 1)
        self.assertEqual(report["unoptimized_screenshots"], 1)
        self.assertEqual(report["screenshot_bytes"], len(screenshot))
        self.assertEqual(report["source_screenshot_bytes"], len(screenshot))
        self.assertIn("Pillow", report["warnings"][0])
        self.assertIn("pip install Pillow", report["warnings"][0])
        self.assertEqual([p for p in (self.output / "artifacts").rglob("*") if p.suffix in {".png", ".jpg"}], [image])

    def test_linked_sources_and_output_are_rejected(self):
        if not hasattr(Path, "is_junction"):
            self.skipTest("Junction checks require Python 3.12 or newer")
        with mock.patch.object(Path, "is_junction", lambda path: path == self.root / "dist"):
            with self.assertRaises(ValueError):
                self.export(screenshots="none")
        with mock.patch.object(Path, "is_junction", lambda path: path == self.run):
            _, data = self.export(screenshots="none")
        self.assertEqual(data["results"], [])

    def test_screenshots_are_downscaled_and_stripped(self):
        try:
            from PIL import Image, PngImagePlugin
        except ImportError:
            self.skipTest("Optional Pillow is not installed")
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text("private", "PRIVATE-IMAGE-METADATA")
        Image.new("RGB", (3000, 2000), "navy").save(self.run / "screenshot.png", pnginfo=metadata)
        _, data = self.export(screenshots="auto")
        destination = self.resolve_url(data["results"][0]["artifact"]["screenshot_url"])
        with Image.open(destination) as image:
            self.assertLessEqual(max(image.size), 1280)
            self.assertNotIn("private", image.info)
        self.assertEqual(destination.suffix, ".webp")
        self.assertNotIn(b"PRIVATE-IMAGE-METADATA", destination.read_bytes())


class DeployScriptTests(unittest.TestCase):
    """Run both wrappers against a fake CLI; these tests cannot upload anything."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "package"
        (self.root / "tools").mkdir(parents=True)
        (self.root / "tools/build_site.py").write_text('print("Fixture build completed.")\n', encoding="utf-8")
        shutil.copytree(ROOT / "scripts", self.root / "scripts")
        fakebin = self.root / "fakebin"
        fakebin.mkdir()
        fake = fakebin / "fake_cli.py"
        fake.write_text('''import json, os, sys
from pathlib import Path
with Path(os.environ["FAKE_CLI_LOG"]).open("a", encoding="utf-8") as log:
    log.write(json.dumps({"args": sys.argv[1:], "ci": os.environ.get("CI")}) + "\\n")
if sys.argv[1] == "status":
    print(os.environ["FAKE_CLI_STATUS"])
    sys.exit(int(os.environ["FAKE_CLI_STATUS_EXIT"]))
print('{"deploy_url":"https://example.invalid"}')
''', encoding="utf-8")
        # Both shims intentionally coexist: PowerShell must select the native launcher for its OS.
        (fakebin / "netlify.cmd").write_text(f'@echo off\n"{sys.executable}" "{fake}" %*\n', encoding="utf-8")
        shim = fakebin / "netlify"
        shim.write_text(f'#!/bin/sh\nexec "{Path(sys.executable).as_posix()}" "{fake.as_posix()}" "$@"\n', encoding="utf-8")
        shim.chmod(0o755)
        self.log = self.root / "cli-calls.jsonl"
        self.env = dict(os.environ, PATH=str(fakebin) + os.pathsep + os.environ["PATH"], PYTHON=sys.executable,
                        FAKE_CLI_LOG=str(self.log), FAKE_CLI_STATUS_EXIT="1",
                        FAKE_CLI_STATUS=json.dumps({"loggedIn": True, "linked": False, "error": {"code": "NOT_LINKED"}}))
        self.env.pop("NETLIFY_SITE_ID", None)
        self.shells = []
        powershell = shutil.which("pwsh") or shutil.which("powershell")
        if powershell:
            self.shells.append(("powershell", [powershell, "-NoProfile", "-File", str(self.root / "scripts/deploy-netlify.ps1")]))
        posix = shutil.which("sh")
        if not posix and Path("C:/Program Files/Git/bin/sh.exe").is_file():
            posix = "C:/Program Files/Git/bin/sh.exe"
        if posix:
            self.shells.append(("posix", [posix, str(self.root / "scripts/deploy-netlify.sh")]))
        if not self.shells:
            self.skipTest("No supported script shell is installed")

    def invoke(self, command, arguments):
        self.log.unlink(missing_ok=True)
        result = subprocess.run(command + arguments, cwd=self.root, env=self.env,
                                capture_output=True, text=True, timeout=25)
        calls = [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
        return result, calls

    def test_missing_target_never_calls_deploy(self):
        for name, command in self.shells:
            with self.subTest(shell=name):
                result, calls = self.invoke(command, [])
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("No target selected", result.stderr + result.stdout)
                self.assertFalse(calls)

    def test_explicit_new_site_accepts_authenticated_unlinked_status(self):
        for name, command in self.shells:
            arguments = ["-SiteName", "trial-by-pyro", "-Team", "chosen-team"] if name == "powershell" else ["--site-name", "trial-by-pyro", "--team", "chosen-team"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                deploy = calls[-1]
                self.assertEqual(deploy["args"], ["deploy", "--dir", "dist/site", "--no-build", "--json", "--timeout", "600", "--site-name", "trial-by-pyro", "--team", "chosen-team"])
                self.assertEqual(deploy["ci"], "true")

    def test_existing_target_is_explicit_and_production_is_opt_in(self):
        self.env["NETLIFY_SITE_ID"] = "site-from-environment"
        for name, command in self.shells:
            arguments = ["-Production"] if name == "powershell" else ["--prod"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                self.assertEqual(calls[-1]["args"][-3:], ["--site", "site-from-environment", "--prod"])
                self.assertNotIn("--site-name", calls[-1]["args"])

    def test_failed_authentication_never_calls_deploy(self):
        self.env["FAKE_CLI_STATUS"] = json.dumps({"loggedIn": False, "linked": False, "error": {"code": "NOT_LOGGED_IN"}})
        for name, command in self.shells:
            arguments = ["-SiteId", "existing-site"] if name == "powershell" else ["--site-id", "existing-site"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual([call["args"][0] for call in calls], ["status"])

    def test_different_linked_site_is_not_reused_for_new_name(self):
        self.env["FAKE_CLI_STATUS_EXIT"] = "0"
        self.env["FAKE_CLI_STATUS"] = json.dumps({"loggedIn": True, "linked": True, "siteData": {"site-name": "previous-site"}})
        for name, command in self.shells:
            arguments = ["-SiteName", "trial-by-pyro"] if name == "powershell" else ["--site-name", "trial-by-pyro"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual([call["args"][0] for call in calls], ["status"])

    def test_build_failure_never_calls_deploy(self):
        (self.root / "tools/build_site.py").write_text("raise SystemExit(8)\n", encoding="utf-8")
        for name, command in self.shells:
            arguments = ["-SiteId", "existing-site"] if name == "powershell" else ["--site-id", "existing-site"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual([call["args"][0] for call in calls], ["status"])


if __name__ == "__main__":
    unittest.main()
