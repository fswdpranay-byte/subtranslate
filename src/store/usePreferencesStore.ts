import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { appConfig } from '@/config/appConfig';
import type {
  EngineId,
  OnboardingState,
  OverlayPosition,
  Preferences,
  SubtitleStyle,
} from '@/types';
import { clamp, uid } from '@/lib/utils';

export const DEFAULT_PREFERENCES: Preferences = {
  sourceLang: 'auto',
  targetLang: 'en',
  engine: 'web-speech',
  autoTranslate: true,
  subtitle: {
    fontSize: 18,
    backgroundOpacity: 72,
    textColor: '#FFFFFF',
    position: 'bottom',
    showOriginal: true,
  },
  overlay: { x: 50, y: 80 },
  saveHistoryToCloud: false,
};

export const DEFAULT_ONBOARDING: OnboardingState = {
  completed: false,
  micGranted: false,
  overlayExplained: false,
  overlayGranted: false,
  completedAt: null,
};

interface PreferencesStore {
  preferences: Preferences;
  onboarding: OnboardingState;
  setSourceLang: (code: string) => void;
  setTargetLang: (code: string) => void;
  swapLanguages: () => void;
  setEngine: (engine: EngineId) => void;
  setAutoTranslate: (enabled: boolean) => void;
  updateSubtitle: (patch: Partial<SubtitleStyle>) => void;
  setOverlayPosition: (position: OverlayPosition) => void;
  setSaveHistoryToCloud: (enabled: boolean) => void;
  markMicGranted: (granted: boolean) => void;
  markOverlayExplained: () => void;
  markOverlayGranted: (granted: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  resetPreferences: () => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      onboarding: DEFAULT_ONBOARDING,

      setSourceLang: (code) =>
        set((state) => ({
          preferences: { ...state.preferences, sourceLang: code },
        })),

      setTargetLang: (code) =>
        set((state) => ({
          preferences: { ...state.preferences, targetLang: code },
        })),

      swapLanguages: () => {
        const { sourceLang, targetLang } = get().preferences;
        if (sourceLang === 'auto' || targetLang === 'none') return;
        set((state) => ({
          preferences: { ...state.preferences, sourceLang: targetLang, targetLang: sourceLang },
        }));
      },

      setEngine: (engine) =>
        set((state) => ({ preferences: { ...state.preferences, engine } })),

      setAutoTranslate: (enabled) =>
        set((state) => ({ preferences: { ...state.preferences, autoTranslate: enabled } })),

      updateSubtitle: (patch) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            subtitle: {
              ...state.preferences.subtitle,
              ...patch,
              fontSize: clamp(patch.fontSize ?? state.preferences.subtitle.fontSize, 12, 40),
              backgroundOpacity: clamp(
                patch.backgroundOpacity ?? state.preferences.subtitle.backgroundOpacity,
                0,
                100,
              ),
            },
          },
        })),

      setOverlayPosition: (position) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            overlay: {
              x: clamp(position.x, 4, 96),
              y: clamp(position.y, 6, 94),
            },
          },
        })),

      setSaveHistoryToCloud: (enabled) =>
        set((state) => ({
          preferences: { ...state.preferences, saveHistoryToCloud: enabled },
        })),

      markMicGranted: (granted) =>
        set((state) => ({ onboarding: { ...state.onboarding, micGranted: granted } })),

      markOverlayExplained: () =>
        set((state) => ({ onboarding: { ...state.onboarding, overlayExplained: true } })),

      markOverlayGranted: (granted) =>
        set((state) => ({
          onboarding: { ...state.onboarding, overlayGranted: granted, overlayExplained: true },
        })),

      completeOnboarding: () =>
        set((state) => ({
          onboarding: {
            ...state.onboarding,
            completed: true,
            completedAt: state.onboarding.completedAt ?? new Date().toISOString(),
          },
        })),

      resetOnboarding: () => set({ onboarding: DEFAULT_ONBOARDING }),

      resetPreferences: () =>
        set({ preferences: { ...DEFAULT_PREFERENCES, overlay: { ...DEFAULT_PREFERENCES.overlay } } }),
    }),
    {
      name: appConfig.storage.preferences,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ preferences: state.preferences, onboarding: state.onboarding }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PreferencesStore>;
        return {
          ...current,
          preferences: {
            ...DEFAULT_PREFERENCES,
            ...saved.preferences,
            subtitle: {
              ...DEFAULT_PREFERENCES.subtitle,
              ...saved.preferences?.subtitle,
            },
            overlay: { ...DEFAULT_PREFERENCES.overlay, ...saved.preferences?.overlay },
          },
          onboarding: { ...DEFAULT_ONBOARDING, ...saved.onboarding },
        };
      },
    },
  ),
);

/** Test helper / debugging only. */
export function createDemoSegment(original: string, translated?: string) {
  return {
    id: uid('demo'),
    original,
    translated,
    isFinal: true,
    at: Date.now(),
    translationState: translated ? ('done' as const) : ('skipped' as const),
  };
}
