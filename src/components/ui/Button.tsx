import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-brand-400 to-brand-600 text-ink-950 font-semibold shadow-[0_10px_35px_-12px_rgba(34,211,238,0.7)] hover:from-brand-300 hover:to-brand-500 active:scale-[0.99]',
  secondary:
    'bg-white/[0.06] text-ink-100 ring-1 ring-inset ring-white/10 hover:bg-white/[0.1] active:scale-[0.99]',
  outline:
    'bg-transparent text-ink-100 ring-1 ring-inset ring-white/15 hover:bg-white/5 active:scale-[0.99]',
  ghost: 'bg-transparent text-ink-300 hover:bg-white/5 hover:text-white',
  danger:
    'bg-rose-600 text-white font-semibold hover:bg-rose-500 active:scale-[0.99] shadow-[0_10px_35px_-12px_rgba(244,63,94,0.7)]',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-2xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
