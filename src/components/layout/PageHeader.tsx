import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  subtitle,
  showLogo = false,
  backTo,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
  backTo?: string;
  right?: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className={cn('mb-4 flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {showLogo ? (
          <Logo />
        ) : (
          <button
            type="button"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="truncate text-[11px] text-ink-400">{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}
