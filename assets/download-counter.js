'use strict';

(function () {
  const NAMESPACE = 'orbitakt-dvizhoff';
  const KEY = 'apk-downloads';
  const INITIAL_COUNT = 117;
  const STORAGE_KEY = 'orbitakt_apk_downloaded_v1';
  const BASE_URL = `https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}`;

  function renderCount(el, value) {
    if (!el || typeof value !== 'number' || !Number.isFinite(value)) return;
    el.textContent = String(Math.max(INITIAL_COUNT, Math.floor(value)));
  }

  document.addEventListener('DOMContentLoaded', function () {
    const countElement = document.getElementById('download-count');
    const downloadBtn = document.getElementById('download-btn');
    if (!countElement || !downloadBtn) return;

    fetch(BASE_URL, { method: 'GET', cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (data && typeof data.count === 'number') {
          if (data.count < INITIAL_COUNT) {
            return fetch(`${BASE_URL}/set?count=${INITIAL_COUNT}`, { method: 'GET', cache: 'no-store' })
              .then(function (r) { return r.ok ? r.json() : data; });
          }
          return data;
        }
        return null;
      })
      .then(function (data) {
        if (data && typeof data.count === 'number') {
          renderCount(countElement, data.count);
        }
      })
      .catch(function () {
        // Fallback to initial value rendered in HTML (117)
      });

    downloadBtn.addEventListener('click', function () {
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch (_) {}

      const current = parseInt(countElement.textContent, 10);
      if (Number.isFinite(current)) {
        renderCount(countElement, current + 1);
      }

      fetch(`${BASE_URL}/up`, { method: 'GET', keepalive: true, cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) {
          if (data && typeof data.count === 'number') {
            if (data.count <= INITIAL_COUNT) {
              return fetch(`${BASE_URL}/set?count=${INITIAL_COUNT + 1}`, { method: 'GET', keepalive: true, cache: 'no-store' })
                .then(function (r) { return r.ok ? r.json() : data; });
            }
            return data;
          }
          return null;
        })
        .then(function (data) {
          if (data && typeof data.count === 'number') {
            renderCount(countElement, data.count);
          }
        })
        .catch(function () {});
    });
  });
})();
