# Публикация сайта Орбитакт на GitHub Pages

Сначала обновите существующий репозиторий сайта содержимым этого ZIP: index.html должен находиться в корне, рядом с assets/ и download/. Не загружайте ZIP как единственный файл и не помещайте файлы в дополнительную вложенную папку.

В исходном комплекте сайт связан с Duckolly/dvizhoff; адрес сайта при сохранении этого репозитория — https://duckolly.github.io/dvizhoff/ . Название «Орбитакт» в интерфейсе не требует переименования репозитория. Репозиторий приложения https://github.com/Duckolly/orbitakt и авторский сайт https://duckolly.github.io/testofsilence/ имеют другое назначение.

## Порядок

1. Скопировать содержимое ZIP в корень локального клона сайта. Сохранить .git.
2. Убедиться, что download/ — папка с orbitakt-arm64.apk, а не прежний пустой файл download. При конфликте типов удалить только пустой файл download и повторить копирование папки.
3. Проверить изменения:

```bash
git diff --check
git status --short
```

4. Добавить файлы, создать коммит и выполнить push в main. Обновить в том числе .github/workflows/publish-pages.yml и .nojekyll.
5. GitHub → Settings → Pages → Source → GitHub Actions.
6. Actions → Publish Orbitakt site → дождаться успешных build и deploy. Workflow публикует страницы, assets и download с APK; служебные документы и Android-шаблоны не публикуются.

Для другого бесплатного статического хостинга достаточно index.html, privacy.html, support.html, assets/, download/ и .nojekyll. Сборка и VM не нужны.

## Проверки

На главной должны быть новая иконка, название Орбитакт и блок произведений. Ссылки:

- download/orbitakt-arm64.apk — APK 3.9.5+18 с этого же сайта.
- privacy.html и support.html — локальные страницы.
- https://duckolly.github.io/testofsilence/ — общий сайт книги, рассказа и комикса.
- https://github.com/Duckolly/orbitakt — исходники приложения.

При 404 у главной проверить источник Pages и расположение index.html. При 404 у APK проверить наличие папки download в репозитории и в workflow. При старом названии или иконке обновить страницу с очисткой кеша и дождаться завершения последнего deploy.

Внешние адреса и состояние настроек удалённого GitHub Pages не подтверждены этой локальной проверкой. Публикация на удалённый сайт не выполнялась.
