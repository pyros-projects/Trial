"""Exercise real filesystem source snapshots and URL validation."""
import importlib.util
import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'gallery'))

class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def module(self):
        self.assertTrue((ROOT / 'gallery/projects.py').is_file(), 'Source-project support has not been implemented')
        import projects
        return projects

    def make_project(self):
        p = self.root / 'a'
        p.mkdir()
        (p / 'README.md').write_text('A real source snapshot\n')
        (p / 'server.py').write_text('print("source archive")\n')
        return p

    def test_digest_changes_with_content_and_paths(self):
        module = self.module()
        p = self.make_project()
        first = module.project_summary(p)
        self.assertEqual(first['file_count'], 2)
        self.assertEqual(first['sha256'], module.project_summary(p)['sha256'])
        (p / 'server.py').write_text('print("changed source")\n')
        second = module.project_summary(p)
        self.assertNotEqual(first['sha256'], second['sha256'])
        (p / 'server.py').rename(p / 'app.py')
        self.assertNotEqual(second['sha256'], module.project_summary(p)['sha256'])

    def test_dependencies_runtime_secrets_and_symlinks_excluded(self):
        module = self.module()
        p = self.make_project()
        before = module.project_summary(p)
        for d in ('node_modules', '.git', '.venv', 'data', '__pycache__'):
            (p / d).mkdir()
            (p / d / 'untracked').write_text('not authored source')
        (p / '.env').write_text('SECRET=not-for-download')
        (p / 'state.sqlite').write_bytes(b'not source')
        outside = self.root / 'outside.txt'
        outside.write_text('outside secret')
        try:
            (p / 'escape.txt').symlink_to(outside)
        except OSError:
            pass
        self.assertEqual(before, module.project_summary(p))
        data = module.project_zip(p)
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            self.assertEqual(set(z.namelist()), {'README.md', 'server.py'})
            self.assertEqual(z.read('server.py'), (p / 'server.py').read_bytes())

    def test_sqlite_wal_and_shared_memory_are_not_source(self):
        module = self.module()
        p = self.make_project()
        before = module.project_summary(p)
        for suffix in ('.db-wal', '.db-shm', '.sqlite-wal', '.sqlite-shm', '.sqlite3-wal', '.sqlite3-shm'):
            (p / ('state' + suffix)).write_bytes(b'private runtime state')
        self.assertEqual(before, module.project_summary(p))

    def test_only_explicit_loopback_preview_urls_accepted(self):
        module = self.module()
        for value in ('http://127.0.0.1:8811/', 'http://localhost:8812/app', 'http://[::1]:8813/'):
            with self.subTest(url=value):
                self.assertEqual(module.validate_preview_url(value), value)
        for value in ('javascript:alert(1)', 'https://example.com:443/', 'http://0.0.0.0:8000/',
                      'http://localhost/', 'http://user:pass@localhost:8000/',
                      'http://localhost.evil.test:8000/', 'file:///tmp/index.html', 'http://127.0.0.1:99999/'):
            with self.subTest(url=value):
                with self.assertRaises(ValueError):
                    module.validate_preview_url(value)

if __name__ == '__main__':
    unittest.main()
