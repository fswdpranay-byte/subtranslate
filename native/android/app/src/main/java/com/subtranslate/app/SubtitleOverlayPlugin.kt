package com.subtranslate.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Bridges the web layer to the Android floating-overlay service.
 *
 * `Display over other apps` is a special app-op, not a runtime permission, so it
 * has to be granted on a system settings screen. Microphone is a normal runtime
 * permission and is requested here. System-audio capture uses the standard
 * MediaProjection consent dialog and is forwarded to the foreground service.
 */
@CapacitorPlugin(
    name = "SubtitleOverlay",
    permissions = [
        Permission(
            alias = "microphone",
            strings = [Manifest.permission.RECORD_AUDIO]
        ),
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class SubtitleOverlayPlugin : Plugin() {

    private fun canDrawOverlays(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
    }

    @PluginMethod
    fun checkPermission(call: PluginCall) {
        call.resolve(JSObject().put("granted", canDrawOverlays()))
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        if (canDrawOverlays()) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        openOverlaySettings()
        call.resolve(JSObject().put("granted", false))
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        openOverlaySettings()
        call.resolve()
    }

    /**
     * Native microphone permission, used by onboarding and the dashboard.
     *
     * Android WebView `getUserMedia` is unreliable across OEM WebView builds, so
     * the web layer asks the Android runtime directly and then uses the native
     * speech service instead of the browser capture path.
     */
    @PluginMethod
    fun checkMicrophonePermission(call: PluginCall) {
        call.resolve(
            JSObject().put(
                "granted",
                getPermissionState("microphone") == PermissionState.GRANTED
            )
        )
    }

    @PluginMethod
    fun requestMicrophonePermission(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAlias("microphone", call, "microphoneCallback")
    }

    @PermissionCallback
    private fun microphoneCallback(call: PluginCall) {
        // Resolve instead of rejecting so the web layer can show Android-specific
        // "open app settings" guidance after a permanent denial.
        call.resolve(
            JSObject().put(
                "granted",
                getPermissionState("microphone") == PermissionState.GRANTED
            )
        )
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            val intent = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:${context.packageName}")
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (error: Exception) {
            call.reject(error.message ?: "Could not open Android app settings.")
        }
    }

    @PluginMethod
    fun isSystemAudioSupported(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("supported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
        )
    }

    private fun openOverlaySettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (_: Exception) {
            // Some OEMs hide this screen; the user can find it in app settings.
        }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (!canDrawOverlays()) {
            call.reject("Enable \"Display over other apps\" for SubTranslate first.")
            return
        }

        // AudioPlaybackCapture (system mode) also needs RECORD_AUDIO, and the
        // foreground notification needs POST_NOTIFICATIONS on Android 13+.
        val missing = mutableListOf<String>()
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            missing.add("microphone")
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            missing.add("notifications")
        }

        if (missing.isNotEmpty()) {
            requestPermissionForAliases(missing.toTypedArray(), call, "permissionsCallback")
            return
        }
        beginStart(call)
    }

    private fun beginStart(call: PluginCall) {
        val mode = call.getString("captureMode") ?: SubtitleOverlayService.MODE_MIC
        if (mode == SubtitleOverlayService.MODE_SYSTEM) {
            startSystemAudio(call)
        } else {
            launchService(call, SubtitleOverlayService.ACTION_START)
        }
    }

    @PermissionCallback
    private fun permissionsCallback(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            beginStart(call)
        } else {
            call.reject("Microphone permission is required to capture app audio.")
        }
    }

    private fun startSystemAudio(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("System audio capture requires Android 10 or newer.")
            return
        }
        try {
            val manager = context.getSystemService(MediaProjectionManager::class.java)
            startActivityForResult(
                call,
                manager.createScreenCaptureIntent(),
                "projectionResult"
            )
        } catch (error: Exception) {
            call.reject(error.message ?: "Could not open the screen-capture prompt.")
        }
    }

    @ActivityCallback
    private fun projectionResult(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.reject("Screen capture permission is required to hear Instagram audio.")
            return
        }
        launchService(
            call,
            SubtitleOverlayService.ACTION_START,
            result.resultCode,
            result.data
        )
    }

    @PluginMethod
    fun update(call: PluginCall) {
        if (!canDrawOverlays()) {
            call.reject("Overlay permission was revoked.")
            return
        }
        launchService(call, SubtitleOverlayService.ACTION_UPDATE)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        context.stopService(Intent(context, SubtitleOverlayService::class.java))
        call.resolve()
    }

    @PluginMethod
    fun isRunning(call: PluginCall) {
        call.resolve(JSObject().put("running", SubtitleOverlayService.isRunning))
    }

    private fun launchService(
        call: PluginCall,
        action: String,
        projectionResultCode: Int = Activity.RESULT_CANCELED,
        projectionData: Intent? = null
    ) {
        try {
            val mode = call.getString("captureMode") ?: SubtitleOverlayService.MODE_MIC
            val intent = Intent(context, SubtitleOverlayService::class.java).apply {
                this.action = action
                putExtra(SubtitleOverlayService.EXTRA_CAPTURE_MODE, mode)
                if (projectionData != null) {
                    putExtra(SubtitleOverlayService.EXTRA_PROJECTION_RESULT_CODE, projectionResultCode)
                    putExtra(SubtitleOverlayService.EXTRA_PROJECTION_DATA, projectionData)
                }
            }
            call.data?.let { data ->
                intent.putExtra(SubtitleOverlayService.EXTRA_FONT_SIZE, data.optInt("fontSize", 18))
                intent.putExtra(SubtitleOverlayService.EXTRA_BG_OPACITY, data.optInt("backgroundOpacity", 72))
                intent.putExtra(SubtitleOverlayService.EXTRA_TEXT_COLOR, data.optString("textColor", "#FFFFFF"))
                intent.putExtra(SubtitleOverlayService.EXTRA_POSITION, data.optString("position", "bottom"))
                intent.putExtra(SubtitleOverlayService.EXTRA_SHOW_ORIGINAL, data.optBoolean("showOriginal", true))
                intent.putExtra(SubtitleOverlayService.EXTRA_SOURCE_LANG, data.optString("sourceLang", "auto"))
                intent.putExtra(SubtitleOverlayService.EXTRA_TARGET_LANG, data.optString("targetLang", "en"))
                intent.putExtra(SubtitleOverlayService.EXTRA_TRANSLATE, data.optBoolean("translate", true))
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            call.resolve()
        } catch (error: Exception) {
            call.reject(error.message ?: "Could not start the overlay service.")
        }
    }
}
