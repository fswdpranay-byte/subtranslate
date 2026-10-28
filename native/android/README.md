# Native Android overlay (optional but recommended)

This folder contains the reference Kotlin implementation for the real
system-wide floating subtitle service used by the Play Store build.

The web app already ships a **PWA overlay simulator**, so you can finish the
frontend and onboarding without touching Android. Add these files when you are
ready to test on a device.

## What is included

| File | Purpose |
| --- | --- |
| `SubtitleOverlayPlugin.kt` | Capacitor plugin exposed as `SubtitleOverlay` (permission checks, start/stop/update). |
| `SubtitleOverlayService.kt` | Foreground service + WindowManager overlay + `SpeechRecognizer` + free MyMemory translation. |
| `MainActivity.kt` | Registers the plugin before `super.onCreate()`. |
| `AndroidManifest.additions.xml` | Permissions + foreground service declaration. |

## Install into a generated Android project

```bash
npm run build:pwa
npx cap add android
```

Then copy the Kotlin sources:

```text
native/android/app/src/main/java/com/subtranslate/app/MainActivity.kt
  -> android/app/src/main/java/com/subtranslate/app/MainActivity.kt

native/android/app/src/main/java/com/subtranslate/app/SubtitleOverlayPlugin.kt
  -> android/app/src/main/java/com/subtranslate/app/SubtitleOverlayPlugin.kt

native/android/app/src/main/java/com/subtranslate/app/SubtitleOverlayService.kt
  -> android/app/src/main/java/com/subtranslate/app/SubtitleOverlayService.kt
```

Merge the permissions and `<service>` entry from
`AndroidManifest.additions.xml` into
`android/app/src/main/AndroidManifest.xml`.

Then:

```bash
npx cap sync android
npx cap open android
```

Run on a physical device (overlays do not work reliably on emulators for all
OEMs) and grant:

1. Microphone
2. Notifications (Android 13+)
3. Display over other apps (system settings screen)

## How it behaves

- The service starts in the foreground with a **Stop** action in the
  notification.
- A draggable subtitle card is added through `WindowManager` with
  `TYPE_APPLICATION_OVERLAY`.
- `SpeechRecognizer` listens continuously (restarted after each final result or
  recoverable error).
- Final lines are translated with MyMemory when translation is enabled.
- Styling changes from the web app (`update`) are applied live.

## Production caveats

- `SpeechRecognizer` is provided by Google/OEM services and its availability,
  language packs and offline support vary. If you need guaranteed offline
  transcription on Android, wire `whisper.cpp` via JNI or run a local ONNX model
  and replace the recognition section.
- Android 14+ requires `FOREGROUND_SERVICE_MICROPHONE` and a matching
  `foregroundServiceType="microphone"`.
- OEM battery optimisation can kill background services. Document how users can
  exempt SubTranslate from battery restrictions.
- Continuous recognition is battery intensive; stop the service when the
  overlay is closed.
- The API key-free MyMemory endpoint has a quota. For production, proxy
  translation through your own Supabase Edge Function or a self-hosted
  LibreTranslate instance.
- Google Play requires a clear in-app disclosure and prominent consent for
  microphone + overlay usage. Complete the Data safety form accurately.

See `../../ANDROID_GUIDE.md` for the release bundle and Play Console walkthrough.
