# SubTranslate — Android Build & Play Store Guide

This guide takes the web/PWA project in this repo and produces a signed **Android App Bundle (`.aab`)** that you can upload to Google Play. Everything here can be done with free tools: Android Studio, the Android SDK, and a locally generated signing key.

The app has two layers:

| Layer | Tech | What it gives you |
| --- | --- | --- |
| App shell / UI | React + Vite + Capacitor | Dashboard, onboarding, settings, PWA install, in-browser overlay simulator |
| Native overlay | Kotlin (`android/app/src/main/java/com/subtranslate/app/`) | True system-wide floating subtitles over Instagram, TikTok, YouTube, etc. |

The UI alone is fully usable as a PWA. The native layer is optional until you want the real "display over other apps" experience.

---

## 1. Prerequisites

Install these once:

1. **Node.js 20+** (you already have it — `node -v`).
2. **JDK 17** — Android Gradle Plugin 8.x requires 17. Android Studio ships with a JBR 17; use that if you do not want a separate install.
3. **Android Studio** (free) with:
   - Android SDK Platform **34** (or newer)
   - Android SDK Build-Tools
   - Android SDK Platform-Tools (for `adb`)
   - An emulator or, preferably, a **physical Android device** with USB debugging enabled.
4. A **Google Play Developer account** (one-time **$25** fee). This is the only paid component in the whole stack and is only needed to publish; sideloading/signing/building is free.

Verify the toolchain:

```powershell
java -version          # should report 17.x
node -v
npm -v
```

If `java -version` shows a different major version, set `JAVA_HOME` to the JDK 17 folder before running Gradle. In Android Studio: **File → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK → 17**.

---

## 2. Build the web app and sync the Android platform

The `android/` project is **already committed** to this repository, including the Kotlin overlay sources, manifest entries, Gradle/Kotlin setup, and launcher icons. You do not need to regenerate it.

From the repository root:

```powershell
npm install
npm run build:pwa
npm run cap:sync android
```

What happens:

- `build:pwa` runs `tsc --noEmit && vite build`, producing `dist/` including `sw.js`, `manifest.webmanifest` and the app shell.
- `cap:sync android` copies `dist/` and the plugin config into `android/app/src/main/assets/public`.

If you ever delete `android/` and need to regenerate it, run `npm run cap:add:android`, then restore the native files from `native/android/` (see §3) and re-apply the manifest, Gradle, and icon changes.

`cap:build` is the command to use after every frontend change — it rebuilds `dist/` and copies it (plus plugin config) into `android/app/src/main/assets/public`.

> If `cap:add:android` fails with "android platform already exists", the folder is already generated — skip straight to `npm run cap:build`.

### 2b. Build a debug APK without installing Android Studio

The repo includes `.github/workflows/android.yml`, which builds a debug APK on GitHub's free runners (JDK 17 + Android SDK are preinstalled). This is the fastest way to get an installable APK on a phone.

1. Push a change to `main` (or open **Actions → Android debug APK → Run workflow**).
2. Wait for the green check (~4–6 minutes on the first run).
3. Download the rolling build directly:

   <https://github.com/fswdpranay-byte/subtranslate/releases/download/android-latest/subtranslate-debug.apk>

   You can also open the run → **Artifacts** → **`subtranslate-debug-apk`**.
4. Install it on the phone (enable "Install unknown apps" for your browser/file manager).
5. Grant **microphone**, **notifications**, and **Display over other apps** when the app asks.

Once installed, later builds arrive in-app: Settings → **App updates** → **Check for updates**, then **Download & install**. CI stamps each APK with a monotonic `versionCode` (`github.run_number`) and publishes it in the release notes, which is what the app compares against.

> CI debug builds are signed with `android/app/debug.p12`, a fixed **debug-only** key committed to the repo, so each new build installs as an update. It cannot be used for Play. If you previously installed a build signed with a different key and Android says "App not installed", uninstall the old copy once.

Because that debug key is public, the `android-latest` APK is for testing only: treat it as an unsigned development build, install it only from this repository's releases, and never distribute it as a production app. Play uploads must use your own private release keystore (§5).

Debug APKs install over USB/download but are **not** accepted by Play. Use §5–6 for a signed release bundle.

---

## 3. Native overlay sources

These are already installed in `android/app/src/main/java/com/subtranslate/app/`. The repo also keeps a copy under `native/android/` so that regenerating `android/` never loses them.

If you regenerated the platform, copy the files back (create folders if needed):

```text
native/android/app/src/main/java/com/subtranslate/app/MainActivity.kt
  -> android/app/src/main/java/com/subtranslate/app/MainActivity.kt

native/android/app/src/main/java/com/subtranslate/app/SubtitleOverlayPlugin.kt
  -> android/app/src/main/java/com/subtranslate/app/SubtitleOverlayPlugin.kt

native/android/app/src/main/java/com/subtranslate/app/SubtitleOverlayService.kt
  -> android/app/src/main/java/com/subtranslate/app/SubtitleOverlayService.kt
```

PowerShell:

```powershell
$src = "native/android/app/src/main/java/com/subtranslate/app"
$dst = "android/app/src/main/java/com/subtranslate/app"
Copy-Item "$src/*.kt" $dst -Force
```

Capacitor's generated `MainActivity.kt` is replaced by ours, which registers the plugin:

```kotlin
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SubtitleOverlayPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

### Merge the manifest

The committed `android/app/src/main/AndroidManifest.xml` already contains these entries. If you regenerate the platform, add them **inside** the existing `<manifest>` element:

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />

<!-- Inside <application> -->
<service
    android:name=".SubtitleOverlayService"
    android:exported="false"
    android:foregroundServiceType="microphone|mediaProjection" />
```

Notes:

- Do **not** duplicate `INTERNET` or `RECORD_AUDIO` if Capacitor already added them; duplicate `<uses-permission>` entries are harmless but noisy.
- `SYSTEM_ALERT_WINDOW` is a special permission. It cannot be granted with a runtime dialog — the app must send the user to **Settings → Apps → Special app access → Display over other apps**. `requestOverlayPermission()` already does this.
- `POST_NOTIFICATIONS` is needed on Android 13+ so the foreground-service notification is visible.
- `foregroundServiceType="microphone|mediaProjection"` plus the matching `FOREGROUND_SERVICE_*` permissions is mandatory on Android 14+. Without them the service crashes at start on API 34.
- System-audio mode needs `android/app/build.gradle` to include the offline engine:
  ```gradle
  implementation 'com.alphacephei:vosk-android:0.3.47'
  ```
  It is already added. The `MediaProjection` consent prompt appears every time the user starts system-audio mode; that is an Android requirement, not a bug.

### Capture modes

| Mode | Hears | Requirements |
| --- | --- | --- |
| Microphone | Sound in the room (phone speaker) | Android 6+, mic permission |
| System audio | The audio Instagram/TikTok/YouTube is playing, even with headphones | Android 10+, screen-capture consent, one-time model download per source language |

Both modes transcribe on-device. Only translated text is sent to the free translation endpoint, and only when translation is on.

### Using system audio with Instagram

1. Install the Android build, open the app, and go to **Overlay**.
2. Set **Audio language** to the language of the reel. Vosk needs a specific language
   ("Auto-detect" falls back to English), so pick the real spoken language.
3. Set **Subtitle language** and enable translation if you want converted text.
4. Tap **Capture Instagram audio**, then:
   - Enable **Display over other apps** if Android opens that setting.
   - Allow **microphone** and **notifications** when asked. `RECORD_AUDIO` is required
     by Android's playback-capture API, and the notification keeps the service alive.
   - Accept Android's screen-capture prompt. On Android 14+ choose **Entire screen**
     (or select Instagram as the single app).
5. Wait for the first-run model download (~40–80 MB, shown in the floating card).
   It is cached, so later sessions start immediately.
6. Press Home and open Instagram. The floating caption card stays above the reel.
7. Play a reel. Captions follow the audio; you can drag the card, tap **Clear** to
   reset the transcript, or **✕** to stop.
8. Keep the SubTranslate foreground notification visible. On Xiaomi/Redmi, Samsung,
   Oppo, and Vivo also set battery usage to **Unrestricted** so Android does not kill
   the service while Instagram is open.

If the card says **"No app audio yet"** after several seconds, the app you are testing
has opted out of playback capture or the media is DRM-protected. Try a different reel,
raise the media volume, or use the microphone overlay with the phone speaker.

Then sync:

```powershell
npm run cap:build
npm run cap:open     # opens android/ in Android Studio
```

---

## 4. Configure app identity and version

In `android/app/build.gradle`:

```gradle
android {
    namespace "com.subtranslate.app"
    compileSdk rootProject.ext.compileSdkVersion   // 34

    defaultConfig {
        applicationId "com.subtranslate.app"
        minSdkVersion rootProject.ext.minSdkVersion    // 22
        targetSdkVersion rootProject.ext.targetSdkVersion // 34
        versionCode 1             // integer, increment on every Play upload
        versionName "1.0.0"       // user-visible version
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = '17' }
}
```

App name and launcher icon:

- Name: `android/app/src/main/res/values/strings.xml` → `<string name="app_name">SubTranslate</string>`
- Icons: run `npm run icons`. It regenerates the PWA icons **and**, when `android/` exists, the legacy, round, and adaptive launcher icons (foreground, background `#0F172A`) for every density.
- Splash: `@capacitor/splash-screen` config is already present in `capacitor.config.json` (background `#0F172A`).

Increase `versionCode` for **every** Play upload. Play rejects a bundle whose `versionCode` was already used.

---

## 5. Create a signing keystore (one time)

A `.aab` must be signed. Keep the keystore and passwords safe — losing them means you cannot publish updates under the same listing (unless you enrolled in Play App Signing and use the upload-key reset flow).

```powershell
keytool -genkeypair -v `
  -keystore subtranslate-upload.jks `
  -alias subtranslate `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass "CHANGE_ME_STORE_PASSWORD" `
  -keypass "CHANGE_ME_KEY_PASSWORD" `
  -dname "CN=SubTranslate, OU=Mobile, O=SubTranslate, L=City, ST=State, C=IN"
```

> Never commit `*.jks` or `keystore.properties`. They are already covered by `.gitignore`; double-check before pushing.

Create `android/keystore.properties` (not committed):

```properties
storeFile=../subtranslate-upload.jks
storePassword=CHANGE_ME_STORE_PASSWORD
keyAlias=subtranslate
keyPassword=CHANGE_ME_KEY_PASSWORD
```

`storeFile` is resolved relative to `android/app/`, so `../subtranslate-upload.jks` points at `android/subtranslate-upload.jks` if you place it there. Simplest: move the `.jks` into `android/`.

Wire it into `android/app/build.gradle`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            shrinkResources false
        }
    }
}
```

For a first release keep `minifyEnabled false`; R8 shrinking can strip reflection-based Capacitor plugin code. If you enable it later, add keep rules for `com.getcapacitor.**` and `com.subtranslate.app.**`.

---

## 6. Build the `.aab` in Android Studio

1. Open the project: `npm run cap:open` (or **File → Open → `android/`**).
2. Wait for **Gradle sync** to finish. First sync downloads Gradle + dependencies.
3. **Build → Generate Signed Bundle / APK…**
4. Choose **Android App Bundle** → **Next**.
5. Select the keystore you created, enter alias and passwords → **Next**.
6. Choose **release** → **Create**.

Output:

```text
android/app/release/app-release.aab
```

Command-line alternative (from `android/`):

```powershell
.\gradlew.bat bundleRelease
```

The same file appears at `android/app/build/outputs/bundle/release/app-release.aab`.

### Test before uploading

Install a debug build on a physical device:

```powershell
npm run cap:build
cd android
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

Then verify on the device:

- [ ] Onboarding completes and preferences persist after restart.
- [ ] Microphone permission prompt appears with rationale.
- [ ] Live transcription works with the **Web Speech** engine (uses Android's `SpeechRecognizer` via WebView/Chrome).
- [ ] **Display over other apps** settings opens and the toggle can be enabled.
- [ ] Floating overlay appears over another app, is draggable, and the notification **Stop** action ends it.
- [ ] **Instagram system audio:** Overlay page → **Capture Instagram audio** → accept the screen-capture prompt → open Instagram and play a video. The first run downloads the source-language model; captions should follow the video even with headphones or low volume.
- [ ] Switch back to **Launch microphone overlay** and confirm captions resume from the mic.
- [ ] Changing font size / background opacity / text colour in Settings updates the overlay live.
- [ ] Wi-Fi off: app shell still loads (service worker) and cached translations still resolve.
- [ ] Back button behaves (Capacitor `App` listener routes to the dashboard instead of closing mid-session).

> Overlays and continuous speech recognition are unreliable on emulators. Use a real phone, and test on at least one Samsung/Xiaomi device if possible because their battery managers are aggressive.

---

## 7. Publish to Google Play

1. Go to [play.google.com/console](https://play.google.com/console) → **Create app**.
2. Fill in:
   - App name: **SubTranslate**
   - Default language, app/game: **App**
   - Free/paid: **Free**
   - Accept the developer program policies.
3. **Set up → App signing**: enroll in **Play App Signing** (recommended). Upload the `.aab` from step 6 as the first release; Google stores the app signing key and you keep the upload key.
4. **Store listing**:
   - Short description (≤80 chars): `Live subtitles & translation for any app, on-device and private.`
   - Full description: explain transcription, 50+ languages, overlay, privacy.
   - App icon 512×512 PNG, feature graphic 1024×500 PNG, at least 2 phone screenshots.
5. **Data safety** — be accurate. SubTranslate:
   - Records audio **only while the user starts a session**.
   - Microphone mode uses the device mic; system-audio mode captures app playback through Android's `MediaProjection`/`AudioPlaybackCapture`.
   - On-device engines (Android `SpeechRecognizer`, Vosk) do not upload audio.
   - The optional Deepgram engine streams audio to Deepgram; disclose this and make it opt-in.
   - Text may be sent to MyMemory/LibreTranslate when translation is enabled; disclose it.
   - Supabase stores email + preferences if the user signs in.
6. **Content rating** questionnaire → complete honestly.
7. **Permissions**: declare `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` usage in the Play Console. Overlay permission requires a clear in-app explanation (onboarding step 3 covers it) and Play may request a short video demonstrating the core feature.
8. **Testing tracks**: start with **Internal testing** (up to 100 testers, no review delay) → **Closed testing** → **Production**.
9. Upload the `.aab` to the track, add release notes, roll out.

### Policy gotchas that get apps rejected

- **Microphone + overlay**: both are sensitive. The store listing and in-app onboarding must explain exactly why. Never start listening without an explicit tap.
- **Screen capture (`MediaProjection`)**: Play requires a prominent in-app disclosure that the app can capture everything on screen. SubTranslate uses it **only for audio**, immediately after an explicit tap, and the system consent dialog appears every session. Never start it silently or on app launch.
- **Background microphone**: Android shows the green privacy indicator; that is expected. Do not attempt to hide it.
- **Accessibility API**: do **not** use `AccessibilityService` to read other apps' audio or screen; SubTranslate uses the microphone and an overlay only.
- **Data safety mismatch** is the most common rejection reason. If you add analytics or ads later, update the form.

---

## 8. Updating the app

Checklist for every release:

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
2. `npm run cap:build`
3. Re-copy anything changed in `native/android/` (the generated folder is not the source of truth).
4. **Build → Generate Signed Bundle** → release.
5. Upload to the appropriate track, write release notes, roll out.

If you regenerate the Android platform (`rm -rf android && npx cap add android`), you must re-apply: Kotlin files, manifest additions, signing config, launcher icons, and `versionCode`.

---

## 9. Environment variables in the Android build

Vite inlines `VITE_*` variables **at build time**. Create `.env` before running `npm run build:pwa`:

```env
VITE_SUPABASE_URL=your_free_supabase_url
VITE_SUPABASE_ANON_KEY=your_free_supabase_anon_key
# optional — leave empty for fully local operation
VITE_DEEPGRAM_API_KEY=
VITE_DEEPGRAM_PROXY_URL=
VITE_LIBRETRANSLATE_URL=
```

Because the anon key is a public client key, this is safe **only** with Supabase Row Level Security enabled (see `supabase/schema.sql`). Never put a Deepgram key in a shipped build if you care about the credits — use `VITE_DEEPGRAM_PROXY_URL` pointing at a Supabase Edge Function that holds the secret.

After changing `.env`, always re-run `npm run cap:build`; the copied web assets in `android/` are a snapshot.

---

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk` |
| Gradle sync fails on JDK | Set Gradle JDK to 17 in Android Studio settings; `JAVA_HOME` must point to JDK 17 |
| Blank white screen in the app | Run `npm run cap:build`; check `android/app/src/main/assets/public/index.html` exists; inspect with `chrome://inspect` after enabling `webContentsDebuggingEnabled` |
| Overlay never appears | Grant "Display over other apps"; on MIUI/ColorOS also enable "Display pop-up windows while running in background" and disable battery optimisation |
| Service killed after a few minutes | OEM battery optimisation; ask users to set the app to **Unrestricted**; keep the foreground notification visible |
| `SpeechRecognizer` unavailable | Device lacks Google speech service, or language pack missing; install Google app / offline speech data, or use system-audio mode |
| Microphone button does nothing / permission denied | Settings → Apps → SubTranslate → Permissions → Microphone → **Allow**, then reopen the app. The APK asks Android directly; it never relies on the WebView browser prompt |
| System audio shows "No app audio yet" | The app opted out of playback capture, or media is DRM-protected. Try another app/video, raise the media volume, or use microphone mode |
| Model download fails | Check Wi-Fi; the model comes from `alphacephei.com`. Retry by stopping and starting system-audio mode. A failed download is deleted and retried |
| No offline model for a language | Vosk small models cover ~28 languages. Pick a supported source language or use microphone mode |
| Play rejects `versionCode` | Increment it; a code can never be reused |
| Upload key lost | Play Console → App signing → request upload key reset; requires a new keystore and re-upload |

---

## 11. Free-tier reality check

| Piece | Free option | Limit |
| --- | --- | --- |
| Android build | Android Studio + local SDK | Free |
| Signing | `keytool` | Free |
| Hosting (PWA) | Vercel / Cloudflare Pages / Netlify | Generous free tiers |
| Auth + DB | Supabase Free | 500 MB DB, 50k MAU |
| Speech | Web Speech API / Android SpeechRecognizer / Vosk (system audio) | Free, on-device, device-dependent |
| Offline Whisper | `@xenova/transformers` WASM (CDN, cached by SW) | Free, CPU-heavy, first load ~40–80 MB |
| Translation | MyMemory / LibreTranslate / offline phrasebook | Rate-limited but free |
| Play Store | Google Play Developer account | **$25 one-time** (only if publishing) |

Everything except the optional Play developer account can be built, tested, and sideloaded for **$0**.
