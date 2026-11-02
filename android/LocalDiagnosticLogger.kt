// SAMPLE: Place into the Android application's package and adjust its package declaration.
// Android Kotlin + AndroidX core. No network, no external crash-reporting SDK.
// This implementation stores structured JSONL in app-private files and rotates old data.

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class LocalDiagnosticLogger private constructor(context: Context) {
    enum class Level { INFO, WARN, ERROR, FATAL }

    private val appContext = context.applicationContext
    private val directory = File(appContext.filesDir, "diagnostics").apply { mkdirs() }
    private val activeFile = File(directory, "events.jsonl")
    private val previousFile = File(directory, "events.previous.jsonl")
    private val io = Executors.newSingleThreadExecutor()
    private val sessionId = UUID.randomUUID().toString()
    private val lock = Any()
    private val versionName: String = try {
        @Suppress("DEPRECATION")
        appContext.packageManager.getPackageInfo(appContext.packageName, 0).versionName ?: "unknown"
    } catch (_: Exception) { "unknown" }

    companion object {
        @Volatile private var instance: LocalDiagnosticLogger? = null
        private const val MAX_FILE_BYTES = 512L * 1024L // two files => about 1 MiB

        fun get(context: Context): LocalDiagnosticLogger =
            instance ?: synchronized(this) {
                instance ?: LocalDiagnosticLogger(context).also { instance = it }
            }
    }

    /** Do not pass personal data, raw user content, API tokens, URLs, or account IDs. */
    fun record(
        level: Level,
        code: String,
        component: String,
        details: Map<String, Any?> = emptyMap(),
        cause: Throwable? = null
    ) {
        // Serialize inside guard: JSONException (e.g. NaN metadata) must not escape
        // into the step-counter service before the asynchronous write starts.
        try {
            val event = eventJson(level, code, component, details, cause)
            io.execute { append(event) }
        } catch (_: Throwable) { /* logging must never interrupt the step counter */ }
    }

    /** Install once in Application.onCreate(); preserves Android's existing crash handler. */
    fun installCrashHandler() {
        val oldHandler = Thread.getDefaultUncaughtExceptionHandler()
        if (oldHandler is CrashHandlerMarker) return
        Thread.setDefaultUncaughtExceptionHandler(object : CrashHandlerMarker {
            override fun uncaughtException(thread: Thread, throwable: Throwable) {
                // Best-effort synchronous write: process may terminate immediately.
                try {
                    val event = eventJson(Level.FATAL, "APP_UNCAUGHT_EXCEPTION", "process",
                        mapOf("thread" to thread.name), throwable)
                    append(event)
                } catch (_: Throwable) { }
                if (oldHandler != null) oldHandler.uncaughtException(thread, throwable)
                else {
                    android.os.Process.killProcess(android.os.Process.myPid())
                    kotlin.system.exitProcess(10)
                }
            }
        })
    }

    private interface CrashHandlerMarker : Thread.UncaughtExceptionHandler

    private fun eventJson(
        level: Level, code: String, component: String,
        details: Map<String, Any?>, cause: Throwable?
    ): String {
        val safeDetails = JSONObject()
        details.entries.take(16).forEach { (key, value) ->
            if (key.matches(Regex("[a-zA-Z0-9_]{1,40}"))) {
                // Only primitive, bounded telemetry; no arbitrary objects or messages.
                val safeValue = when (value) {
                    is Boolean, is Int, is Long -> value
                    is Double -> if (value.isFinite()) value else "[nonfinite]"
                    is Float -> if (value.isFinite()) value else "[nonfinite]"
                    is String -> if (value.matches(Regex("[a-zA-Z0-9_. -]{0,80}"))) value else "[redacted]"
                    else -> "[omitted]"
                }
                safeDetails.put(key, safeValue)
            }
        }
        val result = JSONObject()
            .put("ts", Instant.now().toString())
            .put("level", level.name)
            .put("code", safeCode(code))
            .put("component", safeCode(component))
            .put("session_id", sessionId)
            .put("android_sdk", Build.VERSION.SDK_INT)
            .put("app_version", versionName)
            .put("details", safeDetails)
        if (cause != null) {
            result.put("exception_class", cause.javaClass.name)
            // Intentionally exclude exception.message: often contains sensitive paths/data.
            result.put("stack", cause.stackTrace.take(12).map {
                JSONObject().put("class", it.className)
                    .put("method", it.methodName)
                    .put("line", it.lineNumber)
            }.let { org.json.JSONArray(it) })
        }
        return result.toString()
    }

    private fun safeCode(value: String): String =
        if (value.matches(Regex("[a-zA-Z0-9_.-]{1,64}"))) value else "UNKNOWN"

    private fun append(json: String) {
        try {
            synchronized(lock) {
                directory.mkdirs()
                val bytes = (json + "\n").toByteArray(Charsets.UTF_8)
                if (activeFile.length() + bytes.size > MAX_FILE_BYTES) {
                    if (previousFile.exists()) previousFile.delete()
                    if (activeFile.exists() && !activeFile.renameTo(previousFile)) return
                }
                if (bytes.size > MAX_FILE_BYTES) return
                FileOutputStream(activeFile, true).use { out -> out.write(bytes) }
            }
        } catch (_: Exception) {
            // Diagnostics must never disable step counting or crash the process.
        }
    }

    /** Clear log files only when the user requests it in Settings. */
    fun clearAsync(callback: (Boolean) -> Unit) {
        try {
            io.execute {
                val success = synchronized(lock) {
                    try {
                        val currentDeleted = !activeFile.exists() || activeFile.delete()
                        val previousDeleted = !previousFile.exists() || previousFile.delete()
                        currentDeleted && previousDeleted
                    } catch (_: Exception) { false }
                }
                Handler(Looper.getMainLooper()).post { callback(success) }
            }
        } catch (_: Exception) {
            Handler(Looper.getMainLooper()).post { callback(false) }
        }
    }

    /** Callback is delivered on main thread. Caller shares resulting ZIP through FileProvider. */
    fun exportAsync(callback: (File?) -> Unit) {
        io.execute {
            val zipFile = try {
                val exportDirectory = File(appContext.cacheDir, "diagnostics").apply { mkdirs() }
                val target = File(exportDirectory, "dvizh-diagnostics.zip")
                synchronized(lock) {
                    ZipOutputStream(FileOutputStream(target)).use { zip ->
                        listOf(previousFile, activeFile).filter { it.isFile }.forEach { source ->
                            zip.putNextEntry(ZipEntry(source.name))
                            source.inputStream().use { it.copyTo(zip) }
                            zip.closeEntry()
                        }
                    }
                }
                target
            } catch (_: Exception) { null }
            Handler(Looper.getMainLooper()).post { callback(zipFile) }
        }
    }
}
