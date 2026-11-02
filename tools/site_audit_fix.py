#!/usr/bin/env python3
"""Audit relative asset links for static GitHub Pages project sites.

By default the script only reports problems. --fix changes only high-confidence
links and prints remaining unresolved paths. No third-party dependencies.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ATTR = re.compile(r'(?P<head>\b(?:href|src|poster|data-src)\s*=\s*)(?P<quote>["\'])(?P<value>.*?)(?P=quote)', re.I | re.S)
CSS_URL = re.compile(r'(?P<head>url\(\s*)(?P<quote>["\']?)(?P<value>[^)"\']+)(?P=quote)(?P<tail>\s*\))', re.I)
IGNORED_DIRS = {'.git', '.venv', 'venv', 'node_modules', '__pycache__', 'dist', 'build'}
PREFIXES = ('assets/', 'img/', 'images/', 'css/', 'styles/', 'static/')


def is_external(raw: str) -> bool:
    v = raw.strip()
    return (not v or v.startswith(('#', '//', '?')) or
            bool(re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', v)))


def pathname(raw: str) -> str:
    return unquote(urlsplit(raw.strip()).path).replace('\\', '/')


def static_target(root: Path, source: Path, path: str, repo: str) -> tuple[Path, bool]:
    """Return resolved target and flag broken domain-root links on project Pages."""
    if path.startswith(f'/{repo}/'):
        base = root
        path = path[len(repo) + 2:]
        bad_root = False
    elif path.startswith('/'):
        base = root
        path = path.lstrip('/')
        bad_root = True
    else:
        base = source.parent
        bad_root = False
    if not path or path.endswith('/'):
        path += 'index.html'
    return (base / path).resolve(), bad_root


def exists(target: Path, root: Path) -> bool:
    try:
        target.relative_to(root)
        if target.is_file():
            return True
        return target.is_dir() and (target / 'index.html').is_file()
    except ValueError:
        return False


def candidate(root: Path, source: Path, path: str, repo: str) -> str | None:
    """Only propose a replacement when a unique, exact file exists in the checkout."""
    p = path.lstrip('/')
    if p.startswith(f'{repo}/'):
        p = p[len(repo) + 1:]
    if path.startswith('/'):
        target = root / p
        if exists(target.resolve(), root):
            return os.path.relpath(target, source.parent).replace('\\', '/')
    short = p.removeprefix('./')
    if short.startswith(PREFIXES):
        # `assets/name.png` in HTML but `name.png` is at root.
        suffix = short.split('/', 1)[1]
        target = (root / suffix).resolve()
        if exists(target, root):
            return os.path.relpath(target, source.parent).replace('\\', '/')
    return None


def rewrite(raw: str, root: Path, source: Path, repo: str, findings: list[tuple[str, str, str]]) -> str:
    if is_external(raw):
        return raw
    path = pathname(raw)
    if not path or re.search(r'[{*}]', path):
        return raw
    target, bad_root = static_target(root, source, path, repo)
    if exists(target, root) and not bad_root:
        return raw
    proposed = candidate(root, source, path, repo)
    reason = 'Root-relative URL on a project site' if bad_root else 'Missing local asset'
    findings.append((str(source.relative_to(root)), raw, proposed or f'UNRESOLVED: {reason}'))
    if proposed is None:
        return raw
    # Retain query and fragment, which are not filenames.
    suffix = raw[len(path):]
    return proposed + suffix


def check_file(root: Path, source: Path, repo: str, do_fix: bool):
    original = source.read_text(encoding='utf-8-sig')
    findings: list[tuple[str, str, str]] = []

    def attr_sub(match: re.Match) -> str:
        value = rewrite(match.group('value'), root, source, repo, findings)
        if not do_fix:
            value = match.group('value')
        return match.group('head') + match.group('quote') + value + match.group('quote')

    def css_sub(match: re.Match) -> str:
        value = rewrite(match.group('value'), root, source, repo, findings)
        if not do_fix:
            value = match.group('value')
        return match.group('head') + match.group('quote') + value + match.group('quote') + match.group('tail')

    if source.suffix.lower() in {'.html', '.htm'}:
        revised = ATTR.sub(attr_sub, original)
        # CSS url() is also used in inline <style> tags.
        revised = CSS_URL.sub(css_sub, revised)
    else:
        revised = CSS_URL.sub(css_sub, original)
    if do_fix and revised != original:
        backup = source.with_suffix(source.suffix + '.bak')
        if not backup.exists():
            backup.write_text(original, encoding='utf-8')
        source.write_text(revised, encoding='utf-8')
    return findings


def scan(root: Path):
    for folder, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith('.pytest')]
        for name in files:
            p = Path(folder) / name
            if p.suffix.lower() in {'.html', '.htm', '.css'}:
                yield p


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site', nargs='?', default='.', help='Checkout root (folder with index.html)')
    parser.add_argument('--repo', default='dvizhoff', help='GitHub Pages repository slug')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--check', action='store_true', help='CI mode: exit non-zero on missing assets')
    group.add_argument('--fix', action='store_true', help='Apply only high-confidence fixes (creates *.bak)')
    args = parser.parse_args(argv)
    root = Path(args.site).resolve()
    if not (root / 'index.html').is_file():
        print(f'ERROR: missing {root / "index.html"}', file=sys.stderr)
        return 2
    problems = []
    for source in scan(root):
        problems += check_file(root, source, args.repo, args.fix)
    for src, old, proposed in problems:
        label = 'FIX' if args.fix and not proposed.startswith('UNRESOLVED') else 'WARN'
        print(f'{label}: {src}: {old} -> {proposed}')
    unresolved = sum(proposal.startswith('UNRESOLVED') for _, _, proposal in problems)
    if problems:
        print(f'Issues: {len(problems)}, unresolved: {unresolved}.')
    else:
        print('PASS: no missing local asset links found in HTML/CSS.')
    if args.fix:
        return 1 if unresolved else 0
    return 1 if problems else 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
