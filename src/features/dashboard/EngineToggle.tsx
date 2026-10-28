import { Check, Cpu, Lock, Sparkles, Zap } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { getEngineDescriptors } from '@/services/transcription';
import { cn } from '@/lib/utils';
import type { EngineDescriptor } from '@/types';

export function EngineToggle() {
  const selected = usePreferencesStore((state) => state.preferences.engine);
  const setEngine = usePreferencesStore((state) => state.setEngine);
  const engines = getEngineDescriptors();

  const onDevice = engines.filter((engine) => engine.mode === 'on-device');
  const trial = engines.filter((engine) => engine.mode === 'trial');

  return (
    <Card className="p-4">
      <CardHeader
        icon={<Cpu className="h-4 w-4" />}
        title="Caption engine"
        description="Switch freely — live sessions restart automatically."
      />

      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
            <Lock className="h-3 w-3" /> Zero-cost · private
          </div>
          <div className="space-y-1.5">
            {onDevice.map((engine) => (
              <EngineRow
                key={engine.id}
                engine={engine}
                selected={selected === engine.id}
                onSelect={() => setEngine(engine.id)}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent-400/80">
            <Sparkles className="h-3 w-3" /> Free trial credit
          </div>
          <div className="space-y-1.5">
            {trial.map((engine) => (
              <EngineRow
                key={engine.id}
                engine={engine}
                selected={selected === engine.id}
                onSelect={() => setEngine(engine.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
        <Zap className="mt-0.5 h-3 w-3 shrink-0" />
        On-device is the default. Deepgram only runs when a key or proxy URL is configured, so the
        app never needs paid infrastructure.
      </p>
    </Card>
  );
}

function EngineRow({
  engine,
  selected,
  onSelect,
}: {
  engine: EngineDescriptor;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = !engine.available;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
        selected
          ? 'border-brand-400/40 bg-brand-400/[0.07] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.08)]'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-brand-300 bg-brand-400 text-ink-950' : 'border-white/20',
        )}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-100">{engine.name}</span>
          {engine.badge ? (
            <Badge tone={engine.mode === 'trial' ? 'violet' : 'brand'} className="normal-case">
              {engine.badge}
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 block text-[11px] leading-relaxed text-ink-400">
          {engine.description}
        </span>
        {disabled && engine.reason ? (
          <span className="mt-1 block text-[10px] leading-relaxed text-amber-300/80">
            {engine.reason}
          </span>
        ) : null}
      </span>
    </button>
  );
}
