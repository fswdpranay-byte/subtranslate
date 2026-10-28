package com.subtranslate.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * Capacitor entry Activity.
 *
 * Plugins must be registered BEFORE super.onCreate() so the bridge can expose
 * them to the web layer on first load.
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SubtitleOverlayPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
