import { useState } from 'react';
import type { CardLookup } from '@hsdeck/shared';
import { useBuilderStore } from '../../store/builder-store';
import { BasedOnPanel } from './BasedOnPanel';

const inputClass =
  'h-9 w-full rounded-md border border-line bg-bg px-2 text-sm placeholder:text-ink-faint focus:border-gold';

interface DeckMetaFieldsProps {
  defaultName: string;
  authorName: string;
  onAuthorNameChange: (value: string) => void;
  lookup: CardLookup;
}

/** Name, author, archetype, base-deck strip and description inputs of the deck panel. */
export function DeckMetaFields({
  defaultName,
  authorName,
  onAuthorNameChange,
  lookup,
}: DeckMetaFieldsProps) {
  const store = useBuilderStore();
  const [showDescription, setShowDescription] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor="deck-name">
        Deck name
      </label>
      <input
        id="deck-name"
        className={inputClass}
        placeholder={defaultName}
        maxLength={60}
        value={store.name}
        onChange={(e) => store.setName(e.target.value)}
      />
      <label className="sr-only" htmlFor="author-name">
        Your name
      </label>
      <input
        id="author-name"
        className={inputClass}
        placeholder="Your name"
        maxLength={40}
        value={authorName}
        onChange={(e) => onAuthorNameChange(e.target.value)}
      />
      <label className="sr-only" htmlFor="deck-archetype">
        Archetype
      </label>
      <input
        id="deck-archetype"
        className={inputClass}
        placeholder="Archetype, e.g. Attack Druid"
        maxLength={40}
        value={store.archetype ?? ''}
        onChange={(e) => store.setArchetype(e.target.value)}
      />
      <BasedOnPanel lookup={lookup} />
      {showDescription ? (
        <textarea
          aria-label="Deck description"
          rows={3}
          maxLength={2000}
          value={store.description}
          onChange={(e) => store.setDescription(e.target.value)}
          placeholder="How to play this deck, mulligan tips…"
          className="w-full resize-y rounded-md border border-line bg-bg p-2 text-sm placeholder:text-ink-faint focus:border-gold"
        />
      ) : (
        <button
          type="button"
          className="self-start text-xs text-gold hover:underline"
          onClick={() => setShowDescription(true)}
        >
          {store.description ? 'Edit description' : '+ Add description'}
        </button>
      )}
    </div>
  );
}
