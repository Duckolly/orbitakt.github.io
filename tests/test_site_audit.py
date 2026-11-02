import tempfile
import unittest
from pathlib import Path
from tools.site_audit_fix import main


class SiteAuditTests(unittest.TestCase):
    def test_fixes_root_file_referenced_under_assets(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'index.html').write_text('<link href="assets/style.css"><img src="assets/home-light.png">', encoding='utf8')
            (root / 'style.css').write_text('body{}', encoding='utf8')
            (root / 'home-light.png').write_bytes(b'png-placeholder')
            self.assertEqual(1, main([str(root), '--check']))
            self.assertEqual(0, main([str(root), '--fix']))
            self.assertEqual(0, main([str(root), '--check']))
            html = (root / 'index.html').read_text(encoding='utf8')
            self.assertIn('href="style.css"', html)
            self.assertIn('src="home-light.png"', html)
            self.assertTrue((root / 'index.html.bak').exists())

    def test_does_not_rewrite_valid_assets(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'assets').mkdir()
            (root / 'index.html').write_text('<link href="assets/style.css">', encoding='utf8')
            (root / 'assets' / 'style.css').write_text('body{}', encoding='utf8')
            self.assertEqual(0, main([str(root), '--check']))

    def test_handles_project_root_url(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'index.html').write_text('<script src="/main.js"></script>', encoding='utf8')
            (root / 'main.js').write_text('alert(1)', encoding='utf8')
            self.assertEqual(1, main([str(root), '--check']))
            self.assertEqual(0, main([str(root), '--fix']))
            self.assertIn('src="main.js"', (root / 'index.html').read_text(encoding='utf8'))

    def test_nested_page_can_reference_root_using_repo_prefix(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'index.html').write_text('<a href="docs/page.html">Docs</a>', encoding='utf8')
            (root / 'docs').mkdir()
            (root / 'docs' / 'page.html').write_text('<img src="/dvizhoff/logo.png">', encoding='utf8')
            (root / 'logo.png').write_bytes(b'png-placeholder')
            self.assertEqual(0, main([str(root), '--check']))

    def test_css_url_missing_asset(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'index.html').write_text('<link href="style.css">', encoding='utf8')
            (root / 'style.css').write_text('body{background:url("assets/bg.png")}', encoding='utf8')
            (root / 'bg.png').write_bytes(b'png-placeholder')
            self.assertEqual(1, main([str(root), '--check']))
            self.assertEqual(0, main([str(root), '--fix']))
            self.assertEqual(0, main([str(root), '--check']))

    def test_detects_unknown_missing_file(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / 'index.html').write_text('<img src="missing.png">', encoding='utf8')
            self.assertEqual(1, main([str(root), '--check']))
            self.assertEqual(1, main([str(root), '--fix']))


if __name__ == '__main__':
    unittest.main()
