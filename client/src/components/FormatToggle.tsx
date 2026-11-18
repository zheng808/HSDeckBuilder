import type { DeckFormat } from '@hsdeck/shared';
import { SegmentedControl } from './ui/SegmentedControl';

interface FormatToggleProps {
  value: DeckFormat;
  onChange: (format: DeckFormat) => void;
  size?: 'sm' | 'md';
}

export function FormatToggle({ value, onChange, size }: FormatToggleProps) {
  return (
    <SegmentedControl<DeckFormat>
      label="Deck format"
      size={size}
      value={value}
      onChange={onChange}
      options={[
        { value: 'STANDARD', label: 'Standard' },
        { value: 'WILD', label: 'Wild' },
      ]}
    />
  );
}
