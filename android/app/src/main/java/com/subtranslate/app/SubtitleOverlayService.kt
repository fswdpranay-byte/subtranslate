package com.subtranslate.app

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/**
 * Reference implementation of the Android floating subtitle service.
 *
 * It runs a foreground service with SpeechRecognizer and draws a draggable
 * WindowManager overlay above other apps. Final lines are optionally translated
 * with the same free MyMemory endpoint used by the web app.
 *
 * IMPORTANT: This is a scaffold intended to be compiled in Android Studio and
 * tuned to your Play policy requirements. Continuous speech recognition battery
 * behaviour and OEM background restrictions vary by device.
 */
class SubtitleOverlayService : Service(), RecognitionListener {

    companion object {
        const val ACTION_START = "com.subtranslate.app.overlay.START"
        const val ACTION_STOP = "com.subtranslate.app.overlay.STOP"
        const val ACTION_UPDATE = "com.subtranslate.app.overlay.UPDATE"

        const val EXTRA_FONT_SIZE = "fontSize"
        const val EXTRA_BG_OPACITY = "backgroundOpacity"
        const val EXTRA_TEXT_COLOR = "textColor"
        const val EXTRA_POSITION = "position"
        const val EXTRA_SHOW_ORIGINAL = "showOriginal"
        const val EXTRA_SOURCE_LANG = "sourceLang"
        const val EXTRA_TARGET_LANG = "targetLang"
        const val EXTRA_TRANSLATE = "translate"

        private const val CHANNEL_ID = "subtranslate_overlay"
        private const val NOTIFICATION_ID = 4242

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

    private var fontSize = 18
    private var backgroundOpacity = 72
    private var textColor = "#FFFFFF"
    private var position = "bottom"
    private var showOriginal = true
    private var sourceLang = "auto"
    private var targetLang = "en"
    private var translate = true

    private var currentOriginal = ""
    private var currentTranslated = ""

    private val mainHandler = Handler(Looper.getMainLooper())
    private val translationExecutor = Executors.newSingleThreadExecutor()
    private val restartRunnable = Runnable { if (isRunning) startListening() }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        startForeground(NOTIFICATION_ID, buildNotification())
        isRunning = true
        createOverlay()
        createRecognizer()
        currentOriginal = "Listening…"
        render()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> applyStyle(intent)
            ACTION_START -> {
                applyStyle(intent)
                startListening()
            }
            else -> startListening()
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

        val close = TextView(this).apply {
            text = "✕"
            setTextColor(Color.parseColor("#94A3B8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            gravity = Gravity.END
            setPadding(0, 0, 0, dp(2))
            setOnClickListener { stopSelf() }
        }

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

        container.addView(close)
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
    // Speech recognition
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
        if (!isRunning) return
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
        if (!isRunning) return
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
            currentOriginal = text
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
            currentOriginal = text
            currentTranslated = ""
            render()
            translateLine(text)
        }
        scheduleRestart()
    }

    override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit

    // ------------------------------------------------------------------
    // Free translation (MyMemory) — swap for a Supabase Edge Function later
    // ------------------------------------------------------------------

    private fun translateLine(text: String) {
        if (!translate || targetLang == "none") return
        val source = if (sourceLang == "auto") "en" else isoCode(sourceLang)
        val target = isoCode(targetLang)
        if (source == target) return

        translationExecutor.execute {
            try {
                val query = URLEncoder.encode(text, "UTF-8")
                val url = URL(
                    "https://api.mymemory.translated.net/get?q=$query&langpair=$source|$target"
                )
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 6000
                connection.readTimeout = 6000
                connection.requestMethod = "GET"
                try {
                    val body = connection.inputStream.bufferedReader().use { it.readText() }
                    val translated = JSONObject(body)
                        .optJSONObject("responseData")
                        ?.optString("translatedText")
                        ?.trim()
                        .orEmpty()

                    if (translated.isNotEmpty() && !translated.startsWith("MYMEMORY WARNING")) {
                        mainHandler.post {
                            currentTranslated = translated
                            render()
                        }
                    }
                } finally {
                    connection.disconnect()
                }
            } catch (_: Exception) {
                // Keep the original caption visible; translation is best-effort.
            }
        }
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

    private fun buildNotification(): Notification {
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

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SubTranslate captions are live")
            .setContentText("Floating subtitles are running over your apps")
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

        recognizer?.let {
            try {
                it.cancel()
                it.destroy()
            } catch (_: Exception) {
                // No-op.
            }
        }
        recognizer = null

        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (_: Exception) {
                // Already detached.
            }
        }
        overlayView = null

        translationExecutor.shutdownNow()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        super.onDestroy()
    }
}
