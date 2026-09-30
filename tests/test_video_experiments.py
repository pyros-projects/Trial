"""Video publication remains separate from HTML runs and exposes only declared files."""
from __future__ import annotations

import copy
import json
import re
import stat
import sys
import tempfile
import threading
import unittest
from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
from urllib.error import HTTPError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from gallery import server
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


class VideoExperimentTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / "package"
        self.videos = self.root / "videos"
        self.prompt = self.videos / "one-take/prompt.md"
        self.prompt.parent.mkdir(parents=True)
        self.prompt_bytes = b'# Original prompt\r\nKeep these exact bytes.\n'
        self.prompt.write_bytes(self.prompt_bytes)
        self.catalog = [{
            "id": "one-take", "title": "One take", "description": "A recorded experiment.",
            "look_for": "Look at the motion.", "format": "Recorded video",
            "internal_note": "PRIVATE-CATALOG",
            "videos": [{"youtube_id": "O8_O6q4zivw", "model_key": "video_only",
                        "title": "A recorded result", "setting": "xhigh", "duration": "7:00",
                        "private_note": "PRIVATE-VIDEO"},
                       {"youtube_id": "724PehuxQtI", "model_key": "html_model"}],
        }]
        self.write_catalog(self.catalog)
        self.static = self.root / "gallery/static"
        self.static.mkdir(parents=True)
        for name in build_site.STATIC_FILES:
            (self.static / name).write_bytes(b"Static fixture")
        (self.static / "appsettings.json").write_text(json.dumps({
            "siteUrl": "https://trial.example.test", "models": [
                {"key": "video_only", "label": "Video Model"},
                {"key": "html_model", "label": "HTML Model"},
            ],
        }), encoding="utf-8")
        prompts = self.root / "prompts/01-fluid-simulation"
        prompts.mkdir(parents=True)
        for name in ("prompt.md", "acceptance.md"):
            (prompts / name).write_text("HTML task", encoding="utf-8")
        (prompts.parent / "catalog.json").write_text(json.dumps([
            {"id": "01-fluid-simulation", "title": "Fluid", "track": "html"},
        ]), encoding="utf-8")
        self.run = self.root / "results/html_model/01-fluid-simulation"
        self.run.mkdir(parents=True)
        self.html_bytes = b"<!doctype html><title>Original HTML build</title>"
        (self.run / "index.html").write_bytes(self.html_bytes)
        profile = self.root / "results/video_only/model.toml"
        profile.parent.mkdir()
        profile.write_text('provider = "Video Provider"\nprivate_note = "PRIVATE-PROFILE"\n', encoding="utf-8")
        self.output = self.root / "dist/site"

    def write_catalog(self, value):
        (self.videos / "catalog.json").write_text(json.dumps(value), encoding="utf-8")

    def export(self):
        report = build_site.build_site(self.root, screenshots="none")
        data = json.loads((self.output / "api/data.json").read_text(encoding="utf-8"))
        return report, data

    def local_state(self):
        for name, value in {"RESULTS_ROOT": self.root / "results", "STATIC_ROOT": self.static,
                            "CATALOG_PATH": self.root / "prompts/catalog.json", "VIDEOS_ROOT": self.videos}.items():
            patcher = mock.patch.object(server, name, value, create=True)
            patcher.start()
            self.addCleanup(patcher.stop)
        return server.GalleryState("http://127.0.0.1:9876")

    def start_http(self, state):
        service = server.QuietThreadingHTTPServer(("127.0.0.1", 0), server.make_gallery_handler(state))
        thread = threading.Thread(target=service.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(service.server_close)
        self.addCleanup(service.shutdown)
        return f"http://127.0.0.1:{service.server_address[1]}"

    def test_export_allowlists_video_metadata_and_prompts_without_changing_html_counts(self):
        (self.prompt.parent / "private.md").write_bytes(b"PRIVATE-EVIDENCE")
        (self.prompt.parent / "recording.mp4").write_bytes(b"PRIVATE-VIDEO-MEDIA")
        unlisted = self.videos / "unlisted/prompt.md"
        unlisted.parent.mkdir()
        unlisted.write_bytes(b"PRIVATE-UNLISTED")
        originals = {path: path.read_bytes() for path in self.videos.rglob("*") if path.is_file()}
        report, data = self.export()
        self.assertIn("video_experiments", data)
        experiment = data["video_experiments"][0]
        self.assertEqual(set(experiment), {"id", "title", "description", "look_for", "format", "videos", "prompt_url", "share_url"})
        self.assertEqual(experiment["prompt_url"], "/videos/one-take/prompt.md")
        self.assertEqual(experiment["share_url"], "/videos/one-take/")
        self.assertEqual(experiment["videos"][0], {
            "youtube_id": "O8_O6q4zivw", "model_key": "video_only", "title": "A recorded result",
            "setting": "xhigh", "duration": "7:00", "share_url": "/videos/one-take/O8_O6q4zivw/",
        })
        self.assertNotIn("title", experiment["videos"][1])
        self.assertEqual(data["summary"]["models"], 1)
        self.assertEqual(data["summary"]["runs"], 1)
        self.assertEqual(data["summary"]["tasks"], 1)
        self.assertEqual(len(data["results"]), 1)
        self.assertEqual([task["id"] for task in data["catalog"]], ["01-fluid-simulation"])
        self.assertEqual(data["model_profiles"]["video_only"], {"provider": "Video Provider"})
        self.assertEqual(report["html_files"], 1)
        self.assertEqual(report["video_experiments"], 1)
        self.assertEqual(report["videos"], 2)
        self.assertEqual(report["video_share_pages"], 4)
        self.assertEqual((self.output / "videos/one-take/prompt.md").read_bytes(), self.prompt_bytes)
        self.assertEqual((self.output / "artifacts/html_model/01-fluid-simulation/index.html").read_bytes(), self.html_bytes)
        self.assertEqual({path.relative_to(self.output / "videos").as_posix()
                          for path in (self.output / "videos").rglob("*") if path.is_file()}, {
            "index.html", "one-take/index.html", "one-take/prompt.md",
            "one-take/O8_O6q4zivw/index.html", "one-take/724PehuxQtI/index.html",
        })
        for path in self.output.rglob("*"):
            if path.is_file():
                self.assertNotIn(b"PRIVATE-", path.read_bytes(), path)
        for path, body in originals.items():
            self.assertEqual(path.read_bytes(), body)

    def test_share_metadata_is_escaped_and_opens_the_matching_video_route(self):
        dangerous = '\"><img src=x onerror=alert(1)> & </script>'
        self.catalog[0]["title"] = dangerous
        self.catalog[0]["description"] = dangerous
        self.catalog[0]["videos"][0]["title"] = dangerous
        self.write_catalog(self.catalog)
        self.export()
        for route, viewer, image in (
            ("/videos/", "/#videos", "https://i.ytimg.com/vi/O8_O6q4zivw/hqdefault.jpg"),
            ("/videos/one-take/", "/#videos/one-take", "https://i.ytimg.com/vi/O8_O6q4zivw/hqdefault.jpg"),
            ("/videos/one-take/O8_O6q4zivw/", "/#watch/one-take/O8_O6q4zivw", "https://i.ytimg.com/vi/O8_O6q4zivw/hqdefault.jpg"),
            ("/videos/one-take/724PehuxQtI/", "/#watch/one-take/724PehuxQtI", "https://i.ytimg.com/vi/724PehuxQtI/hqdefault.jpg"),
        ):
            with self.subTest(route=route):
                page = self.output / route.lstrip("/") / "index.html"
                self.assertTrue(page.is_file(), f"Missing video share page: {route}")
                source = page.read_text(encoding="utf-8")
                document = ShareDocument(source)
                self.assertEqual(document.metadata["og:url"], "https://trial.example.test" + route)
                self.assertEqual(document.metadata["og:image"], image)
                self.assertEqual(document.metadata["twitter:image"], image)
                self.assertIn(viewer, [attrs.get("href") for tag, attrs in document.tags if tag == "a"])
                script = re.search(r"<script>(.*?)</script>", source, re.DOTALL).group(1)
                self.assertEqual(json.loads(re.search(r"location\.replace\((.+?)\);", script).group(1)), viewer)
                self.assertEqual(source.count("</script>"), 1)
                self.assertFalse(any(tag == "img" or "onerror" in attrs for tag, attrs in document.tags))
                if route != "/videos/":
                    self.assertIn(dangerous, document.metadata["og:title"])

    def test_missing_video_catalog_remains_compatible_with_existing_exports(self):
        (self.videos / "catalog.json").unlink()
        report, data = self.export()
        self.assertEqual(data.get("video_experiments"), [])
        self.assertEqual(report["video_experiments"], 0)
        self.assertEqual(report["videos"], 0)
        self.assertEqual(data["summary"]["runs"], 1)
        source = (self.output / "videos/index.html").read_text(encoding="utf-8")
        document = ShareDocument(source)
        self.assertNotIn("og:image", document.metadata)
        self.assertIn('/#videos', source)

    def test_video_share_title_identifies_the_model_even_with_a_recording_title(self):
        self.export()
        for youtube_id, title in (
            ("O8_O6q4zivw", "Video Model: A recorded result | Trial Video lab"),
            ("724PehuxQtI", "HTML Model: One take | Trial Video lab"),
        ):
            page = self.output / "videos/one-take" / youtube_id / "index.html"
            document = ShareDocument(page.read_text(encoding="utf-8"))
            self.assertEqual(document.metadata["og:title"], title)
            self.assertEqual(document.metadata["twitter:title"], title)

    def test_invalid_catalog_fails_before_replacing_an_existing_export(self):
        self.export()
        before = {path.relative_to(self.output): path.read_bytes() for path in self.output.rglob("*") if path.is_file()}
        invalid = [None, {}, [None], [{**self.catalog[0], "id": "../private"}],
                   [{**self.catalog[0], "id": "Uppercase"}], [self.catalog[0], self.catalog[0]],
                   [{**self.catalog[0], "title": ""}], [{**self.catalog[0], "description": "x" * 4001}],
                   [{**self.catalog[0], "look_for": "bad\x00text"}], [{**self.catalog[0], "videos": []}]]
        for field, value in [("youtube_id", "../../secret"), ("youtube_id", "short"), ("youtube_id", 123),
                             ("model_key", ""), ("model_key", "../private"), ("model_key", "x\\private"),
                             ("title", "x" * 201), ("setting", "x" * 101), ("duration", "1:99"),
                             ("duration", "7:0"), ("duration", 7)]:
            case = copy.deepcopy(self.catalog)
            case[0]["videos"][0][field] = value
            invalid.append(case)
        duplicate = copy.deepcopy(self.catalog)
        duplicate[0]["videos"].append(duplicate[0]["videos"][0])
        invalid.append(duplicate)
        case_collision = copy.deepcopy(self.catalog)
        case_collision[0]["videos"].append({
            "youtube_id": "o8_o6q4zivw", "model_key": "video_only",
        })
        invalid.append(case_collision)
        for case in invalid:
            with self.subTest(case=case):
                self.write_catalog(case)
                with self.assertRaisesRegex(ValueError, "[Vv]ideo"):
                    self.export()
        (self.videos / "catalog.json").write_bytes(b'{broken')
        with self.assertRaisesRegex(ValueError, "[Vv]ideo"):
            self.export()
        (self.videos / "catalog.json").write_bytes(b' ' * (1024 * 1024 + 1))
        with self.assertRaisesRegex(ValueError, "[Vv]ideo"):
            self.export()
        after = {path.relative_to(self.output): path.read_bytes() for path in self.output.rglob("*") if path.is_file()}
        self.assertEqual(after, before)

    def test_prompts_must_be_regular_files_and_reparse_points_are_rejected(self):
        original_lstat = Path.lstat
        for target in (self.videos, self.videos / "catalog.json", self.prompt.parent, self.prompt):
            def reparse_lstat(path, *args, **kwargs):
                info = original_lstat(path, *args, **kwargs)
                if path == target:
                    return SimpleNamespace(st_mode=info.st_mode, st_size=info.st_size,
                                           st_file_attributes=stat.FILE_ATTRIBUTE_REPARSE_POINT)
                return info
            with self.subTest(target=target), mock.patch.object(Path, "lstat", reparse_lstat):
                with self.assertRaisesRegex(ValueError, "[Vv]ideo"):
                    self.export()
        self.prompt.unlink()
        with self.assertRaisesRegex(ValueError, "[Vv]ideo"):
            self.export()
        self.prompt.mkdir()
        with self.assertRaisesRegex(ValueError, "[Vv]ideo"):
            self.export()

    def test_local_data_uses_the_same_allowlist_and_only_declared_prompt_routes_are_served(self):
        state = self.local_state()
        base = self.start_http(state)
        with urlopen(base + "/api/data") as response:
            local = json.load(response)
        _, public = self.export()
        self.assertIn("video_experiments", local)
        self.assertEqual(local["video_experiments"], public["video_experiments"])
        self.assertEqual(local["model_profiles"]["video_only"], {"provider": "Video Provider"})
        (self.prompt.parent / "private.md").write_text("PRIVATE", encoding="utf-8")
        unlisted = self.videos / "unlisted/prompt.md"
        unlisted.parent.mkdir()
        unlisted.write_text("PRIVATE", encoding="utf-8")
        with urlopen(base + "/videos/one-take/prompt.md") as response:
            self.assertEqual(response.read(), self.prompt_bytes)
            self.assertEqual(response.headers.get_content_type(), "text/plain")
        for path in ("/videos/catalog.json", "/videos/one-take/private.md", "/videos/unlisted/prompt.md",
                     "/videos/one-take/%2e%2e/catalog.json", "/videos/", "/videos/one-take/"):
            with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                urlopen(base + path)
            self.assertEqual(error.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
