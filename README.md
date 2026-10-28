# SubTranslate

Live audio transcription and translation with **system-wide subtitles** — built entirely on free infrastructure. React + Vite PWA, Capacitor Android app, on-device speech engines, and a native floating overlay.

> Listen once. Read in any language. Nothing leaves your device unless you choose a cloud engine.

---

## Features

- **Live transcription** from the microphone with an interim + final transcript view.
- **50+ target languages** with source auto-detection and dual-language captions.
- **Three engines**, switchable at runtime:
  - `Web Speech API` — instant, zero download, best on Chrome/Android.
  - `Whisper WASM` — `@xenova/transformers` on-device, private, cached offline.
  - `Deepgram` — cloud streaming fallback with free credits (optional, opt-in).
- **Subtitle customiser** — font size (12–32 px), background opacity (0–100 %), text colour, top/centre/bottom position, dual-language toggle.
- **Floating overlay** — draggable, semi-transparent card; a native `TYPE_APPLICATION_OVERLAY` service on Android and an in-browser **Overlay Simulator** for the PWA.
- **Privacy-first onboarding** — 4 steps: welcome, microphone rationale, overlay permission, interactive caption test.
- **Works offline** — service worker precaches the app shell and runtime-caches Whisper weights.
- **Optional accounts** — Supabase anonymous or email auth, profile + preferences sync. The app runs fully local without any keys.
- **Installable PWA** — custom manifest, maskable icons, install prompt, update banner.
- **Free translation chain** — LibreTranslate (if configured) → MyMemory (no key) → bundled offline phrasebook, with localStorage cache and rate limiting.

---

## Quick start

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>. No `.env` is required: with no keys the app runs in **local-only mode** using Web Speech and the offline translation fallback.

### Optional configuration

Copy `.env.example` to `.env` and fill in only what you need:

```env
VITE_SUPABASE_URL=your_free_supabase_url
VITE_SUPABASE_ANON_KEY=your_free_supabase_anon_key
VITE_DEEPGRAM_API_KEY=
VITE_DEEPGRAM_PROXY_URL=
VITE_LIBRETRANSLATE_URL=
```

| Variable | Needed for | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Accounts + preference sync | Run `supabase/schema.sql` in the Supabase SQL editor first. RLS is required. |
| `VITE_DEEPGRAM_API_KEY` | Deepgram engine | Browser WebSockets cannot set headers, so the key is passed as a query param. Fine for personal use; **not** for a public deployment. |
| `VITE_DEEPGRAM_PROXY_URL` | Deepgram in production | A Supabase Edge Function / small server that adds the `Authorization` header. Preferred over shipping a key. |
| `VITE_LIBRETRANSLATE_URL` | Self-hosted translation | e.g. a free LibreTranslate instance. Falls back to MyMemory when unset. |
| `VITE_TRANSLATION_PROVIDER` | Translation order | `mymemory` (default, no key) or `libretranslate`. |
| `VITE_WHISPER_MODEL` | Whisper engine | `Xenova/whisper-tiny` (default, ~40 MB) or `Xenova/whisper-base` (~80 MB). |
| `VITE_WHISPER_CHUNK_SECONDS` | Whisper latency | Audio chunk length; default `5`. |

Placeholder values such as `your_free_supabase_url` are treated as unset, so a half-filled `.env` never breaks startup.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `0.0.0.0:5173` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` / `npm run build:pwa` | Typecheck + production build into `dist/` (SW + manifest) |
| `npm run preview` | Serve the production build locally |
| `npm run cap:add:android` | Generate the `android/` project (once) |
| `npm run cap:build` | `vite build` + `npx cap sync android` |
| `npm run cap:open` | Open `android/` in Android Studio |
| `npm run icons` | Regenerate PWA icons from `scripts/generate-icons.ps1` |

---

## Project structure

```text
src/
  config/            appConfig.ts (isPaidMode, endpoints), languages.ts (70+ languages)
  services/
    audio/           PCM capture via AudioWorklet for streaming engines
    transcription/   registry + webSpeech, whisper (worker), deepgram engines
    translation.ts   LibreTranslate → MyMemory → offline phrasebook
  features/
    onboarding/      4-step flow with mic/overlay permission and live test
    dashboard/       live controls, language pickers, engine toggle, customiser, transcript
    overlay/         PWA overlay simulator with draggable captions
    settings/        preferences, privacy, engine status
    auth/            Supabase magic-link / anonymous sign-in
  components/        UI primitives, SubtitleCard, layout, PWA banners
  store/             Zustand: preferences (persisted), session, auth, UI
  hooks/             mic permission, elapsed timer, online status, native overlay
  lib/               supabase client, native bridge, PWA helpers, utils
native/android/      Kotlin overlay plugin + foreground service (reference sources)
supabase/schema.sql  profiles, preferences, history, RLS, new-user trigger
public/              icons, favicon, robots.txt
```

### Routing

`HashRouter` is used so the same build works on static hosts and inside Capacitor:

`#/` dashboard · `#/onboarding` · `#/overlay` · `#/settings` · `#/auth`

---

## How the engines work

1. **Web Speech** — `window.SpeechRecognition` / `webkitSpeechRecognition`, continuous + interim results. Free, but availability and offline language packs depend on the browser/OEM.
2. **Whisper WASM** — a module worker dynamically imports `@xenova/transformers` from jsDelivr (never bundled), runs `Xenova/whisper-tiny.en` on 16 kHz PCM from an `AudioWorklet`, and posts partial/final text back. Weights are cached by the service worker under `subtranslate-ml-models`, so the second launch is offline.
3. **Deepgram** — `wss://api.deepgram.com/v1/listen` with `linear16`, 16 kHz mono PCM, interim results, keep-alive pings. Only audio, never the full session, is streamed.

Translation is applied to **final** segments only. Results are cached in `localStorage` (`subtranslate:translations`) to avoid repeat requests and to survive offline.

---

## Android

**Install the latest build (no Android Studio needed):**

<https://github.com/fswdpranay-byte/subtranslate/releases/download/android-latest/subtranslate-debug.apk>

The GitHub Actions workflow rebuilds this **debug APK** on every push to `main`. On the phone: open the link, allow "Install unknown apps", install, then grant microphone, notifications, and **Display over other apps**.

### Two capture modes

| Mode | What it hears | Requirements |
| --- | --- | --- |
| Microphone | Sound in the room | Android 6+, mic permission |
| System audio | The audio **Instagram/TikTok/YouTube is playing** (headphones work) | Android 10+, screen-capture consent, one-time offline model download |

System audio uses `MediaProjection` + `AudioPlaybackCapture` and transcribes fully on-device with [Vosk](https://alphacephei.com/vosk/). Open **Overlay → Capture Instagram audio**, accept the prompt, then play a video. No audio is uploaded.

See **[ANDROID_GUIDE.md](./ANDROID_GUIDE.md)** for the complete path from source to a signed `.aab` in the Play Console, including:

- Capacitor platform sync and native overlay sources
- `SYSTEM_ALERT_WINDOW` / `FOREGROUND_SERVICE_MICROPHONE` / `FOREGROUND_SERVICE_MEDIA_PROJECTION` requirements
- keystore creation and Gradle signing config
- Play Console listing, data-safety answers, and policy gotchas

Quick version (local build):

```powershell
npm run build:pwa
npm run cap:sync android
npm run cap:open
```

---

## Deploying the PWA (free)

The output is a static site in `dist/`. Any free static host works:

- **Vercel** — import the repo, framework preset *Vite*, build `npm run build:pwa`, output `dist`.
- **Cloudflare Pages** — build command `npm run build:pwa`, output directory `dist`.
- **Netlify** — build `npm run build:pwa`, publish `dist`.
- **GitHub Pages** — works, but the app must be served from the repo subpath. Set `base: '/<repo>/'` in `vite.config.ts` and update the manifest `start_url`/`scope` accordingly.

HTTPS is required for microphone access and service workers. All the hosts above provide it by default.

---

## Free-tier limits to know

- **Web Speech** is free but its accuracy, language support, and offline behaviour vary by device.
- **Whisper tiny** is ~40–80 MB on first load and CPU-heavy; expect a delay on low-end phones.
- **MyMemory** has a daily character quota. For heavy use, self-host LibreTranslate or proxy through a Supabase Edge Function.
- **Supabase Free** pauses inactive projects after a week; a cron ping or manual visit reactivates it.
- **Deepgram** free credits are finite — keep it as an explicit fallback, not the default.

---

## Privacy

- Audio is captured only after the user taps **Start**.
- Web Speech and Whisper run on-device/browser; no audio is uploaded by those engines.
- Deepgram and translation APIs are opt-in and clearly labelled in Settings.
- Supabase stores only the account email and preferences; row-level security scopes every row to `auth.uid()`.
- No analytics, no ads, no third-party trackers.

---

## License

MIT. Speech models and third-party APIs retain their own licenses and terms.
