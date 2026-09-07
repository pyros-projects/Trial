"""Model profiles are optional public setup notes, separate from run metadata."""
from __future__ import annotations

import json
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from gallery import server


class ModelProfileTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.results = Path(temporary.name) / "results"
        self.model = self.results / "Model One"
        self.run = self.model / "01-fluid-simulation-001"
        self.run.mkdir(parents=True)
        (self.run / "index.html").write_text("<!doctype html><title>Profile fixture</title>", encoding="utf-8")
        self.path = self.model / "model.toml"
        patch = mock.patch.object(server, "RESULTS_ROOT", self.results)
        patch.start()
        self.addCleanup(patch.stop)
        self.state = server.GalleryState("http://127.0.0.1:8766")

    def write_profile(self, **fields):
        self.path.write_text("\n".join(f"{key} = {json.dumps(value, ensure_ascii=True)}" for key, value in fields.items()), encoding="utf-8")

    def profiles(self):
        return server.load_model_profiles(self.results, [self.model.name])

    def test_model_profiles_allowlist_and_refresh_without_changing_run_identity(self):
        self.assertEqual(self.state.data()["model_profiles"], {})
        fields = {"provider": " Provider <Example> ", "provider_url": "https://provider.example/products",
                  "harness": "Tool harness", "harness_url": "https://harness.example/", "setting": "Thinking: high"}
        self.write_profile(**fields, label="PRIVATE-LABEL", color="#badbad", order=1, notes="PRIVATE-NOTE")
        (self.run / "model.toml").write_text('provider = "PRIVATE-RUN-PROFILE"', encoding="utf-8")
        payload = self.state.data()
        self.assertEqual(payload["model_profiles"], {"Model One": {**fields, "provider": "Provider <Example>"}})
        self.assertEqual(payload["results"][0]["model"], "Model One")
        self.assertNotIn("model_profile", payload["results"][0])
        self.write_profile(harness="Replacement harness")
        self.assertEqual(self.state.data()["model_profiles"], {"Model One": {"harness": "Replacement harness"}})
        self.path.unlink()
        self.assertEqual(self.state.data()["model_profiles"], {})

    def test_model_profiles_ignore_missing_malformed_non_string_and_nested_config(self):
        for content in (b"", b'provider = "unterminated', b"\xff", b'provider = true\nharness = 7\nsetting = ["high"]',
                        b'[profile]\nprovider = "PRIVATE-NESTED"', b'provider = "one"\nprovider = "two"'):
            with self.subTest(content=content):
                self.path.write_bytes(content)
                self.assertEqual(self.profiles(), {})
        self.path.unlink()
        self.assertEqual(self.profiles(), {})
        self.path.mkdir()
        self.assertEqual(self.profiles(), {})

    def test_model_profiles_bound_strings_and_reject_control_characters(self):
        self.write_profile(provider="P" * 200, harness="H" * 200, setting="S" * 500)
        self.assertEqual(self.profiles()["Model One"]["setting"], "S" * 500)
        for value in ("P" * 201, "line\nbreak", "tab\tlabel", "hidden\u0085control", "bidi\u202econtrol", "   "):
            with self.subTest(value=value):
                self.write_profile(provider=value, provider_url="https://provider.example/", setting="S" * 501)
                self.assertEqual(self.profiles(), {})

    def test_model_profiles_urls_require_labels_and_safe_http_links(self):
        self.write_profile(provider_url="https://provider.example/", harness=" ", harness_url="https://harness.example/", setting="High")
        self.assertEqual(self.profiles(), {"Model One": {"setting": "High"}})
        for url in ("https://provider.example/home?q=info#overview", "http://example.test:8080/"):
            with self.subTest(url=url):
                self.write_profile(provider="Provider", provider_url=url)
                self.assertEqual(self.profiles()["Model One"]["provider_url"], url)
        for url in ("javascript:alert(1)", "data:text/html,x", "//example.test/", "/about", "ftp://example.test/",
                    "https://", "https://user:secret@example.test/", "https://user@example.test/",
                    "https://example.test\n/", "https://example.test/with space", "https://example.test\\path",
                    "https://example.test:99999/", "https://example.test:invalid/", "https://example.test/" + "x" * 2048):
            with self.subTest(url=url):
                self.write_profile(provider="Provider", provider_url=url, harness="Harness", harness_url=url)
                self.assertEqual(self.profiles(), {"Model One": {"provider": "Provider", "harness": "Harness"}})

    def test_model_profiles_skip_oversized_unreadable_and_linked_paths(self):
        self.path.write_bytes(b"#" + b"x" * (16 * 1024) + b'\nprovider = "Oversized"')
        with mock.patch.object(Path, "open", side_effect=AssertionError("Oversized profile must not be opened")):
            self.assertEqual(self.profiles(), {})
        self.write_profile(provider="Provider")
        with mock.patch.object(Path, "open", side_effect=PermissionError("Unreadable fixture")):
            self.assertEqual(self.profiles(), {})
        for kind in ("is_symlink", "is_junction"):
            for blocked in (self.results, self.model, self.path):
                with self.subTest(kind=kind, blocked=str(blocked)):
                    with mock.patch.object(Path, kind, lambda path: path == blocked, create=True):
                        with mock.patch.object(Path, "open", side_effect=AssertionError("Linked profile must not be opened")):
                            self.assertEqual(self.profiles(), {})

    def test_model_profiles_do_not_publish_models_without_inventory_rows(self):
        self.write_profile(provider="Provider")
        (self.run / "index.html").unlink()
        self.assertEqual(self.state.data()["model_profiles"], {})

    def test_model_profiles_reject_reparse_points_without_is_junction(self):
        self.write_profile(provider="Provider")
        original_lstat = Path.lstat
        for blocked in (self.results, self.model, self.path):
            with self.subTest(blocked=str(blocked)):
                def reparse_lstat(path, *args, **kwargs):
                    result = original_lstat(path, *args, **kwargs)
                    if path != blocked:
                        return result
                    attributes = {name: getattr(result, name) for name in dir(result) if name.startswith("st_")}
                    attributes["st_file_attributes"] = getattr(result, "st_file_attributes", 0) | stat.FILE_ATTRIBUTE_REPARSE_POINT
                    return SimpleNamespace(**attributes)

                with mock.patch.object(Path, "is_junction", new_callable=mock.PropertyMock, side_effect=AttributeError, create=True):
                    self.assertFalse(hasattr(self.path, "is_junction"))
                    with mock.patch.object(Path, "lstat", reparse_lstat):
                        with mock.patch.object(Path, "open", side_effect=AssertionError("Reparse profile must not be opened")):
                            self.assertEqual(self.profiles(), {})


if __name__ == "__main__":
    unittest.main()
