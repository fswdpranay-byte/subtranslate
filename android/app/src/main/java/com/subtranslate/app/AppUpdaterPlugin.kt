package com.subtranslate.app

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

/**
 * Downloads the rolling debug APK from the GitHub release and hands it to the
 * Android package installer. Android always shows its own confirmation screen;
 * after that the new APK updates in place because every CI build uses the same
 * debug signing key.
 */
@CapacitorPlugin(name = "AppUpdater")
class AppUpdaterPlugin : Plugin() {

    private val handler = Handler(Looper.getMainLooper())

    @PluginMethod
    fun canInstall(call: PluginCall) {
        call.resolve(JSObject().put("allowed", canInstallPackages()))
    }

    @PluginMethod
    fun downloadAndInstall(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("Missing APK download URL.")
            return
        }

        if (!canInstallPackages()) {
            openInstallPermissionSettings()
            call.resolve(
                JSObject()
                    .put("started", false)
                    .put("needsPermission", true)
            )
            return
        }

        val downloads = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        if (downloads == null) {
            call.reject("This device has no writable download folder.")
            return
        }

        try {
            val target = File(downloads, "subtranslate-update.apk")
            if (target.exists()) target.delete()

            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle("SubTranslate update")
                .setDescription("Downloading the latest APK…")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                )
                .setDestinationInExternalFilesDir(
                    context,
                    Environment.DIRECTORY_DOWNLOADS,
                    target.name
                )

            val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val id = manager.enqueue(request)

            call.resolve(JSObject().put("started", true).put("downloadId", id))
            waitForDownload(manager, id, target, 0)
        } catch (error: Exception) {
            call.reject("Could not start the download: ${error.message}", error)
        }
    }

    private fun waitForDownload(
        manager: DownloadManager,
        id: Long,
        target: File,
        attempt: Int
    ) {
        if (attempt > 360) return // ~6 minutes, then give up quietly.

        handler.postDelayed({
            val cursor = manager.query(DownloadManager.Query().setFilterById(id))
            if (cursor == null) {
                waitForDownload(manager, id, target, attempt + 1)
                return@postDelayed
            }

            cursor.use {
                if (!it.moveToFirst()) {
                    waitForDownload(manager, id, target, attempt + 1)
                    return@postDelayed
                }

                val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> installApk(target)
                    DownloadManager.STATUS_FAILED -> Unit
                    else -> waitForDownload(manager, id, target, attempt + 1)
                }
            }
        }, 1000)
    }

    private fun installApk(file: File) {
        if (!file.exists() || file.length() == 0L) return

        try {
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION or
                        Intent.FLAG_ACTIVITY_NEW_TASK
                )
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            // The download stays in the app folder; the user can retry from Settings.
        }
    }

    private fun canInstallPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            context.packageManager.canRequestPackageInstalls()
    }

    private fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (_: Exception) {
            // Some OEMs hide this screen; the browser download still works.
        }
    }

    override fun handleOnDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.handleOnDestroy()
    }
}
