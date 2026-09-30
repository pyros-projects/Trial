"""The public export is an allowlist of display assets, never a results archive."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from html.parser import HTMLParser
from unittest import mock
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools import build_site


class ShareDocument(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.feed(source)
        self.metadata = {attrs.get("property", attrs.get("name")): attrs.get("content")
                         for tag, attrs in self.tags if tag == "meta"}

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


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

    def share_document(self, row):
        source = (self.resolve_url(row["share_url"]) / "index.html").read_text(encoding="utf-8")
        return source, ShareDocument(source)

    def comparison_document(self, data, task_id="01-fluid-simulation"):
        source = (self.resolve_url(data["comparison_urls"][task_id]) / "index.html").read_text(encoding="utf-8")
        return source, ShareDocument(source)

    def model_document(self, data, model_key="Model One"):
        source = (self.resolve_url(data["model_urls"][model_key]) / "index.html").read_text(encoding="utf-8")
        return source, ShareDocument(source)

    def add_catalog_task(self, task_id, title):
        catalog_path = self.root / "prompts/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog.append({"id": task_id, "title": title, "track": "html"})
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        prompt = self.root / "prompts" / task_id
        prompt.mkdir()
        for name in ("prompt.md", "acceptance.md"):
            (prompt / name).write_text("Public requirements for " + title, encoding="utf-8")

    def test_model_collection_pages_count_builds_prompts_and_escape_component_paths(self):
        model_key = "Model ' & # % 雪"
        model_folder = self.run.parent.with_name(model_key)
        self.run.parent.rename(model_folder)
        self.run = model_folder / self.run.name
        label = 'Model "><img src=x onerror=alert(1)> & </script>'
        settings = {"siteUrl": "https://models.example.test:8443/", "models": [{"key": model_key, "label": label}]}
        (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")
        self.add_catalog_task("02-vector", "Vector")
        for run_key in ("01-fluid-simulation-repeat", "02-vector", "unknown-build"):
            folder = model_folder / run_key
            folder.mkdir()
            (folder / "index.html").write_bytes(self.html)
        private_only = self.root / "results/Not Published/source-only/project"
        private_only.mkdir(parents=True)
        (private_only / "main.py").write_text("PRIVATE-SOURCE", encoding="utf-8")
        (self.run / "metadata.json").write_text('{"notes":"PRIVATE-NOTE","model":"PRIVATE-MODEL"}', encoding="utf-8")
        (self.run / "screenshot.png").write_bytes(b"PRIVATE-DO-NOT-READ-SCREENSHOTS-NONE")
        originals = {path: path.read_bytes() for path in self.root.rglob("index.html")}
        report, data = self.export(screenshots="none")
        model_url = "/models/" + quote(model_key, safe="") + "/"
        self.assertEqual(data["model_urls"], {model_key: model_url})
        source, document = self.model_document(data, model_key)
        canonical = "https://models.example.test:8443" + model_url
        self.assertEqual(document.metadata["og:url"], canonical)
        self.assertIn(("link", {"rel": "canonical", "href": canonical}), document.tags)
        self.assertEqual(document.metadata["og:title"], label + " builds | Trial - a Vibe Benchmark")
        self.assertIn("4 builds", document.metadata["og:description"])
        self.assertIn("2 prompts", document.metadata["og:description"])
        self.assertEqual(document.metadata["twitter:title"], document.metadata["og:title"])
        self.assertEqual(document.metadata["twitter:description"], document.metadata["og:description"])
        self.assertEqual(document.metadata["twitter:card"], "summary")
        self.assertFalse(any(key and "image" in key for key in document.metadata))
        viewer = "/#model/" + quote(model_key, safe="")
        self.assertIn(viewer, [attrs.get("href") for tag, attrs in document.tags if tag == "a"])
        script = re.search(r"<script>(.*?)</script>", source, flags=re.DOTALL).group(1)
        self.assertEqual(json.loads(re.search(r"location\.replace\((.+?)\);", script).group(1)), viewer)
        self.assertEqual(sum(tag == "script" for tag, _ in document.tags), 1)
        self.assertEqual(source.count("</script>"), 1)
        self.assertFalse(any(tag == "img" or "onerror" in attrs or attrs.get("http-equiv", "").lower() == "refresh" for tag, attrs in document.tags))
        self.assertNotIn("/models/", (self.output / "_redirects").read_text(encoding="utf-8"))
        self.assertEqual(report["model_pages"], 1)
        self.assertEqual(report["model_images"], 0)
        self.assertEqual(report["model_image_bytes"], 0)
        self.assertEqual([path.name for path in self.resolve_url(model_url).iterdir()], ["index.html"])
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.html"))), 4)
        for row in data["results"]:
            self.assertEqual(self.resolve_url(row["artifact"]["url"]).read_bytes(), self.html)
            self.assertEqual(row["artifact"]["sha256"], hashlib.sha256(self.html).hexdigest())
        for path, content in originals.items():
            self.assertEqual(path.read_bytes(), content)
        for path in self.output.rglob("*"):
            if path.is_file():
                self.assertNotIn(b"PRIVATE", path.read_bytes(), str(path))
        self.assertLess(len(source.encode("utf-8")), 4096)

    def test_model_collection_jpeg_uses_three_distinct_tasks_in_catalog_order(self):
        try:
            from PIL import Image, ImageDraw, PngImagePlugin
        except ImportError:
            self.skipTest("Optional Pillow is not installed")
        tasks = [("03-vector", "Vector", "#00ff00"), ("01-fluid-simulation", "Fluid", "#ff0000"),
                 ("02-orbits", "Orbits", "#0000ff"), ("04-sand", "Sand", "#ffff00")]
        for key, title, _ in tasks:
            if key != "01-fluid-simulation":
                self.add_catalog_task(key, title)
        catalog_path = self.root / "prompts/catalog.json"
        catalog = {task["id"]: task for task in json.loads(catalog_path.read_text(encoding="utf-8"))}
        catalog_path.write_text(json.dumps([catalog[key] for key, _, _ in tasks]), encoding="utf-8")
        original_images = {}
        for run_key, color in [(key, color) for key, _, color in tasks] + [
                ("01-fluid-simulation-repeat", "magenta"), ("unknown-build", "navy")]:
            folder = self.run.parent / run_key
            folder.mkdir(exist_ok=True)
            (folder / "index.html").write_bytes(self.html)
            metadata = PngImagePlugin.PngInfo()
            metadata.add_text("private", "PRIVATE-IMAGE-METADATA")
            path = folder / "screenshot.png"
            Image.new("RGB", (600, 400), color).save(path, pnginfo=metadata)
            original_images[path] = path.read_bytes()
        drawn = []
        original_text = ImageDraw.ImageDraw.text

        def record_text(draw, position, text, *args, **kwargs):
            drawn.append(text)
            return original_text(draw, position, text, *args, **kwargs)

        with mock.patch.object(ImageDraw.ImageDraw, "text", record_text):
            report, data = self.export()
        _, document = self.model_document(data)
        image_url = "/models/Model%20One/preview.jpg"
        self.assertEqual(document.metadata["og:image"], build_site.DEFAULT_SITE_URL + image_url)
        self.assertEqual(document.metadata["twitter:image"], document.metadata["og:image"])
        self.assertEqual(document.metadata["twitter:card"], "summary_large_image")
        self.assertIn("6 builds", document.metadata["og:description"])
        self.assertIn("4 prompts", document.metadata["og:description"])
        alt = document.metadata["og:image:alt"]
        self.assertLess(alt.index("Vector"), alt.index("Fluid"))
        self.assertLess(alt.index("Fluid"), alt.index("Orbits"))
        model_text = drawn[drawn.index("TRIAL / MODEL") + 1:]
        self.assertIn("Display name builds", model_text)
        self.assertEqual([text for text in model_text if text in {title for _, title, _ in tasks}], ["Vector", "Fluid", "Orbits"])
        jpeg = self.resolve_url(image_url)
        with Image.open(jpeg) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (1200, 630))
            self.assertEqual(image.mode, "RGB")
            self.assertFalse(image.getexif())
            self.assertNotIn("comment", image.info)
            self.assertNotIn("icc_profile", image.info)
            for point, channel in [((200, 360), 1), ((600, 360), 0), ((1000, 360), 2)]:
                pixel = image.getpixel(point)
                self.assertGreater(pixel[channel], 200)
                self.assertTrue(all(value < 50 for index, value in enumerate(pixel) if index != channel))
        self.assertNotIn(b"PRIVATE", jpeg.read_bytes())
        self.assertLess(jpeg.stat().st_size, 200 * 1024)
        self.assertEqual(report["model_pages"], 1)
        self.assertEqual(report["model_images"], 1)
        self.assertEqual(report["model_image_bytes"], jpeg.stat().st_size)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.html"))), 6)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.webp"))), 6)
        self.assertEqual(len(list((self.output / "models").rglob("*.jpg"))), 1)
        for path, content in original_images.items():
            self.assertEqual(path.read_bytes(), content)

    def test_model_collection_without_pillow_reuses_prompt_order_or_unassigned_image(self):
        self.add_catalog_task("02-orbits", "Orbits")
        catalog_path = self.root / "prompts/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog_path.write_text(json.dumps(list(reversed(catalog))), encoding="utf-8")
        (self.run / "screenshot.png").write_bytes(b"Original fluid screenshot")
        first = self.run.parent / "02-orbits"
        first.mkdir()
        (first / "index.html").write_bytes(self.html)
        (first / "screenshot.png").write_bytes(b"Original orbital screenshot")
        unknown = self.root / "results/Unassigned Model/unknown"
        unknown.mkdir(parents=True)
        (unknown / "index.html").write_bytes(self.html)
        (unknown / "screenshot.png").write_bytes(b"Original unassigned screenshot")
        with mock.patch.object(build_site, "pillow_modules", return_value=None):
            report, data = self.export()
        for model_key, run_key in [("Model One", "02-orbits"), ("Unassigned Model", "unknown")]:
            with self.subTest(model=model_key):
                _, document = self.model_document(data, model_key)
                row = next(row for row in data["results"] if row["model_key"] == model_key and row["run_key"] == run_key)
                screenshot = row["artifact"]["screenshot_url"]
                self.assertEqual(document.metadata["og:image"], build_site.DEFAULT_SITE_URL + screenshot)
                self.assertEqual(document.metadata["twitter:image"], document.metadata["og:image"])
                self.assertEqual(document.metadata["twitter:card"], "summary_large_image")
                self.assertEqual(self.resolve_url(screenshot).read_bytes(), (self.root / "results" / model_key / run_key / "screenshot.png").read_bytes())
        _, document = self.model_document(data, "Unassigned Model")
        self.assertIn("1 build", document.metadata["og:description"])
        self.assertIn("0 prompts", document.metadata["og:description"])
        self.assertEqual(report["model_pages"], 2)
        self.assertEqual(report["model_images"], 0)
        self.assertEqual(report["model_image_bytes"], 0)
        self.assertFalse(list((self.output / "models").rglob("preview.jpg")))
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.png"))), 3)

    def test_model_collection_without_images_is_text_only_and_rebuild_removes_page(self):
        report, data = self.export()
        _, document = self.model_document(data)
        self.assertIn("1 build", document.metadata["og:description"])
        self.assertIn("1 prompt", document.metadata["og:description"])
        self.assertNotIn("1 prompts", document.metadata["og:description"])
        self.assertEqual(document.metadata["twitter:card"], "summary")
        self.assertNotIn("og:image", document.metadata)
        self.assertEqual(report["model_pages"], 1)
        self.assertEqual(report["model_images"], 0)
        (self.run / "index.html").unlink()
        report, data = self.export()
        self.assertEqual(data["model_urls"], {})
        self.assertEqual(report["model_pages"], 0)
        self.assertEqual(report["model_images"], 0)
        self.assertEqual(report["model_image_bytes"], 0)
        self.assertFalse((self.output / "models").exists())

    def test_comparison_pages_count_builds_models_and_escape_public_metadata(self):
        title = 'Fluid </title><script>alert("title")</script>'
        label = 'Model "><img src=x onerror=alert(1)>'
        catalog_path = self.root / "prompts/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog[0]["title"] = title
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        original_catalog = catalog_path.read_bytes()
        prompt = self.root / "prompts/01-fluid-simulation/prompt.md"
        original_prompt = prompt.read_bytes()
        settings = {"siteUrl": "https://comparisons.example.test:8443/", "models": [{"key": "Model One", "label": label}]}
        (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")
        for model, run in [("Model One", "01-fluid-simulation-two"), ("Model Two", "01-fluid-simulation")]:
            folder = self.root / "results" / model / run
            folder.mkdir(parents=True)
            (folder / "index.html").write_bytes(self.html)
        (self.run / "screenshot.png").write_bytes(b"Do not read images with --screenshots none")
        report, data = self.export(screenshots="none")
        self.assertEqual(data["comparison_urls"], {"01-fluid-simulation": "/compare/01-fluid-simulation/"})
        source, document = self.comparison_document(data)
        canonical = "https://comparisons.example.test:8443/compare/01-fluid-simulation/"
        self.assertEqual(document.metadata["og:url"], canonical)
        self.assertIn(("link", {"rel": "canonical", "href": canonical}), document.tags)
        self.assertEqual(document.metadata["og:title"], title + " | Trial")
        self.assertIn("3 builds", document.metadata["og:description"])
        self.assertIn("2 models", document.metadata["og:description"])
        self.assertIn(label, document.metadata["og:description"])
        self.assertEqual(document.metadata["twitter:title"], document.metadata["og:title"])
        self.assertEqual(document.metadata["twitter:description"], document.metadata["og:description"])
        self.assertEqual(document.metadata["twitter:card"], "summary")
        self.assertFalse(any(key and "image" in key for key in document.metadata))
        viewer = "/#compare/01-fluid-simulation"
        self.assertIn(viewer, [attrs.get("href") for tag, attrs in document.tags if tag == "a"])
        script = re.search(r"<script>(.*?)</script>", source, flags=re.DOTALL).group(1)
        self.assertEqual(json.loads(re.search(r"location\.replace\((.+?)\);", script).group(1)), viewer)
        self.assertEqual(source.count("</script>"), 1)
        self.assertFalse(any(tag == "img" or "onerror" in attrs or attrs.get("http-equiv", "").lower() == "refresh" for tag, attrs in document.tags))
        self.assertNotIn("/compare/", (self.output / "_redirects").read_text(encoding="utf-8"))
        self.assertFalse((self.output / "comparisons").exists())
        self.assertEqual(report["html_files"], 3)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.html"))), 3)
        self.assertEqual(catalog_path.read_bytes(), original_catalog)
        self.assertEqual(prompt.read_bytes(), original_prompt)
        self.assertLess(len(source.encode("utf-8")), 4096)

    def test_comparison_urls_exclude_unknown_and_non_html_tasks_and_reject_unsafe_ids(self):
        catalog_path = self.root / "prompts/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog.append({"id": "02-source-only", "title": "Source task", "track": "real-apps"})
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        prompt = self.root / "prompts/02-source-only"
        prompt.mkdir()
        for name in ("prompt.md", "acceptance.md"):
            (prompt / name).write_text("Public source task", encoding="utf-8")
        source = self.root / "results/Model One/02-source-only/project"
        source.mkdir(parents=True)
        (source / "main.py").write_text("PRIVATE PROJECT", encoding="utf-8")
        unknown = self.root / "results/Unknown Model/unknown"
        unknown.mkdir(parents=True)
        (unknown / "index.html").write_bytes(self.html)
        _, data = self.export(screenshots="none")
        self.assertEqual(set(data["comparison_urls"]), {"01-fluid-simulation"})
        self.assertEqual(len(list((self.output / "compare").rglob("index.html"))), 1)
        self.assertEqual(len(data["results"]), 2)
        previous = (self.output / "api/data.json").read_bytes()
        catalog[0]["id"] = "../outside"
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        with self.assertRaises(ValueError):
            self.export(screenshots="none")
        self.assertEqual((self.output / "api/data.json").read_bytes(), previous)
        catalog[0]["id"] = "01-fluid-simulation"
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        (self.run / "index.html").unlink()
        _, data = self.export(screenshots="none")
        self.assertEqual(data["comparison_urls"], {})
        self.assertFalse((self.output / "compare").exists())

    def test_comparison_without_pillow_reuses_first_image_in_configured_order(self):
        (self.run / "screenshot.png").write_bytes(b"Original first-model screenshot")
        second = self.root / "results/Model Two/01-fluid-simulation"
        second.mkdir(parents=True)
        (second / "index.html").write_bytes(self.html)
        second_image = b"Original second-model screenshot"
        (second / "screenshot.png").write_bytes(second_image)
        settings = {"models": [{"key": "Model Two", "label": "Second display"}, {"key": "Model One", "label": "First display"}]}
        (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")
        with mock.patch.object(build_site, "pillow_modules", return_value=None):
            report, data = self.export()
        _, document = self.comparison_document(data)
        second_row = next(row for row in data["results"] if row["model_key"] == "Model Two")
        expected_image = build_site.DEFAULT_SITE_URL + second_row["artifact"]["screenshot_url"]
        self.assertEqual(document.metadata["og:image"], expected_image)
        self.assertEqual(document.metadata["twitter:image"], expected_image)
        self.assertEqual(document.metadata["twitter:card"], "summary_large_image")
        description = document.metadata["og:description"]
        self.assertLess(description.index("Second display"), description.index("First display"))
        self.assertIn("Second display", document.metadata["og:image:alt"])
        self.assertEqual(self.resolve_url(second_row["artifact"]["screenshot_url"]).read_bytes(), second_image)
        self.assertFalse((self.output / "comparisons").exists())
        self.assertEqual(report["comparison_images"], 0)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.png"))), 2)

    def test_comparison_jpeg_uses_three_distinct_models_and_strips_source_metadata(self):
        try:
            from PIL import Image, ImageDraw, PngImagePlugin
        except ImportError:
            self.skipTest("Optional Pillow is not installed")
        models = [("Model One", "First display", "#ff0000"), ("Model Two", "Second display", "#0000ff"),
                  ("Model Three", "Third display", "#00ff00"), ("Model Four", "Fourth display", "#ffff00")]
        original_images = {}
        for key, _, color in models:
            folder = self.root / "results" / key / "01-fluid-simulation"
            folder.mkdir(parents=True, exist_ok=True)
            (folder / "index.html").write_bytes(self.html)
            metadata = PngImagePlugin.PngInfo()
            metadata.add_text("private", "PRIVATE-IMAGE-METADATA")
            path = folder / "screenshot.png"
            Image.new("RGB", (600, 400), color).save(path, pnginfo=metadata)
            original_images[path] = path.read_bytes()
        duplicate = self.root / "results/Model Three/01-fluid-simulation-two"
        duplicate.mkdir()
        (duplicate / "index.html").write_bytes(self.html)
        Image.new("RGB", (600, 400), "magenta").save(duplicate / "screenshot.png")
        order = [models[2], models[0], models[1], models[3]]
        settings = {"models": [{"key": key, "label": label} for key, label, _ in order]}
        (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")
        drawn = []
        original_text = ImageDraw.ImageDraw.text

        def record_text(draw, position, text, *args, **kwargs):
            drawn.append((text, getattr(kwargs.get("font"), "size", 0)))
            return original_text(draw, position, text, *args, **kwargs)

        with mock.patch.object(ImageDraw.ImageDraw, "text", record_text):
            report, data = self.export()
        _, document = self.comparison_document(data)
        self.assertEqual(document.metadata["og:image"], build_site.DEFAULT_SITE_URL + "/comparisons/01-fluid-simulation.jpg")
        self.assertEqual(document.metadata["twitter:image"], document.metadata["og:image"])
        self.assertIn("5 builds", document.metadata["og:description"])
        self.assertIn("4 models", document.metadata["og:description"])
        jpeg = self.output / "comparisons/01-fluid-simulation.jpg"
        with Image.open(jpeg) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertEqual(image.size, (1200, 630))
            self.assertEqual(image.mode, "RGB")
            self.assertFalse(image.getexif())
            self.assertNotIn("comment", image.info)
            self.assertNotIn("icc_profile", image.info)
            for point, channel in [((200, 360), 1), ((600, 360), 0), ((1000, 360), 2)]:
                pixel = image.getpixel(point)
                self.assertGreater(pixel[channel], 200)
                self.assertTrue(all(value < 50 for index, value in enumerate(pixel) if index != channel))
        labels = [text for text, _ in drawn if text in {entry[1] for entry in models}]
        self.assertEqual(labels, ["Third display", "First display", "Second display"])
        self.assertTrue(all(size >= 18 for text, size in drawn if text in labels))
        self.assertTrue(any("Fluid" in text for text, _ in drawn))
        self.assertTrue(any("5 builds" in text and "4 models" in text for text, _ in drawn))
        self.assertNotIn(b"PRIVATE", jpeg.read_bytes())
        self.assertLess(jpeg.stat().st_size, 200 * 1024)
        self.assertEqual(report["comparison_images"], 1)
        self.assertEqual(report["comparison_image_bytes"], jpeg.stat().st_size)
        self.assertEqual(len(list((self.output / "comparisons").iterdir())), 1)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.html"))), 5)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.webp"))), 5)
        for path, content in original_images.items():
            self.assertEqual(path.read_bytes(), content)

    def test_comparison_with_unreadable_screenshot_keeps_text_preview(self):
        if build_site.pillow_modules() is None:
            self.skipTest("Optional Pillow is not installed")
        (self.run / "screenshot.png").write_bytes(b"Unreadable screenshot fixture")
        _, data = self.export()
        _, document = self.comparison_document(data)
        self.assertEqual(document.metadata["twitter:card"], "summary")
        self.assertNotIn("og:image", document.metadata)
        self.assertFalse((self.output / "comparisons").exists())

    def test_comparison_with_one_model_has_one_image_and_singular_counts(self):
        modules = build_site.pillow_modules()
        if modules is None:
            self.skipTest("Optional Pillow is not installed")
        image_module, _ = modules
        image_module.new("RGB", (800, 500), "navy").save(self.run / "screenshot.png")
        report, data = self.export()
        _, document = self.comparison_document(data)
        self.assertIn("1 build from 1 model", document.metadata["og:description"])
        self.assertIn("Display name", document.metadata["og:image:alt"])
        self.assertEqual(report["comparison_images"], 1)
        image_url = document.metadata["og:image"].removeprefix(build_site.DEFAULT_SITE_URL)
        with image_module.open(self.resolve_url(image_url)) as image:
            self.assertEqual(image.size, (1200, 630))
            self.assertEqual(image.format, "JPEG")
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.webp"))), 1)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.html"))), 1)

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
        self.assertTrue((self.resolve_url(row["share_url"]) / "index.html").is_file())
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

    def test_model_profiles_match_local_allowlist_without_reading_run_files(self):
        profile = self.run.parent / "model.toml"
        profile.write_text('''provider = "Provider"
provider_url = "https://provider.example/"
harness = "Harness"
harness_url = "https://harness.example/"
setting = "High reasoning"
runtime = "Local runtime"
runtime_url = "https://runtime.example/"
quantization = "4-bit with 8-bit attention"
quantization_url = "https://models.example/quant"
label = "PRIVATE-LABEL"
color = "PRIVATE-COLOR"
notes = "PRIVATE-NOTE"
[credentials]
token = "PRIVATE-TOKEN"
''', encoding="utf-8")
        (self.run / "model.toml").write_text('provider = "PRIVATE-RUN-PROFILE"', encoding="utf-8")
        (self.run / "metadata.json").write_text('{"provider":"PRIVATE-RUN-PROVIDER"}', encoding="utf-8")
        with mock.patch.object(build_site.server, "RESULTS_ROOT", self.root / "results"):
            local = build_site.server.GalleryState("http://127.0.0.1:8766").data()
        original_open = Path.open

        def checked_open(path, *args, **kwargs):
            if path.is_relative_to(self.run) and path.name != "index.html":
                raise AssertionError(f"Private run file was opened: {path}")
            return original_open(path, *args, **kwargs)

        with mock.patch.object(Path, "open", checked_open):
            _, public = self.export(screenshots="none")
        expected = {"Model One": {"provider": "Provider", "provider_url": "https://provider.example/",
                                  "harness": "Harness", "harness_url": "https://harness.example/", "setting": "High reasoning",
                                  "runtime": "Local runtime", "runtime_url": "https://runtime.example/",
                                  "quantization": "4-bit with 8-bit attention", "quantization_url": "https://models.example/quant"}}
        self.assertEqual(local["model_profiles"], expected)
        self.assertEqual(public["model_profiles"], expected)
        self.assertFalse(list(self.output.rglob("*.toml")))
        for path in self.output.rglob("*"):
            if path.is_file():
                self.assertNotIn(b"PRIVATE", path.read_bytes(), path)

    def test_model_profiles_missing_invalid_and_unpublished_models_do_not_break_export(self):
        extra = self.root / "results/Unpublished model"
        extra.mkdir()
        (extra / "model.toml").write_text('provider = "PRIVATE-UNPUBLISHED"', encoding="utf-8")
        profile = self.run.parent / "model.toml"
        for content in (None, 'provider = "unterminated', 'provider_url = "javascript:alert(1)"'):
            with self.subTest(content=content):
                if content is not None:
                    profile.write_text(content, encoding="utf-8")
                _, data = self.export(screenshots="none")
                self.assertEqual(data["model_profiles"], {})
                self.assertEqual(len(data["results"]), 1)
                self.assertFalse(list(self.output.rglob("*.toml")))

    def test_prompt_guidance_survives_public_export_without_private_fields(self):
        catalog_path = self.root / "prompts/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        guidance = {
            "look_for": "Drag through the dye. Does it curl around obstacles and settle after you stop?",
        }
        catalog[0].update(guidance)
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        _, data = self.export(screenshots="none")
        published = json.loads((self.output / "prompts/catalog.json").read_text(encoding="utf-8"))
        for task in (data["catalog"][0], published[0]):
            for field, value in guidance.items():
                self.assertEqual(task.get(field), value)
            self.assertNotIn("internal_note", task)

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

    def split_settings(self, **changes):
        settings = json.loads(self.model_settings)
        settings.update(siteUrl="https://gallery.example.test", artifactOrigin="https://builds.example.test")
        settings.update(changes)
        (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")

    def test_split_export_moves_only_app_html_off_the_gallery_origin(self):
        self.split_settings()
        screenshot = b"Selected screenshot"
        (self.run / "screenshot.png").write_bytes(screenshot)
        private = self.run / "evidence/private.json"
        private.parent.mkdir()
        private.write_text("PRIVATE EVIDENCE", encoding="utf-8")
        original_open = Path.open

        def guarded_open(path, *args, **kwargs):
            if path == private:
                raise AssertionError("The exporter read raw evidence")
            return original_open(path, *args, **kwargs)

        with mock.patch.object(Path, "open", guarded_open), mock.patch.object(build_site, "pillow_modules", return_value=None):
            report, data = self.export()
        artifact = data["results"][0]["artifact"]
        self.assertEqual(artifact["url"], "https://builds.example.test/artifacts/Model%20One/01-fluid-simulation/index.html")
        self.assertEqual(artifact["source_url"], "https://builds.example.test/sources/Model%20One/01-fluid-simulation/index.html")
        self.assertEqual(artifact["screenshot_url"], "/artifacts/Model%20One/01-fluid-simulation/screenshot.png")
        self.assertEqual(self.resolve_url(artifact["screenshot_url"]).read_bytes(), screenshot)
        self.assertFalse(list((self.output / "artifacts").rglob("*.html")))
        artifact_output = self.root / "dist/artifacts"
        published = artifact_output / "artifacts/Model One/01-fluid-simulation/index.html"
        self.assertEqual(published.read_bytes(), self.html)
        self.assertEqual(hashlib.sha256(published.read_bytes()).hexdigest(), artifact["sha256"])
        self.assertEqual((self.run / "index.html").read_bytes(), self.html)
        self.assertEqual({p.relative_to(artifact_output).as_posix() for p in artifact_output.rglob("*") if p.is_file()},
                         {"artifacts/Model One/01-fluid-simulation/index.html", "_headers", "_redirects"})
        _, share = self.share_document(data["results"][0])
        self.assertEqual(share.metadata["og:image"], "https://gallery.example.test" + artifact["screenshot_url"])
        self.assertEqual(report["artifact_origin"], "https://builds.example.test")
        self.assertEqual(report["artifact_output"], str(artifact_output))
        self.assertEqual(report["artifact_files"], 3)
        self.assertEqual(report["artifact_bytes"], sum(p.stat().st_size for p in artifact_output.rglob("*") if p.is_file()))
        self.assertEqual(report["bytes"], sum(p.stat().st_size for p in self.output.rglob("*") if p.is_file()))

    def test_split_routes_redirect_to_normal_origin_and_keep_source_attachments(self):
        self.split_settings()
        self.export(screenshots="none")
        redirects = (self.output / "_redirects").read_text(encoding="utf-8").splitlines()
        self.assertIn("/artifacts/* https://builds.example.test/artifacts/:splat 302", redirects)
        self.assertIn("/sources/* https://builds.example.test/sources/:splat 302", redirects)
        self.assertNotIn("/sources/* /artifacts/:splat 200", redirects)
        artifact_output = self.root / "dist/artifacts"
        self.assertEqual((artifact_output / "_redirects").read_text(encoding="utf-8"), "/sources/* /artifacts/:splat 200\n")
        headers = (artifact_output / "_headers").read_text(encoding="utf-8")
        self.assertNotIn("sandbox", headers)
        self.assertIn("X-Content-Type-Options: nosniff", headers)
        self.assertIn("Referrer-Policy: no-referrer", headers)
        self.assertIn("Content-Type: application/octet-stream", headers)
        self.assertIn("Content-Disposition: attachment", headers)
        self.assertIn("no-transform", headers)

    def test_artifact_origin_rejects_unsafe_and_equivalent_gallery_origins(self):
        self.export(screenshots="none")
        previous = (self.output / "api/data.json").read_bytes()
        unsafe = [None, "", 42, [], "//builds.example.test", "javascript:alert(1)",
                  "https://user:secret@builds.example.test", "https://builds.example.test/path",
                  "https://builds.example.test?", "https://builds.example.test#",
                  "https://builds.example.test\\@evil.test", "https://builds.example.test\n",
                  "https://builds.example.test:99999", "https://GALLERY.example.test:443/"]
        for value in unsafe:
            with self.subTest(artifactOrigin=value):
                self.split_settings(artifactOrigin=value)
                with self.assertRaises(ValueError):
                    self.export(screenshots="none")
                self.assertEqual((self.output / "api/data.json").read_bytes(), previous)
                self.assertFalse((self.root / "dist/artifacts").exists())

    def test_artifact_origin_override_is_normalized_without_rewriting_settings(self):
        self.split_settings()
        path = self.root / "gallery/static/appsettings.json"
        original = path.read_bytes()
        report, data = self.export(screenshots="none", artifact_origin="https://BUILDS-PREVIEW.example.test:443/")
        self.assertEqual(report["artifact_origin"], "https://builds-preview.example.test")
        self.assertTrue(data["results"][0]["artifact"]["url"].startswith("https://builds-preview.example.test/artifacts/"))
        self.assertEqual((self.output / "appsettings.json").read_bytes(), original)
        self.assertEqual(path.read_bytes(), original)
        with self.assertRaises(ValueError):
            self.export(screenshots="none", artifact_origin="https://gallery.example.test/")

    def test_artifact_origin_does_not_accept_browser_equivalent_ip_spellings(self):
        for origin in ("http://127.1", "http://2130706433", "http://0x7f000001", "http://0177.0.0.1"):
            with self.subTest(artifactOrigin=origin):
                self.split_settings(siteUrl="http://127.0.0.1", artifactOrigin=origin)
                with self.assertRaises(ValueError):
                    self.export(screenshots="none")
        self.split_settings(siteUrl="http://[::1]", artifactOrigin="http://[0:0:0:0:0:0:0:1]:80/")
        with self.assertRaises(ValueError):
            self.export(screenshots="none")

    def test_split_export_does_not_replace_unowned_artifact_directory(self):
        self.export(screenshots="none")
        previous = (self.output / "api/data.json").read_bytes()
        self.split_settings()
        artifact_output = self.root / "dist/artifacts"
        artifact_output.mkdir()
        sentinel = artifact_output / "keep.txt"
        sentinel.write_text("User data", encoding="utf-8")
        with self.assertRaises(ValueError):
            self.export(screenshots="none")
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "User data")
        self.assertEqual((self.output / "api/data.json").read_bytes(), previous)

    def test_split_export_stages_both_outputs_and_removes_stale_artifacts_on_success(self):
        self.split_settings()
        self.export(screenshots="none")
        artifact_output = self.root / "dist/artifacts"
        self.assertTrue(artifact_output.is_dir())
        previous = {p: p.read_bytes() for out in (self.output, artifact_output) for p in out.rglob("*") if p.is_file()}
        prompt = self.root / "prompts/01-fluid-simulation/acceptance.md"
        prompt.unlink()
        with self.assertRaises(ValueError):
            self.export(screenshots="none")
        self.assertEqual({p: p.read_bytes() for p in previous}, previous)
        prompt.write_text("Restored prompt", encoding="utf-8")
        (self.run / "index.html").unlink()
        report, data = self.export(screenshots="none")
        self.assertEqual(data["results"], [])
        self.assertFalse(list(artifact_output.rglob("*.html")))
        self.assertEqual(report["artifact_files"], 2)

    def test_artifact_staging_failure_preserves_both_existing_exports(self):
        self.split_settings()
        self.export(screenshots="none")
        artifact_output = self.root / "dist/artifacts"
        previous = {p: p.read_bytes() for out in (self.output, artifact_output) for p in out.rglob("*") if p.is_file()}
        original_write = Path.write_text

        def fail_artifact_headers(path, *args, **kwargs):
            if path.name == "_headers" and path.parent.name == "artifacts":
                raise OSError("Fixture: app staging write failed")
            return original_write(path, *args, **kwargs)

        with mock.patch.object(Path, "write_text", fail_artifact_headers), self.assertRaises(OSError):
            self.export(screenshots="none")
        self.assertEqual({p: p.read_bytes() for p in previous}, previous)

    def test_split_export_rejects_artifact_junctions_before_replacing_gallery(self):
        if not hasattr(Path, "is_junction"):
            self.skipTest("Junction checks require Python 3.12 or newer")
        self.split_settings()
        self.export(screenshots="none")
        previous = (self.output / "api/data.json").read_bytes()
        targets = (self.root / "dist/artifacts", self.root / "dist/.artifacts-export-owned",
                   self.root / "dist/artifacts/artifacts")
        for target in targets:
            with self.subTest(target=target), mock.patch.object(Path, "is_junction", lambda path: path == target):
                with self.assertRaises(ValueError):
                    self.export(screenshots="none")
                self.assertEqual((self.output / "api/data.json").read_bytes(), previous)

    def test_split_export_keeps_legacy_demo_routes_and_policy_in_gallery(self):
        self.split_settings()
        self.add_catalog_task("fixture-demo", "Legacy demo")
        catalog_path = self.root / "prompts/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog[-1]["track"] = "real-apps"
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        demo = self.run.parent / "fixture-demo/project/gallery/index.html"
        demo.parent.mkdir(parents=True)
        demo.write_bytes(self.html)
        _, data = self.export(screenshots="none")
        artifact = next(row["artifact"] for row in data["results"] if row["task_id"] == "fixture-demo")
        self.assertEqual(artifact["url"], "/demos/Model%20One/fixture-demo/index.html")
        self.assertEqual(self.resolve_url(artifact["url"]).read_bytes(), self.html)
        self.assertFalse((self.root / "dist/artifacts/demos").exists())
        self.assertIn("Content-Security-Policy: " + build_site.DEMO_CSP,
                      (self.output / "_headers").read_text(encoding="utf-8"))

    def test_unconfigured_export_keeps_opaque_origin_but_allows_forms(self):
        report, data = self.export(screenshots="none")
        headers = (self.output / "_headers").read_text(encoding="utf-8")
        artifact_headers = headers.split("/artifacts/*\n", 1)[1].split("\n/", 1)[0]
        self.assertIn("allow-forms", artifact_headers)
        self.assertNotIn("allow-same-origin", artifact_headers)
        self.assertTrue(data["results"][0]["artifact"]["url"].startswith("/artifacts/"))
        self.assertIsNone(report["artifact_origin"])
        self.assertIsNone(report["artifact_output"])
        self.assertEqual(report["artifact_files"], 0)

    def test_share_pages_have_canonical_metadata_and_plain_viewer_link(self):
        report, data = self.export(screenshots="none")
        row = data["results"][0]
        self.assertEqual(row["share_url"], "/share/Model%20One/01-fluid-simulation/")
        source, document = self.share_document(row)
        canonical = "https://trial-by-pyro.netlify.app" + row["share_url"]
        self.assertEqual(document.metadata["og:url"], canonical)
        self.assertIn(("link", {"rel": "canonical", "href": canonical}), document.tags)
        self.assertIn("Display name", document.metadata["og:title"])
        self.assertIn("Fluid", document.metadata["og:title"])
        self.assertIn("Interactive fluid.", document.metadata["og:description"])
        self.assertEqual(document.metadata["og:type"], "website")
        self.assertEqual(document.metadata["og:site_name"], "Trial - a Vibe Benchmark")
        self.assertEqual(document.metadata["twitter:card"], "summary")
        self.assertEqual(document.metadata["twitter:title"], document.metadata["og:title"])
        self.assertEqual(document.metadata["twitter:description"], document.metadata["og:description"])
        self.assertFalse(any(key and "image" in key for key in document.metadata))
        viewer = "/#play/Model%20One/01-fluid-simulation"
        self.assertIn(viewer, [attrs.get("href") for tag, attrs in document.tags if tag == "a"])
        redirect = re.search(r"location\.replace\((.+?)\);", source)
        self.assertIsNotNone(redirect)
        self.assertEqual(json.loads(redirect.group(1)), viewer)
        self.assertFalse(any(attrs.get("http-equiv", "").lower() == "refresh" for _, attrs in document.tags))
        self.assertNotIn("/share/", (self.output / "_redirects").read_text(encoding="utf-8"))
        self.assertLess(len(source.encode("utf-8")), 4096)
        self.assertEqual(report["html_files"], 1)
        self.assertEqual(len(list((self.output / "artifacts").rglob("*.html"))), 1)
        self.assertEqual(self.resolve_url(row["artifact"]["url"]).read_bytes(), self.html)

    def test_share_pages_use_alternate_origin_and_existing_screenshot(self):
        settings = json.loads(self.model_settings)
        settings["siteUrl"] = "https://builds.example.test:8443/"
        (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")
        image = b"\x89PNG\r\n\x1a\nOriginal screenshot bytes."
        (self.run / "screenshot.png").write_bytes(image)
        with mock.patch.object(build_site, "pillow_modules", return_value=None):
            _, data = self.export()
        row = data["results"][0]
        _, document = self.share_document(row)
        origin = "https://builds.example.test:8443"
        self.assertEqual(document.metadata["og:url"], origin + row["share_url"])
        self.assertEqual(document.metadata["og:image"], origin + row["artifact"]["screenshot_url"])
        self.assertEqual(document.metadata["twitter:image"], document.metadata["og:image"])
        self.assertEqual(document.metadata["twitter:card"], "summary_large_image")
        self.assertIn("Display name", document.metadata["og:image:alt"])
        self.assertIn("Fluid", document.metadata["twitter:image:alt"])
        self.assertEqual(self.resolve_url(row["artifact"]["screenshot_url"]).read_bytes(), image)
        self.assertFalse(any(path.suffix in {".png", ".webp", ".jpg"} for path in (self.output / "share").rglob("*")))

    def test_share_pages_escape_labels_titles_and_component_paths(self):
        original_name = self.run.name
        model_name = "Model ' & #"
        model_folder = self.run.parent.with_name(model_name)
        self.run.parent.rename(model_folder)
        self.run = model_folder / original_name
        run_name = original_name + " ' & #"
        self.run.rename(model_folder / run_name)
        self.run = model_folder / run_name
        dangerous_label = 'Model "><img src=x onerror=alert(1)> & </script>'
        dangerous_title = 'Fluid </title><script>alert("title")</script>'
        settings = {"models": [{"key": model_name, "label": dangerous_label}]}
        (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")
        catalog_path = self.root / "prompts/catalog.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        catalog[0]["title"] = dangerous_title
        catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
        _, data = self.export(screenshots="none")
        row = data["results"][0]
        encoded = "/".join(quote(part, safe="") for part in (model_name, run_name))
        self.assertEqual(row["share_url"], "/share/" + encoded + "/")
        source, document = self.share_document(row)
        self.assertIn(dangerous_label, document.metadata["og:title"])
        self.assertIn(dangerous_title, document.metadata["og:title"])
        self.assertEqual(sum(tag == "script" for tag, _ in document.tags), 1)
        self.assertFalse(any(tag == "img" or "onerror" in attrs for tag, attrs in document.tags))
        script = re.search(r"<script>(.*?)</script>", source, flags=re.DOTALL).group(1)
        argument = re.search(r"location\.replace\((.+?)\);", script).group(1)
        self.assertEqual(json.loads(argument), "/#play/" + encoded)
        self.assertEqual(source.count("</script>"), 1)

    def test_share_origin_rejects_unsafe_values_before_replacing_output(self):
        self.export(screenshots="none")
        previous = (self.output / "api/data.json").read_bytes()
        unsafe = ["javascript:alert(1)", "//example.test", "https://user:secret@example.test",
                  "https://example.test/path", "https://example.test?token=secret", "https://example.test#fragment",
                  "https://example.test?", "https://example.test#", "https://example.test\\@evil.test",
                  "https://example.test:99999", "https://example.test\n", "", 42, []]
        for value in unsafe:
            with self.subTest(siteUrl=value):
                settings = {"siteUrl": value, "models": []}
                (self.root / "gallery/static/appsettings.json").write_text(json.dumps(settings), encoding="utf-8")
                with self.assertRaises(ValueError):
                    build_site.build_site(self.root, screenshots="none")
                self.assertEqual((self.output / "api/data.json").read_bytes(), previous)

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
        _, document = self.share_document(data["results"][0])
        self.assertTrue(document.metadata["og:image"].endswith("/screenshot.webp"))


class DeployScriptTests(unittest.TestCase):
    """Run both wrappers against a fake CLI; these tests cannot upload anything."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "package"
        (self.root / "tools").mkdir(parents=True)
        (self.root / "tools/build_site.py").write_text('''import json, os, sys
from pathlib import Path
Path(os.environ["FAKE_BUILD_LOG"]).write_text(json.dumps(sys.argv[1:]), encoding="utf-8")
for directory in ("dist/site", "dist/artifacts"):
    Path(directory).mkdir(parents=True, exist_ok=True)
Path("dist/artifacts/check.html").write_bytes(b"original artifact bytes")
print("Fixture build completed.")
''', encoding="utf-8")
        shutil.copytree(ROOT / "scripts", self.root / "scripts")
        shutil.copy2(ROOT / "netlify.toml", self.root / "netlify.toml")
        fakebin = self.root / "fakebin"
        fakebin.mkdir()
        fake = fakebin / "fake_cli.py"
        fake.write_text('''import json, os, sys, tomllib
from pathlib import Path
with Path(os.environ["FAKE_CLI_LOG"]).open("a", encoding="utf-8") as log:
    log.write(json.dumps({"args": sys.argv[1:], "ci": os.environ.get("CI"), "cwd": str(Path.cwd())}) + "\\n")
if sys.argv[1] == "status":
    print(os.environ["FAKE_CLI_STATUS"])
    sys.exit(int(os.environ["FAKE_CLI_STATUS_EXIT"]))
if sys.argv[1] == "sites:list":
    print(os.environ["FAKE_CLI_SITES"])
    sys.exit(0)
if sys.argv[1] != "deploy":
    sys.exit("Unexpected fake CLI command")
if "--config" in sys.argv:
    sys.exit("Unknown option --config")
if "--alias" in sys.argv:
    deploy_dir = Path(sys.argv[sys.argv.index("--dir") + 1])
    publish = tomllib.loads(Path("netlify.toml").read_text(encoding="utf-8"))["build"]["publish"]
    if Path(publish).resolve() != deploy_dir.resolve():
        sys.exit("Artifact deploy would inherit headers from a different publish directory")
    if (deploy_dir / "check.html").read_bytes() != b"original artifact bytes":
        sys.exit("Staged artifact bytes changed")
    sys.exit(int(os.environ["FAKE_CLI_ARTIFACT_EXIT"]))
print('{"deploy_url":"https://example.invalid"}')
''', encoding="utf-8")
        # Both shims intentionally coexist: PowerShell must select the native launcher for its OS.
        (fakebin / "netlify.cmd").write_text(f'@echo off\n"{sys.executable}" "{fake}" %*\n', encoding="utf-8")
        shim = fakebin / "netlify"
        shim.write_text(f'#!/bin/sh\nexec "{Path(sys.executable).as_posix()}" "{fake.as_posix()}" "$@"\n', encoding="utf-8")
        shim.chmod(0o755)
        self.log = self.root / "cli-calls.jsonl"
        self.build_log = self.root / "build-args.json"
        self.env = dict(os.environ, PATH=str(fakebin) + os.pathsep + os.environ["PATH"], PYTHON=sys.executable,
                        FAKE_CLI_LOG=str(self.log), FAKE_CLI_STATUS_EXIT="1",
                        FAKE_BUILD_LOG=str(self.build_log), FAKE_CLI_ARTIFACT_EXIT="0",
                        FAKE_CLI_SITES=json.dumps([{"id": "existing-site", "name": "trial-by-pyro"}]),
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
        self.build_log.unlink(missing_ok=True)
        result = subprocess.run(command + arguments, cwd=self.root, env=self.env,
                                capture_output=True, text=True, timeout=25)
        calls = [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []
        return result, calls

    def configure_artifact_origin(self, origin="https://builds--trial-by-pyro.netlify.app"):
        settings = self.root / "gallery/static/appsettings.json"
        settings.parent.mkdir(parents=True, exist_ok=True)
        settings.write_text(json.dumps({"artifactOrigin": origin}), encoding="utf-8")

    def test_split_production_uploads_artifact_alias_before_gallery_only_production(self):
        self.configure_artifact_origin()
        for name, command in self.shells:
            arguments = ["-SiteId", "existing-site", "-Production"] if name == "powershell" else ["--site-id", "existing-site", "--prod"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                self.assertEqual([call["args"][0] for call in calls], ["status", "sites:list", "deploy", "deploy"])
                artifact, gallery = [call["args"] for call in calls if call["args"][0] == "deploy"]
                self.assertEqual(artifact[artifact.index("--dir") + 1], "public")
                self.assertEqual(artifact[artifact.index("--alias") + 1], "builds")
                self.assertEqual(artifact[artifact.index("--site") + 1], "existing-site")
                self.assertNotIn("--config", artifact)
                self.assertNotIn("--prod", artifact)
                self.assertEqual(gallery[gallery.index("--dir") + 1], "dist/site")
                self.assertIn("--prod", gallery)
                self.assertNotIn("--alias", gallery)
                self.assertNotIn("--config", gallery)
                self.assertNotEqual(Path(calls[-2]["cwd"]), self.root)
                self.assertFalse(Path(calls[-2]["cwd"]).exists(), "Artifact staging must be cleaned up")
                self.assertEqual(Path(calls[-1]["cwd"]), self.root)

    def test_split_draft_uses_separate_artifact_alias_and_build_origin(self):
        self.configure_artifact_origin()
        for name, command in self.shells:
            arguments = ["-SiteId", "existing-site"] if name == "powershell" else ["--site-id", "existing-site"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                deploys = [call["args"] for call in calls if call["args"][0] == "deploy"]
                self.assertEqual(len(deploys), 2)
                self.assertEqual(deploys[0][deploys[0].index("--dir") + 1], "public")
                self.assertEqual(deploys[0][deploys[0].index("--alias") + 1], "builds-preview")
                self.assertNotIn("--config", deploys[0])
                self.assertEqual(deploys[1][deploys[1].index("--dir") + 1], "dist/site")
                self.assertNotIn("--config", deploys[1])
                self.assertTrue(all("--prod" not in deploy for deploy in deploys))
                build_args = json.loads(self.build_log.read_text(encoding="utf-8"))
                self.assertEqual(build_args[build_args.index("--artifact-origin") + 1], "https://builds-preview--trial-by-pyro.netlify.app")

    def test_split_origin_must_match_existing_target_before_build_or_upload(self):
        self.configure_artifact_origin()
        self.env["FAKE_CLI_SITES"] = json.dumps([{"id": "existing-site", "name": "different-site"}])
        for name, command in self.shells:
            arguments = ["-SiteId", "existing-site"] if name == "powershell" else ["--site-id", "existing-site"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("artifactOrigin", result.stderr + result.stdout)
                self.assertFalse(any(call["args"][0] == "deploy" for call in calls))
                self.assertFalse(self.build_log.exists())

    def test_split_new_site_requires_linking_an_existing_target(self):
        self.configure_artifact_origin()
        for name, command in self.shells:
            arguments = ["-SiteName", "trial-by-pyro"] if name == "powershell" else ["--site-name", "trial-by-pyro"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("existing site", result.stderr + result.stdout)
                self.assertFalse(any(call["args"][0] == "deploy" for call in calls))
                self.assertFalse(self.build_log.exists())

    def test_failed_artifact_upload_aborts_gallery_upload(self):
        self.configure_artifact_origin()
        self.env["FAKE_CLI_ARTIFACT_EXIT"] = "17"
        for name, command in self.shells:
            arguments = ["-SiteId", "existing-site", "-Production"] if name == "powershell" else ["--site-id", "existing-site", "--prod"]
            with self.subTest(shell=name):
                result, calls = self.invoke(command, arguments)
                self.assertNotEqual(result.returncode, 0)
                deploys = [call["args"] for call in calls if call["args"][0] == "deploy"]
                self.assertEqual(len(deploys), 1)
                self.assertEqual(deploys[0][deploys[0].index("--dir") + 1], "public")
                self.assertNotIn("--prod", deploys[0])
                self.assertFalse(Path(calls[-1]["cwd"]).exists(), "Failed artifact staging must be cleaned up")

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
