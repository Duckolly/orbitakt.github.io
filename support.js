'use strict';

const reportButton = document.getElementById('copy-report');
const reportStatus = document.getElementById('copy-status');
if (reportButton && reportStatus) {
  reportButton.addEventListener('click', async function () {
    const report = document.getElementById('report-template');
    try {
      if (!navigator.clipboard || !report) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(report.textContent);
      reportStatus.textContent = 'Шаблон скопирован. Заполните его и отправьте в сообщество.';
    } catch (_) {
      reportStatus.textContent = 'Не удалось скопировать автоматически. Выделите текст шаблона и скопируйте вручную.';
    }
  });
}

const diagnostics = window.DvizhDiagnostics;
const diagnosticsStatus = document.getElementById('diagnostics-status');
const exportButton = document.getElementById('export-diagnostics');
const clearButton = document.getElementById('clear-diagnostics');

function showDiagnosticsStatus(message) {
  if (diagnosticsStatus) diagnosticsStatus.textContent = message;
}

function refreshDiagnosticsStatus() {
  if (!diagnostics) {
    showDiagnosticsStatus('Диагностика сайта не загружена. Проверьте подключение JavaScript.');
    return;
  }
  if (!diagnostics.storageAvailable()) {
    showDiagnosticsStatus('Браузер не разрешает локальное сохранение. Ошибки между посещениями не сохраняются.');
    return;
  }
  const count = diagnostics.recent().length;
  showDiagnosticsStatus('Событий в локальном журнале: ' + count + '. Данные остаются в этом браузере.');
}

if (diagnostics && exportButton) {
  exportButton.addEventListener('click', function () {
    const success = diagnostics.export();
    showDiagnosticsStatus(success
      ? 'Файл JSON скачан. Проверьте его содержимое перед отправкой в поддержку.'
      : 'Не удалось сформировать файл отчёта. Проверьте настройки загрузок браузера.');
  });
}

if (diagnostics && clearButton) {
  clearButton.addEventListener('click', function () {
    if (!window.confirm('Удалить сохранённые ошибки сайта в этом браузере?')) return;
    const success = diagnostics.clear();
    if (success) refreshDiagnosticsStatus();
    else showDiagnosticsStatus('Не удалось очистить журнал. Проверьте настройки браузера.');
  });
}
refreshDiagnosticsStatus();
