# Восстановление GitHub Pages: `Duckolly/dvizhoff`

## Проверка конфигурации

Нужен репозиторий `https://github.com/Duckolly/dvizhoff` и опубликованная
ветка `main`. В корне репозитория должны лежать `index.html`, `assets/`,
`.github/workflows/publish-pages.yml` и `.nojekyll`.

**Не загружайте папку `dvizhoff/` целиком внутрь репозитория.**
При загрузке архива на GitHub раскройте папку и загрузите её *содержимое*.
После публикации файл `index.html` должен открываться по адресу
`https://duckolly.github.io/dvizhoff/`, а не `.../dvizhoff/dvizhoff/`.

## Рекомендуемый путь (GitHub Actions)

1. Скопируйте все файлы из этого комплекта в локальный клон `dvizhoff`.
2. Запустите тесты и проверьте дерево проекта.
3. Сделайте коммит и push в `main`:

```bash
python -m unittest discover -s tests -v
python tools/site_audit_fix.py . --repo dvizhoff --check
git status --short
git add .
git commit -m "fix: publish dvizhoff and enable local web diagnostics"
git push origin main
```

4. На GitHub: **Settings → Pages → Source → GitHub Actions**.
   Если проект раньше публиковался из ветки, обязательно переключите Source.
5. **Actions → Publish Dvizh site**: должны успешно завершиться `build` и `deploy`.
   При красном статусе открыть job logs. Если виден только check workflow,
   проверьте наличие `publish-pages.yml` в `main` и настройки Actions.

Workflow запускается также через `workflow_dispatch` (кнопка Run workflow).
Он проверяет пути и загружает только публичные HTML/CSS/JS/PNG.

## Как распознать причину

| Симптом | Что проверять |
| --- | --- |
| GitHub Pages 404 целиком | Source, ветка main, успешный deploy, index.html в корне, корректное имя repo |
| HTML открывается без стилей | DevTools → Network → `assets/style.css` (HTTP 200?), правильный регистр имени |
| Не показываются скриншоты | Network → `assets/*.png`, что изображения реально закоммичены |
| Старая версия после push | Actions → крайний deploy, hard refresh / инкогнито / кеш браузера |
| GitHub Actions отказ в правах | Settings → Actions, разрешения workflow и Pages, защищённая среда github-pages |
| Кнопки диагностики не работают | Network → `assets/diagnostics.js` и `assets/support.js`, ошибки Console, доступность localStorage |

Сайт не требует DNS-записей и внешнего сервера; CNAME не нужен, пока нет своего домена.
Если Source всё же должен остаться «Deploy from a branch», workflow не является
вариантом публикации; используйте `main / (root)` и отдельно проверяйте
результат Pages. Не включайте обе схемы без необходимости.

## Что проверено и что пока не подтверждено

Локально: наличие файлов, ссылки, синтаксис JS, HTTP-обслуживание и тесты
(если выполнены, см. `VERIFICATION.json`).

Не подтверждено: настоящий HTTP-статус `https://duckolly.github.io/dvizhoff/`,
фактическая настройка Pages в `Duckolly/dvizhoff`, права на публикацию,
результат Actions после push. Для этого нужен доступ к GitHub.

## Google Play

После публикации укажите URL политики `https://duckolly.github.io/dvizhoff/privacy.html`.
В карточке приложения необходим рабочий email для связи. Telegram допустим
как дополнительный канал, но не как замена обязательному email. Сведения
о регистрации разработчика и правилах — в `GOOGLE_SUPPORT.md`.
