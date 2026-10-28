import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import { appConfig } from '@/config/appConfig';
import { isAndroidNative } from '@/lib/nativeOverlay';
import { applyUpdate, checkWebUpdate } from '@/lib/pwa';
import { toast, useUiStore } from '@/store/useUiStore';

/**
 * In-app update flow.
 *
 * - PWA / web: asks the service worker for a new build and activates it.
 * - Android: compares the installed versionCode with the rolling GitHub
 *   release, downloads the APK and hands it to Android's package installer.
 */

const RELEASE_API =
  'https://api.github.com/repos/fswdpranay-byte/subtranslate/releases/tags/android-latest';
export const APK_DOWNLOAD_URL =
  'https://github.com/fswdpranay-byte/subtranslate/releases/download/android-latest/subtranslate-debug.apk';
export const RELEASE_PAGE_URL =
  'https://github.com/fswdpranay-byte/subtranslate/releases/tag/android-latest';

interface AppUpdaterPlugin {
  canInstall: () => Promise<{ allowed: boolean }>;
  downloadAndInstall: (options: { url: string }) => Promise<{
    started: boolean;
    needsPermission?: boolean;
  }>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface ReleasePayload {
  body?: string | null;
  assets?: ReleaseAsset[];
}

export interface InstalledAppInfo {
  version: string;
  build: string;
  native: boolean;
}

const CHECK_THROTTLE_MS = 30 * 60 * 1000;
let lastCheckAt = 0;

export async function getInstalledAppInfo(): Promise<InstalledAppInfo> {
  if (isAndroidNative) {
    try {
      const info = await App.getInfo();
      return { version: info.version, build: info.build, native: true };
    } catch {
      /* fall through to the bundled version */
    }
  }
  return { version: appConfig.version, build: 'web', native: false };
}

function parseVersionCode(body: string | null | undefined): number | null {
  if (!body) return null;
  const match =
    body.match(/version\s*code[^0-9]{0,8}(\d+)/i) ??
    body.match(/build[^0-9]{0,8}(\d+)/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function parseVersionName(body: string | null | undefined): string | null {
  if (!body) return null;
  const match = body.match(/version\s*name[^0-9a-z]{0,8}([0-9][\w.\-]*)/i);
  return match ? match[1] : null;
}

async function fetchLatestRelease(): Promise<ReleasePayload> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GitHub responded with ${response.status}`);
    }
    return (await response.json()) as ReleasePayload;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Check for an update. Safe to call on mount, from a button, or when the app
 * returns to the foreground. Pass `silent` to skip the confirmation toasts.
 */
export async function checkForUpdates({ silent = false } = {}): Promise<boolean> {
  const ui = useUiStore.getState();
  if (ui.updateStatus === 'checking') return false;

  ui.setUpdateState('checking', 'Looking for a newer build…');

  if (!isAndroidNative) {
    const available = await checkWebUpdate();
    if (available) {
      ui.setUpdateState('available', 'A new build is downloaded and ready to activate.');
      if (!silent) toast('Update ready', 'Tap Update now to activate the new build.', 'info');
      return true;
    }
    ui.setUpdateState('current', 'You are running the newest web build.');
    if (!silent) toast('You are up to date', 'No newer web build was found.', 'success');
    return false;
  }

  try {
    const [release, installed] = await Promise.all([fetchLatestRelease(), getInstalledAppInfo()]);
    const latestCode = parseVersionCode(release.body);
    const latestName = parseVersionName(release.body) ?? 'latest';
    const currentCode = Number.parseInt(installed.build, 10) || 0;

    if (latestCode && latestCode > currentCode) {
      ui.setUpdateState(
        'available',
        `Version ${latestName} is ready to download and install.`,
        latestName,
      );
      if (!silent) {
        toast('Update available', `SubTranslate ${latestName} can be installed now.`, 'info');
      }
      return true;
    }

    ui.setUpdateState(
      'current',
      latestCode
        ? `You are on the latest Android build (${installed.version}).`
        : 'No newer Android build is published yet.',
      installed.version,
    );
    if (!silent) {
      toast(
        'You are up to date',
        latestCode
          ? `Build ${installed.build} is the newest release.`
          : 'The next CI build will publish a version to compare against.',
        'success',
      );
    }
    return false;
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'The update server took too long to respond.'
        : 'Could not reach the update server. Check your connection and try again.';
    ui.setUpdateState('error', message);
    if (!silent) toast('Update check failed', message, 'error');
    return false;
  }
}

/** Download and launch the Android installer, or activate a waiting PWA build. */
export async function installUpdate(): Promise<void> {
  if (!isAndroidNative) {
    await applyUpdate();
    return;
  }

  try {
    const permission = await AppUpdater.canInstall();

    if (!permission.allowed) {
      // The plugin opens Android's "Install unknown apps" screen instead of
      // downloading, so there is exactly one download request per tap.
      await AppUpdater.downloadAndInstall({ url: APK_DOWNLOAD_URL });
      toast(
        'Allow app installs',
        'Turn on "Install unknown apps" for SubTranslate, then tap Update now again.',
        'info',
      );
      return;
    }

    const result = await AppUpdater.downloadAndInstall({ url: APK_DOWNLOAD_URL });
    if (result.started) {
      useUiStore
        .getState()
        .setUpdateState(
          'installing',
          'Downloading the new APK. Android will ask you to install it when the download finishes.',
          useUiStore.getState().updateVersion,
        );
      useUiStore.getState().setUpdateAvailable(false);
      toast(
        'Downloading update',
        'Android will ask you to install it as soon as the download finishes.',
        'info',
      );
    } else if (result.needsPermission) {
      toast(
        'Allow app installs',
        'Turn on "Install unknown apps" for SubTranslate, then tap Update now again.',
        'info',
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The installer could not start.';
    toast(
      'Update could not start',
      `${message} You can download the APK directly from GitHub.`,
      'error',
    );
    // Last-resort fallback: open the download in the system browser.
    window.open(APK_DOWNLOAD_URL, '_blank', 'noopener');
  }
}

/** Android only: check quietly when the app launches or returns to view. */
export function useAutoUpdateCheck(): void {
  useEffect(() => {
    if (!isAndroidNative) return;

    const maybeCheck = () => {
      const now = Date.now();
      if (now - lastCheckAt < CHECK_THROTTLE_MS) return;
      lastCheckAt = now;
      void checkForUpdates({ silent: true });
    };

    maybeCheck();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeCheck();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
