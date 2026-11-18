import { CARD_CLASSES, type CardClass } from '@hsdeck/shared';
import { classColor, classLabel } from '../lib/class-meta';
import { cn } from '../lib/format';

interface ClassPickerProps {
  value: CardClass | null;
  onChange: (cls: CardClass) => void;
}

export function ClassPicker({ value, onChange }: ClassPickerProps) {
  return (
    <div
      role="group"
      aria-label="Choose a class"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {CARD_CLASSES.map((cls) => {
        const active = cls === value;
        return (
          <button
            key={cls}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(cls)}
            className={cn(
              'card-surface flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2',
              active && 'ring-2 ring-gold',
            )}
            style={{ borderLeft: `4px solid ${classColor(cls)}` }}
          >
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: classColor(cls) }}
              aria-hidden
            />
            <span className="font-semibold">{classLabel(cls)}</span>
          </button>
        );
      })}
    </div>
  );
}
