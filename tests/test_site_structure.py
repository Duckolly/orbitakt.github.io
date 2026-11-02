"""Regression tests for the GitHub Pages site without third-party dependencies."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import unittest

ROOT = Path(__file__).resolve().parents[1]
PAGES = (ROOT / 'index.html', ROOT / 'privacy.html', ROOT / 'support.html')


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.resources = []
        self.ids = set()
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if 'id' in values:
            self.ids.add(values['id'])
        if tag in {'a', 'link', 'img', 'script'}:
            key = 'href' if tag in {'a', 'link'} else 'src'
            if key in values:
                self.resources.append((tag, values[key]))
                if tag == 'script':
                    self.scripts.append(values[key])


class SiteStructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = {}
        for page in PAGES:
            html = page.read_text(encoding='utf-8')
            parser = PageParser()
            parser.feed(html)
            cls.pages[page] = (html, parser)

    def test_index_at_deployment_root(self):
        self.assertTrue((ROOT / 'index.html').is_file())
        self.assertTrue((ROOT / '.nojekyll').exists())

    def test_local_links_exist(self):
        for page, (_, parser) in self.pages.items():
            for tag, url in parser.resources:
                with self.subTest(page=page.name, tag=tag, url=url):
                    parts = urlsplit(url)
                    if parts.scheme or parts.netloc:
                        continue
                    self.assertFalse(parts.path.startswith('/'), url)
                    target = (page.parent / unquote(parts.path)).resolve() if parts.path else page
                    self.assertTrue(target.is_relative_to(ROOT), url)
                    self.assertTrue(target.is_file() or (target.is_dir() and (target/'index.html').is_file()), url)
                    if parts.fragment and target in self.pages:
                        self.assertIn(unquote(parts.fragment), self.pages[target][1].ids, url)

    def test_diagnostics_loaded_on_every_page(self):
        for page, (html, parser) in self.pages.items():
            with self.subTest(page=page.name):
                self.assertEqual(1, parser.scripts.count('assets/diagnostics.js'))
                self.assertLess(html.index('assets/diagnostics.js'), html.index('assets/style.css'))

    def test_support_controls_exist(self):
        ids = self.pages[ROOT/'support.html'][1].ids
        for required in ['export-diagnostics', 'clear-diagnostics', 'diagnostics-status', 'copy-report']:
            self.assertIn(required, ids)
        self.assertIn('assets/support.js', self.pages[ROOT/'support.html'][1].scripts)

    def test_privacy_discloses_local_logging(self):
        html = self.pages[ROOT/'privacy.html'][0]
        self.assertIn('localStorage', html)
        self.assertIn('100 диагностических событий', html)
        self.assertIn('не передаётся разработчику автоматически', html)

    def test_png_file_signatures(self):
        for path in (ROOT/'assets').glob('*.png'):
            with self.subTest(file=path.name):
                self.assertEqual(b'\x89PNG\r\n\x1a\n', path.read_bytes()[:8])


if __name__ == '__main__':
    unittest.main()
