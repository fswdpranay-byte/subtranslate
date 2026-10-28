import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';
import { usePreferencesStore } from '@/store/usePreferencesStore';
import { cn } from '@/lib/utils';

interface DraggableSubtitleProps {
  children: ReactNode;
}

/** Percentage-based drag surface so the overlay keeps its position on resize. */
export function DraggableSubtitle({ children }: DraggableSubtitleProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const position = usePreferencesStore((state) => state.preferences.overlay);
  const setOverlayPosition = usePreferencesStore((state) => state.setOverlayPosition);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Do not fight with scrolling on touch devices.
    event.preventDefault();
    const wrapper = wrapperRef.current;
    const stage = wrapper?.parentElement;
    if (!wrapper || !stage) return;

    const rect = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = position.x;
    const originY = position.y;
    setDragging(true);
    wrapper.setPointerCapture(event.pointerId);

    const move = (moveEvent: globalThis.PointerEvent) => {
      const x = originX + ((moveEvent.clientX - startX) / rect.width) * 100;
      const y = originY + ((moveEvent.clientY - startY) / rect.height) * 100;
      setOverlayPosition({ x, y });
    };

    const finish = () => {
      setDragging(false);
      wrapper.removeEventListener('pointermove', move);
      wrapper.removeEventListener('pointerup', finish);
      wrapper.removeEventListener('pointercancel', finish);
    };

    wrapper.addEventListener('pointermove', move);
    wrapper.addEventListener('pointerup', finish);
    wrapper.addEventListener('pointercancel', finish);
  };

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      className={cn(
        'absolute z-20 -translate-x-1/2 -translate-y-1/2 touch-none select-none rounded-xl',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={{ left: `${position.x}%`, top: `${position.y}%`, width: '90%' }}
    >
      {children}
      <span
        className={cn(
          'pointer-events-none absolute -top-6 right-0 flex items-center gap-1 rounded-full border border-white/15 bg-ink-950/80 px-2 py-0.5 text-[8px] font-medium text-ink-300 backdrop-blur transition-opacity',
          dragging ? 'opacity-100' : 'opacity-0 group-hover/sim:opacity-100',
        )}
      >
        <GripHorizontal className="h-2.5 w-2.5" /> drag
      </span>
    </div>
  );
}
