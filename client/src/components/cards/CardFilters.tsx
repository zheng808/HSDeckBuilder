import { CARD_TYPES, RARITIES, type CardType, type Rarity } from '@hsdeck/shared';
import { cn, titleCase } from '../../lib/format';

export type OwnerFilter = 'ALL' | 'CLASS' | 'NEUTRAL';

export interface CardFilterState {
  q: string;
  cost: number | null; // 7 means 7+
  type: CardType | '';
  rarity: Rarity | '';
  owner: OwnerFilter;
}

export const EMPTY_FILTERS: CardFilterState = {
  q: '',
  cost: null,
  type: '',
  rarity: '',
  owner: 'ALL',
};

interface CardFiltersProps {
  value: CardFilterState;
  onChange: (next: CardFilterState) => void;
  resultCount: number;
}

const COSTS = [0, 1, 2, 3, 4, 5, 6, 7];
const selectClass =
  'h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:border-gold';

export function CardFilters({ value, onChange, resultCount }: CardFiltersProps) {
  const update = (patch: Partial<CardFilterState>) => onChange({ ...value, ...patch });
  const hasFilters = JSON.stringify(value) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="card-surface flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="card-search">
          Search cards
        </label>
        <input
          id="card-search"
          type="search"
          placeholder="Search name or text…"
          value={value.q}
          onChange={(e) => update({ q: e.target.value })}
          className="h-9 min-w-48 flex-1 rounded-md border border-line bg-surface px-3 text-sm placeholder:text-ink-faint focus:border-gold"
        />
        <label className="sr-only" htmlFor="card-type">
          Card type
        </label>
        <select
          id="card-type"
          className={selectClass}
          value={value.type}
          onChange={(e) => update({ type: e.target.value as CardType | '' })}
        >
          <option value="">All types</option>
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {titleCase(t)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="card-rarity">
          Rarity
        </label>
        <select
          id="card-rarity"
          className={selectClass}
          value={value.rarity}
          onChange={(e) => update({ rarity: e.target.value as Rarity | '' })}
        >
          <option value="">All rarities</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {titleCase(r)}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="card-owner">
          Class or neutral
        </label>
        <select
          id="card-owner"
          className={selectClass}
          value={value.owner}
          onChange={(e) => update({ owner: e.target.value as OwnerFilter })}
        >
          <option value="ALL">Class + Neutral</option>
          <option value="CLASS">Class only</option>
          <option value="NEUTRAL">Neutral only</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-muted">Mana</span>
        <div role="group" aria-label="Filter by mana cost" className="flex gap-1">
          {COSTS.map((c) => {
            const active = value.cost === c;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => update({ cost: active ? null : c })}
                className={cn(
                  'size-8 rounded-full text-sm font-bold transition-colors',
                  active
                    ? 'bg-mana text-white ring-2 ring-gold'
                    : 'bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                {c === 7 ? '7+' : c}
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-xs text-ink-muted" aria-live="polite">
          {resultCount} card{resultCount === 1 ? '' : 's'}
        </span>
        {hasFilters && (
          <button
            type="button"
            className="text-xs text-gold hover:underline"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
