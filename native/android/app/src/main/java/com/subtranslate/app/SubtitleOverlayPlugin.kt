package com.subtranslate.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Bridges the web layer to the Android floating-overlay service.
 *
 * `Display over other apps` is a special app-op, not a runtime permission, so it
 * has to be granted on a system settings screen. Microphone is a normal runtime
 * permission and is requested here.
 */
@CapacitorPlugin(
    name = "SubtitleOverlay",
    permissions = [
        Permission(
            alias = "microphone",
            strings = [Manifest.permission.RECORD_AUDIO]
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
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphoneCallback")
            return
        }
        launchService(call, SubtitleOverlayService.ACTION_START)
    }

    @PermissionCallback
    private fun microphoneCallback(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            launchService(call, SubtitleOverlayService.ACTION_START)
        } else {
            call.reject("Microphone permission is required for the floating captions.")
        }
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

    private fun launchService(call: PluginCall, action: String) {
        try {
            val intent = Intent(context, SubtitleOverlayService::class.java).apply {
                this.action = action
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
