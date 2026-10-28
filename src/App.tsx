import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AppLayout } from '@/components/layout/AppLayout';
import { PwaBanners } from '@/components/PwaBanners';
import { ToastHost } from '@/components/ui/ToastHost';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { OverlaySimulatorPage } from '@/features/overlay/OverlaySimulatorPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AuthPage } from '@/features/auth/AuthPage';
import { TranscriptionProvider } from '@/features/transcription/TranscriptionProvider';
import { useAuthStore } from '@/store/useAuthStore';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { useAutoUpdateCheck } from '@/lib/updater';
import type { ReactNode } from 'react';

function RequireOnboarding({ children }: { children: ReactNode }) {
  const completed = usePreferencesStore((state) => state.onboarding.completed);
  if (!completed) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);
  return null;
}

function useNativeBackButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;

    void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const atRoot = window.location.hash === '' || window.location.hash === '#/' || window.location.hash === '#';
      if (!atRoot && (canGoBack || window.history.length > 1)) {
        window.history.back();
      } else {
        void CapacitorApp.exitApp();
      }
    }).then((handle) => {
      remove = () => void handle.remove();
    });

    return () => remove?.();
  }, []);
}

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  useNativeBackButton();
  useAutoUpdateCheck();

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return (
    <TranscriptionProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/onboarding" element={<OnboardingFlow />} />
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={
              <RequireOnboarding>
                <DashboardPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/overlay"
            element={
              <RequireOnboarding>
                <OverlaySimulatorPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireOnboarding>
                <SettingsPage />
              </RequireOnboarding>
            }
          />
          <Route
            path="/auth"
            element={
              <RequireOnboarding>
                <AuthPage />
              </RequireOnboarding>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastHost />
      <PwaBanners />
    </TranscriptionProvider>
  );
}
