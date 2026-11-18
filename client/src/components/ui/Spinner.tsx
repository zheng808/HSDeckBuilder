export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-ink-muted">
      <span
        className="size-5 animate-spin rounded-full border-2 border-gold border-t-transparent"
        aria-hidden
      />
      <span>{label}…</span>
    </div>
  );
}
