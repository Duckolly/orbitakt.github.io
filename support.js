'use strict';
const button = document.getElementById('copy-report');
button.addEventListener('click', async () => {
  const status = document.getElementById('copy-status');
  try {
    await navigator.clipboard.writeText(document.getElementById('report-template').textContent);
    status.textContent = 'Шаблон скопирован. Заполните его и отправьте в сообщество.';
  } catch (_) {
    status.textContent = 'Не удалось скопировать автоматически. Выделите текст шаблона и скопируйте вручную.';
  }
});
