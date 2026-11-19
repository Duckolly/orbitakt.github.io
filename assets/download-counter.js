'use strict';

(function () {
  const NAMESPACE = 'orbitakt-dvizhoff';
  const KEY = 'apk-downloads';
  const INITIAL_COUNT = 117;
  const STORAGE_KEY = 'orbitakt_apk_downloaded_v1';
  const BASE_URL = 'https://abacus.jasoncameron.dev';

  function renderCount(el, value) {
    if (!el || typeof value !== 'number' || !Number.isFinite(value)) return;
    el.textContent = String(Math.max(INITIAL_COUNT, Math.floor(value)));
  }

  document.addEventListener('DOMContentLoaded', function () {
    const countElement = document.getElementById('download-count');
    const downloadBtn = document.getElementById('download-btn');
    if (!countElement || !downloadBtn) return;

    // 1. Загружаем актуальное значение с сервера
    fetch(`${BASE_URL}/get/${NAMESPACE}/${KEY}`, { method: 'GET', cache: 'no-store' })
      .then(function (response) {
        if (response.status === 404) {
          // Создаём счётчик со стартовым значением 117, если его ещё нет
          return fetch(`${BASE_URL}/create/${NAMESPACE}/${KEY}?value=${INITIAL_COUNT}`, {
            method: 'GET',
            cache: 'no-store'
          }).then(function (r) { return r.ok ? r.json() : null; });
        }
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (data && typeof data.value === 'number') {
          renderCount(countElement, data.value);
        }
      })
      .catch(function () {});

    // 2. Отправляем +1 перед запуском скачивания APK
    downloadBtn.addEventListener('click', function (event) {
      let alreadyCounted = false;
      try {
        alreadyCounted = sessionStorage.getItem(STORAGE_KEY) === '1';
      } catch (_) {}

      if (alreadyCounted) return; // Повторный клик в той же вкладке — просто качаем файл

      event.preventDefault(); // Пауза на 150-300 мс, чтобы браузер не оборвал запрос
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch (_) {}

      const current = parseInt(countElement.textContent, 10);
      if (Number.isFinite(current)) {
        renderCount(countElement, current + 1);
      }

      const startDownload = function () {
        const link = document.createElement('a');
        link.href = downloadBtn.href;
        link.download = downloadBtn.getAttribute('download') || 'orbitakt-arm64.apk';
        document.body.appendChild(link);
        link.click();
        link.remove();
      };

      fetch(`${BASE_URL}/hit/${NAMESPACE}/${KEY}`, {
        method: 'GET',
        cache: 'no-store'
      })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (data) {
          if (data && typeof data.value === 'number') {
            renderCount(countElement, data.value);
          }
        })
        .catch(function () {})
        .finally(startDownload);
    });
  });
})();