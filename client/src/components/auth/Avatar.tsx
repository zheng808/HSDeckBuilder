import { useState } from 'react';
import { cn } from '../../lib/format';
import { initials } from '../../lib/auth';

interface AvatarProps {
  name: string;
  src: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'size-5 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-16 text-xl',
};

/** Round avatar image with an initials fallback when there is no image or it fails. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const base = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 font-semibold text-ink',
    SIZE[size],
    className,
  );
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(base, 'object-cover')}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className={base} role="img" aria-label={name}>
      {initials(name)}
    </span>
  );
}
