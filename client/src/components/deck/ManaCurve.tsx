import { cn } from '../../lib/format';

interface ManaCurveProps {
  /** Eight buckets: 0,1,2,3,4,5,6 and 7+. */
  curve: number[];
  className?: string;
}

const LABELS = ['0', '1', '2', '3', '4', '5', '6', '7+'];

/**
 * Single-series bar chart: one hue, no legend, tooltip per bar, only the peak is
 * direct-labeled, and a visually hidden table carries the same data.
 */
export function ManaCurve({ curve, className }: ManaCurveProps) {
  const values = LABELS.map((_, i) => curve[i] ?? 0);
  const max = Math.max(0, ...values);
  const peakIndex = max > 0 ? values.indexOf(max) : -1;

  return (
    <figure className={cn('flex flex-col gap-1', className)}>
      <figcaption className="text-xs font-medium text-ink-muted">Mana curve</figcaption>
      <div className="flex h-24 items-end gap-1 border-b border-line" aria-hidden>
        {values.map((n, i) => {
          const label = LABELS[i] ?? '';
          const pct = max === 0 ? 0 : (n / max) * 100;
          return (
            <div
              key={label}
              className="group flex h-full flex-1 flex-col items-center justify-end"
              title={`${label} mana · ${n} card${n === 1 ? '' : 's'}`}
            >
              {i === peakIndex && (
                <span className="mb-0.5 text-[11px] leading-none text-ink-muted">{n}</span>
              )}
              <div
                className="w-full max-w-7 rounded-t-[4px] bg-gold transition-[height] group-hover:bg-gold-soft"
                style={{ height: `${pct}%`, minHeight: n > 0 ? 3 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1" aria-hidden>
        {LABELS.map((label) => (
          <span key={label} className="flex-1 text-center text-[10px] text-ink-faint">
            {label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Cards by mana cost</caption>
        <thead>
          <tr>
            <th scope="col">Mana cost</th>
            <th scope="col">Cards</th>
          </tr>
        </thead>
        <tbody>
          {values.map((n, i) => (
            <tr key={LABELS[i]}>
              <th scope="row">{LABELS[i]}</th>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
