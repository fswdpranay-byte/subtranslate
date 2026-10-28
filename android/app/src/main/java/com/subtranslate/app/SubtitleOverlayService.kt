package com.subtranslate.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.text.Html
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.Executors
import java.util.zip.ZipInputStream

/**
 * Android floating subtitle service.
 *
 * Two capture modes:
 *  - microphone: SpeechRecognizer on the device mic (works everywhere).
 *  - system: MediaProjection + AudioPlaybackCapture, transcribed on-device with
 *    Vosk. This is what hears Instagram/TikTok/YouTube audio directly, even with
 *    headphones or the volume low. Android 10+ only.
 *
 * In system mode the first run downloads a small (~40–80 MB) offline model for
 * the chosen source language. Audio never leaves the phone.
 */
class SubtitleOverlayService : Service(), RecognitionListener {

    companion object {
        const val ACTION_START = "com.subtranslate.app.overlay.START"
        const val ACTION_STOP = "com.subtranslate.app.overlay.STOP"
        const val ACTION_UPDATE = "com.subtranslate.app.overlay.UPDATE"

        const val MODE_MIC = "microphone"
        const val MODE_SYSTEM = "system"

        const val EXTRA_FONT_SIZE = "fontSize"
        const val EXTRA_BG_OPACITY = "backgroundOpacity"
        const val EXTRA_TEXT_COLOR = "textColor"
        const val EXTRA_POSITION = "position"
        const val EXTRA_SHOW_ORIGINAL = "showOriginal"
        const val EXTRA_SOURCE_LANG = "sourceLang"
        const val EXTRA_TARGET_LANG = "targetLang"
        const val EXTRA_TRANSLATE = "translate"
        const val EXTRA_CAPTURE_MODE = "captureMode"
        const val EXTRA_PROJECTION_RESULT_CODE = "projectionResultCode"
        const val EXTRA_PROJECTION_DATA = "projectionData"

        private const val CHANNEL_ID = "subtranslate_overlay"
        private const val NOTIFICATION_ID = 4242
        private const val SAMPLE_RATE = 16000

        /**
         * Small Vosk models (Apache 2.0) from https://alphacephei.com/vosk/models.
         * Only the model for the selected source language is downloaded.
         */
        private val MODEL_URLS = mapOf(
            "en" to "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip",
            "en-in" to "https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip",
            "hi" to "https://alphacephei.com/vosk/models/vosk-model-small-hi-0.22.zip",
            "es" to "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip",
            "fr" to "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip",
            "de" to "https://alphacephei.com/vosk/models/vosk-model-small-de-0.15.zip",
            "pt" to "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip",
            "it" to "https://alphacephei.com/vosk/models/vosk-model-small-it-0.22.zip",
            "ru" to "https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip",
            "nl" to "https://alphacephei.com/vosk/models/vosk-model-small-nl-0.22.zip",
            "tr" to "https://alphacephei.com/vosk/models/vosk-model-small-tr-0.3.zip",
            "ja" to "https://alphacephei.com/vosk/models/vosk-model-small-ja-0.22.zip",
            "ko" to "https://alphacephei.com/vosk/models/vosk-model-small-ko-0.22.zip",
            "cn" to "https://alphacephei.com/vosk/models/vosk-model-small-cn-0.22.zip",
            "ca" to "https://alphacephei.com/vosk/models/vosk-model-small-ca-0.4.zip",
            "eo" to "https://alphacephei.com/vosk/models/vosk-model-small-eo-0.42.zip",
            "fa" to "https://alphacephei.com/vosk/models/vosk-model-small-fa-0.42.zip",
            "cs" to "https://alphacephei.com/vosk/models/vosk-model-small-cs-0.4-rhasspy.zip",
            "pl" to "https://alphacephei.com/vosk/models/vosk-model-small-pl-0.22.zip",
            "uk" to "https://alphacephei.com/vosk/models/vosk-model-small-uk-v3-nano.zip",
            "kz" to "https://alphacephei.com/vosk/models/vosk-model-small-kz-0.42.zip",
            "uz" to "https://alphacephei.com/vosk/models/vosk-model-small-uz-0.22.zip",
            "gu" to "https://alphacephei.com/vosk/models/vosk-model-small-gu-0.42.zip",
            "te" to "https://alphacephei.com/vosk/models/vosk-model-small-te-0.42.zip",
            "tg" to "https://alphacephei.com/vosk/models/vosk-model-small-tg-0.22.zip",
            "ky" to "https://alphacephei.com/vosk/models/vosk-model-small-ky-0.42.zip",
            "ka" to "https://alphacephei.com/vosk/models/vosk-model-small-ka-0.42.zip",
            "vn" to "https://alphacephei.com/vosk/models/vosk-model-small-vn-0.4.zip",
        )

        @Volatile
        var isRunning: Boolean = false
            private set
    }

    private lateinit var windowManager: WindowManager
    private var overlayView: LinearLayout? = null
    private var originalView: TextView? = null
    private var translatedView: TextView? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var foregroundStarted = false

    private var fontSize = 18
    private var backgroundOpacity = 72
    private var textColor = "#FFFFFF"
    private var position = "bottom"
    private var showOriginal = true
    private var sourceLang = "auto"
    private var targetLang = "en"
    private var translate = true
    private var captureMode = MODE_MIC

    @Volatile
    private var mediaProjection: MediaProjection? = null

    @Volatile
    private var audioRecord: AudioRecord? = null

    @Volatile
    private var captureThread: Thread? = null

    @Volatile
    private var systemCaptureActive = false

    private var currentOriginal = ""
    private var currentTranslated = ""

    /** Rolling caption lines so the overlay reads continuously instead of flashing. */
    private val originalLines = ArrayDeque<String>()
    private val translatedLines = ArrayDeque<String>()
    private val maxCaptionLines = 3

    /**
     * Full session transcript. The overlay only shows a rolling window, but the
     * Copy action must expose everything that was recorded since the last Clear.
     */
    private val recordedOriginal = StringBuilder()
    private val recordedTranslated = StringBuilder()

    /**
     * Translation cache + provider health. Free endpoints have daily quotas, so
     * like phrases are served locally and a quota warning switches providers
     * instead of silently stopping translations.
     */
    private val translationCache = object : LinkedHashMap<String, String>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, String>?): Boolean =
            size > 300
    }

    @Volatile
    private var myMemoryBlockedUntil = 0L

    private val mainHandler = Handler(Looper.getMainLooper())
    private val translationExecutor = Executors.newSingleThreadExecutor()
    private val restartRunnable = Runnable { if (isRunning && captureMode == MODE_MIC) startListening() }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        isRunning = true
        createOverlay()
        currentOriginal = "Starting…"
        render()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                applyStyle(intent)
                if (!foregroundStarted) ensureForeground(captureMode)
            }
            ACTION_START -> {
                applyStyle(intent)
                captureMode = intent.getStringExtra(EXTRA_CAPTURE_MODE) ?: MODE_MIC
                if (captureMode == MODE_SYSTEM) {
                    ensureForeground(MODE_SYSTEM)
                    startSystemAudioCapture(intent)
                } else {
                    ensureForeground(MODE_MIC)
                    createRecognizer()
                    startListening()
                }
            }
            else -> {
                ensureForeground(captureMode)
                startListening()
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ------------------------------------------------------------------
    // Overlay window
    // ------------------------------------------------------------------

    private fun createOverlay() {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(12))
            background = roundedBackground(backgroundOpacity)
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            setPadding(0, 0, 0, dp(2))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val copy = TextView(this).apply {
            text = "Copy"
            setTextColor(Color.parseColor("#94A3B8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
            setPadding(dp(8), dp(6), dp(8), dp(6))
            setOnClickListener { showTranscriptDialog() }
        }

        val clear = TextView(this).apply {
            text = "Clear"
            setTextColor(Color.parseColor("#94A3B8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
            setPadding(dp(8), dp(6), dp(8), dp(6))
            setOnClickListener { clearTranscript() }
        }

        val close = TextView(this).apply {
            text = "✕"
            setTextColor(Color.parseColor("#94A3B8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setPadding(dp(8), dp(6), dp(4), dp(6))
            setOnClickListener { stopSelf() }
        }

        header.addView(copy)
        header.addView(clear)
        header.addView(close)

        originalView = TextView(this).apply {
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSize.toFloat())
            gravity = Gravity.CENTER
            maxLines = 4
            setShadowLayer(6f, 0f, 2f, Color.BLACK)
        }

        translatedView = TextView(this).apply {
            setTextColor(Color.parseColor("#A5F3FC"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, (fontSize - 1).coerceAtLeast(11).toFloat())
            gravity = Gravity.CENTER
            maxLines = 4
            setPadding(0, dp(4), 0, 0)
            setShadowLayer(6f, 0f, 2f, Color.BLACK)
        }

        container.addView(header)
        container.addView(originalView)
        container.addView(translatedView)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            width = (resources.displayMetrics.widthPixels * 0.92).toInt()
            y = dp(150)
        }

        layoutParams = params
        enableDrag(container)
        windowManager.addView(container, params)
        overlayView = container
        render()
    }

    private fun enableDrag(view: View) {
        var initialX = 0
        var initialY = 0
        var touchX = 0f
        var touchY = 0f

        view.setOnTouchListener { _, event ->
            val params = layoutParams ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initialX + (event.rawX - touchX).toInt()
                    params.y = initialY - (event.rawY - touchY).toInt()
                    try {
                        windowManager.updateViewLayout(view, params)
                    } catch (_: Exception) {
                        // View was detached while dragging.
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun applyStyle(intent: Intent) {
        fontSize = intent.getIntExtra(EXTRA_FONT_SIZE, fontSize).coerceIn(12, 40)
        backgroundOpacity = intent.getIntExtra(EXTRA_BG_OPACITY, backgroundOpacity).coerceIn(0, 100)
        textColor = intent.getStringExtra(EXTRA_TEXT_COLOR) ?: textColor
        position = intent.getStringExtra(EXTRA_POSITION) ?: position
        showOriginal = intent.getBooleanExtra(EXTRA_SHOW_ORIGINAL, showOriginal)
        sourceLang = intent.getStringExtra(EXTRA_SOURCE_LANG) ?: sourceLang
        targetLang = intent.getStringExtra(EXTRA_TARGET_LANG) ?: targetLang
        translate = intent.getBooleanExtra(EXTRA_TRANSLATE, translate)

        originalView?.setTextSize(TypedValue.COMPLEX_UNIT_SP, fontSize.toFloat())
        translatedView?.setTextSize(
            TypedValue.COMPLEX_UNIT_SP,
            (fontSize - 1).coerceAtLeast(11).toFloat()
        )

        try {
            val color = Color.parseColor(textColor)
            originalView?.setTextColor(color)
        } catch (_: IllegalArgumentException) {
            originalView?.setTextColor(Color.WHITE)
        }

        overlayView?.background = roundedBackground(backgroundOpacity)

        layoutParams?.let { params ->
            when (position) {
                "top" -> {
                    params.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    params.y = dp(80)
                }
                "center" -> {
                    params.gravity = Gravity.CENTER
                    params.y = 0
                }
                else -> {
                    params.gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                    params.y = dp(150)
                }
            }
            overlayView?.let {
                try {
                    windowManager.updateViewLayout(it, params)
                } catch (_: Exception) {
                    // No-op.
                }
            }
        }

        render()
    }

    private fun roundedBackground(opacityPercent: Int): GradientDrawable {
        val alpha = (opacityPercent.coerceIn(0, 100) * 255) / 100
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(14).toFloat()
            setColor(Color.argb(alpha, 2, 6, 23))
            setStroke(dp(1), Color.argb(60, 255, 255, 255))
        }
    }

    /** Append a finalized phrase and keep the last few lines visible together. */
    private fun rememberOriginal(text: String): String? {
        val line = text.trim()
        if (line.isEmpty()) return null

        val delta: String
        if (originalLines.isEmpty()) {
            originalLines.addLast(line)
            delta = line
        } else {
            val previous = originalLines.last()
            val merged = mergeStreamingText(previous, line)
            when {
                merged == previous -> return null
                merged == normalizeCaption("$previous $line") -> {
                    originalLines.addLast(line)
                    delta = line
                }
                else -> {
                    // Cumulative result: the engine repeated earlier words.
                    originalLines[originalLines.lastIndex] = merged
                    delta = merged.removePrefix(previous).trim()
                }
            }
        }

        while (originalLines.size > maxCaptionLines) originalLines.removeFirst()
        currentOriginal = originalLines.joinToString(" ")
        // Keep earlier translations visible while the newest phrase is translated.
        currentTranslated = translatedLines.joinToString(" ")
        val result = delta.ifEmpty { null }
        if (result != null) appendRecorded(recordedOriginal, result)
        return result
    }

    /** Append a completed translation so converted captions also continue. */
    private fun rememberTranslated(text: String) {
        val line = text.trim()
        if (line.isEmpty()) return

        val delta: String
        if (translatedLines.isEmpty()) {
            translatedLines.addLast(line)
            delta = line
        } else {
            val previous = translatedLines.last()
            val merged = mergeStreamingText(previous, line)
            when {
                merged == previous -> return
                merged == normalizeCaption("$previous $line") -> {
                    translatedLines.addLast(line)
                    delta = line
                }
                else -> {
                    translatedLines[translatedLines.lastIndex] = merged
                    delta = merged.removePrefix(previous).trim()
                }
            }
        }

        while (translatedLines.size > maxCaptionLines) translatedLines.removeFirst()
        currentTranslated = translatedLines.joinToString(" ")
        val result = delta.ifEmpty { null }
        if (result != null) appendRecorded(recordedTranslated, result)
    }

    private fun appendRecorded(target: StringBuilder, text: String) {
        val line = text.trim()
        if (line.isEmpty()) return
        if (target.isNotEmpty()) target.append(' ')
        target.append(line)
    }

    /**
     * Opens a focusable dialog over the overlay. The floating window is
     * intentionally non-focusable (so Instagram keeps typing/scrolling behind
     * it), but the dialog can take focus and expose a selectable transcript.
     */
    private fun showTranscriptDialog() {
        val original = recordedOriginal.toString().trim()
        val translated = recordedTranslated.toString().trim()
        if (original.isEmpty() && translated.isEmpty()) {
            toast("Nothing recorded yet")
            return
        }

        val body = buildString {
            if (original.isNotEmpty()) {
                append("Original\n")
                append(original)
            }
            if (translated.isNotEmpty()) {
                if (isNotEmpty()) append("\n\n")
                append("Translated\n")
                append(translated)
            }
        }

        mainHandler.post {
            if (!isRunning) return@post

            val textView = TextView(this).apply {
                text = body
                setTextIsSelectable(true)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                setPadding(dp(18), dp(10), dp(18), dp(10))
            }
            val scroll = ScrollView(this).apply {
                addView(textView)
                setPadding(0, dp(6), 0, dp(6))
            }

            val dialog = AlertDialog.Builder(this)
                .setTitle("Recorded text")
                .setView(scroll)
                .setPositiveButton("Copy all") { _, _ -> copyTranscript(body) }
                .setNegativeButton("Close", null)
                .create()

            val dialogType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            dialog.window?.setType(dialogType)
            dialog.show()
        }
    }

    private fun copyTranscript(text: String) {
        try {
            val clipboard = getSystemService(CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("SubTranslate transcript", text))
            toast("Recorded text copied")
        } catch (_: Exception) {
            toast("Could not copy the transcript")
        }
    }

    private fun toast(message: String) {
        mainHandler.post {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun clearTranscript() {
        originalLines.clear()
        translatedLines.clear()
        recordedOriginal.setLength(0)
        recordedTranslated.setLength(0)
        currentOriginal = ""
        currentTranslated = ""
        render()
    }

    /** Show the live partial phrase after the finalized lines. */
    private fun showPartial(partial: String) {
        val line = partial.trim()
        val finished = originalLines.joinToString(" ")
        currentOriginal =
            if (line.isEmpty()) finished
            else mergeStreamingText(finished, line)
    }

    private fun normalizeCaption(value: String): String =
        value.replace(Regex("\\s+"), " ").trim()

    /** Compare words without surrounding punctuation so overlap detection is stable. */
    private fun captionWords(value: String): List<String> =
        value
            .split(Regex("\\s+"))
            .map { word ->
                word
                    .trim { it in ".,!?;:\"'“”‘’()[]{}—–-…" }
                    .lowercase()
            }
            .filter { it.isNotEmpty() }

    /**
     * Collapse cumulative recognizer output. SpeechRecognizer and Vosk often
     * re-send the whole phrase so far; appending it verbatim repeated every
     * earlier word. This keeps each spoken word on screen exactly once.
     */
    private fun mergeStreamingText(base: String, incoming: String): String {
        val current = normalizeCaption(base)
        val next = normalizeCaption(incoming)
        if (current.isEmpty()) return next
        if (next.isEmpty()) return current

        val currentWords = captionWords(current)
        val nextWords = captionWords(next)

        if (currentWords == nextWords) return current

        if (
            nextWords.size > currentWords.size &&
            nextWords.subList(0, currentWords.size) == currentWords
        ) {
            return next
        }

        if (
            currentWords.size > nextWords.size &&
            currentWords.subList(0, nextWords.size) == nextWords
        ) {
            return current
        }

        val maxOverlap = minOf(currentWords.size, nextWords.size, 16)
        for (size in maxOverlap downTo 2) {
            if (currentWords.subList(currentWords.size - size, currentWords.size) ==
                nextWords.subList(0, size)
            ) {
                val nextWordsOriginal = next.split(Regex("\\s+"))
                return normalizeCaption(
                    "$current ${nextWordsOriginal.drop(size).joinToString(" ")}"
                )
            }
        }

        // A lone word that is already the last word on screen is a duplicate.
        if (
            nextWords.size == 1 &&
            currentWords.isNotEmpty() &&
            currentWords.last() == nextWords.first()
        ) {
            return current
        }

        return "$current $next"
    }

    private fun render() {
        val original = if (currentOriginal.isBlank()) "Listening…" else currentOriginal
        originalView?.text = original
        originalView?.visibility = if (showOriginal || !translate) View.VISIBLE else View.GONE

        val hasTranslation = currentTranslated.isNotBlank()
        translatedView?.text = currentTranslated
        translatedView?.visibility =
            if (translate && hasTranslation) View.VISIBLE else View.GONE

        // Never render an empty card when translation is on but still pending.
        if (!showOriginal && translate && !hasTranslation) {
            originalView?.text = original
            originalView?.visibility = View.VISIBLE
        }
    }

    // ------------------------------------------------------------------
    // Foreground notification
    // ------------------------------------------------------------------

    private fun ensureForeground(mode: String) {
        val notification = buildNotification(mode)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val type = when {
                    mode == MODE_SYSTEM -> ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    else -> 0
                }
                if (type != 0) {
                    startForeground(NOTIFICATION_ID, notification, type)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            foregroundStarted = true
        } catch (error: Exception) {
            currentOriginal = "Could not start the caption service: ${error.message ?: "unknown error"}"
            currentTranslated = ""
            render()
            stopSelf()
        }
    }

    // ------------------------------------------------------------------
    // Microphone speech recognition
    // ------------------------------------------------------------------

    private fun createRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            currentOriginal = "Speech recognition is unavailable on this device."
            render()
            return
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this).also {
                it.setRecognitionListener(this)
            }
        }
    }

    private fun startListening() {
        if (!isRunning || captureMode != MODE_MIC) return
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            currentOriginal = "Microphone permission is required."
            render()
            return
        }
        createRecognizer()
        if (listening) return

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            if (sourceLang != "auto") {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, sourceLang)
            }
        }

        try {
            listening = true
            recognizer?.startListening(intent)
        } catch (_: Exception) {
            listening = false
            scheduleRestart(1200)
        }
    }

    private fun scheduleRestart(delayMs: Long = 450) {
        if (!isRunning || captureMode != MODE_MIC) return
        listening = false
        mainHandler.removeCallbacks(restartRunnable)
        mainHandler.postDelayed(restartRunnable, delayMs)
    }

    override fun onReadyForSpeech(params: android.os.Bundle?) {
        if (currentOriginal.isBlank() || currentOriginal == "Listening…") {
            currentOriginal = "Listening…"
            render()
        }
    }

    override fun onBeginningOfSpeech() = Unit
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit

    override fun onError(error: Int) {
        listening = false
        when (error) {
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> {
                currentOriginal = "Microphone permission denied."
                currentTranslated = ""
                render()
            }
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY,
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
            SpeechRecognizer.ERROR_CLIENT -> scheduleRestart()
            else -> scheduleRestart(1200)
        }
    }

    override fun onPartialResults(partialResults: android.os.Bundle?) {
        val text = partialResults
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.firstOrNull()
            ?.trim()
            .orEmpty()
        if (text.isNotEmpty()) {
            showPartial(text)
            render()
        }
    }

    override fun onResults(results: android.os.Bundle?) {
        val text = results
            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.firstOrNull()
            ?.trim()
            .orEmpty()

        if (text.isNotEmpty()) {
            val delta = rememberOriginal(text)
            if (delta != null) {
                render()
                translateLine(delta)
            }
        }
        scheduleRestart()
    }

    override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit

    private fun stopMicrophone() {
        listening = false
        mainHandler.removeCallbacks(restartRunnable)
        recognizer?.let {
            try {
                it.cancel()
                it.destroy()
            } catch (_: Exception) {
                // No-op.
            }
        }
        recognizer = null
    }

    // ------------------------------------------------------------------
    // System audio (MediaProjection + AudioPlaybackCapture + Vosk)
    // ------------------------------------------------------------------

    private fun startSystemAudioCapture(intent: Intent) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            currentOriginal = "System audio capture needs Android 10 or newer."
            render()
            return
        }

        val resultCode = intent.getIntExtra(EXTRA_PROJECTION_RESULT_CODE, Activity.RESULT_CANCELED)
        @Suppress("DEPRECATION")
        val data = intent.getParcelableExtra<Intent>(EXTRA_PROJECTION_DATA)
        if (resultCode != Activity.RESULT_OK || data == null) {
            currentOriginal = "Screen capture permission was denied."
            render()
            return
        }

        // Only one capture source at a time.
        stopMicrophone()
        stopSystemCapture()

        val manager = getSystemService(MediaProjectionManager::class.java)
        val projection = try {
            manager.getMediaProjection(resultCode, data)
        } catch (error: Exception) {
            currentOriginal = "Could not start system audio: ${error.message ?: "unknown error"}"
            render()
            return
        }

        mediaProjection = projection
        projection.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                mainHandler.post {
                    if (systemCaptureActive) {
                        currentOriginal = "Screen capture stopped."
                        currentTranslated = ""
                        render()
                    }
                }
            }
        }, mainHandler)

        systemCaptureActive = true
        setStatus("Preparing offline speech model…")
        captureThread = Thread { runSystemCapture(projection) }.apply {
            name = "SubTranslateAudio"
            start()
        }
    }

    private fun runSystemCapture(projection: MediaProjection) {
        var model: Model? = null
        var vosk: Recognizer? = null
        var record: AudioRecord? = null

        try {
            val language = voskLanguage()
            model = ensureModel(language) ?: return
            if (!isRunning || !systemCaptureActive) return

            setStatus("Loading speech model…")
            vosk = Recognizer(model, SAMPLE_RATE.toFloat())

            val minBuffer = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            if (minBuffer <= 0) {
                setStatus("This device cannot open the audio mixer.")
                return
            }

            val format = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(SAMPLE_RATE)
                .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                .build()

            val captureConfig = AudioPlaybackCaptureConfiguration.Builder(projection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()

            record = AudioRecord.Builder()
                .setAudioFormat(format)
                .setBufferSizeInBytes(minBuffer * 2)
                .setAudioPlaybackCaptureConfig(captureConfig)
                .build()

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                setStatus("Could not open system audio capture.")
                return
            }

            audioRecord = record
            record.startRecording()
            setStatus("Listening to app audio…")

            val buffer = ByteArray(4096)
            var silentBytes = 0L
            var heardAudio = false
            var silenceHintShown = false

            while (isRunning && systemCaptureActive) {
                val read = record.read(buffer, 0, buffer.size)
                if (read <= 0) {
                    if (read == AudioRecord.ERROR_DEAD_OBJECT) break
                    continue
                }

                var peak = 0
                var index = 0
                while (index + 1 < read) {
                    val sample = ((buffer[index + 1].toInt() shl 8) or
                        (buffer[index].toInt() and 0xFF)).toShort().toInt()
                    val amplitude = if (sample < 0) -sample else sample
                    if (amplitude > peak) peak = amplitude
                    index += 2
                }

                if (peak > 400) {
                    heardAudio = true
                    silentBytes = 0
                } else if (!heardAudio) {
                    // 16 kHz * 2 bytes = 32 bytes per millisecond.
                    silentBytes += read
                    if (!silenceHintShown && silentBytes > 32_000L * 8) {
                        silenceHintShown = true
                        setStatus("No app audio yet. If Instagram blocks capture, switch to microphone mode.")
                    }
                }

                if (vosk.acceptWaveForm(buffer, read)) {
                    val text = JSONObject(vosk.result).optString("text").trim()
                    if (text.isNotEmpty()) {
                        mainHandler.post {
                            val delta = rememberOriginal(text)
                            if (delta != null) {
                                render()
                                translateLine(delta)
                            }
                        }
                    }
                } else {
                    val partial = JSONObject(vosk.partialResult).optString("partial").trim()
                    if (partial.isNotEmpty()) {
                        mainHandler.post {
                            showPartial(partial)
                            render()
                        }
                    }
                }
            }
        } catch (error: Exception) {
            setStatus("System audio failed: ${error.message ?: "unknown error"}")
        } finally {
            systemCaptureActive = false
            try {
                record?.stop()
            } catch (_: Exception) {
                // Not recording.
            }
            try {
                record?.release()
            } catch (_: Exception) {
                // Already released.
            }
            audioRecord = null
            try {
                vosk?.close()
            } catch (_: Exception) {
                // Already closed.
            }
            try {
                model?.close()
            } catch (_: Exception) {
                // Already closed.
            }
            try {
                projection.stop()
            } catch (_: Exception) {
                // System already revoked it.
            }
            mediaProjection = null
        }
    }

    private fun stopSystemCapture() {
        systemCaptureActive = false
        try {
            audioRecord?.stop()
        } catch (_: Exception) {
            // Not recording.
        }
        try {
            mediaProjection?.stop()
        } catch (_: Exception) {
            // Already stopped.
        }
        mediaProjection = null
    }

    private fun voskLanguage(): String {
        val code = sourceLang.lowercase().substringBefore('-')
        return when (code) {
            "", "auto" -> "en"
            "zh" -> "cn"
            "vi" -> "vn"
            else -> code
        }
    }

    private fun ensureModel(language: String): Model? {
        val url = MODEL_URLS[language]
        if (url == null) {
            setStatus("No offline model for \"$language\". Use a supported source language or microphone mode.")
            return null
        }

        val modelDir = File(filesDir, "vosk-model-$language")
        val marker = File(modelDir, ".ready")

        if (!marker.exists()) {
            try {
                modelDir.deleteRecursively()
                modelDir.mkdirs()

                val archive = File(cacheDir, "vosk-model-$language.zip")
                setStatus("Downloading $language speech model…")
                download(url, archive)
                if (!isRunning || !systemCaptureActive) {
                    archive.delete()
                    return null
                }

                setStatus("Unpacking speech model…")
                unzip(archive, modelDir)
                archive.delete()
                marker.writeText("ok")
            } catch (error: Exception) {
                setStatus("Model download failed: ${error.message ?: "check your connection"}")
                return null
            }
        }

        return try {
            Model(modelDir.absolutePath)
        } catch (error: Exception) {
            setStatus("Could not load the speech model: ${error.message ?: "unknown error"}")
            modelDir.deleteRecursively()
            null
        }
    }

    private fun download(url: String, destination: File) {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        connection.instanceFollowRedirects = true
        try {
            val total = connection.contentLength.toLong()
            var downloaded = 0L
            var lastPercent = -1

            connection.inputStream.use { input ->
                destination.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        if (!isRunning || !systemCaptureActive) return
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        downloaded += read
                        if (total > 0) {
                            val percent = ((downloaded * 100) / total).toInt()
                            if (percent - lastPercent >= 2) {
                                lastPercent = percent
                                setStatus("Downloading speech model… $percent%")
                            }
                        }
                    }
                }
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun unzip(archive: File, target: File) {
        ZipInputStream(BufferedInputStream(FileInputStream(archive))).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val parts = entry.name.split('/', limit = 2)
                if (parts.size == 2 && parts[1].isNotEmpty()) {
                    val output = File(target, parts[1])
                    val canonical = output.canonicalFile
                    val root = target.canonicalPath + File.separator
                    if (canonical.path.startsWith(root)) {
                        if (entry.isDirectory) {
                            canonical.mkdirs()
                        } else {
                            canonical.parentFile?.mkdirs()
                            FileOutputStream(canonical).use { out -> zip.copyTo(out) }
                        }
                    }
                }
                zip.closeEntry()
            }
        }
    }

    private fun setStatus(text: String) {
        mainHandler.post {
            if (!isRunning) return@post
            currentOriginal = text
            currentTranslated = ""
            render()
        }
    }

    // ------------------------------------------------------------------
    // Free translation: MyMemory -> Google fallback, with a local cache.
    // The overlay keeps translating for the whole session; a provider quota
    // hit switches to the next provider instead of stopping captions.
    // ------------------------------------------------------------------

    private fun translateLine(text: String) {
        if (!translate || targetLang == "none") return
        val target = isoCode(targetLang)
        val source = if (sourceLang == "auto") "auto" else isoCode(sourceLang)
        if (source != "auto" && source == target) return

        val cacheKey = "$source|$target|$text"
        synchronized(translationCache) { translationCache[cacheKey] }?.let { cached ->
            rememberTranslated(cached)
            render()
            return
        }

        translationExecutor.execute {
            val translated = translateText(text, source, target) ?: return@execute
            synchronized(translationCache) { translationCache[cacheKey] = translated }
            mainHandler.post {
                if (!isRunning) return@post
                rememberTranslated(translated)
                render()
            }
        }
    }

    private fun translateText(text: String, source: String, target: String): String? {
        val chunks = chunkText(text.trim(), 450)
        if (chunks.isEmpty()) return null

        val parts = ArrayList<String>(chunks.size)
        for (chunk in chunks) {
            val part = translateChunk(chunk, source, target) ?: return null
            parts.add(part)
        }
        return parts.joinToString(" ").trim().ifEmpty { null }
    }

    /** MyMemory rejects queries above ~500 bytes, so split long phrases on words. */
    private fun chunkText(text: String, maxChars: Int): List<String> {
        if (text.length <= maxChars) return listOf(text)

        val chunks = mutableListOf<String>()
        val current = StringBuilder()
        for (word in text.split(Regex("\\s+"))) {
            if (current.isNotEmpty() && current.length + 1 + word.length > maxChars) {
                chunks.add(current.toString())
                current.setLength(0)
            }
            if (current.isNotEmpty()) current.append(' ')
            current.append(word)
        }
        if (current.isNotEmpty()) chunks.add(current.toString())
        return chunks
    }

    private fun translateChunk(text: String, source: String, target: String): String? {
        if (System.currentTimeMillis() >= myMemoryBlockedUntil) {
            translateWithMyMemory(text, source, target)?.let { return it }
        }
        return translateWithGoogle(text, source, target)
    }

    private fun translateWithMyMemory(text: String, source: String, target: String): String? {
        val sourceCode = if (source == "auto") guessSourceLanguage() else isoCode(source)
        val targetCode = isoCode(target)
        if (sourceCode == targetCode) return text

        return try {
            val query = URLEncoder.encode(text, "UTF-8")
            val pair = URLEncoder.encode("$sourceCode|$targetCode", "UTF-8")
            val url = URL("https://api.mymemory.translated.net/get?q=$query&langpair=$pair")
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 4000
            connection.readTimeout = 4000
            connection.requestMethod = "GET"
            try {
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val translated = JSONObject(body)
                    .optJSONObject("responseData")
                    ?.optString("translatedText")
                    ?.trim()
                    .orEmpty()

                when {
                    translated.isEmpty() -> null
                    translated.contains("MYMEMORY WARNING", ignoreCase = true) -> {
                        // Free quota exhausted for now; use the other provider and
                        // retry MyMemory later instead of hammering it.
                        myMemoryBlockedUntil = System.currentTimeMillis() + 15 * 60 * 1000
                        null
                    }
                    translated.contains("QUERY LENGTH LIMIT", ignoreCase = true) -> null
                    translated.contains("PLEASE SELECT TWO DISTINCT", ignoreCase = true) -> null
                    translated.contains("INVALID LANGUAGE", ignoreCase = true) -> null
                    else -> decodeEntities(translated)
                }
            } finally {
                connection.disconnect()
            }
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Free Google web endpoint used as a second provider. It accepts `auto` as
     * the source language and has no API key, which keeps long sessions alive
     * after MyMemory's anonymous quota is used up.
     */
    private fun translateWithGoogle(text: String, source: String, target: String): String? {
        return try {
            val query = URLEncoder.encode(text, "UTF-8")
            val sl = if (source == "auto") "auto" else isoCode(source)
            val url = URL(
                "https://translate.googleapis.com/translate_a/single" +
                    "?client=gtx&sl=$sl&tl=${isoCode(target)}&dt=t&q=$query"
            )
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 4000
            connection.readTimeout = 4000
            connection.requestMethod = "GET"
            try {
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val segments = JSONArray(body).optJSONArray(0) ?: return null
                val builder = StringBuilder()
                for (index in 0 until segments.length()) {
                    val item = segments.optJSONArray(index) ?: continue
                    val piece = item.optString(0)
                    if (piece.isNotEmpty()) builder.append(piece)
                }
                builder.toString().trim().ifEmpty { null }
            } finally {
                connection.disconnect()
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeEntities(text: String): String {
        return try {
            @Suppress("DEPRECATION")
            Html.fromHtml(text).toString()
        } catch (_: Exception) {
            text
        }
    }

    private fun guessSourceLanguage(): String {
        if (captureMode == MODE_SYSTEM) return voskLanguage()
        val language = Locale.getDefault().language.lowercase()
        return if (language.isBlank()) "en" else isoCode(language)
    }

    private fun isoCode(code: String): String {
        return when {
            code.startsWith("zh") -> "zh-CN"
            code.startsWith("pt") -> "pt"
            code.startsWith("fil") -> "tl"
            else -> code.substringBefore('-')
        }
    }

    // ------------------------------------------------------------------
    // Notification lifecycle
    // ------------------------------------------------------------------

    private fun buildNotification(mode: String): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Floating captions",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Keeps SubTranslate captions above other apps"
                    setShowBadge(false)
                }
                manager.createNotificationChannel(channel)
            }
        }

        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, SubtitleOverlayService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this,
                2,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        val text = if (mode == MODE_SYSTEM) {
            "Hearing this app's audio and transcribing on-device"
        } else {
            "Floating subtitles are running over your apps"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SubTranslate captions are live")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentIntent)
            .addAction(0, "Stop", stopIntent)
            .build()
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    override fun onDestroy() {
        isRunning = false
        listening = false
        mainHandler.removeCallbacks(restartRunnable)

        stopMicrophone()
        stopSystemCapture()

        translationExecutor.shutdownNow()

        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (_: Exception) {
                // Already detached.
            }
        }
        overlayView = null

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        super.onDestroy()
    }
}
