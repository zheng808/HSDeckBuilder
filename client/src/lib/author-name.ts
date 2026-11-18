const KEY = 'hsdeck.authorName';
export const DEFAULT_AUTHOR_NAME = 'Anonymous';

export function getAuthorName(): string {
  return localStorage.getItem(KEY) ?? DEFAULT_AUTHOR_NAME;
}

export function setAuthorName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) localStorage.setItem(KEY, trimmed.slice(0, 40));
  else localStorage.removeItem(KEY);
}
