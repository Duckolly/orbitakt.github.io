/* Движ: local-only website diagnostics, schema v2.
 * Installed early in <head> to capture missing CSS/images and script failures.
 * No network, cookies, analytics, or collection of user-entered values.
 */
(function () {
  'use strict';

  const KEY = 'dvizh_web_diagnostics_v2';
  const LIMIT = 100;
  const MAX_MESSAGE = 160;
  const MAX_META = 8;
  const ALLOWED_META = /^(resource|file|phase|line|column|status|reason|build)$/;
  const SAFE_CODE = /^[A-Z0-9_.-]{1,64}$/;

  function safeCode(input, fallback) {
    const value = String(input == null ? '' : input);
    return SAFE_CODE.test(value) ? value : fallback;
  }

  // Called only for fixed, developer-authored messages. Never pass form fields,
  // user-provided free text, paths, auth headers or full exception.message.
  function safeMessage(input) {
    return String(input == null ? '' : input)
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/([?&](?:token|key|password|secret|code)=)[^&#\s]+/gi, '$1[redacted]')
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
      .replace(/\+?\d[\d\s()-]{9,}\d/g, '[phone]')
      .slice(0, MAX_MESSAGE);
  }

  function safeFilename(url) {
    try {
      const file = new URL(url, document.baseURI).pathname.split('/').pop();
      return /^[a-zA-Z0-9_.-]{1,80}$/.test(file || '') ? file : 'redacted';
    } catch (_) { return 'unknown'; }
  }

  function read() {
    try {
      const events = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(events) ? events.slice(-LIMIT) : [];
    } catch (_) { return []; }
  }

  function storageAvailable() {
    try {
      localStorage.setItem(KEY + '_probe', '1');
      localStorage.removeItem(KEY + '_probe');
      return true;
    } catch (_) { return false; }
  }

  function metadata(input) {
    const clean = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return clean;
    Object.entries(input).slice(0, MAX_META).forEach(function (pair) {
      if (!ALLOWED_META.test(pair[0])) return;
      const value = pair[1];
      if (typeof value === 'boolean') clean[pair[0]] = value;
      else if (typeof value === 'number' && Number.isFinite(value)) clean[pair[0]] = value;
      else if (typeof value === 'string') clean[pair[0]] = safeMessage(value);
    });
    return clean;
  }

  function capture(code, message, component, meta) {
    const event = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      code: safeCode(code, 'WEB_UNKNOWN_ERROR'),
      component: safeCode(component || 'WEB', 'WEB'),
      message: safeMessage(message),
      // Omit URL parameters (possible account IDs or sensitive data).
      page: location.pathname.replace(/[^a-zA-Z0-9_./-]/g, '_').slice(-120),
      meta: metadata(meta)
    };
    try {
      const events = read();
      events.push(event);
      localStorage.setItem(KEY, JSON.stringify(events.slice(-LIMIT)));
    } catch (_) { /* Logging must never break the website. */ }
    return event;
  }

  // Resource errors do not bubble. Capture them before browsers fire events for
  // stylesheet, image or script requests. Store basename only, never full URL.
  window.addEventListener('error', function (event) {
    const target = event.target;
    if (target && target !== window && target.tagName) {
      const kind = target.tagName.toLowerCase();
      if (kind === 'img' || kind === 'script' || kind === 'link') {
        capture('WEB_ASSET_LOAD_FAILED', 'Не удалось загрузить ресурс сайта', 'ASSETS', {
          resource: kind,
          file: safeFilename(target.currentSrc || target.src || target.href || ''),
          phase: document.readyState
        });
      }
      return;
    }
    capture('WEB_UNCAUGHT_EXCEPTION',
      event.error && event.error.name ? safeMessage(event.error.name) : 'JavaScript error',
      'WINDOW', { phase: document.readyState, line: event.lineno || 0 });
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    capture('WEB_UNHANDLED_REJECTION',
      reason && reason.name ? safeMessage(reason.name) : 'Unhandled promise rejection', 'PROMISE');
  });

  window.DvizhDiagnostics = Object.freeze({
    schemaVersion: 2,
    capture: capture,
    recent: function () { return read().slice(); },
    storageAvailable: storageAvailable,
    clear: function () {
      try { localStorage.removeItem(KEY); return true; }
      catch (_) { return false; }
    },
    export: function () {
      try {
        const data = {
          schema: 2,
          exportedAt: new Date().toISOString(),
          storageAvailable: storageAvailable(),
          // This is only added to a report deliberately downloaded by the user.
          browser: navigator.userAgent,
          events: read()
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dvizh-site-diagnostics-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
        return true;
      } catch (_) { return false; }
    }
  });
})();
