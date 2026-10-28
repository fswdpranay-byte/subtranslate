import { AlignCenter, AlignJustify, AlignLeft, Languages, Palette, Type } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { SubtitleCard } from '@/components/SubtitleCard';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import type { SubtitlePosition } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = ['#FFFFFF', '#FDE68A', '#67E8F9', '#A7F3D0', '#FBCFE8', '#FCA5A5'];

export function SubtitleCustomizer() {
  const preferences = usePreferencesStore((state) => state.preferences);
  const updateSubtitle = usePreferencesStore((state) => state.updateSubtitle);
  const setAutoTranslate = usePreferencesStore((state) => state.setAutoTranslate);

  return (
    <Card className="p-4">
      <CardHeader
        icon={<Palette className="h-4 w-4" />}
        title="Subtitle style"
        description="Live preview updates instantly — web and native overlay."
      />

      <div className="mt-4 rounded-xl bg-gradient-to-br from-ink-800 to-ink-950 p-2 ring-1 ring-inset ring-white/[0.06]">
        <SubtitleCard
          original="This is how your captions will look."
          translated="Así se verán tus subtítulos."
          style={preferences.subtitle}
          compact
        />
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Slider
            label="Font size"
            value={preferences.subtitle.fontSize}
            min={12}
            max={36}
            suffix="px"
            onChange={(fontSize) => updateSubtitle({ fontSize })}
          />
          <Slider
            label="Background"
            value={preferences.subtitle.backgroundOpacity}
            min={0}
            max={100}
            suffix="%"
            onChange={(backgroundOpacity) => updateSubtitle({ backgroundOpacity })}
          />
        </div>

        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-300">
            <Type className="h-3 w-3" /> Text color
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((color) => {
              const active = preferences.subtitle.textColor.toUpperCase() === color.toUpperCase();
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color} for subtitles`}
                  aria-pressed={active}
                  onClick={() => updateSubtitle({ textColor: color })}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition hover:scale-110',
                    active ? 'border-brand-300 ring-2 ring-brand-400/30' : 'border-white/20',
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
            <label
              title="Custom color"
              className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-white/30 bg-white/5"
            >
              <span className="pointer-events-none text-[9px] font-bold text-ink-300">+</span>
              <input
                type="color"
                aria-label="Pick a custom subtitle color"
                value={preferences.subtitle.textColor}
                onChange={(event) => updateSubtitle({ textColor: event.target.value })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-ink-300">
            <AlignJustify className="h-3 w-3" /> Position
          </span>
          <Segmented<SubtitlePosition>
            ariaLabel="Subtitle position"
            value={preferences.subtitle.position}
            onChange={(position) => updateSubtitle({ position })}
            options={[
              { value: 'top', label: 'Top', icon: <AlignLeft className="h-3 w-3 rotate-90" /> },
              { value: 'center', label: 'Center', icon: <AlignCenter className="h-3 w-3" /> },
              { value: 'bottom', label: 'Bottom', icon: <AlignLeft className="h-3 w-3 -rotate-90" /> },
            ]}
          />
        </div>

        <div className="space-y-3 border-t border-white/[0.06] pt-3">
          <Switch
            id="dual-language"
            checked={preferences.subtitle.showOriginal}
            onChange={(showOriginal) => updateSubtitle({ showOriginal })}
            label="Dual-language subtitles"
            description="Show the original transcript above the translation."
          />
          <Switch
            id="auto-translate"
            checked={preferences.autoTranslate}
            onChange={setAutoTranslate}
            disabled={preferences.targetLang === 'none'}
            label="Auto-translate captions"
            description={
              preferences.targetLang === 'none'
                ? 'Choose a subtitle language first.'
                : 'Translate each finalized line using the free provider.'
            }
          />
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-ink-400">
        <Languages className="h-3 w-3" /> Tip: drag the subtitle card anywhere in the simulator.
      </p>
    </Card>
  );
}
