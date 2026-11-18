import type { CardOwnerClass } from '@hsdeck/shared';
import { classColor, classLabel } from '../lib/class-meta';
import { cn } from '../lib/format';

interface ClassBadgeProps {
  cls: CardOwnerClass;
  className?: string;
}

export function ClassBadge({ cls, className }: ClassBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', className)}>
      <span
        className="size-2.5 rounded-full"
        style={{ backgroundColor: classColor(cls) }}
        aria-hidden
      />
      {classLabel(cls)}
    </span>
  );
}
