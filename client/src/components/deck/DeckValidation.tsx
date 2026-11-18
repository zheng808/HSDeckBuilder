import { DECK_SIZE, type DeckIssue } from '@hsdeck/shared';

interface DeckValidationProps {
  issues: DeckIssue[];
  cardCount: number;
}

export function DeckValidation({ issues, cardCount }: DeckValidationProps) {
  const remaining = DECK_SIZE - cardCount;
  if (issues.length === 0 && remaining <= 0) {
    return (
      <p
        className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success"
        role="status"
      >
        ✓ Deck is complete and legal.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-sm" role="status">
      {remaining > 0 && (
        <p className="text-ink-muted">
          Add {remaining} more card{remaining === 1 ? '' : 's'} to publish.
        </p>
      )}
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1">
          {issues.map((issue, i) => (
            <li
              key={`${issue.code}-${issue.dbfId ?? i}`}
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-danger"
            >
              <span className="sr-only">Problem: </span>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
