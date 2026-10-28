import { create } from 'zustand';
import { appConfig } from '@/config/appConfig';

interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'error';
}

interface UiStore {
  toasts: Toast[];
  updateAvailable: boolean;
  offlineReady: boolean;
  canInstall: boolean;
  installDismissed: boolean;
  simulatorRunning: boolean;

  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  setUpdateAvailable: (value: boolean) => void;
  setOfflineReady: (value: boolean) => void;
  setCanInstall: (value: boolean) => void;
  dismissInstall: () => void;
  setSimulatorRunning: (value: boolean) => void;
}

let toastSequence = 0;

export const useUiStore = create<UiStore>()((set) => ({
  toasts: [],
  updateAvailable: false,
  offlineReady: false,
  canInstall: false,
  installDismissed:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(appConfig.storage.installDismissed) === '1'
      : false,
  simulatorRunning: false,

  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...toast, id: `toast_${++toastSequence}` }],
    })),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  setUpdateAvailable: (value) => set({ updateAvailable: value }),
  setOfflineReady: (value) => set({ offlineReady: value }),
  setCanInstall: (value) => set({ canInstall: value }),
  dismissInstall: () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(appConfig.storage.installDismissed, '1');
    }
    set({ installDismissed: true, canInstall: false });
  },
  setSimulatorRunning: (value) => set({ simulatorRunning: value }),
}));

export function toast(title: string, description?: string, tone: Toast['tone'] = 'info'): void {
  useUiStore.getState().pushToast({ title, description, tone });
}
