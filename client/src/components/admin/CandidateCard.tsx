import { useState } from 'react';
import { Link } from 'react-router';
import { DECK_SIZE, type ProCandidate } from '@hsdeck/shared';
import { useApproveCandidate, useRejectCandidate } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { relativeTime } from '../../lib/format';
import { ClassBadge } from '../ClassBadge';
import { FormatBadge } from '../FormatBadge';
import { SourceBadge } from '../deck/SourceBadge';
import { Button, buttonClasses } from '../ui/Button';
import { useToast } from '../ui/Toast';

const inputClass =
  'h-8 w-full rounded-md border border-line bg-bg px-2 text-sm placeholder:text-ink-faint focus:border-gold';

export function CandidateCard({ candidate }: { candidate: ProCandidate }) {
  const toast = useToast();
  const approve = useApproveCandidate();
  const reject = useRejectCandidate();
  const [name, setName] = useState(candidate.title.slice(0, 60));
  const [archetype, setArchetype] = useState(candidate.archetypeGuess ?? '');
  const busy = approve.isPending || reject.isPending;
  const pending = candidate.status === 'pending';
  const importable = candidate.issues.length === 0;

  const onApprove = () =>
    approve.mutate(
      { id: candidate.id, name: name.trim() || undefined, archetype: archetype.trim() || null },
      {
        onSuccess: ({ deck }) => toast.success(`Imported "${deck.name}".`),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  const onReject = () =>
    reject.mutate(candidate.id, {
      onSuccess: () => toast.push('Candidate rejected.'),
      onError: (err) => toast.error(errorMessage(err)),
    });

  return (
    <article className="card-surface flex flex-col gap-3 p-4" aria-label={candidate.title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">
            {candidate.source.url ? (
              <a
                href={candidate.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {candidate.title}
              </a>
            ) : (
              candidate.title
            )}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <SourceBadge source={candidate.source} />
            {candidate.heroClass && <ClassBadge cls={candidate.heroClass} className="text-xs" />}
            {candidate.format && <FormatBadge format={candidate.format} />}
            <span>
              {candidate.cardCount}/{DECK_SIZE} cards
            </span>
            <span>found {relativeTime(candidate.createdAt)}</span>
          </div>
        </div>
        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-ink-muted">
          {candidate.status}
        </span>
      </div>

      {candidate.issues.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-warning" aria-label="Problems">
          {candidate.issues.map((issue, i) => (
            <li key={i}>⚠ {issue}</li>
          ))}
        </ul>
      )}

      {pending && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Deck name
            <input
              className={inputClass}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Archetype
            <input
              className={inputClass}
              maxLength={40}
              placeholder="e.g. Attack Druid"
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {pending && (
          <>
            <Button
              size="sm"
              loading={approve.isPending}
              disabled={busy || !importable}
              title={importable ? 'Import as a published pro list' : 'Fix the problems first'}
              onClick={onApprove}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={reject.isPending}
              disabled={busy}
              onClick={onReject}
            >
              Reject
            </Button>
          </>
        )}
        {candidate.status === 'approved' && candidate.deckId && (
          <Link to={`/decks/${candidate.deckId}`} className={buttonClasses('secondary', 'sm')}>
            View imported deck
          </Link>
        )}
        <details className="ml-auto text-xs text-ink-muted">
          <summary className="cursor-pointer select-none">Deck code</summary>
          <code className="mt-1 block max-w-md break-all rounded bg-bg p-2 font-mono text-ink">
            {candidate.code}
          </code>
        </details>
      </div>
    </article>
  );
}
