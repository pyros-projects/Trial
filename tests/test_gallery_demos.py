"""Static demo delivery contracts; submitted application code is never executed."""
from __future__ import annotations

import codecs
import hashlib
import io
import json
import stat
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from gallery import demos, projects, server
from tools import build_site

DEMO_TASKS = [
    {"id": "fixture-source-project", "title": "Source project fixture", "track": "real-apps"},
    {"id": "fixture-second-project", "title": "Second project fixture", "track": "real-apps"},
]


class GalleryDemoTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "package"
        self.output = self.root / "dist/site"
        self.results = self.root / "results"
        self.model = "Model One & #"
        self.run = self.results / self.model / "fixture-source-project"
        self.run.mkdir(parents=True)
        self.html = b'<!doctype html>\r\n<title>Demo</title>\n<script>const state = {count: 0};</script>\n'
        static = self.root / "gallery/static"
        static.mkdir(parents=True)
        for name in build_site.STATIC_FILES:
            (static / name).write_bytes(b"Public gallery asset")
        (static / "appsettings.json").write_text('{"models":[]}', encoding="utf-8")
        catalog = [{"id": "01-fluid-simulation", "title": "Fluid", "track": "html"}, *DEMO_TASKS]
        for task in catalog:
            folder = self.root / "prompts" / task["id"]
            folder.mkdir(parents=True)
            for name in ("prompt.md", "acceptance.md"):
                (folder / name).write_text("Public fixture instructions", encoding="utf-8")
        self.catalog_path = self.root / "prompts/catalog.json"
        self.catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        for attribute, value in (("RESULTS_ROOT", self.results), ("CATALOG_PATH", self.catalog_path)):
            patcher = mock.patch.object(server, attribute, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def demo(self, run=None):
        run = self.run if run is None else run
        path = run / "project/gallery/index.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(self.html)
        (run / "project/main.py").write_text("# PRIVATE authored backend source\n", encoding="utf-8")
        (run / "project/benchmark.json").write_text(json.dumps({
            "schema_version": 1, "task_id": run.name, "track": "real-apps", "name": "Fixture",
            "commands": {"start": ["python", "main.py"]},
        }), encoding="utf-8")
        return path

    def export(self):
        report = build_site.build_site(self.root, screenshots="none")
        data = json.loads((self.output / "api/data.json").read_text(encoding="utf-8"))
        return report, data

    def start_http(self, handler):
        http = server.QuietThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()

        def stop():
            http.shutdown()
            http.server_close()
            thread.join(timeout=5)

        self.addCleanup(stop)
        return f"http://127.0.0.1:{http.server_address[1]}"

    def get(self, url):
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url, timeout=5) as response:
            return response.read(), dict(response.headers)

    def test_public_demo_is_one_exact_copy_without_private_reads_or_files(self):
        source = self.demo()
        for relative in ("index.html", "metadata.json", "report.json", "notes.md", "evidence/log.jsonl",
                         "project/.env", "project/netlify.toml", "project/functions/api.js",
                         "project/gallery/sidecar.js", "project/data/state.db", "project.zip"):
            path = self.run / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"PRIVATE run contents")
        original_text, original_bytes = Path.read_text, Path.read_bytes

        def check(path):
            if path.is_relative_to(self.run) and path != source:
                raise AssertionError(f"Private source was read: {path}")

        def read_text(path, *args, **kwargs):
            check(path)
            return original_text(path, *args, **kwargs)

        def read_bytes(path, *args, **kwargs):
            check(path)
            return original_bytes(path, *args, **kwargs)

        with mock.patch.object(Path, "read_text", read_text), mock.patch.object(Path, "read_bytes", read_bytes):
            report, data = self.export()
        self.assertEqual(len(data["results"]), 1)
        artifact = data["results"][0]["artifact"]
        encoded = f"{quote(self.model, safe='')}/fixture-source-project/index.html"
        self.assertEqual(artifact["url"], f"/demos/{encoded}")
        self.assertEqual(artifact["source_url"], f"/demo-sources/{encoded}")
        self.assertIs(artifact["demo"], True)
        self.assertEqual(artifact["bytes"], len(self.html))
        self.assertEqual(artifact["sha256"], hashlib.sha256(self.html).hexdigest())
        target = self.output / unquote(artifact["url"]).lstrip("/")
        self.assertEqual(target.read_bytes(), self.html)
        self.assertEqual(source.read_bytes(), self.html)
        self.assertEqual(list((self.output / "demos").rglob("*.html")), [target])
        self.assertFalse((self.output / "demo-sources").exists())
        self.assertFalse((self.output / "artifacts").exists())
        self.assertEqual(report["html_files"], 1)
        for path in self.output.rglob("*"):
            if path.is_file():
                self.assertNotIn(b"PRIVATE", path.read_bytes(), path)
        self.assertNotIn("manifest", artifact)
        self.assertNotIn("notes", data["results"][0])
        self.assertIsNone(data["results"][0]["score"])
        self.assertEqual(artifact["checks"], [])

    def test_only_known_real_apps_use_the_fixed_demo_path_without_html_bypass(self):
        for task in DEMO_TASKS:
            run = self.results / self.model / task["id"]
            self.demo(run)
            (run / "index.html").write_text("PRIVATE top-level bypass", encoding="utf-8")
            wrong = run.with_name(task["id"] + "-wrong-path")
            (wrong / "project/gallery").mkdir(parents=True)
            for relative in ("index.html", "result.html", "app.html", "project/gallery/app.html"):
                (wrong / relative).write_bytes(self.html)
        for name in ("unknown-task", "01-fluid-simulation"):
            self.demo(self.results / self.model / name)
        _, data = self.export()
        self.assertEqual({row["task_id"] for row in data["results"]}, {task["id"] for task in DEMO_TASKS})
        self.assertEqual(len(data["results"]), 2)
        self.assertTrue(all(row["artifact"].get("demo") and row["artifact"]["url"].startswith("/demos/")
                            for row in data["results"]))

    def test_linked_or_reparse_demo_components_are_rejected(self):
        source = self.demo()
        actual_symlink, actual_lstat = Path.is_symlink, Path.lstat
        for target in (self.run, self.run / "project", source.parent, source):
            with self.subTest(path=target, kind="symlink"):
                with mock.patch.object(Path, "is_symlink", lambda path: path == target or actual_symlink(path)):
                    self.assertIsNone(demos.demo_file(self.run))
                    self.assertEqual(build_site.PublicGalleryState(self.root, DEMO_TASKS).scan(), [])
            with self.subTest(path=target, kind="Windows reparse point"):
                def lstat(path, *args, **kwargs):
                    if path == target:
                        return SimpleNamespace(st_file_attributes=stat.FILE_ATTRIBUTE_REPARSE_POINT)
                    return actual_lstat(path, *args, **kwargs)

                with mock.patch.object(Path, "is_symlink", lambda path: False if path == target else actual_symlink(path)), mock.patch.object(Path, "lstat", lstat):
                    self.assertIsNone(demos.demo_file(self.run))

    def test_form_opt_in_rejection_preserves_the_previous_export(self):
        source = self.demo()
        self.export()
        previous = {path.relative_to(self.output): path.read_bytes() for path in self.output.rglob("*") if path.is_file()}
        for fragment in (b"<form netlify>", b'<FORM DATA-NETLIFY="true">', b'<form data-netlify="false"/>',
                         b"<template><form netlify></form></template>"):
            with self.subTest(fragment=fragment):
                source.write_bytes(b"<!doctype html>" + fragment)
                with self.assertRaisesRegex(ValueError, "Netlify Forms"):
                    self.export()
                current = {path.relative_to(self.output): path.read_bytes() for path in self.output.rglob("*") if path.is_file()}
                self.assertEqual(current, previous)

    def test_form_validation_allows_text_examples_and_is_not_a_javascript_scanner(self):
        source = self.demo()
        allowed = b'''<!doctype html><!-- <form netlify> -->
<pre>&lt;form data-netlify="true"&gt;</pre><div data-note="netlify"></div>
<form name="netlify-example"></form>
<script>const example = '<form data-netlify="true">'; fetch('https://example.invalid');</script>'''
        source.write_bytes(allowed)
        demos.validate_static_html(allowed)
        _, data = self.export()
        target = self.output / unquote(data["results"][0]["artifact"]["url"]).lstrip("/")
        self.assertEqual(target.read_bytes(), allowed)

    def test_ordinary_and_unassigned_html_form_opt_ins_are_rejected(self):
        self.demo()
        self.export()
        previous = (self.output / "api/data.json").read_bytes()
        for name in ("01-fluid-simulation", "unassigned-build"):
            with self.subTest(run=name):
                run = self.results / self.model / name
                run.mkdir()
                html = run / "index.html"
                html.write_bytes(b'<!doctype html><form name="contact" data-netlify="true"></form>')
                with self.assertRaisesRegex(ValueError, "Netlify Forms"):
                    self.export()
                self.assertEqual((self.output / "api/data.json").read_bytes(), previous)
                html.unlink()

    def test_legacy_html_encoding_preserves_bytes_and_bom_form_guards(self):
        run = self.results / self.model / "01-fluid-simulation"
        run.mkdir()
        source = run / "index.html"
        title = "Résumé – café"
        legacy = f'<!doctype html><meta charset="windows-1252"><title>{title}</title>'.encode("cp1252")
        source.write_bytes(legacy)
        _, data = self.export()
        artifact = data["results"][0]["artifact"]
        target = self.output / unquote(artifact["url"]).lstrip("/")
        self.assertEqual(target.read_bytes(), legacy)
        self.assertEqual(source.read_bytes(), legacy)
        self.assertEqual(artifact["bytes"], len(legacy))
        self.assertEqual(artifact["sha256"], hashlib.sha256(legacy).hexdigest())
        encodings = (
            ("cp1252", b""), ("utf-8", codecs.BOM_UTF8),
            ("utf-16-le", codecs.BOM_UTF16_LE), ("utf-16-be", codecs.BOM_UTF16_BE),
            ("utf-32-le", codecs.BOM_UTF32_LE), ("utf-32-be", codecs.BOM_UTF32_BE),
        )
        for encoding, bom in encodings:
            for attribute in ("netlify", 'data-netlify="true"'):
                with self.subTest(encoding=encoding, attribute=attribute):
                    markup = f"<!doctype html><title>{title}</title><form {attribute}></form>"
                    source.write_bytes(bom + markup.encode(encoding))
                    with self.assertRaisesRegex(ValueError, "Netlify Forms"):
                        self.export()
                    self.assertEqual(target.read_bytes(), legacy)

    def test_export_response_policy_and_source_alias_cover_the_demo_route(self):
        self.demo()
        self.export()
        redirects = (self.output / "_redirects").read_text(encoding="utf-8")
        self.assertIn("/demo-sources/* /demos/:splat 200\n", redirects)
        headers = (self.output / "_headers").read_text(encoding="utf-8")
        for route in ("/demos/*", "/demo-sources/*"):
            block = headers.split(route + "\n", 1)[1].split("\n/", 1)[0]
            self.assertIn("Content-Security-Policy: " + demos.DEMO_CSP, block)
            self.assertIn("no-transform", block)
        download = headers.split("/demo-sources/*\n", 1)[1].split("\n/", 1)[0]
        self.assertIn("Content-Type: application/octet-stream", download)
        self.assertIn("Content-Disposition: attachment", download)
        directives = dict(part.strip().split(" ", 1) for part in demos.DEMO_CSP.split(";") if part.strip())
        self.assertEqual(set(directives["sandbox"].split()), {"allow-scripts", "allow-downloads"})
        for name in ("default-src", "connect-src", "frame-src", "object-src", "base-uri", "form-action"):
            self.assertEqual(directives[name], "'none'", name)
        self.assertNotIn("'unsafe-eval'", directives["script-src"])

    def test_local_demo_fallback_retains_source_zip_hash_and_restrictive_headers(self):
        source = self.demo()
        (self.run / "project/.env").write_text("PRIVATE credential", encoding="utf-8")
        artifact_base = self.start_http(server.make_artifact_handler())
        state = server.GalleryState(artifact_base)
        artifact = state.scan()[0]["artifact"]
        self.assertEqual(artifact["kind"], "project")
        self.assertIs(artifact["demo"], True)
        self.assertEqual(artifact["url"], state.artifact_url(source))
        summary = projects.project_summary(self.run / "project")
        self.assertEqual(artifact["sha256"], summary["sha256"])
        self.assertNotEqual(artifact["sha256"], hashlib.sha256(self.html).hexdigest())
        body, headers = self.get(artifact["url"])
        self.assertEqual(body, self.html)
        self.assertEqual(headers["Content-Security-Policy"], demos.DEMO_CSP)
        gallery_base = self.start_http(server.make_gallery_handler(state))
        zipped, _ = self.get(gallery_base + artifact["source_url"])
        with zipfile.ZipFile(io.BytesIO(zipped)) as archive:
            self.assertIn("main.py", archive.namelist())
            self.assertEqual(archive.read("gallery/index.html"), self.html)
            self.assertNotIn(".env", archive.namelist())
        for relative in ("project/main.py", "project/.env", "project/gallery/sidecar.js"):
            path = self.run / relative
            url = artifact_base + "/" + "/".join(quote(part, safe="") for part in path.relative_to(self.results).parts)
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.get(url)
            self.assertEqual(error.exception.code, 404)

    def test_explicit_loopback_preview_takes_precedence_without_changing_source_identity(self):
        self.demo()
        state = server.GalleryState("http://127.0.0.1:8766")
        original = state.scan()[0]["artifact"]
        preview = "http://127.0.0.1:8999/"
        (self.run / "metadata.json").write_text(json.dumps({"preview_url": preview}), encoding="utf-8")
        selected = state.scan()[0]["artifact"]
        self.assertEqual(selected["url"], preview)
        self.assertFalse(selected.get("demo", False))
        self.assertEqual(selected["sha256"], original["sha256"])
        self.assertEqual(selected["source_url"], original["source_url"])

    def test_invalid_explicit_preview_remains_blocked_with_a_warning(self):
        self.demo()
        (self.run / "metadata.json").write_text(json.dumps({"preview_url": "https://example.invalid:443/"}), encoding="utf-8")
        state = server.GalleryState("http://127.0.0.1:8766")
        artifact = state.scan()[0]["artifact"]
        self.assertIsNone(artifact["url"])
        self.assertFalse(artifact.get("demo", False))
        self.assertIn("loopback", artifact["warning"])


if __name__ == "__main__":
    unittest.main()
