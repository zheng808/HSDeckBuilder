import type { DeckFormat } from '@hsdeck/shared';
import { cn } from '../lib/format';

export function FormatBadge({ format, className }: { format: DeckFormat; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        format === 'STANDARD' ? 'border-gold/50 text-gold' : 'border-ink-muted/50 text-ink-muted',
        className,
      )}
    >
      {format === 'STANDARD' ? 'Standard' : 'Wild'}
    </span>
  );
}
