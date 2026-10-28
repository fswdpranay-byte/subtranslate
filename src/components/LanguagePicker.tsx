import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { AUTO_LANGUAGE, LANGUAGES, NO_TRANSLATION, getLanguage } from '@/config/languages';
import { cn } from '@/lib/utils';

interface LanguagePickerProps {
  label: string;
  value: string;
  onChange: (code: string) => void;
  includeAuto?: boolean;
  includeNone?: boolean;
  disabled?: boolean;
  hint?: string;
}

export function LanguagePicker({
  label,
  value,
  onChange,
  includeAuto = false,
  includeNone = false,
  disabled = false,
  hint,
}: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = getLanguage(value);
  const display =
    value === NO_TRANSLATION.code
      ? NO_TRANSLATION
      : (selected ?? { ...AUTO_LANGUAGE, name: value, nativeName: value, flag: '🌐' });

  const options = useMemo(() => {
    const list = [...LANGUAGES];
    if (includeAuto) list.unshift(AUTO_LANGUAGE);
    if (includeNone) {
      list.unshift({
        code: NO_TRANSLATION.code,
        name: NO_TRANSLATION.name,
        nativeName: NO_TRANSLATION.nativeName,
        flag: NO_TRANSLATION.flag,
      });
    }
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (language) =>
        language.name.toLowerCase().includes(needle) ||
        language.nativeName.toLowerCase().includes(needle) ||
        language.code.toLowerCase().includes(needle),
    );
  }, [includeAuto, includeNone, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const select = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <>
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-ink-300">{label}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-ink-950/60 px-3 text-left transition hover:border-white/20 hover:bg-ink-950/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="text-lg leading-none" aria-hidden>
              {display.flag}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{display.name}</span>
              <span className="block truncate text-[10px] uppercase tracking-wide text-ink-400">
                {display.code}
              </span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
        </button>
        {hint ? <p className="text-[10px] leading-relaxed text-ink-500">{hint}</p> : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/80 backdrop-blur-sm sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl sm:max-h-[70vh] sm:max-w-md sm:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-[11px] text-ink-400">{options.length} options</p>
              </div>
              <button
                type="button"
                aria-label="Close language picker"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-ink-400 transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-white/[0.07] p-3">
              <div className="flex items-center gap-2 rounded-xl bg-ink-950/70 px-3 ring-1 ring-inset ring-white/10 focus-within:ring-brand-400/50">
                <Search className="h-4 w-4 text-ink-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search languages…"
                  className="h-10 w-full bg-transparent text-sm text-white placeholder:text-ink-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2" role="listbox">
              {options.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-ink-400">No language matches “{query}”.</p>
              ) : (
                options.map((language) => {
                  const active = language.code === value;
                  return (
                    <button
                      key={language.code}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => select(language.code)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                        active ? 'bg-brand-400/10' : 'hover:bg-white/5',
                      )}
                    >
                      <span className="text-xl leading-none" aria-hidden>
                        {language.flag}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-sm',
                            active ? 'font-semibold text-brand-100' : 'text-ink-100',
                          )}
                        >
                          {language.name}
                        </span>
                        <span className="block truncate text-[11px] text-ink-400">
                          {language.nativeName}
                        </span>
                      </span>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink-400">
                        {language.code}
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-brand-300" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
