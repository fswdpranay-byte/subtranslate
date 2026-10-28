# Native Android overlay

This folder contains a reference copy of the Kotlin implementation for the real
system-wide floating subtitle service used by the Android build. The live copy
is already installed in `android/app/src/main/java/com/subtranslate/app/`.

The web app also ships a **PWA overlay simulator**, so you can preview the card
without an Android device.

## What is included

| File | Purpose |
| --- | --- |
| `SubtitleOverlayPlugin.kt` | Capacitor plugin exposed as `SubtitleOverlay` (permission checks, MediaProjection consent, start/stop/update). |
| `SubtitleOverlayService.kt` | Foreground service + WindowManager overlay + two capture modes + free MyMemory translation. |
| `MainActivity.kt` | Registers the plugin before `super.onCreate()`. |
| `AndroidManifest.additions.xml` | Permissions + foreground service declaration. |

## Capture modes

| Mode | How it works | Requirements |
| --- | --- | --- |
| `microphone` | Android `SpeechRecognizer` listens to the mic. | Mic permission. Works on Android 6+. |
| `system` | `MediaProjection` + `AudioPlaybackCapture` captures the audio another app (Instagram, TikTok, YouTube…) is playing, transcribed on-device by **Vosk**. | Android 10+, screen-capture consent. First run downloads a small (~40–80 MB) offline model for the source language. |

System mode is what lets SubTranslate transcribe Instagram videos directly. The
sound does not need to reach the microphone, so headphones and low volume work.
Apps can opt out of playback capture (DRM/protected audio usually does); if
Instagram produces no audio on a specific device, the overlay shows a hint to
switch to microphone mode.

Audio never leaves the device in either mode. Only translated text is sent to
the free translation endpoint, and only when translation is enabled.

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
`android/app/src/main/AndroidManifest.xml`, and add the Vosk dependency:

```gradle
dependencies {
    implementation 'com.alphacephei:vosk-android:0.3.47'
}
```

Then:

```bash
npx cap sync android
npx cap open android
```

Run on a physical device (overlays do not work reliably on emulators for all
OEMs) and grant:

1. Microphone (microphone mode)
2. Notifications (Android 13+)
3. Display over other apps (system settings screen)
4. Screen-capture consent (system mode, each session)

## How it behaves

- The service starts in the foreground with a **Stop** action in the
  notification.
- A draggable subtitle card is added through `WindowManager` with
  `TYPE_APPLICATION_OVERLAY`.
- Microphone mode restarts `SpeechRecognizer` after each final result or
  recoverable error.
- System mode feeds 16 kHz PCM from `AudioPlaybackCapture` into Vosk and shows
  partial results continuously.
- Final lines are translated with MyMemory when translation is enabled.
- Styling changes from the web app (`update`) are applied live.

## Production caveats

- `SpeechRecognizer` is provided by Google/OEM services and its availability,
  language packs and offline support vary.
- Vosk small models cover ~28 languages. Languages without a small model fall
  back to an error message; use microphone mode for those.
- Android 14+ requires `FOREGROUND_SERVICE_MICROPHONE` /
  `FOREGROUND_SERVICE_MEDIA_PROJECTION` and matching `foregroundServiceType`.
- OEM battery optimisation can kill background services. Document how users can
  exempt SubTranslate from battery restrictions.
- Continuous recognition is battery intensive; stop the service when the
  overlay is closed.
- The API key-free MyMemory endpoint has a quota. For production, proxy
  translation through your own Supabase Edge Function or a self-hosted
  LibreTranslate instance.
- Google Play requires a clear in-app disclosure and prominent consent for
  microphone, screen capture and overlay usage. Complete the Data safety form
  accurately.

See `../../ANDROID_GUIDE.md` for the release bundle and Play Console walkthrough.
