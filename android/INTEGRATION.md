# Android: локальный диагностический журнал

> Пример на Kotlin. **Это не патч существующего Android-проекта:** исходный код приложения недоступен, поэтому требуется адаптация пакета, версии Android SDK и вызовов шагомера. Не записывать персональные данные, токены, координаты или тексты пользователя.

## Интеграция

1. Разместить `LocalDiagnosticLogger.kt` в пакете приложения и добавить `package ...`.
2. В `Application.onCreate()` вызвать:

```kotlin
val logger = LocalDiagnosticLogger.get(this)
logger.installCrashHandler()
logger.record(LocalDiagnosticLogger.Level.INFO, "APP_STARTED", "application")
```

3. В `StepCounterService`, `SensorEventListener` и обработчиках разрешений добавлять **до и после** критических операций наблюдаемые события:

```kotlin
val log = LocalDiagnosticLogger.get(applicationContext)
log.record(LocalDiagnosticLogger.Level.INFO, "STEP_COUNTER_START_REQUESTED", "steps")

// Проверить разрешения, состояние foreground service и доступность датчика.
// Внутри ветки отсутствующего разрешения:
log.record(LocalDiagnosticLogger.Level.ERROR, "STEP_PERMISSION_MISSING", "steps",
    mapOf("activity_recognition_granted" to false))

// При отсутствии TYPE_STEP_COUNTER / TYPE_STEP_DETECTOR:
log.record(LocalDiagnosticLogger.Level.ERROR, "STEP_SENSOR_UNAVAILABLE", "sensor")

// Если registerListener вернул false:
log.record(LocalDiagnosticLogger.Level.ERROR, "STEP_LISTENER_REGISTER_FAILED", "sensor")

// При обработке исключения:
log.record(LocalDiagnosticLogger.Level.ERROR, "STEP_STORAGE_WRITE_FAILED", "storage",
    mapOf("operation" to "persist_steps"), error)
```

4. В настройках добавить «Диагностика → Экспортировать журнал», вызвать `exportAsync`. ZIP отправлять только по явному действию пользователя через Android Sharesheet. `context` в примере — контекст Activity (не Application):

```kotlin
val logger = LocalDiagnosticLogger.get(context)
logger.exportAsync { file ->
    if (file == null) return@exportAsync
    val uri = androidx.core.content.FileProvider.getUriForFile(
        context, "${context.packageName}.diagnostics", file
    )
    val share = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type = "application/zip"
        putExtra(android.content.Intent.EXTRA_STREAM, uri)
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(android.content.Intent.createChooser(share, "Поделиться диагностикой"))
}
```

Для кнопки «Удалить журнал» используйте `LocalDiagnosticLogger.get(context).clearAsync { success -> ... }` и покажите пользователю результат. Не вызывайте удаление автоматически при ошибке приложения.

5. Добавить `diagnostics_paths.xml` в `res/xml/`, провайдер в `<application>` манифеста:

```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.diagnostics"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/diagnostics_paths" />
</provider>
```

## Что обязательно диагностировать в шагомере

- `STEP_COUNTER_START_REQUESTED` — пользователь запустил учёт.
- `STEP_PERMISSION_MISSING` — `ACTIVITY_RECOGNITION` не выдано или отозвано (Android 10+); отдельно фиксировать состояние FGS-разрешений, если применимо к target SDK.
- `STEP_SENSOR_UNAVAILABLE` — системный датчик шагов не найден.
- `STEP_LISTENER_REGISTER_FAILED` — регистрация слушателя возвратила `false`.
- `STEP_FOREGROUND_SERVICE_STOPPED` — завершение foreground service с явной причиной.
- `STEP_STORAGE_WRITE_FAILED` — ошибка хранения; отдельно кодировать `SQLiteException`, `IOException` по `exception_class`.
- `STEP_SENSOR_EVENT_STALLED` — давно не приходили события; **не считать это доказательством отказа**, т. к. датчик может не получать шаги, когда человек неподвижен.
- `STEP_COUNT_BASELINE_RESET` — значение `TYPE_STEP_COUNTER` сбросилось после перезапуска устройства.
- `STEP_COUNTER_RECOVERED` — успешное восстановление после сбоя.

Журнал **не должен** запускать бесконечные ретраи, постоянно держать CPU или менять семантику счёта шагов. Проверьте штатные разрешения, правила запуска foreground service и энергосбережение на целевых Android версиях.

## Контроль качества

- Ротация логов: 2 × 512 КиБ, только внутренний каталог `filesDir`.
- Экспорт ZIP производится асинхронно, не на UI-потоке, и только вручную.
- Приложение продолжает работать при переполнении памяти, запрете доступа к хранилищу или ошибке логгера.
- Crash handler вызывает исходный обработчик, не проглатывает fatal crash.
- Тестировать на реальном устройстве Android 10–16, а не только эмуляторе.
- `APP_UNCAUGHT_EXCEPTION` не гарантирует запись при аварийном завершении ОС, native crash или принудительном убийстве процесса.
