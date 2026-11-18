import {
  CARD_CLASSES,
  CLASS_DISPLAY_NAME,
  type CardClass,
  type CardOwnerClass,
} from '@hsdeck/shared';

/** CSS variable reference for a class color token defined in index.css. */
export function classColor(cls: CardOwnerClass): string {
  return cls === 'NEUTRAL' ? 'var(--color-ink-muted)' : `var(--color-class-${cls.toLowerCase()})`;
}

export function classLabel(cls: CardOwnerClass): string {
  return cls === 'NEUTRAL' ? 'Neutral' : CLASS_DISPLAY_NAME[cls];
}

export function isCardClass(value: string | null | undefined): value is CardClass {
  return (CARD_CLASSES as readonly string[]).includes(value ?? '');
}

export const RARITY_COLOR: Record<string, string> = {
  FREE: 'var(--color-rarity-common)',
  COMMON: 'var(--color-rarity-common)',
  RARE: 'var(--color-rarity-rare)',
  EPIC: 'var(--color-rarity-epic)',
  LEGENDARY: 'var(--color-rarity-legendary)',
};
