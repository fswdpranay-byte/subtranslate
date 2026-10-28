import { useEffect } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUiStore } from '@/store/useUiStore';
import { cn } from '@/lib/utils';

const toneStyles = {
  success: 'border-emerald-400/25 bg-emerald-950/80 text-emerald-100',
  error: 'border-rose-400/25 bg-rose-950/80 text-rose-100',
  info: 'border-white/10 bg-ink-900/95 text-ink-100',
};

const toneIcons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function ToastHost() {
  const toasts = useUiStore((state) => state.toasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), 5200),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismissToast]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 pb-[env(safe-area-inset-bottom)] sm:bottom-6">
      {toasts.map((toast) => {
        const Icon = toneIcons[toast.tone];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-md animate-fade-up items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl',
              toneStyles[toast.tone],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="rounded-md p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
