# Движ — сайт `dvizhoff` и локальная диагностика

Содержимое этого репозитория — **готовый статический сайт для GitHub Pages** и
вспомогательные средства проверки. Для сайта не нужны VM, сервер, Node.js или домен.
Пути к CSS и изображениям в полученном архиве уже были правильными. Главный риск
недоступности сайта — неправильная публикация GitHub Pages либо вложенная папка
`dvizhoff/` в корне репозитория; состояние удалённых настроек проверить в ZIP нельзя.

**Важно:** исходного Android-приложения в этом ZIP нет. Файлы в `android/` —
исходный шаблон логгера и инструкция, а не интеграция в работающий шагомер.

## Как опубликовать именно `Duckolly/dvizhoff`

1. В репозитории `https://github.com/Duckolly/dvizhoff` проверьте, что **в корне ветки
   `main`** лежит `index.html`, а рядом папка `assets/` с `style.css`, `diagnostics.js`
   и изображениями. Нельзя загружать внешнюю папку `dvizhoff/` одним каталогом.
2. Загрузите изменённые файлы (включая **скрытую** `.github/workflows/publish-pages.yml`
   и `.nojekyll`) и создайте коммит в `main`.
3. В GitHub откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**.
   Этот шаг надо выполнить вручную один раз, если Pages ещё не настроен.
4. Откройте вкладку **Actions → Publish Dvizh site**. Workflow запускается при
   `push` в `main`; также его можно запустить вручную (`Run workflow`).
   Дождитесь завершения **build** и **deploy** без ошибок.
5. Проверьте адреса (ожидаются, но не подтверждены в текущей среде):
   - `https://duckolly.github.io/dvizhoff/`
   - `https://duckolly.github.io/dvizhoff/privacy.html`
   - `https://duckolly.github.io/dvizhoff/support.html`
   - `https://duckolly.github.io/dvizhoff/assets/style.css`

Статус удалённого GitHub Pages и HTTP-коды живых ресурсов **не проверены**:
в рабочей среде нет доступа к удалённому репозиторию и его настройкам.
Если после успешной публикации сайт недоступен, см. `PUBLISH_GITHUB_PAGES.md`.

## Проверки до коммита

```bash
python -m unittest discover -s tests -v
python tools/site_audit_fix.py . --repo dvizhoff --check
python -m http.server 8000
```

Откройте `http://localhost:8000/` и `http://localhost:8000/support.html`.
Скрипт проверки не меняет файлы без `--fix`. Сайт работает без сборки.

## Ошибки сайта: подключено

На **каждой** странице подключён `assets/diagnostics.js`, в том числе для
ошибок загрузки CSS, изображений, скриптов, необработанных JS-исключений
и Promise rejection. Сохраняет последние 100 событий в localStorage браузера
(без сетевой отправки); авария localStorage не ломает сайт.

`support.html` содержит кнопки **«Скачать отчёт JSON»** и **«Очистить журнал»**.
Пользователь самостоятельно выбирает, кому передать отчёт. Перед отправкой
необходимо проверить файл: в экспорт добавляется User-Agent браузера.
Если JavaScript или хранилище заблокированы, логирование может не сработать.

**Журнал сайта не диагностирует Android:** датчики, Foreground Service, доступы
и запись шагов диагностируются отдельно в нативном приложении.

## Android: пока шаблон

`android/LocalDiagnosticLogger.kt` и `android/INTEGRATION.md` требуют исходников
приложения: `app/src/main/...`, Gradle, манифеста и текущей реализации шагомера.
`CURSOR_TASK.md` — интеграционная задача, но не свидетельство исправления бага.

## Состав публикации

Workflow публикует **только** `index.html`, `privacy.html`, `support.html`,
`.nojekyll` и `assets/`. Вспомогательные документы, тесты и Kotlin-код
не попадают на публичный сайт.
