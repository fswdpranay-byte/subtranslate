import { ArrowLeftRight, Languages } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { LanguagePicker } from '@/components/LanguagePicker';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { isSameLanguage } from '@/config/languages';

export function LanguageControls() {
  const preferences = usePreferencesStore((state) => state.preferences);
  const setSourceLang = usePreferencesStore((state) => state.setSourceLang);
  const setTargetLang = usePreferencesStore((state) => state.setTargetLang);
  const swapLanguages = usePreferencesStore((state) => state.swapLanguages);
  const autoTranslate = usePreferencesStore((state) => state.setAutoTranslate);

  const canSwap =
    preferences.sourceLang !== 'auto' && preferences.targetLang !== 'none';
  const sameLanguage = sameLanguageSafe(preferences.sourceLang, preferences.targetLang);

  return (
    <Card className="p-4">
      <CardHeader
        icon={<Languages className="h-4 w-4" />}
        title="Languages"
        description="Pick the audio you hear and the subtitles you want."
        action={
          <button
            type="button"
            onClick={swapLanguages}
            disabled={!canSwap}
            title="Swap source and target"
            aria-label="Swap source and target languages"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        }
      />

      <div className="mt-4 space-y-3">
        <LanguagePicker
          label="Audio language"
          value={preferences.sourceLang}
          onChange={setSourceLang}
          includeAuto
          hint="Auto-detect works best with Whisper and Deepgram. Browser speech uses your system language."
        />
        <LanguagePicker
          label="Subtitle language"
          value={preferences.targetLang}
          onChange={(code) => {
            setTargetLang(code);
            if (code !== 'none') autoTranslate(true);
          }}
          includeNone
        />
      </div>

      {sameLanguage ? (
        <p className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-200/80">
          Source and target are the same language — translation will be skipped. Pick another
          target, or use “No translation” for a plain transcript.
        </p>
      ) : null}

      {preferences.targetLang === 'none' ? (
        <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[10px] leading-relaxed text-ink-400">
          Translation is off. You’ll still get a live transcript in the original language.
        </p>
      ) : null}
    </Card>
  );
}

function sameLanguageSafe(source: string, target: string): boolean {
  if (source === 'auto') return false;
  return isSameLanguage(source, target);
}
