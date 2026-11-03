'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'diagnostics.js'), 'utf8');

function fixture(storageBroken = false) {
  const data = new Map();
  const handlers = new Map();
  const storage = {
    getItem(key) { if (storageBroken) throw new Error('Storage disabled'); return data.get(key) ?? null; },
    setItem(key, value) { if (storageBroken) throw new Error('Storage disabled'); data.set(key, String(value)); },
    removeItem(key) { if (storageBroken) throw new Error('Storage disabled'); data.delete(key); }
  };
  let lastDownload = null;
  const document = {
    baseURI: 'https://duckolly.github.io/dvizhoff/support.html',
    readyState: 'complete',
    body: { appendChild() {} },
    createElement() {
      return { href: '', download: '', click() { lastDownload = this.download; }, remove() {} };
    }
  };
  class MockURL extends URL {
    static createObjectURL() { return 'blob:report'; }
    static revokeObjectURL() {}
  }
  const win = {
    addEventListener(name, callback) { handlers.set(name, callback); }
  };
  vm.runInNewContext(source, {
    localStorage: storage,
    window: win,
    location: { pathname: '/dvizhoff/support.html', search: '?token=never-store' },
    document,
    navigator: { userAgent: 'Browser from direct user export' },
    URL: MockURL,
    Blob,
    setTimeout: (f) => f(),
    Date
  });
  return { log: win.DvizhDiagnostics, win, handlers, data, getDownload: () => lastDownload };
}

{
  const f = fixture();
  assert.equal(f.log.storageAvailable(), true);
  assert.deepEqual([...f.log.recent()], []);
  f.handlers.get('error')({
    target: { tagName: 'IMG', src: 'https://duckolly.github.io/dvizhoff/assets/missing.png?token=secret' }
  });
  const event = f.log.recent()[0];
  assert.equal(event.code, 'WEB_ASSET_LOAD_FAILED');
  assert.equal(event.meta.file, 'missing.png');
  assert.equal(event.meta.resource, 'img');
  assert.equal(event.page, '/dvizhoff/support.html');
  assert.doesNotMatch(JSON.stringify(event), /secret|never-store/);
  f.handlers.get('error')({ target: f.win, error: { name: 'TypeError' }, lineno: 23 });
  f.handlers.get('unhandledrejection')({ reason: { name: 'SyntaxError' } });
  assert.equal(f.log.recent().length, 3);
  for (let i = 0; i < 110; i++) f.log.capture('WEB_TEST', 'Test', 'WEB', { phase: 'test' });
  assert.equal(f.log.recent().length, 100);
  f.log.capture('WEB_TEST', 'support@example.com Bearer xyzsecret', 'WEB');
  assert.match(f.log.recent().at(-1).message, /\[email\].*Bearer \[redacted\]/);
  assert.equal(f.log.export(), true);
  assert.match(f.getDownload(), /^orbitakt-site-diagnostics-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(f.log.clear(), true);
  assert.equal(f.log.recent().length, 0);
}
{
  const f = fixture(true);
  assert.equal(f.log.storageAvailable(), false);
  assert.doesNotThrow(() => f.log.capture('WEB_FAULT', 'Storage unavailable', 'WEB'));
  assert.equal(f.log.recent().length, 0);
  assert.equal(f.log.clear(), false);
}
console.log('PASS: local storage, sanitized asset failures, exceptions, ring buffer, export, clear, blocked storage');
